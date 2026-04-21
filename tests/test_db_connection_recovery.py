from __future__ import annotations

import importlib

import psycopg2

import utils.db as db_mod


class _CursorOk:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, query: str):
        return None


class _ConnOk:
    closed = 0

    def cursor(self):
        return _CursorOk()


class _CursorBroken:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, query: str):
        raise psycopg2.OperationalError("connection lost")


class _ConnBroken:
    closed = 0

    def cursor(self):
        return _CursorBroken()


class _ConnClosed:
    closed = 1

    def cursor(self):
        return _CursorOk()

    def commit(self):
        return None


class _CursorAbortedThenOk:
    def __init__(self, conn):
        self.conn = conn

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, query: str):
        if self.conn.aborted:
            raise psycopg2.errors.InFailedSqlTransaction("current transaction is aborted")


class _ConnAborted:
    closed = 0

    def __init__(self):
        self.aborted = True
        self.rollback_count = 0

    def cursor(self):
        return _CursorAbortedThenOk(self)

    def rollback(self):
        self.rollback_count += 1
        self.aborted = False


class _ConnInTransaction:
    closed = 0

    def __init__(self):
        self.rollback_count = 0

    def get_transaction_status(self):
        return psycopg2.extensions.TRANSACTION_STATUS_INTRANS

    def rollback(self):
        self.rollback_count += 1


class _CursorAdvisoryLock:
    def __init__(self, conn):
        self.conn = conn

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, query: str, params=None):
        self.conn.executed.append((query, params))


class _ConnSchemaCheck:
    closed = 0

    def __init__(self):
        self.commits = 0
        self.closed_count = 0
        self.executed = []

    def cursor(self):
        return _CursorAdvisoryLock(self)

    def commit(self):
        self.commits += 1

    def close(self):
        self.closed_count += 1


def test_get_conn_reinitializes_closed_connection(monkeypatch):
    replacement = _ConnOk()
    db_mod._thread_local.conn = _ConnClosed()
    monkeypatch.setattr(db_mod, "connect_db", lambda url=None: replacement)

    conn = db_mod.get_conn()

    assert conn is replacement
    assert db_mod._thread_local.conn is replacement


def test_get_conn_reinitializes_broken_connection(monkeypatch):
    replacement = _ConnOk()
    db_mod._thread_local.conn = _ConnBroken()
    monkeypatch.setattr(db_mod, "connect_db", lambda url=None: replacement)

    conn = db_mod.get_conn()

    assert conn is replacement
    assert db_mod._thread_local.conn is replacement


def test_get_conn_rolls_back_aborted_transaction(monkeypatch):
    existing = _ConnAborted()
    db_mod._thread_local.conn = existing
    monkeypatch.setattr(
        db_mod,
        "connect_db",
        lambda url=None: (_ for _ in ()).throw(AssertionError("should not reconnect")),
    )

    conn = db_mod.get_conn()

    assert conn is existing
    assert db_mod._thread_local.conn is existing
    assert existing.rollback_count == 1


def test_release_thread_connection_transaction_rolls_back_open_transaction():
    existing = _ConnInTransaction()
    db_mod._thread_local.conn = existing

    db_mod.release_thread_connection_transaction()

    assert existing.rollback_count == 1


def test_init_db_sets_default_connect_timeout(monkeypatch):
    captured: dict[str, object] = {}

    class _CursorNoop:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def execute(self, query, params=None):
            return None

        def fetchall(self):
            return []

    class _ConnNoop:
        closed = 0
        autocommit = False

        def cursor(self):
            return _CursorNoop()

        def commit(self):
            return None

    monkeypatch.setattr(
        db_mod.psycopg2,
        "connect",
        lambda dsn, **kwargs: captured.update({"dsn": dsn, "kwargs": kwargs}) or _ConnNoop(),
    )

    db_mod.init_db("postgresql://example.test/db")

    assert captured["dsn"] == "postgresql://example.test/db"
    assert captured["kwargs"] == {"connect_timeout": 5}


def test_connect_db_falls_back_to_database_public_url(monkeypatch):
    captured: dict[str, object] = {}

    class _ConnNoop:
        autocommit = True

    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("DATABASE_PUBLIC_URL", "postgresql://public.example.test/db")
    monkeypatch.setattr(
        db_mod.psycopg2,
        "connect",
        lambda dsn, **kwargs: captured.update({"dsn": dsn, "kwargs": kwargs}) or _ConnNoop(),
    )

    conn = db_mod.connect_db()

    assert captured["dsn"] == "postgresql://public.example.test/db"
    assert captured["kwargs"] == {"connect_timeout": 5}
    assert conn.autocommit is False


def test_get_conn_uses_connection_only_path(monkeypatch):
    replacement = _ConnOk()
    db_mod._thread_local.conn = None
    monkeypatch.setattr(db_mod, "connect_db", lambda url=None: replacement)
    monkeypatch.setattr(
        db_mod,
        "init_db",
        lambda url=None: (_ for _ in ()).throw(AssertionError("get_conn must not run schema DDL")),
    )

    conn = db_mod.get_conn()

    assert conn is replacement
    assert db_mod._thread_local.conn is replacement


def test_ensure_database_ready_skips_schema_init_when_schema_is_ready(monkeypatch):
    conn = _ConnSchemaCheck()
    monkeypatch.setattr(db_mod, "connect_db", lambda url=None: conn)
    monkeypatch.setattr(db_mod, "_schema_is_ready", lambda existing_conn: existing_conn is conn)
    monkeypatch.setattr(
        db_mod,
        "init_db",
        lambda url=None: (_ for _ in ()).throw(AssertionError("ready schema must not run DDL")),
    )

    db_mod.ensure_database_ready()

    assert conn.commits == 1
    assert conn.closed_count == 1
    assert "pg_advisory_lock" in conn.executed[0][0]


def test_ensure_database_ready_initializes_missing_schema(monkeypatch):
    conn = _ConnSchemaCheck()
    initialized = _ConnSchemaCheck()
    monkeypatch.setattr(db_mod, "connect_db", lambda url=None: conn)
    monkeypatch.setattr(db_mod, "_schema_is_ready", lambda existing_conn: False)
    monkeypatch.setattr(db_mod, "init_db", lambda url=None: initialized)

    db_mod.ensure_database_ready()

    assert conn.closed_count == 1
    assert initialized.closed_count == 1


def test_init_db_script_uses_readiness_initialization(monkeypatch, capsys):
    script = importlib.import_module("scripts.init_db")
    calls = []
    monkeypatch.setattr(script.db_mod, "ensure_database_ready", lambda: calls.append(True))
    monkeypatch.setattr(
        script.db_mod,
        "init_db",
        lambda: (_ for _ in ()).throw(AssertionError("script must use readiness initialization")),
    )

    script.main()

    assert calls == [True]
    assert "DB schema ready" in capsys.readouterr().out
