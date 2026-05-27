import Avatar from "./Avatar.jsx";
import ChannelBadge from "./ChannelBadge.jsx";
import SLABadge from "./SLABadge.jsx";
import { channelMeta, STATUS_FILTERS, statusConfig } from "../constants/config";

export default function ConversationList({
  activeChannel,
  filterStatus,
  filtered,
  search,
  selected,
  setFilterStatus,
  setSearch,
  setSelected,
  setConversations,
  stats,
}) {
  const title = channelMeta(activeChannel).label === "All" ? "Unified Inbox" : channelMeta(activeChannel).label;

  return (
    <div className="w-80 bg-white border-r border-gray-100 flex flex-col shadow-sm">
      <div className="px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-sm font-semibold text-gray-800">{title}</h1>
          <div className="flex gap-1">
            {STATUS_FILTERS.map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`text-xs px-2 py-0.5 rounded-full font-medium transition-all ${filterStatus === status ? "bg-indigo-600 text-white" : "text-gray-500 hover:bg-gray-100"}`}
              >
                {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1 mb-3">
          {[
            { label: "Open", val: stats.open, color: "text-blue-600" },
            { label: "Pending", val: stats.pending, color: "text-amber-600" },
            { label: "Resolved", val: stats.resolved, color: "text-green-600" },
            { label: "Unread", val: stats.unread, color: "text-red-600" },
          ].map((stat) => (
            <div key={stat.label} className="bg-gray-50 rounded-lg p-1.5 text-center">
              <div className={`text-base font-bold ${stat.color}`}>{stat.val}</div>
              <div className="text-xs text-gray-400">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="relative">
          <i className="ti ti-search absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" style={{ fontSize: 14 }} />
          <input
            type="text"
            placeholder="Search conversations..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
            <i className="ti ti-inbox-off" style={{ fontSize: 28 }} />
            <span className="text-sm">No conversations</span>
          </div>
        )}
        {filtered.map((conversation) => (
          <button
            key={conversation.id}
            onClick={() => {
              setSelected(conversation.id);
              setConversations((previous) =>
                previous.map((item) => (item.id === conversation.id ? { ...item, unread: 0 } : item))
              );
            }}
            className={`w-full text-left px-4 py-3 border-b border-gray-50 transition-all hover:bg-indigo-50/40 ${selected === conversation.id ? "bg-indigo-50 border-l-2 border-l-indigo-500" : ""}`}
          >
            <div className="flex items-start gap-2.5">
              <Avatar initials={conversation.avatar} color={channelMeta(conversation.channel).color || "#6366F1"} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-sm font-semibold text-gray-800 truncate">{conversation.name}</span>
                  <span className="text-xs text-gray-400 shrink-0 ml-1">{conversation.time}</span>
                </div>
                <div className="text-xs text-gray-600 font-medium truncate mb-1">{conversation.subject}</div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs text-gray-400 truncate">{conversation.preview}</span>
                  {conversation.unread > 0 && (
                    <span className="shrink-0 w-4 h-4 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">
                      {conversation.unread}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                  <ChannelBadge channelId={conversation.channel} small />
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${statusConfig[conversation.status].cls}`}>
                    {statusConfig[conversation.status].label}
                  </span>
                  <SLABadge deadline={conversation.slaDeadline} unit={conversation.slaUnit} />
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
