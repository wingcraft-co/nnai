"""scoring_audit.py — 스코어링 엔진 전수조사 스크립트.

모든 유효 입력 조합에 대해 recommend_from_db()를 실행하고,
에러/빈 결과/비정상 점수/차별화 부재를 검출한다.

Usage:
    SKIP_EXTERNAL_INIT=1 python3 scripts/scoring_audit.py
"""
from __future__ import annotations

import sys
import os
import json
import time
import itertools
from collections import defaultdict
from pathlib import Path

# Project root
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.setdefault("SKIP_EXTERNAL_INIT", "1")

from recommender import recommend_from_db

# ── Input dimensions ──────────────────────────────────────────────

PERSONAS = ["wanderer", "local", "planner", "free_spirit", "pioneer", ""]
PURPOSES = ["원격 근무", "프리랜서 활동", "온라인 비즈니스 운영", "장기 여행", "은퇴 후 거주"]
TIMELINES = ["1~3개월 단기 체류", "6개월 중기 체류", "1년 장기 체류", "영주권/이민 목표"]
INCOMES_KRW = [0, 150, 250, 400, 600, 800]  # 만원 (0 = 비공개)
TRAVEL_TYPES = ["혼자 (솔로)", "배우자/파트너 동반", "자녀 동반 (배우자 없이)", "가족 전체 동반"]
STAY_STYLES = ["정착형", "순환형", "이동형"]
TAX_SENSITIVITIES = ["optimize", "simple", "unknown"]
LIFESTYLES_SINGLE = [
    [],
    ["일하기 좋은 인프라"],
    ["한인 커뮤니티 활성화"],
    ["저렴한 물가와 생활비"],
    ["영어로 생활 가능"],
]
CONTINENTS = [[], ["아시아"], ["유럽"], ["중남미"], ["중동/아프리카"], ["북미"]]

# USD conversion (approximation for testing)
USD_RATE = 0.000714


def build_profile(
    persona: str,
    purpose: str,
    timeline: str,
    income_krw: int,
    travel_type: str,
    stay_style: str,
    lifestyle: list[str],
    preferred_countries: list[str],
) -> dict:
    """Build a user_profile dict matching recommend_from_db() expectations."""
    income_usd = round(income_krw * 10000 * USD_RATE)
    is_short = timeline == "1~3개월 단기 체류"

    return {
        "nationality": "한국",
        "income_usd": income_usd,
        "effective_income_usd": income_usd,
        "income_krw": income_krw,
        "purpose": purpose,
        "lifestyle": lifestyle,
        "languages": [],
        "timeline": timeline,
        "preferred_countries": preferred_countries,
        "language": "한국어",
        "persona_type": persona,
        "persona_vector": None,
        "income_type": "",
        "travel_type": travel_type,
        "children_ages": ["7~12"] if "자녀" in travel_type or "가족" in travel_type else [],
        "dual_nationality": False,
        "readiness_stage": "",
        "has_spouse_income": "없음",
        "spouse_income_krw": 0,
        "stay_style": "" if is_short else stay_style,
        "tax_sensitivity": "" if is_short else "simple",
    }


# ── Test generators ───────────────────────────────────────────────

def generate_full_combos():
    """Generate all valid input combinations (conditional logic applied)."""
    combos = []
    for persona, purpose, timeline, income, travel, lifestyle, continent in itertools.product(
        PERSONAS, PURPOSES, TIMELINES, INCOMES_KRW, TRAVEL_TYPES, LIFESTYLES_SINGLE, CONTINENTS
    ):
        is_short = timeline == "1~3개월 단기 체류"
        styles = [""] if is_short else STAY_STYLES
        taxes = [""] if is_short else TAX_SENSITIVITIES
        for style in styles:
            for tax in taxes:
                combos.append((persona, purpose, timeline, income, travel, style, tax, lifestyle, continent))
    return combos


