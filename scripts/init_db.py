"""Initialize the PostgreSQL schema from scratch."""
from __future__ import annotations

from dotenv import load_dotenv

from utils import db as db_mod


def main() -> None:
    load_dotenv()
    conn = db_mod.init_db()
    conn.close()
    print("DB schema initialized")


if __name__ == "__main__":
    main()
