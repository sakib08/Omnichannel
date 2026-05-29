<?php
/**
 * Instagram DM connector (Meta Messaging API).
 *
 * Instagram Direct Messages use the same Meta platform as Messenger but
 * target the Instagram Graph API surface.  Your Meta App must have
 * instagram_manage_messages and instagram_basic permissions approved.
 *
 * Inbound  — GET  /wp-json/sme/v1/webhooks/instagram  (hub verification)
 *            POST /wp-json/sme/v1/webhooks/instagram  (DM events)
 *            Register in: Meta for Developers → App → Instagram → Webhooks
 *            Subscribe to: messages, messaging_postbacks, messaging_seen
 *
 * Outbound — POST /wp-json/sme/v1/instagram/send
 *            Agents POST { conversationId, recipientId (IGSID), text }.
 *
 * Settings keys (stored under sme_platform_settings['instagram']):
 *   enabled, igAccountId, pageId, pageToken, appId, appSecret,
 *   verifyToken, fetchProfile, typingIndicator, readReceipts,
 *   imageAttach, storyReplies, autoAssign, autoReply, autoReplyMsg
 *
 * @package Synchronized_Messaging_Engine
 */

defined( 'ABSPATH' ) || die( 'No script kiddies please!' );

class Synchronized_Messaging_Engine_Instagram_Pipe extends Synchronized_Messaging_Engine_Channel_Pipe_Base {

    const GRAPH_API = 'https://graph.facebook.com/v19.0/';

    public function get_channel_slug(): string {
        return 'instagram';
    }

