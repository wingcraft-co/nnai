import os

import pytest

os.environ.setdefault("SECRET_KEY", "test-secret-key")


@pytest.fixture(autouse=True)
def set_test_env(monkeypatch):
    """모든 테스트에 더미 HF_TOKEN 주입 (실제 API 호출 방지)"""
    monkeypatch.setenv("HF_TOKEN", "hf_test_dummy_token")
    monkeypatch.setenv("SECRET_KEY", "test-secret-key")
