def test_create_theme_returns_gradio_theme():
    import gradio as gr
    from ui.theme import create_theme
    theme = create_theme()
    assert isinstance(theme, gr.themes.Base)

def test_create_layout_returns_blocks():
    import gradio as gr
    from ui.layout import create_layout
    dummy_fn = lambda *args: ("결과 마크다운", [], {})
    dummy_detail_fn = lambda *args: ("상세 결과", None)
    demo = create_layout(dummy_fn, dummy_detail_fn)
    assert isinstance(demo, gr.Blocks)

def test_create_layout_has_correct_inputs():
    import gradio as gr
    from ui.layout import create_layout
    demo = create_layout(lambda *a: ("", [], {}), lambda *a: "")
    component_types = {type(c).__name__ for c in demo.blocks.values()}
    assert "Dropdown"      in component_types
    assert "Slider"        in component_types
    assert "CheckboxGroup" in component_types
    assert "Radio"         in component_types

def test_language_options_has_korean():
    from ui.layout import LANGUAGE_OPTIONS
    # P3: simplified to 3 choices (no flag emojis)
    assert any("한국어" in opt for opt in LANGUAGE_OPTIONS)
    assert len(LANGUAGE_OPTIONS) == 3


def test_layout_has_tabs():
    """레이아웃에 Tabs 컴포넌트가 있어야 함"""
    import gradio as gr
    from ui.layout import create_layout
    demo = create_layout(lambda *a: ("", [], {}), lambda *a: "")
    component_types = {type(c).__name__ for c in demo.blocks.values()}
    assert "Tabs" in component_types


def test_layout_has_preferred_countries_checkbox():
    """관심 대륙 선택 CheckboxGroup이 있어야 함"""
    import gradio as gr
    from ui.layout import create_layout, CONTINENT_OPTIONS
    demo = create_layout(lambda *a: ("", [], {}), lambda *a: "")
    # CONTINENT_OPTIONS: DB 보유 대륙만 노출 (북미·중동/아프리카 DB 미보유 제외)
    assert len(CONTINENT_OPTIONS) == 3
    assert "아시아" in CONTINENT_OPTIONS
    assert "유럽" in CONTINENT_OPTIONS
    assert "중남미" in CONTINENT_OPTIONS
    assert "북미" not in CONTINENT_OPTIONS
    assert "중동/아프리카" not in CONTINENT_OPTIONS


# ── TASK-2a: flag helper and city button label tests ──────────────────────────

def test_country_code_to_flag_malaysia():
    from ui.layout import _country_code_to_flag
    assert _country_code_to_flag("MY") == "🇲🇾"


def test_country_code_to_flag_portugal():
    from ui.layout import _country_code_to_flag
    assert _country_code_to_flag("PT") == "🇵🇹"


def test_country_code_to_flag_lowercase():
    from ui.layout import _country_code_to_flag
    # lowercase input should also work
    assert _country_code_to_flag("de") == "🇩🇪"


def test_city_btn_label_full():
    from ui.layout import _city_btn_label
    city_data = {"city": "Kuala Lumpur", "country_id": "MY"}
    label = _city_btn_label(city_data)
    assert "🇲🇾" in label
    assert "Kuala Lumpur" in label


def test_city_btn_label_unknown_country():
    from ui.layout import _city_btn_label
    city_data = {"city": "SomeCity", "country_id": "XX"}
    label = _city_btn_label(city_data)
    assert "SomeCity" in label


def test_city_btn_label_missing_country_id():
    from ui.layout import _city_btn_label
    city_data = {"city": "TestCity"}
    label = _city_btn_label(city_data)
    assert "TestCity" in label


def test_city_btn_label_missing_city():
    from ui.layout import _city_btn_label
    city_data = {"country_id": "TH"}
    label = _city_btn_label(city_data)
    assert "🇹🇭" in label
    assert "?" in label


