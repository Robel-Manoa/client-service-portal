const ROLE_HOME = {
  client: "./index-client.html",
  engineer: "./index-engineer.html",
  admin: "./index-admin.html",
};

const ALL_STATUSES = ["open", "in_progress", "pending_client", "resolved", "closed"];

function requireAuth(requiredRole) {
  const user = Storage.getCurrentUser();
  if (!user) {
    window.location.href = "../index.html";
    return null;
  }
  if (requiredRole && user.role !== requiredRole) {
    window.location.href = "../index.html";
    return null;
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
    if (pageRole === "client") requests = Storage.getRequestsForClient(currentUser.id);
    else if (pageRole === "engineer") requests = Storage.getRequestsForEngineer(currentUser.id);
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

    function renderRequest() {
      const request = Storage.getRequestById(requestId);

      if (!request) {
        requestInfo.innerHTML = "<p>Request not found.</p>";
        statusHistoryList.innerHTML = "";
        statusControls.innerHTML = "";
        return;
      }

      document.getElementById("request-title").textContent = request.title;
      document.getElementById("request-description").textContent = request.description;
      document.getElementById("request-priority").textContent = request.priority;
      document.getElementById("request-status").textContent = request.status;
      document.getElementById("request-created").textContent = request.created_at;

      statusHistoryList.innerHTML = "";
      (request.status_history || []).forEach((entry) => {
        const li = document.createElement("li");
        li.textContent = `${entry.status} - ${entry.at}`;
        statusHistoryList.appendChild(li);
      });

      statusControls.innerHTML = "";
      if (currentUser.role !== "client") {
        const nextStatuses = ALL_STATUSES.filter((status) =>
          Storage.canTransition(request.status, status)
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
    }

    renderRequest();
  }
}
