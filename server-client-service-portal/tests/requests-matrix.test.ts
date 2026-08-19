import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import app from "../src/app";
import { SEED_IDS } from "../src/core/database";

// Covers the Client/Engineer/Admin access matrix on requests: creation,
// status transitions, engineer assignment, comments.
// Seed data: SEED_IDS.request1 belongs to SEED_IDS.client1, assigned to
// SEED_IDS.engineer, with one public comment and one internal comment.

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

// --- POST /api/requests: client-only ---

test("POST /api/requests: an engineer cannot create a request (403)", async () => {
  const token = await tokenFor("robel@gmail.com"); // SEED_IDS.engineer
  const res = await fetch(
    `${baseUrl}/api/requests`,
    authed(token, {
      method: "POST",
      body: JSON.stringify({
        title: "Engineer request",
        description: "Should not go through",
        priority: "low",
      }),
    }),
  );
  assert.equal(res.status, 403);
});

test("POST /api/requests: an admin cannot create a request (403)", async () => {
  const token = await tokenFor("admin@portal.local");
  const res = await fetch(
    `${baseUrl}/api/requests`,
    authed(token, {
      method: "POST",
      body: JSON.stringify({
        title: "Admin request",
        description: "Should not go through",
        priority: "low",
      }),
    }),
  );
  assert.equal(res.status, 403);
});

test("POST /api/requests: a client can create a request (201)", async () => {
  const token = await tokenFor("manoa@gmail.com");
  const res = await fetch(
    `${baseUrl}/api/requests`,
    authed(token, {
      method: "POST",
      body: JSON.stringify({
        title: "New test request",
        description: "Description long enough to pass Zod validation",
        priority: "medium",
      }),
    }),
  );
  const body = await res.json();
  assert.equal(res.status, 201);
  assert.equal(body.client_id, SEED_IDS.client1);
  assert.equal(body.status, "open");
});

// --- GET /api/requests: role-based filtering ---

test("GET /api/requests: an engineer only sees requests assigned to them", async () => {
  const token = await tokenFor("robel@gmail.com"); // assigned to SEED_IDS.request1 in the seed data
  const res = await fetch(`${baseUrl}/api/requests`, authed(token));
  const requests: Array<{ id: string; assigned_engineer_id?: string }> =
    await res.json();

  assert.equal(res.status, 200);
  assert.ok(requests.some((r) => r.id === SEED_IDS.request1));
  assert.ok(
    requests.every((r) => r.assigned_engineer_id === SEED_IDS.engineer),
    "an engineer should only see requests assigned to them",
  );
});

// --- PATCH /api/requests/:id: status transitions ---

test("status transitions: a client can never change the status (403)", async () => {
  const clientToken = await tokenFor("manoa@gmail.com");
  const created = await fetch(
    `${baseUrl}/api/requests`,
    authed(clientToken, {
      method: "POST",
      body: JSON.stringify({
        title: "Request for status test",
        description: "Description long enough for Zod",
        priority: "low",
      }),
    }),
  ).then((r) => r.json());

  const res = await fetch(
    `${baseUrl}/api/requests/${created.id}`,
    authed(clientToken, {
      method: "PATCH",
      body: JSON.stringify({ status: "resolved" }),
    }),
  );
  assert.equal(res.status, 403);
});

test("status transitions: an engineer cannot change status on a request not assigned to them (403)", async () => {
  const clientToken = await tokenFor("manoa@gmail.com");
  const created = await fetch(
    `${baseUrl}/api/requests`,
    authed(clientToken, {
      method: "POST",
      body: JSON.stringify({
        title: "Unassigned request for engineer PATCH test",
        description: "Description long enough for Zod",
        priority: "low",
      }),
    }),
  ).then((r) => r.json());

  const engineerToken = await tokenFor("robel@gmail.com");
  const res = await fetch(
    `${baseUrl}/api/requests/${created.id}`,
    authed(engineerToken, {
      method: "PATCH",
      body: JSON.stringify({ status: "resolved" }),
    }),
  );
  assert.equal(res.status, 403);
});

