import { CHANNELS } from "../constants/config";
import ThemeToggle from "./ThemeToggle.jsx";
import { ChannelIcon } from "./ChannelBadge.jsx";

export default function Sidebar({ activeChannel, setActiveChannel, conversations, theme, toggleTheme }) {
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
      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold">AW</div>
    </aside>
  );
}
