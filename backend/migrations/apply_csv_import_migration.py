#!/usr/bin/env python3
"""
Apply CSV Import System Migration
Creates tables for commitments, actuals, financial variances, and import logs
"""

import os
import sys
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from supabase import create_client, Client
from dotenv import load_dotenv

def apply_csv_import_migration():
    """Apply the CSV import system migration"""
    
    # Load environment variables
    load_dotenv()
    
    # Get Supabase credentials
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_service_key:
        print("❌ Error: Missing Supabase credentials")
        print("Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your .env file")
        return False
    
    try:
        # Create Supabase client
        supabase: Client = create_client(supabase_url, supabase_service_key)
        
        print("🚀 Applying CSV Import System Migration...")
        print("📋 Creating tables for CSV import functionality...")
        
        # Test basic connectivity
        try:
            # Try to access an existing table to verify connection
            result = supabase.table('projects').select('id').limit(1).execute()
            print("✅ Database connection verified")
        except Exception as e:
            print(f"❌ Database connection failed: {str(e)}")
            return False
        
        print("✅ Migration preparation complete!")
        print("📊 Tables to be created:")
        print("   - organizations (multi-tenant support)")
        print("   - commitments (purchase orders)")
        print("   - actuals (invoices/payments)")
        print("   - financial_variances (variance analysis)")
        print("   - csv_import_logs (import tracking)")
        print("\n⚠️  Note: Due to Supabase limitations, please run the SQL migration manually:")
        print("   1. Open Supabase Dashboard > SQL Editor")
        print("   2. Copy and paste the contents of 009_csv_import_system.sql")
        print("   3. Execute the SQL script")
        print("   4. Run this script again to verify the migration")
        
        return True
            
    except Exception as e:
        print(f"❌ Error preparing migration: {str(e)}")
        return False

def verify_migration():
    """Verify that the migration was applied correctly"""
    
    load_dotenv()
    
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_service_key:
        return False
    
    try:
        supabase: Client = create_client(supabase_url, supabase_service_key)
        
        # Check if tables exist
        tables_to_check = [
            'organizations',
            'commitments', 
            'actuals',
            'financial_variances',
            'csv_import_logs'
        ]
        
        print("\n🔍 Verifying migration...")
        
        all_tables_exist = True
        for table in tables_to_check:
            try:
                # Try to query the table (this will fail if table doesn't exist)
                result = supabase.table(table).select("*").limit(1).execute()
                print(f"   ✅ {table} table exists")
            except Exception as e:
                print(f"   ❌ {table} table missing or inaccessible")
                all_tables_exist = False
        
        if not all_tables_exist:
            print("\n⚠️  Some tables are missing. Please run the SQL migration manually.")
            return False
        
        # Check if functions exist by trying to call them
        functions_to_check = [
            'get_variance_summary',
            'calculate_financial_variances'
        ]
        
        for function in functions_to_check:
            try:
                # Try to call the function
                result = supabase.rpc(function).execute()
                print(f"   ✅ {function}() function exists")
            except Exception as e:
                print(f"   ❌ {function}() function missing")
                return False
        
        print("✅ All migration components verified successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Error verifying migration: {str(e)}")
        return False

if __name__ == "__main__":
    print("CSV Import System Migration")
    print("=" * 50)
    
    # Apply migration
    success = apply_csv_import_migration()
    
    if success:
        # Try to verify migration
        if verify_migration():
            print("\n🎉 CSV Import System is ready!")
            print("📝 You can now:")
            print("   - Import commitment CSV files (purchase orders)")
            print("   - Import actual CSV files (invoices/payments)")
            print("   - Calculate financial variances automatically")
            print("   - Track import history and errors")
        else:
            print("\n⚠️  Migration verification failed.")
            print("Please run the SQL migration manually in Supabase Dashboard.")
    else:
        print("\n❌ Migration preparation failed. Please check the error messages above.")
        sys.exit(1)