#!/usr/bin/env python3
"""
Script to delete a user from Supabase Auth and related tables.
"""

import sys
import os
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from config.database import service_supabase


def delete_user(user_id: str, email: str):
    """Delete a user and all related data"""
    try:
        print("🗑️  Deleting User")
        print("=" * 50)
        print(f"📧 Email: {email}")
        print(f"🆔 User ID: {user_id}")
        
        if not service_supabase:
            print("❌ Service role client not available")
            return False
        
        # Step 1: Delete user_roles
        print("\n📝 Step 1: Deleting user role assignments...")
        try:
            service_supabase.table("user_roles").delete().eq("user_id", user_id).execute()
            print("✅ User roles deleted")
        except Exception as e:
            print(f"⚠️  Error deleting user roles: {e}")
        
        # Step 2: Delete user_profiles
        print("\n📝 Step 2: Deleting user profile...")
        try:
            service_supabase.table("user_profiles").delete().eq("user_id", user_id).execute()
            print("✅ User profile deleted")
        except Exception as e:
            print(f"⚠️  Error deleting user profile: {e}")
        
        # Step 3: Delete from Supabase Auth
        print("\n📝 Step 3: Deleting user from Supabase Auth...")
        try:
            service_supabase.auth.admin.delete_user(user_id)
            print("✅ User deleted from Auth")
        except Exception as e:
            print(f"❌ Error deleting user from Auth: {e}")
            return False
        
        print("\n" + "=" * 50)
        print("✅ SUCCESS! User deleted")
        print("=" * 50)
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Main function"""
    if len(sys.argv) < 2:
        print("Usage: python delete_user.py <email_or_user_id>")
        print("\nExample:")
        print("  python delete_user.py admin@orka.com")
        print("  python delete_user.py 7bc558e0-b098-43d1-9ba0-0f02e3e6fc80")
        sys.exit(1)
    
    identifier = sys.argv[1]
    
    # Check if it's an email or user ID
    if "@" in identifier:
        # It's an email, need to find the user ID
        print(f"🔍 Looking up user with email: {identifier}")
        
        try:
            response = service_supabase.auth.admin.list_users()
            
            for user in response:
                if user.email and user.email.lower() == identifier.lower():
                    print(f"✅ Found user: {user.id}")
                    
                    # Confirm deletion
                    print(f"\n⚠️  WARNING: You are about to delete user:")
                    print(f"   Email: {user.email}")
                    print(f"   ID: {user.id}")
                    print(f"   Created: {user.created_at}")
                    
                    confirm = input("\nType 'DELETE' to confirm: ")
                    if confirm != "DELETE":
                        print("❌ Deletion cancelled")
                        sys.exit(0)
                    
                    success = delete_user(user.id, user.email)
                    sys.exit(0 if success else 1)
            
            print(f"❌ User with email '{identifier}' not found")
            sys.exit(1)
            
        except Exception as e:
            print(f"❌ Error looking up user: {e}")
            sys.exit(1)
    else:
        # It's a user ID
        user_id = identifier
        
        # Try to get user info
        try:
            response = service_supabase.auth.admin.list_users()
            user_email = None
            
            for user in response:
                if user.id == user_id:
                    user_email = user.email
                    print(f"✅ Found user: {user_email}")
                    
                    # Confirm deletion
                    print(f"\n⚠️  WARNING: You are about to delete user:")
                    print(f"   Email: {user.email}")
                    print(f"   ID: {user.id}")
                    print(f"   Created: {user.created_at}")
                    
                    confirm = input("\nType 'DELETE' to confirm: ")
                    if confirm != "DELETE":
                        print("❌ Deletion cancelled")
                        sys.exit(0)
                    
                    break
            
            if not user_email:
                print(f"⚠️  User ID not found in list, but will attempt deletion anyway")
                confirm = input(f"\nType 'DELETE' to confirm deletion of {user_id}: ")
                if confirm != "DELETE":
                    print("❌ Deletion cancelled")
                    sys.exit(0)
                user_email = "unknown"
            
            success = delete_user(user_id, user_email)
            sys.exit(0 if success else 1)
            
        except Exception as e:
            print(f"❌ Error: {e}")
            sys.exit(1)


if __name__ == "__main__":
    main()
