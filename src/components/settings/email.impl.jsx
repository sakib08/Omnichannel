import { useState } from "react";
import { InfoBox, Input, Row, SectionDivider, Select, StatusBadge, TabBar, Textarea, Toggle } from "./shared.jsx";
import { TOKEN } from "./tokens.js";

export default function EmailSettings({ cfg, setCfg }) {
  const [tab, setTab] = useState("inbox");
  const S = (k, v) => setCfg({ ...cfg, [k]: v });
  const color = TOKEN.email.color;
 
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${TOKEN.email.grad} flex items-center justify-center text-white font-black text-lg shadow-lg`}>@</div>
          <div>
            <h2 className="text-lg font-bold text-white">Email Piping</h2>
            <p className="text-xs text-slate-400">Route incoming email into your unified inbox</p>
          </div>
        </div>
        <StatusBadge connected={cfg.enabled} />
      </div>
 
      <TabBar
        tabs={[{ id: "inbox", label: "Inbox" }, { id: "smtp", label: "SMTP" }, { id: "imap", label: "IMAP" }, { id: "templates", label: "Templates" }, { id: "dns", label: "DNS / SPF" }]}
        active={tab} onChange={setTab} color={color}
      />
 
      {tab === "inbox" && (
        <div className="space-y-4">
          <InfoBox type="info">Forward your support mailbox to the address below, or configure IMAP polling. No DNS change required for forwarding.</InfoBox>
          <Row label="Enable email channel" desc="Toggle the entire email integration on or off.">
            <Toggle checked={cfg.enabled} onChange={v => S("enabled", v)} color={color} />
          </Row>
          <div className="grid grid-cols-2 gap-4 pt-1">
            <Input label="Inbox name" value={cfg.inboxName} onChange={v => S("inboxName", v)} placeholder="Customer Support" />
            <Input label="Inbox email address" value={cfg.inboxEmail} onChange={v => S("inboxEmail", v)} placeholder="support@acme.com" helper="Customers write to this address." />
            <Input label="Sender display name" value={cfg.senderName} onChange={v => S("senderName", v)} placeholder="Acme Support Team" />
            <Input label="Reply-to address" value={cfg.replyTo} onChange={v => S("replyTo", v)} placeholder="noreply@acme.com" helper="Leave blank to use inbox address." />
          </div>
          <SectionDivider label="Email Forwarding / Piping" />
          <Input label="Forward-to address (copy into your mailbox forwarder)" value="inbound+acme@in.yourdomain.com" readOnly mono helper="Direct your email provider's forwarding rule to this address." />
          <Input label="Inbound webhook (alternative)" value="https://api.yourdomain.com/webhooks/email/inbound" readOnly mono />
        </div>
      )}
 
      {tab === "smtp" && (
        <div className="space-y-4">
          <InfoBox type="tip">Outgoing email is sent through your SMTP server. Use an app password for Gmail; use an API key as password for SendGrid or Mailgun.</InfoBox>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Select label="Provider preset" value={cfg.smtpPreset} onChange={v => S("smtpPreset", v)} options={[
                { value: "custom", label: "Custom / Self-hosted" },
                { value: "gmail", label: "Gmail  (smtp.gmail.com)" },
                { value: "outlook", label: "Outlook / Office 365" },
                { value: "sendgrid", label: "SendGrid" },
                { value: "mailgun", label: "Mailgun" },
                { value: "ses", label: "Amazon SES" },
                { value: "postmark", label: "Postmark" },
              ]} />
            </div>
            <Input label="SMTP host" value={cfg.smtpHost} onChange={v => S("smtpHost", v)} placeholder="smtp.gmail.com" />
            <Select label="Port / Encryption" value={cfg.smtpPort} onChange={v => S("smtpPort", v)} options={[
              { value: "587", label: "587 — STARTTLS (recommended)" },
              { value: "465", label: "465 — SSL/TLS" },
              { value: "25", label: "25 — Unencrypted" },
            ]} />
            <Input label="Username" value={cfg.smtpUser} onChange={v => S("smtpUser", v)} placeholder="you@acme.com" />
            <Input label="Password / API key" value={cfg.smtpPass} onChange={v => S("smtpPass", v)} placeholder="••••••••" type="password" />
          </div>
          <Row label="Enforce TLS" desc="Encrypt the SMTP connection. Strongly recommended.">
            <Toggle checked={cfg.smtpTls} onChange={v => S("smtpTls", v)} color={color} />
          </Row>
          <Row label="Verify SSL certificate" desc="Disable only for self-signed certs in development.">
            <Toggle checked={cfg.smtpVerifySsl} onChange={v => S("smtpVerifySsl", v)} color={color} />
          </Row>
          <button style={{ background: color }} className="mt-1 px-5 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity">
            Send test email
          </button>
        </div>
      )}
 
      {tab === "imap" && (
        <div className="space-y-4">
          <InfoBox type="info">IMAP polls your mailbox at a set interval and imports new messages. Use forwarding above for near-instant delivery.</InfoBox>
          <div className="grid grid-cols-2 gap-4">
            <Input label="IMAP host" value={cfg.imapHost} onChange={v => S("imapHost", v)} placeholder="imap.gmail.com" />
            <Select label="Port / Encryption" value={cfg.imapPort} onChange={v => S("imapPort", v)} options={[
              { value: "993", label: "993 — SSL/TLS (recommended)" },
              { value: "143", label: "143 — STARTTLS" },
            ]} />
            <Input label="Username" value={cfg.imapUser} onChange={v => S("imapUser", v)} placeholder="support@acme.com" />
            <Input label="Password" value={cfg.imapPass} onChange={v => S("imapPass", v)} placeholder="••••••••" type="password" />
            <Input label="Mailbox folder" value={cfg.imapFolder} onChange={v => S("imapFolder", v)} placeholder="INBOX" />
            <Select label="Poll interval" value={cfg.imapPoll} onChange={v => S("imapPoll", v)} options={[
              { value: "1", label: "Every 1 minute" }, { value: "2", label: "Every 2 minutes" },
              { value: "5", label: "Every 5 minutes" }, { value: "10", label: "Every 10 minutes" },
            ]} />
          </div>
          <Row label="Delete from mailbox after import" desc="Remove email from IMAP folder after it has been pulled.">
            <Toggle checked={cfg.imapDelete} onChange={v => S("imapDelete", v)} color={color} />
          </Row>
        </div>
      )}
 
      {tab === "templates" && (
        <div className="space-y-5">
          <SectionDivider label="Auto-Reply" />
          <Row label="Send auto-reply on new conversation" desc="Acknowledge customers the moment a new thread arrives.">
            <Toggle checked={cfg.autoReply} onChange={v => S("autoReply", v)} color={color} />
          </Row>
          {cfg.autoReply && (
            <>
              <Input label="Subject" value={cfg.autoReplySubject} onChange={v => S("autoReplySubject", v)} placeholder="We received your message — Ref #{{ticket_id}}" />
              <Textarea label="Body" value={cfg.autoReplyBody} onChange={v => S("autoReplyBody", v)} rows={5}
                placeholder={"Hi {{customer_name}},\n\nThank you for contacting us! Ticket #{{ticket_id}} has been created and we'll respond within 1 business day.\n\nBest,\n{{team_name}}"}
                helper="Tokens: {{customer_name}}, {{ticket_id}}, {{agent_name}}, {{team_name}}" />
            </>
          )}
          <SectionDivider label="Email Signature" />
          <Row label="Append signature to all replies" desc="Automatically added below every outgoing agent email.">
            <Toggle checked={cfg.signature} onChange={v => S("signature", v)} color={color} />
          </Row>
          {cfg.signature && (
            <Textarea value={cfg.signatureBody} onChange={v => S("signatureBody", v)} rows={4} placeholder={"Best regards,\nThe Support Team\nsupport@acme.com | +1 800 000 0000"} />
          )}
          <SectionDivider label="Out-of-Office" />
          <Row label="Enable out-of-office message" desc="Sent when email arrives outside business hours.">
            <Toggle checked={cfg.outOfOffice} onChange={v => S("outOfOffice", v)} color={color} />
          </Row>
          {cfg.outOfOffice && (
            <Textarea value={cfg.oooBody} onChange={v => S("oooBody", v)} rows={3} placeholder={"Thanks for your email! We're currently out of office and will respond on the next business day."} />
          )}
        </div>
      )}
 
      {tab === "dns" && (
        <div className="space-y-4">
          <InfoBox type="warning">Add these DNS TXT records to your domain to improve deliverability and prevent spoofing. Changes can take up to 48 hours to propagate.</InfoBox>
          <SectionDivider label="SPF Record" />
          <Input label="TXT record — add to your root domain (@)" value={"v=spf1 include:mail.yourdomain.com ~all"} readOnly mono helper="Authorises your mail server to send on behalf of your domain." />
          <SectionDivider label="DKIM Record" />
          <Input label="TXT record — host: mail._domainkey" value={"v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQ..."} readOnly mono />
          <SectionDivider label="DMARC Record" />
          <Input label="TXT record — host: _dmarc" value={"v=DMARC1; p=quarantine; rua=mailto:dmarc@acme.com"} readOnly mono />
          <SectionDivider label="MX Record (for email piping)" />
          <Input label="MX record — host: @, priority: 10" value={"mx.in.yourdomain.com"} readOnly mono helper="Required if you want to receive email directly (not forwarding)." />
        </div>
      )}
    </div>
  );
}
 
/* ═══════════════════════════════════════════════════════════════════════════
   WHATSAPP SETTINGS
═══════════════════════════════════════════════════════════════════════════ */
