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
                if ( ( $change['field'] ?? '' ) !== 'messages' ) {
                    continue;
                }
                $value    = $change['value'] ?? array();
                $messages = $value['messages'] ?? array();
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
            $this->log_debug( '[KMBP WhatsApp] DB error: ' . $conversation_id->get_error_message() );
            return;
        }

        $this->store_message(
            $conversation_id,
            esc_html( $text ),
            'contact',
            $contact_name,
            array( 'channel' => 'whatsapp', 'from' => $from, 'type' => $type, 'msgId' => $msg_id ),
            'wa_' . $msg_id
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
        $this->remember_display_phone( $display );

        if ( '' !== $verified && '' !== $display ) {
            $message = sprintf(
                /* translators: 1: verified WhatsApp business name, 2: display phone number */
                __( 'Connected to %1$s (%2$s).', 'kinetix-messaging-by-ppros' ),
                $verified,
                $display
            );
        } else {
            $label = '' !== $verified ? $verified : ( '' !== $display ? $display : $phone_id );
            $message = sprintf(
                /* translators: %s: WhatsApp business name, phone number, or phone number id */
                __( 'Connected to %s.', 'kinetix-messaging-by-ppros' ),
                $label
            );
        }

        return rest_ensure_response(
            array(
                'ok'             => true,
                'phoneNumberId'  => $phone_id,
                'displayPhone'   => $display,
                'verifiedName'   => $verified,
                'qualityRating'  => sanitize_text_field( (string) ( $phone['quality_rating'] ?? '' ) ),
                'wabaName'       => $waba_name,
                'message'        => $message,
            )
        );
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
     * Fill an empty display number after a successful check.
     */
    private function remember_display_phone( string $display ): void {
        if ( '' === $display ) {
            return;
        }
        $all = get_option( Kinetix_Messaging_By_Ppros_Activator::SETTINGS_OPTION, array() );
        if ( ! is_array( $all ) ) {
            return;
        }
        $cfg     = isset( $all['whatsapp'] ) && is_array( $all['whatsapp'] ) ? $all['whatsapp'] : array();
        $current = trim( (string) ( $cfg['displayPhone'] ?? '' ) );
        if ( '' !== $current ) {
            return;
        }
        $cfg['displayPhone'] = $display;
        $all['whatsapp']     = $cfg;
        update_option( Kinetix_Messaging_By_Ppros_Activator::SETTINGS_OPTION, $all, false );
    }
}
