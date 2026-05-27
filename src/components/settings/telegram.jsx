import { useState } from "react";
import { CodeSnippet, InfoBox, Input, Row, SectionDivider, Select, StatusBadge, TabBar, Textarea, Toggle } from "./shared.jsx";
import { TOKEN } from "./tokens.js";

export default function TelegramSettings({ cfg, setCfg }) {
  const [tab, setTab] = useState("bot");
  const S = (k, v) => setCfg({ ...cfg, [k]: v });
  const color = TOKEN.telegram.color;
 
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${TOKEN.telegram.grad} flex items-center justify-center text-white font-black text-lg shadow-lg`}>T</div>
          <div>
            <h2 className="text-lg font-bold text-white">Telegram Bot</h2>
            <p className="text-xs text-slate-400">Connect a bot via BotFather and embed it on your site</p>
          </div>
        </div>
        <StatusBadge connected={cfg.enabled} />
      </div>
 
      <TabBar
        tabs={[{ id: "bot", label: "Bot Setup" }, { id: "webhook", label: "Webhook" }, { id: "widget", label: "Website Widget" }, { id: "features", label: "Features" }, { id: "advanced", label: "Advanced" }]}
        active={tab} onChange={setTab} color={color}
      />
 
      {tab === "bot" && (
        <div className="space-y-4">
          <InfoBox type="tip">
            Open Telegram → search <strong>@BotFather</strong> → type <code className="font-mono text-sky-300">/newbot</code> → follow the steps → copy the token below.
          </InfoBox>
          <Row label="Enable Telegram" desc="Activate or pause the Telegram integration.">
            <Toggle checked={cfg.enabled} onChange={v => S("enabled", v)} color={color} />
          </Row>
          <div className="grid grid-cols-2 gap-4 pt-1">
            <div className="col-span-2">
              <Input label="Bot Token" value={cfg.botToken} onChange={v => S("botToken", v)} placeholder="123456789:ABCDEFxxxxxxxxxxxxxxxxxxxxxxx" type="password" mono helper="Keep secret. Anyone with this token can control your bot." />
            </div>
            <Input label="Bot username" value={cfg.botUsername} onChange={v => S("botUsername", v)} placeholder="@YourSupportBot" helper="The @handle you chose in BotFather." />
            <Input label="Bot display name" value={cfg.botName} onChange={v => S("botName", v)} placeholder="Acme Support" />
          </div>
          <SectionDivider label="BotFather Commands (run these in BotFather)" />
          <CodeSnippet lang="botfather" code={`/setdescription\nHelp & support for Acme Inc. Reply any time.\n\n/setabouttext\nPowered by Acme Support\n\n/setuserpic\n[Upload your brand logo]\n\n/setcommands\nstart - Start a conversation\nhelp - Get help\nstatus - Check your ticket status`} />
          <div className="flex gap-3">
            <button style={{ background: color }} className="px-5 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity">Verify bot token</button>
          </div>
        </div>
      )}
 
      {tab === "webhook" && (
        <div className="space-y-4">
          <InfoBox type="info">Telegram uses webhooks to push messages to your server. You must register the webhook URL using the Telegram Bot API.</InfoBox>
          <Input label="Your webhook URL" value="https://api.yourdomain.com/webhooks/telegram" readOnly mono />
          <SectionDivider label="Register Webhook — Run this command" />
          <CodeSnippet lang="bash" code={`curl -X POST \\\n  https://api.telegram.org/bot${cfg.botToken||"<YOUR_BOT_TOKEN>"}/setWebhook \\\n  -d "url=https://api.yourdomain.com/webhooks/telegram" \\\n  -d "secret_token=your_secret_here" \\\n  -d "allowed_updates=[message,callback_query]"`} />
          <SectionDivider label="Verify Webhook Status" />
          <CodeSnippet lang="bash" code={`curl https://api.telegram.org/bot${cfg.botToken||"<YOUR_BOT_TOKEN>"}/getWebhookInfo`} />
          <SectionDivider label="Sample Update Object" />
          <CodeSnippet lang="json" code={`{\n  "update_id": 123456789,\n  "message": {\n    "message_id": 1,\n    "from": { "id": 987654, "first_name": "Sarah" },\n    "chat": { "id": 987654, "type": "private" },\n    "text": "Hello! I need help."\n  }\n}`} />
        </div>
      )}
 
      {tab === "widget" && (
        <div className="space-y-4">
          <InfoBox type="tip">Add a Telegram button on your website or app so visitors can open a chat with your bot instantly.</InfoBox>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Pre-filled message (optional)" value={cfg.startMessage} onChange={v => S("startMessage", v)} placeholder="Hello, I need support!" helper="Sent automatically when user clicks the button." />
            <Select label="Button style" value={cfg.widgetStyle} onChange={v => S("widgetStyle", v)} options={[
              { value: "floating", label: "Floating bubble (bottom-right)" },
              { value: "inline", label: "Inline text link" },
              { value: "banner", label: "Banner bar" },
            ]} />
            <Input label="Button label" value={cfg.btnLabel} onChange={v => S("btnLabel", v)} placeholder="Chat on Telegram" />
            <Select label="Widget position" value={cfg.widgetPos} onChange={v => S("widgetPos", v)} options={[
              { value: "bottom-right", label: "Bottom right" },
              { value: "bottom-left", label: "Bottom left" },
            ]} />
          </div>
          <SectionDivider label="Deep Link" />
          <Input label="Share this link" value={`https://t.me/${(cfg.botUsername||"YourBot").replace("@","")}?start=${encodeURIComponent(cfg.startMessage||"start")}`} readOnly mono />
          <SectionDivider label="Embed Snippet — Floating Button" />
          <CodeSnippet lang="html" code={`<!-- Telegram floating chat button -->\n<style>\n  .tg-btn {\n    position: fixed; bottom: 24px; right: 24px; z-index: 9999;\n    background: #229ED9; color: #fff; border-radius: 50px;\n    padding: 12px 20px; font-family: sans-serif; font-size: 14px;\n    font-weight: 600; text-decoration: none;\n    box-shadow: 0 4px 16px rgba(34,158,217,.4);\n  }\n</style>\n<a class="tg-btn"\n   href="https://t.me/${(cfg.botUsername||"YourBot").replace("@","")}"\n   target="_blank">\n  💬 ${cfg.btnLabel||"Chat on Telegram"}\n</a>`} />
          <SectionDivider label="Login Widget (Authenticate users via Telegram)" />
          <CodeSnippet lang="html" code={`<script async src="https://telegram.org/js/telegram-widget.js?22"\n  data-telegram-login="${(cfg.botUsername||"YourBot").replace("@","")}"\n  data-size="large"\n  data-auth-url="https://yoursite.com/auth/telegram"\n  data-request-access="write">\n</script>`} />
        </div>
      )}
 
      {tab === "features" && (
        <div className="space-y-1">
          <Row label="Allow group conversations" desc="Handle messages from Telegram groups and supergroups.">
            <Toggle checked={cfg.allowGroups} onChange={v => S("allowGroups", v)} color={color} />
          </Row>
          <Row label="Typing indicator" desc="Send a typing action while agent composes a reply.">
            <Toggle checked={cfg.typingIndicator} onChange={v => S("typingIndicator", v)} color={color} />
          </Row>
          <Row label="Parse Markdown in replies" desc="Enable bold, italic, inline code, links in agent messages.">
            <Toggle checked={cfg.markdown} onChange={v => S("markdown", v)} color={color} />
          </Row>
          <Row label="Auto-reply on /start" desc="Send a welcome message when a user first starts the bot.">
            <Toggle checked={cfg.startReply} onChange={v => S("startReply", v)} color={color} />
          </Row>
          {cfg.startReply && (
            <div className="pt-2 pb-3">
              <Textarea label="Welcome message" value={cfg.startMsg} onChange={v => S("startMsg", v)} rows={3}
                placeholder={"👋 Hi there! Welcome to Acme Support.\n\nHow can we help you today?"} />
            </div>
          )}
          <Row label="Inline keyboards" desc="Use button grids in bot replies for structured options.">
            <Toggle checked={cfg.inlineKeyboard} onChange={v => S("inlineKeyboard", v)} color={color} />
          </Row>
          <Row label="Allow file uploads" desc="Accept files and documents sent by customers.">
            <Toggle checked={cfg.fileUpload} onChange={v => S("fileUpload", v)} color={color} />
          </Row>
          <Row label="Auto-assign new conversations" desc="Distribute to agents using round-robin.">
            <Toggle checked={cfg.autoAssign} onChange={v => S("autoAssign", v)} color={color} />
          </Row>
        </div>
      )}
 
      {tab === "advanced" && (
        <div className="space-y-4">
          <SectionDivider label="Commands" />
          <Textarea label="Bot command list (sent to BotFather via /setcommands)" value={cfg.commands} onChange={v => S("commands", v)} rows={6} mono
            placeholder={"start - Start a new conversation\nhelp - Get help and FAQs\nstatus - Check your ticket status\ncancel - Cancel current action"} />
          <SectionDivider label="Rate Limiting" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Max messages per second (global)" value={cfg.rateGlobal} onChange={v => S("rateGlobal", v)} placeholder="30" suffix="msg/s" />
            <Input label="Max messages per chat per second" value={cfg.ratePerChat} onChange={v => S("ratePerChat", v)} placeholder="1" suffix="msg/s" helper="Telegram enforces this limit." />
          </div>
          <SectionDivider label="Privacy & Data" />
          <Row label="Delete messages after conversation closed" desc="Remove message history from Telegram after resolution.">
            <Toggle checked={cfg.deleteClosed} onChange={v => S("deleteClosed", v)} color={color} />
          </Row>
          <Row label="Anonymise customer IDs in logs" desc="Replace Telegram user IDs with internal reference IDs in exported logs.">
            <Toggle checked={cfg.anonymise} onChange={v => S("anonymise", v)} color={color} />
          </Row>
        </div>
      )}
    </div>
  );
}
