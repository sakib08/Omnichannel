<?php
/**
 * Telegram channel connector.
 *
 * Inbound  — POST /wp-json/sme/v1/webhooks/telegram
 *            Telegram posts JSON updates to this URL.
 *            Register it via:
 *              curl -X POST \
 *                "https://api.telegram.org/bot<TOKEN>/setWebhook" \
 *                -d "url=<SITE_URL>/wp-json/sme/v1/webhooks/telegram" \
 *                -d "secret_token=<webhookSecret>"
 *
 * Outbound — POST /wp-json/sme/v1/telegram/send
 *            Agents POST { conversationId, recipientId (chat_id), text }.
 *
 * Settings keys (stored under sme_platform_settings['telegram']):
 *   enabled, botToken, botUsername, webhookSecret, startReply, startMsg,
 *   typingIndicator, markdown, autoReply, autoReplyMsg
 *
 * @package Kinetix_Messaging_By_Ppros
 */

defined( 'ABSPATH' ) || die( 'No script kiddies please!' );

class Kinetix_Messaging_By_Ppros_Telegram_Pipe extends Kinetix_Messaging_By_Ppros_Channel_Pipe_Base {

    const BOT_API = 'https://api.telegram.org/bot';

    /** @var array|null Update queued for shutdown processing. */
    private $pending_webhook_update = null;

    /** @var bool Whether the webhook response flush hook was registered. */
    private $webhook_response_flush_registered = false;

    public function get_channel_slug(): string {
        return 'telegram';
    }

