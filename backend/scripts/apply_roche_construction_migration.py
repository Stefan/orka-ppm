#!/usr/bin/env python3
"""
Apply Roche Construction/Engineering PPM Features Migration
Migration 011: Add tables for shareable URLs, simulations, scenarios, change management, PO breakdowns, and Google Suite reports
"""

import os
import sys
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def get_supabase_client() -> Client:
    """Create and return Supabase client"""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_ANON_KEY")
    
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment variables")
    
    return create_client(url, key)

def read_migration_file() -> str:
    """Read the migration SQL file"""
    migration_path = os.path.join(os.path.dirname(__file__), "migrations", "011_roche_construction_ppm_features.sql")
    
    if not os.path.exists(migration_path):
        raise FileNotFoundError(f"Migration file not found: {migration_path}")
    
    with open(migration_path, 'r', encoding='utf-8') as f:
        return f.read()

def apply_migration(supabase: Client, sql_content: str) -> bool:
    """Apply the migration SQL to the database"""
    try:
        print("🚀 Starting Roche Construction/Engineering PPM Features migration...")
        
        # Split SQL into individual statements (basic splitting on semicolons)
        statements = [stmt.strip() for stmt in sql_content.split(';') if stmt.strip()]
        
        print(f"📝 Found {len(statements)} SQL statements to execute")
        
        # Execute each statement
        for i, statement in enumerate(statements, 1):
            # Skip comments and empty statements
            if statement.startswith('--') or not statement.strip():
                continue
            
            try:
                print(f"⚡ Executing statement {i}/{len(statements)}...")
                
                # Use the execute_sql function if available, otherwise use rpc
                try:
                    result = supabase.rpc('execute_sql', {'sql_query': statement}).execute()
                except Exception as rpc_error:
                    # Fallback: try direct SQL execution (this might not work in all Supabase setups)
                    print(f"⚠️  RPC method failed, trying alternative approach: {rpc_error}")
                    # For Supabase, we need to use the REST API directly for DDL statements
                    # This is a limitation - DDL statements typically need to be run in the Supabase dashboard
                    raise Exception("DDL statements must be executed in Supabase SQL Editor. Please run the migration file manually.")
                
                if hasattr(result, 'data') and result.data:
                    print(f"✅ Statement {i} executed successfully")
                else:
                    print(f"⚠️  Statement {i} executed (no data returned)")
                    
            except Exception as stmt_error:
                print(f"❌ Error executing statement {i}: {stmt_error}")
                print(f"Statement: {statement[:100]}...")
                return False
        
        print("🎉 Migration completed successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        return False

def verify_migration(supabase: Client) -> bool:
    """Verify that the migration was applied correctly"""
    try:
        print("🔍 Verifying migration...")
        
        # Check if the new tables exist
        tables_to_check = [
            'shareable_urls',
            'simulation_results', 
            'scenario_analyses',
            'change_requests',
            'po_breakdowns',
            'change_request_po_links',
            'report_templates',
            'generated_reports',
            'shareable_url_access_log'
        ]
        
        for table in tables_to_check:
            try:
                # Try to query the table (this will fail if table doesn't exist)
                result = supabase.table(table).select("count", count="exact").limit(1).execute()
                print(f"✅ Table '{table}' exists and is accessible")
            except Exception as e:
                print(f"❌ Table '{table}' verification failed: {e}")
                return False
        
        print("🎉 Migration verification completed successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Migration verification failed: {e}")
        return False

def main():
    """Main migration function"""
    try:
        print("🏗️  Roche Construction/Engineering PPM Features Migration")
        print("=" * 60)
        
        # Get Supabase client
        supabase = get_supabase_client()
        print("✅ Connected to Supabase")
        
        # Read migration file
        sql_content = read_migration_file()
        print("✅ Migration file loaded")
        
        # Important note about Supabase limitations
        print("\n⚠️  IMPORTANT NOTE:")
        print("Due to Supabase security restrictions, DDL statements (CREATE TABLE, etc.)")
        print("must be executed manually in the Supabase SQL Editor.")
        print("\nPlease:")
        print("1. Copy the contents of migrations/011_roche_construction_ppm_features.sql")
        print("2. Paste and execute it in your Supabase project's SQL Editor")
        print("3. Run this script again with --verify-only flag to verify the migration")
        
        # Check if user wants to verify only
        if len(sys.argv) > 1 and sys.argv[1] == '--verify-only':
            print("\n🔍 Running verification only...")
            success = verify_migration(supabase)
        else:
            print("\n📋 Migration SQL content preview:")
            print("-" * 40)
            print(sql_content[:500] + "..." if len(sql_content) > 500 else sql_content)
            print("-" * 40)
            
            # Ask user to confirm they've run the SQL manually
            response = input("\nHave you executed the migration SQL in Supabase SQL Editor? (y/N): ")
            if response.lower() == 'y':
                success = verify_migration(supabase)
            else:
                print("Please execute the migration SQL in Supabase SQL Editor first.")
                success = False
        
        if success:
            print("\n🎉 Migration completed successfully!")
            print("\nNew features available:")
            print("- 📤 Shareable Project URLs")
            print("- 🎲 Monte Carlo Risk Simulations") 
            print("- 🔄 What-If Scenario Analysis")
            print("- 📋 Integrated Change Management")
            print("- 💰 SAP PO Breakdown Management")
            print("- 📊 Google Suite Report Generation")
            return 0
        else:
            print("\n❌ Migration failed or verification incomplete")
            return 1
            
    except Exception as e:
        print(f"\n❌ Migration script failed: {e}")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)