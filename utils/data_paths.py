"""utils/data_paths.py — 데이터 파일 경로 해석 유틸리티."""
import os
from pathlib import Path


def resolve_data_path(filename: str) -> Path:
    """database/ 우선, 없으면 data/ 폴백."""
    base = Path(__file__).parent.parent
    db_path = base / "database" / filename
    return db_path if db_path.exists() else base / "data" / filename
