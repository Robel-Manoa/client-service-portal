import { randomUUID } from "node:crypto";

// Matches the format gen_random_uuid() produces in Postgres (schema.sql),
// so swapping the in-memory store for the real DB won't touch ID types.
export function generateId(): string {
  return randomUUID();
}
