// Tests the Postgres-backed ports.ts implementation directly (the storage
// layer core/*.service.ts now defaults to — see core/postgres.repositories.ts).
//
// Unlike user-service.test.ts/request.service.test.ts, these repositories
// always query through the shared dbPool rather than accepting an
// injectable client, so there's no single connection to BEGIN/ROLLBACK on.
// Instead, every test tracks the user ids it creates and deletes them in
// afterEach — deleting a user cascades to their requests, comments,
// assignments and status history (see ON DELETE CASCADE in schema.sql), so
// that one cleanup step is enough to leave no trace.

import { test, afterEach, after } from "node:test";
import assert from "node:assert/strict";
import {
  userRepository,
  requestRepository,
  commentRepository,
} from "../src/core/postgres.repositories";
import { generateId } from "../src/core/id.util";
import { dbPool } from "../src/db/postgres";
import type { RequestComment, ServiceRequest, User } from "../src/core/types";

let createdUserIds: string[] = [];

afterEach(async () => {
  for (const id of createdUserIds) {
    await userRepository.deleteById(id);
  }
  createdUserIds = [];
});

after(async () => {
  await dbPool.end();
});

function testUser(overrides: Partial<User> = {}): User {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    name: "Test User",
    email: `user-${generateId()}@example.com`,
    password: "hashed-password",
    role: "client",
    is_active: true,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

async function createUser(overrides: Partial<User> = {}): Promise<User> {
  const user = testUser(overrides);
  await userRepository.insert(user);
  createdUserIds.push(user.id);
  return user;
}

function testRequest(clientId: string, overrides: Partial<ServiceRequest> = {}): ServiceRequest {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    client_id: clientId,
    title: "Test request",
    description: "Test description",
    priority: "low",
    status: "open",
    created_at: now,
    updated_at: now,
    status_history: [{ status: "open", at: now }],
    ...overrides,
  };
}

