"""타로 세션 — 5장 추천 결과의 서버사이드 저장 및 reveal 게이팅.

PostgreSQL `tarot_sessions` 테이블에 저장되어 서버 재배포에도 세션이 유지된다.
세션 TTL은 24시간이며, 새 세션 생성 시 만료된 row를 lazy cleanup한다.
"""
from __future__ import annotations

import logging
import uuid
from typing import Any

from psycopg2.extras import Json

from utils.db import get_conn

logger = logging.getLogger(__name__)

SESSION_TTL_SECONDS = 24 * 60 * 60


def create_session(cities: list[dict]) -> str:
    """5장 도시 데이터를 저장하고 session_id를 반환한다."""
    session_id = uuid.uuid4().hex[:16]
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM tarot_sessions WHERE expires_at < NOW()",
        )
        cur.execute(
            """
            INSERT INTO tarot_sessions (session_id, cities, expires_at)
            VALUES (%s, %s, NOW() + make_interval(secs => %s))
            """,
            (session_id, Json(cities), SESSION_TTL_SECONDS),
        )
    conn.commit()
    logger.info(
        "[tarot_session] created session=%s, cities=%d",
        session_id, len(cities),
    )
    return session_id


def get_session(session_id: str) -> dict[str, Any] | None:
    """세션 데이터를 반환한다. 없거나 만료 시 None."""
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT cities, revealed_indices
            FROM tarot_sessions
            WHERE session_id = %s AND expires_at > NOW()
            """,
            (session_id,),
        )
        row = cur.fetchone()
    if row is None:
        return None
    return {"cities": row[0], "revealed_indices": row[1]}


def reveal_cards(session_id: str, indices: list[int]) -> list[dict]:
    """선택된 3장의 인덱스를 받아 해당 도시 데이터를 반환한다."""
    if len(indices) != 3:
        raise ValueError("Must select exactly 3 cards")

    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT cities, revealed_indices
            FROM tarot_sessions
            WHERE session_id = %s AND expires_at > NOW()
            FOR UPDATE
            """,
            (session_id,),
        )
        row = cur.fetchone()
        if row is None:
            conn.rollback()
            raise ValueError("Session not found")
        cities, revealed_indices = row[0], row[1]
        if revealed_indices is not None:
            conn.rollback()
            raise ValueError("Cards already revealed")
        if any(i < 0 or i >= len(cities) for i in indices):
            conn.rollback()
            raise ValueError("Invalid card index")

        sorted_indices = sorted(indices)
        cur.execute(
            """
            UPDATE tarot_sessions
            SET revealed_indices = %s
            WHERE session_id = %s
            """,
            (Json(sorted_indices), session_id),
        )
    conn.commit()
    return [cities[i] for i in indices]
