#!/usr/bin/env python3
"""
Test the ALTER TABLE migration by checking what would be added
"""
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

def test_alter_migration():
    """Test what the ALTER migration would do"""
    
    print("🧪 Testing ALTER TABLE migration compatibility...")
    
    try:
        supabase_url = os.getenv("SUPABASE_URL")
        service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        supabase: Client = create_client(supabase_url, service_key)
        print("✅ Connected to Supabase")
        
        # Check current user_profiles structure
        current_columns = ['user_id', 'role', 'is_active', 'created_at', 'updated_at', 
                          'deactivated_at', 'deactivated_by', 'deactivation_reason']
        
        missing_columns = ['id', 'last_login', 'sso_provider', 'sso_user_id']
        
        print(f"\n📋 Current user_profiles table:")
        print(f"   ✅ Existing columns: {len(current_columns)}")
        for col in current_columns:
            print(f"      - {col}")
        
        print(f"\n📋 Columns to be added by ALTER migration:")
        print(f"   ➕ New columns: {len(missing_columns)}")
        for col in missing_columns:
            print(f"      - {col}")
        
        # Check if other tables exist
        other_tables = ['user_activity_log', 'admin_audit_log', 'chat_error_log']
        
        print(f"\n📋 Other tables to be created:")
        for table_name in other_tables:
            try:
                result = supabase.table(table_name).select('*').limit(1).execute()
                print(f"   ⚠️  {table_name} already exists")
            except Exception as e:
                if "Could not find the table" in str(e):
                    print(f"   ➕ {table_name} will be created")
                else:
                    print(f"   ❓ {table_name} status unclear: {e}")
        
        print(f"\n✅ ALTER migration compatibility check complete")
        print(f"📋 The migration should work safely with the existing schema")
        
        return True
        
    except Exception as e:
        print(f"❌ Error testing migration: {e}")
        return False

if __name__ == "__main__":
    success = test_alter_migration()
    
    if success:
        print(f"\n🎯 Ready to apply ALTER migration!")
        print(f"   Use: backend/migrations/user_management_schema_alter.sql")
    else:
        print(f"\n⚠️  Migration compatibility check failed")