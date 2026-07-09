const CSP = () => {
  const keys = {
    user: "csp_users",
    requests: "csp_requests",
    assignements: "csp_assignements",
    comments: "csp_comments",
    currentUser: "csp_current_user",
    seeded: "csp_seeded",
  };

  function read(key) {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }

  function write(key, value) {
    sessionStorage.setItem(key, JSON.stringify(value));
  }

  function uid(prefix) {
    return prefix + "_" + Math.random().toString(36).substr(2, 9);
  }

  function init() {
    if (sessionStorage.getItem(keys.seeded) === "true") return;

    const seed =
      typeof data !== "undefined"
        ? data
        : { users: [], requests: [], assignements: [], comments: [] };

    write(keys.user, seed.users || []);
    write(keys.requests, seed.requests || []);
    write(keys.assignements, seed.assignements || []);
    write(keys.comments, seed.comments || []);
    sessionStorage.setItem(keys.seeded, "true");
  }

  function getUser() {
    return read(keys.user) || [];
  }

  function findUserByEmail(email) {
    return getUser().find((user) => user.email === email);
  }

  function getUserById(id) {
    return getUser().find((user) => user.id === id);
  }

  function getCurrentUser() {
    return read(keys.currentUser) || null;
  }

  function login(email, password) {
    const user = getUser().find(
      (u) => u.email === email && u.password === password,
    );
    if (!user) return null;
    write(keys.currentUser, user);
    return user;
  }

  function logout() {
    sessionStorage.removeItem(keys.currentUser);
  }

  function getRequests() {
    return read(keys.requests) || [];
  }

  function getAssignements() {
    return read(keys.assignements) || [];
  }

  function saveRequest(requests) {
    write(keys.requests, requests);
  }

  function getRequestById(id) {
    return getRequests().find((request) => request.id === id);
  }

  function getRequestsForClient(clientId) {
    return getRequests().filter((request) => request.client_id === clientId);
  }

  function getRequestsForEngineer(engineerId) {
    const myRequestIds = getAssignements()
      .filter((a) => a.engineer_id === engineerId)
      .map((a) => a.request_id);
    return getRequests().filter((request) => myRequestIds.includes(request.id));
  }

  function addRequest({ client_id, title, description, priority }) {
    const requests = getRequests();
    const now = new Date().toISOString();
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
    saveRequest(requests);
    return newRequest;
  }

  const valid_transitions = {
    open: ["in_progress"],
    in_progress: ["pending_client", "resolved"],
    resolved: ["closed"],
    closed: [],
  };

  function canTransition(from, to) {
    return (valid_transitions[from] || []).includes(to);
  }

  function updateRequestStatus(requestId, newStatus) {
    const requests = getRequests();
    const request = requests.find((r) => r.id === requestId);
    if (!request) return null;
    if (!canTransition(request.status, newStatus)) return null;
    const now = new Date().toISOString();
    request.status = newStatus;
    request.updated_at = now;
    request.status_history.push({ status: newStatus, at: now });
    saveRequest(requests);
    return request;
  }

  function getAssignments() {
    return read(keys.assignements) || [];
  }

  function getAssignedRequestsForEngineer(engineerId) {
    const assignment = getAssignments().find(
      (a) => a.engineer_id === engineerId,
    );
    if (!assignment) return [];
    return assignment.request_ids
      .map((requestId) => getRequestById(requestId))
      .filter(Boolean);
  }

  function getComments() {
    return read(keys.comments) || [];
  }

  function saveComments(comments) {
    write(keys.comments, comments);
  }

  function getCommentsForRequest(requestId, { includeInternal }) {
    return getComments()
      .filter((c) => c.request_id === requestId)
      .filter((c) => includeInternal || !c.is_internal)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }

  function addComment({ request_id, user_id, content, is_internal }) {
    const comments = getComments();
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
    getUser,
    findUserByEmail,
    getUserById,
    getCurrentUser,
    login,
    logout,
    getRequests,
    getAssignments,
    saveRequest,
    getRequestById,
    getRequestsForClient,
    getRequestsForEngineer,
    addRequest,
    canTransition,
    updateRequestStatus,
    getAssignedRequestsForEngineer,
    getComments,
    saveComments,
    getCommentsForRequest,
    addComment,
  };
};

const Storage = CSP();
Storage.init();
