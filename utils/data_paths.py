"""utils/data_paths.py — 데이터 파일 경로 해석 유틸리티."""
from pathlib import Path


def resolve_data_path(filename: str) -> Path:
    base = Path(__file__).parent.parent
    return base / "data" / filename
