import { useState } from "react";
import EmailSettings from "./email";
import LineSettings from "./Line";
import MessengerSettings from "./messanger";
import SmsSettings from "./sms";
import TelegramSettings from "./telegram";
import ViberSettings from "./Viber";
import WeChatSettings from "./WeChat";
import WhatsAppSettings from "./whatsapp";
import { ChannelCard } from "./shared";
import { TOKEN } from "./tokens";
import ThemeToggle from "../ThemeToggle";

export default function IntegrationSettings({ theme = "dark", toggleTheme }) {
  const [active, setActive] = useState("messenger");
  const [saved, setSaved]   = useState(false);
  const [dirty, setDirty]   = useState(false);
 
  /* per-channel config */
  const [messengerCfg, setMessengerCfg] = useState({
    enabled: true, pageId: "", pageName: "Acme Support", pageToken: "", appId: "", appSecret: "",
    verifyToken: "acme_verify_2024", chatPlugin: true, greetLoggedIn: "Hi {{user_first_name}}! How can we help?",
    greetLoggedOut: "Hi! How can we help today?", themeColor: "#0866FF", loggedOutMode: "window",
    allowedDomain: "https://www.acme.com", autoReply: true,
    autoReplyMsg: "Hi {{user_first_name}}! Thanks for messaging us 👋 An agent will reply shortly.",
    awayMsg: true, awayMsgText: "We're offline right now but will respond first thing tomorrow ☀️",
    iceBreakers: true, iceList: ["What are your business hours?", "Track my order", "Speak to a human"],
    persistentMenu: true, fetchProfile: true, readReceipts: true, typingIndicator: true,
    reactions: true, quickReplies: true, imageAttach: true, fileAttach: true, autoAssign: true,
    csat: false, handover: false, secondaryAppId: "",
  });
  const [emailCfg, setEmailCfg] = useState({
    enabled: true, inboxName: "Customer Support", inboxEmail: "support@acme.com",
    senderName: "Acme Support Team", replyTo: "", smtpPreset: "gmail",
    smtpHost: "smtp.gmail.com", smtpPort: "587", smtpUser: "", smtpPass: "",
    smtpTls: true, smtpVerifySsl: true, imapHost: "imap.gmail.com", imapPort: "993",
    imapUser: "", imapPass: "", imapFolder: "INBOX", imapPoll: "2", imapDelete: false,
    autoReply: true, autoReplySubject: "We received your message — Ref #{{ticket_id}}",
    autoReplyBody: "", signature: true, signatureBody: "Best regards,\nThe Support Team\nsupport@acme.com",
    outOfOffice: false, oooBody: "",
  });
  const [whatsappCfg, setWhatsappCfg] = useState({
    enabled: true, wabaid: "", phoneNumberId: "", accessToken: "", verifyToken: "acme_wa_verify",
    displayPhone: "", ctaMessage: "Hello! I'd like to chat with support.", btnStyle: "floating",
    btnLabel: "Chat on WhatsApp", readReceipts: true, media: true, autoAssign: true,
    bizHours: false, autoReply: false, autoReplyMsg: "", template: "none",
    optOut: true, optIn: true, businessId: "", qualityTier: "MEDIUM",
  });
  const [telegramCfg, setTelegramCfg] = useState({
    enabled: false, botToken: "", botUsername: "@AcmeSupportBot", botName: "Acme Support",
    startMessage: "Hello, I need support!", widgetStyle: "floating", btnLabel: "Chat on Telegram",
    widgetPos: "bottom-right", allowGroups: false, typingIndicator: true, markdown: true,
    startReply: true, startMsg: "👋 Hi there! Welcome to Acme Support.\n\nHow can we help you today?",
    inlineKeyboard: true, fileUpload: true, autoAssign: true, commands: "start - Start a new conversation\nhelp - Get help and FAQs\nstatus - Check your ticket status",
    rateGlobal: "30", ratePerChat: "1", deleteClosed: false, anonymise: false,
  });
  const [smsCfg, setSmsCfg] = useState({
    enabled: false, provider: "twilio", accountSid: "", authToken: "",
    vonageKey: "", vonageSecret: "", genericKey: "", genericSecret: "",
    fromNumber: "", numberType: "local", perAgentNumber: false, mms: true,
    charWarn: true, autoSplit: true, unicode: false, delivery: true, retry: false,
    autoReply: true,
    autoReplyMsg: "Thanks for texting support. We received your message and will reply shortly. Reply STOP to opt out.",
    optOut: true, optIn: true, helpKeyword: false,
    helpMsg: "For support, call 1-800-000-0000 or email support@acme.com. Reply STOP to unsubscribe.",
    quietHours: false, quietFrom: "21:00", quietUntil: "09:00",
    brandId: "", campaignId: "", autoAssign: true, bizHours: false, sessionReset: false,
  });
  const [lineCfg, setLineCfg] = useState({
    enabled: false, channelId: "", basicId: "", channelSecret: "", accessToken: "",
    accountName: "Acme Support", language: "en", fetchProfile: true, createContacts: true,
    autoAssign: true, richMessages: true, autoReply: true,
    autoReplyMsg: "Thanks for messaging us. Our team will reply shortly.",
  });
  const [viberCfg, setViberCfg] = useState({
    enabled: false, botName: "Acme Support", senderId: "", authToken: "", avatarUrl: "",
    region: "global", fetchProfile: true, smsFallback: false, deliveryReceipts: true,
    media: true, autoAssign: true,
    autoReplyMsg: "Thanks for contacting support. We will reply shortly.",
  });
  const [wechatCfg, setWechatCfg] = useState({
    enabled: false, appId: "", appSecret: "", accountType: "service", serverToken: "",
    encodingAesKey: "", fetchProfile: true, autoAssign: true, media: true,
    menuJson: '{"button":[{"type":"click","name":"Support","key":"SUPPORT"}]}',
    autoReplyMsg: "Thanks for contacting us on WeChat. We will reply shortly.",
  });
 
  const cfgMap = {
    messenger: [messengerCfg, setMessengerCfg],
    email:     [emailCfg,     setEmailCfg],
    whatsapp:  [whatsappCfg,  setWhatsappCfg],
    telegram:  [telegramCfg,  setTelegramCfg],
    sms:       [smsCfg,       setSmsCfg],
    line:      [lineCfg,      setLineCfg],
    viber:     [viberCfg,     setViberCfg],
    wechat:    [wechatCfg,    setWechatCfg],
  };
 
  const wrappedSet = (setFn) => (v) => { setFn(v); setDirty(true); };
 
  const handleSave = () => {
    setSaved(true); setDirty(false);
    setTimeout(() => setSaved(false), 2500);
  };
 
  const channels = Object.keys(cfgMap);
 
  return (
    <div
      className="settings-page min-h-screen text-slate-100 flex flex-col"
      style={{
        background:
          theme === "dark"
            ? "linear-gradient(135deg, #0a0e1a 0%, #0e1525 50%, #0a1020 100%)"
            : "linear-gradient(135deg, #f8fafc 0%, #eef2ff 52%, #f8fafc 100%)",
        fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      }}
    >
      {/* Top bar */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between px-6 py-3 border-b border-slate-800/80 backdrop-blur-md"
        style={{ background: theme === "dark" ? "rgba(10,14,26,0.85)" : "rgba(255,255,255,0.86)" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-black text-white">⚙</div>
          <span className="text-sm font-bold text-white tracking-tight">Integration Settings</span>
          <span className="text-xs text-slate-600 hidden sm:block">/ Channel Connections</span>
        </div>
        <div className="flex items-center gap-3">
          {dirty && <span className="text-xs text-amber-400 font-medium animate-pulse">Unsaved changes</span>}
          {toggleTheme && <ThemeToggle theme={theme} onToggle={toggleTheme} />}
          <button
            onClick={handleSave}
            style={{ background: saved ? "#10B981" : "linear-gradient(135deg,#6366f1,#8b5cf6)" }}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 shadow-lg flex items-center gap-2"
          >
            {saved ? <>✓ Saved</> : <>Save changes</>}
          </button>
        </div>
      </header>
 
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className="w-60 shrink-0 border-r border-slate-800/60 flex flex-col py-4 px-3 gap-1 overflow-y-auto"
          style={{ background: theme === "dark" ? "rgba(8,12,22,0.6)" : "rgba(255,255,255,0.62)" }}
        >
          <p className="px-3 text-xs font-bold uppercase tracking-widest text-slate-600 mb-2">Channels</p>
          {channels.map(id => (
            <ChannelCard
              key={id} id={id} active={active === id}
              connected={cfgMap[id][0].enabled}
              onClick={() => setActive(id)}
            />
          ))}
 
          <div className="flex-1" />
 
          <div className="px-3 pt-4 border-t border-slate-800/60 mt-2 space-y-1">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-600 mb-2">Status</p>
            {channels.map(id => (
              <div key={id} className="flex items-center justify-between py-1">
                <span className="text-xs text-slate-400">{TOKEN[id].label}</span>
                <span className={`text-xs font-semibold ${cfgMap[id][0].enabled ? "text-green-400" : "text-slate-600"}`}>
                  {cfgMap[id][0].enabled ? "●" : "○"}
                </span>
              </div>
            ))}
          </div>
        </aside>
 
        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-6 py-8">
            {active === "messenger" && (
              <MessengerSettings cfg={messengerCfg} setCfg={wrappedSet(setMessengerCfg)} />
            )}
            {active === "email" && (
              <EmailSettings cfg={emailCfg} setCfg={wrappedSet(setEmailCfg)} />
            )}
            {active === "whatsapp" && (
              <WhatsAppSettings cfg={whatsappCfg} setCfg={wrappedSet(setWhatsappCfg)} />
            )}
            {active === "telegram" && (
              <TelegramSettings cfg={telegramCfg} setCfg={wrappedSet(setTelegramCfg)} />
            )}
            {active === "sms" && (
              <SmsSettings cfg={smsCfg} setCfg={wrappedSet(setSmsCfg)} />
            )}
            {active === "line" && (
              <LineSettings cfg={lineCfg} setCfg={wrappedSet(setLineCfg)} />
            )}
            {active === "viber" && (
              <ViberSettings cfg={viberCfg} setCfg={wrappedSet(setViberCfg)} />
            )}
            {active === "wechat" && (
              <WeChatSettings cfg={wechatCfg} setCfg={wrappedSet(setWechatCfg)} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
