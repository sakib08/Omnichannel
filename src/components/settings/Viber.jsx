import { useState } from "react";
import { CodeSnippet, InfoBox, Input, Row, SectionDivider, Select, StatusBadge, TabBar, Textarea, Toggle, TOKEN } from "./shared.jsx";
import { webhookUrl } from "../../api/client.js";
export default function ViberSettings({ cfg, setCfg }) {
  const [tab, setTab] = useState("bot");
  const S = (key, value) => setCfg({ ...cfg, [key]: value });
  const color = TOKEN.viber.color;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${TOKEN.viber.grad} flex items-center justify-center text-white font-black text-lg shadow-lg`}>V</div>
          <div>
            <h2 className="text-lg font-bold text-white">Viber Bot</h2>
            <p className="text-xs text-slate-400">Connect Viber Business Messages or a bot account</p>
          </div>
        </div>
        <StatusBadge connected={cfg.enabled} />
      </div>

      <TabBar
        tabs={[
          { id: "bot", label: "Bot Setup" },
          { id: "webhook", label: "Webhook" },
          { id: "sender", label: "Sender" },
          { id: "messaging", label: "Messaging" },
        ]}
        active={tab}
        onChange={setTab}
        color={color}
      />

      {tab === "bot" && (
        <div className="space-y-4">
          <InfoBox type="info">Create a Viber bot or Business Messages sender, then paste the authentication token and sender details here.</InfoBox>
          <Row label="Enable Viber" desc="Activate or pause the Viber integration.">
            <Toggle checked={cfg.enabled} onChange={value => S("enabled", value)} color={color} />
          </Row>
          <div className="grid grid-cols-2 gap-4 pt-1">
            <Input label="Bot name" value={cfg.botName} onChange={value => S("botName", value)} placeholder="Acme Support" />
            <Input label="Sender ID" value={cfg.senderId} onChange={value => S("senderId", value)} placeholder="acme_support" mono />
            <div className="col-span-2">
              <Input label="Authentication Token" value={cfg.authToken} onChange={value => S("authToken", value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" type="password" helper="Keep this token private and use it from your backend." />
            </div>
          </div>
          <button style={{ background: color }} className="px-5 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity">Test Viber token</button>
        </div>
      )}

      {tab === "webhook" && (
        <div className="space-y-4">
          <InfoBox type="tip">Register this webhook endpoint with Viber so inbound messages and delivery statuses reach your inbox.</InfoBox>
          <Input label="Webhook URL" value={webhookUrl("viber")} readOnly mono />
          <SectionDivider label="Register Webhook" />
          <CodeSnippet lang="bash" code={`curl -X POST https://chatapi.viber.com/pa/set_webhook \\\n  -H "X-Viber-Auth-Token: ${cfg.authToken || "<AUTH_TOKEN>"}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"url":"${webhookUrl("viber")}","event_types":["message","delivered","seen","failed"]}'`} />
          <SectionDivider label="Sample Inbound Payload" />
          <CodeSnippet lang="json" code={`{\n  "event": "message",\n  "sender": { "id": "viber-user-id", "name": "Customer" },\n  "message": { "type": "text", "text": "Hello, I need support" }\n}`} />
        </div>
      )}

      {tab === "sender" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Avatar URL" value={cfg.avatarUrl} onChange={value => S("avatarUrl", value)} placeholder="https://cdn.yourdomain.com/viber-avatar.png" />
            <Select label="Default region" value={cfg.region} onChange={value => S("region", value)} options={[
              { value: "global", label: "Global" },
              { value: "eu", label: "Europe" },
              { value: "mena", label: "Middle East and Africa" },
              { value: "apac", label: "Asia Pacific" },
            ]} />
          </div>
          <Row label="Fetch subscriber profile" desc="Store display name and avatar on first inbound message.">
            <Toggle checked={cfg.fetchProfile} onChange={value => S("fetchProfile", value)} color={color} />
          </Row>
          <Row label="Use sender fallback" desc="Fall back to SMS if a Viber delivery fails and a phone number is available.">
            <Toggle checked={cfg.smsFallback} onChange={value => S("smsFallback", value)} color={color} />
          </Row>
        </div>
      )}

      {tab === "messaging" && (
        <div className="space-y-4">
          <Row label="Delivery receipts" desc="Show sent, delivered, seen, and failed states in the inbox.">
            <Toggle checked={cfg.deliveryReceipts} onChange={value => S("deliveryReceipts", value)} color={color} />
          </Row>
          <Row label="Allow media attachments" desc="Accept images, files, stickers, and contact cards when supported.">
            <Toggle checked={cfg.media} onChange={value => S("media", value)} color={color} />
          </Row>
          <Row label="Auto-assign conversations" desc="Route new Viber messages to available agents.">
            <Toggle checked={cfg.autoAssign} onChange={value => S("autoAssign", value)} color={color} />
          </Row>
          <Textarea label="Auto-reply message" value={cfg.autoReplyMsg} onChange={value => S("autoReplyMsg", value)} rows={3} placeholder="Thanks for contacting support. We will reply shortly." />
        </div>
      )}
    </div>
  );
}
