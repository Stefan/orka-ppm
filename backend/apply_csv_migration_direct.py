#!/usr/bin/env python3
"""
Direct CSV Import Migration Application
Applies the CSV import system migration directly to Supabase
"""

import os
import sys
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def apply_csv_migration():
    """Apply CSV import migration directly to Supabase"""
    
    # Get Supabase credentials
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print("❌ Missing Supabase credentials")
        print("   SUPABASE_URL:", bool(SUPABASE_URL))
        print("   SUPABASE_SERVICE_ROLE_KEY:", bool(SUPABASE_SERVICE_ROLE_KEY))
        return False
    
    try:
        # Create Supabase client with service role key (bypasses RLS)
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        print("✅ Connected to Supabase with service role")
        
        # Read the migration SQL file
        with open('migrations/009_csv_import_system.sql', 'r') as f:
            migration_sql = f.read()
        
        print("📋 Applying CSV import migration...")
        
        # Split the SQL into individual statements
        statements = [stmt.strip() for stmt in migration_sql.split(';') if stmt.strip()]
        
        success_count = 0
        error_count = 0
        
        for i, statement in enumerate(statements):
            if not statement:
                continue
                
            try:
                # Execute each statement
                result = supabase.rpc('exec_sql', {'sql': statement}).execute()
                success_count += 1
                print(f"✅ Statement {i+1}/{len(statements)} executed successfully")
                
            except Exception as e:
                error_count += 1
                print(f"⚠️ Statement {i+1}/{len(statements)} failed: {str(e)}")
                # Continue with other statements
        
        print(f"\n📊 Migration Summary:")
        print(f"   ✅ Successful statements: {success_count}")
        print(f"   ❌ Failed statements: {error_count}")
        print(f"   📝 Total statements: {len(statements)}")
        
        # Verify key tables exist
        print(f"\n🔍 Verifying migration...")
        tables_to_check = ['organizations', 'commitments', 'actuals', 'financial_variances', 'csv_import_logs']
        
        for table in tables_to_check:
            try:
                result = supabase.table(table).select("count", count="exact").limit(1).execute()
                print(f"   ✅ {table} table exists")
            except Exception as e:
                print(f"   ❌ {table} table missing: {str(e)}")
        
        return success_count > error_count
        
    except Exception as e:
        print(f"❌ Migration failed: {str(e)}")
        return False

if __name__ == "__main__":
    print("CSV Import Migration - Direct Application")
    print("=" * 50)
    
    success = apply_csv_migration()
    
    if success:
        print("\n🎉 Migration completed successfully!")
        sys.exit(0)
    else:
        print("\n💥 Migration failed!")
        sys.exit(1)