<?php
/**
 * Public-facing live chat widget.
 *
 * When the Live Chat channel is enabled and an API key is saved, a floating
 * chat window is printed on the front of the site. Messages travel over
 * livechat.pluginpros.co WebSockets and are mirrored into the WordPress inbox.
 *
 * @package Kinetix_Messaging_By_Ppros
 */

defined( 'ABSPATH' ) || die( 'No script kiddies please!' );

class Kinetix_Messaging_By_Ppros_Public {

    public function enqueue_assets() {
        if ( is_admin() ) {
            return;
        }

        $all = (array) get_option( Kinetix_Messaging_By_Ppros_Activator::SETTINGS_OPTION, array() );
        $cfg = isset( $all['livechat'] ) && is_array( $all['livechat'] ) ? $all['livechat'] : array();

        if ( empty( $cfg['enabled'] ) || empty( $cfg['apiKey'] ) ) {
            return;
        }

        $pipe  = new Kinetix_Messaging_By_Ppros_Livechat_Pipe();
        $host  = $pipe->normalized_host( $cfg );
        $token = $pipe->ensure_widget_token();

        $ice = isset( $cfg['iceList'] ) && is_array( $cfg['iceList'] ) ? $cfg['iceList'] : array();
        $ice = array_values( array_filter( array_map( 'strval', $ice ), 'strlen' ) );

        $user = wp_get_current_user();
        $visitor_name = ( $user && $user->ID > 0 ) ? (string) $user->display_name : '';

        $theme = sanitize_hex_color( (string) ( $cfg['themeColor'] ?? '' ) );
        if ( ! $theme ) {
            $theme = '#7C3AED';
        }

        $position = sanitize_key( (string) ( $cfg['position'] ?? 'bottom-right' ) );
        if ( ! in_array( $position, array( 'bottom-right', 'bottom-left' ), true ) ) {
            $position = 'bottom-right';
        }

        wp_enqueue_style(
            'kmbp-livechat-widget',
            KINETIX_MESSAGING_BY_PPROS_URL . 'assets/css/livechat-widget.css',
            array(),
            KINETIX_MESSAGING_BY_PPROS_VERSION
        );

        wp_enqueue_script(
            'kmbp-livechat-widget',
            KINETIX_MESSAGING_BY_PPROS_URL . 'assets/js/livechat-widget.js',
            array(),
            KINETIX_MESSAGING_BY_PPROS_VERSION,
            true
        );

        wp_localize_script(
            'kmbp-livechat-widget',
            'KinetixLivechat',
            array(
                'restUrl'        => esc_url_raw( rest_url( 'kmbp/v1/' ) ),
                'widgetToken'    => $token,
                'nonce'          => is_user_logged_in() ? wp_create_nonce( 'wp_rest' ) : '',
                'apiKey'         => (string) $cfg['apiKey'],
                'wsUrl'          => 'wss://' . $host . '/ws/chat',
                'brandName'      => (string) ( $cfg['brandName'] ?? '' ) !== '' ? (string) $cfg['brandName'] : (string) get_bloginfo( 'name' ),
                'tagline'        => (string) ( $cfg['tagline'] ?? '' ),
                'welcomeMessage' => (string) ( $cfg['welcomeMessage'] ?? '' ),
                'iceBreakers'    => $ice,
                'themeColor'     => $theme,
                'position'       => $position,
                'onlineText'     => (string) ( $cfg['onlineText'] ?? '' ),
                'agentName'      => (string) ( $cfg['agentName'] ?? '' ),
                'askName'        => ! empty( $cfg['askName'] ),
                'visitorName'    => $visitor_name,
                'i18n'           => array(
                    'sendPlaceholder' => __( 'Send a message…', 'kinetix-messaging-by-ppros' ),
                    'namePlaceholder' => __( 'Your name', 'kinetix-messaging-by-ppros' ),
                    'chooseStarter'   => __( 'Please choose a starting sentence.', 'kinetix-messaging-by-ppros' ),
                    'today'           => __( 'Today', 'kinetix-messaging-by-ppros' ),
                    'openChat'        => __( 'Open live chat', 'kinetix-messaging-by-ppros' ),
                    'closeChat'       => __( 'Close live chat', 'kinetix-messaging-by-ppros' ),
                    'send'            => __( 'Send', 'kinetix-messaging-by-ppros' ),
                    'connecting'      => __( 'Connecting…', 'kinetix-messaging-by-ppros' ),
                    'offline'         => __( 'Reconnecting…', 'kinetix-messaging-by-ppros' ),
                    'justNow'         => __( 'Just now', 'kinetix-messaging-by-ppros' ),
                    'defaultWelcome'  => __( 'Hi {{name}}, welcome! 👋', 'kinetix-messaging-by-ppros' ),
                    'defaultTagline'  => __( 'We help your business grow by connecting you to your customers.', 'kinetix-messaging-by-ppros' ),
                    'defaultOnline'   => __( 'A few minutes', 'kinetix-messaging-by-ppros' ),
                    'visitorFallback' => __( 'there', 'kinetix-messaging-by-ppros' ),
                ),
            )
        );
    }
}
