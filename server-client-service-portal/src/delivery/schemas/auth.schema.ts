import { z } from "zod";

export const loginSchema = z.object({
  body: z.object({
    email: z
      .email({
        // z.string().email() is deprecated in Zod v4 in favor of the
        // top-level z.email() — this callback keeps the same two distinct
        // messages that used to come from .string({message}) (missing) and
        // .email(message) (malformed) as two separate chained calls.
        error: (issue) =>
          issue.code === "invalid_type"
            ? "Email is required"
            : "Invalid email format",
      })
      .openapi({ example: "admin@portal.local" }),
    password: z.string({ message: "Password is required" }).openapi({example: "Mystongpass"}),
  }),
});
