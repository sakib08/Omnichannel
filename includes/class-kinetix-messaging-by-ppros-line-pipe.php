<?php
/**
 * LINE Messaging API connector.
 *
 * Inbound  — POST /wp-json/kmbp/v1/webhooks/line
 *            LINE posts signed JSON webhook events to this URL.
 *            Set in: LINE Developers Console → Channel → Messaging API →
 *            Webhook settings → Webhook URL
 *
 * Outbound — POST /wp-json/kmbp/v1/line/send
 *            Agents POST { conversationId, recipientId (userId), text }.
 *
 * Settings keys (stored under kmbp_platform_settings['line']):
 *   enabled, channelAccessToken, channelSecret,
 *   autoReply, autoReplyMsg, typingIndicator
 *
 * @package Kinetix_Messaging_By_Ppros
 */

defined( 'ABSPATH' ) || die( 'No script kiddies please!' );

class Kinetix_Messaging_By_Ppros_Line_Pipe extends Kinetix_Messaging_By_Ppros_Channel_Pipe_Base {

    const MESSAGING_API = 'https://api.line.me/v2/bot/';

    public function get_channel_slug(): string {
        return 'line';
    }

    public function register_routes(): void {
        $ns = Kinetix_Messaging_By_Ppros_Rest_Api::NAMESPACE_V1;

        register_rest_route(
            $ns,
            '/webhooks/line',
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'handle_webhook' ),
                'permission_callback' => array( $this, 'check_line_webhook_permission' ),
            )
        );

        register_rest_route(
            $ns,
            '/line/send',
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

    // ── Inbound webhook ────────────────────────────────────────────────────

    /**
     * Permission callback for LINE inbound webhook POST.
     */
    public function check_line_webhook_permission( WP_REST_Request $request ): bool {
        if ( ! $this->is_channel_enabled() ) {
            return false;
        }
        $channel_secret = (string) ( $this->get_settings()['channelSecret'] ?? '' );
        if ( '' === $channel_secret ) {
            return false;
        }
        $signature = (string) ( $request->get_header( 'x-line-signature' ) ?? '' );
        $expected  = base64_encode( hash_hmac( 'sha256', $request->get_body(), $channel_secret, true ) );
        return hash_equals( $expected, $signature );
    }

    public function handle_webhook( WP_REST_Request $request ) {
        $cfg        = $this->get_settings();
        $raw_body   = $request->get_body();

        $payload = json_decode( $raw_body, true );
        if ( ! is_array( $payload ) ) {
            return rest_ensure_response( array( 'ok' => true ) );
        }

        foreach ( $payload['events'] ?? array() as $event ) {
            $this->dispatch_event( $event, $cfg );
        }

        return rest_ensure_response( array( 'ok' => true ) );
    }

    private function dispatch_event( array $event, array $cfg ): void {
        $type = (string) ( $event['type'] ?? '' );

        switch ( $type ) {
            case 'message':
                $this->process_message_event( $event, $cfg );
                break;
            case 'follow':
                $this->process_follow_event( $event, $cfg );
                break;
            case 'postback':
                $this->process_postback_event( $event, $cfg );
                break;
        }
    }

    private function process_message_event( array $event, array $cfg ): void {
        $source  = $event['source'] ?? array();
        $user_id = (string) ( $source['userId'] ?? '' );
        $msg     = $event['message'] ?? array();
        $msg_id  = (string) ( $event['webhookEventId'] ?? $msg['id'] ?? '' );
        $msg_type = (string) ( $msg['type'] ?? 'text' );

        if ( '' === $user_id ) {
            return;
        }

        $text = match ( $msg_type ) {
            'text'     => (string) ( $msg['text'] ?? '' ),
            'image'    => '[Image]',
            'video'    => '[Video]',
            'audio'    => '[Audio]',
            'file'     => '[File: ' . ( $msg['fileName'] ?? 'attachment' ) . ']',
            'location' => '[Location: ' . ( $msg['address'] ?? '' ) . ']',
            'sticker'  => '[Sticker]',
            default    => '[Message: ' . $msg_type . ']',
        };

        $contact_name    = $this->maybe_get_profile_name( $user_id, $cfg );
        $subject         = mb_substr( $text, 0, 80 ) ?: 'LINE message';
        $conversation_id = $this->find_or_create_conversation( $user_id, $contact_name, $user_id, $subject );

        if ( is_wp_error( $conversation_id ) ) {
            $this->log_debug( '[KMBP LINE] DB error: ' . $conversation_id->get_error_message() );
            return;
        }

        $this->store_message(
            $conversation_id,
            esc_html( $text ),
            'contact',
            $contact_name,
            array( 'channel' => 'line', 'userId' => $user_id, 'msgType' => $msg_type, 'msgId' => $msg_id ),
            'line_' . $msg_id
        );

        // Send typing indicator.
        if ( ! empty( $cfg['typingIndicator'] ) ) {
            $this->send_typing_indicator( $user_id, $cfg );
        }

        $this->maybe_send_auto_reply( $user_id, $contact_name, (string) $conversation_id );

        do_action( 'kmbp_inbound_message_received', $conversation_id, 'line', array(
            'userId' => $user_id, 'text' => $text, 'msgType' => $msg_type,
        ) );
    }

    private function process_follow_event( array $event, array $cfg ): void {
        $user_id = (string) ( $event['source']['userId'] ?? '' );
        if ( '' === $user_id ) {
            return;
        }
        $contact_name    = $this->maybe_get_profile_name( $user_id, $cfg );
        $conversation_id = $this->find_or_create_conversation(
            $user_id, $contact_name, $user_id, 'New LINE follower'
        );
        if ( ! is_wp_error( $conversation_id ) && ! empty( $cfg['startMsg'] ) ) {
            $this->send_message( $user_id, (string) $cfg['startMsg'], $cfg );
        }
    }

    private function process_postback_event( array $event, array $cfg ): void {
        $user_id = (string) ( $event['source']['userId'] ?? '' );
        $data    = (string) ( $event['postback']['data'] ?? '' );
        if ( '' === $user_id ) {
            return;
        }
        $contact_name    = $this->maybe_get_profile_name( $user_id, $cfg );
        $conversation_id = $this->find_or_create_conversation(
            $user_id, $contact_name, $user_id, 'Postback: ' . $data
        );
        if ( ! is_wp_error( $conversation_id ) ) {
            $this->store_message(
                $conversation_id,
                '[Postback: ' . esc_html( $data ) . ']',
                'contact',
                $contact_name,
                array( 'channel' => 'line', 'userId' => $user_id, 'postback' => $data )
            );
        }
    }

    // ── Outbound send ─────────────────────────────────────────────────────

    protected function send_message( string $recipient_id, string $text, array $cfg = array() ) {
        if ( empty( $cfg ) ) {
            $cfg = $this->get_settings();
        }
        $token = (string) ( $cfg['channelAccessToken'] ?? '' );
        if ( '' === $token ) {
            return new \WP_Error(
                'kmbp_line_not_configured',
                __( 'LINE Channel Access Token is not configured.', 'kinetix-messaging-by-ppros' )
            );
        }

        $result = $this->http_post_json(
            self::MESSAGING_API . 'message/push',
            array(
                'to'       => $recipient_id,
                'messages' => array(
                    array( 'type' => 'text', 'text' => $text ),
                ),
            ),
            array( 'Authorization' => 'Bearer ' . $token )
        );

        if ( is_wp_error( $result ) ) {
            return new \WP_Error(
                'kmbp_line_send_error',
                sprintf(
                    /* translators: %s: LINE API error message */
                    __( 'LINE API error: %s', 'kinetix-messaging-by-ppros' ),
                    $result->get_error_message()
                ),
                array( 'status' => 502 )
            );
        }

        return $result;
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private function send_typing_indicator( string $user_id, array $cfg ): void {
        $token = (string) ( $cfg['channelAccessToken'] ?? '' );
        if ( '' === $token ) {
            return;
        }
        $this->http_post_json(
            self::MESSAGING_API . 'chat/loading/start',
            array( 'chatId' => $user_id ),
            array( 'Authorization' => 'Bearer ' . $token )
        );
    }

    private function maybe_get_profile_name( string $user_id, array $cfg ): string {
        $cache_key = 'kmbp_line_profile_' . md5( $user_id );
        $cached    = get_transient( $cache_key );
        if ( false !== $cached ) {
            return (string) $cached;
        }

        $token = (string) ( $cfg['channelAccessToken'] ?? '' );
        if ( '' === $token ) {
            return 'LINE User';
        }

        $data = $this->http(
            self::MESSAGING_API . 'profile/' . rawurlencode( $user_id ),
            array( 'headers' => array( 'Authorization' => 'Bearer ' . $token ) )
        );

        if ( is_wp_error( $data ) || empty( $data['displayName'] ) ) {
            return 'LINE User';
        }

        $name = (string) $data['displayName'];
        set_transient( $cache_key, $name, 6 * HOUR_IN_SECONDS );

        return $name;
    }
}
