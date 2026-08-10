import { z } from "zod";

export const loginSchema = z.object({
  body: z.object({
    email: z
      .string({ message: "Email is required" })
      .email("Invalid email format").openapi({example: "admin@portal.local"}),
    password: z.string({ message: "Password is required" }).openapi({example: "Mystongpass"}),
  }),
});
