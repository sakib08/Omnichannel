<?php
/**
 * WeChat Official Account connector.
 *
 * Inbound  — GET  /wp-json/kmbp/v1/webhooks/wechat  (URL verification echo)
 *            POST /wp-json/kmbp/v1/webhooks/wechat  (XML messages)
 *            Register in: WeChat Official Account admin → Development →
 *            Basic configuration → Server URL
 *
 * Outbound — POST /wp-json/kmbp/v1/wechat/send
 *            Agents POST { conversationId, recipientId (openid), text }.
 *
 * Settings keys (stored under kmbp_platform_settings['wechat']):
 *   enabled, appId, appSecret, serverToken, encodingAesKey,
 *   fetchProfile, autoReplyMsg, autoAssign
 *
 * Access token is fetched on demand and cached for 90 minutes in a
 * WordPress transient (kmbp_wechat_access_token).
 *
 * @package Kinetix_Messaging_By_Ppros
 */

defined( 'ABSPATH' ) || die( 'No script kiddies please!' );

class Kinetix_Messaging_By_Ppros_Wechat_Pipe extends Kinetix_Messaging_By_Ppros_Channel_Pipe_Base {

    const API_BASE = 'https://api.weixin.qq.com/cgi-bin/';
    const TOKEN_TRANSIENT = 'kmbp_wechat_access_token';

    public function get_channel_slug(): string {
        return 'wechat';
    }

