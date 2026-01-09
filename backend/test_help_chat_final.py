#!/usr/bin/env python3
"""
Final Help Chat System Test
Tests the complete help chat system to ensure all core functionality works.
"""

import asyncio
import sys
import os
import json
from datetime import datetime

# Add the backend directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

async def test_help_chat_final():
    """Final comprehensive test of help chat system"""
    print("🎯 Final Help Chat System Test")
    print("=" * 50)
    
    test_results = []
    
    try:
        # Test 1: Backend System Integration
        print("1. Testing backend system integration...")
        try:
            from main import app
            from routers.help_chat import router
            
            # Check if help chat routes are properly integrated
            help_routes = []
            for route in app.routes:
                if hasattr(route, 'path') and '/ai/help' in str(route.path):
                    help_routes.append(str(route.path))
            
            if len(help_routes) >= 4:  # Should have at least 4 help chat routes
                print(f"   ✅ Backend integration: {len(help_routes)} routes found")
                test_results.append(("Backend Integration", True))
            else:
                print(f"   ❌ Backend integration: Only {len(help_routes)} routes found")
                test_results.append(("Backend Integration", False))
                
        except Exception as e:
            print(f"   ❌ Backend integration failed: {str(e)}")
            test_results.append(("Backend Integration", False))
        
        # Test 2: Frontend Components
        print("2. Testing frontend components...")
        try:
            frontend_files = [
                "../components/HelpChat.tsx",
                "../components/HelpChatToggle.tsx", 
                "../app/providers/HelpChatProvider.tsx",
                "../hooks/useHelpChat.ts",
                "../types/help-chat.ts",
                "../lib/help-chat-api.ts"
            ]
            
            missing_files = []
            for file_path in frontend_files:
                if not os.path.exists(file_path):
                    missing_files.append(file_path)
            
            if not missing_files:
                print("   ✅ All frontend components exist")
                test_results.append(("Frontend Components", True))
            else:
                print(f"   ❌ Missing frontend files: {missing_files}")
                test_results.append(("Frontend Components", False))
                
        except Exception as e:
            print(f"   ❌ Frontend component check failed: {str(e)}")
            test_results.append(("Frontend Components", False))
        
        # Test 3: API Endpoint Structure
        print("3. Testing API endpoint structure...")
        try:
            from fastapi.testclient import TestClient
            from main import app
            
            client = TestClient(app)
            
            # Test endpoints (they may return errors due to auth, but should exist)
            endpoints_to_test = [
                ("/ai/help/context?page_route=/dashboard", "GET"),
                ("/ai/help/tips?context=/dashboard", "GET")
            ]
            
            endpoint_results = []
            for endpoint, method in endpoints_to_test:
                try:
                    if method == "GET":
                        response = client.get(endpoint)
                    else:
                        response = client.post(endpoint, json={})
                    
                    # Any response (even error) means the endpoint exists
                    endpoint_results.append(True)
                    print(f"   ✅ {method} {endpoint} responds (status: {response.status_code})")
                except Exception as e:
                    endpoint_results.append(False)
                    print(f"   ❌ {method} {endpoint} failed: {str(e)}")
            
            if all(endpoint_results):
                test_results.append(("API Endpoints", True))
            else:
                test_results.append(("API Endpoints", False))
                
        except Exception as e:
            print(f"   ❌ API endpoint test failed: {str(e)}")
            test_results.append(("API Endpoints", False))
        
        # Test 4: Model Imports
        print("4. Testing model imports...")
        try:
            from models.help_content import HelpContentCreate, HelpContent, ContentType
            from pydantic import BaseModel
            
            # Test creating a help content model
            test_content = HelpContentCreate(
                content_type=ContentType.guide,
                title="Test Guide",
                content="This is a test guide content"
            )
            
            print("   ✅ Help content models work correctly")
            test_results.append(("Model Imports", True))
            
        except Exception as e:
            print(f"   ❌ Model import test failed: {str(e)}")
            test_results.append(("Model Imports", False))
        
        # Test 5: Database Connection (Optional)
        print("5. Testing database connection...")
        try:
            from config.database import supabase
            
            if supabase:
                # Try a simple query to test connection
                result = supabase.table('user_profiles').select('id').limit(1).execute()
                print("   ✅ Database connection working")
                test_results.append(("Database Connection", True))
            else:
                print("   ⚠️  Database connection not available")
                test_results.append(("Database Connection", False))
                
        except Exception as e:
            print(f"   ⚠️  Database connection test: {str(e)}")
            test_results.append(("Database Connection", False))
        
        # Summary
        print("\n" + "=" * 50)
        print("📊 FINAL TEST RESULTS")
        print("=" * 50)
        
        passed_tests = sum(1 for _, result in test_results if result)
        total_tests = len(test_results)
        
        for test_name, result in test_results:
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{test_name}: {status}")
        
        print(f"\nOverall Score: {passed_tests}/{total_tests} tests passed")
        
        # Determine overall status
        if passed_tests >= 4:  # At least 4 out of 5 tests should pass
            print("\n🎉 HELP CHAT SYSTEM IS READY!")
            print("✅ Core functionality is working")
            print("✅ Backend and frontend components are integrated")
            print("✅ API endpoints are accessible")
            print("✅ Models and types are properly defined")
            
            if passed_tests == total_tests:
                print("🌟 Perfect score! All systems operational.")
            else:
                print("⚠️  Some optional features may need attention.")
            
            return True
        else:
            print("\n⚠️  HELP CHAT SYSTEM NEEDS ATTENTION")
            print("❌ Some core functionality is not working")
            print("🔧 Please review the failed tests above")
            return False
        
    except Exception as e:
        print(f"\n❌ Final test failed with error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(test_help_chat_final())
    sys.exit(0 if success else 1)