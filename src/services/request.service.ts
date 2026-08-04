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
    // Create a request in the database
    static async create(data:{
        id: string;
        title: string;
        description: string;
        priority: Priority;
        client_id: string;
    }, db: Pool | PoolClient = dbPool): Promise<RequestRecord>{
        // CTE + JOIN rather than a plain RETURNING: the RequestRecord type
        // requires client_name/client_email (and engineer_name), which a
        // bare INSERT can't provide (they aren't columns on the requests
        // table). assigned_engineer_id/engineer_name are hardcoded to NULL:
        // a request that was just created can't have a row in `assignments`
        // yet (see schema.sql — assignment lives in its own table, not a
        // column on requests).
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

    // Fetch every request, including client and assigned engineer info.
    // Assignment lives in its own table (assignments.request_id/engineer_id),
    // not a column on requests — hence the LEFT JOIN instead of a direct column.
    static async findAll(filter?: {client_id?: string; assigned_engineer_id?: string}, db: Pool | PoolClient = dbPool):Promise<RequestRecord[]>{
        let query = `SELECT r.id, r.title, r.description, r.priority, r.status, r.client_id, r.created_at, r.updated_at,
                            a.engineer_id AS assigned_engineer_id, c.full_name AS client_name, c.email AS client_email, e.full_name AS engineer_name
                     FROM requests r
                     JOIN users c ON r.client_id = c.id
                     LEFT JOIN assignments a ON a.request_id = r.id
                     LEFT JOIN users e ON e.id = a.engineer_id`;
        const queryParams: any[] = [];
        const conditions: string[] = [];

        // Dynamic filtering based on role (RBAC)
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

    // Fetch a request by ID
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

    // Update a request
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

        // status/priority live on requests; assigned_engineer_id lives on
        // assignments (a separate table) — these are two distinct writes,
        // not a single UPDATE requests like before.
        if(fields.length > 0){
            values.push(new Date());
            fields.push(`updated_at = $${values.length}`);
            const query = `UPDATE requests SET ${fields.join(', ')} WHERE id = $${values.length + 1}`;
            await db.query(query, [...values, id]);
        }

        if(update.assigned_engineer_id !== undefined){
            // upsert: a request has at most one assignment row
            // (UNIQUE(request_id) in schema.sql). engineer_id = NULL to
            // unassign, symmetric with the schema's ON DELETE SET NULL —
            // the assignment row (and its history) is kept.
            await db.query(
                `INSERT INTO assignments (request_id, engineer_id) VALUES ($1, $2)
                 ON CONFLICT (request_id) DO UPDATE SET engineer_id = EXCLUDED.engineer_id, assigned_at = CURRENT_TIMESTAMP`,
                [id, update.assigned_engineer_id],
            );
        }

        return await this.findById(id, db);
    }
}
