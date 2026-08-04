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

-- gen_random_uuid() has been built into PostgreSQL core since version 13;
-- this extension is just a safety net on an older version (IF NOT EXISTS =
-- no-op if it's already native)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- create types
CREATE TYPE user_role AS ENUM ('client', 'engineer', 'admin');
CREATE TYPE request_priority AS ENUM ('low', 'medium', 'high');
-- Statuses kept in sync with RequestStatus (src/core/types.ts).
CREATE TYPE request_status AS ENUM ('open', 'in_progress', 'pending_client', 'resolved', 'closed');

-- create tables
-- UUIDs everywhere for IDs (instead of SERIAL): same format as the app side
-- (crypto.randomUUID(), see src/core/id.util.ts), so there's no mapping
-- needed between auto-incrementing integers and the string identifiers
-- already in place.

-- Table: users
CREATE TABLE users(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    role user_role NOT NULL DEFAULT 'client',
    -- Was missing: without this column, the app can't persist account
    -- deactivation (UserService.login/update rely on it).
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
    -- Nullable + ON DELETE SET NULL: if the assigned engineer is deleted, we
    -- keep a record that an assignment existed (instead of losing it) —
    -- consistent with the fact that a NOT NULL column would be incompatible
    -- with SET NULL (Postgres would otherwise refuse the user deletion).
    engineer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (request_id)
);

-- Table: history of a request's status changes
-- (mirrors ServiceRequest.status_history on the app side — missing from the
-- initial schema even though the app already reads/writes it).
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