test("status transitions: an assigned engineer still CANNOT go from open -> in_progress (403)", async () => {
  const clientToken = await tokenFor("manoa@gmail.com");
  const created = await fetch(
    `${baseUrl}/api/requests`,
    authed(clientToken, {
      method: "POST",
      body: JSON.stringify({
        title: "Request for in_progress test",
        description: "Description long enough for Zod",
        priority: "low",
      }),
    }),
  ).then((r) => r.json());

  const adminToken = await tokenFor("admin@portal.local");
  await fetch(
    `${baseUrl}/api/requests/${created.id}/assignments`,
    authed(adminToken, {
      method: "POST",
      body: JSON.stringify({ engineer_id: SEED_IDS.engineer }),
    }),
  );

  const engineerToken = await tokenFor("robel@gmail.com");
  const res = await fetch(
    `${baseUrl}/api/requests/${created.id}`,
    authed(engineerToken, {
      method: "PATCH",
      body: JSON.stringify({ status: "in_progress" }),
    }),
  );
  assert.equal(res.status, 403);
});

test("status transitions: the assigned engineer CAN go from open -> resolved (200)", async () => {
  const clientToken = await tokenFor("manoa@gmail.com");
  const created = await fetch(
    `${baseUrl}/api/requests`,
    authed(clientToken, {
      method: "POST",
      body: JSON.stringify({
        title: "Request for resolved test",
        description: "Description long enough for Zod",
        priority: "low",
      }),
    }),
  ).then((r) => r.json());

  const adminToken = await tokenFor("admin@portal.local");
  await fetch(
    `${baseUrl}/api/requests/${created.id}/assignments`,
    authed(adminToken, {
      method: "POST",
      body: JSON.stringify({ engineer_id: SEED_IDS.engineer }),
    }),
  );

  const engineerToken = await tokenFor("robel@gmail.com");
  const res = await fetch(
    `${baseUrl}/api/requests/${created.id}`,
    authed(engineerToken, {
      method: "PATCH",
      body: JSON.stringify({ status: "resolved" }),
    }),
  );
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.status, "resolved");

  // An admin can then close the request, a transition the engineer doesn't have.
  const closeRes = await fetch(
    `${baseUrl}/api/requests/${created.id}`,
    authed(adminToken, {
      method: "PATCH",
      body: JSON.stringify({ status: "closed" }),
    }),
  );
  const closeBody = await closeRes.json();

  assert.equal(closeRes.status, 200);
  assert.equal(closeBody.status, "closed");
});

// --- POST /api/requests/:id/assignments: admin only ---

test("assignment: a client cannot assign an engineer (403)", async () => {
  const token = await tokenFor("manoa@gmail.com");
  const res = await fetch(
    `${baseUrl}/api/requests/${SEED_IDS.request1}/assignments`,
    authed(token, {
      method: "POST",
      body: JSON.stringify({ engineer_id: SEED_IDS.engineer }),
    }),
  );
  assert.equal(res.status, 403);
});

test("assignment: a missing request id is a 404", async () => {
  const token = await tokenFor("admin@portal.local");
  const res = await fetch(
    `${baseUrl}/api/requests/00000000-0000-4000-8000-999999999999/assignments`,
    authed(token, {
      method: "POST",
      body: JSON.stringify({ engineer_id: SEED_IDS.engineer }),
    }),
  );
  assert.equal(res.status, 404);
});

test("assignment: an admin cannot assign a user who isn't an engineer (400)", async () => {
  const token = await tokenFor("admin@portal.local");
  const res = await fetch(
    `${baseUrl}/api/requests/${SEED_IDS.request1}/assignments`,
    authed(token, {
      method: "POST",
      // SEED_IDS.client1 is a client, not an engineer
      body: JSON.stringify({ engineer_id: SEED_IDS.client1 }),
    }),
  );
  assert.equal(res.status, 400);
});

test("assignment: an admin can assign a valid engineer (201)", async () => {
  const clientToken = await tokenFor("manoa@gmail.com");
  const created = await fetch(
    `${baseUrl}/api/requests`,
    authed(clientToken, {
      method: "POST",
      body: JSON.stringify({
        title: "Request for assignment test",
        description: "Description long enough for Zod",
        priority: "low",
      }),
    }),
  ).then((r) => r.json());

  const adminToken = await tokenFor("admin@portal.local");
  const res = await fetch(
    `${baseUrl}/api/requests/${created.id}/assignments`,
    authed(adminToken, {
      method: "POST",
      body: JSON.stringify({ engineer_id: SEED_IDS.engineer }),
    }),
  );
  const body = await res.json();

  assert.equal(res.status, 201);
  assert.equal(body.assigned_engineer_id, SEED_IDS.engineer);
});

