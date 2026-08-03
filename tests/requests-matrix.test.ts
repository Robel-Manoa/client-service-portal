import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import app from "../src/app";
import { SEED_IDS } from "../src/core/database";

// Couvre la matrice d'accès Client/Engineer/Admin sur les demandes :
// création, transitions de statut, assignation d'engineer, commentaires.
// Seed : SEED_IDS.request1 appartient à SEED_IDS.client1, assigné à
// SEED_IDS.engineer, avec un commentaire public et un interne.

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

// --- POST /api/requests : réservé aux clients ---

test("POST /api/requests : un engineer ne peut pas créer de demande (403)", async () => {
  const token = await tokenFor("robel@gmail.com"); // SEED_IDS.engineer
  const res = await fetch(
    `${baseUrl}/api/requests`,
    authed(token, {
      method: "POST",
      body: JSON.stringify({
        title: "Demande engineer",
        description: "Ne devrait pas passer",
        priority: "low",
      }),
    }),
  );
  assert.equal(res.status, 403);
});

test("POST /api/requests : un admin ne peut pas créer de demande (403)", async () => {
  const token = await tokenFor("admin@portal.local");
  const res = await fetch(
    `${baseUrl}/api/requests`,
    authed(token, {
      method: "POST",
      body: JSON.stringify({
        title: "Demande admin",
        description: "Ne devrait pas passer",
        priority: "low",
      }),
    }),
  );
  assert.equal(res.status, 403);
});

test("POST /api/requests : un client peut créer une demande (201)", async () => {
  const token = await tokenFor("manoa@gmail.com");
  const res = await fetch(
    `${baseUrl}/api/requests`,
    authed(token, {
      method: "POST",
      body: JSON.stringify({
        title: "Nouvelle demande de test",
        description: "Description suffisamment longue pour passer Zod",
        priority: "medium",
      }),
    }),
  );
  const body = await res.json();
  assert.equal(res.status, 201);
  assert.equal(body.client_id, SEED_IDS.client1);
  assert.equal(body.status, "open");
});

// --- GET /api/requests : filtrage par rôle ---

test("GET /api/requests : un engineer ne voit que les demandes qui lui sont assignées", async () => {
  const token = await tokenFor("robel@gmail.com"); // assigné à SEED_IDS.request1 dans le seed
  const res = await fetch(`${baseUrl}/api/requests`, authed(token));
  const requests: Array<{ id: string; assigned_engineer_id?: string }> =
    await res.json();

  assert.equal(res.status, 200);
  assert.ok(requests.some((r) => r.id === SEED_IDS.request1));
  assert.ok(
    requests.every((r) => r.assigned_engineer_id === SEED_IDS.engineer),
    "un engineer ne doit voir que les demandes qui lui sont assignées",
  );
});

// --- PATCH /api/requests/:id : transitions de statut ---

test("transitions de statut : un client ne peut jamais changer le statut (403)", async () => {
  const clientToken = await tokenFor("manoa@gmail.com");
  const created = await fetch(
    `${baseUrl}/api/requests`,
    authed(clientToken, {
      method: "POST",
      body: JSON.stringify({
        title: "Demande pour test de statut",
        description: "Description suffisamment longue pour Zod",
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

test("transitions de statut : un engineer ne peut PAS faire open -> in_progress (403)", async () => {
  const clientToken = await tokenFor("manoa@gmail.com");
  const created = await fetch(
    `${baseUrl}/api/requests`,
    authed(clientToken, {
      method: "POST",
      body: JSON.stringify({
        title: "Demande pour test in_progress",
        description: "Description suffisamment longue pour Zod",
        priority: "low",
      }),
    }),
  ).then((r) => r.json());

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

test("transitions de statut : un engineer PEUT faire open -> resolved (200)", async () => {
  const clientToken = await tokenFor("manoa@gmail.com");
  const created = await fetch(
    `${baseUrl}/api/requests`,
    authed(clientToken, {
      method: "POST",
      body: JSON.stringify({
        title: "Demande pour test resolved",
        description: "Description suffisamment longue pour Zod",
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
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.status, "resolved");

  // Un admin peut ensuite fermer la demande, transition que l'engineer n'a pas.
  const adminToken = await tokenFor("admin@portal.local");
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

// --- POST /api/requests/:id/assignments : admin only ---

test("assignation : un client ne peut pas assigner un engineer (403)", async () => {
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

test("assignation : un admin ne peut pas assigner un utilisateur qui n'est pas engineer (400)", async () => {
  const token = await tokenFor("admin@portal.local");
  const res = await fetch(
    `${baseUrl}/api/requests/${SEED_IDS.request1}/assignments`,
    authed(token, {
      method: "POST",
      // SEED_IDS.client1 est un client, pas un engineer
      body: JSON.stringify({ engineer_id: SEED_IDS.client1 }),
    }),
  );
  assert.equal(res.status, 400);
});

test("assignation : un admin peut assigner un engineer valide (201)", async () => {
  const clientToken = await tokenFor("manoa@gmail.com");
  const created = await fetch(
    `${baseUrl}/api/requests`,
    authed(clientToken, {
      method: "POST",
      body: JSON.stringify({
        title: "Demande pour test assignation",
        description: "Description suffisamment longue pour Zod",
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

// --- Commentaires : visibilité par rôle ---

test("commentaires : le client propriétaire ne voit que les commentaires publics", async () => {
  const token = await tokenFor("manoa@gmail.com"); // propriétaire de SEED_IDS.request1
  const res = await fetch(`${baseUrl}/api/requests/${SEED_IDS.request1}/comments`, authed(token));
  const comments: Array<{ visibility: string }> = await res.json();

  assert.equal(res.status, 200);
  assert.ok(comments.length > 0);
  assert.ok(comments.every((c) => c.visibility === "public"));
});

test("commentaires : un client qui n'est pas propriétaire n'a pas accès (403)", async () => {
  const token = await tokenFor("Fy@gmail.com"); // SEED_IDS.client2, ne possède pas SEED_IDS.request1
  const res = await fetch(`${baseUrl}/api/requests/${SEED_IDS.request1}/comments`, authed(token));
  assert.equal(res.status, 403);
});

test("commentaires : le staff voit aussi les commentaires internes", async () => {
  const token = await tokenFor("admin@portal.local");
  const res = await fetch(`${baseUrl}/api/requests/${SEED_IDS.request1}/comments`, authed(token));
  const comments: Array<{ visibility: string }> = await res.json();

  assert.equal(res.status, 200);
  assert.ok(comments.some((c) => c.visibility === "internal"));
});

test("commentaires : un client qui poste en 'internal' est forcé en 'public'", async () => {
  const token = await tokenFor("manoa@gmail.com");
  const res = await fetch(
    `${baseUrl}/api/requests/${SEED_IDS.request1}/comments`,
    authed(token, {
      method: "POST",
      body: JSON.stringify({ body: "Commentaire client", visibility: "internal" }),
    }),
  );
  const body = await res.json();

  assert.equal(res.status, 201);
  assert.equal(body.visibility, "public", "un client ne peut jamais poster en interne");
});

test("commentaires : un engineer peut poster un commentaire interne", async () => {
  const token = await tokenFor("robel@gmail.com");
  const res = await fetch(
    `${baseUrl}/api/requests/${SEED_IDS.request1}/comments`,
    authed(token, {
      method: "POST",
      body: JSON.stringify({ body: "Note interne engineer", visibility: "internal" }),
    }),
  );
  const body = await res.json();

  assert.equal(res.status, 201);
  assert.equal(body.visibility, "internal");
});
