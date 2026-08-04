import { RequestComment, ServiceRequest, User } from "./types";
import { env } from "../config/env.config";

// In-memory data store

// bcrypt hash of 'password123' (bcrypt.hash('password123', 10)) — verified
// with bcrypt.compare before commit.
// Sourced from env.config.ts (validated Zod schema) rather than process.env
// directly, so the app refuses to start with a clear message if the
// variable is missing, instead of failing later on a bcrypt.compare(undefined).
const DEMO_PASSWORD_HASH = env.PASSWORD_HASH; // plaintext password: 'password123'

// Fixed (valid) UUIDs for seed data, exported so tests can reference them by
// name instead of duplicating raw strings. The recognizable format (prefixed
// by entity type) is purely for dev readability — these are real UUIDs,
// same shape as what PostgreSQL will later generate with gen_random_uuid().
export const SEED_IDS = {
  admin: "00000000-0000-4000-8000-000000000000",
  client1: "00000000-0000-4000-8000-000000000001",
  engineer: "00000000-0000-4000-8000-000000000002",
  client2: "00000000-0000-4000-8000-000000000003",
  request1: "10000000-0000-4000-8000-000000000001",
  comment1: "20000000-0000-4000-8000-000000000001",
  comment2: "20000000-0000-4000-8000-000000000002",
} as const;

// Exported as const for immutability
export const serviceRequestDb: ServiceRequest[] = [
  {
    id: SEED_IDS.request1,
    client_id: SEED_IDS.client1,
    title: "My Request test",
    description: "This is a request at a memory storage",
    priority: "high",
    status: "open",
    created_at: "2023-01-01",
    updated_at: "2023-01-01",
    status_history: [
      { status: "open", at: "2023-01-01" },
      { status: "in_progress", at: "2023-01-02" },
    ],
    assigned_engineer_id: SEED_IDS.engineer,
  },
];

export const requestCommentDb: RequestComment[] = [
  {
    id: SEED_IDS.comment1,
    request_id: SEED_IDS.request1,
    author_id: SEED_IDS.engineer,
    body: "Picked up this request, investigating now.",
    visibility: "public",
    created_at: "2023-01-02",
  },
  {
    id: SEED_IDS.comment2,
    request_id: SEED_IDS.request1,
    author_id: SEED_IDS.engineer,
    body: "Internal note: this client is on a premium contract, prioritize.",
    visibility: "internal",
    created_at: "2023-01-02",
  },
];

export const userAccountDb: User[] = [
  {
    id: SEED_IDS.admin,
    name: "Admin Portal",
    email: "admin@portal.local",
    password: DEMO_PASSWORD_HASH,
    role: "admin",
    is_active: true,
    created_at: "2023-04-25",
    updated_at: "2023-04-25",
  },
  {
    id: SEED_IDS.client1,
    name: "Robel",
    email: "manoa@gmail.com",
    password: DEMO_PASSWORD_HASH,
    role: "client",
    is_active: true,
    created_at: "2023-04-25",
    updated_at: "2023-04-25",
  },
  {
    id: SEED_IDS.engineer,
    name: "manoa",
    email: "robel@gmail.com",
    password: DEMO_PASSWORD_HASH,
    role: "engineer",
    is_active: true,
    created_at: "2023-04-25",
    updated_at: "2023-04-25",
  },
  {
    id: SEED_IDS.client2,
    name: "Fy",
    email: "Fy@gmail.com",
    password: DEMO_PASSWORD_HASH,
    role: "client",
    is_active: true,
    created_at: "2023-04-25",
    updated_at: "2023-04-25",
  },
];
