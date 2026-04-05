"""모바일 앱 전용 업로드 라우터."""
from __future__ import annotations

import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from utils.mobile_auth import require_mobile_auth

router = APIRouter(prefix="/api/mobile", tags=["mobile-uploads"])

_UPLOAD_DIR = Path("/tmp/nnai-mobile-uploads")
_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/uploads/image")
def upload_image(
    file: UploadFile = File(...),
    user_id: str = Depends(require_mobile_auth),
):
    del user_id  # 인증 목적만 사용

    if not file.filename:
        raise HTTPException(status_code=422, detail="file is required")

    ext = os.path.splitext(file.filename)[1] or ".bin"
    saved_name = f"{uuid.uuid4().hex}{ext}"
    path = _UPLOAD_DIR / saved_name

    data = file.file.read()
    with open(path, "wb") as f:
        f.write(data)

    url = f"/api/mobile/uploads/{saved_name}"
    return {"url": url, "image_url": url}