    public function register_routes(): void {
        $ns = Kinetix_Messaging_By_Ppros_Rest_Api::NAMESPACE_V1;

        register_rest_route(
            $ns,
            '/webhooks/wechat',
            array(
                array(
                    'methods'             => WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'handle_webhook_verify' ),
                    'permission_callback' => array( $this, 'check_wechat_webhook_verify_permission' ),
                ),
                array(
                    'methods'             => WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'handle_webhook' ),
                    'permission_callback' => array( $this, 'check_wechat_inbound_webhook_permission' ),
                ),
            )
        );

        register_rest_route(
            $ns,
            '/wechat/send',
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

    // ── URL verification (GET) ────────────────────────────────────────────

    /**
     * Verify WeChat URL signature (GET and POST query params).
     */
    protected function verify_wechat_signature( WP_REST_Request $request, string $token ): bool {
        if ( '' === $token ) {
            return false;
        }
        $signature = (string) ( $request->get_param( 'signature' ) ?? '' );
        $timestamp = (string) ( $request->get_param( 'timestamp' ) ?? '' );
        $nonce     = (string) ( $request->get_param( 'nonce' ) ?? '' );
        $tmp       = array( $token, $timestamp, $nonce );
        sort( $tmp );
        return hash_equals( sha1( implode( '', $tmp ) ), $signature );
    }

    /**
     * Permission callback for WeChat URL verification (GET).
     */
    public function check_wechat_webhook_verify_permission( WP_REST_Request $request ): bool {
        if ( ! $this->is_channel_enabled() ) {
            return false;
        }
        $token = (string) ( $this->get_settings()['serverToken'] ?? '' );
        return $this->verify_wechat_signature( $request, $token );
    }

    /**
     * Permission callback for WeChat inbound webhook POST.
     */
    public function check_wechat_inbound_webhook_permission( WP_REST_Request $request ): bool {
        if ( ! $this->is_channel_enabled() ) {
            return false;
        }
        $token = (string) ( $this->get_settings()['serverToken'] ?? '' );
        return $this->verify_wechat_signature( $request, $token );
    }

    public function handle_webhook_verify( WP_REST_Request $request ) {
        $echostr = (string) ( $request->get_param( 'echostr' ) ?? '' );
        return new WP_REST_Response( $echostr, 200, array( 'Content-Type' => 'text/plain' ) );
    }

    // ── Inbound webhook (POST XML) ────────────────────────────────────────

    public function handle_webhook( WP_REST_Request $request ) {
        $cfg     = $this->get_settings();
        $raw_xml = $request->get_body();

        if ( '' === trim( $raw_xml ) ) {
            return new WP_REST_Response( 'success', 200 );
        }

        // Suppress XML errors for malformed payloads.
        libxml_use_internal_errors( true );
        $xml = simplexml_load_string( $raw_xml, 'SimpleXMLElement', LIBXML_NOCDATA );
        libxml_clear_errors();

        if ( false === $xml ) {
            return new WP_REST_Response( 'success', 200 );
        }

        $msg_type  = (string) ( $xml->MsgType ?? '' );
        $open_id   = (string) ( $xml->FromUserName ?? '' );
        $msg_id    = (string) ( $xml->MsgId ?? '' );

        if ( '' === $open_id ) {
            return new WP_REST_Response( 'success', 200 );
        }

        $text = $this->extract_xml_text( $xml, $msg_type );
        $contact_name = $this->maybe_get_profile_name( $open_id, $cfg );

        $subject         = mb_substr( $text, 0, 80 ) ?: 'WeChat message';
        $conversation_id = $this->find_or_create_conversation(
            $open_id, $contact_name, $open_id, $subject
        );

        if ( is_wp_error( $conversation_id ) ) {
            $this->log_debug( '[KMBP WeChat] DB error: ' . $conversation_id->get_error_message() );
            return new WP_REST_Response( 'success', 200 );
        }

        $this->store_message(
            $conversation_id,
            esc_html( $text ),
            'contact',
            $contact_name,
            array( 'channel' => 'wechat', 'openId' => $open_id, 'msgType' => $msg_type, 'msgId' => $msg_id ),
            'wx_' . $msg_id
        );

        // Auto-reply.
        if ( ! empty( $cfg['autoReplyMsg'] ) ) {
            $this->send_message( $open_id, (string) $cfg['autoReplyMsg'], $cfg );
        }

        do_action( 'kmbp_inbound_message_received', $conversation_id, 'wechat', array(
            'openId' => $open_id, 'text' => $text, 'msgType' => $msg_type,
        ) );

        // WeChat expects a plain "success" response (or an XML reply).
        return new WP_REST_Response( 'success', 200, array( 'Content-Type' => 'text/plain' ) );
    }

    private function extract_xml_text( \SimpleXMLElement $xml, string $msg_type ): string {
        return match ( $msg_type ) {
            'text'  => (string) $xml->Content,
            'image' => '[Image]',
            'voice' => '[Voice message]',
            'video' => '[Video]',
            'shortvideo' => '[Short video]',
            'location' => '[Location: ' . ( $xml->Label ?? '' ) . ']',
            'link'  => '[Link: ' . ( $xml->Title ?? '' ) . ' — ' . ( $xml->Url ?? '' ) . ']',
            'event' => '[Event: ' . ( $xml->Event ?? '' ) . ']',
            default => '[Message: ' . $msg_type . ']',
        };
    }

    // ── Outbound send ─────────────────────────────────────────────────────

    protected function send_message( string $recipient_id, string $text, array $cfg = array() ) {
        if ( empty( $cfg ) ) {
            $cfg = $this->get_settings();
        }

        $access_token = $this->get_access_token( $cfg );
        if ( is_wp_error( $access_token ) ) {
            return $access_token;
        }

        $result = $this->http_post_json(
            self::API_BASE . 'message/custom/send?access_token=' . rawurlencode( $access_token ),
            array(
                'touser'  => $recipient_id,
                'msgtype' => 'text',
                'text'    => array( 'content' => $text ),
            )
        );

        if ( is_wp_error( $result ) ) {
            return new \WP_Error(
                'kmbp_wechat_send_error',
                sprintf(
                    /* translators: %s: WeChat API error message */
                    __( 'WeChat API error: %s', 'kinetix-messaging-by-ppros' ),
                    $result->get_error_message()
                ),
                array( 'status' => 502 )
            );
        }

        if ( isset( $result['errcode'] ) && 0 !== (int) $result['errcode'] ) {
            return new \WP_Error(
                'kmbp_wechat_api_error',
                sprintf( 'WeChat error %d: %s', (int) $result['errcode'], $result['errmsg'] ?? '' ),
                array( 'status' => 502 )
            );
        }

        return $result;
    }

    // ── Access token management ───────────────────────────────────────────

    /**
     * Return a valid WeChat access token, fetching a new one if necessary.
     * Tokens are valid for 7200 s; we cache them for 90 min to be safe.
     *
     * @return string|\WP_Error
     */
    private function get_access_token( array $cfg ) {
        $cached = get_transient( self::TOKEN_TRANSIENT );
        if ( false !== $cached ) {
            return $cached;
        }

        $app_id  = (string) ( $cfg['appId'] ?? '' );
        $secret  = (string) ( $cfg['appSecret'] ?? '' );
        if ( '' === $app_id || '' === $secret ) {
            return new \WP_Error(
                'kmbp_wechat_not_configured',
                __( 'WeChat appId and appSecret are required.', 'kinetix-messaging-by-ppros' )
            );
        }

        $url  = self::API_BASE . 'token?grant_type=client_credential&appid=' . rawurlencode( $app_id ) . '&secret=' . rawurlencode( $secret );
        $data = $this->http( $url );

        if ( is_wp_error( $data ) ) {
            return $data;
        }

        if ( empty( $data['access_token'] ) ) {
            $msg = isset( $data['errmsg'] ) ? $data['errmsg'] : 'Empty access_token response';
            return new \WP_Error( 'kmbp_wechat_token_error', $msg );
        }

        $token = (string) $data['access_token'];
        set_transient( self::TOKEN_TRANSIENT, $token, 90 * MINUTE_IN_SECONDS );

        return $token;
    }

    // ── Profile fetch ─────────────────────────────────────────────────────

    private function maybe_get_profile_name( string $open_id, array $cfg ): string {
        if ( empty( $cfg['fetchProfile'] ) ) {
            return 'WeChat User';
        }

        $cache_key = 'kmbp_wx_profile_' . md5( $open_id );
        $cached    = get_transient( $cache_key );
        if ( false !== $cached ) {
            return (string) $cached;
        }

        $access_token = $this->get_access_token( $cfg );
        if ( is_wp_error( $access_token ) ) {
            return 'WeChat User';
        }

        $url  = self::API_BASE . 'user/info?access_token=' . rawurlencode( $access_token )
              . '&openid=' . rawurlencode( $open_id ) . '&lang=en';
        $data = $this->http( $url );

        if ( is_wp_error( $data ) || empty( $data['nickname'] ) ) {
            return 'WeChat User';
        }

        $name = (string) $data['nickname'];
        set_transient( $cache_key, $name, 6 * HOUR_IN_SECONDS );

        return $name;
    }
}
