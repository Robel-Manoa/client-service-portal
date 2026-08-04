// Business logic layer
// Data access for users

import type { Pool, PoolClient } from "pg";
import { dbPool } from "../db/postgres";

// Pool (normal usage) OR a PoolClient dedicated to a transaction
// (integration tests: BEGIN ... ROLLBACK on a single connection). Both
// expose the same .query() method, so UserService doesn't need to know
// which one it's using.
type Queryable = Pool | PoolClient;

// Interface representing a user record from the database
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
    // For login: find a user by email
    static async findByEmail(email: string, db: Queryable = dbPool): Promise<UserRecord | null>{
        const query = `SELECT id, full_name AS name, email, password_hash, role, is_active, created_at, updated_at FROM users WHERE email = $1`;
        const result = await db.query<UserRecord>(query, [email]);
        return result.rows[0]||null;
    }

    // Find a user by ID
    static async findById(id:string, db: Queryable = dbPool): Promise<UserRecord | null>{
        const query = `SELECT id, full_name AS name, email, password_hash, role, is_active, created_at, updated_at FROM users WHERE id = $1`;
        const result = await db.query<UserRecord>(query, [id]);
        return result.rows[0] || null;
    }

    // Create a user in the database
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
            // Email already taken
            // SQL error code 23505
            // UNIQUE constraint violation
            if (error.code === "23505") {
                const customError = new Error("A user with this email already exists");
                (customError as any).statusCode = 409; // HTTP 409 conflict
                throw customError;
            }
            throw error;
        }
    }

    // Fetch every row in the users table (excluding the password)
    static async findAll(db: Queryable = dbPool): Promise<Omit<UserRecord, "password_hash">[]>{
        const query = `SELECT id, full_name AS name, email, role, is_active, created_at, updated_at FROM users ORDER BY created_at DESC`;
        const result = await db.query<Omit<UserRecord, "password_hash">>(query);
        return result.rows;
    }
}
