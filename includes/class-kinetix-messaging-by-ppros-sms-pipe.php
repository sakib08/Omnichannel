<?php
/**
 * SMS connector — supports Twilio, Vonage, and generic providers.
 *
 * Inbound  — POST /wp-json/kmbp/v1/webhooks/sms
 *            Generic endpoint compatible with Twilio, Vonage, and others.
 *            Twilio:  set Messaging → Webhook URL → HTTP POST
 *            Vonage:  set Inbound Message URL → HTTP POST
 *
 * Outbound — POST /wp-json/kmbp/v1/sms/send
 *            Agents POST { conversationId, recipientId (phone), text }.
 *
 * Settings keys (stored under kmbp_platform_settings['sms']):
 *   enabled, provider ('twilio'|'vonage'|'messagebird'|'sinch'|'plivo'|'telnyx'),
 *   accountSid, authToken,          — Twilio
 *   vonageKey, vonageSecret,        — Vonage
 *   genericKey, genericSecret,      — other providers
 *   fromNumber,                     — sending number
 *   autoReply, autoReplyMsg, optOut, optIn, helpKeyword, helpMsg
 *
 * @package Kinetix_Messaging_By_Ppros
 */

defined( 'ABSPATH' ) || die( 'No script kiddies please!' );

class Kinetix_Messaging_By_Ppros_Sms_Pipe extends Kinetix_Messaging_By_Ppros_Channel_Pipe_Base {

    // Provider-specific API endpoints.
    const TWILIO_API   = 'https://api.twilio.com/2010-04-01/Accounts/';
    const VONAGE_API   = 'https://rest.nexmo.com/sms/json';
    const SINCH_API    = 'https://us.sms.api.sinch.com/xms/v1/';
    const PLIVO_API    = 'https://api.plivo.com/v1/Account/';
    const TELNYX_API   = 'https://api.telnyx.com/v2/messages';
    const MBIRD_API    = 'https://rest.messagebird.com/messages';

    public function get_channel_slug(): string {
        return 'sms';
    }

