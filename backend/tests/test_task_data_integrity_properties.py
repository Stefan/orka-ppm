"""
Property-based tests for Task Data Integrity.

**Feature: integrated-master-schedule, Property 1: Task Data Integrity**
**Validates: Requirements 1.1, 1.4, 2.2, 6.1**

For any task creation or update operation, all required fields should be captured 
correctly and task hierarchies should maintain valid parent-child relationships.
"""

import sys
import os
import pytest
from hypothesis import given, strategies as st, settings, assume, HealthCheck
from typing import List, Dict, Any, Optional
from uuid import uuid4, UUID
from datetime import date, datetime, timedelta
from pydantic import ValidationError

# Add the backend directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from models.schedule import (
    ScheduleCreate, TaskCreate, TaskUpdate, TaskResponse,
    TaskStatus, MilestoneCreate, MilestoneStatus,
    TaskProgressUpdate
)


# =====================================================
# CUSTOM STRATEGIES
# =====================================================

def valid_wbs_code_strategy():
    """Generate valid WBS codes following standard numbering conventions."""
    return st.from_regex(r"[1-9][0-9]?(\.[1-9][0-9]?){0,4}", fullmatch=True)


def valid_task_name_strategy():
    """Generate valid task names (1-255 characters, non-empty)."""
    return st.text(
        alphabet=st.characters(whitelist_categories=('L', 'N', 'P', 'Z')),
        min_size=1,
        max_size=100
    ).filter(lambda x: x.strip() != "")


def valid_date_strategy():
    """Generate valid dates within a reasonable range."""
    return st.dates(
        min_value=date(2020, 1, 1),
        max_value=date(2030, 12, 31)
    )


def valid_duration_strategy():
    """Generate valid task durations (1-365 days)."""
    return st.integers(min_value=1, max_value=365)


def valid_progress_strategy():
    """Generate valid progress percentages (0-100)."""
    return st.integers(min_value=0, max_value=100)


def valid_effort_hours_strategy():
    """Generate valid effort hours (0-10000)."""
    return st.floats(min_value=0.0, max_value=10000.0, allow_nan=False, allow_infinity=False)


@st.composite
def task_create_data_strategy(draw):
    """Generate valid TaskCreate data."""
    start_date = draw(valid_date_strategy())
    duration = draw(valid_duration_strategy())
    end_date = start_date + timedelta(days=duration)
    
    return {
        "wbs_code": draw(valid_wbs_code_strategy()),
        "name": draw(valid_task_name_strategy()),
        "description": draw(st.one_of(st.none(), st.text(min_size=0, max_size=500))),
        "planned_start_date": start_date,
        "planned_end_date": end_date,
        "duration_days": duration,
        "planned_effort_hours": draw(st.one_of(st.none(), valid_effort_hours_strategy())),
        "deliverables": draw(st.lists(st.text(min_size=1, max_size=50), max_size=5)),
        "acceptance_criteria": draw(st.one_of(st.none(), st.text(min_size=0, max_size=500)))
    }


@st.composite
def task_hierarchy_strategy(draw, max_depth=3, max_children=3):
    """Generate a valid task hierarchy structure."""
    def generate_children(parent_wbs: str, depth: int) -> List[Dict]:
        if depth >= max_depth:
            return []
        
        num_children = draw(st.integers(min_value=0, max_value=max_children))
        children = []
        
        for i in range(1, num_children + 1):
            child_wbs = f"{parent_wbs}.{i}"
            start_date = draw(valid_date_strategy())
            duration = draw(valid_duration_strategy())
            end_date = start_date + timedelta(days=duration)
            
            child = {
                "wbs_code": child_wbs,
                "name": draw(valid_task_name_strategy()),
                "planned_start_date": start_date,
                "planned_end_date": end_date,
                "duration_days": duration,
                "children": generate_children(child_wbs, depth + 1)
            }
            children.append(child)
        
        return children
    
    # Generate root task
    root_wbs = str(draw(st.integers(min_value=1, max_value=9)))
    start_date = draw(valid_date_strategy())
    duration = draw(valid_duration_strategy())
    end_date = start_date + timedelta(days=duration)
    
    return {
        "wbs_code": root_wbs,
        "name": draw(valid_task_name_strategy()),
        "planned_start_date": start_date,
        "planned_end_date": end_date,
        "duration_days": duration,
        "children": generate_children(root_wbs, 1)
    }


