import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import app from "../src/app";
import { SEED_IDS } from "../src/core/database";

// Covers the user-management branches auth.test.ts doesn't reach:
// DELETE /api/users/:id, the GET /api/users/:id 404 branch, and
// loginUser's failure paths (wrong password, unknown email, disabled
// account) at the HTTP level — auth.test.ts only exercises the success path.

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

async function tokenFor(email: string) {
  const { body } = await login(email, "password123");
  return body.token as string;
}

function authed(token: string, init: RequestInit = {}) {
  return {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  };
}

// --- loginUser failure branches ---

test("login with the wrong password is rejected (401)", async () => {
  const { status, body } = await login("manoa@gmail.com", "wrong-password");
  assert.equal(status, 401);
  assert.equal(body.error, "Invalid credentials");
});

test("login with an email that doesn't exist is rejected (401)", async () => {
  const { status, body } = await login("nobody@example.com", "password123");
  assert.equal(status, 401);
  assert.equal(body.error, "Invalid credentials");
});

test("login for a disabled account is rejected (403), even with the right password", async () => {
  const adminToken = await tokenFor("admin@portal.local");

  const created = await fetch(
    `${baseUrl}/api/users`,
    authed(adminToken, {
      method: "POST",
      body: JSON.stringify({
        name: "Disabled Tester",
        email: "disabled-tester@example.com",
        password: "password123",
        role: "client",
        is_active: false,
      }),
    }),
  );
  assert.equal(created.status, 201);

  const { status, body } = await login(
    "disabled-tester@example.com",
    "password123",
  );
  assert.equal(status, 403);
  assert.equal(body.error, "Account disabled");
});

// --- GET /api/users/:id ---

test("GET /api/users/:id: a missing id is a 404", async () => {
  const token = await tokenFor("admin@portal.local");
  const res = await fetch(
    `${baseUrl}/api/users/00000000-0000-4000-8000-999999999999`,
    authed(token),
  );
  assert.equal(res.status, 404);
});

// --- DELETE /api/users/:id (admin-only) ---

test("DELETE /api/users/:id: a client cannot delete a user (403)", async () => {
  const token = await tokenFor("manoa@gmail.com");
  const res = await fetch(
    `${baseUrl}/api/users/${SEED_IDS.client2}`,
    authed(token, { method: "DELETE" }),
  );
  assert.equal(res.status, 403);
});

test("DELETE /api/users/:id: an engineer cannot delete a user (403)", async () => {
  const token = await tokenFor("robel@gmail.com");
  const res = await fetch(
    `${baseUrl}/api/users/${SEED_IDS.client2}`,
    authed(token, { method: "DELETE" }),
  );
  assert.equal(res.status, 403);
});

test("DELETE /api/users/:id: a missing id is a 404", async () => {
  const token = await tokenFor("admin@portal.local");
  const res = await fetch(
    `${baseUrl}/api/users/00000000-0000-4000-8000-999999999999`,
    authed(token, { method: "DELETE" }),
  );
  assert.equal(res.status, 404);
});

test("DELETE /api/users/:id: an admin can delete a user (204), and a second delete 404s", async () => {
  const adminToken = await tokenFor("admin@portal.local");

  // A throwaway user, so this doesn't delete any seed account other tests
  // in the suite (or other files, if run in the same process) rely on.
  const created = await fetch(
    `${baseUrl}/api/users`,
    authed(adminToken, {
      method: "POST",
      body: JSON.stringify({
        name: "Delete Me Tester",
        email: "delete-me-tester@example.com",
        password: "password123",
      }),
    }),
  );
  const { id } = await created.json();

  const deleteRes = await fetch(
    `${baseUrl}/api/users/${id}`,
    authed(adminToken, { method: "DELETE" }),
  );
  assert.equal(deleteRes.status, 204);

  const secondDeleteRes = await fetch(
    `${baseUrl}/api/users/${id}`,
    authed(adminToken, { method: "DELETE" }),
  );
  assert.equal(secondDeleteRes.status, 404);
});
