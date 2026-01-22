#!/usr/bin/env python3
"""
Script to delete all users and create a fresh admin user.
"""

import sys
import os
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from config.database import service_supabase
from auth.rbac import UserRole, DEFAULT_ROLE_PERMISSIONS


def delete_all_users():
    """Delete all users from Supabase"""
    try:
        print("🗑️  Deleting All Users")
        print("=" * 50)
        
        if not service_supabase:
            print("❌ Service role client not available")
            return False
        
        # Get all users
        print("\n📋 Fetching all users...")
        response = service_supabase.auth.admin.list_users()
        
        if not response:
            print("ℹ️  No users found")
            return True
        
        print(f"✅ Found {len(response)} user(s)")
        
        # Delete each user
        for idx, user in enumerate(response, 1):
            print(f"\n🗑️  Deleting user {idx}/{len(response)}: {user.email}")
            
            try:
                # Delete user_roles
                service_supabase.table("user_roles").delete().eq("user_id", user.id).execute()
                
                # Delete user_profiles
                service_supabase.table("user_profiles").delete().eq("user_id", user.id).execute()
                
                # Delete from Auth
                service_supabase.auth.admin.delete_user(user.id)
                
                print(f"   ✅ Deleted: {user.email}")
                
            except Exception as e:
                print(f"   ⚠️  Error deleting {user.email}: {e}")
        
        print("\n" + "=" * 50)
        print("✅ All users deleted")
        print("=" * 50)
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def create_admin_user(email: str, password: str):
    """Create an admin user"""
    try:
        print("\n🚀 Creating Admin User")
        print("=" * 50)
        print(f"📧 Email: {email}")
        
        # Step 1: Create user in Supabase Auth
        print("\n📝 Step 1: Creating user in Supabase Auth...")
        try:
            auth_response = service_supabase.auth.admin.create_user({
                "email": email,
                "password": password,
                "email_confirm": True
            })
            
            if not auth_response or not auth_response.user:
                print("❌ Failed to create user in Supabase Auth")
                return False
            
            user_id = auth_response.user.id
            print(f"✅ User created in Auth: {user_id}")
            
        except Exception as e:
            print(f"❌ Error creating user in Auth: {e}")
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
                print("⚠️  User profile creation returned no data")
                
        except Exception as e:
            print(f"⚠️  Error creating user profile: {e}")
        
        # Step 3: Get or create admin role
        print("\n📝 Step 3: Setting up admin role...")
        try:
            role_response = service_supabase.table("roles").select("*").eq("name", "admin").execute()
            
            if role_response.data:
                admin_role_id = role_response.data[0]['id']
                print(f"✅ Admin role found: {admin_role_id}")
            else:
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
        
        print("\n" + "=" * 50)
        print("✅ SUCCESS! Admin user created")
        print("=" * 50)
        print(f"\n📧 Email: {email}")
        print(f"🔑 Password: {password}")
        print(f"🆔 User ID: {user_id}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Main function"""
    print("\n" + "=" * 80)
    print("  RESET USERS - Delete All & Create Admin")
    print("=" * 80 + "\n")
    
    if len(sys.argv) < 3:
        print("Usage: python reset_users.py <email> <password>")
        print("\nExample:")
        print("  python reset_users.py stefan.krause@gmail.com MySecurePassword123!")
        print("\n⚠️  WARNING: This will DELETE ALL USERS!")
        sys.exit(1)
    
    email = sys.argv[1]
    password = sys.argv[2]
    
    # Validate email
    if "@" not in email or "." not in email:
        print("❌ Invalid email format")
        sys.exit(1)
    
    # Validate password
    if len(password) < 8:
        print("❌ Password must be at least 8 characters long")
        sys.exit(1)
    
    # Confirm action
    print("⚠️  WARNING: This will DELETE ALL USERS from the database!")
    print(f"   Then create a new admin user: {email}")
    confirm = input("\nType 'RESET' to confirm: ")
    
    if confirm != "RESET":
        print("❌ Operation cancelled")
        sys.exit(0)
    
    # Delete all users
    print("\n" + "=" * 80)
    if not delete_all_users():
        print("\n❌ Failed to delete users")
        sys.exit(1)
    
    # Create admin user
    print("\n" + "=" * 80)
    if not create_admin_user(email, password):
        print("\n❌ Failed to create admin user")
        sys.exit(1)
    
    print("\n" + "=" * 80)
    print("✅ COMPLETE! All users deleted and new admin created")
    print("=" * 80)
    print("\n💡 Next steps:")
    print("  1. Go to http://localhost:3000")
    print("  2. Click 'Sign In'")
    print(f"  3. Log in with: {email}")
    print(f"  4. Password: {password}")


if __name__ == "__main__":
    main()
