import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

// Modèle de donnée du commentaire pour OpenAPI
export const commentSchema = z.object({
  id: z.string().openapi({ example: "8f14e45f-ceea-4c9c-8f1e-000000000020" }),
  request_id: z.string().openapi({ example: "8f14e45f-ceea-4c9c-8f1e-000000000010" }),
  author_id: z.string().openapi({ example: "8f14e45f-ceea-4c9c-8f1e-000000000002" }),
  body: z.string().openapi({ example: "Prise en charge en cours." }),
  visibility: z.enum(["public", "internal"]).openapi({ example: "public" }),
  created_at: z.string().openapi({ example: "02-01-2023 00:00", description: "Format DD-MM-YYYY HH:mm" }),
}).openapi("RequestComment");

// Schéma pour la création d'un commentaire (POST /api/requests/:id/comments)
// visibility est optionnel : un client ne peut de toute façon poster qu'en
// "public" (forcé côté controller, quelle que soit la valeur envoyée).
export const createCommentSchema = z.object({
  body: z.object({
    body: z
      .string({ message: "Le contenu du commentaire est obligatoire." })
      .min(1, "Le commentaire ne peut pas être vide."),
    visibility: z.enum(["public", "internal"]).optional(),
  }),
});
