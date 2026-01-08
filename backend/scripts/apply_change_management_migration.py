#!/usr/bin/env python3
"""
Apply the integrated change management migration
"""

import sys
from pathlib import Path

# Add the backend directory to the Python path
sys.path.append(str(Path(__file__).parent))

from config.database import supabase

def apply_migration():
    """Apply the change management migration"""
    
    if not supabase:
        print("❌ No Supabase connection available")
        return False
    
    try:
        # Read the migration file
        migration_file = Path(__file__).parent / "migrations" / "012_integrated_change_management.sql"
        
        if not migration_file.exists():
            print(f"❌ Migration file not found: {migration_file}")
            return False
        
        print(f"📖 Migration file ready: {migration_file}")
        print("⚠️  Manual Action Required:")
        print("   The Supabase Python client cannot execute DDL statements directly.")
        print("   Please apply the migration manually via Supabase SQL Editor:")
        print("   1. Open your Supabase project dashboard")
        print("   2. Go to SQL Editor")
        print(f"   3. Copy and paste the contents of: {migration_file}")
        print("   4. Execute the SQL to create the change management schema")
        print("")
        print("   Alternatively, use the Supabase CLI:")
        print("   supabase db push")
        print("")
        
        # Test if tables exist by trying to query them
        tables_to_check = [
            "change_requests",
            "change_templates", 
            "change_approvals",
            "change_impacts",
            "change_implementations",
            "change_audit_log",
            "change_notifications"
        ]
        
        print("🔍 Checking if change management tables exist...")
        tables_exist = 0
        
        for table in tables_to_check:
            try:
                result = supabase.table(table).select("count", count="exact").limit(0).execute()
                print(f"✅ Table '{table}' exists")
                tables_exist += 1
            except Exception as e:
                print(f"❌ Table '{table}' does not exist: {str(e)}")
        
        if tables_exist == len(tables_to_check):
            print(f"\n🎉 All {len(tables_to_check)} change management tables exist!")
            print("✅ Change management schema is ready")
            return True
        else:
            print(f"\n⚠️  Only {tables_exist}/{len(tables_to_check)} tables exist")
            print("   Please run the migration SQL manually as described above")
            return False
        
    except Exception as e:
        print(f"❌ Migration check failed: {e}")
        return False

if __name__ == "__main__":
    success = apply_migration()
    if success:
        print("\n🎉 Change management migration verification completed!")
    else:
        print("\n❌ Change management migration requires manual intervention")
        sys.exit(1)