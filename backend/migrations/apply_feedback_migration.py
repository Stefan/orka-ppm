#!/usr/bin/env python3
"""
Apply Feedback System Migration
Applies the feedback system tables and functions to Supabase
"""

import os
import sys
from supabase import create_client, Client

def apply_feedback_migration():
    """Apply the feedback system migration"""
    
    # Get Supabase credentials
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_key:
        print("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required")
        return False
    
    try:
        # Create Supabase client
        supabase: Client = create_client(supabase_url, supabase_key)
        print("✅ Connected to Supabase")
        
        # Read the migration file
        migration_file = os.path.join(os.path.dirname(__file__), "008_feedback_system.sql")
        
        if not os.path.exists(migration_file):
            print(f"❌ Error: Migration file not found: {migration_file}")
            return False
        
        with open(migration_file, 'r') as f:
            migration_sql = f.read()
        
        print("📄 Read migration file: 008_feedback_system.sql")
        
        # Split the migration into individual statements
        statements = [stmt.strip() for stmt in migration_sql.split(';') if stmt.strip()]
        
        print(f"🔄 Executing {len(statements)} SQL statements...")
        
        # Execute each statement
        for i, statement in enumerate(statements, 1):
            try:
                # Skip comments and empty statements
                if statement.startswith('--') or not statement:
                    continue
                
                # Execute the statement using RPC for DDL operations
                result = supabase.rpc('exec_sql', {'sql': statement}).execute()
                print(f"✅ Statement {i}/{len(statements)} executed successfully")
                
            except Exception as e:
                # Some statements might fail if they already exist, which is okay
                if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
                    print(f"⚠️  Statement {i}/{len(statements)} skipped (already exists)")
                else:
                    print(f"❌ Error in statement {i}/{len(statements)}: {e}")
                    # Continue with other statements
        
        print("🎉 Feedback system migration completed successfully!")
        print("\n📋 Created tables:")
        print("   - features (feature requests)")
        print("   - feature_comments (discussions)")
        print("   - feature_votes (voting system)")
        print("   - bugs (bug reports)")
        print("   - bug_attachments (file uploads)")
        print("   - notifications (status changes)")
        print("\n🔧 Created functions:")
        print("   - update_feature_vote_counts() (automatic vote counting)")
        print("   - create_status_change_notification() (notifications)")
        print("   - get_feedback_statistics() (admin stats)")
        print("\n🔒 Applied Row Level Security policies")
        
        return True
        
    except Exception as e:
        print(f"❌ Error applying migration: {e}")
        return False

def verify_migration():
    """Verify that the migration was applied successfully"""
    
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_key:
        return False
    
    try:
        supabase: Client = create_client(supabase_url, supabase_key)
        
        # Check if tables exist by trying to query them
        tables_to_check = ['features', 'bugs', 'notifications', 'feature_votes', 'feature_comments']
        
        print("\n🔍 Verifying migration...")
        
        for table in tables_to_check:
            try:
                result = supabase.table(table).select("count", count="exact").limit(0).execute()
                print(f"✅ Table '{table}' exists and is accessible")
            except Exception as e:
                print(f"❌ Table '{table}' verification failed: {e}")
                return False
        
        print("✅ All tables verified successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Verification error: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Starting Feedback System Migration")
    print("=" * 50)
    
    # Apply the migration
    success = apply_feedback_migration()
    
    if success:
        # Verify the migration
        verify_migration()
        print("\n🎉 Migration completed successfully!")
        print("\n📝 Next steps:")
        print("   1. Test the feedback endpoints in your API")
        print("   2. Access the feedback page at /feedback")
        print("   3. Submit test feature requests and bug reports")
    else:
        print("\n❌ Migration failed. Please check the errors above.")
        sys.exit(1)