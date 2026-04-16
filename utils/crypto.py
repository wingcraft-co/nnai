"""PII encryption helpers."""
from __future__ import annotations

import hashlib
import os

from cryptography.fernet import Fernet


def has_pii_encryption_key() -> bool:
    return bool(os.environ.get("APP_PII_ENCRYPTION_KEY"))


def _fernet() -> Fernet | None:
    key = os.environ.get("APP_PII_ENCRYPTION_KEY")
    if not key:
        return None
    return Fernet(key)


def _coerce_bytes(value: bytes | bytearray | memoryview | None) -> bytes | None:
    if value is None:
        return None
    if isinstance(value, memoryview):
        return value.tobytes()
    if isinstance(value, bytearray):
        return bytes(value)
    return value


def encrypt_text(value: str | None) -> bytes | None:
    if not value:
        return None
    fernet = _fernet()
    if fernet is None:
        return None
    return fernet.encrypt(value.encode("utf-8"))


def decrypt_text(value: bytes | bytearray | memoryview | None) -> str | None:
    raw = _coerce_bytes(value)
    if not raw:
        return None
    fernet = _fernet()
    if fernet is None:
        return None
    return fernet.decrypt(raw).decode("utf-8")


def pii_hash(value: str | None) -> str | None:
    if not value:
        return None
    return hashlib.sha256(value.strip().lower().encode("utf-8")).hexdigest()
