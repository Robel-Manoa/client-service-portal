# Client service portal

## Metadata

-	Author: ROBEL Fy Manoa Andrianavalona
-	Status: Design-complete, no framework, no backend, Built with plain HTML, CSS, and JavaScript, zero external dependencies
-	Created: 07/07/2026 (start of the development part)
-	URL: Robel-Manoa/client-service-portal

## objective

Build a web application to improve and manage the customer request process

## Background

Your company, a systems integration and software development agency, manages ongoing service relationships with multiple clients. Currently, service requests are handled informally — through emails and spreadsheets. The Client Service Portal (CSP) is a web application that brings this process into a structured, role-based system. Clients use the portal to submit and track service requests. Engineers manage their assigned requests and update statuses. Admins oversee all requests, manage assignments, and administer user accounts.

## Goals

-	Submit a request as a customer
-	Track the project's status and progress
-	Manage customer requests
-	Assign a manager (engineer) to a request (as an admin)  
-	Update a client's project status  
-	Leave a comment on each project  
-	Manage user accounts (as an admin)  
-	View your own requests and comments left  
-	Add internal comments (not visible to clients)
-	A responsive application

## Non-goals

-	Password hashing
-	Using a backend
-	Using a builds tool
-	Using any framework

## User roles

| Role	   | Who they are	                    | What they can do                                                                             |
|----------|------------------------------------|----------------------------------------------------------------------------------------------|
| Client   | An external company representative | Submit requests, view their own requests, add comment                                        |
| Engineer | An internal company engineer       | View, assigned requests, update request status, add comments (internal or visible to client) |
| Admin    | An internal administrator          | Manage all requests, assign engineers to requests, manage user accounts                      |

## How to run the application

To launch the app you need to:
1. Take the application at the repo with the commande line into the terminal : git clone https://github.com/Robel-Manoa/client-service-portal.git
2. Go into the folder downloaded from GitHub
3. Double click on the index.html file

## User Account Demo
### Client Account
- name: "John Doe",
- email: "john.doe@gmail.com",
- password: "password123",
- role: "client"

### Engineer Account
- name: "Jane Smith",
- email: "jane.smith@gmail.com",
- assword: "password456",
- role: "engineer"

### Admin Account
- name: "Bob Johnson",
- email: "bob.johnson@gmail.com",
- password: "password789",
- role: "admin"

## User interface
### Login page
    The login page shows a login form where users (all types of users) need to enter their email address and password correctly to log into the app. The page also has a small brief describing the app, how it works, and why it’s there. The login page handles redirecting users according to their roles (client, engineer, admin).

### User Homepages & Dashboards
-	Client Dashboard: Displays a personalized view of all requests submitted by the client.
    Visible Fields: Request Name, Priority, Status, and Creation Date.
    Action: Users can click on any request to view its full details.
-	Engineer Dashboard: Displays all requests assigned to the engineer by the administrator.
    Layout: Inherits the same layout as the client dashboard.
    Action: Engineers can view the full details of any assigned request.
-	Admin Dashboard: Displays all requests submitted by all clients across the platform, using the same view and layout as the other roles.

### Global Features
-	Data Filtering: All user dashboards include a filtering option to sort requests by status. Users can filter the list to display:
    Open requests
    In-progress requests
    Completed (or finished) requests

### Request details page
    The request details page clearly displays all information related to the client's request. It includes the request title, description, priority, status, creation date, and the assigned engineer. It also features a history of all status changes for the project, as well as comments left by clients, administrators, and engineers. This comment section can also function as a chat/discussion thread

### Add new request page
    To submit a new request, the client must complete a form with the following fields: title, project priority, and project description. Once all fields are filled out, the client can submit the request. It will then appear in the administration dashboard's request list as an "Open" request, as well as on the dashboard of the client who submitted it

## Missing features

-	Add regex
-	Filter request list by date
-	Searched request
-	Backend part

