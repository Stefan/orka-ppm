#!/usr/bin/env python3
"""Validate Project Controls deployment."""

import sys
from pathlib import Path

backend = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend))

def main():
    try:
        from config.database import supabase
        if not supabase:
            print("Database not configured")
            return 1
        print("Project Controls: OK")
        return 0
    except Exception as e:
        print(f"Validation failed: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
