"""
Property-Based Tests for PBT Framework Integration

This module validates that the property-based testing framework is correctly
integrated with pytest and Hypothesis, and that domain generators produce
valid data.

Feature: property-based-testing
Task: 1.1 Write property test for framework integration
Task: 2.1 Create custom Hypothesis generators for PPM domain objects
**Property 1: Framework Integration Completeness**
**Property 4: Domain Generator Validity**
**Validates: Requirements 1.1, 1.2, 1.5**
"""

import pytest
from datetime import datetime, date
from uuid import UUID
from typing import Dict, Any

from hypothesis import given, settings, assume
from hypothesis import strategies as st

# Import the PBT framework
from tests.property_tests.pbt_framework import (
    BackendPBTFramework,
    DomainGenerators,
    PBTTestConfig,
    get_test_settings
)

# Import specialized generators
from tests.property_tests.pbt_framework.domain_generators import (
    edge_case_financial_record,
    currency_conversion_pair,
    rbac_test_scenario,
    project_with_financials
)


class TestFrameworkIntegration:
    """
    Test suite for validating PBT framework integration.
    
    **Property 1: Framework Integration Completeness**
    For any backend property test setup, pytest and Hypothesis must integrate
    correctly to generate diverse test cases and execute minimum 100 iterations
    per property.
    
    **Validates: Requirements 1.1, 1.2**
    """
    
    def test_framework_initialization(self):
        """
        Test that BackendPBTFramework initializes correctly.
        
        **Validates: Requirements 1.1**
        """
        framework = BackendPBTFramework()
        
        assert framework is not None
        assert framework.generators is not None
        assert framework.config is not None
        assert framework.config.min_iterations >= 100, \
            "Framework must be configured for minimum 100 iterations"
    
    def test_framework_with_custom_config(self):
        """
        Test framework initialization with custom configuration.
        
        **Validates: Requirements 1.1, 1.2**
        """
        config = PBTTestConfig(
            min_iterations=200,
            seed=42,
            ci_mode=True
        )
        
        framework = BackendPBTFramework(config=config)
        
        assert framework.config.min_iterations == 200
        assert framework.config.seed == 42
        assert framework.config.ci_mode is True
    
    def test_profile_settings(self):
        """
        Test that all profiles are correctly configured.
        
        **Validates: Requirements 1.2, 1.4**
        """
        profiles = ["default", "ci", "dev", "thorough"]
        
        for profile_name in profiles:
            config = get_test_settings(profile_name)
            assert config is not None
            assert config.profile_name == profile_name
            
            # Default and CI profiles must have at least 100 iterations
            if profile_name in ["default", "ci", "thorough"]:
                assert config.min_iterations >= 100, \
                    f"Profile {profile_name} must have at least 100 iterations"
    
    @given(st.integers(min_value=100, max_value=1000))
    @settings(max_examples=100)
    def test_iteration_count_enforcement(self, iterations: int):
        """
        Property test: Framework enforces minimum iteration count.
        
        For any requested iteration count >= 100, the framework must
        configure tests with at least that many iterations.
        
        **Validates: Requirements 1.2**
        """
        config = PBTTestConfig(min_iterations=iterations)
        framework = BackendPBTFramework(config=config)
        
        assert framework.config.min_iterations >= 100
        assert framework.config.min_iterations == iterations


