#!/usr/bin/env python3
"""
Apply Unified Registers migration (061).

Creates the table public.registers and RLS policies.
Required for the Registers feature (TopBar → Analysis → Registers).

Prerequisites:
  - Migration 058 (RLS sub-organizations) should be applied first, so that
    get_user_visible_org_ids() and is_org_admin() exist for RLS policies.

Usage:
  Run the SQL in Supabase SQL Editor (see instructions below).
  From repo root:
    cd backend && python migrations/apply_registers_migration.py
"""

from pathlib import Path


def main():
    migration_file = Path(__file__).parent / "061_registers_unified.sql"
    print("=" * 60)
    print("Unified Registers migration (061)")
    print("=" * 60)
    print()
    print("The table 'public.registers' is required for the Registers feature.")
    print("To create it:")
    print()
    print("1. Open your Supabase project → SQL Editor")
    print("2. Copy the contents of:")
    print(f"   {migration_file}")
    print("3. Paste and run the SQL")
    print()
    print("If RLS policies fail (e.g. function get_user_visible_org_ids does not exist),")
    print("apply migration 058_rls_sub_organizations.sql first.")
    print()
    print("After applying, the schema cache usually updates automatically.")
    print("If the app still reports 'table not in schema cache', wait a few seconds")
    print("or trigger a schema reload in Supabase (e.g. restart pooler or re-run a simple query).")
    print("=" * 60)


if __name__ == "__main__":
    main()
