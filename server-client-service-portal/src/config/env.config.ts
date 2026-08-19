import dotenv from 'dotenv';
import {z} from 'zod';

dotenv.config();

const envSchema = z.object({
    PORT: z.coerce.number().default(3000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    URL_SITE: z.string().min(1, "URL_SITE cannot be empty.").default('localhost:3001/'),
    JWT_SECRET: z.string().min(10, "JWT_SECRET must be at least 10 characters long."),
    PASSWORD_HASH: z.string().min(1, "PASSWORD_HASH is required (password for demo accounts)."),

    // Required: the app reads/writes through this Postgres connection (see
    // src/db/postgres.ts) — a missing var should fail fast at startup
    // instead of the pool silently connecting to the wrong database.
    DB_HOST: z.string().min(1, "DB_HOST is required."),
    DB_PORT: z.coerce.number().default(5432),
    DB_USER: z.string().min(1, "DB_USER is required."),
    DB_PASSWORD: z.string().min(1, "DB_PASSWORD is required."),
    DB_NAME: z.string().min(1, "DB_NAME is required."),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(
    JSON.stringify(z.treeifyError(parsed.error), null, 2)
  );
}

export const env = parsed.data;
