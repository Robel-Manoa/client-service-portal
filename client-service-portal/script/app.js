// @ts-check

/**
 * Page orchestration for the Client Service Portal.
 *
 * This single script is loaded on every page (see each `pages/*.html`
 * file). Each block below guards itself behind the DOM elements it
 * needs, so one script can safely drive several different pages without erroring on elements
 * that don't exist there. storage (script/storage.js) is the shared
 * data layer; this file only ever reads through it and manipulates the
 * DOM — it never touches sessionStorage directly.
 */

const ROLE_HOME = {
  client: "./index-client.html",
  engineer: "./index-engineer.html",
  admin: "./index-admin.html",
};

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
 * slots. Using native <template> instead of building markup from string interpolation keeps
 * user-entered values (names, titles, comments, ...) out of innerHTML
 * entirely, so there is no HTML-escaping to get right or forget.
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
 * Access-control gatekeeper. Redirects to the login page if no user is
 * logged in, or if the logged-in user's role isn't part of requiredRole.
 * @param {UserRole | UserRole[]} [requiredRole] a single role or list of allowed roles
 * @returns {User | null} the current user, or `null` if redirected away
 */
function requireAuth(requiredRole) {
  const user = storage.getCurrentUser();
  if (!user) {
    window.location.href = "../index.html";
    return null;
  }
  if (requiredRole) {
    const allowedRoles = Array.isArray(requiredRole)
      ? requiredRole
      : [requiredRole];
    if (!allowedRoles.includes(user.role)) {
      window.location.href = "../index.html";
      return null;
    }
  }
  return user;
}

// --- Login / logout -----------------------------------------------------

const loginForm = /** @type {HTMLFormElement | null} */ (
  document.getElementById("loginForm")
);

if (loginForm) {
  loginForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const email = /** @type {HTMLInputElement} */ (
      document.getElementById("email")
    ).value;
    const password = /** @type {HTMLInputElement} */ (
      document.getElementById("password")
    ).value;
    const errorMessage = document.querySelector(".error-message");

    const user = storage.login(email, password);
    if (!user) {
      if (errorMessage) {
        errorMessage.textContent =
          "Invalid email or password. Please try again.";
      }
      return;
    }

    window.location.href = "pages/index-" + user.role + ".html";
  });
}

const logoutButton = document.getElementById("logoutButton");

if (logoutButton) {
  logoutButton.addEventListener("click", function (event) {
    event.preventDefault();

    storage.logout();
    window.location.href = "../index.html";
  });
}

// --- User list (client-list.html) ---------------------------------------

const lists = document.getElementById("clients-list");
const userRowTemplate = /** @type {HTMLTemplateElement | null} */ (
  document.getElementById("user-row-template")
);

/**
 * Renders the user table on the admin/engineer client list page.
 * @param {User[]} users
 * @returns {void}
 */
function userList(users) {
  if (!lists || !userRowTemplate) return;
  lists.innerHTML = "";

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
      link.href = `./detail-users.html?id=${encodeURIComponent(user.id)}`;
    }

    lists.appendChild(row);
  });
}

const addUserForm = /** @type {HTMLFormElement | null} */ (
  document.getElementById("add-user-form")
);
const adminActions = document.getElementById("admin-actions");
const editUser = document.getElementById("user-admin-actions");

// Called from inline onclick attributes in client-list.html and
// detail-users.html — each pair only ever exists on its own page, so a
// missing element (null) is expected on the other page and simply ignored.

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
  if (editUser) editUser.style.display = "block";
}

/** @returns {void} */
function removeFormEdit() {
  if (editUser) editUser.style.display = "none";
}

if (lists) {
  const currentUser = requireAuth(["admin", "engineer"]);

  if (currentUser) {
    const homeLink = document.getElementById("homeLink");
    if (homeLink instanceof HTMLAnchorElement) {
      homeLink.href = ROLE_HOME[currentUser.role];
    }

    userList(storage.getUsers());

    if (currentUser.role === "admin") {
      if (addUserForm) {
        addUserForm.addEventListener("submit", function (event) {
          event.preventDefault();

          // Read "name" and "role" by id, not addUserForm.name/.role:
          // HTMLFormElement already has its own name IDL attribute, and
          // every Element already has a role IDL attribute.
          // Both shadow a same-named child control accessed via dot
          // notation, so the bare form.name / form.role never reach the
          // input/select below.
          const nameInput = /** @type {HTMLInputElement} */ (
            document.getElementById("add-user-name")
          );
          const roleSelect = /** @type {HTMLSelectElement} */ (
            document.getElementById("add-user-role")
          );

          const created = storage.createUser({
            name: nameInput.value,
            email: addUserForm.email.value,
            password: addUserForm.password.value,
            role: /** @type {UserRole} */ (roleSelect.value),
          });

          if (!created) {
            alert("A user with this email already exists.");
            return;
          }

          addUserForm.reset();
          userList(storage.getUsers());
        });
      }
    } else if (adminActions) {
      adminActions.remove();
    }
  }
}

