<?php
/**
 * Abstract base class for all channel pipe connectors.
 *
 * Provides shared DB helpers (find_or_create_conversation, store_message),
 * a common REST permission callback, and the settings accessor pattern so
 * each concrete channel pipe only needs to implement its own routes and
 * API logic.
 *
 * @package Kinetix_Messaging_By_Ppros
 */

defined( 'ABSPATH' ) || die( 'No script kiddies please!' );

abstract class Kinetix_Messaging_By_Ppros_Channel_Pipe_Base {

    // ── Each subclass must declare these ─────────────────────────────────────

    /** Returns the internal channel slug, e.g. 'telegram'. */
    abstract public function get_channel_slug(): string;

    /** Registers all REST routes for the channel. */
    abstract public function register_routes(): void;

    // ── Hook registration (called from the main orchestrator) ─────────────

    /**
     * Wire this pipe's routes (and any cron / filter hooks) into the loader.
     * Subclasses may override to add cron hooks; calling parent::register_hooks()
     * is not required but the default just adds the rest_api_init action.
     */
    public function register_hooks( Kinetix_Messaging_By_Ppros_Loader $loader ): void {
        $loader->add_action( 'rest_api_init', $this, 'register_routes' );
    }

    // ── Shared permission callbacks ───────────────────────────────────────

    /**
     * Log a debug message when WP_DEBUG is enabled.
     *
     * @param string $message Log message.
     */
    protected function log_debug( string $message ): void {
        if ( ! defined( 'WP_DEBUG' ) || ! WP_DEBUG ) {
            return;
        }
        // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log -- Debug only when WP_DEBUG is true.
        error_log( $message );
    }

    public function check_access(): bool {
        return current_user_can( Kinetix_Messaging_By_Ppros_Activator::CAP_ACCESS_MESSAGING )
            || current_user_can( 'manage_options' );
    }

    public function check_manage_settings(): bool {
        return current_user_can( Kinetix_Messaging_By_Ppros_Activator::CAP_MANAGE_SETTINGS )
            || current_user_can( 'manage_options' );
    }

    // ── Inbound webhook permission helpers ───────────────────────────────────

    /** Whether this channel is enabled in plugin settings. */
    protected function is_channel_enabled(): bool {
        $cfg = $this->get_settings();
        return ! empty( $cfg['enabled'] );
    }

    /**
     * Read an HTTP request header with a $_SERVER fallback for reverse proxies.
     */
    protected function get_request_header( WP_REST_Request $request, string $name ): string {
        $value = (string) ( $request->get_header( $name ) ?? '' );
        if ( '' !== $value ) {
            return $value;
        }
        $server_key = 'HTTP_' . strtoupper( str_replace( '-', '_', $name ) );
        return (string) ( $_SERVER[ $server_key ] ?? '' );
    }

    /**
     * Permission callback for Meta webhook hub verification (GET).
     * Used by WhatsApp, Messenger, and Instagram.
     */
    public function check_meta_hub_verify_permission( WP_REST_Request $request ): bool {
        if ( ! $this->is_channel_enabled() ) {
            return false;
        }
        $verify_token = (string) ( $this->get_settings()['verifyToken'] ?? '' );
        if ( '' === $verify_token ) {
            return false;
        }
        $mode  = (string) ( $request->get_param( 'hub_mode' ) ?? '' );
        $token = (string) ( $request->get_param( 'hub_verify_token' ) ?? '' );
        return 'subscribe' === $mode && hash_equals( $verify_token, $token );
    }

    /**
     * Verify Meta X-Hub-Signature-256 using the configured app secret.
     */
    protected function verify_meta_hub_signature( WP_REST_Request $request, string $app_secret ): bool {
        if ( '' === $app_secret ) {
            return false;
        }
        $sig_header = (string) ( $request->get_header( 'x-hub-signature-256' ) ?? '' );
        if ( '' === $sig_header ) {
            return false;
        }
        $expected = 'sha256=' . hash_hmac( 'sha256', $request->get_body(), $app_secret );
        return hash_equals( $expected, $sig_header );
    }

    /**
     * Permission callback for Meta inbound webhook POST (Messenger, Instagram, WhatsApp).
     */
    public function check_meta_inbound_webhook_permission( WP_REST_Request $request ): bool {
        if ( ! $this->is_channel_enabled() ) {
            return false;
        }
        $app_secret = (string) ( $this->get_settings()['appSecret'] ?? '' );
        return $this->verify_meta_hub_signature( $request, $app_secret );
    }

    /**
     * Validate a shared webhook token sent via X-KMBP-Token header or token query/body param.
     */
    protected function verify_webhook_token( WP_REST_Request $request, string $stored_token ): bool {
        if ( '' === $stored_token ) {
            return false;
        }
        $provided = (string) ( $request->get_header( 'x-kmbp-token' )
            ?? $request->get_param( 'token' )
            ?? '' );
        return hash_equals( $stored_token, $provided );
    }

