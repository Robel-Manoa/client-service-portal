// Test de la logique métier dans request.service (RequestService, backé par Postgres)
//
// Chaque test tourne dans sa propre transaction SQL (BEGIN avant, ROLLBACK après, systématique)
// sur une seule connexion dédiée (`client`), passée explicitement à RequestService ET à
// UserService (pour créer les utilisateurs prérequis — client_id est une
// clé étrangère NOT NULL vers users). Rien n'est jamais persisté sur le disque.

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

// Crée un utilisateur (client ou engineer) prérequis pour les demandes,
// via UserService plutôt que du SQL brut — même connexion transactionnelle.
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

test("create() crée une demande et renvoie les infos du client via la jointure", async () => {
  const testClient = await createTestUser("client");

  const request = await RequestService.create(
    {
      id: generateId(),
      title: "Bug sur le formulaire de connexion",
      description: "Le bouton ne réagit plus après un clic",
      priority: "high",
      client_id: testClient.id,
    },
    client,
  );

  assert.equal(request.title, "Bug sur le formulaire de connexion");
  assert.equal(request.status, "open");
  assert.equal(request.client_id, testClient.id);
  assert.equal(request.client_name, testClient.name);
  assert.equal(request.client_email, testClient.email);
  assert.equal(request.engineer_name, null);
});

test("findAll() renvoie toutes les demandes", async () => {
  const testClient = await createTestUser("client");

  await RequestService.create(
    {
      id: generateId(),
      title: "Demande 1",
      description: "Description 1",
      priority: "low",
      client_id: testClient.id,
    },
    client,
  );
  await RequestService.create(
    {
      id: generateId(),
      title: "Demande 2",
      description: "Description 2",
      priority: "medium",
      client_id: testClient.id,
    },
    client,
  );

  const results = await RequestService.findAll(undefined, client);

  assert.equal(results.length, 2);
});

test("findAll() filtre par client_id", async () => {
  const clientA = await createTestUser("client");
  const clientB = await createTestUser("client");

  await RequestService.create(
    {
      id: generateId(),
      title: "Demande de A",
      description: "Description A",
      priority: "low",
      client_id: clientA.id,
    },
    client,
  );
  await RequestService.create(
    {
      id: generateId(),
      title: "Demande de B",
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

test("findAll() filtre par engineer assigné", async () => {
  const testClient = await createTestUser("client");
  const engineer = await createTestUser("engineer");

  const assigned = await RequestService.create(
    {
      id: generateId(),
      title: "Demande assignée",
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
      title: "Demande non assignée",
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

test("findById() renvoie une demande existante", async () => {
  const testClient = await createTestUser("client");
  const created = await RequestService.create(
    {
      id: generateId(),
      title: "Demande à retrouver",
      description: "Description",
      priority: "low",
      client_id: testClient.id,
    },
    client,
  );

  const found = await RequestService.findById(created.id, client);

  assert.ok(found);
  assert.equal(found?.id, created.id);
  assert.equal(found?.title, "Demande à retrouver");
});

test("findById() renvoie null pour une demande inexistante", async () => {
  const found = await RequestService.findById(generateId(), client);
  assert.equal(found, null);
});

test("update() modifie le statut d'une demande", async () => {
  const testClient = await createTestUser("client");
  const created = await RequestService.create(
    {
      id: generateId(),
      title: "Demande à résoudre",
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

test("update() sans changement renvoie la demande telle quelle (chemin findById)", async () => {
  const testClient = await createTestUser("client");
  const created = await RequestService.create(
    {
      id: generateId(),
      title: "Demande inchangée",
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

test("le ROLLBACK ne laisse aucune trace entre les tests", async () => {
  // Si l'un des ROLLBACK précédents avait échoué, cette liste ne serait pas vide.
  const results = await RequestService.findAll(undefined, client);
  assert.equal(
    results.length,
    0,
    "aucune demande ne doit survivre d'un test à l'autre",
  );
});
