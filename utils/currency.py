# utils/currency.py
import requests

_FALLBACK_RATES: dict = {
    "USD": 0.000714,   # 1 KRW = 0.000714 USD  →  1 USD ≈ 1,400 KRW
    "MYR": 0.00312,
    "THB": 0.0246,
    "EUR": 0.000660,
    "SGD": 0.000962,
}


def get_exchange_rates() -> dict:
    """1 KRW 기준 환율 딕셔너리를 반환합니다. 실패 시 fallback 반환."""
    try:
        resp = requests.get(
            "https://api.exchangerate-api.com/v4/latest/KRW",
            timeout=5,
        )
        resp.raise_for_status()
        return resp.json().get("rates", _FALLBACK_RATES.copy())
    except Exception:
        return _FALLBACK_RATES.copy()
