<?php
/**
 * Instagram DM connector (Meta Messaging API).
 *
 * Instagram Direct Messages use the same Meta platform as Messenger but
 * target the Instagram Graph API surface.  Your Meta App must have
 * instagram_manage_messages and instagram_basic permissions approved.
 *
 * Inbound  — GET  /wp-json/kmbp/v1/webhooks/instagram  (hub verification)
 *            POST /wp-json/kmbp/v1/webhooks/instagram  (DM events)
 *            Register in: Meta for Developers → App → Instagram → Webhooks
 *            Subscribe to: messages, messaging_postbacks, messaging_seen
 *
 * Outbound — POST /wp-json/kmbp/v1/instagram/send
 *            Agents POST { conversationId, recipientId (IGSID), text }.
 *
 * Settings keys (stored under kmbp_platform_settings['instagram']):
 *   enabled, igAccountId, pageId, pageToken, appId, appSecret,
 *   verifyToken, fetchProfile, typingIndicator, readReceipts,
 *   imageAttach, storyReplies, autoAssign, autoReply, autoReplyMsg
 *
 * @package Kinetix_Messaging_By_Ppros
 */

defined( 'ABSPATH' ) || die( 'No script kiddies please!' );

class Kinetix_Messaging_By_Ppros_Instagram_Pipe extends Kinetix_Messaging_By_Ppros_Channel_Pipe_Base {

    const GRAPH_API = 'https://graph.facebook.com/v23.0/';

    public function get_channel_slug(): string {
        return 'instagram';
    }

