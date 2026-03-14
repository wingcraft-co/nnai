import pytest

# PDF functionality has been removed. All tests in this file are skipped.
pytestmark = pytest.mark.skip(reason="PDF functionality removed (TASK-3)")


def test_generate_report_creates_pdf():
    pass


def test_generate_report_pdf_nonempty():
    pass


def test_generate_report_with_selected_city():
    pass


def test_generate_report_korean_content_no_crash():
    pass
