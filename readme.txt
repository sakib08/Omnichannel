=== Kinetix Messaging by Ppros ===
Contributors: pluginpros
Tags: messaging, omnichannel, telegram, whatsapp, email
Requires at least: 6.0
Tested up to: 7.0
Requires PHP: 7.4
Stable tag: 1.0.1
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

**MessageBird** (`https://rest.messagebird.com/messages`) — **Data sent:** access key, originator number, recipient phone number, and message text. **Service provided by Bird:** [Terms](https://bird.com/en-uk/legal/terms), [Privacy Policy](https://bird.com/en-uk/legal/privacy).

= Email (administrator-configured) =

The email channel does not use a fixed third-party API endpoint. When enabled, the site administrator supplies their own SMTP and/or IMAP server hostname and credentials. The plugin connects only to those administrator-configured mail servers to send outbound email or poll for inbound messages (every 5 minutes via WordPress cron, when IMAP is configured). Inbound email may also be pushed to your site via a webhook URL you configure in services such as Mailgun, SendGrid, Postmark, or SparkPost; those providers are chosen and configured by the site administrator, not by this plugin.

**Data sent:** depends on the mail server or inbound-parse provider the administrator configures (typically sender/recipient addresses, subject, and message body).

== Installation ==

1. Upload the plugin files to `/wp-content/plugins/kinetix-messaging-by-ppros`, or install through the WordPress plugins screen.
2. Activate the plugin through the Plugins screen in WordPress.
3. Open **Kinetix Messaging → Inbox** and configure your channel settings.

== Changelog ==

= 1.0.1 =
* Initial release.
* Document external messaging APIs and SMS providers in readme.
* Ship `src/` source and document build steps for compiled admin assets.
