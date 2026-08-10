import dotenv from 'dotenv';
import {z} from 'zod';

dotenv.config();

const envSchema = z.object({
    PORT: z.coerce.number().default(3000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    URL_SITE: z.string().min(1, "URL_SITE cannot be empty.").default('localhost:3001/'),
    JWT_SECRET: z.string().min(10, "JWT_SECRET must be at least 10 characters long."),
    PASSWORD_HASH: z.string().min(1, "PASSWORD_HASH is required (password for demo accounts)."),

    // Postgres isn't wired into the app yet (see src/db/postgres.ts), so
    // these have defaults instead of being required — nothing breaks while
    // they're unused. Drop the defaults once we actually connect.
    DB_HOST: z.string().default("localhost"),
    DB_PORT: z.coerce.number().default(5432),
    DB_USER: z.string().default("postgres"),
    DB_PASSWORD: z.string().default("postgres"),
    DB_NAME: z.string().default("service_portal"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(
    JSON.stringify(z.treeifyError(parsed.error), null, 2)
  );
}

export const env = parsed.data;
