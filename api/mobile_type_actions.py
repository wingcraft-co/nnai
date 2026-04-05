"""모바일 앱 전용 Type Actions 라우터."""
from __future__ import annotations

import json
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field

from utils.db import get_conn
from utils.mobile_auth import require_mobile_auth

router = APIRouter(prefix="/api/mobile/type-actions", tags=["mobile-type-actions"])


class PlannerBoardCreate(BaseModel):
    country: str
    city: str | None = None
    title: str


class PlannerTaskCreate(BaseModel):
    text: str | None = None
    title: str | None = None
    due_date: str | None = None
    sort_order: int = 0


class PlannerTaskPatch(BaseModel):
    text: str | None = None
    title: str | None = None
    due_date: str | None = None
    sort_order: int | None = None
    is_done: bool | None = None


class WandererCondition(BaseModel):
    id: str
    label: str
    is_done: bool = False


class WandererHopCreate(BaseModel):
    to_country: str | None = None
    to_city: str | None = None
    from_country: str | None = None
    target_month: str | None = None
    note: str | None = None
    status: Literal["planned", "booked"] = "planned"
    conditions: list[WandererCondition] = Field(default_factory=list)
    is_focus: bool = False

    # backward-compat fields
    from_city: str | None = None


class WandererHopPatch(BaseModel):
    to_country: str | None = None
    to_city: str | None = None
    from_country: str | None = None
    target_month: str | None = None
    note: str | None = None
    status: Literal["planned", "booked"] | None = None
    conditions: list[WandererCondition] | None = None
    is_focus: bool | None = None


class LocalEventSave(BaseModel):
    source: Literal["google_places", "eventbrite", "ticketmaster"]
    source_event_id: str
    title: str
    venue_name: str | None = None
    address: str | None = None
    country: str | None = None
    city: str | None = None
    starts_at: str | None = None
    ends_at: str | None = None
    lat: float | None = None
    lng: float | None = None
    radius_m: int = 1500
    status: Literal["recommended", "saved", "attended", "hidden"] = "saved"


class LocalEventPatch(BaseModel):
    status: Literal["recommended", "saved", "attended", "hidden"]


class PioneerMilestonePatch(BaseModel):
    status: Literal["todo", "doing", "done", "blocked"] | None = None
    title: str | None = None
    target_date: str | None = None
    note: str | None = None


class FreeSpiritSpinCreate(BaseModel):
    country: str | None = None
    city: str | None = None
    lat: float
    lng: float
    radius_m: int = 1500
    keyword: str | None = None


def _serialize_hop(row: tuple) -> dict:
    return {
        "id": row[0],
        "from_country": row[1],
        "to_country": row[2],
        "to_city": row[3],
        "note": row[4],
        "target_month": row[5],
        "status": row[6],
        "conditions": row[7],
        "is_focus": row[8],
    }


@router.get("/planner/boards")
def get_planner_boards(user_id: str = Depends(require_mobile_auth)):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, country, city, title, created_at, updated_at
            FROM planner_boards
            WHERE user_id = %s
            ORDER BY created_at DESC
            """,
            (user_id,),
        )
        rows = cur.fetchall()
    return [
        {
            "id": r[0],
            "country": r[1],
            "city": r[2],
            "title": r[3],
            "created_at": str(r[4]),
            "updated_at": str(r[5]),
        }
        for r in rows
    ]


@router.post("/planner/boards", status_code=201)
def create_planner_board(body: PlannerBoardCreate, user_id: str = Depends(require_mobile_auth)):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO planner_boards (user_id, country, city, title)
            VALUES (%s, %s, %s, %s)
            RETURNING id, country, city, title, created_at, updated_at
            """,
            (user_id, body.country, body.city, body.title),
        )
        row = cur.fetchone()
    conn.commit()
    return {
        "id": row[0],
        "country": row[1],
        "city": row[2],
        "title": row[3],
        "created_at": str(row[4]),
        "updated_at": str(row[5]),
    }


