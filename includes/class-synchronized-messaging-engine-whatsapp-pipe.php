<?php
/**
 * WhatsApp Business Cloud API connector.
 *
 * Inbound  — GET  /wp-json/sme/v1/webhooks/whatsapp  (hub verification)
 *            POST /wp-json/sme/v1/webhooks/whatsapp  (message events)
 *            Paste callback URL + verify token in:
 *            Meta for Developers → App → WhatsApp → Configuration → Webhooks
 *
 * Outbound — POST /wp-json/sme/v1/whatsapp/send
 *            Agents POST { conversationId, recipientId (phone), text }.
 *
 * Settings keys (stored under sme_platform_settings['whatsapp']):
 *   enabled, accessToken, phoneNumberId, wabaid, verifyToken,
 *   displayPhone, autoReply, autoReplyMsg, readReceipts
 *
 * @package Synchronized_Messaging_Engine
 */

defined( 'ABSPATH' ) || die( 'No script kiddies please!' );

class Synchronized_Messaging_Engine_Whatsapp_Pipe extends Synchronized_Messaging_Engine_Channel_Pipe_Base {

    const GRAPH_API = 'https://graph.facebook.com/v19.0/';

    public function get_channel_slug(): string {
        return 'whatsapp';
    }

    public function register_routes(): void {
        $ns = Synchronized_Messaging_Engine_Rest_Api::NAMESPACE_V1;

        // GET: webhook hub verification.
        register_rest_route(
            $ns,
            '/webhooks/whatsapp',
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
            '/whatsapp/send',
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

    // ── Webhook hub verification (GET) ─────────────────────────────────────

    public function handle_webhook_verify( WP_REST_Request $request ) {
        $cfg  = $this->get_settings();
        $mode  = (string) ( $request->get_param( 'hub_mode' ) ?? '' );
        $token = (string) ( $request->get_param( 'hub_verify_token' ) ?? '' );
        $challenge = (string) ( $request->get_param( 'hub_challenge' ) ?? '' );

        if ( 'subscribe' === $mode && hash_equals( (string) ( $cfg['verifyToken'] ?? '' ), $token ) ) {
            // Must return the raw challenge string, not JSON.
            return new WP_REST_Response( $challenge, 200, array( 'Content-Type' => 'text/plain' ) );
        }

        return new WP_Error( 'sme_forbidden', 'Verification failed.', array( 'status' => 403 ) );
    }

    // ── Inbound webhook (POST) ─────────────────────────────────────────────

    public function handle_webhook( WP_REST_Request $request ) {
        $cfg    = $this->get_settings();
        $body   = $request->get_json_params();

        if ( ! is_array( $body ) || ( $body['object'] ?? '' ) !== 'whatsapp_business_account' ) {
            return rest_ensure_response( array( 'ok' => true ) );
        }

        $entries = $body['entry'] ?? array();
        foreach ( $entries as $entry ) {
            $changes = $entry['changes'] ?? array();
            foreach ( $changes as $change ) {
                if ( ( $change['field'] ?? '' ) !== 'messages' ) {
                    continue;
                }
                $value    = $change['value'] ?? array();
                $messages = $value['messages'] ?? array();
                $contacts = $value['contacts'] ?? array();
                $contact_map = array();
                foreach ( $contacts as $c ) {
                    $contact_map[ $c['wa_id'] ] = $c['profile']['name'] ?? $c['wa_id'];
                }
                foreach ( $messages as $msg ) {
                    $this->process_message( $msg, $contact_map, $cfg );
                }
            }
        }

        return rest_ensure_response( array( 'ok' => true ) );
    }

    private function process_message( array $msg, array $contact_map, array $cfg ): void {
        $from        = (string) ( $msg['from'] ?? '' );
        $msg_id      = (string) ( $msg['id'] ?? '' );
        $type        = (string) ( $msg['type'] ?? 'text' );
        $contact_name = $contact_map[ $from ] ?? $from;

        $text = match ( $type ) {
            'text'     => (string) ( $msg['text']['body'] ?? '' ),
            'image'    => '[Image' . ( isset( $msg['image']['caption'] ) ? ': ' . $msg['image']['caption'] : '' ) . ']',
            'video'    => '[Video' . ( isset( $msg['video']['caption'] ) ? ': ' . $msg['video']['caption'] : '' ) . ']',
            'audio'    => '[Voice message]',
            'document' => '[Document: ' . ( $msg['document']['filename'] ?? 'file' ) . ']',
            'sticker'  => '[Sticker]',
            'location' => '[Location: ' . ( $msg['location']['name'] ?? 'lat ' . ( $msg['location']['latitude'] ?? '' ) ) . ']',
            'contacts' => '[Contact card]',
            default    => '[Unsupported: ' . $type . ']',
        };

        if ( '' === $from ) {
            return;
        }

        $subject         = mb_substr( $text, 0, 80 ) ?: 'WhatsApp message';
        $conversation_id = $this->find_or_create_conversation(
            $from, $contact_name, '+' . ltrim( $from, '+' ), $subject
        );

        if ( is_wp_error( $conversation_id ) ) {
            error_log( '[SME WhatsApp] DB error: ' . $conversation_id->get_error_message() );
            return;
        }

        $this->store_message(
            $conversation_id,
            esc_html( $text ),
            'contact',
            $contact_name,
            array( 'channel' => 'whatsapp', 'from' => $from, 'type' => $type, 'msgId' => $msg_id ),
            'wa_' . $msg_id
        );

        // Mark as read in WhatsApp.
        if ( ! empty( $cfg['readReceipts'] ) && '' !== $msg_id ) {
            $this->mark_read( $msg_id, $cfg );
        }

        $this->maybe_send_auto_reply( $from, $contact_name, (string) $conversation_id );

        do_action( 'sme_inbound_message_received', $conversation_id, 'whatsapp', array(
            'from' => $from, 'text' => $text, 'type' => $type,
        ) );
    }

    // ── Outbound send ─────────────────────────────────────────────────────

    protected function send_message( string $recipient_id, string $text, array $cfg = array() ) {
        if ( empty( $cfg ) ) {
            $cfg = $this->get_settings();
        }
        $token          = (string) ( $cfg['accessToken'] ?? '' );
        $phone_number_id = (string) ( $cfg['phoneNumberId'] ?? '' );

        if ( '' === $token || '' === $phone_number_id ) {
            return new \WP_Error(
                'sme_whatsapp_not_configured',
                __( 'WhatsApp accessToken and phoneNumberId are required.', 'synchronized-messaging-engine' )
            );
        }

        $result = $this->http_post_json(
            self::GRAPH_API . $phone_number_id . '/messages',
            array(
                'messaging_product' => 'whatsapp',
                'recipient_type'    => 'individual',
                'to'                => $recipient_id,
                'type'              => 'text',
                'text'              => array( 'body' => $text, 'preview_url' => false ),
            ),
            array( 'Authorization' => 'Bearer ' . $token )
        );

        if ( is_wp_error( $result ) ) {
            return new \WP_Error(
                'sme_whatsapp_send_error',
                sprintf( __( 'WhatsApp API error: %s', 'synchronized-messaging-engine' ), $result->get_error_message() ),
                array( 'status' => 502 )
            );
        }

        return $result;
    }

    private function mark_read( string $message_id, array $cfg ): void {
        $token          = (string) ( $cfg['accessToken'] ?? '' );
        $phone_number_id = (string) ( $cfg['phoneNumberId'] ?? '' );
        if ( '' === $token || '' === $phone_number_id ) {
            return;
        }
        $this->http_post_json(
            self::GRAPH_API . $phone_number_id . '/messages',
            array(
                'messaging_product' => 'whatsapp',
                'status'            => 'read',
                'message_id'        => $message_id,
            ),
            array( 'Authorization' => 'Bearer ' . $token )
        );
    }
}
