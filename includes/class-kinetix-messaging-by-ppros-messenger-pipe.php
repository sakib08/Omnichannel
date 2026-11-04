<?php
/**
 * Facebook Messenger connector.
 *
 * Inbound  — GET  /wp-json/kmbp/v1/webhooks/messenger  (hub verification)
 *            POST /wp-json/kmbp/v1/webhooks/messenger  (page events)
 *            Register in: Meta for Developers → App → Webhooks → Page
 *            Subscribe fields: messages, messaging_postbacks, message_deliveries
 *
 * Outbound — POST /wp-json/kmbp/v1/messenger/send
 *            Agents POST { conversationId, recipientId (PSID), text }.
 *
 * Settings keys (stored under kmbp_platform_settings['messenger']):
 *   enabled, pageToken, appSecret, verifyToken, pageId, appId,
 *   fetchProfile, typingIndicator, readReceipts, autoReply, autoReplyMsg
 *
 * @package Kinetix_Messaging_By_Ppros
 */

defined( 'ABSPATH' ) || die( 'No script kiddies please!' );

class Kinetix_Messaging_By_Ppros_Messenger_Pipe extends Kinetix_Messaging_By_Ppros_Channel_Pipe_Base {

    const GRAPH_API = 'https://graph.facebook.com/v23.0/';

    public function get_channel_slug(): string {
        return 'messenger';
    }

