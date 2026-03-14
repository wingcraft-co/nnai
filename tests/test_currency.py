# tests/test_currency.py
from unittest.mock import patch, MagicMock


def test_get_exchange_rates_returns_dict():
    """get_exchange_rates() 는 딕셔너리를 반환해야 함"""
    with patch("utils.currency.requests.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"rates": {"USD": 0.000714, "EUR": 0.000660}}
        mock_get.return_value = mock_resp

        from utils.currency import get_exchange_rates
        result = get_exchange_rates()

    assert isinstance(result, dict)


def test_get_exchange_rates_has_usd_key():
    """정상 응답 시 USD 키가 포함되어야 함"""
    with patch("utils.currency.requests.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"rates": {"USD": 0.000714}}
        mock_get.return_value = mock_resp

        from utils.currency import get_exchange_rates
        result = get_exchange_rates()

    assert "USD" in result
    assert result["USD"] > 0


def test_get_exchange_rates_on_error_returns_fallback():
    """네트워크 오류 시 fallback 딕셔너리를 반환해야 함"""
    with patch("utils.currency.requests.get", side_effect=Exception("timeout")):
        from utils.currency import get_exchange_rates
        result = get_exchange_rates()

    assert isinstance(result, dict)
    assert "USD" in result


def test_get_exchange_rates_usd_rate_is_positive():
    """USD 환율은 항상 양수여야 함 (fallback 포함)"""
    with patch("utils.currency.requests.get", side_effect=Exception("network error")):
        from utils.currency import get_exchange_rates
        result = get_exchange_rates()

    assert result.get("USD", 0) > 0
