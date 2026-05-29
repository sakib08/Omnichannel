/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/App.jsx"
/*!*********************!*\
  !*** ./src/App.jsx ***!
  \*********************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ OmnichannelApp),
/* harmony export */   normaliseConversation: () => (/* binding */ normaliseConversation),
/* harmony export */   normaliseMessage: () => (/* binding */ normaliseMessage)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _components_ConversationList_jsx__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./components/ConversationList.jsx */ "./src/components/ConversationList.jsx");
/* harmony import */ var _components_ConversationView_jsx__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./components/ConversationView.jsx */ "./src/components/ConversationView.jsx");
/* harmony import */ var _components_Sidebar_jsx__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./components/Sidebar.jsx */ "./src/components/Sidebar.jsx");
/* harmony import */ var _components_settings_Setttings_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./components/settings/Setttings.js */ "./src/components/settings/Setttings.js");
/* harmony import */ var _api_client_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./api/client.js */ "./src/api/client.js");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! react/jsx-runtime */ "react/jsx-runtime");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__);







// ── Data normalisers ─────────────────────────────────────────────────────────

function makeInitials(name = "") {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
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
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}
const VALID_PRIORITIES = new Set(["high", "medium", "low"]);
function normaliseConversation(raw) {
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
    notes: []
  };
}
function normaliseMessage(raw) {
  const body = raw.body || "";
  return {
    id: raw.id,
    sender: raw.senderName || "Unknown",
    text: body,
    isHtml: /<[a-z][\s\S]*>/i.test(body),
    time: formatTime(raw.sentAt),
    isAgent: raw.senderType === "agent"
  };
}

// ── Component ────────────────────────────────────────────────────────────────

function OmnichannelApp() {
  const [activeChannel, setActiveChannel] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)("all");
  const [conversations, setConversations] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)([]);
  const [messagesByConvId, setMessagesByConvId] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)({});
  const [agents, setAgents] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)([]);
  const [loadingConvs, setLoadingConvs] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(true);
  const [loadingMsgs, setLoadingMsgs] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
  const [sendingReply, setSendingReply] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
  const [selected, setSelected] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(null);
  const [search, setSearch] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)("");
  const [activeTab, setActiveTab] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)("reply");
  const [replyText, setReplyText] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)("");
  const [noteText, setNoteText] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)("");
  const [showSaved, setShowSaved] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
  const [filterStatus, setFilterStatus] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)("all");
  const [theme, setTheme] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)("light");
  const [sendError, setSendError] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)("");
  const messagesEndRef = (0,react__WEBPACK_IMPORTED_MODULE_0__.useRef)(null);
  const refreshTimerRef = (0,react__WEBPACK_IMPORTED_MODULE_0__.useRef)(null);

  // ── Load agents once (for assignee selector) ────────────────────────────────
  (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    _api_client_js__WEBPACK_IMPORTED_MODULE_5__.api.listAgents().then(data => setAgents(data || [])).catch(() => {});
  }, []);

  // ── Load conversations ──────────────────────────────────────────────────────
  const loadConversations = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async () => {
    try {
      const params = {};
      if (activeChannel !== "all") params.channel = activeChannel;
      const raw = await _api_client_js__WEBPACK_IMPORTED_MODULE_5__.api.listConversations(params);
      setConversations((raw || []).map(normaliseConversation));
    } catch (err) {
      console.error("[SME] Failed to load conversations:", err);
    } finally {
      setLoadingConvs(false);
    }
  }, [activeChannel]);
  (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    setLoadingConvs(true);
    loadConversations();
  }, [loadConversations]);

  // Auto-refresh every 30 s to pick up new inbound emails.
  (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    refreshTimerRef.current = setInterval(loadConversations, 30_000);
    return () => clearInterval(refreshTimerRef.current);
  }, [loadConversations]);

  // ── Lazy-load messages when a conversation is opened ───────────────────────
  (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    if (!selected) return;
    if (messagesByConvId[selected] !== undefined) return; // already cached

    setLoadingMsgs(true);
    _api_client_js__WEBPACK_IMPORTED_MODULE_5__.api.listMessages(selected).then(msgs => {
      setMessagesByConvId(prev => ({
        ...prev,
        [selected]: (msgs || []).map(normaliseMessage)
      }));
      // Mark as read.
      _api_client_js__WEBPACK_IMPORTED_MODULE_5__.api.updateConversation(selected, {
        unreadCount: 0
      }).catch(() => {});
      setConversations(prev => prev.map(c => c.id === selected ? {
        ...c,
        unread: 0
      } : c));
    }).catch(err => console.error("[SME] Failed to load messages:", err)).finally(() => setLoadingMsgs(false));
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scroll to bottom when new messages arrive ──────────────────────────────
  const selectedMessages = messagesByConvId[selected];
  (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth"
    });
  }, [selectedMessages?.length]);

  // ── Derived conversation (merged with loaded messages + notes) ─────────────
  const selectedConv = (0,react__WEBPACK_IMPORTED_MODULE_0__.useMemo)(() => {
    const conv = conversations.find(c => c.id === selected);
    if (!conv) return null;
    return {
      ...conv,
      messages: messagesByConvId[selected] || []
    };
  }, [conversations, selected, messagesByConvId]);

  // ── Client-side filtering ──────────────────────────────────────────────────
  const filtered = (0,react__WEBPACK_IMPORTED_MODULE_0__.useMemo)(() => {
    const q = search.toLowerCase();
    return conversations.filter(c => {
      if (filterStatus !== "all" && c.status !== filterStatus) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || c.subject.toLowerCase().includes(q);
    });
  }, [conversations, filterStatus, search]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = (0,react__WEBPACK_IMPORTED_MODULE_0__.useMemo)(() => ({
    open: conversations.filter(c => c.status === "open").length,
    pending: conversations.filter(c => c.status === "pending").length,
    resolved: conversations.filter(c => c.status === "resolved").length,
    unread: conversations.reduce((sum, c) => sum + c.unread, 0)
  }), [conversations]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleSelectConversation = id => {
    setSelected(id);
    setSendError("");
    // Optimistically clear unread badge.
    setConversations(prev => prev.map(c => c.id === id ? {
      ...c,
      unread: 0
    } : c));
  };
  const sendReply = async () => {
    if (!replyText.trim() || !selected || sendingReply) return;
    const conv = conversations.find(c => c.id === selected);
    if (!conv) return;
    setSendingReply(true);
    setSendError("");
    const plainText = replyText.trim();
    try {
      let newMsg;
      if (conv.channel === "email") {
        // Email: send via SMTP using the email pipe endpoint.
        const result = await _api_client_js__WEBPACK_IMPORTED_MODULE_5__.api.sendEmail({
          conversationId: selected,
          to: conv.contactHandle,
          toName: conv.name,
          subject: conv.subject.match(/^re:/i) ? conv.subject : `Re: ${conv.subject}`,
          body: `<p>${plainText.replace(/\n/g, "<br>")}</p>`
        });
        newMsg = {
          id: result.messageId || Date.now(),
          sender: _api_client_js__WEBPACK_IMPORTED_MODULE_5__.currentUser.name || "You",
          text: `<p>${plainText.replace(/\n/g, "<br>")}</p>`,
          isHtml: true,
          time: "just now",
          isAgent: true
        };
      } else {
        // All other channels: use the channel-specific send endpoint which
        // both delivers the message via the external API and stores it in DB.
        const result = await _api_client_js__WEBPACK_IMPORTED_MODULE_5__.api.sendChannel(conv.channel, {
          conversationId: selected,
          recipientId: conv.externalId || conv.contactHandle,
          text: plainText
        });
        newMsg = {
          id: result.messageId || Date.now(),
          sender: _api_client_js__WEBPACK_IMPORTED_MODULE_5__.currentUser.name || "You",
          text: plainText,
          isHtml: false,
          time: "just now",
          isAgent: true
        };
      }
      setMessagesByConvId(prev => ({
        ...prev,
        [selected]: [...(prev[selected] || []), newMsg]
      }));
      setConversations(prev => prev.map(c => c.id === selected ? {
        ...c,
        preview: plainText.slice(0, 60),
        time: "just now"
      } : c));
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
    setConversations(prev => prev.map(c => c.id === selected ? {
      ...c,
      notes: [...c.notes, noteText.trim()]
    } : c));
    setNoteText("");
  };
  const updateAssignee = async agentId => {
    const parsedId = agentId ? Number(agentId) : null;
    const agent = agents.find(a => a.id === parsedId);
    setConversations(prev => prev.map(c => c.id === selected ? {
      ...c,
      assigneeId: parsedId,
      assignee: agent ? agent.name : "Unassigned"
    } : c));
    try {
      await _api_client_js__WEBPACK_IMPORTED_MODULE_5__.api.updateConversation(selected, {
        assigneeId: parsedId
      });
    } catch (err) {
      console.error("[SME] Failed to update assignee:", err);
    }
  };
  const updateStatus = async status => {
    setConversations(prev => prev.map(c => c.id === selected ? {
      ...c,
      status
    } : c));
    try {
      await _api_client_js__WEBPACK_IMPORTED_MODULE_5__.api.updateConversation(selected, {
        status
      });
    } catch (err) {
      console.error("[SME] Failed to update status:", err);
      loadConversations();
    }
  };
  const toggleTheme = () => setTheme(t => t === "dark" ? "light" : "dark");
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)("div", {
    className: `sme-app-root theme-${theme} flex bg-gray-50 font-sans overflow-hidden`,
    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(_components_Sidebar_jsx__WEBPACK_IMPORTED_MODULE_3__["default"], {
      activeChannel: activeChannel,
      conversations: conversations,
      setActiveChannel: setActiveChannel,
      theme: theme,
      toggleTheme: toggleTheme
    }), activeChannel === "settings" ? /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("main", {
      className: "flex-1 overflow-hidden",
      children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(_components_settings_Setttings_js__WEBPACK_IMPORTED_MODULE_4__["default"], {
        theme: theme,
        toggleTheme: toggleTheme
      })
    }) : /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.Fragment, {
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(_components_ConversationList_jsx__WEBPACK_IMPORTED_MODULE_1__["default"], {
        activeChannel: activeChannel,
        filterStatus: filterStatus,
        filtered: filtered,
        loading: loadingConvs,
        search: search,
        selected: selected,
        setConversations: setConversations,
        setFilterStatus: setFilterStatus,
        setSearch: setSearch,
        setSelected: handleSelectConversation,
        stats: stats
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(_components_ConversationView_jsx__WEBPACK_IMPORTED_MODULE_2__["default"], {
        activeTab: activeTab,
        addNote: addNote,
        agents: agents,
        loadingMessages: loadingMsgs,
        messagesEndRef: messagesEndRef,
        noteText: noteText,
        replyText: replyText,
        selectedConv: selectedConv,
        sendError: sendError,
        sendReply: sendReply,
        sendingReply: sendingReply,
        setActiveTab: setActiveTab,
        setNoteText: setNoteText,
        setReplyText: setReplyText,
        setShowSaved: setShowSaved,
        showSaved: showSaved,
        updateAssignee: updateAssignee,
        updateStatus: updateStatus
      })]
    })]
  });
}

/***/ },

/***/ "./src/api/client.js"
/*!***************************!*\
  !*** ./src/api/client.js ***!
  \***************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   api: () => (/* binding */ api),
/* harmony export */   caps: () => (/* binding */ caps),
/* harmony export */   currentUser: () => (/* binding */ currentUser),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   restNonce: () => (/* binding */ restNonce),
/* harmony export */   restUrl: () => (/* binding */ restUrl),
/* harmony export */   siteHost: () => (/* binding */ siteHost),
/* harmony export */   siteOrigin: () => (/* binding */ siteOrigin),
/* harmony export */   webhookUrl: () => (/* binding */ webhookUrl)
/* harmony export */ });
// Thin REST client around the SMEBoot bootstrap object that the WP admin
// page exposes via wp_localize_script.  Falls back to sensible defaults so
// the module is still importable when developing outside the WP admin shell.

const boot = typeof window !== "undefined" && window.SMEBoot ? window.SMEBoot : {};
const restUrl = (boot.restUrl || "/wp-json/sme/v1/").replace(/\/?$/, "/");

/** Build a fully-qualified webhook URL for a given channel slug.
 *  e.g. webhookUrl("telegram") → "https://example.com/wp-json/sme/v1/webhooks/telegram"
 */
const webhookUrl = slug => restUrl + "webhooks/" + slug;

/** Site origin, derived from the REST URL (used for display-only labels). */
const siteOrigin = (() => {
  try {
    return new URL(restUrl).origin;
  } catch (_) {
    return "";
  }
})();

