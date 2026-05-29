// Thin REST client around the SMEBoot bootstrap object that the WP admin
// page exposes via wp_localize_script.  Falls back to sensible defaults so
// the module is still importable when developing outside the WP admin shell.

const boot = typeof window !== "undefined" && window.SMEBoot ? window.SMEBoot : {};

export const restUrl = (boot.restUrl || "/wp-json/sme/v1/").replace(/\/?$/, "/");
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

  listConversations: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`conversations${qs ? `?${qs}` : ""}`);
  },
  listMessages: (cid) => request(`conversations/${cid}/messages`),
  createConversation: (payload) => request("conversations", { method: "POST", body: payload }),
  updateConversation: (id, payload) => request(`conversations/${id}`, { method: "PUT", body: payload }),
  createMessage: (payload) => request("messages", { method: "POST", body: payload }),

  sendEmail: (payload) => request("email/send", { method: "POST", body: payload }),
  pollEmail: () => request("email/poll", { method: "POST" }),
  testEmailConnection: (type) => request("email/test-connection", { method: "POST", body: { type } }),
};

export default api;
