# Client Service Portal — Backend

REST API for the Client Service Portal: a service-request tracking system for
clients, engineers, and administrators. Built with Express and TypeScript,
backed by PostgreSQL, with JWT authentication, role-based access control, and
an auto-generated OpenAPI specification.

This is the backend half of a two-part repository. The frontend
(`client-service-portal/`) is a separate, framework-free static site that
consumes this API over HTTP — see its own README for frontend-specific
instructions.

## Prerequisites

- Node.js 22 or later
- npm (ships with Node)
- PostgreSQL 13 or later, running locally or reachable over the network
  (CI runs against PostgreSQL 16 — that is the safest version to match)

## Getting started

1. Install dependencies:

   ```
   npm ci
   ```

2. Create a `.env` file in this directory, using `.env.example` as a
   template:

   ```
   cp .env.example .env
   ```

   Then fill in real values (see "Environment variables" below). At minimum
   you need a running PostgreSQL server and a database user with permission
   to create databases — `DB_NAME` does not need to exist yet, the init
   script creates it.

3. Initialize the database (creates the database if missing, applies the
   schema, and seeds demo data):

   ```
   npm run db:init
   ```

4. Start the API in watch mode:

   ```
   npm run dev
   ```

   The server listens on `http://localhost:3001` by default (or whatever
   `PORT` is set to). On startup it prints the URL it is listening on and the
   URL of the interactive API documentation.

5. Confirm it is running:

   ```
   curl http://localhost:3001/health
   ```

   This should return `{"status":"UP", ...}`.

To run the compiled production build instead of the dev server:

```
npm run build
npm start
```

### Running the frontend against this API

