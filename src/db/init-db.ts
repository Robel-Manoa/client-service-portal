// Initialisation de la base de donnée PostgreSQL
// Lit et applique src/db/schema.sql — une seule source de vérité pour le
// schéma, pas de copie à maintenir en double ici.
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { dbPool } from "./postgres";
import { env } from "../config/env.config";

const schemaSQL = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");

// PostgreSQL exige de se connecter à une base existante — impossible de se
// connecter directement à `service_portal` tant qu'elle n'a pas été créée.
// On se connecte donc d'abord à la base de maintenance "postgres" (toujours
// présente par défaut) pour la créer si besoin, avant de lancer le schéma.
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
      // CREATE DATABASE n'accepte pas de paramètre lié ($1) pour le nom de
      // la base : on valide son format avant de l'interpoler, pour ne
      // jamais injecter une valeur non maîtrisée dans le SQL.
      if (!/^[a-zA-Z_]\w*$/.test(env.DB_NAME)) {
        throw new Error(`Nom de base invalide : "${env.DB_NAME}"`);
      }
      console.log(`Base "${env.DB_NAME}" absente, création en cours...`);
      await maintenanceClient.query(`CREATE DATABASE "${env.DB_NAME}"`);
      console.log(`Base "${env.DB_NAME}" créée avec succès`);
    }
  } finally {
    await maintenanceClient.end();
  }
}

async function initDatabase() {
  console.log("Initilisation du schéma PostgreSQL");
  try {
    await ensureDatabaseExists();
    await dbPool.query(schemaSQL);
    console.log(`Schéma SQL appliqué avec succès dans la base [${env.DB_NAME}]`);
  } catch (error) {
    console.error("Erreur lors de l'initialisation du Schema SQL : ", error);
    process.exitCode = 1;
  } finally {
    // Fermeture de la connexion
    await dbPool.end();
  }
}

initDatabase();
