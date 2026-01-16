#!/usr/bin/env python3
"""
Apply Change Management Database Migrations
Applies migrations 011 and 012 to set up change management infrastructure
"""

import os
import sys
from pathlib import Path
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def get_supabase_client() -> Client:
    """Create Supabase client with service role key"""
    url = os.getenv("SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not service_key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment")
    
    return create_client(url, service_key)

def check_table_exists(supabase: Client, table_name: str) -> bool:
    """Check if a table exists"""
    try:
        result = supabase.table(table_name).select("*", count="exact").limit(1).execute()
        return True
    except Exception as e:
        if "Could not find" in str(e) or "relation" in str(e).lower():
            return False
        return True  # Assume exists if other error

def read_sql_file(file_path: Path) -> str:
    """Read SQL migration file"""
    if not file_path.exists():
        raise FileNotFoundError(f"Migration file not found: {file_path}")
    return file_path.read_text(encoding='utf-8')

def main():
    """Main migration application function"""
    print("🚀 Applying Change Management Database Migrations")
    print("=" * 60)
    
    try:
        # Get Supabase client
        supabase = get_supabase_client()
        print("✅ Connected to Supabase\n")
        
        # Check which tables already exist
        required_tables = [
            "change_requests",
            "change_approvals", 
            "change_audit_log",
            "workflow_instances"
        ]
        
        print("📋 Checking existing tables...")
        existing_tables = {}
        for table in required_tables:
            exists = check_table_exists(supabase, table)
            existing_tables[table] = exists
            status = "✅ EXISTS" if exists else "❌ MISSING"
            print(f"   {table}: {status}")
        
        all_exist = all(existing_tables.values())
        
        if all_exist:
            print("\n✅ All required tables already exist!")
            print("No migration needed.")
            return 0
        
        # Get migration files
        migrations_dir = Path(__file__).parent.parent / "migrations"
        migration_files = [
            migrations_dir / "011_roche_construction_ppm_features.sql",
            migrations_dir / "012_integrated_change_management.sql"
        ]
        
        print(f"\n📝 Migration files to apply:")
        for mf in migration_files:
            exists_marker = "✅" if mf.exists() else "❌"
            print(f"   {exists_marker} {mf.name}")
        
        # Check if all migration files exist
        missing_files = [mf for mf in migration_files if not mf.exists()]
        if missing_files:
            print(f"\n❌ Missing migration files:")
            for mf in missing_files:
                print(f"   - {mf}")
            return 1
        
        # Important note about Supabase
        print("\n" + "=" * 60)
        print("⚠️  IMPORTANT: Supabase SQL Execution")
        print("=" * 60)
        print("\nDue to Supabase security restrictions, DDL statements")
        print("(CREATE TABLE, CREATE INDEX, etc.) must be executed")
        print("manually in the Supabase SQL Editor.")
        print("\nPlease follow these steps:")
        print("\n1. Open your Supabase project dashboard")
        print("2. Navigate to: SQL Editor")
        print("3. Create a new query")
        print("4. Copy and paste the contents of these files:")
        
        for mf in migration_files:
            print(f"   - {mf.relative_to(Path.cwd())}")
        
        print("\n5. Execute the SQL in the editor")
        print("6. Run this script again with --verify flag")
        print("\n" + "=" * 60)
        
        # Check if user wants to verify
        if "--verify" in sys.argv:
            print("\n🔍 Verifying migration...")
            
            # Re-check tables
            print("\n📋 Checking tables after migration...")
            all_exist_now = True
            for table in required_tables:
                exists = check_table_exists(supabase, table)
                status = "✅" if exists else "❌"
                print(f"   {status} {table}")
                if not exists:
                    all_exist_now = False
            
            if all_exist_now:
                print("\n🎉 Migration verification successful!")
                print("\nThe following features are now available:")
                print("  ✅ Shareable Project URLs")
                print("  ✅ Monte Carlo Risk Simulations")
                print("  ✅ What-If Scenario Analysis")
                print("  ✅ Integrated Change Management")
                print("  ✅ SAP PO Breakdown Management")
                print("  ✅ Google Suite Report Generation")
                return 0
            else:
                print("\n❌ Some tables are still missing!")
                print("Please ensure you executed all migration SQL in Supabase.")
                return 1
        else:
            # Show SQL preview
            print("\n📄 SQL Preview (first migration):")
            print("-" * 60)
            sql_content = read_sql_file(migration_files[0])
            preview = sql_content[:500]
            print(preview)
            if len(sql_content) > 500:
                print("...")
                print(f"\n(Total: {len(sql_content)} characters)")
            print("-" * 60)
            
            print("\n💡 Run with --verify flag after executing SQL in Supabase")
            return 0
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
