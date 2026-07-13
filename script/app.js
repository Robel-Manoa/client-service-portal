const ROLE_HOME = {
  client: "./index-client.html",
  engineer: "./index-engineer.html",
  admin: "./index-admin.html",
};

const ALL_STATUSES = [
  "open",
  "in_progress",
  "pending_client",
  "resolved",
  "closed",
];

function requireAuth(requiredRole) {
  const user = Storage.getCurrentUser();
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

const loginForm = document.getElementById("loginForm");

if (loginForm) {
  loginForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const errorMessage = document.querySelector(".error-message");

    const user = Storage.login(email, password);
    if (!user) {
      errorMessage.textContent = "Invalid email or password. Please try again.";
      return;
    }

    window.location.href = "pages/index-" + user.role + ".html";
  });
}

const logoutButton = document.getElementById("logoutButton");

if (logoutButton) {
  logoutButton.addEventListener("click", function (event) {
    event.preventDefault();

    Storage.logout();
    window.location.href = "../index.html";
  });
}

const lists = document.getElementById("clients-list");

const ROLE_COLORS = {
  client: "green",
  engineer: "blue",
  admin: "red",
};

function userList(users) {
  lists.innerHTML = "";

  users.forEach((user) => {
    const row = document.createElement("ul");

    row.innerHTML = `
      <li>${user.name}</li>
      <li>${user.email}</li>
      <li class="roles">${user.role}</li>
      <li><a href="./detail-users.html?id=${user.id}">View details</a></li>
    `;

    const roleItem = row.querySelector(".roles");
    roleItem.style.backgroundColor = ROLE_COLORS[user.role] || "";
    roleItem.style.padding = "5px";
    roleItem.style.width = "60px";
    roleItem.style.color = "white";
    roleItem.style.marginTop = "10px";
    roleItem.style.borderRadius = "10px";
    roleItem.style.textAlign = "center";

    lists.appendChild(row);
  });
}

const addUserForm = document.getElementById("add-user-form");
const adminActions = document.getElementById("admin-actions");
const editUser = document.getElementById("user-admin-actions");

function showForm(){
  adminActions.style.display = "block";
  editUser.style.display = "block";
}

function showFormEdit(){
  editUser.style.display = "block";
}

function removeFormEdit(){
  editUser.style.display = "none";
}

if (lists) {
  const currentUser = requireAuth(["admin", "engineer"]);

  if (currentUser) {
    const homeLink = document.getElementById("homeLink");
    if (homeLink) homeLink.href = ROLE_HOME[currentUser.role];

    userList(Storage.getUser());

    if (currentUser.role === "admin") {
      if (addUserForm) {
        addUserForm.addEventListener("submit", function (event) {
          event.preventDefault();

          const created = Storage.createUser({
            name: addUserForm.name.value,
            email: addUserForm.email.value,
            password: addUserForm.password.value,
            role: addUserForm.role.value,
          });

          if (!created) {
            alert("A user with this email already exists.");
            return;
          }

          addUserForm.reset();
          userList(Storage.getUser());
        });
      }
    } else if (adminActions) {
      adminActions.remove();
    }
  }
}

const table = document.querySelector("table");
const form = document.getElementById("filterForm");
const filterInput = document.getElementById("filterInput");
const pageRole = document.body.dataset.role;

function renderTable(requests) {
  table.querySelectorAll("tr:not(:first-child)").forEach((row) => row.remove());

  requests.forEach((request) => {
    const row = document.createElement("tr");

    row.innerHTML = `
            <td>${request.title}</td>
            <td>${request.priority}</td>
            <td>${request.status}</td>
            <td>${request.created_at}</td>
            <td><a href="./request-detail.html?id=${request.id}">View Details</a></td>
        `;

    table.appendChild(row);
  });
}

