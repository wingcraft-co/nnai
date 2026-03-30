"""방문자 카운터 FastAPI 라우터."""
from __future__ import annotations
from datetime import datetime, timezone
from fastapi import APIRouter
from pydantic import BaseModel
from utils.db import get_conn

router = APIRouter()


class PingRequest(BaseModel):
    path: str = "/dev"


@router.post("/visits/ping")
def ping(req: PingRequest):
    """방문 시 해당 경로의 카운트를 1 증가시킨다."""
    now = datetime.now(timezone.utc).isoformat()
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO visits (path, count, updated_at)
            VALUES (%s, 1, %s)
            ON CONFLICT (path) DO UPDATE
                SET count = visits.count + 1,
                    updated_at = EXCLUDED.updated_at
            RETURNING count
            """,
            (req.path, now),
        )
        count = cur.fetchone()[0]
    conn.commit()
    return {"path": req.path, "count": count}


@router.get("/visits")
def get_visits(path: str = "/dev"):
    """경로별 누적 방문자 수를 반환한다."""
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            "SELECT count FROM visits WHERE path = %s",
            (path,),
        )
        row = cur.fetchone()
    return {"path": path, "count": int(row[0]) if row else 0}
