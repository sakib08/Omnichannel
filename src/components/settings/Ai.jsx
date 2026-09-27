import { useEffect, useState } from "react";
import { Input, Textarea, Toggle, SectionDivider, Row, InfoBox, Select } from "./shared.jsx";
import api from "../../api/client.js";

const COLOR = "#6366f1";

const PROVIDER_PRESETS = {
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    chatModel: "gpt-4o-mini",
    embeddingModel: "text-embedding-3-small",
    supportsEmbed: true,
    keyHint: "sk-…",
    helper: "Official OpenAI Chat Completions + Embeddings API.",
  },
  grok: {
    label: "Grok (xAI)",
    baseUrl: "https://api.x.ai/v1",
    chatModel: "grok-3-mini",
    embeddingModel: "",
    supportsEmbed: false,
    keyHint: "xai-…",
    helper: "xAI Grok via OpenAI-compatible API. RAG uses keyword search (no embeddings).",
  },
  claude: {
    label: "Claude (Anthropic)",
    baseUrl: "https://api.anthropic.com",
    chatModel: "claude-sonnet-4-5",
    embeddingModel: "",
    supportsEmbed: false,
    keyHint: "sk-ant-…",
    helper: "Anthropic Messages API. RAG uses keyword search (Claude has no embeddings).",
  },
  gemini: {
    label: "Gemini (Google)",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    chatModel: "gemini-2.0-flash",
    embeddingModel: "text-embedding-004",
    supportsEmbed: true,
    keyHint: "AIza…",
    helper: "Google Gemini generateContent + embedContent APIs.",
  },
  openai_compat: {
    label: "OpenAI-compatible (custom)",
    baseUrl: "https://api.openai.com/v1",
    chatModel: "gpt-4o-mini",
    embeddingModel: "text-embedding-3-small",
    supportsEmbed: true,
    keyHint: "API key",
    helper: "Azure OpenAI, Groq, Ollama, Together, Fireworks, and other compatible endpoints.",
  },
};

