import { useState } from "react";
import { CodeSnippet, InfoBox, Input, Row, SectionDivider, Select, StatusBadge, TabBar, Textarea, Toggle } from "./shared.jsx";
import { TOKEN } from "./tokens.js";

export default function WhatsAppSettings({ cfg, setCfg }) {
  const [tab, setTab] = useState("api");
  const S = (k, v) => setCfg({ ...cfg, [k]: v });
  const color = TOKEN.whatsapp.color;
 
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${TOKEN.whatsapp.grad} flex items-center justify-center text-white font-black text-lg shadow-lg`}>W</div>
          <div>
            <h2 className="text-lg font-bold text-white">WhatsApp Business</h2>
            <p className="text-xs text-slate-400">Connect your WhatsApp Business API to the inbox</p>
          </div>
        </div>
        <StatusBadge connected={cfg.enabled} />
      </div>
 
      <TabBar
        tabs={[{ id: "api", label: "API Setup" }, { id: "webhook", label: "Webhook" }, { id: "widget", label: "Website Button" }, { id: "messaging", label: "Messaging" }, { id: "compliance", label: "Compliance" }]}
        active={tab} onChange={setTab} color={color}
      />
 
      {tab === "api" && (
        <div className="space-y-4">
          <InfoBox type="info">
            WhatsApp Business API is managed through Meta. Go to <strong>developers.facebook.com</strong> → create an app → add WhatsApp product → get your credentials.
          </InfoBox>
          <Row label="Enable WhatsApp" desc="Activate or pause the WhatsApp integration.">
            <Toggle checked={cfg.enabled} onChange={v => S("enabled", v)} color={color} />
          </Row>
          <div className="grid grid-cols-2 gap-4 pt-1">
            <div className="col-span-2">
              <Input label="WhatsApp Business Account ID (WABAID)" value={cfg.wabaid} onChange={v => S("wabaid", v)} placeholder="1234567890" mono helper="Found in Meta Business Manager → WhatsApp → Business Accounts." />
            </div>
            <div className="col-span-2">
              <Input label="Phone Number ID" value={cfg.phoneNumberId} onChange={v => S("phoneNumberId", v)} placeholder="Phone Number ID from Meta dashboard" mono />
            </div>
            <div className="col-span-2">
              <Input label="Permanent Access Token" value={cfg.accessToken} onChange={v => S("accessToken", v)} placeholder="EAAxxxxxxxxxxxxxxxxxxxxxxx..." type="password" helper="Generate a system user token from Meta Business Settings for uninterrupted access." />
            </div>
            <Input label="Webhook Verify Token" value={cfg.verifyToken} onChange={v => S("verifyToken", v)} placeholder="your_webhook_verify_token" helper="Any secret string you choose." />
            <Input label="Display phone number" value={cfg.displayPhone} onChange={v => S("displayPhone", v)} placeholder="+1 555 000 0000" />
          </div>
          <Input label="Webhook URL — paste in Meta App → WhatsApp → Configuration" value="https://api.yourdomain.com/webhooks/whatsapp" readOnly mono />
          <div className="flex gap-3">
            <button style={{ background: color }} className="px-5 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity">Test connection</button>
          </div>
        </div>
      )}
 
      {tab === "webhook" && (
        <div className="space-y-4">
          <InfoBox type="tip">Subscribe to these webhook fields in Meta → WhatsApp → Configuration → Webhooks.</InfoBox>
          <Input label="Callback URL" value="https://api.yourdomain.com/webhooks/whatsapp" readOnly mono />
          <SectionDivider label="Required Webhook Fields" />
          <CodeSnippet lang="fields" code={"messages\nmessage_template_status_update\naccount_update\nphone_number_quality_update"} />
          <SectionDivider label="Sample Inbound Message" />
          <CodeSnippet lang="json" code={`{\n  "object": "whatsapp_business_account",\n  "entry": [{\n    "id": "${cfg.wabaid || "WABAID"}",\n    "changes": [{\n      "value": {\n        "messaging_product": "whatsapp",\n        "messages": [{ "from": "15551234567", "text": { "body": "Hello!" } }]\n      }\n    }]\n  }]\n}`} />
        </div>
      )}
 
      {tab === "widget" && (
        <div className="space-y-4">
          <InfoBox type="tip">Add a click-to-chat button on your website so visitors can open WhatsApp with your number pre-filled.</InfoBox>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input label="Pre-filled message" value={cfg.ctaMessage} onChange={v => S("ctaMessage", v)} placeholder="Hello! I'd like to chat with support." helper="Optional. Pre-fills the WhatsApp compose box." />
            </div>
            <Select label="Button style" value={cfg.btnStyle} onChange={v => S("btnStyle", v)} options={[
              { value: "floating", label: "Floating bubble (bottom-right)" },
              { value: "inline", label: "Inline banner" },
              { value: "none", label: "None (use snippet only)" },
            ]} />
            <Input label="Button label text" value={cfg.btnLabel} onChange={v => S("btnLabel", v)} placeholder="Chat on WhatsApp" />
          </div>
          <SectionDivider label="Click-to-Chat Link" />
          <Input label="Share this link" value={`https://wa.me/${(cfg.displayPhone||"15551234567").replace(/\D/g,"")}?text=${encodeURIComponent(cfg.ctaMessage||"Hello!")}`} readOnly mono />
          <SectionDivider label="Embed Snippet" />
          <CodeSnippet lang="html" code={`<!-- WhatsApp Chat Button -->\n<a href="https://wa.me/${(cfg.displayPhone||"15551234567").replace(/\D/g,"")}\n   ?text=${encodeURIComponent(cfg.ctaMessage||"Hello! I'd like to chat.")}\n   target="_blank" rel="noopener">\n  <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/WhatsApp.svg/479px-WhatsApp.svg.png"\n       alt="Chat on WhatsApp" height="48">\n</a>`} />
        </div>
      )}
 
      {tab === "messaging" && (
        <div className="space-y-1">
          <Row label="Read receipts" desc="Send read receipts when agent views a message.">
            <Toggle checked={cfg.readReceipts} onChange={v => S("readReceipts", v)} color={color} />
          </Row>
          <Row label="Allow media attachments" desc="Images, documents, audio, and video.">
            <Toggle checked={cfg.media} onChange={v => S("media", v)} color={color} />
          </Row>
          <Row label="Auto-assign new conversations" desc="Round-robin to online agents.">
            <Toggle checked={cfg.autoAssign} onChange={v => S("autoAssign", v)} color={color} />
          </Row>
          <Row label="Business hours only" desc="Reject inbound messages outside working hours.">
            <Toggle checked={cfg.bizHours} onChange={v => S("bizHours", v)} color={color} />
          </Row>
          <Row label="Auto-reply on new conversation" desc="Send an immediate acknowledgement to the customer.">
            <Toggle checked={cfg.autoReply} onChange={v => S("autoReply", v)} color={color} />
          </Row>
          {cfg.autoReply && (
            <div className="pt-2 pb-1">
              <Textarea label="Auto-reply message" value={cfg.autoReplyMsg} onChange={v => S("autoReplyMsg", v)} rows={3}
                placeholder={"Hi {{customer_name}}! 👋 We received your message and will reply shortly. Reference: #{{ticket_id}}"}
                helper="Tokens: {{customer_name}}, {{ticket_id}}" />
            </div>
          )}
          <div className="pt-3">
            <Select label="Default message template" value={cfg.template} onChange={v => S("template", v)} options={[
              { value: "none", label: "No default template" },
              { value: "greeting", label: "Greeting" },
              { value: "support_ack", label: "Support acknowledgement" },
              { value: "order_update", label: "Order update" },
            ]} />
          </div>
        </div>
      )}
 
      {tab === "compliance" && (
        <div className="space-y-4">
          <InfoBox type="warning">WhatsApp mandates explicit opt-in before sending marketing or outbound messages. Ensure your consent collection complies with WhatsApp Business Policy.</InfoBox>
          <SectionDivider label="Opt-Out Handling" />
          <Row label="Process STOP keyword" desc="Immediately opt out contacts who reply STOP.">
            <Toggle checked={cfg.optOut} onChange={v => S("optOut", v)} color={color} />
          </Row>
          <Row label="Process START keyword" desc="Re-subscribe contacts who reply START.">
            <Toggle checked={cfg.optIn} onChange={v => S("optIn", v)} color={color} />
          </Row>
          <SectionDivider label="10DLC / WABA Registration" />
          <InfoBox type="info">Complete business verification in Meta Business Manager before sending high-volume messages.</InfoBox>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Business Portfolio ID" value={cfg.businessId} onChange={v => S("businessId", v)} placeholder="Meta Business Portfolio ID" mono />
            <Input label="WABA Quality Tier" value={cfg.qualityTier} onChange={v => S("qualityTier", v)} placeholder="MEDIUM" readOnly />
          </div>
        </div>
      )}
    </div>
  );
}
 
/* ═══════════════════════════════════════════════════════════════════════════
   TELEGRAM SETTINGS
═══════════════════════════════════════════════════════════════════════════ */
