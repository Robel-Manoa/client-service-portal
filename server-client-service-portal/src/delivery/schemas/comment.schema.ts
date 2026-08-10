import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

// Comment data model (for OpenAPI)
export const commentSchema = z.object({
  id: z.string().openapi({ example: "8f14e45f-ceea-4c9c-8f1e-000000000020" }),
  request_id: z.string().openapi({ example: "8f14e45f-ceea-4c9c-8f1e-000000000010" }),
  author_id: z.string().openapi({ example: "8f14e45f-ceea-4c9c-8f1e-000000000002" }),
  body: z.string().openapi({ example: "Investigating now." }),
  visibility: z.enum(["public", "internal"]).openapi({ example: "public" }),
  created_at: z.string().openapi({ example: "02-01-2023 00:00", description: "Format: DD-MM-YYYY HH:mm" }),
}).openapi("RequestComment");

// Schema for creating a comment (POST /api/requests/:id/comments)
// visibility is optional: a client can only post as "public" anyway
// (enforced in the controller regardless of the value sent).
export const createCommentSchema = z.object({
  body: z.object({
    body: z
      .string({ message: "Comment body is required." })
      .min(1, "Comment body cannot be empty."),
    visibility: z.enum(["public", "internal"]).optional(),
  }),
});
