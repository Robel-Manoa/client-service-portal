# Client Service Portal — Frontend

A framework-free web client for the Client Service Portal: clients submit
and track service requests, engineers manage the ones assigned to them, and
administrators oversee everything and manage user accounts.

This is the frontend half of a two-part repository. The backend
(`server-client-service-portal/`) is a separate Express and TypeScript API
that this frontend consumes over HTTP — see that project's own README for
backend-specific instructions. This project has no build step and no
package manager of its own; it runs directly in the browser.

## Prerequisites

- A modern web browser.
- The backend API running and reachable (see "Running against the backend"
  below). Nothing in this frontend works without it — there is no offline
  or mock mode.

## Getting started

1. Make sure the backend is running first (from `server-client-service-portal/`,
   see that project's README — in short: `npm ci`, configure `.env`,
   `npm run db:init`, `npm run dev`). By default it listens on
   `http://localhost:3001`.
2. Open `index.html` directly in a browser. There is nothing to install,
   build, or serve — double-clicking the file is enough.
3. Log in with one of the seeded demo accounts (password `password123` for
   all of them):

   | Role     | Email                |
   | -------- | --------------------- |
   | Admin    | admin@portal.local     |
   | Client   | manoa@gmail.com        |
   | Engineer | robel@gmail.com        |
   | Client   | Fy@gmail.com            |

That is the entire setup. There is no `npm install`, no dev server, and no
compilation step for this part of the repository.

### Running against the backend

The frontend talks to the API at a fixed base URL, `API_BASE_URL` in
`script/api.js`:

```js
const API_BASE_URL = "http://localhost:3001/api";
```

If the backend runs on a different host or port, update that one constant —
it is the only place the API location is configured.

## Project structure

```
client-service-portal/
├── index.html            Login page (site entry point)
├── jsconfig.json         Editor-level type checking for the plain JS files
├── pages/
│   ├── add-request.html    New request form (client)
│   ├── client-list.html    All users (admin)
│   ├── detail-users.html   Single user profile
│   ├── index-admin.html    Admin dashboard — all requests
│   ├── index-client.html   Client dashboard — own requests
│   ├── index-engineer.html Engineer dashboard — assigned requests
│   └── request-detail.html Single request — status, assignment, comments
├── script/
│   ├── api.js             All communication with the backend
│   ├── routes.js          Page URL construction
│   └── app.js              Page-specific rendering and event handling
└── styles/
    └── styles.css          The one stylesheet, shared by every page
```

Every page loads the same three scripts, in this order, each deferred:
`api.js`, then `routes.js`, then `app.js`. They are plain global scripts,
not ES modules — there is no bundler, so load order matters and each script
relies on the previous one already having run.

## How the pages fit together

| Page | Who sees it | Purpose |
| ---- | ------------ | ------- |
| `index.html` | Everyone (logged out) | Login form; redirects to the correct dashboard on success. |
| `pages/index-client.html` | Client | Table of the client's own requests, filterable by status. |
| `pages/index-engineer.html` | Engineer | Table of requests assigned to the engineer. |
| `pages/index-admin.html` | Admin | Table of every request on the platform. |
| `pages/add-request.html` | Client | Form to submit a new request (title, priority, description). |
| `pages/request-detail.html` | Any authenticated role | Full detail of one request: fields, status history, status-transition actions, assignment (admin), comment thread. |
| `pages/client-list.html` | Admin | List of every user, with a form to create new ones. |
| `pages/detail-users.html` | Admin, engineer | A single user's profile; admins additionally get an edit form and, when viewing a client or engineer, that user's request list. |

## Session handling

The frontend keeps only the logged-in session — the JWT and the current
user object — in `sessionStorage`, under the key `csp_session`, written and
read by `script/api.js`. Nothing else is cached client-side, and nothing is
persisted across a closed tab; logging in again is required for a new tab
or browser session. On any `401` response from the API, the session is
cleared automatically and the user is redirected to the login page.

## Access control

Role checks in the frontend exist to give users a coherent interface — they
are not a security boundary. The backend enforces every permission
independently and will reject a request regardless of what the frontend
does or does not show. Two mechanisms are used:

- **Page guards**: every protected page calls `requireAuth(requiredRole)`
  (defined in `script/app.js`) before rendering anything. It reads the
  current session, redirects to the login page if there is none, and also
  redirects if the logged-in user's role is not in `requiredRole` (a single
  role or a list of allowed roles).
