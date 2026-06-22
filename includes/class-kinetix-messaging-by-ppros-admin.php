<?php
/**
 * Admin-area registration: menu, assets and capability gating.
 *
 * @package Kinetix_Messaging_By_Ppros
 */

defined( 'ABSPATH' ) || die( 'No script kiddies please!' );

class Kinetix_Messaging_By_Ppros_Admin {

    const MENU_SLUG      = 'kinetix-messaging-by-ppros';
    const HELP_MENU_SLUG = 'kinetix-messaging-by-ppros-help';

    public function register_menu() {
        $cap = current_user_can( 'manage_options' )
            ? 'manage_options'
            : Kinetix_Messaging_By_Ppros_Activator::CAP_ACCESS_MESSAGING;

        add_menu_page(
            __( 'Kinetix Messaging by Ppros', 'kinetix-messaging-by-ppros' ),
            __( 'Kinetix Messaging', 'kinetix-messaging-by-ppros' ),
            $cap,
            self::MENU_SLUG,
            array( $this, 'render_app_container' ),
            'dashicons-email-alt',
            58
        );

        // Rename the auto-generated first submenu entry to "Inbox".
        add_submenu_page(
            self::MENU_SLUG,
            __( 'Inbox — Messaging Engine', 'kinetix-messaging-by-ppros' ),
            __( 'Inbox', 'kinetix-messaging-by-ppros' ),
            $cap,
            self::MENU_SLUG,
            array( $this, 'render_app_container' )
        );

        // Help submenu.
        add_submenu_page(
            self::MENU_SLUG,
            __( 'Help & Documentation — Kinetix Messaging', 'kinetix-messaging-by-ppros' ),
            __( 'Help', 'kinetix-messaging-by-ppros' ),
            $cap,
            self::HELP_MENU_SLUG,
            array( $this, 'render_help_page' )
        );
    }

    public function render_app_container() {
        if ( ! current_user_can( Kinetix_Messaging_By_Ppros_Activator::CAP_ACCESS_MESSAGING )
            && ! current_user_can( 'manage_options' ) ) {
            wp_die( esc_html__( 'You do not have permission to access this page.', 'kinetix-messaging-by-ppros' ) );
        }

        echo '<div id="kinetix-messaging-by-ppros"></div>';
    }

    // ── Help page ──────────────────────────────────────────────────────────

