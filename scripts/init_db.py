"""Initialize the PostgreSQL schema from scratch."""
from __future__ import annotations

from dotenv import load_dotenv

from utils import db as db_mod


def main() -> None:
    load_dotenv()
    db_mod.ensure_database_ready()
    print("DB schema ready")


if __name__ == "__main__":
    main()
