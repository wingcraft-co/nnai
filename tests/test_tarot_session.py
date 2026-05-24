"""타로 세션 저장/조회/reveal 테스트 (PostgreSQL 기반)."""
import os

import pytest

TEST_DB_URL = os.environ.get("TEST_DATABASE_URL")

pytestmark = pytest.mark.skipif(
    not TEST_DB_URL,
    reason="TEST_DATABASE_URL 환경변수가 없으면 스킵"
)


@pytest.fixture(autouse=True)
def _db_env(monkeypatch):
    """tarot_session은 utils.db.get_conn()을 사용하므로 DATABASE_URL을 테스트 DB로 가리킨다."""
    monkeypatch.setenv("DATABASE_URL", TEST_DB_URL)
    from utils.db import init_db
    conn = init_db(TEST_DB_URL)
    conn.close()
    yield
    from utils.db import get_conn
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("DELETE FROM tarot_sessions")
    conn.commit()


def test_create_session_returns_session_id():
    from api.tarot_session import create_session
    cities = [{"city": f"City{i}", "country_id": f"C{i}"} for i in range(5)]
    sid = create_session(cities)
    assert isinstance(sid, str)
    assert len(sid) > 8


def test_get_session_returns_stored_data():
    from api.tarot_session import create_session, get_session
    cities = [{"city": f"City{i}", "country_id": f"C{i}"} for i in range(5)]
    sid = create_session(cities)
    session = get_session(sid)
    assert session is not None
    assert len(session["cities"]) == 5
    assert session["revealed_indices"] is None


def test_reveal_cards_returns_selected_cities():
    from api.tarot_session import create_session, reveal_cards
    cities = [{"city": f"City{i}", "score": i} for i in range(5)]
    sid = create_session(cities)
    revealed = reveal_cards(sid, [0, 2, 4])
    assert len(revealed) == 3
    assert revealed[0]["city"] == "City0"
    assert revealed[1]["city"] == "City2"
    assert revealed[2]["city"] == "City4"


def test_reveal_cards_stores_indices():
    from api.tarot_session import create_session, get_session, reveal_cards
    cities = [{"city": f"City{i}"} for i in range(5)]
    sid = create_session(cities)
    reveal_cards(sid, [1, 3, 4])
    session = get_session(sid)
    assert session["revealed_indices"] == [1, 3, 4]


def test_reveal_cards_rejects_invalid_indices():
    from api.tarot_session import create_session, reveal_cards
    cities = [{"city": f"City{i}"} for i in range(5)]
    sid = create_session(cities)
    with pytest.raises(ValueError):
        reveal_cards(sid, [0, 1, 5])


def test_reveal_cards_rejects_wrong_count():
    from api.tarot_session import create_session, reveal_cards
    cities = [{"city": f"City{i}"} for i in range(5)]
    sid = create_session(cities)
    with pytest.raises(ValueError):
        reveal_cards(sid, [0, 1])


def test_reveal_cards_rejects_double_reveal():
    from api.tarot_session import create_session, reveal_cards
    cities = [{"city": f"City{i}"} for i in range(5)]
    sid = create_session(cities)
    reveal_cards(sid, [0, 1, 2])
    with pytest.raises(ValueError):
        reveal_cards(sid, [0, 1, 2])


def test_get_session_returns_none_for_unknown():
    from api.tarot_session import get_session
    assert get_session("nonexistent") is None


def test_session_persists_across_function_calls():
    """DB 영속성 검증: 함수 호출 사이 in-memory state에 의존하지 않음."""
    from api.tarot_session import create_session, get_session
    cities = [{"city": "Lisbon", "country_id": "PT"}] * 5
    sid = create_session(cities)
    for _ in range(3):
        session = get_session(sid)
        assert session is not None
        assert len(session["cities"]) == 5


def test_expired_sessions_are_cleaned_up_on_create():
    """만료된 세션이 새 create_session 호출 시 정리되는지 검증."""
    from api.tarot_session import create_session
    from utils.db import get_conn
    sid = create_session([{"city": "X"}] * 5)
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE tarot_sessions SET expires_at = NOW() - INTERVAL '1 minute' WHERE session_id = %s",
            (sid,),
        )
    conn.commit()

    create_session([{"city": "Y"}] * 5)

    with conn.cursor() as cur:
        cur.execute("SELECT 1 FROM tarot_sessions WHERE session_id = %s", (sid,))
        assert cur.fetchone() is None


def test_reveal_endpoint_integration():
    """reveal API가 3장의 도시 데이터를 반환하는지 검증."""
    from api.tarot_session import create_session, reveal_cards
    cities = [
        {"city": "Lisbon", "country_id": "PT", "monthly_cost_usd": 1800},
        {"city": "Bangkok", "country_id": "TH", "monthly_cost_usd": 1100},
        {"city": "Medellin", "country_id": "CO", "monthly_cost_usd": 1200},
        {"city": "Tbilisi", "country_id": "GE", "monthly_cost_usd": 900},
        {"city": "Budapest", "country_id": "HU", "monthly_cost_usd": 1500},
    ]
    sid = create_session(cities)
    revealed = reveal_cards(sid, [0, 2, 3])
    assert len(revealed) == 3
    assert revealed[0]["city"] == "Lisbon"
    assert revealed[1]["city"] == "Medellin"
    assert revealed[2]["city"] == "Tbilisi"
