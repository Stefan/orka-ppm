#!/usr/bin/env python3
"""
Apply Financial Tracking Migration - Task 2.5
Creates the financial_tracking table and related components needed for task 2.5
"""

import os
import sys
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from supabase import create_client, Client
from dotenv import load_dotenv

def apply_financial_tracking_migration():
    """Apply the financial tracking migration"""
    
    # Load environment variables
    load_dotenv()
    
    # Initialize Supabase client
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_service_key:
        print("❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables")
        print("Please check your .env file")
        return False
    
    try:
        # Create Supabase client with service role key for admin operations
        supabase: Client = create_client(supabase_url, supabase_service_key)
        print("✓ Connected to Supabase")
        
        # Read the migration SQL file
        migration_file = Path(__file__).parent / "003_financial_tracking_only.sql"
        
        if not migration_file.exists():
            print(f"❌ Error: Migration file not found: {migration_file}")
            return False
        
        with open(migration_file, 'r') as f:
            migration_sql = f.read()
        
        print("✓ Read migration SQL file")
        
        # Note: Supabase Python client doesn't support executing DDL directly
        # We need to provide instructions for manual execution
        
        print("\n" + "="*60)
        print("MANUAL MIGRATION REQUIRED")
        print("="*60)
        print("\nThe financial_tracking table migration cannot be applied automatically.")
        print("Please follow these steps:")
        print("\n1. Open your Supabase project dashboard")
        print("2. Navigate to the SQL Editor (left sidebar)")
        print("3. Copy the contents of: backend/migrations/003_financial_tracking_only.sql")
        print("4. Paste into the SQL Editor and click 'Run'")
        print("\nAlternatively, copy and paste this SQL:")
        print("\n" + "-"*60)
        print(migration_sql)
        print("-"*60)
        
        print("\n5. After running the SQL, verify with:")
        print("   python migrations/verify_schema.py")
        
        return True
        
    except Exception as e:
        print(f"❌ Error connecting to Supabase: {e}")
        return False

if __name__ == "__main__":
    print("Financial Tracking Migration - Task 2.5")
    print("="*50)
    
    success = apply_financial_tracking_migration()
    
    if success:
        print("\n✓ Migration instructions provided")
        print("Please execute the SQL manually in Supabase SQL Editor")
    else:
        print("\n❌ Migration failed")
        sys.exit(1)