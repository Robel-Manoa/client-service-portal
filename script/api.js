// @ts-check

/**
 * Fetch-based client for the Client Service Portal backend API
 * (server-client-service-portal). Every page (`app.js`) reads and writes
 * through this file instead of calling `fetch` directly, so auth headers,
 * error handling, and the API's base URL only need to be right in one place.
 *
 * The backend is the single source of truth for data, ids, timestamps, and
 * validation — nothing here is ever invented client-side.
 */

const API_BASE_URL = "http://localhost:3001/api";

// The logged-in session (JWT + user) lives in sessionStorage, not
// localStorage: it should not survive closing the tab, same as before
// this file replaced the old mock data layer.
const SESSION_KEY = "csp_session";

// --- Shared types ----------------------------------------------------------

/** @typedef {"client" | "engineer" | "admin"} UserRole */
/** @typedef {"low" | "medium" | "high"} ServiceRequestPriority */
/** @typedef {"open" | "in_progress" | "pending_client" | "resolved" | "closed"} RequestStatus */
/** @typedef {"public" | "internal"} CommentVisibility */

/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} name
 * @property {string} email
 * @property {UserRole} role
 * @property {boolean} is_active
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} StatusHistoryEntry
 * @property {RequestStatus} status
 * @property {string} at
 */

/**
 * @typedef {Object} ServiceRequest
 * @property {string} id
 * @property {string} client_id
 * @property {string} title
 * @property {string} description
 * @property {ServiceRequestPriority} priority
 * @property {RequestStatus} status
 * @property {string} created_at
 * @property {string} updated_at
 * @property {StatusHistoryEntry[]} status_history
 * @property {string} [assigned_engineer_id]
 */

/**
 * @typedef {Object} RequestComment
 * @property {string} id
 * @property {string} request_id
 * @property {string} author_id
 * @property {string} body
 * @property {CommentVisibility} visibility
 * @property {string} created_at
 */

/**
 * Thrown for any non-2xx API response. Kept as its own class (instead of a
 * plain Error) so callers can tell "the request failed" apart from "the
 * server rejected it and told us why" and show that reason to the user.
 */
