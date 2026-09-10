<?php
/**
 * Live Chat connector via livechat.pluginpros.co (WebSocket rooms).
 *
 * Inbound  — POST /wp-json/kmbp/v1/livechat/inbound
 *            The public site widget POSTs visitor messages so they appear
 *            in the WordPress inbox. Authenticated with a widget token.
 *
 * Outbound — POST /wp-json/kmbp/v1/livechat/send
 *            Agents POST { conversationId, recipientId (room_id), text }.
 *            Delivered over a short-lived WebSocket connection to the same room.
 *
 * Public widget config is localised from PHP (not this REST surface).
 *
 * Settings keys (stored under kmbp_platform_settings['livechat']):
 *   enabled, apiKey, host, widgetToken, brandName, tagline, welcomeMessage,
 *   iceList, themeColor, position, onlineText, agentName, askName,
 *   autoReply, autoReplyMsg, autoAssign
 *
 * @package Kinetix_Messaging_By_Ppros
 */

defined( 'ABSPATH' ) || die( 'No script kiddies please!' );

class Kinetix_Messaging_By_Ppros_Livechat_Pipe extends Kinetix_Messaging_By_Ppros_Channel_Pipe_Base {

    const DEFAULT_HOST = 'livechat.pluginpros.co';

    public function get_channel_slug(): string {
        return 'livechat';
    }

