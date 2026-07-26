<?php
/**
 * Email Piping — inbound receive + outbound send for the Messaging Engine.
 *
 * Inbound paths
 *   1. IMAP polling  — WordPress cron fires `kmbp_imap_poll` every 5 minutes.
 *                      The handler connects to the configured IMAP server, grabs
 *                      unseen messages, and stores them as conversations/messages.
 *   2. Webhook push  — POST /wp-json/kmbp/v1/webhooks/email
 *                      Compatible with Mailgun, SendGrid (Inbound Parse),
 *                      Postmark, SparkPost, and any raw email-to-HTTP relay.
 *                      No authentication is required from the email provider;
 *                      the secret is enforced via a shared webhook token stored
 *                      in the email channel settings (`webhookToken`).
 *
 * Outbound path
 *   POST /wp-json/kmbp/v1/email/send
 *   Authenticated agents POST { conversationId, subject, body (HTML) } and
 *   the handler opens a dedicated PHPMailer instance (bypassing wp_mail globals)
 *   configured with the SMTP credentials stored in settings.
 *
 * Manual IMAP poll trigger (for testing / debugging)
 *   POST /wp-json/kmbp/v1/email/poll  (requires kmbp_manage_settings)
 *
 * @package Kinetix_Messaging_By_Ppros
 */

defined( 'ABSPATH' ) || die( 'No script kiddies please!' );

class Kinetix_Messaging_By_Ppros_Email_Pipe {

    // ── Cron event tag ───────────────────────────────────────────────────────
    const CRON_HOOK = 'kmbp_imap_poll';

    // ── Cron schedule name (registered via cron_schedules) ──────────────────
    const CRON_SCHEDULE = 'kmbp_every_5_minutes';

    // ─────────────────────────────────────────────────────────────────────────
    //  Registration helpers called from the main Kinetix_Messaging_By_Ppros
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Register all WordPress hooks that this class needs.
     * Called once from Kinetix_Messaging_By_Ppros::define_email_pipe_hooks().
     */
    public function register_hooks( Kinetix_Messaging_By_Ppros_Loader $loader ) {
        // REST routes
        $loader->add_action( 'rest_api_init', $this, 'register_routes' );

        // Custom cron schedule (every 5 min)
        $loader->add_filter( 'cron_schedules', $this, 'add_cron_schedule' );

        // Cron event handler
        $loader->add_action( self::CRON_HOOK, $this, 'run_imap_poll' );
    }

    /**
     * Schedule the IMAP poll cron on plugin activation.
     * Safe to call multiple times — does nothing if already scheduled.
     */
    public static function schedule_cron() {
        if ( ! wp_next_scheduled( self::CRON_HOOK ) ) {
            wp_schedule_event( time(), self::CRON_SCHEDULE, self::CRON_HOOK );
        }
    }

    /**
     * Unschedule the IMAP cron on plugin deactivation.
     */
    public static function unschedule_cron() {
        $timestamp = wp_next_scheduled( self::CRON_HOOK );
        if ( $timestamp ) {
            wp_unschedule_event( $timestamp, self::CRON_HOOK );
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  WP Cron schedule registration
    // ─────────────────────────────────────────────────────────────────────────

    public function add_cron_schedule( array $schedules ): array {
        $schedules[ self::CRON_SCHEDULE ] = array(
            'interval' => 5 * MINUTE_IN_SECONDS,
            'display'  => __( 'Every 5 minutes (KMBP email poll)', 'kinetix-messaging-by-ppros' ),
        );
        return $schedules;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  REST route registration
    // ─────────────────────────────────────────────────────────────────────────

    public function register_routes() {
        $ns = Kinetix_Messaging_By_Ppros_Rest_Api::NAMESPACE_V1;

        // ── Outbound send ────────────────────────────────────────────────────
        register_rest_route(
            $ns,
            '/email/send',
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'handle_send' ),
                'permission_callback' => array( $this, 'check_access' ),
                'args'                => array(
                    'conversationId' => array( 'required' => true, 'type' => 'integer', 'minimum' => 1 ),
                    'to'             => array( 'required' => true, 'type' => 'string', 'format' => 'email' ),
                    'toName'         => array( 'type' => 'string', 'default' => '' ),
                    'subject'        => array( 'required' => true, 'type' => 'string' ),
                    'body'           => array( 'required' => true, 'type' => 'string' ),
                ),
            )
        );

        // ── Inbound webhook (no WordPress auth — token-guarded instead) ──────
        register_rest_route(
            $ns,
            '/webhooks/email',
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'handle_inbound_webhook' ),
                'permission_callback' => array( $this, 'check_inbound_webhook_permission' ),
            )
        );