    public function render_help_page() {
        if ( ! current_user_can( Kinetix_Messaging_By_Ppros_Activator::CAP_ACCESS_MESSAGING )
            && ! current_user_can( 'manage_options' ) ) {
            wp_die( esc_html__( 'You do not have permission to access this page.', 'kinetix-messaging-by-ppros' ) );
        }

        $webhook_base = esc_url( rest_url( 'sme/v1/webhooks/' ) );
        $rest_base    = esc_url( rest_url( 'sme/v1/' ) );
        $plugin_ver   = KINETIX_MESSAGING_BY_PPROS_VERSION ?? '1.0.0';
        ?>
        <div class="sme-help wrap">
            <h1>&#128233; Kinetix Messaging — Help &amp; Documentation</h1>
            <p class="sme-version">Version <?php echo esc_html( $plugin_ver ); ?> &nbsp;|&nbsp; REST Base: <code><?php echo esc_html( $rest_base ); ?></code></p>

            <!-- Table of Contents -->
            <div class="sme-toc">
                <strong class="sme-toc-title">Contents</strong>
                <ol>
                    <li><a href="#sme-quick-start">Quick Start</a></li>
                    <li><a href="#sme-channels">Channel Setup</a></li>
                    <li><a href="#sme-webhooks">Webhook URLs</a></li>
                    <li><a href="#sme-troubleshoot">Troubleshooting</a></li>
                    <li><a href="#sme-rest-api">REST API Reference</a></li>
                    <li><a href="#sme-roles">Roles &amp; Capabilities</a></li>
                </ol>
            </div>

            <!-- Quick Start -->
            <h2 id="sme-quick-start">1. Quick Start</h2>
            <p>Follow these four steps to go from install to receiving live messages:</p>
            <ol>
                <li><strong>Activate the plugin</strong> — the database tables are created automatically on first activation.</li>
                <li><strong>Open Settings</strong> — click <em>Kinetix Messaging → Inbox</em> then the ⚙ gear icon inside the app, or go directly to <em>Settings</em> inside the React app sidebar.</li>
                <li><strong>Enable at least one channel</strong> — paste in your API credentials and flip the <em>Enable</em> toggle, then click <strong>Save changes</strong>.</li>
                <li><strong>Register the webhook</strong> — each channel has a <em>Webhook</em> tab with a one-click <em>Register Webhook</em> button (Telegram) or a Callback URL to paste into the platform's developer console (WhatsApp, Messenger, LINE, etc.).</li>
            </ol>
            <div class="sme-tip"><p>&#128161; Your site must be accessible over <strong>HTTPS</strong> with a valid SSL certificate. All platforms (Telegram, Meta, LINE, Viber) reject plain HTTP webhook URLs.</p></div>

            <!-- Channel Setup -->
            <h2 id="sme-channels">2. Channel Setup</h2>

            <div class="sme-cards">
                <div class="sme-card">
                    <strong>&#9993; Email</strong>
                    <span>IMAP polling or inbound webhook (Mailgun / SendGrid / Postmark). SMTP for outbound replies.</span>
                </div>
                <div class="sme-card">
                    <strong><span class="sme-dot-whatsapp">&#9899;</span> WhatsApp Business</strong>
                    <span>Meta Business Cloud API. Requires a verified WhatsApp Business Account (WABA) and a System User token.</span>
                </div>
                <div class="sme-card">
                    <strong><span class="sme-dot-messenger">&#9899;</span> Messenger</strong>
                    <span>Facebook Page + Meta app. Needs pages_messaging permission and App Review for production.</span>
                </div>
                <div class="sme-card">
                    <strong><span class="sme-dot-telegram">&#9899;</span> Telegram</strong>
                    <span>Bot created via @BotFather. One-click webhook registration from the Webhook tab.</span>
                </div>
                <div class="sme-card">
                    <strong><span class="sme-dot-instagram">&#9899;</span> Instagram DM</strong>
                    <span>Professional Instagram Account linked to a Facebook Page. Requires instagram_manage_messages + App Review.</span>
                </div>
                <div class="sme-card">
                    <strong><span class="sme-dot-sms">&#9899;</span> SMS</strong>
                    <span>Supports Twilio, Vonage, Sinch, Plivo, Telnyx, and MessageBird. One shared webhook for all providers.</span>
                </div>
                <div class="sme-card">
                    <strong><span class="sme-dot-line">&#9899;</span> LINE</strong>
                    <span>LINE Messaging API. Channel Access Token from LINE Developers console.</span>
                </div>
                <div class="sme-card">
                    <strong><span class="sme-dot-viber">&#9899;</span> Viber</strong>
                    <span>Viber Bot / Business Messages. Auth token from the Viber Admin Panel. One-click webhook via the Webhook tab or cURL.</span>
                </div>
                <div class="sme-card">
                    <strong><span class="sme-dot-wechat">&#9899;</span> WeChat</strong>
                    <span>WeChat Official Account (Service Account). Server URL + Token + AES Key from the WeChat admin portal.</span>
                </div>
            </div>

            <!-- Webhook URLs -->
            <h2 id="sme-webhooks">3. Webhook URLs</h2>
            <p>Paste each URL into the corresponding platform's developer console. All endpoints accept <code>POST</code> (and <code>GET</code> for hub verification where required).</p>

            <table>
                <thead>
                    <tr><th>Channel</th><th>Webhook URL</th><th>Notes</th></tr>
                </thead>
                <tbody>
                    <tr><td>Telegram</td>      <td><code><?php echo esc_html( $webhook_base . 'telegram' ); ?></code></td>      <td>Use the <em>Register Webhook</em> button — no manual paste needed.</td></tr>
                    <tr><td>WhatsApp</td>       <td><code><?php echo esc_html( $webhook_base . 'whatsapp' ); ?></code></td>      <td>Also enter your Verify Token in Meta → WhatsApp → Configuration.</td></tr>
                    <tr><td>Messenger</td>      <td><code><?php echo esc_html( $webhook_base . 'messenger' ); ?></code></td>     <td>Subscribe to: messages, messaging_postbacks, message_reads.</td></tr>
                    <tr><td>Instagram DM</td>   <td><code><?php echo esc_html( $webhook_base . 'instagram' ); ?></code></td>     <td>Subscribe to: messages, messaging_postbacks.</td></tr>
                    <tr><td>SMS (all providers)</td><td><code><?php echo esc_html( $webhook_base . 'sms' ); ?></code></td>       <td>One URL works for Twilio, Vonage, Sinch, Plivo, Telnyx, MessageBird.</td></tr>
                    <tr><td>LINE</td>           <td><code><?php echo esc_html( $webhook_base . 'line' ); ?></code></td>          <td>Paste in LINE Developers → Messaging API → Webhook URL.</td></tr>
                    <tr><td>Viber</td>          <td><code><?php echo esc_html( $webhook_base . 'viber' ); ?></code></td>         <td>Use the cURL snippet in Settings → Viber → Webhook.</td></tr>
                    <tr><td>WeChat</td>         <td><code><?php echo esc_html( $webhook_base . 'wechat' ); ?></code></td>        <td>Enter as Server URL in WeChat MP admin → Basic configuration.</td></tr>
                    <tr><td>Email (inbound)</td><td><code><?php echo esc_html( $webhook_base . 'email' ); ?></code></td>         <td>For Mailgun / SendGrid / Postmark route forwarding.</td></tr>
                </tbody>
            </table>

            <!-- Troubleshooting -->
            <h2 id="sme-troubleshoot">4. Troubleshooting</h2>

            <h3>Messages not appearing in the inbox</h3>
            <ol>
                <li><strong>Is the channel enabled?</strong> Open Settings, find the channel, confirm the <em>Enable</em> toggle is on and the settings are saved.</li>
                <li><strong>Is the webhook registered?</strong> For Telegram: use the <em>Register Webhook</em> button on the Webhook tab; the status card confirms success. For other channels: paste the URL into the developer console.</li>
                <li><strong>Is the site on HTTPS?</strong> All platforms require a valid SSL certificate. Self-signed certs are rejected.</li>
                <li><strong>Can the platform reach your site?</strong> If you are on <code>localhost</code> or behind a VPN/firewall, platforms cannot deliver. Use a tunnel (e.g. <a href="https://ngrok.com" target="_blank">ngrok</a>) during development.</li>
                <li><strong>Check PHP error logs</strong> — when <code>WP_DEBUG</code> is enabled, the plugin writes debug entries prefixed with <code>[SME ChannelName]</code> for DB errors or unexpected payloads.</li>
                <li><strong>Are pretty permalinks enabled?</strong> The REST API requires <em>Settings → Permalinks</em> to be set to anything other than <em>Plain</em>.</li>
            </ol>

            <h3>Webhook registration fails (Telegram)</h3>
            <div class="sme-warn"><p>&#9888; The Bot Token must be saved first. Click <strong>Save changes</strong> in Settings → Telegram before attempting to register the webhook.</p></div>
            <p>If you see a <em>"Wrong response from the webhook: 403 Forbidden"</em> error from Telegram, a security plugin is blocking unauthenticated REST requests. Whitelist the <code>/wp-json/sme/v1/webhooks/*</code> path in your security plugin.</p>

            <h3>WhatsApp / Messenger hub verification fails</h3>
            <p>The <em>Verify Token</em> you enter in Meta must <strong>exactly match</strong> the token saved in Settings. Copy-paste it — do not type it manually on both sides.</p>

            <h3>Email (IMAP) not polling</h3>
            <p>IMAP polling runs via WordPress Cron every 2 minutes (configurable). Make sure:</p>
            <ul>
                <li>WP-Cron is not disabled (<code>define('DISABLE_WP_CRON', true)</code> in <code>wp-config.php</code>).</li>
                <li>The IMAP credentials are correct — use <em>Test Connection</em> in Settings → Email.</li>
                <li>PHP has the <code>imap</code> extension enabled: <code>php -m | grep imap</code>.</li>
            </ul>

            <!-- REST API -->
            <h2 id="sme-rest-api">5. REST API Reference</h2>
            <p>All endpoints live under <code><?php echo esc_html( $rest_base ); ?></code> and require the <code>X-WP-Nonce</code> header (for authenticated endpoints) or are open for webhook delivery.</p>

            <table>
                <thead><tr><th>Method</th><th>Path</th><th>Auth</th><th>Description</th></tr></thead>
                <tbody>
                    <tr><td><span class="sme-badge sme-badge-blue">GET</span></td>   <td><code>settings</code></td>                      <td>Admin</td>    <td>Retrieve all channel settings.</td></tr>
                    <tr><td><span class="sme-badge sme-badge-green">POST</span></td>  <td><code>settings</code></td>                      <td>Admin</td>    <td>Save all channel settings.</td></tr>
                    <tr><td><span class="sme-badge sme-badge-blue">GET</span></td>    <td><code>conversations</code></td>                  <td>Agent</td>    <td>List conversations (filter by channel, status, search).</td></tr>
                    <tr><td><span class="sme-badge sme-badge-green">POST</span></td>  <td><code>conversations</code></td>                  <td>Agent</td>    <td>Create a conversation manually.</td></tr>
                    <tr><td><span class="sme-badge sme-badge-purple">PUT</span></td>  <td><code>conversations/{id}</code></td>             <td>Agent</td>    <td>Update status, priority, assignee, department.</td></tr>
                    <tr><td><span class="sme-badge sme-badge-blue">GET</span></td>    <td><code>conversations/{id}/messages</code></td>    <td>Agent</td>    <td>List messages in a conversation.</td></tr>
                    <tr><td><span class="sme-badge sme-badge-green">POST</span></td>  <td><code>telegram/send</code></td>                  <td>Agent</td>    <td>Send a Telegram message. Body: <code>{conversationId, recipientId, text}</code></td></tr>
                    <tr><td><span class="sme-badge sme-badge-green">POST</span></td>  <td><code>telegram/set-webhook</code></td>           <td>Admin</td>    <td>Register the Telegram webhook with the Bot API.</td></tr>
                    <tr><td><span class="sme-badge sme-badge-blue">GET</span></td>    <td><code>telegram/webhook-info</code></td>          <td>Admin</td>    <td>Fetch live webhook status from Telegram.</td></tr>
                    <tr><td><span class="sme-badge sme-badge-green">POST</span></td>  <td><code>whatsapp/send</code></td>                  <td>Agent</td>    <td>Send a WhatsApp message.</td></tr>
                    <tr><td><span class="sme-badge sme-badge-green">POST</span></td>  <td><code>messenger/send</code></td>                 <td>Agent</td>    <td>Send a Messenger message.</td></tr>
                    <tr><td><span class="sme-badge sme-badge-green">POST</span></td>  <td><code>instagram/send</code></td>                 <td>Agent</td>    <td>Send an Instagram DM.</td></tr>
                    <tr><td><span class="sme-badge sme-badge-green">POST</span></td>  <td><code>sms/send</code></td>                       <td>Agent</td>    <td>Send an SMS via the configured provider.</td></tr>
                    <tr><td><span class="sme-badge sme-badge-green">POST</span></td>  <td><code>line/send</code></td>                      <td>Agent</td>    <td>Send a LINE message.</td></tr>
                    <tr><td><span class="sme-badge sme-badge-green">POST</span></td>  <td><code>viber/send</code></td>                     <td>Agent</td>    <td>Send a Viber message.</td></tr>
                    <tr><td><span class="sme-badge sme-badge-green">POST</span></td>  <td><code>viber/set-webhook</code></td>              <td>Admin</td>    <td>Register the Viber webhook via the Chat API.</td></tr>
                    <tr><td><span class="sme-badge sme-badge-green">POST</span></td>  <td><code>wechat/send</code></td>                    <td>Agent</td>    <td>Send a WeChat message.</td></tr>
                    <tr><td><span class="sme-badge sme-badge-amber">ANY</span></td>   <td><code>webhooks/{channel}</code></td>             <td>Channel secret</td>     <td>Inbound webhook delivery; each channel verifies its own signature or secret token.</td></tr>
                </tbody>
            </table>

            <!-- Roles -->
            <h2 id="sme-roles">6. Roles &amp; Capabilities</h2>
            <table>
                <thead><tr><th>Capability</th><th>Granted to</th><th>Allows</th></tr></thead>
                <tbody>
                    <tr><td><code>sme_access_messaging</code></td>  <td>Administrator, Editor (on activation)</td> <td>View inbox, read &amp; reply to conversations.</td></tr>
                    <tr><td><code>sme_manage_settings</code></td>   <td>Administrator (on activation)</td>         <td>Change channel settings, credentials, webhooks.</td></tr>
                    <tr><td><code>sme_manage_departments</code></td><td>Administrator (on activation)</td>         <td>Create and edit departments and agent assignments.</td></tr>
                    <tr><td><code>manage_options</code></td>         <td>Administrator (WordPress built-in)</td>   <td>All of the above.</td></tr>
                </tbody>
            </table>
            <div class="sme-tip"><p>&#128161; Capabilities are added to roles during plugin <strong>activation</strong>. If you added an admin user <em>after</em> installing the plugin, deactivate and re-activate the plugin once to grant capabilities.</p></div>

            <p class="sme-footer">Kinetix Messaging by Ppros v<?php echo esc_html( $plugin_ver ); ?></p>
        </div>
        <?php
    }

    public function enqueue_assets( $hook_suffix ) {
        // Only load on our own admin pages to avoid polluting every screen.
        if ( false === strpos( (string) $hook_suffix, self::MENU_SLUG ) ) {
            return;
        }

        if ( false !== strpos( (string) $hook_suffix, self::HELP_MENU_SLUG ) ) {
            wp_enqueue_style(
                'kinetix-messaging-by-ppros-help',
                KINETIX_MESSAGING_BY_PPROS_URL . 'assets/css/admin-help.css',
                array(),
                KINETIX_MESSAGING_BY_PPROS_VERSION
            );
            return;
        }

        $asset_file_path = KINETIX_MESSAGING_BY_PPROS_DIR . 'build/index.asset.php';
        if ( ! file_exists( $asset_file_path ) ) {
            return;
        }
        $asset_file = include $asset_file_path;

        // Tabler Icons webfont — bundled locally (WordPress.org disallows external CDNs).
        wp_enqueue_style(
            'kmbp-tabler-icons',
            KINETIX_MESSAGING_BY_PPROS_URL . 'assets/tabler-icons/tabler-icons.min.css',
            array(),
            '3.44.0'
        );

        wp_enqueue_style(
            'kinetix-messaging-by-ppros-css',
            KINETIX_MESSAGING_BY_PPROS_URL . 'build/index.css',
            array( 'kmbp-tabler-icons' ),
            $asset_file['version']
        );

        wp_enqueue_script(
            'kinetix-messaging-by-ppros-js',
            KINETIX_MESSAGING_BY_PPROS_URL . 'build/index.js',
            $asset_file['dependencies'],
            $asset_file['version'],
            true
        );

        $user                = wp_get_current_user();
        $is_admin            = current_user_can( 'manage_options' );
        $can_access          = current_user_can( Kinetix_Messaging_By_Ppros_Activator::CAP_ACCESS_MESSAGING );
        $can_manage_settings = current_user_can( Kinetix_Messaging_By_Ppros_Activator::CAP_MANAGE_SETTINGS );
        $can_manage_depts    = current_user_can( Kinetix_Messaging_By_Ppros_Activator::CAP_MANAGE_DEPTS );

        wp_localize_script(
            'kinetix-messaging-by-ppros-js',
            'KinetixMessagingBoot',
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
