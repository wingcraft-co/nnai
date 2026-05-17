import os
import pytest

TEST_DB_URL = os.environ.get("TEST_DATABASE_URL")

pytestmark = pytest.mark.skipif(
    not TEST_DB_URL,
    reason="TEST_DATABASE_URL 환경변수가 없으면 스킵"
)


@pytest.fixture
def conn():
    from utils.db import init_db
    c = init_db(TEST_DB_URL)
    yield c
    # 테스트 후 테이블 초기화
    with c.cursor() as cur:
        cur.execute("DELETE FROM nomad_journey_stops")
        cur.execute("DELETE FROM users")
    c.commit()
    c.close()


def test_init_creates_tables(conn):
    with conn.cursor() as cur:
        cur.execute("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema='public'
        """)
        tables = {r[0] for r in cur.fetchall()}
    assert "users" in tables
    assert "nomad_journey_stops" in tables
    assert "pins" not in tables


def test_insert_and_fetch_journey_stop(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO users (id, email, name, picture, persona_type, created_at)
            VALUES (%s, %s, %s, %s, %s, NOW()::text)
            """,
            ("uid1", "test@example.com", "Test", "http://img", "planner")
        )
        cur.execute(
            """
            INSERT INTO nomad_journey_stops(
                user_id, city, country, country_code, note, lat, lng, persona_type
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            ("uid1", "방콕", "Thailand", "TH", "최고!", 13.75, 100.5, "planner")
        )
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT city, note FROM nomad_journey_stops WHERE user_id=%s", ("uid1",))
        rows = cur.fetchall()
    assert len(rows) == 1
    assert rows[0][0] == "방콕"
    assert rows[0][1] == "최고!"


def test_journey_stop_note_length_is_limited(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO users (id, email, name, picture, created_at)
            VALUES (%s, %s, %s, %s, NOW()::text)
            """,
            ("uid1", "test@example.com", "Test", "http://img"),
        )
        with pytest.raises(Exception):
            cur.execute(
                """
                INSERT INTO nomad_journey_stops(user_id, city, country, note, lat, lng)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                ("uid1", "방콕", "Thailand", "12345678901", 13.75, 100.5),
            )
    conn.rollback()


def test_required_schema_includes_journey_flag_columns():
    from utils import db

    required = db._REQUIRED_SCHEMA_COLUMNS["nomad_journey_stops"]

    assert "gps_verified" in required
    assert "flag_color" in required
    assert "github_issue_url" in required
    assert "github_issue_key" in required
    assert "github_issue_status" in required


def test_get_conn_returns_same_thread_connection():
    import importlib
    import utils.db as db_mod
    importlib.reload(db_mod)
    c1 = db_mod.get_conn()
    c2 = db_mod.get_conn()
    assert c1 is c2
