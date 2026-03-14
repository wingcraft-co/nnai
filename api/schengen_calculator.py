"""
api/schengen_calculator.py

쉥겐 90/180 롤링 윈도우 계산기.
"과거 180일 중 쉥겐 체류일 합계가 90일을 초과할 수 없다"는 규칙을 구현.
"""
from __future__ import annotations

import logging
from datetime import date, timedelta

logger = logging.getLogger(__name__)

# 2026년 기준 쉥겐 29개국 (ISO-3166-1 alpha-2)
SCHENGEN_COUNTRIES: frozenset[str] = frozenset({
    "AT",  # 오스트리아
    "BE",  # 벨기에
    "BG",  # 불가리아 (2024년 편입)
    "HR",  # 크로아티아 (2023년 편입)
    "CZ",  # 체코
    "DK",  # 덴마크
    "EE",  # 에스토니아
    "FI",  # 핀란드
    "FR",  # 프랑스
    "DE",  # 독일
    "GR",  # 그리스
    "HU",  # 헝가리
    "IS",  # 아이슬란드
    "IT",  # 이탈리아
    "LV",  # 라트비아
    "LI",  # 리히텐슈타인
    "LT",  # 리투아니아
    "LU",  # 룩셈부르크
    "MT",  # 몰타
    "NL",  # 네덜란드
    "NO",  # 노르웨이
    "PL",  # 폴란드
    "PT",  # 포르투갈
    "RO",  # 루마니아 (2024년 편입)
    "SK",  # 슬로바키아
    "SI",  # 슬로베니아
    "ES",  # 스페인
    "SE",  # 스웨덴
    "CH",  # 스위스
})

_MAX_DAYS = 90
_WINDOW_DAYS = 180
_WARN_THRESHOLD = 7
_REENTRY_MIN_DAYS = 30


def _parse_date(value: str) -> date:
    return date.fromisoformat(value)


def _count_schengen_days_in_window(trips: list[dict], window_start: date, window_end: date) -> int:
    """window_start ~ window_end (inclusive) 범위 내 쉥겐 체류일 합산."""
    total = 0
    for trip in trips:
        country = trip.get("country", "").upper()
        if country not in SCHENGEN_COUNTRIES:
            continue
        entry = _parse_date(trip["entry"])
        exit_ = _parse_date(trip["exit"])
        # 윈도우와 겹치는 구간
        overlap_start = max(entry, window_start)
        overlap_end = min(exit_, window_end)
        if overlap_end >= overlap_start:
            total += (overlap_end - overlap_start).days + 1
    return total


def calculate_remaining_days(trips: list[dict]) -> dict:
    """
    쉥겐 90/180 롤링 윈도우 잔여일을 계산한다.

    Args:
        trips: 여행 기록 리스트.
               각 항목: {"entry": "YYYY-MM-DD", "exit": "YYYY-MM-DD", "country": "ISO-2코드"}
               쉥겐 비해당 국가는 무시된다.

    Returns:
        {
            "remaining_days": int,           # 오늘 기준 잔여 쉥겐 일수 (음수 가능)
            "used_days": int,                # 과거 180일 내 쉥겐 사용일
            "next_reset_date": str,          # 잔여일 >= 1이 되는 최초 날짜 (YYYY-MM-DD)
            "reentry_optimal_date": str,     # 잔여일 >= 30이 되는 날짜 (YYYY-MM-DD)
            "warnings": list[str],           # 경고 메시지
        }
    """
    today = date.today()
    window_start = today - timedelta(days=_WINDOW_DAYS - 1)

    used_days = _count_schengen_days_in_window(trips, window_start, today)
    remaining_days = _MAX_DAYS - used_days

    warnings: list[str] = []
    if remaining_days <= 0:
        warnings.append(
            f"⚠️ 쉥겐 90일 한도를 초과했습니다. "
            f"현재 {used_days}일 사용 중입니다. 즉시 쉥겐 구역을 이탈해야 합니다."
        )
    elif remaining_days <= _WARN_THRESHOLD:
        warnings.append(
            f"⚠️ 쉥겐 잔여일이 {remaining_days}일밖에 남지 않았습니다. "
            f"7일 이내 초과 위험 — 출국 일정을 확인하세요."
        )

    # next_reset_date: 잔여일 >= 1이 되는 최초 날짜 탐색
    # 미래 날짜를 하루씩 앞당기며 가장 오래된 쉥겐 체류일이 180일 윈도우 밖으로 떨어지는 시점
    next_reset_date = _find_reset_date(trips, today, min_remaining=1)
    reentry_optimal_date = _find_reset_date(trips, today, min_remaining=_REENTRY_MIN_DAYS)

    return {
        "remaining_days": remaining_days,
        "used_days": used_days,
        "next_reset_date": next_reset_date,
        "reentry_optimal_date": reentry_optimal_date,
        "warnings": warnings,
    }


def _find_reset_date(trips: list[dict], today: date, min_remaining: int) -> str:
    """
    future_date를 하루씩 증가시며, 해당 날짜 기준 180일 윈도우에서
    쉥겐 사용일이 (90 - min_remaining) 이하가 되는 최초 날짜를 반환.
    최대 366일 탐색. 찾지 못하면 366일 후 날짜 반환.
    """
    max_used = _MAX_DAYS - min_remaining
    for delta in range(0, 367):
        future = today + timedelta(days=delta)
        window_start = future - timedelta(days=_WINDOW_DAYS - 1)
        used = _count_schengen_days_in_window(trips, window_start, future)
        if used <= max_used:
            return future.isoformat()
    # 찾지 못한 경우 (이론상 발생하지 않음)
    return (today + timedelta(days=366)).isoformat()
