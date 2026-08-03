import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import app from "../src/app";
import { SEED_IDS } from "../src/core/database";

// Ces tests couvrent le flux d'authentification/autorisation qui a été cassé
// silencieusement une première fois (ordre authentificate/requireRole inversé) :
// login -> token -> route protégée, plus les cas 401/403/ownership.

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

test("GET /health répond 200 sans authentification", async () => {
  const res = await fetch(`${baseUrl}/health`);
  assert.equal(res.status, 200);
});

test("GET /api/users sans token est rejeté (401)", async () => {
  const res = await fetch(`${baseUrl}/api/users`);
  assert.equal(res.status, 401);
});

test("login admin puis GET /api/users réussit — vérifie que authentificate s'exécute bien avant requireRole", async () => {
  const { status, body: loginBody } = await login(
    "admin@portal.local",
    "password123",
  );
  assert.equal(status, 200);
  assert.ok(loginBody.token, "un token JWT doit être renvoyé");

  const res = await fetch(`${baseUrl}/api/users`, {
    headers: { Authorization: `Bearer ${loginBody.token}` },
  });
  assert.equal(res.status, 200);
});

test("login client puis GET /api/users est refusé (403 : rôle insuffisant)", async () => {
  const { body: loginBody } = await login("manoa@gmail.com", "password123");

  const res = await fetch(`${baseUrl}/api/users`, {
    headers: { Authorization: `Bearer ${loginBody.token}` },
  });
  assert.equal(res.status, 403);
});

test("login engineer puis GET /api/users est refusé (403 : GET /users est admin-only)", async () => {
  const { body: loginBody } = await login("robel@gmail.com", "password123");

  const res = await fetch(`${baseUrl}/api/users`, {
    headers: { Authorization: `Bearer ${loginBody.token}` },
  });
  assert.equal(res.status, 403);
});

test("PATCH /api/users/:id est admin-only : un client ne peut pas modifier son propre profil (403)", async () => {
  const { body: loginBody } = await login("manoa@gmail.com", "password123");

  const res = await fetch(`${baseUrl}/api/users/${SEED_IDS.client1}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${loginBody.token}`,
    },
    body: JSON.stringify({ role: "admin" }),
  });
  assert.equal(res.status, 403);
});

test("un admin peut modifier n'importe quel utilisateur via PATCH /api/users/:id", async () => {
  const { body: loginBody } = await login("admin@portal.local", "password123");

  const res = await fetch(`${baseUrl}/api/users/${SEED_IDS.client2}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${loginBody.token}`,
    },
    body: JSON.stringify({ name: "Fy (modifié)" }),
  });
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.name, "Fy (modifié)");
});

test("un admin ne peut pas créer un utilisateur avec un email déjà utilisé (409)", async () => {
  const { body: loginBody } = await login("admin@portal.local", "password123");

  const res = await fetch(`${baseUrl}/api/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${loginBody.token}`,
    },
    body: JSON.stringify({
      name: "Doublon",
      email: "manoa@gmail.com", // déjà pris par SEED_IDS.client1
      password: "azertyui",
    }),
  });
  assert.equal(res.status, 409);
});

test("un admin ne peut pas changer l'email d'un utilisateur vers un email déjà pris par un autre (409)", async () => {
  const { body: loginBody } = await login("admin@portal.local", "password123");

  const res = await fetch(`${baseUrl}/api/users/${SEED_IDS.client2}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${loginBody.token}`,
    },
    body: JSON.stringify({ email: "manoa@gmail.com" }), // déjà pris par SEED_IDS.client1
  });
  assert.equal(res.status, 409);
});

test("les dates sont renvoyées au format DD-MM-YYYY HH:mm, aussi bien pour les données de seed que fraîchement créées", async () => {
  const DATE_FORMAT = /^\d{2}-\d{2}-\d{4} \d{2}:\d{2}$/;
  const { body: loginBody } = await login("admin@portal.local", "password123");

  // Donnée de seed (stockée en interne comme simple "2023-04-25", sans heure)
  const seedUser = await fetch(`${baseUrl}/api/users/${SEED_IDS.client1}`, {
    headers: { Authorization: `Bearer ${loginBody.token}` },
  }).then((r) => r.json());
  assert.match(seedUser.created_at, DATE_FORMAT);

  // Donnée fraîchement créée (stockée en interne en ISO avec heure)
  const created = await fetch(`${baseUrl}/api/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${loginBody.token}`,
    },
    body: JSON.stringify({
      name: "Test Format Date",
      email: "test-format-date@example.com",
      password: "azertyui",
    }),
  }).then((r) => r.json());
  assert.match(created.created_at, DATE_FORMAT);
});

test("un client ne voit que ses propres demandes sur GET /api/requests", async () => {
  const { body: loginBody } = await login("manoa@gmail.com", "password123");

  const res = await fetch(`${baseUrl}/api/requests`, {
    headers: { Authorization: `Bearer ${loginBody.token}` },
  });
  const requests = await res.json();

  assert.equal(res.status, 200);
  assert.ok(
    requests.every((r: { client_id: string }) => r.client_id === SEED_IDS.client1),
    "un client ne doit voir que les demandes dont il est le propriétaire",
  );
});
