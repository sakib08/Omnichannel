<?php
/**
 * Agent presence (online / away / offline) and business hours.
 *
 * @package Kinetix_Messaging_By_Ppros
 */

defined( 'ABSPATH' ) || die( 'No script kiddies please!' );

class Kinetix_Messaging_By_Ppros_Availability {

    const SETTINGS_KEY = 'availability';

    const META_STATUS = 'kmbp_presence_status';
    const META_SEEN   = 'kmbp_last_seen';

    /** Seconds since the last heartbeat before an agent counts as offline. */
    const ONLINE_WINDOW = 180;

    /** Minimum seconds between last-seen writes for the same user. */
    const TOUCH_THROTTLE = 30;

    /** Seconds before the offline notice may be sent again in one conversation. */
    const NOTICE_COOLDOWN = 12 * HOUR_IN_SECONDS;

    const DAYS = array( 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun' );

    /**
     * Register WordPress hooks.
     */
    public function register_hooks( Kinetix_Messaging_By_Ppros_Loader $loader ): void {
        $loader->add_filter( 'heartbeat_send', $this, 'on_heartbeat_send', 10, 2 );
        $loader->add_action( 'wp_logout', $this, 'on_logout', 10, 1 );
    }

    /**
     * Keep agents online while any wp-admin screen is open.
     *
     * @param array  $response
     * @param string $screen_id
     * @return array
     */
    public function on_heartbeat_send( $response, $screen_id = '' ) {
        unset( $screen_id );
        $user_id = get_current_user_id();
        if ( $user_id > 0 && self::user_can_take_chats( $user_id ) ) {
            self::touch( $user_id );
        }
        return $response;
    }

    /**
     * @param int $user_id
     */
    public function on_logout( $user_id = 0 ): void {
        self::mark_offline( (int) $user_id );
    }

    // ─── Settings ────────────────────────────────────────────────────────────

    public static function default_settings(): array {
        $out = array(
            'hoursEnabled'       => false,
            'requireOnlineAgent' => true,
            'offlineMsgEnabled'  => false,
            'offlineMsg'         => __( "Thanks for your message! Our team is away right now. Our hours are {{hours}}. We'll reply as soon as we're back.", 'kinetix-messaging-by-ppros' ),
        );
        foreach ( self::DAYS as $day ) {
            $weekday                 = ! in_array( $day, array( 'sat', 'sun' ), true );
            $out[ $day . 'Open' ]  = $weekday;
            $out[ $day . 'Start' ] = '09:00';
            $out[ $day . 'End' ]   = '17:00';
        }
        return $out;
    }

    public static function get_settings(): array {
        $all   = (array) get_option( Kinetix_Messaging_By_Ppros_Activator::SETTINGS_OPTION, array() );
        $saved = isset( $all[ self::SETTINGS_KEY ] ) ? (array) $all[ self::SETTINGS_KEY ] : array();
        return array_merge( self::default_settings(), $saved );
    }

    // ─── Presence ────────────────────────────────────────────────────────────

    public static function user_can_take_chats( int $user_id ): bool {
        return user_can( $user_id, Kinetix_Messaging_By_Ppros_Activator::CAP_ACCESS_MESSAGING )
            || user_can( $user_id, 'manage_options' );
    }

    /**
     * Record that the user is active. Throttled to avoid a DB write on every request.
     */
    public static function touch( int $user_id ): void {
        if ( $user_id <= 0 ) {
            return;
        }
        $last = (int) get_user_meta( $user_id, self::META_SEEN, true );
        if ( time() - $last >= self::TOUCH_THROTTLE ) {
            update_user_meta( $user_id, self::META_SEEN, time() );
        }
    }

    public static function mark_offline( int $user_id ): void {
        if ( $user_id > 0 ) {
            delete_user_meta( $user_id, self::META_SEEN );
        }
    }

    /**
     * The status the agent chose: 'online' or 'away'.
     */
    public static function get_status( int $user_id ): string {
        return 'away' === get_user_meta( $user_id, self::META_STATUS, true ) ? 'away' : 'online';
    }

    public static function set_status( int $user_id, string $status ): void {
        if ( $user_id <= 0 || ! in_array( $status, array( 'online', 'away' ), true ) ) {
            return;
        }
        update_user_meta( $user_id, self::META_STATUS, $status );
    }

    /**
     * Effective presence: 'online', 'away', or 'offline' (no recent heartbeat).
     */
    public static function presence( int $user_id ): string {
        $seen = (int) get_user_meta( $user_id, self::META_SEEN, true );
        if ( time() - $seen > self::ONLINE_WINDOW ) {
            return 'offline';
        }
        return self::get_status( $user_id );
    }

    public static function is_online( int $user_id ): bool {
        return 'online' === self::presence( $user_id );
    }

    /**
     * @param int[] $user_ids
     * @return int[]
     */
    public static function filter_online( array $user_ids ): array {
        return array_values( array_filter( array_map( 'intval', $user_ids ), array( __CLASS__, 'is_online' ) ) );
    }

    /**
     * Agents and administrators who are online right now.
     *
     * @return int[]
     */
    public static function online_agent_ids(): array {
        $ids = get_users(
            array(
                'role__in'   => array( Kinetix_Messaging_By_Ppros_Activator::AGENT_ROLE, 'administrator' ),
                'fields'     => 'ID',
                'number'     => 200,
                // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query -- Small user set; filters to recently active agents.
                'meta_query' => array(
                    array(
                        'key'     => self::META_SEEN,
                        'value'   => time() - self::ONLINE_WINDOW,
                        'compare' => '>=',
                        'type'    => 'NUMERIC',
                    ),
                ),
            )
        );
        return self::filter_online( (array) $ids );
    }

    public static function has_online_agents(): bool {
        return ! empty( self::online_agent_ids() );
    }

    // ─── Business hours ──────────────────────────────────────────────────────

    /**
     * Whether the current time is inside business hours. Always true when hours are off.
     */
    public static function is_open_now(): bool {
        $settings = self::get_settings();
        if ( empty( $settings['hoursEnabled'] ) ) {
            return true;
        }

        $now    = new DateTimeImmutable( 'now', wp_timezone() );
        $minute = (int) $now->format( 'G' ) * 60 + (int) $now->format( 'i' );

        $today = self::window( $settings, strtolower( $now->format( 'D' ) ) );
        if ( $today ) {
            list( $start, $end ) = $today;
            if ( $start === $end ) {
                return true;
            }
            if ( $start < $end && $minute >= $start && $minute < $end ) {
                return true;
            }
            if ( $start > $end && $minute >= $start ) {
                return true;
            }
        }

        // An overnight window that started yesterday (e.g. 22:00–06:00).
        $yesterday = self::window( $settings, strtolower( $now->modify( '-1 day' )->format( 'D' ) ) );
        if ( $yesterday && $yesterday[0] > $yesterday[1] && $minute < $yesterday[1] ) {
            return true;
        }

        return false;
    }

    /**
     * Offline means outside business hours, or (optionally) nobody online.
     */
    public static function is_offline(): bool {
        if ( ! self::is_open_now() ) {
            return true;
        }
        $settings = self::get_settings();
        return ! empty( $settings['requireOnlineAgent'] ) && ! self::has_online_agents();
    }

    /**
     * Human-readable schedule, e.g. "Mon–Fri 09:00–17:00 (Asia/Dhaka)".
     */
    public static function hours_summary(): string {
        $settings = self::get_settings();

        $groups = array();
        foreach ( self::DAYS as $day ) {
            $window = self::window( $settings, $day );
            $label  = $window ? self::format_window( $settings, $day ) : '';
            $last   = count( $groups ) - 1;
            if ( $last >= 0 && $groups[ $last ]['label'] === $label ) {
                $groups[ $last ]['to'] = $day;
            } else {
                $groups[] = array(
                    'from'  => $day,
                    'to'    => $day,
                    'label' => $label,
                );
            }
        }

        $parts = array();
        foreach ( $groups as $group ) {
            if ( '' === $group['label'] ) {
                continue;
            }
            $days    = self::day_abbrev( $group['from'] );
            $days   .= $group['from'] !== $group['to'] ? '–' . self::day_abbrev( $group['to'] ) : '';
            $parts[] = $days . ' ' . $group['label'];
        }

        if ( empty( $parts ) ) {
            return '';
        }
        return implode( ', ', $parts ) . ' (' . wp_timezone_string() . ')';
    }

    /**
     * When business hours next start, e.g. "tomorrow at 9:00 am". Empty when open or unknown.
     */
    public static function next_open(): string {
        $settings = self::get_settings();
        if ( empty( $settings['hoursEnabled'] ) || self::is_open_now() ) {
            return '';
        }

        $tz  = wp_timezone();
        $now = new DateTimeImmutable( 'now', $tz );
        for ( $i = 0; $i <= 7; $i++ ) {
            $day    = $now->modify( "+{$i} day" );
            $window = self::window( $settings, strtolower( $day->format( 'D' ) ) );
            if ( ! $window ) {
                continue;
            }
            $start = $day->setTime( intdiv( $window[0], 60 ), $window[0] % 60 );
            if ( $start <= $now ) {
                continue;
            }
            $time = wp_date( get_option( 'time_format' ), $start->getTimestamp() );
            if ( 0 === $i ) {
                /* translators: %s: opening time */
                return sprintf( __( 'today at %s', 'kinetix-messaging-by-ppros' ), $time );
            }
            if ( 1 === $i ) {
                /* translators: %s: opening time */
                return sprintf( __( 'tomorrow at %s', 'kinetix-messaging-by-ppros' ), $time );
            }
            /* translators: 1: weekday name, 2: opening time */
            return sprintf( __( '%1$s at %2$s', 'kinetix-messaging-by-ppros' ), wp_date( 'l', $start->getTimestamp() ), $time );
        }
        return '';
    }

    // ─── Offline notice ──────────────────────────────────────────────────────

    public static function offline_notice_enabled(): bool {
        $settings = self::get_settings();
        return ! empty( $settings['offlineMsgEnabled'] ) && '' !== trim( (string) $settings['offlineMsg'] );
    }

    public static function should_send_offline_notice( int $conversation_id ): bool {
        return $conversation_id > 0
            && self::offline_notice_enabled()
            && ! get_transient( self::notice_key( $conversation_id ) )
            && self::is_offline();
    }

    public static function mark_offline_notice_sent( int $conversation_id ): void {
        set_transient( self::notice_key( $conversation_id ), 1, self::NOTICE_COOLDOWN );
    }

    /**
     * Fill {{hours}}, {{next_open}} and {{customer_name}} in a message template.
     */
    public static function render( string $template, string $customer_name = '' ): string {
        $hours = self::hours_summary();
        $next  = self::next_open();
        return str_replace(
            array( '{{hours}}', '{{next_open}}', '{{customer_name}}' ),
            array(
                '' !== $hours ? $hours : __( 'posted on our website', 'kinetix-messaging-by-ppros' ),
                '' !== $next ? $next : __( 'soon', 'kinetix-messaging-by-ppros' ),
                $customer_name,
            ),
            $template
        );
    }

    public static function offline_notice_text( string $customer_name = '' ): string {
        $settings = self::get_settings();
        return self::render( (string) $settings['offlineMsg'], $customer_name );
    }

    /**
     * Snapshot for the inbox: my status, every agent's presence, and whether we're open.
     */
    public static function snapshot( int $user_id ): array {
        $ids = get_users(
            array(
                'role__in' => array( Kinetix_Messaging_By_Ppros_Activator::AGENT_ROLE, 'administrator' ),
                'fields'   => 'ID',
                'number'   => 200,
            )
        );

        $agents = array();
        foreach ( (array) $ids as $id ) {
            $agents[] = array(
                'id'       => (int) $id,
                'presence' => self::presence( (int) $id ),
            );
        }

        $settings = self::get_settings();
        return array(
            'me'     => array(
                'id'       => $user_id,
                'status'   => self::get_status( $user_id ),
                'presence' => self::presence( $user_id ),
            ),
            'agents' => $agents,
            'hours'  => array(
                'enabled'  => ! empty( $settings['hoursEnabled'] ),
                'open'     => self::is_open_now(),
                'offline'  => self::is_offline(),
                'summary'  => self::hours_summary(),
                'nextOpen' => self::next_open(),
                'timezone' => wp_timezone_string(),
            ),
        );
    }

    // ─── Internals ───────────────────────────────────────────────────────────

    /**
     * @return array{0:int,1:int}|null Start and end minute of the day, or null when closed.
     */
    private static function window( array $settings, string $day ) {
        if ( empty( $settings[ $day . 'Open' ] ) ) {
            return null;
        }
        $start = self::to_minutes( (string) ( $settings[ $day . 'Start' ] ?? '' ) );
        $end   = self::to_minutes( (string) ( $settings[ $day . 'End' ] ?? '' ) );
        if ( null === $start || null === $end ) {
            return null;
        }
        return array( $start, $end );
    }

    private static function to_minutes( string $hhmm ) {
        if ( ! preg_match( '/^([01]?\d|2[0-3]):([0-5]\d)$/', trim( $hhmm ), $m ) ) {
            return null;
        }
        return (int) $m[1] * 60 + (int) $m[2];
    }

    private static function format_window( array $settings, string $day ): string {
        $start = (string) $settings[ $day . 'Start' ];
        $end   = (string) $settings[ $day . 'End' ];
        if ( $start === $end ) {
            return __( '24 hours', 'kinetix-messaging-by-ppros' );
        }
        return $start . '–' . $end;
    }

    private static function day_abbrev( string $day ): string {
        global $wp_locale;
        $index = array_search( $day, self::DAYS, true );
        if ( false === $index || ! $wp_locale ) {
            return ucfirst( $day );
        }
        // WP_Locale weekdays start at Sunday (0).
        return $wp_locale->get_weekday_abbrev( $wp_locale->get_weekday( ( $index + 1 ) % 7 ) );
    }

    private static function notice_key( int $conversation_id ): string {
        return 'kmbp_offline_notice_' . $conversation_id;
    }
}
