import { randomUUID } from "node:crypto";

// Native UUID v4 (crypto.randomUUID): same ID format PostgreSQL will
// generate (`gen_random_uuid()`, see src/db/schema.sql), so moving off
// in-memory storage won't require changing identifier types anywhere else.
export function generateId(): string {
  return randomUUID();
}
