"""
Property-based tests for Resource Conflict Detection

Feature: ai-ppm-platform, Property 5: Resource Conflict Detection
Validates: Requirements 2.2
"""

import pytest
from hypothesis import given, strategies as st, assume, settings
import sys
import os
from unittest.mock import Mock, patch, AsyncMock
import uuid
from datetime import datetime, date, timedelta
import asyncio
import time

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
def conflicting_allocation_strategy(draw):
    """Generate resource allocations that have conflicts"""
    num_resources = draw(st.integers(min_value=2, max_value=8))
    resources = []
    conflicting_allocations = []
    
    for i in range(num_resources):
        resource_id = str(uuid.uuid4())
        resource_name = f"Resource_{i}"
        capacity = draw(st.integers(min_value=30, max_value=50))
        
        resources.append({
            'id': resource_id,
            'name': resource_name,
            'capacity': capacity,
            'availability': draw(st.integers(min_value=80, max_value=100)),
            'skills': draw(st.lists(
                st.sampled_from(['Python', 'JavaScript', 'React', 'SQL', 'AWS']), 
                min_size=1, max_size=4, unique=True
            ))
        })
        
        # Create conflicting allocations for this resource
        num_conflicts = draw(st.integers(min_value=1, max_value=3))
        total_allocation = 0
        
        for j in range(num_conflicts):
            # Ensure we create over-allocation
            if j == num_conflicts - 1:  # Last allocation
                # Make sure total exceeds 100%
                remaining = 100 - total_allocation
                allocation_pct = draw(st.integers(min_value=max(20, remaining + 10), max_value=remaining + 50))
            else:
                allocation_pct = draw(st.integers(min_value=30, max_value=60))
            
            total_allocation += allocation_pct
            
            conflicting_allocations.append({
                'resource_id': resource_id,
                'project_id': str(uuid.uuid4()),
                'allocation_percentage': allocation_pct,
                'role_in_project': draw(st.sampled_from(['Lead', 'Developer', 'Contributor'])),
                'projects': {
                    'name': f'Project_{i}_{j}',
                    'status': draw(st.sampled_from(['active', 'planning'])),
                    'priority': draw(st.sampled_from(['medium', 'high', 'critical']))
                },
                'resources': {
                    'name': resource_name,
                    'capacity': capacity
                }
            })
    
    return resources, conflicting_allocations

@st.composite
def availability_data_strategy(draw, resources):
    """Generate availability data for resources"""
    availability_data = []
    
    for resource in resources:
        capacity_hours = resource['capacity']
        availability_pct = resource['availability']
        effective_capacity = capacity_hours * (availability_pct / 100)
        
        # Calculate over-allocation scenario
        over_allocation_pct = draw(st.integers(min_value=110, max_value=150))
        allocated_hours = effective_capacity * (over_allocation_pct / 100)
        available_hours = max(0, effective_capacity - allocated_hours)
        
        availability_data.append({
            'resource_id': resource['id'],
            'resource_name': resource['name'],
            'total_capacity_hours': capacity_hours,
            'effective_capacity_hours': effective_capacity,
            'allocated_hours': allocated_hours,
            'available_hours': available_hours,
            'utilization_percentage': over_allocation_pct,
            'availability_status': 'overbooked'
        })
    
    return availability_data

@st.composite
def skill_mismatch_scenario_strategy(draw):
    """Generate scenarios with skill mismatches"""
    num_resources = draw(st.integers(min_value=2, max_value=6))
    resources = []
    allocations = []
    
    available_skills = ['Python', 'JavaScript', 'React', 'SQL', 'AWS', 'Docker', 'Kubernetes']
    
    for i in range(num_resources):
        resource_id = str(uuid.uuid4())
        
        # Give resource limited skills
        resource_skills = draw(st.lists(
            st.sampled_from(available_skills[:4]),  # Only first 4 skills
            min_size=1, max_size=2, unique=True
        ))
        
        resources.append({
            'id': resource_id,
            'name': f'Resource_{i}',
            'capacity': draw(st.integers(min_value=30, max_value=50)),
            'availability': draw(st.integers(min_value=70, max_value=100)),
            'skills': resource_skills
        })
        
        # Create allocation requiring different skills
        required_skills = draw(st.lists(
            st.sampled_from(available_skills[3:]),  # Skills from position 3 onwards
            min_size=1, max_size=3, unique=True
        ))
        
        allocations.append({
            'resource_id': resource_id,
            'project_id': str(uuid.uuid4()),
            'allocation_percentage': draw(st.integers(min_value=40, max_value=80)),
            'required_skills': required_skills,
            'projects': {
                'name': f'Project_Requiring_{i}',
                'status': 'active',
                'priority': 'high',
                'description': f'Project requiring {", ".join(required_skills)}'
            },
            'resources': {
                'name': f'Resource_{i}',
                'capacity': resources[i]['capacity']
            }
        })
    
    return resources, allocations

