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
  var storageKeyPhone = "kmbp_livechat_phone";
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
    pendingFile: null,
    pendingPreview: "",
    uploading: false,
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

  function uploadHeaders() {
    var headers = {
      Accept: "application/json",
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

  function normalizePhone(value) {
    return String(value || "").replace(/\D+/g, "");
  }

  function countryCode() {
    var code = String(boot.phoneCountryCode || "").trim();
    return /^\+\d{1,4}$/.test(code) ? code : "";
  }

  function countryChoices() {
    var list = [
      "+1 US", "+1 CA", "+1 AG", "+1 AI", "+1 AS", "+1 BB", "+1 BM", "+1 BS", "+1 DM", "+1 DO", "+1 GD", "+1 GU", "+1 JM", "+1 KN", "+1 KY", "+1 LC", "+1 MP", "+1 MS", "+1 PR", "+1 SX", "+1 TC", "+1 TT", "+1 VC", "+1 VG", "+1 VI",
      "+7 RU", "+7 KZ",
      "+20 EG", "+27 ZA", "+30 GR", "+31 NL", "+32 BE", "+33 FR", "+34 ES", "+36 HU", "+39 IT", "+39 VA", "+40 RO", "+41 CH", "+43 AT",
      "+44 GB", "+44 GG", "+44 IM", "+44 JE", "+45 DK", "+46 SE", "+47 NO", "+48 PL", "+49 DE",
      "+51 PE", "+52 MX", "+53 CU", "+54 AR", "+55 BR", "+56 CL", "+57 CO", "+58 VE",
      "+60 MY", "+61 AU", "+61 CC", "+61 CX", "+62 ID", "+63 PH", "+64 NZ", "+65 SG", "+66 TH",
      "+81 JP", "+82 KR", "+84 VN", "+86 CN", "+90 TR", "+91 IN", "+92 PK", "+93 AF", "+94 LK", "+95 MM", "+98 IR",
      "+211 SS", "+212 MA", "+213 DZ", "+216 TN", "+218 LY", "+220 GM", "+221 SN", "+222 MR", "+223 ML", "+224 GN", "+225 CI", "+226 BF", "+227 NE", "+228 TG", "+229 BJ", "+230 MU", "+231 LR", "+232 SL", "+233 GH", "+234 NG", "+235 TD", "+236 CF", "+237 CM", "+238 CV", "+239 ST", "+240 GQ", "+241 GA", "+242 CG", "+243 CD", "+244 AO", "+245 GW", "+246 IO", "+248 SC", "+249 SD", "+250 RW", "+251 ET", "+252 SO", "+253 DJ", "+254 KE", "+255 TZ", "+256 UG", "+257 BI", "+258 MZ", "+260 ZM", "+261 MG", "+262 RE", "+262 YT", "+263 ZW", "+264 NA", "+265 MW", "+266 LS", "+267 BW", "+268 SZ", "+269 KM", "+290 SH", "+291 ER", "+297 AW", "+298 FO", "+299 GL",
      "+350 GI", "+351 PT", "+352 LU", "+353 IE", "+354 IS", "+355 AL", "+356 MT", "+357 CY", "+358 FI", "+359 BG",
      "+370 LT", "+371 LV", "+372 EE", "+373 MD", "+374 AM", "+375 BY", "+376 AD", "+377 MC", "+378 SM", "+380 UA", "+381 RS", "+382 ME", "+383 XK", "+385 HR", "+386 SI", "+387 BA", "+389 MK",
      "+420 CZ", "+421 SK", "+423 LI",
      "+500 FK", "+501 BZ", "+502 GT", "+503 SV", "+504 HN", "+505 NI", "+506 CR", "+507 PA", "+508 PM", "+509 HT",
      "+590 BL", "+590 GP", "+590 MF", "+591 BO", "+592 GY", "+593 EC", "+594 GF", "+595 PY", "+596 MQ", "+597 SR", "+598 UY", "+599 BQ", "+599 CW",
      "+670 TL", "+672 NF", "+673 BN", "+674 NR", "+675 PG", "+676 TO", "+677 SB", "+678 VU", "+679 FJ", "+680 PW", "+681 WF", "+682 CK", "+683 NU", "+685 WS", "+686 KI", "+687 NC", "+688 TV", "+689 PF", "+690 TK", "+691 FM", "+692 MH",
      "+850 KP", "+852 HK", "+853 MO", "+855 KH", "+856 LA", "+880 BD", "+886 TW",
      "+960 MV", "+961 LB", "+962 JO", "+963 SY", "+964 IQ", "+965 KW", "+966 SA", "+967 YE", "+968 OM", "+970 PS", "+971 AE", "+972 IL", "+973 BH", "+974 QA", "+975 BT", "+976 MN", "+977 NP",
      "+992 TJ", "+993 TM", "+994 AZ", "+995 GE", "+996 KG", "+998 UZ"
    ];
    return list.map(function (entry) {
      var parts = entry.split(" ");
      return { dial: parts[0], letter: parts[1], label: parts[1] + " " + parts[0] };
    }).sort(function (a, b) {
      return a.letter < b.letter ? -1 : a.letter > b.letter ? 1 : 0;
    });
  }

  function preferredLetter(dial) {
    var prefs = {
      "+1": "US",
      "+7": "RU",
      "+39": "IT",
      "+44": "GB",
      "+61": "AU",
      "+212": "MA",
      "+262": "RE",
      "+590": "GP",
      "+599": "CW"
    };
    return prefs[dial] || "";
  }

  function defaultCountryCode() {
    var stored = normalizePhone(getVisitorPhone());
    var choices = countryChoices().slice().sort(function (a, b) {
      return normalizePhone(b.dial).length - normalizePhone(a.dial).length;
    });
    var i;
    for (i = 0; i < choices.length; i++) {
      var digits = normalizePhone(choices[i].dial);
      if (stored && stored.indexOf(digits) === 0 && stored.length > digits.length) {
        return choices[i].dial;
      }
    }
    var preset = countryCode();
    for (i = 0; i < countryChoices().length; i++) {
      if (countryChoices()[i].dial === preset) {
        return preset;
      }
    }
    return "+1";
  }

  function countryCodeOptions() {
    var selected = defaultCountryCode();
    var prefer = preferredLetter(selected);
    var items = countryChoices();
    var matchIndex = -1;
    var i;
    for (i = 0; i < items.length; i++) {
      if (items[i].dial !== selected) {
        continue;
      }
      if (prefer && items[i].letter === prefer) {
        matchIndex = i;
        break;
      }
      if (matchIndex < 0) {
        matchIndex = i;
      }
    }
    return items.map(function (item, index) {
      return '<option value="' + escapeHtml(item.dial + "|" + item.letter) + '"' + (index === matchIndex ? " selected" : "") + ">" + escapeHtml(item.label) + "</option>";
    }).join("");
  }

  function activeCountryCode() {
    var select = root.querySelector(".kmbp-lc-phone-code");
    if (select && select.value) {
      var dial = String(select.value).split("|")[0];
      if (/^\+\d{1,4}$/.test(dial)) {
        return dial;
      }
    }
    return defaultCountryCode();
  }

  function isValidPhone(value) {
    var digits = normalizePhone(value);
    return digits.length >= 8 && digits.length <= 15;
  }

  function getVisitorPhone() {
    try {
      return localStorage.getItem(storageKeyPhone) || "";
    } catch (e) {
      return "";
    }
  }

  function setVisitorPhone(phone) {
    try {
      localStorage.setItem(storageKeyPhone, String(phone || "").trim());
    } catch (e) {
      /* ignore */
    }
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
  var tagline = typeof boot.tagline === "string" ? boot.tagline : (i18n.defaultTagline || "");
  var welcomeTpl = boot.welcomeMessage || i18n.defaultWelcome || "Hi {{name}}, welcome! 👋";
  var channels = Array.isArray(boot.channels) ? boot.channels : [];

  function isSafeChannelUrl(url) {
    return /^(https:\/\/|mailto:|sms:\+|viber:\/\/)/i.test(String(url || ""));
  }

  function channelColor(value) {
    return /^#[0-9a-fA-F]{6}$/.test(String(value || "")) ? value : "#111827";
  }

  function channelIcon(id) {
    var paths = {
      whatsapp: '<path fill="currentColor" d="M12 2.2A9.8 9.8 0 0 0 3.7 16.9L2.4 21.6l4.9-1.3A9.8 9.8 0 1 0 12 2.2zm5.5 13.8c-.2.7-1.2 1.2-1.7 1.3-.4.1-1 .1-1.6-.1-.4-.1-.8-.3-1.4-.5-2.5-1.1-4.1-3.6-4.2-3.8-.1-.2-1-1.3-1-2.5s.6-1.8.9-2c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5.2.5.8 1.9.8 2s.1.3 0 .5l-.3.4c-.1.2-.3.3-.4.5-.1.1-.3.3-.1.5.2.3.7 1.2 1.5 1.9 1.1 1 1.9 1.3 2.2 1.4.3.1.4.1.6-.1.2-.2.7-.8.9-1.1.2-.3.4-.2.6-.1.3.1 1.6.8 1.9.9.3.1.5.2.5.3.1.2.1.7-.1 1.3z"/>',
      messenger: '<path fill="currentColor" d="M12 2C6.5 2 2 6.1 2 11.2c0 2.9 1.4 5.5 3.7 7.2V22l3.4-1.9c.9.2 1.8.4 2.9.4 5.5 0 10-4.1 10-9.2S17.5 2 12 2zm1 12.4-2.5-2.7-4.9 2.7 5.4-5.7 2.6 2.7 4.8-2.7-5.4 5.7z"/>',
      instagram: '<path fill="none" stroke="currentColor" stroke-width="1.8" d="M8 3.5h8A4.5 4.5 0 0 1 20.5 8v8A4.5 4.5 0 0 1 16 20.5H8A4.5 4.5 0 0 1 3.5 16V8A4.5 4.5 0 0 1 8 3.5z"/><circle cx="12" cy="12" r="3.4" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17.2" cy="6.8" r="1" fill="currentColor"/>',
      telegram: '<path fill="currentColor" d="M20.7 4.3 2.9 11.2c-1.2.5-1.2 1.1-.2 1.4l4.6 1.4 10.6-6.7c.5-.3 1-.1.6.2l-8.6 7.8-.3 4.6c.5 0 .7-.2 1-.5l2.3-2.2 4.8 3.5c.9.5 1.5.2 1.7-.8l3.1-14.6c.3-1.3-.5-1.9-1.4-1.5z"/>',
      line: '<path fill="currentColor" d="M12 3C6.5 3 2 6.6 2 11.1c0 4.1 3.6 7.5 8.5 8l.3 2.4c.1.4.5.2.7-.1l2.6-2.5c3.5-.6 6.9-3.4 6.9-7.8C21 6.6 17.5 3 12 3z"/>',
      viber: '<path fill="currentColor" d="M7 3.5h6.2C16.4 3.5 19 6 19 9.2v5.6c0 3.2-2.6 5.7-5.8 5.7H9.4L5 22.5v-3.4C3.8 17.8 3 16.1 3 14.2V9.2C3 6 5.6 3.5 8.8 3.5H7z"/>',
      sms: '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M5 6.5h14v9H8.5L5 18.5v-12z"/>',
      email: '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M4 7h16v10H4z"/><path fill="none" stroke="currentColor" stroke-width="1.8" d="m4 7 8 6 8-6"/>',
    };
    var body = paths[id] || '<circle cx="12" cy="12" r="4" fill="currentColor"/>';
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + body + "</svg>";
  }

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
    '<div class="kmbp-lc-channels"' +
    (channels.length ? "" : " hidden") +
    ">" +
    '<p class="kmbp-lc-channels-label"></p>' +
    '<div class="kmbp-lc-channels-row"></div>' +
    "</div>" +
    '<div class="kmbp-lc-status" hidden></div>' +
    '<div class="kmbp-lc-body">' +
    '<div class="kmbp-lc-landing">' +
    '<div class="kmbp-lc-day"></div>' +
    '<p class="kmbp-lc-welcome"></p>' +
    '<div class="kmbp-lc-fields">' +
    (boot.askName || boot.visitorName
      ?     '<div class="kmbp-lc-field kmbp-lc-name-field"><input type="text" class="kmbp-lc-name-input" maxlength="80" autocomplete="name" /></div>'
      : "") +
    '<div class="kmbp-lc-field kmbp-lc-email-field"><input type="email" class="kmbp-lc-email-input" maxlength="190" autocomplete="email" required /></div>' +
    '<div class="kmbp-lc-field kmbp-lc-phone-field">' +
    '<select class="kmbp-lc-phone-code" aria-label="' + escapeHtml(i18n.countryCode || "Country code") + '">' +
    countryCodeOptions() +
    "</select>" +
    '<input type="tel" class="kmbp-lc-phone-input" maxlength="20" autocomplete="tel-national" required /></div>' +
    "</div>" +
    "</div>" +
    '<div class="kmbp-lc-msgs" hidden></div>' +
    "</div>" +
    '<form class="kmbp-lc-composer" autocomplete="off">' +
    '<div class="kmbp-lc-file" hidden>' +
    '<img alt="" hidden />' +
    '<span class="kmbp-lc-file-name"></span>' +
    '<button type="button" class="kmbp-lc-file-remove" aria-label="' +
    escapeHtml(i18n.removeFile || "Remove file") +
    '">&times;</button>' +
    "</div>" +
    '<div class="kmbp-lc-composer-inner">' +
    '<button type="button" class="kmbp-lc-attach" aria-label="' +
    escapeHtml(i18n.attach || "Attach an image, GIF, or PDF") +
    '">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>' +
    "</button>" +
    '<input type="file" class="kmbp-lc-file-input" accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,.jpg,.jpeg,.png,.gif,.webp,.pdf" tabindex="-1" />' +
    '<input type="text" class="kmbp-lc-text" maxlength="4000" />' +
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
  root.querySelector(".kmbp-lc-tagline").hidden = !String(tagline).trim();
  var channelLabel = root.querySelector(".kmbp-lc-channels-label");
  var channelRow = root.querySelector(".kmbp-lc-channels-row");
  var channelWrap = root.querySelector(".kmbp-lc-channels");
  if (channelLabel) {
    channelLabel.textContent = i18n.alsoOn || "Also on";
  }
  channels.forEach(function (channel) {
    if (!channel || !isSafeChannelUrl(channel.url) || !channelRow) {
      return;
    }
    var link = document.createElement("a");
    link.className = "kmbp-lc-channel";
    link.href = channel.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.style.background = channelColor(channel.color);
    link.title = channel.label || channel.id || "";
    link.setAttribute("aria-label", channel.label || channel.id || "Open channel");
    link.innerHTML = channelIcon(channel.id);
    channelRow.appendChild(link);
  });
  if (channelWrap && (!channelRow || !channelRow.childElementCount)) {
    channelWrap.hidden = true;
  }
  root.querySelector(".kmbp-lc-day").textContent = i18n.today || "Today";
  root.querySelector(".kmbp-lc-text").placeholder = i18n.sendPlaceholder || "Send a message…";

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

  var phoneInput = root.querySelector(".kmbp-lc-phone-input");
  var phoneCode = root.querySelector(".kmbp-lc-phone-code");
  phoneInput.placeholder = i18n.phoneNumber || "Phone number";
  phoneInput.value = localPhoneValue();
  phoneCode.addEventListener("change", function () {
    phoneInput.classList.remove("kmbp-lc-invalid");
    if (hasValidPhone()) {
      setVisitorPhone(currentPhone());
      showStatus("");
    }
    syncChatLock();
  });
  phoneInput.addEventListener("input", function () {
    phoneInput.classList.remove("kmbp-lc-invalid");
    if (hasValidPhone()) {
      setVisitorPhone(currentPhone());
      showStatus("");
      if (hasValidEmail()) {
        ensureIdentity(function (ok) {
          if (ok && state.open) {
            connect();
          }
        });
      }
    }
    syncChatLock();
    if (state.messages.length) {
      showChatView();
    }
  });

  var landing = root.querySelector(".kmbp-lc-landing");
  var msgsEl = root.querySelector(".kmbp-lc-msgs");
  var statusEl = root.querySelector(".kmbp-lc-status");
  var composeInput = root.querySelector(".kmbp-lc-text");
  var fileInput = root.querySelector(".kmbp-lc-file-input");
  var fileChip = root.querySelector(".kmbp-lc-file");
  var fileChipImg = fileChip.querySelector("img");
  var fileChipName = fileChip.querySelector(".kmbp-lc-file-name");
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

  function localPhoneValue() {
    var stored = normalizePhone(getVisitorPhone());
    var code = normalizePhone(defaultCountryCode());
    if (code && stored.indexOf(code) === 0) {
      return stored.slice(code.length);
    }
    return stored;
  }

  function currentPhone() {
    var digits = normalizePhone(phoneInput ? phoneInput.value : "").replace(/^0+/, "");
    var codeDigits = normalizePhone(activeCountryCode());
    if (!digits || !codeDigits) {
      return "";
    }
    return "+" + codeDigits + digits;
  }

  function hasValidPhone() {
    return isValidPhone(currentPhone());
  }

  function syncChatLock() {
    var locked = !hasValidEmail() || !hasValidPhone();
    var busy = state.uploading;
    root.classList.toggle("kmbp-lc-locked", locked);
    composeInput.disabled = locked || busy;
    root.querySelector(".kmbp-lc-send").disabled = locked || busy;
    root.querySelector(".kmbp-lc-attach").disabled = locked || busy;
  }

  function requireEmail() {
    if (!hasValidEmail()) {
      showStatus(i18n.emailRequired || "Enter your email to start chatting.");
      emailInput.classList.add("kmbp-lc-invalid");
      emailInput.focus();
      return false;
    }
    setVisitorEmail(currentEmail());
    emailInput.classList.remove("kmbp-lc-invalid");
    if (!hasValidPhone()) {
      showStatus(i18n.phoneRequired || "Enter your phone number with country code.");
      phoneInput.classList.add("kmbp-lc-invalid");
      phoneInput.focus();
      return false;
    }
    setVisitorPhone(currentPhone());
    phoneInput.classList.remove("kmbp-lc-invalid");
    showStatus("");
    return true;
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
      if (hasValidEmail() && hasValidPhone()) {
        ensureIdentity(function (ok) {
          if (ok) {
            connect();
          }
        });
        composeInput.focus();
      } else if (!hasValidEmail() && emailInput && !emailInput.readOnly) {
        emailInput.focus();
      } else if (!hasValidPhone() && phoneInput) {
        phoneInput.focus();
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
    if (!hasValidEmail() || !hasValidPhone()) {
      landing.hidden = false;
      msgsEl.hidden = true;
      return;
    }
    landing.hidden = true;
    msgsEl.hidden = false;
  }

  function isSafeUploadUrl(url) {
    var base = String(boot.uploadsBase || "").replace(/\/$/, "");
    if (!base) {
      return false;
    }
    try {
      var parsed = new URL(url, window.location.href);
      var baseUrl = new URL(base + "/", window.location.href);
      return parsed.origin === baseUrl.origin && (parsed.pathname + "/").indexOf(baseUrl.pathname) === 0;
    } catch (e) {
      return false;
    }
  }

  function kindFromUrl(url, mime) {
    var value = String(mime || url || "").toLowerCase();
    if (value.indexOf("pdf") !== -1) {
      return "pdf";
    }
    if (value.indexOf("gif") !== -1) {
      return "gif";
    }
    return "image";
  }

  function normalizeAttachment(msg) {
    var att = msg && (msg.attachment || msg.file);
    if (att && att.url && isSafeUploadUrl(att.url)) {
      return {
        url: String(att.url),
        name: String(att.name || "file"),
        mime: String(att.mime || ""),
        kind: att.kind || kindFromUrl(att.url, att.mime),
      };
    }
    var content = msgContent(msg);
    var match = content.match(/https?:\/\/\S+/i);
    if (!match || !isSafeUploadUrl(match[0])) {
      return null;
    }
    var url = match[0].replace(/[),.;]+$/, "");
    if (!/\.(jpe?g|png|gif|webp|pdf)(\?|#|$)/i.test(url)) {
      return null;
    }
    return {
      url: url,
      name: decodeURIComponent(url.split("/").pop().split("?")[0] || "file"),
      mime: "",
      kind: kindFromUrl(url, ""),
    };
  }

  function visibleText(msg, att) {
    var text = msgContent(msg);
    if (att && att.url) {
      text = text.split(att.url).join("").trim();
    }
    return text;
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
    var att = normalizeAttachment(msg);
    var text = visibleText(msg, att);
    if (text) {
      var caption = document.createElement("div");
      caption.className = "kmbp-lc-bubble-text";
      caption.textContent = text;
      bubble.appendChild(caption);
    }
    if (att && (att.kind === "image" || att.kind === "gif")) {
      var img = document.createElement("img");
      img.src = att.url;
      img.alt = att.name || "";
      bubble.appendChild(img);
    } else if (att) {
      var link = document.createElement("a");
      link.className = "kmbp-lc-file-link";
      link.href = att.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = att.name || "PDF";
      bubble.appendChild(link);
    }
    if (!bubble.childNodes.length) {
      bubble.textContent = text;
    }
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
    var att = normalizeAttachment(incoming);
    if (!content && !att) {
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
        phone: currentPhone(),
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

  function mirrorToInbox(text, messageId, attachmentId) {
    if (!boot.restUrl || !boot.widgetToken) {
      return;
    }
    var payload = {
      roomId: roomId,
      text: text,
      senderName: getVisitorName() || currentEmail() || "Website Visitor",
      email: currentEmail(),
      phone: currentPhone(),
      messageId: messageId,
    };
    if (attachmentId) {
      payload.attachmentId = attachmentId;
    }
    fetch(boot.restUrl + "livechat/inbound", {
      method: "POST",
      credentials: "same-origin",
      headers: widgetHeaders(),
      body: JSON.stringify(payload),
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

  function localFileError(file) {
    if (!file) {
      return i18n.fileType || "Only images, GIFs, and PDFs can be uploaded.";
    }
    var max = boot.maxUploadBytes || 8 * 1024 * 1024;
    if (!file.size || file.size > max) {
      return i18n.fileTooLarge || "That file is too large.";
    }
    var name = String(file.name || "").toLowerCase();
    var okExt = /\.(jpe?g|png|gif|webp|pdf)$/.test(name);
    var okMime = /^(image\/(jpeg|png|gif|webp)|application\/pdf)$/.test(file.type || "");
    if (!okExt || (file.type && !okMime)) {
      return i18n.fileType || "Only images, GIFs, and PDFs can be uploaded.";
    }
    return "";
  }

  function clearPendingFile() {
    if (state.pendingPreview) {
      URL.revokeObjectURL(state.pendingPreview);
    }
    state.pendingFile = null;
    state.pendingPreview = "";
    fileChip.hidden = true;
    fileChipImg.hidden = true;
    fileChipImg.removeAttribute("src");
    fileChipName.textContent = "";
    fileInput.value = "";
  }

  function setPendingFile(file) {
    var error = localFileError(file);
    if (error) {
      fileInput.value = "";
      showStatus(error);
      return;
    }
    clearPendingFile();
    showStatus("");
    state.pendingFile = file;
    fileChipName.textContent = file.name;
    if (/^image\//.test(file.type || "") || /\.(jpe?g|png|gif|webp)$/i.test(file.name || "")) {
      state.pendingPreview = URL.createObjectURL(file);
      fileChipImg.src = state.pendingPreview;
      fileChipImg.hidden = false;
    }
    fileChip.hidden = false;
  }

  function uploadFile(file) {
    var body = new FormData();
    body.append("file", file, file.name);
    return fetch(boot.restUrl + "livechat/upload", {
      method: "POST",
      credentials: "same-origin",
      headers: uploadHeaders(),
      body: body,
    }).then(function (res) {
      return res.text().then(function (raw) {
        var data = null;
        try {
          data = raw ? JSON.parse(raw) : null;
        } catch (e) {
          data = null;
        }
        if (!res.ok || !data || !data.url || !data.id) {
          throw new Error((data && data.message) || i18n.uploadFailed || "Could not upload that file.");
        }
        return data;
      });
    });
  }

  function deliverMessage(text, uploaded) {
    connect();
    var att = null;
    if (uploaded && uploaded.url) {
      att = {
        id: uploaded.id,
        url: uploaded.url,
        name: uploaded.name || "",
        mime: uploaded.mime || "",
        kind: uploaded.kind || "",
      };
    }
    var content = text;
    if (att && att.url) {
      content = text ? text + "\n" + att.url : att.url;
    }
    var local = {
      id: uid(),
      content: content,
      attachment: att,
      sender_name: getVisitorName() || displayName(),
      sender_type: "visitor",
      created_at: new Date().toISOString(),
    };
    appendMessage(local);
    state.pendingOut[content] = Date.now();
    var payload = {
      content: content,
      sender_name: local.sender_name,
      sender_type: "visitor",
    };
    if (att) {
      payload.attachment = att;
    }
    enqueueWs(payload);
    mirrorToInbox(text, local.id, att ? att.id : 0);
    composeInput.value = "";
    if (att) {
      clearPendingFile();
    }
  }

  function submitMessage(text, file) {
    text = String(text || "").trim();
    if ((!text && !file) || state.uploading) {
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
      var pending = file;
      var start = pending ? uploadFile(pending) : Promise.resolve(null);
      if (pending) {
        state.uploading = true;
        syncChatLock();
        showStatus(i18n.uploading || "Uploading…");
      }
      start
        .then(function (uploaded) {
          state.uploading = false;
          syncChatLock();
          showStatus("");
          deliverMessage(text, uploaded);
        })
        .catch(function (err) {
          state.uploading = false;
          syncChatLock();
          showStatus((err && err.message) || i18n.uploadFailed || "Could not upload that file.");
        });
    });
  }

  function sendText(text) {
    submitMessage(text, null);
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
    submitMessage(composeInput.value, state.pendingFile);
  });
  root.querySelector(".kmbp-lc-attach").addEventListener("click", function () {
    if (!requireEmail()) {
      return;
    }
    fileInput.click();
  });
  fileInput.addEventListener("change", function () {
    var file = fileInput.files && fileInput.files[0];
    if (file) {
      setPendingFile(file);
    }
  });
  root.querySelector(".kmbp-lc-file-remove").addEventListener("click", function () {
    clearPendingFile();
    showStatus("");
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
