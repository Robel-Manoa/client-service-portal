import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import app from "../src/app";
import { SEED_IDS } from "../src/core/database";

// Covers the single-resource request routes that requests-matrix.test.ts
// doesn't touch: GET/PUT/DELETE /api/requests/:id.
// Seed data: SEED_IDS.request1 (status "open") belongs to SEED_IDS.client1
// (manoa@gmail.com), assigned to SEED_IDS.engineer (robel@gmail.com).
// SEED_IDS.client2 (Fy@gmail.com) owns nothing.

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

// --- GET /api/requests/:id ---

test("GET /api/requests/:id: the owning client can view their request", async () => {
  const token = await tokenFor("manoa@gmail.com"); // SEED_IDS.client1
  const res = await fetch(
    `${baseUrl}/api/requests/${SEED_IDS.request1}`,
    authed(token),
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.id, SEED_IDS.request1);
});

test("GET /api/requests/:id: staff (admin/engineer) can view any request", async () => {
  const adminToken = await tokenFor("admin@portal.local");
  const adminRes = await fetch(
    `${baseUrl}/api/requests/${SEED_IDS.request1}`,
    authed(adminToken),
  );
  assert.equal(adminRes.status, 200);

  const engineerToken = await tokenFor("robel@gmail.com");
  const engineerRes = await fetch(
    `${baseUrl}/api/requests/${SEED_IDS.request1}`,
    authed(engineerToken),
  );
  assert.equal(engineerRes.status, 200);
});

test("GET /api/requests/:id: a client who doesn't own it is denied (403)", async () => {
  const token = await tokenFor("Fy@gmail.com"); // SEED_IDS.client2
  const res = await fetch(
    `${baseUrl}/api/requests/${SEED_IDS.request1}`,
    authed(token),
  );
  assert.equal(res.status, 403);
});

test("GET /api/requests/:id: a missing id is a 404", async () => {
  const token = await tokenFor("admin@portal.local");
  const res = await fetch(
    `${baseUrl}/api/requests/00000000-0000-4000-8000-999999999999`,
    authed(token),
  );
  assert.equal(res.status, 404);
});

// --- PUT /api/requests/:id ---

test("PUT /api/requests/:id: the owning client can update title/description/priority", async () => {
  const token = await tokenFor("manoa@gmail.com");
  const res = await fetch(
    `${baseUrl}/api/requests/${SEED_IDS.request1}`,
    authed(token, {
      method: "PUT",
      body: JSON.stringify({ title: "Updated title for my request" }),
    }),
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.title, "Updated title for my request");
});

test("PUT /api/requests/:id: staff can also update it", async () => {
  const token = await tokenFor("admin@portal.local");
  const res = await fetch(
    `${baseUrl}/api/requests/${SEED_IDS.request1}`,
    authed(token, {
      method: "PUT",
      body: JSON.stringify({ priority: "low" }),
    }),
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.priority, "low");
});

test("PUT /api/requests/:id: a non-owner client is denied (403)", async () => {
  const token = await tokenFor("Fy@gmail.com");
  const res = await fetch(
    `${baseUrl}/api/requests/${SEED_IDS.request1}`,
    authed(token, {
      method: "PUT",
      body: JSON.stringify({ title: "Hijacked title attempt" }),
    }),
  );
  assert.equal(res.status, 403);
});

test("PUT /api/requests/:id: a missing id is a 404", async () => {
  const token = await tokenFor("admin@portal.local");
  const res = await fetch(
    `${baseUrl}/api/requests/00000000-0000-4000-8000-999999999999`,
    authed(token, {
      method: "PUT",
      body: JSON.stringify({ title: "Doesn't matter, id is missing" }),
    }),
  );
  assert.equal(res.status, 404);
});

// --- DELETE /api/requests/:id (admin-only) ---

test("DELETE /api/requests/:id: a client cannot delete a request (403)", async () => {
  const token = await tokenFor("manoa@gmail.com");
  const res = await fetch(
    `${baseUrl}/api/requests/${SEED_IDS.request1}`,
    authed(token, { method: "DELETE" }),
  );
  assert.equal(res.status, 403);
});

test("DELETE /api/requests/:id: an engineer cannot delete a request (403)", async () => {
  const token = await tokenFor("robel@gmail.com");
  const res = await fetch(
    `${baseUrl}/api/requests/${SEED_IDS.request1}`,
    authed(token, { method: "DELETE" }),
  );
  assert.equal(res.status, 403);
});

test("DELETE /api/requests/:id: an admin can delete a request (204), and a second delete 404s", async () => {
  const adminToken = await tokenFor("admin@portal.local");
  const clientToken = await tokenFor("manoa@gmail.com");

  // Create a throwaway request so this test doesn't delete the shared
  // seed record other tests in the suite still rely on.
  const created = await fetch(
    `${baseUrl}/api/requests`,
    authed(clientToken, {
      method: "POST",
      body: JSON.stringify({
        title: "Request created only to be deleted",
        description: "This request exists purely for the delete test.",
        priority: "low",
      }),
    }),
  );
  const { id } = await created.json();

  const deleteRes = await fetch(
    `${baseUrl}/api/requests/${id}`,
    authed(adminToken, { method: "DELETE" }),
  );
  assert.equal(deleteRes.status, 204);

  const secondDeleteRes = await fetch(
    `${baseUrl}/api/requests/${id}`,
    authed(adminToken, { method: "DELETE" }),
  );
  assert.equal(secondDeleteRes.status, 404);
});