    public function register_routes(): void {
        $ns = Kinetix_Messaging_By_Ppros_Rest_Api::NAMESPACE_V1;

        register_rest_route(
            $ns,
            '/livechat/inbound',
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'handle_inbound' ),
                'permission_callback' => array( $this, 'check_inbound_permission' ),
            )
        );

        register_rest_route(
            $ns,
            '/livechat/send',
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
            '/livechat/test-connection',
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'handle_test_connection' ),
                'permission_callback' => array( $this, 'check_manage_settings' ),
            )
        );
    }

    /**
     * Public inbound from the visitor widget. Requires the site widget token.
     */
    public function check_inbound_permission( WP_REST_Request $request ): bool {
        if ( ! $this->is_channel_enabled() ) {
            return false;
        }
        $stored = (string) ( $this->get_settings()['widgetToken'] ?? '' );
        if ( '' === $stored ) {
            return false;
        }
        $provided = (string) ( $request->get_header( 'x-kmbp-widget-token' )
            ?? $request->get_param( 'widgetToken' )
            ?? '' );
        return hash_equals( $stored, $provided );
    }

    // ── Inbound visitor message ───────────────────────────────────────────

    public function handle_inbound( WP_REST_Request $request ) {
        if ( ! $this->rate_limit_inbound() ) {
            return new WP_Error(
                'kmbp_livechat_rate_limited',
                __( 'Too many messages. Please wait a moment and try again.', 'kinetix-messaging-by-ppros' ),
                array( 'status' => 429 )
            );
        }

        $cfg      = $this->get_settings();
        $room_id  = $this->sanitize_room_id( (string) $request->get_param( 'roomId' ) );
        $text     = sanitize_textarea_field( (string) $request->get_param( 'text' ) );
        $name     = sanitize_text_field( (string) $request->get_param( 'senderName' ) );
        $msg_uid  = sanitize_text_field( (string) $request->get_param( 'messageId' ) );

        if ( '' === $room_id ) {
            return new WP_Error( 'kmbp_livechat_bad_room', __( 'A valid room ID is required.', 'kinetix-messaging-by-ppros' ), array( 'status' => 400 ) );
        }
        if ( '' === trim( $text ) ) {
            return new WP_Error( 'kmbp_empty_body', __( 'Message text is required.', 'kinetix-messaging-by-ppros' ), array( 'status' => 400 ) );
        }
        if ( strlen( $text ) > 4000 ) {
            $text = substr( $text, 0, 4000 );
        }
        if ( '' === $name ) {
            $name = __( 'Website Visitor', 'kinetix-messaging-by-ppros' );
        }
        $name = mb_substr( $name, 0, 80 );

        $subject         = mb_substr( $text, 0, 80 ) ?: __( 'Live chat', 'kinetix-messaging-by-ppros' );
        $conversation_id = $this->find_or_create_conversation( $room_id, $name, $room_id, $subject );
        if ( is_wp_error( $conversation_id ) ) {
            return $conversation_id;
        }

        $is_first = $this->conversation_message_count( $conversation_id ) === 0;

        $external_id = '' !== $msg_uid ? 'lc_' . $msg_uid : 'lc_' . md5( $room_id . '|' . $text . '|' . $name );
        $message_id  = $this->store_message(
            $conversation_id,
            esc_html( $text ),
            'contact',
            $name,
            array(
                'channel' => 'livechat',
                'roomId'  => $room_id,
            ),
            $external_id
        );

        if ( $is_first ) {
            $this->maybe_store_and_send_auto_reply( $conversation_id, $room_id, $name, $cfg );
        }

        do_action(
            'kmbp_inbound_message_received',
            $conversation_id,
            'livechat',
            array(
                'from' => $room_id,
                'text' => $text,
            )
        );

        return rest_ensure_response(
            array(
                'ok'             => true,
                'conversationId' => $conversation_id,
                'messageId'      => $message_id,
            )
        );
    }

    // ── Test WebSocket handshake ──────────────────────────────────────────

    public function handle_test_connection() {
        $cfg     = $this->get_settings();
        $api_key = (string) ( $cfg['apiKey'] ?? '' );
        if ( '' === $api_key ) {
            return new WP_Error(
                'kmbp_livechat_not_configured',
                __( 'Enter your livechat.pluginpros.co API key first.', 'kinetix-messaging-by-ppros' ),
                array( 'status' => 400 )
            );
        }

        $room   = 'kmbp-test-' . wp_generate_password( 8, false, false );
        $result = $this->websocket_handshake_only( $this->normalized_host( $cfg ), $room, $api_key );
        if ( is_wp_error( $result ) ) {
            return $result;
        }

        return rest_ensure_response(
            array(
                'ok'      => true,
                'message' => __( 'Connected to livechat.pluginpros.co successfully.', 'kinetix-messaging-by-ppros' ),
                'host'    => $this->normalized_host( $cfg ),
            )
        );
    }

    // ── Outbound send (agent → visitor room) ──────────────────────────────

    protected function send_message( string $recipient_id, string $text, array $cfg = array() ) {
        if ( empty( $cfg ) ) {
            $cfg = $this->get_settings();
        }

        $api_key = (string) ( $cfg['apiKey'] ?? '' );
        $room_id = $this->sanitize_room_id( $recipient_id );
        if ( '' === $api_key ) {
            return new \WP_Error(
                'kmbp_livechat_not_configured',
                __( 'Live Chat API key is not configured.', 'kinetix-messaging-by-ppros' )
            );
        }
        if ( '' === $room_id ) {
            return new \WP_Error(
                'kmbp_livechat_bad_room',
                __( 'A valid live chat room ID is required.', 'kinetix-messaging-by-ppros' )
            );
        }

        $agent_name = (string) ( $cfg['agentName'] ?? '' );
        if ( '' === $agent_name ) {
            $current = wp_get_current_user();
            $agent_name = $current->display_name ?: __( 'Support', 'kinetix-messaging-by-ppros' );
        }

        $payload = array(
            'content'     => $text,
            'sender_name' => $agent_name,
            'sender_type' => 'agent',
        );

        $result = $this->websocket_send_json( $this->normalized_host( $cfg ), $room_id, $api_key, $payload );
        if ( is_wp_error( $result ) ) {
            return new \WP_Error(
                'kmbp_livechat_send_error',
                sprintf(
                    /* translators: %s: live chat API error message */
                    __( 'Live Chat error: %s', 'kinetix-messaging-by-ppros' ),
                    $result->get_error_message()
                ),
                array( 'status' => 502 )
            );
        }

        return $result;
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    public static function default_host(): string {
        return self::DEFAULT_HOST;
    }

    /**
     * Strip protocol/path so settings can accept a hostname or a full URL.
     */
    public function normalized_host( array $cfg = array() ): string {
        if ( empty( $cfg ) ) {
            $cfg = $this->get_settings();
        }
        $host = trim( (string) ( $cfg['host'] ?? '' ) );
        if ( '' === $host ) {
            $host = self::DEFAULT_HOST;
        }
        $host = preg_replace( '#^https?://#i', '', $host );
        $host = preg_replace( '#/.*$#', '', $host );
        $host = strtolower( sanitize_text_field( $host ) );
        return $host !== '' ? $host : self::DEFAULT_HOST;
    }

    public function sanitize_room_id( string $room_id ): string {
        $room_id = trim( $room_id );
        if ( ! preg_match( '/^[A-Za-z0-9][A-Za-z0-9_-]{7,79}$/', $room_id ) ) {
            return '';
        }
        return $room_id;
    }

    /**
     * Ensure a public widget token exists so inbound POSTs can be authenticated
     * without exposing the livechat.pluginpros.co API key as the only secret.
     */
    public function ensure_widget_token(): string {
        $cfg   = $this->get_settings();
        $token = (string) ( $cfg['widgetToken'] ?? '' );
        if ( '' !== $token ) {
            return $token;
        }
        $token = wp_generate_password( 32, false, false );
        $this->update_channel_setting( 'widgetToken', $token );
        return $token;
    }

    private function conversation_message_count( int $conversation_id ): int {
        global $wpdb;
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- KMBP custom tables.
        return (int) $wpdb->get_var(
            $wpdb->prepare(
                "SELECT COUNT(*) FROM {$wpdb->prefix}kmbp_messages WHERE conversation_id = %d",
                $conversation_id
            )
        );
    }

    private function maybe_store_and_send_auto_reply( int $conversation_id, string $room_id, string $customer_name, array $cfg ): void {
        if ( empty( $cfg['autoReply'] ) || empty( $cfg['autoReplyMsg'] ) ) {
            return;
        }
        $msg = str_replace(
            array( '{{customer_name}}', '{{ticket_id}}', '{{name}}' ),
            array( $customer_name, (string) $conversation_id, $customer_name ),
            (string) $cfg['autoReplyMsg']
        );
        $result = $this->send_message( $room_id, $msg, $cfg );
        if ( is_wp_error( $result ) ) {
            $this->log_debug( '[KMBP LiveChat] Auto-reply failed: ' . $result->get_error_message() );
            return;
        }
        $agent_name = (string) ( $cfg['agentName'] ?? '' );
        if ( '' === $agent_name ) {
            $agent_name = __( 'Support', 'kinetix-messaging-by-ppros' );
        }
        $this->store_message(
            $conversation_id,
            $msg,
            'agent',
            $agent_name,
            array( 'direction' => 'outbound', 'autoReply' => true )
        );
    }

    private function rate_limit_inbound(): bool {
        $ip  = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( (string) $_SERVER['REMOTE_ADDR'] ) ) : 'unknown';
        $key = 'kmbp_lc_rl_' . md5( $ip );
        $n   = (int) get_transient( $key );
        if ( $n >= 40 ) {
            return false;
        }
        set_transient( $key, $n + 1, MINUTE_IN_SECONDS );
        return true;
    }

    // ── Minimal WebSocket client (RFC 6455 text frames) ───────────────────

    /**
     * Open a short-lived TLS WebSocket, send one JSON text frame, then close.
     *
     * @return array|\WP_Error
     */
    private function websocket_send_json( string $host, string $room_id, string $api_key, array $payload ) {
        $fp = $this->websocket_connect( $host, $room_id, $api_key );
        if ( is_wp_error( $fp ) ) {
            return $fp;
        }

        $json  = wp_json_encode( $payload );
        $wrote = fwrite( $fp, $this->ws_encode_text( $json ) );
        if ( false === $wrote ) {
            fclose( $fp );
            return new \WP_Error( 'kmbp_livechat_ws_write', __( 'Could not send the chat frame.', 'kinetix-messaging-by-ppros' ) );
        }

        stream_set_timeout( $fp, 4 );
        $reply = $this->ws_read_text( $fp );
        fwrite( $fp, $this->ws_encode_close() );
        fclose( $fp );

        if ( is_string( $reply ) && '' !== $reply ) {
            $data = json_decode( $reply, true );
            if ( is_array( $data ) && ( $data['type'] ?? '' ) === 'error' ) {
                $msg = (string) ( $data['message'] ?? __( 'Chat server returned an error.', 'kinetix-messaging-by-ppros' ) );
                return new \WP_Error( 'kmbp_livechat_ws_error', $msg );
            }
        }

        return array( 'ok' => true );
    }

    /**
     * TLS handshake only — used by the settings "Test connection" button.
     *
     * @return true|\WP_Error
     */
    private function websocket_handshake_only( string $host, string $room_id, string $api_key ) {
        $fp = $this->websocket_connect( $host, $room_id, $api_key );
        if ( is_wp_error( $fp ) ) {
            return $fp;
        }
        fwrite( $fp, $this->ws_encode_close() );
        fclose( $fp );
        return true;
    }

    /**
     * @return resource|\WP_Error
     */
    private function websocket_connect( string $host, string $room_id, string $api_key ) {
        $path   = '/ws/chat/' . rawurlencode( $room_id ) . '/?api_key=' . rawurlencode( $api_key );
        $key    = base64_encode( random_bytes( 16 ) );
        $origin = home_url();

        $context = stream_context_create(
            array(
                'ssl' => array(
                    'verify_peer'      => true,
                    'verify_peer_name' => true,
                    'SNI_enabled'      => true,
                    'peer_name'        => $host,
                ),
            )
        );

        $errno  = 0;
        $errstr = '';
        // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_stream_socket_client -- WebSocket upgrade is not available via wp_remote_*.
        $fp = @stream_socket_client(
            'ssl://' . $host . ':443',
            $errno,
            $errstr,
            12,
            STREAM_CLIENT_CONNECT,
            $context
        );

        if ( ! $fp ) {
            return new \WP_Error(
                'kmbp_livechat_ws_connect',
                sprintf(
                    /* translators: 1: host, 2: error text */
                    __( 'Could not reach %1$s: %2$s', 'kinetix-messaging-by-ppros' ),
                    $host,
                    $errstr ? $errstr : (string) $errno
                )
            );
        }

        stream_set_timeout( $fp, 12 );

        $request  = "GET {$path} HTTP/1.1\r\n";
        $request .= "Host: {$host}\r\n";
        $request .= "Upgrade: websocket\r\n";
        $request .= "Connection: Upgrade\r\n";
        $request .= "Sec-WebSocket-Key: {$key}\r\n";
        $request .= "Sec-WebSocket-Version: 13\r\n";
        $request .= "Origin: {$origin}\r\n";
        $request .= "\r\n";

        fwrite( $fp, $request );

        $headers = '';
        while ( ! feof( $fp ) ) {
            $line = fgets( $fp, 2048 );
            if ( false === $line ) {
                break;
            }
            $headers .= $line;
            if ( "\r\n" === $line || "\n" === $line ) {
                break;
            }
        }

        if ( ! preg_match( '#^HTTP/1\.[01] 101#', $headers ) ) {
            fclose( $fp );
            $status = '';
            if ( preg_match( '#^HTTP/\S+\s+(\d+)#', $headers, $m ) ) {
                $status = $m[1];
            }
            return new \WP_Error(
                'kmbp_livechat_ws_handshake',
                sprintf(
                    /* translators: %s: HTTP status or snippet */
                    __( 'WebSocket handshake failed (%s). Check the API key and host.', 'kinetix-messaging-by-ppros' ),
                    $status !== '' ? $status : wp_trim_words( $headers, 12, '…' )
                )
            );
        }

        return $fp;
    }

    private function ws_encode_text( string $payload ): string {
        $length   = strlen( $payload );
        $mask_key = random_bytes( 4 );
        $frame    = chr( 0x81 );

        if ( $length <= 125 ) {
            $frame .= chr( 0x80 | $length );
        } elseif ( $length <= 65535 ) {
            $frame .= chr( 0x80 | 126 ) . pack( 'n', $length );
        } else {
            $high   = ( $length >> 32 ) & 0xFFFFFFFF;
            $low    = $length & 0xFFFFFFFF;
            $frame .= chr( 0x80 | 127 ) . pack( 'NN', $high, $low );
        }

        $frame .= $mask_key;
        $masked = '';
        for ( $i = 0; $i < $length; $i++ ) {
            $masked .= $payload[ $i ] ^ $mask_key[ $i % 4 ];
        }
        return $frame . $masked;
    }

    private function ws_encode_close(): string {
        $mask_key = random_bytes( 4 );
        $payload  = pack( 'n', 1000 );
        $masked   = ( $payload[0] ^ $mask_key[0] ) . ( $payload[1] ^ $mask_key[1] );
        return chr( 0x88 ) . chr( 0x80 | 2 ) . $mask_key . $masked;
    }

    /**
     * Read the first complete text frame (skips ping/pong/binary). Empty string on timeout.
     */
    private function ws_read_text( $fp ): string {
        $header = $this->ws_read_bytes( $fp, 2 );
        if ( strlen( $header ) < 2 ) {
            return '';
        }

        $byte1    = ord( $header[0] );
        $byte2    = ord( $header[1] );
        $opcode   = $byte1 & 0x0F;
        $masked   = ( $byte2 & 0x80 ) === 0x80;
        $len      = $byte2 & 0x7F;

        if ( 126 === $len ) {
            $ext = $this->ws_read_bytes( $fp, 2 );
            if ( strlen( $ext ) < 2 ) {
                return '';
            }
            $unpacked = unpack( 'n', $ext );
            $len      = (int) ( $unpacked[1] ?? 0 );
        } elseif ( 127 === $len ) {
            $ext = $this->ws_read_bytes( $fp, 8 );
            if ( strlen( $ext ) < 8 ) {
                return '';
            }
            $unpacked = unpack( 'N2', $ext );
            $len      = (int) ( $unpacked[2] ?? 0 );
        }

        $mask_key = '';
        if ( $masked ) {
            $mask_key = $this->ws_read_bytes( $fp, 4 );
            if ( strlen( $mask_key ) < 4 ) {
                return '';
            }
        }

        // Cap read so a huge history blob cannot stall the agent send.
        $len     = min( $len, 65535 );
        $payload = $len > 0 ? $this->ws_read_bytes( $fp, $len ) : '';
        if ( $masked && $payload !== '' ) {
            $decoded = '';
            $plen    = strlen( $payload );
            for ( $i = 0; $i < $plen; $i++ ) {
                $decoded .= $payload[ $i ] ^ $mask_key[ $i % 4 ];
            }
            $payload = $decoded;
        }

        if ( 0x1 === $opcode ) {
            return $payload;
        }
        if ( 0x9 === $opcode ) {
            // Ping — ignore; we are about to close anyway.
            return '';
        }
        return '';
    }

    private function ws_read_bytes( $fp, int $n ): string {
        $data = '';
        while ( strlen( $data ) < $n && ! feof( $fp ) ) {
            $chunk = fread( $fp, $n - strlen( $data ) );
            if ( false === $chunk || '' === $chunk ) {
                break;
            }
            $data .= $chunk;
        }
        return $data;
    }
}
