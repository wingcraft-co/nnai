"""모바일 앱 전용 Profile 라우터."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from utils.db import get_conn
from utils.mobile_auth import require_mobile_auth

router = APIRouter(prefix="/api/mobile", tags=["mobile-profile"])


@router.get("/profile")
def get_profile(user_id: str = Depends(require_mobile_auth)):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("SELECT id, name, picture, email, persona_type FROM users WHERE id = %s", (user_id,))
        user = cur.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        cur.execute("SELECT badge FROM user_badges WHERE user_id = %s", (user_id,))
        badges = [r[0] for r in cur.fetchall()]

        cur.execute("SELECT COUNT(*) FROM pins WHERE user_id = %s", (user_id,))
        pin_count = int(cur.fetchone()[0])

        cur.execute("SELECT COUNT(*) FROM posts WHERE user_id = %s", (user_id,))
        post_count = int(cur.fetchone()[0])

        cur.execute("SELECT COUNT(*) FROM circle_members WHERE user_id = %s", (user_id,))
        circle_count = int(cur.fetchone()[0])

    return {
        "uid": user[0],
        "name": user[1],
        "picture": user[2],
        "email": user[3],
        "persona_type": user[4],
        "badges": badges,
        "stats": {
            "pins": pin_count,
            "posts": post_count,
            "circles": circle_count,
        },
    }
