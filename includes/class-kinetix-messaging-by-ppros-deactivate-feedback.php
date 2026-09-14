<?php
/**
 * Optional deactivation feedback on the Plugins screen.
 *
 * Intercepts Deactivate for this plugin, asks why, and emails the answer to
 * support@pluginpros.co. On local/dev sites without sendmail, the payload is
 * posted to pluginpros.co which then sends the mail. Skipping still deactivates
 * and sends nothing.
 *
 * @package Kinetix_Messaging_By_Ppros
 */

defined( 'ABSPATH' ) || die( 'No script kiddies please!' );

class Kinetix_Messaging_By_Ppros_Deactivate_Feedback {

    const AJAX_ACTION = 'kmbp_deactivate_feedback';
    const NONCE_ACTION = 'kmbp_deactivate_feedback';
    const SUPPORT_EMAIL = 'support@pluginpros.co';
    const FEEDBACK_TOKEN = 'kmbp-deactivate-feedback-v1';
    const HUB_REST_URL = 'https://pluginpros.co/wp-json/kmbp/v1/deactivate-feedback';

    public function enqueue_assets( $hook_suffix ) {
        if ( 'plugins.php' !== $hook_suffix ) {
            return;
        }

        if ( ! current_user_can( 'activate_plugins' ) ) {
            return;
        }

        wp_enqueue_style(
            'kmbp-deactivate-feedback',
            KINETIX_MESSAGING_BY_PPROS_URL . 'assets/css/deactivate-feedback.css',
            array(),
            KINETIX_MESSAGING_BY_PPROS_VERSION
        );

        wp_enqueue_script(
            'kmbp-deactivate-feedback',
            KINETIX_MESSAGING_BY_PPROS_URL . 'assets/js/deactivate-feedback.js',
            array(),
            KINETIX_MESSAGING_BY_PPROS_VERSION,
            true
        );

        wp_localize_script(
            'kmbp-deactivate-feedback',
            'kmbpDeactivateFeedback',
            array(
                'ajaxUrl'  => admin_url( 'admin-ajax.php' ),
                'nonce'    => wp_create_nonce( self::NONCE_ACTION ),
                'action'   => self::AJAX_ACTION,
                'plugin'   => KINETIX_MESSAGING_BY_PPROS_BASENAME,
                'strings'  => array(
                    'submitting' => __( 'Sending…', 'kinetix-messaging-by-ppros' ),
                ),
            )
        );
    }

    public function render_modal() {
        if ( ! $this->is_plugins_screen() || ! current_user_can( 'activate_plugins' ) ) {
            return;
        }

        $reasons = $this->reasons();
        ?>
        <div id="kmbp-deactivate-modal" class="kmbp-df" hidden>
            <div class="kmbp-df__backdrop" data-kmbp-df="cancel"></div>
            <div class="kmbp-df__dialog" role="dialog" aria-modal="true" aria-labelledby="kmbp-df-title">
                <button type="button" class="kmbp-df__close" data-kmbp-df="cancel" aria-label="<?php esc_attr_e( 'Close', 'kinetix-messaging-by-ppros' ); ?>">
                    <span aria-hidden="true">&times;</span>
                </button>
                <div class="kmbp-df__header">
                    <h2 id="kmbp-df-title"><?php esc_html_e( 'Before you go', 'kinetix-messaging-by-ppros' ); ?></h2>
                    <p><?php esc_html_e( 'If you have a moment, tell us why you are deactivating Kinetix Messaging. This is optional and helps us improve.', 'kinetix-messaging-by-ppros' ); ?></p>
                </div>
                <form id="kmbp-df-form" class="kmbp-df__form">
                    <fieldset class="kmbp-df__reasons">
                        <legend class="screen-reader-text"><?php esc_html_e( 'Reason for deactivating', 'kinetix-messaging-by-ppros' ); ?></legend>
                        <?php foreach ( $reasons as $slug => $label ) : ?>
                            <label class="kmbp-df__reason">
                                <input type="radio" name="kmbp_df_reason" value="<?php echo esc_attr( $slug ); ?>" />
                                <span><?php echo esc_html( $label ); ?></span>
                            </label>
                        <?php endforeach; ?>
                    </fieldset>
                    <label class="kmbp-df__details-label" for="kmbp-df-details">
                        <?php esc_html_e( 'Anything we should know? (optional)', 'kinetix-messaging-by-ppros' ); ?>
                    </label>
                    <textarea id="kmbp-df-details" name="kmbp_df_details" rows="3" maxlength="2000" placeholder="<?php esc_attr_e( 'What went wrong, what you expected, or which plugin you switched to…', 'kinetix-messaging-by-ppros' ); ?>"></textarea>
                    <p class="kmbp-df__privacy">
                        <?php esc_html_e( 'Submitting sends your reason, optional comments, site URL, plugin/WordPress/PHP versions, and your name and email to Plugin Pros so we can email support@pluginpros.co. Skip if you prefer not to share this.', 'kinetix-messaging-by-ppros' ); ?>
                    </p>
                    <div class="kmbp-df__actions">
                        <button type="button" class="button" data-kmbp-df="skip">
                            <?php esc_html_e( 'Skip & Deactivate', 'kinetix-messaging-by-ppros' ); ?>
                        </button>
                        <button type="submit" class="button button-primary" data-kmbp-df="submit">
                            <?php esc_html_e( 'Submit & Deactivate', 'kinetix-messaging-by-ppros' ); ?>
                        </button>
                    </div>
                </form>
            </div>
        </div>
        <?php
    }

