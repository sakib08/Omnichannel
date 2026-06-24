// Thin REST client around the KinetixMessagingBoot bootstrap object that the WP admin
// page exposes via wp_localize_script.  Falls back to sensible defaults so
// the module is still importable when developing outside the WP admin shell.

const boot = typeof window !== "undefined" && window.KinetixMessagingBoot ? window.KinetixMessagingBoot : {};

export const restUrl = (boot.restUrl || "/wp-json/kmbp/v1/").replace(/\/?$/, "/");

/** Build a fully-qualified webhook URL for a given channel slug.
 *  e.g. webhookUrl("telegram") → "https://example.com/wp-json/kmbp/v1/webhooks/telegram"
 */
export const webhookUrl = (slug) => restUrl + "webhooks/" + slug;

/** Site origin, derived from the REST URL (used for display-only labels). */
export const siteOrigin = (() => {
  try { return new URL(restUrl).origin; } catch (_) { return ""; }
})();

/** Hostname only, e.g. "example.com" */
export const siteHost = (() => {
  try { return new URL(restUrl).hostname; } catch (_) { return "yourdomain.com"; }
})();

/** True when the site URL is unlikely to be reachable by external webhook providers. */
export const isLocalWebhookSite = (() => {
  try {
    const u = new URL(restUrl);
    const host = u.hostname.toLowerCase();
    if (u.protocol !== "https:") return true;
    if (
      host === "localhost" ||
      host.endsWith(".test") ||
      host.endsWith(".local") ||
      host.endsWith(".localhost") ||
      host.startsWith("127.") ||
      host.startsWith("192.168.") ||
      host.startsWith("10.")
    ) {
      return true;
    }
  } catch (_) {
    return false;
  }
  return false;
})();
export const restNonce = boot.nonce || "";
export const currentUser = boot.user || { id: 0, name: "Guest", email: "", roles: [] };
export const caps = boot.caps || {
  isAdmin: false,
  canAccessMessaging: false,
  canManageSettings: false,
  canManageDepts: false,
};

async function request(path, { method = "GET", body, signal } = {}) {
  const url = restUrl + path.replace(/^\//, "");
  const headers = { Accept: "application/json" };
  if (restNonce) headers["X-WP-Nonce"] = restNonce;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(url, {
    method,
    credentials: "same-origin",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }

  if (!response.ok) {
    const message = (data && data.message) || `Request failed: ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export const api = {
  getSettings:        () => request("settings"),
  getChannelSettings: (channel) => request(`settings/${channel}`),
  saveSettings:       (payload) => request("settings", { method: "POST", body: payload }),
  saveChannel:        (channel, payload) => request(`settings/${channel}`, { method: "POST", body: payload }),

  listDepartments:   () => request("departments"),
  createDepartment:  (payload) => request("departments", { method: "POST", body: payload }),
  updateDepartment:  (id, payload) => request(`departments/${id}`, { method: "PUT", body: payload }),
  deleteDepartment:  (id) => request(`departments/${id}`, { method: "DELETE" }),

  listAgents:        () => request("agents"),
  assignAgentDepts:  (id, departmentIds) => request(`agents/${id}/departments`, { method: "POST", body: { departmentIds } }),

  /** Lightweight heartbeat — single DB query, ~80 bytes. */
  poll: () => request("poll"),

  listConversations: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`conversations${qs ? `?${qs}` : ""}`);
  },
  listMessages:    (cid) => request(`conversations/${cid}/messages`),
  listNewMessages: (cid, afterId) => request(`conversations/${cid}/messages?after_id=${afterId}`),
  createConversation: (payload) => request("conversations", { method: "POST", body: payload }),
  updateConversation: (id, payload) => request(`conversations/${id}`, { method: "PUT", body: payload }),
  createMessage: (payload) => request("messages", { method: "POST", body: payload }),

  sendEmail:    (payload) => request("email/send",    { method: "POST", body: payload }),
  pollEmail:    () =>        request("email/poll",    { method: "POST" }),
  testEmailConnection: (type) => request("email/test-connection", { method: "POST", body: { type } }),

  // Channel-specific outbound send (all share the same { conversationId, recipientId, text } shape).
  sendTelegram:   (payload) => request("telegram/send",   { method: "POST", body: payload }),
  sendWhatsApp:   (payload) => request("whatsapp/send",   { method: "POST", body: payload }),
  sendMessenger:  (payload) => request("messenger/send",  { method: "POST", body: payload }),
  sendWeChat:     (payload) => request("wechat/send",     { method: "POST", body: payload }),
  sendSms:        (payload) => request("sms/send",        { method: "POST", body: payload }),
  sendLine:       (payload) => request("line/send",       { method: "POST", body: payload }),
  sendInstagram:  (payload) => request("instagram/send",  { method: "POST", body: payload }),
  sendViber:      (payload) => request("viber/send",      { method: "POST", body: payload }),

  /** Generic channel send — picks the right endpoint from the channel slug. */
  sendChannel: (channel, payload) => {
    const map = {
      email:     "email/send",
      telegram:  "telegram/send",
      whatsapp:  "whatsapp/send",
      messenger: "messenger/send",
      wechat:    "wechat/send",
      sms:       "sms/send",
      line:      "line/send",
      instagram: "instagram/send",
      viber:     "viber/send",
    };
    const path = map[channel];
    if (!path) return Promise.reject(new Error(`No send endpoint for channel: ${channel}`));
    return request(path, { method: "POST", body: payload });
  },

  /** Register a Telegram webhook with a single API call. */
  registerTelegramWebhook: (body = {}) => request("telegram/set-webhook", { method: "POST", body }),
  /** Fetch live webhook status from Telegram (getWebhookInfo). */
  getTelegramWebhookInfo: () => request("telegram/webhook-info"),
  /** Register Viber webhook via the Viber Chat API. */
  registerViberWebhook: () => request("viber/set-webhook", { method: "POST" }),
};

export default api;
