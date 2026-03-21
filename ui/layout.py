# ui/layout.py
import gradio as gr
from ui.theme import create_theme
from ui.loading import get_loading_html, get_cycling_loading_html, LOADING_CLEAR, HEADER_GLOBE_HTML, HEADER_GLOBE_JS

# 모듈 레벨 환율 캐싱 (앱 기동 시 1회 조회 — 이후 재사용)
_EXCHANGE_RATE_USD: float | None = None


def _get_exchange_rate_usd() -> float:
    """USD/KRW 환율을 캐싱하여 반환. 실패 시 기본값(0.000714 ≈ 1,400원/달러) 사용."""
    global _EXCHANGE_RATE_USD
    if _EXCHANGE_RATE_USD is None:
        try:
            import utils.currency
            rates = utils.currency.get_exchange_rates()
            _EXCHANGE_RATE_USD = rates.get("USD", 0.000714)
        except Exception:
            _EXCHANGE_RATE_USD = 0.000714
    return _EXCHANGE_RATE_USD


def check_income_warning(
    income_krw: float,
    preferred_countries: list,
    travel_type: str,
    timeline: str,
    exchange_rate_usd: float | None = None,
) -> tuple:
    """
    입력값 조합을 평가하여 경고 문구 반환. LLM 호출 없음.

    Args:
        income_krw: 월 소득 (만원 단위)
        preferred_countries: 선택된 대륙 목록 (예: ["유럽", "아시아"])
        travel_type: 동반 여부 문자열
        timeline: 목표 체류 기간 문자열
        exchange_rate_usd: USD 환율. None이면 캐싱값 사용.

    Returns:
        tuple: (income_warning_update, submit_warning_update, btn_interactive_update)
    """
    usd_rate = exchange_rate_usd if exchange_rate_usd is not None else _get_exchange_rate_usd()
    income_usd = (income_krw or 0) * 10000 * usd_rate

    income_warnings: list[str] = []
    submit_warnings: list[str] = []
    hard_block = False

    # Case 1: 유럽 소득 기준
    if "유럽" in (preferred_countries or []):
        if income_usd < 1000 and timeline in ["3년 장기 체류", "5년 이상 초장기 체류"]:
            hard_block = True
            submit_warnings.append(
                "🚫 현재 조건으로는 추천 가능한 도시가 없어요. "
                "소득을 높이거나 체류 기간 또는 대륙을 변경해주세요."
            )
        elif income_usd < 1500:
            income_warnings.append(
                "⚠️ 현재 소득으로는 유럽 장기 비자 신청이 어려울 수 있어요. "
                "아시아·중남미로 대륙을 변경하거나 소득 기준이 낮은 도시를 추천받아보세요."
            )
        elif income_usd < 2849:
            income_warnings.append(
                "⚠️ 유럽 비자 최소 소득 기준($2,849~$3,680/월)에 미달할 수 있어요. "
                "추천 결과가 제한될 수 있어요."
            )

    # Case 1: 중남미 소득 기준
    if "중남미" in (preferred_countries or []) and income_usd < 1000:
        income_warnings.append(
            "⚠️ 중남미 일부 국가의 비자 소득 기준($1,000~$3,000/월)에 미달할 수 있어요."
        )

    # Case 2: 가족 전체 동반 소득
    if "가족 전체 동반" in (travel_type or "") and income_usd < 3000:
        income_warnings.append(
            "⚠️ 가족 동반 + 현재 소득 조건으로는 추천 가능한 장기 비자가 제한돼요. "
            "아시아 지역을 중심으로 추천이 진행됩니다."
        )

    # Case 3: 90일 이하
    if timeline == "90일 이하 (비자 없이 탐색)":
        income_warnings.append(
            "ℹ️ 90일 이하 체류는 무비자 국가를 중심으로 추천돼요. "
            "비자 신청 없이 입국 가능한 도시를 안내해드려요."
        )

    return (
        gr.update(
            visible=bool(income_warnings),
            value="\n\n".join(income_warnings) if income_warnings else "",
        ),
        gr.update(
            visible=bool(submit_warnings),
            value="\n\n".join(submit_warnings) if submit_warnings else "",
        ),
        gr.update(interactive=not hard_block),
    )


