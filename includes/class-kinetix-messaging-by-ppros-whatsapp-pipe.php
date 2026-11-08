<?php
/**
 * WhatsApp Business Cloud API connector.
 *
 * Inbound  — GET  /wp-json/kmbp/v1/webhooks/whatsapp  (hub verification)
 *            POST /wp-json/kmbp/v1/webhooks/whatsapp  (message events)
 *            Paste callback URL + verify token in:
 *            Meta for Developers → App → WhatsApp → Configuration → Webhooks
 *
 * Outbound — POST /wp-json/kmbp/v1/whatsapp/send
 *            Agents POST { conversationId, recipientId (phone), text }.
 *
 * Settings keys (stored under kmbp_platform_settings['whatsapp']):
 *   enabled, accessToken, phoneNumberId, wabaid, verifyToken, appSecret,
 *   displayPhone, autoReply, autoReplyMsg, readReceipts
 *
 * @package Kinetix_Messaging_By_Ppros
 */

defined( 'ABSPATH' ) || die( 'No script kiddies please!' );

class Kinetix_Messaging_By_Ppros_Whatsapp_Pipe extends Kinetix_Messaging_By_Ppros_Channel_Pipe_Base {

    const GRAPH_API = 'https://graph.facebook.com/v23.0/';

    public function get_channel_slug(): string {
        return 'whatsapp';
    }

    public function register_routes(): void {
        $ns = Kinetix_Messaging_By_Ppros_Rest_Api::NAMESPACE_V1;

        // GET: webhook hub verification.
        register_rest_route(
            $ns,
            '/webhooks/whatsapp',
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
            '/whatsapp/test-connection',
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'handle_test_connection' ),
                'permission_callback' => array( $this, 'check_manage_settings' ),
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
        $challenge = $this->meta_hub_param( $request, 'challenge' );
        return new WP_REST_Response( $challenge, 200, array( 'Content-Type' => 'text/plain' ) );
    }

    /**
     * Reject unsigned calls and remember why, so Test connection can show it.
     */
    public function check_meta_inbound_webhook_permission( WP_REST_Request $request ): bool {
        if ( ! $this->is_channel_enabled() ) {
            $this->note_delivery_error( __( 'WhatsApp is turned off, so an incoming message was ignored.', 'kinetix-messaging-by-ppros' ) );
            return false;
        }
        $app_secret = trim( (string) ( $this->get_settings()['appSecret'] ?? '' ) );
        if ( '' === $app_secret ) {
            $this->note_delivery_error( __( 'An incoming WhatsApp message was rejected because App Secret is empty.', 'kinetix-messaging-by-ppros' ) );
            return false;
        }
        $body = json_decode( (string) $request->get_body(), true );
        $from_whatsapp = is_array( $body ) && 'whatsapp_business_account' === (string) ( $body['object'] ?? '' );
        if ( '' === trim( $this->get_request_header( $request, 'x-hub-signature-256' ) ) ) {
            if ( $from_whatsapp ) {
                $this->note_delivery_error( __( 'WhatsApp sent a message, but this site did not receive its signature, so the message was rejected.', 'kinetix-messaging-by-ppros' ) );
            }
            return false;
        }
        if ( ! $this->verify_meta_hub_signature( $request, $app_secret ) ) {
            $this->note_delivery_error( __( 'An incoming WhatsApp message was rejected because its signature does not match the App Secret saved here.', 'kinetix-messaging-by-ppros' ) );
            return false;
        }
        return true;
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
                $value    = $change['value'] ?? array();
                $messages = $value['messages'] ?? array();
                $field    = (string) ( $change['field'] ?? '' );
                if ( 'messages' !== $field && empty( $messages ) ) {
                    continue;
                }
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
            $this->note_delivery_error(
                sprintf(
                    /* translators: %s: database error */
                    __( 'A WhatsApp message arrived but could not be saved: %s', 'kinetix-messaging-by-ppros' ),
                    $conversation_id->get_error_message()
                )
            );
            return;
        }
        delete_option( 'kmbp_whatsapp_delivery_error' );

