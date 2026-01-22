"""
Checkpoint Verification Test - Task 5

This test verifies that the property-based testing infrastructure is working correctly
by checking domain generators produce valid and realistic data.

**Feature: property-based-testing**
**Task: 5. Checkpoint - Ensure testing infrastructure is working correctly**
"""

import pytest
from hypothesis import given, settings
from tests.property_tests.pbt_framework.domain_generators import DomainGenerators


class TestCheckpointVerification:
    """Verify testing infrastructure is working correctly."""
    
    @given(project=DomainGenerators.project_data())
    @settings(max_examples=10)
    def test_project_generator_samples(self, project):
        """Sample project generator output to verify realistic data."""
        print(f"\nProject sample: {project}")
        
        # Verify required fields
        assert 'name' in project
        assert 'budget' in project
        assert 'status' in project
        
        # Verify realistic values
        assert len(project['name']) > 0
        assert project['budget'] >= 0
        assert project['status'] in ['planning', 'active', 'completed', 'cancelled', 'on_hold']
    
    @given(record=DomainGenerators.financial_record())
    @settings(max_examples=10)
    def test_financial_record_generator_samples(self, record):
        """Sample financial record generator output to verify realistic data."""
        print(f"\nFinancial record sample: {record}")
        
        # Verify required fields
        assert 'planned_amount' in record
        assert 'actual_amount' in record
        assert 'currency' in record
        
        # Verify realistic values
        assert record['planned_amount'] >= 0
        assert record['actual_amount'] >= 0
        assert record['currency'] in ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD']
        
        # Verify variance calculations if present
        if 'variance_amount' in record:
            expected_variance = record['actual_amount'] - record['planned_amount']
            assert abs(record['variance_amount'] - expected_variance) < 0.1
    
    @given(assignment=DomainGenerators.user_role_assignment())
    @settings(max_examples=10)
    def test_user_role_assignment_generator_samples(self, assignment):
        """Sample user role assignment generator output to verify realistic data."""
        print(f"\nUser role assignment sample: {assignment}")
        
        # Verify required fields
        assert 'user_id' in assignment
        assert 'role' in assignment
        
        # Verify realistic values
        assert assignment['role'] in ['admin', 'portfolio_manager', 'project_manager', 'viewer', 'contributor', 'analyst']
        
        # Verify scope consistency
        if assignment.get('scope_type'):
            assert assignment['scope_type'] in ['project', 'portfolio', 'organization']
            assert assignment.get('scope_id') is not None
    
    def test_iteration_count_verification(self):
        """Verify that tests run with minimum 100 iterations."""
        from tests.property_tests.pbt_framework.test_config import get_test_settings
        
        config = get_test_settings("default")
        assert config.min_iterations >= 100, "Default config should have minimum 100 iterations"
        
        ci_config = get_test_settings("ci")
        assert ci_config.min_iterations >= 100, "CI config should have minimum 100 iterations"
        
        print(f"\n✓ Default config iterations: {config.min_iterations}")
        print(f"✓ CI config iterations: {ci_config.min_iterations}")
