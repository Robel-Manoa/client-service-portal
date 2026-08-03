// Mise en place de la logique métier
// Traitement des données

import type { Pool, PoolClient } from "pg";
import { dbPool } from "../db/postgres";

// Pool (usage normal) OU PoolClient dédié à une transaction (tests
// d'intégration : BEGIN ... ROLLBACK sur une seule connexion). Les deux
// exposent la même méthode .query(), donc UserService n'a pas besoin de
// savoir laquelle il utilise.
type Queryable = Pool | PoolClient;

// Définition de l'intérface représentant un utilisateur issu de la base de donnée
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
    // Pour la partie login : Trouver un utilisateur par son email
    static async findByEmail(email: string, db: Queryable = dbPool): Promise<UserRecord | null>{
        const query = `SELECT id, full_name AS name, email, password_hash, role, is_active, created_at, updated_at FROM users WHERE email = $1`;
        const result = await db.query<UserRecord>(query, [email]);
        return result.rows[0]||null;
    }

    // Trouver un utilisateur par son ID
    static async findById(id:string, db: Queryable = dbPool): Promise<UserRecord | null>{
        const query = `SELECT id, full_name AS name, email, password_hash, role, is_active, created_at, updated_at FROM users WHERE id = $1`;
        const result = await db.query<UserRecord>(query, [id]);
        return result.rows[0] || null;
    }

    // Création d'un utilisateur dans la base de donnée
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
            // Si l'email existe déjà
            // code SQL 23505
            // Violation de contrainte UNIQUE
            if (error.code === "23505") {
                const customError = new Error("Un utilisateur avec cette email existe déjà");
                (customError as any).statusCode = 409; // HTTP 409 conflict
                throw customError;
            }
            throw error;
        }
    }

    // Récupération de tous les données dans la tables users (exepter le mot de passe)
    static async findAll(db: Queryable = dbPool): Promise<Omit<UserRecord, "password_hash">[]>{
        const query = `SELECT id, full_name AS name, email, role, is_active, created_at, updated_at FROM users ORDER BY created_at DESC`;
        const result = await db.query<Omit<UserRecord, "password_hash">>(query);
        return result.rows;
    }
}
