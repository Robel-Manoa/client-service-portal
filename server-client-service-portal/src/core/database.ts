// Fixed UUIDs so tests can reference seed records by name instead of
// hardcoding strings everywhere. The prefix per entity type is just to make
// them easier to eyeball — they're still valid UUIDs, same shape Postgres
// generates with gen_random_uuid(). The matching rows live in Postgres,
// seeded by src/db/seed.ts (run as part of `npm run db:init`).
export const SEED_IDS = {
  admin: "00000000-0000-4000-8000-000000000000",
  client1: "00000000-0000-4000-8000-000000000001",
  engineer: "00000000-0000-4000-8000-000000000002",
  client2: "00000000-0000-4000-8000-000000000003",
  request1: "10000000-0000-4000-8000-000000000001",
  comment1: "20000000-0000-4000-8000-000000000001",
  comment2: "20000000-0000-4000-8000-000000000002",
} as const;
