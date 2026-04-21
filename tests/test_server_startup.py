from __future__ import annotations

import importlib
import sys

from fastapi.testclient import TestClient


def test_server_import_does_not_initialize_db_until_startup(monkeypatch):
    import utils.db as db_mod

    init_calls: list[bool] = []

    def _fake_ensure_database_ready():
        init_calls.append(True)
        return object()

    monkeypatch.setattr(db_mod, "ensure_database_ready", _fake_ensure_database_ready)
    sys.modules.pop("server", None)

    server = importlib.import_module("server")
    assert init_calls == []

    with TestClient(server.app):
        pass

    assert len(init_calls) == 1


def test_startup_uses_readiness_check_not_unconditional_schema_init(monkeypatch):
    import utils.db as db_mod

    ready_calls: list[bool] = []
    monkeypatch.setattr(db_mod, "ensure_database_ready", lambda: ready_calls.append(True))
    monkeypatch.setattr(
        db_mod,
        "init_db",
        lambda url=None: (_ for _ in ()).throw(AssertionError("startup must not always run DDL")),
    )
    sys.modules.pop("server", None)

    server = importlib.import_module("server")

    with TestClient(server.app):
        pass

    assert ready_calls == [True]


def test_auth_middleware_releases_db_transaction_after_request(monkeypatch):
    import utils.db as db_mod

    monkeypatch.setattr(db_mod, "ensure_database_ready", lambda: None)
    sys.modules.pop("server", None)

    server = importlib.import_module("server")
    release_calls: list[bool] = []
    monkeypatch.setattr(
        server,
        "release_thread_connection_transaction",
        lambda: release_calls.append(True),
    )

    with TestClient(server.app) as client:
        response = client.get("/ads.txt")

    assert response.status_code == 200
    assert release_calls == [True]