def check_companion_warning(travel_type: str, has_spouse_income: str) -> dict:
    """
    배우자/가족 동반 시 소득 미입력 경고.

    Returns:
        gr.update dict (visible, value)
    """
    if travel_type in ["배우자·파트너 동반", "가족 전체 동반 (배우자 + 자녀)"]:
        if has_spouse_income != "있음":
            return gr.update(
                visible=True,
                value="ℹ️ 배우자 동반 시 일부 국가는 합산 소득 기준을 적용해요. "
                      "배우자 소득을 입력하면 더 정확한 추천이 가능해요.",
            )
    return gr.update(visible=False, value="")


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
    "아시아",    # TH, MY, ID, PH, VN, JP, GE
    "유럽",      # PT, EE, ES, DE, GR, HR, CZ, HU, SI, MT, RS, AL, MK
    "중남미",    # CR, MX, CO, AR, BR
    # "북미",          # DB 미보유 — city_scores.json에 해당 도시 없음
    # "중동/아프리카",  # DB 미보유 — city_scores.json에 해당 도시 없음
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
:root{--nn-title:#0C447C;--nn-sub:#888780}
.dark{--nn-title:#60A5FA;--nn-sub:#9CA3AF}
@media(prefers-color-scheme:dark){:root:not(.light){--nn-title:#60A5FA;--nn-sub:#9CA3AF}}
.main-header{text-align:center;padding:20px 0 10px}
.main-header h1{font-size:2rem;color:var(--nn-title)}
.main-header p{color:var(--nn-sub);font-size:.95rem}
footer{display:none!important}
"""


def create_layout(advisor_fn, detail_fn):
    with gr.Blocks(title="NomadNavigator AI") as demo:

        # ── 로딩 오버레이 (position:fixed — DOM 위치 무관) ───────────────
        # 초기값: 앱 로딩 중 지구본 애니메이션 표시 → demo.load() 시 클리어
        loading_overlay = gr.HTML(
            value=get_loading_html("앱을 불러오는 중이에요..."),
            elem_id="nnai-loading-overlay",
        )

        # ── 헤더 ──────────────────────────────────────────────────────
        # js_on_load=: 컴포넌트 마운트 시 Gradio가 직접 JS를 실행해줌
        with gr.Column(elem_classes="main-header"):
            gr.HTML(
                value=HEADER_GLOBE_HTML,
                js_on_load=HEADER_GLOBE_JS,
            )
            gr.HTML('<p style="color:#888780;font-size:.95rem;margin:0;">국적 · 소득 · 체류 목적을 입력하면 AI가 최적의 장기 체류 도시를 제안합니다</p>')

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

                        # 소득·동반 인라인 경고 (입력 변경 시 즉시 노출)
                        income_warning = gr.Markdown(visible=False, value="")
                        companion_warning = gr.Markdown(visible=False, value="")

                        # 하드 경고 — 제출 버튼 바로 위
                        submit_warning = gr.Markdown(visible=False, value="")

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
                # Show cycling overlay once — JS cycles messages automatically while
                # advisor_fn blocks. No Python-side sleep needed.
                yield (
                    gr.update(),
                    gr.update(),
                    gr.update(visible=False),
                    gr.update(),
                    gr.update(),
                    get_cycling_loading_html(_STEP1_LOADING),
                )
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
                    LOADING_CLEAR,
                )
            except Exception as e:
                yield (
                    f"⚠️ 오류가 발생했습니다: {str(e)}",
                    {},
                    gr.update(visible=False),
                    gr.update(),
                    gr.update(),
                    LOADING_CLEAR,
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
            outputs=[step1_output, parsed_state, btn_go_step2, tabs, city_choice, loading_overlay],
        )

        # ── 경고 이벤트 연결 ────────────────────────────────────────────
        # check_income_warning: 소득·대륙·동반·기간 변경 시 호출
        # outputs: [income_warning, submit_warning, btn_step1]
        _income_warning_inputs = [income_krw, preferred_countries, travel_type, timeline]
        for _trigger in _income_warning_inputs:
            _trigger.change(
                fn=check_income_warning,
                inputs=_income_warning_inputs,
                outputs=[income_warning, submit_warning, btn_step1],
            )

        # check_companion_warning: 동반 유형 또는 배우자 소득 여부 변경 시 호출
        # outputs: [companion_warning]
        travel_type.change(
            fn=check_companion_warning,
            inputs=[travel_type, has_spouse_income],
            outputs=[companion_warning],
        )
        has_spouse_income.change(
            fn=check_companion_warning,
            inputs=[travel_type, has_spouse_income],
            outputs=[companion_warning],
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
                static_map = {"1순위 도시": 0, "2순위 도시": 1, "3순위 도시": 2}
                if choice in static_map:
                    idx = static_map[choice]
                else:
                    cities = parsed.get("top_cities", [])
                    dynamic_labels = [_city_btn_label(c) for c in cities]
                    idx = dynamic_labels.index(choice) if choice in dynamic_labels else 0
                yield gr.update(), get_cycling_loading_html(_STEP2_LOADING)
                markdown = detail_fn(parsed, city_index=idx)
                yield markdown, LOADING_CLEAR
            except Exception as e:
                import traceback
                traceback.print_exc()
                yield f"⚠️ 오류가 발생했습니다: {str(e)}", LOADING_CLEAR

        btn_step2.click(
            fn=run_step2,
            inputs=[parsed_state, city_choice],
            outputs=[step2_output, loading_overlay],
        )

        # ── 앱 초기 로딩 완료 시 오버레이 클리어 ──────────────────────
        demo.load(fn=lambda: LOADING_CLEAR, outputs=[loading_overlay])

    return demo
