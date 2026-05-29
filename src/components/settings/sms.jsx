import { useState } from "react";
import { InfoBox, Input, Row, SectionDivider, Select, StatusBadge, TabBar, Textarea, Toggle } from "./shared.jsx";
import { TOKEN } from "./tokens.js";
import { webhookUrl } from "../../api/client.js";

export default function SmsSettings({ cfg, setCfg }) {
  const [tab, setTab] = useState("connection");
  const S = (k, v) => setCfg({ ...cfg, [k]: v });
  const color = TOKEN.sms.color;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${TOKEN.sms.grad} flex items-center justify-center text-white font-black text-lg shadow-lg`}>S</div>
          <div>
            <h2 className="text-lg font-bold text-white">SMS</h2>
            <p className="text-xs text-slate-400">Connect your SMS provider to the unified inbox</p>
          </div>
        </div>
        <StatusBadge connected={cfg.enabled} />
      </div>

      <TabBar
        tabs={[
          { id: "connection", label: "Connection" },
          { id: "numbers", label: "Phone Numbers" },
          { id: "messaging", label: "Messaging" },
          { id: "compliance", label: "Compliance" },
          { id: "advanced", label: "Advanced" },
        ]}
        active={tab}
        onChange={setTab}
        color={color}
      />

      {tab === "connection" && (
        <div className="space-y-4">
          <InfoBox type="info">
            Connect your SMS provider to send and receive text messages. The platform supports Twilio, Vonage, MessageBird, Sinch, and Plivo.
          </InfoBox>
          <Row label="SMS channel enabled" desc="Toggle the entire SMS channel on or off.">
            <Toggle checked={cfg.enabled} onChange={v => S("enabled", v)} color={color} />
          </Row>
          <Select label="SMS provider" value={cfg.provider} onChange={v => S("provider", v)} options={[
            { value: "twilio", label: "Twilio" },
            { value: "vonage", label: "Vonage (Nexmo)" },
            { value: "messagebird", label: "MessageBird" },
            { value: "sinch", label: "Sinch" },
            { value: "plivo", label: "Plivo" },
            { value: "telnyx", label: "Telnyx" },
          ]} />

          {cfg.provider === "twilio" && (
            <div className="grid grid-cols-2 gap-4 pt-1">
              <div className="col-span-2">
                <Input label="Account SID" value={cfg.accountSid} onChange={v => S("accountSid", v)} placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" mono helper="Found on the Twilio Console dashboard." />
              </div>
              <div className="col-span-2">
                <Input label="Auth Token" value={cfg.authToken} onChange={v => S("authToken", v)} placeholder="••••••••••••••••••••••••••••••••" type="password" helper="Keep this secret. Never expose it client-side." />
              </div>
              <div className="col-span-2">
                <Input label="Webhook URL — paste in Twilio Console → Phone Numbers → Messaging" value={webhookUrl("sms")} readOnly mono helper="Twilio will POST inbound SMS to this URL." />
              </div>
            </div>
          )}
          {cfg.provider === "vonage" && (
            <div className="grid grid-cols-2 gap-4 pt-1">
              <Input label="API Key" value={cfg.vonageKey} onChange={v => S("vonageKey", v)} placeholder="Vonage API Key" />
              <Input label="API Secret" value={cfg.vonageSecret} onChange={v => S("vonageSecret", v)} placeholder="••••••••" type="password" />
              <div className="col-span-2">
                <Input label="Inbound Webhook URL" value={webhookUrl("sms")} readOnly mono />
              </div>
            </div>
          )}
          {(cfg.provider === "messagebird" || cfg.provider === "sinch" || cfg.provider === "plivo" || cfg.provider === "telnyx") && (
            <div className="grid grid-cols-2 gap-4 pt-1">
              <Input label="API Key / Auth ID" value={cfg.genericKey} onChange={v => S("genericKey", v)} placeholder="API Key" />
              <Input label="API Secret" value={cfg.genericSecret} onChange={v => S("genericSecret", v)} placeholder="••••••••" type="password" />
              <div className="col-span-2">
                <Input label="Webhook URL" value={webhookUrl("sms")} readOnly mono />
              </div>
            </div>
          )}
          <div className="flex gap-3">
            <button style={{ background: color }} className="px-5 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity">Test connection</button>
          </div>
        </div>
      )}

      {tab === "numbers" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input label="Default sending number" value={cfg.fromNumber} onChange={v => S("fromNumber", v)} placeholder="+1 555 000 0000" helper="This number is shown as the sender when no agent-specific number is assigned." />
            </div>
            <Select label="Number type" value={cfg.numberType} onChange={v => S("numberType", v)} options={[
              { value: "local", label: "Local number (10DLC)" },
              { value: "toll_free", label: "Toll-free number" },
              { value: "short", label: "Short code" },
              { value: "alpha", label: "Alphanumeric sender ID" },
            ]} />
          </div>
          <Row label="Allow per-agent phone numbers" desc="Each agent can have a dedicated number for outbound SMS.">
            <Toggle checked={cfg.perAgentNumber} onChange={v => S("perAgentNumber", v)} color={color} />
          </Row>
          <Row label="Enable MMS (multimedia messages)" desc="Allow sending and receiving images, audio, and documents.">
            <Toggle checked={cfg.mms} onChange={v => S("mms", v)} color={color} />
          </Row>
        </div>
      )}

      {tab === "messaging" && (
        <div className="space-y-4">
          <SectionDivider label="Message Behaviour" />
          <Row label="Character count warning" desc="Warn agents when a message exceeds 160 characters (1 SMS credit).">
            <Toggle checked={cfg.charWarn} onChange={v => S("charWarn", v)} color={color} />
          </Row>
          <Row label="Auto-split long messages" desc="Split messages over 160 chars into multiple SMS segments automatically.">
            <Toggle checked={cfg.autoSplit} onChange={v => S("autoSplit", v)} color={color} />
          </Row>
          <Row label="Unicode message support" desc="Enable emoji and non-Latin characters (uses 70-char limit per segment).">
            <Toggle checked={cfg.unicode} onChange={v => S("unicode", v)} color={color} />
          </Row>
          <Row label="Delivery receipts" desc="Track delivery status (Sent → Delivered → Failed) per message.">
            <Toggle checked={cfg.delivery} onChange={v => S("delivery", v)} color={color} />
          </Row>
          <Row label="Retry failed messages" desc="Automatically retry undelivered messages up to 3 times.">
            <Toggle checked={cfg.retry} onChange={v => S("retry", v)} color={color} />
          </Row>

          <SectionDivider label="Auto-Reply & Templates" />
          <Row label="Send auto-reply on new SMS" desc="Acknowledge the customer immediately when a new SMS conversation starts.">
            <Toggle checked={cfg.autoReply} onChange={v => S("autoReply", v)} color={color} />
          </Row>
          {cfg.autoReply && (
            <Textarea
              label="Auto-reply message"
              value={cfg.autoReplyMsg}
              onChange={v => S("autoReplyMsg", v)}
              rows={3}
              placeholder="Hi! We received your message and will reply shortly. Reference: #{{ticket_id}}"
              helper="Tokens: {{agent_name}}, {{ticket_id}}. Max 160 characters."
            />
          )}
        </div>
      )}

      {tab === "compliance" && (
        <div className="space-y-4">
          <InfoBox type="warning">
            TCPA and GDPR require explicit consent before sending marketing SMS. Ensure your opt-in process is compliant.
          </InfoBox>
          <SectionDivider label="Opt-Out & Consent Management" />
          <Row label="Handle STOP / UNSUBSCRIBE keywords automatically" desc="Instantly opt out contacts and prevent future messages when they reply STOP.">
            <Toggle checked={cfg.optOut} onChange={v => S("optOut", v)} color={color} />
          </Row>
          <Row label="Handle START / SUBSCRIBE keywords" desc="Re-subscribe contacts who reply START after opting out.">
            <Toggle checked={cfg.optIn} onChange={v => S("optIn", v)} color={color} />
          </Row>
          <Row label="Handle HELP keyword" desc="Auto-send support information when a contact replies HELP.">
            <Toggle checked={cfg.helpKeyword} onChange={v => S("helpKeyword", v)} color={color} />
          </Row>
          {cfg.helpKeyword && (
            <Textarea
              label="HELP reply message"
              value={cfg.helpMsg}
              onChange={v => S("helpMsg", v)}
              rows={2}
              placeholder="For support, call 1-800-000-0000 or email support@acme.com. Reply STOP to unsubscribe."
            />
          )}
          <Row label="Quiet hours" desc="Block outbound SMS during specified hours to comply with regulations.">
            <Toggle checked={cfg.quietHours} onChange={v => S("quietHours", v)} color={color} />
          </Row>
          {cfg.quietHours && (
            <div className="grid grid-cols-2 gap-4">
              <Input label="Do not disturb from" value={cfg.quietFrom} onChange={v => S("quietFrom", v)} placeholder="21:00" />
              <Input label="Do not disturb until" value={cfg.quietUntil} onChange={v => S("quietUntil", v)} placeholder="09:00" />
            </div>
          )}

          <SectionDivider label="10DLC Registration (US only)" />
          <InfoBox type="info">
            US carriers require all A2P SMS to be registered under 10DLC. Complete this in your Twilio / provider console and paste the IDs here.
          </InfoBox>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Brand registration ID (BID)" value={cfg.brandId} onChange={v => S("brandId", v)} placeholder="BxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxX" mono />
            <Input label="Campaign ID (CNO)" value={cfg.campaignId} onChange={v => S("campaignId", v)} placeholder="CxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxX" mono />
          </div>
        </div>
      )}

      {tab === "advanced" && (
        <div className="space-y-4">
          <SectionDivider label="Routing" />
          <Row label="Auto-assign incoming SMS" desc="Round-robin assignment to available agents.">
            <Toggle checked={cfg.autoAssign} onChange={v => S("autoAssign", v)} color={color} />
          </Row>
          <Row label="Business hours only" desc="Only accept inbound SMS during configured business hours.">
            <Toggle checked={cfg.bizHours} onChange={v => S("bizHours", v)} color={color} />
          </Row>
          <Row label="Create new conversation per session" desc="Start a fresh conversation if last session was closed more than 24 hours ago.">
            <Toggle checked={cfg.sessionReset} onChange={v => S("sessionReset", v)} color={color} />
          </Row>
        </div>
      )}
    </div>
  );
}
