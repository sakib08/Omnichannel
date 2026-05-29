import Avatar from "./Avatar.jsx";
import ChannelBadge from "./ChannelBadge.jsx";
import RightPanel from "./RightPanel.jsx";
import { channelMeta, priorityConfig, SAVED_REPLIES, statusConfig } from "../constants/config";

function MessageBubble({ message, conv }) {
  const avatarInitials = message.isAgent ? "AG" : conv.avatar;
  const avatarColor = message.isAgent ? "#6366F1" : (channelMeta(conv.channel).color || "#6366F1");

  return (
    <div className={`flex gap-3 ${message.isAgent ? "flex-row-reverse" : ""}`}>
      <Avatar initials={avatarInitials} color={avatarColor} size={32} />
      <div className={`max-w-md ${message.isAgent ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500">{message.sender}</span>
          <span className="text-xs text-gray-400">{message.time}</span>
        </div>
        <div
          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
            message.isAgent
              ? "bg-indigo-600 text-white rounded-tr-sm"
              : "bg-white border border-gray-200 text-gray-800 rounded-tl-sm"
          }`}
        >
          {message.isHtml ? (
            <div
              className="sme-email-body prose prose-sm max-w-none"
              /* Email HTML has already passed wp_kses_post on the server */
              dangerouslySetInnerHTML={{ __html: message.text }}
            />
          ) : (
            <span style={{ whiteSpace: "pre-wrap" }}>{message.text}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ConversationView({
  activeTab,
  addNote,
  agents,
  loadingMessages,
  messagesEndRef,
  noteText,
  replyText,
  selectedConv,
  sendError,
  sendReply,
  sendingReply,
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

  const isEmail = selectedConv.channel === "email";

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Avatar
            initials={selectedConv.avatar}
            color={channelMeta(selectedConv.channel).color || "#6366F1"}
            size={40}
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">{selectedConv.name}</span>
              <ChannelBadge channelId={selectedConv.channel} />
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusConfig[selectedConv.status]?.cls || ""}`}>
                {statusConfig[selectedConv.status]?.label || selectedConv.status}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityConfig[selectedConv.priority]?.bg || ""}`}>
                <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${priorityConfig[selectedConv.priority]?.dot || ""}`} />
                {priorityConfig[selectedConv.priority]?.label || selectedConv.priority}
              </span>
            </div>
            <div className="text-sm text-gray-500 flex items-center gap-2">
              <span>{selectedConv.subject}</span>
              {isEmail && selectedConv.contactHandle && (
                <span className="text-gray-400">
                  &lt;{selectedConv.contactHandle}&gt;
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedConv.status}
            onChange={(e) => updateStatus(e.target.value)}
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
          {/* Message thread */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {loadingMessages ? (
              <div className="flex flex-col items-center justify-center h-40 gap-3 text-gray-400">
                <svg className="animate-spin w-6 h-6 text-indigo-500" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                <span className="text-sm">Loading messages…</span>
              </div>
            ) : selectedConv.messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-400">
                <i className="ti ti-message-off" style={{ fontSize: 28 }} />
                <span className="text-sm">No messages yet</span>
              </div>
            ) : (
              selectedConv.messages.map((message) => (
                <MessageBubble key={message.id} message={message} conv={selectedConv} />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Compose area */}
          <div className="bg-white border-t border-gray-100 px-4 py-3">
            <div className="flex gap-1 mb-2 border-b border-gray-100 pb-2">
              {["reply", "note"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`text-sm px-3 py-1 rounded-lg font-medium transition-all ${
                    activeTab === tab ? "bg-indigo-600 text-white" : "text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  <i className={`ti ${tab === "reply" ? "ti-send" : "ti-note"} mr-1`} style={{ fontSize: 13 }} />
                  {tab === "reply" ? "Reply" : "Internal Note"}
                </button>
              ))}
            </div>

            {activeTab === "reply" && (
              <div>
                {isEmail && selectedConv.contactHandle && (
                  <div className="flex items-center gap-1.5 mb-1.5 text-xs text-gray-400">
                    <i className="ti ti-mail" style={{ fontSize: 12 }} />
                    <span>
                      Sending via SMTP to <span className="font-medium text-gray-600">{selectedConv.contactHandle}</span>
                    </span>
                  </div>
                )}
                <textarea
                  rows={3}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={`Reply via ${channelMeta(selectedConv.channel).label}…`}
                  onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) sendReply(); }}
                  disabled={sendingReply}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 bg-gray-50 disabled:opacity-60"
                />

                {sendError && (
                  <div className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <i className="ti ti-alert-circle" style={{ fontSize: 12 }} />
                    {sendError}
                  </div>
                )}

                <div className="flex items-center justify-between mt-2">
                  <div className="relative">
                    <button
                      onClick={() => setShowSaved((v) => !v)}
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
                            onClick={() => { setReplyText(reply.body); setShowSaved(false); }}
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
                      disabled={!replyText.trim() || sendingReply}
                      className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1"
                    >
                      {sendingReply ? (
                        <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                      ) : (
                        <i className="ti ti-send" style={{ fontSize: 14 }} />
                      )}
                      {sendingReply ? "Sending…" : "Send"}
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
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add an internal note visible only to agents…"
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
          agents={agents}
          selectedConv={selectedConv}
          setActiveTab={setActiveTab}
          setReplyText={setReplyText}
          updateAssignee={updateAssignee}
        />
      </div>
    </div>
  );
}
