const loginForm = document.getElementById("loginForm");

if (loginForm) {
  loginForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const errorMessage = document.querySelector(".error-message");

    if (email === "client@test.com" && password === "Client@123") {
      sessionStorage.setItem("myData", email);
      window.location.href = "pages/index-client.html";
    } else if (email === "engineer@test.com" && password === "engineer@123") {
      sessionStorage.setItem("myData", email);
      window.location.href = "pages/index-engineer.html";
    } else {
      errorMessage.textContent = "Invalid email or password. Please try again.";
    }
  });
}

const logout = document
  .getElementById("logoutButton")
  .addEventListener("click", function (event) {
    event.preventDefault();

    sessionStorage.clear();
    window.location.href = "../index.html";
});

const table = document.querySelector("table");
const form = document.getElementById("filterForm");
const filterInput = document.getElementById("filterInput");

function renderTable(requests) {
  table.querySelectorAll("tr:not(:first-child)").forEach((row) => row.remove());

  requests.forEach((request) => {
    const row = document.createElement("tr");

    row.innerHTML = `
            <td>${request.title}</td>
            <td>${request.priority}</td>
            <td>${request.status}</td>
            <td>${request.created_at}</td>
            <td><a href="request-details.html?id=${request.id}">View Details</a></td>
        `;

    table.appendChild(row);
  });
}

if (table && form && filterInput) {
  renderTable(data);
  form.addEventListener("submit", function (event) {
    event.preventDefault();

    const selectedStatus = filterInput.value.toLowerCase();
    if (selectedStatus === "all") {
      renderTable(data);
      return;
    }

    const filteredData = data.filter((request) => {
      return request.status.toLowerCase() === selectedStatus;
    });

    renderTable(filteredData);
  });
}
