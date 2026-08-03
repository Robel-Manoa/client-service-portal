import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

// Permission à Zod pour openAPI
extendZodWithOpenApi(z);

// Seule source de vérité pour la liste des statuts valides — réutilisée
// partout (payload, historique, schéma de transition) pour éviter que les
// cinq valeurs divergent d'un endroit à l'autre.
const REQUEST_STATUSES = ["open", "in_progress", "pending_client", "resolved", "closed"] as const;

// Model de donnée du Request pour openAPI
export const requestSchema = z.object({
  id: z.string().openapi({example: "8f14e45f-ceea-4c9c-8f1e-000000000001"}),
  client_id: z.string().openapi({example: "8f14e45f-ceea-4c9c-8f1e-000000000002"}),
  title: z.string().openapi({example: "My first request"}),
  description: z.string().openapi({example: "I need website to sell my own product"}),
  priority: z.enum(["low", "medium", "high"]).openapi({example: "low"}),
  status: z.enum(REQUEST_STATUSES).openapi({example: "open"}),
  created_at: z.string().openapi({example: "01-01-2023 00:00", description: "Format DD-MM-YYYY HH:mm"}),
  updated_at: z.string().openapi({example: "01-01-2023 00:00", description: "Format DD-MM-YYYY HH:mm"}),
  status_history: z.array(
    z.object({
      status: z.enum(REQUEST_STATUSES),
      at: z.string(),
    }),
  ).openapi({example: [{ status: "open", at: "01-01-2023 00:00" }]}),
  assigned_engineer_id: z.string().optional().openapi({example: "8f14e45f-ceea-4c9c-8f1e-000000000003"}),
}).openapi("ServiceRequest")

// 1. Schéma pour la CRÉATION d'une demande (POST)
// client_id n'est volontairement pas dans ce schéma : il est dérivé de
// req.user (token JWT) dans le controller, jamais du corps de la requête,
// pour empêcher un client de créer une demande au nom d'un autre.
export const createRequestSchema = z.object({
  body: z.object({
    title: z.string({ message: "Le titre est obligatoire." }).min(5, "Le titre doit contenir au moins 5 caractères."),
    description: z.string({ message: "La description est obligatoire." }).min(10, "La description doit contenir au moins 10 caractères."),
    priority: z.enum(["low", "medium", "high"], {
      message: "La priorité doit être : low, medium ou high.",
    }),
  }),
});

// 2. Schéma pour la MISE À JOUR du contenu d'une demande (PUT) — titre/description/priorité
// uniquement. Le statut a son propre schéma/endpoint (voir updateRequestStatusSchema),
// car les règles de qui a le droit de faire quelle transition sont spécifiques.
export const updateRequestSchema = z.object({
  body: z.object({
    title: z.string().min(5, "Le titre doit contenir au moins 5 caractères.").optional(),
    description: z.string().min(10, "La description doit contenir au moins 10 caractères.").optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
  }),
});

// 3. Schéma pour le changement de statut d'une demande (PATCH /api/requests/:id)
export const updateRequestStatusSchema = z.object({
  body: z.object({
    status: z.enum(REQUEST_STATUSES, {
      message: "Le statut doit être : open, in_progress, pending_client, resolved ou closed.",
    }),
  }),
});

// 4. Schéma pour assigner un engineer à une demande (POST /api/requests/:id/assignments)
export const assignEngineerSchema = z.object({
  body: z.object({
    engineer_id: z.string({ message: "L'identifiant de l'engineer est obligatoire." }),
  }),
});
