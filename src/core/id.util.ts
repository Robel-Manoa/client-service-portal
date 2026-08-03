import { randomUUID } from "node:crypto";

// UUID v4 natif (crypto.randomUUID) : même format d'ID que ce que PostgreSQL
// génèrera plus tard (`gen_random_uuid()`, voir src/db/schema.sql), pour que
// la migration depuis le stockage en mémoire n'implique pas de changer le
// type des identifiants dans le reste de l'app.
export function generateId(): string {
  return randomUUID();
}
