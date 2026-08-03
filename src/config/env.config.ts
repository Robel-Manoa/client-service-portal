import dotenv from 'dotenv';
import {z} from 'zod';

// chargement des variables du fichier .env dans process.env
dotenv.config();

// schéma attendu obligatoire
const envSchema = z.object({
    PORT: z.coerce.number().default(3000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    URL_SITE: z.string().min(1, "URL_SITE ne peut pas être vide.").default('localhost:3001/'),
    JWT_SECRET: z.string().min(10, "La clé JWT_SECRET doit faire au moins 10 caractères."),
    PASSWORD_HASH: z.string().min(1, "PASSWORD_HASH est obligatoire (mot de passe des comptes de démonstration)."),

    // Config PostgreSQL (src/db/postgres.ts) : pas encore branchée à l'app,
    // donc optionnelle avec des défauts pour ne rien casser tant qu'elle
    // n'est pas utilisée. À passer en obligatoire (sans .default) le jour où
    // la connexion réelle est activée.
    DB_HOST: z.string().default("localhost"),
    DB_PORT: z.coerce.number().default(5432),
    DB_USER: z.string().default("postgres"),
    DB_PASSWORD: z.string().default("postgres"),
    DB_NAME: z.string().default("service_portal"),
});

// validation du process.env par le schema
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(
    JSON.stringify(z.treeifyError(parsed.error), null, 2)
  );
}

// export de la configuration
export const env = parsed.data;