<?php
/**
* Plugin Name: Synchronized Messaging Engine
* Plugin URI: https://pluginpros.co
* Description: A powerful plugin that synchronizes messaging across multiple platforms, ensuring seamless communication and enhanced user engagement.
* Version: 4.7.2
* @author    PluginPros - https://pluginpros.co
* @category  WooCommerce
* Author: pluginpros
* Author URI: https://pluginpros.co
* Tested up to: 7.0
* Text Domain: synchronized-messaging-engine
* Domain Path: /lang
* License: GPL2
*/

function synchronized_messaging_engine_enqueue() {
    // Path to the generated asset file
    $asset_file = include(plugin_dir_path(__FILE__) . 'build/index.asset.php');

    wp_enqueue_style(
        'synchronized-messaging-engine-css',
        plugins_url('build/index.css', __FILE__),
        array(),
        $asset_file['version']
    );

    wp_enqueue_script(
        'synchronized-messaging-engine-js',
        plugins_url('build/index.js', __FILE__),
        $asset_file['dependencies'],
        $asset_file['version'],
        true
    );
}
add_action('admin_enqueue_scripts', 'synchronized_messaging_engine_enqueue');

add_action('admin_menu', function() {
    add_menu_page(
        'Synchronized Messaging Engine',
        'Messaging Engine',
        'manage_options',
        'synchronized-messaging-engine',
        function() {
            echo '<div id="synchronized-messaging-engine"></div>';
        },
        'dashicons-email-alt',
        6
    );
});
