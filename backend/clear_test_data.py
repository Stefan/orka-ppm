#!/usr/bin/env python3
"""
Clear test data from the PPM platform
"""
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# Initialize Supabase client
supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")  # Use service role key for admin operations
)

def clear_test_data():
    """Clear all test data from the database"""
    
    print("🧹 Clearing test data from PPM platform...")
    
    try:
        # Clear in reverse dependency order
        tables_to_clear = [
            "financial_tracking",
            "milestones", 
            "risks",
            "issues",
            "project_resources",
            "projects",
            "resources",
            "portfolios"
        ]
        
        for table in tables_to_clear:
            try:
                result = supabase.table(table).delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
                print(f"✅ Cleared {table}")
            except Exception as e:
                print(f"⚠️  Warning clearing {table}: {e}")
        
        print("\n🎉 Test data cleared successfully!")
        
    except Exception as e:
        print(f"❌ Error clearing test data: {e}")

if __name__ == "__main__":
    clear_test_data()