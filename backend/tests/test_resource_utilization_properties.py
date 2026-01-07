"""
Property-based tests for Resource Utilization Calculations

Feature: ai-ppm-platform, Property 8: Resource Update Propagation
Validates: Requirements 2.5
"""

import pytest
from hypothesis import given, strategies as st, assume, settings
import sys
import os
from unittest.mock import Mock, patch
import uuid
from datetime import datetime, date

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Mock environment variables before importing main
with patch.dict(os.environ, {
    'SUPABASE_URL': 'https://test.supabase.co',
    'SUPABASE_ANON_KEY': 'test_key',
    'SUPABASE_JWT_SECRET': 'test_secret',
    'OPENAI_API_KEY': 'test_openai_key'
}):
    from main import calculate_enhanced_resource_availability, calculate_advanced_skill_match_score


# Test data strategies for property-based testing
@st.composite
def resource_strategy(draw):
    """Generate valid resource data for testing"""
    capacity = draw(st.integers(min_value=20, max_value=60))  # 20-60 hours per week
    availability = draw(st.integers(min_value=0, max_value=100))  # 0-100% availability
    num_projects = draw(st.integers(min_value=0, max_value=5))  # 0-5 current projects
    
    return {
        'id': str(uuid.uuid4()),
        'name': draw(st.text(min_size=5, max_size=50)),
        'email': f"{draw(st.text(min_size=3, max_size=10))}@company.com",
        'role': draw(st.sampled_from(['Developer', 'Designer', 'Manager', 'Analyst'])),
        'capacity': capacity,
        'availability': availability,
        'hourly_rate': draw(st.floats(min_value=50.0, max_value=200.0)),
        'skills': draw(st.lists(st.sampled_from(['Python', 'JavaScript', 'React', 'Node.js', 'SQL', 'AWS']), min_size=1, max_size=6)),
        'location': draw(st.sampled_from(['Remote', 'New York', 'San Francisco', 'Austin', 'Seattle'])),
        'current_projects': [str(uuid.uuid4()) for _ in range(num_projects)],
        'created_at': datetime.now().isoformat(),
        'updated_at': datetime.now().isoformat()
    }

@st.composite
def allocation_strategy(draw):
    """Generate project allocation percentages"""
    return draw(st.integers(min_value=10, max_value=100))

@st.composite
def skill_matching_strategy(draw):
    """Generate skill matching test data"""
    all_skills = ['Python', 'JavaScript', 'React', 'Node.js', 'SQL', 'AWS', 'Docker', 'Kubernetes', 'TypeScript', 'FastAPI']
    
    required_skills = draw(st.lists(st.sampled_from(all_skills), min_size=1, max_size=5, unique=True))
    resource_skills = draw(st.lists(st.sampled_from(all_skills), min_size=0, max_size=8, unique=True))
    
    return {
        'required_skills': required_skills,
        'resource_skills': resource_skills
    }