- **Element-level gating**: on `request-detail.html`, the internal-comment
  option, the delete-request action, and the engineer-assignment section
  are only shown to the roles allowed to use them. The set of status
  buttons offered is computed to match the backend's exact transition rules
  per role — a client is never offered a status change, an engineer is only
  ever offered `open -> resolved`, and an admin is offered every status.

## Known limitations

These are current, intentional gaps rather than defects, and are worth
knowing before extending the application:

- **The assigned engineer and comment authors are shown by id, not by
  name.** Resolving an id to a name requires `GET /api/users/:id`, which
  the backend restricts to `admin` and `engineer` — a `client` viewing the
  same page would get a `403`. Rather than show a name to some viewers and
  fail silently for others, the id is shown to everyone.
- **A user's request list on their profile page only renders for an admin
  viewer.** The backend has no endpoint to fetch an arbitrary user's
  requests; `GET /api/requests` is always scoped to the caller's own role,
  so only an admin (who already sees every request) can filter that list
  down to one user.
- **Status transitions are enforced by the backend, not just the UI.** The
  frontend only ever offers buttons the backend will accept; it does not
  independently invent or loosen the transition rules.

### Not yet implemented

- Validation via regular expressions on form fields beyond basic length
  checks.
- Filtering the request list by date.
- Searching requests by keyword.

## Working with `script/api.js`

This is the only file that talks to the backend; every page goes through
it instead of calling `fetch` directly. It exposes a single `api` object,
backed by an internal request helper that attaches the bearer token, parses
JSON responses, and throws an `ApiError` (carrying `.status` and, for
validation failures, field-level `.details`) on any non-2xx response.

Relevant methods:

- Session: `login`, `logout`, `getCurrentUser`.
- Users: `getUsers`, `getUserById`, `getEngineers`, `createUser`,
  `updateUser`, `deleteUser`.
- Requests: `getRequests`, `getRequestById`, `createRequest`,
  `updateRequestStatus`, `deleteRequest`, `assignEngineer`.
- Comments: `getCommentsForRequest`, `addComment`.

`script/routes.js` is the single source of truth for page URLs
(`ROUTES.login`, `ROUTES.home(role)`, `ROUTES.requestDetail(id)`, and so
on) — new links or redirects should go through it rather than hardcoding a
path, since it already accounts for the difference between the root
`index.html` and pages nested under `pages/`.

`script/app.js` is where each page's own logic lives. Every block checks
for a page-specific DOM element before running, which is what lets one
script safely serve every page — a block simply does nothing on pages
where its element is absent. It also defines `requireAuth` (see "Access
control" above), `cloneTemplate` (renders `<template>` elements by filling
`[data-field]` slots with `textContent`, deliberately avoiding `innerHTML`
for any user-supplied data), and `describeError` (turns a failed API call
into a message worth displaying).

### A note on form field names

On any form, a field named `name`, `role`, `title`, `id`, `class`, `style`,
`action`, `method`, `target`, or `length` must be read with
`document.getElementById(...)`, not `form.name` / `form.role` / etc. Native
DOM elements already expose properties with these exact names —
`HTMLFormElement.name`, the ARIA `role` reflection on every `Element`,
`HTMLElement.title` as tooltip text, and so on — and those built-in
properties silently shadow a same-named child form control when accessed
by dot notation, without raising any error. This has already caused bugs in
this codebase; any new form field using one of these names needs the same
treatment.

## Type checking

There is no build step, but every `.js` file starts with `// @ts-check` and
is checked in strict mode by the TypeScript language service via
`jsconfig.json`. This is an editor/IDE-time check only — nothing is
compiled or bundled. Shared data shapes (`User`, `ServiceRequest`,
`RequestComment`, and the role/status/priority unions) are declared once as
JSDoc `@typedef`s in `script/api.js`; because these are plain global
scripts rather than ES modules, those typedefs are automatically visible in
`script/app.js` and `script/routes.js` as well.

## Styling

A single stylesheet, `styles/styles.css`, is shared by every page — there
are no per-page or component-scoped styles. It uses CSS custom properties
for the core color palette and per-role badge colors, and is responsive via
a small number of media queries plus a flexbox layout on the request-detail
page that stacks its columns on narrow viewports without needing an
additional breakpoint.