/** Hostname only, e.g. "example.com" */
const siteHost = (() => {
  try {
    return new URL(restUrl).hostname;
  } catch (_) {
    return "yourdomain.com";
  }
})();
const restNonce = boot.nonce || "";
const currentUser = boot.user || {
  id: 0,
  name: "Guest",
  email: "",
  roles: []
};
const caps = boot.caps || {
  isAdmin: false,
  canAccessMessaging: false,
  canManageSettings: false,
  canManageDepts: false
};
async function request(path, {
  method = "GET",
  body,
  signal
} = {}) {
  const url = restUrl + path.replace(/^\//, "");
  const headers = {
    Accept: "application/json"
  };
  if (restNonce) headers["X-WP-Nonce"] = restNonce;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(url, {
    method,
    credentials: "same-origin",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = text;
  }
  if (!response.ok) {
    const message = data && data.message || `Request failed: ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}
const api = {
  getSettings: () => request("settings"),
  getChannelSettings: channel => request(`settings/${channel}`),
  saveSettings: payload => request("settings", {
    method: "POST",
    body: payload
  }),
  saveChannel: (channel, payload) => request(`settings/${channel}`, {
    method: "POST",
    body: payload
  }),
  listDepartments: () => request("departments"),
  createDepartment: payload => request("departments", {
    method: "POST",
    body: payload
  }),
  updateDepartment: (id, payload) => request(`departments/${id}`, {
    method: "PUT",
    body: payload
  }),
  deleteDepartment: id => request(`departments/${id}`, {
    method: "DELETE"
  }),
  listAgents: () => request("agents"),
  assignAgentDepts: (id, departmentIds) => request(`agents/${id}/departments`, {
    method: "POST",
    body: {
      departmentIds
    }
  }),
  listConversations: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`conversations${qs ? `?${qs}` : ""}`);
  },
  listMessages: cid => request(`conversations/${cid}/messages`),
  createConversation: payload => request("conversations", {
    method: "POST",
    body: payload
  }),
  updateConversation: (id, payload) => request(`conversations/${id}`, {
    method: "PUT",
    body: payload
  }),
  createMessage: payload => request("messages", {
    method: "POST",
    body: payload
  }),
  sendEmail: payload => request("email/send", {
    method: "POST",
    body: payload
  }),
  pollEmail: () => request("email/poll", {
    method: "POST"
  }),
  testEmailConnection: type => request("email/test-connection", {
    method: "POST",
    body: {
      type
    }
  }),
  // Channel-specific outbound send (all share the same { conversationId, recipientId, text } shape).
  sendTelegram: payload => request("telegram/send", {
    method: "POST",
    body: payload
  }),
  sendWhatsApp: payload => request("whatsapp/send", {
    method: "POST",
    body: payload
  }),
  sendMessenger: payload => request("messenger/send", {
    method: "POST",
    body: payload
  }),
  sendWeChat: payload => request("wechat/send", {
    method: "POST",
    body: payload
  }),
  sendSms: payload => request("sms/send", {
    method: "POST",
    body: payload
  }),
  sendLine: payload => request("line/send", {
    method: "POST",
    body: payload
  }),
  sendInstagram: payload => request("instagram/send", {
    method: "POST",
    body: payload
  }),
  sendViber: payload => request("viber/send", {
    method: "POST",
    body: payload
  }),
  /** Generic channel send — picks the right endpoint from the channel slug. */
  sendChannel: (channel, payload) => {
    const map = {
      email: "email/send",
      telegram: "telegram/send",
      whatsapp: "whatsapp/send",
      messenger: "messenger/send",
      wechat: "wechat/send",
      sms: "sms/send",
      line: "line/send",
      instagram: "instagram/send",
      viber: "viber/send"
    };
    const path = map[channel];
    if (!path) return Promise.reject(new Error(`No send endpoint for channel: ${channel}`));
    return request(path, {
      method: "POST",
      body: payload
    });
  },
  /** Register a Telegram webhook with a single API call. */
  registerTelegramWebhook: () => request("telegram/set-webhook", {
    method: "POST"
  }),
  /** Register Viber webhook via the Viber Chat API. */
  registerViberWebhook: () => request("viber/set-webhook", {
    method: "POST"
  })
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (api);

/***/ },

/***/ "./src/components/Avatar.jsx"
/*!***********************************!*\
  !*** ./src/components/Avatar.jsx ***!
  \***********************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Avatar)
/* harmony export */ });
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react/jsx-runtime */ "react/jsx-runtime");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__);

function Avatar({
  initials,
  color = "#6366F1",
  size = 36
}) {
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", {
    style: {
      width: size,
      height: size,
      background: color + "22",
      border: `1.5px solid ${color}44`,
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: size * 0.35,
      fontWeight: 600,
      color,
      flexShrink: 0
    },
    children: initials
  });
}

/***/ },

/***/ "./src/components/ChannelBadge.jsx"
/*!*****************************************!*\
  !*** ./src/components/ChannelBadge.jsx ***!
  \*****************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ ChannelBadge)
/* harmony export */ });
/* harmony import */ var _constants_config__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../constants/config */ "./src/constants/config.js");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react/jsx-runtime */ "react/jsx-runtime");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__);


const channelMeta = id => _constants_config__WEBPACK_IMPORTED_MODULE_0__.CHANNELS.find(c => c.id === id) || _constants_config__WEBPACK_IMPORTED_MODULE_0__.CHANNELS[0];

/** Renders either a Tabler icon class or a text letter (icon: "letter:XX"). */
function ChannelIcon({
  icon,
  color,
  size
}) {
  if (icon && icon.startsWith("letter:")) {
    const letter = icon.slice(7);
    return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        color: "#fff",
        fontSize: Math.round(size * 0.6),
        fontWeight: 800,
        lineHeight: 1,
        flexShrink: 0
      },
      children: letter
    });
  }
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)("i", {
    className: `ti ${icon}`,
    style: {
      fontSize: size
    }
  });
}
function ChannelBadge({
  channelId,
  small
}) {
  const ch = channelMeta(channelId);
  const iconSize = small ? 11 : 13;
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxs)("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      fontSize: small ? 11 : 12,
      fontWeight: 500,
      color: ch.color || "#6b7280",
      background: (ch.color || "#6b7280") + "18",
      borderRadius: 20,
      padding: small ? "2px 7px" : "3px 9px"
    },
    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)(ChannelIcon, {
      icon: ch.icon,
      color: ch.color || "#6b7280",
      size: iconSize
    }), !small && ch.label]
  });
}

/***/ },

/***/ "./src/components/ConversationList.jsx"
/*!*********************************************!*\
  !*** ./src/components/ConversationList.jsx ***!
  \*********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ ConversationList)
/* harmony export */ });
/* harmony import */ var _Avatar_jsx__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./Avatar.jsx */ "./src/components/Avatar.jsx");
/* harmony import */ var _ChannelBadge_jsx__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./ChannelBadge.jsx */ "./src/components/ChannelBadge.jsx");
/* harmony import */ var _SLABadge_jsx__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./SLABadge.jsx */ "./src/components/SLABadge.jsx");
/* harmony import */ var _constants_config__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../constants/config */ "./src/constants/config.js");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react/jsx-runtime */ "react/jsx-runtime");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__);





function ConversationList({
  activeChannel,
  filterStatus,
  filtered,
  loading,
  search,
  selected,
  setFilterStatus,
  setSearch,
  setSelected,
  setConversations,
  stats
}) {
  const title = (0,_constants_config__WEBPACK_IMPORTED_MODULE_3__.channelMeta)(activeChannel).label === "All" ? "Unified Inbox" : (0,_constants_config__WEBPACK_IMPORTED_MODULE_3__.channelMeta)(activeChannel).label;
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
    className: "w-80 bg-white border-r border-gray-100 flex flex-col shadow-sm",
    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "px-4 pt-4 pb-3 border-b border-gray-100",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "flex flex-col gap-2 mb-3",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("h1", {
          className: "text-sm font-semibold text-gray-800",
          children: title
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
          className: "flex gap-1 flex-wrap",
          children: _constants_config__WEBPACK_IMPORTED_MODULE_3__.STATUS_FILTERS.map(status => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("button", {
            onClick: () => setFilterStatus(status),
            className: `text-xs px-2 py-0.5 rounded-full font-medium transition-all ${filterStatus === status ? "bg-indigo-600 text-white" : "text-gray-500 hover:bg-gray-100"}`,
            children: status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)
          }, status))
        })]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
        className: "grid grid-cols-4 gap-1 mb-3",
        children: [{
          label: "Open",
          val: stats.open,
          color: "text-blue-600"
        }, {
          label: "Pending",
          val: stats.pending,
          color: "text-amber-600"
        }, {
          label: "Resolved",
          val: stats.resolved,
          color: "text-green-600"
        }, {
          label: "Unread",
          val: stats.unread,
          color: "text-red-600"
        }].map(stat => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
          className: "bg-gray-50 rounded-lg p-1.5 text-center",
          children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
            className: `text-base font-bold ${stat.color}`,
            children: stat.val
          }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
            className: "text-xs text-gray-400",
            children: stat.label
          })]
        }, stat.label))
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "relative",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("i", {
          className: "ti ti-search absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400",
          style: {
            fontSize: 14
          }
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("input", {
          type: "text",
          placeholder: "Search conversations...",
          value: search,
          onChange: event => setSearch(event.target.value),
          className: "w-full pl-8 pr-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
        })]
      })]
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "flex-1 overflow-y-auto",
      children: [loading && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "flex flex-col items-center justify-center h-40 text-gray-400 gap-2",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("svg", {
          className: "animate-spin w-5 h-5 text-indigo-500",
          viewBox: "0 0 24 24",
          fill: "none",
          children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("circle", {
            className: "opacity-25",
            cx: "12",
            cy: "12",
            r: "10",
            stroke: "currentColor",
            strokeWidth: "4"
          }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("path", {
            className: "opacity-75",
            fill: "currentColor",
            d: "M4 12a8 8 0 018-8v8z"
          })]
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("span", {
          className: "text-sm",
          children: "Loading\u2026"
        })]
      }), !loading && filtered.length === 0 && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "flex flex-col items-center justify-center h-40 text-gray-400 gap-2",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("i", {
          className: "ti ti-inbox-off",
          style: {
            fontSize: 28
          }
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("span", {
          className: "text-sm",
          children: "No conversations"
        })]
      }), !loading && filtered.map(conversation => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("button", {
        onClick: () => {
          setSelected(conversation.id);
        },
        className: `w-full text-left px-4 py-3 border-b border-gray-50 transition-all hover:bg-indigo-50/40 ${selected === conversation.id ? "bg-indigo-50 border-l-2 border-l-indigo-500" : ""}`,
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
          className: "flex items-start gap-2.5",
          children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_Avatar_jsx__WEBPACK_IMPORTED_MODULE_0__["default"], {
            initials: conversation.avatar,
            color: (0,_constants_config__WEBPACK_IMPORTED_MODULE_3__.channelMeta)(conversation.channel).color || "#6366F1"
          }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
            className: "flex-1 min-w-0",
            children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
              className: "flex items-center justify-between mb-0.5",
              children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("span", {
                className: "text-sm font-semibold text-gray-800 truncate",
                children: conversation.name
              }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("span", {
                className: "text-xs text-gray-400 shrink-0 ml-1",
                children: conversation.time
              })]
            }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
              className: "text-xs text-gray-600 font-medium truncate mb-1",
              children: conversation.subject
            }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
              className: "flex items-center justify-between gap-1",
              children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("span", {
                className: "text-xs text-gray-400 truncate",
                children: conversation.preview
              }), conversation.unread > 0 && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("span", {
                className: "shrink-0 w-4 h-4 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold",
                children: conversation.unread
              })]
            }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
              className: "flex items-center gap-1 mt-1.5 flex-wrap",
              children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_ChannelBadge_jsx__WEBPACK_IMPORTED_MODULE_1__["default"], {
                channelId: conversation.channel,
                small: true
              }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("span", {
                className: `text-xs px-1.5 py-0.5 rounded-full font-medium ${_constants_config__WEBPACK_IMPORTED_MODULE_3__.statusConfig[conversation.status].cls}`,
                children: _constants_config__WEBPACK_IMPORTED_MODULE_3__.statusConfig[conversation.status].label
              }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_SLABadge_jsx__WEBPACK_IMPORTED_MODULE_2__["default"], {
                deadline: conversation.slaDeadline,
                unit: conversation.slaUnit
              })]
            })]
          })]
        })
      }, conversation.id))]
    })]
  });
}

/***/ },

/***/ "./src/components/ConversationView.jsx"
/*!*********************************************!*\
  !*** ./src/components/ConversationView.jsx ***!
  \*********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ ConversationView)
/* harmony export */ });
/* harmony import */ var _Avatar_jsx__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./Avatar.jsx */ "./src/components/Avatar.jsx");
/* harmony import */ var _ChannelBadge_jsx__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./ChannelBadge.jsx */ "./src/components/ChannelBadge.jsx");
/* harmony import */ var _RightPanel_jsx__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./RightPanel.jsx */ "./src/components/RightPanel.jsx");
/* harmony import */ var _constants_config__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../constants/config */ "./src/constants/config.js");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react/jsx-runtime */ "react/jsx-runtime");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__);





function MessageBubble({
  message,
  conv
}) {
  const avatarInitials = message.isAgent ? "AG" : conv.avatar;
  const avatarColor = message.isAgent ? "#6366F1" : (0,_constants_config__WEBPACK_IMPORTED_MODULE_3__.channelMeta)(conv.channel).color || "#6366F1";
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
    className: `flex gap-3 ${message.isAgent ? "flex-row-reverse" : ""}`,
    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_Avatar_jsx__WEBPACK_IMPORTED_MODULE_0__["default"], {
      initials: avatarInitials,
      color: avatarColor,
      size: 32
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: `max-w-md ${message.isAgent ? "items-end" : "items-start"} flex flex-col gap-1`,
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "flex items-center gap-2",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("span", {
          className: "text-xs font-medium text-gray-500",
          children: message.sender
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("span", {
          className: "text-xs text-gray-400",
          children: message.time
        })]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
        className: `px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${message.isAgent ? "bg-indigo-600 text-white rounded-tr-sm" : "bg-white border border-gray-200 text-gray-800 rounded-tl-sm"}`,
        children: message.isHtml ? /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
          className: "sme-email-body prose prose-sm max-w-none"
          /* Email HTML has already passed wp_kses_post on the server */,
          dangerouslySetInnerHTML: {
            __html: message.text
          }
        }) : /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("span", {
          style: {
            whiteSpace: "pre-wrap"
          },
          children: message.text
        })
      })]
    })]
  });
}
function ConversationView({
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
  updateStatus
}) {
  if (!selectedConv) {
    return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "flex-1 flex flex-col items-center justify-center bg-gray-50 gap-4 text-gray-400",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
        className: "w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("i", {
          className: "ti ti-messages text-indigo-400",
          style: {
            fontSize: 32
          }
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "text-center",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
          className: "text-base font-semibold text-gray-600 mb-1",
          children: "Select a conversation"
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
          className: "text-sm text-gray-400",
          children: "Choose from the inbox to start replying"
        })]
      })]
    });
  }
  const isEmail = selectedConv.channel === "email";
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
    className: "flex-1 flex flex-col min-w-0",
    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between shadow-sm",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "flex items-center gap-3",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_Avatar_jsx__WEBPACK_IMPORTED_MODULE_0__["default"], {
          initials: selectedConv.avatar,
          color: (0,_constants_config__WEBPACK_IMPORTED_MODULE_3__.channelMeta)(selectedConv.channel).color || "#6366F1",
          size: 40
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
          children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
            className: "flex items-center gap-2",
            children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("span", {
              className: "font-semibold text-gray-900",
              children: selectedConv.name
            }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_ChannelBadge_jsx__WEBPACK_IMPORTED_MODULE_1__["default"], {
              channelId: selectedConv.channel
            }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("span", {
              className: `text-xs px-2 py-0.5 rounded-full font-medium ${_constants_config__WEBPACK_IMPORTED_MODULE_3__.statusConfig[selectedConv.status]?.cls || ""}`,
              children: _constants_config__WEBPACK_IMPORTED_MODULE_3__.statusConfig[selectedConv.status]?.label || selectedConv.status
            }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("span", {
              className: `text-xs px-2 py-0.5 rounded-full font-medium ${_constants_config__WEBPACK_IMPORTED_MODULE_3__.priorityConfig[selectedConv.priority]?.bg || ""}`,
              children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("span", {
                className: `inline-block w-1.5 h-1.5 rounded-full mr-1 ${_constants_config__WEBPACK_IMPORTED_MODULE_3__.priorityConfig[selectedConv.priority]?.dot || ""}`
              }), _constants_config__WEBPACK_IMPORTED_MODULE_3__.priorityConfig[selectedConv.priority]?.label || selectedConv.priority]
            })]
          }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
            className: "text-sm text-gray-500 flex items-center gap-2",
            children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("span", {
              children: selectedConv.subject
            }), isEmail && selectedConv.contactHandle && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("span", {
              className: "text-gray-400",
              children: ["<", selectedConv.contactHandle, ">"]
            })]
          })]
        })]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "flex items-center gap-2",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("select", {
          value: selectedConv.status,
          onChange: e => updateStatus(e.target.value),
          className: "text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white outline-none focus:ring-2 focus:ring-indigo-200",
          children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("option", {
            value: "open",
            children: "Open"
          }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("option", {
            value: "pending",
            children: "Pending"
          }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("option", {
            value: "resolved",
            children: "Resolved"
          })]
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("button", {
          className: "px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600",
          children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("i", {
            className: "ti ti-dots mr-1",
            style: {
              fontSize: 14
            }
          }), "More"]
        })]
      })]
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "flex flex-1 overflow-hidden",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "flex-1 flex flex-col min-w-0",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
          className: "flex-1 overflow-y-auto px-6 py-4 space-y-4",
          children: [loadingMessages ? /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
            className: "flex flex-col items-center justify-center h-40 gap-3 text-gray-400",
            children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("svg", {
              className: "animate-spin w-6 h-6 text-indigo-500",
              viewBox: "0 0 24 24",
              fill: "none",
              children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("circle", {
                className: "opacity-25",
                cx: "12",
                cy: "12",
                r: "10",
                stroke: "currentColor",
                strokeWidth: "4"
              }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("path", {
                className: "opacity-75",
                fill: "currentColor",
                d: "M4 12a8 8 0 018-8v8z"
              })]
            }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("span", {
              className: "text-sm",
              children: "Loading messages\u2026"
            })]
          }) : selectedConv.messages.length === 0 ? /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
            className: "flex flex-col items-center justify-center h-40 gap-2 text-gray-400",
            children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("i", {
              className: "ti ti-message-off",
              style: {
                fontSize: 28
              }
            }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("span", {
              className: "text-sm",
              children: "No messages yet"
            })]
          }) : selectedConv.messages.map(message => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(MessageBubble, {
            message: message,
            conv: selectedConv
          }, message.id)), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
            ref: messagesEndRef
          })]
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
          className: "bg-white border-t border-gray-100 px-4 py-3",
          children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
            className: "flex gap-1 mb-2 border-b border-gray-100 pb-2",
            children: ["reply", "note"].map(tab => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("button", {
              onClick: () => setActiveTab(tab),
              className: `text-sm px-3 py-1 rounded-lg font-medium transition-all ${activeTab === tab ? "bg-indigo-600 text-white" : "text-gray-500 hover:bg-gray-100"}`,
              children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("i", {
                className: `ti ${tab === "reply" ? "ti-send" : "ti-note"} mr-1`,
                style: {
                  fontSize: 13
                }
              }), tab === "reply" ? "Reply" : "Internal Note"]
            }, tab))
          }), activeTab === "reply" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
            children: [isEmail && selectedConv.contactHandle && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
              className: "flex items-center gap-1.5 mb-1.5 text-xs text-gray-400",
              children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("i", {
                className: "ti ti-mail",
                style: {
                  fontSize: 12
                }
              }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("span", {
                children: ["Sending via SMTP to ", /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("span", {
                  className: "font-medium text-gray-600",
                  children: selectedConv.contactHandle
                })]
              })]
            }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("textarea", {
              rows: 3,
              value: replyText,
              onChange: e => setReplyText(e.target.value),
              placeholder: `Reply via ${(0,_constants_config__WEBPACK_IMPORTED_MODULE_3__.channelMeta)(selectedConv.channel).label}…`,
              onKeyDown: e => {
                if (e.key === "Enter" && e.ctrlKey) sendReply();
              },
              disabled: sendingReply,
              className: "w-full text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 bg-gray-50 disabled:opacity-60"
            }), sendError && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
              className: "mt-1 text-xs text-red-600 flex items-center gap-1",
              children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("i", {
                className: "ti ti-alert-circle",
                style: {
                  fontSize: 12
                }
              }), sendError]
            }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
              className: "flex items-center justify-between mt-2",
              children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
                className: "relative",
                children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("button", {
                  onClick: () => setShowSaved(v => !v),
                  className: "text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1",
                  children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("i", {
                    className: "ti ti-bookmark",
                    style: {
                      fontSize: 13
                    }
                  }), "Saved Replies"]
                }), showSaved && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
                  className: "absolute bottom-8 left-0 bg-white border border-gray-200 rounded-xl shadow-lg w-72 z-20 overflow-hidden",
                  children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
                    className: "px-3 py-2 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide",
                    children: "Saved Replies"
                  }), _constants_config__WEBPACK_IMPORTED_MODULE_3__.SAVED_REPLIES.map(reply => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("button", {
                    onClick: () => {
                      setReplyText(reply.body);
                      setShowSaved(false);
                    },
                    className: "w-full text-left px-3 py-2 hover:bg-indigo-50 transition-colors",
                    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
                      className: "text-sm font-medium text-gray-800",
                      children: reply.title
                    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
                      className: "text-xs text-gray-500 truncate",
                      children: reply.body
                    })]
                  }, reply.id))]
                })]
              }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
                className: "flex items-center gap-2",
                children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("span", {
                  className: "text-xs text-gray-400",
                  children: "Ctrl+Enter to send"
                }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("button", {
                  onClick: sendReply,
                  disabled: !replyText.trim() || sendingReply,
                  className: "px-4 py-1.5 bg-indigo-600 text-white text-sm rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1",
                  children: [sendingReply ? /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("svg", {
                    className: "animate-spin w-3.5 h-3.5",
                    viewBox: "0 0 24 24",
                    fill: "none",
                    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("circle", {
                      className: "opacity-25",
                      cx: "12",
                      cy: "12",
                      r: "10",
                      stroke: "currentColor",
                      strokeWidth: "4"
                    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("path", {
                      className: "opacity-75",
                      fill: "currentColor",
                      d: "M4 12a8 8 0 018-8v8z"
                    })]
                  }) : /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("i", {
                    className: "ti ti-send",
                    style: {
                      fontSize: 14
                    }
                  }), sendingReply ? "Sending…" : "Send"]
                })]
              })]
            })]
          }), activeTab === "note" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
            children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("textarea", {
              rows: 3,
              value: noteText,
              onChange: e => setNoteText(e.target.value),
              placeholder: "Add an internal note visible only to agents\u2026",
              className: "w-full text-sm border border-amber-200 rounded-xl px-3 py-2 resize-none outline-none focus:ring-2 focus:ring-amber-200 bg-amber-50/60"
            }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
              className: "flex justify-end mt-2",
              children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("button", {
                onClick: addNote,
                disabled: !noteText.trim(),
                className: "px-4 py-1.5 bg-amber-500 text-white text-sm rounded-lg font-medium hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1",
                children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("i", {
                  className: "ti ti-note",
                  style: {
                    fontSize: 14
                  }
                }), "Add Note"]
              })
            })]
          })]
        })]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_RightPanel_jsx__WEBPACK_IMPORTED_MODULE_2__["default"], {
        agents: agents,
        selectedConv: selectedConv,
        setActiveTab: setActiveTab,
        setReplyText: setReplyText,
        updateAssignee: updateAssignee
      })]
    })]
  });
}

/***/ },

/***/ "./src/components/RightPanel.jsx"
/*!***************************************!*\
  !*** ./src/components/RightPanel.jsx ***!
  \***************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ RightPanel)
/* harmony export */ });
/* harmony import */ var _ChannelBadge_jsx__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./ChannelBadge.jsx */ "./src/components/ChannelBadge.jsx");
/* harmony import */ var _SLABadge_jsx__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./SLABadge.jsx */ "./src/components/SLABadge.jsx");
/* harmony import */ var _constants_config__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../constants/config */ "./src/constants/config.js");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react/jsx-runtime */ "react/jsx-runtime");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__);




function RightPanel({
  agents,
  selectedConv,
  setActiveTab,
  setReplyText,
  updateAssignee
}) {
  // Build agent options: "Unassigned" + all agents from API.
  const agentOptions = [{
    id: "",
    name: "Unassigned"
  }, ...(agents || []).map(a => ({
    id: String(a.id),
    name: a.name || a.login
  }))];
  const currentValue = selectedConv.assigneeId ? String(selectedConv.assigneeId) : "";
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
    className: "w-72 bg-white border-l border-gray-100 flex flex-col overflow-y-auto",
    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
      className: "px-4 py-4 border-b border-gray-100",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("div", {
        className: "text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2",
        children: "Assignee"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("select", {
        value: currentValue,
        onChange: e => updateAssignee(e.target.value || null),
        className: "w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white outline-none focus:ring-2 focus:ring-indigo-200",
        children: agentOptions.map(agent => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("option", {
          value: agent.id,
          children: agent.name
        }, agent.id))
      })]
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
      className: "px-4 py-4 border-b border-gray-100",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("div", {
        className: "text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2",
        children: "SLA Status"
      }), selectedConv.slaDeadline === 0 ? /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
        className: "flex items-center gap-2 text-sm text-green-600",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("i", {
          className: "ti ti-circle-check",
          style: {
            fontSize: 16
          }
        }), "Met \u2014 conversation resolved"]
      }) : /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
          className: "flex items-center justify-between mb-1.5",
          children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("span", {
            className: "text-sm text-gray-600",
            children: "First response due"
          }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_SLABadge_jsx__WEBPACK_IMPORTED_MODULE_1__["default"], {
            deadline: selectedConv.slaDeadline,
            unit: selectedConv.slaUnit
          })]
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("div", {
          className: "w-full bg-gray-100 rounded-full h-1.5",
          children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("div", {
            className: `h-1.5 rounded-full ${selectedConv.slaUnit === "min" && selectedConv.slaDeadline <= 10 ? "bg-red-500" : selectedConv.slaUnit === "min" && selectedConv.slaDeadline <= 30 ? "bg-amber-500" : "bg-green-500"}`,
            style: {
              width: `${Math.min(100, (selectedConv.slaUnit === "min" ? (60 - selectedConv.slaDeadline) / 60 : (8 - selectedConv.slaDeadline) / 8) * 100)}%`
            }
          })
        })]
      })]
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
      className: "px-4 py-4 border-b border-gray-100",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("div", {
        className: "text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3",
        children: "Details"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
        className: "space-y-2 text-sm",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
          className: "flex justify-between",
          children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("span", {
            className: "text-gray-500",
            children: "Channel"
          }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_ChannelBadge_jsx__WEBPACK_IMPORTED_MODULE_0__["default"], {
            channelId: selectedConv.channel,
            small: true
          })]
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
          className: "flex justify-between",
          children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("span", {
            className: "text-gray-500",
            children: "Status"
          }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("span", {
            className: `text-xs px-2 py-0.5 rounded-full font-medium ${_constants_config__WEBPACK_IMPORTED_MODULE_2__.statusConfig[selectedConv.status]?.cls || ""}`,
            children: _constants_config__WEBPACK_IMPORTED_MODULE_2__.statusConfig[selectedConv.status]?.label || selectedConv.status
          })]
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
          className: "flex justify-between",
          children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("span", {
            className: "text-gray-500",
            children: "Priority"
          }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("span", {
            className: `text-xs px-2 py-0.5 rounded-full font-medium ${_constants_config__WEBPACK_IMPORTED_MODULE_2__.priorityConfig[selectedConv.priority]?.bg || ""}`,
            children: _constants_config__WEBPACK_IMPORTED_MODULE_2__.priorityConfig[selectedConv.priority]?.label || selectedConv.priority
          })]
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
          className: "flex justify-between",
          children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("span", {
            className: "text-gray-500",
            children: "Messages"
          }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("span", {
            className: "font-medium text-gray-700",
            children: selectedConv.messages.length
          })]
        }), selectedConv.contactHandle && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
          className: "flex justify-between items-center gap-2",
          children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("span", {
            className: "text-gray-500 shrink-0",
            children: "Contact"
          }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("span", {
            className: "text-xs text-gray-700 truncate",
            children: selectedConv.contactHandle
          })]
        })]
      })]
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
      className: "px-4 py-4",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
        className: "text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("i", {
          className: "ti ti-note",
          style: {
            fontSize: 13
          }
        }), "Internal Notes", selectedConv.notes.length > 0 && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("span", {
          className: "ml-auto bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 rounded-full font-bold",
          children: selectedConv.notes.length
        })]
      }), selectedConv.notes.length === 0 && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("div", {
        className: "text-xs text-gray-400 italic",
        children: "No notes yet. Use the reply area to add one."
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("div", {
        className: "space-y-2",
        children: selectedConv.notes.map((note, index) => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
          className: "bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 text-xs text-amber-900 leading-relaxed",
          children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("i", {
            className: "ti ti-lock mr-1 text-amber-400",
            style: {
              fontSize: 11
            }
          }), note]
        }, index))
      })]
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
      className: "px-4 py-4 border-t border-gray-100",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
        className: "text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("i", {
          className: "ti ti-bookmark",
          style: {
            fontSize: 13
          }
        }), "Quick Replies"]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("div", {
        className: "space-y-1",
        children: _constants_config__WEBPACK_IMPORTED_MODULE_2__.SAVED_REPLIES.map(reply => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("button", {
          onClick: () => {
            setReplyText(reply.body);
            setActiveTab("reply");
          },
          className: "w-full text-left px-2.5 py-2 rounded-lg hover:bg-indigo-50 transition-colors group",
          children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("div", {
            className: "text-xs font-medium text-gray-700 group-hover:text-indigo-700",
            children: reply.title
          }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
            className: "text-xs text-gray-400 truncate",
            children: [reply.body.slice(0, 45), "\u2026"]
          })]
        }, reply.id))
      })]
    })]
  });
}

/***/ },

/***/ "./src/components/SLABadge.jsx"
/*!*************************************!*\
  !*** ./src/components/SLABadge.jsx ***!
  \*************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ SLABadge)
/* harmony export */ });
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react/jsx-runtime */ "react/jsx-runtime");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__);

function SLABadge({
  deadline,
  unit
}) {
  if (deadline === 0) return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", {
    className: "text-xs text-gray-400",
    children: "-"
  });
  const urgent = unit === "min" && deadline <= 10;
  const warning = unit === "min" && deadline <= 30;
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("span", {
    className: `text-xs font-medium px-2 py-0.5 rounded-full ${urgent ? "bg-red-100 text-red-700" : warning ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`,
    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("i", {
      className: "ti ti-clock mr-1",
      style: {
        fontSize: 11
      }
    }), deadline, unit]
  });
}

/***/ },

/***/ "./src/components/Sidebar.jsx"
/*!************************************!*\
  !*** ./src/components/Sidebar.jsx ***!
  \************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Sidebar)
/* harmony export */ });
/* harmony import */ var _constants_config__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../constants/config */ "./src/constants/config.js");
/* harmony import */ var _ThemeToggle_jsx__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./ThemeToggle.jsx */ "./src/components/ThemeToggle.jsx");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react/jsx-runtime */ "react/jsx-runtime");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__);



function Sidebar({
  activeChannel,
  setActiveChannel,
  conversations,
  theme,
  toggleTheme
}) {
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("aside", {
    className: "w-16 bg-white border-r border-gray-100 flex flex-col items-center py-4 gap-1 z-10 shadow-sm",
    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("div", {
      className: "mb-4",
      children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("div", {
        className: "w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("i", {
          className: "ti ti-topology-star-3 text-white",
          style: {
            fontSize: 16
          }
        })
      })
    }), _constants_config__WEBPACK_IMPORTED_MODULE_0__.CHANNELS.map(channel => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("button", {
      onClick: () => setActiveChannel(channel.id),
      title: channel.label,
      className: `relative w-10 h-10 rounded-xl flex items-center justify-center transition-all ${activeChannel === channel.id ? "bg-indigo-50 text-indigo-600" : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"}`,
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("i", {
        className: `ti ${channel.icon}`,
        style: {
          fontSize: 18,
          color: activeChannel === channel.id ? channel.color || "#4F46E5" : undefined
        }
      }), channel.id !== "all" && conversations.some(conversation => conversation.channel === channel.id && conversation.unread > 0) && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("span", {
        className: "absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"
      })]
    }, channel.id)), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("div", {
      className: "flex-1"
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(_ThemeToggle_jsx__WEBPACK_IMPORTED_MODULE_1__["default"], {
      theme: theme,
      onToggle: toggleTheme,
      compact: true
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("button", {
      onClick: () => setActiveChannel("settings"),
      title: "Settings",
      className: `w-10 h-10 rounded-xl flex items-center justify-center transition-all ${activeChannel === "settings" ? "bg-indigo-50 text-indigo-600" : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"}`,
      children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("i", {
        className: "ti ti-settings",
        style: {
          fontSize: 18
        }
      })
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("div", {
      className: "w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold",
      children: "AW"
    })]
  });
}

/***/ },

/***/ "./src/components/ThemeToggle.jsx"
/*!****************************************!*\
  !*** ./src/components/ThemeToggle.jsx ***!
  \****************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ ThemeToggle)
/* harmony export */ });
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react/jsx-runtime */ "react/jsx-runtime");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__);

