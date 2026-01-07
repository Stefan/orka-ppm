"""
Property-based tests for Budget Alert Generation
Feature: ai-ppm-platform, Property 15: Budget Alert Generation
Validates: Requirements 5.3
"""

import pytest
from hypothesis import given, strategies as st, assume, settings
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from unittest.mock import Mock, patch, MagicMock
from datetime import date, datetime, timedelta
import uuid
import json

# Import budget alert functions from main.py
from main import (
    check_budget_thresholds,
    send_budget_alert_notification,
    BudgetAlert,
    calculate_budget_variance
)

# Test data strategies for property-based testing
@st.composite
def project_strategy(draw):
    """Generate valid project data for budget alert testing"""
    budget = draw(st.floats(min_value=1000.0, max_value=1000000.0, allow_nan=False, allow_infinity=False))
    # Generate actual cost that could trigger alerts
    actual_cost = draw(st.floats(min_value=0.0, max_value=budget * 2.0, allow_nan=False, allow_infinity=False))
    
    return {
        "id": str(uuid.uuid4()),
        "name": f"Test Project {draw(st.text(min_size=1, max_size=50))}",
        "description": draw(st.one_of(st.none(), st.text(max_size=200))),
        "budget": budget,
        "actual_cost": actual_cost,
        "status": draw(st.sampled_from(["planning", "active", "on-hold", "completed"])),
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat()
    }

@st.composite
def alert_rule_strategy(draw):
    """Generate valid budget alert rules for testing"""
    alert_types = ["warning", "critical", "overrun"]
    
    return {
        "id": str(uuid.uuid4()),
        "project_id": draw(st.one_of(st.none(), st.just(str(uuid.uuid4())))),
        "threshold_percentage": draw(st.floats(min_value=50.0, max_value=150.0, allow_nan=False, allow_infinity=False)),
        "alert_type": draw(st.sampled_from(alert_types)),
        "recipients": draw(st.lists(st.emails(), min_size=1, max_size=5)),
        "is_active": draw(st.booleans()),
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat()
    }

@st.composite
def budget_threshold_scenario_strategy(draw):
    """Generate scenarios where budget thresholds are exceeded"""
    threshold = draw(st.floats(min_value=50.0, max_value=100.0, allow_nan=False, allow_infinity=False))
    budget = draw(st.floats(min_value=1000.0, max_value=100000.0, allow_nan=False, allow_infinity=False))
    
    # Generate actual cost that exceeds the threshold
    min_cost_for_alert = budget * (threshold / 100.0)
    actual_cost = draw(st.floats(
        min_value=min_cost_for_alert, 
        max_value=budget * 2.0, 
        allow_nan=False, 
        allow_infinity=False
    ))
    
    project = {
        "id": str(uuid.uuid4()),
        "name": f"Test Project {draw(st.text(min_size=1, max_size=50))}",
        "budget": budget,
        "actual_cost": actual_cost
    }
    
    alert_rule = {
        "id": str(uuid.uuid4()),
        "project_id": None,  # Applies to all projects
        "threshold_percentage": threshold,
        "alert_type": draw(st.sampled_from(["warning", "critical", "overrun"])),
        "recipients": draw(st.lists(st.emails(), min_size=1, max_size=3)),
        "is_active": True
    }
    
    return {"project": project, "alert_rule": alert_rule}

