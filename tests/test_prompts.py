import json
from prompts.system    import SYSTEM_PROMPT
from prompts.few_shots import FEW_SHOT_EXAMPLES

def test_system_prompt_is_string():
    assert isinstance(SYSTEM_PROMPT, str)
    assert "JSON" in SYSTEM_PROMPT

def test_few_shots_format():
    assert isinstance(FEW_SHOT_EXAMPLES, list)
    assert len(FEW_SHOT_EXAMPLES) >= 4  # user+assistant 2쌍 = 4 메시지
    for msg in FEW_SHOT_EXAMPLES:
        assert "role" in msg
        assert "content" in msg
        assert msg["role"] in ("user", "assistant")

def test_few_shots_assistant_is_valid_json():
    for msg in FEW_SHOT_EXAMPLES:
        if msg["role"] == "assistant":
            parsed = json.loads(msg["content"])
            assert "top_cities" in parsed
            assert "overall_warning" in parsed

def test_few_shots_pairs():
    """user → assistant 쌍 순서 확인"""
    roles = [m["role"] for m in FEW_SHOT_EXAMPLES]
    for i in range(0, len(roles) - 1, 2):
        assert roles[i] == "user"
        assert roles[i+1] == "assistant"


def test_system_prompt_has_emoji_format_rules():
    """system.py에 출력 형식 규칙(이모티콘/느낌표 금지)이 포함됐는지 확인."""
    from prompts.system import SYSTEM_PROMPT
    assert "이모티콘은 섹션 구분자" in SYSTEM_PROMPT
    assert "느낌표" in SYSTEM_PROMPT


def test_system_prompt_en_has_emoji_format_rules():
    """system_en.py에 출력 형식 규칙 영문 버전이 포함됐는지 확인."""
    from prompts.system_en import SYSTEM_PROMPT_EN
    assert "Emojis only as section dividers" in SYSTEM_PROMPT_EN
    assert "exclamation" in SYSTEM_PROMPT_EN.lower()


def test_ge_labour_warning_in_system_prompt():
    """system.py: GE 노동이민법 경고가 system prompt에 포함됨."""
    from prompts.system import SYSTEM_PROMPT
    assert "노동이민법" in SYSTEM_PROMPT or "노동 활동 허가" in SYSTEM_PROMPT


def test_system_prompt_ees_current_active():
    """system.py: EES 문구가 '시행 예정'이 아닌 '현재 시행 중'을 사용해야 함 (2025년 10월 발효)."""
    from prompts.system import SYSTEM_PROMPT
    assert "2024년 시행 예정" not in SYSTEM_PROMPT
    assert "시행 중" in SYSTEM_PROMPT or "발효" in SYSTEM_PROMPT or "2025년 10월" in SYSTEM_PROMPT