function ThemeToggle({
  theme,
  onToggle,
  compact = false
}) {
  const isDark = theme === "dark";
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("button", {
    type: "button",
    onClick: onToggle,
    title: isDark ? "Switch to light mode" : "Switch to dark mode",
    "aria-label": isDark ? "Switch to light mode" : "Switch to dark mode",
    className: `theme-toggle inline-flex items-center rounded-full border transition-all ${compact ? "h-10 w-10 justify-center" : "gap-2 px-3 py-2 text-sm font-semibold"}`,
    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("i", {
      className: `ti ${isDark ? "ti-sun" : "ti-moon"}`,
      style: {
        fontSize: 18
      }
    }), !compact && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", {
      children: isDark ? "Light" : "Dark"
    })]
  });
}

/***/ },

/***/ "./src/components/settings/Line.jsx"
/*!******************************************!*\
  !*** ./src/components/settings/Line.jsx ***!
  \******************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ LineSettings)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _shared_jsx__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./shared.jsx */ "./src/components/settings/shared.jsx");
/* harmony import */ var _tokens_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./tokens.js */ "./src/components/settings/tokens.js");
/* harmony import */ var _api_client_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../api/client.js */ "./src/api/client.js");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react/jsx-runtime */ "react/jsx-runtime");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__);





function LineSettings({
  cfg,
  setCfg
}) {
  const [tab, setTab] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)("channel");
  const S = (key, value) => setCfg({
    ...cfg,
    [key]: value
  });
  const color = _tokens_js__WEBPACK_IMPORTED_MODULE_2__.TOKEN.line.color;
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
    className: "space-y-5",
    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "flex items-center justify-between",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "flex items-center gap-3",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
          className: `w-10 h-10 rounded-2xl bg-gradient-to-br ${_tokens_js__WEBPACK_IMPORTED_MODULE_2__.TOKEN.line.grad} flex items-center justify-center text-white font-black text-lg shadow-lg`,
          children: "L"
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
          children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("h2", {
            className: "text-lg font-bold text-white",
            children: "LINE Messaging API"
          }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("p", {
            className: "text-xs text-slate-400",
            children: "Connect a LINE Official Account to your unified inbox"
          })]
        })]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.StatusBadge, {
        connected: cfg.enabled
      })]
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.TabBar, {
      tabs: [{
        id: "channel",
        label: "Channel"
      }, {
        id: "webhook",
        label: "Webhook"
      }, {
        id: "profile",
        label: "Profile"
      }, {
        id: "messaging",
        label: "Messaging"
      }],
      active: tab,
      onChange: setTab,
      color: color
    }), tab === "channel" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "space-y-4",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.InfoBox, {
        type: "info",
        children: "Create a Messaging API channel in the LINE Developers Console, then copy the Channel ID, Channel Secret, and long-lived access token."
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Enable LINE",
        desc: "Activate or pause the LINE integration.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.enabled,
          onChange: value => S("enabled", value),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "grid grid-cols-2 gap-4 pt-1",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "Channel ID",
          value: cfg.channelId,
          onChange: value => S("channelId", value),
          placeholder: "2000000000",
          mono: true
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "Basic ID",
          value: cfg.basicId,
          onChange: value => S("basicId", value),
          placeholder: "@123abcde"
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
          className: "col-span-2",
          children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
            label: "Channel Secret",
            value: cfg.channelSecret,
            onChange: value => S("channelSecret", value),
            placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
            type: "password",
            mono: true
          })
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
          className: "col-span-2",
          children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
            label: "Channel Access Token",
            value: cfg.accessToken,
            onChange: value => S("accessToken", value),
            placeholder: "Long-lived channel access token",
            type: "password",
            helper: "Keep this token on your server only."
          })
        })]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("button", {
        style: {
          background: color
        },
        className: "px-5 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity",
        children: "Verify LINE channel"
      })]
    }), tab === "webhook" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "space-y-4",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.InfoBox, {
        type: "tip",
        children: "Enable webhooks in the LINE Developers Console and set this endpoint as the Webhook URL."
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
        label: "Webhook URL",
        value: (0,_api_client_js__WEBPACK_IMPORTED_MODULE_3__.webhookUrl)("line"),
        readOnly: true,
        mono: true
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "Webhook Verification"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.CodeSnippet, {
        lang: "http",
        code: `POST ${(0,_api_client_js__WEBPACK_IMPORTED_MODULE_3__.webhookUrl)("line")}\nHeader: x-line-signature\nBody: LINE event payload`
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "Sample Message Event"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.CodeSnippet, {
        lang: "json",
        code: `{\n  "events": [{\n    "type": "message",\n    "replyToken": "reply-token",\n    "source": { "type": "user", "userId": "Uxxxxxxxx" },\n    "message": { "type": "text", "text": "Hello, I need help" }\n  }]\n}`
      })]
    }), tab === "profile" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "space-y-4",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "grid grid-cols-2 gap-4",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "Official account name",
          value: cfg.accountName,
          onChange: value => S("accountName", value),
          placeholder: "Acme Support"
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Select, {
          label: "Default language",
          value: cfg.language,
          onChange: value => S("language", value),
          options: [{
            value: "en",
            label: "English"
          }, {
            value: "ja",
            label: "Japanese"
          }, {
            value: "th",
            label: "Thai"
          }, {
            value: "id",
            label: "Indonesian"
          }]
        })]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Fetch user profiles",
        desc: "Load LINE display names and avatars for inbound conversations.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.fetchProfile,
          onChange: value => S("fetchProfile", value),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Create contacts automatically",
        desc: "Create a customer record when an unknown LINE user messages you.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.createContacts,
          onChange: value => S("createContacts", value),
          color: color
        })
      })]
    }), tab === "messaging" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "space-y-4",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Auto-assign conversations",
        desc: "Distribute new LINE threads to available agents.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.autoAssign,
          onChange: value => S("autoAssign", value),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Allow rich messages",
        desc: "Enable image maps, buttons, carousel messages, and quick replies.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.richMessages,
          onChange: value => S("richMessages", value),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Auto-reply on first message",
        desc: "Send an immediate acknowledgement to new LINE contacts.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.autoReply,
          onChange: value => S("autoReply", value),
          color: color
        })
      }), cfg.autoReply && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Textarea, {
        label: "Auto-reply message",
        value: cfg.autoReplyMsg,
        onChange: value => S("autoReplyMsg", value),
        rows: 3,
        placeholder: "Thanks for messaging us. Our team will reply shortly."
      })]
    })]
  });
}

/***/ },

/***/ "./src/components/settings/Settings.jsx"
/*!**********************************************!*\
  !*** ./src/components/settings/Settings.jsx ***!
  \**********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ IntegrationSettings)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _email_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./email.js */ "./src/components/settings/email.js");
/* harmony import */ var _instagram_jsx__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./instagram.jsx */ "./src/components/settings/instagram.jsx");
/* harmony import */ var _Line_jsx__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./Line.jsx */ "./src/components/settings/Line.jsx");
/* harmony import */ var _messanger_jsx__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./messanger.jsx */ "./src/components/settings/messanger.jsx");
/* harmony import */ var _sms_jsx__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./sms.jsx */ "./src/components/settings/sms.jsx");
/* harmony import */ var _telegram_jsx__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./telegram.jsx */ "./src/components/settings/telegram.jsx");
/* harmony import */ var _Viber_jsx__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./Viber.jsx */ "./src/components/settings/Viber.jsx");
/* harmony import */ var _WeChat_jsx__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./WeChat.jsx */ "./src/components/settings/WeChat.jsx");
/* harmony import */ var _whatsapp_jsx__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./whatsapp.jsx */ "./src/components/settings/whatsapp.jsx");
/* harmony import */ var _shared_jsx__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./shared.jsx */ "./src/components/settings/shared.jsx");
/* harmony import */ var _Team_jsx__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./Team.jsx */ "./src/components/settings/Team.jsx");
/* harmony import */ var _tokens_js__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./tokens.js */ "./src/components/settings/tokens.js");
/* harmony import */ var _ThemeToggle_jsx__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ../ThemeToggle.jsx */ "./src/components/ThemeToggle.jsx");
/* harmony import */ var _api_client_js__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ../../api/client.js */ "./src/api/client.js");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! react/jsx-runtime */ "react/jsx-runtime");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__);
















const CHANNEL_DEFAULTS = {
  messenger: {
    enabled: false,
    pageId: "",
    pageName: "Acme Support",
    pageToken: "",
    appId: "",
    appSecret: "",
    verifyToken: "",
    chatPlugin: true,
    greetLoggedIn: "Hi {{user_first_name}}! How can we help?",
    greetLoggedOut: "Hi! How can we help today?",
    themeColor: "#0866FF",
    loggedOutMode: "window",
    allowedDomain: "",
    autoReply: true,
    autoReplyMsg: "Hi {{user_first_name}}! Thanks for messaging us. An agent will reply shortly.",
    awayMsg: true,
    awayMsgText: "We're offline right now but will respond first thing tomorrow.",
    iceBreakers: true,
    iceList: ["What are your business hours?", "Track my order", "Speak to a human"],
    persistentMenu: true,
    fetchProfile: true,
    readReceipts: true,
    typingIndicator: true,
    reactions: true,
    quickReplies: true,
    imageAttach: true,
    fileAttach: true,
    autoAssign: true,
    csat: false,
    handover: false,
    secondaryAppId: ""
  },
  email: {
    enabled: false,
    inboxName: "Customer Support",
    inboxEmail: "",
    senderName: "",
    replyTo: "",
    smtpPreset: "gmail",
    smtpHost: "smtp.gmail.com",
    smtpPort: "587",
    smtpUser: "",
    smtpPass: "",
    smtpTls: true,
    smtpVerifySsl: true,
    imapHost: "imap.gmail.com",
    imapPort: "993",
    imapUser: "",
    imapPass: "",
    imapFolder: "INBOX",
    imapPoll: "2",
    imapDelete: false,
    autoReply: true,
    autoReplySubject: "We received your message — Ref #{{ticket_id}}",
    autoReplyBody: "",
    signature: true,
    signatureBody: "Best regards,\nThe Support Team",
    outOfOffice: false,
    oooBody: ""
  },
  whatsapp: {
    enabled: false,
    wabaid: "",
    phoneNumberId: "",
    accessToken: "",
    verifyToken: "",
    displayPhone: "",
    ctaMessage: "Hello! I'd like to chat with support.",
    btnStyle: "floating",
    btnLabel: "Chat on WhatsApp",
    readReceipts: true,
    media: true,
    autoAssign: true,
    bizHours: false,
    autoReply: false,
    autoReplyMsg: "",
    template: "none",
    optOut: true,
    optIn: true,
    businessId: "",
    qualityTier: "MEDIUM"
  },
  telegram: {
    enabled: false,
    botToken: "",
    botUsername: "",
    botName: "",
    startMessage: "Hello, I need support!",
    widgetStyle: "floating",
    btnLabel: "Chat on Telegram",
    widgetPos: "bottom-right",
    allowGroups: false,
    typingIndicator: true,
    markdown: true,
    startReply: true,
    startMsg: "Hi there! Welcome to support.\n\nHow can we help you today?",
    inlineKeyboard: true,
    fileUpload: true,
    autoAssign: true,
    commands: "start - Start a new conversation\nhelp - Get help and FAQs\nstatus - Check your ticket status",
    rateGlobal: "30",
    ratePerChat: "1",
    deleteClosed: false,
    anonymise: false
  },
  sms: {
    enabled: false,
    provider: "twilio",
    accountSid: "",
    authToken: "",
    vonageKey: "",
    vonageSecret: "",
    genericKey: "",
    genericSecret: "",
    fromNumber: "",
    numberType: "local",
    perAgentNumber: false,
    mms: true,
    charWarn: true,
    autoSplit: true,
    unicode: false,
    delivery: true,
    retry: false,
    autoReply: true,
    autoReplyMsg: "Thanks for texting support. We received your message and will reply shortly. Reply STOP to opt out.",
    optOut: true,
    optIn: true,
    helpKeyword: false,
    helpMsg: "For support, call 1-800-000-0000 or email support@acme.com. Reply STOP to unsubscribe.",
    quietHours: false,
    quietFrom: "21:00",
    quietUntil: "09:00",
    brandId: "",
    campaignId: "",
    autoAssign: true,
    bizHours: false,
    sessionReset: false
  },
  line: {
    enabled: false,
    channelId: "",
    basicId: "",
    channelSecret: "",
    accessToken: "",
    accountName: "",
    language: "en",
    fetchProfile: true,
    createContacts: true,
    autoAssign: true,
    richMessages: true,
    autoReply: true,
    autoReplyMsg: "Thanks for messaging us. Our team will reply shortly."
  },
  viber: {
    enabled: false,
    botName: "",
    senderId: "",
    authToken: "",
    avatarUrl: "",
    region: "global",
    fetchProfile: true,
    smsFallback: false,
    deliveryReceipts: true,
    media: true,
    autoAssign: true,
    autoReplyMsg: "Thanks for contacting support. We will reply shortly."
  },
  wechat: {
    enabled: false,
    appId: "",
    appSecret: "",
    accountType: "service",
    serverToken: "",
    encodingAesKey: "",
    fetchProfile: true,
    autoAssign: true,
    media: true,
    menuJson: '{"button":[{"type":"click","name":"Support","key":"SUPPORT"}]}',
    autoReplyMsg: "Thanks for contacting us on WeChat. We will reply shortly."
  },
  instagram: {
    enabled: false,
    igAccountId: "",
    pageId: "",
    pageToken: "",
    appId: "",
    appSecret: "",
    verifyToken: "",
    fetchProfile: true,
    typingIndicator: true,
    readReceipts: true,
    imageAttach: true,
    storyReplies: true,
    autoAssign: true,
    csat: false,
    autoReply: true,
    autoReplyMsg: "Hi! Thanks for reaching out on Instagram 👋 An agent will reply shortly.",
    awayMsg: false,
    awayMsgText: "We're offline right now but will respond as soon as possible.",
    iceBreakers: false,
    iceList: ["What are your hours?", "Track my order", "Speak to a human"]
  }
};
const CHANNEL_ORDER = Object.keys(CHANNEL_DEFAULTS);

// Strip masked secret placeholders ("••••••••") so they're not posted back to
// the server and overwrite the real stored secret.
function stripMaskedSecrets(values) {
  const out = {
    ...values
  };
  for (const key of Object.keys(out)) {
    if (typeof out[key] === "string" && /^•+$/.test(out[key])) {
      delete out[key];
    }
    if (key.endsWith("_set")) delete out[key];
  }
  return out;
}
function IntegrationSettings({
  theme = "dark",
  toggleTheme
}) {
  const [active, setActive] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)("messenger");
  const [configs, setConfigs] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(() => Object.fromEntries(CHANNEL_ORDER.map(id => [id, {
    ...CHANNEL_DEFAULTS[id]
  }])));
  const [loading, setLoading] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(true);
  const [saving, setSaving] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
  const [saved, setSaved] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
  const [dirty, setDirty] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
  const [error, setError] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(null);
  (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    let cancelled = false;
    setLoading(true);
    _api_client_js__WEBPACK_IMPORTED_MODULE_14__["default"].getSettings().then(remote => {
      if (cancelled) return;
      setConfigs(previous => {
        const next = {
          ...previous
        };
        for (const id of CHANNEL_ORDER) {
          next[id] = {
            ...CHANNEL_DEFAULTS[id],
            ...(remote?.[id] || {})
          };
        }
        return next;
      });
    }).catch(err => {
      if (!cancelled) setError(err.message || "Could not load settings");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const setChannel = id => updater => {
    setConfigs(previous => {
      const current = previous[id];
      const next = typeof updater === "function" ? updater(current) : updater;
      return {
        ...previous,
        [id]: {
          ...current,
          ...next
        }
      };
    });
    setDirty(true);
  };
  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const payload = Object.fromEntries(CHANNEL_ORDER.map(id => [id, stripMaskedSecrets(configs[id])]));
      const remote = await _api_client_js__WEBPACK_IMPORTED_MODULE_14__["default"].saveSettings(payload);
      setConfigs(previous => {
        const next = {
          ...previous
        };
        for (const id of CHANNEL_ORDER) {
          next[id] = {
            ...CHANNEL_DEFAULTS[id],
            ...(remote?.[id] || {})
          };
        }
        return next;
      });
      setSaved(true);
      setDirty(false);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.message || "Could not save settings");
    } finally {
      setSaving(false);
    }
  };
  const channels = (0,react__WEBPACK_IMPORTED_MODULE_0__.useMemo)(() => [...CHANNEL_ORDER, "team"], []);
  const canManageSettings = _api_client_js__WEBPACK_IMPORTED_MODULE_14__.caps?.canManageSettings || _api_client_js__WEBPACK_IMPORTED_MODULE_14__.caps?.isAdmin;
  const showSaveButton = active !== "team" && canManageSettings;
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)("div", {
    className: "settings-page h-full text-slate-100 flex flex-col",
    style: {
      background: theme === "dark" ? "linear-gradient(135deg, #0a0e1a 0%, #0e1525 50%, #0a1020 100%)" : "linear-gradient(135deg, #f8fafc 0%, #eef2ff 52%, #f8fafc 100%)",
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif"
    },
    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)("header", {
      className: "sticky top-0 z-30 flex items-center justify-between px-6 py-3 border-b border-slate-800/80 backdrop-blur-md",
      style: {
        background: theme === "dark" ? "rgba(10,14,26,0.85)" : "rgba(255,255,255,0.86)"
      },
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)("div", {
        className: "flex items-center gap-3",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("div", {
          className: "w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-black text-white",
          children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("i", {
            className: "ti ti-settings"
          })
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("span", {
          className: "text-sm font-bold text-white tracking-tight",
          children: "Integration Settings"
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)("span", {
          className: "text-xs text-slate-600 hidden sm:block",
          children: ["/ ", active === "team" ? "Team & Departments" : "Channel Connections"]
        })]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)("div", {
        className: "flex items-center gap-3",
        children: [loading && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("span", {
          className: "text-xs text-slate-400",
          children: "Loading\u2026"
        }), error && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("span", {
          className: "text-xs text-red-400 font-medium",
          children: error
        }), dirty && !saved && !saving && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("span", {
          className: "text-xs text-amber-400 font-medium animate-pulse",
          children: "Unsaved changes"
        }), saving && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("span", {
          className: "text-xs text-slate-300",
          children: "Saving\u2026"
        }), toggleTheme && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_ThemeToggle_jsx__WEBPACK_IMPORTED_MODULE_13__["default"], {
          theme: theme,
          onToggle: toggleTheme
        }), showSaveButton && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("button", {
          disabled: saving || loading || !dirty,
          onClick: handleSave,
          style: {
            background: saved ? "#10B981" : "linear-gradient(135deg,#6366f1,#8b5cf6)"
          },
          className: "px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed",
          children: saved ? "✓ Saved" : saving ? "Saving…" : "Save changes"
        })]
      })]
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)("div", {
      className: "flex flex-1 overflow-hidden",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)("aside", {
        className: "w-60 shrink-0 border-r border-slate-800/60 flex flex-col py-4 px-3 gap-1 overflow-y-auto",
        style: {
          background: theme === "dark" ? "rgba(8,12,22,0.6)" : "rgba(255,255,255,0.62)"
        },
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("p", {
          className: "px-3 text-xs font-bold uppercase tracking-widest text-slate-600 mb-2",
          children: "Channels"
        }), CHANNEL_ORDER.map(id => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_10__.ChannelCard, {
          id: id,
          active: active === id,
          connected: !!configs[id]?.enabled,
          onClick: () => setActive(id)
        }, id)), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("p", {
          className: "px-3 mt-6 text-xs font-bold uppercase tracking-widest text-slate-600 mb-2",
          children: "Team"
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)("button", {
          onClick: () => setActive("team"),
          className: `w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-150 ${active === "team" ? "bg-slate-800 shadow-md border border-slate-700/60" : "hover:bg-slate-800/50 border border-transparent"}`,
          children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("div", {
            className: "w-9 h-9 rounded-xl flex items-center justify-center text-white bg-gradient-to-br from-indigo-500 to-purple-600 shrink-0",
            children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("i", {
              className: "ti ti-users"
            })
          }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)("div", {
            className: "flex-1 text-left min-w-0",
            children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("p", {
              className: `text-sm font-semibold truncate ${active === "team" ? "text-gray-500" : "text-slate-300"}`,
              children: "Agents & Departments"
            }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("p", {
              className: "text-xs text-slate-500",
              children: "Manage assignments"
            })]
          })]
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("div", {
          className: "flex-1"
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)("div", {
          className: "px-3 pt-4 border-t border-slate-800/60 mt-2 space-y-1",
          children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("p", {
            className: "text-xs font-bold uppercase tracking-widest text-slate-600 mb-2",
            children: "Status"
          }), CHANNEL_ORDER.map(id => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)("div", {
            className: "flex items-center justify-between py-1",
            children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("span", {
              className: "text-xs text-slate-400",
              children: _tokens_js__WEBPACK_IMPORTED_MODULE_12__.TOKEN[id].label
            }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("span", {
              className: `text-xs font-semibold ${configs[id]?.enabled ? "text-green-400" : "text-slate-600"}`,
              children: configs[id]?.enabled ? "●" : "○"
            })]
          }, id))]
        })]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("main", {
        className: "flex-1 overflow-y-auto",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("div", {
          className: "max-w-3xl mx-auto px-6 py-8 pb-24",
          children: active === "team" ? /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_Team_jsx__WEBPACK_IMPORTED_MODULE_11__["default"], {}) : /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.Fragment, {
            children: [active === "messenger" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_messanger_jsx__WEBPACK_IMPORTED_MODULE_4__["default"], {
              cfg: configs.messenger,
              setCfg: setChannel("messenger")
            }), active === "email" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_email_js__WEBPACK_IMPORTED_MODULE_1__["default"], {
              cfg: configs.email,
              setCfg: setChannel("email")
            }), active === "whatsapp" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_whatsapp_jsx__WEBPACK_IMPORTED_MODULE_9__["default"], {
              cfg: configs.whatsapp,
              setCfg: setChannel("whatsapp")
            }), active === "telegram" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_telegram_jsx__WEBPACK_IMPORTED_MODULE_6__["default"], {
              cfg: configs.telegram,
              setCfg: setChannel("telegram")
            }), active === "sms" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_sms_jsx__WEBPACK_IMPORTED_MODULE_5__["default"], {
              cfg: configs.sms,
              setCfg: setChannel("sms")
            }), active === "line" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_Line_jsx__WEBPACK_IMPORTED_MODULE_3__["default"], {
              cfg: configs.line,
              setCfg: setChannel("line")
            }), active === "viber" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_Viber_jsx__WEBPACK_IMPORTED_MODULE_7__["default"], {
              cfg: configs.viber,
              setCfg: setChannel("viber")
            }), active === "wechat" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_WeChat_jsx__WEBPACK_IMPORTED_MODULE_8__["default"], {
              cfg: configs.wechat,
              setCfg: setChannel("wechat")
            }), active === "instagram" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_instagram_jsx__WEBPACK_IMPORTED_MODULE_2__["default"], {
              cfg: configs.instagram,
              setCfg: setChannel("instagram")
            })]
          })
        })
      })]
    })]
  });
}

