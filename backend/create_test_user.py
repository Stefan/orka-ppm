#!/usr/bin/env python3
"""
Create a test user for the PPM platform
"""
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# Initialize Supabase client
supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_ANON_KEY")  # Use anon key for auth operations
)

def create_test_user():
    """Create a test user account"""
    
    print("👤 Creating test user account...")
    
    try:
        # Create test user
        email = "testuser@company.com"
        password = "testpassword123"
        
        response = supabase.auth.sign_up({
            "email": email,
            "password": password
        })
        
        if response.user:
            print(f"✅ Test user created successfully!")
            print(f"   Email: {email}")
            print(f"   Password: {password}")
            print(f"   User ID: {response.user.id}")
            print("\n🔑 You can now log in with these credentials at http://localhost:3000")
        else:
            print("❌ Failed to create test user")
            
    except Exception as e:
        print(f"❌ Error creating test user: {e}")
        print("Note: User might already exist or email confirmation might be required")

if __name__ == "__main__":
    create_test_user()