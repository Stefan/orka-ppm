#!/usr/bin/env python3
"""
Check what primary key exists on user_profiles table
"""
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

def check_primary_key():
    """Check the current primary key structure"""
    
    print("🔍 Checking current user_profiles primary key...")
    
    try:
        supabase_url = os.getenv("SUPABASE_URL")
        service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        supabase: Client = create_client(supabase_url, service_key)
        print("✅ Connected to Supabase")
        
        # Try to insert a test record to see what happens with IDs
        print("\n📋 Testing primary key behavior...")
        
        # First check if table is empty or has data
        try:
            result = supabase.table('user_profiles').select('*').execute()
            record_count = len(result.data) if result.data else 0
            print(f"   Current records in table: {record_count}")
            
            if result.data:
                sample_record = result.data[0]
                print(f"   Sample record keys: {list(sample_record.keys())}")
                
                # Check if any field looks like a primary key
                for key, value in sample_record.items():
                    if key in ['id', 'user_id'] or 'id' in key.lower():
                        print(f"   Potential PK field: {key} = {value} (type: {type(value).__name__})")
            
        except Exception as e:
            print(f"   Error checking records: {e}")
        
        # Try to insert a minimal record to see what's required
        print(f"\n🧪 Testing what fields are required for insert...")
        
        # We won't actually insert, but we can see what the error tells us
        try:
            # This will likely fail, but the error will tell us about constraints
            result = supabase.table('user_profiles').insert({}).execute()
        except Exception as e:
            print(f"   Insert error (expected): {e}")
            
            # Look for clues about primary key in the error
            error_str = str(e).lower()
            if 'primary key' in error_str or 'unique' in error_str:
                print(f"   💡 Error suggests primary key constraints exist")
        
        return True
        
    except Exception as e:
        print(f"❌ Error checking primary key: {e}")
        return False

if __name__ == "__main__":
    check_primary_key()