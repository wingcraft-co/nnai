"""모바일 앱 전용 Type Actions 라우터."""
from __future__ import annotations

import json
import random
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from utils.db import get_conn
from utils.mobile_auth import require_mobile_auth

router = APIRouter(prefix="/api/mobile/type-actions", tags=["mobile-type-actions"])


class PlannerBoardCreate(BaseModel):
    title: str


class PlannerTaskCreate(BaseModel):
    title: str


class PlannerTaskPatch(BaseModel):
    title: str | None = None
    is_done: bool | None = None


class WandererCondition(BaseModel):
    id: str
    label: str
    is_done: bool = False


class WandererHopCreate(BaseModel):
    from_city: str | None = None
    to_city: str | None = None
    status: Literal["planned", "booked"] = "planned"
    conditions: list[WandererCondition] = Field(default_factory=list)
    is_focus: bool = False


class WandererHopPatch(BaseModel):
    from_city: str | None = None
    to_city: str | None = None
    status: Literal["planned", "booked"] | None = None
    conditions: list[WandererCondition] | None = None
    is_focus: bool | None = None


class LocalEventSave(BaseModel):
    event_id: str
    title: str | None = None


class LocalEventPatch(BaseModel):
    title: str | None = None
    status: str | None = None


class PioneerMilestonePatch(BaseModel):
    is_done: bool


def _serialize_hop(row: tuple) -> dict:
    return {
        "id": row[0],
        "from_city": row[1],
        "to_city": row[2],
        "status": row[3],
        "conditions": row[4],
        "is_focus": row[5],
        "created_at": str(row[6]),
        "updated_at": str(row[7]),
    }


@router.get("/planner/boards")
def get_planner_boards(user_id: str = Depends(require_mobile_auth)):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, title, created_at, updated_at
            FROM planner_boards
            WHERE user_id = %s
            ORDER BY created_at DESC
            """,
            (user_id,),
        )
        rows = cur.fetchall()
    return [{"id": r[0], "title": r[1], "created_at": str(r[2]), "updated_at": str(r[3])} for r in rows]


@router.post("/planner/boards", status_code=201)
def create_planner_board(body: PlannerBoardCreate, user_id: str = Depends(require_mobile_auth)):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO planner_boards (user_id, title)
            VALUES (%s, %s)
            RETURNING id, title, created_at, updated_at
            """,
            (user_id, body.title),
        )
        row = cur.fetchone()
    conn.commit()
    return {"id": row[0], "title": row[1], "created_at": str(row[2]), "updated_at": str(row[3])}


@router.post("/planner/boards/{board_id}/tasks", status_code=201)
def create_planner_task(board_id: int, body: PlannerTaskCreate, user_id: str = Depends(require_mobile_auth)):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM planner_boards WHERE id = %s AND user_id = %s", (board_id, user_id))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Planner board not found")

        cur.execute(
            """
            INSERT INTO planner_tasks (board_id, user_id, title)
            VALUES (%s, %s, %s)
            RETURNING id, board_id, title, is_done, created_at, updated_at
            """,
            (board_id, user_id, body.title),
        )
        row = cur.fetchone()
    conn.commit()
    return {
        "id": row[0],
        "board_id": row[1],
        "title": row[2],
        "is_done": row[3],
        "created_at": str(row[4]),
        "updated_at": str(row[5]),
    }


@router.patch("/planner/tasks/{task_id}")
def patch_planner_task(task_id: int, body: PlannerTaskPatch, user_id: str = Depends(require_mobile_auth)):
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=422, detail="At least one field is required")

    assignments = ", ".join(f"{k} = %s" for k in updates.keys())
    values = list(updates.values())
    values.extend([user_id, task_id])

    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            f"""
            UPDATE planner_tasks
            SET {assignments},
                updated_at = NOW()
            WHERE user_id = %s AND id = %s
            RETURNING id, board_id, title, is_done, created_at, updated_at
            """,
            tuple(values),
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Planner task not found")
    conn.commit()
    return {
        "id": row[0],
        "board_id": row[1],
        "title": row[2],
        "is_done": row[3],
        "created_at": str(row[4]),
        "updated_at": str(row[5]),
    }


@router.post("/free-spirit/spins", status_code=201)
def create_free_spirit_spin(user_id: str = Depends(require_mobile_auth)):
    result = random.choice(["city_shuffle", "new_circle", "surprise_route"])
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO free_spirit_spins (user_id, result)
            VALUES (%s, %s)
            RETURNING id, result, created_at
            """,
            (user_id, result),
        )
        row = cur.fetchone()
    conn.commit()
    return {"id": row[0], "result": row[1], "created_at": str(row[2])}


@router.get("/wanderer/hops")
def get_wanderer_hops(user_id: str = Depends(require_mobile_auth)):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, from_city, to_city, status, conditions, is_focus, created_at, updated_at
            FROM wanderer_hops
            WHERE user_id = %s
            ORDER BY created_at DESC
            """,
            (user_id,),
        )
        rows = cur.fetchall()
    return [_serialize_hop(r) for r in rows]


