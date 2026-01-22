"""
Property-based tests for Baseline Management.

These tests validate Property 12: Baseline Variance Calculation and
Property 13: Baseline Version Management from the Integrated Master Schedule
System design document.

**Property 12: Baseline Variance Calculation**
For any established baseline, schedule variance calculations should be
mathematically correct for individual tasks and overall project.

**Property 13: Baseline Version Management**
For any baseline versioning operation, multiple baseline versions should be
maintained correctly with proper approval workflow.

**Validates: Requirements 7.1, 7.2, 7.4, 7.5**
"""

import sys
import os
import pytest
from hypothesis import given, strategies as st, settings, assume
from typing import List, Dict, Any, Optional
from uuid import uuid4, UUID
from datetime import date, datetime, timedelta
from decimal import Decimal
import random

# Add the backend directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


class BaselineVarianceCalculator:
    """
    Pure implementation of baseline variance calculation for property testing.
    
    This mirrors the logic in BaselineManager.calculate_schedule_variance
    but is isolated for testing without database dependencies.
    """
    
    @staticmethod
    def calculate_task_variance(
        baseline_task: Dict[str, Any],
        current_task: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Calculate variance for a single task against its baseline.
        
        Args:
            baseline_task: Task data from baseline snapshot
            current_task: Current task data
            
        Returns:
            Dict with variance calculations
        """
        baseline_start = date.fromisoformat(baseline_task["planned_start_date"])
        baseline_end = date.fromisoformat(baseline_task["planned_end_date"])
        current_start = date.fromisoformat(current_task["planned_start_date"])
        current_end = date.fromisoformat(current_task["planned_end_date"])
        
        start_variance_days = (current_start - baseline_start).days
        end_variance_days = (current_end - baseline_end).days
        duration_variance_days = current_task["duration_days"] - baseline_task["duration_days"]
        
        baseline_progress = baseline_task.get("progress_percentage", 0)
        current_progress = current_task.get("progress_percentage", 0)
        progress_variance = current_progress - baseline_progress
        
        return {
            "task_id": current_task["id"],
            "task_name": current_task["name"],
            "wbs_code": current_task["wbs_code"],
            "start_variance_days": start_variance_days,
            "end_variance_days": end_variance_days,
            "duration_variance_days": duration_variance_days,
            "progress_variance": progress_variance,
            "baseline_start_date": baseline_start.isoformat(),
            "baseline_end_date": baseline_end.isoformat(),
            "current_start_date": current_start.isoformat(),
            "current_end_date": current_end.isoformat(),
            "is_critical": current_task.get("is_critical", False)
        }
    
    @staticmethod
    def calculate_schedule_variance(
        baseline_schedule: Dict[str, Any],
        current_schedule: Dict[str, Any],
        baseline_tasks: List[Dict[str, Any]],
        current_tasks: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Calculate overall schedule variance against baseline.
        
        Args:
            baseline_schedule: Schedule data from baseline snapshot
            current_schedule: Current schedule data
            baseline_tasks: Tasks from baseline snapshot
            current_tasks: Current task data
            
        Returns:
            Dict with variance calculations
        """
        current_tasks_map = {task["id"]: task for task in current_tasks}
        
        task_variances = []
        total_schedule_variance_days = 0
        
        for baseline_task in baseline_tasks:
            task_id = baseline_task["id"]
            current_task = current_tasks_map.get(task_id)
            
            if current_task:
                variance = BaselineVarianceCalculator.calculate_task_variance(
                    baseline_task, current_task
                )
                task_variances.append(variance)
                total_schedule_variance_days += variance["duration_variance_days"]
        
        # Calculate overall schedule variance
        baseline_start = date.fromisoformat(baseline_schedule["start_date"])
        baseline_end = date.fromisoformat(baseline_schedule["end_date"])
        current_start = date.fromisoformat(current_schedule["start_date"])
        current_end = date.fromisoformat(current_schedule["end_date"])
        
        schedule_start_variance_days = (current_start - baseline_start).days
        schedule_end_variance_days = (current_end - baseline_end).days
        
        # Calculate SPI
        spi = BaselineVarianceCalculator.calculate_schedule_performance_index(
            current_tasks, baseline_tasks
        )
        
        return {
            "schedule_variance": {
                "start_variance_days": schedule_start_variance_days,
                "end_variance_days": schedule_end_variance_days,
                "total_duration_variance_days": total_schedule_variance_days,
                "schedule_performance_index": spi
            },
            "task_variances": task_variances,
            "summary": {
                "total_tasks_analyzed": len(task_variances),
                "tasks_ahead_of_schedule": len([t for t in task_variances if t["end_variance_days"] < 0]),
                "tasks_behind_schedule": len([t for t in task_variances if t["end_variance_days"] > 0]),
                "tasks_on_schedule": len([t for t in task_variances if t["end_variance_days"] == 0]),
                "average_duration_variance": total_schedule_variance_days / len(task_variances) if task_variances else 0,
                "critical_tasks_with_variance": len([t for t in task_variances if t["is_critical"] and t["end_variance_days"] != 0])
            }
        }
    
    @staticmethod
    def calculate_schedule_performance_index(
        current_tasks: List[Dict[str, Any]],
        baseline_tasks: List[Dict[str, Any]]
    ) -> float:
        """
        Calculate Schedule Performance Index (SPI).
        
        SPI = Earned Value / Planned Value
        
        Args:
            current_tasks: Current task data
            baseline_tasks: Baseline task data
            
        Returns:
            float: Schedule Performance Index
        """
        current_tasks_map = {task["id"]: task for task in current_tasks}
        
        total_earned_value = 0.0
        total_planned_value = 0.0
        
        for baseline_task in baseline_tasks:
            task_id = baseline_task["id"]
            current_task = current_tasks_map.get(task_id)
            
            if current_task:
                baseline_effort = baseline_task.get("planned_effort_hours", 1) or 1
                current_progress = current_task.get("progress_percentage", 0)
                
                # Earned value = baseline effort * actual progress
                earned_value = baseline_effort * (current_progress / 100)
                
                # Planned value = baseline effort (assuming 100% planned)
                planned_value = baseline_effort
                
                total_earned_value += earned_value
                total_planned_value += planned_value
        
        return round(total_earned_value / total_planned_value, 3) if total_planned_value > 0 else 0.0


class BaselineVersionManager:
    """
    Pure implementation of baseline version management for property testing.
    
    This mirrors the logic in BaselineManager for version management
    but is isolated for testing without database dependencies.
    """
    
    def __init__(self):
        self.baselines: Dict[str, Dict[str, Any]] = {}
        self.schedule_baselines: Dict[str, List[str]] = {}  # schedule_id -> list of baseline_ids
    
    def create_baseline(
        self,
        schedule_id: str,
        baseline_name: str,
        baseline_date: date,
        baseline_data: Dict[str, Any],
        created_by: str
    ) -> Dict[str, Any]:
        """
        Create a new baseline version.
        
        Args:
            schedule_id: ID of the schedule
            baseline_name: Name of the baseline
            baseline_date: Date of the baseline
            baseline_data: Snapshot data
            created_by: User ID
            
        Returns:
            Created baseline record
        """
        baseline_id = str(uuid4())
        
        baseline = {
            "id": baseline_id,
            "schedule_id": schedule_id,
            "baseline_name": baseline_name,
            "baseline_date": baseline_date.isoformat(),
            "baseline_data": baseline_data,
            "is_approved": False,
            "approved_by": None,
            "approved_at": None,
            "created_by": created_by,
            "created_at": datetime.utcnow().isoformat()
        }
        
        self.baselines[baseline_id] = baseline
        
        if schedule_id not in self.schedule_baselines:
            self.schedule_baselines[schedule_id] = []
        self.schedule_baselines[schedule_id].append(baseline_id)
        
        return baseline
    
    def approve_baseline(
        self,
        baseline_id: str,
        approved_by: str
    ) -> Optional[Dict[str, Any]]:
        """
        Approve a baseline.
        
        Args:
            baseline_id: ID of the baseline to approve
            approved_by: User ID approving
            
        Returns:
            Updated baseline or None if not found
        """
        if baseline_id not in self.baselines:
            return None
        
        baseline = self.baselines[baseline_id]
        baseline["is_approved"] = True
        baseline["approved_by"] = approved_by
        baseline["approved_at"] = datetime.utcnow().isoformat()
        
        return baseline
    
    def get_baseline_versions(
        self,
        schedule_id: str
    ) -> List[Dict[str, Any]]:
        """
        Get all baseline versions for a schedule.
        
        Args:
            schedule_id: ID of the schedule
            
        Returns:
            List of baselines sorted by creation date (newest first)
        """
        if schedule_id not in self.schedule_baselines:
            return []
        
        baselines = [
            self.baselines[bid] 
            for bid in self.schedule_baselines[schedule_id]
            if bid in self.baselines
        ]
        
        # Sort by created_at descending
        baselines.sort(key=lambda b: b["created_at"], reverse=True)
        
        return baselines
    
    def get_latest_approved_baseline(
        self,
        schedule_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get the latest approved baseline for a schedule.
        
        Args:
            schedule_id: ID of the schedule
            
        Returns:
            Latest approved baseline or None
        """
        baselines = self.get_baseline_versions(schedule_id)
        
        for baseline in baselines:
            if baseline["is_approved"]:
                return baseline
        
        return None
    
    def delete_baseline(
        self,
        baseline_id: str
    ) -> bool:
        """
        Delete a baseline (only if not approved).
        
        Args:
            baseline_id: ID of the baseline to delete
            
        Returns:
            True if deleted, False otherwise
        """
        if baseline_id not in self.baselines:
            return False
        
        baseline = self.baselines[baseline_id]
        
        # Cannot delete approved baselines
        if baseline["is_approved"]:
            return False
        
        schedule_id = baseline["schedule_id"]
        
        del self.baselines[baseline_id]
        
        if schedule_id in self.schedule_baselines:
            self.schedule_baselines[schedule_id] = [
                bid for bid in self.schedule_baselines[schedule_id]
                if bid != baseline_id
            ]
        
        return True


# Hypothesis strategies for generating test data
@st.composite
def date_strategy(draw, min_days_from_now=-365, max_days_from_now=365):
    """Generate a date within a range from today."""
    days_offset = draw(st.integers(min_value=min_days_from_now, max_value=max_days_from_now))
    return date.today() + timedelta(days=days_offset)


@st.composite
def task_strategy(draw, task_id=None):
    """Generate a single task with valid data."""
    if task_id is None:
        task_id = str(uuid4())
    
    start_date = draw(date_strategy(min_days_from_now=-180, max_days_from_now=180))
    duration = draw(st.integers(min_value=1, max_value=90))
    end_date = start_date + timedelta(days=duration)
    
    progress = draw(st.integers(min_value=0, max_value=100))
    effort = draw(st.floats(min_value=1.0, max_value=500.0, allow_nan=False, allow_infinity=False))
    
    return {
        "id": task_id,
        "name": f"Task-{task_id[:8]}",
        "wbs_code": f"1.{draw(st.integers(min_value=1, max_value=99))}",
        "planned_start_date": start_date.isoformat(),
        "planned_end_date": end_date.isoformat(),
        "duration_days": duration,
        "progress_percentage": progress,
        "planned_effort_hours": round(effort, 2),
        "is_critical": draw(st.booleans())
    }


@st.composite
def task_pair_strategy(draw):
    """Generate a baseline task and corresponding current task with same ID."""
    task_id = str(uuid4())
    
    # Generate baseline task
    baseline_start = draw(date_strategy(min_days_from_now=-180, max_days_from_now=0))
    baseline_duration = draw(st.integers(min_value=1, max_value=90))
    baseline_end = baseline_start + timedelta(days=baseline_duration)
    baseline_progress = draw(st.integers(min_value=0, max_value=100))
    baseline_effort = draw(st.floats(min_value=1.0, max_value=500.0, allow_nan=False, allow_infinity=False))
    
    baseline_task = {
        "id": task_id,
        "name": f"Task-{task_id[:8]}",
        "wbs_code": f"1.{draw(st.integers(min_value=1, max_value=99))}",
        "planned_start_date": baseline_start.isoformat(),
        "planned_end_date": baseline_end.isoformat(),
        "duration_days": baseline_duration,
        "progress_percentage": baseline_progress,
        "planned_effort_hours": round(baseline_effort, 2),
        "is_critical": draw(st.booleans())
    }
    
    # Generate current task with potential variance
    start_variance = draw(st.integers(min_value=-30, max_value=30))
    duration_variance = draw(st.integers(min_value=-20, max_value=20))
    
    current_start = baseline_start + timedelta(days=start_variance)
    current_duration = max(1, baseline_duration + duration_variance)
    current_end = current_start + timedelta(days=current_duration)
    current_progress = draw(st.integers(min_value=0, max_value=100))
    
    current_task = {
        "id": task_id,
        "name": baseline_task["name"],
        "wbs_code": baseline_task["wbs_code"],
        "planned_start_date": current_start.isoformat(),
        "planned_end_date": current_end.isoformat(),
        "duration_days": current_duration,
        "progress_percentage": current_progress,
        "planned_effort_hours": baseline_task["planned_effort_hours"],
        "is_critical": baseline_task["is_critical"]
    }
    
    return baseline_task, current_task


@st.composite
def schedule_strategy(draw):
    """Generate a schedule with valid data."""
    start_date = draw(date_strategy(min_days_from_now=-180, max_days_from_now=0))
    duration = draw(st.integers(min_value=30, max_value=365))
    end_date = start_date + timedelta(days=duration)
    
    return {
        "id": str(uuid4()),
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat()
    }


@st.composite
def schedule_pair_strategy(draw):
    """Generate a baseline schedule and corresponding current schedule."""
    schedule_id = str(uuid4())
    
    baseline_start = draw(date_strategy(min_days_from_now=-180, max_days_from_now=0))
    baseline_duration = draw(st.integers(min_value=30, max_value=365))
    baseline_end = baseline_start + timedelta(days=baseline_duration)
    
    baseline_schedule = {
        "id": schedule_id,
        "start_date": baseline_start.isoformat(),
        "end_date": baseline_end.isoformat()
    }
    
    # Generate current schedule with potential variance
    start_variance = draw(st.integers(min_value=-30, max_value=30))
    end_variance = draw(st.integers(min_value=-30, max_value=30))
    
    current_start = baseline_start + timedelta(days=start_variance)
    current_end = baseline_end + timedelta(days=end_variance)
    
    # Ensure end is after start
    if current_end <= current_start:
        current_end = current_start + timedelta(days=30)
    
    current_schedule = {
        "id": schedule_id,
        "start_date": current_start.isoformat(),
        "end_date": current_end.isoformat()
    }
    
    return baseline_schedule, current_schedule


@st.composite
def baseline_data_strategy(draw):
    """Generate baseline creation data."""
    return {
        "baseline_name": f"Baseline-{draw(st.integers(min_value=1, max_value=100))}",
        "baseline_date": draw(date_strategy(min_days_from_now=-90, max_days_from_now=0)),
        "description": f"Test baseline {draw(st.text(min_size=0, max_size=50, alphabet=st.characters(whitelist_categories=('L', 'N', 'P', 'Z'))))}",
        "created_by": str(uuid4())
    }


class TestBaselineVarianceCalculationProperties:
    """
    Property-based tests for Property 12: Baseline Variance Calculation.
    
    For any established baseline, schedule variance calculations should be
    mathematically correct for individual tasks and overall project.
    
    **Validates: Requirements 7.1, 7.2, 7.5**
    """
    
    def setup_method(self):
        """Set up test environment."""
        self.calculator = BaselineVarianceCalculator()
    
    @given(task_pair_strategy())
    @settings(max_examples=100)
    def test_property_12_task_variance_mathematical_correctness(
        self, 
        task_pair: tuple
    ):
        """
        Property 12.1: Task Variance Mathematical Correctness
        
        For any task, the variance calculation should match the mathematical
        formula: variance = current_value - baseline_value
        
        **Feature: integrated-master-schedule, Property 12: Baseline Variance Calculation**
        **Validates: Requirements 7.1, 7.2**
        """
        baseline_task, current_task = task_pair
        
        variance = self.calculator.calculate_task_variance(baseline_task, current_task)
        
        # Verify start variance
        baseline_start = date.fromisoformat(baseline_task["planned_start_date"])
        current_start = date.fromisoformat(current_task["planned_start_date"])
        expected_start_variance = (current_start - baseline_start).days
        
        assert variance["start_variance_days"] == expected_start_variance, \
            f"Start variance {variance['start_variance_days']} should equal {expected_start_variance}"
        
        # Verify end variance
        baseline_end = date.fromisoformat(baseline_task["planned_end_date"])
        current_end = date.fromisoformat(current_task["planned_end_date"])
        expected_end_variance = (current_end - baseline_end).days
        
        assert variance["end_variance_days"] == expected_end_variance, \
            f"End variance {variance['end_variance_days']} should equal {expected_end_variance}"
        
        # Verify duration variance
        expected_duration_variance = current_task["duration_days"] - baseline_task["duration_days"]
        
        assert variance["duration_variance_days"] == expected_duration_variance, \
            f"Duration variance {variance['duration_variance_days']} should equal {expected_duration_variance}"
        
        # Verify progress variance
        expected_progress_variance = current_task["progress_percentage"] - baseline_task["progress_percentage"]
        
        assert variance["progress_variance"] == expected_progress_variance, \
            f"Progress variance {variance['progress_variance']} should equal {expected_progress_variance}"
    
    @given(task_pair_strategy())
    @settings(max_examples=100)
    def test_property_12_zero_variance_when_unchanged(self, task_pair: tuple):
        """
        Property 12.2: Zero Variance When Unchanged
        
        When current task data matches baseline exactly, all variances should be zero.
        
        **Feature: integrated-master-schedule, Property 12: Baseline Variance Calculation**
        **Validates: Requirements 7.2**
        """
        baseline_task, _ = task_pair
        
        # Use baseline as both baseline and current (no changes)
        variance = self.calculator.calculate_task_variance(baseline_task, baseline_task)
        
        assert variance["start_variance_days"] == 0, "Start variance should be 0 when unchanged"
        assert variance["end_variance_days"] == 0, "End variance should be 0 when unchanged"
        assert variance["duration_variance_days"] == 0, "Duration variance should be 0 when unchanged"
        assert variance["progress_variance"] == 0, "Progress variance should be 0 when unchanged"
    
    @given(task_pair_strategy())
    @settings(max_examples=100)
    def test_property_12_positive_variance_indicates_delay(self, task_pair: tuple):
        """
        Property 12.3: Positive Variance Indicates Delay
        
        A positive end variance should indicate the task is behind schedule.
        
        **Feature: integrated-master-schedule, Property 12: Baseline Variance Calculation**
        **Validates: Requirements 7.2, 7.5**
        """
        baseline_task, current_task = task_pair
        
        variance = self.calculator.calculate_task_variance(baseline_task, current_task)
        
        baseline_end = date.fromisoformat(baseline_task["planned_end_date"])
        current_end = date.fromisoformat(current_task["planned_end_date"])
        
        if current_end > baseline_end:
            assert variance["end_variance_days"] > 0, \
                "Positive end variance should indicate task is behind schedule"
        elif current_end < baseline_end:
            assert variance["end_variance_days"] < 0, \
                "Negative end variance should indicate task is ahead of schedule"
        else:
            assert variance["end_variance_days"] == 0, \
                "Zero end variance should indicate task is on schedule"
    
    @given(st.lists(task_pair_strategy(), min_size=1, max_size=10), schedule_pair_strategy())
    @settings(max_examples=100)
    def test_property_12_summary_counts_are_consistent(
        self, 
        task_pairs: List[tuple],
        schedule_pair: tuple
    ):
        """
        Property 12.4: Summary Counts Are Consistent
        
        The sum of tasks ahead, behind, and on schedule should equal total tasks analyzed.
        
        **Feature: integrated-master-schedule, Property 12: Baseline Variance Calculation**
        **Validates: Requirements 7.2, 7.5**
        """
        baseline_schedule, current_schedule = schedule_pair
        baseline_tasks = [pair[0] for pair in task_pairs]
        current_tasks = [pair[1] for pair in task_pairs]
        
        result = self.calculator.calculate_schedule_variance(
            baseline_schedule, current_schedule, baseline_tasks, current_tasks
        )
        
        summary = result["summary"]
        
        total_categorized = (
            summary["tasks_ahead_of_schedule"] +
            summary["tasks_behind_schedule"] +
            summary["tasks_on_schedule"]
        )
        
        assert total_categorized == summary["total_tasks_analyzed"], \
            f"Sum of categories {total_categorized} should equal total {summary['total_tasks_analyzed']}"
    
    @given(st.lists(task_pair_strategy(), min_size=1, max_size=10), schedule_pair_strategy())
    @settings(max_examples=100)
    def test_property_12_spi_bounds(
        self, 
        task_pairs: List[tuple],
        schedule_pair: tuple
    ):
        """
        Property 12.5: SPI Bounds
        
        Schedule Performance Index should be non-negative.
        
        **Feature: integrated-master-schedule, Property 12: Baseline Variance Calculation**
        **Validates: Requirements 7.5**
        """
        baseline_schedule, current_schedule = schedule_pair
        baseline_tasks = [pair[0] for pair in task_pairs]
        current_tasks = [pair[1] for pair in task_pairs]
        
        result = self.calculator.calculate_schedule_variance(
            baseline_schedule, current_schedule, baseline_tasks, current_tasks
        )
        
        spi = result["schedule_variance"]["schedule_performance_index"]
        
        assert spi >= 0, f"SPI {spi} should be non-negative"
        assert spi <= 2.0, f"SPI {spi} should be reasonable (<=2.0 for most cases)"
    
    @given(st.lists(task_pair_strategy(), min_size=1, max_size=10), schedule_pair_strategy())
    @settings(max_examples=100)
    def test_property_12_spi_equals_one_when_on_track(
        self, 
        task_pairs: List[tuple],
        schedule_pair: tuple
    ):
        """
        Property 12.6: SPI Equals One When On Track
        
        When all tasks have progress matching their baseline effort proportion,
        SPI should be close to 1.0.
        
        **Feature: integrated-master-schedule, Property 12: Baseline Variance Calculation**
        **Validates: Requirements 7.5**
        """
        baseline_schedule, current_schedule = schedule_pair
        baseline_tasks = [pair[0] for pair in task_pairs]
        
        # Set current tasks to have 100% progress (fully earned)
        current_tasks = []
        for baseline_task in baseline_tasks:
            current_task = baseline_task.copy()
            current_task["progress_percentage"] = 100
            current_tasks.append(current_task)
        
        spi = self.calculator.calculate_schedule_performance_index(current_tasks, baseline_tasks)
        
        assert abs(spi - 1.0) < 0.01, f"SPI {spi} should be 1.0 when all tasks are 100% complete"
    
    @given(st.lists(task_pair_strategy(), min_size=1, max_size=10), schedule_pair_strategy())
    @settings(max_examples=100)
    def test_property_12_variance_calculation_is_deterministic(
        self, 
        task_pairs: List[tuple],
        schedule_pair: tuple
    ):
        """
        Property 12.7: Variance Calculation Is Deterministic
        
        The same inputs should always produce the same variance results.
        
        **Feature: integrated-master-schedule, Property 12: Baseline Variance Calculation**
        **Validates: Requirements 7.2**
        """
        baseline_schedule, current_schedule = schedule_pair
        baseline_tasks = [pair[0] for pair in task_pairs]
        current_tasks = [pair[1] for pair in task_pairs]
        
        result1 = self.calculator.calculate_schedule_variance(
            baseline_schedule, current_schedule, baseline_tasks, current_tasks
        )
        result2 = self.calculator.calculate_schedule_variance(
            baseline_schedule, current_schedule, baseline_tasks, current_tasks
        )
        
        assert result1["schedule_variance"] == result2["schedule_variance"], \
            "Variance calculation should be deterministic"
        assert result1["summary"] == result2["summary"], \
            "Summary calculation should be deterministic"


class TestBaselineVersionManagementProperties:
    """
    Property-based tests for Property 13: Baseline Version Management.
    
    For any baseline versioning operation, multiple baseline versions should be
    maintained correctly with proper approval workflow.
    
    **Validates: Requirements 7.1, 7.4**
    """
    
    def setup_method(self):
        """Set up test environment."""
        self.manager = BaselineVersionManager()
    
    @given(baseline_data_strategy())
    @settings(max_examples=100)
    def test_property_13_baseline_creation_assigns_unique_id(
        self, 
        baseline_data: Dict[str, Any]
    ):
        """
        Property 13.1: Baseline Creation Assigns Unique ID
        
        Each created baseline should have a unique identifier.
        
        **Feature: integrated-master-schedule, Property 13: Baseline Version Management**
        **Validates: Requirements 7.1**
        """
        schedule_id = str(uuid4())
        
        baseline1 = self.manager.create_baseline(
            schedule_id=schedule_id,
            baseline_name=baseline_data["baseline_name"],
            baseline_date=baseline_data["baseline_date"],
            baseline_data={"snapshot": {}},
            created_by=baseline_data["created_by"]
        )
        
        baseline2 = self.manager.create_baseline(
            schedule_id=schedule_id,
            baseline_name=f"{baseline_data['baseline_name']}-2",
            baseline_date=baseline_data["baseline_date"],
            baseline_data={"snapshot": {}},
            created_by=baseline_data["created_by"]
        )
        
        assert baseline1["id"] != baseline2["id"], \
            "Each baseline should have a unique ID"
    
    @given(st.lists(baseline_data_strategy(), min_size=1, max_size=5))
    @settings(max_examples=100)
    def test_property_13_multiple_versions_maintained(
        self, 
        baseline_data_list: List[Dict[str, Any]]
    ):
        """
        Property 13.2: Multiple Versions Maintained
        
        Multiple baseline versions for the same schedule should all be maintained.
        
        **Feature: integrated-master-schedule, Property 13: Baseline Version Management**
        **Validates: Requirements 7.4**
        """
        manager = BaselineVersionManager()
        schedule_id = str(uuid4())
        
        created_baselines = []
        for i, baseline_data in enumerate(baseline_data_list):
            baseline = manager.create_baseline(
                schedule_id=schedule_id,
                baseline_name=f"{baseline_data['baseline_name']}-{i}",
                baseline_date=baseline_data["baseline_date"],
                baseline_data={"snapshot": {"version": i}},
                created_by=baseline_data["created_by"]
            )
            created_baselines.append(baseline)
        
        versions = manager.get_baseline_versions(schedule_id)
        
        assert len(versions) == len(baseline_data_list), \
            f"Should maintain {len(baseline_data_list)} versions, got {len(versions)}"
        
        # Verify all created baselines are in versions
        created_ids = {b["id"] for b in created_baselines}
        version_ids = {v["id"] for v in versions}
        
        assert created_ids == version_ids, \
            "All created baselines should be retrievable"
    
    @given(baseline_data_strategy())
    @settings(max_examples=100)
    def test_property_13_new_baseline_not_approved_by_default(
        self, 
        baseline_data: Dict[str, Any]
    ):
        """
        Property 13.3: New Baseline Not Approved By Default
        
        A newly created baseline should not be approved by default.
        
        **Feature: integrated-master-schedule, Property 13: Baseline Version Management**
        **Validates: Requirements 7.4**
        """
        manager = BaselineVersionManager()
        schedule_id = str(uuid4())
        
        baseline = manager.create_baseline(
            schedule_id=schedule_id,
            baseline_name=baseline_data["baseline_name"],
            baseline_date=baseline_data["baseline_date"],
            baseline_data={"snapshot": {}},
            created_by=baseline_data["created_by"]
        )
        
        assert baseline["is_approved"] is False, \
            "New baseline should not be approved by default"
        assert baseline["approved_by"] is None, \
            "New baseline should not have approver"
        assert baseline["approved_at"] is None, \
            "New baseline should not have approval timestamp"
    
    @given(baseline_data_strategy())
    @settings(max_examples=100)
    def test_property_13_approval_sets_correct_fields(
        self, 
        baseline_data: Dict[str, Any]
    ):
        """
        Property 13.4: Approval Sets Correct Fields
        
        Approving a baseline should set is_approved, approved_by, and approved_at.
        
        **Feature: integrated-master-schedule, Property 13: Baseline Version Management**
        **Validates: Requirements 7.4**
        """
        manager = BaselineVersionManager()
        schedule_id = str(uuid4())
        approver_id = str(uuid4())
        
        baseline = manager.create_baseline(
            schedule_id=schedule_id,
            baseline_name=baseline_data["baseline_name"],
            baseline_date=baseline_data["baseline_date"],
            baseline_data={"snapshot": {}},
            created_by=baseline_data["created_by"]
        )
        
        approved_baseline = manager.approve_baseline(baseline["id"], approver_id)
        
        assert approved_baseline["is_approved"] is True, \
            "Approved baseline should have is_approved=True"
        assert approved_baseline["approved_by"] == approver_id, \
            "Approved baseline should have correct approver"
        assert approved_baseline["approved_at"] is not None, \
            "Approved baseline should have approval timestamp"
    
    @given(st.lists(baseline_data_strategy(), min_size=2, max_size=5))
    @settings(max_examples=100)
    def test_property_13_latest_approved_baseline_retrieval(
        self, 
        baseline_data_list: List[Dict[str, Any]]
    ):
        """
        Property 13.5: Latest Approved Baseline Retrieval
        
        get_latest_approved_baseline should return the most recently created
        approved baseline.
        
        **Feature: integrated-master-schedule, Property 13: Baseline Version Management**
        **Validates: Requirements 7.4**
        """
        manager = BaselineVersionManager()
        schedule_id = str(uuid4())
        approver_id = str(uuid4())
        
        # Create multiple baselines
        baselines = []
        for i, baseline_data in enumerate(baseline_data_list):
            baseline = manager.create_baseline(
                schedule_id=schedule_id,
                baseline_name=f"{baseline_data['baseline_name']}-{i}",
                baseline_date=baseline_data["baseline_date"],
                baseline_data={"snapshot": {"version": i}},
                created_by=baseline_data["created_by"]
            )
            baselines.append(baseline)
        
        # Approve only the last one
        last_baseline = baselines[-1]
        manager.approve_baseline(last_baseline["id"], approver_id)
        
        latest_approved = manager.get_latest_approved_baseline(schedule_id)
        
        assert latest_approved is not None, \
            "Should find an approved baseline"
        assert latest_approved["id"] == last_baseline["id"], \
            "Should return the approved baseline"
    
    @given(baseline_data_strategy())
    @settings(max_examples=100)
    def test_property_13_unapproved_baseline_can_be_deleted(
        self, 
        baseline_data: Dict[str, Any]
    ):
        """
        Property 13.6: Unapproved Baseline Can Be Deleted
        
        An unapproved baseline should be deletable.
        
        **Feature: integrated-master-schedule, Property 13: Baseline Version Management**
        **Validates: Requirements 7.4**
        """
        manager = BaselineVersionManager()
        schedule_id = str(uuid4())
        
        baseline = manager.create_baseline(
            schedule_id=schedule_id,
            baseline_name=baseline_data["baseline_name"],
            baseline_date=baseline_data["baseline_date"],
            baseline_data={"snapshot": {}},
            created_by=baseline_data["created_by"]
        )
        
        result = manager.delete_baseline(baseline["id"])
        
        assert result is True, "Unapproved baseline should be deletable"
        
        versions = manager.get_baseline_versions(schedule_id)
        assert len(versions) == 0, "Deleted baseline should not appear in versions"
    
    @given(baseline_data_strategy())
    @settings(max_examples=100)
    def test_property_13_approved_baseline_cannot_be_deleted(
        self, 
        baseline_data: Dict[str, Any]
    ):
        """
        Property 13.7: Approved Baseline Cannot Be Deleted
        
        An approved baseline should not be deletable.
        
        **Feature: integrated-master-schedule, Property 13: Baseline Version Management**
        **Validates: Requirements 7.4**
        """
        manager = BaselineVersionManager()
        schedule_id = str(uuid4())
        approver_id = str(uuid4())
        
        baseline = manager.create_baseline(
            schedule_id=schedule_id,
            baseline_name=baseline_data["baseline_name"],
            baseline_date=baseline_data["baseline_date"],
            baseline_data={"snapshot": {}},
            created_by=baseline_data["created_by"]
        )
        
        manager.approve_baseline(baseline["id"], approver_id)
        
        result = manager.delete_baseline(baseline["id"])
        
        assert result is False, "Approved baseline should not be deletable"
        
        versions = manager.get_baseline_versions(schedule_id)
        assert len(versions) == 1, "Approved baseline should still exist"
    
    @given(st.lists(baseline_data_strategy(), min_size=2, max_size=5))
    @settings(max_examples=100)
    def test_property_13_versions_sorted_by_creation_date(
        self, 
        baseline_data_list: List[Dict[str, Any]]
    ):
        """
        Property 13.8: Versions Sorted By Creation Date
        
        get_baseline_versions should return baselines sorted by creation date
        (newest first).
        
        **Feature: integrated-master-schedule, Property 13: Baseline Version Management**
        **Validates: Requirements 7.4**
        """
        manager = BaselineVersionManager()
        schedule_id = str(uuid4())
        
        for i, baseline_data in enumerate(baseline_data_list):
            manager.create_baseline(
                schedule_id=schedule_id,
                baseline_name=f"{baseline_data['baseline_name']}-{i}",
                baseline_date=baseline_data["baseline_date"],
                baseline_data={"snapshot": {"version": i}},
                created_by=baseline_data["created_by"]
            )
        
        versions = manager.get_baseline_versions(schedule_id)
        
        # Verify sorted by created_at descending
        for i in range(len(versions) - 1):
            assert versions[i]["created_at"] >= versions[i + 1]["created_at"], \
                "Versions should be sorted by creation date (newest first)"
    
    @given(baseline_data_strategy())
    @settings(max_examples=100)
    def test_property_13_baseline_data_preserved(
        self, 
        baseline_data: Dict[str, Any]
    ):
        """
        Property 13.9: Baseline Data Preserved
        
        The baseline snapshot data should be preserved exactly as provided.
        
        **Feature: integrated-master-schedule, Property 13: Baseline Version Management**
        **Validates: Requirements 7.1**
        """
        manager = BaselineVersionManager()
        schedule_id = str(uuid4())
        
        snapshot_data = {
            "snapshot": {
                "tasks": [{"id": "task1", "name": "Test Task"}],
                "schedule": {"start_date": "2025-01-01"}
            }
        }
        
        baseline = manager.create_baseline(
            schedule_id=schedule_id,
            baseline_name=baseline_data["baseline_name"],
            baseline_date=baseline_data["baseline_date"],
            baseline_data=snapshot_data,
            created_by=baseline_data["created_by"]
        )
        
        assert baseline["baseline_data"] == snapshot_data, \
            "Baseline data should be preserved exactly"
    
    def test_property_13_no_baselines_returns_empty_list(self):
        """
        Property 13.10: No Baselines Returns Empty List
        
        get_baseline_versions for a schedule with no baselines should return
        an empty list.
        
        **Feature: integrated-master-schedule, Property 13: Baseline Version Management**
        **Validates: Requirements 7.4**
        """
        manager = BaselineVersionManager()
        schedule_id = str(uuid4())
        
        versions = manager.get_baseline_versions(schedule_id)
        
        assert versions == [], "Should return empty list for schedule with no baselines"
    
    def test_property_13_no_approved_baseline_returns_none(self):
        """
        Property 13.11: No Approved Baseline Returns None
        
        get_latest_approved_baseline for a schedule with no approved baselines
        should return None.
        
        **Feature: integrated-master-schedule, Property 13: Baseline Version Management**
        **Validates: Requirements 7.4**
        """
        manager = BaselineVersionManager()
        schedule_id = str(uuid4())
        
        # Create unapproved baseline
        manager.create_baseline(
            schedule_id=schedule_id,
            baseline_name="Test Baseline",
            baseline_date=date.today(),
            baseline_data={"snapshot": {}},
            created_by=str(uuid4())
        )
        
        latest_approved = manager.get_latest_approved_baseline(schedule_id)
        
        assert latest_approved is None, \
            "Should return None when no approved baselines exist"


def run_property_tests():
    """Run all property-based tests."""
    print("🚀 Running Baseline Management Property Tests")
    print("=" * 60)
    print("Property 12: Baseline Variance Calculation")
    print("Property 13: Baseline Version Management")
    print("Validates: Requirements 7.1, 7.2, 7.4, 7.5")
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
        print("\n🎉 All baseline management property tests passed!")
    else:
        print("\n❌ Some property tests failed.")
    
    sys.exit(0 if success else 1)
