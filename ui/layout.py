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
    "💻 디지털 노마드 / 원격 근무",
    "👨‍👩‍👧 자녀 교육 동반 장기 체류",
    "🏖️ 은퇴 후 장기 체류",
    "💼 취업 / 창업 장기 체류",
    "🎓 유학 후 장기 체류",
    "🌿 라이프스타일 장기 체류 (삶의 질)",
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
    "🇰🇷 한국어",
    "🇺🇸 영어 (기본 소통)",
    "🇺🇸 영어 (업무 가능 수준)",
    "🇯🇵 일본어",
    "🇨🇳 중국어",
    "🇪🇸 스페인어",
    "🇵🇹 포르투갈어",
]

COUNTRY_OPTIONS = [
    "🇲🇾 말레이시아",
    "🇵🇹 포르투갈",
    "🇹🇭 태국",
    "🇪🇪 에스토니아",
    "🇪🇸 스페인",
    "🇮🇩 인도네시아",
    "🇩🇪 독일",
    "🇬🇪 조지아",
    "🇨🇷 코스타리카",
    "🇬🇷 그리스",
    "🇵🇭 필리핀",
    "🇻🇳 베트남",
]

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


def create_layout(advisor_fn, detail_fn):
    theme = create_theme()

    with gr.Blocks(
        theme=theme,
        title="NomadNavigator AI",
        css="""
        .main-header{text-align:center;padding:20px 0 10px}
        .main-header h1{font-size:2rem;color:#0C447C}
        .main-header p{color:#888780;font-size:.95rem}
        footer{display:none!important}
        """,
    ) as demo:

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

                        nationality = gr.Dropdown(
                            choices=NATIONALITIES, value="Korean",
                            label="국적", info="여권 발급 국가 기준",
                        )
                        income_krw = gr.Slider(
                            minimum=100, maximum=2000, value=500, step=50,
                            label="월 수입 (만원)",
                            info="세전 월 소득 (만원 단위, 예: 500 = 500만원)",
                        )
                        immigration_purpose = gr.Dropdown(
                            choices=STAY_PURPOSES,
                            value=STAY_PURPOSES[0],
                            label="장기 체류 목적",
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
                        timeline = gr.Radio(
                            choices=["1년 단기 체험", "3년 장기 체류", "5년 이상 초장기 체류"],
                            value="1년 단기 체험",
                            label="목표 체류 기간",
                        )
                        preferred_countries = gr.CheckboxGroup(
                            choices=COUNTRY_OPTIONS,
                            label="관심 국가 선택",
                            info="선택한 국가를 우선 고려하지만, AI가 더 적합한 곳을 제안할 수 있어요. 선택 안 하면 전체 고려",
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

        def run_step1(nat, inc, purpose, life, langs, tl, pref_countries):
            try:
                for msg in _STEP1_LOADING:
                    yield msg, gr.update(), gr.update(visible=False), gr.update(), gr.update()
                markdown, cities, parsed = advisor_fn(
                    nat, inc, purpose, life, langs, tl, pref_countries
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
                nationality, income_krw, immigration_purpose,
                lifestyle, languages, timeline, preferred_countries,
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
                    yield [msg]
                markdown = detail_fn(parsed, city_index=idx)
                yield [markdown]
            except Exception as e:
                yield [f"⚠️ 오류가 발생했습니다: {str(e)}"]

        btn_step2.click(
            fn=run_step2,
            inputs=[parsed_state, city_choice],
            outputs=[step2_output],
        )

    return demo
