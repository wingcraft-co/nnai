"""FastAPI + Gradio 통합 서버."""
from __future__ import annotations
import os
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, HTMLResponse
from starlette.middleware.base import BaseHTTPMiddleware
import gradio as gr

from pydantic import BaseModel
from api.auth import router as auth_router, extract_user_id
from api.pins import router as pins_router
from utils.db import init_db

# DB 초기화 (앱 시작 시 1회)
init_db()

# FastAPI 앱
app = FastAPI(title="NomadNavigator API")

# CORS — Vercel 프론트엔드에서 백엔드 API 호출 허용
_ALLOWED_ORIGINS = [
    "https://nnai.app",
    "https://www.nnai.app",
    os.getenv("FRONTEND_URL", ""),       # Vercel 프리뷰 배포용
    "http://localhost:3000",              # 로컬 개발
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in _ALLOWED_ORIGINS if o],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


_ADS_TXT_CONTENT = "google.com, pub-8452594011595682, DIRECT, f08c47fec0942fa0"

_PRIVACY_HTML = """<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>개인정보처리방침 — NomadNavigator AI</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
         max-width: 800px; margin: 0 auto; padding: 40px 20px;
         color: #333; line-height: 1.7; }
  h1 { font-size: 1.8rem; margin-bottom: 8px; }
  h2 { font-size: 1.2rem; margin-top: 32px; color: #111; }
  p, li { font-size: 0.95rem; color: #555; }
  a { color: #2563EB; }
  .updated { font-size: 0.85rem; color: #888; margin-bottom: 32px; }
</style>
</head>
<body>
<h1>개인정보처리방침</h1>
<p class="updated">최종 수정일: 2026년 3월 28일</p>

<p>NomadNavigator AI(이하 "서비스", nnai.app)는 이용자의 개인정보를 소중히 여기며,
관련 법령을 준수합니다.</p>

<h2>1. 수집하는 정보</h2>
<ul>
  <li>Google 로그인 시: 이름, 이메일 주소, 프로필 사진 (Google OAuth 제공 정보)</li>
  <li>서비스 이용 정보: 입력한 국적, 소득, 라이프스타일 등 추천 조건</li>
  <li>자동 수집: 접속 IP, 브라우저 종류, 방문 시각 (서버 로그)</li>
</ul>

<h2>2. 수집 목적</h2>
<ul>
  <li>AI 도시 추천 서비스 제공</li>
  <li>핀(즐겨찾기) 저장 기능 제공</li>
  <li>서비스 품질 개선 및 오류 분석</li>
</ul>

<h2>3. 제3자 제공</h2>
<p>수집한 개인정보는 원칙적으로 제3자에게 제공하지 않습니다.
단, Google AdSense를 통한 광고 게재 시 Google의 개인정보처리방침이 적용될 수 있습니다.</p>

<h2>4. 광고 및 쿠키</h2>
<p>본 서비스는 Google AdSense를 사용하며, 광고 제공을 위해 쿠키를 사용할 수 있습니다.
Google의 광고 개인정보 설정은
<a href="https://adssettings.google.com" target="_blank">adssettings.google.com</a>에서 관리하실 수 있습니다.</p>

<h2>5. 보유 및 파기</h2>
<p>회원 탈퇴 요청 시 또는 서비스 종료 시 즉시 파기합니다.
서버 로그는 최대 30일 보관 후 자동 삭제됩니다.</p>

<h2>6. 이용자 권리</h2>
<p>개인정보 열람·수정·삭제를 요청하시려면 아래 이메일로 문의해주세요.</p>

<h2>7. 문의</h2>
<p>이메일: <a href="mailto:nnai.support@gmail.com">nnai.support@gmail.com</a></p>
</body>
</html>"""


class AuthMiddleware(BaseHTTPMiddleware):
    """쿠키에서 user_id를 꺼내 request.state.user_id에 주입."""
    async def dispatch(self, request: Request, call_next):
        if request.url.path == "/ads.txt":
            return PlainTextResponse(_ADS_TXT_CONTENT)
        if request.url.path in ("/privacy", "/privacy-policy"):
            return HTMLResponse(_PRIVACY_HTML)
        request.state.user_id = extract_user_id(request)
        return await call_next(request)


app.add_middleware(AuthMiddleware)
app.include_router(auth_router)
app.include_router(pins_router, prefix="/api")


# ── Frontend API Endpoints ─────────────────────────────────────


class RecommendRequest(BaseModel):
    nationality: str
    income_krw: int
    immigration_purpose: str
    lifestyle: list[str]
    languages: list[str]
    timeline: str
    preferred_countries: list[str] = []
    preferred_language: str = "한국어"
    persona_type: str = ""
    income_type: str = ""
    travel_type: str = "혼자 (솔로)"
    children_ages: list[str] | None = None
    dual_nationality: bool = False
    readiness_stage: str = ""
    has_spouse_income: str = "없음"
    spouse_income_krw: int = 0


class DetailRequest(BaseModel):
    parsed_data: dict
    city_index: int = 0


@app.post("/api/recommend")
async def api_recommend(req: RecommendRequest):
    from app import nomad_advisor
    markdown, cities, parsed = nomad_advisor(
        nationality=req.nationality,
        income_krw=req.income_krw,
        immigration_purpose=req.immigration_purpose,
        lifestyle=req.lifestyle,
        languages=req.languages,
        timeline=req.timeline,
        preferred_countries=req.preferred_countries,
        preferred_language=req.preferred_language,
        persona_type=req.persona_type,
        income_type=req.income_type,
        travel_type=req.travel_type,
        children_ages=req.children_ages,
        dual_nationality=req.dual_nationality,
        readiness_stage=req.readiness_stage,
        has_spouse_income=req.has_spouse_income,
        spouse_income_krw=req.spouse_income_krw,
    )
    return {"markdown": markdown, "cities": cities, "parsed": parsed}


@app.post("/api/detail")
async def api_detail(req: DetailRequest):
    from app import show_city_detail_with_nationality
    markdown = show_city_detail_with_nationality(
        parsed_data=req.parsed_data,
        city_index=req.city_index,
    )
    return {"markdown": markdown}


# ── Gradio demo ────────────────────────────────────────────────

# Gradio demo 임포트 (app.py에서 demo 객체만 꺼냄)
def _build_gradio():
    from app import nomad_advisor, show_city_detail_with_nationality
    from ui.layout import create_layout
    return create_layout(nomad_advisor, show_city_detail_with_nationality)


demo = _build_gradio()
gr.mount_gradio_app(app, demo, path="/")


# 직접 실행 시 uvicorn
if __name__ == "__main__":
    import uvicorn
    _is_hf = bool(os.getenv("SPACE_ID"))
    _is_railway = bool(os.getenv("RAILWAY_ENVIRONMENT"))
    _is_cloud = _is_hf or _is_railway
    uvicorn.run(
        "server:app",
        host="0.0.0.0" if _is_cloud else "127.0.0.1",
        port=int(os.getenv("PORT", 7860)),
        reload=not _is_cloud,
    )
