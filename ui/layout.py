# ui/layout.py
import gradio as gr
from ui.theme import create_theme


def _country_code_to_flag(code: str) -> str:
    """Convert 2-letter ISO country code to flag emoji via Unicode regional indicators."""
    code = code.upper()
    return "".join(chr(0x1F1E6 + ord(c) - ord("A")) for c in code)


ISO2_TO_ISO3 = {
    "MY": "MYS", "PT": "PRT", "TH": "THA", "EE": "EST",
    "ES": "ESP", "ID": "IDN", "DE": "DEU", "GE": "GEO",
    "CR": "CRI", "GR": "GRC", "PH": "PHL", "VN": "VNM",
}


def _city_btn_label(city_data: dict) -> str:
    code = city_data.get("country_id", "")
    flag = _country_code_to_flag(code) if code else ""
    iso3 = ISO2_TO_ISO3.get(code, code)
    city = city_data.get("city", "?")
    return f"{flag} {city}, {iso3}".strip()

NATIONALITIES = [
    "Korean", "Japanese", "Chinese", "American",
    "British", "German", "French", "Australian", "Other",
]

STAY_PURPOSES = [
    "💻 원격 근무 / 프리랜서 활동",
    "🌿 삶의 질 향상 (기후·생활비·환경)",
    "🗺️ 현재 노마드 — 다음 베이스 탐색",
    "🏖️ 은퇴 후 장기 거주",
    "💼 창업 / 사업 거점 이전",
]

LIFESTYLE_OPTIONS = [
    "🏖️ 해변",
    "🏙️ 도심",
    "💰 저물가",
    "🔒 안전 우선",
    "🌐 영어권",
    "☀️ 따뜻한 기후",
    "❄️ 선선한 기후",
    "🤝 노마드 커뮤니티",
    "🍜 한국 음식",
]

LANGUAGE_OPTIONS = [
    "영어 불가 / 한국어만",
    "영어 기본 소통 가능",
    "영어 업무 수준",
]

CONTINENT_OPTIONS = [
    "아시아",
    "유럽",
    "중남미",
    "중동/아프리카",
    "북미",
]

LANGUAGE_TOGGLE_OPTIONS = ["한국어", "English"]

# Step 1 로딩 메시지 시퀀스
_STEP1_LOADING = [
    "🔍 프로필을 분석하는 중이에요...",
    "🌍 전 세계 비자 데이터를 검색하는 중이에요...",
    "🤖 AI가 최적의 도시를 선별하는 중이에요...",
    "✨ 거의 다 됐어요!",
]

# Step 2 로딩 메시지 시퀀스
_STEP2_LOADING = [
    "🏙️ 선택한 도시 정보를 불러오는 중이에요...",
    "📋 맞춤 가이드를 작성하는 중이에요...",
]


_APP_CSS = """
.main-header{text-align:center;padding:20px 0 10px}
.main-header h1{font-size:2rem;color:#0C447C}
.main-header p{color:#888780;font-size:.95rem}
footer{display:none!important}
"""


