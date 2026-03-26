"""utils/data_paths.py — 데이터 파일 경로 해석 유틸리티."""
import os
from pathlib import Path


def resolve_data_path(filename: str) -> Path:
    base = Path(__file__).parent.parent
    db_path = base / "data" / filename
    return db_path
