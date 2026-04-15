"""Structured security event logging helpers."""
from __future__ import annotations

import logging

logger = logging.getLogger("nnai.security")


def log_security_event(event: str, **fields) -> None:
    safe_fields = []
    for key in sorted(fields):
        value = fields[key]
        if value is None:
            continue
        safe_fields.append(f"{key}={value}")

    suffix = ""
    if safe_fields:
        suffix = " " + " ".join(safe_fields)

    logger.warning("security_event event=%s%s", event, suffix)
