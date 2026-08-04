import dotenv from 'dotenv';
import {z} from 'zod';

// load variables from the .env file into process.env
dotenv.config();

// required schema
const envSchema = z.object({
    PORT: z.coerce.number().default(3000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    URL_SITE: z.string().min(1, "URL_SITE cannot be empty.").default('localhost:3001/'),
    JWT_SECRET: z.string().min(10, "JWT_SECRET must be at least 10 characters long."),
    PASSWORD_HASH: z.string().min(1, "PASSWORD_HASH is required (password for demo accounts)."),

    // PostgreSQL config (src/db/postgres.ts): not wired into the app yet,
    // so it's optional with sensible defaults to avoid breaking anything
    // while it's unused. Switch to required (drop .default) once the real
    // connection is turned on.
    DB_HOST: z.string().default("localhost"),
    DB_PORT: z.coerce.number().default(5432),
    DB_USER: z.string().default("postgres"),
    DB_PASSWORD: z.string().default("postgres"),
    DB_NAME: z.string().default("service_portal"),
});

// validate process.env against the schema
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(
    JSON.stringify(z.treeifyError(parsed.error), null, 2)
  );
}

// exported config
export const env = parsed.data;
