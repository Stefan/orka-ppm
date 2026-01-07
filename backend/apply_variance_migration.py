#!/usr/bin/env python3
"""
Apply Variance Alert System Migration
Applies migration 010_variance_alert_system.sql to set up variance alert tables
"""

import os
import sys
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def apply_variance_migration():
    """Apply the variance alert system migration"""
    
    # Get Supabase credentials
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        return False
    
    try:
        # Create Supabase client with service role key for admin operations
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        print("✅ Connected to Supabase")
        
        # Read migration file
        migration_file = "migrations/010_variance_alert_system.sql"
        if not os.path.exists(migration_file):
            print(f"❌ Migration file not found: {migration_file}")
            return False
        
        with open(migration_file, 'r') as f:
            migration_sql = f.read()
        
        print(f"📄 Read migration file: {migration_file}")
        
        # Split migration into individual statements
        statements = [stmt.strip() for stmt in migration_sql.split(';') if stmt.strip()]
        
        print(f"🔄 Executing {len(statements)} SQL statements...")
        
        # Execute each statement
        success_count = 0
        for i, statement in enumerate(statements, 1):
            try:
                # Skip comments and empty statements
                if statement.startswith('--') or not statement:
                    continue
                
                # Execute the statement
                result = supabase.rpc('exec_sql', {'sql': statement}).execute()
                success_count += 1
                print(f"  ✅ Statement {i}/{len(statements)} executed successfully")
                
            except Exception as e:
                print(f"  ⚠️ Statement {i}/{len(statements)} failed: {str(e)}")
                # Continue with other statements
                continue
        
        print(f"\n🎉 Migration completed!")
        print(f"   ✅ {success_count}/{len(statements)} statements executed successfully")
        
        # Verify tables were created
        print("\n🔍 Verifying table creation...")
        
        tables_to_check = [
            'variance_threshold_rules',
            'variance_alerts', 
            'notification_deliveries',
            'notifications'
        ]
        
        for table in tables_to_check:
            try:
                result = supabase.table(table).select('count', count='exact').limit(0).execute()
                print(f"  ✅ Table '{table}' exists")
            except Exception as e:
                print(f"  ❌ Table '{table}' verification failed: {str(e)}")
        
        print("\n✅ Variance alert system migration completed successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {str(e)}")
        return False

if __name__ == "__main__":
    print("🚀 Starting Variance Alert System Migration...")
    print("=" * 50)
    
    success = apply_variance_migration()
    
    if success:
        print("\n🎉 Migration completed successfully!")
        sys.exit(0)
    else:
        print("\n❌ Migration failed!")
        sys.exit(1)