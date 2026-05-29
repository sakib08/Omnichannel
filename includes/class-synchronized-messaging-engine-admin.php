<?php
/**
 * Admin-area registration: menu, assets and capability gating.
 *
 * @package Synchronized_Messaging_Engine
 */

defined( 'ABSPATH' ) || die( 'No script kiddies please!' );

class Synchronized_Messaging_Engine_Admin {

    const MENU_SLUG = 'synchronized-messaging-engine';

    public function register_menu() {
        $cap = current_user_can( 'manage_options' )
            ? 'manage_options'
            : Synchronized_Messaging_Engine_Activator::CAP_ACCESS_MESSAGING;

        add_menu_page(
            __( 'Synchronized Messaging Engine', 'synchronized-messaging-engine' ),
            __( 'Messaging Engine', 'synchronized-messaging-engine' ),
            $cap,
            self::MENU_SLUG,
            array( $this, 'render_app_container' ),
            'dashicons-email-alt',
            6
        );
    }

    public function render_app_container() {
        if ( ! current_user_can( Synchronized_Messaging_Engine_Activator::CAP_ACCESS_MESSAGING )
            && ! current_user_can( 'manage_options' ) ) {
            wp_die( esc_html__( 'You do not have permission to access this page.', 'synchronized-messaging-engine' ) );
        }

        echo '<div id="synchronized-messaging-engine"></div>';
    }

    public function enqueue_assets( $hook_suffix ) {
        // Only load on our own admin page to avoid polluting every screen.
        if ( false === strpos( (string) $hook_suffix, self::MENU_SLUG ) ) {
            return;
        }

        $asset_file_path = PLUGIN_PROS_SYNCHRONIZED_MESSAGING_ENGINE_PLUGIN_DIR . 'build/index.asset.php';
        if ( ! file_exists( $asset_file_path ) ) {
            return;
        }
        $asset_file = include $asset_file_path;

        wp_enqueue_style(
            'synchronized-messaging-engine-css',
            PLUGIN_PROS_SYNCHRONIZED_MESSAGING_ENGINE_PLUGIN_URL . 'build/index.css',
            array(),
            $asset_file['version']
        );

        wp_enqueue_script(
            'synchronized-messaging-engine-js',
            PLUGIN_PROS_SYNCHRONIZED_MESSAGING_ENGINE_PLUGIN_URL . 'build/index.js',
            $asset_file['dependencies'],
            $asset_file['version'],
            true
        );

        $user                = wp_get_current_user();
        $is_admin            = current_user_can( 'manage_options' );
        $can_access          = current_user_can( Synchronized_Messaging_Engine_Activator::CAP_ACCESS_MESSAGING );
        $can_manage_settings = current_user_can( Synchronized_Messaging_Engine_Activator::CAP_MANAGE_SETTINGS );
        $can_manage_depts    = current_user_can( Synchronized_Messaging_Engine_Activator::CAP_MANAGE_DEPTS );

        wp_localize_script(
            'synchronized-messaging-engine-js',
            'SMEBoot',
            array(
                'restUrl' => esc_url_raw( rest_url( 'sme/v1/' ) ),
                'nonce'   => wp_create_nonce( 'wp_rest' ),
                'user'    => array(
                    'id'    => (int) $user->ID,
                    'name'  => $user->display_name,
                    'email' => $user->user_email,
                    'roles' => (array) $user->roles,
                ),
                'caps'    => array(
                    'isAdmin'            => $is_admin,
                    'canAccessMessaging' => $can_access,
                    'canManageSettings'  => $can_manage_settings,
                    'canManageDepts'     => $can_manage_depts,
                ),
            )
        );
    }
}
