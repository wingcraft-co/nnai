-- Mobile contract: city_stays + wanderer_hops redesign + type-action support tables

CREATE TABLE IF NOT EXISTS city_stays (
    id                BIGSERIAL PRIMARY KEY,
    user_id           TEXT NOT NULL REFERENCES users(id),
    city              TEXT NOT NULL,
    country           TEXT NOT NULL,
    arrived_at        TEXT,
    left_at           TEXT,
    visa_expires_at   TEXT,
    budget_total      DOUBLE PRECISION,
    budget_remaining  DOUBLE PRECISION,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wanderer_hops (
    id          BIGSERIAL PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id),
    from_city   TEXT,
    to_city     TEXT,
    status      TEXT NOT NULL DEFAULT 'planned',
    conditions  JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_focus    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE wanderer_hops
ADD COLUMN IF NOT EXISTS conditions JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE wanderer_hops
ADD COLUMN IF NOT EXISTS is_focus BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE wanderer_hops
SET status = 'planned'
WHERE status NOT IN ('planned', 'booked');

ALTER TABLE wanderer_hops
DROP CONSTRAINT IF EXISTS wanderer_hops_status_check;

ALTER TABLE wanderer_hops
ADD CONSTRAINT wanderer_hops_status_check
CHECK (status IN ('planned', 'booked'));

CREATE TABLE IF NOT EXISTS planner_boards (
    id          BIGSERIAL PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id),
    title       TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS planner_tasks (
    id          BIGSERIAL PRIMARY KEY,
    board_id    BIGINT NOT NULL REFERENCES planner_boards(id) ON DELETE CASCADE,
    user_id     TEXT NOT NULL REFERENCES users(id),
    title       TEXT NOT NULL,
    is_done     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS free_spirit_spins (
    id          BIGSERIAL PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id),
    result      TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS local_saved_events (
    id          BIGSERIAL PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id),
    event_id    TEXT NOT NULL,
    title       TEXT,
    status      TEXT NOT NULL DEFAULT 'saved',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, event_id)
);

CREATE TABLE IF NOT EXISTS pioneer_milestones (
    id          BIGSERIAL PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id),
    title       TEXT NOT NULL,
    is_done     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, title)
);
