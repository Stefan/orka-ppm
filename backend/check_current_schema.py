#!/usr/bin/env python3
"""
Check current database schema to understand what exists
"""
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

def check_current_schema():
    """Check the current database schema"""
    
    print("🔍 Checking current database schema...")
    
    try:
        supabase_url = os.getenv("SUPABASE_URL")
        service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        supabase: Client = create_client(supabase_url, service_key)
        print("✅ Connected to Supabase")
        
        # Check user_profiles table structure
        print("\n📋 Checking user_profiles table...")
        try:
            result = supabase.table('user_profiles').select('*').limit(1).execute()
            if result.data:
                print("✅ user_profiles table exists with data:")
                sample_record = result.data[0]
                print("   Columns found:")
                for key, value in sample_record.items():
                    print(f"   - {key}: {type(value).__name__} = {value}")
            else:
                print("✅ user_profiles table exists but is empty")
                # Try to insert a test record to see what columns are expected
                print("   Attempting to determine table structure...")
                
        except Exception as e:
            print(f"❌ Error checking user_profiles: {e}")
        
        # Check what tables exist by trying common ones
        common_tables = [
            'portfolios', 'projects', 'resources', 'risks', 
            'user_activity_log', 'admin_audit_log', 'chat_error_log'
        ]
        
        print(f"\n📋 Checking for other tables...")
        for table_name in common_tables:
            try:
                result = supabase.table(table_name).select('*').limit(1).execute()
                print(f"✅ {table_name} exists")
            except Exception as e:
                if "Could not find the table" in str(e):
                    print(f"❌ {table_name} does not exist")
                else:
                    print(f"⚠️  {table_name}: {e}")
        
    except Exception as e:
        print(f"❌ Schema check failed: {e}")

if __name__ == "__main__":
    check_current_schema()