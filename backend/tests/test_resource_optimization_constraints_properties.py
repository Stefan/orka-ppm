"""
Property-based tests for Resource Optimization Constraint Compliance

Feature: ai-ppm-platform, Property 6: Optimization Constraint Compliance
Validates: Requirements 2.3
"""

import pytest
from hypothesis import given, strategies as st, assume, settings
import sys
import os
from unittest.mock import Mock, patch, AsyncMock
import uuid
from datetime import datetime, date, timedelta
import asyncio

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Mock environment variables before importing
with patch.dict(os.environ, {
    'SUPABASE_URL': 'https://test.supabase.co',
    'SUPABASE_ANON_KEY': 'test_key',
    'SUPABASE_JWT_SECRET': 'test_secret',
    'OPENAI_API_KEY': 'test_openai_key'
}):
    from ai_agents import ResourceOptimizerAgent


# Test data strategies for property-based testing
@st.composite
def resource_with_constraints_strategy(draw):
    """Generate resources with specific constraint attributes for testing"""
    num_resources = draw(st.integers(min_value=3, max_value=15))
    resources = []
    
    skill_pool = ['Python', 'JavaScript', 'React', 'Node.js', 'SQL', 'AWS', 'Docker', 'Kubernetes', 'Java', 'C#']
    location_pool = ['Remote', 'New York', 'San Francisco', 'Austin', 'Seattle', 'London', 'Berlin']
    
    for i in range(num_resources):
        capacity = draw(st.integers(min_value=20, max_value=60))
        availability = draw(st.integers(min_value=0, max_value=100))
        num_skills = draw(st.integers(min_value=1, max_value=5))
        current_utilization = draw(st.integers(min_value=0, max_value=120))  # Allow over-allocation for testing
        
        resource = {
            'id': str(uuid.uuid4()),
            'name': f'Resource_{i}',
            'email': f"resource{i}@company.com",
            'role': draw(st.sampled_from(['Developer', 'Designer', 'Manager', 'Analyst', 'QA Engineer'])),
            'capacity': capacity,
            'availability': availability,
            'hourly_rate': draw(st.floats(min_value=50.0, max_value=200.0)),
            'skills': draw(st.lists(
                st.sampled_from(skill_pool), 
                min_size=1, max_size=num_skills, unique=True
            )),
            'location': draw(st.sampled_from(location_pool)),
            'current_utilization': current_utilization,
            'available_capacity': max(0, 100 - current_utilization),
            'current_allocations': [],
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
        
        # Add some current allocations based on utilization
        if current_utilization > 0:
            num_allocations = draw(st.integers(min_value=1, max_value=3))
            remaining_utilization = current_utilization
            
            for j in range(num_allocations):
                if remaining_utilization <= 0:
                    break
                    
                allocation_pct = min(remaining_utilization, draw(st.integers(min_value=10, max_value=50)))
                resource['current_allocations'].append({
                    'project_id': str(uuid.uuid4()),
                    'allocation_percentage': allocation_pct
                })
                remaining_utilization -= allocation_pct
        
        resources.append(resource)
    
    return resources

@st.composite
def project_with_constraints_strategy(draw):
    """Generate projects with specific skill and constraint requirements"""
    num_projects = draw(st.integers(min_value=1, max_value=8))
    projects = []
    
    skill_pool = ['Python', 'JavaScript', 'React', 'Node.js', 'SQL', 'AWS', 'Docker', 'Kubernetes', 'Java', 'C#']
    
    for i in range(num_projects):
        num_required_skills = draw(st.integers(min_value=1, max_value=4))
        
        project = {
            'project_id': str(uuid.uuid4()),
            'project_name': f'Project_{i}',
            'status': draw(st.sampled_from(['planning', 'active', 'on-hold'])),
            'priority': draw(st.sampled_from(['low', 'medium', 'high', 'critical'])),
            'required_skills': draw(st.lists(
                st.sampled_from(skill_pool), 
                min_size=1, max_size=num_required_skills, unique=True
            )),
            'estimated_effort': draw(st.integers(min_value=40, max_value=320)),  # hours
            'deadline': (datetime.now() + timedelta(days=draw(st.integers(min_value=30, max_value=180)))).date(),
            'current_team_size': draw(st.integers(min_value=0, max_value=5)),
            'max_team_size': draw(st.integers(min_value=1, max_value=8)),
            'preferred_location': draw(st.sampled_from(['Remote', 'New York', 'San Francisco', 'Austin', 'Seattle', 'London', 'Berlin', None])),
            'workload_intensity': draw(st.sampled_from(['light', 'medium', 'heavy']))
        }
        projects.append(project)
    
    return projects

@st.composite
def optimization_constraints_strategy(draw):
    """Generate optimization constraints for testing"""
    constraints = {}
    
    # Skill constraints
    if draw(st.booleans()):
        skill_pool = ['Python', 'JavaScript', 'React', 'Node.js', 'SQL', 'AWS', 'Docker', 'Kubernetes']
        constraints['required_skills'] = draw(st.lists(
            st.sampled_from(skill_pool), 
            min_size=1, max_size=3, unique=True
        ))
    
    # Availability constraints
    if draw(st.booleans()):
        constraints['min_availability'] = draw(st.integers(min_value=20, max_value=80))
    
    # Utilization constraints
    if draw(st.booleans()):
        constraints['max_utilization'] = draw(st.integers(min_value=70, max_value=95))
    
    # Location constraints
    if draw(st.booleans()):
        constraints['location'] = draw(st.sampled_from(['Remote', 'New York', 'San Francisco', 'Austin', 'Seattle']))
    
    # Workload balancing constraints
    if draw(st.booleans()):
        constraints['balance_workload'] = True
        constraints['target_utilization_min'] = draw(st.integers(min_value=60, max_value=75))
        constraints['target_utilization_max'] = draw(st.integers(min_value=80, max_value=90))
    
    return constraints


class TestResourceOptimizationConstraintCompliance:
    """Property 6: Optimization Constraint Compliance tests"""

    @settings(max_examples=10, deadline=15000)
    @given(
        resources=resource_with_constraints_strategy(),
        projects=project_with_constraints_strategy(),
        constraints=optimization_constraints_strategy()
    )
    def test_optimization_respects_skill_matching_constraints(self, resources, projects, constraints):
        """
        Property 6: Optimization Constraint Compliance - Skill Matching
        
        For any optimization recommendation, it should respect skill matching constraints.
        Resources should only be recommended for projects where they have the required skills.
        
        **Validates: Requirements 2.3**
        """
        # Skip cases with no skill constraints
        assume(len(projects) > 0)
        assume(len(resources) > 0)
        
        mock_supabase = Mock()
        agent = ResourceOptimizerAgent(mock_supabase, "test_openai_key")
        
        # Setup database mocks
        self._setup_database_mocks(mock_supabase, resources, projects, [])
        
        # Mock the optimization methods to return actual results we can verify
        async def mock_get_resources(*args, **kwargs):
            return resources
        
        async def mock_get_projects(*args, **kwargs):
            return projects
        
        async def mock_get_allocations(*args, **kwargs):
            return []
        
        async def mock_get_availability(*args, **kwargs):
            # Create availability data
            availability_data = []
            for resource in resources:
                availability_data.append({
                    'resource_id': resource['id'],
                    'resource_name': resource['name'],
                    'utilization_percentage': resource['current_utilization'],
                    'available_hours': max(0, resource['capacity'] * (100 - resource['current_utilization']) / 100),
                    'allocated_hours': resource['capacity'] * resource['current_utilization'] / 100
                })
            return availability_data
        
        with patch.object(agent, '_get_resources_with_skills', side_effect=mock_get_resources):
            with patch.object(agent, '_get_project_requirements', side_effect=mock_get_projects):
                with patch.object(agent, '_get_current_allocations', side_effect=mock_get_allocations):
                    with patch.object(agent, '_get_resource_availability', side_effect=mock_get_availability):
                        
                        try:
                            result = asyncio.run(agent.analyze_resource_allocation("test_user_id", None))
                            
                            # Verify skill matching constraints are respected
                            recommendations = result.get('recommendations', [])
                            skill_matches = result.get('skill_matches', [])
                            
                            # Check skill-based recommendations
                            for recommendation in recommendations:
                                if recommendation.get('type') == 'skill_optimization':
                                    resource_id = recommendation.get('recommended_resource_id')
                                    project_id = recommendation.get('project_id')
                                    
                                    # Find the resource and project
                                    resource = next((r for r in resources if r['id'] == resource_id), None)
                                    project = next((p for p in projects if p['project_id'] == project_id), None)
                                    
                                    if resource and project:
                                        # Verify skill matching constraint
                                        resource_skills = set(skill.lower() for skill in resource.get('skills', []))
                                        required_skills = set(skill.lower() for skill in project.get('required_skills', []))
                                        
                                        # At least one skill should match
                                        skill_overlap = resource_skills.intersection(required_skills)
                                        assert len(skill_overlap) > 0, f"Resource {resource['name']} recommended for project {project['project_name']} but has no matching skills. Resource skills: {resource_skills}, Required: {required_skills}"
                                        
                                        # Verify match score is reasonable (>= 0.6 threshold from agent)
                                        match_score = recommendation.get('match_score', 0)
                                        assert match_score >= 0.6, f"Match score {match_score} below threshold for skill optimization recommendation"
                            
                            # Check skill matches structure
                            for skill_match in skill_matches:
                                matching_resources = skill_match.get('matching_resources', [])
                                required_skills = set(skill.lower() for skill in skill_match.get('required_skills', []))
                                
                                for match in matching_resources:
                                    resource_id = match.get('resource_id')
                                    resource = next((r for r in resources if r['id'] == resource_id), None)
                                    
                                    if resource:
                                        resource_skills = set(skill.lower() for skill in resource.get('skills', []))
                                        skill_overlap = resource_skills.intersection(required_skills)
                                        
                                        # Matching resources should have at least one required skill
                                        assert len(skill_overlap) > 0, f"Resource {resource['name']} in skill matches but has no required skills"
                            
                            print(f"✅ Skill matching constraints verified for {len(recommendations)} recommendations")
                            
                        except Exception as e:
                            # Allow the test to fail properly if there's an issue
                            raise e

    @settings(max_examples=10, deadline=15000)
    @given(
        resources=resource_with_constraints_strategy(),
        projects=project_with_constraints_strategy()
    )
    def test_optimization_respects_availability_constraints(self, resources, projects):
        """
        Property 6: Optimization Constraint Compliance - Availability
        
        For any optimization recommendation, it should respect resource availability constraints.
        Resources should not be over-allocated beyond their available capacity.
        
        **Validates: Requirements 2.3**
        """
        assume(len(resources) > 0)
        assume(len(projects) > 0)
        
        mock_supabase = Mock()
        agent = ResourceOptimizerAgent(mock_supabase, "test_openai_key")
        
        # Setup database mocks
        self._setup_database_mocks(mock_supabase, resources, projects, [])
        
        async def mock_get_resources(*args, **kwargs):
            return resources
        
        async def mock_get_projects(*args, **kwargs):
            return projects
        
        async def mock_get_allocations(*args, **kwargs):
            return []
        
        async def mock_get_availability(*args, **kwargs):
            # Create availability data
            availability_data = []
            for resource in resources:
                available_capacity = max(0, 100 - resource['current_utilization'])
                availability_data.append({
                    'resource_id': resource['id'],
                    'resource_name': resource['name'],
                    'utilization_percentage': resource['current_utilization'],
                    'available_hours': resource['capacity'] * available_capacity / 100,
                    'allocated_hours': resource['capacity'] * resource['current_utilization'] / 100,
                    'availability_status': 'available' if available_capacity > 20 else 'mostly_allocated'
                })
            return availability_data
        
        with patch.object(agent, '_get_resources_with_skills', side_effect=mock_get_resources):
            with patch.object(agent, '_get_project_requirements', side_effect=mock_get_projects):
                with patch.object(agent, '_get_current_allocations', side_effect=mock_get_allocations):
                    with patch.object(agent, '_get_resource_availability', side_effect=mock_get_availability):
                        
                        try:
                            result = asyncio.run(agent.analyze_resource_allocation("test_user_id", None))
                            
                            # Verify availability constraints are respected
                            recommendations = result.get('recommendations', [])
                            
                            for recommendation in recommendations:
                                resource_id = recommendation.get('resource_id')
                                if not resource_id:
                                    continue
                                
                                # Find the resource
                                resource = next((r for r in resources if r['id'] == resource_id), None)
                                if not resource:
                                    continue
                                
                                # Check different recommendation types
                                if recommendation.get('type') == 'increase_utilization':
                                    # Should only recommend increasing utilization if resource has available capacity
                                    available_capacity = resource.get('available_capacity', 0)
                                    current_utilization = resource.get('current_utilization', 0)
                                    
                                    assert available_capacity > 0, f"Recommendation to increase utilization for resource {resource['name']} with no available capacity"
                                    assert current_utilization < 85, f"Recommendation to increase utilization for resource {resource['name']} already at {current_utilization}%"
                                
                                elif recommendation.get('type') == 'reduce_utilization':
                                    # Should recommend reducing utilization for over-allocated resources
                                    current_utilization = resource.get('current_utilization', 0)
                                    assert current_utilization > 85, f"Recommendation to reduce utilization for resource {resource['name']} only at {current_utilization}%"
                                
                                elif recommendation.get('type') == 'skill_optimization':
                                    # Should consider availability when recommending resources
                                    recommended_resource_id = recommendation.get('recommended_resource_id')
                                    recommended_resource = next((r for r in resources if r['id'] == recommended_resource_id), None)
                                    
                                    if recommended_resource:
                                        available_capacity = recommended_resource.get('available_capacity', 0)
                                        # Should have some available capacity or be reasonably utilized
                                        current_utilization = recommended_resource.get('current_utilization', 0)
                                        assert current_utilization <= 100, f"Recommended over-allocated resource {recommended_resource['name']} at {current_utilization}%"
                            
                            print(f"✅ Availability constraints verified for {len(recommendations)} recommendations")
                            
                        except Exception as e:
                            raise e

    @settings(max_examples=10, deadline=15000)
    @given(
        resources=resource_with_constraints_strategy(),
        projects=project_with_constraints_strategy()
    )
    def test_optimization_respects_workload_balancing_constraints(self, resources, projects):
        """
        Property 6: Optimization Constraint Compliance - Workload Balancing
        
        For any optimization recommendation, it should respect workload balancing constraints.
        The system should aim to balance workload across resources within target utilization ranges.
        
        **Validates: Requirements 2.3**
        """
        assume(len(resources) >= 2)  # Need multiple resources for balancing
        assume(len(projects) > 0)
        
        mock_supabase = Mock()
        agent = ResourceOptimizerAgent(mock_supabase, "test_openai_key")
        
        # Setup database mocks
        self._setup_database_mocks(mock_supabase, resources, projects, [])
        
        async def mock_get_resources(*args, **kwargs):
            return resources
        
        async def mock_get_projects(*args, **kwargs):
            return projects
        
        async def mock_get_allocations(*args, **kwargs):
            return []
        
        async def mock_get_availability(*args, **kwargs):
            # Create availability data
            availability_data = []
            for resource in resources:
                availability_data.append({
                    'resource_id': resource['id'],
                    'resource_name': resource['name'],
                    'utilization_percentage': resource['current_utilization'],
                    'available_hours': max(0, resource['capacity'] * (100 - resource['current_utilization']) / 100),
                    'allocated_hours': resource['capacity'] * resource['current_utilization'] / 100
                })
            return availability_data
        
        with patch.object(agent, '_get_resources_with_skills', side_effect=mock_get_resources):
            with patch.object(agent, '_get_project_requirements', side_effect=mock_get_projects):
                with patch.object(agent, '_get_current_allocations', side_effect=mock_get_allocations):
                    with patch.object(agent, '_get_resource_availability', side_effect=mock_get_availability):
                        
                        try:
                            result = asyncio.run(agent.analyze_resource_allocation("test_user_id", None))
                            
                            # Verify workload balancing constraints
                            recommendations = result.get('recommendations', [])
                            
                            # Check that recommendations promote workload balancing
                            increase_util_recommendations = [r for r in recommendations if r.get('type') == 'increase_utilization']
                            reduce_util_recommendations = [r for r in recommendations if r.get('type') == 'reduce_utilization']
                            
                            # Verify target utilization ranges are reasonable
                            for recommendation in increase_util_recommendations:
                                target_utilization = recommendation.get('target_utilization', 0)
                                current_utilization = recommendation.get('current_utilization', 0)
                                
                                # Target should be within reasonable range (60-85%)
                                assert 60 <= target_utilization <= 85, f"Target utilization {target_utilization}% outside reasonable range for increase recommendation"
                                assert target_utilization > current_utilization, f"Target utilization {target_utilization}% not higher than current {current_utilization}%"
                            
                            for recommendation in reduce_util_recommendations:
                                target_utilization = recommendation.get('target_utilization', 0)
                                current_utilization = recommendation.get('current_utilization', 0)
                                
                                # Target should be within reasonable range
                                assert 60 <= target_utilization <= 85, f"Target utilization {target_utilization}% outside reasonable range for reduce recommendation"
                                assert target_utilization < current_utilization, f"Target utilization {target_utilization}% not lower than current {current_utilization}%"
                            
                            # Verify summary metrics make sense
                            summary = result.get('summary', {})
                            avg_utilization = summary.get('avg_utilization', 0)
                            
                            # Average utilization should be reasonable
                            if len(resources) > 0:
                                calculated_avg = sum(r['current_utilization'] for r in resources) / len(resources)
                                # Allow some tolerance for rounding
                                assert abs(avg_utilization - calculated_avg) <= 2, f"Average utilization {avg_utilization}% doesn't match calculated {calculated_avg:.1f}%"
                            
                            print(f"✅ Workload balancing constraints verified for {len(recommendations)} recommendations")
                            
                        except Exception as e:
                            raise e

    @settings(max_examples=10, deadline=15000)
    @given(
        resources=resource_with_constraints_strategy(),
        projects=project_with_constraints_strategy(),
        constraints=optimization_constraints_strategy()
    )
    def test_optimization_respects_combined_constraints(self, resources, projects, constraints):
        """
        Property 6: Optimization Constraint Compliance - Combined Constraints
        
        For any optimization recommendation with multiple constraints, it should respect 
        all constraints simultaneously (skill matching AND availability AND workload balancing).
        
        **Validates: Requirements 2.3**
        """
        assume(len(resources) >= 2)
        assume(len(projects) > 0)
        assume(len(constraints) > 0)  # Must have some constraints to test
        
        # Skip cases where min_availability constraint can't be met by any resource
        if 'min_availability' in constraints:
            min_availability = constraints['min_availability']
            available_resources = [r for r in resources if r.get('availability', 0) >= min_availability]
            assume(len(available_resources) > 0)
        
        mock_supabase = Mock()
        agent = ResourceOptimizerAgent(mock_supabase, "test_openai_key")
        
        # Setup database mocks
        self._setup_database_mocks(mock_supabase, resources, projects, [])
        
        async def mock_get_resources(*args, **kwargs):
            return resources
        
        async def mock_get_projects(*args, **kwargs):
            return projects
        
        async def mock_get_allocations(*args, **kwargs):
            return []
        
        async def mock_get_availability(*args, **kwargs):
            # Create availability data
            availability_data = []
            for resource in resources:
                availability_data.append({
                    'resource_id': resource['id'],
                    'resource_name': resource['name'],
                    'utilization_percentage': resource['current_utilization'],
                    'available_hours': max(0, resource['capacity'] * (100 - resource['current_utilization']) / 100),
                    'allocated_hours': resource['capacity'] * resource['current_utilization'] / 100
                })
            return availability_data
        
        with patch.object(agent, '_get_resources_with_skills', side_effect=mock_get_resources):
            with patch.object(agent, '_get_project_requirements', side_effect=mock_get_projects):
                with patch.object(agent, '_get_current_allocations', side_effect=mock_get_allocations):
                    with patch.object(agent, '_get_resource_availability', side_effect=mock_get_availability):
                        
                        # Test constrained optimization
                        try:
                            # Test the constrained optimization method
                            constrained_result = asyncio.run(agent.optimize_for_constraints(constraints, "test_user_id"))
                            
                            # Verify that constraints are applied
                            constrained_resources = constrained_result.get('constrained_resources', [])
                            applied_constraints = constrained_result.get('applied_constraints', {})
                            
                            # Verify applied constraints match input
                            for key, value in constraints.items():
                                assert key in applied_constraints, f"Constraint {key} not applied"
                                assert applied_constraints[key] == value, f"Constraint {key} value mismatch"
                            
                            # Verify constrained resources meet the constraints
                            for constrained_resource in constrained_resources:
                                resource_id = constrained_resource.get('resource_id')
                                resource = next((r for r in resources if r['id'] == resource_id), None)
                                
                                if resource:
                                    # Check skill constraints
                                    if 'required_skills' in constraints:
                                        required_skills = set(skill.lower() for skill in constraints['required_skills'])
                                        resource_skills = set(skill.lower() for skill in resource.get('skills', []))
                                        skill_overlap = resource_skills.intersection(required_skills)
                                        assert len(skill_overlap) > 0, f"Constrained resource {resource['name']} doesn't have required skills"
                                    
                                    # Check availability constraints
                                    if 'min_availability' in constraints:
                                        min_availability = constraints['min_availability']
                                        resource_availability = resource.get('availability', 0)
                                        assert resource_availability >= min_availability, f"Resource {resource['name']} availability {resource_availability}% below minimum {min_availability}%"
                                    
                                    # Check utilization constraints
                                    if 'max_utilization' in constraints:
                                        max_utilization = constraints['max_utilization']
                                        current_utilization = resource.get('current_utilization', 0)
                                        assert current_utilization <= max_utilization, f"Resource {resource['name']} utilization {current_utilization}% above maximum {max_utilization}%"
                                    
                                    # Check location constraints
                                    if 'location' in constraints:
                                        required_location = constraints['location']
                                        resource_location = resource.get('location')
                                        assert resource_location == required_location, f"Resource {resource['name']} location {resource_location} doesn't match required {required_location}"
                            
                            print(f"✅ Combined constraints verified for {len(constrained_resources)} constrained resources")
                            
                        except Exception as e:
                            raise e

    def _setup_database_mocks(self, mock_supabase, resources, projects, allocations):
        """Setup comprehensive database mocks for constraint testing"""
        
        def mock_table(table_name):
            mock_table_obj = Mock()
            
            if table_name == "resources":
                mock_table_obj.select.return_value.execute.return_value.data = resources
                mock_table_obj.select.return_value.eq.return_value.execute.return_value.data = resources
            elif table_name == "projects":
                # Convert projects to expected format
                project_data = []
                for project in projects:
                    project_data.append({
                        'id': project['project_id'],
                        'name': project['project_name'],
                        'status': project['status'],
                        'priority': project['priority'],
                        'end_date': project['deadline'].isoformat() if project['deadline'] else None,
                        'team_members': [str(uuid.uuid4()) for _ in range(project.get('current_team_size', 0))]
                    })
                mock_table_obj.select.return_value.execute.return_value.data = project_data
                mock_table_obj.select.return_value.eq.return_value.execute.return_value.data = project_data
            elif table_name == "project_resources":
                mock_table_obj.select.return_value.execute.return_value.data = allocations
                mock_table_obj.select.return_value.eq.return_value.execute.return_value.data = allocations
            
            return mock_table_obj
        
        mock_supabase.table.side_effect = mock_table


if __name__ == "__main__":
    pytest.main([__file__])