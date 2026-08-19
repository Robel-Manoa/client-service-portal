// @ts-check

/**
 * Page orchestration for the Client Service Portal.
 *
 * This single script is loaded on every page (see each `pages/*.html`
 * file). Each section below only runs on the page it belongs to — it
 * checks for one DOM element that only exists on that page, and bails
 * out immediately if it's not there. That's what lets one script safely
 * drive several different pages. api (script/api.js) is the shared
 * data layer; this file only ever reads through it and manipulates the DOM.
 */

/** @type {RequestStatus[]} */
const ALL_STATUSES = [
  "open",
  "in_progress",
  "pending_client",
  "resolved",
  "closed",
];

/**
 * Clones a <template>'s content and fills its text-only [data-field]
 * slots. Using <template> instead of building markup from string
 * interpolation keeps user-entered values (names, titles, comments, ...)
 * out of innerHTML entirely, so there's no HTML-escaping to get right.
 * @param {HTMLTemplateElement} template
 * @param {Record<string, string>} fields
 * @returns {DocumentFragment}
 */
function cloneTemplate(template, fields) {
  const fragment = /** @type {DocumentFragment} */ (
    template.content.cloneNode(true)
  );
  for (const [field, value] of Object.entries(fields)) {
    const el = fragment.querySelector(`[data-field="${field}"]`);
    if (el) el.textContent = value;
  }
  return fragment;
}

/**
 * Access-control gatekeeper. Redirects to the login page if no one is
 * logged in, or if the logged-in user's role isn't part of requiredRole.
 * @param {UserRole | UserRole[]} [requiredRole] a single role or list of allowed roles
 * @returns {User | null} the current user, or `null` if redirected away
 */
function requireAuth(requiredRole) {
  const user = api.getCurrentUser();
  if (!user) {
    window.location.href = ROUTES.login();
    return null;
  }
  if (requiredRole) {
    const allowedRoles = Array.isArray(requiredRole)
      ? requiredRole
      : [requiredRole];
    if (!allowedRoles.includes(user.role)) {
      window.location.href = ROUTES.login();
      return null;
    }
  }
  return user;
}

/**
 * Turns a failed api.js call into a message worth showing the user:
 * field-level validation errors (400) are joined into one string,
 * everything else falls back to the backend's own error message.
 * @param {unknown} err
 * @returns {string}
 */
function describeError(err) {
  if (err instanceof ApiError && err.details && err.details.length) {
    return err.details.map((detail) => detail.message).join("\n");
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong. Please try again.";
}

// --- Login (index.html) ---------------------------------------------------

const loginForm = /** @type {HTMLFormElement | null} */ (
  document.getElementById("loginForm")
);

if (loginForm) {
  loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const email = /** @type {HTMLInputElement} */ (
      document.getElementById("email")
    ).value;
    const password = /** @type {HTMLInputElement} */ (
      document.getElementById("password")
    ).value;

    try {
      const user = await api.login(email, password);
      window.location.href = ROUTES.home(user.role);
    } catch (err) {
      alert(
        err instanceof ApiError && err.status === 401
          ? "Invalid email or password. Please try again."
          : describeError(err),
      );
    }
  });
}

// --- Logout (every protected page) -----------------------------------------

const logoutButton = document.getElementById("logoutButton");

if (logoutButton) {
  logoutButton.addEventListener("click", function (event) {
    event.preventDefault();
    api.logout();
    window.location.href = ROUTES.login();
  });
}

// --- Show/hide admin panels (client-list.html, detail-users.html) ----------
//
// These four are called from inline onclick="..." attributes in the HTML,
// which only works if they're real global functions — they can't live
// inside the page-init functions below. Each pair only exists on its own
// page, so the other page's lookup is null and simply does nothing.

const adminActions = document.getElementById("admin-actions");
const editUserActions = document.getElementById("user-admin-actions");

/** @returns {void} */
function showForm() {
  if (adminActions) adminActions.style.display = "block";
}

/** @returns {void} */
function removeForm() {
  if (adminActions) adminActions.style.display = "none";
}

