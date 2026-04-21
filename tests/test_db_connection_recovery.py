from __future__ import annotations

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


def test_get_conn_reinitializes_closed_connection(monkeypatch):
    replacement = _ConnOk()
    db_mod._thread_local.conn = _ConnClosed()
    monkeypatch.setattr(db_mod, "init_db", lambda url=None: replacement)

    conn = db_mod.get_conn()

    assert conn is replacement
    assert db_mod._thread_local.conn is replacement


def test_get_conn_reinitializes_broken_connection(monkeypatch):
    replacement = _ConnOk()
    db_mod._thread_local.conn = _ConnBroken()
    monkeypatch.setattr(db_mod, "init_db", lambda url=None: replacement)

    conn = db_mod.get_conn()

    assert conn is replacement
    assert db_mod._thread_local.conn is replacement


def test_get_conn_rolls_back_aborted_transaction(monkeypatch):
    existing = _ConnAborted()
    db_mod._thread_local.conn = existing
    monkeypatch.setattr(
        db_mod,
        "init_db",
        lambda url=None: (_ for _ in ()).throw(AssertionError("should not reconnect")),
    )

    conn = db_mod.get_conn()

    assert conn is existing
    assert db_mod._thread_local.conn is existing
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
