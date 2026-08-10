// Not wired into the running app yet — app.ts/server.ts still run on the
// in-memory store in core/database.ts. So far only the Postgres-backed
// service layer under src/services (and its tests) uses this pool.
import pg from "pg";
import { env } from "../config/env.config";

const { Pool } = pg;

export const dbPool = new Pool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Without this, a dropped connection on an idle pool client takes down the
// whole process with an uncaught exception. pg's docs call this out
// explicitly — easy to miss.
dbPool.on("error", (err) => {
  console.error("[DB] Unexpected error on an idle pool connection:", err);
});

dbPool.on("connect", () => {
  console.log("[DB] New connection established with PostgreSQL");
});
