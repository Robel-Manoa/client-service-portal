import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import app from "../src/app";
import { SEED_IDS } from "../src/core/database";

// These tests cover the authentication/authorization flow that broke
// silently once before (authenticate/requireRole ran in the wrong order):
// login -> token -> protected route, plus the 401/403/ownership cases.

let server: Server;
let baseUrl: string;

before(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

async function login(email: string, password: string) {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return { status: res.status, body: await res.json() };
}

test("GET /health returns 200 without authentication", async () => {
  const res = await fetch(`${baseUrl}/health`);
  assert.equal(res.status, 200);
});

test("GET /api/users without a token is rejected (401)", async () => {
  const res = await fetch(`${baseUrl}/api/users`);
  assert.equal(res.status, 401);
});

test("logging in as admin then GET /api/users succeeds — confirms authenticate runs before requireRole", async () => {
  const { status, body: loginBody } = await login(
    "admin@portal.local",
    "password123",
  );
  assert.equal(status, 200);
  assert.ok(loginBody.token, "a JWT token should be returned");

  const res = await fetch(`${baseUrl}/api/users`, {
    headers: { Authorization: `Bearer ${loginBody.token}` },
  });
  assert.equal(res.status, 200);
});

test("logging in as a client then GET /api/users is denied (403: insufficient role)", async () => {
  const { body: loginBody } = await login("manoa@gmail.com", "password123");

  const res = await fetch(`${baseUrl}/api/users`, {
    headers: { Authorization: `Bearer ${loginBody.token}` },
  });
  assert.equal(res.status, 403);
});

test("logging in as an engineer then GET /api/users is denied (403: GET /users is admin-only)", async () => {
  const { body: loginBody } = await login("robel@gmail.com", "password123");

  const res = await fetch(`${baseUrl}/api/users`, {
    headers: { Authorization: `Bearer ${loginBody.token}` },
  });
  assert.equal(res.status, 403);
});

test("PATCH /api/users/:id is admin-only: a client cannot update their own profile (403)", async () => {
  const { body: loginBody } = await login("manoa@gmail.com", "password123");

  const res = await fetch(`${baseUrl}/api/users/${SEED_IDS.client1}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${loginBody.token}`,
    },
    body: JSON.stringify({ role: "admin" }),
  });
  assert.equal(res.status, 403);
});

test("an admin can update any user via PATCH /api/users/:id", async () => {
  const { body: loginBody } = await login("admin@portal.local", "password123");

  const res = await fetch(`${baseUrl}/api/users/${SEED_IDS.client2}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${loginBody.token}`,
    },
    body: JSON.stringify({ name: "Fy (updated)" }),
  });
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.name, "Fy (updated)");
});

test("an admin cannot create a user with an email that's already in use (409)", async () => {
  const { body: loginBody } = await login("admin@portal.local", "password123");

  const res = await fetch(`${baseUrl}/api/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${loginBody.token}`,
    },
    body: JSON.stringify({
      name: "Duplicate",
      email: "manoa@gmail.com", // already taken by SEED_IDS.client1
      password: "azertyui",
    }),
  });
  assert.equal(res.status, 409);
});

test("an admin cannot change a user's email to one already taken by someone else (409)", async () => {
  const { body: loginBody } = await login("admin@portal.local", "password123");

  const res = await fetch(`${baseUrl}/api/users/${SEED_IDS.client2}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${loginBody.token}`,
    },
    body: JSON.stringify({ email: "manoa@gmail.com" }), // already taken by SEED_IDS.client1
  });
  assert.equal(res.status, 409);
});

test("dates are returned in DD-MM-YYYY HH:mm format, for both seed data and freshly created records", async () => {
  const DATE_FORMAT = /^\d{2}-\d{2}-\d{4} \d{2}:\d{2}$/;
  const { body: loginBody } = await login("admin@portal.local", "password123");

  // Seed data (stored internally as plain "2023-04-25", no time)
  const seedUser = await fetch(`${baseUrl}/api/users/${SEED_IDS.client1}`, {
    headers: { Authorization: `Bearer ${loginBody.token}` },
  }).then((r) => r.json());
  assert.match(seedUser.created_at, DATE_FORMAT);

  // Freshly created data (stored internally as ISO with time)
  const created = await fetch(`${baseUrl}/api/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${loginBody.token}`,
    },
    body: JSON.stringify({
      name: "Date Format Test",
      email: "test-format-date@example.com",
      password: "azertyui",
    }),
  }).then((r) => r.json());
  assert.match(created.created_at, DATE_FORMAT);
});

test("a client only sees their own requests on GET /api/requests", async () => {
  const { body: loginBody } = await login("manoa@gmail.com", "password123");

  const res = await fetch(`${baseUrl}/api/requests`, {
    headers: { Authorization: `Bearer ${loginBody.token}` },
  });
  const requests = await res.json();

  assert.equal(res.status, 200);
  assert.ok(
    requests.every((r: { client_id: string }) => r.client_id === SEED_IDS.client1),
    "a client should only see requests they own",
  );
});
