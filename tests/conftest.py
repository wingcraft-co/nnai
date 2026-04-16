import os

import pytest

os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault(
    "APP_PII_ENCRYPTION_KEY",
    "l2f5Rk6evwYTxg2R31m0P3Bz9h3m8U8lVfM2i4A0hE4=",
)


@pytest.fixture(autouse=True)
def set_test_env(monkeypatch):
    """모든 테스트에 더미 HF_TOKEN 주입 (실제 API 호출 방지)"""
    monkeypatch.setenv("HF_TOKEN", "hf_test_dummy_token")
    monkeypatch.setenv("SECRET_KEY", "test-secret-key")
    monkeypatch.setenv(
        "APP_PII_ENCRYPTION_KEY",
        "l2f5Rk6evwYTxg2R31m0P3Bz9h3m8U8lVfM2i4A0hE4=",
    )