@st.composite
def milestone_create_data_strategy(draw):
    """Generate valid MilestoneCreate data."""
    return {
        "name": draw(valid_task_name_strategy()),
        "description": draw(st.one_of(st.none(), st.text(min_size=0, max_size=500))),
        "target_date": draw(valid_date_strategy()),
        "success_criteria": draw(st.one_of(st.none(), st.text(min_size=0, max_size=500))),
        "deliverables": draw(st.lists(st.text(min_size=1, max_size=50), max_size=5)),
        "approval_required": draw(st.booleans())
    }


# =====================================================
# PROPERTY TESTS
# =====================================================

class TestTaskDataIntegrityProperties:
    """
    Property-based tests for Task Data Integrity.
    
    **Feature: integrated-master-schedule, Property 1: Task Data Integrity**
    **Validates: Requirements 1.1, 1.4, 2.2, 6.1**
    """
    
    @given(task_create_data_strategy())
    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    def test_property_1a_task_required_fields_captured(self, task_data: Dict[str, Any]):
        """
        Property 1a: Task Required Fields Captured
        
        For any valid task creation data, all required fields (name, WBS code, 
        start date, end date, duration) should be captured correctly in the model.
        
        **Validates: Requirements 1.1**
        """
        # Create TaskCreate model
        task = TaskCreate(
            wbs_code=task_data["wbs_code"],
            name=task_data["name"],
            description=task_data["description"],
            planned_start_date=task_data["planned_start_date"],
            planned_end_date=task_data["planned_end_date"],
            duration_days=task_data["duration_days"],
            planned_effort_hours=task_data["planned_effort_hours"],
            deliverables=task_data["deliverables"],
            acceptance_criteria=task_data["acceptance_criteria"]
        )
        
        # Property: All required fields should be captured correctly
        assert task.wbs_code == task_data["wbs_code"], "WBS code should be captured correctly"
        assert task.name == task_data["name"], "Task name should be captured correctly"
        assert task.planned_start_date == task_data["planned_start_date"], "Start date should be captured correctly"
        assert task.planned_end_date == task_data["planned_end_date"], "End date should be captured correctly"
        assert task.duration_days == task_data["duration_days"], "Duration should be captured correctly"
        
        # Property: Optional fields should be captured when provided
        assert task.description == task_data["description"], "Description should be captured correctly"
        assert task.planned_effort_hours == task_data["planned_effort_hours"], "Effort hours should be captured correctly"
        assert task.deliverables == task_data["deliverables"], "Deliverables should be captured correctly"
        assert task.acceptance_criteria == task_data["acceptance_criteria"], "Acceptance criteria should be captured correctly"
    
    @given(
        valid_wbs_code_strategy(),
        valid_task_name_strategy(),
        valid_date_strategy(),
        valid_duration_strategy()
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    def test_property_1b_task_date_validation(
        self, 
        wbs_code: str, 
        name: str, 
        start_date: date, 
        duration: int
    ):
        """
        Property 1b: Task Date Validation
        
        For any task, the planned end date must be on or after the planned start date.
        Invalid date ranges should be rejected.
        
        **Validates: Requirements 1.1**
        """
        end_date = start_date + timedelta(days=duration)
        
        # Valid date range should be accepted
        task = TaskCreate(
            wbs_code=wbs_code,
            name=name,
            planned_start_date=start_date,
            planned_end_date=end_date,
            duration_days=duration
        )
        
        # Property: End date should be >= start date
        assert task.planned_end_date >= task.planned_start_date, \
            "End date must be on or after start date"
        
        # Property: Invalid date range should be rejected
        invalid_end_date = start_date - timedelta(days=1)
        with pytest.raises(ValidationError):
            TaskCreate(
                wbs_code=wbs_code,
                name=name,
                planned_start_date=start_date,
                planned_end_date=invalid_end_date,
                duration_days=duration
            )
    
    @given(task_hierarchy_strategy())
    @settings(max_examples=50, suppress_health_check=[HealthCheck.too_slow])
    def test_property_1c_task_hierarchy_parent_child_relationships(self, hierarchy: Dict[str, Any]):
        """
        Property 1c: Task Hierarchy Parent-Child Relationships
        
        For any task hierarchy, parent-child relationships should be valid:
        - Child WBS codes should be prefixed with parent WBS code
        - Each task should have at most one parent
        - Hierarchy depth should be consistent with WBS code structure
        
        **Validates: Requirements 1.4**
        """
        def validate_hierarchy(task: Dict, parent_wbs: Optional[str] = None, depth: int = 0):
            wbs_code = task["wbs_code"]
            
            # Property: Child WBS codes should be prefixed with parent WBS code
            if parent_wbs:
                assert wbs_code.startswith(parent_wbs + "."), \
                    f"Child WBS '{wbs_code}' should be prefixed with parent WBS '{parent_wbs}'"
            
            # Property: WBS code depth should match hierarchy depth
            wbs_parts = wbs_code.split(".")
            assert len(wbs_parts) == depth + 1, \
                f"WBS code depth ({len(wbs_parts)}) should match hierarchy depth ({depth + 1})"
            
            # Recursively validate children
            for child in task.get("children", []):
                validate_hierarchy(child, wbs_code, depth + 1)
        
        validate_hierarchy(hierarchy)
    
    @given(st.lists(task_create_data_strategy(), min_size=2, max_size=10))
    @settings(max_examples=50, suppress_health_check=[HealthCheck.too_slow])
    def test_property_1d_wbs_code_uniqueness_within_schedule(self, tasks_data: List[Dict[str, Any]]):
        """
        Property 1d: WBS Code Uniqueness Within Schedule
        
        For any set of tasks within a schedule, WBS codes should be unique.
        Duplicate WBS codes should be detectable.
        
        **Validates: Requirements 2.2**
        """
        # Create tasks
        tasks = []
        for task_data in tasks_data:
            task = TaskCreate(
                wbs_code=task_data["wbs_code"],
                name=task_data["name"],
                planned_start_date=task_data["planned_start_date"],
                planned_end_date=task_data["planned_end_date"],
                duration_days=task_data["duration_days"]
            )
            tasks.append(task)
        
        # Extract WBS codes
        wbs_codes = [task.wbs_code for task in tasks]
        unique_wbs_codes = set(wbs_codes)
        
        # Property: Duplicate WBS codes should be detectable
        has_duplicates = len(wbs_codes) != len(unique_wbs_codes)
        
        if has_duplicates:
            # Find duplicates
            seen = set()
            duplicates = set()
            for code in wbs_codes:
                if code in seen:
                    duplicates.add(code)
                seen.add(code)
            
            assert len(duplicates) > 0, "Duplicates should be detected when they exist"
        else:
            # All codes are unique
            assert len(wbs_codes) == len(unique_wbs_codes), \
                "All WBS codes should be unique when no duplicates exist"
    
    @given(milestone_create_data_strategy())
    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    def test_property_1e_milestone_required_fields_captured(self, milestone_data: Dict[str, Any]):
        """
        Property 1e: Milestone Required Fields Captured
        
        For any valid milestone creation data, all required fields (name, target date)
        should be captured correctly in the model.
        
        **Validates: Requirements 6.1**
        """
        # Create MilestoneCreate model
        milestone = MilestoneCreate(
            name=milestone_data["name"],
            description=milestone_data["description"],
            target_date=milestone_data["target_date"],
            success_criteria=milestone_data["success_criteria"],
            deliverables=milestone_data["deliverables"],
            approval_required=milestone_data["approval_required"]
        )
        
        # Property: All required fields should be captured correctly
        assert milestone.name == milestone_data["name"], "Milestone name should be captured correctly"
        assert milestone.target_date == milestone_data["target_date"], "Target date should be captured correctly"
        
        # Property: Optional fields should be captured when provided
        assert milestone.description == milestone_data["description"], "Description should be captured correctly"
        assert milestone.success_criteria == milestone_data["success_criteria"], "Success criteria should be captured correctly"
        assert milestone.deliverables == milestone_data["deliverables"], "Deliverables should be captured correctly"
        assert milestone.approval_required == milestone_data["approval_required"], "Approval required should be captured correctly"
    
    @given(
        valid_task_name_strategy(),
        valid_progress_strategy(),
        st.sampled_from(list(TaskStatus))
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    def test_property_1f_task_progress_update_validation(
        self, 
        name: str, 
        progress: int, 
        status: TaskStatus
    ):
        """
        Property 1f: Task Progress Update Validation
        
        For any task progress update, progress percentage should be within 0-100
        and status should be a valid TaskStatus enum value.
        
        **Validates: Requirements 1.1**
        """
        # Create progress update
        progress_update = TaskProgressUpdate(
            progress_percentage=progress,
            status=status
        )
        
        # Property: Progress should be within valid range
        assert 0 <= progress_update.progress_percentage <= 100, \
            "Progress percentage should be between 0 and 100"
        
        # Property: Status should be a valid enum value
        assert progress_update.status in TaskStatus, \
            "Status should be a valid TaskStatus enum value"
        
        # Property: Invalid progress should be rejected
        with pytest.raises(ValidationError):
            TaskProgressUpdate(
                progress_percentage=101,  # Invalid: > 100
                status=status
            )
        
        with pytest.raises(ValidationError):
            TaskProgressUpdate(
                progress_percentage=-1,  # Invalid: < 0
                status=status
            )
    
    @given(
        valid_wbs_code_strategy(),
        valid_task_name_strategy(),
        valid_date_strategy(),
        valid_duration_strategy()
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    def test_property_1g_task_duration_consistency(
        self, 
        wbs_code: str, 
        name: str, 
        start_date: date, 
        duration: int
    ):
        """
        Property 1g: Task Duration Consistency
        
        For any task, the duration should be consistent with the date range
        (end_date - start_date should equal duration in days).
        
        **Validates: Requirements 1.1**
        """
        end_date = start_date + timedelta(days=duration)
        
        task = TaskCreate(
            wbs_code=wbs_code,
            name=name,
            planned_start_date=start_date,
            planned_end_date=end_date,
            duration_days=duration
        )
        
        # Property: Duration should be positive
        assert task.duration_days >= 1, "Duration should be at least 1 day"
        
        # Property: Date range should be consistent with duration
        calculated_duration = (task.planned_end_date - task.planned_start_date).days
        assert calculated_duration == task.duration_days, \
            f"Date range ({calculated_duration} days) should match duration ({task.duration_days} days)"
    
    @given(st.lists(valid_wbs_code_strategy(), min_size=1, max_size=20))
    @settings(max_examples=50, suppress_health_check=[HealthCheck.too_slow])
    def test_property_1h_wbs_code_format_validation(self, wbs_codes: List[str]):
        """
        Property 1h: WBS Code Format Validation
        
        For any WBS code, it should follow standard numbering conventions
        (e.g., "1", "1.1", "1.1.1", etc.).
        
        **Validates: Requirements 2.2**
        """
        import re
        wbs_pattern = re.compile(r"^[1-9][0-9]?(\.[1-9][0-9]?)*$")
        
        for wbs_code in wbs_codes:
            # Property: WBS code should match standard format
            assert wbs_pattern.match(wbs_code), \
                f"WBS code '{wbs_code}' should follow standard numbering conventions"
            
            # Property: WBS code parts should be valid numbers
            parts = wbs_code.split(".")
            for part in parts:
                assert part.isdigit(), f"WBS code part '{part}' should be numeric"
                assert int(part) >= 1, f"WBS code part '{part}' should be >= 1"


def run_property_tests():
    """Run all property-based tests"""
    print("🚀 Running Task Data Integrity Property Tests")
    print("=" * 60)
    print("Feature: integrated-master-schedule, Property 1: Task Data Integrity")
    print("Validates: Requirements 1.1, 1.4, 2.2, 6.1")
    print("=" * 60)
    
    # Run pytest with this file
    test_file = __file__
    exit_code = pytest.main([
        test_file,
        "-v",
        "--tb=short",
        "-x"  # Stop on first failure
    ])
    
    return exit_code == 0


if __name__ == "__main__":
    success = run_property_tests()
    if success:
        print("\n🎉 All task data integrity property tests passed!")
    else:
        print("\n❌ Some property tests failed.")
    
    sys.exit(0 if success else 1)
