<?php
/**
 * WeChat Official Account connector.
 *
 * Inbound  — GET  /wp-json/sme/v1/webhooks/wechat  (URL verification echo)
 *            POST /wp-json/sme/v1/webhooks/wechat  (XML messages)
 *            Register in: WeChat Official Account admin → Development →
 *            Basic configuration → Server URL
 *
 * Outbound — POST /wp-json/sme/v1/wechat/send
 *            Agents POST { conversationId, recipientId (openid), text }.
 *
 * Settings keys (stored under sme_platform_settings['wechat']):
 *   enabled, appId, appSecret, serverToken, encodingAesKey,
 *   fetchProfile, autoReplyMsg, autoAssign
 *
 * Access token is fetched on demand and cached for 90 minutes in a
 * WordPress transient (sme_wechat_access_token).
 *
 * @package Synchronized_Messaging_Engine
 */

defined( 'ABSPATH' ) || die( 'No script kiddies please!' );

class Synchronized_Messaging_Engine_Wechat_Pipe extends Synchronized_Messaging_Engine_Channel_Pipe_Base {

    const API_BASE = 'https://api.weixin.qq.com/cgi-bin/';
    const TOKEN_TRANSIENT = 'sme_wechat_access_token';

    public function get_channel_slug(): string {
        return 'wechat';
    }

    public function register_routes(): void {
        $ns = Synchronized_Messaging_Engine_Rest_Api::NAMESPACE_V1;

        register_rest_route(
            $ns,
            '/webhooks/wechat',
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

    public function handle_webhook_verify( WP_REST_Request $request ) {
        $cfg       = $this->get_settings();
        $token     = (string) ( $cfg['serverToken'] ?? '' );
        $signature = (string) ( $request->get_param( 'signature' ) ?? '' );
        $timestamp = (string) ( $request->get_param( 'timestamp' ) ?? '' );
        $nonce     = (string) ( $request->get_param( 'nonce' ) ?? '' );
        $echostr   = (string) ( $request->get_param( 'echostr' ) ?? '' );

        $tmp = array( $token, $timestamp, $nonce );
        sort( $tmp );
        $computed = sha1( implode( '', $tmp ) );

        if ( hash_equals( $computed, $signature ) ) {
            return new WP_REST_Response( $echostr, 200, array( 'Content-Type' => 'text/plain' ) );
        }

        return new WP_Error( 'sme_forbidden', 'Signature verification failed.', array( 'status' => 403 ) );
    }

    // ── Inbound webhook (POST XML) ────────────────────────────────────────

    public function handle_webhook( WP_REST_Request $request ) {
        $cfg     = $this->get_settings();
        $raw_xml = $request->get_body();

        // Verify signature.
        $token    = (string) ( $cfg['serverToken'] ?? '' );
        $sig      = (string) ( $request->get_param( 'signature' ) ?? '' );
        $ts       = (string) ( $request->get_param( 'timestamp' ) ?? '' );
        $nonce    = (string) ( $request->get_param( 'nonce' ) ?? '' );
        $tmp      = array( $token, $ts, $nonce );
        sort( $tmp );
        $computed = sha1( implode( '', $tmp ) );

        if ( '' !== $token && ! hash_equals( $computed, $sig ) ) {
            return new WP_Error( 'sme_unauthorized', 'Signature mismatch.', array( 'status' => 401 ) );
        }

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
            error_log( '[SME WeChat] DB error: ' . $conversation_id->get_error_message() );
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

        do_action( 'sme_inbound_message_received', $conversation_id, 'wechat', array(
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
                'sme_wechat_send_error',
                sprintf( __( 'WeChat API error: %s', 'synchronized-messaging-engine' ), $result->get_error_message() ),
                array( 'status' => 502 )
            );
        }

        if ( isset( $result['errcode'] ) && 0 !== (int) $result['errcode'] ) {
            return new \WP_Error(
                'sme_wechat_api_error',
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
                'sme_wechat_not_configured',
                __( 'WeChat appId and appSecret are required.', 'synchronized-messaging-engine' )
            );
        }

        $url  = self::API_BASE . 'token?grant_type=client_credential&appid=' . rawurlencode( $app_id ) . '&secret=' . rawurlencode( $secret );
        $data = $this->http( $url );

        if ( is_wp_error( $data ) ) {
            return $data;
        }

        if ( empty( $data['access_token'] ) ) {
            $msg = isset( $data['errmsg'] ) ? $data['errmsg'] : 'Empty access_token response';
            return new \WP_Error( 'sme_wechat_token_error', $msg );
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

        $cache_key = 'sme_wx_profile_' . md5( $open_id );
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
