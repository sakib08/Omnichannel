<?php
/**
 * Fired during plugin activation / deactivation.
 *
 * Responsibilities
 *  - Create custom database tables for conversations, messages, departments
 *    and the agent ↔ department mapping.
 *  - Register the custom "kmbp_agent" role and the capabilities used by the
 *    plugin (kmbp_access_messaging, kmbp_manage_settings, kmbp_manage_departments).
 *  - Seed default platform settings in wp_options so the React app has
 *    something to read on first load.
 *
 * @package Kinetix_Messaging_By_Ppros
 */

defined( 'ABSPATH' ) || die( 'No script kiddies please!' );

class Kinetix_Messaging_By_Ppros_Activator {

    const DB_VERSION_OPTION    = 'kmbp_db_version';
    const DB_VERSION           = '1.0.0';
    const SETTINGS_OPTION      = 'kmbp_platform_settings';
    const AGENT_ROLE           = 'kmbp_agent';
    const CAP_ACCESS_MESSAGING = 'kmbp_access_messaging';
    const CAP_MANAGE_SETTINGS  = 'kmbp_manage_settings';
    const CAP_MANAGE_DEPTS     = 'kmbp_manage_departments';

    public static function activate() {
        self::maybe_upgrade();
    }

    /**
     * Ensure DB tables, legacy migration, roles, and cron exist.
     * Runs on activation and on every load until kmbp tables are present.
     */
    public static function maybe_upgrade() {
        global $wpdb;

        $kmbp_conversations = $wpdb->prefix . 'kmbp_conversations';
        $sme_conversations  = $wpdb->prefix . 'sme_conversations';

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        $kmbp_ready = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $kmbp_conversations ) ) === $kmbp_conversations;
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        $legacy_left = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $sme_conversations ) ) === $sme_conversations;

        if ( $legacy_left ) {
            self::migrate_legacy_prefix();
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $kmbp_ready = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $kmbp_conversations ) ) === $kmbp_conversations;
        }

        if ( ! $kmbp_ready ) {
            self::create_tables();
            self::seed_default_settings();
            self::seed_default_departments();
        }

        self::register_roles_and_caps();
        self::migrate_settings_keys();
        Kinetix_Messaging_By_Ppros_Email_Pipe::schedule_cron();
    }

    /**
     * One-time migration from the legacy "sme" prefix to "kmbp".
     */
    private static function migrate_legacy_prefix() {
        global $wpdb;

        $tables = array( 'departments', 'conversations', 'messages', 'agent_departments' );
        foreach ( $tables as $table ) {
            $old = $wpdb->prefix . 'sme_' . $table;
            $new = $wpdb->prefix . 'kmbp_' . $table;
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            if ( $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $old ) ) === $old
                && $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $new ) ) !== $new ) {
                // phpcs:ignore WordPress.DB.DirectDatabaseQuery.SchemaChange
                $wpdb->query( "RENAME TABLE `{$old}` TO `{$new}`" );
            }
        }

        $options = array(
            'sme_db_version'        => self::DB_VERSION_OPTION,
            'sme_platform_settings' => self::SETTINGS_OPTION,
        );
        foreach ( $options as $old_key => $new_key ) {
            $value = get_option( $old_key, null );
            if ( null !== $value && null === get_option( $new_key, null ) ) {
                update_option( $new_key, $value, false );
                delete_option( $old_key );
            }
        }

        $timestamp = wp_next_scheduled( 'sme_imap_poll' );
        if ( $timestamp ) {
            wp_unschedule_event( $timestamp, 'sme_imap_poll' );
        }

        $cap_map = array(
            'sme_access_messaging'   => self::CAP_ACCESS_MESSAGING,
            'sme_manage_settings'    => self::CAP_MANAGE_SETTINGS,
            'sme_manage_departments' => self::CAP_MANAGE_DEPTS,
        );
        foreach ( get_editable_roles() as $role_name => $role_info ) {
            $role = get_role( $role_name );
            if ( ! $role ) {
                continue;
            }
            foreach ( $cap_map as $old_cap => $new_cap ) {
                if ( $role->has_cap( $old_cap ) ) {
                    $role->add_cap( $new_cap );
                    $role->remove_cap( $old_cap );
                }
            }
        }

        $old_role = get_role( 'sme_agent' );
        if ( $old_role && ! get_role( self::AGENT_ROLE ) ) {
            add_role( self::AGENT_ROLE, __( 'Messaging Agent', 'kinetix-messaging-by-ppros' ), $old_role->capabilities );
            $users = get_users( array( 'role' => 'sme_agent' ) );
            foreach ( $users as $user ) {
                $user->add_role( self::AGENT_ROLE );
                $user->remove_role( 'sme_agent' );
            }
            remove_role( 'sme_agent' );
        }
    }

    public static function deactivate() {
        // Unschedule the IMAP poll cron on deactivation.
        Kinetix_Messaging_By_Ppros_Email_Pipe::unschedule_cron();
        // Roles/caps and data are intentionally left in place on deactivation
        // so the admin doesn't lose history.  Removed only on uninstall.
    }

    /**
     * Create custom tables using dbDelta.
     */
    private static function create_tables() {
        global $wpdb;

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';

        $charset_collate = $wpdb->get_charset_collate();
        $prefix          = $wpdb->prefix;

        $departments_sql = "CREATE TABLE {$prefix}kmbp_departments (
            id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            name VARCHAR(191) NOT NULL,
            slug VARCHAR(191) NOT NULL,
            description TEXT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY  (id),
            UNIQUE KEY slug (slug)
        ) {$charset_collate};";

        $conversations_sql = "CREATE TABLE {$prefix}kmbp_conversations (
            id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            channel VARCHAR(40) NOT NULL,
            external_id VARCHAR(191) NULL,
            contact_name VARCHAR(191) NULL,
            contact_handle VARCHAR(191) NULL,
            subject VARCHAR(255) NULL,
            preview TEXT NULL,
            status VARCHAR(40) NOT NULL DEFAULT 'open',
            priority VARCHAR(20) NOT NULL DEFAULT 'medium',
            assignee_id BIGINT(20) UNSIGNED NULL,
            department_id BIGINT(20) UNSIGNED NULL,
            unread_count INT(11) NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY  (id),
            KEY channel (channel),
            KEY status (status),
            KEY assignee_id (assignee_id),
            KEY department_id (department_id)
        ) {$charset_collate};";

        $messages_sql = "CREATE TABLE {$prefix}kmbp_messages (
            id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            conversation_id BIGINT(20) UNSIGNED NOT NULL,
            external_id VARCHAR(191) NULL,
            sender_type VARCHAR(20) NOT NULL DEFAULT 'customer',
            sender_id BIGINT(20) UNSIGNED NULL,
            sender_name VARCHAR(191) NULL,
            body LONGTEXT NOT NULL,
            meta LONGTEXT NULL,
            sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY  (id),
            KEY conversation_id (conversation_id),
            KEY sent_at (sent_at)
        ) {$charset_collate};";

        $agent_dept_sql = "CREATE TABLE {$prefix}kmbp_agent_departments (
            id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id BIGINT(20) UNSIGNED NOT NULL,
            department_id BIGINT(20) UNSIGNED NOT NULL,
            assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY  (id),
            UNIQUE KEY agent_dept (user_id, department_id),
            KEY user_id (user_id),
            KEY department_id (department_id)
        ) {$charset_collate};";

        dbDelta( $departments_sql );
        dbDelta( $conversations_sql );
        dbDelta( $messages_sql );
        dbDelta( $agent_dept_sql );

        update_option( self::DB_VERSION_OPTION, self::DB_VERSION );
    }

    /**
     * Register the custom messaging agent role and the capabilities that
     * gate access to the plugin's admin screens.
     */
    private static function register_roles_and_caps() {
        // Add custom role for agents.  Limited to "read" + plugin messaging cap.
        $existing = get_role( self::AGENT_ROLE );
        if ( null === $existing ) {
            add_role(
                self::AGENT_ROLE,
                __( 'Messaging Agent', 'kinetix-messaging-by-ppros' ),
                array(
                    'read'                       => true,
                    self::CAP_ACCESS_MESSAGING   => true,
                )
            );
        } else {
            $existing->add_cap( self::CAP_ACCESS_MESSAGING );
        }

        // Grant administrators every capability the plugin uses.
        $admin = get_role( 'administrator' );
        if ( $admin ) {
            $admin->add_cap( self::CAP_ACCESS_MESSAGING );
            $admin->add_cap( self::CAP_MANAGE_SETTINGS );
            $admin->add_cap( self::CAP_MANAGE_DEPTS );
        }

        // Shop managers (WooCommerce) often need messaging access too.
        $shop_manager = get_role( 'shop_manager' );
        if ( $shop_manager ) {
            $shop_manager->add_cap( self::CAP_ACCESS_MESSAGING );
        }
    }

    /**
     * One-time migration: if the stored settings contain all-lowercase keys
     * (written by the buggy first version of sanitize_channel_payload that
     * called sanitize_key() on camelCase names), wipe the option so it is
     * re-seeded with correct keys on the next page load.
     *
     * Detects corruption by checking whether the "messenger" channel still has
     * the camelCase "pageToken" key vs the lowercase "pagetoken" artifact.
     */
    public static function migrate_settings_keys() {
        $stored = get_option( self::SETTINGS_OPTION, null );
        if ( null === $stored || ! is_array( $stored ) ) {
            return;
        }
        // If messenger data exists and "pagetoken" is present (lowercase) but
        // "pageToken" is absent, the option was written with the old bug.
        $messenger = isset( $stored['messenger'] ) ? (array) $stored['messenger'] : array();
        $has_bad   = array_key_exists( 'pagetoken', $messenger );
        $has_good  = array_key_exists( 'pageToken', $messenger );
        if ( $has_bad && ! $has_good ) {
            delete_option( self::SETTINGS_OPTION );
        }
    }

    /**
     * Seed wp_options with a sane default for every channel so the React
     * settings UI has something to render on first load.
     */
    private static function seed_default_settings() {
        if ( get_option( self::SETTINGS_OPTION, null ) !== null ) {
            return;
        }

        $defaults = array(
            'messenger' => array(
                'enabled'        => false,
                'pageId'         => '',
                'pageName'       => '',
                'pageToken'      => '',
                'appId'          => '',
                'appSecret'      => '',
                'verifyToken'    => '',
            ),
            'email' => array(
                'enabled'      => false,
                'inboxName'    => '',
                'inboxEmail'   => '',
                'senderName'   => '',
                'webhookToken' => '',
                'smtpHost'     => '',
                'smtpPort'   => '587',
                'smtpUser'   => '',
                'smtpPass'   => '',
                'imapHost'   => '',
                'imapPort'   => '993',
                'imapUser'   => '',
                'imapPass'   => '',
            ),
            'whatsapp' => array(
                'enabled'       => false,
                'wabaid'        => '',
                'phoneNumberId' => '',
                'accessToken'   => '',
                'appSecret'     => '',
                'verifyToken'   => '',
                'displayPhone'  => '',
            ),
            'telegram' => array(
                'enabled'       => false,
                'botToken'      => '',
                'botUsername'   => '',
                'botName'       => '',
                'webhookSecret' => '',
            ),
            'sms' => array(
                'enabled'      => false,
                'provider'     => 'twilio',
                'accountSid'   => '',
                'authToken'    => '',
                'webhookToken' => '',
                'fromNumber' => '',
            ),
            'line' => array(
                'enabled'       => false,
                'channelId'     => '',
                'basicId'       => '',
                'channelSecret' => '',
                'accessToken'   => '',
            ),
            'viber' => array(
                'enabled'   => false,
                'senderId'  => '',
                'authToken' => '',
                'botName'   => '',
            ),
            'wechat' => array(
                'enabled'        => false,
                'appId'          => '',
                'appSecret'      => '',
                'serverToken'    => '',
                'encodingAesKey' => '',
            ),
        );

        add_option( self::SETTINGS_OPTION, $defaults, '', false );
    }

    /**
     * Seed a couple of starter departments so the agents can be assigned
     * to something immediately after install.
     */
    private static function seed_default_departments() {
        global $wpdb;
        // phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- KMBP custom tables; no WordPress core API exists.
        $existing = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->prefix}kmbp_departments" );
        if ( $existing > 0 ) {
            return;
        }

        $seed = array(
            array( 'name' => 'Support',  'slug' => 'support',  'description' => 'General customer support' ),
            array( 'name' => 'Sales',    'slug' => 'sales',    'description' => 'Pre-sales and billing inquiries' ),
            array( 'name' => 'Billing',  'slug' => 'billing',  'description' => 'Invoices, refunds and account billing' ),
        );

        foreach ( $seed as $row ) {
            $wpdb->insert( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                $wpdb->prefix . 'kmbp_departments',
                array(
                    'name'        => $row['name'],
                    'slug'        => $row['slug'],
                    'description' => $row['description'],
                    'created_at'  => current_time( 'mysql' ),
                ),
                array( '%s', '%s', '%s', '%s' )
            );
        }
        // phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
    }
}
