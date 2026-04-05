"""PostgreSQL 연결 + 스키마 초기화."""
import os
import threading
import psycopg2

_DATABASE_URL = os.environ.get("DATABASE_URL")


def init_db(url: str | None = None) -> psycopg2.extensions.connection:
    """DB 연결 + 테이블 생성."""
    db_url = url or _DATABASE_URL
    if not db_url:
        raise RuntimeError("DATABASE_URL 환경변수가 설정되지 않았습니다.")
    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id         TEXT PRIMARY KEY,
                email      TEXT,
                name       TEXT,
                picture    TEXT,
                persona_type TEXT,
                created_at TEXT
            );
        """)
        cur.execute("""
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS persona_type TEXT;
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS pins (
                id         SERIAL PRIMARY KEY,
                user_id    TEXT NOT NULL REFERENCES users(id),
                city       TEXT NOT NULL,
                display    TEXT,
                note       TEXT,
                lat        REAL NOT NULL,
                lng        REAL NOT NULL,
                user_lat   REAL,
                user_lng   REAL,
                created_at TEXT NOT NULL
            );
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS visits (
                path       TEXT PRIMARY KEY,
                count      BIGINT NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL
            );
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS posts (
                id          BIGSERIAL PRIMARY KEY,
                user_id     TEXT NOT NULL REFERENCES users(id),
                title       TEXT NOT NULL,
                body        TEXT NOT NULL,
                tags        JSONB NOT NULL DEFAULT '[]',
                city        TEXT,
                likes_count INTEGER NOT NULL DEFAULT 0,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS post_likes (
                post_id     BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
                user_id     TEXT NOT NULL REFERENCES users(id),
                PRIMARY KEY (post_id, user_id)
            );
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS post_comments (
                id          BIGSERIAL PRIMARY KEY,
                post_id     BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
                user_id     TEXT NOT NULL REFERENCES users(id),
                body        TEXT NOT NULL,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS circles (
                id           BIGSERIAL PRIMARY KEY,
                name         TEXT NOT NULL,
                description  TEXT,
                member_count INTEGER NOT NULL DEFAULT 0,
                created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS circle_members (
                circle_id   BIGINT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
                user_id     TEXT NOT NULL REFERENCES users(id),
                joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (circle_id, user_id)
            );
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS move_plans (
                id          BIGSERIAL PRIMARY KEY,
                user_id     TEXT NOT NULL REFERENCES users(id),
                title       TEXT NOT NULL,
                from_city   TEXT,
                to_city     TEXT,
                stage       TEXT NOT NULL DEFAULT 'planning'
                            CHECK (stage IN ('planning', 'booked', 'completed')),
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS move_checklist_items (
                id          BIGSERIAL PRIMARY KEY,
                plan_id     BIGINT NOT NULL REFERENCES move_plans(id) ON DELETE CASCADE,
                text        TEXT NOT NULL,
                is_done     BOOLEAN NOT NULL DEFAULT FALSE,
                sort_order  INTEGER NOT NULL DEFAULT 0
            );
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS user_badges (
                user_id     TEXT NOT NULL REFERENCES users(id),
                badge       TEXT NOT NULL
                            CHECK (badge IN ('host', 'verified_reviewer', 'community_builder')),
                earned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (user_id, badge)
            );
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS city_stays (
                id                BIGSERIAL PRIMARY KEY,
                user_id           TEXT NOT NULL REFERENCES users(id),
                city              TEXT NOT NULL,
                country           TEXT,
                arrived_at        TEXT,
                left_at           TEXT,
                visa_expires_at   TEXT,
                budget_total      DOUBLE PRECISION,
                budget_remaining  DOUBLE PRECISION,
                created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        """)
        cur.execute("""
            ALTER TABLE city_stays
            ALTER COLUMN country DROP NOT NULL;
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS wanderer_hops (
                id          BIGSERIAL PRIMARY KEY,
                user_id     TEXT NOT NULL REFERENCES users(id),
                from_city   TEXT,
                from_country TEXT,
                to_country  TEXT,
                to_city     TEXT,
                note        TEXT,
                target_month TEXT,
                status      TEXT NOT NULL DEFAULT 'planned',
                conditions  JSONB NOT NULL DEFAULT '[]'::jsonb,
                is_focus    BOOLEAN NOT NULL DEFAULT FALSE,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        """)
        cur.execute("""
            ALTER TABLE wanderer_hops
            ADD COLUMN IF NOT EXISTS conditions JSONB NOT NULL DEFAULT '[]'::jsonb;
        """)
        cur.execute("""
            ALTER TABLE wanderer_hops
            ADD COLUMN IF NOT EXISTS is_focus BOOLEAN NOT NULL DEFAULT FALSE;
        """)
        cur.execute("""
            ALTER TABLE wanderer_hops
            ADD COLUMN IF NOT EXISTS from_country TEXT;
        """)
        cur.execute("""
            ALTER TABLE wanderer_hops
            ADD COLUMN IF NOT EXISTS to_country TEXT;
        """)
        cur.execute("""
            ALTER TABLE wanderer_hops
            ADD COLUMN IF NOT EXISTS note TEXT;
        """)
        cur.execute("""
            ALTER TABLE wanderer_hops
            ADD COLUMN IF NOT EXISTS target_month TEXT;
        """)
        cur.execute("""
            UPDATE wanderer_hops
            SET status = 'planned'
            WHERE status NOT IN ('planned', 'booked');
        """)
        cur.execute("""
            ALTER TABLE wanderer_hops
            DROP CONSTRAINT IF EXISTS wanderer_hops_status_check;
        """)
        cur.execute("""
            ALTER TABLE wanderer_hops
            ADD CONSTRAINT wanderer_hops_status_check
            CHECK (status IN ('planned', 'booked'));
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS planner_boards (
                id          BIGSERIAL PRIMARY KEY,
                user_id     TEXT NOT NULL REFERENCES users(id),
                country     TEXT,
                city        TEXT,
                title       TEXT NOT NULL,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        """)
        cur.execute("""
            ALTER TABLE planner_boards
            ADD COLUMN IF NOT EXISTS country TEXT;
        """)
        cur.execute("""
            ALTER TABLE planner_boards
            ADD COLUMN IF NOT EXISTS city TEXT;
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS planner_tasks (
                id          BIGSERIAL PRIMARY KEY,
                board_id    BIGINT NOT NULL REFERENCES planner_boards(id) ON DELETE CASCADE,
                user_id     TEXT NOT NULL REFERENCES users(id),
                text        TEXT,
                title       TEXT NOT NULL,
                is_done     BOOLEAN NOT NULL DEFAULT FALSE,
                due_date    TEXT,
                sort_order  INTEGER NOT NULL DEFAULT 0,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        """)
        cur.execute("""
            ALTER TABLE planner_tasks
            ADD COLUMN IF NOT EXISTS text TEXT;
        """)
        cur.execute("""
            ALTER TABLE planner_tasks
            ADD COLUMN IF NOT EXISTS due_date TEXT;
        """)
        cur.execute("""
            ALTER TABLE planner_tasks
            ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
        """)
        cur.execute("""
            UPDATE planner_tasks SET text = title WHERE text IS NULL;
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS free_spirit_spins (
                id          BIGSERIAL PRIMARY KEY,
                user_id     TEXT NOT NULL REFERENCES users(id),
                result      TEXT NOT NULL,
                selected    JSONB NOT NULL DEFAULT '{}'::jsonb,
                candidates_count INTEGER NOT NULL DEFAULT 1,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        """)
        cur.execute("""
            ALTER TABLE free_spirit_spins
            ADD COLUMN IF NOT EXISTS selected JSONB NOT NULL DEFAULT '{}'::jsonb;
        """)
        cur.execute("""
            ALTER TABLE free_spirit_spins
            ADD COLUMN IF NOT EXISTS candidates_count INTEGER NOT NULL DEFAULT 1;
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS local_saved_events (
                id          BIGSERIAL PRIMARY KEY,
                user_id     TEXT NOT NULL REFERENCES users(id),
                event_id    TEXT NOT NULL,
                source      TEXT,
                source_event_id TEXT,
                title       TEXT,
                venue_name  TEXT,
                address     TEXT,
                country     TEXT,
                city        TEXT,
                starts_at   TEXT,
                ends_at     TEXT,
                lat         DOUBLE PRECISION,
                lng         DOUBLE PRECISION,
                radius_m    INTEGER NOT NULL DEFAULT 1500,
                status      TEXT NOT NULL DEFAULT 'saved',
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE (user_id, event_id)
            );
        """)
        cur.execute("""
            ALTER TABLE local_saved_events
            ADD COLUMN IF NOT EXISTS source TEXT;
        """)
        cur.execute("""
            ALTER TABLE local_saved_events
            ADD COLUMN IF NOT EXISTS source_event_id TEXT;
        """)
        cur.execute("""
            ALTER TABLE local_saved_events
            ADD COLUMN IF NOT EXISTS venue_name TEXT;
        """)
        cur.execute("""
            ALTER TABLE local_saved_events
            ADD COLUMN IF NOT EXISTS address TEXT;
        """)
        cur.execute("""
            ALTER TABLE local_saved_events
            ADD COLUMN IF NOT EXISTS country TEXT;
        """)
        cur.execute("""
            ALTER TABLE local_saved_events
            ADD COLUMN IF NOT EXISTS city TEXT;
        """)
        cur.execute("""
            ALTER TABLE local_saved_events
            ADD COLUMN IF NOT EXISTS starts_at TEXT;
        """)
        cur.execute("""
            ALTER TABLE local_saved_events
            ADD COLUMN IF NOT EXISTS ends_at TEXT;
        """)
        cur.execute("""
            ALTER TABLE local_saved_events
            ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
        """)
        cur.execute("""
            ALTER TABLE local_saved_events
            ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
        """)
        cur.execute("""
            ALTER TABLE local_saved_events
            ADD COLUMN IF NOT EXISTS radius_m INTEGER NOT NULL DEFAULT 1500;
        """)
        cur.execute("""
            UPDATE local_saved_events
            SET source_event_id = event_id
            WHERE source_event_id IS NULL;
        """)
        cur.execute("""
            UPDATE local_saved_events
            SET source = 'google_places'
            WHERE source IS NULL;
        """)
        cur.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_local_saved_events_user_source_event
            ON local_saved_events (user_id, source, source_event_id);
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS pioneer_milestones (
                id          BIGSERIAL PRIMARY KEY,
                user_id     TEXT NOT NULL REFERENCES users(id),
                country     TEXT,
                city        TEXT,
                category    TEXT,
                title       TEXT NOT NULL,
                status      TEXT NOT NULL DEFAULT 'todo',
                target_date TEXT,
                note        TEXT,
                is_done     BOOLEAN NOT NULL DEFAULT FALSE,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE (user_id, title)
            );
        """)
        cur.execute("""
            ALTER TABLE pioneer_milestones
            ADD COLUMN IF NOT EXISTS country TEXT;
        """)
        cur.execute("""
            ALTER TABLE pioneer_milestones
            ADD COLUMN IF NOT EXISTS city TEXT;
        """)
        cur.execute("""
            ALTER TABLE pioneer_milestones
            ADD COLUMN IF NOT EXISTS category TEXT;
        """)
        cur.execute("""
            ALTER TABLE pioneer_milestones
            ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'todo';
        """)
        cur.execute("""
            ALTER TABLE pioneer_milestones
            ADD COLUMN IF NOT EXISTS target_date TEXT;
        """)
        cur.execute("""
            ALTER TABLE pioneer_milestones
            ADD COLUMN IF NOT EXISTS note TEXT;
        """)
        cur.execute("""
            UPDATE pioneer_milestones
            SET status = CASE WHEN is_done THEN 'done' ELSE 'todo' END
            WHERE status IS NULL;
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS verified_sources (
                id            TEXT PRIMARY KEY,
                name          TEXT NOT NULL,
                publisher     TEXT,
                url           TEXT NOT NULL,
                metric_scope  JSONB NOT NULL DEFAULT '[]'::jsonb,
                last_checked  TEXT,
                updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS verified_countries (
                country_id                 TEXT PRIMARY KEY,
                name                       TEXT NOT NULL,
                name_kr                    TEXT,
                visa_type                  TEXT NOT NULL,
                min_income_usd             DOUBLE PRECISION,
                stay_months                INTEGER,
                renewable                  BOOLEAN,
                visa_fee_usd               DOUBLE PRECISION,
                source_url                 TEXT,
                data_verified_date         TEXT,
                is_verified                BOOLEAN NOT NULL DEFAULT TRUE,
                raw_data                   JSONB NOT NULL,
                updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS verified_cities (
                city_id                    TEXT PRIMARY KEY,
                city                       TEXT NOT NULL,
                city_kr                    TEXT,
                country                    TEXT,
                country_id                 TEXT NOT NULL,
                monthly_cost_usd           DOUBLE PRECISION,
                internet_mbps              DOUBLE PRECISION,
                safety_score               DOUBLE PRECISION,
                english_score              DOUBLE PRECISION,
                nomad_score                DOUBLE PRECISION,
                tax_residency_days         INTEGER,
                data_verified_date         TEXT,
                is_verified                BOOLEAN NOT NULL DEFAULT TRUE,
                raw_data                   JSONB NOT NULL,
                updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS verified_city_sources (
                city_id       TEXT NOT NULL REFERENCES verified_cities(city_id) ON DELETE CASCADE,
                source_id     TEXT NOT NULL REFERENCES verified_sources(id) ON DELETE CASCADE,
                linked_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (city_id, source_id)
            );
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS verification_logs (
                id            BIGSERIAL PRIMARY KEY,
                entity_type   TEXT NOT NULL,
                entity_id     TEXT NOT NULL,
                action        TEXT NOT NULL,
                source_id     TEXT,
                verified_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                notes         TEXT,
                payload       JSONB NOT NULL DEFAULT '{}'::jsonb
            );
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS idx_verified_cities_country_id ON verified_cities(country_id);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_verification_logs_entity ON verification_logs(entity_type, entity_id);")
    conn.commit()
    return conn


_conn: psycopg2.extensions.connection | None = None
_lock = threading.Lock()


def get_conn() -> psycopg2.extensions.connection:
    """앱 전역 싱글턴 연결 반환."""
    global _conn
    if _conn is None:
        with _lock:
            if _conn is None:
                _conn = init_db()
    return _conn
