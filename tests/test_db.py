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
        cur.execute("DELETE FROM pins")
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
    assert "pins" in tables


def test_insert_and_fetch_pin(conn):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO users VALUES (%s,%s,%s,%s,%s)",
            ("uid1", "test@example.com", "Test", "http://img", "2026-01-01T00:00:00")
        )
        cur.execute(
            "INSERT INTO pins(user_id,city,display,note,lat,lng,user_lat,user_lng,created_at) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)",
            ("uid1", "방콕", "Bangkok, Thailand", "최고!", 13.75, 100.5,
             13.0, 100.0, "2026-01-01T00:00:00")
        )
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT city, note FROM pins WHERE user_id=%s", ("uid1",))
        rows = cur.fetchall()
    assert len(rows) == 1
    assert rows[0][0] == "방콕"
    assert rows[0][1] == "최고!"


def test_get_conn_returns_same_thread_connection():
    import importlib
    import utils.db as db_mod
    importlib.reload(db_mod)
    c1 = db_mod.get_conn()
    c2 = db_mod.get_conn()
    assert c1 is c2
