"""모바일 앱 전용 Feed 라우터."""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from utils.db import get_conn
from utils.mobile_auth import require_mobile_auth

router = APIRouter(prefix="/api/mobile", tags=["mobile-feed"])


class PostCreate(BaseModel):
    title: str
    body: str
    tags: list[str] = Field(default_factory=list)
    city: str | None = None


class CommentCreate(BaseModel):
    body: str


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
            SELECT p.id, p.user_id, u.name, u.picture, u.persona_type,
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

    return [
        {
            "id": r[0],
            "user_id": r[1],
            "author": r[2],
            "picture": r[3],
            "author_persona_type": r[4],
            "title": r[5],
            "body": r[6],
            "tags": r[7],
            "city": r[8],
            "likes_count": r[9],
            "created_at": str(r[10]),
            "liked": r[11],
        }
        for r in rows
    ]


@router.post("/posts", status_code=201)
def create_post(body: PostCreate, user_id: str = Depends(require_mobile_auth)):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO posts (user_id, title, body, tags, city)
            VALUES (%s, %s, %s, %s::jsonb, %s)
            RETURNING id
            """,
            (user_id, body.title, body.body, json.dumps(body.tags), body.city),
        )
        post_id = cur.fetchone()[0]

        cur.execute(
            """
            SELECT p.id, p.user_id, u.name, u.picture, u.persona_type,
                   p.title, p.body, p.tags, p.city, p.likes_count, p.created_at
            FROM posts p
            JOIN users u ON u.id = p.user_id
            WHERE p.id = %s
            """,
            (post_id,),
        )
        row = cur.fetchone()
    conn.commit()

    return {
        "id": row[0],
        "user_id": row[1],
        "author": row[2],
        "picture": row[3],
        "author_persona_type": row[4],
        "title": row[5],
        "body": row[6],
        "tags": row[7],
        "city": row[8],
        "likes_count": row[9],
        "created_at": str(row[10]),
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
            SELECT c.id, c.user_id, u.name, u.picture, c.body, c.created_at
            FROM post_comments c
            JOIN users u ON u.id = c.user_id
            WHERE c.post_id = %s
            ORDER BY c.created_at ASC
            """,
            (post_id,),
        )
        rows = cur.fetchall()

    return [
        {
            "id": r[0],
            "user_id": r[1],
            "author": r[2],
            "picture": r[3],
            "body": r[4],
            "created_at": str(r[5]),
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
            SELECT c.id, c.user_id, u.name, u.picture, c.body, c.created_at
            FROM post_comments c
            JOIN users u ON u.id = c.user_id
            WHERE c.id = %s
            """,
            (comment_id,),
        )
        row = cur.fetchone()
    conn.commit()

    return {
        "id": row[0],
        "user_id": row[1],
        "author": row[2],
        "picture": row[3],
        "body": row[4],
        "created_at": str(row[5]),
    }