class TestBudgetAlertGeneration:
    """Property 15: Budget Alert Generation tests"""

    @settings(max_examples=10)
    @given(scenario=budget_threshold_scenario_strategy())
    def test_budget_alert_generation_for_threshold_exceeded(self, scenario):
        """
        Property 15: Budget Alert Generation
        For any project exceeding budget thresholds, automated alerts should be generated to designated stakeholders
        Validates: Requirements 5.3
        """
        project = scenario["project"]
        alert_rule = scenario["alert_rule"]
        
        # Calculate expected utilization percentage (rounded like the implementation)
        budget = project["budget"]
        actual_cost = project["actual_cost"]
        threshold = alert_rule["threshold_percentage"]
        
        utilization_percentage = round((actual_cost / budget) * 100, 2) if budget > 0 else 0
        
        # Ensure the scenario actually exceeds the threshold
        assume(utilization_percentage >= threshold)
        
        # Test the check_budget_thresholds function
        alerts = check_budget_thresholds(project, [alert_rule])
        
        # Verify that an alert was generated
        assert len(alerts) == 1, f"Expected 1 alert for project exceeding {threshold}% threshold (actual: {utilization_percentage:.1f}%)"
        
        alert = alerts[0]
        
        # Verify alert properties
        assert alert.project_id == uuid.UUID(project["id"]), "Alert should reference the correct project"
        assert alert.alert_type == alert_rule["alert_type"], "Alert should have the correct type"
        assert alert.threshold_percentage == threshold, "Alert should reference the correct threshold"
        
        # The implementation rounds to 2 decimal places, so we should expect that
        assert alert.current_percentage == utilization_percentage, f"Alert should show current utilization percentage (expected: {utilization_percentage}%, got: {alert.current_percentage}%)"
        assert alert.budget_amount == budget, "Alert should show correct budget amount"
        assert alert.actual_cost == actual_cost, "Alert should show correct actual cost"
        assert alert.variance == (actual_cost - budget), "Alert should calculate variance correctly"
        assert alert.recipients == alert_rule["recipients"], "Alert should target the correct recipients"
        assert alert.message is not None and len(alert.message) > 0, "Alert should have a descriptive message"
        
        # Verify message contains relevant information
        assert project["name"] in alert.message, "Alert message should contain project name"
        
        # The message format depends on alert type, so check appropriately
        if alert_rule["alert_type"] == "overrun":
            # For overrun alerts, the message shows "exceeded budget by X%" where X = utilization - 100
            exceeded_by = utilization_percentage - 100
            exceeded_str = f"{exceeded_by:.1f}%"
            assert exceeded_str in alert.message, f"Overrun alert message should contain exceeded percentage: {alert.message}"
        else:
            # For warning and critical alerts, the message shows the utilization percentage
            percentage_str = f"{utilization_percentage:.1f}%"
            assert percentage_str in alert.message, f"Alert message should contain utilization percentage: {alert.message}"

    @settings(max_examples=10)
    @given(project=project_strategy())
    def test_budget_alert_generation_respects_active_rules_only(self, project):
        """
        Property 15: Budget Alert Generation - Active Rules Only
        For any project, only active alert rules should generate alerts
        Validates: Requirements 5.3
        """
        # Create one active and one inactive rule with same threshold
        threshold = 60.0
        
        active_rule = {
            "id": str(uuid.uuid4()),
            "project_id": None,
            "threshold_percentage": threshold,
            "alert_type": "warning",
            "recipients": ["active@example.com"],
            "is_active": True
        }
        
        inactive_rule = {
            "id": str(uuid.uuid4()),
            "project_id": None,
            "threshold_percentage": threshold,
            "alert_type": "critical",
            "recipients": ["inactive@example.com"],
            "is_active": False
        }
        
        # Ensure project exceeds threshold
        project["actual_cost"] = project["budget"] * 0.8  # 80% utilization
        
        # Test with both rules (active and inactive)
        all_alerts = check_budget_thresholds(project, [active_rule, inactive_rule])
        
        # Test with only active rule
        active_alerts = check_budget_thresholds(project, [active_rule])
        
        # Verify that only active rules generate alerts
        assert len(all_alerts) == 1, "Only active rules should generate alerts"
        assert len(active_alerts) == 1, "Active rule should generate exactly one alert"
        assert len(all_alerts) == len(active_alerts), "Same number of alerts should be generated"
        
        # Verify the generated alert comes from the active rule
        alert = all_alerts[0]
        assert alert.alert_type == active_rule["alert_type"], "Alert should come from active rule"
        assert alert.recipients == active_rule["recipients"], "Alert should have recipients from active rule"

    @settings(max_examples=10)
    @given(project=project_strategy(), alert_rules=st.lists(alert_rule_strategy(), min_size=2, max_size=4))
    def test_budget_alert_generation_multiple_thresholds(self, project, alert_rules):
        """
        Property 15: Budget Alert Generation - Multiple Thresholds
        For any project with multiple applicable alert rules, all exceeded thresholds should generate alerts
        Validates: Requirements 5.3
        """
        # Make all rules active and applicable to all projects
        for rule in alert_rules:
            rule["is_active"] = True
            rule["project_id"] = None  # Apply to all projects
        
        # Set different threshold levels
        thresholds = [60.0, 80.0, 100.0, 120.0]
        for i, rule in enumerate(alert_rules):
            rule["threshold_percentage"] = thresholds[i % len(thresholds)]
        
        # Set project cost to exceed multiple thresholds
        project["actual_cost"] = project["budget"] * 1.1  # 110% utilization
        
        utilization_percentage = (project["actual_cost"] / project["budget"]) * 100
        
        # Determine which thresholds should be exceeded
        exceeded_thresholds = [rule for rule in alert_rules if rule["threshold_percentage"] <= utilization_percentage]
        
        # Skip if no thresholds are exceeded
        assume(len(exceeded_thresholds) > 0)
        
        # Generate alerts
        alerts = check_budget_thresholds(project, alert_rules)
        
        # Verify correct number of alerts generated
        assert len(alerts) == len(exceeded_thresholds), f"Expected {len(exceeded_thresholds)} alerts for {utilization_percentage:.1f}% utilization"
        
        # Verify each exceeded threshold generated an alert
        alert_thresholds = [alert.threshold_percentage for alert in alerts]
        expected_thresholds = [rule["threshold_percentage"] for rule in exceeded_thresholds]
        
        for threshold in expected_thresholds:
            assert threshold in alert_thresholds, f"Threshold {threshold}% should have generated an alert"

    @settings(max_examples=10)
    @given(project=project_strategy(), alert_rule=alert_rule_strategy())
    def test_budget_alert_generation_project_specific_rules(self, project, alert_rule):
        """
        Property 15: Budget Alert Generation - Project-Specific Rules
        For any project-specific alert rule, alerts should only be generated for the specified project
        Validates: Requirements 5.3
        """
        # Make rule active and project-specific
        alert_rule["is_active"] = True
        alert_rule["project_id"] = project["id"]
        alert_rule["threshold_percentage"] = 50.0  # Low threshold to ensure alert triggers
        
        # Set project cost to exceed threshold
        project["actual_cost"] = project["budget"] * 0.8  # 80% utilization
        
        # Create another project that also exceeds threshold
        other_project = {
            "id": str(uuid.uuid4()),
            "name": "Other Test Project",
            "budget": project["budget"],
            "actual_cost": project["actual_cost"]  # Same cost structure
        }
        
        # Test alert generation for target project
        target_alerts = check_budget_thresholds(project, [alert_rule])
        
        # Test alert generation for other project
        other_alerts = check_budget_thresholds(other_project, [alert_rule])
        
        # Verify project-specific rule behavior
        assert len(target_alerts) == 1, "Project-specific rule should generate alert for target project"
        assert len(other_alerts) == 0, "Project-specific rule should not generate alert for other projects"
        
        # Verify alert references correct project
        assert target_alerts[0].project_id == uuid.UUID(project["id"]), "Alert should reference the correct project"

    @settings(max_examples=10)
    @given(projects=st.lists(project_strategy(), min_size=2, max_size=5))
    def test_budget_alert_generation_no_false_positives(self, projects):
        """
        Property 15: Budget Alert Generation - No False Positives
        For any projects under budget thresholds, no alerts should be generated
        Validates: Requirements 5.3
        """
        # Create alert rule with high threshold
        alert_rule = {
            "id": str(uuid.uuid4()),
            "project_id": None,  # Apply to all projects
            "threshold_percentage": 90.0,  # High threshold
            "alert_type": "warning",
            "recipients": ["test@example.com"],
            "is_active": True
        }
        
        # Ensure all projects are well under the threshold
        for project in projects:
            project["actual_cost"] = project["budget"] * 0.5  # 50% utilization, well under 90%
        
        # Test alert generation for each project
        for project in projects:
            alerts = check_budget_thresholds(project, [alert_rule])
            
            utilization_percentage = (project["actual_cost"] / project["budget"]) * 100
            
            # Verify no false positive alerts
            assert len(alerts) == 0, f"No alerts should be generated for project at {utilization_percentage:.1f}% utilization (threshold: 90%)"

    @settings(max_examples=10)
    @given(project=project_strategy())
    def test_budget_alert_generation_handles_zero_budget(self, project):
        """
        Property 15: Budget Alert Generation - Zero Budget Handling
        For any project with zero or invalid budget, no alerts should be generated
        Validates: Requirements 5.3
        """
        # Set project budget to zero
        project["budget"] = 0.0
        project["actual_cost"] = 1000.0  # Some actual cost
        
        # Create alert rule
        alert_rule = {
            "id": str(uuid.uuid4()),
            "project_id": None,
            "threshold_percentage": 50.0,
            "alert_type": "warning",
            "recipients": ["test@example.com"],
            "is_active": True
        }
        
        # Test alert generation
        alerts = check_budget_thresholds(project, [alert_rule])
        
        # Verify no alerts for zero budget projects
        assert len(alerts) == 0, "No alerts should be generated for projects with zero budget"

    @settings(max_examples=10)
    @given(scenario=budget_threshold_scenario_strategy())
    @patch('main.supabase')
    def test_budget_alert_notification_storage(self, mock_supabase, scenario):
        """
        Property 15: Budget Alert Generation - Alert Storage
        For any generated alert, it should be properly stored in the database
        Validates: Requirements 5.3
        """
        project = scenario["project"]
        alert_rule = scenario["alert_rule"]
        
        # Mock successful database insertion
        mock_response = Mock()
        mock_response.data = [{"id": str(uuid.uuid4()), "created_at": datetime.now().isoformat()}]
        mock_supabase.table.return_value.insert.return_value.execute.return_value = mock_response
        
        # Generate alert
        alerts = check_budget_thresholds(project, [alert_rule])
        assume(len(alerts) == 1)
        
        alert = alerts[0]
        
        # Test alert notification/storage
        import asyncio
        result = asyncio.run(send_budget_alert_notification(alert))
        
        # Verify storage was attempted
        assert result == True, "Alert notification should succeed when database is available"
        
        # Verify database interaction
        mock_supabase.table.assert_called_with("budget_alerts")
        mock_supabase.table.return_value.insert.assert_called_once()
        
        # Verify stored data structure
        stored_data = mock_supabase.table.return_value.insert.call_args[0][0]
        
        assert stored_data["project_id"] == str(alert.project_id), "Stored alert should reference correct project"
        assert stored_data["alert_type"] == alert.alert_type, "Stored alert should have correct type"
        assert stored_data["threshold_percentage"] == alert.threshold_percentage, "Stored alert should have correct threshold"
        assert stored_data["current_percentage"] == alert.current_percentage, "Stored alert should have correct current percentage"
        assert stored_data["budget_amount"] == alert.budget_amount, "Stored alert should have correct budget amount"
        assert stored_data["actual_cost"] == alert.actual_cost, "Stored alert should have correct actual cost"
        assert stored_data["variance"] == alert.variance, "Stored alert should have correct variance"
        assert stored_data["message"] == alert.message, "Stored alert should have correct message"
        assert stored_data["recipients"] == alert.recipients, "Stored alert should have correct recipients"
        assert stored_data["is_resolved"] == False, "New alerts should be unresolved"

if __name__ == "__main__":
    # Run the tests
    pytest.main([__file__, "-v"])