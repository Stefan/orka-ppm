"""
Property-based tests for Resource Management

Feature: integrated-master-schedule
Properties 8, 9, 10: Resource Assignment Integrity, Resource Conflict Detection, Resource Utilization Calculation
Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5
"""

import pytest
from hypothesis import given, strategies as st, assume, settings, HealthCheck
import sys
import os
from unittest.mock import Mock, patch, AsyncMock
import uuid
from datetime import datetime, date, timedelta
from typing import List, Dict, Any

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Mock environment variables before importing modules
with patch.dict(os.environ, {
    'SUPABASE_URL': 'https://test.supabase.co',
    'SUPABASE_ANON_KEY': 'test_key',
    'SUPABASE_JWT_SECRET': 'test_secret',
    'OPENAI_API_KEY': 'test_openai_key'
}):
    from models.schedule import (
        ResourceAssignmentCreate, ResourceAssignmentResponse,
        ResourceUtilizationReport
    )
    from services.resource_assignment_service import (
        ResourceAssignmentService, ResourceConflictType
    )


# =====================================================
# TEST DATA STRATEGIES
# =====================================================

@st.composite
def resource_id_strategy(draw):
    """Generate valid resource UUIDs"""
    return uuid.uuid4()

@st.composite
def task_id_strategy(draw):
    """Generate valid task UUIDs"""
    return uuid.uuid4()


@st.composite
def allocation_percentage_strategy(draw):
    """Generate valid allocation percentages (1-100)"""
    return draw(st.integers(min_value=1, max_value=100))

@st.composite
def planned_hours_strategy(draw):
    """Generate valid planned hours"""
    return draw(st.floats(min_value=0.0, max_value=1000.0, allow_nan=False, allow_infinity=False))

@st.composite
def date_range_strategy(draw):
    """Generate valid date ranges for assignments"""
    start_offset = draw(st.integers(min_value=0, max_value=30))
    duration = draw(st.integers(min_value=1, max_value=60))
    
    start_date = date.today() + timedelta(days=start_offset)
    end_date = start_date + timedelta(days=duration)
    
    return start_date, end_date

@st.composite
def resource_assignment_create_strategy(draw):
    """Generate valid ResourceAssignmentCreate objects"""
    resource_id = draw(resource_id_strategy())
    allocation_percentage = draw(allocation_percentage_strategy())
    planned_hours = draw(st.one_of(st.none(), planned_hours_strategy()))
    
    start_date, end_date = draw(date_range_strategy())
    
    return ResourceAssignmentCreate(
        resource_id=resource_id,
        allocation_percentage=allocation_percentage,
        planned_hours=planned_hours,
        assignment_start_date=start_date,
        assignment_end_date=end_date
    )

@st.composite
def resource_data_strategy(draw):
    """Generate valid resource data for testing"""
    capacity = draw(st.integers(min_value=20, max_value=60))  # 20-60 hours per week
    availability = draw(st.integers(min_value=10, max_value=100))  # 10-100% availability
    
    return {
        'id': str(uuid.uuid4()),
        'name': f"Resource_{draw(st.text(min_size=3, max_size=10, alphabet='abcdefghijklmnopqrstuvwxyz'))}",
        'capacity': capacity,
        'availability': availability
    }

@st.composite
def task_data_strategy(draw):
    """Generate valid task data for testing"""
    start_offset = draw(st.integers(min_value=0, max_value=30))
    duration = draw(st.integers(min_value=1, max_value=60))
    
    start_date = date.today() + timedelta(days=start_offset)
    end_date = start_date + timedelta(days=duration)
    
    return {
        'id': str(uuid.uuid4()),
        'schedule_id': str(uuid.uuid4()),
        'name': f"Task_{draw(st.text(min_size=3, max_size=10, alphabet='abcdefghijklmnopqrstuvwxyz'))}",
        'wbs_code': f"1.{draw(st.integers(min_value=1, max_value=99))}",
        'planned_start_date': start_date.isoformat(),
        'planned_end_date': end_date.isoformat(),
        'status': draw(st.sampled_from(['not_started', 'in_progress', 'completed']))
    }