/** @returns {void} */
function showFormEdit() {
  if (editUserActions) editUserActions.style.display = "block";
}

/** @returns {void} */
function removeFormEdit() {
  if (editUserActions) editUserActions.style.display = "none";
}

// --- Client list (client-list.html) -----------------------------------

(function initClientListPage() {
  const clientsList = document.getElementById("clients-list");
  if (!clientsList) return;

  const userRowTemplate = /** @type {HTMLTemplateElement | null} */ (
    document.getElementById("user-row-template")
  );
  const addUserForm = /** @type {HTMLFormElement | null} */ (
    document.getElementById("add-user-form")
  );

  // The list itself is GET /api/users, which the backend only allows for
  // admins — engineers can no longer see this page.
  const currentUser = requireAuth("admin");
  if (!currentUser) return;

  const homeLink = document.getElementById("homeLink");
  if (homeLink instanceof HTMLAnchorElement) {
    homeLink.href = ROUTES.home(currentUser.role);
  }

  // Written as `const renderUserList = (users) => {}` rather than
  // `function renderUserList(users) {}`: TypeScript only trusts the
  // `if (!clientsList) return` check above for the rest of *this*
  // function's own body, not for a separately hoisted nested function —
  // so a `function` declaration here would need its own redundant null
  // check on `clientsList` to type-check. An arrow function assigned to a
  // `const`, defined inline at this point, keeps that check in scope.
  // The same reasoning applies everywhere else in this file you see this
  // `const fn = () => {}` shape instead of a plain `function fn() {}`.

  /** @type {(users: User[]) => void} */
  const renderUserList = (users) => {
    if (!userRowTemplate) return;
    clientsList.innerHTML = "";

    users.forEach((user) => {
      const row = cloneTemplate(userRowTemplate, {
        name: user.name,
        email: user.email,
        role: user.role,
      });

      row
        .querySelector('[data-field="role"]')
        ?.classList.add(`role-badge--${user.role}`);

      const link = /** @type {HTMLAnchorElement | null} */ (
        row.querySelector('[data-field="link"]')
      );
      if (link) {
        link.href = ROUTES.userDetail(user.id);
      }

      clientsList.appendChild(row);
    });
  };

  api
    .getUsers()
    .then(renderUserList)
    .catch((err) => {
      alert(describeError(err));
    });

  if (!addUserForm) return;

  addUserForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    // Read "name" and "role" by id, not addUserForm.name/.role:
    // HTMLFormElement already has its own name IDL attribute, and every
    // Element already has a role IDL attribute (ARIA reflection). Both
    // silently shadow a same-named child control accessed via dot
    // notation, so form.name / form.role would never reach these inputs.
    const nameInput = /** @type {HTMLInputElement} */ (
      document.getElementById("add-user-name")
    );
    const roleSelect = /** @type {HTMLSelectElement} */ (
      document.getElementById("add-user-role")
    );

    try {
      await api.createUser({
        name: nameInput.value,
        email: addUserForm.email.value,
        password: addUserForm.password.value,
        role: /** @type {UserRole} */ (roleSelect.value),
      });
      addUserForm.reset();
      renderUserList(await api.getUsers());
    } catch (err) {
      alert(describeError(err));
    }
  });
})();

// --- Dashboards (index-{admin,client,engineer}.html) ------------------

