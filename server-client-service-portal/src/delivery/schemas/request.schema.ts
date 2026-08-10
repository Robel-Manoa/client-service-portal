import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

// Lets Zod attach OpenAPI metadata
extendZodWithOpenApi(z);

// Defined once and reused below (payload, history, transition schema) so
// these five values can't quietly drift out of sync with each other.
const REQUEST_STATUSES = ["open", "in_progress", "pending_client", "resolved", "closed"] as const;

// Request data model (for OpenAPI)
export const requestSchema = z.object({
  id: z.string().openapi({example: "8f14e45f-ceea-4c9c-8f1e-000000000001"}),
  client_id: z.string().openapi({example: "8f14e45f-ceea-4c9c-8f1e-000000000002"}),
  title: z.string().openapi({example: "My first request"}),
  description: z.string().openapi({example: "I need website to sell my own product"}),
  priority: z.enum(["low", "medium", "high"]).openapi({example: "low"}),
  status: z.enum(REQUEST_STATUSES).openapi({example: "open"}),
  created_at: z.string().openapi({example: "01-01-2023 00:00", description: "Format: DD-MM-YYYY HH:mm"}),
  updated_at: z.string().openapi({example: "01-01-2023 00:00", description: "Format: DD-MM-YYYY HH:mm"}),
  status_history: z.array(
    z.object({
      status: z.enum(REQUEST_STATUSES),
      at: z.string(),
    }),
  ).openapi({example: [{ status: "open", at: "01-01-2023 00:00" }]}),
  assigned_engineer_id: z.string().optional().openapi({example: "8f14e45f-ceea-4c9c-8f1e-000000000003"}),
}).openapi("ServiceRequest")

// 1. Schema for CREATING a request (POST)
// client_id is deliberately left out of this schema: it's derived from
// req.user (JWT token) in the controller, never from the request body, so a
// client can't create a request on someone else's behalf.
export const createRequestSchema = z.object({
  body: z.object({
    title: z.string({ message: "Title is required." }).min(5, "Title must be at least 5 characters long."),
    description: z.string({ message: "Description is required." }).min(10, "Description must be at least 10 characters long."),
    priority: z.enum(["low", "medium", "high"], {
      message: "Priority must be one of: low, medium, or high.",
    }),
  }),
});

// 2. Schema for UPDATING a request's content (PUT) — title/description/priority
// only. Status has its own schema/endpoint (see updateRequestStatusSchema),
// since the rules around who can perform which transition are specific.
export const updateRequestSchema = z.object({
  body: z.object({
    title: z.string().min(5, "Title must be at least 5 characters long.").optional(),
    description: z.string().min(10, "Description must be at least 10 characters long.").optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
  }),
});

// 3. Schema for changing a request's status (PATCH /api/requests/:id)
export const updateRequestStatusSchema = z.object({
  body: z.object({
    status: z.enum(REQUEST_STATUSES, {
      message: "Status must be one of: open, in_progress, pending_client, resolved, or closed.",
    }),
  }),
});

// 4. Schema for assigning an engineer to a request (POST /api/requests/:id/assignments)
export const assignEngineerSchema = z.object({
  body: z.object({
    engineer_id: z.string({ message: "The engineer's ID is required." }),
  }),
});
