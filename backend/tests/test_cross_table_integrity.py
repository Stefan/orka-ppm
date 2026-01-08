"""
Test script for cross-table integrity validation.

This script tests that all user-related foreign keys remain valid
across all tables in the system.
"""

import sys
import os
from datetime import datetime

# Add the backend directory to the Python path
sys.path.insert(0, os.path.dirname(__file__))

from data_integrity_service import DataIntegrityService

def test_cross_table_integrity():
    """
    Test cross-table integrity validation functionality.
    
    This verifies that all user-related foreign key relationships
    are valid across all tables in the system.
    """
    print("🔍 Testing Cross-Table Integrity Validation")
    print("=" * 50)
    
    try:
        # Initialize the data integrity service
        service = DataIntegrityService()
        
        # Run cross-table integrity validation
        result = service.validate_cross_table_integrity()
        
        print(f"✅ Cross-table integrity validation completed in {result.execution_time:.2f} seconds")
        print(f"Status: {'PASS' if result.is_valid else 'FAIL'}")
        
        if result.checks_performed:
            print("\nChecks performed:")
            for check in result.checks_performed:
                print(f"  ✓ {check}")
        
        if result.details:
            print("\nValidation details:")
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
        
        print("\n🎯 Cross-table integrity validation completed successfully")
        return True
        
    except Exception as e:
        print(f"❌ Cross-table integrity validation failed: {e}")
        return False

def test_referential_integrity():
    """
    Test referential integrity validation functionality.
    
    This verifies that user_id foreign keys reference valid records.
    """
    print("\n🔍 Testing Referential Integrity Validation")
    print("=" * 50)
    
    try:
        service = DataIntegrityService()
        
        # Run referential integrity validation
        result = service.validate_referential_integrity()
        
        print(f"✅ Referential integrity validation completed in {result.execution_time:.2f} seconds")
        print(f"Status: {'PASS' if result.is_valid else 'FAIL'}")
        
        if result.checks_performed:
            print("\nChecks performed:")
            for check in result.checks_performed:
                print(f"  ✓ {check}")
        
        if result.warnings:
            print("\n⚠️  Warnings:")
            for warning in result.warnings:
                print(f"  - {warning}")
        
        if result.errors:
            print("\n❌ Errors:")
            for error in result.errors:
                print(f"  - {error}")
            return False
        
        print("\n🎯 Referential integrity validation completed successfully")
        return True
        
    except Exception as e:
        print(f"❌ Referential integrity validation failed: {e}")
        return False

def test_comprehensive_integrity():
    """
    Test comprehensive data integrity validation.
    
    This runs all integrity checks together.
    """
    print("\n🔍 Testing Comprehensive Data Integrity")
    print("=" * 50)
    
    try:
        service = DataIntegrityService()
        
        # Run comprehensive integrity validation
        result = service.perform_comprehensive_integrity_validation()
        
        print(f"✅ Comprehensive integrity validation completed in {result.execution_time:.2f} seconds")
        print(f"Overall Status: {'PASS' if result.is_valid else 'FAIL'}")
        
        if result.checks_performed:
            print(f"\nTotal checks performed: {len(result.checks_performed)}")
            for check in result.checks_performed:
                print(f"  ✓ {check}")
        
        if result.details:
            print("\nValidation details by category:")
            for category, details in result.details.items():
                print(f"  {category}:")
                if isinstance(details, dict):
                    for key, value in details.items():
                        print(f"    {key}: {value}")
                else:
                    print(f"    {details}")
        
        print(f"\nSummary:")
        print(f"  Errors: {len(result.errors)}")
        print(f"  Warnings: {len(result.warnings)}")
        
        if result.warnings:
            print("\n⚠️  Warnings:")
            for warning in result.warnings:
                print(f"  - {warning}")
        
        if result.errors:
            print("\n❌ Errors:")
            for error in result.errors:
                print(f"  - {error}")
            return False
        
        print("\n🎯 Comprehensive integrity validation completed successfully")
        return True
        
    except Exception as e:
        print(f"❌ Comprehensive integrity validation failed: {e}")
        return False

def main():
    """Run all cross-table integrity tests"""
    print("🚀 Starting Cross-Table Integrity Tests")
    print("=" * 60)
    
    tests = [
        ("Referential Integrity", test_referential_integrity),
        ("Cross-Table Integrity", test_cross_table_integrity),
        ("Comprehensive Integrity", test_comprehensive_integrity)
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
        print("\n🎉 All cross-table integrity tests passed!")
        print("Cross-table integrity validation is working correctly.")
        return True
    else:
        print(f"\n⚠️  {failed} test(s) failed.")
        print("Cross-table integrity validation may have issues.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)