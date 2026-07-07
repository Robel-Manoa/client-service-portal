const loginForm = document.getElementById("loginForm");

if (loginForm) {
  loginForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const errorMessage = document.querySelector(".error-message");

    if (email === "client@test.com" && password === "Client@123") {
      console.log("Client login successful");
      window.location.href = "pages/index-client.html";
    } else {
      errorMessage.textContent = "Invalid email or password. Please try again.";
    }
  });
}

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
