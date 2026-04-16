"""모바일 앱 전용 Feed 라우터."""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from utils.db import get_conn, get_user_identity
from utils.mobile_auth import require_mobile_auth

router = APIRouter(prefix="/api/mobile", tags=["mobile-feed"])


class PostCreate(BaseModel):
    title: str
    body: str
    tags: list[str] = Field(default_factory=list)
    city: str | None = None
    image_url: str | None = None
    picture: str | None = None


class CommentCreate(BaseModel):
    body: str


def _identity_names(user_ids: list[str]) -> dict[str, str | None]:
    names: dict[str, str | None] = {}
    for user_id in dict.fromkeys(user_ids):
        identity = get_user_identity(user_id)
        names[user_id] = identity["name"] if identity else None
    return names


@router.get("/posts")
def get_posts(
    limit: int = 20,
    offset: int = 0,
    user_id: str = Depends(require_mobile_auth),
):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT p.id, p.user_id, COALESCE(p.image_url, u.picture) AS picture, u.persona_type,
                   p.title, p.body, p.tags, p.city, p.likes_count, p.created_at,
                   EXISTS(
                       SELECT 1 FROM post_likes
                       WHERE post_id = p.id AND user_id = %s
                   ) AS liked
            FROM posts p
            JOIN users u ON u.id = p.user_id
            ORDER BY p.created_at DESC
            LIMIT %s OFFSET %s
            """,
            (user_id, limit, offset),
        )
        rows = cur.fetchall()
    author_names = _identity_names([r[1] for r in rows])

    return [
        {
            "id": r[0],
            "user_id": r[1],
            "author": author_names.get(r[1]),
            "picture": r[2],
            "author_persona_type": r[3],
            "title": r[4],
            "body": r[5],
            "tags": r[6],
            "city": r[7],
            "likes_count": r[8],
            "created_at": str(r[9]),
            "liked": r[10],
        }
        for r in rows
    ]


@router.post("/posts", status_code=201)
def create_post(body: PostCreate, user_id: str = Depends(require_mobile_auth)):
    image_url = body.image_url or body.picture
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO posts (user_id, title, body, tags, city, image_url)
            VALUES (%s, %s, %s, %s::jsonb, %s, %s)
            RETURNING id
            """,
            (user_id, body.title, body.body, json.dumps(body.tags), body.city, image_url),
        )
        post_id = cur.fetchone()[0]

        cur.execute(
            """
            SELECT p.id, p.user_id, COALESCE(p.image_url, u.picture) AS picture, u.persona_type,
                   p.title, p.body, p.tags, p.city, p.likes_count, p.created_at
            FROM posts p
            JOIN users u ON u.id = p.user_id
            WHERE p.id = %s
            """,
            (post_id,),
        )
        row = cur.fetchone()
    conn.commit()
    identity = get_user_identity(row[1])

    return {
        "id": row[0],
        "user_id": row[1],
        "author": identity["name"] if identity else None,
        "picture": row[2],
        "author_persona_type": row[3],
        "title": row[4],
        "body": row[5],
        "tags": row[6],
        "city": row[7],
        "likes_count": row[8],
        "created_at": str(row[9]),
        "liked": False,
    }


@router.post("/posts/{post_id}/like")
def toggle_like(post_id: int, user_id: str = Depends(require_mobile_auth)):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM posts WHERE id = %s", (post_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Post not found")

        cur.execute(
            "SELECT 1 FROM post_likes WHERE post_id = %s AND user_id = %s",
            (post_id, user_id),
        )
        already_liked = cur.fetchone() is not None

        if already_liked:
            cur.execute(
                "DELETE FROM post_likes WHERE post_id = %s AND user_id = %s",
                (post_id, user_id),
            )
            cur.execute(
                "UPDATE posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = %s",
                (post_id,),
            )
        else:
            cur.execute(
                "INSERT INTO post_likes (post_id, user_id) VALUES (%s, %s)",
                (post_id, user_id),
            )
            cur.execute(
                "UPDATE posts SET likes_count = likes_count + 1 WHERE id = %s",
                (post_id,),
            )
    conn.commit()

    return {"liked": not already_liked}


@router.get("/posts/{post_id}/comments")
def get_comments(post_id: int, user_id: str = Depends(require_mobile_auth)):
    del user_id  # 인증 목적만 사용
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM posts WHERE id = %s", (post_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Post not found")

        cur.execute(
            """
            SELECT c.id, c.user_id, u.picture, c.body, c.created_at
            FROM post_comments c
            JOIN users u ON u.id = c.user_id
            WHERE c.post_id = %s
            ORDER BY c.created_at ASC
            """,
            (post_id,),
        )
        rows = cur.fetchall()
    author_names = _identity_names([r[1] for r in rows])

    return [
        {
            "id": r[0],
            "user_id": r[1],
            "author": author_names.get(r[1]),
            "picture": r[2],
            "body": r[3],
            "created_at": str(r[4]),
        }
        for r in rows
    ]


@router.post("/posts/{post_id}/comments", status_code=201)
def create_comment(post_id: int, body: CommentCreate, user_id: str = Depends(require_mobile_auth)):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM posts WHERE id = %s", (post_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Post not found")

        cur.execute(
            """
            INSERT INTO post_comments (post_id, user_id, body)
            VALUES (%s, %s, %s)
            RETURNING id
            """,
            (post_id, user_id, body.body),
        )
        comment_id = cur.fetchone()[0]

        cur.execute(
            """
            SELECT c.id, c.user_id, u.picture, c.body, c.created_at
            FROM post_comments c
            JOIN users u ON u.id = c.user_id
            WHERE c.id = %s
            """,
            (comment_id,),
        )
        row = cur.fetchone()
    conn.commit()
    identity = get_user_identity(row[1])

    return {
        "id": row[0],
        "user_id": row[1],
        "author": identity["name"] if identity else None,
        "picture": row[2],
        "body": row[3],
        "created_at": str(row[4]),
    }