(function initDashboardPage() {
  const tableBody = document.getElementById("requests-table-body");
  const requestRowTemplate = /** @type {HTMLTemplateElement | null} */ (
    document.getElementById("request-row-template")
  );
  const filterForm = document.getElementById("filterForm");
  const filterInput = /** @type {HTMLInputElement | null} */ (
    document.getElementById("filterInput")
  );
  const pageRole = /** @type {UserRole | undefined} */ (
    /** @type {HTMLElement} */ (document.body).dataset.role
  );

  if (
    !tableBody ||
    !requestRowTemplate ||
    !filterForm ||
    !filterInput ||
    !pageRole
  ) {
    return;
  }

  const currentUser = requireAuth(pageRole);
  if (!currentUser) return;

  /** @type {(requests: ServiceRequest[]) => void} */
  const renderRequestsTable = (requests) => {
    tableBody.innerHTML = "";

    requests.forEach((request) => {
      const row = cloneTemplate(requestRowTemplate, {
        title: request.title,
        priority: request.priority,
        status: request.status,
        created_at: request.created_at,
      });

      const link = /** @type {HTMLAnchorElement | null} */ (
        row.querySelector('[data-field="link"]')
      );
      if (link) {
        link.href = ROUTES.requestDetail(request.id);
      }

      tableBody.appendChild(row);
    });
  };

  // GET /api/requests is already scoped server-side to the caller's role
  // (admin sees all, engineer sees their assignments, client sees their
  // own), so this one call is correct for every dashboard.
  let allRequests = /** @type {ServiceRequest[]} */ ([]);

  api
    .getRequests()
    .then((requests) => {
      allRequests = requests;
      renderRequestsTable(allRequests);
    })
    .catch((err) => {
      alert(describeError(err));
    });

  filterForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const selectedStatus = filterInput.value.toLowerCase();
    const requestsToShow =
      selectedStatus === "all"
        ? allRequests
        : allRequests.filter(
            (request) => request.status.toLowerCase() === selectedStatus,
          );

    renderRequestsTable(requestsToShow);
  });
})();

// --- Add request (add-request.html) -----------------------------------

(function initAddRequestPage() {
  const addRequestForm = /** @type {HTMLFormElement | null} */ (
    document.getElementById("add-request-form")
  );
  if (!addRequestForm) return;

  if (!requireAuth("client")) return;

  addRequestForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    // Read by id, not addRequestForm.title: every HTMLElement already has
    // its own title IDL attribute (tooltip text), which shadows a child
    // input named "title".
    const titleInput = /** @type {HTMLInputElement} */ (
      document.getElementById("title")
    );

    try {
      // No client_id in this payload — the server reads the owner from
      // the caller's token, it doesn't trust the client to say who they are.
      await api.createRequest({
        title: titleInput.value,
        description: addRequestForm.description.value,
        priority: /** @type {ServiceRequestPriority} */ (
          addRequestForm.priority.value
        ),
      });
      window.location.href = ROUTES.home("client");
    } catch (err) {
      alert(describeError(err));
    }
  });
})();

// --- Request detail (request-detail.html) ------------------------------

