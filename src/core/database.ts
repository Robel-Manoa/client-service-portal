import { RequestComment, ServiceRequest, User } from "./types";
import { env } from "../config/env.config";

// base de donnée en mémoire

// Hash bcrypt généré avec bcrypt.hash('password123', 10) — vérifié avec bcrypt.compare avant commit.
// Vient de env.config.ts (schéma Zod validé) plutôt que de process.env directement,
// pour que l'app refuse de démarrer avec un message clair si la variable manque,
// au lieu de planter plus tard sur un bcrypt.compare(undefined).
const DEMO_PASSWORD_HASH = env.PASSWORD_HASH; // mot de passe en clair : 'password123'

// IDs fixes (UUID valides) pour les données de seed, exportés pour que les
// tests y fassent référence par nom plutôt que de recopier des chaînes en
// dur. Format reconnaissable (préfixe par type d'entité) uniquement pour le
// confort de lecture en dev — ce sont de vrais UUID, comme ceux que
// PostgreSQL générera plus tard avec gen_random_uuid().
export const SEED_IDS = {
  admin: "00000000-0000-4000-8000-000000000000",
  client1: "00000000-0000-4000-8000-000000000001",
  engineer: "00000000-0000-4000-8000-000000000002",
  client2: "00000000-0000-4000-8000-000000000003",
  request1: "10000000-0000-4000-8000-000000000001",
  comment1: "20000000-0000-4000-8000-000000000001",
  comment2: "20000000-0000-4000-8000-000000000002",
} as const;

// Export avec une variable const pour les qualités de code avec sonarqube
// Utiliser const pour des variables immuables
export const serviceRequestDb: ServiceRequest[] = [
  {
    id: SEED_IDS.request1,
    client_id: SEED_IDS.client1,
    title: "My Request test",
    description: "This is a request at a memory storage",
    priority: "high",
    status: "open",
    created_at: "2023-01-01",
    updated_at: "2023-01-01",
    status_history: [
      { status: "open", at: "2023-01-01" },
      { status: "in_progress", at: "2023-01-02" },
    ],
    assigned_engineer_id: SEED_IDS.engineer,
  },
];

export const requestCommentDb: RequestComment[] = [
  {
    id: SEED_IDS.comment1,
    request_id: SEED_IDS.request1,
    author_id: SEED_IDS.engineer,
    body: "Prise en charge de la demande, analyse en cours.",
    visibility: "public",
    created_at: "2023-01-02",
  },
  {
    id: SEED_IDS.comment2,
    request_id: SEED_IDS.request1,
    author_id: SEED_IDS.engineer,
    body: "Note interne : le client a un contrat premium, prioriser.",
    visibility: "internal",
    created_at: "2023-01-02",
  },
];

export const userAccountDb: User[] = [
  {
    id: SEED_IDS.admin,
    name: "Admin Portal",
    email: "admin@portal.local",
    password: DEMO_PASSWORD_HASH,
    role: "admin",
    is_active: true,
    created_at: "2023-04-25",
    updated_at: "2023-04-25",
  },
  {
    id: SEED_IDS.client1,
    name: "Robel",
    email: "manoa@gmail.com",
    password: DEMO_PASSWORD_HASH,
    role: "client",
    is_active: true,
    created_at: "2023-04-25",
    updated_at: "2023-04-25",
  },
  {
    id: SEED_IDS.engineer,
    name: "manoa",
    email: "robel@gmail.com",
    password: DEMO_PASSWORD_HASH,
    role: "engineer",
    is_active: true,
    created_at: "2023-04-25",
    updated_at: "2023-04-25",
  },
  {
    id: SEED_IDS.client2,
    name: "Fy",
    email: "Fy@gmail.com",
    password: DEMO_PASSWORD_HASH,
    role: "client",
    is_active: true,
    created_at: "2023-04-25",
    updated_at: "2023-04-25",
  },
];
