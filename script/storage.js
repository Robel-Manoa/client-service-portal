// @ts-check

/**
 * @typedef {"client" | "engineer" | "admin"} UserRole
 *
 * @typedef {Object} User
 * @property {string} id
 * @property {string} name
 * @property {string} email
 * @property {string} password
 * @property {UserRole} role
 * @property {boolean} is_active
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {"open" | "in_progress" | "pending_client" | "resolved" | "closed"} RequestStatus
 *
 * @typedef {Object} StatusHistoryEntry
 * @property {RequestStatus} status
 * @property {string} at
 *
 * @typedef {Object} ServiceRequest
 * @property {string} id
 * @property {string} client_id
 * @property {string} title
 * @property {string} description
 * @property {string} priority
 * @property {RequestStatus} status
 * @property {string} created_at
 * @property {string} updated_at
 * @property {StatusHistoryEntry[]} status_history
 */

/**
 * @typedef {Object} Assignment
 * @property {string} id
 * @property {string} request_id
 * @property {string} engineer_id
 * @property {string} assigned_at
 */

/**
 * Named RequestComment, not Comment, to avoid colliding with the DOM's built-in global Comment interface
 * @typedef {Object} RequestComment
 * @property {string} id
 * @property {string} request_id
 * @property {string} user_id
 * @property {string} content
 * @property {boolean} is_internal
 * @property {string} created_at
 */

/**
 * Data layer for the Client Service Portal.
 *
 * A closure-based module keeps the sessionStorage keys and internal helpers private, exposing only the functions returned at the bottom of this file. Every page reads and writes through this module instead of touching sessionStorage directly, so it stays the single source of truth for the app's data.
 */
