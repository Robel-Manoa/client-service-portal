// No app.listen(), no Postgres — UserService talks to a throwaway fake
// repository built fresh per test instead.

import { test } from "node:test";
import assert from "node:assert/strict";
import { UserService, EMAIL_TAKEN_MESSAGE } from "../../src/core/user.service";
import type { UserRepository } from "../../src/core/ports";
import type { User } from "../../src/core/types";

function fakeUserRepository(seed: User[] = []): UserRepository {
  const rows = [...seed];
  return {
    async findAll() {
      return rows;
    },
    async findById(id) {
      return rows.find((u) => u.id === id);
    },
    async findByEmail(email) {
      return rows.find((u) => u.email === email);
    },
    async insert(user) {
      rows.push(user);
    },
    async save(user) {
      const i = rows.findIndex((u) => u.id === user.id);
      if (i !== -1) rows[i] = user;
    },
    async deleteById(id) {
      const i = rows.findIndex((u) => u.id === id);
      if (i === -1) return false;
      rows.splice(i, 1);
      return true;
    },
  };
}

test("create() hashes the password and never returns it", async () => {
  const users = fakeUserRepository();

  const created = await UserService.create(
    {
      name: "Ada Lovelace",
      email: "ada@example.com",
      password: "correct horse battery staple",
      role: "client",
      is_active: true,
    },
    users,
  );

  assert.equal(created.name, "Ada Lovelace");
  assert.equal((created as Partial<User>).password, undefined);

  const stored = await users.findByEmail("ada@example.com");
  assert.notEqual(stored?.password, "correct horse battery staple");
});

test("create() rejects a duplicate email", async () => {
  const users = fakeUserRepository([
    {
      id: "u1",
      name: "Existing User",
      email: "taken@example.com",
      password: "irrelevant-hash",
      role: "client",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ]);

  await assert.rejects(
    () =>
      UserService.create(
        {
          name: "Someone Else",
          email: "taken@example.com",
          password: "whatever123",
          role: "client",
          is_active: true,
        },
        users,
      ),
    (error: unknown) =>
      error instanceof Error && error.message === EMAIL_TAKEN_MESSAGE,
  );
});

test("login() succeeds with the right password and returns a token", async () => {
  const users = fakeUserRepository();
  await UserService.create(
    {
      name: "Grace Hopper",
      email: "grace@example.com",
      password: "compiler-1959",
      role: "engineer",
      is_active: true,
    },
    users,
  );

  const result = await UserService.login("grace@example.com", "compiler-1959", users);

  assert.ok(result, "login should succeed");
  assert.equal(result?.user.email, "grace@example.com");
  assert.ok(result?.token);
});

test("login() returns null for the wrong password", async () => {
  const users = fakeUserRepository();
  await UserService.create(
    {
      name: "Grace Hopper",
      email: "grace@example.com",
      password: "compiler-1959",
      role: "engineer",
      is_active: true,
    },
    users,
  );

  const result = await UserService.login("grace@example.com", "wrong-password", users);
  assert.equal(result, null);
});

test("login() returns null for an email that doesn't exist", async () => {
  const users = fakeUserRepository();
  const result = await UserService.login("nobody@example.com", "whatever", users);
  assert.equal(result, null);
});

test("login() throws for a disabled account, even with the right password", async () => {
  const users = fakeUserRepository();
  await UserService.create(
    {
      name: "Disabled User",
      email: "disabled@example.com",
      password: "still-correct",
      role: "client",
      is_active: false,
    },
    users,
  );

  await assert.rejects(
    () => UserService.login("disabled@example.com", "still-correct", users),
    /disabled/i,
  );
});
