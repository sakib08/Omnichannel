import { CHANNELS } from "../constants/config";
import ThemeToggle from "./ThemeToggle.jsx";

export default function Sidebar({ activeChannel, setActiveChannel, conversations, theme, toggleTheme }) {
  return (
    <aside className="w-16 bg-white border-r border-gray-100 flex flex-col items-center py-4 gap-1 z-10 shadow-sm">
      <div className="mb-4">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
          <i className="ti ti-topology-star-3 text-white" style={{ fontSize: 16 }} />
        </div>
      </div>
      {CHANNELS.map((channel) => (
        <button
          key={channel.id}
          onClick={() => setActiveChannel(channel.id)}
          title={channel.label}
          className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all ${activeChannel === channel.id ? "bg-indigo-50 text-indigo-600" : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"}`}
        >
          <i
            className={`ti ${channel.icon}`}
            style={{ fontSize: 18, color: activeChannel === channel.id ? (channel.color || "#4F46E5") : undefined }}
          />
          {channel.id !== "all" && conversations.some((conversation) => conversation.channel === channel.id && conversation.unread > 0) && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          )}
        </button>
      ))}
      <div className="flex-1" />
      <ThemeToggle theme={theme} onToggle={toggleTheme} compact />
      <button 
        onClick={() => setActiveChannel("settings")}
        title="Settings"
        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${activeChannel === "settings" ? "bg-indigo-50 text-indigo-600" : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"}`}
      >
        <i className="ti ti-settings" style={{ fontSize: 18 }} />
      </button>
      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold">AW</div>
    </aside>
  );
}