/***/ },

/***/ "./src/components/settings/Setttings.js"
/*!**********************************************!*\
  !*** ./src/components/settings/Setttings.js ***!
  \**********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* reexport safe */ _Settings_jsx__WEBPACK_IMPORTED_MODULE_0__["default"])
/* harmony export */ });
/* harmony import */ var _Settings_jsx__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./Settings.jsx */ "./src/components/settings/Settings.jsx");


/***/ },

/***/ "./src/components/settings/Team.jsx"
/*!******************************************!*\
  !*** ./src/components/settings/Team.jsx ***!
  \******************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ TeamSettings)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _api_client_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../api/client.js */ "./src/api/client.js");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react/jsx-runtime */ "react/jsx-runtime");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__);



function Pill({
  active,
  color = "#6366f1",
  onClick,
  children
}) {
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("button", {
    type: "button",
    onClick: onClick,
    style: active ? {
      background: color + "22",
      borderColor: color + "66",
      color
    } : {},
    className: "text-xs font-semibold px-2.5 py-1 rounded-full border border-slate-700 text-slate-600 hover:border-slate-500 transition-all",
    children: children
  });
}
function TeamSettings() {
  const [departments, setDepartments] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)([]);
  const [agents, setAgents] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)([]);
  const [loading, setLoading] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(true);
  const [error, setError] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(null);
  const [creating, setCreating] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
  const [newDeptName, setNewDeptName] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)("");
  const [newDeptDesc, setNewDeptDesc] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)("");
  const [pendingAssign, setPendingAssign] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)({});
  const canManageDepts = _api_client_js__WEBPACK_IMPORTED_MODULE_1__.caps?.canManageDepts || _api_client_js__WEBPACK_IMPORTED_MODULE_1__.caps?.isAdmin;
  const refresh = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async () => {
    setLoading(true);
    setError(null);
    try {
      const [depts, ag] = await Promise.all([_api_client_js__WEBPACK_IMPORTED_MODULE_1__["default"].listDepartments(), _api_client_js__WEBPACK_IMPORTED_MODULE_1__["default"].listAgents()]);
      setDepartments(Array.isArray(depts) ? depts : []);
      setAgents(Array.isArray(ag) ? ag : []);
    } catch (err) {
      setError(err.message || "Could not load team data");
    } finally {
      setLoading(false);
    }
  }, []);
  (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    refresh();
  }, [refresh]);
  const deptIndex = (0,react__WEBPACK_IMPORTED_MODULE_0__.useMemo)(() => {
    const map = new Map();
    for (const dept of departments) map.set(dept.id, dept);
    return map;
  }, [departments]);
  const handleCreate = async () => {
    if (!newDeptName.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      const created = await _api_client_js__WEBPACK_IMPORTED_MODULE_1__["default"].createDepartment({
        name: newDeptName.trim(),
        description: newDeptDesc.trim()
      });
      setDepartments(previous => [...previous, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewDeptName("");
      setNewDeptDesc("");
    } catch (err) {
      setError(err.message || "Could not create department");
    } finally {
      setCreating(false);
    }
  };
  const handleDelete = async id => {
    if (!window.confirm("Delete this department? Agent assignments to it will be removed.")) return;
    setError(null);
    try {
      await _api_client_js__WEBPACK_IMPORTED_MODULE_1__["default"].deleteDepartment(id);
      setDepartments(previous => previous.filter(dept => dept.id !== id));
      setAgents(previous => previous.map(agent => ({
        ...agent,
        departmentIds: agent.departmentIds.filter(deptId => deptId !== id)
      })));
    } catch (err) {
      setError(err.message || "Could not delete department");
    }
  };
  const toggleAgentDept = (agentId, deptId) => {
    setAgents(previous => previous.map(agent => {
      if (agent.id !== agentId) return agent;
      const has = agent.departmentIds.includes(deptId);
      const nextIds = has ? agent.departmentIds.filter(id => id !== deptId) : [...agent.departmentIds, deptId];
      return {
        ...agent,
        departmentIds: nextIds
      };
    }));
  };
  const saveAgent = async agent => {
    setPendingAssign(previous => ({
      ...previous,
      [agent.id]: true
    }));
    setError(null);
    try {
      await _api_client_js__WEBPACK_IMPORTED_MODULE_1__["default"].assignAgentDepts(agent.id, agent.departmentIds);
    } catch (err) {
      setError(err.message || "Could not save assignment");
    } finally {
      setPendingAssign(previous => {
        const next = {
          ...previous
        };
        delete next[agent.id];
        return next;
      });
    }
  };
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("div", {
    className: "space-y-10",
    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("section", {
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("div", {
        className: "flex items-center justify-between mb-4",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("div", {
          children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("h2", {
            className: "text-lg font-bold text-white",
            children: "Departments"
          }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("p", {
            className: "text-xs text-slate-500 mt-1",
            children: "Organize agents into teams that conversations can be routed to."
          })]
        })
      }), error && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("div", {
        className: "mb-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-xs px-4 py-3",
        children: error
      }), canManageDepts && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("div", {
        className: "rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 space-y-3 mb-6",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("p", {
          className: "text-xs font-semibold uppercase tracking-widest text-slate-500",
          children: "Add department"
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("div", {
          className: "flex flex-col md:flex-row gap-2",
          children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("input", {
            value: newDeptName,
            onChange: event => setNewDeptName(event.target.value),
            placeholder: "Department name (e.g. VIP Support)",
            className: "flex-1 rounded-xl border border-slate-700 bg-slate-800/70 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-indigo-500"
          }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("input", {
            value: newDeptDesc,
            onChange: event => setNewDeptDesc(event.target.value),
            placeholder: "Optional description",
            className: "flex-1 rounded-xl border border-slate-700 bg-slate-800/70 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-indigo-500"
          }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("button", {
            onClick: handleCreate,
            disabled: !newDeptName.trim() || creating,
            className: "px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-br from-indigo-500 to-purple-600 hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed",
            children: creating ? "Adding…" : "Add"
          })]
        })]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("div", {
        className: "rounded-2xl border border-slate-800/80 bg-slate-900/60 overflow-hidden",
        children: [loading && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("p", {
          className: "text-xs text-slate-400 px-4 py-3",
          children: "Loading departments\u2026"
        }), !loading && departments.length === 0 && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("p", {
          className: "text-xs text-slate-500 px-4 py-3",
          children: "No departments yet. Add one above."
        }), !loading && departments.length > 0 && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("div", {
          className: "overflow-x-auto",
          children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("table", {
            className: "w-full min-w-[640px]",
            children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("thead", {
              className: "bg-slate-900/60 border-b border-slate-800/80",
              children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("tr", {
                children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("th", {
                  className: "text-left text-[11px] font-semibold uppercase tracking-widest text-slate-500 px-4 py-3",
                  children: "Department"
                }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("th", {
                  className: "text-left text-[11px] font-semibold uppercase tracking-widest text-slate-500 px-4 py-3",
                  children: "Description"
                }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("th", {
                  className: "text-left text-[11px] font-semibold uppercase tracking-widest text-slate-500 px-4 py-3",
                  children: "Assigned Agents"
                }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("th", {
                  className: "text-right text-[11px] font-semibold uppercase tracking-widest text-slate-500 px-4 py-3",
                  children: "Action"
                })]
              })
            }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("tbody", {
              className: "divide-y divide-slate-800/70",
              children: departments.map(dept => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("tr", {
                children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("td", {
                  className: "px-4 py-3 text-sm font-semibold text-slate-100",
                  children: dept.name
                }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("td", {
                  className: "px-4 py-3 text-xs text-slate-500",
                  children: dept.description || "No description"
                }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("td", {
                  className: "px-4 py-3 text-xs text-slate-400",
                  children: [agents.filter(agent => agent.departmentIds.includes(dept.id)).length, " agent(s)"]
                }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("td", {
                  className: "px-4 py-3 text-right",
                  children: canManageDepts && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("button", {
                    onClick: () => handleDelete(dept.id),
                    title: "Delete department",
                    className: "text-slate-500 hover:text-red-400 text-xs",
                    children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("i", {
                      className: "ti ti-trash"
                    })
                  })
                })]
              }, dept.id))
            })]
          })
        })]
      })]
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("section", {
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("div", {
        className: "flex items-center justify-between mb-4",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("div", {
          children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("h2", {
            className: "text-lg font-bold text-white",
            children: "Agents"
          }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("p", {
            className: "text-xs text-slate-500 mt-1",
            children: ["Users with the ", /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("code", {
              className: "text-indigo-300 bg-slate-800/70 px-1 py-0.5 rounded",
              children: "Messaging Agent"
            }), " role can only access the messaging area. Assign them to one or more departments."]
          })]
        })
      }), loading && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("p", {
        className: "text-xs text-slate-400",
        children: "Loading agents\u2026"
      }), !loading && agents.length === 0 && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("p", {
        className: "text-xs text-slate-500",
        children: ["No messaging agents yet. Create a new WordPress user and assign the ", /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("strong", {
          children: "Messaging Agent"
        }), " role."]
      }), agents.length > 0 && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("div", {
        className: "rounded-2xl border border-slate-800/80 bg-slate-900/60 overflow-hidden",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("div", {
          className: "overflow-x-auto",
          children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("table", {
            className: "w-full min-w-[760px]",
            children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("thead", {
              className: "bg-slate-900/60 border-b border-slate-800/80",
              children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("tr", {
                children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("th", {
                  className: "text-left text-[11px] font-semibold uppercase tracking-widest text-slate-500 px-4 py-3",
                  children: "Agent"
                }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("th", {
                  className: "text-left text-[11px] font-semibold uppercase tracking-widest text-slate-500 px-4 py-3",
                  children: "Email"
                }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("th", {
                  className: "text-left text-[11px] font-semibold uppercase tracking-widest text-slate-500 px-4 py-3",
                  children: "Departments"
                }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("th", {
                  className: "text-right text-[11px] font-semibold uppercase tracking-widest text-slate-500 px-4 py-3",
                  children: "Action"
                })]
              })
            }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("tbody", {
              className: "divide-y divide-slate-800/70",
              children: agents.map(agent => {
                const isPending = !!pendingAssign[agent.id];
                return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("tr", {
                  className: "align-top",
                  children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("td", {
                    className: "px-4 py-3",
                    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("p", {
                      className: "text-sm font-semibold text-slate-100",
                      children: [agent.name, !agent.isAgent && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("span", {
                        className: "ml-2 text-[10px] uppercase tracking-widest text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full",
                        children: agent.roles.join(", ")
                      })]
                    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("p", {
                      className: "mt-1 text-[10px] uppercase tracking-widest text-slate-600",
                      children: agent.departmentIds.length > 0 ? `Member of: ${agent.departmentIds.map(id => deptIndex.get(id)?.name).filter(Boolean).join(", ")}` : "No department assigned"
                    })]
                  }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("td", {
                    className: "px-4 py-3 text-xs text-slate-400",
                    children: agent.email
                  }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("td", {
                    className: "px-4 py-3",
                    children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("div", {
                      className: "flex flex-wrap gap-2",
                      children: [departments.length === 0 && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("p", {
                        className: "text-xs text-slate-500",
                        children: "No departments to assign yet."
                      }), departments.map(dept => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(Pill, {
                        active: agent.departmentIds.includes(dept.id),
                        onClick: canManageDepts ? () => toggleAgentDept(agent.id, dept.id) : undefined,
                        children: dept.name
                      }, dept.id))]
                    })
                  }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("td", {
                    className: "px-4 py-3 text-right",
                    children: canManageDepts && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("button", {
                      onClick: () => saveAgent(agent),
                      disabled: isPending,
                      className: "text-xs px-3 py-1.5 rounded-lg bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed",
                      children: isPending ? "Saving…" : "Save"
                    })
                  })]
                }, agent.id);
              })
            })]
          })
        })
      })]
    })]
  });
}

/***/ },

/***/ "./src/components/settings/Viber.jsx"
/*!*******************************************!*\
  !*** ./src/components/settings/Viber.jsx ***!
  \*******************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ ViberSettings)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _shared_jsx__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./shared.jsx */ "./src/components/settings/shared.jsx");
/* harmony import */ var _api_client_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../api/client.js */ "./src/api/client.js");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react/jsx-runtime */ "react/jsx-runtime");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__);




function ViberSettings({
  cfg,
  setCfg
}) {
  const [tab, setTab] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)("bot");
  const S = (key, value) => setCfg({
    ...cfg,
    [key]: value
  });
  const color = _shared_jsx__WEBPACK_IMPORTED_MODULE_1__.TOKEN.viber.color;
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
    className: "space-y-5",
    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
      className: "flex items-center justify-between",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
        className: "flex items-center gap-3",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("div", {
          className: `w-10 h-10 rounded-2xl bg-gradient-to-br ${_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.TOKEN.viber.grad} flex items-center justify-center text-white font-black text-lg shadow-lg`,
          children: "V"
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
          children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("h2", {
            className: "text-lg font-bold text-white",
            children: "Viber Bot"
          }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("p", {
            className: "text-xs text-slate-400",
            children: "Connect Viber Business Messages or a bot account"
          })]
        })]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.StatusBadge, {
        connected: cfg.enabled
      })]
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.TabBar, {
      tabs: [{
        id: "bot",
        label: "Bot Setup"
      }, {
        id: "webhook",
        label: "Webhook"
      }, {
        id: "sender",
        label: "Sender"
      }, {
        id: "messaging",
        label: "Messaging"
      }],
      active: tab,
      onChange: setTab,
      color: color
    }), tab === "bot" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
      className: "space-y-4",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.InfoBox, {
        type: "info",
        children: "Create a Viber bot or Business Messages sender, then paste the authentication token and sender details here."
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Enable Viber",
        desc: "Activate or pause the Viber integration.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.enabled,
          onChange: value => S("enabled", value),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
        className: "grid grid-cols-2 gap-4 pt-1",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "Bot name",
          value: cfg.botName,
          onChange: value => S("botName", value),
          placeholder: "Acme Support"
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "Sender ID",
          value: cfg.senderId,
          onChange: value => S("senderId", value),
          placeholder: "acme_support",
          mono: true
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("div", {
          className: "col-span-2",
          children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
            label: "Authentication Token",
            value: cfg.authToken,
            onChange: value => S("authToken", value),
            placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
            type: "password",
            helper: "Keep this token private and use it from your backend."
          })
        })]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("button", {
        style: {
          background: color
        },
        className: "px-5 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity",
        children: "Test Viber token"
      })]
    }), tab === "webhook" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
      className: "space-y-4",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.InfoBox, {
        type: "tip",
        children: "Register this webhook endpoint with Viber so inbound messages and delivery statuses reach your inbox."
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
        label: "Webhook URL",
        value: (0,_api_client_js__WEBPACK_IMPORTED_MODULE_2__.webhookUrl)("viber"),
        readOnly: true,
        mono: true
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "Register Webhook"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.CodeSnippet, {
        lang: "bash",
        code: `curl -X POST https://chatapi.viber.com/pa/set_webhook \\\n  -H "X-Viber-Auth-Token: ${cfg.authToken || "<AUTH_TOKEN>"}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"url":"${(0,_api_client_js__WEBPACK_IMPORTED_MODULE_2__.webhookUrl)("viber")}","event_types":["message","delivered","seen","failed"]}'`
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "Sample Inbound Payload"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.CodeSnippet, {
        lang: "json",
        code: `{\n  "event": "message",\n  "sender": { "id": "viber-user-id", "name": "Customer" },\n  "message": { "type": "text", "text": "Hello, I need support" }\n}`
      })]
    }), tab === "sender" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
      className: "space-y-4",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
        className: "grid grid-cols-2 gap-4",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "Avatar URL",
          value: cfg.avatarUrl,
          onChange: value => S("avatarUrl", value),
          placeholder: "https://cdn.yourdomain.com/viber-avatar.png"
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Select, {
          label: "Default region",
          value: cfg.region,
          onChange: value => S("region", value),
          options: [{
            value: "global",
            label: "Global"
          }, {
            value: "eu",
            label: "Europe"
          }, {
            value: "mena",
            label: "Middle East and Africa"
          }, {
            value: "apac",
            label: "Asia Pacific"
          }]
        })]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Fetch subscriber profile",
        desc: "Store display name and avatar on first inbound message.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.fetchProfile,
          onChange: value => S("fetchProfile", value),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Use sender fallback",
        desc: "Fall back to SMS if a Viber delivery fails and a phone number is available.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.smsFallback,
          onChange: value => S("smsFallback", value),
          color: color
        })
      })]
    }), tab === "messaging" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
      className: "space-y-4",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Delivery receipts",
        desc: "Show sent, delivered, seen, and failed states in the inbox.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.deliveryReceipts,
          onChange: value => S("deliveryReceipts", value),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Allow media attachments",
        desc: "Accept images, files, stickers, and contact cards when supported.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.media,
          onChange: value => S("media", value),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Auto-assign conversations",
        desc: "Route new Viber messages to available agents.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.autoAssign,
          onChange: value => S("autoAssign", value),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Textarea, {
        label: "Auto-reply message",
        value: cfg.autoReplyMsg,
        onChange: value => S("autoReplyMsg", value),
        rows: 3,
        placeholder: "Thanks for contacting support. We will reply shortly."
      })]
    })]
  });
}

/***/ },

/***/ "./src/components/settings/WeChat.jsx"
/*!********************************************!*\
  !*** ./src/components/settings/WeChat.jsx ***!
  \********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ WeChatSettings)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _shared_jsx__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./shared.jsx */ "./src/components/settings/shared.jsx");
/* harmony import */ var _tokens_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./tokens.js */ "./src/components/settings/tokens.js");
/* harmony import */ var _api_client_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../api/client.js */ "./src/api/client.js");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react/jsx-runtime */ "react/jsx-runtime");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__);