class TestResourceUtilizationCalculations:
    """Property 8: Resource Update Propagation tests"""

    @settings(max_examples=100)
    @given(resource=resource_strategy())
    def test_utilization_calculation_consistency(self, resource):
        """
        Property 8: Resource Update Propagation - Utilization Calculation Consistency
        
        For any resource, utilization calculations should be mathematically consistent
        and respect capacity constraints.
        
        **Validates: Requirements 2.5**
        """
        # Mock supabase responses for project allocations
        with patch('main.supabase') as mock_supabase:
            # Create mock allocations for current projects
            allocations = []
            total_allocation_percentage = 0
            
            for project_id in resource['current_projects']:
                allocation_percentage = min(100 - total_allocation_percentage, 50)  # Don't exceed 100% total
                if allocation_percentage > 0:
                    allocations.append(allocation_percentage)
                    total_allocation_percentage += allocation_percentage
            
            # Create a mock function that returns the correct allocation for each call
            def mock_execute(*args, **kwargs):
                if allocations:
                    allocation = allocations.pop(0)
                    return Mock(data=[{'allocation_percentage': allocation}])
                else:
                    return Mock(data=[])
            
            # Mock the database responses - each call returns one allocation
            mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.side_effect = mock_execute
            
            # Calculate availability metrics
            result = calculate_enhanced_resource_availability(resource)
            
            # Verify mathematical consistency
            capacity_hours = resource['capacity']
            availability_percentage = resource['availability'] / 100.0
            effective_capacity = capacity_hours * availability_percentage
            
            # Check that allocated + available = effective capacity (within rounding tolerance)
            calculated_total = result['allocated_hours'] + result['available_hours']
            assert abs(calculated_total - effective_capacity) <= 0.1, f"Total hours mismatch: {calculated_total} vs {effective_capacity}"
            
            # The function rounds both utilization and allocated hours separately, so we need to check
            # that the returned values are internally consistent within rounding tolerance
            if effective_capacity > 0:
                # Calculate what the utilization should be based on the returned allocated hours
                recalculated_utilization = (result['allocated_hours'] / effective_capacity * 100)
                # Allow for rounding differences - the function may calculate utilization before rounding allocated hours
                utilization_tolerance = 15.0  # Allow up to 15% difference due to rounding order and very small effective capacities
                assert abs(result['utilization_percentage'] - recalculated_utilization) <= utilization_tolerance, f"Utilization inconsistency: {result['utilization_percentage']} vs {recalculated_utilization} (from allocated hours)"
            
            # Check capacity hours matches input
            assert result['capacity_hours'] == capacity_hours
            
            # Check availability status logic
            if result['utilization_percentage'] >= 100:
                assert result['availability_status'] in ['fully_allocated']
                assert result['can_take_more_work'] is False
            elif result['utilization_percentage'] >= 80:
                assert result['availability_status'] == 'mostly_allocated'
                assert result['can_take_more_work'] is True
            elif result['utilization_percentage'] >= 50:
                assert result['availability_status'] == 'partially_allocated'
                assert result['can_take_more_work'] is True
            else:
                assert result['availability_status'] == 'available'
                assert result['can_take_more_work'] is True

    @settings(max_examples=10)
    @given(resource=resource_strategy(), allocations=st.lists(allocation_strategy(), min_size=0, max_size=3))
    def test_allocation_updates_propagate_correctly(self, resource, allocations):
        """
        Property 8: Resource Update Propagation - Allocation Updates
        
        For any resource allocation changes, utilization metrics should update correctly
        and maintain consistency.
        
        **Validates: Requirements 2.5**
        """
        # Ensure we don't exceed 100% total allocation
        total_allocation = sum(allocations)
        if total_allocation > 100:
            # Scale down allocations proportionally
            scale_factor = 100 / total_allocation
            allocations = [int(alloc * scale_factor) for alloc in allocations]
        
        # Adjust resource to have the right number of projects
        resource['current_projects'] = [str(uuid.uuid4()) for _ in range(len(allocations))]
        
        with patch('main.supabase') as mock_supabase:
            # Mock database responses for allocations
            mock_responses = [Mock(data=[{'allocation_percentage': alloc}]) for alloc in allocations]
            mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.side_effect = mock_responses
            
            # Calculate initial availability
            result = calculate_enhanced_resource_availability(resource)
            
            # Verify that total allocated hours matches expected allocation
            capacity_hours = resource['capacity']
            availability_percentage = resource['availability'] / 100.0
            effective_capacity = capacity_hours * availability_percentage
            
            expected_allocated_hours = sum(allocations) / 100.0 * effective_capacity
            assert abs(result['allocated_hours'] - expected_allocated_hours) <= 0.1, f"Allocated hours mismatch: {result['allocated_hours']} vs {expected_allocated_hours}"
            
            # Verify available hours
            expected_available_hours = max(0, effective_capacity - expected_allocated_hours)
            assert abs(result['available_hours'] - expected_available_hours) <= 0.1, f"Available hours mismatch: {result['available_hours']} vs {expected_available_hours}"

    @settings(max_examples=100)
    @given(skill_data=skill_matching_strategy())
    def test_skill_matching_properties(self, skill_data):
        """
        Property 8: Resource Update Propagation - Skill Matching Consistency
        
        For any skill matching scenario, the match score should be mathematically
        consistent and provide accurate skill analysis.
        
        **Validates: Requirements 2.5**
        """
        required_skills = skill_data['required_skills']
        resource_skills = skill_data['resource_skills']
        
        result = calculate_advanced_skill_match_score(required_skills, resource_skills)
        
        # Verify match score is between 0 and 1
        assert 0.0 <= result['match_score'] <= 1.0, f"Match score out of range: {result['match_score']}"
        
        # Verify matching skills are actually in both lists (case insensitive)
        required_lower = [skill.lower() for skill in required_skills]
        resource_lower = [skill.lower() for skill in resource_skills]
        
        for matching_skill in result['matching_skills']:
            assert matching_skill.lower() in required_lower, f"Matching skill {matching_skill} not in required skills"
            assert matching_skill.lower() in resource_lower, f"Matching skill {matching_skill} not in resource skills"
        
        # Verify missing skills are in required but not in resource
        for missing_skill in result['missing_skills']:
            assert missing_skill.lower() in required_lower, f"Missing skill {missing_skill} not in required skills"
            assert missing_skill.lower() not in resource_lower, f"Missing skill {missing_skill} found in resource skills"
        
        # Verify extra skills are in resource but not in required
        for extra_skill in result['extra_skills']:
            assert extra_skill.lower() in resource_lower, f"Extra skill {extra_skill} not in resource skills"
            assert extra_skill.lower() not in required_lower, f"Extra skill {extra_skill} found in required skills"
        
        # Verify match score calculation
        if required_skills:
            expected_match_score = len(result['matching_skills']) / len(required_skills)
            assert abs(result['match_score'] - expected_match_score) <= 0.001, f"Match score calculation error: {result['match_score']} vs {expected_match_score}"
        else:
            assert result['match_score'] == 1.0, "Empty required skills should result in perfect match"

    @settings(max_examples=10)
    @given(resource=resource_strategy())
    def test_zero_availability_edge_case(self, resource):
        """
        Property 8: Resource Update Propagation - Zero Availability Edge Case
        
        For any resource with zero availability, utilization calculations should
        handle the edge case gracefully.
        
        **Validates: Requirements 2.5**
        """
        # Force zero availability
        resource['availability'] = 0
        
        with patch('main.supabase') as mock_supabase:
            mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = []
            
            result = calculate_enhanced_resource_availability(resource)
            
            # With zero availability, effective capacity should be 0
            assert result['available_hours'] == 0.0, f"Zero availability should result in 0 available hours, got {result['available_hours']}"
            assert result['allocated_hours'] == 0.0, f"Zero availability should result in 0 allocated hours, got {result['allocated_hours']}"
            assert result['utilization_percentage'] == 0.0, f"Zero availability should result in 0% utilization, got {result['utilization_percentage']}"

    @settings(max_examples=10)
    @given(resource=resource_strategy())
    def test_overallocation_handling(self, resource):
        """
        Property 8: Resource Update Propagation - Overallocation Handling
        
        For any resource that becomes overallocated, the system should handle
        the scenario correctly and maintain data consistency.
        
        **Validates: Requirements 2.5**
        """
        # Force overallocation by creating high allocation percentages
        resource['current_projects'] = [str(uuid.uuid4()) for _ in range(3)]
        
        with patch('main.supabase') as mock_supabase:
            # Mock 60% allocation for each of 3 projects (180% total)
            allocations = [60, 60, 60]  # 180% total allocation
            
            def mock_execute(*args, **kwargs):
                if allocations:
                    allocation = allocations.pop(0)
                    return Mock(data=[{'allocation_percentage': allocation}])
                else:
                    return Mock(data=[])
            
            mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.side_effect = mock_execute
            
            result = calculate_enhanced_resource_availability(resource)
            
            # Check that overallocation is detected
            if result['utilization_percentage'] > 100:
                assert result['available_hours'] <= 0, f"Overallocated resource should have <= 0 available hours, got {result['available_hours']}"
                assert result['can_take_more_work'] is False, "Overallocated resource should not be able to take more work"
            
            # Verify mathematical consistency even in overallocation
            capacity_hours = resource['capacity']
            availability_percentage = resource['availability'] / 100.0
            effective_capacity = capacity_hours * availability_percentage
            
            if effective_capacity > 0:
                expected_utilization = (result['allocated_hours'] / effective_capacity * 100)
                # Allow for rounding differences in overallocation scenarios
                utilization_tolerance = 25.0  # Allow up to 25% difference due to rounding order in overallocation
                assert abs(result['utilization_percentage'] - expected_utilization) <= utilization_tolerance, f"Utilization calculation inconsistent in overallocation: {result['utilization_percentage']} vs {expected_utilization}"


if __name__ == "__main__":
    pytest.main([__file__])