def generate_differentiation_pairs():
    """Generate pairs that should produce different TOP5 to test differentiation."""
    base = dict(timeline="1년 장기 체류", income_krw=400, travel_type="혼자 (솔로)",
                stay_style="순환형", lifestyle=[], preferred_countries=[])
    pairs = []

    # Purpose differentiation
    for p1, p2 in [("원격 근무", "은퇴 후 거주"), ("원격 근무", "장기 여행"), ("프리랜서 활동", "은퇴 후 거주")]:
        pairs.append(("purpose", p1, p2, {**base, "purpose": p1}, {**base, "purpose": p2}))

    # Persona differentiation
    for p1, p2 in [("wanderer", "local"), ("planner", "free_spirit"), ("pioneer", "wanderer")]:
        pairs.append(("persona", p1, p2,
                       {**base, "purpose": "원격 근무", "persona": p1},
                       {**base, "purpose": "원격 근무", "persona": p2}))

    # Income differentiation
    for i1, i2 in [(150, 800), (250, 600)]:
        pairs.append(("income", str(i1), str(i2),
                       {**base, "purpose": "원격 근무", "income_krw": i1},
                       {**base, "purpose": "원격 근무", "income_krw": i2}))

    # Travel type differentiation
    for t1, t2 in [("혼자 (솔로)", "가족 전체 동반")]:
        pairs.append(("travel", t1, t2,
                       {**base, "purpose": "원격 근무", "travel_type": t1},
                       {**base, "purpose": "원격 근무", "travel_type": t2}))

    return pairs


# ── Audit runner ──────────────────────────────────────────────────

