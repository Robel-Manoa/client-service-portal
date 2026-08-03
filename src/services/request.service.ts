import { dbPool } from "../db/postgres";
import {Pool, PoolClient} from 'pg';

type Priority = "low" | "medium" | "high";

export interface RequestRecord{
    id: string,
    title: string,
    description: string,
    priority: Priority,
    status: "open" | "in_progress" | "pending_client" | "resolved" | "closed",
    client_id: string,
    client_name: string,
    client_email: string,
    assigned_engineer_id: string | null,
    engineer_name: string | null,
    created_at: Date,
    updated_at: Date
}

export class RequestService{
    // Création d'une demande dans la base de donnée
    static async create(data:{
        id: string;
        title: string;
        description: string;
        priority: Priority;
        client_id: string;
    }, db: Pool | PoolClient = dbPool): Promise<RequestRecord>{
        // CTE + JOIN plutôt qu'un simple RETURNING : le type RequestRecord
        // exige client_name/client_email (et engineer_name), qu'un INSERT
        // seul ne peut pas fournir (ce ne sont pas des colonnes de la table
        // requests). assigned_engineer_id/engineer_name sont forcés à NULL
        // en littéral : une demande tout juste créée ne peut pas encore
        // avoir de ligne dans `assignments` (voir schema.sql — l'assignation
        // est une table séparée, pas une colonne de requests).
        const query = `
            WITH new_request AS (
                INSERT INTO requests(id, title, description, priority, client_id)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id, title, description, priority, status, client_id, created_at, updated_at
            )
            SELECT nr.id, nr.title, nr.description, nr.priority, nr.status, nr.client_id, nr.created_at, nr.updated_at,
                   NULL::uuid AS assigned_engineer_id, NULL::text AS engineer_name,
                   c.full_name AS client_name, c.email AS client_email
            FROM new_request nr
            JOIN users c ON nr.client_id = c.id
        `;
        const values = [data.id, data.title, data.description, data.priority, data.client_id];
        const result = await db.query<RequestRecord>(query, values);
        return result.rows[0];
    }

    // Récupération de toutes les demandes avec informations sur le client et l'ingénieur assigné.
    // L'assignation vit dans sa propre table (assignments.request_id/engineer_id),
    // pas dans une colonne de requests — d'où le LEFT JOIN plutôt qu'une colonne directe.
    static async findAll(filter?: {client_id?: string; assigned_engineer_id?: string}, db: Pool | PoolClient = dbPool):Promise<RequestRecord[]>{
        let query = `SELECT r.id, r.title, r.description, r.priority, r.status, r.client_id, r.created_at, r.updated_at,
                            a.engineer_id AS assigned_engineer_id, c.full_name AS client_name, c.email AS client_email, e.full_name AS engineer_name
                     FROM requests r
                     JOIN users c ON r.client_id = c.id
                     LEFT JOIN assignments a ON a.request_id = r.id
                     LEFT JOIN users e ON e.id = a.engineer_id`;
        const queryParams: any[] = [];
        const conditions: string[] = [];

        // Filtre dynamique selon les rôles (RBAC)
        if(filter?.client_id){
            queryParams.push(filter.client_id);
            conditions.push(`r.client_id = $${queryParams.length}`);
        }

        if(filter?.assigned_engineer_id){
            queryParams.push(filter.assigned_engineer_id);
            conditions.push(`a.engineer_id = $${queryParams.length}`);
        }

        if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
        }

        query += " ORDER BY r.created_at DESC";
        const result = await db.query<RequestRecord>(query, queryParams);
        return result.rows;
    }

    // Récupération d'une demande par ID
    static async findById(id: string, db: Pool | PoolClient = dbPool): Promise<RequestRecord | null>{
        const query = `SELECT r.id, r.title, r.description, r.priority, r.status, r.client_id, r.created_at, r.updated_at,
                              a.engineer_id AS assigned_engineer_id, c.full_name AS client_name, c.email AS client_email, e.full_name AS engineer_name
                       FROM requests r
                       JOIN users c ON r.client_id = c.id
                       LEFT JOIN assignments a ON a.request_id = r.id
                       LEFT JOIN users e ON e.id = a.engineer_id
                       WHERE r.id = $1`;
        const result =  await db.query<RequestRecord>(query, [id]);
        return result.rows[0] || null;
    }

    // Mise à jour d'une demande
    static async update(id: string, update:{
        status?: "open" | "in_progress" | "pending_client" | "resolved" | "closed";
        priority?: Priority;
        assigned_engineer_id?: string | null;
    }, db: Pool | PoolClient = dbPool): Promise<RequestRecord | null>{
        const fields: string[] = [];
        const values: any[] = [];

        if(update.status !== undefined){
            values.push(update.status);
            fields.push(`status = $${values.length}`);
        }

        if(update.priority !== undefined){
            values.push(update.priority);
            fields.push(`priority = $${values.length}`);
        }

        // status/priority vivent sur requests ; assigned_engineer_id vit sur
        // assignments (table séparée) — ce sont deux écritures distinctes,
        // pas un seul UPDATE requests comme avant.
        if(fields.length > 0){
            values.push(new Date());
            fields.push(`updated_at = $${values.length}`);
            const query = `UPDATE requests SET ${fields.join(', ')} WHERE id = $${values.length + 1}`;
            await db.query(query, [...values, id]);
        }

        if(update.assigned_engineer_id !== undefined){
            // upsert : une demande a au plus une ligne d'assignation
            // (UNIQUE(request_id) dans schema.sql). engineer_id = NULL pour
            // désassigner, symétrique avec le ON DELETE SET NULL du schéma —
            // la ligne d'assignation (donc son historique) est conservée.
            await db.query(
                `INSERT INTO assignments (request_id, engineer_id) VALUES ($1, $2)
                 ON CONFLICT (request_id) DO UPDATE SET engineer_id = EXCLUDED.engineer_id, assigned_at = CURRENT_TIMESTAMP`,
                [id, update.assigned_engineer_id],
            );
        }

        return await this.findById(id, db);
    }
}