// --- Requests table (dashboards) -----------------------------------------

const tableBody = document.getElementById("requests-table-body");
const requestRowTemplate = /** @type {HTMLTemplateElement | null} */ (
  document.getElementById("request-row-template")
);
const form = document.getElementById("filterForm");
const filterInput = /** @type {HTMLInputElement | null} */ (
  document.getElementById("filterInput")
);
const pageRole = /** @type {UserRole | undefined} */ (
  /** @type {HTMLElement} */ (document.body).dataset.role
);

/**
 * Renders the requests table shared by the client, engineer, and admin
 * dashboards.
 * @param {ServiceRequest[]} requests
 * @returns {void}
 */
function renderTable(requests) {
  if (!tableBody || !requestRowTemplate) return;
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
      link.href = `./request-detail.html?id=${encodeURIComponent(request.id)}`;
    }

    tableBody.appendChild(row);
  });
}

if (tableBody && form && filterInput && pageRole) {
  const currentUser = requireAuth(pageRole);

  if (currentUser) {
    let requests = /** @type {ServiceRequest[]} */ ([]);
    if (pageRole === "client")
      requests = storage.getRequestsForClient(currentUser.id);
    else if (pageRole === "engineer")
      requests = storage.getRequestsForEngineer(currentUser.id);
    else if (pageRole === "admin") requests = storage.getRequests();

    renderTable(requests);

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      const selectedStatus = filterInput.value.toLowerCase();
      if (selectedStatus === "all") {
        renderTable(requests);
        return;
      }

      const filteredData = requests.filter((request) => {
        return request.status.toLowerCase() === selectedStatus;
      });

      renderTable(filteredData);
    });
  }
}

// --- Add request (add-request.html) --------------------------------------

const addRequestForm = /** @type {HTMLFormElement | null} */ (
  document.getElementById("add-request-form")
);

if (addRequestForm) {
  const currentUser = requireAuth("client");

  if (currentUser) {
    addRequestForm.addEventListener("submit", function (event) {
      event.preventDefault();

      // Read by id, not addRequestForm.title: every HTMLElement already
      // has its own title IDL attribute, which shadows the child input named "title".
      const titleInput = /** @type {HTMLInputElement} */ (
        document.getElementById("title")
      );

      storage.addRequest({
        client_id: currentUser.id,
        title: titleInput.value,
        description: addRequestForm.description.value,
        priority: addRequestForm.priority.value,
      });

      window.location.href = "./index-client.html";
    });
  }
}

// --- Request detail (request-detail.html) --------------------------------

const requestInfo = document.getElementById("request-info");