    /**
     * Persist a single key on this channel's settings array in wp_options.
     */
    protected function update_channel_setting( string $key, $value ): void {
        $all  = (array) get_option( Kinetix_Messaging_By_Ppros_Activator::SETTINGS_OPTION, array() );
        $slug = $this->get_channel_slug();
        if ( ! isset( $all[ $slug ] ) || ! is_array( $all[ $slug ] ) ) {
            $all[ $slug ] = array();
        }
        $all[ $slug ][ $key ] = $value;
        update_option( Kinetix_Messaging_By_Ppros_Activator::SETTINGS_OPTION, $all, false );
    }

    // ── Settings accessor ─────────────────────────────────────────────────

    /**
     * Return the full settings array for this channel from wp_options.
     * Credentials are NOT scrubbed here (this runs server-side only).
     */
    protected function get_settings(): array {
        $all = (array) get_option( Kinetix_Messaging_By_Ppros_Activator::SETTINGS_OPTION, array() );
        $slug = $this->get_channel_slug();
        return isset( $all[ $slug ] ) ? (array) $all[ $slug ] : array();
    }

    // ── Conversation / message DB helpers ─────────────────────────────────

    /**
     * Find an existing open conversation for this channel by external ID
     * (the contact's unique ID on the platform, e.g. a Telegram chat_id).
     * Creates a new one if no match is found.
     *
     * @param string $external_id    Platform-specific contact ID used to thread messages.
     * @param string $contact_name   Display name of the customer.
     * @param string $contact_handle Handle / phone / username shown in the UI.
     * @param string $subject        Conversation subject (defaults to first message excerpt).
     * @return int|\WP_Error  Conversation row ID.
     */
    protected function find_or_create_conversation(
        string $external_id,
        string $contact_name,
        string $contact_handle,
        string $subject = ''
    ) {
        global $wpdb;
        $channel = $this->get_channel_slug();

        // phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- KMBP custom tables; no WordPress core API exists.

        // Match by external_id + channel for open conversations.
        $cid = (int) $wpdb->get_var(
            $wpdb->prepare(
                "SELECT id FROM {$wpdb->prefix}kmbp_conversations
                 WHERE channel = %s AND external_id = %s AND status != 'closed'
                 ORDER BY updated_at DESC LIMIT 1",
                $channel,
                $external_id
            )
        );

        if ( $cid > 0 ) {
            return $cid;
        }

        // Create a new conversation.
        $ok = $wpdb->insert( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prefix . 'kmbp_conversations',
            array(
                'channel'        => $channel,
                'external_id'    => $external_id,
                'contact_name'   => $contact_name,
                'contact_handle' => $contact_handle,
                'subject'        => $subject ?: ( $contact_name . ' — new conversation' ),
                'preview'        => '',
                'status'         => 'open',
                'priority'       => 'medium',
                'assignee_id'    => null,
                'department_id'  => null,
                'created_at'     => current_time( 'mysql' ),
                'updated_at'     => current_time( 'mysql' ),
            ),
            array( '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', null, null, '%s', '%s' )
        );

        if ( false === $ok ) {
            return new \WP_Error( 'kmbp_db_error', __( 'Could not create conversation.', 'kinetix-messaging-by-ppros' ) );
        }

        // phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        return (int) $wpdb->insert_id;
    }

    /**
     * Insert a message into the DB and update the parent conversation preview.
     *
     * @param int    $conversation_id
     * @param string $body          Plain-text or HTML content.
     * @param string $sender_type   'contact' or 'agent'.
     * @param string $sender_name   Display name.
     * @param array  $meta          Extra JSON metadata.
     * @param string $external_id   Platform message ID for deduplication.
     * @return int  Inserted message row ID.
     */
    protected function store_message(
        int $conversation_id,
        string $body,
        string $sender_type = 'contact',
        string $sender_name = '',
        array $meta = array(),
        string $external_id = ''
    ): int {
        global $wpdb;

        // phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- KMBP custom tables; no WordPress core API exists.

        // Deduplicate by external message ID.
        if ( '' !== $external_id ) {
            $existing = (int) $wpdb->get_var(
                $wpdb->prepare(
                    "SELECT id FROM {$wpdb->prefix}kmbp_messages WHERE external_id = %s LIMIT 1",
                    $external_id
                )
            );
            if ( $existing > 0 ) {
                return $existing;
            }
        }

        $current_user = wp_get_current_user();

        $wpdb->insert(
            $wpdb->prefix . 'kmbp_messages',
            array(
                'conversation_id' => $conversation_id,
                'external_id'     => $external_id,
                'sender_type'     => $sender_type,
                'sender_id'       => ( 'agent' === $sender_type && $current_user->ID > 0 ) ? (int) $current_user->ID : null,
                'sender_name'     => $sender_name,
                'body'            => wp_kses_post( $body ),
                'meta'            => wp_json_encode( $meta ),
                'sent_at'         => current_time( 'mysql' ),
            ),
            array( '%d', '%s', '%s', '%d', '%s', '%s', '%s', '%s' )
        );

        $message_id = (int) $wpdb->insert_id;

        $wpdb->update(
            $wpdb->prefix . 'kmbp_conversations',
            array(
                'preview'    => wp_trim_words( wp_strip_all_tags( $body ), 14, '…' ),
                'updated_at' => current_time( 'mysql' ),
            ),
            array( 'id' => $conversation_id ),
            array( '%s', '%s' ),
            array( '%d' )
        );

        // phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

        return $message_id;
    }

