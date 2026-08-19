// Demo/test fixture data — the Postgres equivalent of the old in-memory
// arrays in core/database.ts. Same fixed SEED_IDS, same content, so the
// HTTP-level tests (tests/auth.test.ts, tests/requests-*.test.ts, etc.)
// that log in as these demo accounts keep working unchanged.
import { dbPool } from "./postgres";
import { env } from "../config/env.config";
import { SEED_IDS } from "../core/database";

export async function seedDatabase() {
  await dbPool.query(
    `INSERT INTO users (id, full_name, email, password_hash, role, is_active, created_at, updated_at)
     VALUES
       ($1, 'Admin Portal', 'admin@portal.local', $5, 'admin', TRUE, '2023-04-25', '2023-04-25'),
       ($2, 'Robel', 'manoa@gmail.com', $5, 'client', TRUE, '2023-04-25', '2023-04-25'),
       ($3, 'manoa', 'robel@gmail.com', $5, 'engineer', TRUE, '2023-04-25', '2023-04-25'),
       ($4, 'Fy', 'Fy@gmail.com', $5, 'client', TRUE, '2023-04-25', '2023-04-25')
     ON CONFLICT (id) DO NOTHING`,
    [SEED_IDS.admin, SEED_IDS.client1, SEED_IDS.engineer, SEED_IDS.client2, env.PASSWORD_HASH],
  );

  await dbPool.query(
    `INSERT INTO requests (id, client_id, title, description, priority, status, created_at, updated_at)
     VALUES ($1, $2, 'My Request test', 'This is a request at a memory storage', 'high', 'open', '2023-01-01', '2023-01-01')
     ON CONFLICT (id) DO NOTHING`,
    [SEED_IDS.request1, SEED_IDS.client1],
  );

  await dbPool.query(
    `INSERT INTO assignments (request_id, engineer_id) VALUES ($1, $2) ON CONFLICT (request_id) DO NOTHING`,
    [SEED_IDS.request1, SEED_IDS.engineer],
  );

  await dbPool.query(
    `INSERT INTO request_status_history (request_id, status, changed_at)
     SELECT $1, 'open', '2023-01-01'
     WHERE NOT EXISTS (SELECT 1 FROM request_status_history WHERE request_id = $1)`,
    [SEED_IDS.request1],
  );
  await dbPool.query(
    `INSERT INTO request_status_history (request_id, status, changed_at)
     SELECT $1, 'in_progress', '2023-01-02'
     WHERE (SELECT COUNT(*) FROM request_status_history WHERE request_id = $1) < 2`,
    [SEED_IDS.request1],
  );

  await dbPool.query(
    `INSERT INTO comments (id, request_id, author_id, body, is_internal, created_at)
     VALUES
       ($1, $3, $4, 'Picked up this request, investigating now.', FALSE, '2023-01-02'),
       ($2, $3, $4, 'Internal note: this client is on a premium contract, prioritize.', TRUE, '2023-01-02')
     ON CONFLICT (id) DO NOTHING`,
    [SEED_IDS.comment1, SEED_IDS.comment2, SEED_IDS.request1, SEED_IDS.engineer],
  );
}
