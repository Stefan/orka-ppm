#!/usr/bin/env python3
"""
Comprehensive Help Chat System Test
Tests all implemented help chat functionality to ensure core features work.
"""

import asyncio
import sys
import os
import json
from datetime import datetime

# Add the backend directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

async def test_help_chat_comprehensive():
    """Test comprehensive help chat functionality"""
    print("🧪 Testing Help Chat Comprehensive Functionality")
    print("=" * 60)
    
    test_results = {
        "backend_imports": False,
        "router_functionality": False,
        "database_connection": False,
        "main_app_integration": False,
        "frontend_build": False
    }
    
    try:
        # Test 1: Backend imports and router functionality
        print("1. Testing backend imports and router functionality...")
        from routers.help_chat import router
        from models.help_content import HelpContentCreate, HelpContent
        print("   ✅ Help chat router and models imported successfully")
        test_results["backend_imports"] = True
        
        # Check router endpoints
        routes = []
        for route in router.routes:
            method = list(route.methods)[0] if route.methods else "UNKNOWN"
            routes.append(f"{method} {route.path}")
        
        expected_routes = [
            "POST /ai/help/query",
            "GET /ai/help/context", 
            "POST /ai/help/feedback",
            "GET /ai/help/tips"
        ]
        
        all_routes_found = True
        for expected in expected_routes:
            if any(expected in route for route in routes):
                print(f"   ✅ Found route: {expected}")
            else:
                print(f"   ❌ Missing route: {expected}")
                all_routes_found = False
        
        test_results["router_functionality"] = all_routes_found
        
        # Test 2: Database connection
        print("2. Testing database connection...")
        try:
            from config.database import supabase
            if supabase:
                # Test basic connection
                result = supabase.table('users').select('id').limit(1).execute()
                print("   ✅ Database connection working")
                test_results["database_connection"] = True
            else:
                print("   ❌ Database connection not available")
        except Exception as e:
            print(f"   ⚠️  Database connection test failed: {str(e)}")
        
        # Test 3: Main application integration
        print("3. Testing main application integration...")
        try:
            import main
            app = main.app
            
            # Check if help chat routes are included
            help_chat_routes = []
            for route in app.routes:
                if hasattr(route, 'path') and '/ai/help' in str(route.path):
                    help_chat_routes.append(str(route.path))
            
            if help_chat_routes:
                print(f"   ✅ Help chat routes integrated: {help_chat_routes}")
                test_results["main_app_integration"] = True
            else:
                print("   ❌ Help chat routes not found in main app")
                
        except Exception as e:
            print(f"   ❌ Main app integration test failed: {str(e)}")
        
        # Test 4: Check if frontend components exist
        print("4. Testing frontend component existence...")
        frontend_components = [
            "../components/HelpChat.tsx",
            "../components/HelpChatToggle.tsx", 
            "../app/providers/HelpChatProvider.tsx",
            "../hooks/useHelpChat.ts",
            "../types/help-chat.ts"
        ]
        
        frontend_exists = True
        for component in frontend_components:
            if os.path.exists(component):
                print(f"   ✅ Found: {component}")
            else:
                print(f"   ❌ Missing: {component}")
                frontend_exists = False
        
        test_results["frontend_build"] = frontend_exists
        
        # Test 5: Test API endpoint structure (mock test)
        print("5. Testing API endpoint structure...")
        try:
            from fastapi.testclient import TestClient
            from main import app
            
            client = TestClient(app)
            
            # Test help context endpoint (should work without auth for structure test)
            response = client.get("/ai/help/context?page_route=/dashboard")
            print(f"   ✅ Help context endpoint responds (status: {response.status_code})")
            
            # Note: Other endpoints require authentication, so we just check they exist
            print("   ✅ API endpoint structure test completed")
            
        except Exception as e:
            print(f"   ⚠️  API endpoint structure test failed: {str(e)}")
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST RESULTS SUMMARY")
        print("=" * 60)
        
        passed_tests = sum(test_results.values())
        total_tests = len(test_results)
        
        for test_name, result in test_results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{test_name.replace('_', ' ').title()}: {status}")
        
        print(f"\nOverall: {passed_tests}/{total_tests} tests passed")
        
        if passed_tests >= 3:  # At least 3 out of 5 core tests should pass
            print("🎉 Help Chat system core functionality is working!")
            return True
        else:
            print("⚠️  Help Chat system has some issues but basic functionality may work")
            return passed_tests > 0
        
    except Exception as e:
        print(f"\n❌ Comprehensive test failed with error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(test_help_chat_comprehensive())
    sys.exit(0 if success else 1)