class TestDomainGeneratorValidity:
    """
    Test suite for validating domain generators produce valid data.
    
    **Property 4: Domain Generator Validity**
    For any custom generator for domain-specific data types, generated data
    must be valid and realistic.
    
    Task: 2.1 Create custom Hypothesis generators for PPM domain objects
    **Validates: Requirements 1.5**
    """
    
    @given(project=DomainGenerators.project_data())
    @settings(max_examples=100)
    def test_project_data_generator_validity(self, project: Dict[str, Any]):
        """
        Property test: Project data generator produces valid projects.
        
        For any generated project data:
        - Must have a valid UUID id
        - Must have a non-empty name
        - Must have a non-negative budget
        - Must have a valid status
        - Must have valid dates (if included)
        
        Task: 2.1 Create custom Hypothesis generators for PPM domain objects
        **Validates: Requirements 1.5**
        """
        # Validate required fields exist
        assert 'id' in project
        assert 'name' in project
        assert 'budget' in project
        assert 'status' in project
        
        # Validate UUID
        assert isinstance(project['id'], UUID)
        
        # Validate name is non-empty
        assert len(project['name']) > 0
        
        # Validate budget is non-negative
        assert project['budget'] >= 0
        
        # Validate status is valid
        valid_statuses = ['planning', 'active', 'on_hold', 'completed', 'cancelled']
        assert project['status'] in valid_statuses
        
        # Validate health indicator if present
        if 'health' in project:
            assert project['health'] in ['green', 'yellow', 'red']
        
        # Validate dates if present
        if 'start_date' in project and 'end_date' in project:
            start = date.fromisoformat(project['start_date'])
            end = date.fromisoformat(project['end_date'])
            assert end >= start, "End date must be after or equal to start date"
        
        # Validate new fields
        if 'priority' in project:
            assert project['priority'] in ['low', 'medium', 'high', 'critical', 'emergency']
        
        if 'department' in project:
            assert len(project['department']) > 0
    
    @given(project=DomainGenerators.project_data(realistic_names=True))
    @settings(max_examples=100)
    def test_project_data_realistic_names(self, project: Dict[str, Any]):
        """
        Property test: Project data with realistic names follows expected patterns.
        
        Task: 2.1 Create custom Hypothesis generators for PPM domain objects
        **Validates: Requirements 1.5**
        """
        # Realistic names should contain a dash separator
        assert '-' in project['name'], "Realistic names should contain department separator"
        
        # Name should not be empty
        assert len(project['name']) > 0
    
    @given(record=DomainGenerators.financial_record())
    @settings(max_examples=100)
    def test_financial_record_generator_validity(self, record: Dict[str, Any]):
        """
        Property test: Financial record generator produces valid records.
        
        For any generated financial record:
        - Must have valid planned and actual amounts
        - Must have a valid currency code
        - Must have a valid exchange rate (if included)
        - Variance calculations must be mathematically correct
        
        Task: 2.1 Create custom Hypothesis generators for PPM domain objects
        **Validates: Requirements 1.5**
        """
        # Validate required fields
        assert 'planned_amount' in record
        assert 'actual_amount' in record
        assert 'currency' in record
        
        # Validate amounts are non-negative
        assert record['planned_amount'] >= 0
        assert record['actual_amount'] >= 0
        
        # Validate currency is valid
        valid_currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD']
        assert record['currency'] in valid_currencies
        
        # Validate exchange rate if present
        if 'exchange_rate' in record:
            assert record['exchange_rate'] > 0
            assert record['exchange_rate'] <= 200.0  # Allow for JPY rates
        
        # Validate variance calculation
        if 'variance_amount' in record:
            expected_variance = record['actual_amount'] - record['planned_amount']
            # Use slightly larger tolerance for floating point precision
            assert abs(record['variance_amount'] - expected_variance) < 0.02
        
        # Validate variance status if present
        if 'variance_status' in record:
            assert record['variance_status'] in ['under_budget', 'on_budget', 'over_budget']
    
    @given(record=DomainGenerators.financial_record(realistic_exchange_rates=True))
    @settings(max_examples=100)
    def test_financial_record_realistic_exchange_rates(self, record: Dict[str, Any]):
        """
        Property test: Financial records with realistic exchange rates are within expected ranges.
        
        Task: 2.1 Create custom Hypothesis generators for PPM domain objects
        **Validates: Requirements 1.5**
        """
        if 'exchange_rate' in record:
            currency = record['currency']
            rate = record['exchange_rate']
            
            # Verify rate is within realistic range for the currency
            expected_ranges = {
                'USD': (1.0, 1.0),
                'EUR': (0.85, 0.95),
                'GBP': (0.75, 0.85),
                'JPY': (100.0, 150.0),
                'CHF': (0.85, 0.95),
                'CAD': (1.25, 1.40),
                'AUD': (1.40, 1.60),
            }
            
            if currency in expected_ranges:
                min_rate, max_rate = expected_ranges[currency]
                assert min_rate <= rate <= max_rate, \
                    f"Exchange rate {rate} for {currency} outside expected range [{min_rate}, {max_rate}]"
    
    @given(assignment=DomainGenerators.user_role_assignment())
    @settings(max_examples=100)
    def test_user_role_assignment_generator_validity(self, assignment: Dict[str, Any]):
        """
        Property test: User role assignment generator produces valid assignments.
        
        For any generated user role assignment:
        - Must have a valid user UUID
        - Must have a valid role
        - Scope must be consistent (scope_id present only if scope_type is set)
        
        Task: 2.1 Create custom Hypothesis generators for PPM domain objects
        **Validates: Requirements 1.5**
        """
        # Validate required fields
        assert 'user_id' in assignment
        assert 'role' in assignment
        
        # Validate UUID
        assert isinstance(assignment['user_id'], UUID)
        
        # Validate role is valid
        valid_roles = ['admin', 'portfolio_manager', 'project_manager', 'viewer', 'analyst']
        assert assignment['role'] in valid_roles
        
        # Validate scope consistency
        if 'scope_type' in assignment:
            if assignment['scope_type'] is not None:
                assert 'scope_id' in assignment
                assert assignment['scope_id'] is not None
            else:
                # scope_type is None, scope_id should also be None
                if 'scope_id' in assignment:
                    assert assignment['scope_id'] is None
        
        # Validate role level if present
        if 'role_level' in assignment:
            expected_levels = {
                'admin': 100,
                'portfolio_manager': 80,
                'project_manager': 60,
                'analyst': 40,
                'viewer': 20
            }
            assert assignment['role_level'] == expected_levels[assignment['role']]
    
    @given(assignment=DomainGenerators.user_role_assignment(include_permissions=True))
    @settings(max_examples=100)
    def test_user_role_assignment_permissions(self, assignment: Dict[str, Any]):
        """
        Property test: User role assignments have correct derived permissions.
        
        Task: 2.1 Create custom Hypothesis generators for PPM domain objects
        **Validates: Requirements 1.5**
        """
        if 'permissions' in assignment:
            permissions = assignment['permissions']
            role = assignment['role']
            
            # All roles should have read permission
            assert 'read' in permissions
            
            # Admin should have all permissions
            if role == 'admin':
                assert 'admin' in permissions
                assert 'manage_users' in permissions
            
            # Portfolio manager should have management permissions
            if role == 'portfolio_manager':
                assert 'manage_projects' in permissions
            
            # Project manager should have create/update permissions
            if role == 'project_manager':
                assert 'create' in permissions
                assert 'update' in permissions
    
    @given(portfolio=DomainGenerators.portfolio_data())
    @settings(max_examples=100)
    def test_portfolio_data_generator_validity(self, portfolio: Dict[str, Any]):
        """
        Property test: Portfolio data generator produces valid portfolios.
        
        For any generated portfolio:
        - Must have a valid UUID id
        - Must have a non-empty name
        - Must have a non-negative total budget
        - Project IDs must be valid UUID strings
        
        **Validates: Requirements 1.5**
        """
        # Validate required fields
        assert 'id' in portfolio
        assert 'name' in portfolio
        assert 'total_budget' in portfolio
        
        # Validate UUID
        assert isinstance(portfolio['id'], UUID)
        
        # Validate name
        assert len(portfolio['name']) > 0
        
        # Validate budget
        assert portfolio['total_budget'] >= 0
        
        # Validate project IDs if present
        if 'project_ids' in portfolio:
            for pid in portfolio['project_ids']:
                # Should be valid UUID string
                UUID(pid)  # Will raise if invalid
    
    @given(risk=DomainGenerators.risk_record())
    @settings(max_examples=100)
    def test_risk_record_generator_validity(self, risk: Dict[str, Any]):
        """
        Property test: Risk record generator produces valid risk records.
        
        For any generated risk record:
        - Probability must be between 0 and 1
        - Impact must be between 0 and 1
        - Risk score must equal probability * impact
        - Category must be valid
        
        **Validates: Requirements 1.5**
        """
        # Validate probability and impact ranges
        assert 0 <= risk['probability'] <= 1
        assert 0 <= risk['impact'] <= 1
        
        # Validate risk score calculation
        expected_score = risk['probability'] * risk['impact']
        assert abs(risk['risk_score'] - expected_score) < 0.0001
        
        # Validate category
        valid_categories = ['technical', 'schedule', 'cost', 'resource', 'external', 'regulatory']
        assert risk['category'] in valid_categories
    
    @given(allocation=DomainGenerators.resource_allocation())
    @settings(max_examples=100)
    def test_resource_allocation_generator_validity(self, allocation: Dict[str, Any]):
        """
        Property test: Resource allocation generator produces valid allocations.
        
        For any generated resource allocation:
        - Allocation percentage must be between 0 and 100
        - Hours per week must be consistent with percentage
        - Dates must be valid
        
        **Validates: Requirements 1.5**
        """
        # Validate allocation percentage
        assert 0 <= allocation['allocation_percentage'] <= 100
        
        # Validate hours calculation (based on 40-hour week)
        expected_hours = (allocation['allocation_percentage'] / 100) * 40
        assert abs(allocation['hours_per_week'] - expected_hours) < 0.01
        
        # Validate dates
        start = date.fromisoformat(allocation['start_date'])
        end = date.fromisoformat(allocation['end_date'])
        assert end >= start


