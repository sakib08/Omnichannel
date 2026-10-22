<?php
/**
 * Email alerts for agents: new assignments and customers left waiting.
 *
 * Browser notifications are handled in the inbox app; this class covers agents
 * who don't have the inbox open.
 *
 * @package Kinetix_Messaging_By_Ppros
 */

defined( 'ABSPATH' ) || die( 'No script kiddies please!' );

class Kinetix_Messaging_By_Ppros_Notifications {

    const SETTINGS_KEY = 'notifications';

    const CRON_HOOK = 'kmbp_waiting_reminders';

    /** Only remind about messages newer than this, so old threads never trigger mail. */
    const WAITING_LOOKBACK = DAY_IN_SECONDS;

    /** Cap on recipients for unassigned conversations. */
    const MAX_RECIPIENTS = 20;

    public function register_hooks( Kinetix_Messaging_By_Ppros_Loader $loader ): void {
        $loader->add_action( 'kmbp_conversation_assigned', $this, 'on_assigned', 10, 3 );
        $loader->add_action( self::CRON_HOOK, $this, 'run_waiting_check' );
    }

    public static function schedule_cron(): void {
        if ( ! wp_next_scheduled( self::CRON_HOOK ) ) {
            wp_schedule_event( time(), Kinetix_Messaging_By_Ppros_Email_Pipe::CRON_SCHEDULE, self::CRON_HOOK );
        }
    }

    public static function unschedule_cron(): void {
        $timestamp = wp_next_scheduled( self::CRON_HOOK );
        if ( $timestamp ) {
            wp_unschedule_event( $timestamp, self::CRON_HOOK );
        }
    }

    public static function default_settings(): array {
        return array(
            'emailAssigned'            => true,
            'emailAssignedOfflineOnly' => true,
            'emailWaiting'             => false,
            'waitingMinutes'           => 15,
        );
    }

    public static function get_settings(): array {
        $all   = (array) get_option( Kinetix_Messaging_By_Ppros_Activator::SETTINGS_OPTION, array() );
        $saved = isset( $all[ self::SETTINGS_KEY ] ) ? (array) $all[ self::SETTINGS_KEY ] : array();
        return array_merge( self::default_settings(), $saved );
    }

    // ─── Assignment alerts ───────────────────────────────────────────────────

    /**
     * @param int $conversation_id
     * @param int $assignee_id
     * @param int $by_user_id 0 when assigned automatically (AI routing).
     */
    public function on_assigned( $conversation_id, $assignee_id, $by_user_id = 0 ): void {
        $conversation_id = (int) $conversation_id;
        $assignee_id     = (int) $assignee_id;
        $settings        = self::get_settings();

        if ( empty( $settings['emailAssigned'] ) || $assignee_id <= 0 || $assignee_id === (int) $by_user_id ) {
            return;
        }
        if ( ! empty( $settings['emailAssignedOfflineOnly'] ) && Kinetix_Messaging_By_Ppros_Availability::is_online( $assignee_id ) ) {
            return;
        }

        $conv = $this->get_conversation( $conversation_id );
        $user = get_userdata( $assignee_id );
        if ( ! $conv || ! $user || ! is_email( $user->user_email ) ) {
            return;
        }

        $by      = $by_user_id ? get_userdata( (int) $by_user_id ) : null;
        $contact = $this->contact_label( $conv );
        $channel = $this->channel_label( (string) $conv['channel'] );

        $subject = sprintf(
            /* translators: 1: site name, 2: customer name, 3: channel name */
            __( '[%1$s] Conversation assigned to you: %2$s (%3$s)', 'kinetix-messaging-by-ppros' ),
            $this->site_name(),
            $contact,
            $channel
        );

        $intro = $by
            ? sprintf(
                /* translators: 1: name of the person who assigned it, 2: customer name, 3: channel name */
                __( '%1$s assigned you a conversation with %2$s on %3$s.', 'kinetix-messaging-by-ppros' ),
                $by->display_name,
                $contact,
                $channel
            )
            : sprintf(
                /* translators: 1: customer name, 2: channel name */
                __( 'A conversation with %1$s on %2$s was routed to you.', 'kinetix-messaging-by-ppros' ),
                $contact,
                $channel
            );

        $this->send(
            array( $user->user_email ),
            $subject,
            $intro,
            $this->last_customer_message( $conversation_id ),
            $conversation_id,
            __( 'You get this email when a conversation is assigned to you.', 'kinetix-messaging-by-ppros' )
        );
    }