def create_layout(advisor_fn, detail_fn):
    with gr.Blocks(title="NomadNavigator AI") as demo:

        # ── 헤더 ──────────────────────────────────────────────────────
        with gr.Column(elem_classes="main-header"):
            gr.HTML("""
                <h1>🌏 NomadNavigator AI</h1>
                <p>국적 · 소득 · 체류 목적을 입력하면 AI가 최적의 장기 체류 도시를 제안합니다</p>
            """)

        # ── State ──────────────────────────────────────────────────────
        parsed_state = gr.State({})

        # ── Tabs ───────────────────────────────────────────────────────
        with gr.Tabs() as tabs:

            # ── Tab 1: 도시 추천 ───────────────────────────────────────
            with gr.Tab("🔍 도시 추천", id=0):
                with gr.Row():
                    # 입력 패널
                    with gr.Column(scale=1):
                        gr.Markdown("### 📋 내 프로필 입력")

                        ui_language = gr.Radio(
                            choices=["한국어", "English"],
                            value="한국어",
                            label="언어 / Language",
                            info="UI and AI response language",
                        )

                        nationality = gr.Dropdown(
                            choices=NATIONALITIES, value="Korean",
                            label="국적", info="여권 발급 국가 기준",
                        )
                        # P2-1: 복수국적 여부
                        dual_nationality = gr.Checkbox(
                            label="복수국적 보유 (예: 한국-미국 이중국적)",
                            value=False,
                            info="복수국적 보유 시 보조 여권 기준 체류 가능 여부를 추가 안내합니다.",
                        )

                        # P1-1: 동반 여부 + 자녀 연령대
                        travel_type = gr.Radio(
                            label="동반 여부",
                            choices=["혼자 (솔로)", "배우자·파트너 동반", "자녀 동반 (배우자 없이)", "가족 전체 동반 (배우자 + 자녀)"],
                            value="혼자 (솔로)",
                        )
                        with gr.Column(visible=False) as children_info_col:
                            children_ages = gr.CheckboxGroup(
                                label="자녀 연령대 (해당 항목 모두 선택)",
                                choices=["영유아 (7세 이하)", "초등 (8~13세)", "중고등 (14~18세)"],
                            )

                        # 변경 4: 배우자 소득 입력 (배우자 동반 시 노출)
                        with gr.Column(visible=False) as spouse_income_col:
                            has_spouse_income = gr.Radio(
                                label="배우자/파트너 수입이 있나요?",
                                choices=["있음", "없음"],
                                value="없음",
                            )
                            spouse_income_krw = gr.Number(
                                label="배우자 월 수입 (만원)",
                                value=300,
                                minimum=0,
                                visible=False,
                            )

                        # 변경 4: 성인 자녀 소득 (가족 전체 동반 시 노출)
                        with gr.Column(visible=False) as adult_child_income_col:
                            has_adult_child_income = gr.Radio(
                                label="자녀가 20세 이상이며 소득이 있나요?",
                                choices=["있음", "없음"],
                                value="없음",
                            )

                        # P0-1: Slider → Number
                        income_krw = gr.Number(
                            label="월 소득 (만원)", value=500, minimum=100,
                            info="세전 월 소득 기준. 비자 신청 소득 기준 검토에 사용됩니다.",
                        )
                        # P0-2 / 변경 5-Q4: 소득 증빙 형태 (아코디언 Q4 통합, 5개 선택지)
                        income_type = gr.Dropdown(
                            label="원격근무 계약 형태",
                            choices=[
                                "한국 법인 재직 (재직증명서 + 급여명세서)",
                                "해외 법인 재직",
                                "프리랜서 (계약서·해외 송금 내역)",
                                "1인 사업자 (종합소득세 신고 기반)",
                                "무소득 / 은퇴",
                            ],
                            value="한국 법인 재직 (재직증명서 + 급여명세서)",
                            info="비자 신청 시 소득 증빙 방식이 신청 가능 비자를 결정합니다.",
                        )
                        immigration_purpose = gr.Dropdown(
                            choices=STAY_PURPOSES,
                            value=STAY_PURPOSES[0],
                            label="장기 체류 목적",
                        )

                        # 변경 2: 준비 단계 질문 신규 추가
                        readiness_stage = gr.Radio(
                            label="현재 준비 단계",
                            choices=[
                                "막연하게 고민 중 (6개월+ 후 실행 예상)",
                                "구체적으로 준비 중 (3~6개월 내 출국 목표)",
                                "이미 출국했거나 출국 임박",
                            ],
                            value="막연하게 고민 중 (6개월+ 후 실행 예상)",
                        )

                        # P1-4: "90일 이하" 옵션 추가
                        timeline = gr.Radio(
                            choices=["90일 이하 (비자 없이 탐색)", "1년 단기 체험", "3년 장기 체류", "5년 이상 초장기 체류"],
                            value="1년 단기 체험",
                            label="목표 체류 기간",
                        )

                        lifestyle = gr.CheckboxGroup(
                            choices=LIFESTYLE_OPTIONS,
                            label="라이프스타일 선호",
                            info="해당 항목 모두 선택",
                        )
                        languages = gr.CheckboxGroup(
                            choices=LANGUAGE_OPTIONS,
                            label="사용 가능 언어",
                            info="가능한 언어 모두 선택",
                        )
                        preferred_countries = gr.CheckboxGroup(
                            choices=CONTINENT_OPTIONS,
                            label="관심 대륙 선택",
                            info="선택한 대륙의 도시가 추천에 우선 반영됩니다. 선택하지 않으면 전체 대상으로 추천합니다.",
                        )

                        # 변경 5: 아코디언 개편 — Q1 CheckboxGroup 전환, Q5 선택지 확인
                        with gr.Accordion("🔍 내 노마드 유형 진단 (선택사항)", open=False):
                            gr.Markdown("_질문으로 AI가 당신의 노마드 스타일을 파악합니다._")

                            # Q1: Radio → CheckboxGroup, 선택지 순화
                            q_motivation = gr.CheckboxGroup(
                                choices=[
                                    "생활비 절감 / FIRE",
                                    "번아웃 회복 / 환경 전환",
                                    "유럽 장기 체류 (쉥겐 루프)",
                                    "한국 생활 리셋",
                                    "사업/프리랜서 거점 이전",
                                ],
                                label="Q1. 노마드 생활을 고려하는 주된 이유 (복수 선택, 선택사항)",
                                value=[],
                            )
                            # Q2: 유지
                            q_europe = gr.Radio(
                                choices=["예 (유럽 루트 계획 있음)", "아니오"],
                                label="Q2. 유럽에서 활동할 계획이 있나요?",
                                value="아니오",
                            )
                            # Q5: 선택지 PM 문서 기준으로 확인 (·로 통일)
                            q_concern = gr.CheckboxGroup(
                                choices=["비자·체류일 관리", "생활비 예산", "세금·법적 문제", "건강보험 공백", "외로움·커뮤니티", "숙소 구하기"],
                                label="걱정되는 항목을 모두 선택하세요",
                                value=["생활비 예산"],
                            )

                        # event handlers — 동반 구성에 따라 관련 컬럼 표시/숨김
                        travel_type.change(
                            fn=lambda t: (
                                gr.update(visible=t in ["자녀 동반 (배우자 없이)", "가족 전체 동반 (배우자 + 자녀)"]),
                                gr.update(visible=t in ["배우자·파트너 동반", "가족 전체 동반 (배우자 + 자녀)"]),
                                gr.update(visible=t == "가족 전체 동반 (배우자 + 자녀)"),
                            ),
                            inputs=[travel_type],
                            outputs=[children_info_col, spouse_income_col, adult_child_income_col],
                        )
                        has_spouse_income.change(
                            fn=lambda v: gr.update(visible=v == "있음"),
                            inputs=[has_spouse_income],
                            outputs=[spouse_income_krw],
                        )

                        btn_step1 = gr.Button(
                            "🚀 도시 추천 받기", variant="primary", size="lg",
                        )
                        gr.Markdown("_⚠️ 본 서비스는 참고용이며 법적 비자/체류 조언이 아닙니다._")

                    # 결과 패널
                    with gr.Column(scale=1):
                        gr.Markdown("### 📊 추천 도시 TOP 3")
                        step1_output = gr.Markdown(
                            "← 왼쪽에서 프로필을 입력하고 분석을 시작하세요."
                        )

                # Step 1 완료 후 등장하는 Tab 2 진입 버튼
                btn_go_step2 = gr.Button(
                    "📖 상세 가이드 받기 →",
                    variant="secondary",
                    size="lg",
                    visible=False,
                )

            # ── Tab 2: 상세 가이드 ─────────────────────────────────────
            with gr.Tab("📖 상세 가이드", id=1):
                with gr.Row():
                    with gr.Column(scale=1):
                        city_choice = gr.Radio(
                            choices=["1순위 도시", "2순위 도시", "3순위 도시"],
                            value="1순위 도시",
                            label="상세 가이드를 받을 도시 선택",
                        )
                        btn_step2 = gr.Button(
                            "📖 상세 가이드 받기",
                            variant="primary",
                            size="lg",
                        )

                    with gr.Column(scale=2):
                        step2_output = gr.Markdown(
                            "← Step 1을 먼저 완료한 후 도시를 선택하세요."
                        )

        # ── Step 1 이벤트 ──────────────────────────────────────────────
        _FALLBACK_LABELS = ["1순위 도시", "2순위 도시", "3순위 도시"]

        def run_step1(nat, dual_nat, inc, inc_type, purpose, readiness_stage_val, life, langs, tl,
                      pref_countries, ui_lang, q_motiv, q_euro, q_concern_val,
                      travel_type_val, children_ages_val,
                      has_spouse_income_val, spouse_income_krw_val):
            try:
                from utils.persona import diagnose_persona
                persona_type = diagnose_persona(q_motiv, q_euro, None, None, q_concern_val)
                for msg in _STEP1_LOADING:
                    yield msg, gr.update(), gr.update(visible=False), gr.update(), gr.update()
                markdown, cities, parsed = advisor_fn(
                    nat, inc, purpose, life, langs, tl, pref_countries, ui_lang, persona_type,
                    dual_nationality=dual_nat,
                    income_type=inc_type,
                    travel_type=travel_type_val, children_ages=children_ages_val,
                    readiness_stage=readiness_stage_val,
                    has_spouse_income=has_spouse_income_val,
                    spouse_income_krw=spouse_income_krw_val,
                )
                labels = [
                    _city_btn_label(cities[i]) if i < len(cities) else _FALLBACK_LABELS[i]
                    for i in range(3)
                ]
                yield (
                    markdown,
                    parsed,
                    gr.update(visible=True),
                    gr.update(),
                    gr.update(choices=labels, value=labels[0]),
                )
            except Exception as e:
                yield (
                    f"⚠️ 오류가 발생했습니다: {str(e)}",
                    {},
                    gr.update(visible=False),
                    gr.update(),
                    gr.update(),
                )

        btn_step1.click(
            fn=run_step1,
            inputs=[
                nationality, dual_nationality, income_krw, income_type, immigration_purpose,
                readiness_stage,
                lifestyle, languages, timeline, preferred_countries,
                ui_language,
                q_motivation, q_europe, q_concern,
                travel_type, children_ages,
                has_spouse_income, spouse_income_krw,
            ],
            outputs=[step1_output, parsed_state, btn_go_step2, tabs, city_choice],
        )

        # Step 2 탭으로 이동
        btn_go_step2.click(
            fn=lambda: gr.update(selected=1),
            inputs=[],
            outputs=[tabs],
        )

        # ── Step 2 이벤트 ──────────────────────────────────────────────
        def run_step2(parsed, choice):
            try:
                # Support both legacy static labels and new dynamic city labels
                static_map = {"1순위 도시": 0, "2순위 도시": 1, "3순위 도시": 2}
                if choice in static_map:
                    idx = static_map[choice]
                else:
                    cities = parsed.get("top_cities", [])
                    dynamic_labels = [_city_btn_label(c) for c in cities]
                    idx = dynamic_labels.index(choice) if choice in dynamic_labels else 0
                for msg in _STEP2_LOADING:
                    yield msg
                markdown = detail_fn(parsed, city_index=idx)
                yield markdown
            except Exception as e:
                import traceback
                traceback.print_exc()
                yield f"⚠️ 오류가 발생했습니다: {str(e)}"

        btn_step2.click(
            fn=run_step2,
            inputs=[parsed_state, city_choice],
            outputs=[step2_output],
        )

    return demo
