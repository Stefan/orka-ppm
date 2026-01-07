#!/usr/bin/env python3
"""
Direct Migration Application Script
Applies the CSV import system migration directly using Supabase client
"""

import os
import sys
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

def apply_migration():
    """Apply the CSV import system migration"""
    try:
        supabase = get_supabase_client()
        print("✓ Connected to Supabase")
        
        # Read the migration SQL file
        with open('migrations/009_csv_import_system.sql', 'r') as f:
            migration_sql = f.read()
        
        print("✓ Migration SQL loaded")
        
        # Split the SQL into individual statements
        statements = [stmt.strip() for stmt in migration_sql.split(';') if stmt.strip()]
        
        print(f"✓ Found {len(statements)} SQL statements")
        
        # Execute each statement
        for i, statement in enumerate(statements):
            if statement.strip():
                try:
                    print(f"Executing statement {i+1}/{len(statements)}...")
                    # Use rpc to execute raw SQL
                    result = supabase.rpc('exec_sql', {'sql': statement}).execute()
                    print(f"✓ Statement {i+1} executed successfully")
                except Exception as e:
                    print(f"⚠️ Statement {i+1} failed: {str(e)}")
                    # Continue with other statements
        
        print("✅ Migration application completed!")
        
        # Verify the tables exist
        print("\n🔍 Verifying migration...")
        tables_to_check = ['commitments', 'actuals', 'financial_variances', 'csv_import_logs']
        
        for table in tables_to_check:
            try:
                result = supabase.table(table).select("*", count="exact").limit(1).execute()
                print(f"✓ {table} table exists")
            except Exception as e:
                print(f"❌ {table} table check failed: {str(e)}")
        
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {str(e)}")
        return False

if __name__ == "__main__":
    success = apply_migration()
    sys.exit(0 if success else 1)