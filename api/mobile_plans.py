"""모바일 앱 전용 Plans 라우터."""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field

from utils.db import get_conn
from utils.mobile_auth import require_mobile_auth

router = APIRouter(prefix="/api/mobile", tags=["mobile-plans"])


class MoveCreate(BaseModel):
    title: str
    from_city: str | None = None
    to_city: str | None = None
    checklist: list[str] = Field(default_factory=list)


class MovePatch(BaseModel):
    stage: Literal["planning", "booked", "completed"]


def _get_checklist(cur, plan_id: int) -> list[dict]:
    cur.execute(
        """
        SELECT id, text, is_done, sort_order
        FROM move_checklist_items
        WHERE plan_id = %s
        ORDER BY sort_order ASC
        """,
        (plan_id,),
    )
    return [
        {"id": r[0], "text": r[1], "is_done": r[2], "sort_order": r[3]}
        for r in cur.fetchall()
    ]


@router.get("/moves")
def get_moves(user_id: str = Depends(require_mobile_auth)):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, title, from_city, to_city, stage, created_at
            FROM move_plans
            WHERE user_id = %s
            ORDER BY created_at DESC
            """,
            (user_id,),
        )
        plans = cur.fetchall()

        result = []
        for row in plans:
            result.append(
                {
                    "id": row[0],
                    "title": row[1],
                    "from_city": row[2],
                    "to_city": row[3],
                    "stage": row[4],
                    "created_at": str(row[5]),
                    "checklist": _get_checklist(cur, row[0]),
                }
            )

    return result


@router.post("/moves", status_code=201)
def create_move(body: MoveCreate, user_id: str = Depends(require_mobile_auth)):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO move_plans (user_id, title, from_city, to_city)
            VALUES (%s, %s, %s, %s)
            RETURNING id, title, from_city, to_city, stage, created_at
            """,
            (user_id, body.title, body.from_city, body.to_city),
        )
        row = cur.fetchone()
        plan_id = row[0]

        for idx, text in enumerate(body.checklist):
            cur.execute(
                "INSERT INTO move_checklist_items (plan_id, text, sort_order) VALUES (%s, %s, %s)",
                (plan_id, text, idx),
            )

        checklist = _get_checklist(cur, plan_id)
    conn.commit()

    return {
        "id": row[0],
        "title": row[1],
        "from_city": row[2],
        "to_city": row[3],
        "stage": row[4],
        "created_at": str(row[5]),
        "checklist": checklist,
    }


@router.patch("/moves/{move_id}")
def patch_move(move_id: int, body: MovePatch, user_id: str = Depends(require_mobile_auth)):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE move_plans
            SET stage = %s
            WHERE id = %s AND user_id = %s
            RETURNING id
            """,
            (body.stage, move_id, user_id),
        )
        row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Move plan not found")

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, title, from_city, to_city, stage, created_at
            FROM move_plans
            WHERE id = %s AND user_id = %s
            """,
            (move_id, user_id),
        )
        plan = cur.fetchone()
        checklist = _get_checklist(cur, move_id)

    conn.commit()
    return {
        "id": plan[0],
        "title": plan[1],
        "from_city": plan[2],
        "to_city": plan[3],
        "stage": plan[4],
        "created_at": str(plan[5]),
        "checklist": checklist,
    }


@router.delete("/moves/{move_id}", status_code=204)
def delete_move(move_id: int, user_id: str = Depends(require_mobile_auth)):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM move_plans WHERE id = %s AND user_id = %s RETURNING id",
            (move_id, user_id),
        )
        row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Move plan not found")

    conn.commit()
    return Response(status_code=204)


@router.patch("/moves/{move_id}/items/{item_id}")
def toggle_item(move_id: int, item_id: int, user_id: str = Depends(require_mobile_auth)):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("SELECT 1 FROM move_plans WHERE id = %s AND user_id = %s", (move_id, user_id))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Move plan not found")

        cur.execute(
            """
            UPDATE move_checklist_items
            SET is_done = NOT is_done
            WHERE id = %s AND plan_id = %s
            RETURNING id, text, is_done, sort_order
            """,
            (item_id, move_id),
        )
        row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Checklist item not found")

    conn.commit()
    return {"id": row[0], "text": row[1], "is_done": row[2], "sort_order": row[3]}
