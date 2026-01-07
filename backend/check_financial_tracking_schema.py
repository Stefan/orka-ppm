#!/usr/bin/env python3
"""
Check the schema of financial_tracking table
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

def check_schema():
    """Check the financial_tracking table schema"""
    try:
        supabase = get_supabase_client()
        print("✓ Connected to Supabase")
        
        # Get existing data to see the schema
        result = supabase.table("financial_tracking").select("*").limit(5).execute()
        
        if result.data:
            print(f"📊 Found {len(result.data)} records in financial_tracking")
            print("\n🔍 Sample record structure:")
            for i, record in enumerate(result.data):
                print(f"Record {i+1}:")
                for key, value in record.items():
                    print(f"   {key}: {value} ({type(value).__name__})")
                print()
        else:
            print("📊 No records found in financial_tracking")
            
            # Try to insert a minimal record to see what columns are required
            print("\n🧪 Testing minimal insert to discover schema...")
            try:
                test_record = {"test": "value"}
                result = supabase.table("financial_tracking").insert(test_record).execute()
                print("✓ Insert succeeded (unexpected)")
            except Exception as e:
                print(f"❌ Insert failed: {e}")
                # This will show us what columns are expected
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

if __name__ == "__main__":
    success = check_schema()
    sys.exit(0 if success else 1)