import { useState } from "react";
import { ChannelSharePanel, CodeSnippet, InfoBox, Input, Row, SectionDivider, Select, StatusBadge, TabBar, Textarea, Toggle } from "./shared.jsx";
import { TOKEN } from "./tokens.js";
import api from "../../api/client.js";

export default function LivechatSettings({ cfg, setCfg }) {
  const [tab, setTab] = useState("api");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const S = (k, v) => setCfg({ ...cfg, [k]: v });
  const color = TOKEN.livechat.color;
  const ice = cfg.iceList || [];

  const handleTest = async () => {
    if (testing) return;
    setTesting(true);
    setTestResult(null);
    try {
      await api.saveChannel("livechat", stripMasked(cfg));
      const data = await api.testLivechat();
      setTestResult({ ok: true, message: data.message || "Connected successfully." });
    } catch (err) {
      setTestResult({ ok: false, message: err.message || "Connection failed." });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${TOKEN.livechat.grad} flex items-center justify-center text-white font-black text-lg shadow-lg`}>
            LC
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Live Chat</h2>
            <p className="text-xs text-slate-400">Website widget powered by livechat.pluginpros.co</p>
          </div>
        </div>
        <StatusBadge connected={cfg.enabled} />
      </div>

      <ChannelSharePanel channel="livechat" cfg={cfg} color={color} />

      <TabBar
        tabs={[
          { id: "api", label: "API Setup" },
          { id: "widget", label: "Widget" },
          { id: "messaging", label: "Messaging" },
        ]}
        active={tab}
        onChange={setTab}
        color={color}
      />

      {tab === "api" && (
        <div className="space-y-4">
          <InfoBox type="info">
            Create a free API key at{" "}
            <a href="https://livechat.pluginpros.co/" target="_blank" rel="noopener noreferrer" className="underline font-semibold">
              livechat.pluginpros.co
            </a>
            . Rooms are created automatically the first time a visitor connects. Messages appear in this inbox like any other channel.
          </InfoBox>
          <Row label="Enable Live Chat" desc="Show the chat window on your website and receive conversations in the inbox.">
            <Toggle checked={cfg.enabled} onChange={(v) => S("enabled", v)} color={color} />
          </Row>
          <Input
            label="API key"
            value={cfg.apiKey}
            onChange={(v) => S("apiKey", v)}
            placeholder="Paste the key from your livechat.pluginpros.co dashboard"
            type="password"
            mono
            helper="Used by the visitor widget (WebSocket query param) and by agents sending replies."
          />
          <Input
            label="Chat host"
            value={cfg.host}
            onChange={(v) => S("host", v)}
            placeholder="livechat.pluginpros.co"
            mono
            helper="Leave blank to use livechat.pluginpros.co. Hostname only — no https:// prefix needed."
          />
          <SectionDivider label="WebSocket URL" />
          <CodeSnippet
            lang="wss"
            code={`wss://${(cfg.host || "livechat.pluginpros.co").replace(/^https?:\/\//, "").replace(/\/.*$/, "") || "livechat.pluginpros.co"}/ws/chat/<room_id>/?api_key=YOUR_API_KEY`}
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              style={{ background: color }}
              className="px-5 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {testing ? "Testing…" : "Test connection"}
            </button>
            {testResult && (
              <span className={`text-xs font-medium ${testResult.ok ? "text-green-400" : "text-red-400"}`}>
                {testResult.message}
              </span>
            )}
          </div>
        </div>
      )}

      {tab === "widget" && (
        <div className="space-y-4">
          <InfoBox type="tip">
            The window appears automatically on every public page once Live Chat is enabled and saved. Style it to match the floating chat card: welcome line, starter buttons, then the conversation.
          </InfoBox>
          <Input label="Brand name" value={cfg.brandName} onChange={(v) => S("brandName", v)} placeholder="Shown in the widget header (defaults to your site title)" />
          <Input label="Tagline" value={cfg.tagline} onChange={(v) => S("tagline", v)} placeholder="We help your business grow by connecting you to your customers." />
          <Input
            label="Welcome message"
            value={cfg.welcomeMessage}
            onChange={(v) => S("welcomeMessage", v)}
            placeholder="Hi {{name}}, welcome! 👋"
            helper="Token: {{name}} — visitor name, or “there” when unknown."
          />
          <Input label="Response time label" value={cfg.onlineText} onChange={(v) => S("onlineText", v)} placeholder="A few minutes" />
          <Input label="Agent display name" value={cfg.agentName} onChange={(v) => S("agentName", v)} placeholder="Support" helper="Shown on outbound replies in the widget." />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Accent color" value={cfg.themeColor} onChange={(v) => S("themeColor", v)} placeholder="#7C3AED" />
            <Select
              label="Launcher position"
              value={cfg.position}
              onChange={(v) => S("position", v)}
              options={[
                { value: "bottom-right", label: "Bottom right" },
                { value: "bottom-left", label: "Bottom left" },
              ]}
            />
          </div>
          <Row label="Ask for visitor name" desc="Show a name field on the welcome screen before the first message.">
            <Toggle checked={cfg.askName} onChange={(v) => S("askName", v)} color={color} />
          </Row>
          <SectionDivider label="Starting sentences" />
          <p className="text-xs text-slate-500">Purple shortcut buttons on the welcome screen. Clicking one sends that text as the first message.</p>
          {ice.map((item, i) => (
            <div key={i} className="flex gap-2">
              <div className="flex-1">
                <Input
                  value={item}
                  onChange={(v) => {
                    const list = [...ice];
                    list[i] = v;
                    S("iceList", list);
                  }}
                  placeholder={`Starter ${i + 1}`}
                />
              </div>
              <button
                type="button"
                onClick={() => S("iceList", ice.filter((_, j) => j !== i))}
                className="self-center text-slate-600 hover:text-red-400 transition-colors px-2"
              >
                ✕
              </button>
            </div>
          ))}
          {ice.length < 6 && (
            <button
              type="button"
              onClick={() => S("iceList", [...ice, ""])}
              className="text-xs font-semibold hover:opacity-80 transition-colors flex items-center gap-1"
              style={{ color }}
            >
              + Add starter
            </button>
          )}
        </div>
      )}

      {tab === "messaging" && (
        <div className="space-y-1">
          <Row label="Auto-assign new conversations" desc="Round-robin to online agents.">
            <Toggle checked={cfg.autoAssign} onChange={(v) => S("autoAssign", v)} color={color} />
          </Row>
          <Row label="Auto-reply on new conversation" desc="Send an immediate acknowledgement to the visitor over the live chat room.">
            <Toggle checked={cfg.autoReply} onChange={(v) => S("autoReply", v)} color={color} />
          </Row>
          {cfg.autoReply && (
            <div className="pt-2 pb-1">
              <Textarea
                label="Auto-reply message"
                value={cfg.autoReplyMsg}
                onChange={(v) => S("autoReplyMsg", v)}
                rows={3}
                placeholder={"Hi {{customer_name}}! Thanks for chatting with us. An agent will reply shortly."}
                helper="Tokens: {{customer_name}}, {{name}}, {{ticket_id}}"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function stripMasked(values) {
  const out = { ...values };
  for (const key of Object.keys(out)) {
    if (typeof out[key] === "string" && /^•+$/.test(out[key])) {
      delete out[key];
    }
    if (key.endsWith("_set")) delete out[key];
  }
  return out;
}
