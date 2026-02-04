#!/usr/bin/env python3
"""
Validate Change Orders deployment - checks that tables exist.
"""

import os
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
        # Check change_orders table exists
        r = supabase.table("change_orders").select("id").limit(1).execute()
        print("change_orders table: OK")
        return 0
    except Exception as e:
        print(f"Validation failed: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