    public function register_routes(): void {
        $ns = Kinetix_Messaging_By_Ppros_Rest_Api::NAMESPACE_V1;

        // GET: hub verification, POST: DM events.
        register_rest_route(
            $ns,
            '/webhooks/instagram',
            array(
                array(
                    'methods'             => WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'handle_webhook_verify' ),
                    'permission_callback' => array( $this, 'check_meta_hub_verify_permission' ),
                ),
                array(
                    'methods'             => WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'handle_webhook' ),
                    'permission_callback' => array( $this, 'check_meta_inbound_webhook_permission' ),
                ),
            )
        );

        register_rest_route(
            $ns,
            '/instagram/test-connection',
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'handle_test_connection' ),
                'permission_callback' => array( $this, 'check_manage_settings' ),
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
        $challenge = $this->meta_hub_param( $request, 'challenge' );
        return new WP_REST_Response( $challenge, 200, array( 'Content-Type' => 'text/plain' ) );
    }

    // ── Inbound webhook (POST) ─────────────────────────────────────────────

    public function handle_webhook( WP_REST_Request $request ) {
        $cfg  = $this->get_settings();
        $body = $request->get_json_params();

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
            $this->log_debug( '[KMBP Instagram] DB error: ' . $conversation_id->get_error_message() );
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

        do_action( 'kmbp_inbound_message_received', $conversation_id, 'instagram', array(
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
                'kmbp_instagram_not_configured',
                __( 'Instagram Page Access Token is not configured.', 'kinetix-messaging-by-ppros' )
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
                'kmbp_instagram_send_error',
                sprintf(
                    /* translators: %s: Instagram API error message */
                    __( 'Instagram API error: %s', 'kinetix-messaging-by-ppros' ),
                    $result->get_error_message()
                ),
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

        $cache_key = 'kmbp_ig_profile_' . md5( $igsid );
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

    /**
     * Confirm the Page token is linked to an Instagram professional account.
     */
    public function handle_test_connection() {
        $cfg   = $this->get_settings();
        $token = trim( (string) ( $cfg['pageToken'] ?? '' ) );
        if ( '' === $token ) {
            return new WP_Error(
                'kmbp_instagram_not_configured',
                __( 'Enter a Page Access Token first.', 'kinetix-messaging-by-ppros' ),
                array( 'status' => 400 )
            );
        }

        $me = $this->http(
            self::GRAPH_API . 'me?fields=id,name,instagram_business_account{id,username,name}&access_token=' . rawurlencode( $token )
        );
        if ( is_wp_error( $me ) ) {
            return new WP_Error( 'kmbp_instagram_verify_failed', $me->get_error_message(), array( 'status' => 400 ) );
        }

        $page_id = preg_replace( '/\D+/', '', (string) ( $me['id'] ?? '' ) );
        $ig      = isset( $me['instagram_business_account'] ) && is_array( $me['instagram_business_account'] ) ? $me['instagram_business_account'] : array();
        $ig_id   = preg_replace( '/\D+/', '', (string) ( $ig['id'] ?? '' ) );
        if ( ! is_string( $ig_id ) || '' === $ig_id ) {
            return new WP_Error(
                'kmbp_instagram_verify_failed',
                __( 'This token is not linked to an Instagram professional account.', 'kinetix-messaging-by-ppros' ),
                array( 'status' => 400 )
            );
        }

        $expected_page = preg_replace( '/\D+/', '', (string) ( $cfg['pageId'] ?? '' ) );
        if ( is_string( $expected_page ) && '' !== $expected_page && is_string( $page_id ) && $expected_page !== $page_id ) {
            return new WP_Error(
                'kmbp_instagram_page_mismatch',
                sprintf(
                    /* translators: 1: token page id, 2: typed page id */
                    __( 'This token belongs to Facebook Page %1$s, not %2$s.', 'kinetix-messaging-by-ppros' ),
                    $page_id,
                    $expected_page
                ),
                array( 'status' => 400 )
            );
        }

        $expected_ig = preg_replace( '/\D+/', '', (string) ( $cfg['igAccountId'] ?? '' ) );
        if ( is_string( $expected_ig ) && '' !== $expected_ig && $expected_ig !== $ig_id ) {
            return new WP_Error(
                'kmbp_instagram_account_mismatch',
                sprintf(
                    /* translators: 1: token Instagram account id, 2: typed Instagram account id */
                    __( 'This token is linked to Instagram account %1$s, not %2$s.', 'kinetix-messaging-by-ppros' ),
                    $ig_id,
                    $expected_ig
                ),
                array( 'status' => 400 )
            );
        }

        $username = sanitize_text_field( (string) ( $ig['username'] ?? '' ) );
        $this->remember_instagram_ids( is_string( $page_id ) ? $page_id : '', $ig_id );

        $label = '' !== $username ? '@' . ltrim( $username, '@' ) : $ig_id;
        return rest_ensure_response(
            array(
                'ok'          => true,
                'pageId'      => is_string( $page_id ) ? $page_id : '',
                'igAccountId' => $ig_id,
                'username'    => $username,
                'message'     => sprintf(
                    /* translators: %s: Instagram username or account id */
                    __( 'Connected to %s.', 'kinetix-messaging-by-ppros' ),
                    $label
                ),
            )
        );
    }

    /**
     * Fill empty Instagram and Page IDs after a successful check.
     */
    private function remember_instagram_ids( string $page_id, string $ig_id ): void {
        $all = get_option( Kinetix_Messaging_By_Ppros_Activator::SETTINGS_OPTION, array() );
        if ( ! is_array( $all ) ) {
            return;
        }
        $cfg     = isset( $all['instagram'] ) && is_array( $all['instagram'] ) ? $all['instagram'] : array();
        $changed = false;
        if ( '' !== $page_id && '' === trim( (string) ( $cfg['pageId'] ?? '' ) ) ) {
            $cfg['pageId'] = $page_id;
            $changed       = true;
        }
        if ( '' !== $ig_id && '' === trim( (string) ( $cfg['igAccountId'] ?? '' ) ) ) {
            $cfg['igAccountId'] = $ig_id;
            $changed            = true;
        }
        if ( ! $changed ) {
            return;
        }
        $all['instagram'] = $cfg;
        update_option( Kinetix_Messaging_By_Ppros_Activator::SETTINGS_OPTION, $all, false );
    }
}
