#!/usr/bin/env python3
"""
Simple CSV Tables Creation
Creates the essential tables needed for CSV import functionality
"""

import os
import sys
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def create_csv_tables():
    """Create essential CSV import tables"""
    
    # Get Supabase credentials
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print("❌ Missing Supabase credentials")
        return False
    
    try:
        # Create Supabase client with service role key
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        print("✅ Connected to Supabase with service role")
        
        # Create csv_import_logs table first (essential for CSV import)
        print("📋 Creating csv_import_logs table...")
        
        # Check if table already exists
        try:
            result = supabase.table("csv_import_logs").select("count", count="exact").limit(1).execute()
            print("✅ csv_import_logs table already exists")
            return True
        except:
            print("📝 csv_import_logs table doesn't exist, creating...")
        
        # Create the table using a simple insert that will fail but create the table structure
        # This is a workaround since we can't execute DDL directly
        try:
            # Try to insert a test record to see what happens
            test_record = {
                "import_type": "commitments",
                "file_name": "test.csv",
                "file_size": 100,
                "records_processed": 0,
                "records_imported": 0,
                "records_failed": 0,
                "import_status": "processing",
                "error_details": {},
                "column_mapping": {},
                "validation_errors": [],
                "imported_by": "00000000-0000-0000-0000-000000000001",
                "organization_id": "00000000-0000-0000-0000-000000000001"
            }
            
            result = supabase.table("csv_import_logs").insert(test_record).execute()
            print("✅ csv_import_logs table exists and working")
            
            # Clean up test record
            if result.data:
                supabase.table("csv_import_logs").delete().eq("id", result.data[0]["id"]).execute()
            
            return True
            
        except Exception as e:
            print(f"❌ csv_import_logs table creation failed: {str(e)}")
            
            # The table doesn't exist, we need to create it manually
            print("⚠️ CSV import tables need to be created manually in Supabase Dashboard")
            print("📋 Please run the following SQL in Supabase Dashboard > SQL Editor:")
            print()
            print("-- Essential CSV Import Table")
            print("CREATE TABLE IF NOT EXISTS csv_import_logs (")
            print("  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),")
            print("  import_type TEXT NOT NULL,")
            print("  file_name TEXT NOT NULL,")
            print("  file_size INTEGER,")
            print("  records_processed INTEGER DEFAULT 0,")
            print("  records_imported INTEGER DEFAULT 0,")
            print("  records_failed INTEGER DEFAULT 0,")
            print("  import_status TEXT DEFAULT 'processing',")
            print("  error_details JSONB DEFAULT '{}',")
            print("  column_mapping JSONB DEFAULT '{}',")
            print("  validation_errors JSONB DEFAULT '[]',")
            print("  imported_by TEXT,")
            print("  organization_id TEXT DEFAULT 'DEFAULT',")
            print("  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),")
            print("  completed_at TIMESTAMP WITH TIME ZONE")
            print(");")
            print()
            print("-- Enable RLS")
            print("ALTER TABLE csv_import_logs ENABLE ROW LEVEL SECURITY;")
            print()
            print("-- Allow all operations for now (development)")
            print("CREATE POLICY \"Allow all operations on csv_import_logs\" ON csv_import_logs FOR ALL USING (true);")
            
            return False
        
    except Exception as e:
        print(f"❌ Connection failed: {str(e)}")
        return False

if __name__ == "__main__":
    print("CSV Import Tables Creation")
    print("=" * 40)
    
    success = create_csv_tables()
    
    if success:
        print("\n🎉 CSV import tables ready!")
        sys.exit(0)
    else:
        print("\n💥 Manual setup required!")
        sys.exit(1)