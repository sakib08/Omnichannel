<?php
/**
 * Viber Bot / Business Messages connector.
 *
 * Inbound  — POST /wp-json/sme/v1/webhooks/viber
 *            Viber pushes signed JSON events to this endpoint.
 *            Register with:
 *              curl -X POST https://chatapi.viber.com/pa/set_webhook \
 *                -H "X-Viber-Auth-Token: <AUTH_TOKEN>" \
 *                -H "Content-Type: application/json" \
 *                -d '{"url":"<SITE>/wp-json/sme/v1/webhooks/viber",
 *                     "event_types":["message","delivered","seen","failed"]}'
 *
 * Outbound — POST /wp-json/sme/v1/viber/send
 *            Agents POST { conversationId, recipientId (viber_id), text }.
 *
 * Settings keys (stored under sme_platform_settings['viber']):
 *   enabled, authToken, botName, senderId, avatarUrl,
 *   fetchProfile, deliveryReceipts, media, autoAssign, autoReplyMsg
 *
 * @package Ppros_Synchronized_Messaging_Engine
 */

defined( 'ABSPATH' ) || die( 'No script kiddies please!' );

class Ppros_Synchronized_Messaging_Engine_Viber_Pipe extends Ppros_Synchronized_Messaging_Engine_Channel_Pipe_Base {

    const API_BASE = 'https://chatapi.viber.com/pa/';

    public function get_channel_slug(): string {
        return 'viber';
    }