@router.post("/wanderer/hops", status_code=201)
def create_wanderer_hop(body: WandererHopCreate, user_id: str = Depends(require_mobile_auth)):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO wanderer_hops (user_id, from_city, to_city, status, conditions, is_focus)
            VALUES (%s, %s, %s, %s, %s::jsonb, %s)
            RETURNING id, from_city, to_city, status, conditions, is_focus, created_at, updated_at
            """,
            (
                user_id,
                body.from_city,
                body.to_city,
                body.status,
                json.dumps([c.model_dump() for c in body.conditions]),
                body.is_focus,
            ),
        )
        row = cur.fetchone()
    conn.commit()
    return _serialize_hop(row)


@router.patch("/wanderer/hops/{hop_id}")
def patch_wanderer_hop(hop_id: int, body: WandererHopPatch, user_id: str = Depends(require_mobile_auth)):
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=422, detail="At least one field is required")

    if "conditions" in updates and updates["conditions"] is not None:
        updates["conditions"] = json.dumps([c.model_dump() for c in updates["conditions"]])

    assignments = []
    values = []
    for key, value in updates.items():
        if key == "conditions":
            assignments.append("conditions = %s::jsonb")
        else:
            assignments.append(f"{key} = %s")
        values.append(value)

    values.extend([user_id, hop_id])

    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            f"""
            UPDATE wanderer_hops
            SET {', '.join(assignments)},
                updated_at = NOW()
            WHERE user_id = %s AND id = %s
            RETURNING id, from_city, to_city, status, conditions, is_focus, created_at, updated_at
            """,
            tuple(values),
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Wanderer hop not found")
    conn.commit()
    return _serialize_hop(row)


@router.delete("/wanderer/hops/{hop_id}", status_code=204)
def delete_wanderer_hop(hop_id: int, user_id: str = Depends(require_mobile_auth)):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM wanderer_hops WHERE id = %s AND user_id = %s RETURNING id",
            (hop_id, user_id),
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Wanderer hop not found")
    conn.commit()
    return None


@router.get("/local/events/saved")
def get_saved_local_events(user_id: str = Depends(require_mobile_auth)):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT event_id, title, status, created_at, updated_at
            FROM local_saved_events
            WHERE user_id = %s
            ORDER BY created_at DESC
            """,
            (user_id,),
        )
        rows = cur.fetchall()
    return [
        {
            "event_id": r[0],
            "title": r[1],
            "status": r[2],
            "created_at": str(r[3]),
            "updated_at": str(r[4]),
        }
        for r in rows
    ]


@router.post("/local/events/save", status_code=201)
def save_local_event(body: LocalEventSave, user_id: str = Depends(require_mobile_auth)):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO local_saved_events (user_id, event_id, title)
            VALUES (%s, %s, %s)
            ON CONFLICT (user_id, event_id)
            DO UPDATE SET
                title = EXCLUDED.title,
                updated_at = NOW()
            RETURNING event_id, title, status, created_at, updated_at
            """,
            (user_id, body.event_id, body.title),
        )
        row = cur.fetchone()
    conn.commit()
    return {
        "event_id": row[0],
        "title": row[1],
        "status": row[2],
        "created_at": str(row[3]),
        "updated_at": str(row[4]),
    }


@router.patch("/local/events/{event_id}")
def patch_local_event(event_id: str, body: LocalEventPatch, user_id: str = Depends(require_mobile_auth)):
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=422, detail="At least one field is required")

    assignments = ", ".join(f"{k} = %s" for k in updates.keys())
    values = list(updates.values())
    values.extend([user_id, event_id])

    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            f"""
            UPDATE local_saved_events
            SET {assignments},
                updated_at = NOW()
            WHERE user_id = %s AND event_id = %s
            RETURNING event_id, title, status, created_at, updated_at
            """,
            tuple(values),
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Local event not found")
    conn.commit()
    return {
        "event_id": row[0],
        "title": row[1],
        "status": row[2],
        "created_at": str(row[3]),
        "updated_at": str(row[4]),
    }


def _ensure_default_milestones(user_id: str):
    defaults = [
        "Set relocation goal",
        "Prepare visa documents",
        "Open local banking plan",
    ]
    conn = get_conn()
    with conn.cursor() as cur:
        for title in defaults:
            cur.execute(
                """
                INSERT INTO pioneer_milestones (user_id, title)
                VALUES (%s, %s)
                ON CONFLICT (user_id, title) DO NOTHING
                """,
                (user_id, title),
            )
    conn.commit()


@router.get("/pioneer/milestones")
def get_pioneer_milestones(user_id: str = Depends(require_mobile_auth)):
    _ensure_default_milestones(user_id)
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, title, is_done, created_at, updated_at
            FROM pioneer_milestones
            WHERE user_id = %s
            ORDER BY id ASC
            """,
            (user_id,),
        )
        rows = cur.fetchall()
    return [
        {
            "id": r[0],
            "title": r[1],
            "is_done": r[2],
            "created_at": str(r[3]),
            "updated_at": str(r[4]),
        }
        for r in rows
    ]


@router.patch("/pioneer/milestones/{milestone_id}")
def patch_pioneer_milestone(
    milestone_id: int,
    body: PioneerMilestonePatch,
    user_id: str = Depends(require_mobile_auth),
):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE pioneer_milestones
            SET is_done = %s,
                updated_at = NOW()
            WHERE id = %s AND user_id = %s
            RETURNING id, title, is_done, created_at, updated_at
            """,
            (body.is_done, milestone_id, user_id),
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Pioneer milestone not found")
    conn.commit()
    return {
        "id": row[0],
        "title": row[1],
        "is_done": row[2],
        "created_at": str(row[3]),
        "updated_at": str(row[4]),
    }