if (requestInfo) {
  const currentUser = requireAuth();

  if (currentUser) {
    const homeLink = document.getElementById("homeLink");
    if (homeLink instanceof HTMLAnchorElement) {
      homeLink.href = ROLE_HOME[currentUser.role];
    }

    const params = new URLSearchParams(window.location.search);
    const requestId = /** @type {string} */ (params.get("id"));
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

    if (internalCommentLabel && currentUser.role === "client") {
      internalCommentLabel.style.display = "none";
    }

    if (assignmentSection) {
      if (currentUser.role === "admin") {
        storage.getEngineers().forEach((engineer) => {
          const option = document.createElement("option");
          option.value = engineer.id;
          option.textContent = engineer.name;
          assignEngineerSelect?.appendChild(option);
        });
      } else {
        assignmentSection.style.display = "none";
      }
    }

    /** @returns {void} */
    function renderComments() {
      if (!commentsList || !currentUser) return;
      commentsList.innerHTML = "";
      const includeInternal = currentUser.role !== "client";
      const comments = storage.getCommentsForRequest(requestId, {
        includeInternal,
      });

      comments.forEach((comment) => {
        const author = storage.getUserById(comment.user_id);
        const li = document.createElement("li");
        // textContent (not innerHTML): no escaping needed, safe by construction.
        li.textContent = `${author ? author.name : "Unknown"}${
          comment.is_internal ? " (internal)" : ""
        }: ${comment.content} - ${comment.created_at}`;
        commentsList.appendChild(li);
      });
    }

    /** @returns {void} */
    function renderRequest() {
      if (!currentUser) return;
      const request = storage.getRequestById(requestId);

      if (!request) {
        if (requestInfo) requestInfo.innerHTML = "<p>Request not found.</p>";
        if (statusHistoryList) statusHistoryList.innerHTML = "";
        if (statusControls) statusControls.innerHTML = "";
        if (commentsList) commentsList.innerHTML = "";
        return;
      }

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

      const assignment = storage.getAssignmentForRequest(request.id);
      const assignedEngineer = assignment
        ? storage.getUserById(assignment.engineer_id)
        : null;
      setText(
        "request-assigned-engineer",
        assignedEngineer ? assignedEngineer.name : "Unassigned",
      );
      if (assignEngineerSelect) {
        assignEngineerSelect.value = assignment ? assignment.engineer_id : "";
      }

      if (statusHistoryList) {
        statusHistoryList.innerHTML = "";
        (request.status_history || []).forEach((entry) => {
          const li = document.createElement("li");
          li.textContent = `${entry.status} - ${entry.at}`;
          statusHistoryList.appendChild(li);
        });
      }

      if (statusControls) {
        statusControls.innerHTML = "";
        if (currentUser.role !== "client") {
          const nextStatuses = ALL_STATUSES.filter((status) =>
            storage.canTransition(request.status, status),
          );

          nextStatuses.forEach((status) => {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = `Move to ${status}`;
            button.dataset.status = status;
            statusControls.appendChild(button);
          });
        }
      }

      renderComments();
    }

    // Event delegation: the status buttons above are recreated on every render, so a single listener on their stable parent avoids re-attaching one listener per button on every status change.
    if (statusControls) {
      statusControls.addEventListener("click", function (event) {
        const button = /** @type {HTMLElement} */ (event.target).closest(
          "button[data-status]",
        );
        if (!button || !(button instanceof HTMLElement)) return;

        const status = /** @type {RequestStatus} */ (button.dataset.status);
        storage.updateRequestStatus(requestId, status);
        renderRequest();
      });
    }

    if (assignEngineerForm && currentUser.role === "admin") {
      assignEngineerForm.addEventListener("submit", function (event) {
        event.preventDefault();
        if (!assignEngineerSelect) return;

        const engineerId = assignEngineerSelect.value;
        if (!engineerId) return;

        storage.assignRequest({
          request_id: requestId,
          engineer_id: engineerId,
        });
        renderRequest();
      });
    }

    if (addCommentForm) {
      addCommentForm.addEventListener("submit", function (event) {
        event.preventDefault();

        const content = addCommentForm.content.value.trim();
        if (!content) return;

        const isInternal =
          currentUser.role !== "client" && addCommentForm.is_internal.checked;

        storage.addComment({
          request_id: requestId,
          user_id: currentUser.id,
          content,
          is_internal: isInternal,
        });

        addCommentForm.reset();
        renderComments();
      });
    }

    renderRequest();
  }
}

// --- User detail (detail-users.html) --------------------------------------

const userProfile = document.querySelector(".user-profile");

if (userProfile) {
  const currentUser = requireAuth(["admin", "engineer"]);

  if (currentUser) {
    const homeLink = document.getElementById("homeLink");
    if (homeLink instanceof HTMLAnchorElement) {
      homeLink.href = ROLE_HOME[currentUser.role];
    }

    const params = new URLSearchParams(window.location.search);
    const userId = /** @type {string} */ (params.get("id"));

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
    // Read/write these fields by id, not editUserForm.name/.role
    const editUserNameInput = /** @type {HTMLInputElement | null} */ (
      document.getElementById("edit-user-name")
    );
    const editUserRoleSelect = /** @type {HTMLSelectElement | null} */ (
      document.getElementById("edit-user-role")
    );

    if (currentUser.role !== "admin" && adminSection) {
      adminSection.remove();
    }

    /**
     * @param {User} user
     * @returns {void}
     */
    function renderUserRequests(user) {
      if (!requestsList || !requestsSection || !userRequestRowTemplate) return;
      requestsList.innerHTML = "";

      let requests = /** @type {ServiceRequest[]} */ ([]);
      if (user.role === "client")
        requests = storage.getRequestsForClient(user.id);
      else if (user.role === "engineer")
        requests = storage.getRequestsForEngineer(user.id);

      if (!requests.length) {
        requestsSection.style.display = "none";
        return;
      }

      requestsSection.style.display = "";
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
          link.href = `./request-detail.html?id=${encodeURIComponent(request.id)}`;
        }

        requestsList.appendChild(row);
      });
    }

    /** @returns {void} */
    function renderUser() {
      if (!currentUser) return;
      const user = storage.getUserById(userId);

      if (!user) {
        if (userProfile) userProfile.innerHTML = "<p>User not found.</p>";
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

      renderUserRequests(user);

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
    }

    if (editUserForm) {
      editUserForm.addEventListener("submit", function (event) {
        event.preventDefault();
        if (!editUserNameInput || !editUserRoleSelect) return;

        storage.updateUser(userId, {
          name: editUserNameInput.value,
          email: editUserForm.email.value,
          role: /** @type {UserRole} */ (editUserRoleSelect.value),
          is_active: editUserForm.is_active.checked,
        });

        renderUser();
      });
    }

    if (deleteUserButton) {
      deleteUserButton.addEventListener("click", function () {
        if (userId === currentUser.id) {
          alert("You cannot delete your own account.");
          return;
        }

        storage.deleteUser(userId);
        window.location.href = "./client-list.html";
      });
    }

    renderUser();
  }
}
