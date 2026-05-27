import Avatar from "./Avatar.jsx";
import ChannelBadge from "./ChannelBadge.jsx";
import RightPanel from "./RightPanel.jsx";
import { channelMeta, priorityConfig, SAVED_REPLIES, statusConfig } from "../constants/config";

export default function ConversationView({
  activeTab,
  addNote,
  messagesEndRef,
  noteText,
  replyText,
  selectedConv,
  sendReply,
  setActiveTab,
  setNoteText,
  setReplyText,
  setShowSaved,
  showSaved,
  updateAssignee,
  updateStatus,
}) {
  if (!selectedConv) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 gap-4 text-gray-400">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center">
          <i className="ti ti-messages text-indigo-400" style={{ fontSize: 32 }} />
        </div>
        <div className="text-center">
          <div className="text-base font-semibold text-gray-600 mb-1">Select a conversation</div>
          <div className="text-sm text-gray-400">Choose from the inbox to start replying</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Avatar initials={selectedConv.avatar} color={channelMeta(selectedConv.channel).color || "#6366F1"} size={40} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">{selectedConv.name}</span>
              <ChannelBadge channelId={selectedConv.channel} />
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusConfig[selectedConv.status].cls}`}>
                {statusConfig[selectedConv.status].label}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityConfig[selectedConv.priority].bg}`}>
                <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${priorityConfig[selectedConv.priority].dot}`} />
                {priorityConfig[selectedConv.priority].label}
              </span>
            </div>
            <div className="text-sm text-gray-500">{selectedConv.subject}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedConv.status}
            onChange={(event) => updateStatus(event.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white outline-none focus:ring-2 focus:ring-indigo-200"
          >
            <option value="open">Open</option>
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
          </select>
          <button className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
            <i className="ti ti-dots mr-1" style={{ fontSize: 14 }} />
            More
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {selectedConv.messages.map((message) => (
              <div key={message.id} className={`flex gap-3 ${message.isAgent ? "flex-row-reverse" : ""}`}>
                <Avatar
                  initials={message.isAgent ? "AW" : selectedConv.avatar}
                  color={message.isAgent ? "#6366F1" : channelMeta(selectedConv.channel).color || "#6366F1"}
                  size={32}
                />
                <div className={`max-w-md ${message.isAgent ? "items-end" : "items-start"} flex flex-col gap-1`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-500">{message.sender}</span>
                    <span className="text-xs text-gray-400">{message.time}</span>
                  </div>
                  <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${message.isAgent ? "bg-indigo-600 text-white rounded-tr-sm" : "bg-white border border-gray-200 text-gray-800 rounded-tl-sm"}`}>
                    {message.text}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="bg-white border-t border-gray-100 px-4 py-3">
            <div className="flex gap-1 mb-2 border-b border-gray-100 pb-2">
              {["reply", "note"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`text-sm px-3 py-1 rounded-lg font-medium transition-all ${activeTab === tab ? "bg-indigo-600 text-white" : "text-gray-500 hover:bg-gray-100"}`}
                >
                  <i className={`ti ${tab === "reply" ? "ti-send" : "ti-note"} mr-1`} style={{ fontSize: 13 }} />
                  {tab === "reply" ? "Reply" : "Internal Note"}
                </button>
              ))}
            </div>

            {activeTab === "reply" && (
              <div>
                <textarea
                  rows={3}
                  value={replyText}
                  onChange={(event) => setReplyText(event.target.value)}
                  placeholder={`Reply via ${channelMeta(selectedConv.channel).label}...`}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && event.ctrlKey) sendReply();
                  }}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 bg-gray-50"
                />
                <div className="flex items-center justify-between mt-2">
                  <div className="relative">
                    <button
                      onClick={() => setShowSaved((visible) => !visible)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                    >
                      <i className="ti ti-bookmark" style={{ fontSize: 13 }} />
                      Saved Replies
                    </button>
                    {showSaved && (
                      <div className="absolute bottom-8 left-0 bg-white border border-gray-200 rounded-xl shadow-lg w-72 z-20 overflow-hidden">
                        <div className="px-3 py-2 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          Saved Replies
                        </div>
                        {SAVED_REPLIES.map((reply) => (
                          <button
                            key={reply.id}
                            onClick={() => {
                              setReplyText(reply.body);
                              setShowSaved(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-indigo-50 transition-colors"
                          >
                            <div className="text-sm font-medium text-gray-800">{reply.title}</div>
                            <div className="text-xs text-gray-500 truncate">{reply.body}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Ctrl+Enter to send</span>
                    <button
                      onClick={sendReply}
                      disabled={!replyText.trim()}
                      className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1"
                    >
                      <i className="ti ti-send" style={{ fontSize: 14 }} />
                      Send
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "note" && (
              <div>
                <textarea
                  rows={3}
                  value={noteText}
                  onChange={(event) => setNoteText(event.target.value)}
                  placeholder="Add an internal note visible only to agents..."
                  className="w-full text-sm border border-amber-200 rounded-xl px-3 py-2 resize-none outline-none focus:ring-2 focus:ring-amber-200 bg-amber-50/60"
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={addNote}
                    disabled={!noteText.trim()}
                    className="px-4 py-1.5 bg-amber-500 text-white text-sm rounded-lg font-medium hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1"
                  >
                    <i className="ti ti-note" style={{ fontSize: 14 }} />
                    Add Note
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <RightPanel
          selectedConv={selectedConv}
          setActiveTab={setActiveTab}
          setReplyText={setReplyText}
          updateAssignee={updateAssignee}
        />
      </div>
    </div>
  );
}
