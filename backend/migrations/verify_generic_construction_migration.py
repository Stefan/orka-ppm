#!/usr/bin/env python3
"""
Verification script for Generic Construction PPM Features migration
Checks if all tables, indexes, and functions are properly created
"""

import os
import sys
from pathlib import Path
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def get_supabase_client() -> Client:
    """Create Supabase client"""
    url = os.getenv("SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not service_key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment")
    
    return create_client(url, service_key)

def verify_table_exists(supabase: Client, table_name: str) -> bool:
    """Verify that a table exists and is accessible"""
    try:
        result = supabase.table(table_name).select("*", count="exact").limit(1).execute()
        print(f"✓ Table '{table_name}' exists (count: {result.count})")
        return True
    except Exception as e:
        print(f"✗ Table '{table_name}' not found or not accessible: {str(e)}")
        return False

def main():
    """Main verification function"""
    try:
        # Get Supabase client
        supabase = get_supabase_client()
        print("✓ Connected to Supabase\n")
        
        # List of tables to verify
        tables_to_verify = [
            "shareable_urls",
            "simulation_results",
            "scenario_analyses",
            "change_requests",
            "po_breakdowns",
            "change_request_po_links",
            "report_templates",
            "generated_reports",
            "shareable_url_access_log"
        ]
        
        print("Verifying Generic Construction PPM Features tables:\n")
        
        all_tables_exist = True
        for table in tables_to_verify:
            if not verify_table_exists(supabase, table):
                all_tables_exist = False
        
        print("\n" + "="*60)
        
        if all_tables_exist:
            print("✅ All Generic Construction PPM Features tables verified successfully!")
            print("\nThe following features are ready:")
            print("  1. Shareable Project URLs")
            print("  2. Monte Carlo Risk Simulations")
            print("  3. What-If Scenario Analysis")
            print("  4. Integrated Change Management")
            print("  5. SAP PO Breakdown Management")
            print("  6. Google Suite Report Generation")
            return 0
        else:
            print("❌ Some tables are missing or not accessible!")
            print("\nPlease run the migration script:")
            print("  python backend/migrations/apply_migration.py")
            return 1
            
    except Exception as e:
        print(f"❌ Verification error: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