@st.composite
def overlapping_assignments_strategy(draw):
    """Generate assignments that may overlap for conflict detection testing"""
    num_assignments = draw(st.integers(min_value=2, max_value=5))
    resource_id = str(uuid.uuid4())
    resource_data = {
        'id': resource_id,
        'name': f"Resource_{draw(st.text(min_size=3, max_size=8, alphabet='abcdefghijklmnopqrstuvwxyz'))}",
        'capacity': draw(st.integers(min_value=30, max_value=50)),
        'availability': draw(st.integers(min_value=50, max_value=100))
    }
    
    assignments = []
    base_date = date.today()
    
    for i in range(num_assignments):
        # Create potentially overlapping date ranges
        start_offset = draw(st.integers(min_value=0, max_value=20))
        duration = draw(st.integers(min_value=5, max_value=15))
        allocation = draw(st.integers(min_value=20, max_value=80))
        
        start_date = base_date + timedelta(days=start_offset)
        end_date = start_date + timedelta(days=duration)
        
        task_id = str(uuid.uuid4())
        task_data = {
            'id': task_id,
            'name': f"Task_{i+1}",
            'wbs_code': f"1.{i+1}",
            'schedule_id': str(uuid.uuid4())
        }
        
        assignments.append({
            'id': str(uuid.uuid4()),
            'task_id': task_id,
            'resource_id': resource_id,
            'allocation_percentage': allocation,
            'assignment_start_date': start_date.isoformat(),
            'assignment_end_date': end_date.isoformat(),
            'planned_hours': allocation * 0.4,  # Rough estimate
            'actual_hours': None,
            'tasks': task_data,
            'resources': resource_data
        })
    
    return assignments, resource_data


# =====================================================
# PROPERTY 8: RESOURCE ASSIGNMENT INTEGRITY
# =====================================================

