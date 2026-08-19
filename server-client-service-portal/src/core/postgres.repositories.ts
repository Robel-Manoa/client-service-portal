// Implements ports.ts on top of the real Postgres schema (src/db/schema.sql).
// The core only ever sees the interfaces in ports.ts, so nothing outside
// this file needs to know status_history/assignments/is_internal are
// normalized into their own tables instead of embedded fields.
import { dbPool } from "../db/postgres";
import { UserRepository, RequestRepository, CommentRepository } from "./ports";
import {
  CommentVisibility,
  RequestComment,
  RequestPriority,
  RequestStatus,
  ServiceRequest,
  StatusHistory,
  User,
  UserRole,
} from "./types";

interface UserRow {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

const USER_SELECT = `SELECT id, full_name AS name, email, password_hash AS password, role, is_active, created_at, updated_at FROM users`;

function mapUser(row: UserRow): User {
  return {
    ...row,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export class PostgresUserRepository implements UserRepository {
  async findAll(): Promise<User[]> {
    const { rows } = await dbPool.query<UserRow>(`${USER_SELECT} ORDER BY created_at DESC`);
    return rows.map(mapUser);
  }

  async findById(id: string): Promise<User | undefined> {
    const { rows } = await dbPool.query<UserRow>(`${USER_SELECT} WHERE id = $1`, [id]);
    return rows[0] ? mapUser(rows[0]) : undefined;
  }

  async findByEmail(email: string): Promise<User | undefined> {
    const { rows } = await dbPool.query<UserRow>(`${USER_SELECT} WHERE email = $1`, [email]);
    return rows[0] ? mapUser(rows[0]) : undefined;
  }

  async insert(user: User): Promise<void> {
    await dbPool.query(
      `INSERT INTO users (id, full_name, email, password_hash, role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        user.id,
        user.name,
        user.email,
        user.password,
        user.role,
        user.is_active,
        user.created_at,
        user.updated_at,
      ],
    );
  }

  async save(user: User): Promise<void> {
    await dbPool.query(
      `UPDATE users SET full_name = $1, email = $2, password_hash = $3, role = $4, is_active = $5, updated_at = $6
       WHERE id = $7`,
      [user.name, user.email, user.password, user.role, user.is_active, user.updated_at, user.id],
    );
  }

  async deleteById(id: string): Promise<boolean> {
    const { rowCount } = await dbPool.query(`DELETE FROM users WHERE id = $1`, [id]);
    return (rowCount ?? 0) > 0;
  }
}

interface RequestRow {
  id: string;
  client_id: string;
  title: string;
  description: string;
  priority: RequestPriority;
  status: RequestStatus;
  created_at: Date;
  updated_at: Date;
  assigned_engineer_id: string | null;
}

const REQUEST_SELECT = `
  SELECT r.id, r.client_id, r.title, r.description, r.priority, r.status, r.created_at, r.updated_at,
         a.engineer_id AS assigned_engineer_id
  FROM requests r
  LEFT JOIN assignments a ON a.request_id = r.id
`;

export class PostgresRequestRepository implements RequestRepository {
  // Fetched separately rather than json_agg'd into the main query — one
  // extra round trip, but keeps both queries simple and easy to read.
  private async attachHistory(rows: RequestRow[]): Promise<ServiceRequest[]> {
    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.id);
    const { rows: historyRows } = await dbPool.query<{
      request_id: string;
      status: RequestStatus;
      changed_at: Date;
    }>(
      `SELECT request_id, status, changed_at FROM request_status_history WHERE request_id = ANY($1) ORDER BY changed_at ASC`,
      [ids],
    );

    const historyByRequest = new Map<string, StatusHistory[]>();
    for (const h of historyRows) {
      const list = historyByRequest.get(h.request_id) ?? [];
      list.push({ status: h.status, at: h.changed_at.toISOString() });
      historyByRequest.set(h.request_id, list);
    }

    return rows.map((r) => ({
      id: r.id,
      client_id: r.client_id,
      title: r.title,
      description: r.description,
      priority: r.priority,
      status: r.status,
      created_at: r.created_at.toISOString(),
      updated_at: r.updated_at.toISOString(),
      status_history: historyByRequest.get(r.id) ?? [],
      assigned_engineer_id: r.assigned_engineer_id ?? undefined,
    }));
  }

  async findAll(): Promise<ServiceRequest[]> {
    const { rows } = await dbPool.query<RequestRow>(`${REQUEST_SELECT} ORDER BY r.created_at DESC`);
    return this.attachHistory(rows);
  }

  async findAllByClient(clientId: string): Promise<ServiceRequest[]> {
    const { rows } = await dbPool.query<RequestRow>(
      `${REQUEST_SELECT} WHERE r.client_id = $1 ORDER BY r.created_at DESC`,
      [clientId],
    );
    return this.attachHistory(rows);
  }

  async findAllByEngineer(engineerId: string): Promise<ServiceRequest[]> {
    const { rows } = await dbPool.query<RequestRow>(
      `${REQUEST_SELECT} WHERE a.engineer_id = $1 ORDER BY r.created_at DESC`,
      [engineerId],
    );
    return this.attachHistory(rows);
  }

  async findById(id: string): Promise<ServiceRequest | undefined> {
    const { rows } = await dbPool.query<RequestRow>(`${REQUEST_SELECT} WHERE r.id = $1`, [id]);
    const [request] = await this.attachHistory(rows);
    return request;
  }

  async insert(request: ServiceRequest): Promise<void> {
    await dbPool.query(
      `INSERT INTO requests (id, client_id, title, description, priority, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        request.id,
        request.client_id,
        request.title,
        request.description,
        request.priority,
        request.status,
        request.created_at,
        request.updated_at,
      ],
    );

    for (const entry of request.status_history) {
      await dbPool.query(
        `INSERT INTO request_status_history (request_id, status, changed_at) VALUES ($1, $2, $3)`,
        [request.id, entry.status, entry.at],
      );
    }

    if (request.assigned_engineer_id) {
      await dbPool.query(
        `INSERT INTO assignments (request_id, engineer_id) VALUES ($1, $2)`,
        [request.id, request.assigned_engineer_id],
      );
    }
  }

  async save(request: ServiceRequest): Promise<void> {
    await dbPool.query(
      `UPDATE requests SET title = $1, description = $2, priority = $3, status = $4, updated_at = $5
       WHERE id = $6`,
      [request.title, request.description, request.priority, request.status, request.updated_at, request.id],
    );

    if (request.assigned_engineer_id !== undefined) {
      // upsert: a request has at most one assignment row (UNIQUE(request_id) in schema.sql).
      await dbPool.query(
        `INSERT INTO assignments (request_id, engineer_id) VALUES ($1, $2)
         ON CONFLICT (request_id) DO UPDATE SET engineer_id = EXCLUDED.engineer_id, assigned_at = CURRENT_TIMESTAMP`,
        [request.id, request.assigned_engineer_id],
      );
    }

    // Only the entries not already in the DB are new — status_history on
    // the object passed in is whatever findById() returned plus whatever
    // the caller appended in-place before calling save().
    const { rows } = await dbPool.query<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM request_status_history WHERE request_id = $1`,
      [request.id],
    );
    const existingCount = Number(rows[0].count);
    for (const entry of request.status_history.slice(existingCount)) {
      await dbPool.query(
        `INSERT INTO request_status_history (request_id, status, changed_at) VALUES ($1, $2, $3)`,
        [request.id, entry.status, entry.at],
      );
    }
  }

  async deleteById(id: string): Promise<boolean> {
    const { rowCount } = await dbPool.query(`DELETE FROM requests WHERE id = $1`, [id]);
    return (rowCount ?? 0) > 0;
  }
}

interface CommentRow {
  id: string;
  request_id: string;
  author_id: string;
  body: string;
  is_internal: boolean;
  created_at: Date;
}

function mapComment(row: CommentRow): RequestComment {
  const visibility: CommentVisibility = row.is_internal ? "internal" : "public";
  return {
    id: row.id,
    request_id: row.request_id,
    author_id: row.author_id,
    body: row.body,
    visibility,
    created_at: row.created_at.toISOString(),
  };
}

export class PostgresCommentRepository implements CommentRepository {
  async findAllForRequest(requestId: string): Promise<RequestComment[]> {
    const { rows } = await dbPool.query<CommentRow>(
      `SELECT id, request_id, author_id, body, is_internal, created_at FROM comments WHERE request_id = $1 ORDER BY created_at ASC`,
      [requestId],
    );
    return rows.map(mapComment);
  }

  async insert(comment: RequestComment): Promise<void> {
    await dbPool.query(
      `INSERT INTO comments (id, request_id, author_id, body, is_internal, created_at) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        comment.id,
        comment.request_id,
        comment.author_id,
        comment.body,
        comment.visibility === "internal",
        comment.created_at,
      ],
    );
  }
}

// Defaults the core services fall back to when nothing's injected — same
// idea as `db = dbPool` in src/services/*.ts.
export const userRepository = new PostgresUserRepository();
export const requestRepository = new PostgresRequestRepository();
export const commentRepository = new PostgresCommentRepository();