// --- Comments: role-based visibility ---

test("comments: the owning client only sees public comments", async () => {
  const token = await tokenFor("manoa@gmail.com"); // owns SEED_IDS.request1
  const res = await fetch(`${baseUrl}/api/requests/${SEED_IDS.request1}/comments`, authed(token));
  const comments: Array<{ visibility: string }> = await res.json();

  assert.equal(res.status, 200);
  assert.ok(comments.length > 0);
  assert.ok(comments.every((c) => c.visibility === "public"));
});

test("comments: a client who doesn't own the request has no access (403)", async () => {
  const token = await tokenFor("Fy@gmail.com"); // SEED_IDS.client2, doesn't own SEED_IDS.request1
  const res = await fetch(`${baseUrl}/api/requests/${SEED_IDS.request1}/comments`, authed(token));
  assert.equal(res.status, 403);
});

test("comments: staff also see internal comments", async () => {
  const token = await tokenFor("admin@portal.local");
  const res = await fetch(`${baseUrl}/api/requests/${SEED_IDS.request1}/comments`, authed(token));
  const comments: Array<{ visibility: string }> = await res.json();

  assert.equal(res.status, 200);
  assert.ok(comments.some((c) => c.visibility === "internal"));
});

test("comments: the assigned engineer also sees internal comments", async () => {
  const token = await tokenFor("robel@gmail.com"); // assigned to SEED_IDS.request1
  const res = await fetch(`${baseUrl}/api/requests/${SEED_IDS.request1}/comments`, authed(token));
  const comments: Array<{ visibility: string }> = await res.json();

  assert.equal(res.status, 200);
  assert.ok(comments.some((c) => c.visibility === "internal"));
});

test("comments: an engineer NOT assigned to the request cannot read comments (403)", async () => {
  const clientToken = await tokenFor("manoa@gmail.com");
  const created = await fetch(
    `${baseUrl}/api/requests`,
    authed(clientToken, {
      method: "POST",
      body: JSON.stringify({
        title: "Unassigned request for engineer comment-read test",
        description: "Description long enough for Zod",
        priority: "low",
      }),
    }),
  ).then((r) => r.json());

  const engineerToken = await tokenFor("robel@gmail.com");
  const res = await fetch(
    `${baseUrl}/api/requests/${created.id}/comments`,
    authed(engineerToken),
  );
  assert.equal(res.status, 403);
});

test("comments: an engineer NOT assigned to the request cannot post a comment (403)", async () => {
  const clientToken = await tokenFor("manoa@gmail.com");
  const created = await fetch(
    `${baseUrl}/api/requests`,
    authed(clientToken, {
      method: "POST",
      body: JSON.stringify({
        title: "Unassigned request for engineer comment-post test",
        description: "Description long enough for Zod",
        priority: "low",
      }),
    }),
  ).then((r) => r.json());

  const engineerToken = await tokenFor("robel@gmail.com");
  const res = await fetch(
    `${baseUrl}/api/requests/${created.id}/comments`,
    authed(engineerToken, {
      method: "POST",
      body: JSON.stringify({ body: "Should not be allowed", visibility: "public" }),
    }),
  );
  assert.equal(res.status, 403);
});

test("comments: a client posting as 'internal' is forced to 'public'", async () => {
  const token = await tokenFor("manoa@gmail.com");
  const res = await fetch(
    `${baseUrl}/api/requests/${SEED_IDS.request1}/comments`,
    authed(token, {
      method: "POST",
      body: JSON.stringify({ body: "Client comment", visibility: "internal" }),
    }),
  );
  const body = await res.json();

  assert.equal(res.status, 201);
  assert.equal(body.visibility, "public", "a client should never be able to post internally");
});

test("comments: an engineer can post an internal comment", async () => {
  const token = await tokenFor("robel@gmail.com");
  const res = await fetch(
    `${baseUrl}/api/requests/${SEED_IDS.request1}/comments`,
    authed(token, {
      method: "POST",
      body: JSON.stringify({ body: "Engineer internal note", visibility: "internal" }),
    }),
  );
  const body = await res.json();

  assert.equal(res.status, 201);
  assert.equal(body.visibility, "internal");
});
