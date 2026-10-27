<?php
/**
 * Live Chat connector via livechat.pluginpros.co (WebSocket rooms).
 *
 * Inbound  — POST /wp-json/kmbp/v1/livechat/inbound
 *            The public site widget POSTs visitor messages so they appear
 *            in the WordPress inbox. Authenticated with a widget token.
 *
 * Upload   — POST /wp-json/kmbp/v1/livechat/upload
 *            Multipart field "file" (JPEG, PNG, GIF, WebP, PDF). Saved with
 *            wp_handle_upload into the WordPress uploads directory and
 *            registered in the media library. Widget token or an agent session.
 *
 * Outbound — POST /wp-json/kmbp/v1/livechat/send
 *            Agents POST { conversationId, recipientId (room_id), text, attachmentId }.
 *            Delivered over a short-lived WebSocket connection to the same room.
 *
 * Public widget config is localised from PHP (not this REST surface).
 *
 * Settings keys (stored under kmbp_platform_settings['livechat']):
 *   enabled, apiKey, host, widgetToken, brandName, tagline, welcomeMessage,
 *   iceList, themeColor, position, onlineText, agentName, askName,
 *   starterPrompt, autoReply, autoReplyMsg, autoAssign
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
            '/livechat/identify',
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'handle_identify' ),
                'permission_callback' => array( $this, 'check_inbound_permission' ),
            )
        );

        register_rest_route(
            $ns,
            '/livechat/upload',
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'handle_upload' ),
                'permission_callback' => array( $this, 'check_upload_permission' ),
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
                    'text'           => array( 'required' => false, 'type' => 'string' ),
                    'attachmentId'   => array( 'required' => false, 'type' => 'integer' ),
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

    /**
     * Visitors use the public widget token. Agents use their WordPress session.
     */
    public function check_upload_permission( WP_REST_Request $request ): bool {
        if ( ! $this->is_channel_enabled() ) {
            return false;
        }
        if ( $this->check_access() ) {
            return true;
        }
        return $this->check_inbound_permission( $request );
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

        $cfg           = $this->get_settings();
        $text          = sanitize_textarea_field( (string) $request->get_param( 'text' ) );
        $name          = sanitize_text_field( (string) $request->get_param( 'senderName' ) );
        $email         = sanitize_email( (string) $request->get_param( 'email' ) );
        $msg_uid       = sanitize_text_field( (string) $request->get_param( 'messageId' ) );
        $attachment_id = absint( $request->get_param( 'attachmentId' ) );
        $attachment    = $this->livechat_attachment_payload( $attachment_id );

        if ( $attachment_id > 0 && ! $attachment ) {
            return new WP_Error(
                'kmbp_livechat_bad_file',
                __( 'That file is no longer available.', 'kinetix-messaging-by-ppros' ),
                array( 'status' => 400 )
            );
        }

        $identity = $this->resolve_visitor_identity( $name, $email );
        $name     = $identity['name'];
        $email    = $identity['email'];
        $room_id  = $this->reconcile_room_id(
            (string) $request->get_param( 'roomId' ),
            $email,
            $identity['roomId']
        );

        if ( '' === $room_id || ! is_email( $email ) ) {
            return new WP_Error( 'kmbp_livechat_email_required', __( 'A valid email address is required to chat.', 'kinetix-messaging-by-ppros' ), array( 'status' => 400 ) );
        }
        if ( '' === trim( $text ) && ! $attachment ) {
            return new WP_Error( 'kmbp_empty_body', __( 'Message text is required.', 'kinetix-messaging-by-ppros' ), array( 'status' => 400 ) );
        }
        if ( strlen( $text ) > 4000 ) {
            $text = substr( $text, 0, 4000 );
        }
        if ( '' === $name ) {
            $name = $email;
        }
        $name = mb_substr( $name, 0, 80 );

        $body            = $attachment ? $this->attachment_message_body( $text, $attachment ) : $text;
        $subject         = mb_substr( $body, 0, 80 ) ?: __( 'Live chat', 'kinetix-messaging-by-ppros' );
        $conversation_id = $this->find_or_create_conversation( $room_id, $name, $email, $subject );
        if ( is_wp_error( $conversation_id ) ) {
            return $conversation_id;
        }

        $this->sync_contact_details( $conversation_id, $name, $email );

        $is_first = $this->conversation_message_count( $conversation_id ) === 0;

        $external_id = '' !== $msg_uid ? 'lc_' . $msg_uid : 'lc_' . md5( $room_id . '|' . $body . '|' . $name . '|' . (string) $attachment_id );
        $meta        = array(
            'channel' => 'livechat',
            'roomId'  => $room_id,
            'email'   => $email,
        );
        if ( $attachment ) {
            $meta['attachment'] = $attachment;
            $meta['caption']    = $text;
        }
        $message_id = $this->store_message(
            $conversation_id,
            $attachment ? $body : esc_html( $text ),
            'contact',
            $name,
            $meta,
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
                'text' => $body,
            )
        );

        return rest_ensure_response(
            array(
                'ok'             => true,
                'conversationId' => $conversation_id,
                'messageId'      => $message_id,
                'roomId'         => $room_id,
            )
        );
    }

    /**
     * Return the canonical WebSocket room for a visitor so the widget never
     * reuses an old browser room (which mixed unrelated inbox threads).
     */
    public function handle_identify( WP_REST_Request $request ) {
        $name  = sanitize_text_field( (string) $request->get_param( 'senderName' ) );
        $email = sanitize_email( (string) $request->get_param( 'email' ) );
        $identity = $this->resolve_visitor_identity( $name, $email );

        if ( '' === $identity['roomId'] || ! is_email( $identity['email'] ) ) {
            return new WP_Error(
                'kmbp_livechat_email_required',
                __( 'A valid email address is required to chat.', 'kinetix-messaging-by-ppros' ),
                array( 'status' => 400 )
            );
        }

        return rest_ensure_response(
            array(
                'ok'             => true,
                'roomId'         => $identity['roomId'],
                'name'           => $identity['name'],
                'email'          => $identity['email'],
                'identityLocked' => ! empty( $identity['locked'] ),
            )
        );
    }

    /**
     * Save a live chat image, GIF, or PDF with the WordPress uploads API.
     */
    public function handle_upload( WP_REST_Request $request ) {
        if ( ! $this->rate_limit_upload() ) {
            return new WP_Error(
                'kmbp_livechat_rate_limited',
                __( 'Too many uploads. Please wait a moment and try again.', 'kinetix-messaging-by-ppros' ),
                array( 'status' => 429 )
            );
        }

        $files = $request->get_file_params();
        $file  = isset( $files['file'] ) && is_array( $files['file'] ) ? $files['file'] : array();
        if ( empty( $file['tmp_name'] ) ) {
            $code = isset( $file['error'] ) ? (int) $file['error'] : UPLOAD_ERR_NO_FILE;
            return new WP_Error(
                'kmbp_livechat_no_file',
                $this->upload_error_message( $code ),
                array( 'status' => 400 )
            );
        }

        $error = isset( $file['error'] ) ? (int) $file['error'] : UPLOAD_ERR_OK;
        if ( UPLOAD_ERR_OK !== $error ) {
            return new WP_Error(
                'kmbp_livechat_upload',
                $this->upload_error_message( $error ),
                array( 'status' => 400 )
            );
        }

        $size = isset( $file['size'] ) ? (int) $file['size'] : 0;
        if ( $size <= 0 || $size > self::max_upload_bytes() ) {
            return new WP_Error(
                'kmbp_livechat_file_size',
                __( 'That file is too large.', 'kinetix-messaging-by-ppros' ),
                array( 'status' => 400 )
            );
        }

        $mimes   = $this->upload_mimes();
        $checked = wp_check_filetype( (string) ( $file['name'] ?? '' ), $mimes );
        if ( empty( $checked['type'] ) ) {
            return new WP_Error(
                'kmbp_livechat_file_type',
                __( 'Only images, GIFs, and PDFs can be uploaded.', 'kinetix-messaging-by-ppros' ),
                array( 'status' => 400 )
            );
        }

        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/media.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';

        if ( empty( $_FILES['file'] ) ) {
            // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- upload payload, checked by wp_handle_upload.
            $_FILES['file'] = $file;
        }

        add_filter( 'upload_dir', array( $this, 'livechat_upload_dir' ) );
        $attach_id = media_handle_upload(
            'file',
            0,
            array(),
            array(
                'test_form' => false,
                'mimes'     => $mimes,
            )
        );
        remove_filter( 'upload_dir', array( $this, 'livechat_upload_dir' ) );

        if ( is_wp_error( $attach_id ) ) {
            return new WP_Error(
                'kmbp_livechat_upload',
                $attach_id->get_error_message(),
                array( 'status' => 400 )
            );
        }

        $attach_id = (int) $attach_id;
        $mime      = (string) get_post_mime_type( $attach_id );
        $path      = (string) get_attached_file( $attach_id );
        if ( ! in_array( $mime, array_values( $mimes ), true ) || ! $this->file_is_livechat_upload( $path ) || ! $this->file_matches_mime( $path, $mime ) ) {
            wp_delete_attachment( $attach_id, true );
            return new WP_Error(
                'kmbp_livechat_file_type',
                __( 'Only images, GIFs, and PDFs can be uploaded.', 'kinetix-messaging-by-ppros' ),
                array( 'status' => 400 )
            );
        }

        $original = sanitize_file_name( wp_basename( (string) ( $file['name'] ?? '' ) ) );
        update_post_meta( $attach_id, '_kmbp_livechat_upload', '1' );
        if ( '' !== $original ) {
            update_post_meta( $attach_id, '_kmbp_livechat_filename', $original );
        }

        $payload = $this->livechat_attachment_payload( $attach_id );
        if ( ! $payload ) {
            wp_delete_attachment( $attach_id, true );
            return new WP_Error(
                'kmbp_livechat_upload',
                __( 'Could not upload that file.', 'kinetix-messaging-by-ppros' ),
                array( 'status' => 400 )
            );
        }

        return rest_ensure_response(
            array(
                'ok'   => true,
                'id'   => $payload['id'],
                'url'  => $payload['url'],
                'name' => $payload['name'],
                'mime' => $payload['mime'],
                'kind' => $payload['kind'],
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

    /**
     * Agent reply. Text is optional when a live chat attachment is included.
     */
    public function handle_send( WP_REST_Request $request ) {
        $cfg = $this->get_settings();
        if ( empty( $cfg['enabled'] ) ) {
            return new WP_Error(
                'kmbp_channel_disabled',
                sprintf(
                    /* translators: %s: channel slug */
                    __( '%s channel is not enabled.', 'kinetix-messaging-by-ppros' ),
                    $this->get_channel_slug()
                ),
                array( 'status' => 503 )
            );
        }

        $conversation_id = (int) $request->get_param( 'conversationId' );
        $recipient_id    = sanitize_text_field( (string) $request->get_param( 'recipientId' ) );
        $text            = sanitize_textarea_field( (string) $request->get_param( 'text' ) );
        $attachment_id   = absint( $request->get_param( 'attachmentId' ) );
        $attachment      = $this->livechat_attachment_payload( $attachment_id );

        if ( $attachment_id > 0 && ! $attachment ) {
            return new WP_Error(
                'kmbp_livechat_bad_file',
                __( 'That file is no longer available.', 'kinetix-messaging-by-ppros' ),
                array( 'status' => 400 )
            );
        }
        if ( '' === trim( $text ) && ! $attachment ) {
            return new WP_Error( 'kmbp_empty_body', __( 'Message text is required.', 'kinetix-messaging-by-ppros' ), array( 'status' => 400 ) );
        }
        if ( strlen( $text ) > 4000 ) {
            $text = substr( $text, 0, 4000 );
        }

        $result = $this->send_message( $recipient_id, $text, $cfg, $attachment ? $attachment : array() );
        if ( is_wp_error( $result ) ) {
            return $result;
        }

        $current_user = wp_get_current_user();
        $meta         = array(
            'direction'   => 'outbound',
            'recipientId' => $recipient_id,
            'apiResult'   => $result,
        );
        if ( $attachment ) {
            $meta['attachment'] = $attachment;
            $meta['caption']    = $text;
        }

        $message_id = $this->store_message(
            $conversation_id,
            $attachment ? $this->attachment_message_body( $text, $attachment ) : $text,
            'agent',
            $current_user->display_name ?: $current_user->user_email,
            $meta
        );

        return rest_ensure_response(
            array(
                'sent'       => true,
                'messageId'  => $message_id,
                'channel'    => $this->get_channel_slug(),
                'attachment' => $attachment,
            )
        );
    }

    /**
     * @param array $attachment Live chat attachment payload, or empty.
     */
    protected function send_message( string $recipient_id, string $text, array $cfg = array(), array $attachment = array() ) {
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

        $wire = $text;
        if ( ! empty( $attachment['url'] ) ) {
            $url  = (string) $attachment['url'];
            $wire = '' !== trim( $text ) ? $text . "\n" . $url : $url;
        }

        $payload = array(
            'content'     => $wire,
            'sender_name' => $agent_name,
            'sender_type' => 'agent',
        );
        if ( ! empty( $attachment['url'] ) ) {
            $payload['attachment'] = array(
                'id'   => (int) ( $attachment['id'] ?? 0 ),
                'url'  => (string) $attachment['url'],
                'name' => (string) ( $attachment['name'] ?? '' ),
                'mime' => (string) ( $attachment['mime'] ?? '' ),
                'kind' => (string) ( $attachment['kind'] ?? '' ),
            );
        }

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
     * Stable room per logged-in WordPress user or guest email.
     * Prevents one browser from appending new chats onto an old WebSocket/inbox thread.
     */
    public function identity_room_id( string $email = '' ): string {
        if ( is_user_logged_in() ) {
            return $this->sanitize_room_id( 'kmbp-user-' . (int) get_current_user_id() );
        }
        $email = strtolower( sanitize_email( $email ) );
        if ( ! is_email( $email ) ) {
            return '';
        }
        return $this->sanitize_room_id( 'kmbp-e-' . substr( md5( 'kmbp|' . $email ), 0, 28 ) );
    }

    /**
     * Prefer the WordPress account when the visitor is logged in.
     *
     * @return array{name:string,email:string,roomId:string,locked:bool}
     */
    public function resolve_visitor_identity( string $name, string $email ): array {
        $locked = false;
        $user   = wp_get_current_user();
        if ( $user instanceof WP_User && $user->ID > 0 ) {
            $locked = true;
            if ( is_email( (string) $user->user_email ) ) {
                $email = (string) $user->user_email;
            }
            if ( (string) $user->display_name !== '' ) {
                $name = sanitize_text_field( (string) $user->display_name );
            }
        }

        $email = sanitize_email( $email );
        $name  = sanitize_text_field( $name );
        if ( '' === $name && is_email( $email ) ) {
            $name = $email;
        }

        return array(
            'name'   => mb_substr( $name, 0, 80 ),
            'email'  => $email,
            'roomId' => $this->identity_room_id( $email ),
            'locked' => $locked,
        );
    }

    /**
     * Prefer the canonical identity room. If this REST request is unauthenticated
     * but the widget booted as a logged-in WP user, accept that user room when
     * the posted email matches the account.
     */
    public function reconcile_room_id( string $client_room, string $email, string $canonical = '' ): string {
        $canonical   = $canonical !== '' ? $canonical : $this->identity_room_id( $email );
        $client_room = $this->sanitize_room_id( $client_room );

        if ( $canonical && $client_room === $canonical ) {
            return $canonical;
        }

        if ( preg_match( '/^kmbp-user-(\d+)$/', $client_room, $m ) ) {
            $claimed = get_user_by( 'id', (int) $m[1] );
            if ( $claimed instanceof WP_User && is_email( $claimed->user_email ) && strtolower( $claimed->user_email ) === strtolower( $email ) ) {
                return $client_room;
            }
        }

        return $canonical;
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

    private function sync_contact_details( int $conversation_id, string $name, string $email ): void {
        global $wpdb;
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- KMBP custom tables.
        $wpdb->update(
            $wpdb->prefix . 'kmbp_conversations',
            array(
                'contact_name'   => $name,
                'contact_handle' => $email,
            ),
            array( 'id' => $conversation_id ),
            array( '%s', '%s' ),
            array( '%d' )
        );
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

    /**
     * @return array<string,string>
     */
    private function upload_mimes(): array {
        return array(
            'jpg|jpeg|jpe' => 'image/jpeg',
            'png'          => 'image/png',
            'gif'          => 'image/gif',
            'webp'         => 'image/webp',
            'pdf'          => 'application/pdf',
        );
    }

    public static function max_upload_bytes(): int {
        $cap = 8 * MB_IN_BYTES;
        if ( function_exists( 'wp_max_upload_size' ) ) {
            $cap = (int) min( $cap, wp_max_upload_size() );
        }
        return max( 1, $cap );
    }

    public static function uploads_base_url(): string {
        $uploads = wp_upload_dir();
        return trailingslashit( (string) ( $uploads['baseurl'] ?? '' ) ) . 'kmbp-livechat';
    }

    /**
     * Keep live chat files under wp-content/uploads/kmbp-livechat.
     *
     * @param array $dirs WordPress upload_dir payload.
     * @return array
     */
    public function livechat_upload_dir( array $dirs ): array {
        $subdir         = '/kmbp-livechat' . (string) ( $dirs['subdir'] ?? '' );
        $dirs['subdir'] = $subdir;
        $dirs['path']   = (string) $dirs['basedir'] . $subdir;
        $dirs['url']    = (string) $dirs['baseurl'] . $subdir;
        return $dirs;
    }

    /**
     * @return array{id:int,url:string,name:string,mime:string,kind:string}|null
     */
    private function livechat_attachment_payload( int $attachment_id ): ?array {
        if ( $attachment_id <= 0 ) {
            return null;
        }
        $post = get_post( $attachment_id );
        if ( ! $post instanceof WP_Post || 'attachment' !== $post->post_type ) {
            return null;
        }
        if ( '1' !== (string) get_post_meta( $attachment_id, '_kmbp_livechat_upload', true ) ) {
            return null;
        }

        $mime    = (string) get_post_mime_type( $attachment_id );
        $allowed = array_values( $this->upload_mimes() );
        if ( ! in_array( $mime, $allowed, true ) ) {
            return null;
        }

        $path = (string) get_attached_file( $attachment_id );
        $url  = (string) wp_get_attachment_url( $attachment_id );
        if ( '' === $url || ! $this->file_is_livechat_upload( $path ) ) {
            return null;
        }

        $saved = sanitize_file_name( (string) get_post_meta( $attachment_id, '_kmbp_livechat_filename', true ) );
        $name  = '' !== $saved ? $saved : wp_basename( $path );
        if ( 'application/pdf' === $mime ) {
            $kind = 'pdf';
        } elseif ( 'image/gif' === $mime ) {
            $kind = 'gif';
        } else {
            $kind = 'image';
        }

        return array(
            'id'   => $attachment_id,
            'url'  => $url,
            'name' => $name,
            'mime' => $mime,
            'kind' => $kind,
        );
    }

    /**
     * Inbox preview text when a message is only a file, or the visitor caption.
     */
    private function attachment_message_body( string $text, array $attachment ): string {
        if ( '' !== trim( $text ) ) {
            return $text;
        }
        $kind = (string) ( $attachment['kind'] ?? '' );
        if ( 'pdf' === $kind ) {
            return __( 'Sent a PDF', 'kinetix-messaging-by-ppros' );
        }
        if ( 'gif' === $kind ) {
            return __( 'Sent a GIF', 'kinetix-messaging-by-ppros' );
        }
        return __( 'Sent an image', 'kinetix-messaging-by-ppros' );
    }

    private function file_is_livechat_upload( string $path ): bool {
        $uploads = wp_upload_dir();
        $base    = trailingslashit( wp_normalize_path( (string) $uploads['basedir'] . '/kmbp-livechat' ) );
        $path    = wp_normalize_path( $path );
        return '' !== $path && 0 === strpos( $path, $base );
    }

    private function file_matches_mime( string $path, string $mime ): bool {
        if ( '' === $path || ! is_readable( $path ) ) {
            return false;
        }
        if ( 'application/pdf' === $mime ) {
            // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen -- local upload sniff, not a remote request.
            $handle = fopen( $path, 'rb' );
            if ( ! $handle ) {
                return false;
            }
            // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fread -- local upload sniff, not a remote request.
            $head = fread( $handle, 5 );
            // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
            fclose( $handle );
            return '%PDF-' === $head;
        }
        $detected = wp_get_image_mime( $path );
        return is_string( $detected ) && $detected === $mime;
    }

    private function upload_error_message( int $code ): string {
        if ( UPLOAD_ERR_INI_SIZE === $code || UPLOAD_ERR_FORM_SIZE === $code ) {
            return __( 'That file is too large.', 'kinetix-messaging-by-ppros' );
        }
        if ( UPLOAD_ERR_NO_FILE === $code ) {
            return __( 'Choose a file to upload.', 'kinetix-messaging-by-ppros' );
        }
        return __( 'Could not upload that file.', 'kinetix-messaging-by-ppros' );
    }

    private function rate_limit_upload(): bool {
        if ( is_user_logged_in() && $this->check_access() ) {
            $key = 'kmbp_lc_up_u_' . get_current_user_id();
            $max = 30;
        } else {
            $ip  = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( (string) $_SERVER['REMOTE_ADDR'] ) ) : 'unknown';
            $key = 'kmbp_lc_up_' . md5( $ip );
            $max = 8;
        }
        $n = (int) get_transient( $key );
        if ( $n >= $max ) {
            return false;
        }
        set_transient( $key, $n + 1, 10 * MINUTE_IN_SECONDS );
        return true;
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

    // phpcs:disable WordPress.WP.AlternativeFunctions.file_system_operations_fwrite, WordPress.WP.AlternativeFunctions.file_system_operations_fclose, WordPress.WP.AlternativeFunctions.file_system_operations_fread -- RFC 6455 sockets cannot use WP_Filesystem or wp_remote_*.
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
    // phpcs:enable WordPress.WP.AlternativeFunctions.file_system_operations_fwrite, WordPress.WP.AlternativeFunctions.file_system_operations_fclose, WordPress.WP.AlternativeFunctions.file_system_operations_fread
}
