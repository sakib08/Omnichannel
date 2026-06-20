<?php
/**
 * Core plugin orchestrator — registers hooks via the loader.
 *
 * @package Kinetix_Messaging_By_Ppros
 */

defined( 'ABSPATH' ) || die( 'No script kiddies please!' );

class Kinetix_Messaging_By_Ppros {

    /** @var Kinetix_Messaging_By_Ppros_Loader */
    protected $loader;

    public function __construct() {
        $this->load_dependencies();
        $this->define_admin_hooks();
        $this->define_rest_hooks();
        $this->define_email_pipe_hooks();
        $this->define_channel_pipe_hooks();
    }

    private function load_dependencies() {
        $this->loader = new Kinetix_Messaging_By_Ppros_Loader();
    }

    private function define_admin_hooks() {
        $admin = new Kinetix_Messaging_By_Ppros_Admin();
        $this->loader->add_action( 'admin_menu', $admin, 'register_menu' );
        $this->loader->add_action( 'admin_enqueue_scripts', $admin, 'enqueue_assets' );
    }

    private function define_rest_hooks() {
        $rest = new Kinetix_Messaging_By_Ppros_Rest_Api();
        $this->loader->add_action( 'rest_api_init', $rest, 'register_routes' );
    }

    private function define_email_pipe_hooks() {
        $email_pipe = new Kinetix_Messaging_By_Ppros_Email_Pipe();
        $email_pipe->register_hooks( $this->loader );
    }

    private function define_channel_pipe_hooks() {
        $pipes = array(
            new Kinetix_Messaging_By_Ppros_Telegram_Pipe(),
            new Kinetix_Messaging_By_Ppros_Whatsapp_Pipe(),
            new Kinetix_Messaging_By_Ppros_Messenger_Pipe(),
            new Kinetix_Messaging_By_Ppros_Wechat_Pipe(),
            new Kinetix_Messaging_By_Ppros_Sms_Pipe(),
                        new Kinetix_Messaging_By_Ppros_Line_Pipe(),
                        new Kinetix_Messaging_By_Ppros_Instagram_Pipe(),
                        new Kinetix_Messaging_By_Ppros_Viber_Pipe(),
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