        // ── Manual poll trigger ───────────────────────────────────────────────
        register_rest_route(
            $ns,
            '/email/poll',
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'handle_manual_poll' ),
                'permission_callback' => array( $this, 'check_manage_settings' ),
            )
        );

        // ── Connection test ───────────────────────────────────────────────────
        register_rest_route(
            $ns,
            '/email/test-connection',
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'handle_test_connection' ),
                'permission_callback' => array( $this, 'check_manage_settings' ),
                'args'                => array(
                    'type' => array(
                        'required' => true,
                        'type'     => 'string',
                        'enum'     => array( 'smtp', 'imap' ),
                    ),
                ),
            )
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Permission callbacks
    // ─────────────────────────────────────────────────────────────────────────

    public function check_access(): bool {
        return current_user_can( Kinetix_Messaging_By_Ppros_Activator::CAP_ACCESS_MESSAGING )
            || current_user_can( 'manage_options' );
    }

    public function check_manage_settings(): bool {
        return current_user_can( Kinetix_Messaging_By_Ppros_Activator::CAP_MANAGE_SETTINGS )
            || current_user_can( 'manage_options' );
    }

    /**
     * Permission callback for inbound email webhook POST.
     * Requires the channel to be enabled and validates the shared webhook token when set.
     */
    public function check_inbound_webhook_permission( WP_REST_Request $request ): bool {
        $cfg = $this->get_settings();
        if ( empty( $cfg['enabled'] ) ) {
            return false;
        }
        $stored_token = (string) ( $cfg['webhookToken'] ?? '' );
        return $this->verify_email_webhook_token( $request, $stored_token );
    }

    /**
     * Validate the inbound email webhook token.
     */
    private function verify_email_webhook_token( WP_REST_Request $request, string $stored_token ): bool {
        if ( '' === $stored_token ) {
            return false;
        }
        $provided_token = (string) ( $request->get_header( 'x-kmbp-token' )
            ?? $request->get_param( 'token' )
            ?? '' );
        return hash_equals( $stored_token, $provided_token );
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Outbound send
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * REST handler — POST /email/send
     *
     * Sends an email from the plugin's configured SMTP account and stores the
     * outbound message in the conversation thread.
     */
    public function handle_send( WP_REST_Request $request ) {
        $cfg = $this->get_settings();

        if ( empty( $cfg['enabled'] ) ) {
            return new WP_Error( 'kmbp_email_disabled', __( 'Email channel is not enabled.', 'kinetix-messaging-by-ppros' ), array( 'status' => 503 ) );
        }

        $conversation_id = (int) $request->get_param( 'conversationId' );
        $to              = sanitize_email( (string) $request->get_param( 'to' ) );
        $to_name         = sanitize_text_field( (string) $request->get_param( 'toName' ) );
        $subject         = sanitize_text_field( (string) $request->get_param( 'subject' ) );
        $body            = wp_kses_post( (string) $request->get_param( 'body' ) );

        if ( ! is_email( $to ) ) {
            return new WP_Error( 'kmbp_invalid_to', __( 'Invalid recipient email address.', 'kinetix-messaging-by-ppros' ), array( 'status' => 400 ) );
        }

        $result = $this->send_via_smtp( $to, $to_name, $subject, $body, $cfg );

        if ( is_wp_error( $result ) ) {
            return $result;
        }

        // Record the outbound message in the DB.
        $current_user = wp_get_current_user();
        $message_id   = $this->store_message(
            $conversation_id,
            $body,
            'agent',
            $current_user->display_name ?: $current_user->user_email,
            array(
                'direction' => 'outbound',
                'to'        => $to,
                'toName'    => $to_name,
                'subject'   => $subject,
            )
        );

        return rest_ensure_response(
            array(
                'sent'       => true,
                'messageId'  => $message_id,
                'to'         => $to,
                'subject'    => $subject,
            )
        );
    }

    /**
     * Send an email through a dedicated PHPMailer instance so that the plugin's
     * SMTP credentials do not interfere with WordPress's own mail config.
     *
     * @param string $to       Recipient address.
     * @param string $to_name  Recipient display name (may be empty).
     * @param string $subject  Email subject.
     * @param string $html_body HTML body.  A plain-text alternative is derived automatically.
     * @param array  $cfg      Email channel settings from wp_options.
     * @return true|\WP_Error
     */
    public function send_via_smtp( string $to, string $to_name, string $subject, string $html_body, array $cfg = array() ) {
        if ( empty( $cfg ) ) {
            $cfg = $this->get_settings();
        }

        require_once ABSPATH . WPINC . '/PHPMailer/PHPMailer.php';
        require_once ABSPATH . WPINC . '/PHPMailer/SMTP.php';
        require_once ABSPATH . WPINC . '/PHPMailer/Exception.php';

        $mail = new \PHPMailer\PHPMailer\PHPMailer( true );

        try {
            // ── Server settings ──────────────────────────────────────────────
            $mail->isSMTP();
            $mail->Host       = (string) ( $cfg['smtpHost'] ?? '' );
            $mail->Port       = (int) ( $cfg['smtpPort'] ?? 587 );
            $mail->Username   = (string) ( $cfg['smtpUser'] ?? '' );
            $mail->Password   = (string) ( $cfg['smtpPass'] ?? '' );

            if ( ! empty( $mail->Username ) ) {
                $mail->SMTPAuth = true;
            }

            // Auto-detect encryption from port when not explicitly set.
            $this->apply_smtp_encryption( $mail, $cfg );

            // ── Sender ───────────────────────────────────────────────────────
            $from_email = ! empty( $cfg['inboxEmail'] ) ? (string) $cfg['inboxEmail'] : (string) ( $cfg['smtpUser'] ?? '' );
            $from_name  = ! empty( $cfg['senderName'] ) ? (string) $cfg['senderName'] : get_bloginfo( 'name' );
            $mail->setFrom( $from_email, $from_name );

            if ( ! empty( $cfg['replyTo'] ) ) {
                $mail->addReplyTo( (string) $cfg['replyTo'] );
            }

            // ── Recipient ────────────────────────────────────────────────────
            $mail->addAddress( $to, $to_name );

            // ── Content ──────────────────────────────────────────────────────
            $mail->isHTML( true );
            $mail->Subject = $subject;
            $mail->Body    = $html_body;
            $mail->AltBody = wp_strip_all_tags( $html_body );

            $mail->send();

            return true;

        } catch ( \PHPMailer\PHPMailer\Exception $e ) {
            return new \WP_Error(
                'kmbp_smtp_error',
                sprintf(
                    /* translators: %s: error message */
                    __( 'SMTP error: %s', 'kinetix-messaging-by-ppros' ),
                    $e->getMessage()
                ),
                array( 'status' => 502 )
            );
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Inbound webhook
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * REST handler — POST /webhooks/email
     *
     * Accepts inbound email payloads from Mailgun, SendGrid Inbound Parse,
     * Postmark, SparkPost, or any raw relay.
     *
     * Security: callers must include a `X-KMBP-Token` header (or `token` body
     * param) matching the `webhookToken` stored in email settings.
     * The webhook is rejected when the token is not configured or does not match.
     */
    public function handle_inbound_webhook( WP_REST_Request $request ) {
        $cfg = $this->get_settings();

        // ── Normalise payload from various provider formats ───────────────────
        $email_data = $this->normalise_webhook_payload( $request );

        if ( is_wp_error( $email_data ) ) {
            return $email_data;
        }

        $conversation_id = $this->process_inbound( $email_data );

        if ( is_wp_error( $conversation_id ) ) {
            return $conversation_id;
        }

        return rest_ensure_response(
            array(
                'received'       => true,
                'conversationId' => $conversation_id,
            )
        );
    }

    /**
     * Normalise inbound webhook payloads from different providers into a
     * consistent internal format.
     *
     * Returned array keys:
     *   from_email, from_name, to, subject, body_html, body_plain,
     *   message_id, in_reply_to, provider, raw
     *
     * @return array|\WP_Error
     */
    private function normalise_webhook_payload( WP_REST_Request $request ) {
        $body   = $request->get_body_params();     // form-encoded (Mailgun, SendGrid)
        $json   = $request->get_json_params();     // JSON (Postmark, SparkPost)
        $params = array_merge( (array) $json, (array) $body );

        // ── Sender ───────────────────────────────────────────────────────────
        $from_raw   = (string) ( $params['from'] ?? $params['From'] ?? $params['sender'] ?? '' );
        $from_email = '';
        $from_name  = '';
        if ( preg_match( '/^(.+?)\s*<([^>]+)>$/', trim( $from_raw ), $m ) ) {
            $from_name  = trim( $m[1], ' "' );
            $from_email = trim( $m[2] );
        } elseif ( is_email( trim( $from_raw ) ) ) {
            $from_email = trim( $from_raw );
        }

        if ( ! is_email( $from_email ) ) {
            return new WP_Error( 'kmbp_invalid_payload', __( 'Could not parse sender address.', 'kinetix-messaging-by-ppros' ), array( 'status' => 400 ) );
        }

        // ── Recipient ─────────────────────────────────────────────────────────
        $to = sanitize_email( (string) ( $params['to'] ?? $params['To'] ?? $params['recipient'] ?? '' ) );

        // ── Subject ───────────────────────────────────────────────────────────
        $subject = sanitize_text_field( (string) ( $params['subject'] ?? $params['Subject'] ?? '(no subject)' ) );

        // ── Body ──────────────────────────────────────────────────────────────
        $body_html  = wp_kses_post( (string) ( $params['body-html'] ?? $params['HtmlBody'] ?? $params['html'] ?? '' ) );
        $body_plain = sanitize_textarea_field( (string) ( $params['body-plain'] ?? $params['TextBody'] ?? $params['text'] ?? '' ) );

        if ( '' === $body_html && '' !== $body_plain ) {
            $body_html = wpautop( esc_html( $body_plain ) );
        }
        if ( '' === $body_html && '' === $body_plain ) {
            return new WP_Error( 'kmbp_invalid_payload', __( 'Email body is empty.', 'kinetix-messaging-by-ppros' ), array( 'status' => 400 ) );
        }

        // ── Threading headers ─────────────────────────────────────────────────
        $message_id  = sanitize_text_field( (string) ( $params['Message-Id'] ?? $params['MessageID'] ?? $params['message-id'] ?? '' ) );
        $in_reply_to = sanitize_text_field( (string) ( $params['In-Reply-To'] ?? $params['in-reply-to'] ?? '' ) );

        return array(
            'from_email'  => $from_email,
            'from_name'   => $from_name,
            'to'          => $to,
            'subject'     => $subject,
            'body_html'   => $body_html,
            'body_plain'  => $body_plain,
            'message_id'  => $message_id,
            'in_reply_to' => $in_reply_to,
            'provider'    => 'webhook',
            'raw'         => $params,
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  IMAP polling
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * WordPress cron handler — fires every 5 minutes.
     */
    public function run_imap_poll(): void {
        $cfg = $this->get_settings();

        if ( empty( $cfg['enabled'] ) || empty( $cfg['imapHost'] ) ) {
            return;
        }

        $results = $this->poll_imap( $cfg );

        if ( is_wp_error( $results ) ) {
            // Log and bail; avoid crashing the cron runner.
            $this->log_debug( '[KMBP Email Pipe] IMAP poll error: ' . $results->get_error_message() );
            return;
        }

        if ( ! empty( $results ) ) {
            $this->log_debug( sprintf( '[KMBP Email Pipe] IMAP poll: processed %d new message(s).', count( $results ) ) );
        }
    }

    /**
     * REST handler — POST /email/poll  (manual trigger for admins/agents).
     */
    public function handle_manual_poll( WP_REST_Request $request ) {
        $cfg = $this->get_settings();

        if ( empty( $cfg['imapHost'] ) ) {
            return new WP_Error( 'kmbp_imap_not_configured', __( 'IMAP is not configured.', 'kinetix-messaging-by-ppros' ), array( 'status' => 400 ) );
        }

        $results = $this->poll_imap( $cfg );

        if ( is_wp_error( $results ) ) {
            return $results;
        }

        return rest_ensure_response(
            array(
                'polled'    => true,
                'processed' => count( $results ),
                'threads'   => $results,
            )
        );
    }

    /**
     * Connect to IMAP, fetch unseen messages, process each one, return a
     * summary array (one entry per message processed).
     *
     * @param array $cfg Email settings from wp_options.
     * @return array|\WP_Error  Array of processed message summaries on success.
     */
    public function poll_imap( array $cfg = array() ) {
        if ( ! function_exists( 'imap_open' ) ) {
            return new \WP_Error(
                'kmbp_imap_extension_missing',
                __( 'The PHP IMAP extension is not installed on this server.', 'kinetix-messaging-by-ppros' ),
                array( 'status' => 500 )
            );
        }

        if ( empty( $cfg ) ) {
            $cfg = $this->get_settings();
        }

        $host       = (string) ( $cfg['imapHost'] ?? '' );
        $port       = (int) ( $cfg['imapPort'] ?? 993 );
        $user       = (string) ( $cfg['imapUser'] ?? '' );
        $pass       = (string) ( $cfg['imapPass'] ?? '' );
        $encryption = strtolower( (string) ( $cfg['imapEncryption'] ?? 'ssl' ) );
        $mailbox    = (string) ( $cfg['imapFolder'] ?? $cfg['imapMailbox'] ?? 'INBOX' );

        // Build IMAP connection string.
        $flags = '/imap';
        if ( 'ssl' === $encryption ) {
            $flags .= '/ssl';
        } elseif ( 'tls' === $encryption ) {
            $flags .= '/tls';
        }

        // Allow self-signed certs in dev; override via settings.
        if ( ! empty( $cfg['imapNovalidateCert'] ) ) {
            $flags .= '/novalidate-cert';
        }

        $connection_string = '{' . $host . ':' . $port . $flags . '}' . $mailbox;

        $imap = @imap_open( $connection_string, $user, $pass, 0, 1 );
        if ( false === $imap ) {
            $errors = imap_errors();
            $msg    = is_array( $errors ) ? implode( '; ', $errors ) : 'Unknown IMAP error';
            return new \WP_Error( 'kmbp_imap_connect_failed', $msg, array( 'status' => 502 ) );
        }

        // Fetch unseen messages.
        $uids = imap_search( $imap, 'UNSEEN', SE_UID );
        if ( false === $uids || empty( $uids ) ) {
            imap_close( $imap );
            return array();
        }

        $processed = array();

        foreach ( $uids as $uid ) {
            $email_data = $this->fetch_imap_message( $imap, $uid );
            if ( is_wp_error( $email_data ) ) {
                continue;
            }

            $conversation_id = $this->process_inbound( $email_data );

            if ( ! is_wp_error( $conversation_id ) ) {
                // Mark as seen.
                imap_setflag_full( $imap, (string) $uid, '\\Seen', ST_UID );

                $processed[] = array(
                    'uid'            => $uid,
                    'from'           => $email_data['from_email'],
                    'subject'        => $email_data['subject'],
                    'conversationId' => $conversation_id,
                );
            }
        }

        imap_close( $imap );

        return $processed;
    }

    /**
     * Decode a single IMAP message identified by $uid into our standard format.
     *
     * @param resource $imap  Active IMAP stream.
     * @param int      $uid   Message UID.
     * @return array|\WP_Error
     */
    private function fetch_imap_message( $imap, int $uid ) {
        $header = imap_fetchheader( $imap, $uid, FT_UID );
        $struct = imap_fetchstructure( $imap, $uid, FT_UID );

        if ( ! $struct ) {
            return new \WP_Error( 'kmbp_imap_parse_error', 'Could not fetch message structure.' );
        }

        // ── Parse headers ────────────────────────────────────────────────────
        $raw_headers = imap_rfc822_parse_headers( $header );

        $from_obj   = isset( $raw_headers->from[0] ) ? $raw_headers->from[0] : null;
        $from_email = $from_obj ? ( isset( $from_obj->mailbox, $from_obj->host ) ? $from_obj->mailbox . '@' . $from_obj->host : '' ) : '';
        $from_name  = $from_obj && isset( $from_obj->personal ) ? imap_utf8( $from_obj->personal ) : '';

        if ( ! is_email( $from_email ) ) {
            return new \WP_Error( 'kmbp_imap_invalid_from', 'Could not determine sender address.' );
        }

        $subject     = isset( $raw_headers->subject ) ? imap_utf8( $raw_headers->subject ) : '(no subject)';
        $message_id  = isset( $raw_headers->message_id ) ? trim( $raw_headers->message_id ) : '';
        $in_reply_to = isset( $raw_headers->in_reply_to ) ? trim( $raw_headers->in_reply_to ) : '';

        // ── Decode body ───────────────────────────────────────────────────────
        list( $body_html, $body_plain ) = $this->decode_imap_body( $imap, $uid, $struct );

        if ( '' === $body_html && '' === $body_plain ) {
            return new \WP_Error( 'kmbp_imap_empty_body', 'Message body is empty.' );
        }

        if ( '' === $body_html && '' !== $body_plain ) {
            $body_html = wpautop( esc_html( $body_plain ) );
        }

        return array(
            'from_email'  => $from_email,
            'from_name'   => $from_name,
            'to'          => '',
            'subject'     => sanitize_text_field( $subject ),
            'body_html'   => wp_kses_post( $body_html ),
            'body_plain'  => sanitize_textarea_field( $body_plain ),
            'message_id'  => sanitize_text_field( $message_id ),
            'in_reply_to' => sanitize_text_field( $in_reply_to ),
            'provider'    => 'imap',
            'raw'         => array(),
        );
    }

    /**
     * Walk the MIME tree of a message structure and extract HTML + plain-text.
     *
     * @param resource        $imap
     * @param int             $uid
     * @param object          $struct imap_fetchstructure result.
     * @param string          $section MIME section path (empty for top-level).
     * @return array{0:string,1:string} [html, plain]
     */
    private function decode_imap_body( $imap, int $uid, object $struct, string $section = '' ): array {
        $html  = '';
        $plain = '';

        // Multipart: recurse into parts.
        if ( 1 === $struct->type && isset( $struct->parts ) ) {
            foreach ( $struct->parts as $idx => $part ) {
                $sub_section = ( '' === $section ) ? (string) ( $idx + 1 ) : $section . '.' . ( $idx + 1 );
                list( $sub_html, $sub_plain ) = $this->decode_imap_body( $imap, $uid, $part, $sub_section );
                $html  .= $sub_html;
                $plain .= $sub_plain;
            }
            return array( $html, $plain );
        }

        // Non-multipart leaf.
        $type    = strtolower( $struct->subtype ?? '' );
        $charset = 'UTF-8';

        if ( isset( $struct->parameters ) ) {
            foreach ( $struct->parameters as $param ) {
                if ( 'charset' === strtolower( $param->attribute ) ) {
                    $charset = strtoupper( $param->value );
                    break;
                }
            }
        }

        $raw = ( '' === $section )
            ? imap_fetchbody( $imap, $uid, '1', FT_UID )
            : imap_fetchbody( $imap, $uid, $section, FT_UID );

        // Decode transfer encoding.
        $encoding = $struct->encoding ?? 0;
        switch ( $encoding ) {
            case 1: // quoted-printable
                $raw = quoted_printable_decode( $raw );
                break;
            case 2: // base64
                $raw = base64_decode( $raw );
                break;
        }

        // Convert charset.
        if ( 'UTF-8' !== $charset && function_exists( 'mb_convert_encoding' ) ) {
            $raw = mb_convert_encoding( $raw, 'UTF-8', $charset );
        }

        if ( 'html' === $type ) {
            $html = $raw;
        } elseif ( 'plain' === $type ) {
            $plain = $raw;
        }

        return array( $html, $plain );
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Connection test
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * REST handler — POST /email/test-connection
     * Tests SMTP (sends a test message) or IMAP connectivity.
     */
    public function handle_test_connection( WP_REST_Request $request ) {
        $type = (string) $request->get_param( 'type' );
        $cfg  = $this->get_settings();

        if ( 'smtp' === $type ) {
            return $this->test_smtp( $cfg );
        }

        return $this->test_imap( $cfg );
    }

    /**
     * Resolve SMTP encryption from explicit setting, UI toggles, or port.
     */
    private function resolve_smtp_encryption( array $cfg, int $port ): string {
        $encryption = strtolower( (string) ( $cfg['smtpEncryption'] ?? '' ) );
        if ( '' !== $encryption ) {
            return $encryption;
        }
        if ( array_key_exists( 'smtpTls', $cfg ) && empty( $cfg['smtpTls'] ) ) {
            return '';
        }
        if ( 465 === $port ) {
            return 'ssl';
        }
        if ( 25 === $port ) {
            return '';
        }
        return 'tls';
    }

    /**
     * Apply encryption options to a PHPMailer SMTP instance.
     */
    private function apply_smtp_encryption( \PHPMailer\PHPMailer\PHPMailer $mail, array $cfg ): void {
        $encryption = $this->resolve_smtp_encryption( $cfg, (int) $mail->Port );
        if ( '' === $encryption ) {
            $mail->SMTPSecure   = '';
            $mail->SMTPAutoTLS  = false;
        } elseif ( 'ssl' === $encryption ) {
            $mail->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS;
        } else {
            $mail->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
        }

        if ( array_key_exists( 'smtpVerifySsl', $cfg ) && empty( $cfg['smtpVerifySsl'] ) ) {
            $mail->SMTPOptions = array(
                'ssl' => array(
                    'verify_peer'       => false,
                    'verify_peer_name'  => false,
                    'allow_self_signed' => true,
                ),
            );
        }

        $mail->CharSet = 'UTF-8';
    }

    private function test_smtp( array $cfg ) {
        if ( '' === (string) ( $cfg['smtpHost'] ?? '' ) ) {
            return new WP_Error(
                'kmbp_smtp_not_configured',
                __( 'SMTP host is not configured.', 'kinetix-messaging-by-ppros' ),
                array( 'status' => 400 )
            );
        }

        $to = '';
        if ( is_email( (string) ( $cfg['smtpUser'] ?? '' ) ) ) {
            $to = (string) $cfg['smtpUser'];
        } elseif ( is_email( (string) ( $cfg['inboxEmail'] ?? '' ) ) ) {
            $to = (string) $cfg['inboxEmail'];
        } else {
            $user = wp_get_current_user();
            $to   = (string) $user->user_email;
        }

        if ( ! is_email( $to ) ) {
            return new WP_Error(
                'kmbp_no_test_recipient',
                __( 'Set a valid SMTP username or inbox email to receive the test message.', 'kinetix-messaging-by-ppros' ),
                array( 'status' => 400 )
            );
        }

        $subject = sprintf(
            /* translators: %s: site name */
            __( 'SMTP test — %s', 'kinetix-messaging-by-ppros' ),
            get_bloginfo( 'name' )
        );
        $body = '<p>' . esc_html__(
            'This is a test email from Kinetix Messaging. Your SMTP settings are working.',
            'kinetix-messaging-by-ppros'
        ) . '</p>';

        $result = $this->send_via_smtp( $to, '', $subject, $body, $cfg );
        if ( is_wp_error( $result ) ) {
            return $result;
        }

        return rest_ensure_response(
            array(
                'ok'     => true,
                'type'   => 'smtp',
                'sentTo' => $to,
            )
        );
    }

    private function test_imap( array $cfg ) {
        if ( ! function_exists( 'imap_open' ) ) {
            return new WP_Error( 'kmbp_imap_extension_missing', __( 'PHP IMAP extension not installed.', 'kinetix-messaging-by-ppros' ), array( 'status' => 500 ) );
        }

        $host       = (string) ( $cfg['imapHost'] ?? '' );
        $port       = (int) ( $cfg['imapPort'] ?? 993 );
        $user       = (string) ( $cfg['imapUser'] ?? '' );
        $pass       = (string) ( $cfg['imapPass'] ?? '' );
        $encryption = strtolower( (string) ( $cfg['imapEncryption'] ?? 'ssl' ) );
        $mailbox    = (string) ( $cfg['imapFolder'] ?? $cfg['imapMailbox'] ?? 'INBOX' );

        $flags = '/imap';
        if ( 'ssl' === $encryption ) {
            $flags .= '/ssl';
        } elseif ( 'tls' === $encryption ) {
            $flags .= '/tls';
        }
        if ( ! empty( $cfg['imapNovalidateCert'] ) ) {
            $flags .= '/novalidate-cert';
        }

        $conn_str = '{' . $host . ':' . $port . $flags . '}' . $mailbox;
        $imap     = @imap_open( $conn_str, $user, $pass, 0, 1 );

        if ( false === $imap ) {
            $errors = imap_errors();
            $msg    = is_array( $errors ) ? implode( '; ', $errors ) : 'Unknown IMAP error';
            return new WP_Error( 'kmbp_imap_test_failed', $msg, array( 'status' => 502 ) );
        }

        imap_close( $imap );
        return rest_ensure_response( array( 'ok' => true, 'type' => 'imap' ) );
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Core: process a normalised inbound email
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Store an inbound email as a conversation + message in the DB.
     *
     * Threading: if `in_reply_to` matches the `external_id` of an existing
     * conversation, the message is appended to that thread; otherwise a new
     * conversation is created.
     *
     * @param array $email_data Normalised email array (from webhook or IMAP).
     * @return int|\WP_Error  Conversation ID on success.
     */
    public function process_inbound( array $email_data ) {
        $from_email  = (string) ( $email_data['from_email'] ?? '' );
        $from_name   = (string) ( $email_data['from_name'] ?? '' );
        $subject     = (string) ( $email_data['subject'] ?? '(no subject)' );
        $body_html   = (string) ( $email_data['body_html'] ?? '' );
        $body_plain  = (string) ( $email_data['body_plain'] ?? '' );
        $message_id  = (string) ( $email_data['message_id'] ?? '' );
        $in_reply_to = (string) ( $email_data['in_reply_to'] ?? '' );

        if ( ! is_email( $from_email ) ) {
            return new \WP_Error( 'kmbp_invalid_from', __( 'Invalid sender address.', 'kinetix-messaging-by-ppros' ) );
        }

        $body = '' !== $body_html ? $body_html : wpautop( esc_html( $body_plain ) );

        // Deduplicate by message-id.
        if ( '' !== $message_id ) {
            $existing_msg_id = $this->find_message_by_external_id( $message_id );
            if ( $existing_msg_id ) {
                return $this->get_conversation_id_for_message( $existing_msg_id );
            }
        }

        // Find or create the conversation thread.
        $conversation_id = $this->find_or_create_conversation(
            $from_email,
            $from_name,
            $subject,
            $message_id,
            $in_reply_to
        );

        if ( is_wp_error( $conversation_id ) ) {
            return $conversation_id;
        }

        // Append the inbound message.
        $this->store_message(
            $conversation_id,
            $body,
            'contact',
            '' !== $from_name ? $from_name : $from_email,
            array(
                'direction'  => 'inbound',
                'from'       => $from_email,
                'fromName'   => $from_name,
                'subject'    => $subject,
                'messageId'  => $message_id,
                'inReplyTo'  => $in_reply_to,
                'provider'   => (string) ( $email_data['provider'] ?? 'unknown' ),
            ),
            $message_id
        );

        /**
         * Fires after an inbound email is stored.
         *
         * @param int   $conversation_id
         * @param array $email_data
         */
        do_action( 'kmbp_inbound_email_received', $conversation_id, $email_data );

        return $conversation_id;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  DB helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Find an existing open conversation for this email thread, or create one.
     *
     * Matching priority:
     *   1. Match by `in_reply_to` → existing conversation's `external_id`.
     *   2. Match by `from_email` + subject (stripped Re:/Fwd:) + open status.
     *   3. Create a new conversation.
     *
     * @return int|\WP_Error Conversation ID.
     */
    private function find_or_create_conversation(
        string $from_email,
        string $from_name,
        string $subject,
        string $message_id,
        string $in_reply_to
    ) {
        global $wpdb;

        // phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- KMBP custom tables; no WordPress core API exists.

        // 1. Thread by in-reply-to.
        if ( '' !== $in_reply_to ) {
            $cid = (int) $wpdb->get_var(
                $wpdb->prepare(
                    "SELECT id FROM {$wpdb->prefix}kmbp_conversations WHERE channel = 'email' AND external_id = %s AND status != 'closed' LIMIT 1",
                    $in_reply_to
                )
            );
            if ( $cid > 0 ) {
                return $cid;
            }
        }

        // 2. Thread by from + normalised subject (strip Re:/Fwd: prefixes).
        $normalised_subject = preg_replace( '/^(re|fwd?)\s*:\s*/i', '', $subject );
        $cid = (int) $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "SELECT id FROM {$wpdb->prefix}kmbp_conversations
                 WHERE channel = 'email'
                   AND contact_handle = %s
                   AND subject LIKE %s
                   AND status != 'closed'
                 ORDER BY updated_at DESC
                 LIMIT 1",
                $from_email,
                '%' . $wpdb->esc_like( $normalised_subject ) . '%'
            )
        );
        if ( $cid > 0 ) {
            return $cid;
        }

        // 3. Create a new conversation.
        $ok = $wpdb->insert( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prefix . 'kmbp_conversations',
            array(
                'channel'        => 'email',
                'external_id'    => $message_id,
                'contact_name'   => $from_name,
                'contact_handle' => $from_email,
                'subject'        => $subject,
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
     * Insert a message row and update the parent conversation's preview + timestamp.
     *
     * @param int    $conversation_id
     * @param string $body        HTML content.
     * @param string $sender_type 'contact' | 'agent'
     * @param string $sender_name Display name.
     * @param array  $meta        Extra metadata stored as JSON.
     * @param string $external_id Optional message-ID for deduplication.
     * @return int  Inserted message row ID.
     */
    private function store_message(
        int $conversation_id,
        string $body,
        string $sender_type,
        string $sender_name,
        array $meta = array(),
        string $external_id = ''
    ): int {
        global $wpdb;

        // phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- KMBP custom tables; no WordPress core API exists.

        $current_user = wp_get_current_user();

        $wpdb->insert(
            $wpdb->prefix . 'kmbp_messages',
            array(
                'conversation_id' => $conversation_id,
                'external_id'     => $external_id,
                'sender_type'     => $sender_type,
                'sender_id'       => ( 'agent' === $sender_type && $current_user->ID > 0 ) ? (int) $current_user->ID : null,
                'sender_name'     => $sender_name,
                'body'            => $body,
                'meta'            => wp_json_encode( $meta ),
                'sent_at'         => current_time( 'mysql' ),
            ),
            array( '%d', '%s', '%s', '%d', '%s', '%s', '%s', '%s' )
        );

        $message_id = (int) $wpdb->insert_id;

        // Update conversation preview + timestamp.
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
     * Look up a message row by its email Message-ID (external_id).
     *
     * @return int  Message row ID, or 0 if not found.
     */
    private function find_message_by_external_id( string $external_id ): int {
        global $wpdb;
        // phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- KMBP custom tables; no WordPress core API exists.
        return (int) $wpdb->get_var(
            $wpdb->prepare(
                "SELECT id FROM {$wpdb->prefix}kmbp_messages WHERE external_id = %s LIMIT 1",
                $external_id
            )
        );
        // phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
    }

    /**
     * Given a message row ID, return its parent conversation ID.
     *
     * @return int Conversation ID, or 0 if not found.
     */
    private function get_conversation_id_for_message( int $message_id ): int {
        global $wpdb;
        // phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- KMBP custom tables; no WordPress core API exists.
        return (int) $wpdb->get_var(
            $wpdb->prepare(
                "SELECT conversation_id FROM {$wpdb->prefix}kmbp_messages WHERE id = %d LIMIT 1",
                $message_id
            )
        );
        // phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Settings accessor
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Log a debug message when WP_DEBUG is enabled.
     *
     * @param string $message Log message.
     */
    private function log_debug( string $message ): void {
        if ( ! defined( 'WP_DEBUG' ) || ! WP_DEBUG ) {
            return;
        }
        // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log -- Debug only when WP_DEBUG is true.
        error_log( $message );
    }

    /**
     * Return the `email` sub-array from wp_options (plain credentials, not scrubbed).
     *
     * @return array
     */
    private function get_settings(): array {
        $all = (array) get_option( Kinetix_Messaging_By_Ppros_Activator::SETTINGS_OPTION, array() );
        return isset( $all['email'] ) ? (array) $all['email'] : array();
    }
}
