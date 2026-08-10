-- cleanup (when resetting the database)
-- drop tables (order doesn't matter: CASCADE handles dependencies)
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS request_status_history CASCADE;
DROP TABLE IF EXISTS assignments CASCADE;
DROP TABLE IF EXISTS requests CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- drop types
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS request_priority CASCADE;
DROP TYPE IF EXISTS request_status CASCADE;

-- gen_random_uuid() is native since PG13; this is just a fallback for
-- anyone running an older version.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- create types
CREATE TYPE user_role AS ENUM ('client', 'engineer', 'admin');
CREATE TYPE request_priority AS ENUM ('low', 'medium', 'high');
-- Keep in sync with RequestStatus in src/core/types.ts.
CREATE TYPE request_status AS ENUM ('open', 'in_progress', 'pending_client', 'resolved', 'closed');

-- UUIDs instead of SERIAL so IDs match what the app already generates
-- (crypto.randomUUID(), src/core/id.util.ts) — no int/string mapping to deal with.

-- Table: users
CREATE TABLE users(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    role user_role NOT NULL DEFAULT 'client',
    -- UserService.login/update both check this — account deactivation
    -- doesn't work without it.
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table: requests
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

-- Table: assignments (a request has at most one assigned engineer at a time)
CREATE TABLE assignments(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    -- Nullable on purpose: if the engineer gets deleted, SET NULL keeps the
    -- assignment record around instead of wiping it. Can't be NOT NULL, or
    -- deleting that user would fail outright.
    engineer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (request_id)
);

-- Table: status change history — mirrors ServiceRequest.status_history,
-- which the app already reads and writes.
CREATE TABLE request_status_history(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    status request_status NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table: comments
CREATE TABLE comments(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    is_internal BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes to speed up common queries against the database
-- Without an index, looking up a user by email (WHERE email = '...') forces PostgreSQL to scan the whole table row by row
-- With idx_users_email in place, that lookup becomes near-instant
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_requests_client ON requests(client_id);
CREATE INDEX idx_assignments_engineer ON assignments(engineer_id);
CREATE INDEX idx_comments_request ON comments(request_id);
CREATE INDEX idx_status_history_request ON request_status_history(request_id);
