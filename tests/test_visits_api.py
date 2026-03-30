import os
import pytest

TEST_DB_URL = os.environ.get("TEST_DATABASE_URL")

pytestmark = pytest.mark.skipif(
    not TEST_DB_URL,
    reason="TEST_DATABASE_URL 환경변수가 없으면 스킵"
)

from fastapi import FastAPI
from fastapi.testclient import TestClient
from utils.db import init_db


def _make_app():
    from api.visits import router
    import utils.db as db_mod

    app = FastAPI()
    app.include_router(router, prefix="/api")

    db_mod._conn = init_db(TEST_DB_URL)
    with db_mod._conn.cursor() as cur:
        cur.execute("DELETE FROM visits")
    db_mod._conn.commit()
    return app


def test_get_visits_returns_zero_for_unknown_path():
    """방문 기록 없는 경로는 count=0을 반환한다."""
    client = TestClient(_make_app())
    r = client.get("/api/visits", params={"path": "/unknown"})
    assert r.status_code == 200
    assert r.json()["count"] == 0


def test_ping_increments_count():
    """ping 호출 시 count가 1 증가한다."""
    client = TestClient(_make_app())
    r = client.post("/api/visits/ping", json={"path": "/dev"})
    assert r.status_code == 200
    assert r.json()["count"] == 1


def test_ping_multiple_times_accumulates():
    """ping을 여러 번 호출하면 누적 집계된다."""
    client = TestClient(_make_app())
    for _ in range(5):
        client.post("/api/visits/ping", json={"path": "/dev"})
    r = client.get("/api/visits", params={"path": "/dev"})
    assert r.json()["count"] == 5


def test_get_visits_returns_correct_count_after_ping():
    """ping 후 GET 조회 시 동일한 count를 반환한다."""
    client = TestClient(_make_app())
    ping_res = client.post("/api/visits/ping", json={"path": "/dev"})
    get_res = client.get("/api/visits", params={"path": "/dev"})
    assert ping_res.json()["count"] == get_res.json()["count"]


def test_ping_default_path_is_dev():
    """path 미전달 시 기본 경로 /dev 로 집계된다."""
    client = TestClient(_make_app())
    r = client.post("/api/visits/ping", json={})
    assert r.status_code == 200
    assert r.json()["path"] == "/dev"


def test_different_paths_tracked_independently():
    """서로 다른 경로는 독립적으로 집계된다."""
    client = TestClient(_make_app())
    client.post("/api/visits/ping", json={"path": "/dev"})
    client.post("/api/visits/ping", json={"path": "/dev"})
    client.post("/api/visits/ping", json={"path": "/other"})

    dev = client.get("/api/visits", params={"path": "/dev"}).json()["count"]
    other = client.get("/api/visits", params={"path": "/other"}).json()["count"]
    assert dev == 2
    assert other == 1
