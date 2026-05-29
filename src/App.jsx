import { useEffect, useRef, useState } from "react";
import ConversationList from "./components/ConversationList.jsx";
import ConversationView from "./components/ConversationView.jsx";
import Sidebar from "./components/Sidebar.jsx";
import IntegrationSettings from "./components/settings/Setttings.js";
import { DUMMY_CONVERSATIONS } from "./constants/config.js";

export default function OmnichannelApp() {
  const [activeChannel, setActiveChannel] = useState("all");
  const [conversations, setConversations] = useState(DUMMY_CONVERSATIONS);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("reply");
  const [replyText, setReplyText] = useState("");
  const [noteText, setNoteText] = useState("");
  const [showSaved, setShowSaved] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [theme, setTheme] = useState("light");
  const messagesEndRef = useRef(null);

  const selectedConv = conversations.find((conversation) => conversation.id === selected);

  const filtered = conversations.filter((conversation) => {
    const matchChannel = activeChannel === "all" || conversation.channel === activeChannel;
    const matchStatus = filterStatus === "all" || conversation.status === filterStatus;
    const query = search.toLowerCase();
    const matchSearch = conversation.name.toLowerCase().includes(query) || conversation.subject.toLowerCase().includes(query);

    return matchChannel && matchStatus && matchSearch;
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedConv?.messages?.length]);

  const sendReply = () => {
    if (!replyText.trim() || !selected) return;

    setConversations((previous) =>
      previous.map((conversation) =>
        conversation.id === selected
          ? {
              ...conversation,
              messages: [
                ...conversation.messages,
                { id: Date.now(), sender: "You", text: replyText, time: "Now", isAgent: true },
              ],
              unread: 0,
              preview: replyText.slice(0, 60),
            }
          : conversation
      )
    );
    setReplyText("");
  };

  const addNote = () => {
    if (!noteText.trim() || !selected) return;

    setConversations((previous) =>
      previous.map((conversation) =>
        conversation.id === selected ? { ...conversation, notes: [...conversation.notes, noteText] } : conversation
      )
    );
    setNoteText("");
  };

  const updateAssignee = (assignee) => {
    setConversations((previous) =>
      previous.map((conversation) => (conversation.id === selected ? { ...conversation, assignee } : conversation))
    );
  };

  const updateStatus = (status) => {
    setConversations((previous) =>
      previous.map((conversation) => (conversation.id === selected ? { ...conversation, status } : conversation))
    );
  };

  const stats = {
    open: conversations.filter((conversation) => conversation.status === "open").length,
    pending: conversations.filter((conversation) => conversation.status === "pending").length,
    resolved: conversations.filter((conversation) => conversation.status === "resolved").length,
    unread: conversations.reduce((sum, conversation) => sum + conversation.unread, 0),
  };

  const toggleTheme = () => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  };

  return (
    <div className={`sme-app-root theme-${theme} flex bg-gray-50 font-sans overflow-hidden`}>
      <Sidebar
        activeChannel={activeChannel}
        conversations={conversations}
        setActiveChannel={setActiveChannel}
        theme={theme}
        toggleTheme={toggleTheme}
      />
      {activeChannel === "settings" ? (
        <main className="flex-1 overflow-hidden">
          <IntegrationSettings theme={theme} toggleTheme={toggleTheme} />
        </main>
      ) : (
        <>
          <ConversationList
            activeChannel={activeChannel}
            filterStatus={filterStatus}
            filtered={filtered}
            search={search}
            selected={selected}
            setConversations={setConversations}
            setFilterStatus={setFilterStatus}
            setSearch={setSearch}
            setSelected={setSelected}
            stats={stats}
          />
          <ConversationView
            activeTab={activeTab}
            addNote={addNote}
            messagesEndRef={messagesEndRef}
            noteText={noteText}
            replyText={replyText}
            selectedConv={selectedConv}
            sendReply={sendReply}
            setActiveTab={setActiveTab}
            setNoteText={setNoteText}
            setReplyText={setReplyText}
            setShowSaved={setShowSaved}
            showSaved={showSaved}
            updateAssignee={updateAssignee}
            updateStatus={updateStatus}
          />
        </>
      )}
    </div>
  );
}