function WeChatSettings({
  cfg,
  setCfg
}) {
  const [tab, setTab] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)("account");
  const S = (k, v) => setCfg({
    ...cfg,
    [k]: v
  });
  const color = _tokens_js__WEBPACK_IMPORTED_MODULE_2__.TOKEN.wechat.color;
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
    className: "space-y-5",
    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "flex items-center justify-between",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "flex items-center gap-3",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
          className: `w-10 h-10 rounded-2xl bg-gradient-to-br ${_tokens_js__WEBPACK_IMPORTED_MODULE_2__.TOKEN.wechat.grad} flex items-center justify-center text-white font-black text-lg shadow-lg`,
          children: "W"
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
          children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("h2", {
            className: "text-lg font-bold text-white",
            children: "WeChat Official Account"
          }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("p", {
            className: "text-xs text-slate-400",
            children: "Connect your WeChat Official Account to the unified inbox"
          })]
        })]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.StatusBadge, {
        connected: cfg.enabled
      })]
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.TabBar, {
      tabs: [{
        id: "account",
        label: "Account"
      }, {
        id: "webhook",
        label: "Webhook"
      }, {
        id: "menu",
        label: "Custom Menu"
      }, {
        id: "messaging",
        label: "Messaging"
      }],
      active: tab,
      onChange: setTab,
      color: color
    }), tab === "account" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "space-y-4",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.InfoBox, {
        type: "info",
        children: ["Register a WeChat Official Account at ", /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("strong", {
          children: "mp.weixin.qq.com"
        }), ", then create a developer app in the WeChat Open Platform to obtain your App ID and App Secret."]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Enable WeChat",
        desc: "Activate or pause the WeChat integration.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.enabled,
          onChange: v => S("enabled", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "grid grid-cols-2 gap-4 pt-1",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "App ID",
          value: cfg.appId,
          onChange: v => S("appId", v),
          placeholder: "wx1234567890abcdef",
          mono: true,
          helper: "Found in WeChat Open Platform \u2192 your app \u2192 Development settings."
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Select, {
          label: "Account type",
          value: cfg.accountType,
          onChange: v => S("accountType", v),
          options: [{
            value: "service",
            label: "Service account"
          }, {
            value: "subscription",
            label: "Subscription account"
          }],
          helper: "Service accounts support more API features for customer support."
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
          className: "col-span-2",
          children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
            label: "App Secret",
            value: cfg.appSecret,
            onChange: v => S("appSecret", v),
            placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
            type: "password",
            helper: "Keep this secret. Use it only on your backend server."
          })
        })]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
        className: "flex gap-3",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("button", {
          style: {
            background: color
          },
          className: "px-5 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity",
          children: "Test connection"
        })
      })]
    }), tab === "webhook" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "space-y-4",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.InfoBox, {
        type: "tip",
        children: "In the WeChat Official Account admin \u2192 Development \u2192 Basic configuration, set the server URL and paste the Token and EncodingAESKey below. Enable message encryption mode if you use AES."
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
        label: "Server URL \u2014 paste in WeChat admin \u2192 Basic configuration",
        value: (0,_api_client_js__WEBPACK_IMPORTED_MODULE_3__.webhookUrl)("wechat"),
        readOnly: true,
        mono: true,
        helper: "WeChat will POST inbound messages and events to this URL."
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "grid grid-cols-2 gap-4",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "Server Token",
          value: cfg.serverToken,
          onChange: v => S("serverToken", v),
          placeholder: "your_server_token",
          helper: "Any secret string you choose. Used to verify webhook requests."
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "EncodingAESKey",
          value: cfg.encodingAesKey,
          onChange: v => S("encodingAesKey", v),
          placeholder: "43-character encoding key",
          mono: true,
          helper: "Required when message encryption is enabled (43 characters)."
        })]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "URL Verification"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.CodeSnippet, {
        lang: "http",
        code: `GET ${(0,_api_client_js__WEBPACK_IMPORTED_MODULE_3__.webhookUrl)("wechat")}\n  ?signature=<sha1>\n  &timestamp=<timestamp>\n  &nonce=<nonce>\n  &echostr=<echostr>\n\n# Your server validates the signature using the Server Token,\n# then returns echostr to complete verification.`
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "Sample Inbound Message (XML)"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.CodeSnippet, {
        lang: "xml",
        code: `<xml>\n  <ToUserName><![CDATA[gh_xxxxxxxx]]></ToUserName>\n  <FromUserName><![CDATA[oXXXXXXXX]]></FromUserName>\n  <CreateTime>1234567890</CreateTime>\n  <MsgType><![CDATA[text]]></MsgType>\n  <Content><![CDATA[Hello, I need support]]></Content>\n  <MsgId>1234567890123456</MsgId>\n</xml>`
      })]
    }), tab === "menu" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "space-y-4",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.InfoBox, {
        type: "tip",
        children: "Define a custom menu for your Official Account. Publish via the WeChat API or paste JSON below and sync from your backend."
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Textarea, {
        label: "Custom menu JSON",
        value: cfg.menuJson,
        onChange: v => S("menuJson", v),
        rows: 8,
        mono: true,
        helper: "Example: {\"button\":[{\"type\":\"click\",\"name\":\"Support\",\"key\":\"SUPPORT\"}]}"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "Publish Menu \u2014 API call"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.CodeSnippet, {
        lang: "bash",
        code: `curl -X POST \\\n  "https://api.weixin.qq.com/cgi-bin/menu/create?access_token=<ACCESS_TOKEN>" \\\n  -H "Content-Type: application/json" \\\n  -d '${cfg.menuJson || '{"button":[]}'}`
      })]
    }), tab === "messaging" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "space-y-4",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "Conversation Behaviour"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Fetch user profiles",
        desc: "Load WeChat nickname and avatar for inbound conversations.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.fetchProfile,
          onChange: v => S("fetchProfile", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Auto-assign conversations",
        desc: "Route new WeChat messages to available agents.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.autoAssign,
          onChange: v => S("autoAssign", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Allow media attachments",
        desc: "Accept images, voice, video, and file messages when supported.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.media,
          onChange: v => S("media", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "Auto-Reply"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Textarea, {
        label: "Auto-reply message",
        value: cfg.autoReplyMsg,
        onChange: v => S("autoReplyMsg", v),
        rows: 3,
        placeholder: "Thanks for contacting us on WeChat. We will reply shortly.",
        helper: "Sent when a customer messages outside agent hours or on first contact, if configured on your backend."
      })]
    })]
  });
}

/***/ },

/***/ "./src/components/settings/email.impl.jsx"
/*!************************************************!*\
  !*** ./src/components/settings/email.impl.jsx ***!
  \************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ EmailSettings)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _shared_jsx__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./shared.jsx */ "./src/components/settings/shared.jsx");
/* harmony import */ var _tokens_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./tokens.js */ "./src/components/settings/tokens.js");
/* harmony import */ var _api_client_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../api/client.js */ "./src/api/client.js");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react/jsx-runtime */ "react/jsx-runtime");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__);





function EmailSettings({
  cfg,
  setCfg
}) {
  const [tab, setTab] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)("inbox");
  const S = (k, v) => setCfg({
    ...cfg,
    [k]: v
  });
  const color = _tokens_js__WEBPACK_IMPORTED_MODULE_2__.TOKEN.email.color;
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
    className: "space-y-5",
    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "flex items-center justify-between",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "flex items-center gap-3",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
          className: `w-10 h-10 rounded-2xl bg-gradient-to-br ${_tokens_js__WEBPACK_IMPORTED_MODULE_2__.TOKEN.email.grad} flex items-center justify-center text-white font-black text-lg shadow-lg`,
          children: "@"
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
          children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("h2", {
            className: "text-lg font-bold text-white",
            children: "Email Piping"
          }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("p", {
            className: "text-xs text-slate-400",
            children: "Route incoming email into your unified inbox"
          })]
        })]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.StatusBadge, {
        connected: cfg.enabled
      })]
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.TabBar, {
      tabs: [{
        id: "inbox",
        label: "Inbox"
      }, {
        id: "smtp",
        label: "SMTP"
      }, {
        id: "imap",
        label: "IMAP"
      }, {
        id: "templates",
        label: "Templates"
      }, {
        id: "dns",
        label: "DNS / SPF"
      }],
      active: tab,
      onChange: setTab,
      color: color
    }), tab === "inbox" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "space-y-4",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.InfoBox, {
        type: "info",
        children: "Forward your support mailbox to the address below, or configure IMAP polling. No DNS change required for forwarding."
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Enable email channel",
        desc: "Toggle the entire email integration on or off.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.enabled,
          onChange: v => S("enabled", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "grid grid-cols-2 gap-4 pt-1",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "Inbox name",
          value: cfg.inboxName,
          onChange: v => S("inboxName", v),
          placeholder: "Customer Support"
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "Inbox email address",
          value: cfg.inboxEmail,
          onChange: v => S("inboxEmail", v),
          placeholder: "support@acme.com",
          helper: "Customers write to this address."
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "Sender display name",
          value: cfg.senderName,
          onChange: v => S("senderName", v),
          placeholder: "Acme Support Team"
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "Reply-to address",
          value: cfg.replyTo,
          onChange: v => S("replyTo", v),
          placeholder: "noreply@acme.com",
          helper: "Leave blank to use inbox address."
        })]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "Email Forwarding / Piping"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
        label: "Forward-to address (copy into your mailbox forwarder)",
        value: `inbound@${_api_client_js__WEBPACK_IMPORTED_MODULE_3__.siteHost}`,
        readOnly: true,
        mono: true,
        helper: "Direct your email provider's forwarding rule to this address."
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
        label: "Inbound webhook (alternative)",
        value: (0,_api_client_js__WEBPACK_IMPORTED_MODULE_3__.webhookUrl)("email"),
        readOnly: true,
        mono: true
      })]
    }), tab === "smtp" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "space-y-4",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.InfoBox, {
        type: "tip",
        children: "Outgoing email is sent through your SMTP server. Use an app password for Gmail; use an API key as password for SendGrid or Mailgun."
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "grid grid-cols-2 gap-4",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
          className: "col-span-2",
          children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Select, {
            label: "Provider preset",
            value: cfg.smtpPreset,
            onChange: v => S("smtpPreset", v),
            options: [{
              value: "custom",
              label: "Custom / Self-hosted"
            }, {
              value: "gmail",
              label: "Gmail  (smtp.gmail.com)"
            }, {
              value: "outlook",
              label: "Outlook / Office 365"
            }, {
              value: "sendgrid",
              label: "SendGrid"
            }, {
              value: "mailgun",
              label: "Mailgun"
            }, {
              value: "ses",
              label: "Amazon SES"
            }, {
              value: "postmark",
              label: "Postmark"
            }]
          })
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "SMTP host",
          value: cfg.smtpHost,
          onChange: v => S("smtpHost", v),
          placeholder: "smtp.gmail.com"
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Select, {
          label: "Port / Encryption",
          value: cfg.smtpPort,
          onChange: v => S("smtpPort", v),
          options: [{
            value: "587",
            label: "587 — STARTTLS (recommended)"
          }, {
            value: "465",
            label: "465 — SSL/TLS"
          }, {
            value: "25",
            label: "25 — Unencrypted"
          }]
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "Username",
          value: cfg.smtpUser,
          onChange: v => S("smtpUser", v),
          placeholder: "you@acme.com"
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "Password / API key",
          value: cfg.smtpPass,
          onChange: v => S("smtpPass", v),
          placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
          type: "password"
        })]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Enforce TLS",
        desc: "Encrypt the SMTP connection. Strongly recommended.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.smtpTls,
          onChange: v => S("smtpTls", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Verify SSL certificate",
        desc: "Disable only for self-signed certs in development.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.smtpVerifySsl,
          onChange: v => S("smtpVerifySsl", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("button", {
        style: {
          background: color
        },
        className: "mt-1 px-5 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity",
        children: "Send test email"
      })]
    }), tab === "imap" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "space-y-4",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.InfoBox, {
        type: "info",
        children: "IMAP polls your mailbox at a set interval and imports new messages. Use forwarding above for near-instant delivery."
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "grid grid-cols-2 gap-4",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "IMAP host",
          value: cfg.imapHost,
          onChange: v => S("imapHost", v),
          placeholder: "imap.gmail.com"
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Select, {
          label: "Port / Encryption",
          value: cfg.imapPort,
          onChange: v => S("imapPort", v),
          options: [{
            value: "993",
            label: "993 — SSL/TLS (recommended)"
          }, {
            value: "143",
            label: "143 — STARTTLS"
          }]
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "Username",
          value: cfg.imapUser,
          onChange: v => S("imapUser", v),
          placeholder: "support@acme.com"
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "Password",
          value: cfg.imapPass,
          onChange: v => S("imapPass", v),
          placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
          type: "password"
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "Mailbox folder",
          value: cfg.imapFolder,
          onChange: v => S("imapFolder", v),
          placeholder: "INBOX"
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Select, {
          label: "Poll interval",
          value: cfg.imapPoll,
          onChange: v => S("imapPoll", v),
          options: [{
            value: "1",
            label: "Every 1 minute"
          }, {
            value: "2",
            label: "Every 2 minutes"
          }, {
            value: "5",
            label: "Every 5 minutes"
          }, {
            value: "10",
            label: "Every 10 minutes"
          }]
        })]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Delete from mailbox after import",
        desc: "Remove email from IMAP folder after it has been pulled.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.imapDelete,
          onChange: v => S("imapDelete", v),
          color: color
        })
      })]
    }), tab === "templates" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "space-y-5",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "Auto-Reply"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Send auto-reply on new conversation",
        desc: "Acknowledge customers the moment a new thread arrives.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.autoReply,
          onChange: v => S("autoReply", v),
          color: color
        })
      }), cfg.autoReply && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "Subject",
          value: cfg.autoReplySubject,
          onChange: v => S("autoReplySubject", v),
          placeholder: "We received your message \u2014 Ref #{{ticket_id}}"
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Textarea, {
          label: "Body",
          value: cfg.autoReplyBody,
          onChange: v => S("autoReplyBody", v),
          rows: 5,
          placeholder: "Hi {{customer_name}},\n\nThank you for contacting us! Ticket #{{ticket_id}} has been created and we'll respond within 1 business day.\n\nBest,\n{{team_name}}",
          helper: "Tokens: {{customer_name}}, {{ticket_id}}, {{agent_name}}, {{team_name}}"
        })]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "Email Signature"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Append signature to all replies",
        desc: "Automatically added below every outgoing agent email.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.signature,
          onChange: v => S("signature", v),
          color: color
        })
      }), cfg.signature && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Textarea, {
        value: cfg.signatureBody,
        onChange: v => S("signatureBody", v),
        rows: 4,
        placeholder: "Best regards,\nThe Support Team\nsupport@acme.com | +1 800 000 0000"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "Out-of-Office"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Enable out-of-office message",
        desc: "Sent when email arrives outside business hours.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.outOfOffice,
          onChange: v => S("outOfOffice", v),
          color: color
        })
      }), cfg.outOfOffice && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Textarea, {
        value: cfg.oooBody,
        onChange: v => S("oooBody", v),
        rows: 3,
        placeholder: "Thanks for your email! We're currently out of office and will respond on the next business day."
      })]
    }), tab === "dns" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "space-y-4",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.InfoBox, {
        type: "warning",
        children: "Add these DNS TXT records to your domain to improve deliverability and prevent spoofing. Changes can take up to 48 hours to propagate."
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "SPF Record"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
        label: "TXT record \u2014 add to your root domain (@)",
        value: `v=spf1 include:mail.${_api_client_js__WEBPACK_IMPORTED_MODULE_3__.siteHost} ~all`,
        readOnly: true,
        mono: true,
        helper: "Authorises your mail server to send on behalf of your domain."
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "DKIM Record"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
        label: "TXT record \u2014 host: mail._domainkey",
        value: "v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQ...",
        readOnly: true,
        mono: true
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "DMARC Record"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
        label: "TXT record \u2014 host: _dmarc",
        value: "v=DMARC1; p=quarantine; rua=mailto:dmarc@acme.com",
        readOnly: true,
        mono: true
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "MX Record (for email piping)"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
        label: "MX record \u2014 host: @, priority: 10",
        value: `mx.in.${_api_client_js__WEBPACK_IMPORTED_MODULE_3__.siteHost}`,
        readOnly: true,
        mono: true,
        helper: "Required if you want to receive email directly (not forwarding)."
      })]
    })]
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   WHATSAPP SETTINGS
═══════════════════════════════════════════════════════════════════════════ */

/***/ },

/***/ "./src/components/settings/email.js"
/*!******************************************!*\
  !*** ./src/components/settings/email.js ***!
  \******************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* reexport safe */ _email_impl_jsx__WEBPACK_IMPORTED_MODULE_0__["default"])
/* harmony export */ });
/* harmony import */ var _email_impl_jsx__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./email.impl.jsx */ "./src/components/settings/email.impl.jsx");


/***/ },

/***/ "./src/components/settings/instagram.jsx"
/*!***********************************************!*\
  !*** ./src/components/settings/instagram.jsx ***!
  \***********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ InstagramSettings)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _shared_jsx__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./shared.jsx */ "./src/components/settings/shared.jsx");
/* harmony import */ var _tokens_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./tokens.js */ "./src/components/settings/tokens.js");
/* harmony import */ var _api_client_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../api/client.js */ "./src/api/client.js");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react/jsx-runtime */ "react/jsx-runtime");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__);





function InstagramSettings({
  cfg,
  setCfg
}) {
  const [tab, setTab] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)("api");
  const S = (k, v) => setCfg({
    ...cfg,
    [k]: v
  });
  const color = _tokens_js__WEBPACK_IMPORTED_MODULE_2__.TOKEN.instagram.color;
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
    className: "space-y-5",
    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "flex items-center justify-between",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "flex items-center gap-3",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
          className: `w-10 h-10 rounded-2xl bg-gradient-to-br ${_tokens_js__WEBPACK_IMPORTED_MODULE_2__.TOKEN.instagram.grad} flex items-center justify-center text-white font-black text-lg shadow-lg`,
          children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("i", {
            className: "ti ti-brand-instagram",
            style: {
              fontSize: 20
            }
          })
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
          children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("h2", {
            className: "text-lg font-bold text-white",
            children: "Instagram DM"
          }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("p", {
            className: "text-xs text-slate-400",
            children: "Receive and reply to Instagram Direct Messages in your inbox"
          })]
        })]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.StatusBadge, {
        connected: cfg.enabled
      })]
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.TabBar, {
      tabs: [{
        id: "api",
        label: "API Keys"
      }, {
        id: "webhook",
        label: "Webhook"
      }, {
        id: "automation",
        label: "Automation"
      }, {
        id: "advanced",
        label: "Advanced"
      }],
      active: tab,
      onChange: setTab,
      color: color
    }), tab === "api" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "space-y-4",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.InfoBox, {
        type: "info",
        children: ["Instagram DM uses the ", /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("strong", {
          children: "Meta Messaging API"
        }), ". You need an Instagram Professional Account connected to a Facebook Page, and a Meta App with ", /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("strong", {
          children: "instagram_manage_messages"
        }), " and ", /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("strong", {
          children: "instagram_basic"
        }), " permissions approved."]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Enable Instagram DM",
        desc: "Activate or pause the Instagram integration.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.enabled,
          onChange: v => S("enabled", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "grid grid-cols-2 gap-4 pt-1",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "Instagram Account ID",
          value: cfg.igAccountId,
          onChange: v => S("igAccountId", v),
          placeholder: "17841400000000000",
          mono: true,
          helper: "Found in Instagram \u2192 Settings \u2192 Account \u2192 About this account \u2192 Instagram ID."
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "Connected Facebook Page ID",
          value: cfg.pageId,
          onChange: v => S("pageId", v),
          placeholder: "123456789012345",
          mono: true,
          helper: "The Page linked to your Instagram Professional Account."
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
          className: "col-span-2",
          children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
            label: "Page Access Token",
            value: cfg.pageToken,
            onChange: v => S("pageToken", v),
            placeholder: "EAAxxxxxxxxxxxxxxxxxxxxxxx\u2026",
            type: "password",
            helper: "Generate a System User token with instagram_manage_messages scope in Meta Business Settings."
          })
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "Meta App ID",
          value: cfg.appId,
          onChange: v => S("appId", v),
          placeholder: "1234567890",
          mono: true
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "App Secret",
          value: cfg.appSecret,
          onChange: v => S("appSecret", v),
          placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
          type: "password",
          helper: "Used to verify X-Hub-Signature-256 on inbound webhooks."
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "Webhook Verify Token",
          value: cfg.verifyToken,
          onChange: v => S("verifyToken", v),
          placeholder: "your_custom_verify_token",
          helper: "Any secret string. Must match exactly what you enter in Meta Webhooks."
        })]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
        className: "flex gap-3 pt-2",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("button", {
          style: {
            background: color
          },
          className: "px-5 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity",
          children: "Verify connection"
        })
      })]
    }), tab === "webhook" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "space-y-4",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.InfoBox, {
        type: "tip",
        children: ["In Meta for Developers \u2192 App \u2192 Instagram \u2192 Webhooks, subscribe to the ", /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("strong", {
          children: "messages"
        }), " and ", /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("strong", {
          children: "messaging_postbacks"
        }), " fields. Paste the Callback URL and Verify Token below."]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
        label: "Callback URL \u2014 paste into Meta Instagram Webhooks",
        value: (0,_api_client_js__WEBPACK_IMPORTED_MODULE_3__.webhookUrl)("instagram"),
        readOnly: true,
        mono: true,
        helper: "Meta will POST all Instagram DM events to this URL."
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
        label: "Verify Token \u2014 paste into Meta Instagram Webhooks",
        value: cfg.verifyToken,
        onChange: v => S("verifyToken", v),
        placeholder: "your_custom_verify_token_here",
        helper: "Must match the Verify Token you entered in the API Keys tab."
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "Required Webhook Subscriptions"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.CodeSnippet, {
        lang: "subscriptions",
        code: "messages\nmessaging_postbacks\nmessaging_seen\nstandby"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "Sample Inbound DM Payload"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.CodeSnippet, {
        lang: "json",
        code: `{\n  "object": "instagram",\n  "entry": [{\n    "id": "${cfg.igAccountId || "IG_ACCOUNT_ID"}",\n    "messaging": [{\n      "sender":    { "id": "USER_IGSID" },\n      "recipient": { "id": "${cfg.igAccountId || "IG_ACCOUNT_ID"}" },\n      "timestamp": 1234567890000,\n      "message":   { "mid": "m_xxxxx", "text": "Hi, I need help!" }\n    }]\n  }]\n}`
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "Permissions Required (review in Meta App Review)"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.CodeSnippet, {
        lang: "permissions",
        code: "instagram_manage_messages\ninstagram_basic\npages_messaging\npages_read_engagement\npages_manage_metadata"
      })]
    }), tab === "automation" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "space-y-5",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "Auto-Reply"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Send auto-reply on new DM",
        desc: "Instantly acknowledge a customer when they open a new conversation.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.autoReply,
          onChange: v => S("autoReply", v),
          color: color
        })
      }), cfg.autoReply && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Textarea, {
        label: "Auto-reply message",
        value: cfg.autoReplyMsg,
        onChange: v => S("autoReplyMsg", v),
        rows: 3,
        placeholder: "Hi! Thanks for reaching out on Instagram \uD83D\uDC4B An agent will reply shortly.",
        helper: "Tokens: {{customer_name}}, {{ticket_id}}"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Away message (outside business hours)",
        desc: "Sent when no agents are online.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.awayMsg,
          onChange: v => S("awayMsg", v),
          color: color
        })
      }), cfg.awayMsg && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Textarea, {
        value: cfg.awayMsgText,
        onChange: v => S("awayMsgText", v),
        rows: 2,
        placeholder: "We're offline right now but will respond as soon as possible \u2600\uFE0F"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "Ice Breakers"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Enable ice breakers",
        desc: "Show quick-start question buttons in new conversations.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.iceBreakers,
          onChange: v => S("iceBreakers", v),
          color: color
        })
      }), cfg.iceBreakers && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "space-y-2 pl-1",
        children: [(cfg.iceList || []).map((item, i) => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
          className: "flex gap-2",
          children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
            className: "flex-1",
            children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
              value: item,
              onChange: v => {
                const l = [...(cfg.iceList || [])];
                l[i] = v;
                S("iceList", l);
              },
              placeholder: `Question ${i + 1}`
            })
          }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("button", {
            onClick: () => S("iceList", (cfg.iceList || []).filter((_, j) => j !== i)),
            className: "self-center text-slate-600 hover:text-red-400 transition-colors px-2",
            children: "\u2715"
          })]
        }, i)), (cfg.iceList?.length || 0) < 4 && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("button", {
          onClick: () => S("iceList", [...(cfg.iceList || []), ""]),
          className: "text-xs font-semibold text-pink-400 hover:text-pink-300 transition-colors flex items-center gap-1",
          children: "+ Add question"
        })]
      })]
    }), tab === "advanced" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "space-y-1",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Fetch customer profile",
        desc: "Load the Instagram username from the API for new conversations.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.fetchProfile,
          onChange: v => S("fetchProfile", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Typing indicator",
        desc: "Send a typing bubble to the customer while an agent types.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.typingIndicator,
          onChange: v => S("typingIndicator", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Read receipts",
        desc: "Mark messages as seen when an agent opens the conversation.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.readReceipts,
          onChange: v => S("readReceipts", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Allow image attachments",
        desc: "Accept and send images via Instagram DM.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.imageAttach,
          onChange: v => S("imageAttach", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Allow story replies",
        desc: "Receive customer replies to your Instagram Stories as DMs.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.storyReplies,
          onChange: v => S("storyReplies", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Auto-assign new conversations",
        desc: "Round-robin assignment to available agents.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.autoAssign,
          onChange: v => S("autoAssign", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "CSAT survey on conversation close",
        desc: "Send a thumbs-up/down satisfaction survey to customers.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.csat,
          onChange: v => S("csat", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "Note"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.InfoBox, {
        type: "warning",
        children: "Instagram DM API requires your app to pass Meta App Review before it can receive messages from customers who haven't previously messaged your account. Test with accounts that have Instagram Business/Creator profiles during development."
      })]
    })]
  });
}

