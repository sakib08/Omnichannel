<?php
/**
 * Plugin Name: Synchronized Messaging Engine
 * Plugin URI: https://pluginpros.co
 * Description: A powerful plugin that synchronizes messaging across multiple platforms, ensuring seamless communication and enhanced user engagement.
 * Version: 0.0.1
 * @author    PluginPros - https://pluginpros.co
 * @category  WooCommerce
 * Author: pluginpros
 * Author URI: https://pluginpros.co
 * Tested up to: 7.0
 * Text Domain: synchronized-messaging-engine
 * Domain Path: /lang
 * License: GPL2
 */

defined( 'ABSPATH' ) || die( 'No script kiddies please!' );

define( 'PLUGIN_PROS_SYNCHRONIZED_MESSAGING_ENGINE_VERSION', '0.0.1' );
define( 'PLUGIN_PROS_SYNCHRONIZED_MESSAGING_ENGINE_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'PLUGIN_PROS_SYNCHRONIZED_MESSAGING_ENGINE_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'PLUGIN_PROS_SYNCHRONIZED_MESSAGING_ENGINE_PLUGIN_FILE', __FILE__ );
define( 'PLUGIN_PROS_SYNCHRONIZED_MESSAGING_ENGINE_PLUGIN_BASENAME', plugin_basename( __FILE__ ) );

require_once PLUGIN_PROS_SYNCHRONIZED_MESSAGING_ENGINE_PLUGIN_DIR . 'includes/class-synchronized-messaging-engine-loader.php';
require_once PLUGIN_PROS_SYNCHRONIZED_MESSAGING_ENGINE_PLUGIN_DIR . 'includes/class-synchronized-messaging-engine-i18n.php';
require_once PLUGIN_PROS_SYNCHRONIZED_MESSAGING_ENGINE_PLUGIN_DIR . 'includes/class-synchronized-messaging-engine-activator.php';
require_once PLUGIN_PROS_SYNCHRONIZED_MESSAGING_ENGINE_PLUGIN_DIR . 'includes/class-synchronized-messaging-engine-admin.php';
require_once PLUGIN_PROS_SYNCHRONIZED_MESSAGING_ENGINE_PLUGIN_DIR . 'includes/class-synchronized-messaging-engine-public.php';
require_once PLUGIN_PROS_SYNCHRONIZED_MESSAGING_ENGINE_PLUGIN_DIR . 'includes/class-synchronized-messaging-engine-rest-api.php';
require_once PLUGIN_PROS_SYNCHRONIZED_MESSAGING_ENGINE_PLUGIN_DIR . 'includes/class-synchronized-messaging-engine-email-pipe.php';
require_once PLUGIN_PROS_SYNCHRONIZED_MESSAGING_ENGINE_PLUGIN_DIR . 'includes/class-synchronized-messaging-engine.php';

register_activation_hook( __FILE__, array( 'Synchronized_Messaging_Engine_Activator', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'Synchronized_Messaging_Engine_Activator', 'deactivate' ) );

function run_synchronized_messaging_engine() {
    $plugin = new Synchronized_Messaging_Engine();
    $plugin->run();
}
run_synchronized_messaging_engine();
