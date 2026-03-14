import os
import pytest

# 모듈 레벨에서 RAG 초기화 스킵 (테스트 환경)
os.environ.setdefault("SKIP_RAG_INIT", "1")


@pytest.fixture(autouse=True)
def set_test_env(monkeypatch):
    """모든 테스트에 더미 HF_TOKEN 주입 (실제 API 호출 방지)"""
    monkeypatch.setenv("HF_TOKEN", "hf_test_dummy_token")
    monkeypatch.setenv("SKIP_RAG_INIT", "1")