/***/ },

/***/ "./src/components/settings/messanger.jsx"
/*!***********************************************!*\
  !*** ./src/components/settings/messanger.jsx ***!
  \***********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ MessengerSettings)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _shared_jsx__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./shared.jsx */ "./src/components/settings/shared.jsx");
/* harmony import */ var _tokens_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./tokens.js */ "./src/components/settings/tokens.js");
/* harmony import */ var _api_client_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../api/client.js */ "./src/api/client.js");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react/jsx-runtime */ "react/jsx-runtime");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__);





function MessengerSettings({
  cfg,
  setCfg
}) {
  const [tab, setTab] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)("api");
  const S = (k, v) => setCfg({
    ...cfg,
    [k]: v
  });
  const color = _tokens_js__WEBPACK_IMPORTED_MODULE_2__.TOKEN.messenger.color;
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
    className: "space-y-5",
    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "flex items-center justify-between",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "flex items-center gap-3",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
          className: `w-10 h-10 rounded-2xl bg-gradient-to-br ${_tokens_js__WEBPACK_IMPORTED_MODULE_2__.TOKEN.messenger.grad} flex items-center justify-center text-white font-black text-lg shadow-lg`,
          children: "M"
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
          children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("h2", {
            className: "text-lg font-bold text-white",
            children: "Facebook Messenger"
          }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("p", {
            className: "text-xs text-slate-400",
            children: "Receive & reply to Messenger DMs in your inbox"
          })]
        })]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.StatusBadge, {
        connected: cfg.enabled
      })]
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.TabBar, {
      tabs: [{
        id: "api",
        label: "API Keys"
      }, {
        id: "webhook",
        label: "Webhook"
      }, {
        id: "widget",
        label: "Chat Plugin"
      }, {
        id: "automation",
        label: "Automation"
      }, {
        id: "advanced",
        label: "Advanced"
      }],
      active: tab,
      onChange: setTab,
      color: color
    }), tab === "api" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "space-y-4",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.InfoBox, {
        type: "info",
        children: ["Connect a Facebook Page via Meta for Developers. Your app needs ", /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("strong", {
          children: "pages_messaging"
        }), ", ", /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("strong", {
          children: "pages_read_engagement"
        }), ", and ", /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("strong", {
          children: "pages_manage_metadata"
        }), " permissions."]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Enable Messenger",
        desc: "Activate or pause the Messenger integration.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.enabled,
          onChange: v => S("enabled", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "grid grid-cols-2 gap-4 pt-1",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "Facebook Page ID",
          value: cfg.pageId,
          onChange: v => S("pageId", v),
          placeholder: "123456789012345",
          mono: true,
          helper: "Found under Page \u2192 About \u2192 Page Transparency."
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "Page Name",
          value: cfg.pageName,
          onChange: v => S("pageName", v),
          placeholder: "Acme Support"
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
          className: "col-span-2",
          children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
            label: "Page Access Token",
            value: cfg.pageToken,
            onChange: v => S("pageToken", v),
            placeholder: "EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx...",
            type: "password",
            helper: "Generate in Meta for Developers \u2192 Graph API Explorer."
          })
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "Meta App ID",
          value: cfg.appId,
          onChange: v => S("appId", v),
          placeholder: "1234567890",
          mono: true
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "App Secret",
          value: cfg.appSecret,
          onChange: v => S("appSecret", v),
          placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
          type: "password",
          helper: "Used to verify webhook signatures."
        })]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "flex gap-3 pt-2",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("button", {
          style: {
            background: color
          },
          className: "px-5 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity",
          children: "Verify Connection"
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("button", {
          className: "px-5 py-2 rounded-xl text-sm font-semibold text-slate-300 border border-slate-700 hover:bg-slate-800 transition-colors",
          children: "Clear credentials"
        })]
      })]
    }), tab === "webhook" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "space-y-4",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.InfoBox, {
        type: "tip",
        children: ["Paste the Callback URL and Verify Token into ", /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("strong", {
          children: "Meta for Developers \u2192 App \u2192 Webhooks \u2192 Page"
        }), ". Subscribe to: ", /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("code", {
          className: "font-mono",
          children: "messages, messaging_postbacks, messaging_optins, message_deliveries"
        })]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
        label: "Callback URL \u2014 paste into Meta Webhooks",
        value: (0,_api_client_js__WEBPACK_IMPORTED_MODULE_3__.webhookUrl)("messenger"),
        readOnly: true,
        mono: true,
        helper: "Meta will POST all Messenger events to this endpoint."
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
        label: "Verify Token \u2014 paste into Meta Webhooks",
        value: cfg.verifyToken,
        onChange: v => S("verifyToken", v),
        placeholder: "your_custom_verify_token_here",
        helper: "Any secret string. Must match exactly what you enter in Meta."
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "Required Webhook Subscriptions"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.CodeSnippet, {
        lang: "subscriptions",
        code: "messages\nmessaging_postbacks\nmessaging_optins\nmessage_deliveries\nmessage_reads"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "Sample Payload"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.CodeSnippet, {
        lang: "json",
        code: `{\n  "object": "page",\n  "entry": [{\n    "id": "${cfg.pageId || "PAGE_ID"}",\n    "messaging": [{\n      "sender": { "id": "USER_PSID" },\n      "message": { "text": "Hello!" }\n    }]\n  }]\n}`
      })]
    }), tab === "widget" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "space-y-4",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Enable Customer Chat Plugin",
        desc: "Embed Messenger chat widget on your website.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.chatPlugin,
          onChange: v => S("chatPlugin", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "grid grid-cols-2 gap-4",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "Greeting \u2014 logged-in users",
          value: cfg.greetLoggedIn,
          onChange: v => S("greetLoggedIn", v),
          placeholder: "Hi {{user_first_name}}! How can we help?",
          helper: "Shown to visitors with active Facebook sessions."
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "Greeting \u2014 logged-out users",
          value: cfg.greetLoggedOut,
          onChange: v => S("greetLoggedOut", v),
          placeholder: "Hi there! How can we help?"
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "Theme color (hex)",
          value: cfg.themeColor,
          onChange: v => S("themeColor", v),
          placeholder: "#0866FF"
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Select, {
          label: "Logged-out chat mode",
          value: cfg.loggedOutMode,
          onChange: v => S("loggedOutMode", v),
          options: [{
            value: "window",
            label: "Open in new window"
          }, {
            value: "inline",
            label: "Inline"
          }, {
            value: "hide",
            label: "Hide for logged-out"
          }]
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
          className: "col-span-2",
          children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
            label: "Allowed domain",
            value: cfg.allowedDomain,
            onChange: v => S("allowedDomain", v),
            placeholder: "https://www.yourwebsite.com",
            helper: "Only this domain may load the chat plugin. Must include https://"
          })
        })]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "Embed Snippet"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.CodeSnippet, {
        lang: "html",
        code: `<!-- Add before </body> -->\n<div id="fb-root"></div>\n<script async defer\n  crossorigin="anonymous"\n  src="https://connect.facebook.net/en_US/sdk/xfbml.customerchat.js">\n</script>\n<fb:customerchat\n  attribution="setup_tool"\n  page_id="${cfg.pageId || "YOUR_PAGE_ID"}"\n  theme_color="${cfg.themeColor || "#0866FF"}">\n</fb:customerchat>`
      })]
    }), tab === "automation" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "space-y-5",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "Auto-Reply"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Send auto-reply on new thread",
        desc: "Instantly acknowledge a customer when they open a new Messenger conversation.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.autoReply,
          onChange: v => S("autoReply", v),
          color: color
        })
      }), cfg.autoReply && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Textarea, {
        label: "Auto-reply message",
        value: cfg.autoReplyMsg,
        onChange: v => S("autoReplyMsg", v),
        rows: 3,
        placeholder: "Hi {{user_first_name}}! Thanks for messaging us 👋 An agent will reply shortly.",
        helper: "Tokens: {{user_first_name}}, {{page_name}}, {{agent_name}}"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Away message (outside business hours)",
        desc: "Sent when no agents are online.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.awayMsg,
          onChange: v => S("awayMsg", v),
          color: color
        })
      }), cfg.awayMsg && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Textarea, {
        value: cfg.awayMsgText,
        onChange: v => S("awayMsgText", v),
        rows: 2,
        placeholder: "We're offline right now but will respond first thing tomorrow ☀️"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "Ice Breakers"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Enable ice breakers",
        desc: "Show quick-start question buttons when a user opens the conversation for the first time.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.iceBreakers,
          onChange: v => S("iceBreakers", v),
          color: color
        })
      }), cfg.iceBreakers && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "space-y-2 pl-1",
        children: [(cfg.iceList || []).map((item, i) => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
          className: "flex gap-2",
          children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
            className: "flex-1",
            children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
              value: item,
              onChange: v => {
                const l = [...(cfg.iceList || [])];
                l[i] = v;
                S("iceList", l);
              },
              placeholder: `Question ${i + 1}`
            })
          }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("button", {
            onClick: () => S("iceList", (cfg.iceList || []).filter((_, j) => j !== i)),
            className: "self-center text-slate-600 hover:text-red-400 transition-colors px-2",
            children: "\u2715"
          })]
        }, i)), (cfg.iceList?.length || 0) < 4 && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("button", {
          onClick: () => S("iceList", [...(cfg.iceList || []), ""]),
          className: "text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1",
          children: "+ Add question"
        })]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "Persistent Menu"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Enable persistent menu",
        desc: "A hamburger menu always visible in the Messenger compose bar.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.persistentMenu,
          onChange: v => S("persistentMenu", v),
          color: color
        })
      })]
    }), tab === "advanced" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "space-y-1",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Fetch user profile (name & avatar)",
        desc: "Pull customer name and profile picture from Facebook.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.fetchProfile,
          onChange: v => S("fetchProfile", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Read receipts",
        desc: "Show agents when messages have been seen by the customer.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.readReceipts,
          onChange: v => S("readReceipts", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Typing indicator",
        desc: "Show a typing bubble to the customer while an agent types.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.typingIndicator,
          onChange: v => S("typingIndicator", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Message reactions",
        desc: "Allow agents to react to messages with emoji.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.reactions,
          onChange: v => S("reactions", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Quick reply buttons",
        desc: "Add structured reply buttons for faster customer responses.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.quickReplies,
          onChange: v => S("quickReplies", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Allow image attachments",
        desc: "Accept and send images via Messenger.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.imageAttach,
          onChange: v => S("imageAttach", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Allow file attachments",
        desc: "Accept PDFs, documents, and other files.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.fileAttach,
          onChange: v => S("fileAttach", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Auto-assign new conversations",
        desc: "Round-robin assignment to available agents.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.autoAssign,
          onChange: v => S("autoAssign", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "CSAT survey on conversation close",
        desc: "Send a thumbs-up/down satisfaction rating request.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.csat,
          onChange: v => S("csat", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "pt-3",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
          label: "Handover Protocol"
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
          label: "Enable Handover Protocol",
          desc: "Pass thread control between your inbox and a Meta bot.",
          children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
            checked: cfg.handover,
            onChange: v => S("handover", v),
            color: color
          })
        }), cfg.handover && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
          className: "pt-2",
          children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
            label: "Secondary Receiver App ID",
            value: cfg.secondaryAppId,
            onChange: v => S("secondaryAppId", v),
            placeholder: "Meta App ID of the secondary receiver",
            mono: true
          })
        })]
      })]
    })]
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   EMAIL SETTINGS
═══════════════════════════════════════════════════════════════════════════ */

/***/ },

/***/ "./src/components/settings/shared.jsx"
/*!********************************************!*\
  !*** ./src/components/settings/shared.jsx ***!
  \********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ChannelCard: () => (/* binding */ ChannelCard),
/* harmony export */   CodeSnippet: () => (/* binding */ CodeSnippet),
/* harmony export */   InfoBox: () => (/* binding */ InfoBox),
/* harmony export */   Input: () => (/* binding */ Input),
/* harmony export */   Row: () => (/* binding */ Row),
/* harmony export */   SectionDivider: () => (/* binding */ SectionDivider),
/* harmony export */   Select: () => (/* binding */ Select),
/* harmony export */   StatusBadge: () => (/* binding */ StatusBadge),
/* harmony export */   TOKEN: () => (/* reexport safe */ _tokens_js__WEBPACK_IMPORTED_MODULE_1__.TOKEN),
/* harmony export */   TabBar: () => (/* binding */ TabBar),
/* harmony export */   Textarea: () => (/* binding */ Textarea),
/* harmony export */   Toggle: () => (/* binding */ Toggle)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _tokens_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./tokens.js */ "./src/components/settings/tokens.js");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react/jsx-runtime */ "react/jsx-runtime");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__);



/* ─── tiny primitives ───────────────────────────────────────────────────── */