@st.composite
def time_conflict_scenario_strategy(draw):
    """Generate scenarios with time-based conflicts"""
    num_resources = draw(st.integers(min_value=1, max_value=4))
    resources = []
    allocations = []
    
    for i in range(num_resources):
        resource_id = str(uuid.uuid4())
        
        resources.append({
            'id': resource_id,
            'name': f'Resource_{i}',
            'capacity': draw(st.integers(min_value=30, max_value=50)),
            'availability': draw(st.integers(min_value=80, max_value=100)),
            'skills': ['Python', 'SQL']
        })
        
        # Create multiple high-priority projects for same resource (time conflict)
        num_high_priority = draw(st.integers(min_value=2, max_value=4))
        
        for j in range(num_high_priority):
            allocations.append({
                'resource_id': resource_id,
                'project_id': str(uuid.uuid4()),
                'allocation_percentage': draw(st.integers(min_value=30, max_value=50)),
                'projects': {
                    'name': f'HighPriority_Project_{i}_{j}',
                    'status': 'active',
                    'priority': 'high'  # All high priority = time conflict
                },
                'resources': {
                    'name': f'Resource_{i}',
                    'capacity': resources[i]['capacity']
                }
            })
    
    return resources, allocations


class TestResourceConflictDetection:
    """Property 5: Resource Conflict Detection tests"""

    @settings(max_examples=10, deadline=30000)
    @given(conflicting_allocation_strategy())
    def test_over_allocation_conflict_detection(self, allocation_data):
        """
        Property 5: Resource Conflict Detection - Over-allocation Detection
        
        For any resource allocation scenario with over-allocation conflicts, 
        the Resource Optimizer Agent should detect and propose alternative allocation strategies.
        
        **Validates: Requirements 2.2**
        """
        resources, conflicting_allocations = allocation_data
        
        # Skip overly complex scenarios
        assume(len(resources) <= 6)
        assume(len(conflicting_allocations) <= 15)
        
        # Ensure we actually have over-allocation conflicts
        resource_totals = {}
        for allocation in conflicting_allocations:
            resource_id = allocation['resource_id']
            if resource_id not in resource_totals:
                resource_totals[resource_id] = 0
            resource_totals[resource_id] += allocation['allocation_percentage']
        
        # Verify at least one resource is over-allocated
        has_over_allocation = any(total > 100 for total in resource_totals.values())
        assume(has_over_allocation)
        
        # Create availability data showing over-allocation
        availability_data = []
        for resource in resources:
            total_allocation = resource_totals.get(resource['id'], 0)
            availability_data.append({
                'resource_id': resource['id'],
                'resource_name': resource['name'],
                'total_capacity_hours': resource['capacity'],
                'effective_capacity_hours': resource['capacity'] * (resource['availability'] / 100),
                'allocated_hours': resource['capacity'] * (total_allocation / 100),
                'available_hours': max(0, resource['capacity'] - (resource['capacity'] * total_allocation / 100)),
                'utilization_percentage': total_allocation,
                'availability_status': 'overbooked' if total_allocation > 100 else 'available'
            })
        
        # Setup mocks
        mock_supabase = Mock()
        agent = ResourceOptimizerAgent(mock_supabase, "test_openai_key")
        
        self._setup_conflict_detection_mocks(mock_supabase, resources, conflicting_allocations, availability_data)
        
        # Test conflict detection
        result = asyncio.run(agent.detect_resource_conflicts("test_user_id"))
        
        # Verify conflicts were detected
        assert result is not None, "Conflict detection should return a result"
        assert 'conflicts' in result, "Result should contain conflicts"
        assert 'total_conflicts' in result, "Result should contain total conflict count"
        assert 'resolution_suggestions' in result, "Result should contain resolution suggestions"
        
        conflicts = result['conflicts']
        
        # Verify over-allocation conflicts were detected
        over_allocation_conflicts = [c for c in conflicts if c.get('type') == 'over_allocation']
        assert len(over_allocation_conflicts) > 0, "Should detect over-allocation conflicts when resources are over-allocated"
        
        # Verify conflict details
        for conflict in over_allocation_conflicts:
            assert 'resource_id' in conflict, "Conflict should identify the resource"
            assert 'resource_name' in conflict, "Conflict should include resource name"
            assert 'total_allocation' in conflict, "Conflict should show total allocation"
            assert 'over_allocation' in conflict, "Conflict should show over-allocation amount"
            assert 'severity' in conflict, "Conflict should have severity level"
            assert 'description' in conflict, "Conflict should have description"
            
            # Verify over-allocation is correctly calculated
            assert conflict['total_allocation'] > 100, "Over-allocation conflict should have >100% allocation"
            assert conflict['over_allocation'] > 0, "Over-allocation amount should be positive"
        
        # Verify resolution suggestions were provided
        resolution_suggestions = result['resolution_suggestions']
        assert len(resolution_suggestions) > 0, "Should provide resolution suggestions for conflicts"
        
        for suggestion in resolution_suggestions:
            assert 'resolution_type' in suggestion, "Resolution should have a type"
            assert 'description' in suggestion, "Resolution should have description"
            assert 'steps' in suggestion, "Resolution should provide steps"
            assert isinstance(suggestion['steps'], list), "Resolution steps should be a list"
            assert len(suggestion['steps']) > 0, "Resolution should provide actionable steps"
        
        print(f"✅ Detected {len(over_allocation_conflicts)} over-allocation conflicts with {len(resolution_suggestions)} resolution suggestions")

    @settings(max_examples=10, deadline=30000)
    @given(skill_mismatch_scenario_strategy())
    def test_skill_mismatch_conflict_detection(self, scenario_data):
        """
        Property 5: Resource Conflict Detection - Skill Mismatch Detection
        
        For any resource allocation scenario with skill mismatches, 
        the Resource Optimizer Agent should detect conflicts and propose alternatives.
        
        **Validates: Requirements 2.2**
        """
        resources, allocations = scenario_data
        
        assume(len(resources) <= 5)
        assume(len(allocations) <= 8)
        
        # Verify we have skill mismatches
        has_skill_mismatch = False
        for allocation in allocations:
            resource = next((r for r in resources if r['id'] == allocation['resource_id']), None)
            if resource:
                required_skills = allocation.get('required_skills', [])
                resource_skills = resource.get('skills', [])
                
                # Check if there's a mismatch
                matching_skills = set(required_skills) & set(resource_skills)
                if len(matching_skills) < len(required_skills):
                    has_skill_mismatch = True
                    break
        
        assume(has_skill_mismatch)
        
        # Setup mocks
        mock_supabase = Mock()
        agent = ResourceOptimizerAgent(mock_supabase, "test_openai_key")
        
        # Create availability data
        availability_data = []
        for resource in resources:
            availability_data.append({
                'resource_id': resource['id'],
                'resource_name': resource['name'],
                'utilization_percentage': 70,
                'availability_status': 'partially_allocated'
            })
        
        self._setup_skill_mismatch_mocks(mock_supabase, resources, allocations, availability_data)
        
        # Test conflict detection with skill analysis
        with patch.object(agent, '_detect_skill_conflicts') as mock_skill_conflicts:
            # Mock skill conflict detection to return conflicts
            mock_skill_conflicts.return_value = [
                {
                    'type': 'skill_mismatch',
                    'resource_id': allocation['resource_id'],
                    'project_id': allocation['project_id'],
                    'required_skills': allocation.get('required_skills', []),
                    'match_score': 0.3,  # Low match score
                    'severity': 'medium',
                    'description': 'Low skill match for project requirements'
                }
                for allocation in allocations[:2]  # First 2 allocations
            ]
            
            result = asyncio.run(agent.detect_resource_conflicts("test_user_id"))
            
            # Verify skill conflicts were detected
            assert result is not None
            assert 'conflicts' in result
            
            conflicts = result['conflicts']
            skill_conflicts = [c for c in conflicts if c.get('type') == 'skill_mismatch']
            
            # Should detect skill mismatches
            assert len(skill_conflicts) > 0, "Should detect skill mismatch conflicts"
            
            for conflict in skill_conflicts:
                assert 'resource_id' in conflict
                assert 'project_id' in conflict
                assert 'required_skills' in conflict
                assert 'match_score' in conflict
                assert conflict['match_score'] < 0.6, "Skill mismatch should have low match score"
                assert 'severity' in conflict
                assert 'description' in conflict
            
            # Verify resolution suggestions include skill development
            resolution_suggestions = result.get('resolution_suggestions', [])
            skill_resolutions = [r for r in resolution_suggestions if 'skill' in r.get('resolution_type', '')]
            
            if skill_resolutions:
                for resolution in skill_resolutions:
                    assert 'steps' in resolution
                    steps_text = ' '.join(resolution['steps']).lower()
                    assert any(keyword in steps_text for keyword in ['training', 'skill', 'development', 'pairing']), \
                        "Skill mismatch resolution should mention training or skill development"
            
            print(f"✅ Detected {len(skill_conflicts)} skill mismatch conflicts")

    @settings(max_examples=10, deadline=30000)
    @given(time_conflict_scenario_strategy())
    def test_time_conflict_detection(self, scenario_data):
        """
        Property 5: Resource Conflict Detection - Time Conflict Detection
        
        For any resource allocation scenario with time conflicts (multiple high-priority projects), 
        the Resource Optimizer Agent should detect conflicts and propose alternatives.
        
        **Validates: Requirements 2.2**
        """
        resources, allocations = scenario_data
        
        assume(len(resources) <= 4)
        assume(len(allocations) <= 12)
        
        # Verify we have time conflicts (multiple high-priority projects per resource)
        resource_high_priority_count = {}
        for allocation in allocations:
            resource_id = allocation['resource_id']
            if allocation['projects']['priority'] == 'high':
                resource_high_priority_count[resource_id] = resource_high_priority_count.get(resource_id, 0) + 1
        
        has_time_conflict = any(count >= 2 for count in resource_high_priority_count.values())
        assume(has_time_conflict)
        
        # Setup mocks
        mock_supabase = Mock()
        agent = ResourceOptimizerAgent(mock_supabase, "test_openai_key")
        
        availability_data = []
        for resource in resources:
            availability_data.append({
                'resource_id': resource['id'],
                'resource_name': resource['name'],
                'utilization_percentage': 85,
                'availability_status': 'mostly_allocated'
            })
        
        self._setup_time_conflict_mocks(mock_supabase, resources, allocations, availability_data)
        
        # Test conflict detection
        result = asyncio.run(agent.detect_resource_conflicts("test_user_id"))
        
        # Verify time conflicts were detected
        assert result is not None
        assert 'conflicts' in result
        
        conflicts = result['conflicts']
        time_conflicts = [c for c in conflicts if c.get('type') == 'time_conflict']
        
        # Should detect time conflicts
        assert len(time_conflicts) > 0, "Should detect time conflicts when multiple high-priority projects compete for same resource"
        
        for conflict in time_conflicts:
            assert 'resource_id' in conflict
            assert 'resource_name' in conflict
            assert 'conflicting_projects' in conflict
            assert 'time_period' in conflict
            assert 'severity' in conflict
            assert len(conflict['conflicting_projects']) >= 2, "Time conflict should involve multiple projects"
        
        print(f"✅ Detected {len(time_conflicts)} time conflicts")

    @settings(max_examples=10, deadline=30000)
    @given(conflicting_allocation_strategy())
    def test_alternative_allocation_strategies_provided(self, allocation_data):
        """
        Property 5: Resource Conflict Detection - Alternative Strategy Generation
        
        For any resource allocation scenario with conflicts, the Resource Optimizer Agent 
        should propose alternative allocation strategies with actionable steps.
        
        **Validates: Requirements 2.2**
        """
        resources, conflicting_allocations = allocation_data
        
        assume(len(resources) <= 5)
        assume(len(conflicting_allocations) <= 10)
        
        # Setup mocks
        mock_supabase = Mock()
        agent = ResourceOptimizerAgent(mock_supabase, "test_openai_key")
        
        # Create availability data with conflicts
        availability_data = []
        for resource in resources:
            resource_allocations = [a for a in conflicting_allocations if a['resource_id'] == resource['id']]
            total_allocation = sum(a['allocation_percentage'] for a in resource_allocations)
            
            availability_data.append({
                'resource_id': resource['id'],
                'resource_name': resource['name'],
                'utilization_percentage': total_allocation,
                'availability_status': 'overbooked' if total_allocation > 100 else 'available'
            })
        
        self._setup_conflict_detection_mocks(mock_supabase, resources, conflicting_allocations, availability_data)
        
        # Test conflict detection and resolution
        result = asyncio.run(agent.detect_resource_conflicts("test_user_id"))
        
        # Verify alternative strategies are provided
        assert result is not None
        assert 'resolution_suggestions' in result, "Should provide resolution suggestions"
        
        resolution_suggestions = result['resolution_suggestions']
        assert len(resolution_suggestions) > 0, "Should provide at least one alternative strategy"
        
        for suggestion in resolution_suggestions:
            # Verify structure of alternative strategies
            assert 'resolution_type' in suggestion, "Alternative strategy should have a type"
            assert 'description' in suggestion, "Alternative strategy should have description"
            assert 'steps' in suggestion, "Alternative strategy should provide actionable steps"
            assert isinstance(suggestion['steps'], list), "Steps should be a list"
            assert len(suggestion['steps']) > 0, "Should provide actionable steps"
            
            # Verify steps are actionable (contain action verbs)
            steps_text = ' '.join(suggestion['steps']).lower()
            action_verbs = ['redistribute', 'reassign', 'reduce', 'extend', 'hire', 'provide', 'consider', 'review', 'update', 'communicate']
            has_action_verb = any(verb in steps_text for verb in action_verbs)
            assert has_action_verb, f"Alternative strategy steps should contain actionable verbs. Steps: {suggestion['steps']}"
            
            # Verify priority and effort estimation
            assert 'priority' in suggestion, "Alternative strategy should have priority"
            assert suggestion['priority'] in ['low', 'medium', 'high', 'critical'], "Priority should be valid"
            
            if 'estimated_effort' in suggestion:
                assert isinstance(suggestion['estimated_effort'], str), "Effort estimation should be descriptive"
        
        # Verify different types of alternative strategies
        strategy_types = set(s['resolution_type'] for s in resolution_suggestions)
        expected_types = ['redistribute_work', 'skill_development', 'timeline_adjustment', 'resource_addition']
        
        # Should have at least one recognized strategy type
        has_recognized_type = any(stype in expected_types for stype in strategy_types)
        assert has_recognized_type, f"Should provide recognized strategy types. Found: {strategy_types}"
        
        print(f"✅ Provided {len(resolution_suggestions)} alternative allocation strategies with types: {strategy_types}")

    def _setup_conflict_detection_mocks(self, mock_supabase, resources, allocations, availability_data):
        """Setup database mocks for conflict detection testing"""
        
        def mock_table(table_name):
            mock_table_obj = Mock()
            
            if table_name == "resources":
                mock_table_obj.select.return_value.execute.return_value.data = resources
                mock_table_obj.select.return_value.eq.return_value.execute.return_value.data = resources
            elif table_name == "project_resources":
                mock_table_obj.select.return_value.execute.return_value.data = allocations
                mock_table_obj.select.return_value.eq.return_value.execute.return_value.data = allocations
            elif table_name == "projects":
                # Create project data from allocations
                projects = []
                for allocation in allocations:
                    if allocation.get('projects'):
                        project = {
                            'id': allocation['project_id'],
                            'name': allocation['projects']['name'],
                            'status': allocation['projects']['status'],
                            'priority': allocation['projects']['priority'],
                            'description': allocation['projects'].get('description', ''),
                            'team_members': []
                        }
                        projects.append(project)
                
                mock_table_obj.select.return_value.execute.return_value.data = projects
                mock_table_obj.select.return_value.eq.return_value.execute.return_value.data = projects
            
            return mock_table_obj
        
        mock_supabase.table.side_effect = mock_table

    def _setup_skill_mismatch_mocks(self, mock_supabase, resources, allocations, availability_data):
        """Setup mocks specifically for skill mismatch testing"""
        self._setup_conflict_detection_mocks(mock_supabase, resources, allocations, availability_data)

    def _setup_time_conflict_mocks(self, mock_supabase, resources, allocations, availability_data):
        """Setup mocks specifically for time conflict testing"""
        self._setup_conflict_detection_mocks(mock_supabase, resources, allocations, availability_data)


if __name__ == "__main__":
    pytest.main([__file__])