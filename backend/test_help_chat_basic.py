#!/usr/bin/env python3
"""
Basic Help Chat Functionality Test
Tests core help chat functionality to ensure it's working properly.
"""

import asyncio
import sys
import os
import pytest

# Add the backend directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

@pytest.mark.asyncio
async def test_help_chat_basic():
    """Test basic help chat functionality"""
    print("🧪 Testing Help Chat Basic Functionality")
    print("=" * 50)
    
    try:
        # Test 1: Import help chat router
        print("1. Testing help chat router import...")
        from routers.help_chat import router
        print("   ✅ Help chat router imported successfully")
        
        # Test 2: Check available routes
        print("2. Checking available routes...")
        routes = []
        for route in router.routes:
            routes.append(f"{list(route.methods)[0]} {route.path}")
        
        expected_routes = [
            "POST /ai/help/query",
            "GET /ai/help/context", 
            "POST /ai/help/feedback",
            "GET /ai/help/tips"
        ]
        
        for expected in expected_routes:
            if any(expected in route for route in routes):
                print(f"   ✅ Found route: {expected}")
            else:
                print(f"   ❌ Missing route: {expected}")
                return False
        
        # Test 3: Test database schema (if available)
        print("3. Testing database schema...")
        try:
            from config.database import supabase
            if supabase:
                print("   ✅ Database connection available")
                
                # Check if help chat tables exist
                try:
                    result = supabase.table('help_sessions').select('*').limit(1).execute()
                    print("   ✅ help_sessions table exists")
                except Exception as e:
                    print(f"   ⚠️  help_sessions table may not exist: {str(e)}")
                
                try:
                    result = supabase.table('help_messages').select('*').limit(1).execute()
                    print("   ✅ help_messages table exists")
                except Exception as e:
                    print(f"   ⚠️  help_messages table may not exist: {str(e)}")
                    
            else:
                print("   ⚠️  Database connection not available")
        except Exception as e:
            print(f"   ⚠️  Database test failed: {str(e)}")
        
        # Test 4: Test main application import
        print("4. Testing main application import...")
        import main
        print("   ✅ Main application imported successfully")
        
        # Test 5: Check if help chat is included in the app
        print("5. Checking help chat integration...")
        app = main.app
        found_help_chat = False
        for route in app.routes:
            if hasattr(route, 'path') and '/ai/help' in route.path:
                found_help_chat = True
                break
        
        if found_help_chat:
            print("   ✅ Help chat routes integrated into main app")
        else:
            print("   ❌ Help chat routes not found in main app")
            return False
        
        print("\n🎉 All basic help chat functionality tests passed!")
        return True
        
    except Exception as e:
        print(f"\n❌ Test failed with error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(test_help_chat_basic())
    sys.exit(0 if success else 1)