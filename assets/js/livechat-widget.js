(function () {
  "use strict";

  var boot = window.KinetixLivechat;
  if (!boot || !boot.apiKey) {
    return;
  }

  var i18n = boot.i18n || {};
  var storageKeyRoom = "kmbp_livechat_room_v2";
  var storageKeyRoomEmail = "kmbp_livechat_room_email";
  var storageKeyName = "kmbp_livechat_name";
  var storageKeyEmail = "kmbp_livechat_email";
  var storageKeyOpen = "kmbp_livechat_open";
  var identityLocked = !!(boot.identityLocked && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(boot.visitorEmail || "").trim()));

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
    outbox: [],
    identifiedEmail: "",
    identifyWaiters: [],
    identifying: false,
  };

  function uid() {
    if (window.crypto && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  function isIdentityRoom(id) {
    return /^(kmbp-user-\d+|kmbp-e-[a-f0-9]{28})$/.test(String(id || ""));
  }

  function widgetHeaders() {
    var headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-KMBP-Widget-Token": boot.widgetToken,
    };
    if (boot.nonce) {
      headers["X-WP-Nonce"] = boot.nonce;
    }
    return headers;
  }

  function persistGuestRoom(id, email) {
    if (identityLocked) {
      return;
    }
    try {
      localStorage.setItem(storageKeyRoom, id);
      localStorage.setItem(storageKeyRoomEmail, String(email || "").toLowerCase());
    } catch (e) {
      /* ignore */
    }
  }

  function initialRoomId() {
    if (boot.roomId && isIdentityRoom(boot.roomId)) {
      return boot.roomId;
    }
    if (identityLocked) {
      return "";
    }
    try {
      var stored = localStorage.getItem(storageKeyRoom);
      var storedEmail = (localStorage.getItem(storageKeyRoomEmail) || "").toLowerCase();
      var email = (getVisitorEmail() || "").toLowerCase();
      if (isIdentityRoom(stored) && storedEmail && storedEmail === email) {
        return stored;
      }
    } catch (e) {
      /* ignore */
    }
    return "";
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

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
  }

  function getVisitorEmail() {
    if (boot.visitorEmail && isValidEmail(boot.visitorEmail)) {
      return String(boot.visitorEmail).trim();
    }
    try {
      return localStorage.getItem(storageKeyEmail) || "";
    } catch (e) {
      return "";
    }
  }

  function setVisitorEmail(email) {
    try {
      localStorage.setItem(storageKeyEmail, String(email || "").trim());
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
    return String(msg.content || msg.text || msg.body || "").trim();
  }

  function msgId(msg) {
    return String(msg.id || msg.message_id || msg.uuid || msgContent(msg) + "|" + (msg.sender_name || "") + "|" + (msg.created_at || ""));
  }

  var roomId = initialRoomId();
  if (roomId && boot.visitorEmail) {
    state.identifiedEmail = String(boot.visitorEmail).trim().toLowerCase();
  } else if (roomId) {
    try {
      state.identifiedEmail = (localStorage.getItem(storageKeyRoomEmail) || "").toLowerCase();
    } catch (e) {
      state.identifiedEmail = "";
    }
  }
  var root = document.createElement("div");
  root.id = "kmbp-livechat";
  root.style.setProperty("--kmbp-lc-accent", boot.themeColor || "#7C3AED");
  if (boot.position === "bottom-left") {
    root.classList.add("kmbp-lc-left");
  }

  var brand = boot.brandName || "Support";
  var tagline = boot.tagline || i18n.defaultTagline || "";
  var welcomeTpl = boot.welcomeMessage || i18n.defaultWelcome || "Hi {{name}}, welcome! 👋";
  var ice = Array.isArray(boot.iceBreakers) ? boot.iceBreakers.filter(Boolean) : [];

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
    '<button type="button" class="kmbp-lc-close" aria-label="' +
    escapeHtml(i18n.closeChat || "Close live chat") +
    '">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
    "</button>" +
    "</div>" +
    '<div class="kmbp-lc-status" hidden></div>' +
    '<div class="kmbp-lc-body">' +
    '<div class="kmbp-lc-landing">' +
    '<div class="kmbp-lc-day"></div>' +
    '<p class="kmbp-lc-welcome"></p>' +
    '<p class="kmbp-lc-prompt"></p>' +
    '<div class="kmbp-lc-fields">' +
    (boot.askName || boot.visitorName
      ? '<div class="kmbp-lc-field"><input type="text" class="kmbp-lc-name-input" maxlength="80" autocomplete="name" /></div>'
      : "") +
    '<div class="kmbp-lc-field"><input type="email" class="kmbp-lc-email-input" maxlength="190" autocomplete="email" required /></div>' +
    "</div>" +
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
  if (identityLocked) {
    root.classList.add("kmbp-lc-known-identity");
  }

  root.querySelector(".kmbp-lc-name").textContent = brand;
  root.querySelector(".kmbp-lc-tagline").textContent = tagline;
  root.querySelector(".kmbp-lc-day").textContent = i18n.today || "Today";
  root.querySelector(".kmbp-lc-prompt").textContent = i18n.chooseStarter || "Please choose a starting sentence.";
  root.querySelector(".kmbp-lc-composer-inner input").placeholder = i18n.sendPlaceholder || "Send a message…";

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

  var nameInput = root.querySelector(".kmbp-lc-name-input");
  if (nameInput) {
    nameInput.placeholder = i18n.namePlaceholder || "Your name";
    nameInput.value = getVisitorName();
    if (boot.visitorName) {
      nameInput.readOnly = true;
    }
    if (!identityLocked) {
      nameInput.addEventListener("input", function () {
        setVisitorName(nameInput.value.trim());
        refreshWelcome();
      });
    }
  }

  var emailInput = root.querySelector(".kmbp-lc-email-input");
  emailInput.placeholder = i18n.emailPlaceholder || "Your email";
  emailInput.value = getVisitorEmail();
  if (identityLocked) {
    emailInput.readOnly = true;
  } else {
    emailInput.addEventListener("input", function () {
      emailInput.classList.remove("kmbp-lc-invalid");
      if (isValidEmail(emailInput.value)) {
        setVisitorEmail(emailInput.value.trim());
        showStatus("");
        syncChatLock();
        ensureIdentity(function (ok) {
          if (ok && state.open) {
            connect();
          }
        });
      } else {
        syncChatLock();
      }
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

  function currentEmail() {
    if (identityLocked) {
      return String(boot.visitorEmail || "").trim();
    }
    return emailInput ? String(emailInput.value || "").trim() : getVisitorEmail();
  }

  function hasValidEmail() {
    return isValidEmail(currentEmail());
  }

  function syncChatLock() {
    var locked = !hasValidEmail();
    root.classList.toggle("kmbp-lc-locked", locked);
    composeInput.disabled = locked;
    root.querySelector(".kmbp-lc-send").disabled = locked;
  }

  function requireEmail() {
    if (hasValidEmail()) {
      setVisitorEmail(currentEmail());
      emailInput.classList.remove("kmbp-lc-invalid");
      showStatus("");
      return true;
    }
    showStatus(i18n.emailRequired || "Enter your email to start chatting.");
    emailInput.classList.add("kmbp-lc-invalid");
    emailInput.focus();
    return false;
  }

  function setOpen(open) {
    state.open = open;
    root.classList.toggle("kmbp-lc-open", open);
    try {
      localStorage.setItem(storageKeyOpen, open ? "1" : "0");
    } catch (e) {
      /* ignore */
    }
    if (open) {
      if (hasValidEmail()) {
        ensureIdentity(function (ok) {
          if (ok) {
            connect();
          }
        });
        composeInput.focus();
      } else if (emailInput && !emailInput.readOnly) {
        emailInput.focus();
      } else {
        composeInput.focus();
      }
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
    if (!content) {
      return;
    }
    // Echo of a message we already drew locally — keep the bubble, just
    // remember the server id so a later history dump cannot drop or duplicate it.
    if (!isAgentMsg(incoming) && state.pendingOut[content] && Date.now() - state.pendingOut[content] < 30000) {
      delete state.pendingOut[content];
      var echoedId = msgId(incoming);
      if (echoedId) {
        state.seen[echoedId] = true;
      }
      return;
    }
    appendMessage(incoming);
  }

  function loadHistory(list) {
    if (!Array.isArray(list) || !list.length) {
      return;
    }
    // Merge only. Replacing the DOM here is what made visitor messages vanish:
    // the server often re-sends history on connect (and when an agent joins the
    // room) *before* the newest visitor line is included.
    list.forEach(function (msg) {
      ingestIncoming(msg);
    });
  }

  function disconnect() {
    if (state.reconnectTimer) {
      clearTimeout(state.reconnectTimer);
      state.reconnectTimer = null;
    }
    if (state.ws) {
      state.ws.onclose = null;
      state.ws.onerror = null;
      state.ws.onmessage = null;
      try {
        state.ws.close();
      } catch (e) {
        /* ignore */
      }
      state.ws = null;
    }
    state.connected = false;
  }

  function resetTranscript() {
    state.messages = [];
    state.seen = {};
    state.pendingOut = {};
    state.outbox = [];
    msgsEl.innerHTML = "";
    msgsEl.hidden = true;
    landing.hidden = false;
  }

  function applyIdentifiedRoom(nextId, email) {
    if (!isIdentityRoom(nextId)) {
      return false;
    }
    var nextEmail = String(email || "").trim().toLowerCase();
    var changed = nextId !== roomId;
    if (changed) {
      disconnect();
      if (roomId) {
        resetTranscript();
      }
      roomId = nextId;
    }
    state.identifiedEmail = nextEmail;
    persistGuestRoom(nextId, nextEmail);
    return true;
  }

  function flushIdentifyWaiters(ok) {
    var waiters = state.identifyWaiters.slice();
    state.identifyWaiters = [];
    waiters.forEach(function (fn) {
      fn(ok);
    });
  }

  function ensureIdentity(cb) {
    cb = cb || function () {};
    var email = currentEmail();
    if (!isValidEmail(email)) {
      cb(false);
      return;
    }

    if (identityLocked && boot.roomId) {
      applyIdentifiedRoom(boot.roomId, boot.visitorEmail);
      cb(!!roomId);
      return;
    }

    if (roomId && state.identifiedEmail === email.toLowerCase()) {
      cb(true);
      return;
    }

    state.identifyWaiters.push(cb);
    if (state.identifying) {
      return;
    }
    state.identifying = true;
    fetch(boot.restUrl + "livechat/identify", {
      method: "POST",
      credentials: "same-origin",
      headers: widgetHeaders(),
      body: JSON.stringify({
        email: email,
        senderName: getVisitorName() || displayName(),
      }),
    })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        state.identifying = false;
        if (data && data.roomId && applyIdentifiedRoom(data.roomId, data.email || email)) {
          if (data.name && nameInput && !boot.visitorName) {
            nameInput.value = data.name;
          }
          flushIdentifyWaiters(true);
          return;
        }
        flushIdentifyWaiters(false);
      })
      .catch(function () {
        state.identifying = false;
        flushIdentifyWaiters(false);
      });
  }

  function mirrorToInbox(text, messageId) {
    if (!boot.restUrl || !boot.widgetToken) {
      return;
    }
    fetch(boot.restUrl + "livechat/inbound", {
      method: "POST",
      credentials: "same-origin",
      headers: widgetHeaders(),
      body: JSON.stringify({
        roomId: roomId,
        text: text,
        senderName: getVisitorName() || currentEmail() || "Website Visitor",
        email: currentEmail(),
        messageId: messageId,
      }),
    })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (data && data.roomId && data.roomId !== roomId) {
          applyIdentifiedRoom(data.roomId, currentEmail());
          connect(true);
        }
      })
      .catch(function () {
        /* inbox mirror is best-effort; the WebSocket is the live path */
      });
  }

  function sendText(text) {
    text = String(text || "").trim();
    if (!text) {
      return;
    }
    if (!requireEmail()) {
      return;
    }
    if (nameInput && nameInput.value.trim() && !boot.visitorName) {
      setVisitorName(nameInput.value.trim());
    }
    ensureIdentity(function (ok) {
      if (!ok || !roomId) {
        showStatus(i18n.emailRequired || "Enter your email to start chatting.");
        return;
      }
      connect();
      var local = {
        id: uid(),
        content: text,
        sender_name: getVisitorName() || displayName(),
        sender_type: "visitor",
        created_at: new Date().toISOString(),
      };
      appendMessage(local);
      state.pendingOut[text] = Date.now();
      enqueueWs({
        content: text,
        sender_name: local.sender_name,
        sender_type: "visitor",
      });
      mirrorToInbox(text, local.id);
      composeInput.value = "";
    });
  }

  function enqueueWs(payload) {
    var json = JSON.stringify(payload);
    if (state.ws && state.ws.readyState === 1) {
      state.ws.send(json);
      return;
    }
    state.outbox.push(json);
  }

  function connect(force) {
    if (!roomId) {
      return;
    }
    if (!force && state.ws && (state.ws.readyState === 0 || state.ws.readyState === 1)) {
      return;
    }
    if (force) {
      disconnect();
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
      while (state.outbox.length) {
        ws.send(state.outbox.shift());
      }
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
  syncChatLock();
})();