function Toggle({
  checked,
  onChange,
  color = "#6366f1"
}) {
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("button", {
    onClick: () => onChange(!checked),
    style: {
      background: checked ? color : "#d1d5db"
    },
    className: "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none",
    children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("span", {
      className: `inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${checked ? "translate-x-6" : "translate-x-1"}`
    })
  });
}
function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  readOnly,
  mono,
  helper,
  prefix,
  suffix
}) {
  const [show, setShow] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
  const isPass = type === "password";
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("div", {
    className: "space-y-1.5",
    children: [label && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("label", {
      className: "block text-xs font-semibold uppercase tracking-widest text-slate-400",
      children: label
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("div", {
      className: `flex items-center rounded-xl border transition-all duration-150 ${readOnly ? "border-slate-700/60 bg-slate-800/40" : "border-slate-700 bg-slate-800/70 hover:border-slate-500 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20"}`,
      children: [prefix && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("span", {
        className: "px-3 py-2.5 text-xs text-slate-500 border-r border-slate-700 select-none font-mono",
        children: prefix
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("input", {
        type: isPass && !show ? "password" : "text",
        value: value,
        onChange: e => !readOnly && onChange?.(e.target.value),
        placeholder: placeholder,
        readOnly: readOnly,
        className: `flex-1 bg-transparent px-3 py-2.5 text-sm outline-none ${readOnly ? "text-slate-400 select-all cursor-default" : "text-slate-100 placeholder-slate-600"} ${mono ? "font-mono" : ""}`
      }), isPass && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("button", {
        onClick: () => setShow(s => !s),
        className: "px-3 text-slate-500 hover:text-slate-300 transition-colors",
        children: show ? "🙈" : "👁"
      }), readOnly && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("button", {
        onClick: () => navigator.clipboard?.writeText(value),
        className: "px-3 text-slate-500 hover:text-indigo-400 transition-colors text-xs font-medium",
        children: "copy"
      }), suffix && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("span", {
        className: "px-3 text-xs text-slate-500 font-mono",
        children: suffix
      })]
    }), helper && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("p", {
      className: "text-xs text-slate-500 leading-relaxed",
      children: helper
    })]
  });
}
function Select({
  label,
  value,
  onChange,
  options,
  helper
}) {
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("div", {
    className: "space-y-1.5",
    children: [label && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("label", {
      className: "block text-xs font-semibold uppercase tracking-widest text-slate-400",
      children: label
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("select", {
      value: value,
      onChange: e => onChange(e.target.value),
      className: "w-full rounded-xl border border-slate-700 bg-slate-800/70 px-3 py-2.5 text-sm text-slate-100 outline-none hover:border-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all",
      children: options.map(o => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("option", {
        value: o.value,
        className: "bg-slate-800",
        children: o.label
      }, o.value))
    }), helper && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("p", {
      className: "text-xs text-slate-500 leading-relaxed",
      children: helper
    })]
  });
}
function Textarea({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  helper,
  mono
}) {
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("div", {
    className: "space-y-1.5",
    children: [label && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("label", {
      className: "block text-xs font-semibold uppercase tracking-widest text-slate-400",
      children: label
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("textarea", {
      rows: rows,
      value: value,
      onChange: e => onChange(e.target.value),
      placeholder: placeholder,
      className: `w-full rounded-xl border border-slate-700 bg-slate-800/70 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 outline-none resize-none hover:border-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all leading-relaxed ${mono ? "font-mono" : ""}`
    }), helper && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("p", {
      className: "text-xs text-slate-500 leading-relaxed",
      children: helper
    })]
  });
}
function SectionDivider({
  label
}) {
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("div", {
    className: "flex items-center gap-3 py-2",
    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("div", {
      className: "flex-1 h-px bg-slate-700/60"
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("span", {
      className: "text-xs font-semibold uppercase tracking-widest text-slate-500",
      children: label
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("div", {
      className: "flex-1 h-px bg-slate-700/60"
    })]
  });
}
function Row({
  label,
  desc,
  children
}) {
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("div", {
    className: "flex items-start justify-between gap-6 py-3.5 border-b border-slate-800/80 last:border-0",
    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("div", {
      className: "flex-1",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("p", {
        className: "text-sm font-medium text-slate-200",
        children: label
      }), desc && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("p", {
        className: "text-xs text-slate-500 mt-0.5 leading-relaxed",
        children: desc
      })]
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("div", {
      className: "shrink-0 pt-0.5",
      children: children
    })]
  });
}
function InfoBox({
  children,
  type = "info"
}) {
  const styles = {
    info: "border-blue-500/30 bg-blue-500/8 text-blue-300",
    warning: "border-amber-500/30 bg-amber-500/8 text-amber-300",
    success: "border-green-500/30 bg-green-500/8 text-green-300",
    tip: "border-indigo-500/30 bg-indigo-500/8 text-indigo-300"
  };
  const icons = {
    info: "ℹ",
    warning: "⚠",
    success: "✓",
    tip: "💡"
  };
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("div", {
    className: `flex gap-3 rounded-xl border px-4 py-3 text-xs leading-relaxed ${styles[type]}`,
    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("span", {
      className: "shrink-0 mt-0.5",
      children: icons[type]
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("span", {
      children: children
    })]
  });
}
function CodeSnippet({
  code,
  lang = "html"
}) {
  const [copied, setCopied] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("div", {
    className: "rounded-xl overflow-hidden border border-slate-700/60",
    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("div", {
      className: "flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-700/60",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("span", {
        className: "text-xs font-mono text-slate-500",
        children: lang
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("button", {
        onClick: () => {
          navigator.clipboard?.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        },
        className: `text-xs font-medium transition-colors ${copied ? "text-green-400" : "text-slate-400 hover:text-white"}`,
        children: copied ? "✓ copied" : "copy"
      })]
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("pre", {
      className: "px-4 py-3 bg-slate-950/80 text-xs text-emerald-400 font-mono leading-relaxed overflow-x-auto whitespace-pre",
      children: code
    })]
  });
}
function StatusBadge({
  connected
}) {
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("span", {
    className: `inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full ${connected ? "bg-green-500/15 text-green-400 border border-green-500/25" : "bg-slate-700/50 text-slate-400 border border-slate-600/40"}`,
    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("span", {
      className: `w-1.5 h-1.5 rounded-full ${connected ? "bg-green-400 animate-pulse" : "bg-slate-500"}`
    }), connected ? "Connected" : "Not connected"]
  });
}
function TabBar({
  tabs,
  active,
  onChange,
  color
}) {
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("div", {
    className: "flex gap-1 p-1 rounded-xl bg-slate-900/60 border border-slate-800",
    children: tabs.map(t => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("button", {
      onClick: () => onChange(t.id),
      style: active === t.id ? {
        background: color + "18",
        color
      } : {},
      className: `flex-1 text-xs font-semibold py-2 px-3 rounded-lg transition-all duration-150 ${active === t.id ? "shadow-sm" : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/60"}`,
      children: t.label
    }, t.id))
  });
}


/* ─── channel cards (sidebar) ───────────────────────────────────────────── */
function ChannelCard({
  id,
  active,
  connected,
  onClick
}) {
  const t = _tokens_js__WEBPACK_IMPORTED_MODULE_1__.TOKEN[id];
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("button", {
    onClick: onClick,
    className: `w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-150 group ${active ? "bg-slate-800 shadow-md border border-slate-700/60" : "hover:bg-slate-800/50 border border-transparent"}`,
    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("div", {
      className: `w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black text-white shadow-sm bg-gradient-to-br ${t.grad} shrink-0`,
      children: t.icon
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("div", {
      className: "flex-1 text-left min-w-0",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("p", {
        className: `text-sm font-semibold truncate ${active ? "text-gray-500" : "text-slate-300"}`,
        children: t.label
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("p", {
        className: "text-xs text-slate-500",
        children: connected ? "● Connected" : "○ Disconnected"
      })]
    }), active && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("div", {
      className: "w-1 h-8 rounded-full",
      style: {
        background: t.color
      }
    })]
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   MESSENGER SETTINGS
═══════════════════════════════════════════════════════════════════════════ */

/***/ },

/***/ "./src/components/settings/sms.jsx"
/*!*****************************************!*\
  !*** ./src/components/settings/sms.jsx ***!
  \*****************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ SmsSettings)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _shared_jsx__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./shared.jsx */ "./src/components/settings/shared.jsx");
/* harmony import */ var _tokens_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./tokens.js */ "./src/components/settings/tokens.js");
/* harmony import */ var _api_client_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../api/client.js */ "./src/api/client.js");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react/jsx-runtime */ "react/jsx-runtime");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__);





function SmsSettings({
  cfg,
  setCfg
}) {
  const [tab, setTab] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)("connection");
  const S = (k, v) => setCfg({
    ...cfg,
    [k]: v
  });
  const color = _tokens_js__WEBPACK_IMPORTED_MODULE_2__.TOKEN.sms.color;
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
    className: "space-y-5",
    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "flex items-center justify-between",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "flex items-center gap-3",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
          className: `w-10 h-10 rounded-2xl bg-gradient-to-br ${_tokens_js__WEBPACK_IMPORTED_MODULE_2__.TOKEN.sms.grad} flex items-center justify-center text-white font-black text-lg shadow-lg`,
          children: "S"
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
          children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("h2", {
            className: "text-lg font-bold text-white",
            children: "SMS"
          }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("p", {
            className: "text-xs text-slate-400",
            children: "Connect your SMS provider to the unified inbox"
          })]
        })]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.StatusBadge, {
        connected: cfg.enabled
      })]
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.TabBar, {
      tabs: [{
        id: "connection",
        label: "Connection"
      }, {
        id: "numbers",
        label: "Phone Numbers"
      }, {
        id: "messaging",
        label: "Messaging"
      }, {
        id: "compliance",
        label: "Compliance"
      }, {
        id: "advanced",
        label: "Advanced"
      }],
      active: tab,
      onChange: setTab,
      color: color
    }), tab === "connection" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "space-y-4",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.InfoBox, {
        type: "info",
        children: "Connect your SMS provider to send and receive text messages. The platform supports Twilio, Vonage, MessageBird, Sinch, and Plivo."
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "SMS channel enabled",
        desc: "Toggle the entire SMS channel on or off.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.enabled,
          onChange: v => S("enabled", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Select, {
        label: "SMS provider",
        value: cfg.provider,
        onChange: v => S("provider", v),
        options: [{
          value: "twilio",
          label: "Twilio"
        }, {
          value: "vonage",
          label: "Vonage (Nexmo)"
        }, {
          value: "messagebird",
          label: "MessageBird"
        }, {
          value: "sinch",
          label: "Sinch"
        }, {
          value: "plivo",
          label: "Plivo"
        }, {
          value: "telnyx",
          label: "Telnyx"
        }]
      }), cfg.provider === "twilio" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "grid grid-cols-2 gap-4 pt-1",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
          className: "col-span-2",
          children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
            label: "Account SID",
            value: cfg.accountSid,
            onChange: v => S("accountSid", v),
            placeholder: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
            mono: true,
            helper: "Found on the Twilio Console dashboard."
          })
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
          className: "col-span-2",
          children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
            label: "Auth Token",
            value: cfg.authToken,
            onChange: v => S("authToken", v),
            placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
            type: "password",
            helper: "Keep this secret. Never expose it client-side."
          })
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
          className: "col-span-2",
          children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
            label: "Webhook URL \u2014 paste in Twilio Console \u2192 Phone Numbers \u2192 Messaging",
            value: (0,_api_client_js__WEBPACK_IMPORTED_MODULE_3__.webhookUrl)("sms"),
            readOnly: true,
            mono: true,
            helper: "Twilio will POST inbound SMS to this URL."
          })
        })]
      }), cfg.provider === "vonage" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "grid grid-cols-2 gap-4 pt-1",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "API Key",
          value: cfg.vonageKey,
          onChange: v => S("vonageKey", v),
          placeholder: "Vonage API Key"
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "API Secret",
          value: cfg.vonageSecret,
          onChange: v => S("vonageSecret", v),
          placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
          type: "password"
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
          className: "col-span-2",
          children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
            label: "Inbound Webhook URL",
            value: (0,_api_client_js__WEBPACK_IMPORTED_MODULE_3__.webhookUrl)("sms"),
            readOnly: true,
            mono: true
          })
        })]
      }), (cfg.provider === "messagebird" || cfg.provider === "sinch" || cfg.provider === "plivo" || cfg.provider === "telnyx") && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "grid grid-cols-2 gap-4 pt-1",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "API Key / Auth ID",
          value: cfg.genericKey,
          onChange: v => S("genericKey", v),
          placeholder: "API Key"
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "API Secret",
          value: cfg.genericSecret,
          onChange: v => S("genericSecret", v),
          placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
          type: "password"
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
          className: "col-span-2",
          children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
            label: "Webhook URL",
            value: (0,_api_client_js__WEBPACK_IMPORTED_MODULE_3__.webhookUrl)("sms"),
            readOnly: true,
            mono: true
          })
        })]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
        className: "flex gap-3",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("button", {
          style: {
            background: color
          },
          className: "px-5 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity",
          children: "Test connection"
        })
      })]
    }), tab === "numbers" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "space-y-4",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "grid grid-cols-2 gap-4",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
          className: "col-span-2",
          children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
            label: "Default sending number",
            value: cfg.fromNumber,
            onChange: v => S("fromNumber", v),
            placeholder: "+1 555 000 0000",
            helper: "This number is shown as the sender when no agent-specific number is assigned."
          })
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Select, {
          label: "Number type",
          value: cfg.numberType,
          onChange: v => S("numberType", v),
          options: [{
            value: "local",
            label: "Local number (10DLC)"
          }, {
            value: "toll_free",
            label: "Toll-free number"
          }, {
            value: "short",
            label: "Short code"
          }, {
            value: "alpha",
            label: "Alphanumeric sender ID"
          }]
        })]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Allow per-agent phone numbers",
        desc: "Each agent can have a dedicated number for outbound SMS.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.perAgentNumber,
          onChange: v => S("perAgentNumber", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Enable MMS (multimedia messages)",
        desc: "Allow sending and receiving images, audio, and documents.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.mms,
          onChange: v => S("mms", v),
          color: color
        })
      })]
    }), tab === "messaging" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "space-y-4",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "Message Behaviour"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Character count warning",
        desc: "Warn agents when a message exceeds 160 characters (1 SMS credit).",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.charWarn,
          onChange: v => S("charWarn", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Auto-split long messages",
        desc: "Split messages over 160 chars into multiple SMS segments automatically.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.autoSplit,
          onChange: v => S("autoSplit", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Unicode message support",
        desc: "Enable emoji and non-Latin characters (uses 70-char limit per segment).",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.unicode,
          onChange: v => S("unicode", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Delivery receipts",
        desc: "Track delivery status (Sent \u2192 Delivered \u2192 Failed) per message.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.delivery,
          onChange: v => S("delivery", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Retry failed messages",
        desc: "Automatically retry undelivered messages up to 3 times.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.retry,
          onChange: v => S("retry", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "Auto-Reply & Templates"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Send auto-reply on new SMS",
        desc: "Acknowledge the customer immediately when a new SMS conversation starts.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.autoReply,
          onChange: v => S("autoReply", v),
          color: color
        })
      }), cfg.autoReply && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Textarea, {
        label: "Auto-reply message",
        value: cfg.autoReplyMsg,
        onChange: v => S("autoReplyMsg", v),
        rows: 3,
        placeholder: "Hi! We received your message and will reply shortly. Reference: #{{ticket_id}}",
        helper: "Tokens: {{agent_name}}, {{ticket_id}}. Max 160 characters."
      })]
    }), tab === "compliance" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "space-y-4",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.InfoBox, {
        type: "warning",
        children: "TCPA and GDPR require explicit consent before sending marketing SMS. Ensure your opt-in process is compliant."
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "Opt-Out & Consent Management"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Handle STOP / UNSUBSCRIBE keywords automatically",
        desc: "Instantly opt out contacts and prevent future messages when they reply STOP.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.optOut,
          onChange: v => S("optOut", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Handle START / SUBSCRIBE keywords",
        desc: "Re-subscribe contacts who reply START after opting out.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.optIn,
          onChange: v => S("optIn", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Handle HELP keyword",
        desc: "Auto-send support information when a contact replies HELP.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.helpKeyword,
          onChange: v => S("helpKeyword", v),
          color: color
        })
      }), cfg.helpKeyword && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Textarea, {
        label: "HELP reply message",
        value: cfg.helpMsg,
        onChange: v => S("helpMsg", v),
        rows: 2,
        placeholder: "For support, call 1-800-000-0000 or email support@acme.com. Reply STOP to unsubscribe."
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Quiet hours",
        desc: "Block outbound SMS during specified hours to comply with regulations.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.quietHours,
          onChange: v => S("quietHours", v),
          color: color
        })
      }), cfg.quietHours && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "grid grid-cols-2 gap-4",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "Do not disturb from",
          value: cfg.quietFrom,
          onChange: v => S("quietFrom", v),
          placeholder: "21:00"
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "Do not disturb until",
          value: cfg.quietUntil,
          onChange: v => S("quietUntil", v),
          placeholder: "09:00"
        })]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "10DLC Registration (US only)"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.InfoBox, {
        type: "info",
        children: "US carriers require all A2P SMS to be registered under 10DLC. Complete this in your Twilio / provider console and paste the IDs here."
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "grid grid-cols-2 gap-4",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "Brand registration ID (BID)",
          value: cfg.brandId,
          onChange: v => S("brandId", v),
          placeholder: "BxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxX",
          mono: true
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "Campaign ID (CNO)",
          value: cfg.campaignId,
          onChange: v => S("campaignId", v),
          placeholder: "CxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxX",
          mono: true
        })]
      })]
    }), tab === "advanced" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "space-y-4",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "Routing"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Auto-assign incoming SMS",
        desc: "Round-robin assignment to available agents.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.autoAssign,
          onChange: v => S("autoAssign", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Business hours only",
        desc: "Only accept inbound SMS during configured business hours.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.bizHours,
          onChange: v => S("bizHours", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Create new conversation per session",
        desc: "Start a fresh conversation if last session was closed more than 24 hours ago.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.sessionReset,
          onChange: v => S("sessionReset", v),
          color: color
        })
      })]
    })]
  });
}

/***/ },

/***/ "./src/components/settings/telegram.jsx"
/*!**********************************************!*\
  !*** ./src/components/settings/telegram.jsx ***!
  \**********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ TelegramSettings)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _shared_jsx__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./shared.jsx */ "./src/components/settings/shared.jsx");
/* harmony import */ var _tokens_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./tokens.js */ "./src/components/settings/tokens.js");
/* harmony import */ var _api_client_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../api/client.js */ "./src/api/client.js");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react/jsx-runtime */ "react/jsx-runtime");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__);





function TelegramSettings({
  cfg,
  setCfg
}) {
  const [tab, setTab] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)("bot");
  const S = (k, v) => setCfg({
    ...cfg,
    [k]: v
  });
  const color = _tokens_js__WEBPACK_IMPORTED_MODULE_2__.TOKEN.telegram.color;
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
    className: "space-y-5",
    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "flex items-center justify-between",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "flex items-center gap-3",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
          className: `w-10 h-10 rounded-2xl bg-gradient-to-br ${_tokens_js__WEBPACK_IMPORTED_MODULE_2__.TOKEN.telegram.grad} flex items-center justify-center text-white font-black text-lg shadow-lg`,
          children: "T"
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
          children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("h2", {
            className: "text-lg font-bold text-white",
            children: "Telegram Bot"
          }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("p", {
            className: "text-xs text-slate-400",
            children: "Connect a bot via BotFather and embed it on your site"
          })]
        })]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.StatusBadge, {
        connected: cfg.enabled
      })]
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.TabBar, {
      tabs: [{
        id: "bot",
        label: "Bot Setup"
      }, {
        id: "webhook",
        label: "Webhook"
      }, {
        id: "widget",
        label: "Website Widget"
      }, {
        id: "features",
        label: "Features"
      }, {
        id: "advanced",
        label: "Advanced"
      }],
      active: tab,
      onChange: setTab,
      color: color
    }), tab === "bot" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "space-y-4",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.InfoBox, {
        type: "tip",
        children: ["Open Telegram \u2192 search ", /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("strong", {
          children: "@BotFather"
        }), " \u2192 type ", /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("code", {
          className: "font-mono text-sky-300",
          children: "/newbot"
        }), " \u2192 follow the steps \u2192 copy the token below."]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Enable Telegram",
        desc: "Activate or pause the Telegram integration.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.enabled,
          onChange: v => S("enabled", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "grid grid-cols-2 gap-4 pt-1",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
          className: "col-span-2",
          children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
            label: "Bot Token",
            value: cfg.botToken,
            onChange: v => S("botToken", v),
            placeholder: "123456789:ABCDEFxxxxxxxxxxxxxxxxxxxxxxx",
            type: "password",
            mono: true,
            helper: "Keep secret. Anyone with this token can control your bot."
          })
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "Bot username",
          value: cfg.botUsername,
          onChange: v => S("botUsername", v),
          placeholder: "@YourSupportBot",
          helper: "The @handle you chose in BotFather."
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "Bot display name",
          value: cfg.botName,
          onChange: v => S("botName", v),
          placeholder: "Acme Support"
        })]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "BotFather Commands (run these in BotFather)"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.CodeSnippet, {
        lang: "botfather",
        code: `/setdescription\nHelp & support for Acme Inc. Reply any time.\n\n/setabouttext\nPowered by Acme Support\n\n/setuserpic\n[Upload your brand logo]\n\n/setcommands\nstart - Start a conversation\nhelp - Get help\nstatus - Check your ticket status`
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
        className: "flex gap-3",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("button", {
          style: {
            background: color
          },
          className: "px-5 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity",
          children: "Verify bot token"
        })
      })]
    }), tab === "webhook" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "space-y-4",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.InfoBox, {
        type: "info",
        children: "Telegram uses webhooks to push messages to your server. You must register the webhook URL using the Telegram Bot API."
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
        label: "Your webhook URL",
        value: (0,_api_client_js__WEBPACK_IMPORTED_MODULE_3__.webhookUrl)("telegram"),
        readOnly: true,
        mono: true
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "Register Webhook \u2014 Run this command"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.CodeSnippet, {
        lang: "bash",
        code: `curl -X POST \\\n  https://api.telegram.org/bot${cfg.botToken || "<YOUR_BOT_TOKEN>"}/setWebhook \\\n  -d "url=${(0,_api_client_js__WEBPACK_IMPORTED_MODULE_3__.webhookUrl)("telegram")}" \\\n  -d "secret_token=your_secret_here" \\\n  -d "allowed_updates=[message,callback_query]"`
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "Verify Webhook Status"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.CodeSnippet, {
        lang: "bash",
        code: `curl https://api.telegram.org/bot${cfg.botToken || "<YOUR_BOT_TOKEN>"}/getWebhookInfo`
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "Sample Update Object"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.CodeSnippet, {
        lang: "json",
        code: `{\n  "update_id": 123456789,\n  "message": {\n    "message_id": 1,\n    "from": { "id": 987654, "first_name": "Sarah" },\n    "chat": { "id": 987654, "type": "private" },\n    "text": "Hello! I need help."\n  }\n}`
      })]
    }), tab === "widget" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "space-y-4",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.InfoBox, {
        type: "tip",
        children: "Add a Telegram button on your website or app so visitors can open a chat with your bot instantly."
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "grid grid-cols-2 gap-4",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "Pre-filled message (optional)",
          value: cfg.startMessage,
          onChange: v => S("startMessage", v),
          placeholder: "Hello, I need support!",
          helper: "Sent automatically when user clicks the button."
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Select, {
          label: "Button style",
          value: cfg.widgetStyle,
          onChange: v => S("widgetStyle", v),
          options: [{
            value: "floating",
            label: "Floating bubble (bottom-right)"
          }, {
            value: "inline",
            label: "Inline text link"
          }, {
            value: "banner",
            label: "Banner bar"
          }]
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "Button label",
          value: cfg.btnLabel,
          onChange: v => S("btnLabel", v),
          placeholder: "Chat on Telegram"
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Select, {
          label: "Widget position",
          value: cfg.widgetPos,
          onChange: v => S("widgetPos", v),
          options: [{
            value: "bottom-right",
            label: "Bottom right"
          }, {
            value: "bottom-left",
            label: "Bottom left"
          }]
        })]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "Deep Link"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
        label: "Share this link",
        value: `https://t.me/${(cfg.botUsername || "YourBot").replace("@", "")}?start=${encodeURIComponent(cfg.startMessage || "start")}`,
        readOnly: true,
        mono: true
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "Embed Snippet \u2014 Floating Button"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.CodeSnippet, {
        lang: "html",
        code: `<!-- Telegram floating chat button -->\n<style>\n  .tg-btn {\n    position: fixed; bottom: 24px; right: 24px; z-index: 9999;\n    background: #229ED9; color: #fff; border-radius: 50px;\n    padding: 12px 20px; font-family: sans-serif; font-size: 14px;\n    font-weight: 600; text-decoration: none;\n    box-shadow: 0 4px 16px rgba(34,158,217,.4);\n  }\n</style>\n<a class="tg-btn"\n   href="https://t.me/${(cfg.botUsername || "YourBot").replace("@", "")}"\n   target="_blank">\n  💬 ${cfg.btnLabel || "Chat on Telegram"}\n</a>`
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "Login Widget (Authenticate users via Telegram)"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.CodeSnippet, {
        lang: "html",
        code: `<script async src="https://telegram.org/js/telegram-widget.js?22"\n  data-telegram-login="${(cfg.botUsername || "YourBot").replace("@", "")}"\n  data-size="large"\n  data-auth-url="https://yoursite.com/auth/telegram"\n  data-request-access="write">\n</script>`
      })]
    }), tab === "features" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "space-y-1",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Allow group conversations",
        desc: "Handle messages from Telegram groups and supergroups.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.allowGroups,
          onChange: v => S("allowGroups", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Typing indicator",
        desc: "Send a typing action while agent composes a reply.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.typingIndicator,
          onChange: v => S("typingIndicator", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Parse Markdown in replies",
        desc: "Enable bold, italic, inline code, links in agent messages.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.markdown,
          onChange: v => S("markdown", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Auto-reply on /start",
        desc: "Send a welcome message when a user first starts the bot.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.startReply,
          onChange: v => S("startReply", v),
          color: color
        })
      }), cfg.startReply && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
        className: "pt-2 pb-3",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Textarea, {
          label: "Welcome message",
          value: cfg.startMsg,
          onChange: v => S("startMsg", v),
          rows: 3,
          placeholder: "👋 Hi there! Welcome to Acme Support.\n\nHow can we help you today?"
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Inline keyboards",
        desc: "Use button grids in bot replies for structured options.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.inlineKeyboard,
          onChange: v => S("inlineKeyboard", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Allow file uploads",
        desc: "Accept files and documents sent by customers.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.fileUpload,
          onChange: v => S("fileUpload", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Auto-assign new conversations",
        desc: "Distribute to agents using round-robin.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.autoAssign,
          onChange: v => S("autoAssign", v),
          color: color
        })
      })]
    }), tab === "advanced" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "space-y-4",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "Commands"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Textarea, {
        label: "Bot command list (sent to BotFather via /setcommands)",
        value: cfg.commands,
        onChange: v => S("commands", v),
        rows: 6,
        mono: true,
        placeholder: "start - Start a new conversation\nhelp - Get help and FAQs\nstatus - Check your ticket status\ncancel - Cancel current action"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "Rate Limiting"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "grid grid-cols-2 gap-4",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "Max messages per second (global)",
          value: cfg.rateGlobal,
          onChange: v => S("rateGlobal", v),
          placeholder: "30",
          suffix: "msg/s"
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "Max messages per chat per second",
          value: cfg.ratePerChat,
          onChange: v => S("ratePerChat", v),
          placeholder: "1",
          suffix: "msg/s",
          helper: "Telegram enforces this limit."
        })]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "Privacy & Data"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Delete messages after conversation closed",
        desc: "Remove message history from Telegram after resolution.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.deleteClosed,
          onChange: v => S("deleteClosed", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Anonymise customer IDs in logs",
        desc: "Replace Telegram user IDs with internal reference IDs in exported logs.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.anonymise,
          onChange: v => S("anonymise", v),
          color: color
        })
      })]
    })]
  });
}

/***/ },

/***/ "./src/components/settings/tokens.js"
/*!*******************************************!*\
  !*** ./src/components/settings/tokens.js ***!
  \*******************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   TOKEN: () => (/* binding */ TOKEN)
/* harmony export */ });
const TOKEN = {
  messenger: {
    label: "Messenger",
    color: "#0866FF",
    bg: "#0866FF",
    icon: "M",
    grad: "from-blue-600 to-blue-400"
  },
  email: {
    label: "Email Pipe",
    color: "#10B981",
    bg: "#10B981",
    icon: "@",
    grad: "from-emerald-600 to-teal-400"
  },
  whatsapp: {
    label: "WhatsApp",
    color: "#25D366",
    bg: "#25D366",
    icon: "W",
    grad: "from-green-500 to-green-400"
  },
  telegram: {
    label: "Telegram",
    color: "#229ED9",
    bg: "#229ED9",
    icon: "T",
    grad: "from-sky-500 to-cyan-400"
  },
  sms: {
    label: "SMS",
    color: "#F22F46",
    bg: "#F22F46",
    icon: "S",
    grad: "from-red-600 to-pink-500"
  },
  line: {
    label: "LINE",
    color: "#06C755",
    bg: "#06C755",
    icon: "L",
    grad: "from-green-600 to-lime-400"
  },
  viber: {
    label: "Viber",
    color: "#7360F2",
    bg: "#7360F2",
    icon: "V",
    grad: "from-violet-600 to-fuchsia-500"
  },
  wechat: {
    label: "WeChat",
    color: "#07C160",
    bg: "#07C160",
    icon: "Wc",
    grad: "from-emerald-600 to-green-400"
  },
  instagram: {
    label: "Instagram DM",
    color: "#E1306C",
    bg: "#E1306C",
    icon: "IG",
    grad: "from-pink-600 to-orange-400"
  }
};

