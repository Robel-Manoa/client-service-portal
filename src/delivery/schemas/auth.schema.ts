import { z } from "zod";

export const loginSchema = z.object({
  body: z.object({
    email: z
      .string({ message: "Email obligatoire" })
      .email("Format email invalide").openapi({example: "admin@portal.local"}),
    password: z.string({ message: "Le mot de passe est obligatoire" }).openapi({example: "Mystongpass"}),
  }),
});
