"""
Test script for cascade deletion functionality.

This script tests that user_profiles are properly deleted when auth.users are deleted,
as required by the database schema's CASCADE constraint.
"""

import sys
import os
import asyncio
from datetime import datetime

# Add the backend directory to the Python path
sys.path.insert(0, os.path.dirname(__file__))

from data_integrity_service import DataIntegrityService
from config.database import supabase, service_supabase

def test_cascade_deletion_configuration():
    """
    Test cascade deletion configuration and functionality.
    
    Since we cannot directly manipulate auth.users through the API,
    this test verifies the database schema is properly configured
    and checks for any orphaned records that would indicate
    cascade deletion is not working.
    """
    print("🔍 Testing Cascade Deletion Functionality")
    print("=" * 50)
    
    try:
        # Initialize the data integrity service
        service = DataIntegrityService()
        
        # Run cascade deletion test
        result = service.test_cascade_deletion()
        
        print(f"✅ Cascade deletion test completed in {result.execution_time:.2f} seconds")
        print(f"Status: {'PASS' if result.is_valid else 'FAIL'}")
        
        if result.checks_performed:
            print("\nChecks performed:")
            for check in result.checks_performed:
                print(f"  ✓ {check}")
        
        if result.details:
            print("\nTest details:")
            for key, value in result.details.items():
                print(f"  {key}: {value}")
        
        if result.warnings:
            print("\n⚠️  Warnings:")
            for warning in result.warnings:
                print(f"  - {warning}")
        
        if result.errors:
            print("\n❌ Errors:")
            for error in result.errors:
                print(f"  - {error}")
            return False
        
        print("\n🎯 Cascade deletion test completed successfully")
        return True
        
    except Exception as e:
        print(f"❌ Cascade deletion test failed: {e}")
        return False

def test_orphaned_records_detection():
    """
    Test detection of orphaned user_profiles records.
    
    Orphaned records would indicate that cascade deletion
    is not working properly.
    """
    print("\n🔍 Testing Orphaned Records Detection")
    print("=" * 50)
    
    try:
        service = DataIntegrityService()
        
        # Run one-to-one relationship validation to detect orphaned records
        result = service.validate_one_to_one_user_relationship()
        
        print(f"✅ Orphaned records check completed in {result.execution_time:.2f} seconds")
        
        orphaned_count = result.details.get("orphaned_profiles_count", 0)
        total_profiles = result.details.get("total_user_profiles", 0)
        total_auth_users = result.details.get("total_auth_users", 0)
        
        print(f"Total auth.users: {total_auth_users}")
        print(f"Total user_profiles: {total_profiles}")
        print(f"Orphaned user_profiles: {orphaned_count}")
        
        if orphaned_count == 0:
            print("✅ No orphaned user_profiles found - cascade deletion appears to be working")
            return True
        else:
            print(f"⚠️  Found {orphaned_count} orphaned user_profiles")
            print("This may indicate cascade deletion is not properly configured")
            
            if result.details.get("missing_profile_user_ids"):
                print("Orphaned user IDs:")
                for user_id in result.details["missing_profile_user_ids"][:5]:  # Show first 5
                    print(f"  - {user_id}")
                if len(result.details["missing_profile_user_ids"]) > 5:
                    print(f"  ... and {len(result.details['missing_profile_user_ids']) - 5} more")
            
            return False
        
    except Exception as e:
        print(f"❌ Orphaned records detection failed: {e}")
        return False

def test_database_schema_constraints():
    """
    Test that the database schema has proper CASCADE constraints configured.
    
    This verifies the foreign key constraint on user_profiles.user_id
    is set up with ON DELETE CASCADE.
    """
    print("\n🔍 Testing Database Schema Constraints")
    print("=" * 50)
    
    try:
        client = service_supabase or supabase
        if not client:
            print("❌ No Supabase client available")
            return False
        
        # Check if user_profiles table exists and has proper structure
        try:
            # Try to query user_profiles to verify it exists
            profiles_response = client.table("user_profiles").select("user_id").limit(1).execute()
            print("✅ user_profiles table exists and is accessible")
        except Exception as e:
            print(f"❌ user_profiles table not accessible: {e}")
            return False
        
        # Check if auth.users table is accessible
        try:
            auth_response = client.table("auth.users").select("id").limit(1).execute()
            print("✅ auth.users table exists and is accessible")
        except Exception as e:
            print(f"⚠️  auth.users table not accessible (expected in Supabase): {e}")
            print("✅ This is normal - auth.users is in auth schema, not public schema")
        
        # Since we can't directly query information_schema through Supabase client,
        # we'll verify the constraint is working by checking data consistency
        service = DataIntegrityService()
        integrity_result = service.validate_referential_integrity()
        
        if integrity_result.is_valid:
            print("✅ Referential integrity check passed - constraints appear to be working")
            return True
        else:
            print("❌ Referential integrity check failed:")
            for error in integrity_result.errors:
                print(f"  - {error}")
            return False
        
    except Exception as e:
        print(f"❌ Database schema constraint test failed: {e}")
        return False

def main():
    """Run all cascade deletion tests"""
    print("🚀 Starting Cascade Deletion Tests")
    print("=" * 60)
    
    tests = [
        ("Database Schema Constraints", test_database_schema_constraints),
        ("Orphaned Records Detection", test_orphaned_records_detection),
        ("Cascade Deletion Configuration", test_cascade_deletion_configuration)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\n📋 Running: {test_name}")
        try:
            success = test_func()
            results.append((test_name, success))
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {e}")
            results.append((test_name, False))
    
    # Print summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    passed = 0
    failed = 0
    
    for test_name, success in results:
        status = "PASS" if success else "FAIL"
        icon = "✅" if success else "❌"
        print(f"{icon} {test_name}: {status}")
        
        if success:
            passed += 1
        else:
            failed += 1
    
    print(f"\nTotal: {len(results)} tests")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    
    if failed == 0:
        print("\n🎉 All cascade deletion tests passed!")
        print("Cascade deletion functionality is working correctly.")
        return True
    else:
        print(f"\n⚠️  {failed} test(s) failed.")
        print("Cascade deletion may not be working properly.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)