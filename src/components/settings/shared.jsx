import { useState } from "react";
import { TOKEN } from "./tokens.js";
 
/* ─── tiny primitives ───────────────────────────────────────────────────── */
export function Toggle({ checked, onChange, color = "#6366f1" }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{ background: checked ? color : "#d1d5db" }}
      className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none"
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${checked ? "translate-x-6" : "translate-x-1"}`}
      />
    </button>
  );
}
 
export function Input({ label, value, onChange, placeholder, type = "text", readOnly, mono, helper, prefix, suffix }) {
  const [show, setShow] = useState(false);
  const isPass = type === "password";
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</label>}
      <div className={`flex items-center rounded-xl border transition-all duration-150 ${readOnly ? "border-slate-700/60 bg-slate-800/40" : "border-slate-700 bg-slate-800/70 hover:border-slate-500 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20"}`}>
        {prefix && <span className="px-3 py-2.5 text-xs text-slate-500 border-r border-slate-700 select-none font-mono">{prefix}</span>}
        <input
          type={isPass && !show ? "password" : "text"}
          value={value}
          onChange={e => !readOnly && onChange?.(e.target.value)}
          placeholder={placeholder}
          readOnly={readOnly}
          className={`flex-1 bg-transparent px-3 py-2.5 text-sm outline-none ${readOnly ? "text-slate-400 select-all cursor-default" : "text-slate-100 placeholder-slate-600"} ${mono ? "font-mono" : ""}`}
        />
        {isPass && (
          <button onClick={() => setShow(s => !s)} className="px-3 text-slate-500 hover:text-slate-300 transition-colors">
            {show ? "🙈" : "👁"}
          </button>
        )}
        {readOnly && (
          <button
            onClick={() => navigator.clipboard?.writeText(value)}
            className="px-3 text-slate-500 hover:text-indigo-400 transition-colors text-xs font-medium"
          >copy</button>
        )}
        {suffix && <span className="px-3 text-xs text-slate-500 font-mono">{suffix}</span>}
      </div>
      {helper && <p className="text-xs text-slate-500 leading-relaxed">{helper}</p>}
    </div>
  );
}
 
export function Select({ label, value, onChange, options, helper }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</label>}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-700 bg-slate-800/70 px-3 py-2.5 text-sm text-slate-100 outline-none hover:border-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
      >
        {options.map(o => <option key={o.value} value={o.value} className="bg-slate-800">{o.label}</option>)}
      </select>
      {helper && <p className="text-xs text-slate-500 leading-relaxed">{helper}</p>}
    </div>
  );
}
 
export function Textarea({ label, value, onChange, placeholder, rows = 3, helper, mono }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</label>}
      <textarea
        rows={rows}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-xl border border-slate-700 bg-slate-800/70 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 outline-none resize-none hover:border-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all leading-relaxed ${mono ? "font-mono" : ""}`}
      />
      {helper && <p className="text-xs text-slate-500 leading-relaxed">{helper}</p>}
    </div>
  );
}
 
export function SectionDivider({ label }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 h-px bg-slate-700/60" />
      <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</span>
      <div className="flex-1 h-px bg-slate-700/60" />
    </div>
  );
}
 
export function Row({ label, desc, children }) {
  return (
    <div className="flex items-start justify-between gap-6 py-3.5 border-b border-slate-800/80 last:border-0">
      <div className="flex-1">
        <p className="text-sm font-medium text-slate-200">{label}</p>
        {desc && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{desc}</p>}
      </div>
      <div className="shrink-0 pt-0.5">{children}</div>
    </div>
  );
}
 
export function InfoBox({ children, type = "info" }) {
  const styles = {
    info:    "border-blue-500/30 bg-blue-500/8 text-blue-300",
    warning: "border-amber-500/30 bg-amber-500/8 text-amber-300",
    success: "border-green-500/30 bg-green-500/8 text-green-300",
    tip:     "border-indigo-500/30 bg-indigo-500/8 text-indigo-300",
  };
  const icons = { info: "ℹ", warning: "⚠", success: "✓", tip: "💡" };
  return (
    <div className={`flex gap-3 rounded-xl border px-4 py-3 text-xs leading-relaxed ${styles[type]}`}>
      <span className="shrink-0 mt-0.5">{icons[type]}</span>
      <span>{children}</span>
    </div>
  );
}
 
export function CodeSnippet({ code, lang = "html" }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl overflow-hidden border border-slate-700/60">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-700/60">
        <span className="text-xs font-mono text-slate-500">{lang}</span>
        <button
          onClick={() => { navigator.clipboard?.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className={`text-xs font-medium transition-colors ${copied ? "text-green-400" : "text-slate-400 hover:text-white"}`}
        >
          {copied ? "✓ copied" : "copy"}
        </button>
      </div>
      <pre className="px-4 py-3 bg-slate-950/80 text-xs text-emerald-400 font-mono leading-relaxed overflow-x-auto whitespace-pre">{code}</pre>
    </div>
  );
}
 
export function StatusBadge({ connected }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full ${connected ? "bg-green-500/15 text-green-400 border border-green-500/25" : "bg-slate-700/50 text-slate-400 border border-slate-600/40"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-green-400 animate-pulse" : "bg-slate-500"}`} />
      {connected ? "Connected" : "Not connected"}
    </span>
  );
}
 
export function TabBar({ tabs, active, onChange, color }) {
  return (
    <div className="flex gap-1 p-1 rounded-xl bg-slate-900/60 border border-slate-800">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={active === t.id ? { background: color + "18", color } : {}}
          className={`flex-1 text-xs font-semibold py-2 px-3 rounded-lg transition-all duration-150 ${active === t.id ? "shadow-sm" : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/60"}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export { TOKEN };
 
/* ─── channel cards (sidebar) ───────────────────────────────────────────── */
export function ChannelCard({ id, active, connected, onClick }) {
  const t = TOKEN[id];
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-150 group ${active ? "bg-slate-800 shadow-md border border-slate-700/60" : "hover:bg-slate-800/50 border border-transparent"}`}
    >
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black text-white shadow-sm bg-gradient-to-br ${t.grad} shrink-0`}
      >
        {t.icon}
      </div>
      <div className="flex-1 text-left min-w-0">
        <p className={`text-sm font-semibold truncate ${active ? "text-gray-500" : "text-slate-300"}`}>{t.label}</p>
        <p className="text-xs text-slate-500">{connected ? "● Connected" : "○ Disconnected"}</p>
      </div>
      {active && <div className="w-1 h-8 rounded-full" style={{ background: t.color }} />}
    </button>
  );
}
 
/* ═══════════════════════════════════════════════════════════════════════════
   MESSENGER SETTINGS
═══════════════════════════════════════════════════════════════════════════ */
