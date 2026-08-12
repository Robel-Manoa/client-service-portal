import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import app from "../src/app";
import { SEED_IDS } from "../src/core/database";

// validate.middleware.ts's 400 branch has no coverage anywhere else: every
// other test file only ever sends valid payloads. One test per schema here,
// each asserting both the 400 status and that `details` names the bad
// field, plus authenticate's invalid-token branch (same "bad input" theme).

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

/**
 * @param {Response} res
 * @param {string} field name expected somewhere in details[].field
 */
async function assertInvalid(res: Response, field: string) {
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error, "Invalid data");
  assert.ok(
    body.details.some((detail: { field: string }) => detail.field === field),
    `expected a validation error on "${field}", got: ${JSON.stringify(body.details)}`,
  );
}

// --- POST /api/auth/login ---

test("login without a password is rejected (400)", async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@portal.local" }),
  });
  await assertInvalid(res, "password");
});

// --- POST /api/requests ---

test("creating a request with a too-short title is rejected (400)", async () => {
  const token = await tokenFor("manoa@gmail.com");
  const res = await fetch(
    `${baseUrl}/api/requests`,
    authed(token, {
      method: "POST",
      body: JSON.stringify({
        title: "Hi",
        description: "A perfectly valid description.",
        priority: "low",
      }),
    }),
  );
  await assertInvalid(res, "title");
});

test("creating a request with a too-short description is rejected (400)", async () => {
  const token = await tokenFor("manoa@gmail.com");
  const res = await fetch(
    `${baseUrl}/api/requests`,
    authed(token, {
      method: "POST",
      body: JSON.stringify({
        title: "A valid title",
        description: "short",
        priority: "low",
      }),
    }),
  );
  await assertInvalid(res, "description");
});

test("creating a request with an invalid priority is rejected (400)", async () => {
  const token = await tokenFor("manoa@gmail.com");
  const res = await fetch(
    `${baseUrl}/api/requests`,
    authed(token, {
      method: "POST",
      body: JSON.stringify({
        title: "A valid title",
        description: "A perfectly valid description.",
        priority: "urgent",
      }),
    }),
  );
  await assertInvalid(res, "priority");
});

// --- PATCH /api/requests/:id (status) ---

test("setting an invalid status is rejected (400)", async () => {
  const token = await tokenFor("admin@portal.local");
  const res = await fetch(
    `${baseUrl}/api/requests/${SEED_IDS.request1}`,
    authed(token, {
      method: "PATCH",
      body: JSON.stringify({ status: "archived" }),
    }),
  );
  await assertInvalid(res, "status");
});

// --- POST /api/requests/:id/comments ---

test("posting an empty comment is rejected (400)", async () => {
  const token = await tokenFor("manoa@gmail.com");
  const res = await fetch(
    `${baseUrl}/api/requests/${SEED_IDS.request1}/comments`,
    authed(token, {
      method: "POST",
      body: JSON.stringify({ body: "" }),
    }),
  );
  await assertInvalid(res, "body");
});

// --- POST /api/users ---

test("creating a user with a too-short name is rejected (400)", async () => {
  const token = await tokenFor("admin@portal.local");
  const res = await fetch(
    `${baseUrl}/api/users`,
    authed(token, {
      method: "POST",
      body: JSON.stringify({
        name: "Bob",
        email: "valid-email@example.com",
        password: "password123",
      }),
    }),
  );
  await assertInvalid(res, "name");
});

test("creating a user with a too-short password is rejected (400)", async () => {
  const token = await tokenFor("admin@portal.local");
  const res = await fetch(
    `${baseUrl}/api/users`,
    authed(token, {
      method: "POST",
      body: JSON.stringify({
        name: "A Valid Name",
        email: "another-valid-email@example.com",
        password: "short",
      }),
    }),
  );
  await assertInvalid(res, "password");
});

test("creating a user with an invalid email is rejected (400)", async () => {
  const token = await tokenFor("admin@portal.local");
  const res = await fetch(
    `${baseUrl}/api/users`,
    authed(token, {
      method: "POST",
      body: JSON.stringify({
        name: "A Valid Name",
        email: "not-an-email",
        password: "password123",
      }),
    }),
  );
  await assertInvalid(res, "email");
});

// --- authenticate: invalid/expired token ---

test("a malformed bearer token is rejected (401), not just a missing one", async () => {
  const res = await fetch(`${baseUrl}/api/requests`, {
    headers: { Authorization: "Bearer not-a-real-jwt" },
  });
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.error, "Invalid or expired token");
});
