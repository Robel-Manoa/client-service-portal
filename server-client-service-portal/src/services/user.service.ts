import type { Pool, PoolClient } from "pg";
import { dbPool } from "../db/postgres";

// Either the shared pool, or a single PoolClient handed in by tests that
// wrap everything in BEGIN...ROLLBACK. Both have .query(), so the rest of
// this class doesn't care which one it got.
type Queryable = Pool | PoolClient;

export interface UserRecord{
    id: string,
    name: string,
    email: string,
    password_hash: string,
    role: "client" | "engineer" | "admin",
    is_active: boolean,
    created_at: Date,
    updated_at: Date
}

export class UserService{
    static async findByEmail(email: string, db: Queryable = dbPool): Promise<UserRecord | null>{
        const query = `SELECT id, full_name AS name, email, password_hash, role, is_active, created_at, updated_at FROM users WHERE email = $1`;
        const result = await db.query<UserRecord>(query, [email]);
        return result.rows[0]||null;
    }

    // Unlike findAll/create, this returns the full record — password_hash
    // included — since a caller might legitimately need it (re-verifying a
    // session, checking a password change). Whoever calls this is on the
    // hook for stripping password_hash before it reaches an API response.
    static async findById(id:string, db: Queryable = dbPool): Promise<UserRecord | null>{
        const query = `SELECT id, full_name AS name, email, password_hash, role, is_active, created_at, updated_at FROM users WHERE id = $1`;
        const result = await db.query<UserRecord>(query, [id]);
        return result.rows[0] || null;
    }

    static async create(userData:{
        id: string;
        name: string;
        email: string;
        passwordHash: string;
        role?: "client" | "engineer" | "admin";
    }, db: Queryable = dbPool): Promise<Omit<UserRecord,"password_hash">>{
        const query = `INSERT INTO users (id, full_name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, full_name AS name, email, role, is_active, created_at, updated_at`;
        const values = [userData.id, userData.name, userData.email, userData.passwordHash, userData.role||"client"];

        try {
            const result = await db.query<Omit<UserRecord, "password_hash">>(query, values);
            return result.rows[0];
        } catch (error: any) {
            // 23505 = unique_violation (the email's taken) — turned into a
            // 409 here so a caller can tell "this specific input conflicts"
            // apart from an unrelated failure, without parsing a raw
            // Postgres error code itself.
            if (error.code === "23505") {
                const customError = new Error("A user with this email already exists");
                (customError as any).statusCode = 409;
                throw customError;
            }
            throw error;
        }
    }

    static async findAll(db: Queryable = dbPool): Promise<Omit<UserRecord, "password_hash">[]>{
        const query = `SELECT id, full_name AS name, email, role, is_active, created_at, updated_at FROM users ORDER BY created_at DESC`;
        const result = await db.query<Omit<UserRecord, "password_hash">>(query);
        return result.rows;
    }
}