    public function register_routes(): void {
        $ns = Kinetix_Messaging_By_Ppros_Rest_Api::NAMESPACE_V1;

        register_rest_route(
            $ns,
            '/webhooks/messenger',
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
            '/messenger/test-connection',
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'handle_test_connection' ),
                'permission_callback' => array( $this, 'check_manage_settings' ),
            )
        );

        register_rest_route(
            $ns,
            '/messenger/send',
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
        return new WP_REST_Response( $challenge, 200, array( 'Content-Type' => 'text/plain; charset=utf-8' ) );
    }

    /**
     * Confirm the saved Page access token with the Graph API.
     */
    public function handle_test_connection() {
        $cfg   = $this->get_settings();
        $token = trim( (string) ( $cfg['pageToken'] ?? '' ) );
        if ( '' === $token ) {
            return new WP_Error(
                'kmbp_messenger_not_configured',
                __( 'Enter a Page Access Token first.', 'kinetix-messaging-by-ppros' ),
                array( 'status' => 400 )
            );
        }

        $page = $this->http(
            self::GRAPH_API . 'me?fields=id,name&access_token=' . rawurlencode( $token )
        );
        if ( is_wp_error( $page ) ) {
            return new WP_Error(
                'kmbp_messenger_verify_failed',
                $page->get_error_message(),
                array( 'status' => 400 )
            );
        }

        $page_id   = preg_replace( '/\D+/', '', (string) ( $page['id'] ?? '' ) );
        $page_name = sanitize_text_field( (string) ( $page['name'] ?? '' ) );
        if ( ! is_string( $page_id ) || '' === $page_id ) {
            return new WP_Error(
                'kmbp_messenger_verify_failed',
                __( 'Facebook did not return a Page for this token.', 'kinetix-messaging-by-ppros' ),
                array( 'status' => 400 )
            );
        }

        $expected = preg_replace( '/\D+/', '', (string) ( $cfg['pageId'] ?? '' ) );
        if ( is_string( $expected ) && '' !== $expected && $expected !== $page_id ) {
            return new WP_Error(
                'kmbp_messenger_page_mismatch',
                sprintf(
                    /* translators: 1: page name, 2: token page id, 3: typed page id */
                    __( 'This token belongs to %1$s (%2$s), not Page ID %3$s.', 'kinetix-messaging-by-ppros' ),
                    '' !== $page_name ? $page_name : __( 'another Page', 'kinetix-messaging-by-ppros' ),
                    $page_id,
                    $expected
                ),
                array( 'status' => 400 )
            );
        }

        $app_id     = trim( (string) ( $cfg['appId'] ?? '' ) );
        $app_secret = trim( (string) ( $cfg['appSecret'] ?? '' ) );
        if ( '' !== $app_id && '' !== $app_secret ) {
            $scope_error = $this->check_page_token_scopes( $token, $app_id, $app_secret );
            if ( is_wp_error( $scope_error ) ) {
                return $scope_error;
            }
        }

        $this->remember_verified_page( $page_id, $page_name, ! is_string( $expected ) || '' === $expected );

        return rest_ensure_response(
            array(
                'ok'       => true,
                'pageId'   => $page_id,
                'pageName' => $page_name,
                'message'  => sprintf(
                    /* translators: %s: Facebook Page name or id */
                    __( 'Connected to %s.', 'kinetix-messaging-by-ppros' ),
                    '' !== $page_name ? $page_name : $page_id
                ),
            )
        );
    }

    /**
     * Require a Page token that can send and receive Messenger messages.
     *
     * @return true|\WP_Error
     */
    private function check_page_token_scopes( string $token, string $app_id, string $app_secret ) {
        $app_token = $app_id . '|' . $app_secret;
        $debug     = $this->http(
            self::GRAPH_API . 'debug_token?input_token=' . rawurlencode( $token ) . '&access_token=' . rawurlencode( $app_token )
        );
        if ( is_wp_error( $debug ) ) {
            return new WP_Error(
                'kmbp_messenger_verify_failed',
                $debug->get_error_message(),
                array( 'status' => 400 )
            );
        }

        $data = isset( $debug['data'] ) && is_array( $debug['data'] ) ? $debug['data'] : array();
        if ( empty( $data['is_valid'] ) ) {
            return new WP_Error(
                'kmbp_messenger_verify_failed',
                __( 'Facebook says this Page access token is not valid.', 'kinetix-messaging-by-ppros' ),
                array( 'status' => 400 )
            );
        }
        if ( isset( $data['type'] ) && 'PAGE' !== strtoupper( (string) $data['type'] ) ) {
            return new WP_Error(
                'kmbp_messenger_verify_failed',
                __( 'Use a Page access token. A user token cannot send Messenger replies.', 'kinetix-messaging-by-ppros' ),
                array( 'status' => 400 )
            );
        }

        $scopes = isset( $data['scopes'] ) && is_array( $data['scopes'] ) ? $data['scopes'] : array();
        if ( ! in_array( 'pages_messaging', $scopes, true ) ) {
            return new WP_Error(
                'kmbp_messenger_verify_failed',
                __( 'This token is missing the pages_messaging permission.', 'kinetix-messaging-by-ppros' ),
                array( 'status' => 400 )
            );
        }

        return true;
    }

    /**
     * Fill an empty Page ID, and replace the placeholder Page name, after a successful check.
     */
    private function remember_verified_page( string $page_id, string $page_name, bool $fill_id ): void {
        $all = get_option( Kinetix_Messaging_By_Ppros_Activator::SETTINGS_OPTION, array() );
        if ( ! is_array( $all ) ) {
            return;
        }
        $cfg = isset( $all['messenger'] ) && is_array( $all['messenger'] ) ? $all['messenger'] : array();
        if ( $fill_id ) {
            $cfg['pageId'] = $page_id;
        }
        $current_name = trim( (string) ( $cfg['pageName'] ?? '' ) );
        if ( '' !== $page_name && ( '' === $current_name || 'Acme Support' === $current_name ) ) {
            $cfg['pageName'] = $page_name;
        }
        $all['messenger'] = $cfg;
        update_option( Kinetix_Messaging_By_Ppros_Activator::SETTINGS_OPTION, $all, false );
    }

    // ── Inbound webhook (POST) ─────────────────────────────────────────────

    public function handle_webhook( WP_REST_Request $request ) {
        $cfg  = $this->get_settings();
        $body = $request->get_json_params();

        if ( ! is_array( $body ) || ( $body['object'] ?? '' ) !== 'page' ) {
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
        if ( isset( $event['message'] ) && ! isset( $event['message']['is_echo'] ) ) {
            $this->process_message( $event, $cfg );
        } elseif ( isset( $event['postback'] ) ) {
            $this->process_postback( $event, $cfg );
        } elseif ( isset( $event['read'] ) ) {
            // Read receipt — no action needed.
        } elseif ( isset( $event['delivery'] ) ) {
            // Delivery receipt — no action needed.
        }
    }

    private function process_message( array $event, array $cfg ): void {
        $sender_id = (string) ( $event['sender']['id'] ?? '' );
        $mid       = (string) ( $event['message']['mid'] ?? '' );
        $text      = (string) ( $event['message']['text'] ?? '' );
        $attachments = $event['message']['attachments'] ?? array();

        if ( '' === $sender_id ) {
            return;
        }

        // Resolve text from attachments when no text body.
        if ( '' === $text && ! empty( $attachments ) ) {
            $types = array_column( $attachments, 'type' );
            $text  = '[' . implode( ', ', array_map( 'ucfirst', $types ) ) . ' attachment]';
        }

        if ( '' === $text ) {
            $text = '[Message]';
        }

        // Fetch profile name if configured.
        $contact_name = $this->maybe_get_profile_name( $sender_id, $cfg );

        $subject         = mb_substr( $text, 0, 80 ) ?: 'Messenger message';
        $conversation_id = $this->find_or_create_conversation(
            $sender_id, $contact_name, 'PSID:' . $sender_id, $subject
        );

        if ( is_wp_error( $conversation_id ) ) {
            $this->log_debug( '[KMBP Messenger] DB error: ' . $conversation_id->get_error_message() );
            return;
        }

        $this->store_message(
            $conversation_id,
            esc_html( $text ),
            'contact',
            $contact_name,
            array( 'channel' => 'messenger', 'psid' => $sender_id, 'mid' => $mid ),
            'fb_' . $mid
        );

        // Send typing indicator.
        if ( ! empty( $cfg['typingIndicator'] ) ) {
            $this->send_sender_action( $sender_id, 'typing_on', $cfg );
        }

        $this->maybe_send_auto_reply( $sender_id, $contact_name, (string) $conversation_id );

        do_action( 'kmbp_inbound_message_received', $conversation_id, 'messenger', array(
            'psid' => $sender_id, 'text' => $text,
        ) );
    }

    private function process_postback( array $event, array $cfg ): void {
        $sender_id = (string) ( $event['sender']['id'] ?? '' );
        $payload   = (string) ( $event['postback']['payload'] ?? '' );
        $title     = (string) ( $event['postback']['title'] ?? $payload );

        if ( '' === $sender_id ) {
            return;
        }

        $contact_name = $this->maybe_get_profile_name( $sender_id, $cfg );
        $conversation_id = $this->find_or_create_conversation(
            $sender_id, $contact_name, 'PSID:' . $sender_id, 'Postback: ' . $title
        );

        if ( ! is_wp_error( $conversation_id ) ) {
            $this->store_message(
                $conversation_id,
                '[Postback: ' . esc_html( $title ) . ']',
                'contact',
                $contact_name,
                array( 'channel' => 'messenger', 'psid' => $sender_id, 'postback' => $payload )
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
                'kmbp_messenger_not_configured',
                __( 'Messenger page access token is not configured.', 'kinetix-messaging-by-ppros' )
            );
        }

        $result = $this->http_post_json(
            self::GRAPH_API . 'me/messages?access_token=' . rawurlencode( $token ),
            array(
                'recipient'       => array( 'id' => $recipient_id ),
                'message'         => array( 'text' => $text ),
                'messaging_type'  => 'RESPONSE',
            )
        );

        if ( is_wp_error( $result ) ) {
            return new \WP_Error(
                'kmbp_messenger_send_error',
                sprintf(
                    /* translators: %s: Messenger API error message */
                    __( 'Messenger API error: %s', 'kinetix-messaging-by-ppros' ),
                    $result->get_error_message()
                ),
                array( 'status' => 502 )
            );
        }

        return $result;
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private function send_sender_action( string $psid, string $action, array $cfg ): void {
        $token = (string) ( $cfg['pageToken'] ?? '' );
        if ( '' === $token ) {
            return;
        }
        $this->http_post_json(
            self::GRAPH_API . 'me/messages?access_token=' . rawurlencode( $token ),
            array(
                'recipient'     => array( 'id' => $psid ),
                'sender_action' => $action,
            )
        );
    }

    /**
     * Fetch the user's name from the Graph API when fetchProfile is enabled.
     * Falls back to the PSID string on failure.
     */
    private function maybe_get_profile_name( string $psid, array $cfg ): string {
        if ( empty( $cfg['fetchProfile'] ) ) {
            return 'Messenger User';
        }

        $token = (string) ( $cfg['pageToken'] ?? '' );
        if ( '' === $token ) {
            return 'Messenger User';
        }

        // Cache per PSID to avoid hammering the Graph API on every message.
        $cache_key = 'kmbp_fb_profile_' . md5( $psid );
        $cached    = get_transient( $cache_key );
        if ( false !== $cached ) {
            return (string) $cached;
        }

        $url  = self::GRAPH_API . $psid . '?fields=first_name,last_name&access_token=' . rawurlencode( $token );
        $data = $this->http( $url );

        if ( is_wp_error( $data ) ) {
            return 'Messenger User';
        }

        $name = trim( ( $data['first_name'] ?? '' ) . ' ' . ( $data['last_name'] ?? '' ) );
        $name = $name ?: 'Messenger User';
        set_transient( $cache_key, $name, 6 * HOUR_IN_SECONDS );

        return $name;
    }
}
