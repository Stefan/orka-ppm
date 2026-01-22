#!/usr/bin/env python3
"""
Script to update a user's email in Supabase Auth.
"""

import sys
import os
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from config.database import service_supabase


def update_user_email(user_id: str, new_email: str):
    """Update user's email in Supabase Auth"""
    try:
        print("🔄 Updating User Email")
        print("=" * 50)
        print(f"🆔 User ID: {user_id}")
        print(f"📧 New Email: {new_email}")
        
        # Check service role client
        if not service_supabase:
            print("❌ Service role Supabase client not initialized.")
            print("💡 Make sure SUPABASE_SERVICE_ROLE_KEY is set in your .env file")
            return False
        
        # Update user email in Supabase Auth
        print("\n📝 Updating email in Supabase Auth...")
        try:
            auth_response = service_supabase.auth.admin.update_user_by_id(
                user_id,
                {
                    "email": new_email,
                    "email_confirm": True  # Auto-confirm the new email
                }
            )
            
            if auth_response and auth_response.user:
                print(f"✅ Email updated successfully in Auth")
                print(f"   New email: {auth_response.user.email}")
            else:
                print("❌ Failed to update email in Auth")
                return False
                
        except Exception as e:
            print(f"❌ Error updating email in Auth: {e}")
            return False
        
        # Success!
        print("\n" + "=" * 50)
        print("✅ SUCCESS! Email updated")
        print("=" * 50)
        print(f"\n🆔 User ID: {user_id}")
        print(f"📧 New Email: {new_email}")
        print("\n💡 Next steps:")
        print(f"  1. Log in with the new email: {new_email}")
        print("  2. Use the same password as before")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Main function"""
    if len(sys.argv) < 3:
        print("Usage: python update_user_email.py <user_id> <new_email>")
        print("\nExample:")
        print("  python update_user_email.py 7bc558e0-b098-43d1-9ba0-0f02e3e6fc80 newemail@example.com")
        sys.exit(1)
    
    user_id = sys.argv[1]
    new_email = sys.argv[2]
    
    # Validate email format
    if "@" not in new_email or "." not in new_email:
        print("❌ Invalid email format")
        sys.exit(1)
    
    success = update_user_email(user_id, new_email)
    
    if not success:
        print("\n❌ Failed to update email")
        sys.exit(1)


if __name__ == "__main__":
    main()
