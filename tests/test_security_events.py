from __future__ import annotations

import logging

from fastapi import Request

from api.auth import extract_user_id
from utils.security_events import log_security_event


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


def test_log_security_event_emits_structured_warning(caplog):
    with caplog.at_level(logging.WARNING, logger="nnai.security"):
        log_security_event("rate_limit_exceeded", endpoint="recommend", mode="free")

    assert "security_event event=rate_limit_exceeded" in caplog.text
    assert "endpoint=recommend" in caplog.text
    assert "mode=free" in caplog.text


def test_extract_user_id_logs_bad_signature(caplog):
    request = _make_request_with_cookie("invalid-session-cookie")

    with caplog.at_level(logging.WARNING, logger="nnai.security"):
        user_id = extract_user_id(request)

    assert user_id is None
    assert "security_event event=session_bad_signature" in caplog.text
    assert "route=middleware" in caplog.text
