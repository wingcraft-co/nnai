from __future__ import annotations

from fastapi import Request

from api.auth import extract_user_id, issue_session_token, read_session_token
from utils import db as db_mod
from utils.crypto import decrypt_text, encrypt_text, pii_hash


def _make_request_with_cookie(cookie_value: str) -> Request:
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/auth/me",
        "headers": [(b"cookie", f"nnai_session={cookie_value}".encode())],
        "client": ("127.0.0.1", 12345),
        "server": ("testserver", 80),
        "scheme": "http",
    }
    return Request(scope)


def test_issue_session_token_round_trips_opaque_sid():
    token = issue_session_token("sess_123")

    assert read_session_token(token) == {"sid": "sess_123"}


def test_issue_session_token_does_not_embed_profile_strings():
    token = issue_session_token("sess_123")

    assert "gmail" not in token.lower()
    assert "user example" not in token.lower()
    assert "picture" not in token.lower()


def test_extract_user_id_resolves_user_via_active_session(monkeypatch):
    token = issue_session_token("sess_123")
    request = _make_request_with_cookie(token)
    monkeypatch.setattr(
        "api.auth.get_auth_session_identity",
        lambda session_id: {"uid": "user-1", "name": "User", "picture": None},
    )

    assert extract_user_id(request) == "user-1"


def test_encrypt_text_round_trips_plaintext():
    encrypted = encrypt_text("user@example.com")

    assert encrypted != b"user@example.com"
    assert decrypt_text(encrypted) == "user@example.com"


def test_pii_hash_normalizes_case_and_whitespace():
    first = pii_hash("  USER@example.com ")
    second = pii_hash("user@example.com")

    assert first == second


def test_upsert_user_identity_does_not_store_plain_email_or_name(monkeypatch):
    captured: dict[str, object] = {}

    class _Cursor:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def execute(self, query, params=None):
            captured["query"] = query
            captured["params"] = params

    class _Conn:
        def cursor(self):
            return _Cursor()

        def commit(self):
            captured["committed"] = True

    monkeypatch.setattr(db_mod, "get_conn", lambda: _Conn())

    db_mod.upsert_user_identity(
        "user-1",
        email="user@example.com",
        name="User Example",
        picture="https://example.com/avatar.png",
        created_at="2026-04-16T00:00:00+00:00",
    )

    params = captured["params"]
    assert params is not None
    assert params[1] is None
    assert params[2] is None
    assert params[4] != b"user@example.com"
    assert params[5] == pii_hash("user@example.com")
    assert params[6] != b"User Example"


def test_backfill_legacy_user_identity_encrypts_existing_plain_email():
    executed: list[tuple[str, object]] = []

    class _Cursor:
        def __init__(self):
            self._rows = [("user-1", "legacy@example.com", "Legacy User")]

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def execute(self, query, params=None):
            executed.append((query, params))

        def fetchall(self):
            return self._rows

    class _Conn:
        def __init__(self):
            self.cursor_obj = _Cursor()

        def cursor(self):
            return self.cursor_obj

        def commit(self):
            return None

    conn = _Conn()

    migrated = db_mod.backfill_legacy_user_identity(conn)

    assert migrated == 1
    assert len(executed) == 2
    update_query, update_params = executed[1]
    assert "SET email = NULL" in update_query
    assert "name = NULL" in update_query
    assert update_params is not None
    assert update_params[0] != b"legacy@example.com"
    assert update_params[1] == pii_hash("legacy@example.com")
    assert update_params[3] == "user-1"
