#!/usr/bin/env python3
"""
Test script to debug the users endpoint
"""

import sys
sys.path.insert(0, 'backend')

from config.database import service_supabase, supabase
from config.settings import settings

print("=" * 80)
print("ENVIRONMENT CHECK")
print("=" * 80)
print(f"SUPABASE_URL: {settings.SUPABASE_URL[:50]}...")
print(f"SUPABASE_SERVICE_ROLE_KEY set: {bool(settings.SUPABASE_SERVICE_ROLE_KEY)}")
print(f"Service Role Key length: {len(settings.SUPABASE_SERVICE_ROLE_KEY)}")
print()

print("=" * 80)
print("CLIENT CHECK")
print("=" * 80)
print(f"Regular client exists: {supabase is not None}")
print(f"Service client exists: {service_supabase is not None}")
print()

if service_supabase:
    print("=" * 80)
    print("FETCHING USERS FROM SUPABASE")
    print("=" * 80)
    try:
        # Try to get users using admin API
        response = service_supabase.auth.admin.list_users()
        print(f"Response type: {type(response)}")
        print(f"Response: {response}")
        
        if hasattr(response, '__iter__'):
            users = list(response)
            print(f"\nFound {len(users)} users")
            for i, user in enumerate(users[:3]):  # Show first 3
                print(f"\nUser {i+1}:")
                print(f"  ID: {user.id}")
                print(f"  Email: {user.email}")
                print(f"  Created: {user.created_at}")
        else:
            print(f"Unexpected response format: {response}")
            
    except Exception as e:
        print(f"ERROR fetching users: {e}")
        print(f"Error type: {type(e).__name__}")
        import traceback
        traceback.print_exc()
else:
    print("❌ Service client not available!")
    print("Cannot fetch users without service role key")
