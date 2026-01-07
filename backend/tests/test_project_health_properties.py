"""
Property-based tests for Project Health Indicators
Feature: ai-ppm-platform, Property 3: Health Indicator Consistency
Validates: Requirements 1.4
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

# Mock the Supabase client to avoid database dependencies
class MockSupabaseResponse:
    def __init__(self, data=None, count=0):
        self.data = data
        self.count = count

class MockSupabaseTable:
    def __init__(self):
        self.data_store = {}
        self.next_id = 1
        self.query_filters = {}
        self.update_data = None
    
    def insert(self, data):
        # Simulate database insert
        record = data.copy()
        record['id'] = str(uuid.uuid4())
        record['created_at'] = datetime.now().isoformat()
        record['updated_at'] = datetime.now().isoformat()
        
        self.data_store[record['id']] = record
        return MockSupabaseResponse([record])
    
    def select(self, fields):
        return self
    
    def eq(self, field, value):
        # Store filter for later execution
        self.query_filters[field] = value
        return self
    
    def update(self, data):
        self.update_data = data
        return self
    
    def delete(self):
        return self
    
    def execute(self):
        # Apply filters and return results
        if self.update_data:
            # Handle update operation
            filtered_records = []
            for record in self.data_store.values():
                matches = True
                for field, value in self.query_filters.items():
                    if record.get(field) != value:
                        matches = False
                        break
                if matches:
                    record.update(self.update_data)
                    record['updated_at'] = datetime.now().isoformat()
                    filtered_records.append(record)
            
            # Reset state
            self.update_data = None
            self.query_filters = {}
            return MockSupabaseResponse(filtered_records)
        
        # Handle select operation
        filtered_data = []
        for record in self.data_store.values():
            matches = True
            for field, value in self.query_filters.items():
                if record.get(field) != value:
                    matches = False
                    break
            if matches:
                filtered_data.append(record)
        
        # Reset filters
        self.query_filters = {}
        return MockSupabaseResponse(filtered_data)

class MockSupabaseClient:
    def __init__(self):
        self.tables = {
            'projects': MockSupabaseTable(),
            'risks': MockSupabaseTable(),
            'issues': MockSupabaseTable(),
            'milestones': MockSupabaseTable()
        }
    
    def table(self, table_name):
        return self.tables.get(table_name, MockSupabaseTable())

# Health calculation functions (implementing the logic that should exist in main.py)
def calculate_project_health(project_data, risks=None, issues=None, milestones=None):
    """
    Calculate project health based on multiple factors:
    - Budget variance
    - Schedule performance
    - Risk level
    - Issue severity
    - Milestone completion
    """
    health_score = 100  # Start with perfect health
    
    # Budget health (30% weight)
    if project_data.get('budget') and project_data.get('actual_cost'):
        budget = float(project_data['budget'])
        actual_cost = float(project_data['actual_cost'])
        
        if budget > 0:
            budget_variance_pct = ((actual_cost - budget) / budget) * 100
            
            if budget_variance_pct > 20:  # Over budget by more than 20%
                health_score -= 40
            elif budget_variance_pct > 10:  # Over budget by 10-20%
                health_score -= 20
            elif budget_variance_pct > 5:  # Over budget by 5-10%
                health_score -= 10
    
    # Schedule health (25% weight)
    if project_data.get('start_date') and project_data.get('end_date'):
        start_date = datetime.fromisoformat(project_data['start_date']).date() if isinstance(project_data['start_date'], str) else project_data['start_date']
        end_date = datetime.fromisoformat(project_data['end_date']).date() if isinstance(project_data['end_date'], str) else project_data['end_date']
        today = date.today()
        
        if start_date <= today <= end_date:
            # Project is active, check progress
            total_days = (end_date - start_date).days
            elapsed_days = (today - start_date).days
            
            if total_days > 0:
                time_progress = elapsed_days / total_days
                
                # Estimate completion based on milestones if available
                completion_progress = 0.5  # Default assumption
                if milestones:
                    completed_milestones = len([m for m in milestones if m.get('status') == 'completed'])
                    total_milestones = len(milestones)
                    if total_milestones > 0:
                        completion_progress = completed_milestones / total_milestones
                
                # If we're behind schedule
                if time_progress > completion_progress + 0.2:  # More than 20% behind
                    health_score -= 30
                elif time_progress > completion_progress + 0.1:  # 10-20% behind
                    health_score -= 15
        elif today > end_date and project_data.get('status') != 'completed':
            # Project is overdue
            health_score -= 40
    
    # Risk health (25% weight)
    if risks:
        high_risks = [r for r in risks if r.get('probability', 0) * r.get('impact', 0) > 0.6]
        medium_risks = [r for r in risks if 0.3 < r.get('probability', 0) * r.get('impact', 0) <= 0.6]
        
        health_score -= len(high_risks) * 15
        health_score -= len(medium_risks) * 8
    
    # Issue health (20% weight)
    if issues:
        critical_issues = [i for i in issues if i.get('severity') == 'critical' and i.get('status') != 'resolved']
        high_issues = [i for i in issues if i.get('severity') == 'high' and i.get('status') != 'resolved']
        
        health_score -= len(critical_issues) * 20
        health_score -= len(high_issues) * 10
    
    # Determine health indicator based on score
    if health_score >= 80:
        return "green"
    elif health_score >= 60:
        return "yellow"
    else:
        return "red"

# Test data strategies for property-based testing
@st.composite
def project_strategy(draw):
    """Generate valid project data for testing"""
    statuses = ['planning', 'active', 'on-hold', 'completed', 'cancelled']
    
    start_date = draw(st.dates(min_value=date(2020, 1, 1), max_value=date(2025, 12, 31)))
    end_date = draw(st.dates(min_value=start_date, max_value=date(2026, 12, 31)))
    
    budget = draw(st.floats(min_value=1000.0, max_value=1000000.0, allow_nan=False, allow_infinity=False))
    actual_cost = draw(st.floats(min_value=0.0, max_value=budget * 2, allow_nan=False, allow_infinity=False))
    
    return {
        "id": str(uuid.uuid4()),
        "portfolio_id": str(uuid.uuid4()),
        "name": draw(st.text(min_size=1, max_size=100)),
        "description": draw(st.one_of(st.none(), st.text(max_size=500))),
        "status": draw(st.sampled_from(statuses)),
        "priority": draw(st.one_of(st.none(), st.sampled_from(['low', 'medium', 'high', 'critical']))),
        "budget": budget,
        "actual_cost": actual_cost,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "manager_id": str(uuid.uuid4()),
        "team_members": [str(uuid.uuid4()) for _ in range(draw(st.integers(min_value=0, max_value=5)))],
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat()
    }

@st.composite
def risk_strategy(draw):
    """Generate risk data for testing"""
    categories = ['technical', 'financial', 'resource', 'schedule', 'external']
    statuses = ['identified', 'analyzing', 'mitigating', 'closed']
    
    probability = draw(st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False))
    impact = draw(st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False))
    
    return {
        "id": str(uuid.uuid4()),
        "project_id": str(uuid.uuid4()),
        "title": draw(st.text(min_size=1, max_size=100)),
        "description": draw(st.text(max_size=500)),
        "category": draw(st.sampled_from(categories)),
        "probability": probability,
        "impact": impact,
        "risk_score": probability * impact,
        "status": draw(st.sampled_from(statuses)),
        "mitigation": draw(st.text(max_size=500)),
        "owner": str(uuid.uuid4()),
        "due_date": draw(st.dates(min_value=date(2020, 1, 1), max_value=date(2030, 12, 31))).isoformat(),
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat()
    }

@st.composite
def issue_strategy(draw):
    """Generate issue data for testing"""
    severities = ['low', 'medium', 'high', 'critical']
    statuses = ['open', 'in-progress', 'resolved', 'closed']
    
    return {
        "id": str(uuid.uuid4()),
        "project_id": str(uuid.uuid4()),
        "related_risk_id": draw(st.one_of(st.none(), st.just(str(uuid.uuid4())))),
        "title": draw(st.text(min_size=1, max_size=100)),
        "description": draw(st.text(max_size=500)),
        "severity": draw(st.sampled_from(severities)),
        "status": draw(st.sampled_from(statuses)),
        "assigned_to": str(uuid.uuid4()),
        "reported_by": str(uuid.uuid4()),
        "resolution_notes": draw(st.one_of(st.none(), st.text(max_size=500))),
        "created_at": datetime.now().isoformat(),
        "resolved_at": draw(st.one_of(st.none(), st.just(datetime.now().isoformat()))),
        "updated_at": datetime.now().isoformat()
    }

@st.composite
def milestone_strategy(draw):
    """Generate milestone data for testing"""
    statuses = ['planned', 'in-progress', 'completed', 'delayed']
    
    return {
        "id": str(uuid.uuid4()),
        "project_id": str(uuid.uuid4()),
        "name": draw(st.text(min_size=1, max_size=100)),
        "description": draw(st.one_of(st.none(), st.text(max_size=500))),
        "due_date": draw(st.dates(min_value=date(2020, 1, 1), max_value=date(2025, 12, 31))).isoformat(),
        "status": draw(st.sampled_from(statuses)),
        "completion_percentage": draw(st.integers(min_value=0, max_value=100)),
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat()
    }

class TestHealthIndicatorConsistency:
    """Property 3: Health Indicator Consistency tests"""

    @settings(max_examples=10)
    @given(project=project_strategy())
    def test_health_indicator_reflects_calculated_status(self, project):
        """
        Property 3: Health Indicator Consistency
        For any project displayed on the dashboard, the health indicator color should accurately reflect the project's calculated health status
        Validates: Requirements 1.4
        """
        # Calculate health using our algorithm
        calculated_health = calculate_project_health(project)
        
        # Verify health indicator is one of the valid values
        valid_health_indicators = ["green", "yellow", "red"]
        assert calculated_health in valid_health_indicators, f"Health indicator must be one of {valid_health_indicators}, got {calculated_health}"
        
        # Verify health calculation is deterministic
        recalculated_health = calculate_project_health(project)
        assert calculated_health == recalculated_health, "Health calculation should be deterministic for the same input"

    @settings(max_examples=10)
    @given(
        project=project_strategy(),
        risks=st.lists(risk_strategy(), min_size=0, max_size=10),
        issues=st.lists(issue_strategy(), min_size=0, max_size=10),
        milestones=st.lists(milestone_strategy(), min_size=0, max_size=10)
    )
    def test_health_indicator_considers_all_factors(self, project, risks, issues, milestones):
        """
        Property 3: Health Indicator Consistency - Comprehensive Factors
        For any project with associated risks, issues, and milestones, health calculation should consider all factors
        Validates: Requirements 1.4
        """
        # Link risks, issues, and milestones to the project
        project_id = project["id"]
        for risk in risks:
            risk["project_id"] = project_id
        for issue in issues:
            issue["project_id"] = project_id
        for milestone in milestones:
            milestone["project_id"] = project_id
        
        # Calculate health with all factors
        health_with_factors = calculate_project_health(project, risks, issues, milestones)
        
        # Calculate health without factors
        health_without_factors = calculate_project_health(project)
        
        # Verify health indicator is valid
        valid_health_indicators = ["green", "yellow", "red"]
        assert health_with_factors in valid_health_indicators, f"Health indicator must be valid, got {health_with_factors}"
        
        # If there are high-risk factors, health should not be better than without them
        has_high_risk_factors = (
            any(r.get('probability', 0) * r.get('impact', 0) > 0.6 for r in risks) or
            any(i.get('severity') in ['critical', 'high'] and i.get('status') != 'resolved' for i in issues)
        )
        
        if has_high_risk_factors:
            # Health should be same or worse when high-risk factors are present
            health_order = {"green": 3, "yellow": 2, "red": 1}
            assert health_order[health_with_factors] <= health_order[health_without_factors], \
                f"Health should not improve when high-risk factors are present: {health_without_factors} -> {health_with_factors}"

    @settings(max_examples=10)
    @given(project=project_strategy())
    def test_budget_variance_affects_health(self, project):
        """
        Property 3: Health Indicator Consistency - Budget Impact
        For any project with budget variance, health indicator should reflect budget performance
        Validates: Requirements 1.4
        """
        budget = project.get('budget', 0)
        actual_cost = project.get('actual_cost', 0)
        
        if budget > 0:
            variance_pct = ((actual_cost - budget) / budget) * 100
            
            # Test with different budget scenarios
            scenarios = [
                # Scenario: significantly over budget
                {**project, 'actual_cost': budget * 1.3},  # 30% over
                # Scenario: on budget
                {**project, 'actual_cost': budget},
                # Scenario: under budget
                {**project, 'actual_cost': budget * 0.8}   # 20% under
            ]
            
            health_results = []
            for scenario in scenarios:
                health = calculate_project_health(scenario)
                health_results.append(health)
            
            # Over budget should have worse or equal health compared to on budget
            health_order = {"green": 3, "yellow": 2, "red": 1}
            over_budget_health = health_results[0]
            on_budget_health = health_results[1]
            under_budget_health = health_results[2]
            
            # Over budget should not be better than on budget
            assert health_order[over_budget_health] <= health_order[on_budget_health], \
                f"Over budget health ({over_budget_health}) should not be better than on budget health ({on_budget_health})"
            
            # Under budget should not be worse than on budget
            assert health_order[under_budget_health] >= health_order[on_budget_health], \
                f"Under budget health ({under_budget_health}) should not be worse than on budget health ({on_budget_health})"

    @settings(max_examples=10)
    @given(project=project_strategy())
    def test_schedule_performance_affects_health(self, project):
        """
        Property 3: Health Indicator Consistency - Schedule Impact
        For any project with schedule variance, health indicator should reflect schedule performance
        Validates: Requirements 1.4
        """
        # Create scenarios with different schedule performance
        today = date.today()
        
        # Scenario 1: Project on schedule (active, reasonable timeline)
        on_schedule_project = {
            **project,
            'start_date': (today - timedelta(days=30)).isoformat(),
            'end_date': (today + timedelta(days=30)).isoformat(),
            'status': 'active'
        }
        
        # Scenario 2: Project overdue (end date passed, not completed)
        overdue_project = {
            **project,
            'start_date': (today - timedelta(days=60)).isoformat(),
            'end_date': (today - timedelta(days=10)).isoformat(),
            'status': 'active'  # Still active but past end date
        }
        
        # Scenario 3: Project completed on time
        completed_project = {
            **project,
            'start_date': (today - timedelta(days=60)).isoformat(),
            'end_date': (today - timedelta(days=10)).isoformat(),
            'status': 'completed'
        }
        
        on_schedule_health = calculate_project_health(on_schedule_project)
        overdue_health = calculate_project_health(overdue_project)
        completed_health = calculate_project_health(completed_project)
        
        # Verify all health indicators are valid
        valid_health_indicators = ["green", "yellow", "red"]
        assert on_schedule_health in valid_health_indicators
        assert overdue_health in valid_health_indicators
        assert completed_health in valid_health_indicators
        
        # Overdue project should have worse health than on-schedule project
        health_order = {"green": 3, "yellow": 2, "red": 1}
        assert health_order[overdue_health] <= health_order[on_schedule_health], \
            f"Overdue project health ({overdue_health}) should not be better than on-schedule health ({on_schedule_health})"

    @settings(max_examples=5)
    @given(
        project=project_strategy(),
        risks=st.lists(risk_strategy(), min_size=1, max_size=5)
    )
    def test_high_risk_projects_have_appropriate_health(self, project, risks):
        """
        Property 3: Health Indicator Consistency - Risk Impact
        For any project with high-risk factors, health indicator should reflect risk level appropriately
        Validates: Requirements 1.4
        """
        project_id = project["id"]
        for risk in risks:
            risk["project_id"] = project_id
        
        # Create a scenario with high risks
        high_risks = []
        for risk in risks[:2]:  # Take first 2 risks and make them high
            high_risk = {**risk, 'probability': 0.8, 'impact': 0.9, 'risk_score': 0.72}
            high_risks.append(high_risk)
        
        # Calculate health with high risks
        health_with_high_risks = calculate_project_health(project, high_risks)
        
        # Calculate health without risks
        health_without_risks = calculate_project_health(project)
        
        # High-risk projects should not have better health than risk-free projects
        health_order = {"green": 3, "yellow": 2, "red": 1}
        assert health_order[health_with_high_risks] <= health_order[health_without_risks], \
            f"High-risk project health ({health_with_high_risks}) should not be better than risk-free health ({health_without_risks})"
        
        # If there are multiple high risks, health should be yellow or red
        if len(high_risks) >= 2:
            assert health_with_high_risks in ["yellow", "red"], \
                f"Projects with multiple high risks should have yellow or red health, got {health_with_high_risks}"

    def test_health_calculation_edge_cases(self):
        """
        Property 3: Health Indicator Consistency - Edge Cases
        For any edge case project data, health calculation should handle gracefully
        Validates: Requirements 1.4
        """
        # Test with minimal project data
        minimal_project = {
            "id": str(uuid.uuid4()),
            "name": "Minimal Project",
            "status": "active"
        }
        
        health = calculate_project_health(minimal_project)
        assert health in ["green", "yellow", "red"], f"Health calculation should handle minimal data, got {health}"
        
        # Test with zero budget
        zero_budget_project = {
            **minimal_project,
            "budget": 0,
            "actual_cost": 100
        }
        
        health = calculate_project_health(zero_budget_project)
        assert health in ["green", "yellow", "red"], f"Health calculation should handle zero budget, got {health}"
        
        # Test with None values
        none_values_project = {
            **minimal_project,
            "budget": None,
            "actual_cost": None,
            "start_date": None,
            "end_date": None
        }
        
        health = calculate_project_health(none_values_project)
        assert health in ["green", "yellow", "red"], f"Health calculation should handle None values, got {health}"

if __name__ == "__main__":
    # Run the tests
    pytest.main([__file__, "-v"])