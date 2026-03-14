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
    assert "🇰🇷 한국어" in LANGUAGE_OPTIONS
    assert "🇰🇷 한국어만 가능" not in LANGUAGE_OPTIONS


def test_layout_has_tabs():
    """레이아웃에 Tabs 컴포넌트가 있어야 함"""
    import gradio as gr
    from ui.layout import create_layout
    demo = create_layout(lambda *a: ("", [], {}), lambda *a: "")
    component_types = {type(c).__name__ for c in demo.blocks.values()}
    assert "Tabs" in component_types


def test_layout_has_preferred_countries_checkbox():
    """관심 국가 선택 CheckboxGroup이 있어야 함"""
    import gradio as gr
    from ui.layout import create_layout, COUNTRY_OPTIONS
    demo = create_layout(lambda *a: ("", [], {}), lambda *a: "")
    # COUNTRY_OPTIONS 리스트가 존재하고 12개 국가를 포함해야 함
    assert len(COUNTRY_OPTIONS) == 12
    assert "🇲🇾 말레이시아" in COUNTRY_OPTIONS
    assert "🇻🇳 베트남" in COUNTRY_OPTIONS
