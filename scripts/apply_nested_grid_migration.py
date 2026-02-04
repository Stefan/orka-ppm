#!/usr/bin/env python3
"""Apply nested grid migration (043)."""

import os
import sys
from pathlib import Path

backend = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend))

def main():
    migration = backend / "migrations" / "043_nested_grid_schema.sql"
    if not migration.exists():
        print("Migration file not found")
        return 1
    print("Copy 043_nested_grid_schema.sql to Supabase SQL Editor and run it.")
    print(f"Path: {migration}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
