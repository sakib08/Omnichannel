<?php
/**
 * Defines the internationalization functionality.
 *
 * @package Synchronized_Messaging_Engine
 */

defined( 'ABSPATH' ) || die( 'No script kiddies please!' );

class Synchronized_Messaging_Engine_I18n {

    public function load_plugin_textdomain() {
        load_plugin_textdomain(
            'synchronized-messaging-engine',
            false,
            dirname( PLUGIN_PROS_SYNCHRONIZED_MESSAGING_ENGINE_PLUGIN_BASENAME ) . '/lang/'
        );
    }
}