/***/ },

/***/ "./src/components/settings/whatsapp.jsx"
/*!**********************************************!*\
  !*** ./src/components/settings/whatsapp.jsx ***!
  \**********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ WhatsAppSettings)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _shared_jsx__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./shared.jsx */ "./src/components/settings/shared.jsx");
/* harmony import */ var _tokens_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./tokens.js */ "./src/components/settings/tokens.js");
/* harmony import */ var _api_client_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../api/client.js */ "./src/api/client.js");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react/jsx-runtime */ "react/jsx-runtime");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__);





function WhatsAppSettings({
  cfg,
  setCfg
}) {
  const [tab, setTab] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)("api");
  const S = (k, v) => setCfg({
    ...cfg,
    [k]: v
  });
  const color = _tokens_js__WEBPACK_IMPORTED_MODULE_2__.TOKEN.whatsapp.color;
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
    className: "space-y-5",
    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "flex items-center justify-between",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "flex items-center gap-3",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
          className: `w-10 h-10 rounded-2xl bg-gradient-to-br ${_tokens_js__WEBPACK_IMPORTED_MODULE_2__.TOKEN.whatsapp.grad} flex items-center justify-center text-white font-black text-lg shadow-lg`,
          children: "W"
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
          children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("h2", {
            className: "text-lg font-bold text-white",
            children: "WhatsApp Business"
          }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("p", {
            className: "text-xs text-slate-400",
            children: "Connect your WhatsApp Business API to the inbox"
          })]
        })]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.StatusBadge, {
        connected: cfg.enabled
      })]
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.TabBar, {
      tabs: [{
        id: "api",
        label: "API Setup"
      }, {
        id: "webhook",
        label: "Webhook"
      }, {
        id: "widget",
        label: "Website Button"
      }, {
        id: "messaging",
        label: "Messaging"
      }, {
        id: "compliance",
        label: "Compliance"
      }],
      active: tab,
      onChange: setTab,
      color: color
    }), tab === "api" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "space-y-4",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.InfoBox, {
        type: "info",
        children: ["WhatsApp Business API is managed through Meta. Go to ", /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("strong", {
          children: "developers.facebook.com"
        }), " \u2192 create an app \u2192 add WhatsApp product \u2192 get your credentials."]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Enable WhatsApp",
        desc: "Activate or pause the WhatsApp integration.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.enabled,
          onChange: v => S("enabled", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "grid grid-cols-2 gap-4 pt-1",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
          className: "col-span-2",
          children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
            label: "WhatsApp Business Account ID (WABAID)",
            value: cfg.wabaid,
            onChange: v => S("wabaid", v),
            placeholder: "1234567890",
            mono: true,
            helper: "Found in Meta Business Manager \u2192 WhatsApp \u2192 Business Accounts."
          })
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
          className: "col-span-2",
          children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
            label: "Phone Number ID",
            value: cfg.phoneNumberId,
            onChange: v => S("phoneNumberId", v),
            placeholder: "Phone Number ID from Meta dashboard",
            mono: true
          })
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
          className: "col-span-2",
          children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
            label: "Permanent Access Token",
            value: cfg.accessToken,
            onChange: v => S("accessToken", v),
            placeholder: "EAAxxxxxxxxxxxxxxxxxxxxxxx...",
            type: "password",
            helper: "Generate a system user token from Meta Business Settings for uninterrupted access."
          })
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "Webhook Verify Token",
          value: cfg.verifyToken,
          onChange: v => S("verifyToken", v),
          placeholder: "your_webhook_verify_token",
          helper: "Any secret string you choose."
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "Display phone number",
          value: cfg.displayPhone,
          onChange: v => S("displayPhone", v),
          placeholder: "+1 555 000 0000"
        })]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
        label: "Webhook URL \u2014 paste in Meta App \u2192 WhatsApp \u2192 Configuration",
        value: (0,_api_client_js__WEBPACK_IMPORTED_MODULE_3__.webhookUrl)("whatsapp"),
        readOnly: true,
        mono: true
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
        className: "flex gap-3",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("button", {
          style: {
            background: color
          },
          className: "px-5 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity",
          children: "Test connection"
        })
      })]
    }), tab === "webhook" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "space-y-4",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.InfoBox, {
        type: "tip",
        children: "Subscribe to these webhook fields in Meta \u2192 WhatsApp \u2192 Configuration \u2192 Webhooks."
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
        label: "Callback URL",
        value: (0,_api_client_js__WEBPACK_IMPORTED_MODULE_3__.webhookUrl)("whatsapp"),
        readOnly: true,
        mono: true
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "Required Webhook Fields"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.CodeSnippet, {
        lang: "fields",
        code: "messages\nmessage_template_status_update\naccount_update\nphone_number_quality_update"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "Sample Inbound Message"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.CodeSnippet, {
        lang: "json",
        code: `{\n  "object": "whatsapp_business_account",\n  "entry": [{\n    "id": "${cfg.wabaid || "WABAID"}",\n    "changes": [{\n      "value": {\n        "messaging_product": "whatsapp",\n        "messages": [{ "from": "15551234567", "text": { "body": "Hello!" } }]\n      }\n    }]\n  }]\n}`
      })]
    }), tab === "widget" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "space-y-4",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.InfoBox, {
        type: "tip",
        children: "Add a click-to-chat button on your website so visitors can open WhatsApp with your number pre-filled."
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "grid grid-cols-2 gap-4",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
          className: "col-span-2",
          children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
            label: "Pre-filled message",
            value: cfg.ctaMessage,
            onChange: v => S("ctaMessage", v),
            placeholder: "Hello! I'd like to chat with support.",
            helper: "Optional. Pre-fills the WhatsApp compose box."
          })
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Select, {
          label: "Button style",
          value: cfg.btnStyle,
          onChange: v => S("btnStyle", v),
          options: [{
            value: "floating",
            label: "Floating bubble (bottom-right)"
          }, {
            value: "inline",
            label: "Inline banner"
          }, {
            value: "none",
            label: "None (use snippet only)"
          }]
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "Button label text",
          value: cfg.btnLabel,
          onChange: v => S("btnLabel", v),
          placeholder: "Chat on WhatsApp"
        })]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "Click-to-Chat Link"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
        label: "Share this link",
        value: `https://wa.me/${(cfg.displayPhone || "15551234567").replace(/\D/g, "")}?text=${encodeURIComponent(cfg.ctaMessage || "Hello!")}`,
        readOnly: true,
        mono: true
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "Embed Snippet"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.CodeSnippet, {
        lang: "html",
        code: `<!-- WhatsApp Chat Button -->\n<a href="https://wa.me/${(cfg.displayPhone || "15551234567").replace(/\D/g, "")}\n   ?text=${encodeURIComponent(cfg.ctaMessage || "Hello! I'd like to chat.")}\n   target="_blank" rel="noopener">\n  <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/WhatsApp.svg/479px-WhatsApp.svg.png"\n       alt="Chat on WhatsApp" height="48">\n</a>`
      })]
    }), tab === "messaging" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "space-y-1",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Read receipts",
        desc: "Send read receipts when agent views a message.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.readReceipts,
          onChange: v => S("readReceipts", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Allow media attachments",
        desc: "Images, documents, audio, and video.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.media,
          onChange: v => S("media", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Auto-assign new conversations",
        desc: "Round-robin to online agents.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.autoAssign,
          onChange: v => S("autoAssign", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Business hours only",
        desc: "Reject inbound messages outside working hours.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.bizHours,
          onChange: v => S("bizHours", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Auto-reply on new conversation",
        desc: "Send an immediate acknowledgement to the customer.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.autoReply,
          onChange: v => S("autoReply", v),
          color: color
        })
      }), cfg.autoReply && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
        className: "pt-2 pb-1",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Textarea, {
          label: "Auto-reply message",
          value: cfg.autoReplyMsg,
          onChange: v => S("autoReplyMsg", v),
          rows: 3,
          placeholder: "Hi {{customer_name}}! 👋 We received your message and will reply shortly. Reference: #{{ticket_id}}",
          helper: "Tokens: {{customer_name}}, {{ticket_id}}"
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
        className: "pt-3",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Select, {
          label: "Default message template",
          value: cfg.template,
          onChange: v => S("template", v),
          options: [{
            value: "none",
            label: "No default template"
          }, {
            value: "greeting",
            label: "Greeting"
          }, {
            value: "support_ack",
            label: "Support acknowledgement"
          }, {
            value: "order_update",
            label: "Order update"
          }]
        })
      })]
    }), tab === "compliance" && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "space-y-4",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.InfoBox, {
        type: "warning",
        children: "WhatsApp mandates explicit opt-in before sending marketing or outbound messages. Ensure your consent collection complies with WhatsApp Business Policy."
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "Opt-Out Handling"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Process STOP keyword",
        desc: "Immediately opt out contacts who reply STOP.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.optOut,
          onChange: v => S("optOut", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Row, {
        label: "Process START keyword",
        desc: "Re-subscribe contacts who reply START.",
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Toggle, {
          checked: cfg.optIn,
          onChange: v => S("optIn", v),
          color: color
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.SectionDivider, {
        label: "10DLC / WABA Registration"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.InfoBox, {
        type: "info",
        children: "Complete business verification in Meta Business Manager before sending high-volume messages."
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "grid grid-cols-2 gap-4",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "Business Portfolio ID",
          value: cfg.businessId,
          onChange: v => S("businessId", v),
          placeholder: "Meta Business Portfolio ID",
          mono: true
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_shared_jsx__WEBPACK_IMPORTED_MODULE_1__.Input, {
          label: "WABA Quality Tier",
          value: cfg.qualityTier,
          onChange: v => S("qualityTier", v),
          placeholder: "MEDIUM",
          readOnly: true
        })]
      })]
    })]
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   TELEGRAM SETTINGS
═══════════════════════════════════════════════════════════════════════════ */

/***/ },

/***/ "./src/constants/config.js"
/*!*********************************!*\
  !*** ./src/constants/config.js ***!
  \*********************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   AGENTS: () => (/* binding */ AGENTS),
/* harmony export */   CHANNELS: () => (/* binding */ CHANNELS),
/* harmony export */   DUMMY_CONVERSATIONS: () => (/* binding */ DUMMY_CONVERSATIONS),
/* harmony export */   SAVED_REPLIES: () => (/* binding */ SAVED_REPLIES),
/* harmony export */   STATUS_FILTERS: () => (/* binding */ STATUS_FILTERS),
/* harmony export */   channelMeta: () => (/* binding */ channelMeta),
/* harmony export */   priorityConfig: () => (/* binding */ priorityConfig),
/* harmony export */   statusConfig: () => (/* binding */ statusConfig)
/* harmony export */ });
const CHANNELS = [{
  id: "all",
  label: "All",
  icon: "ti-inbox"
}, {
  id: "email",
  label: "Email",
  icon: "ti-mail",
  color: "#4F46E5"
}, {
  id: "whatsapp",
  label: "WhatsApp",
  icon: "ti-brand-whatsapp",
  color: "#25D366"
}, {
  id: "messenger",
  label: "Messenger",
  icon: "ti-brand-messenger",
  color: "#0084FF"
}, {
  id: "telegram",
  label: "Telegram",
  icon: "ti-brand-telegram",
  color: "#26A5E4"
}, {
  id: "instagram",
  label: "Instagram DM",
  icon: "ti-brand-instagram",
  color: "#E1306C"
}, {
  id: "sms",
  label: "SMS",
  icon: "ti-device-mobile-message",
  color: "#6366F1"
}, {
  id: "viber",
  label: "Viber",
  icon: "letter:Vi",
  color: "#7360F2"
}, {
  id: "wechat",
  label: "WeChat",
  icon: "ti-brand-wechat",
  color: "#07C160"
}, {
  id: "line",
  label: "LINE",
  icon: "ti-brand-line",
  color: "#06C755"
}];
const AGENTS = ["Alice Wang", "Ben Torres", "Clara Kim", "David Patel", "Unassigned"];
const SAVED_REPLIES = [{
  id: 1,
  title: "Greeting",
  body: "Hi! Thanks for reaching out. How can I assist you today?"
}, {
  id: 2,
  title: "Shipping Info",
  body: "Your order typically ships within 2-3 business days. You'll receive a tracking email once dispatched."
}, {
  id: 3,
  title: "Refund Policy",
  body: "We offer a 30-day hassle-free return policy. Please share your order number and we'll get it sorted."
}, {
  id: 4,
  title: "Escalation",
  body: "I'm escalating this to our specialist team. You'll hear back within 24 hours."
}, {
  id: 5,
  title: "Closing",
  body: "Is there anything else I can help you with today? We appreciate your patience!"
}];
const DUMMY_CONVERSATIONS = [{
  id: 1,
  channel: "email",
  name: "Sarah Mitchell",
  avatar: "SM",
  status: "open",
  subject: "Order #8842 not received",
  preview: "Hi, I placed an order 10 days ago and...",
  time: "2m ago",
  unread: 3,
  assignee: "Alice Wang",
  slaDeadline: 15,
  slaUnit: "min",
  priority: "high",
  messages: [{
    id: 1,
    sender: "Sarah Mitchell",
    text: "Hi, I placed an order 10 days ago and still haven't received it. The tracking shows it's stuck.",
    time: "10:02 AM",
    isAgent: false
  }, {
    id: 2,
    sender: "Alice Wang",
    text: "Hi Sarah! I'm so sorry to hear that. Let me pull up your order details right away.",
    time: "10:05 AM",
    isAgent: true
  }, {
    id: 3,
    sender: "Sarah Mitchell",
    text: "The order number is #8842. I really need this by Friday.",
    time: "10:06 AM",
    isAgent: false
  }],
  notes: ["Customer is a VIP. Handle with priority.", "Escalate if unresolved after 1 hour."]
}, {
  id: 2,
  channel: "whatsapp",
  name: "Carlos Rivera",
  avatar: "CR",
  status: "open",
  subject: "Billing issue on last invoice",
  preview: "Hello, I was charged twice for...",
  time: "8m ago",
  unread: 1,
  assignee: "Ben Torres",
  slaDeadline: 45,
  slaUnit: "min",
  priority: "medium",
  messages: [{
    id: 1,
    sender: "Carlos Rivera",
    text: "Hello, I was charged twice for the same subscription this month.",
    time: "9:45 AM",
    isAgent: false
  }, {
    id: 2,
    sender: "Ben Torres",
    text: "Hey Carlos, I can see the duplicate charge. I'll initiate a refund now.",
    time: "9:50 AM",
    isAgent: true
  }],
  notes: ["Duplicate Stripe charge confirmed. Refund initiated."]
}, {
  id: 3,
  channel: "messenger",
  name: "Emma Johnson",
  avatar: "EJ",
  status: "pending",
  subject: "Product compatibility question",
  preview: "Does your software work with...",
  time: "22m ago",
  unread: 0,
  assignee: "Unassigned",
  slaDeadline: 2,
  slaUnit: "hr",
  priority: "low",
  messages: [{
    id: 1,
    sender: "Emma Johnson",
    text: "Does your software work with macOS Ventura?",
    time: "9:30 AM",
    isAgent: false
  }],
  notes: []
}, {
  id: 4,
  channel: "telegram",
  name: "Liam Chen",
  avatar: "LC",
  status: "resolved",
  subject: "Reset 2FA setup",
  preview: "I lost access to my authenticator app...",
  time: "1h ago",
  unread: 0,
  assignee: "Clara Kim",
  slaDeadline: 0,
  slaUnit: "hr",
  priority: "medium",
  messages: [{
    id: 1,
    sender: "Liam Chen",
    text: "I lost access to my authenticator app and can't log in.",
    time: "8:15 AM",
    isAgent: false
  }, {
    id: 2,
    sender: "Clara Kim",
    text: "No worries! I'll send you a secure reset link to your email now.",
    time: "8:20 AM",
    isAgent: true
  }, {
    id: 3,
    sender: "Liam Chen",
    text: "Got it, thank you so much!",
    time: "8:25 AM",
    isAgent: false
  }],
  notes: ["2FA reset completed successfully."]
}, {
  id: 5,
  channel: "instagram",
  name: "Priya Sharma",
  avatar: "PS",
  status: "open",
  subject: "Collab inquiry",
  preview: "Hi! I'm an influencer with 200k followers...",
  time: "3h ago",
  unread: 2,
  assignee: "David Patel",
  slaDeadline: 4,
  slaUnit: "hr",
  priority: "low",
  messages: [{
    id: 1,
    sender: "Priya Sharma",
    text: "Hi! I'm an influencer with 200k followers and would love to collab with your brand!",
    time: "7:00 AM",
    isAgent: false
  }],
  notes: ["Partnerships team to review."]
}, {
  id: 6,
  channel: "livechat",
  name: "James O'Brien",
  avatar: "JO",
  status: "open",
  subject: "Page not loading",
  preview: "Your checkout page keeps throwing a 500...",
  time: "4m ago",
  unread: 5,
  assignee: "Alice Wang",
  slaDeadline: 5,
  slaUnit: "min",
  priority: "high",
  messages: [{
    id: 1,
    sender: "James O'Brien",
    text: "Your checkout page keeps throwing a 500 error. I can't complete my purchase!",
    time: "10:08 AM",
    isAgent: false
  }, {
    id: 2,
    sender: "Alice Wang",
    text: "I'm so sorry James! Our engineering team is aware and working on a fix right now.",
    time: "10:09 AM",
    isAgent: true
  }, {
    id: 3,
    sender: "James O'Brien",
    text: "How long will it take? I need this urgently.",
    time: "10:10 AM",
    isAgent: false
  }],
  notes: ["Incident #4421 opened. ETA 15 mins."]
}, {
  id: 7,
  channel: "sms",
  name: "Fatima Al-Hassan",
  avatar: "FA",
  status: "pending",
  subject: "Appointment reminder query",
  preview: "Did you send me an appointment reminder...",
  time: "30m ago",
  unread: 1,
  assignee: "Unassigned",
  slaDeadline: 3,
  slaUnit: "hr",
  priority: "low",
  messages: [{
    id: 1,
    sender: "Fatima Al-Hassan",
    text: "Did you send me an appointment reminder? I think it was meant for someone else.",
    time: "9:40 AM",
    isAgent: false
  }],
  notes: []
}, {
  id: 8,
  channel: "email",
  name: "Tom Nguyen",
  avatar: "TN",
  status: "resolved",
  subject: "Feature request: dark mode",
  preview: "I'd love to see a dark mode option...",
  time: "5h ago",
  unread: 0,
  assignee: "David Patel",
  slaDeadline: 0,
  slaUnit: "hr",
  priority: "low",
  messages: [{
    id: 1,
    sender: "Tom Nguyen",
    text: "I'd love to see a dark mode option in your dashboard!",
    time: "5:00 AM",
    isAgent: false
  }, {
    id: 2,
    sender: "David Patel",
    text: "Thanks for the suggestion, Tom! I've logged it with our product team.",
    time: "6:00 AM",
    isAgent: true
  }],
  notes: ["Feature request logged in Jira as FEAT-992."]
}];
const channelMeta = id => CHANNELS.find(channel => channel.id === id) || CHANNELS[0];
const priorityConfig = {
  high: {
    label: "High",
    bg: "bg-red-100 text-red-700",
    dot: "bg-red-500"
  },
  medium: {
    label: "Medium",
    bg: "bg-amber-100 text-amber-700",
    dot: "bg-amber-500"
  },
  low: {
    label: "Low",
    bg: "bg-green-100 text-green-700",
    dot: "bg-green-500"
  }
};
const statusConfig = {
  open: {
    label: "Open",
    cls: "bg-blue-100 text-blue-700"
  },
  pending: {
    label: "Pending",
    cls: "bg-amber-100 text-amber-700"
  },
  resolved: {
    label: "Resolved",
    cls: "bg-green-100 text-green-700"
  }
};
const STATUS_FILTERS = ["all", "open", "pending", "resolved"];

/***/ },

/***/ "./node_modules/@tabler/icons-webfont/dist/tabler-icons.min.css"
/*!**********************************************************************!*\
  !*** ./node_modules/@tabler/icons-webfont/dist/tabler-icons.min.css ***!
  \**********************************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
// extracted by mini-css-extract-plugin


/***/ },

/***/ "./src/index.css"
/*!***********************!*\
  !*** ./src/index.css ***!
  \***********************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
// extracted by mini-css-extract-plugin


/***/ },

/***/ "react"
/*!************************!*\
  !*** external "React" ***!
  \************************/
(module) {

module.exports = window["React"];

/***/ },

/***/ "react/jsx-runtime"
/*!**********************************!*\
  !*** external "ReactJSXRuntime" ***!
  \**********************************/
(module) {

module.exports = window["ReactJSXRuntime"];

/***/ },

/***/ "@wordpress/element"
/*!*********************************!*\
  !*** external ["wp","element"] ***!
  \*********************************/
(module) {

module.exports = window["wp"]["element"];

/***/ }

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		if (!(moduleId in __webpack_modules__)) {
/******/ 			delete __webpack_module_cache__[moduleId];
/******/ 			var e = new Error("Cannot find module '" + moduleId + "'");
/******/ 			e.code = 'MODULE_NOT_FOUND';
/******/ 			throw e;
/******/ 		}
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
/*!**********************!*\
  !*** ./src/index.js ***!
  \**********************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_wordpress_element__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _tabler_icons_webfont_dist_tabler_icons_min_css__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @tabler/icons-webfont/dist/tabler-icons.min.css */ "./node_modules/@tabler/icons-webfont/dist/tabler-icons.min.css");
/* harmony import */ var _index_css__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./index.css */ "./src/index.css");
/* harmony import */ var _App_jsx__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./App.jsx */ "./src/App.jsx");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react/jsx-runtime */ "react/jsx-runtime");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__);





(0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.render)(/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.StrictMode, {
  children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_App_jsx__WEBPACK_IMPORTED_MODULE_3__["default"], {})
}), document.getElementById("synchronized-messaging-engine"));
})();

/******/ })()
;
//# sourceMappingURL=index.js.map