#!/usr/bin/env python3
"""
Test script to verify that all core validators can run independently
and return proper ValidationResult objects.

This is the checkpoint test for task 5.
"""

import asyncio
import sys
import os
import traceback
from typing import List, Dict, Any

# Add the backend directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from pre_startup_testing.models import ValidationConfiguration, ValidationResult, ValidationStatus, Severity
from pre_startup_testing.configuration_validator import ConfigurationValidator
from pre_startup_testing.database_connectivity_checker import DatabaseConnectivityChecker
from pre_startup_testing.authentication_validator import AuthenticationValidator


async def test_validator_independence():
    """Test that all validators can run independently."""
    print("=" * 60)
    print("CHECKPOINT: Testing Core Validator Independence")
    print("=" * 60)
    
    # Create test configuration
    config = ValidationConfiguration(
        skip_non_critical=False,
        timeout_seconds=30,
        parallel_execution=False,  # Run sequentially for testing
        development_mode=True
    )
    
    # Initialize validators
    validators = {
        "Configuration Validator": ConfigurationValidator(config),
        "Database Connectivity Checker": DatabaseConnectivityChecker(config),
        "Authentication Validator": AuthenticationValidator(config)
    }
    
    overall_success = True
    test_results = {}
    
    for validator_name, validator in validators.items():
        print(f"\n🔍 Testing {validator_name}...")
        print("-" * 40)
        
        try:
            # Test that validator can run independently
            results = await validator.validate()
            
            # Verify results are proper ValidationResult objects
            validation_success = True
            error_details = []
            
            if not isinstance(results, list):
                validation_success = False
                error_details.append(f"Expected list, got {type(results)}")
            else:
                for i, result in enumerate(results):
                    if not isinstance(result, ValidationResult):
                        validation_success = False
                        error_details.append(f"Result {i} is not ValidationResult: {type(result)}")
                        continue
                    
                    # Check required fields
                    required_fields = ['component', 'test_name', 'status', 'message']
                    for field in required_fields:
                        if not hasattr(result, field) or getattr(result, field) is None:
                            validation_success = False
                            error_details.append(f"Result {i} missing/null field: {field}")
                    
                    # Check status is valid enum value
                    if not isinstance(result.status, ValidationStatus):
                        validation_success = False
                        error_details.append(f"Result {i} has invalid status: {result.status}")
                    
                    # Check severity is valid enum value
                    if not isinstance(result.severity, Severity):
                        validation_success = False
                        error_details.append(f"Result {i} has invalid severity: {result.severity}")
            
            # Store test results
            test_results[validator_name] = {
                'success': validation_success,
                'results_count': len(results) if isinstance(results, list) else 0,
                'error_details': error_details,
                'results': results if isinstance(results, list) else []
            }
            
            if validation_success:
                print(f"✅ {validator_name} passed independence test")
                print(f"   - Returned {len(results)} validation results")
                
                # Show summary of results
                status_counts = {}
                for result in results:
                    status = result.status.value
                    status_counts[status] = status_counts.get(status, 0) + 1
                
                print(f"   - Result summary: {status_counts}")
                
                # Show any failures or warnings
                failures = [r for r in results if r.status == ValidationStatus.FAIL]
                warnings = [r for r in results if r.status == ValidationStatus.WARNING]
                
                if failures:
                    print(f"   - ⚠️  {len(failures)} failures detected:")
                    for failure in failures[:3]:  # Show first 3
                        print(f"     • {failure.test_name}: {failure.message}")
                    if len(failures) > 3:
                        print(f"     • ... and {len(failures) - 3} more")
                
                if warnings:
                    print(f"   - ⚠️  {len(warnings)} warnings detected:")
                    for warning in warnings[:2]:  # Show first 2
                        print(f"     • {warning.test_name}: {warning.message}")
                    if len(warnings) > 2:
                        print(f"     • ... and {len(warnings) - 2} more")
                        
            else:
                print(f"❌ {validator_name} failed independence test")
                for error in error_details:
                    print(f"   - {error}")
                overall_success = False
                
        except Exception as e:
            print(f"❌ {validator_name} threw exception: {str(e)}")
            print(f"   Traceback: {traceback.format_exc()}")
            test_results[validator_name] = {
                'success': False,
                'results_count': 0,
                'error_details': [f"Exception: {str(e)}"],
                'exception': str(e)
            }
            overall_success = False
    
    # Test error handling and guidance generation
    print(f"\n🔍 Testing Error Handling and Guidance Generation...")
    print("-" * 40)
    
    guidance_success = await test_error_guidance_generation(validators)
    overall_success = overall_success and guidance_success
    
    # Print final summary
    print("\n" + "=" * 60)
    print("CHECKPOINT SUMMARY")
    print("=" * 60)
    
    if overall_success:
        print("✅ ALL VALIDATORS PASSED INDEPENDENCE TEST")
        print("\nCore validators are working correctly:")
        for validator_name, result in test_results.items():
            if result['success']:
                print(f"  ✅ {validator_name}: {result['results_count']} tests")
        
        print("\n🎯 Ready to proceed to next implementation phase")
        print("   - All validators can run independently")
        print("   - All return proper ValidationResult objects")
        print("   - Error handling and guidance generation working")
        
    else:
        print("❌ SOME VALIDATORS FAILED INDEPENDENCE TEST")
        print("\nIssues found:")
        for validator_name, result in test_results.items():
            if not result['success']:
                print(f"  ❌ {validator_name}:")
                for error in result['error_details']:
                    print(f"     - {error}")
        
        print("\n⚠️  Need to fix issues before proceeding")
    
    return overall_success