## Architecture
### Frontend language: Vanilla HTML5 / JavaScript / CSS
The application is built entirely on a native web stack with zero external dependencies, ensuring a lightweight and highly compatible architecture.
- Core Technologies: Native HTML5, CSS3, and Vanilla JavaScript.
- No Frameworks / Libraries: Developed completely without external frameworks (such as React, Vue, or Angular) or third-party libraries (such as jQuery or Tailwind).
- No Build Tools: The project does not require any compilation, transpilation, or bundling tools (no Webpack, Vite, or Babel).
- Direct Execution: The code runs natively and directly in the browser, with no debugging tools or development servers required for building the application

### Backend language: Nothing

### Database: Vanilla JavaScript
To facilitate quick testing and zero-configuration deployment, the application manages data entirely within the browser without requiring a backend database.
-	Initial Bootstrapping: The application initializes its default state using hardcoded JavaScript arrays (mock data).
-	Browser-Based Storage: Once launched, the application manages and persists state changes dynamically using native browser APIs:
    LocalStorage: Used to retain certain settings and user states across page refreshes.
    SessionStorage: Used to handle temporary active session data.
-	Data Volatility (Session-Only): Because storage is strictly client-side and sandboxed, all processed data is volatile. Closing the browser tab or window will destroy all session data, resetting the application to its default initial state upon the next launch.

## File structure
Client-service-portal
    Data/
        Data.js
    Pages/
        Add-request.html 
        Client-list.html
        Detail-users.html
        Index-admin.html
        Index-client.html
        Index-engineer.html
        Request-detail.html
    Script/
        App.js
        Storage.html
    Styles/
        Styles.css
    Index.html
    README.md

### data.js

It's in the data.js file that you can find the fake data for using the app in demo mode

const data = {
  users: [
    {
      id: "u1",
      name: "John Doe",
      email: "john.doe@gmail.com",
      password: "password123",
      role: "client",
      is_active: true,
      created_at: "2023-01-01",
      updated_at: "2023-01-01",
    },
    {
      id: "u2",
      name: "Jane Smith",
      email: "jane.smith@gmail.com",
      password: "password456",
      role: "engineer",
      is_active: true,
      created_at: "2023-01-01",
      updated_at: "2023-01-01",
    },
    {
      id: "u3",
      name: "Bob Johnson",
      email: "bob.johnson@gmail.com",
      password: "password789",
      role: "admin",
      is_active: true,
      created_at: "2023-01-01",
      updated_at: "2023-01-01",
    },
  ],
  requests: [
    {
      id: "r1",
      client_id: "u1",
      title: "New page",
      description: "New page for company",
      priority: "medium",
      status: "open",
      created_at: "01-01-2023",
      updated_at: "01-01-2023",
      status_history: [
        { status: "open", at: "01-01-2023" },
        { status: "in_progress", at: "02-01-2023" },
      ],
    },
    {
      id: "r2",
      client_id: "u2",
      title: "New balance sheet",
      description: "New page for company",
      priority: "medium",
      status: "in_progress",
      created_at: "01-01-2023",
      updated_at: "01-01-2023",
      satus_history: [
        { status: "open", at: "01-01-2023" },
        { status: "in_progress", at: "02-01-2023" },
      ],
    },
  ],
  assignements: [
    {
      id: "a1",
      request_id: "r1",
      engineer_id: "u2",
      assigned_at: "01-01-2023",
    },
    {
      id: "a2",
      request_id: "r2",
      engineer_id: "u2",
      assigned_at: "01-01-2023",
    },
  ],
  comments: [
    {
      id: "c1",
      request_id: "r1",
      user_id: "u1",
      content: "Please start working on this request",
      is_internal: false,
      created_at: "01-01-2023",
    },
    {
      id: "c2",
      request_id: "r2",
      user_id: "u2",
      content: "I'm on it!",
      is_internal: false,
      created_at: "01-01-2023",
    },
  ],
};

## Main functions implemented

### storage.js — the Storage module (data layer)

