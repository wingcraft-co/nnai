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
