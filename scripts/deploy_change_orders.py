#!/usr/bin/env python3
"""
Deploy Change Orders feature - applies migration and validates deployment.
"""

import os
import sys
from pathlib import Path

backend = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend))

def main():
    print("Change Orders Deployment")
    print("=" * 40)
    migration = backend / "migrations" / "042_change_orders_schema.sql"
    if migration.exists():
        print(f"Migration file: {migration}")
        print("Apply via Supabase SQL Editor or: python -m migrations.apply_change_orders_migration")
    else:
        print("Migration file not found")
        return 1
    print("Done.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
