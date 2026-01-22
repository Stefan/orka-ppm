#!/usr/bin/env python3
"""
Simple script to create an admin user in Supabase.

This script creates a user directly in Supabase Auth and assigns admin role.
"""

import sys
import os
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from config.database import supabase, service_supabase
from auth.rbac import UserRole, DEFAULT_ROLE_PERMISSIONS


def create_admin_user(email: str, password: str):
    """Create an admin user with email and password"""
    try:
        print("🚀 Creating Admin User")
        print("=" * 50)
        print(f"📧 Email: {email}")
        
        # Check Supabase connection
        if not service_supabase:
            print("❌ Service role Supabase client not initialized.")
            print("💡 Make sure SUPABASE_SERVICE_ROLE_KEY is set in your .env file")
            return False
        
        # Step 1: Create user in Supabase Auth
        print("\n📝 Step 1: Creating user in Supabase Auth...")
        try:
            auth_response = service_supabase.auth.admin.create_user({
                "email": email,
                "password": password,
                "email_confirm": True  # Auto-confirm email
            })
            
            if not auth_response or not auth_response.user:
                print("❌ Failed to create user in Supabase Auth")
                return False
            
            user_id = auth_response.user.id
            print(f"✅ User created in Auth: {user_id}")
            
        except Exception as e:
            print(f"❌ Error creating user in Auth: {e}")
            print("\n💡 If you get a 'user already exists' error, the user might already be created.")
            print("   You can use the add_admin_user.py script to add admin role to existing user.")
            return False
        
        # Step 2: Create user profile
        print("\n📝 Step 2: Creating user profile...")
        try:
            profile_data = {
                "user_id": user_id,
                "role": "admin",
                "is_active": True
            }
            
            profile_response = service_supabase.table("user_profiles").insert(profile_data).execute()
            
            if profile_response.data:
                print(f"✅ User profile created")
            else:
                print("⚠️  User profile creation returned no data (might already exist)")
                
        except Exception as e:
            print(f"⚠️  Error creating user profile: {e}")
            print("   Continuing with role assignment...")
        
        # Step 3: Get or create admin role
        print("\n📝 Step 3: Setting up admin role...")
        try:
            # Check if admin role exists
            role_response = service_supabase.table("roles").select("*").eq("name", "admin").execute()
            
            if role_response.data:
                admin_role_id = role_response.data[0]['id']
                print(f"✅ Admin role found: {admin_role_id}")
            else:
                # Create admin role
                print("📝 Creating admin role...")
                admin_permissions = [perm.value for perm in DEFAULT_ROLE_PERMISSIONS[UserRole.admin]]
                
                role_create_response = service_supabase.table("roles").insert({
                    "name": "admin",
                    "description": "Full system administrator with all permissions",
                    "permissions": admin_permissions
                }).execute()
                
                if role_create_response.data:
                    admin_role_id = role_create_response.data[0]['id']
                    print(f"✅ Admin role created: {admin_role_id}")
                else:
                    print("❌ Failed to create admin role")
                    return False
            
        except Exception as e:
            print(f"❌ Error with admin role: {e}")
            return False
        
        # Step 4: Assign admin role to user
        print("\n📝 Step 4: Assigning admin role to user...")
        try:
            # Check if user already has admin role
            existing_assignment = service_supabase.table("user_roles").select("*").eq(
                "user_id", user_id
            ).eq("role_id", admin_role_id).execute()
            
            if existing_assignment.data:
                print("ℹ️  User already has admin role")
            else:
                # Assign admin role
                assignment_response = service_supabase.table("user_roles").insert({
                    "user_id": user_id,
                    "role_id": admin_role_id
                }).execute()
                
                if assignment_response.data:
                    print(f"✅ Admin role assigned to user")
                else:
                    print("❌ Failed to assign admin role")
                    return False
                    
        except Exception as e:
            print(f"❌ Error assigning admin role: {e}")
            return False
        
        # Success!
        print("\n" + "=" * 50)
        print("✅ SUCCESS! Admin user created")
        print("=" * 50)
        print(f"\n📧 Email: {email}")
        print(f"🔑 Password: {password}")
        print(f"🆔 User ID: {user_id}")
        print("\n💡 Next steps:")
        print("  1. Go to http://localhost:3000")
        print("  2. Click 'Sign In'")
        print(f"  3. Log in with email: {email}")
        print(f"  4. Use the password you provided")
        print("  5. You should now have admin access!")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Main function"""
    print("\n" + "=" * 50)
    print("  Admin User Creation Script")
    print("=" * 50 + "\n")
    
    if len(sys.argv) < 3:
        print("Usage: python create_admin.py <email> <password>")
        print("\nExample:")
        print("  python create_admin.py admin@example.com MySecurePassword123!")
        print("\n⚠️  Make sure to use a strong password!")
        sys.exit(1)
    
    email = sys.argv[1]
    password = sys.argv[2]
    
    # Validate email format
    if "@" not in email or "." not in email:
        print("❌ Invalid email format")
        sys.exit(1)
    
    # Validate password strength
    if len(password) < 8:
        print("❌ Password must be at least 8 characters long")
        sys.exit(1)
    
    success = create_admin_user(email, password)
    
    if not success:
        print("\n❌ Failed to create admin user")
        sys.exit(1)


if __name__ == "__main__":
    main()
