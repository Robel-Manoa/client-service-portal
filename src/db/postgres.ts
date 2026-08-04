// PostgreSQL connection pool configuration.
// Not wired into the running app yet (app.ts/server.ts still run on the
// in-memory store under core/database.ts) — used so far only by the
// Postgres-backed service layer under src/services and its tests.
import pg from "pg";
import { env } from "../config/env.config";

const { Pool } = pg;

export const dbPool = new Pool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  max: 10, // max number of simultaneous connections in the pool
  idleTimeoutMillis: 30000, // close idle connections after 30s
  connectionTimeoutMillis: 5000, // give up if no connection is available after 5s
});

// An idle client in the pool can emit a background network error (e.g. the
// connection was dropped server-side). Without this listener, `pg` crashes
// the whole process with an uncaught exception — the official `pg` docs
// explicitly recommend always adding it.
dbPool.on("error", (err) => {
  console.error("[DB] Unexpected error on an idle pool connection:", err);
});

// "connect" is the only event name pg.Pool recognizes for signaling a new
// physical connection to PostgreSQL.
dbPool.on("connect", () => {
  console.log("[DB] New connection established with PostgreSQL");
});