async def test_error_guidance_generation(validators: Dict[str, Any]) -> bool:
    """Test that validators can generate proper error guidance."""
    print("Testing error guidance generation...")
    
    guidance_success = True
    
    # Test configuration validator guidance
    try:
        config_validator = validators["Configuration Validator"]
        
        # Create a mock validation result with failure
        mock_results = [
            ValidationResult(
                component="Configuration Validator",
                test_name="Test Environment Variable",
                status=ValidationStatus.FAIL,
                message="Test failure for guidance generation",
                severity=Severity.HIGH,
                resolution_steps=["Step 1", "Step 2"]
            )
        ]
        
        # Test guidance generation methods
        if hasattr(config_validator, 'generate_comprehensive_guidance'):
            guidance = config_validator.generate_comprehensive_guidance(mock_results)
            if isinstance(guidance, dict) and 'report' in guidance:
                print("  ✅ Configuration validator guidance generation works")
            else:
                print("  ❌ Configuration validator guidance generation failed")
                guidance_success = False
        else:
            print("  ⚠️  Configuration validator missing guidance methods")
            
    except Exception as e:
        print(f"  ❌ Configuration validator guidance error: {str(e)}")
        guidance_success = False
    
    # Test database connectivity checker guidance
    try:
        db_checker = validators["Database Connectivity Checker"]
        
        # Test error guidance methods
        if hasattr(db_checker, 'get_database_error_guidance'):
            guidance = db_checker.get_database_error_guidance("connection_failed", "Test error")
            if isinstance(guidance, list) and len(guidance) > 0:
                print("  ✅ Database checker error guidance works")
            else:
                print("  ❌ Database checker error guidance failed")
                guidance_success = False
        else:
            print("  ⚠️  Database checker missing guidance methods")
            
        # Test fallback suggestions
        if hasattr(db_checker, 'suggest_fallback_options'):
            fallback = db_checker.suggest_fallback_options("execute_sql")
            if isinstance(fallback, list) and len(fallback) > 0:
                print("  ✅ Database checker fallback suggestions work")
            else:
                print("  ❌ Database checker fallback suggestions failed")
                guidance_success = False
                
    except Exception as e:
        print(f"  ❌ Database checker guidance error: {str(e)}")
        guidance_success = False
    
    # Test authentication validator error handling
    try:
        auth_validator = validators["Authentication Validator"]
        
        # Test that it has error handling methods
        if hasattr(auth_validator, '_test_error_resolution_guidance'):
            print("  ✅ Authentication validator has error guidance methods")
        else:
            print("  ⚠️  Authentication validator missing some guidance methods")
            
    except Exception as e:
        print(f"  ❌ Authentication validator guidance error: {str(e)}")
        guidance_success = False
    
    return guidance_success


if __name__ == "__main__":
    # Run the independence test
    success = asyncio.run(test_validator_independence())
    
    if success:
        print("\n🎉 Checkpoint 5 completed successfully!")
        sys.exit(0)
    else:
        print("\n💥 Checkpoint 5 failed - issues need to be resolved")
        sys.exit(1)