    public function register_routes(): void {
        $ns = Kinetix_Messaging_By_Ppros_Rest_Api::NAMESPACE_V1;

        register_rest_route(
            $ns,
            '/webhooks/sms',
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'handle_webhook' ),
                'permission_callback' => array( $this, 'check_sms_webhook_permission' ),
            )
        );

        register_rest_route(
            $ns,
            '/sms/test-connection',
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'handle_test_connection' ),
                'permission_callback' => array( $this, 'check_manage_settings' ),
            )
        );

        register_rest_route(
            $ns,
            '/sms/send',
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
     * Permission callback for SMS inbound webhook POST.
     */
    public function check_sms_webhook_permission( WP_REST_Request $request ): bool {
        if ( ! $this->is_channel_enabled() ) {
            return false;
        }
        $cfg      = $this->get_settings();
        $provider = strtolower( (string) ( $cfg['provider'] ?? 'twilio' ) );
        if ( 'twilio' === $provider ) {
            $auth_token = (string) ( $cfg['authToken'] ?? '' );
            if ( '' === $auth_token ) {
                return false;
            }
            return $this->verify_twilio_signature( $request, $auth_token );
        }
        return $this->verify_webhook_token( $request, (string) ( $cfg['webhookToken'] ?? '' ) );
    }

    public function handle_webhook( WP_REST_Request $request ) {
        $cfg      = $this->get_settings();
        $provider = strtolower( (string) ( $cfg['provider'] ?? 'twilio' ) );
        $params   = $request->get_body_params();  // form-encoded

        $normalised = $this->normalise_inbound( $params, $provider );
        if ( null === $normalised ) {
            return new WP_REST_Response( '', 204 );
        }

        [ 'from' => $from, 'to' => $to, 'body' => $body, 'msg_id' => $msg_id ] = $normalised;

        // Compliance: handle STOP/START/HELP keywords.
        $this->handle_compliance_keywords( strtoupper( trim( $body ) ), $from, $cfg );

        $contact_name    = $from;
        $subject         = mb_substr( $body, 0, 80 ) ?: 'SMS message';
        $conversation_id = $this->find_or_create_conversation( $from, $contact_name, $from, $subject );

        if ( is_wp_error( $conversation_id ) ) {
            $this->log_debug( '[KMBP SMS] DB error: ' . $conversation_id->get_error_message() );
        } else {
            $this->store_message(
                $conversation_id,
                esc_html( $body ),
                'contact',
                $contact_name,
                array( 'channel' => 'sms', 'provider' => $provider, 'from' => $from, 'to' => $to, 'msgId' => $msg_id ),
                'sms_' . $msg_id
            );

            $this->maybe_send_auto_reply( $from, $contact_name, (string) $conversation_id );

            do_action( 'kmbp_inbound_message_received', $conversation_id, 'sms', array(
                'from' => $from, 'to' => $to, 'body' => $body, 'provider' => $provider,
            ) );
        }

        // Twilio expects empty 200 or TwiML.
        if ( 'twilio' === $provider ) {
            return new WP_REST_Response(
                '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
                200,
                array( 'Content-Type' => 'text/xml' )
            );
        }

        return rest_ensure_response( array( 'ok' => true ) );
    }

    /**
     * Normalise inbound payload from different providers into
     * { from, to, body, msg_id }.
     *
     * @return array|null  null if the payload can't be parsed.
     */
    private function normalise_inbound( array $params, string $provider ): ?array {
        switch ( $provider ) {
            case 'twilio':
                $from   = sanitize_text_field( (string) ( $params['From'] ?? '' ) );
                $to     = sanitize_text_field( (string) ( $params['To'] ?? '' ) );
                $body   = sanitize_textarea_field( (string) ( $params['Body'] ?? '' ) );
                $msg_id = sanitize_text_field( (string) ( $params['MessageSid'] ?? '' ) );
                break;

            case 'vonage':
                $from   = sanitize_text_field( (string) ( $params['msisdn'] ?? '' ) );
                $to     = sanitize_text_field( (string) ( $params['to'] ?? '' ) );
                $body   = sanitize_textarea_field( (string) ( $params['text'] ?? '' ) );
                $msg_id = sanitize_text_field( (string) ( $params['messageId'] ?? '' ) );
                break;

            case 'sinch':
                $from   = sanitize_text_field( (string) ( $params['from'] ?? '' ) );
                $to     = sanitize_text_field( (string) ( $params['to'] ?? '' ) );
                $body   = sanitize_textarea_field( (string) ( $params['body'] ?? '' ) );
                $msg_id = sanitize_text_field( (string) ( $params['id'] ?? '' ) );
                break;

            default:
                // Generic fall-through for messagebird, plivo, telnyx.
                $from   = sanitize_text_field( (string) ( $params['from'] ?? $params['originator'] ?? '' ) );
                $to     = sanitize_text_field( (string) ( $params['to'] ?? $params['destination'] ?? '' ) );
                $body   = sanitize_textarea_field( (string) ( $params['body'] ?? $params['text'] ?? '' ) );
                $msg_id = sanitize_text_field( (string) ( $params['id'] ?? $params['messageId'] ?? '' ) );
                break;
        }

        if ( '' === $from || '' === $body ) {
            return null;
        }

        return compact( 'from', 'to', 'body', 'msg_id' );
    }

    // ── Compliance keyword handling ────────────────────────────────────────

    private function handle_compliance_keywords( string $keyword, string $from, array $cfg ): void {
        if ( in_array( $keyword, array( 'STOP', 'UNSUBSCRIBE', 'QUIT', 'CANCEL', 'END' ), true ) ) {
            if ( ! empty( $cfg['optOut'] ) ) {
                update_user_meta( 0, 'kmbp_sms_optout_' . md5( $from ), 1 );
            }
            return;
        }

        if ( in_array( $keyword, array( 'START', 'SUBSCRIBE', 'YES' ), true ) ) {
            if ( ! empty( $cfg['optIn'] ) ) {
                delete_user_meta( 0, 'kmbp_sms_optout_' . md5( $from ) );
            }
            return;
        }

        if ( 'HELP' === $keyword && ! empty( $cfg['helpKeyword'] ) && ! empty( $cfg['helpMsg'] ) ) {
            $this->send_message( $from, (string) $cfg['helpMsg'], $cfg );
        }
    }

    // ── Outbound send ─────────────────────────────────────────────────────

    protected function send_message( string $recipient_id, string $text, array $cfg = array() ) {
        if ( empty( $cfg ) ) {
            $cfg = $this->get_settings();
        }
        $provider = strtolower( (string) ( $cfg['provider'] ?? 'twilio' ) );

        return match ( $provider ) {
            'twilio'      => $this->send_twilio( $recipient_id, $text, $cfg ),
            'vonage'      => $this->send_vonage( $recipient_id, $text, $cfg ),
            'sinch'       => $this->send_sinch( $recipient_id, $text, $cfg ),
            'plivo'       => $this->send_plivo( $recipient_id, $text, $cfg ),
            'telnyx'      => $this->send_telnyx( $recipient_id, $text, $cfg ),
            'messagebird' => $this->send_messagebird( $recipient_id, $text, $cfg ),
            default       => new \WP_Error( 'kmbp_sms_unknown_provider', "Unknown SMS provider: {$provider}" ),
        };
    }

    private function send_twilio( string $to, string $text, array $cfg ) {
        $sid  = (string) ( $cfg['accountSid'] ?? '' );
        $auth = (string) ( $cfg['authToken'] ?? '' );
        $from = (string) ( $cfg['fromNumber'] ?? '' );
        if ( '' === $sid || '' === $auth || '' === $from ) {
            return new \WP_Error( 'kmbp_twilio_not_configured', __( 'Twilio Account SID, Auth Token, and From Number are required.', 'kinetix-messaging-by-ppros' ) );
        }
        $result = $this->http(
            self::TWILIO_API . $sid . '/Messages.json',
            array(
                'method'  => 'POST',
                'headers' => array(
                    'Authorization' => 'Basic ' . base64_encode( $sid . ':' . $auth ),
                    'Content-Type'  => 'application/x-www-form-urlencoded',
                ),
                'body'    => http_build_query( array( 'To' => $to, 'From' => $from, 'Body' => $text ) ),
            )
        );
        if ( is_wp_error( $result ) ) {
            return new \WP_Error( 'kmbp_twilio_send_error', $result->get_error_message(), array( 'status' => 502 ) );
        }
        return $result;
    }

    private function send_vonage( string $to, string $text, array $cfg ) {
        $key    = (string) ( $cfg['vonageKey'] ?? '' );
        $secret = (string) ( $cfg['vonageSecret'] ?? '' );
        $from   = (string) ( $cfg['fromNumber'] ?? '' );
        if ( '' === $key || '' === $secret ) {
            return new \WP_Error( 'kmbp_vonage_not_configured', __( 'Vonage API Key and Secret are required.', 'kinetix-messaging-by-ppros' ) );
        }
        $result = $this->http_post_json(
            self::VONAGE_API,
            array( 'api_key' => $key, 'api_secret' => $secret, 'to' => $to, 'from' => $from ?: 'KMBP', 'text' => $text )
        );
        if ( is_wp_error( $result ) ) {
            return new \WP_Error( 'kmbp_vonage_send_error', $result->get_error_message(), array( 'status' => 502 ) );
        }
        return $result;
    }

    private function send_sinch( string $to, string $text, array $cfg ) {
        $key    = (string) ( $cfg['genericKey'] ?? '' );
        $secret = (string) ( $cfg['genericSecret'] ?? '' );
        $from   = (string) ( $cfg['fromNumber'] ?? '' );
        if ( '' === $key ) {
            return new \WP_Error( 'kmbp_sinch_not_configured', 'Sinch API key required.' );
        }
        $result = $this->http_post_json(
            self::SINCH_API . $key . '/batches',
            array( 'from' => $from, 'to' => array( $to ), 'body' => $text ),
            array( 'Authorization' => 'Bearer ' . $secret )
        );
        if ( is_wp_error( $result ) ) {
            return new \WP_Error( 'kmbp_sinch_send_error', $result->get_error_message(), array( 'status' => 502 ) );
        }
        return $result;
    }

    private function send_plivo( string $to, string $text, array $cfg ) {
        $auth_id    = (string) ( $cfg['genericKey'] ?? '' );
        $auth_token = (string) ( $cfg['genericSecret'] ?? '' );
        $src        = (string) ( $cfg['fromNumber'] ?? '' );
        if ( '' === $auth_id || '' === $auth_token ) {
            return new \WP_Error( 'kmbp_plivo_not_configured', 'Plivo Auth ID and Token required.' );
        }
        $result = $this->http(
            self::PLIVO_API . $auth_id . '/Message/',
            array(
                'method'  => 'POST',
                'headers' => array(
                    'Authorization' => 'Basic ' . base64_encode( $auth_id . ':' . $auth_token ),
                    'Content-Type'  => 'application/json',
                ),
                'body'    => wp_json_encode( array( 'src' => $src, 'dst' => $to, 'text' => $text ) ),
            )
        );
        if ( is_wp_error( $result ) ) {
            return new \WP_Error( 'kmbp_plivo_send_error', $result->get_error_message(), array( 'status' => 502 ) );
        }
        return $result;
    }

    private function send_telnyx( string $to, string $text, array $cfg ) {
        $key  = (string) ( $cfg['genericKey'] ?? '' );
        $from = (string) ( $cfg['fromNumber'] ?? '' );
        if ( '' === $key ) {
            return new \WP_Error( 'kmbp_telnyx_not_configured', 'Telnyx API key required.' );
        }
        $result = $this->http_post_json(
            self::TELNYX_API,
            array( 'from' => $from, 'to' => $to, 'text' => $text ),
            array( 'Authorization' => 'Bearer ' . $key )
        );
        if ( is_wp_error( $result ) ) {
            return new \WP_Error( 'kmbp_telnyx_send_error', $result->get_error_message(), array( 'status' => 502 ) );
        }
        return $result;
    }

    private function send_messagebird( string $to, string $text, array $cfg ) {
        $key  = (string) ( $cfg['genericKey'] ?? '' );
        $from = (string) ( $cfg['fromNumber'] ?? '' );
        if ( '' === $key ) {
            return new \WP_Error( 'kmbp_messagebird_not_configured', 'MessageBird API key required.' );
        }
        $result = $this->http_post_json(
            self::MBIRD_API,
            array( 'recipients' => array( $to ), 'originator' => $from ?: 'KMBP', 'body' => $text ),
            array( 'Authorization' => 'AccessKey ' . $key )
        );
        if ( is_wp_error( $result ) ) {
            return new \WP_Error( 'kmbp_messagebird_send_error', $result->get_error_message(), array( 'status' => 502 ) );
        }
        return $result;
    }

    // ── Twilio signature verification ─────────────────────────────────────

    /**
     * Validate the X-Twilio-Signature header.
     * @see https://www.twilio.com/docs/usage/webhooks/webhooks-security
     */
    private function verify_twilio_signature( WP_REST_Request $request, string $auth_token ): bool {
        $signature    = (string) ( $request->get_header( 'x-twilio-signature' ) ?? '' );
        $url          = rest_url( Kinetix_Messaging_By_Ppros_Rest_Api::NAMESPACE_V1 . '/webhooks/sms' );
        $params       = $request->get_body_params();

        ksort( $params );
        $data = $url;
        foreach ( $params as $key => $value ) {
            $data .= $key . $value;
        }

        $computed = base64_encode( hash_hmac( 'sha1', $data, $auth_token, true ) );

        return hash_equals( $computed, $signature );
    }

    /**
     * Check the selected provider's credentials without sending a message.
     */
    public function handle_test_connection() {
        $cfg      = $this->get_settings();
        $provider = strtolower( (string) ( $cfg['provider'] ?? 'twilio' ) );

        switch ( $provider ) {
            case 'twilio':
                return $this->test_twilio( $cfg );
            case 'vonage':
                return $this->test_vonage( $cfg );
            case 'sinch':
                return $this->test_sinch( $cfg );
            case 'plivo':
                return $this->test_plivo( $cfg );
            case 'telnyx':
                return $this->test_telnyx( $cfg );
            case 'messagebird':
                return $this->test_messagebird( $cfg );
            default:
                return new WP_Error(
                    'kmbp_sms_unknown_provider',
                    __( 'Choose an SMS provider first.', 'kinetix-messaging-by-ppros' ),
                    array( 'status' => 400 )
                );
        }
    }

    /**
     * @param array|\WP_Error $result
     * @return array|\WP_Error
     */
    private function sms_verify_result( $result, string $label ) {
        if ( is_wp_error( $result ) ) {
            return new WP_Error( 'kmbp_sms_verify_failed', $result->get_error_message(), array( 'status' => 400 ) );
        }
        return rest_ensure_response(
            array(
                'ok'       => true,
                'provider' => $label,
                'message'  => sprintf(
                    /* translators: %s: SMS provider name */
                    __( 'Connected to %s.', 'kinetix-messaging-by-ppros' ),
                    $label
                ),
            )
        );
    }

    private function test_twilio( array $cfg ) {
        $sid  = trim( (string) ( $cfg['accountSid'] ?? '' ) );
        $auth = trim( (string) ( $cfg['authToken'] ?? '' ) );
        if ( '' === $sid || '' === $auth ) {
            return new WP_Error( 'kmbp_twilio_not_configured', __( 'Enter your Twilio Account SID and Auth Token first.', 'kinetix-messaging-by-ppros' ), array( 'status' => 400 ) );
        }
        $result = $this->http(
            self::TWILIO_API . rawurlencode( $sid ) . '.json',
            array(
                'headers' => array(
                    'Authorization' => 'Basic ' . base64_encode( $sid . ':' . $auth ),
                ),
            )
        );
        return $this->sms_verify_result( $result, 'Twilio' );
    }

    private function test_vonage( array $cfg ) {
        $key    = trim( (string) ( $cfg['vonageKey'] ?? '' ) );
        $secret = trim( (string) ( $cfg['vonageSecret'] ?? '' ) );
        if ( '' === $key || '' === $secret ) {
            return new WP_Error( 'kmbp_vonage_not_configured', __( 'Enter your Vonage API key and secret first.', 'kinetix-messaging-by-ppros' ), array( 'status' => 400 ) );
        }
        $result = $this->http(
            'https://rest.nexmo.com/account/get-balance?api_key=' . rawurlencode( $key ) . '&api_secret=' . rawurlencode( $secret )
        );
        if ( is_array( $result ) && isset( $result['error-code'] ) && '200' !== (string) $result['error-code'] ) {
            $message = sanitize_text_field( (string) ( $result['error-code-label'] ?? __( 'Vonage rejected these credentials.', 'kinetix-messaging-by-ppros' ) ) );
            return new WP_Error( 'kmbp_sms_verify_failed', $message, array( 'status' => 400 ) );
        }
        return $this->sms_verify_result( $result, 'Vonage' );
    }

    private function test_sinch( array $cfg ) {
        $plan   = trim( (string) ( $cfg['genericKey'] ?? '' ) );
        $secret = trim( (string) ( $cfg['genericSecret'] ?? '' ) );
        if ( '' === $plan || '' === $secret ) {
            return new WP_Error( 'kmbp_sinch_not_configured', __( 'Enter your Sinch service plan ID and API token first.', 'kinetix-messaging-by-ppros' ), array( 'status' => 400 ) );
        }
        $result = $this->http(
            self::SINCH_API . rawurlencode( $plan ) . '/batches?page_size=1',
            array(
                'headers' => array(
                    'Authorization' => 'Bearer ' . $secret,
                ),
            )
        );
        return $this->sms_verify_result( $result, 'Sinch' );
    }

    private function test_plivo( array $cfg ) {
        $auth_id = trim( (string) ( $cfg['genericKey'] ?? '' ) );
        $token   = trim( (string) ( $cfg['genericSecret'] ?? '' ) );
        if ( '' === $auth_id || '' === $token ) {
            return new WP_Error( 'kmbp_plivo_not_configured', __( 'Enter your Plivo Auth ID and Auth Token first.', 'kinetix-messaging-by-ppros' ), array( 'status' => 400 ) );
        }
        $result = $this->http(
            self::PLIVO_API . rawurlencode( $auth_id ) . '/',
            array(
                'headers' => array(
                    'Authorization' => 'Basic ' . base64_encode( $auth_id . ':' . $token ),
                ),
            )
        );
        return $this->sms_verify_result( $result, 'Plivo' );
    }

    private function test_telnyx( array $cfg ) {
        $key = trim( (string) ( $cfg['genericKey'] ?? '' ) );
        if ( '' === $key ) {
            return new WP_Error( 'kmbp_telnyx_not_configured', __( 'Enter your Telnyx API key first.', 'kinetix-messaging-by-ppros' ), array( 'status' => 400 ) );
        }
        $result = $this->http(
            'https://api.telnyx.com/v2/balance',
            array(
                'headers' => array(
                    'Authorization' => 'Bearer ' . $key,
                ),
            )
        );
        return $this->sms_verify_result( $result, 'Telnyx' );
    }

    private function test_messagebird( array $cfg ) {
        $key = trim( (string) ( $cfg['genericKey'] ?? '' ) );
        if ( '' === $key ) {
            return new WP_Error( 'kmbp_messagebird_not_configured', __( 'Enter your MessageBird API key first.', 'kinetix-messaging-by-ppros' ), array( 'status' => 400 ) );
        }
        $result = $this->http(
            'https://rest.messagebird.com/balance',
            array(
                'headers' => array(
                    'Authorization' => 'AccessKey ' . $key,
                ),
            )
        );
        return $this->sms_verify_result( $result, 'MessageBird' );
    }
}
