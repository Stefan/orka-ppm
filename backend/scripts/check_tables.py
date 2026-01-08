#!/usr/bin/env python3
"""
Check what tables exist in the database
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

def check_tables():
    """Check what tables exist"""
    try:
        supabase = get_supabase_client()
        print("✓ Connected to Supabase")
        
        # List of tables to check
        tables_to_check = [
            'portfolios', 'projects', 'resources', 'risks', 'issues',
            'financial_tracking', 'commitments', 'actuals', 'financial_variances',
            'csv_import_logs', 'organizations', 'workflows', 'milestones'
        ]
        
        existing_tables = []
        missing_tables = []
        
        for table in tables_to_check:
            try:
                result = supabase.table(table).select("*", count="exact").limit(1).execute()
                existing_tables.append(table)
                print(f"✓ {table} - exists")
            except Exception as e:
                missing_tables.append(table)
                print(f"❌ {table} - missing")
        
        print(f"\n📊 Summary:")
        print(f"✓ Existing tables ({len(existing_tables)}): {', '.join(existing_tables)}")
        print(f"❌ Missing tables ({len(missing_tables)}): {', '.join(missing_tables)}")
        
        # Check if financial_tracking has variance-related data
        if 'financial_tracking' in existing_tables:
            try:
                result = supabase.table('financial_tracking').select('*').limit(5).execute()
                print(f"\n💰 financial_tracking sample data:")
                for row in result.data[:3]:
                    print(f"   - {row}")
            except Exception as e:
                print(f"   Error reading financial_tracking: {e}")
        
        return existing_tables, missing_tables
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return [], []

if __name__ == "__main__":
    existing, missing = check_tables()