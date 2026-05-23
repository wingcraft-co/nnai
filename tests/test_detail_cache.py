from __future__ import annotations

from pathlib import Path

from api.detail_cache import build_detail_cache_key, build_detail_quota


def _parsed(profile_value: str = "원격 근무") -> dict:
    return {
        "_user_profile": {
            "nationality": "Korean",
            "immigration_purpose": profile_value,
            "income_krw": 500,
        },
        "top_cities": [
            {"city": "Lisbon", "country_id": "PT", "visa_type": "D8"},
            {"city": "Bangkok", "country_id": "TH", "visa_type": "DTV"},
        ],
    }


def test_detail_cache_key_is_stable_for_same_profile_and_city():
    first = build_detail_cache_key(_parsed(), 1)
    second = build_detail_cache_key(_parsed(), 1)

    assert first == second


def test_detail_cache_key_changes_when_city_changes():
    assert build_detail_cache_key(_parsed(), 0) != build_detail_cache_key(_parsed(), 1)


def test_detail_cache_key_changes_when_onboarding_profile_changes():
    assert build_detail_cache_key(_parsed("원격 근무"), 1) != build_detail_cache_key(_parsed("이민"), 1)


def test_free_detail_quota_reports_remaining_count():
    quota = build_detail_quota(plan_tier="free", used_count=1)

    assert quota == {
        "is_unlimited": False,
        "limit": 2,
        "used": 1,
        "remaining": 1,
    }


def test_pro_detail_quota_is_unlimited():
    quota = build_detail_quota(plan_tier="pro", used_count=9)

    assert quota["is_unlimited"] is True
    assert quota["limit"] is None
    assert quota["remaining"] is None


def test_library_guides_endpoint_reads_saved_detail_cache():
    server_source = Path("server.py").read_text()

    assert '@app.get("/api/library/guides")' in server_source
    assert '@app.post("/api/library/guides")' in server_source
    assert "class LibraryGuideSaveRequest(BaseModel):" in server_source
    assert '"cache_key": cache_key' in server_source
    assert 'raise HTTPException(status_code=401, detail="Login required.")' in server_source
    assert 'return {"guides": list_detail_guide_cache_entries(user_id)}' in server_source
