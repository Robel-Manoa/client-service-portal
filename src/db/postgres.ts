// Configuration du pool de connexion PostgreSQL.
// Ce module n'est pas encore branché à l'application (voir server.ts / core/database.ts,
// toujours en mémoire) — il est prêt à être importé une fois la migration commencée.
import pg from "pg";
import { env } from "../config/env.config";

const { Pool } = pg;

export const dbPool = new Pool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  max: 10, // nombre max de connexions simultanées dans le pool
  idleTimeoutMillis: 30000, // ferme les connexions inactives après 30s
  connectionTimeoutMillis: 5000, // abandonne si aucune connexion dispo après 5s
});

// Un client inactif du pool peut émettre une erreur réseau en arrière-plan
// (connexion coupée côté serveur, etc.). Sans ce listener, `pg` fait planter
// tout le processus avec une exception non interceptée — la doc officielle
// de `pg` recommande explicitement de toujours l'ajouter.
dbPool.on("error", (err) => {
  console.error("[DB] Erreur inattendue sur une connexion inactive du pool:", err);
});

// "connect" (pas "Connecter") : seul nom d'évènement reconnu par pg.Pool pour
// signaler l'ouverture d'une nouvelle connexion physique vers PostgreSQL.
dbPool.on("connect", () => {
  console.log("[DB] Nouvelle connexion établie avec PostgreSQL");
});