class TestCheckIncomeWarning:
    """check_income_warning() — 소득·대륙 조합 경고 반환"""

    def _call(self, income_krw, preferred_countries, travel_type, timeline, usd_rate=0.000714):
        from ui.layout import check_income_warning
        return check_income_warning(income_krw, preferred_countries, travel_type, timeline, usd_rate)

    def test_europe_soft_warning_below_2849(self):
        """유럽 + ~$2,142/월 → income_warning 가시 (300만원 × 10000 × 0.000714 ≈ $2,142)"""
        income_w, submit_w, btn = self._call(300, ["유럽"], "혼자 (솔로)", "1년 단기 체험")
        assert income_w["visible"] is True
        assert "2,849" in income_w["value"]
        assert submit_w["visible"] is False
        assert btn["interactive"] is True

    def test_europe_hard_warning_below_1500(self):
        """유럽 + ~$1,428/월 → 하드 경고 (200만원 × 10000 × 0.000714 ≈ $1,428)"""
        income_w, submit_w, btn = self._call(200, ["유럽"], "혼자 (솔로)", "1년 단기 체험")
        assert income_w["visible"] is True
        assert "아시아" in income_w["value"] or "중남미" in income_w["value"]
        assert btn["interactive"] is True

    def test_europe_hard_block_long_stay(self):
        """유럽 + ~$714/월 + 3년 → submit_warning 가시 + btn 비활성 (100만원 × 10000 × 0.000714 ≈ $714)"""
        income_w, submit_w, btn = self._call(100, ["유럽"], "혼자 (솔로)", "3년 장기 체류")
        assert submit_w["visible"] is True
        assert btn["interactive"] is False

    def test_no_warning_asia_low_income(self):
        """아시아 + 저소득 → 경고 없음"""
        income_w, submit_w, btn = self._call(300, ["아시아"], "혼자 (솔로)", "1년 단기 체험")
        assert income_w["visible"] is False
        assert btn["interactive"] is True

    def test_latam_warning_below_1000(self):
        """중남미 + ~$714/월 → 중남미 소득 경고 (100만원 × 10000 × 0.000714 ≈ $714)"""
        income_w, submit_w, btn = self._call(100, ["중남미"], "혼자 (솔로)", "1년 단기 체험")
        assert income_w["visible"] is True
        assert "중남미" in income_w["value"]

    def test_family_warning_low_income(self):
        """가족 전체 동반 + ~$2,142/월 → 가족 경고 (300만원 × 10000 × 0.000714 ≈ $2,142 < $3,000)"""
        income_w, submit_w, btn = self._call(300, [], "가족 전체 동반 (배우자 + 자녀)", "1년 단기 체험")
        assert income_w["visible"] is True
        assert "가족" in income_w["value"]

    def test_90day_info_message(self):
        """90일 이하 → ℹ️ 정보 메시지"""
        income_w, submit_w, btn = self._call(500, [], "혼자 (솔로)", "90일 이하 (비자 없이 탐색)")
        assert income_w["visible"] is True
        assert "무비자" in income_w["value"]

    def test_no_warning_clean_profile(self):
        """아무 조건 불충족 없는 프로필 → 모두 hidden"""
        income_w, submit_w, btn = self._call(5000, ["아시아"], "혼자 (솔로)", "1년 단기 체험")
        assert income_w["visible"] is False
        assert submit_w["visible"] is False
        assert btn["interactive"] is True


class TestCheckCompanionWarning:
    """check_companion_warning() — 배우자 소득 미입력 경고"""

    def _call(self, travel_type, has_spouse_income):
        from ui.layout import check_companion_warning
        return check_companion_warning(travel_type, has_spouse_income)

    def test_spouse_no_income_warning(self):
        """배우자 동반 + 소득 없음 → 경고 가시"""
        result = self._call("배우자·파트너 동반", "없음")
        assert result["visible"] is True
        assert "합산 소득" in result["value"]

    def test_spouse_has_income_no_warning(self):
        """배우자 동반 + 소득 있음 → 경고 없음"""
        result = self._call("배우자·파트너 동반", "있음")
        assert result["visible"] is False

    def test_solo_no_warning(self):
        """혼자 → 경고 없음"""
        result = self._call("혼자 (솔로)", "없음")
        assert result["visible"] is False

    def test_family_no_spouse_income_warning(self):
        """가족 전체 동반 + 소득 없음 → 경고 가시"""
        result = self._call("가족 전체 동반 (배우자 + 자녀)", "없음")
        assert result["visible"] is True


# ── Loading overlay tests ──────────────────────────────────────────────────────

def test_loading_clear_is_empty_string():
    from ui.loading import LOADING_CLEAR
    assert LOADING_CLEAR == ""

def test_get_loading_html_returns_string():
    from ui.loading import get_loading_html
    assert isinstance(get_loading_html("테스트"), str)

def test_get_loading_html_contains_message():
    from ui.loading import get_loading_html
    html = get_loading_html("🔍 분석 중...")
    assert "🔍 분석 중..." in html

def test_get_loading_html_has_fixed_overlay():
    from ui.loading import get_loading_html
    html = get_loading_html("test")
    assert "position:fixed" in html
    assert "z-index:9999" in html
    assert "backdrop-filter" in html

def test_get_loading_html_has_canvas():
    from ui.loading import get_loading_html
    html = get_loading_html("test")
    assert 'id="nnai-globe-canvas"' in html
    assert 'width="88"' in html
    assert 'height="108"' in html

def test_get_loading_html_has_raf_guard():
    from ui.loading import get_loading_html
    html = get_loading_html("test")
    assert "__nnaiRAF" in html
    assert "cancelAnimationFrame" in html

def test_get_loading_html_has_canvas_connected_check():
    from ui.loading import get_loading_html
    html = get_loading_html("test")
    assert "isConnected" in html

def test_get_loading_html_different_messages_are_independent():
    from ui.loading import get_loading_html
    html1 = get_loading_html("메시지1")
    html2 = get_loading_html("메시지2")
    assert "메시지1" in html1
    assert "메시지2" in html2
    assert "메시지1" not in html2


# ── Loading overlay wired into layout ─────────────────────────────────────────

def test_layout_has_loading_overlay_html_component():
    """layout must declare a gr.HTML with elem_id='nnai-loading-overlay'."""
    import gradio as gr
    from ui.layout import create_layout
    demo = create_layout(lambda *a, **kw: ("md", [], {}), lambda *a: "detail")
    elem_ids = {
        getattr(c, "elem_id", None)
        for c in demo.blocks.values()
        if isinstance(c, gr.HTML)
    }
    assert "nnai-loading-overlay" in elem_ids, (
        f"gr.HTML with elem_id='nnai-loading-overlay' not found. "
        f"Found HTML elem_ids: {elem_ids}"
    )