Storage is the core module of the application: it is the single source of truth for all data. Every page (app.js) reads and writes through it instead of touching sessionStorage directly. It's built as a closure (CSP()) that keeps the storage keys and helpers private, and exposes only the functions listed below through its returned object.

**Internal helpers (not exposed)**
-	read(key) / write(key, value): Serialize/deserialize data to and from sessionStorage (JSON).
-	uid(prefix): Generates a pseudo-unique id (e.g. request_ab12c34d5) used for every new record.
-	init(): Seeds sessionStorage from data.js on first load only (guarded by the csp_seeded flag), so the mock data isn't re-injected on every page navigation. Called once, right after Storage is created.

**Authentication**
-	login(email, password): Looks up a user matching both fields, stores them as the current session user, and returns the user (or null if the credentials don't match).
-	logout(): Clears the current session user.
-	getCurrentUser(): Returns the logged-in user for the current tab session, or null.

**Users**
-	getUser(): Returns every user.
-	getUserById(id) / findUserByEmail(email): Look up a single user.
-	getEngineers(): Returns only users with the engineer role (used to populate the assignment dropdown).
-	createUser({ name, email, password, role }): Creates a new user, rejecting the operation (returns null) if the email is already taken.
-	updateUser(id, updates): Merges the given fields into an existing user and refreshes updated_at.
-	deleteUser(id): Removes a user from storage.

**Requests**
-	getRequests(): Returns every request.
-	getRequestById(id): Looks up a single request.
-	getRequestsForClient(clientId): Returns the requests submitted by a given client.
-	addRequest({ client_id, title, description, priority }): Creates a new request with status: "open" and starts its status_history.
-	canTransition(from, to): Checks a proposed status change against the valid_transitions map (open → in_progress → pending_client/resolved → closed), returning whether it's allowed.
-	updateRequestStatus(requestId, newStatus): Applies a status change if — and only if — canTransition allows it, and appends an entry to status_history.

**Assignments**
-	getAssignments(): Returns every engineer/request assignment.
-	getAssignmentForRequest(requestId): Returns the assignment tied to a given request, if any.
-	assignRequest({ request_id, engineer_id }): Creates the assignment for a request, or updates it if one already exists (a request can only have one active engineer at a time).
-	getAssignedRequestsForEngineer(engineerId): Alternate lookup of an engineer's requests (currently unused by app.js, which relies on getRequestsForEngineer instead).

**Comments**
-	getComments(): Returns every comment.
-	getCommentsForRequest(requestId, { includeInternal }): Returns the comments for a request, sorted chronologically, filtering out internal comments when includeInternal is false (used to hide internal notes from clients).
-	addComment({ request_id, user_id, content, is_internal }): Creates a new comment on a request.

### app.js — page orchestration functions

app.js runs on every page. Each block checks for the presence of a specific DOM element (e.g. document.getElementById("request-info")) before running, which lets a single script safely drive several different pages without errors on elements that don't exist there.

-	requireAuth(requiredRole): The access-control gatekeeper. Redirects to the login page if no user is logged in, or if the logged-in user's role isn't part of requiredRole (a single role or an array of allowed roles). Called at the top of every protected block, and returns the current user so the rest of the block can use it.
-	userList(users): Renders the user table on the admin/engineer client list page, including the colored role badge (ROLE_COLORS).
-	renderTable(requests): Renders the requests table shared by the client, engineer, and admin dashboards, and is re-run whenever the status filter (filterForm) changes.
-	renderRequest() / renderComments(): Render the request-detail page — request fields, status history, the available status-transition buttons (built from canTransition), and the comment thread. Re-invoked after every status change or new comment so the page stays in sync without a reload.
-	renderUser() / renderUserRequests(user): Render the user-detail page — profile fields, and (if the user is a client or engineer) the list of requests tied to them.

Together, requireAuth and the render* functions form the recurring pattern used across the app: **authenticate → fetch through Storage → render → re-render on user action** — with Storage acting as the shared state manager between pages.
