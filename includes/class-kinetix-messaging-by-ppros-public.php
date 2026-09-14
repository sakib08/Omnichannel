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

        $ice = isset( $cfg['iceList'] ) && is_array( $cfg['iceList'] )
            ? array_values( array_filter( array_map( 'strval', $cfg['iceList'] ), 'strlen' ) )
            : array( 'Just browsing!', "I'd like to learn more", 'I have a question' );

        $user = wp_get_current_user();
        $logged_in     = $user instanceof WP_User && $user->ID > 0;
        $visitor_name  = $logged_in ? (string) $user->display_name : '';
        $visitor_email = $logged_in ? (string) $user->user_email : '';
        $identity_locked = $logged_in && is_email( $visitor_email );
        $visitor_room  = $logged_in ? $pipe->identity_room_id( $visitor_email ) : '';

        $theme = sanitize_hex_color( (string) ( $cfg['themeColor'] ?? '' ) );
        if ( ! $theme ) {
            $theme = '#7C3AED';
        }

        $position = sanitize_key( (string) ( $cfg['position'] ?? 'bottom-right' ) );
        if ( ! in_array( $position, array( 'bottom-right', 'bottom-left' ), true ) ) {
            $position = 'bottom-right';
        }

        $css_path = KINETIX_MESSAGING_BY_PPROS_DIR . 'assets/css/livechat-widget.css';
        $js_path  = KINETIX_MESSAGING_BY_PPROS_DIR . 'assets/js/livechat-widget.js';
        $css_ver  = file_exists( $css_path ) ? (string) filemtime( $css_path ) : KINETIX_MESSAGING_BY_PPROS_VERSION;
        $js_ver   = file_exists( $js_path ) ? (string) filemtime( $js_path ) : KINETIX_MESSAGING_BY_PPROS_VERSION;

        wp_enqueue_style(
            'kmbp-livechat-widget',
            KINETIX_MESSAGING_BY_PPROS_URL . 'assets/css/livechat-widget.css',
            array(),
            $css_ver
        );

        wp_enqueue_script(
            'kmbp-livechat-widget',
            KINETIX_MESSAGING_BY_PPROS_URL . 'assets/js/livechat-widget.js',
            array(),
            $js_ver,
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
                'tagline'        => array_key_exists( 'tagline', $cfg )
                    ? (string) $cfg['tagline']
                    : __( 'We help your business grow by connecting you to your customers.', 'kinetix-messaging-by-ppros' ),
                'welcomeMessage' => array_key_exists( 'welcomeMessage', $cfg )
                    ? (string) $cfg['welcomeMessage']
                    : __( 'Hi {{name}}, welcome! 👋', 'kinetix-messaging-by-ppros' ),
                'starterPrompt'  => array_key_exists( 'starterPrompt', $cfg )
                    ? (string) $cfg['starterPrompt']
                    : __( 'Please choose a starting sentence.', 'kinetix-messaging-by-ppros' ),
                'iceBreakers'    => $ice,
                'themeColor'     => $theme,
                'position'       => $position,
                'agentName'      => (string) ( $cfg['agentName'] ?? '' ),
                'askName'        => ! empty( $cfg['askName'] ),
                'visitorId'      => $logged_in ? (int) $user->ID : 0,
                'visitorName'    => $visitor_name,
                'visitorEmail'   => $visitor_email,
                'roomId'         => $visitor_room,
                'identityLocked' => $identity_locked,
                'i18n'           => array(
                    'sendPlaceholder' => __( 'Send a message…', 'kinetix-messaging-by-ppros' ),
                    'namePlaceholder' => __( 'Your name', 'kinetix-messaging-by-ppros' ),
                    'emailPlaceholder' => __( 'Your email', 'kinetix-messaging-by-ppros' ),
                    'emailRequired'   => __( 'Enter your email to start chatting.', 'kinetix-messaging-by-ppros' ),
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
                    'visitorFallback' => __( 'there', 'kinetix-messaging-by-ppros' ),
                ),
            )
        );
    }
}
