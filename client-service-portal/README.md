# Client service portal

## Metadata

- Author: ROBEL Fy Manoa Andrianavalona
- Status: Connected to a real backend (`server-client-service-portal`); frontend remains no framework, plain HTML, CSS, and JavaScript, zero external dependencies
- Created: 07/07/2026 (start of the development part)
- URL: Robel-Manoa/client-service-portal

## objective

Build a web application to improve and manage the customer request process

## Background

Your company, a systems integration and software development agency, manages ongoing service relationships with multiple clients. Currently, service requests are handled informally — through emails and spreadsheets. The Client Service Portal (CSP) is a web application that brings this process into a structured, role-based system. Clients use the portal to submit and track service requests. Engineers manage their assigned requests and update statuses. Admins oversee all requests, manage assignments, and administer user accounts.

## Goals

- Submit a request as a customer
- Track the project's status and progress
- Manage customer requests
- Assign a manager (engineer) to a request (as an admin)
- Update a client's project status
- Leave a comment on each project
- Manage user accounts (as an admin)
- View your own requests and comments left
- Add internal comments (not visible to clients)
- A responsive application

## Non-goals

- Password hashing on the frontend (the backend hashes/verifies passwords; the frontend never sees or stores one after login)
- Using a frontend framework or build tool

## User roles

| Role     | Who they are                       | What they can do                                                                              |
| -------- | ----------------------------------- | ---------------------------------------------------------------------------------------------- |
| Client   | An external company representative | Submit requests, view their own requests, add comment                                        |
| Engineer | An internal company engineer       | View, assigned requests, update request status, add comments (internal or visible to client) |
| Admin    | An internal administrator          | Manage all requests, assign engineers to requests, manage user accounts                      |

## How to run the application

This is two separate projects that need to run at the same time:

1. Start the backend API (`server-client-service-portal/`): from that
   folder, `npm ci` then `npm run dev` (needs a `.env` — see that project's
   own README/setup). It listens on `http://localhost:3001` by default.
2. Open the frontend (`client-service-portal/`): double-click `index.html`
   (no server, no build step required). It talks to the backend at
   `http://localhost:3001/api` — see `script/api.js`'s `API_BASE_URL` if
   the backend is running somewhere else.

## User Account Demo

Seeded by the backend (`server-client-service-portal/src/core/database.ts`),
password `password123` for all four:

| Role     | Email                |
| -------- | --------------------- |
| Admin    | admin@portal.local    |
| Client   | manoa@gmail.com       |
| Engineer | robel@gmail.com       |
| Client   | Fy@gmail.com          |

## User interface

### Login page

The login page shows a login form where users (all types of users) need to enter their email address and password correctly to log into the app. The page also has a small brief describing the app, how it works, and why it’s there. The login page handles redirecting users according to their roles (client, engineer, admin).

### User Homepages & Dashboards

- Client Dashboard: Displays a personalized view of all requests submitted by the client.
  Visible Fields: Request Name, Priority, Status, Creation Date, and Details link.
  Action: Users can click on any request to view its full details.
- Engineer Dashboard: Displays all requests assigned to the engineer by the administrator.
  Layout: Inherits the same layout as the client dashboard.
  Action: Engineers can view the full details of any assigned request.
- Admin Dashboard: Displays all requests submitted by all clients across the platform, using the same view and layout as the other roles.

### Global Features

- Data Filtering: All user dashboards include a filtering option to sort requests by status (open, in progress, pending client, resolved, closed).

### Request details page

The request details page clearly displays all information related to the client's request. It includes the request title, description, priority, status, creation date, and the assigned engineer (shown by id — see "Known limitations" below). It also features a history of all status changes for the project, as well as comments left by clients, administrators, and engineers (shown by author id, same reason). This comment section can also function as a chat/discussion thread. Admins additionally get a "Delete request" action here.

### Add new request page

To submit a new request, the client must complete a form with the following fields: title, project priority, and project description. Once all fields are filled out, the client can submit the request. It will then appear in the administration dashboard's request list as an "Open" request, as well as on the dashboard of the client who submitted it

## Known limitations

- **Assigned engineer / comment author shown by id, not name.** Resolving a
  name requires `GET /api/users/:id`, which the backend only allows for
  `admin`/`engineer` — a `client` gets a 403. Rather than show a name to
  some viewers and silently fail for others, the id is shown to everyone.
- **A user's request list on their profile page (`detail-users.html`) only
  renders for an admin viewer.** The backend has no "get this specific
  user's requests" endpoint; `GET /api/requests` is scoped to the caller's
  own role, so only an admin (who sees every request) can filter it down to
  an arbitrary user.
- **Status transitions are enforced by the backend, not just the UI**:
  clients can never change status; engineers may only move an `open`
  request straight to `resolved`; admins may set any status. The UI only
  offers the buttons the backend will actually accept.

## Missing features

- Add regex
- Filter request list by date
- Searched request

## Architecture

### Frontend language: Vanilla HTML5 / JavaScript / CSS

The application is built entirely on a native web stack with zero external dependencies, ensuring a lightweight and highly compatible architecture.

- Core Technologies: Native HTML5, CSS3, and Vanilla JavaScript.
- No Frameworks / Libraries: Developed completely without external frameworks (such as React, Vue, or Angular) or third-party libraries (such as jQuery or Tailwind).
- No Build Tools: The project does not require any compilation, transpilation, or bundling tools (no Webpack, Vite, or Babel).
- Direct Execution: The code runs natively and directly in the browser, with no debugging tools or development servers required for building the application

### Backend: `server-client-service-portal/` (Express + TypeScript)

