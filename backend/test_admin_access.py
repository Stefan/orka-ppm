#!/usr/bin/env python3
"""Test admin access for user"""

import os
import sys
from dotenv import load_dotenv
from supabase import create_client
import requests

load_dotenv()

# Get Supabase credentials
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

# Create Supabase client
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Get user
email = 'stefan.krause@gmail.com'
result = supabase.auth.admin.list_users()
user = next((u for u in result if u.email == email), None)

if not user:
    print(f"User {email} not found")
    sys.exit(1)

print(f"User ID: {user.id}")
print(f"Email: {user.email}")
print()

# Get user's session token
# For testing, we'll create a session
session_response = supabase.auth.admin.generate_link({
    "type": "magiclink",
    "email": email
})

print("Session link generated (for testing purposes)")
print()

# Now let's test the /admin/roles endpoint
print("Testing /admin/roles endpoint...")
print()

# We need to sign in to get a proper access token
sign_in = supabase.auth.sign_in_with_password({
    "email": email,
    "password": input("Enter password for stefan.krause@gmail.com: ")
})

if sign_in.session:
    access_token = sign_in.session.access_token
    print(f"Access token obtained: {access_token[:20]}...")
    print()
    
    # Test the endpoint
    api_url = os.getenv('NEXT_PUBLIC_API_URL', 'http://localhost:8000')
    response = requests.get(
        f"{api_url}/admin/roles",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
    )
    
    print(f"Response status: {response.status_code}")
    print(f"Response body: {response.text[:500]}")
    
    if response.status_code == 200:
        print("\n✅ SUCCESS: User has admin access!")
    elif response.status_code == 403:
        print("\n❌ FAILED: User does not have admin access (403 Forbidden)")
    else:
        print(f"\n⚠️  UNEXPECTED: Got status code {response.status_code}")
else:
    print("Failed to sign in")
