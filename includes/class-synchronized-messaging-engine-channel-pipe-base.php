<?php
/**
 * Abstract base class for all channel pipe connectors.
 *
 * Provides shared DB helpers (find_or_create_conversation, store_message),
 * a common REST permission callback, and the settings accessor pattern so
 * each concrete channel pipe only needs to implement its own routes and
 * API logic.
 *
 * @package Synchronized_Messaging_Engine
 */

defined( 'ABSPATH' ) || die( 'No script kiddies please!' );

abstract class Synchronized_Messaging_Engine_Channel_Pipe_Base {

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
    public function register_hooks( Synchronized_Messaging_Engine_Loader $loader ): void {
        $loader->add_action( 'rest_api_init', $this, 'register_routes' );
    }

    // ── Shared permission callbacks ───────────────────────────────────────

    public function check_access(): bool {
        return current_user_can( Synchronized_Messaging_Engine_Activator::CAP_ACCESS_MESSAGING )
            || current_user_can( 'manage_options' );
    }

    public function check_manage_settings(): bool {
        return current_user_can( Synchronized_Messaging_Engine_Activator::CAP_MANAGE_SETTINGS )
            || current_user_can( 'manage_options' );
    }

    // ── Settings accessor ─────────────────────────────────────────────────

    /**
     * Return the full settings array for this channel from wp_options.
     * Credentials are NOT scrubbed here (this runs server-side only).
     */
    protected function get_settings(): array {
        $all = (array) get_option( Synchronized_Messaging_Engine_Activator::SETTINGS_OPTION, array() );
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
        $table   = $wpdb->prefix . 'sme_conversations';
        $channel = $this->get_channel_slug();

        // Match by external_id + channel for open conversations.
        $cid = (int) $wpdb->get_var(
            $wpdb->prepare(
                "SELECT id FROM {$table}
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
        $ok = $wpdb->insert(
            $table,
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
            return new \WP_Error( 'sme_db_error', __( 'Could not create conversation.', 'synchronized-messaging-engine' ) );
        }

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

        // Deduplicate by external message ID.
        if ( '' !== $external_id ) {
            $existing = (int) $wpdb->get_var(
                $wpdb->prepare(
                    "SELECT id FROM {$wpdb->prefix}sme_messages WHERE external_id = %s LIMIT 1",
                    $external_id
                )
            );
            if ( $existing > 0 ) {
                return $existing;
            }
        }

        $current_user = wp_get_current_user();

        $wpdb->insert(
            $wpdb->prefix . 'sme_messages',
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
            $wpdb->prefix . 'sme_conversations',
            array(
                'preview'    => wp_trim_words( wp_strip_all_tags( $body ), 14, '…' ),
                'updated_at' => current_time( 'mysql' ),
            ),
            array( 'id' => $conversation_id ),
            array( '%s', '%s' ),
            array( '%d' )
        );

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
            return new \WP_Error( 'sme_http_error', $msg, array( 'status' => $code, 'body' => $data ) );
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
                'sme_channel_disabled',
                sprintf(
                    /* translators: %s: channel slug */
                    __( '%s channel is not enabled.', 'synchronized-messaging-engine' ),
                    $this->get_channel_slug()
                ),
                array( 'status' => 503 )
            );
        }

        $conversation_id = (int) $request->get_param( 'conversationId' );
        $recipient_id    = sanitize_text_field( (string) $request->get_param( 'recipientId' ) );
        $text            = sanitize_textarea_field( (string) $request->get_param( 'text' ) );

        if ( '' === trim( $text ) ) {
            return new WP_Error( 'sme_empty_body', __( 'Message text is required.', 'synchronized-messaging-engine' ), array( 'status' => 400 ) );
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
