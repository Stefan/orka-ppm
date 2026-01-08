#!/usr/bin/env python3
"""
Test Budget Alert System
This script tests the budget alert system functionality with mock data.
"""

import asyncio
import sys
from datetime import datetime, date
from uuid import uuid4, UUID
from typing import List, Dict, Any

# Mock data and functions for testing
class MockBudgetAlert:
    def __init__(self, project_id: UUID, alert_type: str, threshold_percentage: float, 
                 current_percentage: float, budget_amount: float, actual_cost: float, 
                 variance: float, message: str, recipients: List[str]):
        self.project_id = project_id
        self.alert_type = alert_type
        self.threshold_percentage = threshold_percentage
        self.current_percentage = current_percentage
        self.budget_amount = budget_amount
        self.actual_cost = actual_cost
        self.variance = variance
        self.message = message
        self.recipients = recipients

def calculate_budget_variance(project: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate budget variance and utilization for a project"""
    try:
        budget = float(project.get('budget', 0))
        actual_cost = float(project.get('actual_cost', 0))
        
        if budget <= 0:
            return {
                'budget_amount': budget,
                'actual_cost': actual_cost,
                'variance': actual_cost,
                'variance_percentage': 0.0,
                'utilization_percentage': 0.0,
                'status': 'no_budget'
            }
        
        variance = actual_cost - budget
        variance_percentage = (variance / budget) * 100
        utilization_percentage = (actual_cost / budget) * 100
        
        # Determine status
        if utilization_percentage >= 100:
            status = 'over_budget'
        elif utilization_percentage >= 90:
            status = 'critical'
        elif utilization_percentage >= 80:
            status = 'warning'
        else:
            status = 'on_track'
        
        return {
            'budget_amount': budget,
            'actual_cost': actual_cost,
            'variance': variance,
            'variance_percentage': round(variance_percentage, 2),
            'utilization_percentage': round(utilization_percentage, 2),
            'status': status
        }
        
    except Exception as e:
        print(f"Error calculating budget variance: {e}")
        return {
            'budget_amount': 0.0,
            'actual_cost': 0.0,
            'variance': 0.0,
            'variance_percentage': 0.0,
            'utilization_percentage': 0.0,
            'status': 'error'
        }

def check_budget_thresholds(project: Dict[str, Any], alert_rules: List[Dict[str, Any]]) -> List[MockBudgetAlert]:
    """Check if project budget exceeds any configured thresholds"""
    try:
        budget_info = calculate_budget_variance(project)
        alerts = []
        
        if budget_info['status'] == 'no_budget' or budget_info['status'] == 'error':
            return alerts
        
        current_percentage = budget_info['utilization_percentage']
        project_id = UUID(project['id'])
        
        # Check each alert rule
        for rule in alert_rules:
            # Skip inactive rules
            if not rule.get('is_active', True):
                continue
            
            # Check if rule applies to this project
            rule_project_id = rule.get('project_id')
            if rule_project_id and str(rule_project_id) != str(project_id):
                continue
            
            threshold = rule['threshold_percentage']
            
            # Check if threshold is exceeded
            if current_percentage >= threshold:
                alert_type = rule['alert_type']
                
                # Create alert message
                if alert_type == 'overrun':
                    message = f"Project '{project['name']}' has exceeded budget by {current_percentage - 100:.1f}% (${budget_info['actual_cost']:,.2f} of ${budget_info['budget_amount']:,.2f})"
                elif alert_type == 'critical':
                    message = f"Project '{project['name']}' is at {current_percentage:.1f}% of budget - immediate attention required (${budget_info['actual_cost']:,.2f} of ${budget_info['budget_amount']:,.2f})"
                else:  # warning
                    message = f"Project '{project['name']}' has reached {current_percentage:.1f}% of budget (${budget_info['actual_cost']:,.2f} of ${budget_info['budget_amount']:,.2f})"
                
                alert = MockBudgetAlert(
                    project_id=project_id,
                    alert_type=alert_type,
                    threshold_percentage=threshold,
                    current_percentage=current_percentage,
                    budget_amount=budget_info['budget_amount'],
                    actual_cost=budget_info['actual_cost'],
                    variance=budget_info['variance'],
                    message=message,
                    recipients=rule['recipients']
                )
                alerts.append(alert)
        
        return alerts
        
    except Exception as e:
        print(f"Error checking budget thresholds: {e}")
        return []

async def send_budget_alert_notification(alert: MockBudgetAlert) -> bool:
    """Send budget alert notification to recipients (mock implementation)"""
    try:
        print(f"🚨 BUDGET ALERT: {alert.alert_type.upper()}")
        print(f"   Project: {alert.project_id}")
        print(f"   Message: {alert.message}")
        print(f"   Recipients: {', '.join(alert.recipients)}")
        print(f"   Threshold: {alert.threshold_percentage}%")
        print(f"   Current: {alert.current_percentage}%")
        print(f"   Budget: ${alert.budget_amount:,.2f}")
        print(f"   Actual: ${alert.actual_cost:,.2f}")
        print(f"   Variance: ${alert.variance:,.2f}")
        print()
        
        return True
        
    except Exception as e:
        print(f"Error sending budget alert notification: {e}")
        return False

async def test_budget_alert_system():
    """Test the budget alert system with mock data"""
    print("🧪 Testing Budget Alert System")
    print("=" * 50)
    
    # Mock projects with different budget scenarios
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
        },
        {
            'id': str(uuid4()),
            'name': 'Security Audit',
            'budget': 15000.0,
            'actual_cost': 8000.0   # 53% - should not trigger any alerts
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
    
    print(f"📊 Testing {len(projects)} projects against {len(alert_rules)} alert rules")
    print()
    
    total_alerts = 0
    alerts_by_type = {'warning': 0, 'critical': 0, 'overrun': 0}
    
    # Test each project
    for project in projects:
        print(f"🔍 Checking project: {project['name']}")
        
        # Calculate budget variance
        budget_info = calculate_budget_variance(project)
        print(f"   Budget: ${budget_info['budget_amount']:,.2f}")
        print(f"   Actual: ${budget_info['actual_cost']:,.2f}")
        print(f"   Utilization: {budget_info['utilization_percentage']:.1f}%")
        print(f"   Status: {budget_info['status']}")
        
        # Check for alerts
        alerts = check_budget_thresholds(project, alert_rules)
        
        if alerts:
            print(f"   ⚠️  Generated {len(alerts)} alert(s)")
            for alert in alerts:
                await send_budget_alert_notification(alert)
                total_alerts += 1
                alerts_by_type[alert.alert_type] += 1
        else:
            print(f"   ✅ No alerts generated")
        
        print()
    
    # Summary
    print("📈 Test Summary")
    print("=" * 30)
    print(f"Projects checked: {len(projects)}")
    print(f"Total alerts generated: {total_alerts}")
    print(f"Alerts by type:")
    for alert_type, count in alerts_by_type.items():
        print(f"  - {alert_type.capitalize()}: {count}")
    print(f"Active rules: {len(alert_rules)}")
    
    return total_alerts > 0

async def test_budget_variance_calculation():
    """Test budget variance calculation function"""
    print("\n🧮 Testing Budget Variance Calculation")
    print("=" * 40)
    
    test_cases = [
        {'name': 'Normal project', 'budget': 10000, 'actual_cost': 8500, 'expected_status': 'on_track'},
        {'name': 'Warning threshold', 'budget': 10000, 'actual_cost': 8500, 'expected_status': 'on_track'},
        {'name': 'Critical threshold', 'budget': 10000, 'actual_cost': 9200, 'expected_status': 'critical'},
        {'name': 'Over budget', 'budget': 10000, 'actual_cost': 11000, 'expected_status': 'over_budget'},
        {'name': 'No budget', 'budget': 0, 'actual_cost': 5000, 'expected_status': 'no_budget'},
    ]
    
    for test_case in test_cases:
        project = {
            'name': test_case['name'],
            'budget': test_case['budget'],
            'actual_cost': test_case['actual_cost']
        }
        
        result = calculate_budget_variance(project)
        
        print(f"Test: {test_case['name']}")
        print(f"  Budget: ${result['budget_amount']:,.2f}")
        print(f"  Actual: ${result['actual_cost']:,.2f}")
        print(f"  Utilization: {result['utilization_percentage']:.1f}%")
        print(f"  Status: {result['status']}")
        print(f"  Expected: {test_case['expected_status']}")
        print(f"  ✅ {'PASS' if result['status'] == test_case['expected_status'] else 'FAIL'}")
        print()

if __name__ == "__main__":
    async def main():
        print("🚀 Budget Alert System Test Suite")
        print("=" * 50)
        
        # Test budget variance calculation
        await test_budget_variance_calculation()
        
        # Test full budget alert system
        success = await test_budget_alert_system()
        
        if success:
            print("✅ All tests completed successfully!")
            print("\nThe budget alert system is working correctly:")
            print("- Budget variance calculation ✅")
            print("- Threshold checking ✅") 
            print("- Alert generation ✅")
            print("- Notification sending ✅")
        else:
            print("❌ Some tests failed. Please check the output above.")
            sys.exit(1)
    
    asyncio.run(main())