<?php
/**
 * Core plugin orchestrator — registers hooks via the loader.
 *
 * @package Synchronized_Messaging_Engine
 */

defined( 'ABSPATH' ) || die( 'No script kiddies please!' );

class Synchronized_Messaging_Engine {

    /** @var Synchronized_Messaging_Engine_Loader */
    protected $loader;

    public function __construct() {
        $this->load_dependencies();
        $this->set_locale();
        $this->define_admin_hooks();
        $this->define_rest_hooks();
        $this->define_email_pipe_hooks();
        $this->define_channel_pipe_hooks();
    }

    private function load_dependencies() {
        $this->loader = new Synchronized_Messaging_Engine_Loader();
    }

    private function set_locale() {
        $i18n = new Synchronized_Messaging_Engine_I18n();
        $this->loader->add_action( 'plugins_loaded', $i18n, 'load_plugin_textdomain' );
    }

    private function define_admin_hooks() {
        $admin = new Synchronized_Messaging_Engine_Admin();
        $this->loader->add_action( 'admin_menu', $admin, 'register_menu' );
        $this->loader->add_action( 'admin_enqueue_scripts', $admin, 'enqueue_assets' );
    }

    private function define_rest_hooks() {
        $rest = new Synchronized_Messaging_Engine_Rest_Api();
        $this->loader->add_action( 'rest_api_init', $rest, 'register_routes' );
    }

    private function define_email_pipe_hooks() {
        $email_pipe = new Synchronized_Messaging_Engine_Email_Pipe();
        $email_pipe->register_hooks( $this->loader );
    }

    private function define_channel_pipe_hooks() {
        $pipes = array(
            new Synchronized_Messaging_Engine_Telegram_Pipe(),
            new Synchronized_Messaging_Engine_Whatsapp_Pipe(),
            new Synchronized_Messaging_Engine_Messenger_Pipe(),
            new Synchronized_Messaging_Engine_Wechat_Pipe(),
            new Synchronized_Messaging_Engine_Sms_Pipe(),
                        new Synchronized_Messaging_Engine_Line_Pipe(),
                        new Synchronized_Messaging_Engine_Instagram_Pipe(),
                        new Synchronized_Messaging_Engine_Viber_Pipe(),
                    );
        foreach ( $pipes as $pipe ) {
            $pipe->register_hooks( $this->loader );
        }
    }

    public function run() {
        $this->loader->run();
    }

    public function get_loader() {
        return $this->loader;
    }
}