(function initRequestDetailPage() {
  const requestInfo = document.getElementById("request-info");
  if (!requestInfo) return;

  const currentUser = requireAuth();
  if (!currentUser) return;

  const homeLink = document.getElementById("homeLink");
  if (homeLink instanceof HTMLAnchorElement) {
    homeLink.href = ROUTES.home(currentUser.role);
  }

  const requestId = /** @type {string} */ (
    new URLSearchParams(window.location.search).get("id")
  );
  const statusHistoryList = document.getElementById("status-history");
  const statusControls = document.getElementById("status-controls");
  const commentsList = document.getElementById("comments-list");
  const addCommentForm = /** @type {HTMLFormElement | null} */ (
    document.getElementById("add-comment-form")
  );
  const internalCommentLabel = document.getElementById(
    "internal-comment-label",
  );
  const assignmentSection = document.getElementById("assignment-section");
  const assignEngineerForm = /** @type {HTMLFormElement | null} */ (
    document.getElementById("assign-engineer-form")
  );
  const assignEngineerSelect = /** @type {HTMLSelectElement | null} */ (
    document.getElementById("assign-engineer-select")
  );
  const deleteRequestButton = document.getElementById("delete-request-button");

  // Only clients need this hidden — everyone else may leave internal notes.
  if (internalCommentLabel && currentUser.role === "client") {
    internalCommentLabel.style.display = "none";
  }

  // Only an admin can assign engineers, so everyone else loses the whole
  // section instead of just seeing a form that would 403 on submit.
  if (assignmentSection) {
    if (currentUser.role === "admin") {
      api
        .getEngineers()
        .then((engineers) => {
          engineers.forEach((engineer) => {
            const option = document.createElement("option");
            option.value = engineer.id;
            option.textContent = engineer.name;
            assignEngineerSelect?.appendChild(option);
          });
        })
        .catch((err) => alert(describeError(err)));
    } else {
      assignmentSection.style.display = "none";
    }
  }

  if (deleteRequestButton) {
    if (currentUser.role !== "admin") {
      deleteRequestButton.remove();
    } else {
      deleteRequestButton.addEventListener("click", async function () {
        if (!confirm("Delete this request? This cannot be undone.")) return;

        try {
          await api.deleteRequest(requestId);
          window.location.href = ROUTES.home(currentUser.role);
        } catch (err) {
          alert(describeError(err));
        }
      });
    }
  }

  // The functions below read `currentUser`/`requestInfo`, so they're
  // `const name = () => {...}` rather than `function name() {...}` — see
  // the note by renderUserList (in initClientListPage, above) for why.

  /**
   * Resolving a name needs GET /api/users/:id, which clients aren't
   * allowed to call — so a client viewer only ever gets their own name
   * (from currentUser, no API call needed) plus a generic label for
   * everyone else. That's safe because a client only ever sees comments
   * on their own request, whose other authors can only be staff (never
   * another client) — the server already enforces that ownership check.
   * @type {() => Promise<void>}
   */
  const renderComments = async () => {
    if (!commentsList) return;

    try {
      const comments = await api.getCommentsForRequest(requestId);
      commentsList.innerHTML = "";

      /** @type {Map<string, string>} */
      const authorNames = new Map();
      if (currentUser.role !== "client") {
        const uniqueAuthorIds = [...new Set(comments.map((c) => c.author_id))];
        await Promise.all(
          uniqueAuthorIds.map(async (id) => {
            try {
              const author = await api.getUserById(id);
              authorNames.set(id, author.name);
            } catch {
              authorNames.set(id, "Unknown User");
            }
          }),
        );
      }

      comments.forEach((comment) => {
        const authorName =
          comment.author_id === currentUser.id
            ? currentUser.name
            : authorNames.get(comment.author_id) || "Staff";

        const li = document.createElement("li");
        li.textContent = `${authorName}${
          comment.visibility === "internal" ? " (internal)" : ""
        }: ${comment.body} - ${comment.created_at}`;
        commentsList.appendChild(li);
      });
    } catch (err) {
      alert(describeError(err));
    }
  };

  /** @type {() => void} */
  const showRequestNotFound = () => {
    requestInfo.innerHTML = "<p>Request not found.</p>";
    if (statusHistoryList) statusHistoryList.innerHTML = "";
    if (statusControls) statusControls.innerHTML = "";
    if (commentsList) commentsList.innerHTML = "";
  };

  /**
   * @type {(request: ServiceRequest) => Promise<void>}
   */
  const renderRequestFields = async (request) => {
    /** @type {(id: string, text: string) => void} */
    const setText = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    setText("request-title", request.title);
    setText("request-description", request.description);
    setText("request-priority", request.priority);
    setText("request-status", request.status);
    setText("request-created", request.created_at);

    let engineerName = "Unassigned";

    if (request.assigned_engineer_id) {
      // GET /api/users/:id is admin/engineer-only — clients get a generic
      // label instead of a doomed lookup that would just 403.
      if (currentUser.role === "client") {
        engineerName = "Assigned";
      } else {
        try {
          const assignedEngineer = await api.getUserById(
            request.assigned_engineer_id,
          );
          engineerName = assignedEngineer.name;
        } catch {
          engineerName = "Unknown Engineer";
        }
      }
    }

    setText("request-assigned-engineer", engineerName);

    if (assignEngineerSelect) {
      assignEngineerSelect.value = request.assigned_engineer_id || "";
    }
  };

  /**
   * @param {StatusHistoryEntry[] | undefined} statusHistory
   * @returns {void}
   */
  function renderStatusHistory(statusHistory) {
    if (!statusHistoryList) return;
    statusHistoryList.innerHTML = "";
    (statusHistory || []).forEach((entry) => {
      const li = document.createElement("li");
      li.textContent = `${entry.status} - ${entry.at}`;
      statusHistoryList.appendChild(li);
    });
  }

  /**
   * What `currentStatus` may legally change to, for the current user's
   * role. This mirrors the backend's exact rules
   * (request.controller.ts::updateRequestStatus) instead of a generic
   * state machine: clients can never change status, engineers may only
   * resolve an open request and nothing else, admins may set any status.
   * @type {(currentStatus: RequestStatus) => RequestStatus[]}
   */
  const getAvailableNextStatuses = (currentStatus) => {
    if (currentUser.role === "admin") {
      return ALL_STATUSES.filter((status) => status !== currentStatus);
    }
    if (currentUser.role === "engineer") {
      return currentStatus === "open" ? ["resolved"] : [];
    }
    return [];
  };

  /**
   * @param {RequestStatus} currentStatus
   * @returns {void}
   */
  function renderStatusControls(currentStatus) {
    if (!statusControls) return;
    statusControls.innerHTML = "";

    getAvailableNextStatuses(currentStatus).forEach((status) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `Move to ${status}`;
      button.dataset.status = status;
      statusControls.appendChild(button);
    });
  }

  /** @type {() => Promise<void>} */
  const renderRequest = async () => {
    let request;
    try {
      request = await api.getRequestById(requestId);
    } catch {
      showRequestNotFound();
      return;
    }

    await renderRequestFields(request);
    renderStatusHistory(request.status_history);
    renderStatusControls(request.status);
    await renderComments();
  };

  // One listener on the buttons' stable parent instead of one per button,
  // since the buttons themselves are thrown away and rebuilt on every render.
  if (statusControls) {
    statusControls.addEventListener("click", async function (event) {
      const button = /** @type {HTMLElement} */ (event.target).closest(
        "button[data-status]",
      );
      // The instanceof check isn't just a null guard: .closest() returns
      // a plain Element, and .dataset below needs the more specific
      // HTMLElement to type-check.
      if (!button || !(button instanceof HTMLElement)) return;

      const status = /** @type {RequestStatus} */ (button.dataset.status);

      try {
        await api.updateRequestStatus(requestId, status);
        await renderRequest();
      } catch (err) {
        alert(describeError(err));
      }
    });
  }

  if (assignEngineerForm && currentUser.role === "admin") {
    assignEngineerForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!assignEngineerSelect) return;

      const engineerId = assignEngineerSelect.value;
      if (!engineerId) return;

      try {
        await api.assignEngineer(requestId, engineerId);
        await renderRequest();
      } catch (err) {
        alert(describeError(err));
      }
    });
  }

  if (addCommentForm) {
    addCommentForm.addEventListener("submit", async function (event) {
      event.preventDefault();

      const content = addCommentForm.content.value.trim();
      if (!content) return;

      const isInternal =
        currentUser.role !== "client" && addCommentForm.is_internal.checked;

      try {
        await api.addComment(requestId, {
          body: content,
          visibility: isInternal ? "internal" : "public",
        });
        addCommentForm.reset();
        await renderComments();
      } catch (err) {
        alert(describeError(err));
      }
    });
  }

  renderRequest();
})();

