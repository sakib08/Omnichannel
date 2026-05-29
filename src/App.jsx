import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ConversationList from "./components/ConversationList.jsx";
import ConversationView from "./components/ConversationView.jsx";
import Sidebar from "./components/Sidebar.jsx";
import IntegrationSettings from "./components/settings/Setttings.js";
import { api, currentUser } from "./api/client.js";

// ── Data normalisers ─────────────────────────────────────────────────────────

function makeInitials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function relativeTime(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr.replace(" ", "T"));
  if (isNaN(date.getTime())) return dateStr;
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

function formatTime(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr.replace(" ", "T"));
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const VALID_PRIORITIES = new Set(["high", "medium", "low"]);

export function normaliseConversation(raw) {
  const name = raw.contactName || raw.contactHandle || "Unknown";
  return {
    id: raw.id,
    channel: raw.channel || "email",
    externalId: raw.externalId || "",
    name,
    avatar: makeInitials(name),
    contactHandle: raw.contactHandle || "",
    status: raw.status || "open",
    subject: raw.subject || "(no subject)",
    preview: raw.preview || "",
    time: relativeTime(raw.updatedAt),
    unread: raw.unreadCount || 0,
    assigneeId: raw.assigneeId || null,
    assignee: "Unassigned",
    departmentId: raw.departmentId || null,
    priority: VALID_PRIORITIES.has(raw.priority) ? raw.priority : "medium",
    slaDeadline: 0,
    slaUnit: "hr",
    notes: [],
  };
}

export function normaliseMessage(raw) {
  const body = raw.body || "";
  return {
    id: raw.id,
    sender: raw.senderName || "Unknown",
    text: body,
    isHtml: /<[a-z][\s\S]*>/i.test(body),
    time: formatTime(raw.sentAt),
    isAgent: raw.senderType === "agent",
  };
}

// ── Component ────────────────────────────────────────────────────────────────

