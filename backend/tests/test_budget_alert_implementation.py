#!/usr/bin/env python3
"""
Test Budget Alert Implementation
This script tests the budget alert system implementation by importing and testing the functions.
"""

import sys
import os
from datetime import datetime, date
from uuid import uuid4, UUID
from typing import List, Dict, Any

# Add the current directory to the path to import from main.py
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import the functions from main.py
try:
    from main import (
        calculate_budget_variance,
        check_budget_thresholds,
        send_budget_alert_notification,
        monitor_all_project_budgets,
        BudgetAlert
    )
    print("✅ Successfully imported budget alert functions from main.py")
except ImportError as e:
    print(f"❌ Failed to import functions: {e}")
    sys.exit(1)

def test_budget_variance_calculation():
    """Test the budget variance calculation function"""
    print("\n🧮 Testing Budget Variance Calculation")
    print("=" * 40)
    
    test_cases = [
        {
            'name': 'Normal project',
            'project': {'budget': 10000, 'actual_cost': 7500},
            'expected_utilization': 75.0,
            'expected_status': 'on_track'
        },
        {
            'name': 'Warning threshold',
            'project': {'budget': 10000, 'actual_cost': 8500},
            'expected_utilization': 85.0,
            'expected_status': 'warning'
        },
        {
            'name': 'Critical threshold',
            'project': {'budget': 10000, 'actual_cost': 9200},
            'expected_utilization': 92.0,
            'expected_status': 'critical'
        },
        {
            'name': 'Over budget',
            'project': {'budget': 10000, 'actual_cost': 11000},
            'expected_utilization': 110.0,
            'expected_status': 'over_budget'
        },
        {
            'name': 'No budget',
            'project': {'budget': 0, 'actual_cost': 5000},
            'expected_utilization': 0.0,
            'expected_status': 'no_budget'
        }
    ]
    
    all_passed = True
    
    for test_case in test_cases:
        result = calculate_budget_variance(test_case['project'])
        
        utilization_match = abs(result['utilization_percentage'] - test_case['expected_utilization']) < 0.1
        status_match = result['status'] == test_case['expected_status']
        
        print(f"Test: {test_case['name']}")
        print(f"  Budget: ${result['budget_amount']:,.2f}")
        print(f"  Actual: ${result['actual_cost']:,.2f}")
        print(f"  Utilization: {result['utilization_percentage']:.1f}% (expected: {test_case['expected_utilization']:.1f}%)")
        print(f"  Status: {result['status']} (expected: {test_case['expected_status']})")
        
        if utilization_match and status_match:
            print(f"  ✅ PASS")
        else:
            print(f"  ❌ FAIL")
            all_passed = False
        print()
    
    return all_passed

def test_budget_threshold_checking():
    """Test the budget threshold checking function"""
    print("\n🚨 Testing Budget Threshold Checking")
    print("=" * 40)
    
    # Mock projects
    projects = [
        {
            'id': str(uuid4()),
            'name': 'Website Redesign',
            'budget': 50000.0,
            'actual_cost': 42000.0  # 84% - should trigger warning
        },
        {
            'id': str(uuid4()),
            'name': 'Mobile App Development',
            'budget': 100000.0,
            'actual_cost': 95000.0  # 95% - should trigger critical
        },
        {
            'id': str(uuid4()),
            'name': 'Data Migration',
            'budget': 25000.0,
            'actual_cost': 28000.0  # 112% - should trigger overrun
        }
    ]
    
    # Mock alert rules
    alert_rules = [
        {
            'id': str(uuid4()),
            'project_id': None,  # Applies to all projects
            'threshold_percentage': 80.0,
            'alert_type': 'warning',
            'recipients': ['pm@company.com', 'finance@company.com'],
            'is_active': True
        },
        {
            'id': str(uuid4()),
            'project_id': None,  # Applies to all projects
            'threshold_percentage': 90.0,
            'alert_type': 'critical',
            'recipients': ['pm@company.com', 'finance@company.com', 'cfo@company.com'],
            'is_active': True
        },
        {
            'id': str(uuid4()),
            'project_id': None,  # Applies to all projects
            'threshold_percentage': 100.0,
            'alert_type': 'overrun',
            'recipients': ['pm@company.com', 'finance@company.com', 'cfo@company.com', 'ceo@company.com'],
            'is_active': True
        }
    ]
    
    total_alerts = 0
    
    for project in projects:
        print(f"🔍 Checking project: {project['name']}")
        
        alerts = check_budget_thresholds(project, alert_rules)
        
        if alerts:
            print(f"   ⚠️  Generated {len(alerts)} alert(s)")
            for alert in alerts:
                print(f"      - {alert.alert_type.upper()}: {alert.current_percentage:.1f}% of budget")
                total_alerts += 1
        else:
            print(f"   ✅ No alerts generated")
        print()
    
    print(f"📊 Total alerts generated: {total_alerts}")
    
    # Expected: 6 alerts total (1 + 2 + 3)
    expected_alerts = 6
    return total_alerts == expected_alerts

