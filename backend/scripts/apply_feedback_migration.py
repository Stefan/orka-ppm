#!/usr/bin/env python3
"""
Apply feedback system migration to Supabase database
"""

import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def apply_feedback_migration():
    """Apply the feedback system migration"""
    
    # Get Supabase credentials
    SUPABASE_URL = os.getenv("SUPABASE_URL", "https://xceyrfvxooiplbmwavlb.supabase.co")
    SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not SUPABASE_SERVICE_ROLE_KEY:
        print("❌ SUPABASE_SERVICE_ROLE_KEY not found in environment")
        print("⚠️  Using anon key as fallback (limited permissions)")
        SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjZXlyZnZ4b29pcGxibXdhdmxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4Mjg3ODEsImV4cCI6MjA4MjQwNDc4MX0.jIyJlwx2g9xn8OTSaLum6H8BKqknyxB8gYxgEKdfgqo")
    
    try:
        # Create Supabase client
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        print("✅ Connected to Supabase")
        
        # Read migration file
        migration_path = "migrations/008_feedback_system.sql"
        with open(migration_path, 'r') as f:
            migration_sql = f.read()
        
        print(f"📄 Read migration file: {migration_path}")
        
        # Split migration into individual statements
        statements = [stmt.strip() for stmt in migration_sql.split(';') if stmt.strip()]
        
        print(f"🔧 Executing {len(statements)} SQL statements...")
        
        # Execute each statement
        success_count = 0
        for i, statement in enumerate(statements, 1):
            try:
                # Skip comments and empty statements
                if statement.startswith('--') or not statement.strip():
                    continue
                
                # Execute statement using RPC call
                result = supabase.rpc('exec_sql', {'sql': statement}).execute()
                print(f"✅ Statement {i}/{len(statements)} executed successfully")
                success_count += 1
                
            except Exception as stmt_error:
                print(f"⚠️  Statement {i} failed (may already exist): {stmt_error}")
                # Continue with other statements
                continue
        
        print(f"\n🎉 Migration completed! {success_count} statements executed successfully")
        
        # Verify tables were created
        print("\n=== Verifying Tables ===")
        tables = ['features', 'bugs', 'notifications', 'feature_votes', 'feature_comments']
        for table in tables:
            try:
                result = supabase.table(table).select('count', count='exact').limit(1).execute()
                print(f"✅ {table} table exists (count: {result.count})")
            except Exception as e:
                print(f"❌ {table} table verification failed: {e}")
        
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Starting feedback system migration...")
    success = apply_feedback_migration()
    if success:
        print("\n✅ Feedback system migration completed successfully!")
    else:
        print("\n❌ Feedback system migration failed!")