"""모바일 앱 전용 Profile 라우터."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from utils.db import get_conn, get_user_identity
from utils.mobile_auth import require_mobile_auth
from utils.persona import resolve_character

router = APIRouter(prefix="/api/mobile", tags=["mobile-profile"])


@router.get("/profile")
def get_profile(user_id: str = Depends(require_mobile_auth)):
    identity = get_user_identity(user_id)
    if not identity:
        raise HTTPException(status_code=404, detail="User not found")

    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("SELECT badge FROM user_badges WHERE user_id = %s", (user_id,))
        badges = [r[0] for r in cur.fetchall()]

        cur.execute("SELECT COUNT(*) FROM nomad_journey_stops WHERE user_id = %s", (user_id,))
        journey_stop_count = int(cur.fetchone()[0])

        cur.execute("SELECT COUNT(*) FROM posts WHERE user_id = %s", (user_id,))
        post_count = int(cur.fetchone()[0])

        cur.execute("SELECT COUNT(*) FROM circle_members WHERE user_id = %s", (user_id,))
        circle_count = int(cur.fetchone()[0])

    return {
        "uid": identity["id"],
        "name": identity["name"],
        "picture": identity["picture"],
        "email": identity["email"],
        "persona_type": identity["persona_type"],
        "character": resolve_character(identity["persona_type"]),
        "badges": badges,
        "stats": {
            "journey_stops": journey_stop_count,
            "posts": post_count,
            "circles": circle_count,
        },
    }