class TestHypothesisIntegration:
    """
    Test suite for validating Hypothesis integration.
    
    **Property 1: Framework Integration Completeness**
    Validates that Hypothesis is properly integrated and generates
    diverse test cases.
    
    **Validates: Requirements 1.1, 1.2**
    """
    
    @given(st.integers(), st.integers())
    @settings(max_examples=100)
    def test_hypothesis_basic_integration(self, a: int, b: int):
        """
        Basic test to verify Hypothesis integration works.
        
        **Validates: Requirements 1.1**
        """
        # Simple property: addition is commutative
        assert a + b == b + a
    
    @given(
        projects=st.lists(DomainGenerators.project_data(), min_size=1, max_size=10)
    )
    @settings(max_examples=100)
    def test_hypothesis_with_domain_generators(self, projects):
        """
        Test Hypothesis integration with domain generators.
        
        **Validates: Requirements 1.1, 1.5**
        """
        # All projects should have valid structure
        for project in projects:
            assert 'id' in project
            assert 'name' in project
            assert 'budget' in project
        
        # List should have expected size
        assert 1 <= len(projects) <= 10
    
    @given(
        project=DomainGenerators.project_data(),
        records=st.lists(DomainGenerators.financial_record(), min_size=0, max_size=5)
    )
    @settings(max_examples=100)
    def test_hypothesis_composite_data_generation(self, project, records):
        """
        Test Hypothesis generates composite data correctly.
        
        **Validates: Requirements 1.1, 1.5**
        """
        # Project should be valid
        assert isinstance(project['id'], UUID)
        
        # All records should be valid
        for record in records:
            assert record['planned_amount'] >= 0
            assert record['actual_amount'] >= 0