const CSP = () => {
  const keys = {
    users: "csp_users",
    requests: "csp_requests",
    assignments: "csp_assignments",
    comments: "csp_comments",
    currentUser: "csp_current_user",
    seeded: "csp_seeded",
  };

  /**
   * Reads and parses a JSON value from sessionStorage.
   * Design for failure: a manually edited or corrupted sessionStorage entry
   * must not crash the page — it is treated as absent instead.
   * @param {string} key
   * @returns {*} the parsed value, or `null` if missing/unreadable
   */
  function read(key) {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      console.warn(`Storage: could not parse "${key}", ignoring stored value.`);
      return null;
    }
  }

  /**
   * Serializes and writes a value to sessionStorage.
   * @param {string} key
   * @param {*} value
   * @returns {void}
   */
  function write(key, value) {
    sessionStorage.setItem(key, JSON.stringify(value));
  }

  /**
   * Generates a pseudo-unique id for a new record.
   * Uses `slice` rather than the deprecated `String.prototype.substr`
   * (see MDN: substr is a legacy feature, kept only for compatibility).
   * @param {string} prefix
   * @returns {string} e.g. "request_ab12c34d5"
   */
  function uid(prefix) {
    return `${prefix}_${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * Seeds sessionStorage from the mock data (data/data.js) on first load
   * only, guarded by the `csp_seeded` flag so demo data isn't re-injected
   * on every page navigation. Called once, right after Storage is created.
   * @returns {void}
   */
  function init() {
    if (sessionStorage.getItem(keys.seeded) === "true") return;

    // `data` comes from the globally-loaded data/data.js script; falling
    // back to empty arrays keeps the app usable even if that file is
    // missing (graceful degradation instead of a hard crash).
    const seed =
      typeof data !== "undefined"
        ? data
        : { users: [], requests: [], assignments: [], comments: [] };

    write(keys.users, seed.users || []);
    write(keys.requests, seed.requests || []);
    write(keys.assignments, seed.assignments || []);
    write(keys.comments, seed.comments || []);
    sessionStorage.setItem(keys.seeded, "true");
  }

  // --- Users ---------------------------------------------------------

  /** @returns {User[]} every user */
  function getUsers() {
    return /** @type {User[]} */ (read(keys.users)) || [];
  }

  /**
   * @param {string} email
   * @returns {User | undefined}
   */
  function findUserByEmail(email) {
    return getUsers().find((user) => user.email === email);
  }

  /**
   * @param {string} id
   * @returns {User | undefined}
   */
  function getUserById(id) {
    return getUsers().find((user) => user.id === id);
  }

  /** @returns {User[]} users with the "engineer" role */
  function getEngineers() {
    return getUsers().filter((user) => user.role === "engineer");
  }

  /**
   * @param {{ name: string, email: string, password: string, role: UserRole }} input
   * @returns {User | null} the created user, or `null` if the email is already taken
   */
  function createUser({ name, email, password, role }) {
    const users = getUsers();
    if (users.some((user) => user.email === email)) return null;

    const now = new Date().toISOString();
    /** @type {User} */
    const newUser = {
      id: uid("user"),
      name,
      email,
      password,
      role,
      is_active: true,
      created_at: now,
      updated_at: now,
    };

    users.push(newUser);
    write(keys.users, users);
    return newUser;
  }

  /**
   * @param {string} id
   * @param {Partial<User>} updates
   * @returns {User | null} the updated user, or `null` if it doesn't exist
   */
  function updateUser(id, updates) {
    const users = getUsers();
    const user = users.find((u) => u.id === id);
    if (!user) return null;

    Object.assign(user, updates, { updated_at: new Date().toISOString() });
    write(keys.users, users);
    return user;
  }

  /**
   * @param {string} id
   * @returns {void}
   */
  function deleteUser(id) {
    const users = getUsers().filter((user) => user.id !== id);
    write(keys.users, users);
  }

  // --- Authentication --------------------------------------------------

  /** @returns {User | null} the logged-in user for this tab session */
  function getCurrentUser() {
    return /** @type {User | null} */ (read(keys.currentUser));
  }

  /**
   * @param {string} email
   * @param {string} password
   * @returns {User | null} the matching user, or `null` if credentials don't match
   */
  function login(email, password) {
    const user = getUsers().find(
      (u) => u.email === email && u.password === password,
    );
    if (!user) return null;
    write(keys.currentUser, user);
    return user;
  }

  /** @returns {void} */
  function logout() {
    sessionStorage.removeItem(keys.currentUser);
  }

  // --- Requests --------------------------------------------------------

  /** @returns {ServiceRequest[]} every request */
  function getRequests() {
    return /** @type {ServiceRequest[]} */ (read(keys.requests)) || [];
  }

  /**
   * @param {ServiceRequest[]} requests
   * @returns {void}
   */
  function saveRequests(requests) {
    write(keys.requests, requests);
  }

  /**
   * @param {string} id
   * @returns {ServiceRequest | undefined}
   */
  function getRequestById(id) {
    return getRequests().find((request) => request.id === id);
  }

  /**
   * @param {string} clientId
   * @returns {ServiceRequest[]} requests submitted by this client
   */
  function getRequestsForClient(clientId) {
    return getRequests().filter((request) => request.client_id === clientId);
  }

  /**
   * @param {string} engineerId
   * @returns {ServiceRequest[]} requests assigned to this engineer
   */
  function getRequestsForEngineer(engineerId) {
    const myRequestIds = getAssignments()
      .filter((assignment) => assignment.engineer_id === engineerId)
      .map((assignment) => assignment.request_id);
    return getRequests().filter((request) => myRequestIds.includes(request.id));
  }

  /**
   * @param {{ client_id: string, title: string, description: string, priority: string }} input
   * @returns {ServiceRequest} the created request, status "open"
   */
  function addRequest({ client_id, title, description, priority }) {
    const requests = getRequests();
    const now = new Date().toISOString();
    /** @type {ServiceRequest} */
    const newRequest = {
      id: uid("request"),
      client_id,
      title,
      description,
      priority,
      status: "open",
      created_at: now,
      updated_at: now,
      status_history: [{ status: "open", at: now }],
    };
    requests.push(newRequest);
    saveRequests(requests);
    return newRequest;
  }

  /** @type {Record<RequestStatus, RequestStatus[]>} */
  const valid_transitions = {
    open: ["in_progress"],
    in_progress: ["pending_client", "resolved"],
    pending_client: [],
    resolved: ["closed"],
    closed: [],
  };

  /**
   * @param {RequestStatus} from
   * @param {RequestStatus} to
   * @returns {boolean} whether this status change is allowed
   */
  function canTransition(from, to) {
    return (valid_transitions[from] || []).includes(to);
  }

  /**
   * Applies a status change if — and only if — {@link canTransition} allows it.
   * @param {string} requestId
   * @param {RequestStatus} newStatus
   * @returns {ServiceRequest | null} the updated request, or `null` if the request
   *   doesn't exist or the transition isn't allowed
   */
  function updateRequestStatus(requestId, newStatus) {
    const requests = getRequests();
    const request = requests.find((r) => r.id === requestId);
    if (!request) return null;
    if (!canTransition(request.status, newStatus)) return null;

    const now = new Date().toISOString();
    request.status = newStatus;
    request.updated_at = now;
    request.status_history.push({ status: newStatus, at: now });
    saveRequests(requests);
    return request;
  }

  // --- Assignments -------------------------------------------------------

  /** @returns {Assignment[]} every engineer/request assignment */
  function getAssignments() {
    return /** @type {Assignment[]} */ (read(keys.assignments)) || [];
  }

  /**
   * @param {Assignment[]} assignments
   * @returns {void}
   */
  function saveAssignments(assignments) {
    write(keys.assignments, assignments);
  }

  /**
   * @param {string} requestId
   * @returns {Assignment | undefined}
   */
  function getAssignmentForRequest(requestId) {
    return getAssignments().find((a) => a.request_id === requestId);
  }

  /**
   * Creates the assignment for a request, or updates it if one already
   * exists — a request can only have one active engineer at a time.
   * @param {{ request_id: string, engineer_id: string }} input
   * @returns {Assignment | undefined}
   */
  function assignRequest({ request_id, engineer_id }) {
    const assignments = getAssignments();
    const existing = assignments.find((a) => a.request_id === request_id);
    const now = new Date().toISOString();

    if (existing) {
      existing.engineer_id = engineer_id;
      existing.assigned_at = now;
    } else {
      assignments.push({
        id: uid("assignment"),
        request_id,
        engineer_id,
        assigned_at: now,
      });
    }

    saveAssignments(assignments);
    return getAssignmentForRequest(request_id);
  }

  // --- Comments ------------------------------------------------------

  /** @returns {RequestComment[]} every comment */
  function getComments() {
    return /** @type {RequestComment[]} */ (read(keys.comments)) || [];
  }

  /**
   * @param {RequestComment[]} comments
   * @returns {void}
   */
  function saveComments(comments) {
    write(keys.comments, comments);
  }

  /**
   * @param {string} requestId
   * @param {{ includeInternal: boolean }} options
   * @returns {RequestComment[]} comments for the request, sorted chronologically;
   *   internal comments are excluded when `includeInternal` is false
   */
  function getCommentsForRequest(requestId, { includeInternal }) {
    return getComments()
      .filter((comment) => comment.request_id === requestId)
      .filter((comment) => includeInternal || !comment.is_internal)
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
  }

  /**
   * @param {{ request_id: string, user_id: string, content: string, is_internal: boolean }} input
   * @returns {RequestComment} the created comment
   */
  function addComment({ request_id, user_id, content, is_internal }) {
    const comments = getComments();
    /** @type {RequestComment} */
    const newComment = {
      id: uid("comment"),
      request_id,
      user_id,
      content,
      is_internal,
      created_at: new Date().toISOString(),
    };
    comments.push(newComment);
    saveComments(comments);
    return newComment;
  }

  return {
    init,
    getUsers,
    findUserByEmail,
    getUserById,
    getEngineers,
    createUser,
    updateUser,
    deleteUser,
    getCurrentUser,
    login,
    logout,
    getRequests,
    getRequestById,
    getRequestsForClient,
    getRequestsForEngineer,
    addRequest,
    canTransition,
    updateRequestStatus,
    getAssignments,
    getAssignmentForRequest,
    assignRequest,
    getComments,
    getCommentsForRequest,
    addComment,
  };
};

// Named `storage` (lowercase), not `Storage`, to avoid colliding with the
// DOM's built-in global `Storage` interface (see MDN: Storage — the type
// behind window.localStorage / window.sessionStorage).
const storage = CSP();
storage.init();