    // ─── Waiting reminders ───────────────────────────────────────────────────

    /**
     * Cron: email when the newest message in an open conversation is from the
     * customer and has gone unanswered for the configured number of minutes.
     */
    public function run_waiting_check(): void {
        global $wpdb;
        $settings = self::get_settings();
        if ( empty( $settings['emailWaiting'] ) ) {
            return;
        }

        $minutes = max( 5, (int) $settings['waitingMinutes'] );
        $now     = current_time( 'timestamp' ); // phpcs:ignore WordPress.DateTime.CurrentTimeTimestamp.Requested -- sent_at is stored in site time.
        $before  = gmdate( 'Y-m-d H:i:s', $now - $minutes * MINUTE_IN_SECONDS );
        $after   = gmdate( 'Y-m-d H:i:s', $now - self::WAITING_LOOKBACK );

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- KMBP custom tables; no WordPress core API exists.
        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT c.id, c.channel, c.contact_name, c.contact_handle, c.assignee_id, c.department_id,
                        m.id AS message_id, m.body, m.sent_at
                 FROM {$wpdb->prefix}kmbp_conversations c
                 JOIN {$wpdb->prefix}kmbp_messages m
                   ON m.id = ( SELECT MAX(id) FROM {$wpdb->prefix}kmbp_messages WHERE conversation_id = c.id )
                 WHERE c.status NOT IN ('resolved','closed')
                   AND c.updated_at >= %s
                   AND m.sender_type IN ('contact','customer')
                   AND m.sent_at <= %s
                   AND m.sent_at >= %s
                 LIMIT 50",
                $after,
                $before,
                $after
            ),
            ARRAY_A
        );

        foreach ( (array) $rows as $row ) {
            $conversation_id = (int) $row['id'];
            $message_id      = (int) $row['message_id'];
            $key             = 'kmbp_waiting_' . $conversation_id;
            if ( (int) get_transient( $key ) === $message_id ) {
                continue;
            }
            set_transient( $key, $message_id, 2 * DAY_IN_SECONDS );

            $emails = $this->waiting_recipients( $row );
            if ( empty( $emails ) ) {
                continue;
            }

            $contact = $this->contact_label( $row );
            $channel = $this->channel_label( (string) $row['channel'] );
            $subject = sprintf(
                /* translators: 1: site name, 2: customer name, 3: minutes, 4: channel name */
                __( '[%1$s] %2$s has been waiting over %3$d minutes (%4$s)', 'kinetix-messaging-by-ppros' ),
                $this->site_name(),
                $contact,
                $minutes,
                $channel
            );
            $intro = sprintf(
                /* translators: 1: customer name, 2: channel name, 3: minutes */
                __( '%1$s wrote on %2$s and has had no reply for over %3$d minutes.', 'kinetix-messaging-by-ppros' ),
                $contact,
                $channel,
                $minutes
            );
            $reason = empty( $row['assignee_id'] )
                ? __( 'You get this email because the conversation is unassigned and you are on the team that handles it.', 'kinetix-messaging-by-ppros' )
                : __( 'You get this email because the conversation is assigned to you.', 'kinetix-messaging-by-ppros' );

            $this->send( $emails, $subject, $intro, wp_strip_all_tags( (string) $row['body'] ), $conversation_id, $reason );
        }
    }

    /**
     * Assignee if set; otherwise the conversation's department; otherwise every agent.
     *
     * @return string[] Email addresses.
     */
    private function waiting_recipients( array $row ): array {
        $ids = array();
        if ( ! empty( $row['assignee_id'] ) ) {
            $ids = array( (int) $row['assignee_id'] );
        } elseif ( ! empty( $row['department_id'] ) ) {
            $router = new Kinetix_Messaging_By_Ppros_Ai_Router();
            $ids    = $router->find_department_agents( (int) $row['department_id'] );
        }
        if ( empty( $ids ) ) {
            $ids = get_users(
                array(
                    'role__in' => array( Kinetix_Messaging_By_Ppros_Activator::AGENT_ROLE, 'administrator' ),
                    'fields'   => 'ID',
                    'number'   => self::MAX_RECIPIENTS,
                )
            );
        }

        $emails = array();
        foreach ( array_slice( array_map( 'intval', (array) $ids ), 0, self::MAX_RECIPIENTS ) as $id ) {
            $user = get_userdata( $id );
            if ( $user && is_email( $user->user_email ) ) {
                $emails[] = $user->user_email;
            }
        }
        return array_values( array_unique( $emails ) );
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    /**
     * Send one plain-text alert. Each recipient gets their own copy so addresses aren't shared.
     *
     * @param string[] $emails
     */
    private function send( array $emails, string $subject, string $intro, string $message, int $conversation_id, string $reason ): void {
        $lines = array( $intro, '' );
        if ( '' !== trim( $message ) ) {
            $lines[] = '"' . wp_trim_words( $message, 60, '…' ) . '"';
            $lines[] = '';
        }
        $lines[] = __( 'Open the conversation:', 'kinetix-messaging-by-ppros' );
        $lines[] = self::conversation_url( $conversation_id );
        $lines[] = '';
        $lines[] = '—';
        $lines[] = $reason;
        $lines[] = __( 'Change email alerts in Kinetix Messaging → Settings → Notifications.', 'kinetix-messaging-by-ppros' );

        $body = implode( "\n", $lines );
        foreach ( $emails as $email ) {
            wp_mail( $email, $subject, $body );
        }
    }

    public static function conversation_url( int $conversation_id ): string {
        return add_query_arg(
            array(
                'page'         => Kinetix_Messaging_By_Ppros_Admin::MENU_SLUG,
                'conversation' => $conversation_id,
            ),
            admin_url( 'admin.php' )
        );
    }

    private function get_conversation( int $id ) {
        global $wpdb;
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- KMBP custom table; no WordPress core API exists.
        return $wpdb->get_row(
            $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}kmbp_conversations WHERE id = %d", $id ),
            ARRAY_A
        );
    }

    private function last_customer_message( int $conversation_id ): string {
        global $wpdb;
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- KMBP custom table; no WordPress core API exists.
        $body = $wpdb->get_var(
            $wpdb->prepare(
                "SELECT body FROM {$wpdb->prefix}kmbp_messages
                 WHERE conversation_id = %d AND sender_type IN ('contact','customer')
                 ORDER BY id DESC LIMIT 1",
                $conversation_id
            )
        );
        return wp_strip_all_tags( (string) $body );
    }

    private function contact_label( array $conv ): string {
        foreach ( array( 'contact_name', 'contact_handle' ) as $key ) {
            if ( ! empty( $conv[ $key ] ) ) {
                return (string) $conv[ $key ];
            }
        }
        return __( 'A customer', 'kinetix-messaging-by-ppros' );
    }

    private function channel_label( string $channel ): string {
        $labels = array(
            'whatsapp'  => 'WhatsApp',
            'messenger' => 'Messenger',
            'instagram' => 'Instagram',
            'telegram'  => 'Telegram',
            'line'      => 'LINE',
            'viber'     => 'Viber',
            'wechat'    => 'WeChat',
            'sms'       => 'SMS',
            'email'     => __( 'email', 'kinetix-messaging-by-ppros' ),
            'livechat'  => __( 'Live Chat', 'kinetix-messaging-by-ppros' ),
        );
        return $labels[ $channel ] ?? ucfirst( $channel );
    }

    private function site_name(): string {
        return wp_specialchars_decode( (string) get_bloginfo( 'name' ), ENT_QUOTES );
    }
}
