from __future__ import annotations

import threading

import utils.db as db_mod


class _ConnStub:
    closed = 0

    def __init__(self, name: str):
        self.name = name

    def cursor(self):
        return _CursorStub()


class _CursorStub:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, query: str):
        return None


def test_get_conn_returns_different_connections_per_thread(monkeypatch):
    created: list[_ConnStub] = []

    def _connect_db(url=None):
        conn = _ConnStub(name=f"conn-{len(created)}")
        created.append(conn)
        return conn

    monkeypatch.setattr(db_mod, "connect_db", _connect_db)
    db_mod._thread_local = threading.local()

    main_conn = db_mod.get_conn()
    thread_result: dict[str, _ConnStub] = {}

    def _worker():
        thread_result["conn"] = db_mod.get_conn()

    thread = threading.Thread(target=_worker)
    thread.start()
    thread.join()

    assert main_conn is not thread_result["conn"]
    assert len(created) == 2
