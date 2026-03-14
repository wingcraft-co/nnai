"""
tests/test_schengen_calculator.py

쉥겐 계산기 테스트 — 8개 케이스
"""
from __future__ import annotations

from datetime import date, timedelta

import pytest

from api.schengen_calculator import (
    SCHENGEN_COUNTRIES,
    calculate_remaining_days,
)


def _days_ago(n: int) -> str:
    return (date.today() - timedelta(days=n)).isoformat()


def _days_from_now(n: int) -> str:
    return (date.today() + timedelta(days=n)).isoformat()


# ── 1. 빈 trips ─────────────────────────────────────────────────────────────

def test_empty_trips_returns_full_quota():
    """여행 기록이 없으면 잔여일 90, 사용일 0, 경고 없음."""
    result = calculate_remaining_days([])
    assert result["remaining_days"] == 90
    assert result["used_days"] == 0
    assert result["warnings"] == []


# ── 2. 30일 체류 후 잔여일 60 ────────────────────────────────────────────────

def test_30_day_stay_leaves_60_remaining():
    """30일 쉥겐 체류 후 잔여일 60."""
    trips = [{"entry": _days_ago(30), "exit": _days_ago(1), "country": "DE"}]
    result = calculate_remaining_days(trips)
    assert result["used_days"] == 30
    assert result["remaining_days"] == 60
    assert result["warnings"] == []


# ── 3. 정확히 90일 체류 → 잔여일 0 ──────────────────────────────────────────

def test_exactly_90_days_used_leaves_zero_remaining():
    """정확히 90일 사용 시 잔여일 0 (초과 경고는 없음 — 딱 한도)."""
    trips = [{"entry": _days_ago(89), "exit": date.today().isoformat(), "country": "FR"}]
    result = calculate_remaining_days(trips)
    assert result["used_days"] == 90
    assert result["remaining_days"] == 0


# ── 4. 91일 체류 → 초과 경고 ────────────────────────────────────────────────

def test_91_days_triggers_exceeded_warning():
    """91일 체류 시 경고 메시지 포함."""
    # 91일: 90일 전 입국, 오늘 포함해서 91일
    trips = [{"entry": _days_ago(90), "exit": date.today().isoformat(), "country": "ES"}]
    result = calculate_remaining_days(trips)
    assert result["remaining_days"] < 0 or result["used_days"] > 90
    assert len(result["warnings"]) > 0
    assert any("초과" in w for w in result["warnings"])


# ── 5. 181일 전 체류는 롤링 윈도우 밖 → 카운트 제외 ──────────────────────────

def test_trip_outside_180_window_not_counted():
    """181일 전에 끝난 여행은 현재 윈도우 계산에서 제외."""
    old_trip = {
        "entry": _days_ago(210),
        "exit": _days_ago(181),   # 180일 윈도우 밖
        "country": "IT",
    }
    result = calculate_remaining_days([old_trip])
    assert result["used_days"] == 0
    assert result["remaining_days"] == 90


# ── 6. 크로아티아·불가리아·루마니아가 쉥겐으로 집계됨 ──────────────────────

def test_croatia_bulgaria_romania_counted_as_schengen():
    """2023·2024년 신규 편입 3국이 쉥겐으로 집계되는지 확인."""
    assert "HR" in SCHENGEN_COUNTRIES, "크로아티아(HR) 누락"
    assert "BG" in SCHENGEN_COUNTRIES, "불가리아(BG) 누락"
    assert "RO" in SCHENGEN_COUNTRIES, "루마니아(RO) 누락"

    trips = [
        {"entry": _days_ago(20), "exit": _days_ago(11), "country": "HR"},  # 10일
        {"entry": _days_ago(10), "exit": _days_ago(6),  "country": "BG"},  # 5일
        {"entry": _days_ago(5),  "exit": _days_ago(1),  "country": "RO"},  # 5일
    ]
    result = calculate_remaining_days(trips)
    assert result["used_days"] == 20
    assert result["remaining_days"] == 70


# ── 7. 단일 국가 단일 여행 ────────────────────────────────────────────────

def test_single_country_single_trip():
    """단일 여행, 체류일 정확히 집계."""
    trips = [{"entry": _days_ago(14), "exit": _days_ago(8), "country": "PT"}]
    result = calculate_remaining_days(trips)
    assert result["used_days"] == 7   # 14,13,12,11,10,9,8 → 7일
    assert result["remaining_days"] == 83


# ── 8. 복수 국가 복수 여행 ────────────────────────────────────────────────

def test_multiple_countries_multiple_trips():
    """복수 국가 복수 여행의 총합이 정확히 집계됨. 비쉥겐 국가는 제외."""
    trips = [
        {"entry": _days_ago(60), "exit": _days_ago(51), "country": "DE"},   # 10일
        {"entry": _days_ago(40), "exit": _days_ago(31), "country": "GR"},   # 10일
        {"entry": _days_ago(20), "exit": _days_ago(16), "country": "TH"},   # 비쉥겐 → 제외
        {"entry": _days_ago(10), "exit": _days_ago(6),  "country": "ES"},   # 5일
    ]
    result = calculate_remaining_days(trips)
    assert result["used_days"] == 25   # 10 + 10 + 5
    assert result["remaining_days"] == 65
    assert result["warnings"] == []