    public function register_rest_route() {
        register_rest_route(
            Kinetix_Messaging_By_Ppros_Rest_Api::NAMESPACE_V1,
            '/deactivate-feedback',
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'handle_rest' ),
                'permission_callback' => '__return_true',
            )
        );
    }

    public function handle_ajax() {
        check_ajax_referer( self::NONCE_ACTION, 'nonce' );

        if ( ! current_user_can( 'activate_plugins' ) ) {
            wp_send_json_error( array( 'message' => 'forbidden' ), 403 );
        }

        $payload = $this->collect_payload_from_request();
        $sent    = $this->deliver_feedback( $payload );

        wp_send_json_success(
            array(
                'sent' => (bool) $sent,
            )
        );
    }

    /**
     * Public receiver used on pluginpros.co so local/dev sites can deliver mail
     * without a working sendmail binary.
     *
     * @param WP_REST_Request $request Request.
     * @return WP_REST_Response|WP_Error
     */
    public function handle_rest( $request ) {
        $token = sanitize_text_field( (string) $request->get_param( 'token' ) );
        if ( ! hash_equals( self::FEEDBACK_TOKEN, $token ) ) {
            return new WP_Error( 'kmbp_forbidden', 'Invalid token.', array( 'status' => 403 ) );
        }

        if ( ! $this->allow_remote_feedback() ) {
            return new WP_Error( 'kmbp_rate_limited', 'Too many requests.', array( 'status' => 429 ) );
        }

        $payload = $this->sanitize_payload(
            array(
                'reason'         => $request->get_param( 'reason' ),
                'details'        => $request->get_param( 'details' ),
                'site'           => $request->get_param( 'site' ),
                'plugin_version' => $request->get_param( 'plugin_version' ),
                'wp_version'     => $request->get_param( 'wp_version' ),
                'php_version'    => $request->get_param( 'php_version' ),
                'admin_name'     => $request->get_param( 'admin_name' ),
                'admin_email'    => $request->get_param( 'admin_email' ),
                'locale'         => $request->get_param( 'locale' ),
            )
        );

        $sent = $this->deliver_mail_local( $payload );

        return rest_ensure_response(
            array(
                'sent' => (bool) $sent,
            )
        );
    }

    /**
     * @return array<string, string>
     */
    private function reasons() {
        return array(
            'temporary'       => __( 'It is a temporary deactivation — I am troubleshooting.', 'kinetix-messaging-by-ppros' ),
            'not_working'     => __( 'The plugin is not working or is broken.', 'kinetix-messaging-by-ppros' ),
            'missing_feature' => __( 'It is missing a feature I need.', 'kinetix-messaging-by-ppros' ),
            'too_complicated' => __( 'It is too complicated to set up.', 'kinetix-messaging-by-ppros' ),
            'better_plugin'   => __( 'I found a better plugin.', 'kinetix-messaging-by-ppros' ),
            'no_longer_need'  => __( 'I no longer need it.', 'kinetix-messaging-by-ppros' ),
            'other'           => __( 'Other', 'kinetix-messaging-by-ppros' ),
        );
    }

    /**
     * @return array<string, string>
     */
    private function collect_payload_from_request() {
        // phpcs:ignore WordPress.Security.NonceVerification.Missing -- nonce is verified in handle_ajax() before this runs.
        $reason  = isset( $_POST['reason'] ) ? sanitize_key( wp_unslash( $_POST['reason'] ) ) : '';
        // phpcs:ignore WordPress.Security.NonceVerification.Missing -- nonce is verified in handle_ajax() before this runs.
        $details = isset( $_POST['details'] ) ? sanitize_textarea_field( wp_unslash( $_POST['details'] ) ) : '';
        $user    = wp_get_current_user();

        return $this->sanitize_payload(
            array(
                'reason'         => $reason,
                'details'        => $details,
                'site'           => home_url( '/' ),
                'plugin_version' => KINETIX_MESSAGING_BY_PPROS_VERSION,
                'wp_version'     => get_bloginfo( 'version' ),
                'php_version'    => PHP_VERSION,
                'admin_name'     => $user->display_name,
                'admin_email'    => $user->user_email,
                'locale'         => get_user_locale(),
            )
        );
    }

    /**
     * @param array<string, mixed> $raw Raw values.
     * @return array<string, string>
     */
    private function sanitize_payload( $raw ) {
        $reason  = isset( $raw['reason'] ) ? sanitize_key( (string) $raw['reason'] ) : '';
        $allowed = array_keys( $this->reasons() );
        if ( ! in_array( $reason, $allowed, true ) ) {
            $reason = 'other';
        }

        $details = isset( $raw['details'] ) ? sanitize_textarea_field( (string) $raw['details'] ) : '';
        if ( strlen( $details ) > 2000 ) {
            $details = substr( $details, 0, 2000 );
        }

        $email = isset( $raw['admin_email'] ) ? sanitize_email( (string) $raw['admin_email'] ) : '';

        return array(
            'reason'         => $reason,
            'details'        => $details,
            'site'           => esc_url_raw( (string) ( $raw['site'] ?? '' ) ),
            'plugin_version' => sanitize_text_field( (string) ( $raw['plugin_version'] ?? '' ) ),
            'wp_version'     => sanitize_text_field( (string) ( $raw['wp_version'] ?? '' ) ),
            'php_version'    => sanitize_text_field( (string) ( $raw['php_version'] ?? '' ) ),
            'admin_name'     => sanitize_text_field( (string) ( $raw['admin_name'] ?? '' ) ),
            'admin_email'    => is_email( $email ) ? $email : '',
            'locale'         => sanitize_text_field( (string) ( $raw['locale'] ?? '' ) ),
        );
    }

    /**
     * @param array<string, string> $payload Sanitized payload.
     * @return bool
     */
    private function deliver_feedback( $payload ) {
        if ( $this->is_feedback_hub() ) {
            return $this->deliver_mail_local( $payload );
        }

        if ( $this->post_json( self::HUB_REST_URL, array_merge( $payload, array( 'token' => self::FEEDBACK_TOKEN ) ) ) ) {
            return true;
        }

        return $this->deliver_mail_local( $payload );
    }

    /**
     * @param array<string, string> $payload Sanitized payload.
     * @return bool
     */
    private function deliver_mail_local( $payload ) {
        $composed = $this->compose_message( $payload );

        if ( $this->send_via_plugin_smtp( $composed['subject'], $composed['body'], $payload['admin_email'] ) ) {
            return true;
        }

        $headers = array( 'Content-Type: text/plain; charset=UTF-8' );
        if ( is_email( $payload['admin_email'] ) ) {
            $headers[] = 'Reply-To: ' . $payload['admin_email'];
        }

        return (bool) wp_mail( self::SUPPORT_EMAIL, $composed['subject'], $composed['body'], $headers );
    }

    /**
     * @param array<string, string> $payload Sanitized payload.
     * @return array{subject:string,body:string,label:string}
     */
    private function compose_message( $payload ) {
        $reasons = $this->reasons();
        $label   = isset( $reasons[ $payload['reason'] ] ) ? $reasons[ $payload['reason'] ] : $payload['reason'];
        $host    = wp_parse_url( $payload['site'], PHP_URL_HOST );
        if ( ! is_string( $host ) || '' === $host ) {
            $host = 'unknown-host';
        }

        $lines   = array();
        $lines[] = 'Kinetix Messaging by Ppros was deactivated.';
        $lines[] = '';
        $lines[] = 'Reason: ' . $label . ' (' . $payload['reason'] . ')';
        $lines[] = 'Comments: ' . ( '' !== $payload['details'] ? $payload['details'] : '(none)' );
        $lines[] = '';
        $lines[] = 'Site: ' . $payload['site'];
        $lines[] = 'Plugin version: ' . $payload['plugin_version'];
        $lines[] = 'WordPress: ' . $payload['wp_version'];
        $lines[] = 'PHP: ' . $payload['php_version'];
        $lines[] = 'Admin: ' . $payload['admin_name'] . ' <' . $payload['admin_email'] . '>';
        $lines[] = 'Locale: ' . $payload['locale'];

        return array(
            'label'   => $label,
            'subject' => sprintf( '[Kinetix Messaging] Deactivation: %s (%s)', $label, $host ),
            'body'    => implode( "\n", $lines ),
        );
    }

    /**
     * @param string $subject Subject.
     * @param string $body    Plain-text body.
     * @param string $reply_to Reply-To address.
     * @return bool
     */
    private function send_via_plugin_smtp( $subject, $body, $reply_to ) {
        $settings = get_option( Kinetix_Messaging_By_Ppros_Activator::SETTINGS_OPTION, array() );
        $cfg      = ( isset( $settings['email'] ) && is_array( $settings['email'] ) ) ? $settings['email'] : array();

        if ( empty( $cfg['smtpHost'] ) || ! class_exists( 'Kinetix_Messaging_By_Ppros_Email_Pipe' ) ) {
            return false;
        }

        if ( is_email( $reply_to ) ) {
            $cfg['replyTo'] = $reply_to;
        }

        $pipe   = new Kinetix_Messaging_By_Ppros_Email_Pipe();
        $html   = nl2br( esc_html( $body ) );
        $result = $pipe->send_via_smtp( self::SUPPORT_EMAIL, 'Plugin Pros Support', $subject, $html, $cfg );

        return true === $result;
    }

    /**
     * @param string               $url     Endpoint.
     * @param array<string, mixed> $body    JSON body.
     * @param array<string, string> $headers Extra headers.
     * @return bool
     */
    private function post_json( $url, $body, $headers = array() ) {
        $response = wp_remote_post(
            $url,
            array(
                'timeout' => 15,
                'headers' => array_merge(
                    array(
                        'Content-Type' => 'application/json',
                        'Accept'       => 'application/json',
                    ),
                    $headers
                ),
                'body'    => wp_json_encode( $body ),
            )
        );

        if ( is_wp_error( $response ) ) {
            return false;
        }

        $code = (int) wp_remote_retrieve_response_code( $response );
        if ( $code < 200 || $code >= 300 ) {
            return false;
        }

        $decoded = json_decode( wp_remote_retrieve_body( $response ), true );
        if ( ! is_array( $decoded ) ) {
            return true;
        }

        if ( array_key_exists( 'success', $decoded ) && ( false === $decoded['success'] || 'false' === $decoded['success'] ) ) {
            return false;
        }

        if ( array_key_exists( 'sent', $decoded ) ) {
            return (bool) $decoded['sent'];
        }

        return true;
    }

    /**
     * @return bool
     */
    private function is_feedback_hub() {
        $host = wp_parse_url( home_url(), PHP_URL_HOST );
        return is_string( $host ) && in_array( $host, array( 'pluginpros.co', 'www.pluginpros.co' ), true );
    }

    /**
     * @return bool
     */
    private function allow_remote_feedback() {
        $ip  = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : 'unknown';
        $key = 'kmbp_df_' . md5( $ip );
        $n   = (int) get_transient( $key );
        if ( $n >= 8 ) {
            return false;
        }
        set_transient( $key, $n + 1, HOUR_IN_SECONDS );
        return true;
    }

    /**
     * @return bool
     */
    private function is_plugins_screen() {
        if ( ! function_exists( 'get_current_screen' ) ) {
            return false;
        }
        $screen = get_current_screen();
        return $screen && in_array( $screen->id, array( 'plugins', 'plugins-network' ), true );
    }
}
