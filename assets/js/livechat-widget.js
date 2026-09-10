(function () {
  "use strict";

  var boot = window.KinetixLivechat;
  if (!boot || !boot.apiKey) {
    return;
  }

  var i18n = boot.i18n || {};
  var storageKeyRoom = "kmbp_livechat_room";
  var storageKeyName = "kmbp_livechat_name";
  var storageKeyOpen = "kmbp_livechat_open";

  var state = {
    open: false,
    ws: null,
    reconnectTimer: null,
    reconnectMs: 1200,
    messages: [],
    seen: {},
    pendingOut: {},
    connected: false,
    hadConnect: false,
  };

  function uid() {
    if (window.crypto && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  function getRoomId() {
    try {
      var existing = localStorage.getItem(storageKeyRoom);
      if (existing && /^[A-Za-z0-9][A-Za-z0-9_-]{7,79}$/.test(existing)) {
        return existing;
      }
    } catch (e) {
      /* ignore */
    }
    var raw =
      (window.crypto && crypto.randomUUID && crypto.randomUUID()) ||
      Date.now().toString(36) + Math.random().toString(36).slice(2);
    var id = ("kmbp-" + String(raw).replace(/[^A-Za-z0-9-]/g, "")).slice(0, 80);
    try {
      localStorage.setItem(storageKeyRoom, id);
    } catch (e2) {
      /* ignore */
    }
    return id;
  }

  function getVisitorName() {
    if (boot.visitorName) {
      return boot.visitorName;
    }
    try {
      return localStorage.getItem(storageKeyName) || "";
    } catch (e) {
      return "";
    }
  }

  function setVisitorName(name) {
    try {
      localStorage.setItem(storageKeyName, name);
    } catch (e) {
      /* ignore */
    }
  }

  function displayName() {
    return getVisitorName() || i18n.visitorFallback || "there";
  }

  function interpolate(template, name) {
    return String(template || "").replace(/\{\{\s*name\s*\}\}/gi, name);
  }

  function initials(text) {
    var parts = String(text || "S")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);
    if (!parts.length) {
      return "S";
    }
    return parts
      .map(function (p) {
        return p.charAt(0).toUpperCase();
      })
      .join("");
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatTime(value) {
    if (!value) {
      return i18n.justNow || "Just now";
    }
    var d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) {
      return i18n.justNow || "Just now";
    }
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function isAgentMsg(msg) {
    var t = (msg.sender_type || msg.senderType || "").toLowerCase();
    return t === "agent" || t === "system";
  }

  function msgContent(msg) {
    return msg.content || msg.text || msg.body || "";
  }

  function msgId(msg) {
    return String(msg.id || msg.message_id || msg.uuid || msgContent(msg) + "|" + (msg.sender_name || "") + "|" + (msg.created_at || ""));
  }

  var roomId = getRoomId();
  var root = document.createElement("div");
  root.id = "kmbp-livechat";
  root.style.setProperty("--kmbp-lc-accent", boot.themeColor || "#7C3AED");
  if (boot.position === "bottom-left") {
    root.classList.add("kmbp-lc-left");
  }

  var brand = boot.brandName || "Support";
  var tagline = boot.tagline || i18n.defaultTagline || "";
  var welcomeTpl = boot.welcomeMessage || i18n.defaultWelcome || "Hi {{name}}, welcome! 👋";
  var onlineText = boot.onlineText || i18n.defaultOnline || "A few minutes";
  var ice = Array.isArray(boot.iceBreakers) ? boot.iceBreakers.filter(Boolean) : [];
  var letters = initials(brand);
  var avatarColors = ["#7c3aed", "#ec4899", "#f59e0b"];

  root.innerHTML =
    '<div class="kmbp-lc-window" role="dialog" aria-label="' +
    escapeHtml(brand) +
    ' live chat">' +
    '<div class="kmbp-lc-header">' +
    '<div class="kmbp-lc-brand">' +
    '<div class="kmbp-lc-brand-row">' +
    '<span class="kmbp-lc-dot" aria-hidden="true"></span>' +
    '<span class="kmbp-lc-name"></span>' +
    "</div>" +
    '<p class="kmbp-lc-tagline"></p>' +
    "</div>" +
    '<div class="kmbp-lc-meta">' +
    '<div class="kmbp-lc-avatars" aria-hidden="true"></div>' +
    '<div class="kmbp-lc-online"></div>' +
    '<button type="button" class="kmbp-lc-close" aria-label="' +
    escapeHtml(i18n.closeChat || "Close live chat") +
    '">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
    "</button>" +
    "</div>" +
    "</div>" +
    '<div class="kmbp-lc-status" hidden></div>' +
    '<div class="kmbp-lc-body">' +
    '<div class="kmbp-lc-landing">' +
    '<div class="kmbp-lc-day"></div>' +
    '<p class="kmbp-lc-welcome"></p>' +
    '<p class="kmbp-lc-prompt"></p>' +
    (boot.askName
      ? '<div class="kmbp-lc-name-field"><input type="text" maxlength="80" autocomplete="name" /></div>'
      : "") +
    '<div class="kmbp-lc-ice"></div>' +
    "</div>" +
    '<div class="kmbp-lc-msgs" hidden></div>' +
    "</div>" +
    '<form class="kmbp-lc-composer" autocomplete="off">' +
    '<div class="kmbp-lc-composer-inner">' +
    '<input type="text" maxlength="4000" />' +
    '<button type="submit" class="kmbp-lc-send" aria-label="' +
    escapeHtml(i18n.send || "Send") +
    '">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 12 14-7-7 14-2-5-5-2z"/></svg>' +
    "</button>" +
    "</div>" +
    "</form>" +
    "</div>" +
    '<button type="button" class="kmbp-lc-launcher" aria-label="' +
    escapeHtml(i18n.openChat || "Open live chat") +
    '">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 12a8.5 8.5 0 0 1-8.5 8.5H8l-5 3V12A8.5 8.5 0 1 1 21 12z"/></svg>' +
    "</button>";

  document.body.appendChild(root);

  root.querySelector(".kmbp-lc-name").textContent = brand;
  root.querySelector(".kmbp-lc-tagline").textContent = tagline;
  root.querySelector(".kmbp-lc-online").textContent = onlineText;
  root.querySelector(".kmbp-lc-day").textContent = i18n.today || "Today";
  root.querySelector(".kmbp-lc-prompt").textContent = i18n.chooseStarter || "Please choose a starting sentence.";
  root.querySelector(".kmbp-lc-composer-inner input").placeholder = i18n.sendPlaceholder || "Send a message…";

  var avatarsEl = root.querySelector(".kmbp-lc-avatars");
  for (var a = 0; a < 3; a++) {
    var av = document.createElement("span");
    av.className = "kmbp-lc-avatar";
    av.style.background = avatarColors[a];
    av.textContent = letters.charAt(a % letters.length) || "S";
    avatarsEl.appendChild(av);
  }

  var iceEl = root.querySelector(".kmbp-lc-ice");
  ice.forEach(function (label) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "kmbp-lc-ice-btn";
    btn.innerHTML =
      "<span></span><svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'><path d='m9 6 6 6-6 6'/></svg>";
    btn.querySelector("span").textContent = label;
    btn.addEventListener("click", function () {
      sendText(label);
    });
    iceEl.appendChild(btn);
  });
  if (!ice.length) {
    root.querySelector(".kmbp-lc-prompt").hidden = true;
  }

  var nameInput = root.querySelector(".kmbp-lc-name-field input");
  if (nameInput) {
    nameInput.placeholder = i18n.namePlaceholder || "Your name";
    nameInput.value = getVisitorName();
    nameInput.addEventListener("change", function () {
      setVisitorName(nameInput.value.trim());
      refreshWelcome();
    });
  }

  var landing = root.querySelector(".kmbp-lc-landing");
  var msgsEl = root.querySelector(".kmbp-lc-msgs");
  var statusEl = root.querySelector(".kmbp-lc-status");
  var composeInput = root.querySelector(".kmbp-lc-composer-inner input");
  var welcomeEl = root.querySelector(".kmbp-lc-welcome");

  function refreshWelcome() {
    welcomeEl.textContent = interpolate(welcomeTpl, displayName());
  }
  refreshWelcome();

  function setOpen(open) {
    state.open = open;
    root.classList.toggle("kmbp-lc-open", open);
    try {
      localStorage.setItem(storageKeyOpen, open ? "1" : "0");
    } catch (e) {
      /* ignore */
    }
    if (open) {
      connect();
      composeInput.focus();
    }
  }

  function showStatus(text) {
    if (!text) {
      statusEl.hidden = true;
      statusEl.textContent = "";
      return;
    }
    statusEl.hidden = false;
    statusEl.textContent = text;
  }

  function showChatView() {
    landing.hidden = true;
    msgsEl.hidden = false;
  }

  function appendMessage(msg, opts) {
    opts = opts || {};
    var id = msgId(msg);
    if (id && state.seen[id] && !opts.force) {
      return;
    }
    if (id) {
      state.seen[id] = true;
    }
    state.messages.push(msg);
    showChatView();

    var row = document.createElement("div");
    row.className = "kmbp-lc-row " + (isAgentMsg(msg) ? "is-agent" : "is-visitor");
    var bubble = document.createElement("div");
    bubble.className = "kmbp-lc-bubble";
    bubble.textContent = msgContent(msg);
    var time = document.createElement("div");
    time.className = "kmbp-lc-time";
    time.textContent = formatTime(msg.created_at || msg.sent_at || msg.time || new Date());
    row.appendChild(bubble);
    row.appendChild(time);
    msgsEl.appendChild(row);
    msgsEl.parentElement.scrollTop = msgsEl.parentElement.scrollHeight;
  }

  function ingestIncoming(incoming) {
    var content = msgContent(incoming);
    if (!isAgentMsg(incoming) && content && state.pendingOut[content] && Date.now() - state.pendingOut[content] < 30000) {
      delete state.pendingOut[content];
      return;
    }
    appendMessage(incoming);
  }

  function loadHistory(list) {
    if (!Array.isArray(list) || !list.length) {
      return;
    }
    msgsEl.innerHTML = "";
    state.messages = [];
    state.seen = {};
    list.forEach(function (msg) {
      appendMessage(msg);
    });
  }

  function mirrorToInbox(text, messageId) {
    if (!boot.restUrl || !boot.widgetToken) {
      return;
    }
    fetch(boot.restUrl + "livechat/inbound", {
      method: "POST",
      credentials: "same-origin",
      headers: (function () {
        var headers = {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-KMBP-Widget-Token": boot.widgetToken,
        };
        if (boot.nonce) {
          headers["X-WP-Nonce"] = boot.nonce;
        }
        return headers;
      })(),
      body: JSON.stringify({
        roomId: roomId,
        text: text,
        senderName: getVisitorName() || "Website Visitor",
        messageId: messageId,
      }),
    }).catch(function () {
      /* inbox mirror is best-effort; the WebSocket is the live path */
    });
  }

  function sendText(text) {
    text = String(text || "").trim();
    if (!text) {
      return;
    }
    if (nameInput && nameInput.value.trim()) {
      setVisitorName(nameInput.value.trim());
    }
    var local = {
      id: uid(),
      content: text,
      sender_name: getVisitorName() || displayName(),
      sender_type: "visitor",
      created_at: new Date().toISOString(),
    };
    appendMessage(local);
    state.pendingOut[text] = Date.now();
    if (state.ws && state.ws.readyState === 1) {
      state.ws.send(
        JSON.stringify({
          content: text,
          sender_name: local.sender_name,
          sender_type: "visitor",
        })
      );
    }
    mirrorToInbox(text, local.id);
    composeInput.value = "";
  }

  function connect() {
    if (state.ws && (state.ws.readyState === 0 || state.ws.readyState === 1)) {
      return;
    }
    var url = String(boot.wsUrl || "").replace(/\/$/, "") + "/" + encodeURIComponent(roomId) + "/?api_key=" + encodeURIComponent(boot.apiKey);
    var ws;
    try {
      ws = new WebSocket(url);
    } catch (e) {
      showStatus(i18n.offline || "Reconnecting…");
      scheduleReconnect();
      return;
    }
    state.ws = ws;

    ws.onopen = function () {
      state.connected = true;
      state.hadConnect = true;
      state.reconnectMs = 1200;
      showStatus("");
    };

    ws.onmessage = function (event) {
      var data;
      try {
        data = JSON.parse(event.data);
      } catch (e) {
        return;
      }
      if (data.type === "history" && Array.isArray(data.messages)) {
        loadHistory(data.messages);
        return;
      }
      if (data.type === "message" && data.message) {
        ingestIncoming(data.message);
        return;
      }
      if (data.content && !data.type) {
        ingestIncoming(data);
        return;
      }
      if (data.type === "error") {
        showStatus(data.message || "Chat error");
      }
    };

    ws.onclose = function () {
      state.connected = false;
      if (state.open) {
        if (state.hadConnect) {
          showStatus(i18n.offline || "Reconnecting…");
        }
        scheduleReconnect();
      }
    };

    ws.onerror = function () {
      /* onclose handles retry */
    };
  }

  function scheduleReconnect() {
    if (state.reconnectTimer) {
      return;
    }
    state.reconnectTimer = setTimeout(function () {
      state.reconnectTimer = null;
      if (state.open) {
        connect();
      }
    }, state.reconnectMs);
    state.reconnectMs = Math.min(state.reconnectMs * 1.6, 15000);
  }

  root.querySelector(".kmbp-lc-launcher").addEventListener("click", function () {
    setOpen(true);
  });
  root.querySelector(".kmbp-lc-close").addEventListener("click", function () {
    setOpen(false);
  });
  root.querySelector(".kmbp-lc-composer").addEventListener("submit", function (e) {
    e.preventDefault();
    sendText(composeInput.value);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && state.open) {
      setOpen(false);
    }
  });

  try {
    if (localStorage.getItem(storageKeyOpen) === "1") {
      setOpen(true);
    }
  } catch (e) {
    /* ignore */
  }
})();
