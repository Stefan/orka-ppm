#!/usr/bin/env python3
"""
Apply Change Order Management Migration
Applies the change order schema to the database.
Run via: python -m migrations.apply_change_orders_migration
Or: Apply 042_change_orders_schema.sql manually in Supabase SQL Editor
"""

import os
import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

def main():
    """Apply change orders migration."""
    print("=" * 60)
    print("Change Order Management Migration")
    print("=" * 60)
    print()
    print("To apply this migration, run the SQL file in Supabase:")
    print("  1. Open Supabase Dashboard -> SQL Editor")
    print("  2. Create new query")
    print("  3. Copy contents of: backend/migrations/042_change_orders_schema.sql")
    print("  4. Execute")
    print()
    print("Or use the generic migration runner if exec_sql RPC exists:")
    print("  python -m migrations.apply_migration migrations/042_change_orders_schema.sql")
    print()

    migration_file = Path(__file__).parent / "042_change_orders_schema.sql"
    if migration_file.exists():
        sql = migration_file.read_text(encoding="utf-8")
        print("Migration SQL preview (first 500 chars):")
        print("-" * 40)
        print(sql[:500] + "..." if len(sql) > 500 else sql)
        print("-" * 40)

    # Try to apply via apply_migration if available
    try:
        from apply_migration import get_supabase_client, read_migration_file, apply_migration
        from dotenv import load_dotenv
        load_dotenv()

        client = get_supabase_client()
        sql = read_migration_file(migration_file)
        success = apply_migration(client, sql, "042_change_orders_schema")
        if success:
            print("\n✅ Migration applied successfully")
        else:
            print("\n⚠️  Migration may have partial errors - check output above")
    except Exception as e:
        print(f"\n⚠️  Could not auto-apply: {e}")
        print("   Apply 042_change_orders_schema.sql manually in Supabase SQL Editor")

if __name__ == "__main__":
    main()
