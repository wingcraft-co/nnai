from __future__ import annotations

import utils.db as db_mod


class _CursorStub:
    def __init__(self, count: int):
        self.count = count
        self.executed: list[tuple[str, tuple | None]] = []

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, query: str, params=None):
        self.executed.append((query, params))

    def fetchone(self):
        return (self.count,)


class _ConnStub:
    def __init__(self, count: int):
        self.cursor_stub = _CursorStub(count)
        self.committed = False
        self.rolled_back = False

    def cursor(self):
        return self.cursor_stub

    def commit(self):
        self.committed = True

    def rollback(self):
        self.rolled_back = True


def test_consume_rate_limit_token_inserts_when_under_limit(monkeypatch):
    conn = _ConnStub(count=2)
    monkeypatch.setattr(db_mod, "get_conn", lambda: conn)

    allowed = db_mod.consume_rate_limit_token(
        bucket_key="free:recommend:user-1",
        window_name="minute",
        window_seconds=60,
        limit=3,
    )

    assert allowed is True
    assert conn.committed is True
    assert conn.rolled_back is False
    assert any("INSERT INTO rate_limit_hits" in query for query, _ in conn.cursor_stub.executed)


def test_consume_rate_limit_token_rejects_when_limit_reached(monkeypatch):
    conn = _ConnStub(count=3)
    monkeypatch.setattr(db_mod, "get_conn", lambda: conn)

    allowed = db_mod.consume_rate_limit_token(
        bucket_key="free:recommend:user-1",
        window_name="minute",
        window_seconds=60,
        limit=3,
    )

    assert allowed is False
    assert conn.rolled_back is True
    assert conn.committed is False