export default function OmnichannelApp() {
  const [activeChannel, setActiveChannel] = useState("all");
  const [conversations, setConversations] = useState([]);
  const [messagesByConvId, setMessagesByConvId] = useState({});
  const [agents, setAgents] = useState([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("reply");
  const [replyText, setReplyText] = useState("");
  const [noteText, setNoteText] = useState("");
  const [showSaved, setShowSaved] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [theme, setTheme] = useState("light");
  const [sendError, setSendError] = useState("");
  const messagesEndRef = useRef(null);
  const refreshTimerRef = useRef(null);

  // ── Load agents once (for assignee selector) ────────────────────────────────
  useEffect(() => {
    api.listAgents().then((data) => setAgents(data || [])).catch(() => {});
  }, []);

  // ── Load conversations ──────────────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    try {
      const params = {};
      if (activeChannel !== "all") params.channel = activeChannel;
      const raw = await api.listConversations(params);
      setConversations((raw || []).map(normaliseConversation));
    } catch (err) {
      console.error("[SME] Failed to load conversations:", err);
    } finally {
      setLoadingConvs(false);
    }
  }, [activeChannel]);

  useEffect(() => {
    setLoadingConvs(true);
    loadConversations();
  }, [loadConversations]);

  // Auto-refresh every 30 s to pick up new inbound emails.
  useEffect(() => {
    refreshTimerRef.current = setInterval(loadConversations, 30_000);
    return () => clearInterval(refreshTimerRef.current);
  }, [loadConversations]);

  // ── Lazy-load messages when a conversation is opened ───────────────────────
  useEffect(() => {
    if (!selected) return;
    if (messagesByConvId[selected] !== undefined) return; // already cached

    setLoadingMsgs(true);
    api
      .listMessages(selected)
      .then((msgs) => {
        setMessagesByConvId((prev) => ({
          ...prev,
          [selected]: (msgs || []).map(normaliseMessage),
        }));
        // Mark as read.
        api.updateConversation(selected, { unreadCount: 0 }).catch(() => {});
        setConversations((prev) =>
          prev.map((c) => (c.id === selected ? { ...c, unread: 0 } : c))
        );
      })
      .catch((err) => console.error("[SME] Failed to load messages:", err))
      .finally(() => setLoadingMsgs(false));
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scroll to bottom when new messages arrive ──────────────────────────────
  const selectedMessages = messagesByConvId[selected];
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedMessages?.length]);

  // ── Derived conversation (merged with loaded messages + notes) ─────────────
  const selectedConv = useMemo(() => {
    const conv = conversations.find((c) => c.id === selected);
    if (!conv) return null;
    return {
      ...conv,
      messages: messagesByConvId[selected] || [],
    };
  }, [conversations, selected, messagesByConvId]);

  // ── Client-side filtering ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return conversations.filter((c) => {
      if (filterStatus !== "all" && c.status !== filterStatus) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || c.subject.toLowerCase().includes(q);
    });
  }, [conversations, filterStatus, search]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    open: conversations.filter((c) => c.status === "open").length,
    pending: conversations.filter((c) => c.status === "pending").length,
    resolved: conversations.filter((c) => c.status === "resolved").length,
    unread: conversations.reduce((sum, c) => sum + c.unread, 0),
  }), [conversations]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleSelectConversation = (id) => {
    setSelected(id);
    setSendError("");
    // Optimistically clear unread badge.
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c))
    );
  };

  const sendReply = async () => {
    if (!replyText.trim() || !selected || sendingReply) return;
    const conv = conversations.find((c) => c.id === selected);
    if (!conv) return;

    setSendingReply(true);
    setSendError("");

    const plainText = replyText.trim();

    try {
      let newMsg;

      if (conv.channel === "email") {
        // Send via the email pipe endpoint which uses SMTP.
        const result = await api.sendEmail({
          conversationId: selected,
          to: conv.contactHandle,
          toName: conv.name,
          subject: conv.subject.match(/^re:/i) ? conv.subject : `Re: ${conv.subject}`,
          body: `<p>${plainText.replace(/\n/g, "<br>")}</p>`,
        });
        newMsg = {
          id: result.messageId || Date.now(),
          sender: currentUser.name || "You",
          text: `<p>${plainText.replace(/\n/g, "<br>")}</p>`,
          isHtml: true,
          time: "just now",
          isAgent: true,
        };
      } else {
        // Generic message store for other channels.
        const result = await api.createMessage({
          conversationId: selected,
          body: plainText,
          senderType: "agent",
          senderName: currentUser.name || "Agent",
        });
        newMsg = normaliseMessage(result);
      }

      setMessagesByConvId((prev) => ({
        ...prev,
        [selected]: [...(prev[selected] || []), newMsg],
      }));
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selected
            ? { ...c, preview: plainText.slice(0, 60), time: "just now" }
            : c
        )
      );
      setReplyText("");
    } catch (err) {
      console.error("[SME] Send failed:", err);
      setSendError(err.message || "Failed to send. Please try again.");
    } finally {
      setSendingReply(false);
    }
  };

  const addNote = () => {
    if (!noteText.trim() || !selected) return;
    // Notes are local-only (no dedicated notes API yet).
    setConversations((prev) =>
      prev.map((c) =>
        c.id === selected ? { ...c, notes: [...c.notes, noteText.trim()] } : c
      )
    );
    setNoteText("");
  };

  const updateAssignee = async (agentId) => {
    const parsedId = agentId ? Number(agentId) : null;
    const agent = agents.find((a) => a.id === parsedId);
    setConversations((prev) =>
      prev.map((c) =>
        c.id === selected
          ? { ...c, assigneeId: parsedId, assignee: agent ? agent.name : "Unassigned" }
          : c
      )
    );
    try {
      await api.updateConversation(selected, { assigneeId: parsedId });
    } catch (err) {
      console.error("[SME] Failed to update assignee:", err);
    }
  };

  const updateStatus = async (status) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === selected ? { ...c, status } : c))
    );
    try {
      await api.updateConversation(selected, { status });
    } catch (err) {
      console.error("[SME] Failed to update status:", err);
      loadConversations();
    }
  };

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

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
            loading={loadingConvs}
            search={search}
            selected={selected}
            setConversations={setConversations}
            setFilterStatus={setFilterStatus}
            setSearch={setSearch}
            setSelected={handleSelectConversation}
            stats={stats}
          />
          <ConversationView
            activeTab={activeTab}
            addNote={addNote}
            agents={agents}
            loadingMessages={loadingMsgs}
            messagesEndRef={messagesEndRef}
            noteText={noteText}
            replyText={replyText}
            selectedConv={selectedConv}
            sendError={sendError}
            sendReply={sendReply}
            sendingReply={sendingReply}
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
