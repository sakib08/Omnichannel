=== Kinetix Messaging by Ppros ===
Contributors: sakibbd08
Tags: whatsapp, messenger, chat, social-media, messaging, omnichannel, telegram, email, social
Requires at least: 6.0
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 1.0.7
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Unified inbox for email, Telegram, WhatsApp, Messenger, SMS, and other messaging channels.

== Description ==

Kinetix Messaging by Ppros brings omnichannel conversations into a single WordPress admin inbox. Agents can read, reply, assign, and manage conversations across multiple messaging platforms.

This plugin is free software released under the GPLv2 (or later). All bundled libraries and assets included in the distributed plugin are licensed under the GPL or another GPL-compatible license (MIT, BSD, etc.).

== Source code ==

The human-readable source for the compiled admin UI lives in the `src/` directory inside this plugin (React/JSX, CSS). The minified files in `build/` are generated from that source.

**Public source repository:** https://github.com/sakib08/Omnichannel

= Build tools =

The admin inbox is built with [@wordpress/scripts](https://www.npmjs.com/package/@wordpress/scripts) (webpack), React 19, and Tailwind CSS 4.

= Regenerating build/ assets =

From the plugin root directory:

1. Install Node.js 18+ and npm.
2. Run `npm install`
3. Run `npm run build`

This compiles `src/` into `build/index.js`, `build/index.css`, and related files, and copies Tabler icon fonts into `assets/tabler-icons/` (via a local build script; shell scripts are not shipped in the WordPress.org ZIP).

To create a distributable ZIP locally: `npm run bundle`

== Third-party licenses ==

The following components are bundled in the distributed plugin (compiled into `build/` or copied to `assets/`).

* **React** and **React DOM** — MIT License (GPL-compatible). Copyright Meta Platforms, Inc. https://github.com/facebook/react
* **Tabler Icons** (webfont in `assets/tabler-icons/`) — MIT License (GPL-compatible). Copyright Paweł Kuna. https://github.com/tabler/tabler-icons — See `assets/tabler-icons/LICENSE`.
* **@wordpress/scripts** build output — GPLv2 or later (WordPress ecosystem). https://github.com/WordPress/gutenberg/tree/trunk/packages/scripts

Development-only tools (npm packages used at build time, not included in the plugin ZIP) are not distributed with this plugin.

== External services ==

This plugin is an omnichannel messaging inbox. It does **not** call any third-party API until a site administrator enables a channel and saves that channel's credentials in the plugin settings. No external requests are made on ordinary WordPress page loads for visitors; outbound API calls occur only when an authorized agent sends a message, when the plugin registers or checks a webhook, when optional auto-replies are sent, or when scheduled email polling runs (IMAP, if configured).

Inbound messages are delivered **to** your WordPress site by the messaging provider via webhooks you configure in each provider's dashboard. Those providers may send message content, sender identifiers, and profile metadata to your site.

The shared HTTP client (`wp_remote_request`) in the plugin is used to reach the services below.

= Telegram =

Used when the Telegram channel is enabled. The plugin calls the Telegram Bot API (`https://api.telegram.org/bot`) to register the inbound webhook, send outbound messages, send optional auto-replies, and fetch webhook status.

**Data sent:** bot token (in the request URL), recipient chat ID, message text, webhook URL pointing to your site, and optional webhook secret token.

**Service provided by Telegram FZ-LLC:** [Terms of Service](https://telegram.org/tos), [Privacy Policy](https://telegram.org/privacy).

= Meta Graph API (WhatsApp, Messenger, Instagram) =

Used when the WhatsApp, Messenger, or Instagram channel is enabled. The plugin calls the Meta Graph API (`https://graph.facebook.com/v19.0/`) to send outbound messages, send optional auto-replies, and look up sender profile information for inbound conversations.

**Data sent:** page or user access token, WhatsApp phone number ID (WhatsApp channel), recipient platform ID or phone number, message text, and API version path.

**Service provided by Meta Platforms, Inc.:** [Terms of Service](https://www.facebook.com/legal/terms), [Privacy Policy](https://www.facebook.com/privacy/policy). Developer platform terms: [Meta Platform Terms](https://developers.facebook.com/terms/). WhatsApp Business terms: [WhatsApp Business Terms](https://www.whatsapp.com/legal/business-terms).

= LINE =

Used when the LINE channel is enabled. The plugin calls the LINE Messaging API (`https://api.line.me/v2/bot/`) to send outbound messages and optional auto-replies.

**Data sent:** channel access token, recipient user ID, and message text.

**Service provided by LINE Corporation:** [Terms of Use](https://terms.line.me/line_terms), [Privacy Policy](https://line.me/en/terms/policy/).

= Viber =

Used when the Viber channel is enabled. The plugin calls the Viber REST API (`https://chatapi.viber.com/pa/`) to register the inbound webhook, send outbound messages, and send optional auto-replies.

**Data sent:** authentication token, recipient user ID, message text, and webhook URL pointing to your site.

**Service provided by Rakuten Viber:** [Terms of Use](https://www.viber.com/terms/), [Privacy Policy](https://www.viber.com/privacy/).

= WeChat =

Used when the WeChat channel is enabled. The plugin calls the WeChat Official Account API (`https://api.weixin.qq.com/cgi-bin/`) to obtain access tokens, look up user profiles, and send outbound messages.

**Data sent:** app ID, app secret, access token, recipient open ID, and message text.

**Service provided by Tencent:** [Terms of Service](https://www.wechat.com/en/service_terms.html), [Privacy Policy](https://www.wechat.com/en/privacy_policy.html).

= SMS providers =

Used when the SMS channel is enabled. Exactly one provider is used, based on the administrator's choice in settings. The plugin sends outbound SMS and may send optional auto-replies through the selected API.

**Twilio** (`https://api.twilio.com/2010-04-01/Accounts/`) — **Data sent:** account SID, auth token, from number, recipient phone number, and message text. **Service provided by Twilio Inc.:** [Terms of Service](https://www.twilio.com/en-us/legal/tos), [Privacy Policy](https://www.twilio.com/en-us/legal/privacy).

**Vonage** (`https://rest.nexmo.com/sms/json`) — **Data sent:** API key, API secret, from number, recipient phone number, and message text. **Service provided by Vonage Holdings Corp.:** [Terms of Use](https://www.vonage.com/legal/communications-apis/terms-of-use/), [Privacy Policy](https://www.vonage.com/privacy-policy/).

**Sinch** (`https://us.sms.api.sinch.com/xms/v1/`) — **Data sent:** service plan ID, API token, from number, recipient phone number, and message text. **Service provided by Sinch AB:** [Terms and Conditions](https://www.sinch.com/terms-and-conditions/), [Privacy Policy](https://www.sinch.com/privacy-policy/).

**Plivo** (`https://api.plivo.com/v1/Account/`) — **Data sent:** auth ID, auth token, from number, recipient phone number, and message text. **Service provided by Plivo Inc.:** [Terms of Service](https://www.plivo.com/legal/tos/), [Privacy Policy](https://www.plivo.com/legal/privacy/).

**Telnyx** (`https://api.telnyx.com/v2/messages`) — **Data sent:** API key, from number, recipient phone number, and message text. **Service provided by Telnyx LLC:** [Terms and Conditions](https://telnyx.com/terms-and-conditions), [Privacy Policy](https://telnyx.com/privacy-policy).

**MessageBird** (`https://rest.messagebird.com/messages`) — **Data sent:** access key, originator number, recipient phone number, and message text. **Service provided by Bird (MessageBird):** [Terms of Service](https://messagebird.com/en/legal/terms), [Privacy Policy](https://messagebird.com/en/legal/privacy).

= Email (administrator-configured) =

The email channel does not use a fixed third-party API endpoint. When enabled, the site administrator supplies their own SMTP and/or IMAP server hostname and credentials. The plugin connects only to those administrator-configured mail servers to send outbound email or poll for inbound messages (every 5 minutes via WordPress cron, when IMAP is configured).

Inbound email may also be pushed to your site via a webhook URL you configure in an inbound-parse or route service chosen by the site administrator. Common options include:

**Mailgun** — **Data sent:** sender/recipient addresses, subject, message body, and attachments (as configured in your Mailgun route). **Service provided by Sinch Mailgun:** [Terms of Service](https://www.mailgun.com/legal/terms-of-service/), [Privacy Policy](https://www.mailgun.com/legal/privacy-policy/).

**SendGrid** — **Data sent:** sender/recipient addresses, subject, message body, and attachments (as configured in your Inbound Parse webhook). **Service provided by Twilio SendGrid:** [Terms of Service](https://www.twilio.com/en-us/legal/tos), [Privacy Policy](https://www.twilio.com/en-us/legal/privacy).

**Postmark** — **Data sent:** sender/recipient addresses, subject, and message body (as configured in your Postmark inbound webhook). **Service provided by ActiveCampaign, LLC (Postmark):** [Terms of Service](https://postmarkapp.com/terms-of-service), [Privacy Policy](https://postmarkapp.com/privacy-policy).

**SparkPost** — **Data sent:** sender/recipient addresses, subject, and message body (as configured in your SparkPost relay webhook). **Service provided by Message Systems, LLC (SparkPost):** [Terms of Use](https://www.sparkpost.com/policies/tos/), [Privacy Policy](https://www.sparkpost.com/policies/privacy/).

**Data sent (general):** depends on the mail server or inbound-parse provider the administrator configures (typically sender/recipient addresses, subject, and message body).

== Installation ==

1. Upload the plugin files to `/wp-content/plugins/kinetix-messaging-by-ppros`, or install through the WordPress plugins screen.
2. Activate the plugin through the Plugins screen in WordPress.
3. Open **Kinetix Messaging → Inbox** and configure your channel settings.

== Screenshots ==

1. Unified inbox — all conversations in one WordPress admin screen.
2. Channel settings — connect WhatsApp, Telegram, email, SMS, and more.
3. Conversation view — read and reply without leaving WordPress.

== Frequently Asked Questions ==

= Can I debug my messaging channel on a local machine? =

No — messaging platforms (Telegram, Meta, LINE, Viber, WeChat) deliver inbound messages via webhooks, which require a **publicly reachable HTTPS URL**. A local machine (`localhost`, `127.0.0.1`, `.test`, `.local`) is not reachable from the public internet, so inbound webhook deliveries will fail silently.

To test locally, use a tunnel tool to expose your machine temporarily:

* **ngrok** — `ngrok http 80` gives you a public HTTPS URL.
* **Cloudflare Tunnel** — `cloudflared tunnel --url http://localhost:80`.
* **Expose** — `expose share http://localhost`.

After starting the tunnel, update **WordPress → Settings → General → Site URL** to the tunnel HTTPS address, flush permalinks, and re-register the webhook for your channel.

= Can I debug my messaging channel on a subdomain? =

Yes — a public subdomain works well for staging or development, as long as:

1. The subdomain resolves over **HTTPS** with a valid SSL certificate. Self-signed certificates are rejected by all platforms.
2. Port 443 is open and reachable from the public internet (not behind a VPN or corporate firewall).
3. No WAF, CDN rule, or security plugin is blocking unauthenticated POST requests to `/wp-json/kmbp/v1/webhooks/*`.

If your staging subdomain shares a server with production, ensure `WP_HOME` and `WP_SITEURL` in `wp-config.php` (or Settings → General) point to the correct subdomain so that the REST URL used for webhooks is accurate.

= What should I check if I can't get Messenger and WhatsApp working? =

Both channels run on the Meta Graph API. Work through this checklist:

1. **Verify Token mismatch** — the token in Settings → WhatsApp/Messenger must exactly match the one entered in the Meta App → Webhooks configuration. Copy-paste it; do not retype.
2. **Webhook fields not subscribed** — in Meta App → Products → WhatsApp (or Messenger) → Configuration → Webhooks, make sure `messages` and `messaging_postbacks` are subscribed.
3. **App in Development mode** — while in Development mode only admins and testers of the Meta App can send messages. Submit for App Review to go live with real users.
4. **Short-lived access token** — user tokens expire after ~60 days. Generate a **System User permanent token** in Meta Business Settings → System Users.
5. **Wrong App Secret** — the App Secret validates the `X-Hub-Signature-256` header on every inbound webhook. A mismatched secret causes the plugin to silently reject all incoming messages. Double-check it in Settings → WhatsApp → API Setup.
6. **Phone Number ID vs. WABAID** (WhatsApp only) — the Phone Number ID and WABA ID are different values. Check both in Meta Business Manager → WhatsApp → API Setup.

= How do I add a messaging button to my WordPress pages? =

Use the built-in shortcode **`[kmbp_channel_button channel="whatsapp"]`**. Open **Kinetix Messaging → Settings → (any channel) → Share & Embed** to get the exact shortcode for that channel, with one-click copy. The panel also shows ready-to-paste snippets for:

* **Gutenberg** — add a Shortcode block and paste.
* **Elementor** — drag the Shortcode widget and paste.

Optional attributes: `label="Chat with us"`, `style="link"` (plain anchor instead of pill button), `class="my-class"`.

= Can multiple agents use the inbox at the same time? =

Yes. Assign the built-in **Messaging Agent** role (or the `kmbp_access_messaging` capability) to as many team members as needed. Each agent logs into WordPress independently and opens the Kinetix Messaging inbox. Conversations can be assigned to specific agents via the right-hand panel in the conversation view. The inbox polls for new messages every 8 seconds so all agents see updates in near-real time without refreshing.

= How do I send automated welcome or auto-reply messages? =

Most channels have a dedicated auto-reply option in their settings panel:

* **All channels** — enable the **Auto-reply** toggle and write your message in the text field that appears. The message is sent automatically when a new conversation starts.
* **Telegram** — enable **Auto-reply on /start** in Settings → Telegram → Features. The welcome message fires when a user first sends `/start` to your bot.
* **Messenger / Instagram** — set a greeting in the **Automation** tab.
* **Email** — configure the auto-reply subject and body in Settings → Email → Templates.

== Changelog ==

= 1.0.7 =
* Fix inbound IMAP messages using quoted-printable or base64 transfer encoding never being decoded, due to incorrect PHP IMAP encoding constants — a major cause of emails silently failing to sync or storing raw, unreadable content.
* Fix imported email HTML rendering broken/mangled content: leaked `<style>`/`<script>` text (including `@media` blocks) appearing as visible text above messages, and garbled tag attributes left behind by double-processed quoted-printable content.
* Add a dedicated inbound-email HTML sanitizer that repairs quoted-printable corruption and strips leaked style/script residue before falling back to `wp_kses_post()`, instead of relying on `wp_kses_post()` alone.
* Add a one-time automatic migration that re-sanitizes all previously-stored email messages on update, so already-imported threads are repaired without waiting for a new message to arrive.
* Add scoped CSS for imported email HTML (tables, lists, images, links, blockquotes) so messages render with sane spacing and stay within the message bubble.
* Add manual "Sync now" button and background sync status panel to Settings → Email, with theme-aware styling so it's visible in both light and dark mode.
* Switch IMAP polling to a UID-based incremental sync so already-read messages fetched by other mail clients are no longer missed.
* Add per-message error logging during IMAP polling instead of silently skipping failed messages.

= 1.0.6 =
* Confirm compatibility with WordPress 7.1 and update "Tested up to" to 7.1.

= 1.0.5 =
* Add Share & Embed panel to every channel settings page with a one-click copyable direct link (WhatsApp wa.me, Telegram t.me, Messenger m.me, etc.).
* Add `[kmbp_channel_button]` shortcode for embedding a branded channel button or link on any page, with Gutenberg block and Elementor widget instructions.
* Add delete message action in the conversation view (admin / settings-manager only).
* Add delete conversation (thread) action in the conversation list (admin / settings-manager only).
* Add dedicated REST endpoints: DELETE /kmbp/v1/messages/{id} and DELETE /kmbp/v1/conversations/{id}.
* Add FAQ section to readme.txt and the in-plugin Help page covering local/subdomain debugging, Messenger & WhatsApp troubleshooting, multi-agent usage, shortcode embeds, and auto-replies.
* Update plugin tags to include social-media, messenger, chat, and social for better discoverability.
* Fix ChannelSharePanel text contrast in light mode via React context theme propagation.
* Fix PHPCS warnings: unslash and sanitize $_SERVER header reads; escape RENAME TABLE identifiers with esc_sql().
* Update .distignore to exclude editor-tooling directories (.agents, .codex, .cursor) and empty legacy lang/ folder from release ZIP.

= 1.0.4 =
* Add delete conversation and delete message actions in the inbox (admin-only).
* Add REST endpoints to permanently remove threads and individual messages.
* Add Screenshots section to plugin readme.
* Sanitize webhook request headers read from the server environment.
* Harden legacy table rename migration for PHPCS compliance.

= 1.0.3 =
* Replace short `sme` prefix with `kmbp` for options, tables, capabilities, and REST namespace.
* Fix MessageBird legal URLs in readme.
* Remove remote image URLs from admin embed snippets.

= 1.0.2 =
* Address WordPress.org plugin review feedback (webhook permissions, enqueued admin CSS, menu position).

= 1.0.1 =
* Initial release.
* Document external messaging APIs and SMS providers in readme.
* Ship `src/` source and document build steps for compiled admin assets.
