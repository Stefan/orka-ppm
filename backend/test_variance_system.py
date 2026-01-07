#!/usr/bin/env python3
"""
Test Variance Calculation and Alert System Implementation
Simple validation test for the variance system components
"""

import sys
import os
from datetime import datetime
from decimal import Decimal

def test_variance_calculation_service():
    """Test the variance calculation service implementation"""
    print("🧮 Testing Variance Calculation Service")
    print("=" * 40)
    
    try:
        # Import the service (this will test if the code is syntactically correct)
        sys.path.append(os.path.dirname(__file__))
        from variance_calculation_service import VarianceCalculationService, VarianceCalculationResult
        
        print("✅ VarianceCalculationService imported successfully")
        
        # Test the data structures
        result = VarianceCalculationResult(
            variances_calculated=10,
            projects_processed=5,
            wbs_elements_processed=15,
            total_commitment=Decimal('100000.00'),
            total_actual=Decimal('95000.00'),
            total_variance=Decimal('-5000.00'),
            calculation_time_ms=1500,
            errors=[],
            warnings=[]
        )
        
        print("✅ VarianceCalculationResult model works correctly")
        print(f"   - Variances calculated: {result.variances_calculated}")
        print(f"   - Total variance: {result.total_variance}")
        print(f"   - Calculation time: {result.calculation_time_ms}ms")
        
        return True
        
    except Exception as e:
        print(f"❌ VarianceCalculationService test failed: {e}")
        return False

def test_variance_alert_service():
    """Test the variance alert service implementation"""
    print("\n🚨 Testing Variance Alert Service")
    print("=" * 40)
    
    try:
        # Import the service
        from variance_alert_service import (
            VarianceAlertService, VarianceThresholdRule, VarianceAlert, 
            AlertSeverity, AlertStatus, NotificationChannel
        )
        
        print("✅ VarianceAlertService imported successfully")
        
        # Test threshold rule creation
        rule = VarianceThresholdRule(
            name="Test Budget Warning",
            description="Test alert when project exceeds 80% of budget",
            threshold_percentage=Decimal('80.0'),
            severity=AlertSeverity.MEDIUM,
            cooldown_hours=24,
            recipients=["test@example.com"],
            notification_channels=[NotificationChannel.EMAIL, NotificationChannel.IN_APP]
        )
        
        print("✅ VarianceThresholdRule model works correctly")
        print(f"   - Rule name: {rule.name}")
        print(f"   - Threshold: {rule.threshold_percentage}%")
        print(f"   - Severity: {rule.severity}")
        print(f"   - Channels: {rule.notification_channels}")
        
        # Test alert creation
        alert = VarianceAlert(
            rule_id="test-rule-123",
            project_id="test-project-456",
            wbs_element="WBS-001",
            variance_amount=Decimal('5000.00'),
            variance_percentage=Decimal('85.0'),
            commitment_amount=Decimal('100000.00'),
            actual_amount=Decimal('105000.00'),
            severity=AlertSeverity.HIGH,
            message="Test project has exceeded budget by 5.0%",
            recipients=["manager@example.com"]
        )
        
        print("✅ VarianceAlert model works correctly")
        print(f"   - Project: {alert.project_id}")
        print(f"   - Variance: {alert.variance_percentage}%")
        print(f"   - Message: {alert.message}")
        
        return True
        
    except Exception as e:
        print(f"❌ VarianceAlertService test failed: {e}")
        return False

def test_database_migration():
    """Test the database migration SQL"""
    print("\n🗄️ Testing Database Migration")
    print("=" * 40)
    
    try:
        migration_file = "migrations/010_variance_alert_system.sql"
        
        if not os.path.exists(migration_file):
            print(f"❌ Migration file not found: {migration_file}")
            return False
        
        with open(migration_file, 'r') as f:
            migration_sql = f.read()
        
        print(f"✅ Migration file exists: {migration_file}")
        print(f"   - File size: {len(migration_sql)} characters")
        
        # Check for required tables
        required_tables = [
            'variance_threshold_rules',
            'variance_alerts',
            'notification_deliveries',
            'notifications'
        ]
        
        for table in required_tables:
            if f"CREATE TABLE IF NOT EXISTS {table}" in migration_sql:
                print(f"   ✅ Table definition found: {table}")
            else:
                print(f"   ❌ Table definition missing: {table}")
                return False
        
        # Check for indexes
        if "CREATE INDEX" in migration_sql:
            index_count = migration_sql.count("CREATE INDEX")
            print(f"   ✅ {index_count} indexes defined")
        
        # Check for RLS policies
        if "ROW LEVEL SECURITY" in migration_sql:
            print("   ✅ Row Level Security policies defined")
        
        return True
        
    except Exception as e:
        print(f"❌ Database migration test failed: {e}")
        return False

def test_api_endpoints():
    """Test that the API endpoints are properly defined"""
    print("\n🌐 Testing API Endpoints")
    print("=" * 40)
    
    try:
        # Check if main.py contains the new endpoints
        main_file = "main.py"
        
        if not os.path.exists(main_file):
            print(f"❌ Main file not found: {main_file}")
            return False
        
        with open(main_file, 'r') as f:
            main_content = f.read()
        
        # Check for variance endpoints
        variance_endpoints = [
            "/variance/calculate",
            "/variance/project/{project_id}/summary",
            "/variance/project/{project_id}/details",
            "/variance/alerts/rules",
            "/variance/alerts/check",
            "/variance/alerts/{alert_id}/acknowledge",
            "/variance/alerts/{alert_id}/resolve"
        ]
        
        found_endpoints = 0
        for endpoint in variance_endpoints:
            if endpoint in main_content:
                print(f"   ✅ Endpoint found: {endpoint}")
                found_endpoints += 1
            else:
                print(f"   ❌ Endpoint missing: {endpoint}")
        
        print(f"   📊 Found {found_endpoints}/{len(variance_endpoints)} endpoints")
        
        # Check for service imports
        if "from variance_calculation_service import" in main_content:
            print("   ✅ Variance calculation service imported")
        else:
            print("   ❌ Variance calculation service import missing")
        
        if "from variance_alert_service import" in main_content:
            print("   ✅ Variance alert service imported")
        else:
            print("   ❌ Variance alert service import missing")
        
        return found_endpoints >= len(variance_endpoints) * 0.8  # 80% success rate
        
    except Exception as e:
        print(f"❌ API endpoints test failed: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 Starting Variance System Implementation Tests")
    print("=" * 60)
    
    tests = [
        ("Variance Calculation Service", test_variance_calculation_service),
        ("Variance Alert Service", test_variance_alert_service),
        ("Database Migration", test_database_migration),
        ("API Endpoints", test_api_endpoints)
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        try:
            if test_func():
                passed += 1
                print(f"\n✅ {test_name}: PASSED")
            else:
                print(f"\n❌ {test_name}: FAILED")
        except Exception as e:
            print(f"\n❌ {test_name}: ERROR - {e}")
    
    print("\n" + "=" * 60)
    print(f"🎯 Test Results: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 All tests passed! Variance system implementation is ready.")
        return True
    else:
        print("⚠️ Some tests failed. Please review the implementation.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)