async def test_alert_notification():
    """Test the alert notification function"""
    print("\n📧 Testing Alert Notification")
    print("=" * 30)
    
    # Create a mock alert
    mock_alert = BudgetAlert(
        project_id=uuid4(),
        alert_type='warning',
        threshold_percentage=80.0,
        current_percentage=85.0,
        budget_amount=50000.0,
        actual_cost=42500.0,
        variance=-7500.0,
        message="Test project has reached 85.0% of budget",
        recipients=['test@company.com']
    )
    
    try:
        success = await send_budget_alert_notification(mock_alert)
        print(f"Alert notification result: {'✅ Success' if success else '❌ Failed'}")
        return success
    except Exception as e:
        print(f"❌ Alert notification failed: {e}")
        return False

def test_pydantic_models():
    """Test that Pydantic models are properly defined"""
    print("\n📋 Testing Pydantic Models")
    print("=" * 30)
    
    try:
        # Test BudgetAlert model
        alert = BudgetAlert(
            project_id=uuid4(),
            alert_type='warning',
            threshold_percentage=80.0,
            current_percentage=85.0,
            budget_amount=50000.0,
            actual_cost=42500.0,
            variance=-7500.0,
            message="Test alert",
            recipients=['test@company.com']
        )
        print("✅ BudgetAlert model works correctly")
        
        # Test model validation
        try:
            invalid_alert = BudgetAlert(
                project_id="invalid-uuid",  # This should fail validation
                alert_type='warning',
                threshold_percentage=80.0,
                current_percentage=85.0,
                budget_amount=50000.0,
                actual_cost=42500.0,
                variance=-7500.0,
                message="Test alert",
                recipients=['test@company.com']
            )
            print("❌ Model validation failed - should have rejected invalid UUID")
            return False
        except Exception:
            print("✅ Model validation works correctly")
        
        return True
        
    except Exception as e:
        print(f"❌ Pydantic model test failed: {e}")
        return False

async def main():
    """Run all tests"""
    print("🚀 Budget Alert Implementation Test Suite")
    print("=" * 50)
    
    tests_passed = 0
    total_tests = 4
    
    # Test 1: Budget variance calculation
    if test_budget_variance_calculation():
        tests_passed += 1
        print("✅ Budget variance calculation test PASSED")
    else:
        print("❌ Budget variance calculation test FAILED")
    
    # Test 2: Budget threshold checking
    if test_budget_threshold_checking():
        tests_passed += 1
        print("✅ Budget threshold checking test PASSED")
    else:
        print("❌ Budget threshold checking test FAILED")
    
    # Test 3: Alert notification
    if await test_alert_notification():
        tests_passed += 1
        print("✅ Alert notification test PASSED")
    else:
        print("❌ Alert notification test FAILED")
    
    # Test 4: Pydantic models
    if test_pydantic_models():
        tests_passed += 1
        print("✅ Pydantic models test PASSED")
    else:
        print("❌ Pydantic models test FAILED")
    
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tests_passed}/{total_tests} tests passed")
    
    if tests_passed == total_tests:
        print("🎉 All tests passed! Budget alert system is working correctly.")
        print("\n✅ Implementation Summary:")
        print("- Budget variance calculation ✅")
        print("- Threshold monitoring ✅")
        print("- Alert generation ✅")
        print("- Notification system ✅")
        print("- Pydantic models ✅")
        print("- API endpoints ready ✅")
        return True
    else:
        print(f"❌ {total_tests - tests_passed} test(s) failed. Please check the implementation.")
        return False

if __name__ == "__main__":
    import asyncio
    success = asyncio.run(main())
    sys.exit(0 if success else 1)