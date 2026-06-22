<?php
/**
 * Plugin Name: Kinetix Messaging by Ppros
 * Description: A powerful plugin that synchronizes messaging across multiple platforms, ensuring seamless communication and enhanced user engagement.
 * Version: 1.0.2
 * @author    Plugin Pros - https://pluginpros.co
 * Author: sakibbd08
 * Author URI: https://profiles.wordpress.org/sakibbd08/
 * Tested up to: 7.0
 * Text Domain: kinetix-messaging-by-ppros
 * Domain Path: /languages
 * License: GPLv2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 */

defined( 'ABSPATH' ) || die( 'No script kiddies please!' );

define( 'KINETIX_MESSAGING_BY_PPROS_VERSION', '1.0.2' );
define( 'KINETIX_MESSAGING_BY_PPROS_DIR', plugin_dir_path( __FILE__ ) );
define( 'KINETIX_MESSAGING_BY_PPROS_URL', plugin_dir_url( __FILE__ ) );
define( 'KINETIX_MESSAGING_BY_PPROS_FILE', __FILE__ );
define( 'KINETIX_MESSAGING_BY_PPROS_BASENAME', plugin_basename( __FILE__ ) );

require_once KINETIX_MESSAGING_BY_PPROS_DIR . 'includes/class-kinetix-messaging-by-ppros-loader.php';
require_once KINETIX_MESSAGING_BY_PPROS_DIR . 'includes/class-kinetix-messaging-by-ppros-activator.php';
require_once KINETIX_MESSAGING_BY_PPROS_DIR . 'includes/class-kinetix-messaging-by-ppros-admin.php';
require_once KINETIX_MESSAGING_BY_PPROS_DIR . 'includes/class-kinetix-messaging-by-ppros-public.php';
require_once KINETIX_MESSAGING_BY_PPROS_DIR . 'includes/class-kinetix-messaging-by-ppros-rest-api.php';
require_once KINETIX_MESSAGING_BY_PPROS_DIR . 'includes/class-kinetix-messaging-by-ppros-email-pipe.php';
require_once KINETIX_MESSAGING_BY_PPROS_DIR . 'includes/class-kinetix-messaging-by-ppros-channel-pipe-base.php';
require_once KINETIX_MESSAGING_BY_PPROS_DIR . 'includes/class-kinetix-messaging-by-ppros-telegram-pipe.php';
require_once KINETIX_MESSAGING_BY_PPROS_DIR . 'includes/class-kinetix-messaging-by-ppros-whatsapp-pipe.php';
require_once KINETIX_MESSAGING_BY_PPROS_DIR . 'includes/class-kinetix-messaging-by-ppros-messenger-pipe.php';
require_once KINETIX_MESSAGING_BY_PPROS_DIR . 'includes/class-kinetix-messaging-by-ppros-wechat-pipe.php';
require_once KINETIX_MESSAGING_BY_PPROS_DIR . 'includes/class-kinetix-messaging-by-ppros-sms-pipe.php';
require_once KINETIX_MESSAGING_BY_PPROS_DIR . 'includes/class-kinetix-messaging-by-ppros-line-pipe.php';
require_once KINETIX_MESSAGING_BY_PPROS_DIR . 'includes/class-kinetix-messaging-by-ppros-instagram-pipe.php';
require_once KINETIX_MESSAGING_BY_PPROS_DIR . 'includes/class-kinetix-messaging-by-ppros-viber-pipe.php';
require_once KINETIX_MESSAGING_BY_PPROS_DIR . 'includes/class-kinetix-messaging-by-ppros.php';

register_activation_hook( __FILE__, array( 'Kinetix_Messaging_By_Ppros_Activator', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'Kinetix_Messaging_By_Ppros_Activator', 'deactivate' ) );

function kinetix_messaging_by_ppros_run() {
    $plugin = new Kinetix_Messaging_By_Ppros();
    $plugin->run();
}
kinetix_messaging_by_ppros_run();