def run_audit():
    combos = generate_full_combos()
    total = len(combos)
    print(f"=== 스코어링 전수조사 시작 ===")
    print(f"총 조합 수: {total:,}")
    print()

    errors: list[dict] = []
    empty_results: list[dict] = []
    score_anomalies: list[dict] = []
    results_cache: dict[str, list[str]] = {}  # key → top5 cities

    start = time.time()
    batch_size = 1000

    for i, (persona, purpose, timeline, income, travel, style, tax, lifestyle, continent) in enumerate(combos):
        profile = build_profile(persona, purpose, timeline, income, travel, style, lifestyle, continent)
        profile["tax_sensitivity"] = tax

        try:
            result = recommend_from_db(profile, top_n=5, debug_mode=False)
        except Exception as e:
            errors.append({
                "index": i,
                "error": str(e),
                "profile": {k: v for k, v in profile.items() if k in (
                    "persona_type", "purpose", "timeline", "income_usd",
                    "travel_type", "stay_style", "lifestyle", "preferred_countries"
                )},
            })
            continue

        top_cities = result.get("top_cities", [])

        # Check 1: Empty results
        if len(top_cities) == 0:
            empty_results.append({
                "index": i,
                "persona": persona, "purpose": purpose, "timeline": timeline,
                "income": income, "travel": travel, "continent": continent,
            })

        # Check 2: Score anomalies
        for city in top_cities:
            score = city.get("score", 0)
            if score < 0 or score > 10:
                score_anomalies.append({
                    "index": i, "city": city.get("city"), "score": score,
                })
            if score == 0:
                score_anomalies.append({
                    "index": i, "city": city.get("city"), "score": score,
                    "note": "score is exactly 0",
                })

        # Cache for differentiation check
        key = f"{persona}|{purpose}|{timeline}|{income}|{travel}|{style}|{tax}|{'_'.join(lifestyle)}|{'_'.join(continent)}"
        results_cache[key] = [c.get("city", "") for c in top_cities]

        # Progress
        if (i + 1) % batch_size == 0:
            elapsed = time.time() - start
            rate = (i + 1) / elapsed
            remaining = (total - i - 1) / rate
            print(f"  [{i+1:,}/{total:,}] {rate:.0f} combo/s, 남은 시간: {remaining:.0f}초")

    elapsed = time.time() - start
    print(f"\n=== 전수조사 완료: {elapsed:.1f}초 ({total/elapsed:.0f} combo/s) ===\n")

    # ── Differentiation test ──────────────────────────────────────
    print("=== 차별화 검증 ===")
    diff_pairs = generate_differentiation_pairs()
    diff_failures = []

    for dim, val1, val2, params1, params2 in diff_pairs:
        p1 = build_profile(
            persona=params1.get("persona", ""),
            purpose=params1.get("purpose", "원격 근무"),
            timeline=params1.get("timeline", "1년 장기 체류"),
            income_krw=params1.get("income_krw", 400),
            travel_type=params1.get("travel_type", "혼자 (솔로)"),
            stay_style=params1.get("stay_style", "순환형"),
            lifestyle=params1.get("lifestyle", []),
            preferred_countries=params1.get("preferred_countries", []),
        )
        p2 = build_profile(
            persona=params2.get("persona", ""),
            purpose=params2.get("purpose", "원격 근무"),
            timeline=params2.get("timeline", "1년 장기 체류"),
            income_krw=params2.get("income_krw", 400),
            travel_type=params2.get("travel_type", "혼자 (솔로)"),
            stay_style=params2.get("stay_style", "순환형"),
            lifestyle=params2.get("lifestyle", []),
            preferred_countries=params2.get("preferred_countries", []),
        )

        try:
            r1 = recommend_from_db(p1, top_n=5, debug_mode=False)
            r2 = recommend_from_db(p2, top_n=5, debug_mode=False)
        except Exception as e:
            diff_failures.append({"dim": dim, "val1": val1, "val2": val2, "error": str(e)})
            continue

        cities1 = [c["city"] for c in r1.get("top_cities", [])]
        cities2 = [c["city"] for c in r2.get("top_cities", [])]

        if cities1 == cities2:
            # Same order = no differentiation
            scores1 = [c["score"] for c in r1.get("top_cities", [])]
            scores2 = [c["score"] for c in r2.get("top_cities", [])]
            diff_failures.append({
                "dim": dim, "val1": val1, "val2": val2,
                "cities": cities1, "scores1": scores1, "scores2": scores2,
                "note": "동일한 TOP5 순서 — 차별화 없음",
            })
            print(f"  ❌ {dim}: {val1} vs {val2} → 동일 결과 {cities1}")
        else:
            overlap = set(cities1) & set(cities2)
            print(f"  ✅ {dim}: {val1} vs {val2} → 겹침 {len(overlap)}/5 ({', '.join(overlap) if overlap else '없음'})")

    # ── Report ────────────────────────────────────────────────────
    print(f"\n{'='*60}")
    print(f"=== 최종 리포트 ===")
    print(f"{'='*60}")
    print(f"총 조합: {total:,}")
    print(f"에러 발생: {len(errors)}")
    print(f"빈 결과 (TOP5=0): {len(empty_results)}")
    print(f"점수 이상: {len(score_anomalies)}")
    print(f"차별화 실패: {len(diff_failures)}/{len(diff_pairs)}")

    if errors:
        print(f"\n--- 에러 상세 (최대 10개) ---")
        for e in errors[:10]:
            print(f"  [{e['index']}] {e['error']}")
            print(f"    {e['profile']}")

    if empty_results:
        print(f"\n--- 빈 결과 상세 (최대 10개) ---")
        for e in empty_results[:10]:
            print(f"  [{e['index']}] persona={e['persona']}, purpose={e['purpose']}, "
                  f"timeline={e['timeline']}, income={e['income']}, continent={e['continent']}")

    if score_anomalies:
        print(f"\n--- 점수 이상 상세 (최대 10개) ---")
        for a in score_anomalies[:10]:
            print(f"  [{a['index']}] {a['city']}: score={a['score']} {a.get('note', '')}")

    if diff_failures:
        print(f"\n--- 차별화 실패 상세 ---")
        for f in diff_failures:
            print(f"  {f['dim']}: {f['val1']} vs {f['val2']}")
            if "cities" in f:
                print(f"    결과: {f['cities']}")
                print(f"    점수1: {f.get('scores1')}")
                print(f"    점수2: {f.get('scores2')}")

    # Save full report as JSON
    report = {
        "total_combos": total,
        "elapsed_seconds": round(elapsed, 1),
        "errors_count": len(errors),
        "empty_results_count": len(empty_results),
        "score_anomalies_count": len(score_anomalies),
        "differentiation_failures": len(diff_failures),
        "differentiation_total": len(diff_pairs),
        "errors": errors[:50],
        "empty_results": empty_results[:50],
        "score_anomalies": score_anomalies[:50],
        "diff_failures": diff_failures,
    }
    report_path = Path(__file__).parent.parent / "docs" / "review" / "scoring_audit_report.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\n리포트 저장: {report_path}")

    # Exit code
    has_critical = len(errors) > 0 or len(score_anomalies) > 0
    sys.exit(1 if has_critical else 0)


if __name__ == "__main__":
    run_audit()