    public function register_routes(): void {
        $ns = Ppros_Synchronized_Messaging_Engine_Rest_Api::NAMESPACE_V1;

        register_rest_route(
            $ns,
            '/webhooks/viber',
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'handle_webhook' ),
                'permission_callback' => '__return_true',
            )
        );

        register_rest_route(
            $ns,
            '/viber/send',
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

        register_rest_route(
            $ns,
            '/viber/set-webhook',
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'handle_set_webhook' ),
                'permission_callback' => array( $this, 'check_manage_settings' ),
            )
        );
    }

    // ── Inbound webhook ────────────────────────────────────────────────────

    public function handle_webhook( WP_REST_Request $request ) {
        $cfg      = $this->get_settings();
        $raw_body = $request->get_body();
        $token    = (string) ( $cfg['authToken'] ?? '' );

        // Verify X-Viber-Content-Signature (HMAC-SHA256).
        if ( '' !== $token ) {
            $sig_header = (string) ( $request->get_header( 'x-viber-content-signature' ) ?? '' );
            $expected   = hash_hmac( 'sha256', $raw_body, $token );
            if ( ! hash_equals( $expected, $sig_header ) ) {
                return new WP_Error( 'sme_unauthorized', 'Viber signature mismatch.', array( 'status' => 401 ) );
            }
        }

        $payload = json_decode( $raw_body, true );
        if ( ! is_array( $payload ) ) {
            return rest_ensure_response( array( 'status' => 0 ) );
        }

        $event_type = (string) ( $payload['event'] ?? '' );

        switch ( $event_type ) {
            case 'message':
                $this->process_message( $payload, $cfg );
                break;
            case 'webhook':
                // Viber sends a "webhook" event to confirm the URL is live; nothing to do.
                break;
            case 'conversation_started':
                $this->process_conversation_started( $payload, $cfg );
                break;
            case 'delivered':
            case 'seen':
            case 'failed':
                // Delivery / seen receipts — could update message status; skip for now.
                break;
        }

        return rest_ensure_response( array( 'status' => 0 ) );
    }

    private function process_message( array $payload, array $cfg ): void {
        $sender   = $payload['sender'] ?? array();
        $msg      = $payload['message'] ?? array();
        $user_id  = (string) ( $sender['id'] ?? '' );
        $msg_token = (string) ( $payload['message_token'] ?? '' );
        $msg_type  = (string) ( $msg['type'] ?? 'text' );

        if ( '' === $user_id ) {
            return;
        }

        $text = match ( $msg_type ) {
            'text'     => (string) ( $msg['text'] ?? '' ),
            'picture'  => '[Image' . ( isset( $msg['text'] ) ? ': ' . $msg['text'] : '' ) . ']',
            'video'    => '[Video]',
            'file'     => '[File: ' . ( $msg['file_name'] ?? 'attachment' ) . ']',
            'sticker'  => '[Sticker]',
            'contact'  => '[Contact: ' . ( $msg['contact']['name'] ?? '' ) . ']',
            'url'      => '[URL: ' . ( $msg['media'] ?? '' ) . ']',
            'location' => '[Location]',
            default    => '[Message: ' . $msg_type . ']',
        };

        $contact_name = (string) ( $sender['name'] ?? 'Viber User' );

        $subject         = mb_substr( $text, 0, 80 ) ?: 'Viber message';
        $conversation_id = $this->find_or_create_conversation(
            $user_id, $contact_name, $user_id, $subject
        );

        if ( is_wp_error( $conversation_id ) ) {
            error_log( '[SME Viber] DB error: ' . $conversation_id->get_error_message() );
            return;
        }

        $this->store_message(
            $conversation_id,
            esc_html( $text ),
            'contact',
            $contact_name,
            array( 'channel' => 'viber', 'viberId' => $user_id, 'msgType' => $msg_type, 'token' => $msg_token ),
            'viber_' . $msg_token
        );

        $this->maybe_send_auto_reply( $user_id, $contact_name, (string) $conversation_id );

        do_action( 'sme_inbound_message_received', $conversation_id, 'viber', array(
            'userId' => $user_id, 'text' => $text, 'msgType' => $msg_type,
        ) );
    }

    private function process_conversation_started( array $payload, array $cfg ): void {
        $user_id      = (string) ( $payload['user']['id'] ?? '' );
        $contact_name = (string) ( $payload['user']['name'] ?? 'Viber User' );

        if ( '' === $user_id ) {
            return;
        }

        $conversation_id = $this->find_or_create_conversation(
            $user_id, $contact_name, $user_id, 'Viber conversation started'
        );

        if ( ! is_wp_error( $conversation_id ) && ! empty( $cfg['autoReplyMsg'] ) ) {
            $this->send_message( $user_id, (string) $cfg['autoReplyMsg'], $cfg );
        }
    }

    // ── Outbound send ─────────────────────────────────────────────────────

    protected function send_message( string $recipient_id, string $text, array $cfg = array() ) {
        if ( empty( $cfg ) ) {
            $cfg = $this->get_settings();
        }
        $token    = (string) ( $cfg['authToken'] ?? '' );
        $bot_name = (string) ( $cfg['botName'] ?? 'Support Bot' );
        $avatar   = (string) ( $cfg['avatarUrl'] ?? '' );

        if ( '' === $token ) {
            return new \WP_Error(
                'sme_viber_not_configured',
                __( 'Viber authentication token is not configured.', 'synchronized-messaging-engine' )
            );
        }

        $payload = array(
            'receiver' => $recipient_id,
            'type'     => 'text',
            'text'     => $text,
            'sender'   => array(
                'name'   => $bot_name,
                'avatar' => $avatar,
            ),
        );

        $result = $this->http_post_json(
            self::API_BASE . 'send_message',
            $payload,
            array( 'X-Viber-Auth-Token' => $token )
        );

        if ( is_wp_error( $result ) ) {
            return new \WP_Error(
                'sme_viber_send_error',
                sprintf( __( 'Viber API error: %s', 'synchronized-messaging-engine' ), $result->get_error_message() ),
                array( 'status' => 502 )
            );
        }

        if ( isset( $result['status'] ) && 0 !== (int) $result['status'] ) {
            return new \WP_Error(
                'sme_viber_api_error',
                sprintf( 'Viber error %d: %s', (int) $result['status'], $result['status_message'] ?? '' ),
                array( 'status' => 502 )
            );
        }

        return $result;
    }

    // ── Register webhook with Viber ───────────────────────────────────────

    public function handle_set_webhook( WP_REST_Request $request ) {
        $cfg   = $this->get_settings();
        $token = (string) ( $cfg['authToken'] ?? '' );
        if ( '' === $token ) {
            return new WP_Error( 'sme_no_token', __( 'Viber auth token is not configured.', 'synchronized-messaging-engine' ), array( 'status' => 400 ) );
        }

        $webhook_url = rest_url( Ppros_Synchronized_Messaging_Engine_Rest_Api::NAMESPACE_V1 . '/webhooks/viber' );

        $result = $this->http_post_json(
            self::API_BASE . 'set_webhook',
            array(
                'url'         => $webhook_url,
                'event_types' => array( 'message', 'delivered', 'seen', 'failed', 'conversation_started' ),
                'send_name'   => true,
                'send_photo'  => true,
            ),
            array( 'X-Viber-Auth-Token' => $token )
        );

        if ( is_wp_error( $result ) ) {
            return $result;
        }

        return rest_ensure_response( array(
            'ok'         => true,
            'webhookUrl' => $webhook_url,
            'viber'      => $result,
        ) );
    }
}