    public function register_routes(): void {
        $ns = Kinetix_Messaging_By_Ppros_Rest_Api::NAMESPACE_V1;

        register_rest_route(
            $ns,
            '/webhooks/telegram',
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'handle_webhook' ),
                // Auth is enforced inside handle_webhook() so failures return 403 with
                // actionable JSON instead of WordPress's generic rest_forbidden 401.
                'permission_callback' => '__return_true',
            )
        );

        register_rest_route(
            $ns,
            '/telegram/send',
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
            '/telegram/set-webhook',
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'handle_set_webhook' ),
                'permission_callback' => array( $this, 'check_manage_settings' ),
            )
        );

        register_rest_route(
            $ns,
            '/telegram/webhook-info',
            array(
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => array( $this, 'handle_webhook_info' ),
                'permission_callback' => array( $this, 'check_manage_settings' ),
            )
        );
    }

    /**
     * Validate the Telegram secret token header.
     *
     * @return true|\WP_Error
     */
    private function validate_telegram_webhook_secret( WP_REST_Request $request ) {
        $secret = (string) ( $this->get_settings()['webhookSecret'] ?? '' );
        if ( '' === $secret ) {
            return new WP_Error(
                'sme_telegram_no_secret',
                __( 'Webhook secret is not configured. Open Telegram settings and click Register Webhook.', 'kinetix-messaging-by-ppros' ),
                array( 'status' => 403 )
            );
        }

        $provided = $this->get_request_header( $request, 'x-telegram-bot-api-secret-token' );
        if ( '' === $provided || ! hash_equals( $secret, $provided ) ) {
            return new WP_Error(
                'sme_telegram_bad_secret',
                __( 'Invalid or missing X-Telegram-Bot-Api-Secret-Token. Re-register the webhook from Telegram settings so Telegram receives the current secret.', 'kinetix-messaging-by-ppros' ),
                array( 'status' => 403 )
            );
        }

        return true;
    }

    // ── Inbound webhook ────────────────────────────────────────────────────

    public function handle_webhook( WP_REST_Request $request ) {
        $auth = $this->validate_telegram_webhook_secret( $request );
        if ( is_wp_error( $auth ) ) {
            return $auth;
        }

        $update = $request->get_json_params();
        if ( is_array( $update ) && ! empty( $update ) ) {
            $this->pending_webhook_update = $update;
            $this->register_webhook_shutdown_processing();
        }

        return rest_ensure_response( array( 'ok' => true ) );
    }

    /**
     * Flush the HTTP response before heavy webhook work so Telegram does not time out.
     */
    private function register_webhook_shutdown_processing(): void {
        if ( $this->webhook_response_flush_registered ) {
            add_action( 'shutdown', array( $this, 'process_pending_webhook_update' ), 0 );
            return;
        }

        $this->webhook_response_flush_registered = true;
        add_action( 'shutdown', array( $this, 'flush_webhook_http_response' ), -1 );
        add_action( 'shutdown', array( $this, 'process_pending_webhook_update' ), 0 );
    }

    /**
     * Send the buffered REST response to the client before DB/API work runs.
     */
    public function flush_webhook_http_response(): void {
        if ( function_exists( 'fastcgi_finish_request' ) ) {
            fastcgi_finish_request();
            return;
        }

        if ( ob_get_level() > 0 ) {
            ob_end_flush();
        }
        flush();
    }

    /**
     * Process a queued Telegram update after the HTTP response is sent.
     */
    public function process_pending_webhook_update(): void {
        if ( null === $this->pending_webhook_update ) {
            return;
        }
        $update = $this->pending_webhook_update;
        $this->pending_webhook_update = null;

        $cfg = $this->get_settings();
        if ( empty( $cfg['enabled'] ) ) {
            $this->log_debug( '[SME Telegram] Webhook update ignored because the Telegram channel is disabled.' );
            return;
        }

        $this->dispatch_update( $update, $cfg );
    }

    /**
     * Route the update to the right handler based on its type.
     */
    private function dispatch_update( array $update, array $cfg ): void {
        if ( isset( $update['message'] ) ) {
            $this->process_message_update( $update['message'], $cfg );
        } elseif ( isset( $update['callback_query'] ) ) {
            $this->process_callback_query( $update['callback_query'], $cfg );
        }
    }

    private function process_message_update( array $msg, array $cfg ): void {
        $chat      = $msg['chat'] ?? array();
        $from      = $msg['from'] ?? array();
        $chat_id   = (string) ( $chat['id'] ?? '' );
        $msg_id    = (string) ( $msg['message_id'] ?? '' );
        $text      = (string) ( $msg['text'] ?? $msg['caption'] ?? '' );

        if ( '' === $chat_id ) {
            return;
        }

        // Build contact info.
        $first_name   = (string) ( $from['first_name'] ?? '' );
        $last_name    = (string) ( $from['last_name'] ?? '' );
        $username     = (string) ( $from['username'] ?? '' );
        $contact_name = trim( $first_name . ' ' . $last_name ) ?: ( $username ?: 'Telegram User' );
        $handle       = $username ? '@' . $username : $chat_id;

        // Handle /start command.
        if ( str_starts_with( $text, '/start' ) ) {
            if ( ! empty( $cfg['startReply'] ) && ! empty( $cfg['startMsg'] ) ) {
                $this->send_message( $chat_id, (string) $cfg['startMsg'], $cfg );
            }
        }

        // Handle non-text messages (photos, documents, etc.).
        if ( '' === $text ) {
            if ( isset( $msg['photo'] ) ) {
                $text = '[Photo]';
            } elseif ( isset( $msg['document'] ) ) {
                $text = '[Document: ' . ( $msg['document']['file_name'] ?? 'file' ) . ']';
            } elseif ( isset( $msg['voice'] ) ) {
                $text = '[Voice message]';
            } elseif ( isset( $msg['video'] ) ) {
                $text = '[Video]';
            } elseif ( isset( $msg['sticker'] ) ) {
                $text = '[Sticker: ' . ( $msg['sticker']['emoji'] ?? '🎨' ) . ']';
            } else {
                $text = '[Unsupported message type]';
            }
        }

        $subject         = mb_substr( $text, 0, 80 ) ?: 'Telegram message';
        $conversation_id = $this->find_or_create_conversation( $chat_id, $contact_name, $handle, $subject );

        if ( is_wp_error( $conversation_id ) ) {
            $this->log_debug( '[SME Telegram] DB error: ' . $conversation_id->get_error_message() );
            return;
        }

        $this->store_message(
            $conversation_id,
            esc_html( $text ),
            'contact',
            $contact_name,
            array(
                'channel'   => 'telegram',
                'chatId'    => $chat_id,
                'messageId' => $msg_id,
                'chatType'  => $chat['type'] ?? 'private',
                'fromId'    => $from['id'] ?? null,
            ),
            'tg_' . $msg_id
        );

        // Auto-reply.
        $this->maybe_send_auto_reply( $chat_id, $contact_name, (string) $conversation_id );

        do_action( 'kinetix_messaging_by_ppros_inbound_message_received', $conversation_id, 'telegram', array(
            'chatId'   => $chat_id,
            'text'     => $text,
            'from'     => $from,
        ) );
    }

    private function process_callback_query( array $query, array $cfg ): void {
        $chat_id = (string) ( $query['message']['chat']['id'] ?? $query['from']['id'] ?? '' );
        if ( '' !== $chat_id ) {
            // Acknowledge the callback query (prevents the loading spinner).
            $token = (string) ( $cfg['botToken'] ?? '' );
            if ( '' !== $token ) {
                $this->http_post_json(
                    self::BOT_API . $token . '/answerCallbackQuery',
                    array( 'callback_query_id' => $query['id'] )
                );
            }
        }
    }

    // ── Outbound send ─────────────────────────────────────────────────────

    protected function send_message( string $recipient_id, string $text, array $cfg = array() ) {
        if ( empty( $cfg ) ) {
            $cfg = $this->get_settings();
        }
        $token = (string) ( $cfg['botToken'] ?? '' );
        if ( '' === $token ) {
            return new \WP_Error( 'sme_no_token', __( 'Telegram bot token is not configured.', 'kinetix-messaging-by-ppros' ) );
        }

        $payload = array(
            'chat_id' => $recipient_id,
            'text'    => $text,
        );

        if ( ! empty( $cfg['markdown'] ) ) {
            $payload['parse_mode'] = 'Markdown';
        }

        if ( ! empty( $cfg['typingIndicator'] ) ) {
            $this->http_post_json(
                self::BOT_API . $token . '/sendChatAction',
                array( 'chat_id' => $recipient_id, 'action' => 'typing' )
            );
        }

        $result = $this->http_post_json(
            self::BOT_API . $token . '/sendMessage',
            $payload
        );

        if ( is_wp_error( $result ) ) {
            return new \WP_Error(
                'sme_telegram_send_error',
                sprintf(
                    /* translators: %s: Telegram API error message */
                    __( 'Telegram API error: %s', 'kinetix-messaging-by-ppros' ),
                    $result->get_error_message()
                ),
                array( 'status' => 502 )
            );
        }

        return $result;
    }

    // ── Register webhook with Telegram ────────────────────────────────────

    public function handle_set_webhook( WP_REST_Request $request ) {
        $cfg   = $this->get_settings();
        $token = (string) ( $cfg['botToken'] ?? '' );
        if ( '' === $token ) {
            return new WP_Error(
                'sme_no_token',
                __( 'Bot token is not configured. Save the Telegram settings first.', 'kinetix-messaging-by-ppros' ),
                array( 'status' => 400 )
            );
        }

        $webhook_url = rest_url( Kinetix_Messaging_By_Ppros_Rest_Api::NAMESPACE_V1 . '/webhooks/telegram' );
        $drop_pending = rest_sanitize_boolean( $request->get_param( 'dropPendingUpdates' ) );
        $payload     = array(
            'url'                  => $webhook_url,
            'allowed_updates'      => array( 'message', 'callback_query' ),
            'drop_pending_updates' => $drop_pending,
        );

        $secret = (string) ( $cfg['webhookSecret'] ?? '' );
        if ( '' === $secret ) {
            $secret = wp_generate_password( 32, false, false );
            $this->update_channel_setting( 'webhookSecret', $secret );
        }
        $payload['secret_token'] = $secret;

        $result = $this->http_post_json(
            self::BOT_API . $token . '/setWebhook',
            $payload
        );

        if ( is_wp_error( $result ) ) {
            return new WP_Error(
                'sme_telegram_api_error',
                sprintf(
                    /* translators: %s: Telegram API error message */
                    __( 'Telegram API error: %s', 'kinetix-messaging-by-ppros' ),
                    $result->get_error_message()
                ),
                array( 'status' => 502 )
            );
        }

        if ( empty( $result['ok'] ) ) {
            return new WP_Error(
                'sme_telegram_rejected',
                sprintf(
                    /* translators: %s: Telegram webhook rejection reason */
                    __( 'Telegram rejected the webhook: %s', 'kinetix-messaging-by-ppros' ),
                    $result['description'] ?? 'Unknown error'
                ),
                array( 'status' => 502 )
            );
        }

        // Fetch the current info so the UI can confirm registration.
        $info = $this->get_webhook_info( $token );

        return rest_ensure_response( array(
            'ok'            => true,
            'webhookUrl'    => $webhook_url,
            'webhookSecret' => $secret,
            'telegram'      => $result,
            'info'          => $this->format_webhook_status( $info, $this->get_settings() ),
        ) );
    }

    // ── Webhook status info ────────────────────────────────────────────────

    public function handle_webhook_info( WP_REST_Request $request ) {
        $cfg   = $this->get_settings();
        $token = (string) ( $cfg['botToken'] ?? '' );
        if ( '' === $token ) {
            return new WP_Error( 'sme_no_token', __( 'Bot token is not configured.', 'kinetix-messaging-by-ppros' ), array( 'status' => 400 ) );
        }

        $info = $this->get_webhook_info( $token );

        if ( is_wp_error( $info ) ) {
            return new WP_Error(
                'sme_telegram_api_error',
                sprintf(
                    /* translators: %s: Telegram API error message */
                    __( 'Could not fetch webhook info: %s', 'kinetix-messaging-by-ppros' ),
                    $info->get_error_message()
                ),
                array( 'status' => 502 )
            );
        }

        return rest_ensure_response( $this->format_webhook_status( $info, $cfg ) );
    }

    /**
     * Normalize Telegram getWebhookInfo for the admin UI.
     *
     * @param array|\WP_Error $info
     * @param array           $cfg
     * @return array
     */
    private function format_webhook_status( $info, array $cfg ): array {
        $expected_url = rest_url( Kinetix_Messaging_By_Ppros_Rest_Api::NAMESPACE_V1 . '/webhooks/telegram' );
        $current_url  = is_wp_error( $info ) ? '' : (string) ( $info['result']['url'] ?? '' );

        return array(
            'ok'                 => true,
            'registered'         => $current_url !== '',
            'urlMatch'           => rtrim( $current_url, '/' ) === rtrim( $expected_url, '/' ),
            'webhookUrl'         => $current_url,
            'expectedUrl'        => $expected_url,
            'channelEnabled'     => ! empty( $cfg['enabled'] ),
            'hasWebhookSecret'   => '' !== (string) ( $cfg['webhookSecret'] ?? '' ),
            'pendingUpdateCount' => is_wp_error( $info ) ? 0 : (int) ( $info['result']['pending_update_count'] ?? 0 ),
            'lastError'          => is_wp_error( $info ) ? null : ( $info['result']['last_error_message'] ?? null ),
            'lastErrorAt'        => is_wp_error( $info ) ? null : ( $info['result']['last_error_date'] ?? null ),
            'raw'                => is_wp_error( $info ) ? array() : ( $info['result'] ?? array() ),
        );
    }

    /**
     * Call getWebhookInfo on the Telegram Bot API.
     *
     * @return array|\WP_Error
     */
    private function get_webhook_info( string $token ) {
        return $this->http( self::BOT_API . $token . '/getWebhookInfo' );
    }
}