// --- User detail (detail-users.html) ------------------------------------

(function initUserDetailPage() {
  const userProfile = document.querySelector(".user-profile");
  if (!userProfile) return;

  const currentUser = requireAuth(["admin", "engineer"]);
  if (!currentUser) return;

  const homeLink = document.getElementById("homeLink");
  if (homeLink instanceof HTMLAnchorElement) {
    homeLink.href = ROUTES.home(currentUser.role);
  }

  const userId = /** @type {string} */ (
    new URLSearchParams(window.location.search).get("id")
  );
  const requestsSection = document.getElementById("user-requests-section");
  const requestsList = document.getElementById("user-requests-list");
  const adminSection = document.getElementById("user-admin-actions");
  const editUserForm = /** @type {HTMLFormElement | null} */ (
    document.getElementById("edit-user-form")
  );
  const deleteUserButton = document.getElementById("delete-user-button");
  const userRequestRowTemplate = /** @type {HTMLTemplateElement | null} */ (
    document.getElementById("user-request-row-template")
  );
  // Read/write these fields by id, not editUserForm.name/.role — same
  // IDL-attribute shadowing as the add-user form above.
  const editUserNameInput = /** @type {HTMLInputElement | null} */ (
    document.getElementById("edit-user-name")
  );
  const editUserRoleSelect = /** @type {HTMLSelectElement | null} */ (
    document.getElementById("edit-user-role")
  );

  if (currentUser.role !== "admin" && adminSection) {
    adminSection.remove();
  }

  // These read `currentUser`/`userProfile`, so they're `const name = () =>
  // {}` rather than `function name() {}` — see the note by renderUserList
  // (in initClientListPage, near the top of this file) for why.

  /**
   * Only an admin's request list is complete enough to filter by an
   * arbitrary user's id — GET /api/requests is scoped to the caller for
   * every other role, so an engineer looking at someone else's profile
   * has no backend call that could honestly fill this in.
   * @type {(user: User) => Promise<void>}
   */
  const renderUserRequests = async (user) => {
    if (!requestsList || !requestsSection || !userRequestRowTemplate) return;

    const viewerCanSeeTheseRequests =
      currentUser.role === "admin" &&
      (user.role === "client" || user.role === "engineer");
    if (!viewerCanSeeTheseRequests) {
      requestsSection.style.display = "none";
      return;
    }

    let allRequests;
    try {
      allRequests = await api.getRequests();
    } catch {
      requestsSection.style.display = "none";
      return;
    }

    const requests = allRequests.filter((request) =>
      user.role === "client"
        ? request.client_id === user.id
        : request.assigned_engineer_id === user.id,
    );

    if (!requests.length) {
      requestsSection.style.display = "none";
      return;
    }

    requestsSection.style.display = "";
    requestsList.innerHTML = "";
    requests.forEach((request) => {
      const row = cloneTemplate(userRequestRowTemplate, {
        title: request.title,
        description: request.description,
        priority: request.priority,
        status: request.status,
      });

      const link = /** @type {HTMLAnchorElement | null} */ (
        row.querySelector('[data-field="link"]')
      );
      if (link) {
        link.href = ROUTES.requestDetail(request.id);
      }

      requestsList.appendChild(row);
    });
  };

  /** @type {() => Promise<void>} */
  const renderUser = async () => {
    let user;
    try {
      user = await api.getUserById(userId);
    } catch {
      userProfile.innerHTML = "<p>User not found.</p>";
      if (adminSection) adminSection.remove();
      return;
    }

    /** @type {(id: string, text: string) => void} */
    const setText = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    setText("id-user", user.id);
    setText("name-user", user.name);
    setText("email-user", user.email);
    setText("role-user", user.role);
    setText("account-user", user.is_active ? "Active" : "Inactive");

    await renderUserRequests(user);

    if (
      editUserForm &&
      currentUser.role === "admin" &&
      editUserNameInput &&
      editUserRoleSelect
    ) {
      editUserNameInput.value = user.name;
      editUserForm.email.value = user.email;
      editUserRoleSelect.value = user.role;
      editUserForm.is_active.checked = user.is_active;
    }
  };

  if (editUserForm) {
    editUserForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!editUserNameInput || !editUserRoleSelect) return;

      try {
        await api.updateUser(userId, {
          name: editUserNameInput.value,
          email: editUserForm.email.value,
          role: /** @type {UserRole} */ (editUserRoleSelect.value),
          is_active: editUserForm.is_active.checked,
        });
        await renderUser();
      } catch (err) {
        alert(describeError(err));
      }
    });
  }

  if (deleteUserButton) {
    deleteUserButton.addEventListener("click", async function () {
      if (userId === currentUser.id) {
        alert("You cannot delete your own account.");
        return;
      }

      try {
        await api.deleteUser(userId);
        window.location.href = ROUTES.clientList();
      } catch (err) {
        alert(describeError(err));
      }
    });
  }

  renderUser();
})();
