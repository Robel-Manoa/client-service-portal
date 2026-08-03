// Test de la logique métier dans user service (UserService, backé par Postgres)
//
// Chaque test tourne dans sa propre transaction SQL : BEGIN avant, ROLLBACK
// après (systématique, même en cas d'échec) — rien n'est jamais persisté sur
// le disque. Le ROLLBACK annule tout ce qui a été fait sur UNE connexion
// précise : c'est pour ça que `client` (issu de dbPool.connect(), une seule
// connexion dédiée) est passé explicitement à UserService à chaque appel,
// plutôt que de laisser UserService utiliser dbPool directement (qui pioche
// une connexion différente à chaque requête, ce qui casserait l'isolation).

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

test("création d'un utilisateur", async () => {
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

test("recherche d'un utilisateur par email", async () => {
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

  assert.ok(foundUser, "l'utilisateur créé juste avant doit être retrouvé");
  assert.equal(foundUser?.name, "Robel manoa");
});

test("un email en double est rejeté avec un statusCode 409", async () => {
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

test("le ROLLBACK ne laisse aucune trace : l'email du test précédent est réutilisable", async () => {
  // Si le ROLLBACK d'un des tests précédents n'avait pas fonctionné,
  // cette création échouerait avec une violation de contrainte UNIQUE (409).
  const user = await UserService.create(
    {
      id: generateId(),
      name: "Vérification isolation",
      email: "robelmanoa@gmail.com",
      passwordHash: "$2b$10$abcdef1234567890",
    },
    client,
  );

  assert.equal(user.email, "robelmanoa@gmail.com");
});
