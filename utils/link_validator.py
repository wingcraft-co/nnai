"""utils/link_validator.py — 배치 URL 검증 CLI 스크립트.

실행: python utils/link_validator.py
역할: visa_urls.json의 모든 URL을 순차 검증 후 결과를 파일에 덮어쓰기.
      visa_db.json에 있는 29개국 중 visa_urls.json에 없는 항목도 추가.
런타임에서는 호출되지 않음 — 배포 전 1회 실행.
"""

import json
import logging
import os
import urllib.parse

import requests

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

_DIR = os.path.dirname(os.path.abspath(__file__))
_VISA_URLS_PATH = os.path.join(_DIR, "..", "data", "visa_urls.json")
_VISA_DB_PATH   = os.path.join(_DIR, "..", "data", "visa_db.json")


def _load_visa_db() -> dict[str, dict]:
    """visa_db.json에서 country_id → 항목 매핑 반환."""
    try:
        with open(_VISA_DB_PATH, encoding="utf-8") as f:
            raw = json.load(f)
        return {c["id"]: c for c in raw.get("countries", [])}
    except (OSError, json.JSONDecodeError, KeyError):
        return {}


def validate_url(url: str) -> bool:
    """HTTP HEAD 요청으로 URL 유효성 확인. status < 400 → True, 그 외 → False."""
    try:
        resp = requests.head(url, timeout=5, allow_redirects=True)
        return resp.status_code < 400
    except (requests.exceptions.ConnectionError,
            requests.exceptions.Timeout,
            requests.exceptions.RequestException):
        return False


def find_replacement_url(country_id: str, visa_type: str) -> str:
    """URL 무효 시 대체 URL 탐색.

    1순위: visa_db.json의 source 필드 (공식 URL)
    2순위: Google 정적 검색 URL (웹 검색 API 호출 없음)

    Args:
        country_id: 국가 코드 (e.g. "PT", "TH")
        visa_type: 비자 종류 (e.g. "D8 Digital Nomad Visa")

    Returns:
        str: 공식 URL 또는 Google 검색 URL
    """
    db = _load_visa_db()
    entry = db.get(country_id, {})
    # visa_db.json uses "source" as the official URL field
    official = entry.get("official_url", "") or entry.get("source", "")
    if official and official.startswith("http"):
        return official

    query = urllib.parse.urlencode({"q": f"{country_id} {visa_type} official visa application"})
    return f"https://www.google.com/search?{query}"


def run_validation_batch(urls_path: str = _VISA_URLS_PATH) -> None:
    """visa_urls.json 전수 검증 후 결과 업데이트.

    - visa_db.json의 29개국 중 visa_urls.json에 없는 항목도 추가 (source URL 우선)
    - 유효한 URL: 그대로 유지
    - 무효한 URL: find_replacement_url() 결과로 교체
    - 검증 결과 로그 출력
    """
    try:
        with open(urls_path, encoding="utf-8") as f:
            visa_urls: dict[str, str] = json.load(f)
    except (OSError, json.JSONDecodeError):
        visa_urls = {}

    db = _load_visa_db()

    # visa_db에 있는 국가 중 visa_urls에 없는 항목 추가
    for country_id, entry in db.items():
        if country_id not in visa_urls:
            official = entry.get("official_url", "") or entry.get("source", "")
            if official and official.startswith("http"):
                visa_urls[country_id] = official
                logger.info(f"  [추가] {country_id}: {official}")
            else:
                visa_type = entry.get("visa_type", "visa")
                fallback = find_replacement_url(country_id, visa_type)
                visa_urls[country_id] = fallback
                logger.info(f"  [추가-fallback] {country_id}: {fallback}")

    # 전체 URL 검증
    updated: dict[str, str] = {}
    ok_count = 0
    fail_count = 0
    for country_id, url in visa_urls.items():
        if validate_url(url):
            updated[country_id] = url
            logger.info(f"  [OK]   {country_id}: {url}")
            ok_count += 1
        else:
            db_entry = db.get(country_id, {})
            visa_type = db_entry.get("visa_type", "visa")
            replacement = find_replacement_url(country_id, visa_type)
            updated[country_id] = replacement
            logger.info(f"  [FAIL] {country_id}: {url}")
            logger.info(f"         → 교체: {replacement}")
            fail_count += 1

    with open(urls_path, "w", encoding="utf-8") as f:
        json.dump(updated, f, ensure_ascii=False, indent=2)

    logger.info(f"\n검증 완료: OK={ok_count}, FAIL={fail_count}, 총={len(updated)}개국")


if __name__ == "__main__":
    logger.info("=== visa_urls.json URL 배치 검증 시작 ===\n")
    run_validation_batch()
    logger.info("\n=== 완료 ===")
