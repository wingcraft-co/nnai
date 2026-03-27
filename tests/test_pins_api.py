import os, pytest
os.environ["NNAI_DB_PATH"] = ":memory:"

from fastapi.testclient import TestClient
from fastapi import FastAPI
from utils.db import init_db

# 테스트용 앱 — auth 미들웨어 없이 직접 user_id 주입
def _make_app(user_id: str | None):
    from api.pins import router, SESSION_KEY
    from starlette.middleware.base import BaseHTTPMiddleware

    app = FastAPI()

    class FakeAuth(BaseHTTPMiddleware):
        async def dispatch(self, request, call_next):
            request.state.user_id = user_id
            return await call_next(request)

    app.add_middleware(FakeAuth)
    app.include_router(router, prefix="/api")
    # 각 테스트가 새 인메모리 DB 사용
    from utils import db as db_mod
    db_mod._conn = init_db(":memory:")
    return app

def test_get_pins_empty_returns_list():
    client = TestClient(_make_app("uid1"))
    r = client.get("/api/pins")
    assert r.status_code == 200
    assert r.json() == []

def test_post_pin_saves_and_returns():
    client = TestClient(_make_app("uid1"))
    payload = {
        "city": "방콕", "display": "Bangkok, Thailand",
        "note": "좋아요", "lat": 13.75, "lng": 100.5,
        "user_lat": 13.0, "user_lng": 100.0
    }
    r = client.post("/api/pins", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert data["city"] == "방콕"
    assert "id" in data

def test_post_pin_requires_auth():
    client = TestClient(_make_app(None))
    r = client.post("/api/pins", json={
        "city":"x","display":"x","note":"x","lat":0,"lng":0
    })
    assert r.status_code == 401

def test_get_pins_returns_saved_pins():
    client = TestClient(_make_app("uid1"))
    client.post("/api/pins", json={
        "city":"서울","display":"Seoul, Korea","note":"홈",
        "lat":37.56,"lng":126.97,"user_lat":37.5,"user_lng":126.9
    })
    r = client.get("/api/pins")
    assert r.status_code == 200
    pins = r.json()
    assert len(pins) == 1
    assert pins[0]["city"] == "서울"

def test_get_community_pins():
    client = TestClient(_make_app("uid1"))
    client.post("/api/pins", json={
        "city":"발리","display":"Bali, Indonesia","note":"x",
        "lat":-8.34,"lng":115.09,"user_lat":None,"user_lng":None
    })
    r = client.get("/api/pins/community")
    assert r.status_code == 200
    data = r.json()
    assert any(p["city"] == "발리" for p in data)
