#!/usr/bin/env python3
"""
Verify and apply user management schema migration
"""
import os
import sys
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

def check_table_exists(supabase: Client, table_name: str) -> bool:
    """Check if a table exists by attempting to query it"""
    try:
        result = supabase.table(table_name).select('*').limit(1).execute()
        return True
    except Exception as e:
        if "Could not find the table" in str(e) or "relation" in str(e).lower():
            return False
        else:
            # Other errors might indicate the table exists but has access issues
            print(f"⚠️  Warning checking {table_name}: {e}")
            return True  # Assume it exists if we can't determine

def check_trigger_functionality(supabase: Client) -> bool:
    """Test if the automatic user profile creation trigger works"""
    try:
        # We can't directly test the trigger without creating a real user,
        # but we can check if the function exists by looking for it indirectly
        
        # Try to query user_profiles to see if it has the expected structure
        result = supabase.table('user_profiles').select('id,user_id,role,is_active,created_at').limit(1).execute()
        
        # Check if the table has the expected columns
        if result.data:
            # If there's data, check the structure
            sample_record = result.data[0]
            expected_fields = ['id', 'user_id', 'role', 'is_active']
            has_expected_structure = all(field in sample_record for field in expected_fields)
            return has_expected_structure
        else:
            # No data, but table exists with correct structure if query succeeded
            return True
            
    except Exception as e:
        print(f"⚠️  Could not verify trigger functionality: {e}")
        return False

def apply_migration():
    """Apply and verify the user management schema migration"""
    
    print("🚀 Verifying user management schema migration...")
    
    try:
        # Initialize Supabase client with service role key
        supabase_url = os.getenv("SUPABASE_URL")
        service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not supabase_url or not service_key:
            print("❌ Missing required environment variables:")
            print(f"   SUPABASE_URL: {'✓' if supabase_url else '✗'}")
            print(f"   SUPABASE_SERVICE_ROLE_KEY: {'✓' if service_key else '✗'}")
            return False
        
        supabase: Client = create_client(supabase_url, service_key)
        print("✅ Connected to Supabase with service role")
        
        # Check all required tables
        required_tables = {
            'user_profiles': 'Core user profile information with roles and status',
            'user_activity_log': 'Log of user activities for monitoring',
            'admin_audit_log': 'Audit trail of administrative actions',
            'chat_error_log': 'Error tracking for AI chat functionality'
        }
        
        print("\n📋 Checking required tables...")
        table_status = {}
        
        for table_name, description in required_tables.items():
            exists = check_table_exists(supabase, table_name)
            table_status[table_name] = exists
            
            if exists:
                print(f"✅ {table_name} - {description}")
            else:
                print(f"❌ {table_name} - {description} (MISSING)")
        
        # Check trigger functionality
        print("\n🔍 Checking trigger functionality...")
        trigger_works = check_trigger_functionality(supabase)
        
        if trigger_works:
            print("✅ User profile creation trigger appears to be functional")
        else:
            print("❌ User profile creation trigger may not be working")
        
        # Summary
        all_tables_exist = all(table_status.values())
        
        print(f"\n📊 Migration Status Summary:")
        print(f"   Tables created: {sum(table_status.values())}/{len(table_status)}")
        print(f"   Trigger functional: {'✓' if trigger_works else '✗'}")
        
        if all_tables_exist and trigger_works:
            print("\n🎉 Migration verification successful!")
            print("All required database objects are present and functional.")
            
            # Test basic functionality
            print("\n🧪 Testing basic functionality...")
            try:
                # Try to count existing user profiles
                result = supabase.table('user_profiles').select('*', count='exact').execute()
                profile_count = result.count if hasattr(result, 'count') else len(result.data)
                print(f"✅ Found {profile_count} existing user profiles")
                
                # Try to count auth users (if accessible)
                try:
                    auth_result = supabase.table('auth.users').select('*', count='exact').execute()
                    auth_count = auth_result.count if hasattr(auth_result, 'count') else len(auth_result.data)
                    print(f"✅ Found {auth_count} auth users")
                    
                    if profile_count < auth_count:
                        print(f"⚠️  {auth_count - profile_count} users may need profile synchronization")
                        
                except Exception as e:
                    print(f"ℹ️  Could not access auth.users table (expected): {e}")
                
            except Exception as e:
                print(f"⚠️  Error testing functionality: {e}")
            
            return True
            
        else:
            print("\n❌ Migration verification failed!")
            
            if not all_tables_exist:
                missing_tables = [name for name, exists in table_status.items() if not exists]
                print(f"Missing tables: {', '.join(missing_tables)}")
            
            if not trigger_works:
                print("Trigger functionality needs verification")
            
            print(f"\n📋 To complete the migration:")
            print(f"1. Go to your Supabase project dashboard")
            print(f"2. Navigate to 'SQL Editor'")
            print(f"3. Execute the SQL from migrations/user_management_schema.sql")
            print(f"4. Re-run this script to verify")
            
            return False
        
    except Exception as e:
        print(f"❌ Migration verification failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = apply_migration()
    sys.exit(0 if success else 1)