class TestMinimumIterationEnforcement:
    """
    Test suite for validating minimum 100 iterations per property.
    
    **Validates: Requirements 1.2**
    """
    
    def test_default_config_has_100_iterations(self):
        """
        Test that default configuration has at least 100 iterations.
        
        **Validates: Requirements 1.2**
        """
        config = get_test_settings("default")
        assert config.min_iterations >= 100
    
    def test_ci_config_has_sufficient_iterations(self):
        """
        Test that CI configuration has sufficient iterations.
        
        **Validates: Requirements 1.2**
        """
        config = get_test_settings("ci")
        assert config.min_iterations >= 100
    
    def test_thorough_config_has_many_iterations(self):
        """
        Test that thorough configuration has many iterations.
        
        **Validates: Requirements 1.2**
        """
        config = get_test_settings("thorough")
        assert config.min_iterations >= 100


class TestSpecializedGenerators:
    """
    Test suite for validating specialized generators for edge cases and scenarios.
    
    Task: 2.1 Create custom Hypothesis generators for PPM domain objects
    **Validates: Requirements 1.5**
    """
    
    @given(record=edge_case_financial_record())
    @settings(max_examples=100)
    def test_edge_case_financial_record_validity(self, record: Dict[str, Any]):
        """
        Property test: Edge case financial records are valid and properly categorized.
        
        Task: 2.1 Create custom Hypothesis generators for PPM domain objects
        **Validates: Requirements 1.5**
        """
        # Validate edge case type is present
        assert 'edge_case_type' in record
        assert record['edge_case_type'] in [
            'zero_budget', 'tiny_amount', 'large_amount',
            'extreme_over_budget', 'extreme_under_budget'
        ]
        
        # Validate amounts are non-negative
        assert record['planned_amount'] >= 0
        assert record['actual_amount'] >= 0
        
        # Validate specific edge case constraints
        if record['edge_case_type'] == 'zero_budget':
            assert record['planned_amount'] == 0
        elif record['edge_case_type'] == 'tiny_amount':
            assert record['planned_amount'] <= 1.0
        elif record['edge_case_type'] == 'large_amount':
            assert record['planned_amount'] >= 1_000_000
    
    @given(pair=currency_conversion_pair())
    @settings(max_examples=100)
    def test_currency_conversion_pair_validity(self, pair: Dict[str, Any]):
        """
        Property test: Currency conversion pairs have valid data for testing.
        
        Task: 2.1 Create custom Hypothesis generators for PPM domain objects
        **Validates: Requirements 1.5**
        """
        # Validate currencies
        valid_currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD']
        assert pair['from_currency'] in valid_currencies
        assert pair['to_currency'] in valid_currencies
        
        # Validate exchange rates are positive
        assert pair['from_rate_to_usd'] > 0
        assert pair['to_rate_to_usd'] > 0
        
        # Validate amount is positive
        assert pair['amount'] > 0
    
    @given(scenario=rbac_test_scenario())
    @settings(max_examples=100)
    def test_rbac_test_scenario_validity(self, scenario: Dict[str, Any]):
        """
        Property test: RBAC test scenarios are valid and consistent.
        
        Task: 2.1 Create custom Hypothesis generators for PPM domain objects
        **Validates: Requirements 1.5**
        """
        # Validate user fields
        assert isinstance(scenario['user_id'], UUID)
        assert scenario['user_role'] in ['admin', 'portfolio_manager', 'project_manager', 'viewer', 'analyst']
        
        # Validate role level matches role
        expected_levels = {
            'admin': 100,
            'portfolio_manager': 80,
            'project_manager': 60,
            'analyst': 40,
            'viewer': 20
        }
        assert scenario['user_role_level'] == expected_levels[scenario['user_role']]
        
        # Validate action and permission
        assert scenario['action'] in ['read', 'create', 'update', 'delete', 'admin']
        assert scenario['required_permission'] in ['read', 'create', 'update', 'delete', 'admin']
        
        # Validate expected_access is boolean
        assert isinstance(scenario['expected_access'], bool)
        
        # Validate expected_access logic
        if scenario['required_permission'] in scenario['user_permissions']:
            assert scenario['expected_access'] is True
        else:
            assert scenario['expected_access'] is False
    
    @given(project_data=project_with_financials())
    @settings(max_examples=100)
    def test_project_with_financials_validity(self, project_data: Dict[str, Any]):
        """
        Property test: Projects with financials have consistent aggregated data.
        
        Task: 2.1 Create custom Hypothesis generators for PPM domain objects
        **Validates: Requirements 1.5**
        """
        project = project_data['project']
        records = project_data['financial_records']
        aggregated = project_data['aggregated']
        
        # Validate project exists
        assert isinstance(project['id'], UUID)
        
        # Validate records exist
        assert len(records) >= 1
        
        # Validate all records reference the project
        for record in records:
            assert record['project_id'] == project['id']
        
        # Validate aggregated totals
        calculated_planned = sum(r['planned_amount'] for r in records)
        calculated_actual = sum(r['actual_amount'] for r in records)
        
        # Allow small floating point tolerance
        assert abs(aggregated['total_planned'] - calculated_planned) < 0.1
        assert abs(aggregated['total_actual'] - calculated_actual) < 0.1
        
        # Validate variance calculation
        expected_variance = aggregated['total_actual'] - aggregated['total_planned']
        assert abs(aggregated['total_variance'] - expected_variance) < 0.1


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
