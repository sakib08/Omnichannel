import { useState } from "react";
import { CHANNELS } from "../constants/config";
import ThemeToggle from "./ThemeToggle.jsx";
import { ChannelIcon } from "./ChannelBadge.jsx";
import { currentUser } from "../api/client.js";
import { PRESENCE_STYLES } from "./PresenceDot.jsx";

function initials(name = "") {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("") || "?"
  );
}

function StatusMenu({ presence, onChangeStatus }) {
  const [open, setOpen] = useState(false);
  const me = presence?.me;
  const effective = me?.presence || "offline";
  const hours = presence?.hours;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title={`You are ${PRESENCE_STYLES[effective].label.toLowerCase()}`}
        className="relative w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold"
      >
        {initials(currentUser.name)}
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${PRESENCE_STYLES[effective].dot}`}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-12 bottom-0 z-50 w-56 rounded-xl border border-gray-100 bg-white shadow-lg p-2 text-sm">
            <div className="px-2 py-1.5 text-xs text-gray-400 truncate">{currentUser.name}</div>
            {["online", "away"].map((status) => (
              <button
                key={status}
                onClick={() => {
                  onChangeStatus?.(status);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 ${me?.status === status ? "font-semibold text-gray-900" : "text-gray-600"}`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${PRESENCE_STYLES[status].dot}`} />
                {PRESENCE_STYLES[status].label}
                {me?.status === status && <i className="ti ti-check ml-auto text-indigo-500" style={{ fontSize: 14 }} />}
              </button>
            ))}
            <p className="px-2 pt-2 mt-1 border-t border-gray-100 text-xs text-gray-400 leading-relaxed">
              {me?.status === "away"
                ? "Away: new chats won't be assigned to you."
                : "Online: you can be assigned new chats while this inbox or any admin page is open."}
            </p>
            {hours?.enabled && (
              <p className="px-2 pt-1 text-xs text-gray-400 leading-relaxed">
                {hours.open ? "Within business hours." : `Outside business hours${hours.nextOpen ? `, opens ${hours.nextOpen}` : ""}.`}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function Sidebar({ activeChannel, setActiveChannel, conversations, theme, toggleTheme, presence, onChangeStatus }) {
  return (
    <aside className="w-16 bg-white border-r border-gray-100 flex flex-col items-center py-4 gap-1 z-10 shadow-sm">
      <div className="mb-4">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
          <i className="ti ti-topology-star-3 text-white" style={{ fontSize: 16 }} />
        </div>
      </div>

      {CHANNELS.map((channel) => {
        const isActive  = activeChannel === channel.id;
        const color     = channel.color || "#4F46E5";
        const hasUnread = channel.id !== "all" &&
          conversations.some((c) => c.channel === channel.id && c.unread > 0);

        return (
          <button
            key={channel.id}
            onClick={() => setActiveChannel(channel.id)}
            title={channel.label}
            style={isActive ? { background: color + "18" } : undefined}
            className="relative w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:opacity-80"
          >
            <ChannelIcon
              icon={channel.icon}
              color={isActive ? color : color + "99"}
              size={18}
            />
            {hasUnread && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </button>
        );
      })}

      <div className="flex-1" />
      <ThemeToggle theme={theme} onToggle={toggleTheme} compact />
      <button
        onClick={() => setActiveChannel("settings")}
        title="Settings"
        style={activeChannel === "settings" ? { background: "#4F46E518" } : undefined}
        className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:opacity-80"
      >
        <i
          className="ti ti-settings"
          style={{ fontSize: 18, color: activeChannel === "settings" ? "#4F46E5" : "#9ca3af" }}
        />
      </button>
      <StatusMenu presence={presence} onChangeStatus={onChangeStatus} />
    </aside>
  );
}