    public function register_routes(): void {
        $ns = Synchronized_Messaging_Engine_Rest_Api::NAMESPACE_V1;

        // GET: hub verification, POST: DM events.
        register_rest_route(
            $ns,
            '/webhooks/instagram',
            array(
                array(
                    'methods'             => WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'handle_webhook_verify' ),
                    'permission_callback' => '__return_true',
                ),
                array(
                    'methods'             => WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'handle_webhook' ),
                    'permission_callback' => '__return_true',
                ),
            )
        );

        register_rest_route(
            $ns,
            '/instagram/send',
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'handle_send' ),
                'permission_callback' => array( $this, 'check_access' ),
                'args'                => array(
                    'conversationId' => array( 'required' => true, 'type' => 'integer' ),
                    'recipientId'    => array( 'required' => true, 'type' => 'string' ),
                    'text'           => array( 'required' => true, 'type' => 'string' ),
                ),
            )
        );
    }

    // ── Hub verification (GET) ─────────────────────────────────────────────

    public function handle_webhook_verify( WP_REST_Request $request ) {
        $cfg       = $this->get_settings();
        $mode      = (string) ( $request->get_param( 'hub_mode' ) ?? '' );
        $token     = (string) ( $request->get_param( 'hub_verify_token' ) ?? '' );
        $challenge = (string) ( $request->get_param( 'hub_challenge' ) ?? '' );

        if ( 'subscribe' === $mode && hash_equals( (string) ( $cfg['verifyToken'] ?? '' ), $token ) ) {
            return new WP_REST_Response( $challenge, 200, array( 'Content-Type' => 'text/plain' ) );
        }

        return new WP_Error( 'sme_forbidden', 'Verification failed.', array( 'status' => 403 ) );
    }

    // ── Inbound webhook (POST) ─────────────────────────────────────────────

    public function handle_webhook( WP_REST_Request $request ) {
        $cfg  = $this->get_settings();
        $body = $request->get_json_params();

        // Verify X-Hub-Signature-256 when appSecret is set.
        $app_secret = (string) ( $cfg['appSecret'] ?? '' );
        if ( '' !== $app_secret ) {
            $sig_header = (string) ( $request->get_header( 'x-hub-signature-256' ) ?? '' );
            $raw_body   = $request->get_body();
            $expected   = 'sha256=' . hash_hmac( 'sha256', $raw_body, $app_secret );
            if ( ! hash_equals( $expected, $sig_header ) ) {
                return new WP_Error( 'sme_unauthorized', 'Signature mismatch.', array( 'status' => 401 ) );
            }
        }

        if ( ! is_array( $body ) || ( $body['object'] ?? '' ) !== 'instagram' ) {
            return rest_ensure_response( array( 'ok' => true ) );
        }

        foreach ( $body['entry'] ?? array() as $entry ) {
            foreach ( $entry['messaging'] ?? array() as $event ) {
                $this->dispatch_event( $event, $cfg );
            }
        }

        return rest_ensure_response( array( 'ok' => true ) );
    }

    private function dispatch_event( array $event, array $cfg ): void {
        if ( isset( $event['message'] ) && empty( $event['message']['is_echo'] ) ) {
            $this->process_message( $event, $cfg );
        } elseif ( isset( $event['postback'] ) ) {
            $this->process_postback( $event, $cfg );
        }
    }

    private function process_message( array $event, array $cfg ): void {
        $sender_id   = (string) ( $event['sender']['id'] ?? '' );
        $mid         = (string) ( $event['message']['mid'] ?? '' );
        $text        = (string) ( $event['message']['text'] ?? '' );
        $attachments = $event['message']['attachments'] ?? array();

        if ( '' === $sender_id ) {
            return;
        }

        // Resolve attachment text when no text body.
        if ( '' === $text && ! empty( $attachments ) ) {
            $first = $attachments[0];
            $type  = $first['type'] ?? 'unknown';
            $text  = match ( $type ) {
                'image'    => '[Image]',
                'video'    => '[Video]',
                'audio'    => '[Audio]',
                'file'     => '[File attachment]',
                'story_mention' => '[Story mention]',
                default    => '[Attachment: ' . $type . ']',
            };
        }

        // Story reply: mark as such.
        if ( isset( $event['message']['reply_to']['story'] ) ) {
            if ( empty( $cfg['storyReplies'] ) ) {
                return; // Story replies disabled.
            }
            $text = '[Story reply] ' . $text;
        }

        if ( '' === $text ) {
            $text = '[DM]';
        }

        $contact_name    = $this->maybe_get_username( $sender_id, $cfg );
        $subject         = mb_substr( $text, 0, 80 ) ?: 'Instagram DM';
        $conversation_id = $this->find_or_create_conversation(
            $sender_id, $contact_name, '@' . ltrim( $contact_name, '@' ), $subject
        );

        if ( is_wp_error( $conversation_id ) ) {
            error_log( '[SME Instagram] DB error: ' . $conversation_id->get_error_message() );
            return;
        }

        $this->store_message(
            $conversation_id,
            esc_html( $text ),
            'contact',
            $contact_name,
            array( 'channel' => 'instagram', 'igsid' => $sender_id, 'mid' => $mid ),
            'ig_' . $mid
        );

        // Typing indicator.
        if ( ! empty( $cfg['typingIndicator'] ) ) {
            $this->send_sender_action( $sender_id, 'typing_on', $cfg );
        }

        $this->maybe_send_auto_reply( $sender_id, $contact_name, (string) $conversation_id );

        do_action( 'sme_inbound_message_received', $conversation_id, 'instagram', array(
            'igsid' => $sender_id, 'text' => $text,
        ) );
    }

    private function process_postback( array $event, array $cfg ): void {
        $sender_id = (string) ( $event['sender']['id'] ?? '' );
        $payload   = (string) ( $event['postback']['payload'] ?? '' );
        $title     = (string) ( $event['postback']['title'] ?? $payload );

        if ( '' === $sender_id ) {
            return;
        }

        $contact_name    = $this->maybe_get_username( $sender_id, $cfg );
        $conversation_id = $this->find_or_create_conversation(
            $sender_id, $contact_name, '@' . ltrim( $contact_name, '@' ), 'Postback: ' . $title
        );

        if ( ! is_wp_error( $conversation_id ) ) {
            $this->store_message(
                $conversation_id,
                '[Postback: ' . esc_html( $title ) . ']',
                'contact',
                $contact_name,
                array( 'channel' => 'instagram', 'igsid' => $sender_id, 'postback' => $payload )
            );
            $this->maybe_send_auto_reply( $sender_id, $contact_name, (string) $conversation_id );
        }
    }

    // ── Outbound send ─────────────────────────────────────────────────────

    protected function send_message( string $recipient_id, string $text, array $cfg = array() ) {
        if ( empty( $cfg ) ) {
            $cfg = $this->get_settings();
        }
        $token = (string) ( $cfg['pageToken'] ?? '' );
        if ( '' === $token ) {
            return new \WP_Error(
                'sme_instagram_not_configured',
                __( 'Instagram Page Access Token is not configured.', 'synchronized-messaging-engine' )
            );
        }

        $result = $this->http_post_json(
            self::GRAPH_API . 'me/messages?access_token=' . rawurlencode( $token ),
            array(
                'recipient'      => array( 'id' => $recipient_id ),
                'message'        => array( 'text' => $text ),
                'messaging_type' => 'RESPONSE',
            )
        );

        if ( is_wp_error( $result ) ) {
            return new \WP_Error(
                'sme_instagram_send_error',
                sprintf( __( 'Instagram API error: %s', 'synchronized-messaging-engine' ), $result->get_error_message() ),
                array( 'status' => 502 )
            );
        }

        return $result;
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private function send_sender_action( string $igsid, string $action, array $cfg ): void {
        $token = (string) ( $cfg['pageToken'] ?? '' );
        if ( '' === $token ) {
            return;
        }
        $this->http_post_json(
            self::GRAPH_API . 'me/messages?access_token=' . rawurlencode( $token ),
            array(
                'recipient'     => array( 'id' => $igsid ),
                'sender_action' => $action,
            )
        );
    }

    /**
     * Fetch the Instagram username for an IGSID via the Graph API.
     * Caches the result per user for 6 hours.
     */
    private function maybe_get_username( string $igsid, array $cfg ): string {
        if ( empty( $cfg['fetchProfile'] ) ) {
            return 'Instagram User';
        }

        $cache_key = 'sme_ig_profile_' . md5( $igsid );
        $cached    = get_transient( $cache_key );
        if ( false !== $cached ) {
            return (string) $cached;
        }

        $token = (string) ( $cfg['pageToken'] ?? '' );
        if ( '' === $token ) {
            return 'Instagram User';
        }

        $url  = self::GRAPH_API . $igsid . '?fields=username,name&access_token=' . rawurlencode( $token );
        $data = $this->http( $url );

        if ( is_wp_error( $data ) ) {
            return 'Instagram User';
        }

        $name = (string) ( $data['username'] ?? $data['name'] ?? '' );
        if ( '' !== $name ) {
            $name = '@' . ltrim( $name, '@' );
        } else {
            $name = 'Instagram User';
        }

        set_transient( $cache_key, $name, 6 * HOUR_IN_SECONDS );
        return $name;
    }
}