export default function AiSettings({ cfg, setCfg }) {
  const S = (key, value) => setCfg({ [key]: value });

  const applyProvider = (provider) => {
    const preset = PROVIDER_PRESETS[provider] || PROVIDER_PRESETS.openai;
    setCfg({
      provider,
      baseUrl: preset.baseUrl,
      chatModel: preset.chatModel,
      embeddingModel: preset.embeddingModel,
    });
  };

  const provider = cfg.provider || "openai";
  const preset = PROVIDER_PRESETS[provider] || PROVIDER_PRESETS.openai;
  const showBaseUrl = provider === "openai" || provider === "openai_compat" || provider === "grok";
  const showEmbed = !!preset.supportsEmbed;

  const [docs, setDocs] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [savingDoc, setSavingDoc] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [docError, setDocError] = useState(null);
  const [docOk, setDocOk] = useState(null);
  const [form, setForm] = useState({ id: null, title: "", content: "" });

  const loadDocs = () => {
    setLoadingDocs(true);
    api
      .listKb()
      .then((list) => setDocs(Array.isArray(list) ? list : []))
      .catch((err) => setDocError(err.message || "Could not load knowledge base"))
      .finally(() => setLoadingDocs(false));
  };

  useEffect(() => {
    loadDocs();
  }, []);

  const resetForm = () => setForm({ id: null, title: "", content: "" });

  const saveDoc = async () => {
    if (savingDoc) return;
    setSavingDoc(true);
    setDocError(null);
    setDocOk(null);
    try {
      await api.saveKb({
        id: form.id || undefined,
        title: form.title,
        content: form.content,
      });
      setDocOk(form.id ? "Article updated and re-indexed." : "Article added and indexed.");
      resetForm();
      loadDocs();
    } catch (err) {
      setDocError(err.message || "Could not save article");
    } finally {
      setSavingDoc(false);
    }
  };

  const editDoc = (doc) => {
    if (doc.sourceType !== "manual") return;
    setForm({ id: doc.id, title: doc.title || "", content: doc.content || "" });
    setDocOk(null);
    setDocError(null);
  };

  const deleteDoc = async (id) => {
    if (!window.confirm("Delete this knowledge base article?")) return;
    setDocError(null);
    try {
      await api.deleteKb(id);
      if (form.id === id) resetForm();
      loadDocs();
    } catch (err) {
      setDocError(err.message || "Could not delete article");
    }
  };

  const reindex = async () => {
    if (reindexing) return;
    setReindexing(true);
    setDocError(null);
    setDocOk(null);
    try {
      const result = await api.reindexKb();
      const m = result?.manual || {};
      const w = result?.wp || {};
      setDocOk(
        `Re-indexed ${m.indexed || 0} manual article(s)` +
          (cfg.indexWpContent ? ` and ${w.indexed || 0} WordPress post(s)/page(s)` : "") +
          "."
      );
      loadDocs();
    } catch (err) {
      setDocError(err.message || "Reindex failed");
    } finally {
      setReindexing(false);
    }
  };

  const manualDocs = docs.filter((d) => d.sourceType === "manual");
  const wpDocs = docs.filter((d) => d.sourceType === "post" || d.sourceType === "page");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">AI Support</h2>
        <p className="text-sm text-slate-400">
          Enable an AI assistant that greets customers, routes to departments, answers from your knowledge base, and hands off to humans on request.
        </p>
      </div>

      <InfoBox type="tip">
        Choose OpenAI, Grok (xAI), Claude (Anthropic), Gemini (Google), or any OpenAI-compatible endpoint. Add FAQ articles below and optionally index WordPress posts/pages for RAG answers.
      </InfoBox>

      <SectionDivider label="Enable" />
      <Row
        label="Start conversations with AI"
        desc="When enabled, unassigned inbound chats are handled by the AI until an agent is assigned or the customer asks for a human."
      >
        <Toggle checked={!!cfg.enabled} onChange={(v) => S("enabled", v)} color={COLOR} />
      </Row>

      <SectionDivider label="AI provider" />
      <div className="grid gap-4">
        <Select
          label="Provider"
          value={provider}
          onChange={applyProvider}
          options={Object.entries(PROVIDER_PRESETS).map(([value, p]) => ({
            value,
            label: p.label,
          }))}
          helper={preset.helper}
        />
        {showBaseUrl && (
          <Input
            label="Base URL"
            value={cfg.baseUrl || ""}
            onChange={(v) => S("baseUrl", v)}
            placeholder={preset.baseUrl}
            mono
            helper={
              provider === "openai_compat"
                ? "Full API root including /v1 (e.g. https://api.groq.com/openai/v1)."
                : undefined
            }
          />
        )}
        <Input
          label="API key"
          type="password"
          value={cfg.apiKey || ""}
          onChange={(v) => S("apiKey", v)}
          placeholder={cfg.apiKey_set ? "•••••••• (saved)" : preset.keyHint}
        />
        <div className={`grid gap-4 ${showEmbed ? "sm:grid-cols-2" : ""}`}>
          <Input
            label="Chat model"
            value={cfg.chatModel || ""}
            onChange={(v) => S("chatModel", v)}
            placeholder={preset.chatModel}
            mono
          />
          {showEmbed && (
            <Input
              label="Embedding model"
              value={cfg.embeddingModel || ""}
              onChange={(v) => S("embeddingModel", v)}
              placeholder={preset.embeddingModel}
              mono
            />
          )}
        </div>
        {!showEmbed && (
          <InfoBox type="info">
            {preset.label} does not provide embeddings. Knowledge-base matching uses keyword search; chat answers still use the selected model.
          </InfoBox>
        )}
      </div>

      <SectionDivider label="Messages" />
      <div className="grid gap-4">
        <Input
          label="Assistant display name"
          value={cfg.assistantName || ""}
          onChange={(v) => S("assistantName", v)}
          placeholder="AI Assistant"
        />
        <Textarea
          label="Welcome message"
          value={cfg.welcomeMsg || ""}
          onChange={(v) => S("welcomeMsg", v)}
          rows={3}
          helper="Sent when AI takes over a new conversation."
        />
        <Textarea
          label="Wait-for-agent message"
          value={cfg.waitForAgentMsg || ""}
          onChange={(v) => S("waitForAgentMsg", v)}
          rows={3}
          helper="Sent when the customer asks to talk to a human and AI leaves the chat."
        />
      </div>

      <SectionDivider label="Knowledge base (RAG)" />
      <Row
        label="Index WordPress posts & pages"
        desc="Auto-index published content for RAG answers."
      >
        <Toggle checked={!!cfg.indexWpContent} onChange={(v) => S("indexWpContent", v)} color={COLOR} />
      </Row>

      <div className="rounded-xl border border-slate-700/80 bg-slate-900/40 p-4 space-y-3 mt-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          {form.id ? "Edit article" : "Add article"}
        </p>
        <Input
          label="Title"
          value={form.title}
          onChange={(v) => setForm((f) => ({ ...f, title: v }))}
          placeholder="Shipping policy"
        />
        <Textarea
          label="Content"
          value={form.content}
          onChange={(v) => setForm((f) => ({ ...f, content: v }))}
          rows={5}
          placeholder="Paste FAQ or help article text…"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={savingDoc || !form.title.trim() || !form.content.trim()}
            onClick={saveDoc}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}
          >
            {savingDoc ? "Saving…" : form.id ? "Update article" : "Add article"}
          </button>
          {form.id && (
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 border border-slate-600 hover:bg-slate-800"
            >
              Cancel edit
            </button>
          )}
          <button
            type="button"
            disabled={reindexing}
            onClick={reindex}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-200 border border-slate-600 hover:bg-slate-800 disabled:opacity-50 ml-auto"
          >
            {reindexing ? "Re-indexing…" : "Reindex all"}
          </button>
        </div>
        {docError && <p className="text-xs text-red-400">{docError}</p>}
        {docOk && <p className="text-xs text-emerald-400">{docOk}</p>}
      </div>

      <div className="mt-6 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Manual articles {loadingDocs ? "" : `(${manualDocs.length})`}
        </p>
        {loadingDocs ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : manualDocs.length === 0 ? (
          <p className="text-sm text-slate-500">No manual articles yet.</p>
        ) : (
          <ul className="space-y-2">
            {manualDocs.map((doc) => (
              <li
                key={doc.id}
                className="flex items-start gap-3 rounded-xl border border-slate-700/60 bg-slate-800/40 px-3 py-2.5"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-100 truncate">{doc.title}</p>
                  <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                    {(doc.content || "").replace(/\s+/g, " ").slice(0, 140)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => editDoc(doc)}
                  className="text-xs text-indigo-300 hover:text-indigo-200 shrink-0"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => deleteDoc(doc.id)}
                  className="text-xs text-red-400 hover:text-red-300 shrink-0"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {cfg.indexWpContent && (
        <div className="mt-6 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Indexed WordPress content ({wpDocs.length})
          </p>
          {wpDocs.length === 0 ? (
            <p className="text-sm text-slate-500">None yet — click Reindex all after saving settings.</p>
          ) : (
            <ul className="space-y-1 max-h-48 overflow-y-auto">
              {wpDocs.map((doc) => (
                <li key={doc.id} className="text-xs text-slate-400 flex gap-2">
                  <span className="uppercase text-slate-600 shrink-0">{doc.sourceType}</span>
                  <span className="truncate text-slate-300">{doc.title}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
