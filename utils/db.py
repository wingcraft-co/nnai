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
                created_at TEXT
            );
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
