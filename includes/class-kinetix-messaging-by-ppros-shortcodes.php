<?php
/**
 * Shortcode: [kmbp_channel_button]
 *
 * Renders a styled button or inline link that opens the configured channel.
 *
 * Attributes:
 *   channel  (required) — slug: telegram | whatsapp | messenger | instagram |
 *                         line | viber | wechat | sms | email
 *   label    (optional) — button text; defaults to a sensible per-channel label
 *   style    (optional) — "button" (default, pill-shaped) | "link" (plain anchor)
 *   class    (optional) — extra CSS classes to add to the element
 *
 * Examples:
 *   [kmbp_channel_button channel="telegram"]
 *   [kmbp_channel_button channel="whatsapp" label="Contact us on WhatsApp"]
 *   [kmbp_channel_button channel="email" style="link"]
 *
 * @package Kinetix_Messaging_By_Ppros
 */

defined( 'ABSPATH' ) || die( 'No script kiddies please!' );

class Kinetix_Messaging_By_Ppros_Shortcodes {

    /** Per-channel brand colours (hex). */
    private static $colors = array(
        'telegram'  => '#229ED9',
        'whatsapp'  => '#25D366',
        'messenger' => '#0866FF',
        'instagram' => '#E1306C',
        'line'      => '#06C755',
        'viber'     => '#7360F2',
        'wechat'    => '#07C160',
        'sms'       => '#F22F46',
        'email'     => '#10B981',
    );

    /** Per-channel default button labels. */
    private static $default_labels = array(
        'telegram'  => 'Chat on Telegram',
        'whatsapp'  => 'Chat on WhatsApp',
        'messenger' => 'Message us on Messenger',
        'instagram' => 'DM us on Instagram',
        'line'      => 'Chat on LINE',
        'viber'     => 'Chat on Viber',
        'wechat'    => 'Chat on WeChat',
        'sms'       => 'Send us an SMS',
        'email'     => 'Email us',
    );

    public static function register() {
        add_shortcode( 'kmbp_channel_button', array( __CLASS__, 'render' ) );
    }

    /**
     * Shortcode callback.
     *
     * @param array|string $atts Raw shortcode attributes.
     * @return string           HTML output (empty string on failure).
     */
    public static function render( $atts ) {
        $atts = shortcode_atts(
            array(
                'channel' => '',
                'label'   => '',
                'style'   => 'button',
                'class'   => '',
            ),
            $atts,
            'kmbp_channel_button'
        );

        $channel = sanitize_key( (string) $atts['channel'] );
        if ( ! $channel || ! array_key_exists( $channel, self::$colors ) ) {
            return '';
        }

        $settings = (array) get_option( Kinetix_Messaging_By_Ppros_Activator::SETTINGS_OPTION, array() );
        $cfg      = isset( $settings[ $channel ] ) ? (array) $settings[ $channel ] : array();

        $url = self::build_url( $channel, $cfg );
        if ( ! $url ) {
            return '';
        }

        $label      = $atts['label'] ? sanitize_text_field( $atts['label'] ) : ( self::$default_labels[ $channel ] ?? ucfirst( $channel ) );
        $color      = self::$colors[ $channel ];
        $extra_cls  = sanitize_html_class( $atts['class'] );
        $is_email   = 'email' === $channel;
        $target_rel = $is_email ? '' : ' target="_blank" rel="noopener noreferrer"';

        if ( 'link' === $atts['style'] ) {
            return sprintf(
                '<a href="%s" class="kmbp-channel-link %s" style="color:%s;text-decoration:underline;"%s>%s</a>',
                esc_url( $url ),
                esc_attr( $extra_cls ),
                esc_attr( $color ),
                $target_rel,
                esc_html( $label )
            );
        }

        // Default: pill button with brand colour.
        return sprintf(
            '<a href="%s" class="kmbp-channel-button %s" style="display:inline-flex;align-items:center;gap:8px;background:%s;color:#fff;padding:12px 24px;border-radius:9999px;font-family:sans-serif;font-size:15px;font-weight:600;text-decoration:none;box-shadow:0 4px 14px rgba(0,0,0,0.15);line-height:1;"%s>%s</a>',
            esc_url( $url ),
            esc_attr( $extra_cls ),
            esc_attr( $color ),
            $target_rel,
            esc_html( $label )
        );
    }

    /**
     * Build the channel-specific contact URL from stored settings.
     *
     * @param string $channel Channel slug.
     * @param array  $cfg     Channel settings array.
     * @return string         URL, or empty string when the required credential is missing.
     */
    private static function build_url( string $channel, array $cfg ): string {
        switch ( $channel ) {
            case 'telegram':
                $username = ltrim( (string) ( $cfg['botUsername'] ?? '' ), '@' );
                return $username ? 'https://t.me/' . rawurlencode( $username ) : '';

            case 'whatsapp':
                $phone = preg_replace( '/\D/', '', (string) ( $cfg['displayPhone'] ?? '' ) );
                $text  = rawurlencode( (string) ( $cfg['ctaMessage'] ?? 'Hello!' ) );
                return $phone ? "https://wa.me/{$phone}?text={$text}" : '';

            case 'messenger':
                $page_id = (string) ( $cfg['pageId'] ?? '' );
                return $page_id ? 'https://m.me/' . rawurlencode( $page_id ) : '';

            case 'instagram':
                $account = (string) ( $cfg['igAccountId'] ?? '' );
                return $account ? 'https://ig.me/m/' . rawurlencode( $account ) : '';

            case 'line':
                $basic_id = ltrim( (string) ( $cfg['basicId'] ?? '' ), '@' );
                return $basic_id ? 'https://line.me/R/ti/p/' . rawurlencode( $basic_id ) : '';

            case 'viber':
                $sender = (string) ( $cfg['senderId'] ?? '' );
                return $sender ? 'viber://pa?chatURI=' . rawurlencode( $sender ) : '';

            case 'wechat':
                // WeChat does not expose a universal deep-link; QR code is the standard approach.
                return '';

            case 'sms':
                $number = preg_replace( '/\D/', '', (string) ( $cfg['fromNumber'] ?? '' ) );
                return $number ? 'sms:+' . $number : '';

            case 'email':
                $address = sanitize_email( (string) ( $cfg['inboxEmail'] ?? '' ) );
                return $address ? 'mailto:' . $address : '';
        }

        return '';
    }
}