class ApiError extends Error {
  /**
   * @param {number} status
   * @param {string} message
   * @param {Array<{field?: string, message: string}>} [details] field-level validation errors, only present on 400s
   */
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// --- Internal helpers --------------------------------------------------

/** @returns {{token: string, user: User} | null} */
function readSession() {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * `index.html` (root) and every `pages/*.html` file both load this
 * script, so "go back to the login page" means a different relative
 * path depending on which one is currently open.
 * @returns {string}
 */
function loginRedirectPath() {
  return window.location.pathname.includes("/pages/")
    ? "../index.html"
    : "./index.html";
}

/**
 * Every method on `api` funnels its actual HTTP call through here, so
 * attaching the auth header, parsing JSON, and turning a failed response
 * into an ApiError only has to be written once.
 * @param {string} method
 * @param {string} path
 * @param {{body?: unknown, auth?: boolean}} [options] set `auth: false` for the one endpoint that doesn't need a token yet: login
 * @returns {Promise<any>}
 */
async function request(method, path, options = {}) {
  const { body, auth = true } = options;

  /** @type {Record<string, string>} */
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";

  if (auth) {
    const session = readSession();
    if (!session) {
      // Nothing to send a request with — bounce back to login instead of
      // letting the backend reject it.
      window.location.href = loginRedirectPath();
      throw new ApiError(401, "Not authenticated");
    }
    headers["Authorization"] = `Bearer ${session.token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) return null;

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401 && auth) {
      // The token we had is gone or expired — clear it so the next page
      // load doesn't keep trying to use it, then send the user back.
      sessionStorage.removeItem(SESSION_KEY);
      window.location.href = loginRedirectPath();
    }
    throw new ApiError(
      response.status,
      data?.error || "Request failed",
      data?.details,
    );
  }

  return data;
}

// --- Public API --------------------------------------------------------

const api = {
  // -- Auth / session --

  /** @returns {User | null} */
  getCurrentUser() {
    return readSession()?.user ?? null;
  },

  /**
   * @param {string} email
   * @param {string} password
   * @returns {Promise<User>}
   */
  async login(email, password) {
    const session = await request("POST", "/auth/login", {
      body: { email, password },
      auth: false,
    });
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session.user;
  },

  /** @returns {void} */
  logout() {
    // The backend is stateless (a JWT, not a server-side session), so
    // logging out is just forgetting the token locally.
    sessionStorage.removeItem(SESSION_KEY);
  },

  // -- Users --

  /** @returns {Promise<User[]>} */
  getUsers: () => request("GET", "/users"),

  /** @param {string} id @returns {Promise<User>} */
  getUserById: (id) => request("GET", `/users/${encodeURIComponent(id)}`),

  /**
   * There's no dedicated "list engineers" endpoint, so this reuses the
   * (admin-only) full user list and filters it client-side.
   * @returns {Promise<User[]>}
   */
  getEngineers: async () => {
    const users = await request("GET", "/users");
    return users.filter((/** @type {User} */ user) => user.role === "engineer");
  },

  /**
   * @param {{name: string, email: string, password: string, role: UserRole}} payload
   * @returns {Promise<User>}
   */
  createUser: (payload) => request("POST", "/users", { body: payload }),

  /**
   * @param {string} id
   * @param {{name?: string, email?: string, role?: UserRole, is_active?: boolean}} updates
   * @returns {Promise<User>}
   */
  updateUser: (id, updates) =>
    request("PATCH", `/users/${encodeURIComponent(id)}`, { body: updates }),

  /** @param {string} id @returns {Promise<null>} */
  deleteUser: (id) => request("DELETE", `/users/${encodeURIComponent(id)}`),

  // -- Requests --

  /**
   * Scoped by the backend to whoever is logged in: an admin gets every
   * request, an engineer gets the ones assigned to them, a client gets
   * their own. One call covers every dashboard.
   * @returns {Promise<ServiceRequest[]>}
   */
  getRequests: () => request("GET", "/requests"),

  /** @param {string} id @returns {Promise<ServiceRequest>} */
  getRequestById: (id) => request("GET", `/requests/${encodeURIComponent(id)}`),

  /**
   * `client_id` is deliberately not a parameter here: the backend reads
   * the owner from the caller's token, so there's nothing for the
   * frontend to send.
   * @param {{title: string, description: string, priority: ServiceRequestPriority}} payload
   * @returns {Promise<ServiceRequest>}
   */
  createRequest: (payload) => request("POST", "/requests", { body: payload }),

  /**
   * @param {string} id
   * @param {RequestStatus} status
   * @returns {Promise<ServiceRequest>}
   */
  updateRequestStatus: (id, status) =>
    request("PATCH", `/requests/${encodeURIComponent(id)}`, {
      body: { status },
    }),

  /** @param {string} id @returns {Promise<null>} */
  deleteRequest: (id) => request("DELETE", `/requests/${encodeURIComponent(id)}`),

  /**
   * There's no separate "assignment" resource to create — this just sets
   * `assigned_engineer_id` on the request and hands back the updated request.
   * @param {string} requestId
   * @param {string} engineerId
   * @returns {Promise<ServiceRequest>}
   */
  assignEngineer: (requestId, engineerId) =>
    request("POST", `/requests/${encodeURIComponent(requestId)}/assignments`, {
      body: { engineer_id: engineerId },
    }),

  // -- Comments --

  /** @param {string} requestId @returns {Promise<RequestComment[]>} */
  getCommentsForRequest: (requestId) =>
    request("GET", `/requests/${encodeURIComponent(requestId)}/comments`),

  /**
   * @param {string} requestId
   * @param {{body: string, visibility: CommentVisibility}} comment
   * @returns {Promise<RequestComment>}
   */
  addComment: (requestId, comment) =>
    request("POST", `/requests/${encodeURIComponent(requestId)}/comments`, {
      body: comment,
    }),
};
