-- nettoyage (Si on réinitialise la base de donnée)
-- nettoyage des tables (ordre indifférent : CASCADE gère les dépendances)
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS request_status_history CASCADE;
DROP TABLE IF EXISTS assignments CASCADE;
DROP TABLE IF EXISTS requests CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- nettoyage des types
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS request_priority CASCADE;
DROP TYPE IF EXISTS request_status CASCADE;

-- gen_random_uuid() est intégré au cœur de PostgreSQL depuis la version 13 
-- cette extension ne sert que de filet de sécurité sur une version plus
-- ancienne (IF NOT EXISTS = sans effet si déjà natif)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- création des types
CREATE TYPE user_role AS ENUM ('client', 'engineer', 'admin');
CREATE TYPE request_priority AS ENUM ('low', 'medium', 'high');
-- Statuts alignés avec RequestStatus (src/core/types.ts).
CREATE TYPE request_status AS ENUM ('open', 'in_progress', 'pending_client', 'resolved', 'closed');

-- création des tables
-- IDs en UUID partout (au lieu de SERIAL) : même format que côté app
-- (crypto.randomUUID(), voir src/core/id.util.ts), pas de mapping à faire
-- entre entiers auto-incrémentés et les identifiants string déjà en place.

-- Table : users
CREATE TABLE users(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    role user_role NOT NULL DEFAULT 'client',
    -- Manquait : sans cette colonne, l'app ne peut pas persister la
    -- désactivation de compte (UserService.login/update s'appuient dessus).
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table : requests
CREATE TABLE requests(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    priority request_priority NOT NULL DEFAULT 'low',
    status request_status NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table : assignments (une demande a au plus un engineer assigné à la fois)
CREATE TABLE assignments(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    -- Nullable + ON DELETE SET NULL : si l'engineer assigné est supprimé, on
    -- garde une trace qu'une assignation a existé (au lieu de la perdre) —
    -- cohérent avec le fait qu'une colonne NOT NULL est incompatible avec
    -- SET NULL (Postgres refuserait la suppression du user sinon).
    engineer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (request_id)
);

-- Table : historique des changements de statut d'une demande
-- (correspond à ServiceRequest.status_history côté app — absent du schéma
-- initial alors que l'app le lit/l'écrit déjà).
CREATE TABLE request_status_history(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    status request_status NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table : comments
CREATE TABLE comments(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    is_internal BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Ajout des index pour optimiser la performances des requetes dans la base de donnée
-- Sans index, pour rechercher un utilisateur par son (WHERE email = '...'), PostgreSQL doit relire toute la table ligne par ligne
-- Avec l'index idx_users_email, la recherche devient instantanée
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_requests_client ON requests(client_id);
CREATE INDEX idx_assignments_engineer ON assignments(engineer_id);
CREATE INDEX idx_comments_request ON comments(request_id);
CREATE INDEX idx_status_history_request ON request_status_history(request_id);
