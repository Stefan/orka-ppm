#!/usr/bin/env python3
"""
Script to list all users and optionally make one an admin.
"""

import sys
import os
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from config.database import service_supabase
from auth.rbac import UserRole, DEFAULT_ROLE_PERMISSIONS


def list_all_users():
    """List all users from Supabase Auth"""
    try:
        if not service_supabase:
            print("❌ Service role client not available")
            return []
        
        print("📋 Fetching all users from Supabase Auth...")
        
        # List all users using service role
        response = service_supabase.auth.admin.list_users()
        
        if not response:
            print("No users found")
            return []
        
        users = []
        print(f"\n✅ Found {len(response)} user(s):\n")
        print("=" * 80)
        
        for idx, user in enumerate(response, 1):
            print(f"{idx}. Email: {user.email}")
            print(f"   ID: {user.id}")
            print(f"   Created: {user.created_at}")
            print(f"   Confirmed: {user.email_confirmed_at is not None}")
            print("-" * 80)
            users.append(user)
        
        return users
        
    except Exception as e:
        print(f"❌ Error listing users: {e}")
        import traceback
        traceback.print_exc()
        return []


def make_user_admin(user_id: str, email: str):
    """Add admin role to a user"""
    try:
        print(f"\n🔧 Making user admin...")
        print(f"📧 Email: {email}")
        print(f"🆔 User ID: {user_id}")
        
        # Get or create admin role
        print("\n📝 Step 1: Getting admin role...")
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
        
        # Create or update user profile
        print("\n📝 Step 2: Creating/updating user profile...")
        try:
            # Check if profile exists
            profile_check = service_supabase.table("user_profiles").select("*").eq("user_id", user_id).execute()
            
            if profile_check.data:
                # Update existing profile
                profile_response = service_supabase.table("user_profiles").update({
                    "role": "admin",
                    "is_active": True
                }).eq("user_id", user_id).execute()
                print("✅ User profile updated")
            else:
                # Create new profile
                profile_response = service_supabase.table("user_profiles").insert({
                    "user_id": user_id,
                    "role": "admin",
                    "is_active": True
                }).execute()
                print("✅ User profile created")
                
        except Exception as e:
            print(f"⚠️  Profile error: {e}")
            print("   Continuing with role assignment...")
        
        # Assign admin role
        print("\n📝 Step 3: Assigning admin role...")
        try:
            # Check if already has role
            existing = service_supabase.table("user_roles").select("*").eq(
                "user_id", user_id
            ).eq("role_id", admin_role_id).execute()
            
            if existing.data:
                print("ℹ️  User already has admin role")
            else:
                assignment_response = service_supabase.table("user_roles").insert({
                    "user_id": user_id,
                    "role_id": admin_role_id
                }).execute()
                
                if assignment_response.data:
                    print("✅ Admin role assigned")
                else:
                    print("❌ Failed to assign admin role")
                    return False
                    
        except Exception as e:
            print(f"❌ Error assigning role: {e}")
            return False
        
        print("\n" + "=" * 80)
        print("✅ SUCCESS! User is now an admin")
        print("=" * 80)
        print(f"\n📧 Email: {email}")
        print(f"🆔 User ID: {user_id}")
        print("\n💡 You can now log in with this email and your existing password")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Main function"""
    print("\n" + "=" * 80)
    print("  User Management - List Users & Make Admin")
    print("=" * 80 + "\n")
    
    # List all users
    users = list_all_users()
    
    if not users:
        print("\n❌ No users found or error occurred")
        sys.exit(1)
    
    # If email provided as argument, find and make that user admin
    if len(sys.argv) > 1:
        target_email = sys.argv[1].lower()
        print(f"\n🔍 Looking for user with email: {target_email}")
        
        for user in users:
            if user.email and user.email.lower() == target_email:
                print(f"✅ Found user!")
                success = make_user_admin(user.id, user.email)
                sys.exit(0 if success else 1)
        
        print(f"❌ User with email '{target_email}' not found")
        sys.exit(1)
    
    # Interactive mode
    print("\n💡 To make a user admin, run:")
    print("   python list_and_make_admin.py <email>")
    print("\nExample:")
    print("   python list_and_make_admin.py stefan.krause@gmail.com")


if __name__ == "__main__":
    main()
