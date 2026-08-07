// RequestService tests against a real Postgres instance. Same BEGIN/ROLLBACK
// pattern as user-service.test.ts — see the comment there for why `client`
// gets passed around explicitly. Passed to UserService too, since creating
// a request needs a real client_id (NOT NULL FK to users).

import { test, beforeEach, afterEach, after } from "node:test";
import assert from "node:assert/strict";
import type { PoolClient } from "pg";
import { RequestService } from "../src/services/request.service";
import { UserService } from "../src/services/user.service";
import { generateId } from "../src/core/id.util";
import { dbPool } from "../src/db/postgres";

let client: PoolClient;

beforeEach(async () => {
  client = await dbPool.connect();
  await client.query("BEGIN");
});

afterEach(async () => {
  await client.query("ROLLBACK");
  client.release();
});

after(async () => {
  await dbPool.end();
});

// Creates a user (client or engineer) as a prerequisite for requests, via
// UserService rather than raw SQL — same transactional connection.
async function createTestUser(role: "client" | "engineer" = "client") {
  return UserService.create(
    {
      id: generateId(),
      name: role === "client" ? "Client Test" : "Engineer Test",
      email: `${role}-${generateId()}@example.com`,
      passwordHash: "$2b$10$abcdef1234567890",
      role,
    },
    client,
  );
}

test("create() creates a request and returns client info via the join", async () => {
  const testClient = await createTestUser("client");

  const request = await RequestService.create(
    {
      id: generateId(),
      title: "Login form bug",
      description: "The button stops responding after a click",
      priority: "high",
      client_id: testClient.id,
    },
    client,
  );

  assert.equal(request.title, "Login form bug");
  assert.equal(request.status, "open");
  assert.equal(request.client_id, testClient.id);
  assert.equal(request.client_name, testClient.name);
  assert.equal(request.client_email, testClient.email);
  assert.equal(request.engineer_name, null);
});

test("findAll() returns every request", async () => {
  const testClient = await createTestUser("client");

  await RequestService.create(
    {
      id: generateId(),
      title: "Request 1",
      description: "Description 1",
      priority: "low",
      client_id: testClient.id,
    },
    client,
  );
  await RequestService.create(
    {
      id: generateId(),
      title: "Request 2",
      description: "Description 2",
      priority: "medium",
      client_id: testClient.id,
    },
    client,
  );

  const results = await RequestService.findAll(undefined, client);

  assert.equal(results.length, 2);
});

test("findAll() filters by client_id", async () => {
  const clientA = await createTestUser("client");
  const clientB = await createTestUser("client");

  await RequestService.create(
    {
      id: generateId(),
      title: "Request from A",
      description: "Description A",
      priority: "low",
      client_id: clientA.id,
    },
    client,
  );
  await RequestService.create(
    {
      id: generateId(),
      title: "Request from B",
      description: "Description B",
      priority: "low",
      client_id: clientB.id,
    },
    client,
  );

  const results = await RequestService.findAll(
    { client_id: clientA.id },
    client,
  );

  assert.equal(results.length, 1);
  assert.equal(results[0].client_id, clientA.id);
});

test("findAll() filters by assigned engineer", async () => {
  const testClient = await createTestUser("client");
  const engineer = await createTestUser("engineer");

  const assigned = await RequestService.create(
    {
      id: generateId(),
      title: "Assigned request",
      description: "Description",
      priority: "low",
      client_id: testClient.id,
    },
    client,
  );
  await RequestService.update(
    assigned.id,
    { assigned_engineer_id: engineer.id },
    client,
  );

  await RequestService.create(
    {
      id: generateId(),
      title: "Unassigned request",
      description: "Description",
      priority: "low",
      client_id: testClient.id,
    },
    client,
  );

  const results = await RequestService.findAll(
    { assigned_engineer_id: engineer.id },
    client,
  );

  assert.equal(results.length, 1);
  assert.equal(results[0].id, assigned.id);
  assert.equal(results[0].engineer_name, engineer.name);
});

test("findById() returns an existing request", async () => {
  const testClient = await createTestUser("client");
  const created = await RequestService.create(
    {
      id: generateId(),
      title: "Request to find",
      description: "Description",
      priority: "low",
      client_id: testClient.id,
    },
    client,
  );

  const found = await RequestService.findById(created.id, client);

  assert.ok(found);
  assert.equal(found?.id, created.id);
  assert.equal(found?.title, "Request to find");
});

test("findById() returns null for a request that doesn't exist", async () => {
  const found = await RequestService.findById(generateId(), client);
  assert.equal(found, null);
});

test("update() changes a request's status", async () => {
  const testClient = await createTestUser("client");
  const created = await RequestService.create(
    {
      id: generateId(),
      title: "Request to resolve",
      description: "Description",
      priority: "low",
      client_id: testClient.id,
    },
    client,
  );

  const updated = await RequestService.update(
    created.id,
    { status: "resolved" },
    client,
  );

  assert.equal(updated?.status, "resolved");
});

test("update() with no changes returns the request as-is (findById path)", async () => {
  const testClient = await createTestUser("client");
  const created = await RequestService.create(
    {
      id: generateId(),
      title: "Unchanged request",
      description: "Description",
      priority: "low",
      client_id: testClient.id,
    },
    client,
  );

  const result = await RequestService.update(created.id, {}, client);

  assert.equal(result?.id, created.id);
  assert.equal(result?.title, created.title);
  assert.equal(result?.status, created.status);
});

test("ROLLBACK leaves no trace between tests", async () => {
  // If any earlier ROLLBACK had failed, this list wouldn't be empty.
  const results = await RequestService.findAll(undefined, client);
  assert.equal(
    results.length,
    0,
    "no request should survive from one test to the next",
  );
});
