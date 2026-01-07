#!/usr/bin/env python3
"""
Apply Budget Alert System Migration
This script applies the budget alert system migration to the Supabase database.
"""

import os
import sys
from pathlib import Path
from supabase import create_client, Client
from dotenv import load_dotenv

# Add parent directory to path to import from main.py
sys.path.append(str(Path(__file__).parent.parent))

# Load environment variables
load_dotenv()

def apply_budget_alert_migration():
    """Apply the budget alert system migration"""
    
    # Get environment variables
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required")
        return False
    
    try:
        # Create Supabase client with service role key for admin operations
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        print("✅ Connected to Supabase")
        
        # Read the migration SQL file
        migration_file = Path(__file__).parent / "004_budget_alert_system.sql"
        
        if not migration_file.exists():
            print(f"❌ Migration file not found: {migration_file}")
            return False
        
        with open(migration_file, 'r') as f:
            migration_sql = f.read()
        
        print("📄 Read migration SQL file")
        
        # Execute the migration
        print("🔄 Applying budget alert system migration...")
        
        # Note: Supabase Python client doesn't support raw SQL execution
        # This would need to be run manually in the Supabase SQL editor
        print("⚠️  Please run the following SQL in your Supabase SQL Editor:")
        print("=" * 60)
        print(migration_sql)
        print("=" * 60)
        
        # Verify tables exist by trying to query them
        try:
            # Test budget_alert_rules table
            rules_response = supabase.table("budget_alert_rules").select("count", count="exact").limit(1).execute()
            print(f"✅ budget_alert_rules table accessible (count: {rules_response.count})")
            
            # Test budget_alerts table  
            alerts_response = supabase.table("budget_alerts").select("count", count="exact").limit(1).execute()
            print(f"✅ budget_alerts table accessible (count: {alerts_response.count})")
            
            print("✅ Budget alert system migration verification successful!")
            return True
            
        except Exception as verify_error:
            print(f"⚠️  Tables not yet created. Please run the SQL migration first.")
            print(f"   Verification error: {verify_error}")
            return False
        
    except Exception as e:
        print(f"❌ Error applying migration: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Budget Alert System Migration")
    print("=" * 40)
    
    success = apply_budget_alert_migration()
    
    if success:
        print("\n✅ Migration completed successfully!")
        print("\nNext steps:")
        print("1. The budget alert system is now ready to use")
        print("2. Create alert rules via the API: POST /budget-alerts/rules/")
        print("3. Monitor budgets via: POST /budget-alerts/monitor")
        print("4. View alerts via: GET /budget-alerts/")
    else:
        print("\n❌ Migration failed. Please check the errors above.")
        sys.exit(1)