    /**
     * Make an outbound HTTP request and return the decoded JSON response,
     * or a WP_Error on failure.
     *
     * @param string $url
     * @param array  $args  wp_remote_request() args; method defaults to GET.
     * @return array|\WP_Error
     */
    protected function http( string $url, array $args = array() ) {
        $defaults = array(
            'timeout'     => 15,
            'redirection' => 3,
            'httpversion' => '1.1',
        );
        $args = wp_parse_args( $args, $defaults );

        $response = wp_remote_request( $url, $args );

        if ( is_wp_error( $response ) ) {
            return $response;
        }

        $code = wp_remote_retrieve_response_code( $response );
        $body = wp_remote_retrieve_body( $response );
        $data = json_decode( $body, true );

        if ( $code < 200 || $code >= 300 ) {
            $msg = ( is_array( $data ) && isset( $data['message'] ) ) ? $data['message'] : "HTTP {$code}";
            return new \WP_Error( 'kmbp_http_error', $msg, array( 'status' => $code, 'body' => $data ) );
        }

        return is_array( $data ) ? $data : array( 'raw' => $body );
    }

    /**
     * Convenience wrapper: POST JSON to an API.
     *
     * @return array|\WP_Error  Decoded response array, or WP_Error on failure.
     */
    protected function http_post_json( string $url, array $payload, array $headers = array() ) {
        return $this->http( $url, array(
            'method'  => 'POST',
            'headers' => array_merge(
                array( 'Content-Type' => 'application/json' ),
                $headers
            ),
            'body'    => wp_json_encode( $payload ),
        ) );
    }

    /**
     * Convenience wrapper: POST form-encoded data.
     *
     * @return array|\WP_Error
     */
    protected function http_post_form( string $url, array $fields, array $headers = array() ) {
        return $this->http( $url, array(
            'method'  => 'POST',
            'headers' => $headers,
            'body'    => $fields,
        ) );
    }

    // ── Standard send REST handler scaffold ───────────────────────────────

    /**
     * Common wrapper used by each channel's POST /{channel}/send endpoint.
     * Calls the abstract send_message() then stores the outbound message.
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

        if ( '' === trim( $text ) ) {
            return new WP_Error( 'kmbp_empty_body', __( 'Message text is required.', 'kinetix-messaging-by-ppros' ), array( 'status' => 400 ) );
        }

        $result = $this->send_message( $recipient_id, $text, $cfg );
        if ( is_wp_error( $result ) ) {
            return $result;
        }

        $current_user = wp_get_current_user();
        $message_id   = $this->store_message(
            $conversation_id,
            $text,
            'agent',
            $current_user->display_name ?: $current_user->user_email,
            array( 'direction' => 'outbound', 'recipientId' => $recipient_id, 'apiResult' => $result )
        );

        return rest_ensure_response(
            array(
                'sent'      => true,
                'messageId' => $message_id,
                'channel'   => $this->get_channel_slug(),
            )
        );
    }

    /**
     * Send an outbound message through the channel's API.
     * Each subclass must implement this.
     *
     * @param string $recipient_id  Platform-specific recipient ID.
     * @param string $text          Message text to send.
     * @param array  $cfg           Channel settings.
     * @return array|\WP_Error      API response on success.
     */
    abstract protected function send_message( string $recipient_id, string $text, array $cfg = array() );

    // ── Auto-reply helper ────────────────────────────────────────────────

    /**
     * Send an auto-reply if configured in channel settings.
     *
     * @param string $recipient_id
     * @param string $customer_name Used to interpolate {{customer_name}}.
     * @param string $ticket_id     Used to interpolate {{ticket_id}}.
     */
    protected function maybe_send_auto_reply( string $recipient_id, string $customer_name, string $ticket_id ): void {
        $cfg = $this->get_settings();
        if ( empty( $cfg['autoReply'] ) || empty( $cfg['autoReplyMsg'] ) ) {
            return;
        }
        $msg = str_replace(
            array( '{{customer_name}}', '{{ticket_id}}' ),
            array( $customer_name, $ticket_id ),
            (string) $cfg['autoReplyMsg']
        );
        $this->send_message( $recipient_id, $msg, $cfg );
    }
}
