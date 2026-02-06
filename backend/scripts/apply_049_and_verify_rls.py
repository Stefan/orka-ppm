#!/usr/bin/env python3
"""
Apply migration 049 (RLS on public.audit_bias_metrics) and verify RLS for the whole DB.

Usage:
  cd backend && python scripts/apply_049_and_verify_rls.py

Requires: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (for applying 049 via exec_sql).
Optional: DATABASE_URL (for running verification query and printing full RLS report).
If DATABASE_URL is not set, run backend/migrations/verify_rls_public_tables.sql
in Supabase SQL Editor to see all public tables' RLS status.
"""

import os
import sys
from pathlib import Path

# backend on path
_backend = Path(__file__).resolve().parent.parent
if str(_backend) not in sys.path:
    sys.path.insert(0, str(_backend))

# Load env before importing config (backend and project root)
from dotenv import load_dotenv
for p in (_backend / ".env", _backend / ".env.local", _backend.parent / ".env", _backend.parent / ".env.local"):
    if p.exists():
        load_dotenv(p)

VERIFY_SQL = """
SELECT n.nspname AS schema_name, c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY n.nspname, c.relname;
"""


def apply_049(supabase) -> bool:
    migrations_dir = _backend / "migrations"
    sql_file = migrations_dir / "049_enable_audit_bias_metrics_rls.sql"
    if not sql_file.exists():
        print(f"❌ Migration file not found: {sql_file}")
        return False
    sql = sql_file.read_text(encoding="utf-8")
    statements = []
    current = []
    for line in sql.split("\n"):
        line = line.strip()
        if line.startswith("--") or not line:
            continue
        current.append(line)
        if line.endswith(";"):
            stmt = " ".join(current).strip()
            if stmt:
                statements.append(stmt)
            current = []
    if current:
        stmt = " ".join(current).strip()
        if stmt:
            statements.append(stmt)
    for i, stmt in enumerate(statements, 1):
        try:
            supabase.rpc("exec_sql", {"sql": stmt}).execute()
            print(f"  ✓ Statement {i}/{len(statements)}")
        except Exception as e:
            print(f"  ✗ Statement {i} failed: {e}")
            if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
                continue
            return False
    return True


def verify_via_psycopg2() -> bool:
    try:
        import psycopg2
    except ImportError:
        return False
    url = os.getenv("DATABASE_URL")
    if not url:
        return False
    try:
        conn = psycopg2.connect(url)
        cur = conn.cursor()
        cur.execute(VERIFY_SQL)
        rows = cur.fetchall()
        cur.close()
        conn.close()
        print("\n--- RLS status (public schema) ---")
        print(f"{'schema_name':<12} {'table_name':<40} {'rls_enabled'}")
        print("-" * 65)
        for r in rows:
            print(f"{r[0]:<12} {r[1]:<40} {r[2]}")
        audit_row = next((r for r in rows if r[1] == "audit_bias_metrics"), None)
        if audit_row:
            if audit_row[2]:
                print("\n✅ audit_bias_metrics: relrowsecurity = true")
            else:
                print("\n❌ audit_bias_metrics: relrowsecurity = false (run 049 or 024)")
        return True
    except Exception as e:
        print(f"Verification query failed: {e}")
        return False


def main() -> int:
    from config.database import service_supabase
    if not service_supabase:
        print("❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required")
        return 1
    print("Applying migration 049_enable_audit_bias_metrics_rls.sql ...")
    if not apply_049(service_supabase):
        return 1
    print("✅ Migration 049 applied.")
    if verify_via_psycopg2():
        pass
    else:
        print("\nTo verify RLS for all public tables, run in Supabase SQL Editor:")
        print("  backend/migrations/verify_rls_public_tables.sql")
        print("Or set DATABASE_URL and install psycopg2-binary to verify from this script.")
        print("\nQuick check for audit_bias_metrics:")
        print("  SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'audit_bias_metrics';")
        print("  Expected: relrowsecurity = true")
    return 0


if __name__ == "__main__":
    sys.exit(main())
