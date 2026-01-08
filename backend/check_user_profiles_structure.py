#!/usr/bin/env python3
"""
Check the current user_profiles table structure
"""
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

def check_user_profiles_structure():
    """Check what columns exist in the current user_profiles table"""
    
    print("🔍 Checking current user_profiles table structure...")
    
    try:
        supabase_url = os.getenv("SUPABASE_URL")
        service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        supabase: Client = create_client(supabase_url, service_key)
        print("✅ Connected to Supabase")
        
        # Try to insert a minimal test record to see what columns are required/available
        print("\n📋 Testing table structure by attempting operations...")
        
        # First, try to select with minimal columns
        basic_columns = ['user_id']
        try:
            result = supabase.table('user_profiles').select(','.join(basic_columns)).limit(1).execute()
            print(f"✅ Basic columns work: {basic_columns}")
        except Exception as e:
            print(f"❌ Basic columns failed: {e}")
        
        # Try common columns one by one
        test_columns = [
            'id', 'user_id', 'role', 'is_active', 'created_at', 'updated_at',
            'last_login', 'deactivated_at', 'deactivated_by', 'deactivation_reason',
            'sso_provider', 'sso_user_id'
        ]
        
        working_columns = []
        for column in test_columns:
            try:
                result = supabase.table('user_profiles').select(column).limit(1).execute()
                working_columns.append(column)
                print(f"✅ Column exists: {column}")
            except Exception as e:
                print(f"❌ Column missing: {column} - {e}")
        
        print(f"\n📊 Summary:")
        print(f"   Working columns: {working_columns}")
        print(f"   Missing columns: {[col for col in test_columns if col not in working_columns]}")
        
        # Try to get actual data to see the structure
        if working_columns:
            try:
                result = supabase.table('user_profiles').select(','.join(working_columns)).limit(1).execute()
                if result.data:
                    print(f"\n📄 Sample record structure:")
                    sample = result.data[0]
                    for key, value in sample.items():
                        print(f"   {key}: {type(value).__name__} = {value}")
                else:
                    print(f"\n📄 Table is empty but structure is accessible")
            except Exception as e:
                print(f"⚠️  Could not retrieve sample data: {e}")
        
        return working_columns
        
    except Exception as e:
        print(f"❌ Error checking table structure: {e}")
        return []

if __name__ == "__main__":
    working_columns = check_user_profiles_structure()
    
    if working_columns:
        print(f"\n✅ user_profiles table has {len(working_columns)} accessible columns")
    else:
        print(f"\n❌ Could not determine user_profiles table structure")