@router.post("/planner/boards/{board_id}/tasks", status_code=201)
def create_planner_task(board_id: int, body: PlannerTaskCreate, user_id: str = Depends(require_mobile_auth)):
    text = body.text or body.title
    if not text:
        raise HTTPException(status_code=422, detail="text is required")

    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM planner_boards WHERE id = %s AND user_id = %s", (board_id, user_id))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Planner board not found")

        cur.execute(
            """
            INSERT INTO planner_tasks (board_id, user_id, text, title, due_date, sort_order)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id, board_id, text, is_done, due_date, sort_order
            """,
            (board_id, user_id, text, text, body.due_date, body.sort_order),
        )
        row = cur.fetchone()
    conn.commit()
    return {
        "id": row[0],
        "board_id": row[1],
        "text": row[2],
        "is_done": row[3],
        "due_date": row[4],
        "sort_order": row[5],
    }


@router.patch("/planner/tasks/{task_id}")
def patch_planner_task(task_id: int, body: PlannerTaskPatch, user_id: str = Depends(require_mobile_auth)):
    updates = body.model_dump(exclude_unset=True)
    if "title" in updates and "text" not in updates:
        updates["text"] = updates.pop("title")
    updates.pop("title", None)

    if not updates:
        raise HTTPException(status_code=422, detail="At least one field is required")

    if "text" in updates:
        updates["title"] = updates["text"]

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
            RETURNING id, board_id, text, is_done, due_date, sort_order
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
        "text": row[2],
        "is_done": row[3],
        "due_date": row[4],
        "sort_order": row[5],
    }


@router.post("/free-spirit/spins", status_code=201)
def create_free_spirit_spin(body: FreeSpiritSpinCreate, user_id: str = Depends(require_mobile_auth)):
    selected = {
        "place_id": f"spin-{abs(hash((user_id, body.lat, body.lng))) % 1000000}",
        "name": body.city or body.country or "Random nearby pick",
        "lat": body.lat,
        "lng": body.lng,
    }
    candidates_count = 1

    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO free_spirit_spins (user_id, result, selected, candidates_count)
            VALUES (%s, %s, %s::jsonb, %s)
            RETURNING id, selected, candidates_count
            """,
            (user_id, selected["name"], json.dumps(selected), candidates_count),
        )
        row = cur.fetchone()
    conn.commit()
    return {
        "spin_id": row[0],
        "selected": row[1],
        "candidates_count": row[2],
    }


@router.get("/wanderer/hops")
def get_wanderer_hops(user_id: str = Depends(require_mobile_auth)):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id,
                   from_country,
                   COALESCE(to_country, NULLIF(to_city, '')),
                   to_city,
                   note,
                   target_month,
                   status,
                   conditions,
                   is_focus
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
    to_country = body.to_country or body.to_city
    if not to_country:
        raise HTTPException(status_code=422, detail="to_country is required")

    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO wanderer_hops (user_id, from_country, to_country, to_city, note, target_month, status, conditions, is_focus)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s)
            RETURNING id, from_country, to_country, to_city, note, target_month, status, conditions, is_focus
            """,
            (
                user_id,
                body.from_country or body.from_city,
                to_country,
                body.to_city,
                body.note,
                body.target_month,
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
            RETURNING id, from_country, to_country, to_city, note, target_month, status, conditions, is_focus
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
    return Response(status_code=204)


@router.get("/local/events/saved")
def get_saved_local_events(user_id: str = Depends(require_mobile_auth)):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, source, source_event_id, title, venue_name, address, country, city,
                   starts_at, ends_at, lat, lng, radius_m, status, created_at, updated_at
            FROM local_saved_events
            WHERE user_id = %s
            ORDER BY created_at DESC
            """,
            (user_id,),
        )
        rows = cur.fetchall()
    return [
        {
            "id": r[0],
            "source": r[1],
            "source_event_id": r[2],
            "title": r[3],
            "venue_name": r[4],
            "address": r[5],
            "country": r[6],
            "city": r[7],
            "starts_at": r[8],
            "ends_at": r[9],
            "lat": r[10],
            "lng": r[11],
            "radius_m": r[12],
            "status": r[13],
            "created_at": str(r[14]),
            "updated_at": str(r[15]),
        }
        for r in rows
    ]


@router.post("/local/events/save", status_code=201)
def save_local_event(body: LocalEventSave, user_id: str = Depends(require_mobile_auth)):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id FROM local_saved_events
            WHERE user_id = %s AND source = %s AND source_event_id = %s
            """,
            (user_id, body.source, body.source_event_id),
        )
        existing = cur.fetchone()

        if existing:
            cur.execute(
                """
                UPDATE local_saved_events
                SET title = %s, venue_name = %s, address = %s, country = %s, city = %s,
                    starts_at = %s, ends_at = %s, lat = %s, lng = %s, radius_m = %s,
                    status = %s, updated_at = NOW()
                WHERE id = %s AND user_id = %s
                RETURNING id, status
                """,
                (
                    body.title,
                    body.venue_name,
                    body.address,
                    body.country,
                    body.city,
                    body.starts_at,
                    body.ends_at,
                    body.lat,
                    body.lng,
                    body.radius_m,
                    body.status,
                    existing[0],
                    user_id,
                ),
            )
            row = cur.fetchone()
        else:
            cur.execute(
                """
                INSERT INTO local_saved_events
                    (user_id, event_id, source, source_event_id, title, venue_name, address, country, city,
                     starts_at, ends_at, lat, lng, radius_m, status)
                VALUES
                    (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id, status
                """,
                (
                    user_id,
                    body.source_event_id,
                    body.source,
                    body.source_event_id,
                    body.title,
                    body.venue_name,
                    body.address,
                    body.country,
                    body.city,
                    body.starts_at,
                    body.ends_at,
                    body.lat,
                    body.lng,
                    body.radius_m,
                    body.status,
                ),
            )
            row = cur.fetchone()
    conn.commit()
    return {"id": row[0], "status": row[1]}


