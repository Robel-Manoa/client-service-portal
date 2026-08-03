import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

// Instruction pour dire que Zod peut utiliser les métadonnées openAPI
extendZodWithOpenApi(z);

// Modèle d'un utilisateur (Pour OpenAPI)
// Le nom du schéma dans la documentation (swagger) sera User
export const UserSchema = z.object({
  id: z.string().openapi({example: "8f14e45f-ceea-4c9c-8f1e-000000000001"}),
  name: z.string().openapi({example:"Robel Manoa"}),
  email: z.string().openapi({example:"robelmanoa@gmail.com"}),
  role: z.enum(["client", "engineer", "admin"]).openapi({example: "client"}),
  is_active: z.boolean().openapi({example: true}),
  created_at: z.string().openapi({example: "01-01-2023 00:00", description: "Format DD-MM-YYYY HH:mm"}),
  updated_at: z.string().openapi({example: "01-01-2023 00:00", description: "Format DD-MM-YYYY HH:mm"})
}).openapi("User");

// Schéma pour la création d'un utilisateur

export const createUserSchema = z.object({
  body: z.object({
    name: z
      .string({ message: "Le nom est obligatoire" })
      .min(5, "Le nom doit contenir au moins 5 caractères").openapi({example: "Robel Manoa", description: "Le nom de l'utilisateur créer"}),
    email: z
      .string({ message: "L'email est obligatoire" })
      .email("Le format de l'adresse email est invalide").openapi({example: "robelmanoa@gmail.com"}),
    password: z
      .string({ message: "Le mot de passe est obligatoire" })
      .min(8, "Le mot de passe doit contenir au moins 8 caractères").openapi({example: "mystrongpassword", description: "Le mot de passe doit être sécuriser et minimum 8 caractère"}),
    // Optionnels : par défaut un compte créé est un client actif (voir createUser).
    // Seul un admin authentifié atteint cette route et peut choisir un autre rôle/statut.
    role: z
      .enum(["client", "engineer", "admin"], {
        message: "Le role doit être : client, engineer ou admin seulement",
      })
      .optional().openapi({example: "client"}),
    is_active: z.boolean({ message: "Le status doit être un booléen" }).optional().openapi({example: true}),
  }),
});

// Schéma pour la mise à jour
export const updateUserSchema = z.object({
  body: z.object({
    name: z.string().min(5).optional(),
    email: z.string().email().optional(),
    password: z.string().min(8).optional(),
    role: z.enum(["client", "admin", "engineer"]).optional(),
    is_active: z.boolean().optional(),
  }),
});

