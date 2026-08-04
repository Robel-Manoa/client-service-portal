// PostgreSQL schema initialization
// Reads and applies src/db/schema.sql — a single source of truth for the
// schema, no copy to keep in sync here.
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { dbPool } from "./postgres";
import { env } from "../config/env.config";

const schemaSQL = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");

// PostgreSQL requires connecting to an existing database — it's not possible
// to connect directly to `service_portal` until it has been created. We
// first connect to the "postgres" maintenance database (always present by
// default) to create it if needed, before applying the schema.
async function ensureDatabaseExists() {
  const { Client } = pg;
  const maintenanceClient = new Client({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: "postgres",
  });

  await maintenanceClient.connect();
  try {
    const { rowCount } = await maintenanceClient.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [env.DB_NAME],
    );

    if (rowCount === 0) {
      // CREATE DATABASE doesn't accept a bound parameter ($1) for the
      // database name: validate its format before interpolating it, so we
      // never inject an untrusted value into the SQL.
      if (!/^[a-zA-Z_]\w*$/.test(env.DB_NAME)) {
        throw new Error(`Invalid database name: "${env.DB_NAME}"`);
      }
      console.log(`Database "${env.DB_NAME}" doesn't exist, creating it...`);
      await maintenanceClient.query(`CREATE DATABASE "${env.DB_NAME}"`);
      console.log(`Database "${env.DB_NAME}" created successfully`);
    }
  } finally {
    await maintenanceClient.end();
  }
}

async function initDatabase() {
  console.log("Initializing the PostgreSQL schema");
  try {
    await ensureDatabaseExists();
    await dbPool.query(schemaSQL);
    console.log(`SQL schema applied successfully to database [${env.DB_NAME}]`);
  } catch (error) {
    console.error("Error while initializing the SQL schema: ", error);
    process.exitCode = 1;
  } finally {
    // Close the connection
    await dbPool.end();
  }
}

initDatabase();
