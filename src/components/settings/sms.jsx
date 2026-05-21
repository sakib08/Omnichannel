import { useState } from "react";
import { CodeSnippet, InfoBox, Input, Row, SectionDivider, Select, StatusBadge, TabBar, Textarea, Toggle, TOKEN } from "./shared";

export default function SmsSettings({ cfg, setCfg }) {
  const [tab, setTab] = useState("twilio");
  const S = (k, v) => setCfg({ ...cfg, [k]: v });
  const color = TOKEN.sms.color;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${TOKEN.sms.grad} flex items-center justify-center text-white font-black text-lg shadow-lg`}>S</div>
          <div>
            <h2 className="text-lg font-bold text-white">Twilio SMS</h2>
            <p className="text-xs text-slate-400">Connect Twilio Messaging to your unified inbox</p>
          </div>
        </div>
        <StatusBadge connected={cfg.enabled} />
      </div>

      <TabBar
        tabs={[
          { id: "twilio", label: "Twilio Setup" },
          { id: "numbers", label: "Numbers" },
          { id: "webhook", label: "Webhook" },
          { id: "messaging", label: "Messaging" },
          { id: "compliance", label: "Compliance" },
        ]}
        active={tab}
        onChange={setTab}
        color={color}
      />

      {tab === "twilio" && (
        <div className="space-y-4">
          <InfoBox type="info">
            Create or select a Twilio project, then copy the Account SID and Auth Token from the Twilio Console. For production traffic, use a Messaging Service SID when possible.
          </InfoBox>
          <Row label="Enable SMS" desc="Activate or pause the Twilio SMS integration.">
            <Toggle checked={cfg.enabled} onChange={v => S("enabled", v)} color={color} />
          </Row>
          <div className="grid grid-cols-2 gap-4 pt-1">
            <div className="col-span-2">
              <Input label="Account SID" value={cfg.accountSid} onChange={v => S("accountSid", v)} placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" mono helper="Find this in Twilio Console -> Account Info." />
            </div>
            <div className="col-span-2">
              <Input label="Auth Token" value={cfg.authToken} onChange={v => S("authToken", v)} placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" type="password" helper="Store this only on your backend. Never expose it in client code." />
            </div>
            <Input label="Default From Number" value={cfg.fromNumber} onChange={v => S("fromNumber", v)} placeholder="+15551234567" helper="A Twilio SMS-capable phone number." />
            <Input label="Messaging Service SID" value={cfg.messagingServiceSid} onChange={v => S("messagingServiceSid", v)} placeholder="MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" mono helper="Recommended for pools, opt-outs, and sender selection." />
          </div>
          <div className="flex gap-3 pt-2">
            <button style={{ background: color }} className="px-5 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity">
              Test Twilio connection
            </button>
            <button className="px-5 py-2 rounded-xl text-sm font-semibold text-slate-300 border border-slate-700 hover:bg-slate-800 transition-colors">
              Clear credentials
            </button>
          </div>
        </div>
      )}

      {tab === "numbers" && (
        <div className="space-y-4">
          <InfoBox type="tip">Use a Messaging Service for multiple senders, geo-matching, fallback numbers, and higher delivery reliability.</InfoBox>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Primary SMS number" value={cfg.primaryNumber} onChange={v => S("primaryNumber", v)} placeholder="+15551234567" />
            <Input label="Fallback SMS number" value={cfg.fallbackNumber} onChange={v => S("fallbackNumber", v)} placeholder="+15557654321" />
            <Select label="Sender strategy" value={cfg.senderStrategy} onChange={v => S("senderStrategy", v)} options={[
              { value: "service", label: "Messaging Service sender pool" },
              { value: "primary", label: "Always use primary number" },
              { value: "sticky", label: "Sticky sender per customer" },
            ]} />
            <Select label="Default region" value={cfg.region} onChange={v => S("region", v)} options={[
              { value: "US", label: "United States" },
              { value: "CA", label: "Canada" },
              { value: "GB", label: "United Kingdom" },
              { value: "BD", label: "Bangladesh" },
              { value: "global", label: "Global / auto" },
            ]} />
          </div>
          <SectionDivider label="Inbound Routing" />
          <Row label="Create new contact for unknown numbers" desc="If no customer exists, create one from the sender phone number.">
            <Toggle checked={cfg.createContacts} onChange={v => S("createContacts", v)} color={color} />
          </Row>
          <Row label="Match contacts by E.164 number" desc="Normalize incoming phone numbers before matching customers.">
            <Toggle checked={cfg.normalizeNumbers} onChange={v => S("normalizeNumbers", v)} color={color} />
          </Row>
        </div>
      )}

      {tab === "webhook" && (
        <div className="space-y-4">
          <InfoBox type="tip">
            In Twilio Console, set the incoming message webhook for your phone number or Messaging Service to this URL. Use HTTP POST and validate the Twilio signature server-side.
          </InfoBox>
          <Input label="Incoming Message Webhook" value="https://api.yourdomain.com/webhooks/twilio/sms" readOnly mono helper="Twilio sends inbound SMS events here." />
          <Input label="Status Callback URL" value="https://api.yourdomain.com/webhooks/twilio/status" readOnly mono helper="Delivery, failure, and read status callbacks are received here." />
          <SectionDivider label="Twilio Webhook Settings" />
          <CodeSnippet lang="twilio-console" code={"A message comes in: POST https://api.yourdomain.com/webhooks/twilio/sms\nStatus callback URL: POST https://api.yourdomain.com/webhooks/twilio/status"} />
          <SectionDivider label="Sample Inbound Payload" />
          <CodeSnippet lang="form-urlencoded" code={`MessageSid=SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\nAccountSid=${cfg.accountSid || "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}\nFrom=+15550001111\nTo=${cfg.fromNumber || "+15551234567"}\nBody=Hello, I need help with my order`} />
        </div>
      )}

      {tab === "messaging" && (
        <div className="space-y-5">
          <SectionDivider label="Conversation Behavior" />
          <Row label="Auto-assign new SMS threads" desc="Distribute new SMS conversations to available agents.">
            <Toggle checked={cfg.autoAssign} onChange={v => S("autoAssign", v)} color={color} />
          </Row>
          <Row label="Send delivery receipts to agents" desc="Show sent, delivered, failed, and undelivered states in the inbox.">
            <Toggle checked={cfg.deliveryReceipts} onChange={v => S("deliveryReceipts", v)} color={color} />
          </Row>
          <Row label="Allow MMS attachments" desc="Accept and send media messages when supported by the sender country and number.">
            <Toggle checked={cfg.mms} onChange={v => S("mms", v)} color={color} />
          </Row>
          <Row label="Auto-reply on first inbound SMS" desc="Send an immediate acknowledgement when a customer texts for the first time.">
            <Toggle checked={cfg.autoReply} onChange={v => S("autoReply", v)} color={color} />
          </Row>
          {cfg.autoReply && (
            <Textarea
              label="Auto-reply message"
              value={cfg.autoReplyMsg}
              onChange={v => S("autoReplyMsg", v)}
              rows={3}
              placeholder="Thanks for texting support. We received your message and will reply shortly. Reply STOP to opt out."
              helper="Keep SMS copy short. Long messages may be split into multiple segments."
            />
          )}
          <div className="grid grid-cols-2 gap-4">
            <Input label="Segment warning threshold" value={cfg.segmentWarning} onChange={v => S("segmentWarning", v)} placeholder="2" suffix="segments" />
            <Select label="Encoding preference" value={cfg.encoding} onChange={v => S("encoding", v)} options={[
              { value: "auto", label: "Auto-detect GSM-7 / Unicode" },
              { value: "gsm7", label: "Prefer GSM-7" },
              { value: "unicode", label: "Allow Unicode" },
            ]} />
          </div>
        </div>
      )}

      {tab === "compliance" && (
        <div className="space-y-4">
          <InfoBox type="warning">Only send SMS to contacts who consented to receive messages. Configure STOP/START handling and include required business identification where applicable.</InfoBox>
          <SectionDivider label="Opt-Out Handling" />
          <Row label="Process STOP keyword" desc="Automatically opt out contacts who reply STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, or QUIT.">
            <Toggle checked={cfg.optOut} onChange={v => S("optOut", v)} color={color} />
          </Row>
          <Row label="Process START keyword" desc="Allow customers to re-subscribe by replying START.">
            <Toggle checked={cfg.optIn} onChange={v => S("optIn", v)} color={color} />
          </Row>
          <Textarea label="STOP confirmation message" value={cfg.stopMessage} onChange={v => S("stopMessage", v)} rows={2} placeholder="You are unsubscribed and will no longer receive messages. Reply START to resubscribe." />
          <SectionDivider label="Registration" />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Traffic type" value={cfg.trafficType} onChange={v => S("trafficType", v)} options={[
              { value: "support", label: "Customer support" },
              { value: "transactional", label: "Transactional" },
              { value: "marketing", label: "Marketing" },
            ]} />
            <Input label="A2P 10DLC campaign SID" value={cfg.campaignSid} onChange={v => S("campaignSid", v)} placeholder="QE..." mono helper="Required for many US application-to-person SMS use cases." />
          </div>
        </div>
      )}
    </div>
  );
}