        $this->store_message(
            $conversation_id,
            esc_html( $text ),
            'contact',
            $contact_name,
            array( 'channel' => 'whatsapp', 'from' => $from, 'type' => $type, 'msgId' => $msg_id ),
            '' !== $msg_id ? 'wa_' . $msg_id : ''
        );

        // Mark as read in WhatsApp.
        if ( ! empty( $cfg['readReceipts'] ) && '' !== $msg_id ) {
            $this->mark_read( $msg_id, $cfg );
        }

        $this->maybe_send_auto_reply( $from, $contact_name, (string) $conversation_id );

        do_action( 'kmbp_inbound_message_received', $conversation_id, 'whatsapp', array(
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
                'kmbp_whatsapp_not_configured',
                __( 'WhatsApp accessToken and phoneNumberId are required.', 'kinetix-messaging-by-ppros' )
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
                'kmbp_whatsapp_send_error',
                sprintf(
                    /* translators: %s: WhatsApp API error message */
                    __( 'WhatsApp API error: %s', 'kinetix-messaging-by-ppros' ),
                    $result->get_error_message()
                ),
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

    /**
     * Confirm the access token can read the configured WhatsApp phone number.
     */
    public function handle_test_connection() {
        $cfg      = $this->get_settings();
        $token    = trim( (string) ( $cfg['accessToken'] ?? '' ) );
        $phone_id = preg_replace( '/\D+/', '', (string) ( $cfg['phoneNumberId'] ?? '' ) );
        if ( '' === $token ) {
            return new WP_Error(
                'kmbp_whatsapp_not_configured',
                __( 'Enter a Permanent Access Token first.', 'kinetix-messaging-by-ppros' ),
                array( 'status' => 400 )
            );
        }
        if ( ! is_string( $phone_id ) || '' === $phone_id ) {
            return new WP_Error(
                'kmbp_whatsapp_not_configured',
                __( 'Enter a Phone Number ID first.', 'kinetix-messaging-by-ppros' ),
                array( 'status' => 400 )
            );
        }

        $phone = $this->graph_get( $token, $phone_id . '?fields=id,display_phone_number,verified_name,quality_rating' );
        if ( is_wp_error( $phone ) ) {
            return $phone;
        }

        $returned_id = preg_replace( '/\D+/', '', (string) ( $phone['id'] ?? '' ) );
        if ( ! is_string( $returned_id ) || $returned_id !== $phone_id ) {
            return new WP_Error(
                'kmbp_whatsapp_verify_failed',
                __( 'WhatsApp did not return this Phone Number ID.', 'kinetix-messaging-by-ppros' ),
                array( 'status' => 400 )
            );
        }

        $waba_id   = preg_replace( '/\D+/', '', (string) ( $cfg['wabaid'] ?? '' ) );
        $waba_name = '';
        if ( is_string( $waba_id ) && '' !== $waba_id ) {
            $account = $this->graph_get( $token, $waba_id . '?fields=id,name' );
            if ( is_wp_error( $account ) ) {
                return $account;
            }
            $waba_name = sanitize_text_field( (string) ( $account['name'] ?? '' ) );
            $mismatch  = $this->phone_missing_from_waba( $token, $waba_id, $phone_id );
            if ( is_wp_error( $mismatch ) ) {
                return $mismatch;
            }
        }

        $display  = sanitize_text_field( (string) ( $phone['display_phone_number'] ?? '' ) );
        $verified = sanitize_text_field( (string) ( $phone['verified_name'] ?? '' ) );
        $delivery = $this->ensure_inbound_delivery( $token, $waba_id, $cfg );
        if ( is_wp_error( $delivery ) ) {
            return new WP_Error(
                'kmbp_whatsapp_not_subscribed',
                $delivery->get_error_message(),
                array( 'status' => 400 )
            );
        }
        $waba_id = (string) $delivery;
        $this->remember_whatsapp_phone( $display, $waba_id );

        if ( '' !== $verified && '' !== $display ) {
            $message = sprintf(
                /* translators: 1: verified WhatsApp business name, 2: display phone number */
                __( 'Connected to %1$s (%2$s). New WhatsApp messages will come into the inbox.', 'kinetix-messaging-by-ppros' ),
                $verified,
                $display
            );
        } else {
            $label = '' !== $verified ? $verified : ( '' !== $display ? $display : $phone_id );
            $message = sprintf(
                /* translators: %s: WhatsApp business name, phone number, or phone number id */
                __( 'Connected to %s. New WhatsApp messages will come into the inbox.', 'kinetix-messaging-by-ppros' ),
                $label
            );
        }

        return rest_ensure_response(
            array(
                'ok'             => true,
                'phoneNumberId'  => $phone_id,
                'displayPhone'   => $display,
                'connectedPhone' => Kinetix_Messaging_By_Ppros_Shortcodes::whatsapp_phone_digits(
                    array( 'displayPhone' => $display )
                ),
                'wabaid'         => $waba_id,
                'verifiedName'   => $verified,
                'qualityRating'  => sanitize_text_field( (string) ( $phone['quality_rating'] ?? '' ) ),
                'wabaName'       => $waba_name,
                'message'        => $message,
            )
        );
    }

    /**
     * Register this site's webhook with Meta and subscribe the account to messages.
     *
     * @return string|\WP_Error WABA id when delivery is set up.
     */
    private function ensure_inbound_delivery( string $token, string $waba_id, array $cfg ) {
        $app_secret   = trim( (string) ( $cfg['appSecret'] ?? '' ) );
        $verify_token = trim( (string) ( $cfg['verifyToken'] ?? '' ) );
        if ( '' === $app_secret ) {
            return new WP_Error(
                'kmbp_whatsapp_no_secret',
                __( 'App Secret is empty, so WhatsApp message notifications are rejected.', 'kinetix-messaging-by-ppros' )
            );
        }
        if ( '' === $verify_token ) {
            return new WP_Error(
                'kmbp_whatsapp_no_verify',
                __( 'Webhook Verify Token is empty, so Meta cannot confirm where to send messages.', 'kinetix-messaging-by-ppros' )
            );
        }

        $debug = $this->debug_token( $token );
        if ( is_wp_error( $debug ) ) {
            return new WP_Error(
                'kmbp_whatsapp_debug',
                sprintf(
                    /* translators: %s: Graph API error */
                    __( 'Could not read this token from Meta: %s', 'kinetix-messaging-by-ppros' ),
                    $debug->get_error_message()
                )
            );
        }
        $app_id = preg_replace( '/\D+/', '', (string) ( $debug['data']['app_id'] ?? '' ) );
        if ( ! is_string( $app_id ) || '' === $app_id ) {
            return new WP_Error(
                'kmbp_whatsapp_no_app',
                __( 'Meta did not return an App ID for this token, so the message webhook cannot be registered.', 'kinetix-messaging-by-ppros' )
            );
        }
        if ( '' === $waba_id ) {
            $waba_id = $this->waba_id_from_debug( $debug );
        }

        $callback = rest_url( 'kmbp/v1/webhooks/whatsapp' );
        $probe      = $this->probe_webhook( $verify_token, $callback );
        $probe_data = is_wp_error( $probe ) ? $probe->get_error_data() : array();
        if ( is_wp_error( $probe ) && ( ! is_array( $probe_data ) || empty( $probe_data['transport'] ) ) ) {
            return new WP_Error(
                'kmbp_whatsapp_verify',
                sprintf(
                    /* translators: %s: webhook check error */
                    __( 'Meta could not verify the Webhook Verify Token. %s', 'kinetix-messaging-by-ppros' ),
                    $probe->get_error_message()
                )
            );
        }
        delete_option( 'kmbp_whatsapp_delivery_error' );

        $app_token = $app_id . '|' . $app_secret;
        $hook      = $this->http_post_form(
            self::GRAPH_API . $app_id . '/subscriptions',
            array(
                'object'        => 'whatsapp_business_account',
                'callback_url'  => $callback,
                'verify_token'  => $verify_token,
                'fields'        => 'messages',
                'access_token'  => $app_token,
            )
        );
        if ( is_wp_error( $hook ) ) {
            $detail = $hook->get_error_message();
            if ( is_wp_error( $probe ) ) {
                $detail .= ' ' . $probe->get_error_message();
            }
            return new WP_Error(
                'kmbp_whatsapp_webhook',
                sprintf(
                    /* translators: %s: Meta or webhook error */
                    __( 'WhatsApp did not register message delivery: %s', 'kinetix-messaging-by-ppros' ),
                    $detail
                )
            );
        }

        $account = $this->subscribe_to_messages( $token, $waba_id, $callback, $verify_token );
        if ( is_wp_error( $account ) ) {
            return new WP_Error(
                'kmbp_whatsapp_not_subscribed',
                sprintf(
                    /* translators: %s: Graph API error */
                    __( 'Meta did not verify the Webhook Verify Token for this WhatsApp account: %s', 'kinetix-messaging-by-ppros' ),
                    $account->get_error_message()
                )
            );
        }

        $confirmed = $this->confirm_message_subscription( $app_id, $app_token, $callback );
        if ( is_wp_error( $confirmed ) ) {
            return $confirmed;
        }
        $recent = $this->recent_delivery_error();
        if ( is_wp_error( $recent ) ) {
            return $recent;
        }
        return $waba_id;
    }

    /**
     * Remember the latest reason an inbound WhatsApp message was dropped.
     */
    private function note_delivery_error( string $message ): void {
        update_option(
            'kmbp_whatsapp_delivery_error',
            array(
                'message' => $message,
                'time'    => time(),
            ),
            false
        );
    }

    /**
     * @return true|\WP_Error True when nothing recent failed.
     */
    private function recent_delivery_error() {
        $saved = get_option( 'kmbp_whatsapp_delivery_error', array() );
        if ( ! is_array( $saved ) || empty( $saved['message'] ) || empty( $saved['time'] ) ) {
            return true;
        }
        if ( (int) $saved['time'] < time() - HOUR_IN_SECONDS ) {
            delete_option( 'kmbp_whatsapp_delivery_error' );
            return true;
        }
        return new WP_Error( 'kmbp_whatsapp_delivery', (string) $saved['message'] );
    }

    /**
     * @return array|\WP_Error
     */
    private function debug_token( string $token ) {
        return $this->http(
            self::GRAPH_API . 'debug_token?input_token=' . rawurlencode( $token ),
            array(
                'headers' => array(
                    'Authorization' => 'Bearer ' . $token,
                ),
            )
        );
    }

    /**
     * @param array $debug debug_token response.
     */
    private function waba_id_from_debug( array $debug ): string {
        $scopes = $debug['data']['granular_scopes'] ?? array();
        if ( ! is_array( $scopes ) ) {
            return '';
        }
        foreach ( $scopes as $scope ) {
            if ( ! is_array( $scope ) ) {
                continue;
            }
            $name = (string) ( $scope['scope'] ?? '' );
            if ( ! in_array( $name, array( 'whatsapp_business_management', 'whatsapp_business_messaging' ), true ) ) {
                continue;
            }
            $ids = $scope['target_ids'] ?? array();
            if ( is_array( $ids ) && ! empty( $ids[0] ) ) {
                $id = preg_replace( '/\D+/', '', (string) $ids[0] );
                if ( is_string( $id ) && '' !== $id ) {
                    return $id;
                }
            }
        }
        return '';
    }

    /**
     * Confirm this site answers Meta's webhook challenge.
     *
     * @return true|\WP_Error
     */
    private function probe_webhook( string $verify_token, string $callback ) {
        $challenge = 'kmbp' . wp_generate_password( 8, false, false );
        $url       = add_query_arg(
            array(
                'hub.mode'         => 'subscribe',
                'hub.verify_token' => $verify_token,
                'hub.challenge'    => $challenge,
            ),
            $callback
        );
        $response = wp_remote_get(
            $url,
            array(
                'timeout'     => 15,
                'redirection' => 3,
            )
        );
        if ( is_wp_error( $response ) ) {
            return new WP_Error(
                'kmbp_whatsapp_webhook',
                sprintf(
                    /* translators: %s: HTTP error */
                    __( 'This site could not open its webhook URL: %s', 'kinetix-messaging-by-ppros' ),
                    $response->get_error_message()
                ),
                array( 'transport' => true )
            );
        }
        $code = (int) wp_remote_retrieve_response_code( $response );
        $body = trim( (string) wp_remote_retrieve_body( $response ) );
        if ( 200 === $code && hash_equals( $challenge, $body ) ) {
            return true;
        }
        $snippet = wp_strip_all_tags( $body );
        if ( strlen( $snippet ) > 180 ) {
            $snippet = substr( $snippet, 0, 180 ) . '…';
        }
        return new WP_Error(
            'kmbp_whatsapp_webhook',
            sprintf(
                /* translators: 1: HTTP status, 2: response body, 3: webhook URL */
                __( 'Webhook check failed (HTTP %1$d). WhatsApp will not deliver messages until %3$s returns the verify challenge. Response: %2$s', 'kinetix-messaging-by-ppros' ),
                $code,
                '' !== $snippet ? $snippet : __( '(empty)', 'kinetix-messaging-by-ppros' ),
                $callback
            )
        );
    }

    /**
     * Read back the app webhook and require the messages field on our URL.
     *
     * @return true|\WP_Error
     */
    private function confirm_message_subscription( string $app_id, string $app_token, string $callback ) {
        $listed = $this->http(
            self::GRAPH_API . $app_id . '/subscriptions?access_token=' . rawurlencode( $app_token )
        );
        if ( is_wp_error( $listed ) ) {
            return new WP_Error(
                'kmbp_whatsapp_webhook',
                sprintf(
                    /* translators: %s: Graph API error */
                    __( 'Could not confirm the message webhook: %s', 'kinetix-messaging-by-ppros' ),
                    $listed->get_error_message()
                )
            );
        }
        $rows = $listed['data'] ?? array();
        if ( ! is_array( $rows ) ) {
            $rows = array();
        }
        $wanted = untrailingslashit( $callback );
        foreach ( $rows as $row ) {
            if ( ! is_array( $row ) || 'whatsapp_business_account' !== (string) ( $row['object'] ?? '' ) ) {
                continue;
            }
            $saved = untrailingslashit( (string) ( $row['callback_url'] ?? '' ) );
            $names = array();
            foreach ( (array) ( $row['fields'] ?? array() ) as $field ) {
                if ( is_array( $field ) ) {
                    $names[] = (string) ( $field['name'] ?? '' );
                } elseif ( is_string( $field ) ) {
                    $names[] = $field;
                }
            }
            if ( $saved !== $wanted ) {
                return new WP_Error(
                    'kmbp_whatsapp_webhook',
                    sprintf(
                        /* translators: %s: callback URL Meta has saved */
                        __( 'Meta is sending WhatsApp events to a different address: %s', 'kinetix-messaging-by-ppros' ),
                        '' !== $saved ? $saved : __( '(none)', 'kinetix-messaging-by-ppros' )
                    )
                );
            }
            if ( ! in_array( 'messages', $names, true ) ) {
                return new WP_Error(
                    'kmbp_whatsapp_webhook',
                    __( 'The webhook is connected, but the messages field is not subscribed, so new chats are not delivered.', 'kinetix-messaging-by-ppros' )
                );
            }
            if ( isset( $row['active'] ) && ! $row['active'] ) {
                return new WP_Error(
                    'kmbp_whatsapp_webhook',
                    __( 'Meta has the webhook saved, but it is turned off.', 'kinetix-messaging-by-ppros' )
                );
            }
            return true;
        }
        return new WP_Error(
            'kmbp_whatsapp_webhook',
            __( 'Meta did not save a WhatsApp webhook, so messages will not be delivered.', 'kinetix-messaging-by-ppros' )
        );
    }

    /**
     * Ask Meta to deliver this account's messages to the app webhook.
     *
     * @return true|\WP_Error
     */
    private function subscribe_to_messages( string $token, string $waba_id, string $callback, string $verify_token ) {
        if ( '' === $waba_id ) {
            return new WP_Error(
                'kmbp_whatsapp_no_waba',
                __( 'WhatsApp Business Account ID is missing.', 'kinetix-messaging-by-ppros' )
            );
        }
        $result = $this->http_post_json(
            self::GRAPH_API . $waba_id . '/subscribed_apps',
            array(
                'override_callback_uri' => $callback,
                'verify_token'          => $verify_token,
            ),
            array( 'Authorization' => 'Bearer ' . $token )
        );
        if ( is_wp_error( $result ) ) {
            return $result;
        }
        return true;
    }

    /**
     * @return array|\WP_Error
     */
    private function graph_get( string $token, string $path ) {
        $data = $this->http(
            self::GRAPH_API . ltrim( $path, '/' ),
            array(
                'headers' => array(
                    'Authorization' => 'Bearer ' . $token,
                ),
            )
        );
        if ( is_wp_error( $data ) ) {
            return new WP_Error(
                'kmbp_whatsapp_verify_failed',
                $data->get_error_message(),
                array( 'status' => 400 )
            );
        }
        return $data;
    }

    /**
     * When the WABA phone list loads, the Phone Number ID must be on that account.
     *
     * @return true|\WP_Error
     */
    private function phone_missing_from_waba( string $token, string $waba_id, string $phone_id ) {
        $numbers = $this->http(
            self::GRAPH_API . $waba_id . '/phone_numbers?fields=id',
            array(
                'headers' => array(
                    'Authorization' => 'Bearer ' . $token,
                ),
            )
        );
        if ( is_wp_error( $numbers ) || empty( $numbers['data'] ) || ! is_array( $numbers['data'] ) ) {
            return true;
        }
        foreach ( $numbers['data'] as $row ) {
            if ( ! is_array( $row ) ) {
                continue;
            }
            $id = preg_replace( '/\D+/', '', (string) ( $row['id'] ?? '' ) );
            if ( $id === $phone_id ) {
                return true;
            }
        }
        return new WP_Error(
            'kmbp_whatsapp_phone_mismatch',
            __( 'This Phone Number ID is not on the WhatsApp Business Account you entered.', 'kinetix-messaging-by-ppros' ),
            array( 'status' => 400 )
        );
    }

    /**
     * Keep the number Meta confirmed, and replace a display value that is not a phone.
     */
    private function remember_whatsapp_phone( string $display, string $waba_id ): void {
        if ( '' === $display && '' === $waba_id ) {
            return;
        }
        $all = get_option( Kinetix_Messaging_By_Ppros_Activator::SETTINGS_OPTION, array() );
        if ( ! is_array( $all ) ) {
            return;
        }
        $cfg    = isset( $all['whatsapp'] ) && is_array( $all['whatsapp'] ) ? $all['whatsapp'] : array();
        $digits = Kinetix_Messaging_By_Ppros_Shortcodes::whatsapp_phone_digits( array( 'displayPhone' => $display ) );
        if ( '' !== $digits ) {
            $cfg['connectedPhone'] = $digits;
            $typed = Kinetix_Messaging_By_Ppros_Shortcodes::whatsapp_phone_digits( array( 'displayPhone' => (string) ( $cfg['displayPhone'] ?? '' ) ) );
            if ( '' === $typed ) {
                $cfg['displayPhone'] = $display;
            }
        }
        if ( '' !== $waba_id && '' === preg_replace( '/\D+/', '', (string) ( $cfg['wabaid'] ?? '' ) ) ) {
            $cfg['wabaid'] = $waba_id;
        }
        $all['whatsapp'] = $cfg;
        update_option( Kinetix_Messaging_By_Ppros_Activator::SETTINGS_OPTION, $all, false );
    }
}
