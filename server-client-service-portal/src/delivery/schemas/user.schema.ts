import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

// Lets Zod attach OpenAPI metadata
extendZodWithOpenApi(z);

// User model (for OpenAPI)
// This schema will show up as "User" in the Swagger docs
export const UserSchema = z.object({
  id: z.string().openapi({example: "8f14e45f-ceea-4c9c-8f1e-000000000001"}),
  name: z.string().openapi({example:"Robel Manoa"}),
  email: z.string().openapi({example:"robelmanoa@gmail.com"}),
  role: z.enum(["client", "engineer", "admin"]).openapi({example: "client"}),
  is_active: z.boolean().openapi({example: true}),
  created_at: z.string().openapi({example: "01-01-2023 00:00", description: "Format: DD-MM-YYYY HH:mm"}),
  updated_at: z.string().openapi({example: "01-01-2023 00:00", description: "Format: DD-MM-YYYY HH:mm"})
}).openapi("User");

// Schema for creating a user

export const createUserSchema = z.object({
  body: z.object({
    name: z
      .string({ message: "Name is required" })
      .min(5, "Name must be at least 5 characters long").openapi({example: "Robel Manoa", description: "The new user's name"}),
    email: z
      .email({
        // See auth.schema.ts for why this is a callback: z.string().email()
        // is deprecated in Zod v4, and the callback keeps the same two
        // distinct messages the old chained .string({message}).email(message)
        // used to give for "missing" vs "malformed".
        error: (issue) =>
          issue.code === "invalid_type"
            ? "Email is required"
            : "Invalid email address format",
      })
      .openapi({ example: "robelmanoa@gmail.com" }),
    password: z
      .string({ message: "Password is required" })
      .min(8, "Password must be at least 8 characters long").openapi({example: "mystrongpassword", description: "The password must be secure and at least 8 characters long"}),
    // Optional: a newly created account defaults to an active client (see createUser).
    // Only an authenticated admin reaches this route and can pick a different role/status.
    role: z
      .enum(["client", "engineer", "admin"], {
        message: "Role must be one of: client, engineer, or admin",
      })
      .optional().openapi({example: "client"}),
    is_active: z.boolean({ message: "is_active must be a boolean" }).optional().openapi({example: true}),
  }),
});

// Schema for updating a user
export const updateUserSchema = z.object({
  body: z.object({
    name: z.string().min(5).optional(),
    email: z.email().optional(),
    password: z.string().min(8).optional(),
    role: z.enum(["client", "admin", "engineer"]).optional(),
    is_active: z.boolean().optional(),
  }),
});
