# Client Service Portal

A role-based web application for managing client service requests: clients
submit and track requests, engineers work the ones assigned to them, and
administrators oversee the whole request lifecycle and the user directory.

The project replaces an informal, email-and-spreadsheet request process
with a structured system built around three roles — client, engineer, and
admin — each with a distinct, backend-enforced set of permissions.

## Repository structure

This is a monorepo containing two independent projects that run separately
and communicate over HTTP:

```
client-service-portal/
├── client-service-portal/          Frontend — static HTML/CSS/JavaScript
├── server-client-service-portal/   Backend — Express + TypeScript API
├── .github/workflows/               CI: build/test/coverage, dependency scan
└── sonar-project.properties         SonarQube configuration
```

| Part | Location | Stack | Detailed docs |
| ---- | -------- | ----- | -------------- |
| Frontend | [`client-service-portal/`](client-service-portal/) | Vanilla HTML, CSS, JavaScript — no framework, no build step | [`client-service-portal/README.md`](client-service-portal/README.md) |
| Backend | [`server-client-service-portal/`](server-client-service-portal/) | Node.js, Express, TypeScript, PostgreSQL | [`server-client-service-portal/README.md`](server-client-service-portal/README.md) |

Each part has its own README with full setup, configuration, and
architecture details. This document covers what is shared between them and
how to get the whole application running end to end.

## Quick start

Two things need to be running at the same time: the backend API and the
frontend (which is just a static file opened in a browser).

1. **Backend** — from `server-client-service-portal/`:

   ```
   npm ci
   cp .env.example .env    # then fill in real values, see backend README
   npm run db:init
   npm run dev
   ```

   This starts the API on `http://localhost:3001`. Requires a running
   PostgreSQL instance (13+; CI uses 16).

2. **Frontend** — open `client-service-portal/index.html` directly in a
   browser. No installation or build step is needed; it talks to the
   backend at `http://localhost:3001/api` by default.

3. Log in with one of the seeded demo accounts (password `password123` for
   all of them):

   | Role     | Email                |
   | -------- | --------------------- |
   | Admin    | admin@portal.local     |
   | Client   | manoa@gmail.com        |
   | Engineer | robel@gmail.com        |
   | Client   | Fy@gmail.com            |

For full environment variable reference, npm scripts, database schema, and
API details, see the backend README. For page-by-page frontend behavior and
known limitations, see the frontend README.

## User roles

| Role | Can do |
| ---- | ------ |
| Client | Submit a new request, view and comment on their own requests. |
| Engineer | View and update the status of requests assigned to them, comment (publicly or internally). |
| Admin | View and manage every request, assign engineers to requests, manage user accounts. |

Role permissions are enforced entirely by the backend; the frontend only
reflects what the backend allows and cannot grant access the API would
otherwise refuse.

## Architecture at a glance

```
Browser (client-service-portal/)
  -> fetch, JSON, JWT bearer token
     -> Express API (server-client-service-portal/)
        -> layered: delivery -> core (domain services) -> repositories
           -> PostgreSQL
```

- The frontend holds no business logic of consequence and no local data
  store beyond the current session (`sessionStorage`) — it is a thin client
  over the API.
- The backend is the single source of truth for data, validation, and
  authorization. It exposes a fully documented REST API, browsable at
  `http://localhost:3001/api-docs` once running.
- Authentication is stateless: a JWT issued at login (2-hour expiry) is
  sent as a bearer token on every subsequent request.

## Testing and quality

- The backend has an automated test suite (Node's built-in test runner)
  running against a real PostgreSQL database, with coverage reporting. Run
  it with `npm test` from `server-client-service-portal/`.
- The frontend has no automated tests: it is plain browser JavaScript with
  no DOM available outside a browser, so SonarQube analysis is scoped to
  the backend only (see `sonar-project.properties`).
- Continuous integration (`.github/workflows/`) runs the backend test suite
  with coverage against a PostgreSQL service container, builds the
  TypeScript project, submits results to SonarQube, and runs a Snyk
  dependency vulnerability scan — on every push to `main` and on every pull
  request.

## Where to go next

- Setting up or troubleshooting the API: `server-client-service-portal/README.md`
- Understanding a specific page or frontend behavior: `client-service-portal/README.md`
- Exploring the API interactively: `http://localhost:3001/api-docs` (once the backend is running)
