#!/usr/bin/env python3
"""
Apply user management schema migration using direct table operations
"""
import os
import sys
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

def apply_migration():
    """Apply the user management schema migration using direct operations"""
    
    print("🚀 Applying user management schema migration...")
    
    try:
        # Initialize Supabase client with service role key
        supabase: Client = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        )
        
        print("📄 Creating user management tables...")
        
        # Create user_profiles table by inserting a test record and letting Supabase create the structure
        print("   Creating user_profiles table...")
        try:
            # Try to create the table structure by attempting an insert
            # This will fail but will help us understand the current state
            result = supabase.table('user_profiles').select('*').limit(1).execute()
            print("   ✅ user_profiles table already exists")
        except Exception as e:
            if "Could not find the table" in str(e):
                print("   ℹ️  user_profiles table needs to be created manually in Supabase dashboard")
                print("      Please create the table with the following structure:")
                print("      - id: UUID (Primary Key)")
                print("      - user_id: UUID (Foreign Key to auth.users)")
                print("      - role: VARCHAR(50) DEFAULT 'user'")
                print("      - is_active: BOOLEAN DEFAULT true")
                print("      - last_login: TIMESTAMP WITH TIME ZONE")
                print("      - deactivated_at: TIMESTAMP WITH TIME ZONE")
                print("      - deactivated_by: UUID")
                print("      - deactivation_reason: VARCHAR(255)")
                print("      - sso_provider: VARCHAR(50)")
                print("      - sso_user_id: VARCHAR(255)")
                print("      - created_at: TIMESTAMP WITH TIME ZONE DEFAULT NOW()")
                print("      - updated_at: TIMESTAMP WITH TIME ZONE DEFAULT NOW()")
            else:
                print(f"   ❌ Error checking user_profiles: {e}")
        
        # Check other tables
        tables_to_check = [
            ('user_activity_log', [
                'id: UUID (Primary Key)',
                'user_id: UUID (Foreign Key to auth.users)',
                'action: VARCHAR(100)',
                'details: JSONB',
                'ip_address: INET',
                'user_agent: TEXT',
                'created_at: TIMESTAMP WITH TIME ZONE DEFAULT NOW()'
            ]),
            ('admin_audit_log', [
                'id: UUID (Primary Key)',
                'admin_user_id: UUID (Foreign Key to auth.users)',
                'target_user_id: UUID (Foreign Key to auth.users)',
                'action: VARCHAR(100)',
                'details: JSONB',
                'created_at: TIMESTAMP WITH TIME ZONE DEFAULT NOW()'
            ]),
            ('chat_error_log', [
                'id: UUID (Primary Key)',
                'user_id: UUID (Foreign Key to auth.users)',
                'session_id: VARCHAR(255)',
                'error_type: VARCHAR(50)',
                'error_message: TEXT',
                'status_code: INTEGER',
                'query_text: TEXT',
                'retry_count: INTEGER DEFAULT 0',
                'resolved: BOOLEAN DEFAULT false',
                'created_at: TIMESTAMP WITH TIME ZONE DEFAULT NOW()'
            ])
        ]
        
        for table_name, columns in tables_to_check:
            print(f"   Checking {table_name} table...")
            try:
                result = supabase.table(table_name).select('*').limit(1).execute()
                print(f"   ✅ {table_name} table already exists")
            except Exception as e:
                if "Could not find the table" in str(e):
                    print(f"   ℹ️  {table_name} table needs to be created manually")
                    print(f"      Columns for {table_name}:")
                    for column in columns:
                        print(f"      - {column}")
                    print()
                else:
                    print(f"   ❌ Error checking {table_name}: {e}")
        
        print("\n📋 Manual Setup Instructions:")
        print("Since Supabase doesn't allow direct SQL execution via the API,")
        print("please create these tables manually in your Supabase dashboard:")
        print()
        print("1. Go to your Supabase project dashboard")
        print("2. Navigate to 'Table Editor'")
        print("3. Create the tables with the structures shown above")
        print("4. Set up Row Level Security (RLS) policies as needed")
        print()
        print("Alternatively, you can run the SQL migration directly in the SQL Editor:")
        print("Copy the contents of backend/migrations/user_management_schema.sql")
        print("and execute it in the Supabase SQL Editor.")
        
        print("\n✅ Migration preparation completed!")
        
    except Exception as e:
        print(f"❌ Migration preparation failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    apply_migration()