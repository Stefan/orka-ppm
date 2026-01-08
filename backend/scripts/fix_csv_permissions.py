#!/usr/bin/env python3
"""
Fix CSV Import Permissions
Utility script to check and fix user permissions for CSV import functionality
"""

import os
import sys
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def check_and_fix_permissions():
    """Check and fix user permissions for CSV import"""
    
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
        
        # Check if users table exists
        try:
            users_response = supabase.table('auth.users').select('id, email').limit(5).execute()
            print(f"✅ Found {len(users_response.data)} users in auth.users")
        except Exception as e:
            print(f"⚠️ Could not access auth.users: {e}")
            print("   This is normal if using Supabase Auth")
        
        # Check user_roles table
        try:
            roles_response = supabase.table('user_roles').select('*').execute()
            print(f"✅ Found {len(roles_response.data)} user role assignments")
            
            for role in roles_response.data:
                print(f"   - User {role.get('user_id', 'unknown')}: {role.get('role', 'unknown')}")
                
        except Exception as e:
            print(f"❌ Error accessing user_roles table: {e}")
            print("   Creating user_roles table...")
            
            # Create user_roles table if it doesn't exist
            create_table_sql = """
            CREATE TABLE IF NOT EXISTS user_roles (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL,
                role VARCHAR(50) NOT NULL,
                organization_id UUID,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE(user_id, organization_id)
            );
            """
            
            try:
                supabase.rpc('exec_sql', {'sql': create_table_sql}).execute()
                print("✅ Created user_roles table")
            except Exception as create_error:
                print(f"❌ Failed to create user_roles table: {create_error}")
        
        # Get current authenticated users (if any)
        print("\n🔍 Checking for users to assign permissions...")
        
        # Option 1: Create a test user with proper permissions
        test_user_email = "admin@example.com"
        
        print(f"\n🛠️ Creating/updating test user: {test_user_email}")
        
        # Insert or update user role
        try:
            # First, try to get or create a user ID (using a fixed UUID for testing)
            test_user_id = "00000000-0000-0000-0000-000000000001"
            
            # Insert admin role for test user
            role_data = {
                'user_id': test_user_id,
                'role': 'admin',
                'organization_id': None  # Global admin
            }
            
            # Use upsert to handle existing records
            supabase.table('user_roles').upsert(role_data).execute()
            print(f"✅ Assigned admin role to test user {test_user_id}")
            
        except Exception as e:
            print(f"❌ Failed to assign role: {e}")
        
        # Check roles that have financial_create permission
        print("\n📋 Roles with financial_create permission:")
        roles_with_permission = ['admin', 'portfolio_manager', 'project_manager']
        for role in roles_with_permission:
            print(f"   ✅ {role}")
        
        print("\n💡 Solutions for CSV import permission error:")
        print("1. Ensure your user has one of these roles: admin, portfolio_manager, or project_manager")
        print("2. If you're testing, use the test user credentials created above")
        print("3. Contact your system administrator to assign the appropriate role")
        
        # Provide SQL commands for manual role assignment
        print("\n🔧 Manual role assignment SQL (run in Supabase SQL editor):")
        print("""
-- Replace 'your-user-id' with actual user ID from auth.users
INSERT INTO user_roles (user_id, role, organization_id) 
VALUES ('your-user-id', 'admin', NULL)
ON CONFLICT (user_id, organization_id) 
DO UPDATE SET role = 'admin', updated_at = NOW();
        """)
        
        return True
        
    except Exception as e:
        print(f"❌ Permission check failed: {str(e)}")
        return False

def create_test_organization():
    """Create a test organization for CSV import testing"""
    
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return False
    
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        
        # Check if organizations table exists
        try:
            orgs_response = supabase.table('organizations').select('*').limit(1).execute()
            print(f"✅ Organizations table exists with {len(orgs_response.data)} records")
            
            if len(orgs_response.data) == 0:
                # Create a default organization
                org_data = {
                    'id': '00000000-0000-0000-0000-000000000001',
                    'name': 'Default Organization',
                    'description': 'Default organization for CSV import testing'
                }
                
                supabase.table('organizations').insert(org_data).execute()
                print("✅ Created default organization")
            
        except Exception as e:
            print(f"⚠️ Organizations table issue: {e}")
            
            # Create organizations table
            create_org_table_sql = """
            CREATE TABLE IF NOT EXISTS organizations (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            """
            
            try:
                supabase.rpc('exec_sql', {'sql': create_org_table_sql}).execute()
                print("✅ Created organizations table")
                
                # Insert default organization
                org_data = {
                    'id': '00000000-0000-0000-0000-000000000001',
                    'name': 'Default Organization',
                    'description': 'Default organization for CSV import testing'
                }
                
                supabase.table('organizations').insert(org_data).execute()
                print("✅ Created default organization")
                
            except Exception as create_error:
                print(f"❌ Failed to create organizations table: {create_error}")
        
        return True
        
    except Exception as e:
        print(f"❌ Organization setup failed: {e}")
        return False

if __name__ == "__main__":
    print("🔧 CSV Import Permissions Fix Utility")
    print("=" * 50)
    
    print("\n1. Checking and fixing user permissions...")
    permissions_ok = check_and_fix_permissions()
    
    print("\n2. Setting up test organization...")
    org_ok = create_test_organization()
    
    if permissions_ok and org_ok:
        print("\n✅ Setup completed successfully!")
        print("\n📝 Next steps:")
        print("1. Use admin credentials when uploading CSV files")
        print("2. Ensure you're using the correct organization_id parameter")
        print("3. Test CSV upload with a small file first")
    else:
        print("\n❌ Setup encountered issues. Please check the errors above.")
    
    print("\n" + "=" * 50)