A real HTTP API the frontend talks to over `fetch` — JWT bearer auth,
role-based access control, in-memory data store. See that project's own
docs/source for details; the frontend treats it as the single source of
truth for data, ids, and validation rules and never fakes any of it
locally.

### Session: `sessionStorage`

The frontend keeps only the logged-in session (the JWT and the current
user) in `sessionStorage` (`csp_session`, set by `script/api.js`) — nothing
else is cached client-side. Closing the tab ends the session, same as
before.

### Type checking (jsconfig.json)

Even without a build step, every `.js` file starts with `// @ts-check` and is checked by the TypeScript language service in strict mode via `jsconfig.json` (`allowJs` + `checkJs` + `strict: true`) — this is an editor/IDE-time check only, nothing is compiled or bundled. Shared data shapes (`User`, `ServiceRequest`, `RequestComment`, ...) are declared once as JSDoc `@typedef`s in `script/api.js`; because these files are plain global scripts (no `import`/`export`), those typedefs are automatically visible to `script/app.js` as well.

## File structure

```
client-service-portal/
├── pages/
│   ├── add-request.html
│   ├── client-list.html
│   ├── detail-users.html
│   ├── index-admin.html
│   ├── index-client.html
│   ├── index-engineer.html
│   └── request-detail.html
├── script/
│   ├── api.js
│   └── app.js
├── styles/
│   └── styles.css
├── index.html
├── jsconfig.json
└── README.md
```

## Main functions implemented

### api.js — the data layer

The data layer is the single point of contact with the backend. Every page
(`app.js`) reads and writes through it instead of calling `fetch` directly.
It's a plain object assigned to the `api` constant, backed by one internal
`request(method, path, options)` helper that attaches the bearer token,
parses the JSON response, and throws an `ApiError` (with `.status` and,
for 400s, field-level `.details`) on any non-2xx response.

**Session**

- `login(email, password)`: `POST /api/auth/login`; on success persists
  `{token, user}` to `sessionStorage` and returns the user.
- `logout()`: clears the session, local-only (the API is stateless, there's
  no server-side logout).
- `getCurrentUser()`: synchronous — reads the session and returns the user,
  or `null`.

**Users** (`getUsers`, `getUserById`, `getEngineers`, `createUser`,
`updateUser`, `deleteUser`): thin wrappers over `/api/users*`. `getUsers`
(the list) is admin-only server-side; `getUserById` (a single user) is
allowed for both `admin` and `engineer`.

**Requests** (`getRequests`, `getRequestById`, `createRequest`,
`updateRequestStatus`, `deleteRequest`, `assignEngineer`): thin wrappers
over `/api/requests*`. `getRequests` is scoped server-side by the caller's
role — one call covers every dashboard, no client-side role branching
needed. `assignEngineer` posts to `/api/requests/:id/assignments`, which
just sets `assigned_engineer_id` on the request and returns it — there is
no separate "assignment" resource.

**Comments** (`getCommentsForRequest`, `addComment`): thin wrappers over
`/api/requests/:id/comments`. Internal-comment filtering by role happens
server-side; the frontend never asks for or receives comments it shouldn't.

### app.js — page orchestration functions

`app.js` runs on every page. Each block checks for the presence of a specific DOM element (e.g. `document.getElementById("request-info")`) before running, which lets a single script safely drive several different pages without errors on elements that don't exist there.

- `requireAuth(requiredRole)`: The access-control gatekeeper. Redirects to the login page if no user is logged in, or if the logged-in user's role isn't part of `requiredRole` (a single role or an array of allowed roles). Called at the top of every protected block, and returns the current user so the rest of the block can use it.
- `describeError(err)`: Turns a failed `api.js` call into a message worth showing — joins field-level validation errors (400s) into one string, otherwise falls back to the backend's own error message.
- `cloneTemplate(template, fields)`: Clones a `<template>` element's content and fills its `[data-field]` slots via `textContent`. Used by every function below that renders a list of records, so user-entered data (names, titles, comments, ...) never passes through `innerHTML` string interpolation.
- `userList(users)`: Renders the user list on the admin client list page (via the `#user-row-template` `<template>`), including the role badge (`.role-badge--client/--engineer/--admin` CSS classes).
- `renderTable(requests)`: Renders the requests table body (`#requests-table-body`) shared by the client, engineer, and admin dashboards (via the `#request-row-template` `<template>`), and is re-run whenever the status filter (`filterForm`) changes.
- `renderRequest()` / `renderComments()`: Render the request-detail page — request fields, status history, the available status-transition buttons (matching the backend's exact per-role transition rules), and the comment thread. Re-invoked after every status change, assignment, or new comment so the page stays in sync without a reload. The status buttons share a single delegated click listener on `#status-controls` instead of one listener per button.
- `renderUser()` / `renderUserRequests(user)`: Render the user-detail page (via the `#user-request-row-template` `<template>`) — profile fields, and (admin viewers only, see "Known limitations") the list of requests tied to them.

Together, `requireAuth` and the `render*` functions form the recurring pattern used across the app: **authenticate → fetch through `api` → render → re-render on user action**.

**Note on form fields named `name`/`role`/`title`**: on `add-user-form` and `edit-user-form`, the "name" and "role" fields are read via `document.getElementById(...)`, not `form.name`/`form.role`. `HTMLFormElement` already has its own `name` IDL attribute (the form's own `name` HTML attribute), and every `Element` already has a `role` IDL attribute (ARIA reflection) — both silently shadow a same-named child form control when accessed via dot notation. Same reasoning on `add-request-form`, where the title field is read via `document.getElementById("title")` instead of `form.title` (`HTMLElement.title` is the tooltip-text attribute). Any new form field named `name`, `role`, `title`, `id`, `class`, `style`, `action`, `method`, `target`, or `length` needs the same treatment — read by id instead of by dot access.
