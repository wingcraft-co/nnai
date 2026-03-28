"""FastAPI + Gradio 통합 서버."""
from __future__ import annotations
import os
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Request
from starlette.middleware.base import BaseHTTPMiddleware
import gradio as gr

from api.auth import router as auth_router, extract_user_id
from api.pins import router as pins_router
from utils.db import init_db

# DB 초기화 (앱 시작 시 1회)
init_db()

# FastAPI 앱
app = FastAPI(title="NomadNavigator API")


class AuthMiddleware(BaseHTTPMiddleware):
    """쿠키에서 user_id를 꺼내 request.state.user_id에 주입."""
    async def dispatch(self, request: Request, call_next):
        request.state.user_id = extract_user_id(request)
        return await call_next(request)


app.add_middleware(AuthMiddleware)
app.include_router(auth_router)
app.include_router(pins_router, prefix="/api")


# Gradio demo 임포트 (app.py에서 demo 객체만 꺼냄)
def _build_gradio():
    from app import nomad_advisor, show_city_detail
    from ui.layout import create_layout
    return create_layout(nomad_advisor, show_city_detail)


demo = _build_gradio()
gr.mount_gradio_app(app, demo, path="/")


# 직접 실행 시 uvicorn
if __name__ == "__main__":
    import uvicorn
    _is_hf = bool(os.getenv("SPACE_ID"))
    uvicorn.run(
        "server:app",
        host="0.0.0.0" if _is_hf else "127.0.0.1",
        port=7860,
        reload=not _is_hf,
    )
