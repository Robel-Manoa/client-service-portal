// Tests for the business logic in user.service (UserService, backed by Postgres)
//
// Each test runs inside its own SQL transaction: BEGIN before, ROLLBACK
// after (always, even on failure) — nothing is ever persisted to disk. The
// ROLLBACK undoes everything done on ONE specific connection: that's why
// `client` (from dbPool.connect(), a single dedicated connection) is passed
// explicitly to UserService on every call, instead of letting UserService
// use dbPool directly (which grabs a different connection per query, which
// would break the isolation).

import { test, beforeEach, afterEach, after } from "node:test";
import assert from "node:assert/strict";
import type { PoolClient } from "pg";
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

test("creates a user", async () => {
  const newUser = await UserService.create(
    {
      id: generateId(),
      name: "Robel manoa",
      email: "robelmanoa@gmail.com",
      passwordHash: "$2b$10$abcdef1234567890",
      role: "client",
    },
    client,
  );

  assert.equal(newUser.name, "Robel manoa");
  assert.equal(newUser.email, "robelmanoa@gmail.com");
  assert.equal(newUser.role, "client");
});

test("finds a user by email", async () => {
  await UserService.create(
    {
      id: generateId(),
      name: "Robel manoa",
      email: "robelmanoa@gmail.com",
      passwordHash: "$2b$10$abcdef1234567890",
    },
    client,
  );

  const foundUser = await UserService.findByEmail("robelmanoa@gmail.com", client);

  assert.ok(foundUser, "the user created above should be found");
  assert.equal(foundUser?.name, "Robel manoa");
});

test("a duplicate email is rejected with statusCode 409", async () => {
  await UserService.create(
    {
      id: generateId(),
      name: "Robel manoa",
      email: "robelmanoa@gmail.com",
      passwordHash: "$2b$10$abcdef1234567890",
    },
    client,
  );

  await assert.rejects(
    () =>
      UserService.create(
        {
          id: generateId(),
          name: "Clone",
          email: "robelmanoa@gmail.com",
          passwordHash: "$2$5$ziounopinpiueze",
        },
        client,
      ),
    (error: any) => {
      assert.equal(error.statusCode, 409);
      return true;
    },
  );
});

test("ROLLBACK leaves no trace: the previous test's email can be reused", async () => {
  // If the ROLLBACK from a previous test hadn't worked, this creation would
  // fail with a UNIQUE constraint violation (409).
  const user = await UserService.create(
    {
      id: generateId(),
      name: "Isolation check",
      email: "robelmanoa@gmail.com",
      passwordHash: "$2b$10$abcdef1234567890",
    },
    client,
  );

  assert.equal(user.email, "robelmanoa@gmail.com");
});
