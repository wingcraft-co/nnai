"""utils/persona.py — 페르소나 진단 로직"""
from __future__ import annotations


PERSONA_LABELS = {
    "schengen_loop":    "🗺️ 쉥겐 루프형 (유럽 루트 최적화)",
    "slow_nomad":       "🏡 거점 정착형 (Slow Nomad)",
    "fire_optimizer":   "💰 비용 최적화형 (FIRE)",
    "burnout_escape":   "🌿 번아웃 탈출형",
    "expat_freedom":    "✈️ 사회 이탈형 (탈조선)",
}

PERSONA_HINTS = {
    "schengen_loop": (
        "※ 페르소나: 쉥겐 루프형 — 유럽 내 90일 체류 후 비쉥겐 국가로 이동하는 루트를 최적화하라. "
        "쉥겐 국가와 비쉥겐 버퍼 국가(조지아·세르비아·알바니아 등)를 균형 있게 추천하라."
    ),
    "slow_nomad": (
        "※ 페르소나: 거점 정착형 — 한 도시에서 6개월 이상 깊이 체류하는 라이프스타일을 선호한다. "
        "장기 체류 비자 취득이 쉽고, 현지 커뮤니티와 통합이 용이한 도시를 우선 추천하라."
    ),
    "fire_optimizer": (
        "※ 페르소나: FIRE 최적화형 — 한국 원격 소득을 유지하며 생활비를 최소화하는 것이 최우선이다. "
        "월 생활비 $1,500 이하의 고품질 생활환경과 인터넷 인프라를 갖춘 도시를 추천하라."
    ),
    "burnout_escape": (
        "※ 페르소나: 번아웃 탈출형 — 한국의 경쟁적 환경에서 벗어나 심리적 회복을 원한다. "
        "소도시 감성, 자연환경, 느린 페이스, 활발한 노마드 커뮤니티가 있는 도시를 추천하라."
    ),
    "expat_freedom": (
        "※ 페르소나: 사회 이탈형 — 장기적으로 한국을 완전히 떠나는 것을 목표로 한다. "
        "영주권 경로가 열려 있거나 장기 체류가 가능한 비자 체계를 가진 도시를 우선 추천하라."
    ),
}


def diagnose_persona(
    motivation: str,
    europe_plan: str,
    stay_duration: str,
    work_type: str,
    main_concern: str,
) -> str:
    """
    5개 온보딩 질문 응답으로 페르소나 유형을 진단한다.

    Returns:
        persona_type: one of the PERSONA_LABELS keys
    """
    # Q2: 유럽 계획 → schengen_loop 강신호
    if europe_plan == "예 (유럽 루트 계획 있음)":
        return "schengen_loop"

    # Q1: 동기 기반 분류
    motivation_map = {
        "번아웃 탈출 / 삶 리셋":        "burnout_escape",
        "비용 최적화 (FIRE / 저물가)":   "fire_optimizer",
        "유럽 여행 루트 (쉥겐 90일)":   "schengen_loop",
        "사회 이탈 (탈조선)":            "expat_freedom",
        "자유로운 삶 / 원격근무":         "slow_nomad",
    }
    if motivation in motivation_map:
        return motivation_map[motivation]

    # Q3: 체류 기간 힌트
    if stay_duration in ("6개월 이상", "3~6개월"):
        return "slow_nomad"
    if stay_duration == "1개월 이하":
        return "fire_optimizer"

    # Q5: 주요 걱정
    concern_map = {
        "비자/체류일 관리":               "schengen_loop",
        "생활비 예산":                    "fire_optimizer",
        "세금/법적 문제":                 "slow_nomad",
        "외로움/커뮤니티":                "burnout_escape",
        "숙소 구하기":                    "slow_nomad",
    }
    return concern_map.get(main_concern, "slow_nomad")


def get_persona_hint(persona_type: str) -> str:
    """페르소나 유형에 맞는 LLM 힌트 문자열 반환."""
    return PERSONA_HINTS.get(persona_type, "")