function testComment(
  requestId: string,
  authorId: string,
  overrides: Partial<RequestComment> = {},
): RequestComment {
  return {
    id: generateId(),
    request_id: requestId,
    author_id: authorId,
    body: "Test comment",
    visibility: "public",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// --- PostgresUserRepository ---

test("UserRepository: insert() + findById() round-trips a user", async () => {
  const user = await createUser({ name: "Ada Lovelace", role: "engineer" });

  const found = await userRepository.findById(user.id);

  assert.ok(found);
  assert.equal(found?.name, "Ada Lovelace");
  assert.equal(found?.email, user.email);
  assert.equal(found?.role, "engineer");
  assert.equal(found?.is_active, true);
});

test("UserRepository: findById() returns undefined for a missing id", async () => {
  const found = await userRepository.findById(generateId());
  assert.equal(found, undefined);
});

test("UserRepository: findByEmail() finds by email", async () => {
  const user = await createUser();

  const found = await userRepository.findByEmail(user.email);

  assert.equal(found?.id, user.id);
});

test("UserRepository: findByEmail() returns undefined for an unknown email", async () => {
  const found = await userRepository.findByEmail("nobody@example.com");
  assert.equal(found, undefined);
});

test("UserRepository: findAll() includes an inserted user", async () => {
  const user = await createUser();

  const all = await userRepository.findAll();

  assert.ok(all.some((u) => u.id === user.id));
});

test("UserRepository: save() persists changes", async () => {
  const user = await createUser({ name: "Before", is_active: true });

  user.name = "After";
  user.is_active = false;
  await userRepository.save(user);

  const found = await userRepository.findById(user.id);
  assert.equal(found?.name, "After");
  assert.equal(found?.is_active, false);
});

test("UserRepository: deleteById() removes the user and reports success", async () => {
  const user = await testUser();
  await userRepository.insert(user);

  const deleted = await userRepository.deleteById(user.id);
  assert.equal(deleted, true);

  const found = await userRepository.findById(user.id);
  assert.equal(found, undefined);
});

test("UserRepository: deleteById() returns false for a missing id", async () => {
  const deleted = await userRepository.deleteById(generateId());
  assert.equal(deleted, false);
});

// --- PostgresRequestRepository ---

test("RequestRepository: insert() + findById() round-trips a request with its status history", async () => {
  const client = await createUser({ role: "client" });
  const request = testRequest(client.id, { title: "Login form bug", priority: "high" });

  await requestRepository.insert(request);
  const found = await requestRepository.findById(request.id);

  assert.ok(found);
  assert.equal(found?.title, "Login form bug");
  assert.equal(found?.priority, "high");
  assert.equal(found?.status, "open");
  assert.equal(found?.assigned_engineer_id, undefined);
  assert.equal(found?.status_history.length, 1);
  assert.equal(found?.status_history[0].status, "open");
});

test("RequestRepository: findById() returns undefined for a missing id", async () => {
  const found = await requestRepository.findById(generateId());
  assert.equal(found, undefined);
});

test("RequestRepository: findAllByClient() only returns that client's requests", async () => {
  const clientA = await createUser({ role: "client" });
  const clientB = await createUser({ role: "client" });
  const requestA = testRequest(clientA.id, { title: "From A" });
  const requestB = testRequest(clientB.id, { title: "From B" });
  await requestRepository.insert(requestA);
  await requestRepository.insert(requestB);

  const results = await requestRepository.findAllByClient(clientA.id);

  assert.ok(results.every((r) => r.client_id === clientA.id));
  assert.ok(results.some((r) => r.id === requestA.id));
  assert.ok(!results.some((r) => r.id === requestB.id));
});

test("RequestRepository: findAllByEngineer() only returns requests assigned to that engineer", async () => {
  const client = await createUser({ role: "client" });
  const engineer = await createUser({ role: "engineer" });
  const assigned = testRequest(client.id, { title: "Assigned", assigned_engineer_id: engineer.id });
  const unassigned = testRequest(client.id, { title: "Unassigned" });
  await requestRepository.insert(assigned);
  await requestRepository.insert(unassigned);

  const results = await requestRepository.findAllByEngineer(engineer.id);

  assert.equal(results.length, 1);
  assert.equal(results[0].id, assigned.id);
});

test("RequestRepository: save() updates title/description/priority", async () => {
  const client = await createUser({ role: "client" });
  const request = testRequest(client.id);
  await requestRepository.insert(request);

  request.title = "Updated title";
  request.description = "Updated description";
  request.priority = "high";
  request.updated_at = new Date().toISOString();
  await requestRepository.save(request);

  const found = await requestRepository.findById(request.id);
  assert.equal(found?.title, "Updated title");
  assert.equal(found?.description, "Updated description");
  assert.equal(found?.priority, "high");
});

test("RequestRepository: save() appends a new status_history entry without duplicating existing ones", async () => {
  const client = await createUser({ role: "client" });
  const request = testRequest(client.id);
  await requestRepository.insert(request);

  request.status = "in_progress";
  request.status_history.push({ status: "in_progress", at: new Date().toISOString() });
  await requestRepository.save(request);

  // Saving again with the same (unchanged) history shouldn't add a third row.
  await requestRepository.save(request);

  const found = await requestRepository.findById(request.id);
  assert.equal(found?.status, "in_progress");
  assert.equal(found?.status_history.length, 2);
  assert.equal(found?.status_history[0].status, "open");
  assert.equal(found?.status_history[1].status, "in_progress");
});

test("RequestRepository: save() upserts the assignment when assigned_engineer_id is set", async () => {
  const client = await createUser({ role: "client" });
  const engineerA = await createUser({ role: "engineer" });
  const engineerB = await createUser({ role: "engineer" });
  const request = testRequest(client.id);
  await requestRepository.insert(request);

  request.assigned_engineer_id = engineerA.id;
  await requestRepository.save(request);
  let found = await requestRepository.findById(request.id);
  assert.equal(found?.assigned_engineer_id, engineerA.id);

  // Re-assigning should upsert (UNIQUE(request_id)), not fail or duplicate.
  request.assigned_engineer_id = engineerB.id;
  await requestRepository.save(request);
  found = await requestRepository.findById(request.id);
  assert.equal(found?.assigned_engineer_id, engineerB.id);
});

test("RequestRepository: findAll() includes an inserted request", async () => {
  const client = await createUser({ role: "client" });
  const request = testRequest(client.id);
  await requestRepository.insert(request);

  const all = await requestRepository.findAll();

  assert.ok(all.some((r) => r.id === request.id));
});

test("RequestRepository: deleteById() removes the request and reports success", async () => {
  const client = await createUser({ role: "client" });
  const request = testRequest(client.id);
  await requestRepository.insert(request);

  const deleted = await requestRepository.deleteById(request.id);
  assert.equal(deleted, true);

  const found = await requestRepository.findById(request.id);
  assert.equal(found, undefined);
});

test("RequestRepository: deleteById() returns false for a missing id", async () => {
  const deleted = await requestRepository.deleteById(generateId());
  assert.equal(deleted, false);
});

test("RequestRepository: deleting a request cascades to its comments", async () => {
  const client = await createUser({ role: "client" });
  const request = testRequest(client.id);
  await requestRepository.insert(request);
  await commentRepository.insert(testComment(request.id, client.id));

  await requestRepository.deleteById(request.id);

  const comments = await commentRepository.findAllForRequest(request.id);
  assert.equal(comments.length, 0);
});

// --- PostgresCommentRepository ---

test("CommentRepository: insert() + findAllForRequest() round-trips a comment", async () => {
  const client = await createUser({ role: "client" });
  const request = testRequest(client.id);
  await requestRepository.insert(request);
  const comment = testComment(request.id, client.id, { body: "Investigating now." });

  await commentRepository.insert(comment);
  const found = await commentRepository.findAllForRequest(request.id);

  assert.equal(found.length, 1);
  assert.equal(found[0].body, "Investigating now.");
  assert.equal(found[0].visibility, "public");
});

test("CommentRepository: maps visibility to/from is_internal correctly", async () => {
  const client = await createUser({ role: "client" });
  const request = testRequest(client.id);
  await requestRepository.insert(request);
  await commentRepository.insert(testComment(request.id, client.id, { visibility: "public" }));
  await commentRepository.insert(testComment(request.id, client.id, { visibility: "internal" }));

  const found = await commentRepository.findAllForRequest(request.id);

  assert.equal(found.length, 2);
  assert.ok(found.some((c) => c.visibility === "public"));
  assert.ok(found.some((c) => c.visibility === "internal"));
});

test("CommentRepository: findAllForRequest() returns comments oldest first", async () => {
  const client = await createUser({ role: "client" });
  const request = testRequest(client.id);
  await requestRepository.insert(request);
  const first = testComment(request.id, client.id, {
    body: "First",
    created_at: "2023-01-01T00:00:00.000Z",
  });
  const second = testComment(request.id, client.id, {
    body: "Second",
    created_at: "2023-01-02T00:00:00.000Z",
  });
  await commentRepository.insert(second);
  await commentRepository.insert(first);

  const found = await commentRepository.findAllForRequest(request.id);

  assert.deepEqual(found.map((c) => c.body), ["First", "Second"]);
});

test("CommentRepository: findAllForRequest() returns nothing for a request with no comments", async () => {
  const client = await createUser({ role: "client" });
  const request = testRequest(client.id);
  await requestRepository.insert(request);

  const found = await commentRepository.findAllForRequest(request.id);

  assert.deepEqual(found, []);
});