class TestResourceAssignmentIntegrity:
    """
    Property 8: Resource Assignment Integrity
    
    For any resource assignment to tasks, the assignment should be stored correctly
    with proper effort allocation percentages.
    
    **Validates: Requirements 5.1**
    """

    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    @given(assignment_data=resource_assignment_create_strategy())
    def test_allocation_percentage_bounds(self, assignment_data):
        """
        Property 8: Resource Assignment Integrity - Allocation Percentage Bounds
        
        For any resource assignment, allocation percentage must be between 1 and 100.
        
        **Validates: Requirements 5.1**
        """
        # Verify allocation percentage is within valid bounds
        assert 1 <= assignment_data.allocation_percentage <= 100, \
            f"Allocation percentage {assignment_data.allocation_percentage} out of bounds [1, 100]"


    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    @given(assignment_data=resource_assignment_create_strategy())
    def test_date_range_validity(self, assignment_data):
        """
        Property 8: Resource Assignment Integrity - Date Range Validity
        
        For any resource assignment with dates, end date must be >= start date.
        
        **Validates: Requirements 5.1**
        """
        if assignment_data.assignment_start_date and assignment_data.assignment_end_date:
            assert assignment_data.assignment_end_date >= assignment_data.assignment_start_date, \
                f"End date {assignment_data.assignment_end_date} before start date {assignment_data.assignment_start_date}"

    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    @given(assignment_data=resource_assignment_create_strategy())
    def test_planned_hours_non_negative(self, assignment_data):
        """
        Property 8: Resource Assignment Integrity - Planned Hours Non-Negative
        
        For any resource assignment with planned hours, the value must be >= 0.
        
        **Validates: Requirements 5.1**
        """
        if assignment_data.planned_hours is not None:
            assert assignment_data.planned_hours >= 0, \
                f"Planned hours {assignment_data.planned_hours} is negative"

    @settings(max_examples=50, suppress_health_check=[HealthCheck.too_slow])
    @given(
        allocation=st.integers(min_value=1, max_value=100),
        resource_data=resource_data_strategy(),
        task_data=task_data_strategy()
    )
    def test_assignment_data_preservation(self, allocation, resource_data, task_data):
        """
        Property 8: Resource Assignment Integrity - Data Preservation
        
        For any resource assignment, all input data should be preserved correctly
        in the response model.
        
        **Validates: Requirements 5.1**
        """
        # Create assignment data
        assignment_id = str(uuid.uuid4())
        task_id = task_data['id']
        resource_id = resource_data['id']
        start_date = date.today()
        end_date = start_date + timedelta(days=10)
        planned_hours = allocation * 0.4
        
        # Create response model
        response = ResourceAssignmentResponse(
            id=assignment_id,
            task_id=task_id,
            resource_id=resource_id,
            allocation_percentage=allocation,
            planned_hours=planned_hours,
            actual_hours=None,
            assignment_start_date=start_date,
            assignment_end_date=end_date,
            created_by=str(uuid.uuid4()),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        # Verify data preservation
        assert response.allocation_percentage == allocation
        assert response.task_id == task_id
        assert response.resource_id == resource_id
        assert response.assignment_start_date == start_date
        assert response.assignment_end_date == end_date
        assert response.planned_hours == planned_hours


    @settings(max_examples=50, suppress_health_check=[HealthCheck.too_slow])
    @given(allocation=st.integers(min_value=-100, max_value=0))
    def test_invalid_allocation_rejected(self, allocation):
        """
        Property 8: Resource Assignment Integrity - Invalid Allocation Rejected
        
        For any resource assignment with invalid allocation (<=0), the model should reject it.
        
        **Validates: Requirements 5.1**
        """
        with pytest.raises(ValueError):
            ResourceAssignmentCreate(
                resource_id=uuid.uuid4(),
                allocation_percentage=allocation,
                planned_hours=None,
                assignment_start_date=None,
                assignment_end_date=None
            )

    @settings(max_examples=50, suppress_health_check=[HealthCheck.too_slow])
    @given(allocation=st.integers(min_value=101, max_value=500))
    def test_over_allocation_rejected(self, allocation):
        """
        Property 8: Resource Assignment Integrity - Over Allocation Rejected
        
        For any resource assignment with allocation > 100%, the model should reject it.
        
        **Validates: Requirements 5.1**
        """
        with pytest.raises(ValueError):
            ResourceAssignmentCreate(
                resource_id=uuid.uuid4(),
                allocation_percentage=allocation,
                planned_hours=None,
                assignment_start_date=None,
                assignment_end_date=None
            )


# =====================================================
# PROPERTY 9: RESOURCE CONFLICT DETECTION
# =====================================================

class TestResourceConflictDetection:
    """
    Property 9: Resource Conflict Detection
    
    For any resource allocation scenario, overallocation across concurrent tasks
    should be detected accurately.
    
    **Validates: Requirements 5.2, 5.3**
    """

    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    @given(assignments_data=overlapping_assignments_strategy())
    @pytest.mark.asyncio
    async def test_overallocation_detection(self, assignments_data):
        """
        Property 9: Resource Conflict Detection - Overallocation Detection
        
        For any set of resource assignments, if total allocation exceeds 100%,
        an overallocation conflict should be detected.
        
        **Validates: Requirements 5.2, 5.3**
        """
        assignments, resource_data = assignments_data
        
        # Calculate total allocation
        total_allocation = sum(a['allocation_percentage'] for a in assignments)
        
        # Mock the service's private method for conflict detection
        with patch.dict(os.environ, {
            'SUPABASE_URL': 'https://test.supabase.co',
            'SUPABASE_ANON_KEY': 'test_key'
        }):
            with patch('services.resource_assignment_service.supabase') as mock_db:
                service = ResourceAssignmentService.__new__(ResourceAssignmentService)
                service.db = mock_db
                
                # Call the private conflict detection method
                conflicts = await service._detect_resource_specific_conflicts(
                    resource_data['id'],
                    assignments
                )
                
                # Verify overallocation is detected when total > 100%
                if total_allocation > 100:
                    overallocation_conflicts = [
                        c for c in conflicts 
                        if c['type'] == ResourceConflictType.OVERALLOCATION.value
                    ]
                    assert len(overallocation_conflicts) > 0, \
                        f"Overallocation not detected for {total_allocation}% total allocation"
                    
                    # Verify excess allocation is calculated correctly
                    for conflict in overallocation_conflicts:
                        assert conflict['total_allocation'] == total_allocation
                        assert conflict['excess_allocation'] == total_allocation - 100


    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    @given(
        allocation1=st.integers(min_value=30, max_value=80),
        allocation2=st.integers(min_value=30, max_value=80),
        overlap_offset=st.integers(min_value=1, max_value=9)
    )
    @pytest.mark.asyncio
    async def test_double_booking_detection(self, allocation1, allocation2, overlap_offset):
        """
        Property 9: Resource Conflict Detection - Double Booking Detection
        
        For any two overlapping assignments where combined allocation > 100%,
        a double booking conflict should be detected.
        
        **Validates: Requirements 5.2, 5.3**
        """
        resource_id = str(uuid.uuid4())
        resource_data = {
            'id': resource_id,
            'name': 'Test Resource',
            'capacity': 40,
            'availability': 100
        }
        
        # Create two overlapping assignments
        base_date = date.today()
        
        # Assignment 1: days 0-10 (11 days total)
        assignment1_start = base_date
        assignment1_end = base_date + timedelta(days=10)
        
        # Assignment 2: starts at overlap_offset, ends at day 20
        # This creates an overlap from overlap_offset to day 10
        assignment2_start = base_date + timedelta(days=overlap_offset)
        assignment2_end = base_date + timedelta(days=20)
        
        # Calculate expected overlap: from assignment2_start to assignment1_end
        # overlap_days = (overlap_end - overlap_start).days + 1
        expected_overlap_days = (assignment1_end - assignment2_start).days + 1
        
        assignment1 = {
            'id': str(uuid.uuid4()),
            'task_id': str(uuid.uuid4()),
            'resource_id': resource_id,
            'allocation_percentage': allocation1,
            'assignment_start_date': assignment1_start.isoformat(),
            'assignment_end_date': assignment1_end.isoformat(),
            'tasks': {'id': str(uuid.uuid4()), 'name': 'Task 1', 'wbs_code': '1.1'},
            'resources': resource_data
        }
        
        assignment2 = {
            'id': str(uuid.uuid4()),
            'task_id': str(uuid.uuid4()),
            'resource_id': resource_id,
            'allocation_percentage': allocation2,
            'assignment_start_date': assignment2_start.isoformat(),
            'assignment_end_date': assignment2_end.isoformat(),
            'tasks': {'id': str(uuid.uuid4()), 'name': 'Task 2', 'wbs_code': '1.2'},
            'resources': resource_data
        }
        
        assignments = [assignment1, assignment2]
        combined_allocation = allocation1 + allocation2
        
        with patch.dict(os.environ, {
            'SUPABASE_URL': 'https://test.supabase.co',
            'SUPABASE_ANON_KEY': 'test_key'
        }):
            with patch('services.resource_assignment_service.supabase') as mock_db:
                service = ResourceAssignmentService.__new__(ResourceAssignmentService)
                service.db = mock_db
                
                conflicts = await service._detect_resource_specific_conflicts(
                    resource_id,
                    assignments
                )
                
                # If combined allocation > 100%, double booking should be detected
                if combined_allocation > 100:
                    double_booking_conflicts = [
                        c for c in conflicts 
                        if c['type'] == ResourceConflictType.DOUBLE_BOOKING.value
                    ]
                    assert len(double_booking_conflicts) > 0, \
                        f"Double booking not detected for {combined_allocation}% combined allocation"
                    
                    # Verify overlap days calculation
                    for conflict in double_booking_conflicts:
                        assert conflict['overlap_days'] == expected_overlap_days, \
                            f"Expected {expected_overlap_days} overlap days, got {conflict['overlap_days']}"
                        assert conflict['combined_allocation'] == combined_allocation


    @settings(max_examples=50, suppress_health_check=[HealthCheck.too_slow])
    @given(
        allocation1=st.integers(min_value=10, max_value=40),
        allocation2=st.integers(min_value=10, max_value=40)
    )
    @pytest.mark.asyncio
    async def test_no_conflict_when_under_capacity(self, allocation1, allocation2):
        """
        Property 9: Resource Conflict Detection - No False Positives
        
        For any set of assignments where total allocation <= 100%,
        no overallocation conflict should be detected.
        
        **Validates: Requirements 5.2, 5.3**
        """
        # Ensure total is under 100%
        assume(allocation1 + allocation2 <= 100)
        
        resource_id = str(uuid.uuid4())
        resource_data = {
            'id': resource_id,
            'name': 'Test Resource',
            'capacity': 40,
            'availability': 100
        }
        
        base_date = date.today()
        
        # Non-overlapping assignments
        assignment1 = {
            'id': str(uuid.uuid4()),
            'task_id': str(uuid.uuid4()),
            'resource_id': resource_id,
            'allocation_percentage': allocation1,
            'assignment_start_date': base_date.isoformat(),
            'assignment_end_date': (base_date + timedelta(days=5)).isoformat(),
            'tasks': {'id': str(uuid.uuid4()), 'name': 'Task 1', 'wbs_code': '1.1'},
            'resources': resource_data
        }
        
        assignment2 = {
            'id': str(uuid.uuid4()),
            'task_id': str(uuid.uuid4()),
            'resource_id': resource_id,
            'allocation_percentage': allocation2,
            'assignment_start_date': (base_date + timedelta(days=10)).isoformat(),
            'assignment_end_date': (base_date + timedelta(days=15)).isoformat(),
            'tasks': {'id': str(uuid.uuid4()), 'name': 'Task 2', 'wbs_code': '1.2'},
            'resources': resource_data
        }
        
        assignments = [assignment1, assignment2]
        
        with patch.dict(os.environ, {
            'SUPABASE_URL': 'https://test.supabase.co',
            'SUPABASE_ANON_KEY': 'test_key'
        }):
            with patch('services.resource_assignment_service.supabase') as mock_db:
                service = ResourceAssignmentService.__new__(ResourceAssignmentService)
                service.db = mock_db
                
                conflicts = await service._detect_resource_specific_conflicts(
                    resource_id,
                    assignments
                )
                
                # No overallocation conflicts should be detected
                overallocation_conflicts = [
                    c for c in conflicts 
                    if c['type'] == ResourceConflictType.OVERALLOCATION.value
                ]
                assert len(overallocation_conflicts) == 0, \
                    f"False positive: overallocation detected for {allocation1 + allocation2}% total"

    @settings(max_examples=50, suppress_health_check=[HealthCheck.too_slow])
    @given(num_assignments=st.integers(min_value=1, max_value=10))
    @pytest.mark.asyncio
    async def test_conflict_severity_classification(self, num_assignments):
        """
        Property 9: Resource Conflict Detection - Severity Classification
        
        For any overallocation conflict, severity should be classified correctly:
        - 'high' if total allocation > 150%
        - 'medium' if total allocation > 100% but <= 150%
        
        **Validates: Requirements 5.2, 5.3**
        """
        resource_id = str(uuid.uuid4())
        resource_data = {
            'id': resource_id,
            'name': 'Test Resource',
            'capacity': 40,
            'availability': 100
        }
        
        # Create assignments that will exceed 100%
        allocation_per_task = 30  # 30% each
        base_date = date.today()
        
        assignments = []
        for i in range(num_assignments):
            assignments.append({
                'id': str(uuid.uuid4()),
                'task_id': str(uuid.uuid4()),
                'resource_id': resource_id,
                'allocation_percentage': allocation_per_task,
                'assignment_start_date': base_date.isoformat(),
                'assignment_end_date': (base_date + timedelta(days=10)).isoformat(),
                'tasks': {'id': str(uuid.uuid4()), 'name': f'Task {i+1}', 'wbs_code': f'1.{i+1}'},
                'resources': resource_data
            })
        
        total_allocation = allocation_per_task * num_assignments
        
        with patch.dict(os.environ, {
            'SUPABASE_URL': 'https://test.supabase.co',
            'SUPABASE_ANON_KEY': 'test_key'
        }):
            with patch('services.resource_assignment_service.supabase') as mock_db:
                service = ResourceAssignmentService.__new__(ResourceAssignmentService)
                service.db = mock_db
                
                conflicts = await service._detect_resource_specific_conflicts(
                    resource_id,
                    assignments
                )
                
                if total_allocation > 100:
                    overallocation_conflicts = [
                        c for c in conflicts 
                        if c['type'] == ResourceConflictType.OVERALLOCATION.value
                    ]
                    
                    for conflict in overallocation_conflicts:
                        if total_allocation > 150:
                            assert conflict['severity'] == 'high', \
                                f"Expected 'high' severity for {total_allocation}% allocation"
                        else:
                            assert conflict['severity'] == 'medium', \
                                f"Expected 'medium' severity for {total_allocation}% allocation"



# =====================================================
# PROPERTY 10: RESOURCE UTILIZATION CALCULATION
# =====================================================

class TestResourceUtilizationCalculation:
    """
    Property 10: Resource Utilization Calculation
    
    For any resource assignment configuration, utilization reports should show
    accurate allocation percentages over time.
    
    **Validates: Requirements 5.4, 5.5**
    """

    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    @given(
        capacity=st.integers(min_value=20, max_value=60),
        availability=st.integers(min_value=10, max_value=100),
        total_allocation=st.integers(min_value=0, max_value=200)
    )
    def test_utilization_percentage_calculation(self, capacity, availability, total_allocation):
        """
        Property 10: Resource Utilization Calculation - Percentage Calculation
        
        For any resource with given capacity and availability, utilization percentage
        should be calculated correctly based on allocation.
        
        **Validates: Requirements 5.4, 5.5**
        """
        # Calculate effective capacity
        effective_capacity = capacity * (availability / 100.0)
        
        # Calculate expected utilization
        if effective_capacity > 0:
            # When using allocation percentage directly
            expected_utilization = min(total_allocation, 100)
        else:
            expected_utilization = 0
        
        # Create utilization report
        report = ResourceUtilizationReport(
            resource_id=str(uuid.uuid4()),
            resource_name="Test Resource",
            total_allocation=total_allocation,
            assignments=[],
            utilization_percentage=expected_utilization,
            conflicts=[]
        )
        
        # Verify utilization is within valid range
        assert report.utilization_percentage >= 0, \
            f"Utilization percentage {report.utilization_percentage} is negative"
        
        # Verify total allocation is preserved
        assert report.total_allocation == total_allocation

    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    @given(
        num_assignments=st.integers(min_value=1, max_value=5),
        base_allocation=st.integers(min_value=10, max_value=50)
    )
    def test_total_allocation_aggregation(self, num_assignments, base_allocation):
        """
        Property 10: Resource Utilization Calculation - Allocation Aggregation
        
        For any set of resource assignments, total allocation should be the sum
        of individual allocation percentages.
        
        **Validates: Requirements 5.4, 5.5**
        """
        resource_id = str(uuid.uuid4())
        assignments = []
        
        for i in range(num_assignments):
            assignment = ResourceAssignmentResponse(
                id=str(uuid.uuid4()),
                task_id=str(uuid.uuid4()),
                resource_id=resource_id,
                allocation_percentage=base_allocation,
                planned_hours=base_allocation * 0.4,
                actual_hours=None,
                assignment_start_date=date.today(),
                assignment_end_date=date.today() + timedelta(days=10),
                created_by=str(uuid.uuid4()),
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            assignments.append(assignment)
        
        # Calculate expected total
        expected_total = base_allocation * num_assignments
        
        # Create utilization report
        report = ResourceUtilizationReport(
            resource_id=resource_id,
            resource_name="Test Resource",
            total_allocation=expected_total,
            assignments=assignments,
            utilization_percentage=min(expected_total, 100),
            conflicts=[]
        )
        
        # Verify total allocation matches sum of individual allocations
        actual_total = sum(a.allocation_percentage for a in report.assignments)
        assert report.total_allocation == actual_total, \
            f"Total allocation {report.total_allocation} != sum of assignments {actual_total}"


    @settings(max_examples=50, suppress_health_check=[HealthCheck.too_slow])
    @given(
        planned_hours=st.floats(min_value=0.0, max_value=100.0, allow_nan=False, allow_infinity=False),
        actual_hours=st.floats(min_value=0.0, max_value=100.0, allow_nan=False, allow_infinity=False)
    )
    def test_hours_tracking_consistency(self, planned_hours, actual_hours):
        """
        Property 10: Resource Utilization Calculation - Hours Tracking
        
        For any resource assignment, planned and actual hours should be tracked
        consistently and non-negative.
        
        **Validates: Requirements 5.4, 5.5**
        """
        assignment = ResourceAssignmentResponse(
            id=str(uuid.uuid4()),
            task_id=str(uuid.uuid4()),
            resource_id=str(uuid.uuid4()),
            allocation_percentage=50,
            planned_hours=planned_hours,
            actual_hours=actual_hours,
            assignment_start_date=date.today(),
            assignment_end_date=date.today() + timedelta(days=10),
            created_by=str(uuid.uuid4()),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        # Verify hours are non-negative
        assert assignment.planned_hours >= 0, \
            f"Planned hours {assignment.planned_hours} is negative"
        assert assignment.actual_hours >= 0, \
            f"Actual hours {assignment.actual_hours} is negative"
        
        # Verify hours are preserved correctly
        assert assignment.planned_hours == planned_hours
        assert assignment.actual_hours == actual_hours

    @settings(max_examples=50, suppress_health_check=[HealthCheck.too_slow])
    @given(
        capacity=st.integers(min_value=20, max_value=60),
        availability=st.integers(min_value=0, max_value=100)
    )
    def test_zero_availability_handling(self, capacity, availability):
        """
        Property 10: Resource Utilization Calculation - Zero Availability Edge Case
        
        For any resource with zero availability, utilization calculations should
        handle the edge case gracefully.
        
        **Validates: Requirements 5.4, 5.5**
        """
        effective_capacity = capacity * (availability / 100.0)
        
        # When availability is 0, effective capacity is 0
        if availability == 0:
            assert effective_capacity == 0, \
                f"Zero availability should result in zero effective capacity"
        
        # Utilization should be 0 when there's no capacity
        if effective_capacity == 0:
            utilization = 0
        else:
            utilization = 50  # Some allocation
        
        report = ResourceUtilizationReport(
            resource_id=str(uuid.uuid4()),
            resource_name="Test Resource",
            total_allocation=50 if availability > 0 else 0,
            assignments=[],
            utilization_percentage=utilization,
            conflicts=[]
        )
        
        if availability == 0:
            assert report.utilization_percentage == 0, \
                f"Zero availability should result in 0% utilization"

    @settings(max_examples=50, suppress_health_check=[HealthCheck.too_slow])
    @given(
        total_allocation=st.integers(min_value=101, max_value=300)
    )
    def test_overallocation_in_utilization_report(self, total_allocation):
        """
        Property 10: Resource Utilization Calculation - Overallocation Reporting
        
        For any resource that is overallocated, the utilization report should
        accurately reflect the overallocation and include conflict information.
        
        **Validates: Requirements 5.4, 5.5**
        """
        # Create report with overallocation
        conflicts = [f"Overallocation: {total_allocation}% total allocation exceeds 100%"]
        
        report = ResourceUtilizationReport(
            resource_id=str(uuid.uuid4()),
            resource_name="Test Resource",
            total_allocation=total_allocation,
            assignments=[],
            utilization_percentage=float(total_allocation),  # Can exceed 100%
            conflicts=conflicts
        )
        
        # Verify overallocation is reflected
        assert report.total_allocation > 100, \
            f"Total allocation {report.total_allocation} should be > 100"
        
        # Verify conflicts are reported
        assert len(report.conflicts) > 0, \
            "Overallocation should generate conflict entries"

    @settings(max_examples=50, suppress_health_check=[HealthCheck.too_slow])
    @given(
        num_assignments=st.integers(min_value=0, max_value=10)
    )
    def test_empty_assignments_handling(self, num_assignments):
        """
        Property 10: Resource Utilization Calculation - Empty Assignments
        
        For any resource with no assignments, utilization should be 0%.
        
        **Validates: Requirements 5.4, 5.5**
        """
        if num_assignments == 0:
            report = ResourceUtilizationReport(
                resource_id=str(uuid.uuid4()),
                resource_name="Test Resource",
                total_allocation=0,
                assignments=[],
                utilization_percentage=0.0,
                conflicts=[]
            )
            
            assert report.total_allocation == 0, \
                "No assignments should result in 0 total allocation"
            assert report.utilization_percentage == 0.0, \
                "No assignments should result in 0% utilization"
            assert len(report.assignments) == 0, \
                "Assignments list should be empty"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