@router.patch("/local/events/{event_id}")
def patch_local_event(event_id: str, body: LocalEventPatch, user_id: str = Depends(require_mobile_auth)):
    conn = get_conn()
    with conn.cursor() as cur:
        if event_id.isdigit():
            cur.execute(
                """
                UPDATE local_saved_events
                SET status = %s, updated_at = NOW()
                WHERE user_id = %s AND id = %s
                RETURNING id, status
                """,
                (body.status, user_id, int(event_id)),
            )
        else:
            cur.execute(
                """
                UPDATE local_saved_events
                SET status = %s, updated_at = NOW()
                WHERE user_id = %s AND source_event_id = %s
                RETURNING id, status
                """,
                (body.status, user_id, event_id),
            )
        row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Local event not found")
    conn.commit()
    return {"id": row[0], "status": row[1]}


def _ensure_default_milestones(user_id: str):
    defaults = [
        ("global", None, "visa", "Set relocation goal", "todo", None, None),
        ("global", None, "housing", "Prepare visa documents", "todo", None, None),
        ("global", None, "work", "Open local banking plan", "todo", None, None),
    ]
    conn = get_conn()
    with conn.cursor() as cur:
        for country, city, category, title, status, target_date, note in defaults:
            cur.execute(
                """
                INSERT INTO pioneer_milestones (user_id, country, city, category, title, status, target_date, note)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (user_id, title) DO NOTHING
                """,
                (user_id, country, city, category, title, status, target_date, note),
            )
    conn.commit()


@router.get("/pioneer/milestones")
def get_pioneer_milestones(user_id: str = Depends(require_mobile_auth)):
    _ensure_default_milestones(user_id)
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, country, city, category, title, status, target_date, note
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
            "country": r[1],
            "city": r[2],
            "category": r[3],
            "title": r[4],
            "status": r[5],
            "target_date": r[6],
            "note": r[7],
        }
        for r in rows
    ]


@router.patch("/pioneer/milestones/{milestone_id}")
def patch_pioneer_milestone(
    milestone_id: int,
    body: PioneerMilestonePatch,
    user_id: str = Depends(require_mobile_auth),
):
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=422, detail="At least one field is required")

    assignments = ", ".join(f"{k} = %s" for k in updates.keys())
    values = list(updates.values())
    values.extend([milestone_id, user_id])

    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            f"""
            UPDATE pioneer_milestones
            SET {assignments},
                updated_at = NOW()
            WHERE id = %s AND user_id = %s
            RETURNING id, country, city, category, title, status, target_date, note
            """,
            tuple(values),
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Pioneer milestone not found")
    conn.commit()
    return {
        "id": row[0],
        "country": row[1],
        "city": row[2],
        "category": row[3],
        "title": row[4],
        "status": row[5],
        "target_date": row[6],
        "note": row[7],
    }
