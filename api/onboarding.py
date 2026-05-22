"""Onboarding draft persistence API."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from utils.db import get_onboarding_draft, upsert_onboarding_draft

router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])


class OnboardingDraftRequest(BaseModel):
    form_draft: dict[str, Any] | None = Field(default=None)
    quiz_draft: dict[str, Any] | None = Field(default=None)


def _require_user_id(request: Request) -> str:
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Login required.")
    return user_id


@router.get("/draft")
def read_onboarding_draft(request: Request):
    user_id = _require_user_id(request)
    return get_onboarding_draft(user_id)


@router.put("/draft")
def save_onboarding_draft(body: OnboardingDraftRequest, request: Request):
    user_id = _require_user_id(request)
    current = get_onboarding_draft(user_id)
    fields = body.model_fields_set
    form_draft = body.form_draft if "form_draft" in fields else current["form_draft"]
    quiz_draft = body.quiz_draft if "quiz_draft" in fields else current["quiz_draft"]
    return upsert_onboarding_draft(
        user_id=user_id,
        form_draft=form_draft,
        quiz_draft=quiz_draft,
    )