The frontend expects the API at `http://localhost:3001/api` by default (see
`API_BASE_URL` in the frontend's `script/api.js`). As long as this server is
running on port 3001, the frontend can simply be opened in a browser with no
further configuration.

## Environment variables

All variables are validated at startup with a Zod schema
(`src/config/env.config.ts`). If a required variable is missing or invalid,
the server refuses to start and prints exactly what is wrong, rather than
starting in a broken state.

| Variable        | Required | Default             | Notes                                                                                   |
| ---------------- | -------- | -------------------- | ---------------------------------------------------------------------------------------- |
| `PORT`           | No       | `3000`               | Set to `3001` to match the frontend's default expectations.                              |
| `NODE_ENV`       | No       | `development`        | `development`, `production`, or `test`. Controls the CORS policy (see below).            |
| `URL_SITE`       | No       | `localhost:3001/`    | Used to build the allowed CORS origin when `NODE_ENV` is not `development`.              |
| `JWT_SECRET`     | Yes      | —                     | Minimum 10 characters. Signs and verifies all login tokens.                              |
| `PASSWORD_HASH`  | Yes      | —                     | A pre-computed bcrypt hash used to seed the demo accounts (see "Demo accounts").         |
| `DB_HOST`        | Yes      | —                     | PostgreSQL host.                                                                          |
| `DB_PORT`        | No       | `5432`                | PostgreSQL port.                                                                          |
| `DB_USER`        | Yes      | —                     | Must be able to connect to the maintenance `postgres` database and create `DB_NAME`.     |
| `DB_PASSWORD`    | Yes      | —                     | PostgreSQL password.                                                                      |
| `DB_NAME`        | Yes      | —                     | Application database name. Created automatically by `npm run db:init` if it does not exist. |

To generate a bcrypt hash for `PASSWORD_HASH` (for example, for the literal
password `password123`, which is what the seeded demo accounts use), run:

```
node -e "console.log(require('bcrypt').hashSync('password123', 10))"
```

## Available scripts

| Script                  | Command                                        | Purpose                                                                 |
| ------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------ |
| `npm run dev`            | `tsx watch src/server.ts`                       | Start the API with hot reload for local development.                    |
| `npm run build`          | `tsc`                                           | Compile TypeScript to `dist/`.                                          |
| `npm start`              | `node dist/server.js`                           | Run the compiled server (requires `npm run build` first).               |
| `npm test`               | resets the DB, then runs the test suite         | Runs `db:init` followed by every `*.test.ts` file under `tests/`.        |
| `npm run test:coverage`  | same as `test`, plus coverage reporting         | Writes an lcov report to `coverage/lcov.info`.                          |
| `npm run db:init`        | `tsx src/db/init-db.ts`                         | Creates the database if needed, applies `schema.sql`, seeds demo data.  |

Note: `npm test` and `npm run test:coverage` both reset the target database
from scratch (`schema.sql` starts with `DROP TABLE ... CASCADE`) before
running. Do not point `DB_NAME` at a database whose data you want to keep
when running tests.

## Architecture

The codebase follows a layered structure, with each layer depending only on
the one below it through explicit interfaces:

```
route (src/app.ts)
  -> authenticate           (verifies the JWT, sets req.user)
  -> requireRole(...)       (optional — coarse, role-only check)
  -> validate(schema)       (optional — Zod request validation)
  -> controller             (src/delivery/*.controller.ts)
  -> domain service         (src/core/*.service.ts)
  -> repository             (src/core/postgres.repositories.ts)
  -> PostgreSQL             (src/db/postgres.ts)
```

- **`src/delivery/`** — the HTTP boundary: Express controllers, the JWT
  authentication and role-check middleware, and Zod schemas for request
  validation and OpenAPI generation.
- **`src/core/`** — domain logic (`UserService`, `RequestService`,
  `CommentService`). These depend only on the repository interfaces defined
  in `src/core/ports.ts`, never on `pg` or the database module directly.
  Each method accepts an optional repository argument that defaults to the
  real PostgreSQL implementation — this is how tests substitute fakes
  without touching a real database.
- **`src/db/`** — infrastructure: the connection pool (`postgres.ts`), the
  schema (`schema.sql`), the database bootstrap script (`init-db.ts`), and
  demo data (`seed.ts`).

### Project structure

```
src/
├── app.ts                          Express app (routes, middleware wiring)
├── server.ts                       HTTP server bootstrap, graceful shutdown
├── config/
│   ├── env.config.ts                Environment variable validation
│   └── docs.config.ts               OpenAPI document generation
├── core/
│   ├── comment.service.ts
│   ├── request.service.ts
│   ├── user.service.ts
│   ├── postgres.repositories.ts     Repository implementations (Postgres)
│   ├── ports.ts                     Repository interfaces
│   ├── types.ts                     Shared domain types
│   ├── database.ts                  Fixed seed record IDs
│   ├── date.util.ts
│   └── id.util.ts
├── db/
│   ├── postgres.ts                  Connection pool
│   ├── schema.sql                   Table/enum/index definitions
│   ├── init-db.ts                   Database creation + schema + seed runner
│   └── seed.ts                      Demo data
├── delivery/
│   ├── request.controller.ts
│   ├── user.controller.ts
│   ├── middlewares/
│   │   ├── auth.middleware.ts       authenticate, requireRole
│   │   └── validate.middleware.ts   Zod request validation
│   └── schemas/
│       ├── auth.schema.ts
│       ├── user.schema.ts
│       ├── request.schema.ts
│       └── comment.schema.ts
└── types/
    └── express.d.ts                 Express.Request.user type augmentation

tests/                                Test suite (see "Testing" below)
```

## API overview

Once the server is running, the full interactive specification is available
at `http://localhost:3001/api-docs` (Swagger UI), with the raw OpenAPI 3.0
document at `http://localhost:3001/api-docs.json`. That is the authoritative
reference; the summary below is for orientation only.

### Authentication

- `POST /api/auth/login` — public. Accepts `{ email, password }`, returns
  `{ user, token }`. The token is a JWT (`Authorization: Bearer <token>`),
  valid for 2 hours.

Every other `/api/*` route requires that header. A missing or invalid token
returns `401`.

### Roles

Three roles exist: `client`, `engineer`, `admin`. Access is enforced at two
levels:

1. A route-level `requireRole(...)` middleware for permissions that never
   depend on the data being accessed (for example, only an `admin` may
   delete a user).
2. Controller-level checks for permissions that depend on ownership or
   assignment — for example, a `client` may only view their own requests,
   and an `engineer` may only view requests assigned to them.

| Action                          | Client              | Engineer                  | Admin        |
| -------------------------------- | -------------------- | --------------------------- | ------------- |
| Create a request                 | Yes (their own)      | No                          | No            |
| List / view requests             | Own requests only    | Assigned requests only      | All requests  |
| Change a request's status        | Never                | `open` -> `resolved` only   | Any status    |
| Delete a request                 | No                    | No                          | Yes           |
| Assign an engineer               | No                    | No                          | Yes           |
| View comments                    | Public, own requests | All, any request            | All, any request |
| Post a comment                   | Public only          | Public or internal          | Public or internal |
| List / view users                | No                    | View a single user by id    | Full access   |
| Create / update / delete a user  | No                    | No                          | Yes           |

### Routes

**Requests**

- `GET /api/requests` — list, scoped by role.
- `GET /api/requests/:id`
- `POST /api/requests` — client only.
- `PUT /api/requests/:id` — update title, description, or priority.
- `PATCH /api/requests/:id` — update status (see role rules above).
- `DELETE /api/requests/:id` — admin only.
- `POST /api/requests/:id/assignments` — assign an engineer, admin only.
- `GET /api/requests/:id/comments`
- `POST /api/requests/:id/comments`

**Users**

- `GET /api/users` — admin only.
- `GET /api/users/:id` — admin or engineer.
- `POST /api/users` — admin only.
- `PATCH /api/users/:id` — admin only (no self-service updates).
- `DELETE /api/users/:id` — admin only.

**Other**

- `GET /health` — liveness check, public.
- `GET /api-docs` / `GET /api-docs.json` — API documentation, public.

## Database

PostgreSQL, accessed through a single connection pool (`src/db/postgres.ts`).
There is no migration framework: `src/db/schema.sql` drops and recreates
every table on each run of `npm run db:init`, which is intentional for a
project at this stage but should be replaced with real migrations (Flyway,
Prisma Migrate, node-pg-migrate, or similar) before this schema needs to
evolve without losing data.

Tables:

- `users` — id, full name, email (unique), password hash, role, active flag.
- `requests` — id, client, title, description, priority, status.
- `assignments` — one active engineer assignment per request
  (`UNIQUE(request_id)`).
- `request_status_history` — append-only log of every status change.
- `comments` — public or internal, tied to a request and an author.

Three PostgreSQL enums back `role`, `priority`, and `status`. Status has five
values: `open`, `in_progress`, `pending_client`, `resolved`, `closed`.

### Demo accounts

`npm run db:init` seeds four accounts, all sharing the password
`password123`:

| Role     | Email                |
| -------- | --------------------- |
| Admin    | admin@portal.local     |
| Client   | manoa@gmail.com        |
| Engineer | robel@gmail.com        |
| Client   | Fy@gmail.com            |

This shared demo password is intentional for local development and should
never be reused in a real deployment.

## Authentication and security details

- Passwords are hashed with bcrypt (10 salt rounds) and never returned in
  any API response.
- Login always returns a generic `401` for both "no such account" and
  "wrong password", to avoid revealing which emails are registered.
- JWTs are signed with `JWT_SECRET` and expire after 2 hours; there is no
  refresh-token flow — a user simply logs in again once expired.
- `helmet()` is applied globally for standard header hardening.
- CORS allows any origin when `NODE_ENV=development`, and is restricted to
  `https://<URL_SITE>` otherwise.
- A global rate limit of 100 requests per 15 minutes per client applies to
  every route, including `/health`.
- Unhandled errors are caught by a final error-handling middleware that logs
  the stack trace server-side and returns a generic `500` — no internal
  details are ever leaked to the client.

## Testing

The test suite uses Node's built-in test runner (no Jest, Mocha, or Vitest)
and runs against a real PostgreSQL database, not mocks or an in-memory
store.

```
npm test
```

This resets and reseeds the database (via `db:init`) before running every
`*.test.ts` file under `tests/`. To also generate a coverage report:

```
npm run test:coverage
```

Coverage is written to `coverage/lcov.info`. There is currently no linter
configured for this project.

## Continuous integration

Two GitHub Actions workflows run on every push to `main` and on every pull
request (defined at the repository root, under `.github/workflows/`):

- **`build.yml`** — spins up a PostgreSQL 16 service container, installs
  dependencies, runs the test suite with coverage, compiles the project, and
  submits the coverage report to SonarQube.
- **`snyk-scan.yml`** — scans production dependencies for known
  vulnerabilities at high severity and above.

## Troubleshooting

- **Server exits immediately with a JSON error about environment
  variables** — one or more required variables in `.env` are missing or
  invalid. The error message lists exactly which ones.
- **`ECONNREFUSED` connecting to PostgreSQL** — confirm PostgreSQL is
  running and that `DB_HOST` / `DB_PORT` are correct. `npm run db:init` must
  succeed before `npm run dev` or `npm test` will work.
- **`password authentication failed for user`** — `DB_USER` / `DB_PASSWORD`
  do not match a valid PostgreSQL role, or that role lacks permission to
  connect to the `postgres` maintenance database (needed the first time,
  to create `DB_NAME`).
- **Frontend requests fail with a CORS error** — confirm `NODE_ENV` is
  `development` while developing locally, or that `URL_SITE` matches the
  frontend's actual origin in non-development environments.
- **Login for a demo account fails** — `PASSWORD_HASH` in `.env` must be a
  bcrypt hash of the password you intend to use for all seeded accounts, and
  `npm run db:init` must be re-run after changing it, since seeding is what
  writes that hash into the `users` table.