if (table && form && filterInput && pageRole) {
  const currentUser = requireAuth(pageRole);

  if (currentUser) {
    let requests = [];
    if (pageRole === "client")
      requests = Storage.getRequestsForClient(currentUser.id);
    else if (pageRole === "engineer")
      requests = Storage.getRequestsForEngineer(currentUser.id);
    else if (pageRole === "admin") requests = Storage.getRequests();

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

const addRequestForm = document.getElementById("add-request-form");

if (addRequestForm) {
  const currentUser = requireAuth("client");

  if (currentUser) {
    addRequestForm.addEventListener("submit", function (event) {
      event.preventDefault();

      Storage.addRequest({
        client_id: currentUser.id,
        title: addRequestForm.title.value,
        description: addRequestForm.description.value,
        priority: addRequestForm.priority.value,
      });

      window.location.href = "./index-client.html";
    });
  }
}

const requestInfo = document.getElementById("request-info");

if (requestInfo) {
  const currentUser = requireAuth();

  if (currentUser) {
    const homeLink = document.getElementById("homeLink");
    if (homeLink) homeLink.href = ROLE_HOME[currentUser.role];

    const params = new URLSearchParams(window.location.search);
    const requestId = params.get("id");
    const statusHistoryList = document.getElementById("status-history");
    const statusControls = document.getElementById("status-controls");
    const commentsList = document.getElementById("comments-list");
    const addCommentForm = document.getElementById("add-comment-form");
    const internalCommentLabel = document.getElementById(
      "internal-comment-label",
    );
    const assignmentSection = document.getElementById("assignment-section");
    const assignEngineerForm = document.getElementById("assign-engineer-form");
    const assignEngineerSelect = document.getElementById(
      "assign-engineer-select",
    );

    if (internalCommentLabel && currentUser.role === "client") {
      internalCommentLabel.style.display = "none";
    }

    if (assignmentSection) {
      if (currentUser.role === "admin") {
        Storage.getEngineers().forEach((engineer) => {
          const option = document.createElement("option");
          option.value = engineer.id;
          option.textContent = engineer.name;
          assignEngineerSelect.appendChild(option);
        });
      } else {
        assignmentSection.style.display = "none";
      }
    }

    function renderComments() {
      commentsList.innerHTML = "";
      const includeInternal = currentUser.role !== "client";
      const comments = Storage.getCommentsForRequest(requestId, {
        includeInternal,
      });

      comments.forEach((comment) => {
        const author = Storage.getUserById(comment.user_id);
        const li = document.createElement("li");
        li.textContent = `${author ? author.name : "Unknown"}${
          comment.is_internal ? " (internal)" : ""
        }: ${comment.content} - ${comment.created_at}`;
        commentsList.appendChild(li);
      });
    }

    function renderRequest() {
      const request = Storage.getRequestById(requestId);

      if (!request) {
        requestInfo.innerHTML = "<p>Request not found.</p>";
        statusHistoryList.innerHTML = "";
        statusControls.innerHTML = "";
        commentsList.innerHTML = "";
        return;
      }

      document.getElementById("request-title").textContent = request.title;
      document.getElementById("request-description").textContent =
        request.description;
      document.getElementById("request-priority").textContent =
        request.priority;
      document.getElementById("request-status").textContent = request.status;
      document.getElementById("request-created").textContent =
        request.created_at;

      const assignment = Storage.getAssignmentForRequest(request.id);
      const assignedEngineer = assignment
        ? Storage.getUserById(assignment.engineer_id)
        : null;
      document.getElementById("request-assigned-engineer").textContent =
        assignedEngineer ? assignedEngineer.name : "Unassigned";
      if (assignEngineerSelect) {
        assignEngineerSelect.value = assignment ? assignment.engineer_id : "";
      }

      statusHistoryList.innerHTML = "";
      (request.status_history || []).forEach((entry) => {
        const li = document.createElement("li");
        li.textContent = `${entry.status} - ${entry.at}`;
        statusHistoryList.appendChild(li);
      });

      statusControls.innerHTML = "";
      if (currentUser.role !== "client") {
        const nextStatuses = ALL_STATUSES.filter((status) =>
          Storage.canTransition(request.status, status),
        );

        nextStatuses.forEach((status) => {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = `Move to ${status}`;
          button.addEventListener("click", function () {
            Storage.updateRequestStatus(request.id, status);
            renderRequest();
          });
          statusControls.appendChild(button);
        });
      }

      renderComments();
    }

    if (assignEngineerForm && currentUser.role === "admin") {
      assignEngineerForm.addEventListener("submit", function (event) {
        event.preventDefault();

        const engineerId = assignEngineerSelect.value;
        if (!engineerId) return;

        Storage.assignRequest({
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

        Storage.addComment({
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

const userProfile = document.querySelector(".user-profile");

if (userProfile) {
  const currentUser = requireAuth(["admin", "engineer"]);

  if (currentUser) {
    const homeLink = document.getElementById("homeLink");
    if (homeLink) homeLink.href = ROLE_HOME[currentUser.role];

    const params = new URLSearchParams(window.location.search);
    const userId = params.get("id");

    const requestsSection = document.getElementById("user-requests-section");
    const requestsList = document.getElementById("user-requests-list");
    const adminSection = document.getElementById("user-admin-actions");
    const editUserForm = document.getElementById("edit-user-form");
    const deleteUserButton = document.getElementById("delete-user-button");

    if (currentUser.role !== "admin" && adminSection) {
      adminSection.remove();
    }

    function renderUserRequests(user) {
      requestsList.innerHTML = "";

      let requests = [];
      if (user.role === "client")
        requests = Storage.getRequestsForClient(user.id);
      else if (user.role === "engineer")
        requests = Storage.getRequestsForEngineer(user.id);

      if (!requests.length) {
        requestsSection.style.display = "none";
        return;
      }

      requestsSection.style.display = "";
      requests.forEach((request) => {
        const row = document.createElement("ul");

        row.innerHTML = `
          <li>Title : ${request.title}</li>
          <li>Description : ${request.description}</li>
          <li>Priority : ${request.priority}</li>
          <li>Status : ${request.status}</li>
          <li><a href="./request-detail.html?id=${request.id}">View details</a></li>
        `;

        requestsList.appendChild(row);
      });
    }

    function renderUser() {
      const user = Storage.getUserById(userId);

      if (!user) {
        document.querySelector(".user-profile").innerHTML =
          "<p>User not found.</p>";
        if (adminSection) adminSection.remove();
        return;
      }

      document.getElementById("id-user").textContent = user.id;
      document.getElementById("name-user").textContent = user.name;
      document.getElementById("email-user").textContent = user.email;
      document.getElementById("role-user").textContent = user.role;
      document.getElementById("account-user").textContent = user.is_active
        ? "Active"
        : "Inactive";

      renderUserRequests(user);

      if (editUserForm && currentUser.role === "admin") {
        editUserForm.name.value = user.name;
        editUserForm.email.value = user.email;
        editUserForm.role.value = user.role;
        editUserForm.is_active.checked = user.is_active;
      }
    }

    if (editUserForm) {
      editUserForm.addEventListener("submit", function (event) {
        event.preventDefault();

        Storage.updateUser(userId, {
          name: editUserForm.name.value,
          email: editUserForm.email.value,
          role: editUserForm.role.value,
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

        Storage.deleteUser(userId);
        window.location.href = "./client-list.html";
      });
    }

    renderUser();
  }
}
