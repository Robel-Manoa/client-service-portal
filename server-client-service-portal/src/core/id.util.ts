import { randomUUID } from "node:crypto";

// Matches the format gen_random_uuid() produces in Postgres (schema.sql).
export function generateId(): string {
  return randomUUID();
}
