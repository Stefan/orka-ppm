"""
Property-based tests for Milestone Status Tracking.

These tests validate Property 11: Milestone Status Tracking from the
Integrated Master Schedule System design document.

**Property 11: Milestone Status Tracking**
For any milestone with target dates, status calculations should correctly
identify on-time, at-risk, and overdue milestones.

**Validates: Requirements 6.4, 6.5**
"""

import sys
import os
import pytest
from hypothesis import given, strategies as st, settings, assume
from typing import List, Dict, Any, Optional
from uuid import uuid4, UUID
from datetime import date, datetime, timedelta
from enum import Enum

# Add the backend directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


class MilestoneStatus(str, Enum):
    """Milestone achievement status"""
    PLANNED = "planned"
    AT_RISK = "at_risk"
    ACHIEVED = "achieved"
    MISSED = "missed"


class MilestoneStatusCalculator:
    """
    Pure implementation of milestone status calculation for property testing.
    
    This mirrors the logic in MilestoneTracker but is isolated for testing
    without database dependencies.
    """
    
    @staticmethod
    def calculate_milestone_category(
        target_date: date,
        status: MilestoneStatus,
        today: date
    ) -> str:
        """
        Calculate the category of a milestone based on its target date and status.
        
        Args:
            target_date: The milestone's target date
            status: Current milestone status
            today: Reference date for calculations
            
        Returns:
            str: Category - 'achieved', 'missed', 'at_risk', 'overdue', or 'on_time'
        """
        days_to_target = (target_date - today).days
        
        if status == MilestoneStatus.ACHIEVED:
            return "achieved"
        elif status == MilestoneStatus.MISSED:
            return "missed"
        elif status == MilestoneStatus.AT_RISK:
            return "at_risk"
        elif days_to_target < 0 and status == MilestoneStatus.PLANNED:
            return "overdue"
        else:
            return "on_time"
    
    @staticmethod
    def is_milestone_at_risk(
        target_date: date,
        status: MilestoneStatus,
        today: date,
        risk_window_days: int = 14,
        linked_task_progress: Optional[int] = None,
        linked_task_end_date: Optional[date] = None,
        incomplete_deliverables_count: int = 0
    ) -> tuple[bool, List[str]]:
        """
        Determine if a milestone is at risk based on various factors.
        
        Args:
            target_date: The milestone's target date
            status: Current milestone status
            today: Reference date for calculations
            risk_window_days: Number of days ahead to consider at-risk
            linked_task_progress: Progress percentage of linked task (0-100)
            linked_task_end_date: End date of linked task
            incomplete_deliverables_count: Number of incomplete deliverables
            
        Returns:
            Tuple of (is_at_risk, risk_factors)
        """
        # Only planned milestones can be at risk
        if status != MilestoneStatus.PLANNED:
            return False, []
        
        days_to_target = (target_date - today).days
        risk_factors = []
        is_at_risk = False
        
        # Risk factor 1: Target date is within risk window
        risk_date = today + timedelta(days=risk_window_days)
        if target_date <= risk_date:
            is_at_risk = True
            risk_factors.append(f"Due in {days_to_target} days")
        
        # Risk factor 2: Linked task is behind schedule
        if linked_task_end_date and linked_task_progress is not None:
            if linked_task_end_date < today and linked_task_progress < 100:
                days_overdue = (today - linked_task_end_date).days
                is_at_risk = True
                risk_factors.append(f"Linked task is {days_overdue} days overdue")
            
            # Task progress is insufficient
            if linked_task_progress < 50 and days_to_target <= 7:
                is_at_risk = True
                risk_factors.append(f"Linked task only {linked_task_progress}% complete")
        
        # Risk factor 3: Deliverables are incomplete
        if incomplete_deliverables_count > 0 and days_to_target <= 7:
            is_at_risk = True
            risk_factors.append(f"{incomplete_deliverables_count} incomplete deliverables")
        
        return is_at_risk, risk_factors
    
    @staticmethod
    def calculate_milestone_progress(
        status: MilestoneStatus,
        deliverables: List[Dict[str, Any]]
    ) -> int:
        """
        Calculate milestone progress based on deliverables completion.
        
        Args:
            status: Current milestone status
            deliverables: List of deliverable records with 'status' field
            
        Returns:
            int: Progress percentage (0-100)
        """
        # If milestone is achieved, progress is 100%
        if status == MilestoneStatus.ACHIEVED:
            return 100
        
        # If milestone is missed, progress is 0%
        if status == MilestoneStatus.MISSED:
            return 0
        
        # Calculate based on deliverables
        if not deliverables:
            return 0
        
        completed_deliverables = sum(1 for d in deliverables if d.get("status") == "completed")
        total_deliverables = len(deliverables)
        
        return int((completed_deliverables / total_deliverables) * 100)
    
    @staticmethod
    def is_valid_status_transition(
        current_status: MilestoneStatus,
        new_status: MilestoneStatus
    ) -> bool:
        """
        Validate if a milestone status transition is allowed.
        
        Args:
            current_status: Current milestone status
            new_status: Proposed new status
            
        Returns:
            bool: True if transition is valid
        """
        valid_transitions = {
            MilestoneStatus.PLANNED: [MilestoneStatus.AT_RISK, MilestoneStatus.ACHIEVED, MilestoneStatus.MISSED],
            MilestoneStatus.AT_RISK: [MilestoneStatus.PLANNED, MilestoneStatus.ACHIEVED, MilestoneStatus.MISSED],
            MilestoneStatus.ACHIEVED: [MilestoneStatus.PLANNED],  # Allow reopening
            MilestoneStatus.MISSED: [MilestoneStatus.PLANNED, MilestoneStatus.AT_RISK]  # Allow recovery
        }
        
        return new_status in valid_transitions.get(current_status, [])
    
    @staticmethod
    def generate_status_report(
        milestones: List[Dict[str, Any]],
        today: date
    ) -> Dict[str, Any]:
        """
        Generate a milestone status report.
        
        Args:
            milestones: List of milestone records
            today: Reference date for calculations
            
        Returns:
            Dict with status report
        """
        if not milestones:
            return {
                "total_milestones": 0,
                "on_time": 0,
                "at_risk": 0,
                "overdue": 0,
                "achieved": 0,
                "missed": 0
            }
        
        status_counts = {
            "on_time": 0,
            "at_risk": 0,
            "overdue": 0,
            "achieved": 0,
            "missed": 0
        }
        
        for milestone in milestones:
            target_date = milestone["target_date"]
            status = MilestoneStatus(milestone["status"])
            
            category = MilestoneStatusCalculator.calculate_milestone_category(
                target_date, status, today
            )
            status_counts[category] += 1
        
        return {
            "total_milestones": len(milestones),
            **status_counts
        }


# Hypothesis strategies for generating test data
@st.composite
def date_strategy(draw, min_days_offset=-365, max_days_offset=365):
    """Generate a date within a range from today."""
    today = date.today()
    offset = draw(st.integers(min_value=min_days_offset, max_value=max_days_offset))
    return today + timedelta(days=offset)


@st.composite
def milestone_status_strategy(draw):
    """Generate a valid milestone status."""
    return draw(st.sampled_from(list(MilestoneStatus)))


@st.composite
def deliverable_strategy(draw):
    """Generate a single deliverable with valid status."""
    status = draw(st.sampled_from(["pending", "in_progress", "completed", "cancelled"]))
    return {
        "name": f"Deliverable-{draw(st.integers(min_value=1, max_value=1000))}",
        "status": status
    }


@st.composite
def deliverables_list_strategy(draw, min_size=0, max_size=10):
    """Generate a list of deliverables."""
    return draw(st.lists(deliverable_strategy(), min_size=min_size, max_size=max_size))


@st.composite
def milestone_strategy(draw):
    """Generate a complete milestone record."""
    target_date = draw(date_strategy())
    status = draw(milestone_status_strategy())
    deliverables = draw(deliverables_list_strategy())
    
    return {
        "id": str(uuid4()),
        "name": f"Milestone-{draw(st.integers(min_value=1, max_value=1000))}",
        "target_date": target_date,
        "status": status.value,
        "deliverables": deliverables,
        "responsible_party": str(uuid4()) if draw(st.booleans()) else None
    }


@st.composite
def milestones_list_strategy(draw, min_size=1, max_size=20):
    """Generate a list of milestones."""
    return draw(st.lists(milestone_strategy(), min_size=min_size, max_size=max_size))


class TestMilestoneStatusTrackingProperties:
    """Property-based tests for milestone status tracking."""
    
    def setup_method(self):
        """Set up test environment."""
        self.calculator = MilestoneStatusCalculator()
        self.today = date.today()
    
    @given(
        date_strategy(),
        milestone_status_strategy()
    )
    @settings(max_examples=100)
    def test_property_11_category_is_valid(
        self,
        target_date: date,
        status: MilestoneStatus
    ):
        """
        Property 11.1: Category Is Valid
        
        For any milestone, the calculated category should be one of the
        valid categories: achieved, missed, at_risk, overdue, or on_time.
        
        **Feature: integrated-master-schedule, Property 11: Milestone Status Tracking**
        **Validates: Requirements 6.4, 6.5**
        """
        category = self.calculator.calculate_milestone_category(
            target_date, status, self.today
        )
        
        valid_categories = {"achieved", "missed", "at_risk", "overdue", "on_time"}
        assert category in valid_categories, \
            f"Category '{category}' should be one of {valid_categories}"
    
    @given(date_strategy())
    @settings(max_examples=100)
    def test_property_11_achieved_status_returns_achieved_category(
        self,
        target_date: date
    ):
        """
        Property 11.2: Achieved Status Returns Achieved Category
        
        When a milestone has ACHIEVED status, the category should always
        be 'achieved' regardless of target date.
        
        **Feature: integrated-master-schedule, Property 11: Milestone Status Tracking**
        **Validates: Requirements 6.4, 6.5**
        """
        category = self.calculator.calculate_milestone_category(
            target_date, MilestoneStatus.ACHIEVED, self.today
        )
        
        assert category == "achieved", \
            f"Achieved milestone should have 'achieved' category, got '{category}'"
    
    @given(date_strategy())
    @settings(max_examples=100)
    def test_property_11_missed_status_returns_missed_category(
        self,
        target_date: date
    ):
        """
        Property 11.3: Missed Status Returns Missed Category
        
        When a milestone has MISSED status, the category should always
        be 'missed' regardless of target date.
        
        **Feature: integrated-master-schedule, Property 11: Milestone Status Tracking**
        **Validates: Requirements 6.4, 6.5**
        """
        category = self.calculator.calculate_milestone_category(
            target_date, MilestoneStatus.MISSED, self.today
        )
        
        assert category == "missed", \
            f"Missed milestone should have 'missed' category, got '{category}'"
    
    @given(date_strategy())
    @settings(max_examples=100)
    def test_property_11_at_risk_status_returns_at_risk_category(
        self,
        target_date: date
    ):
        """
        Property 11.4: At Risk Status Returns At Risk Category
        
        When a milestone has AT_RISK status, the category should always
        be 'at_risk' regardless of target date.
        
        **Feature: integrated-master-schedule, Property 11: Milestone Status Tracking**
        **Validates: Requirements 6.4, 6.5**
        """
        category = self.calculator.calculate_milestone_category(
            target_date, MilestoneStatus.AT_RISK, self.today
        )
        
        assert category == "at_risk", \
            f"At-risk milestone should have 'at_risk' category, got '{category}'"
    
    @given(st.integers(min_value=1, max_value=365))
    @settings(max_examples=100)
    def test_property_11_past_planned_milestone_is_overdue(
        self,
        days_past: int
    ):
        """
        Property 11.5: Past Planned Milestone Is Overdue
        
        When a PLANNED milestone has a target date in the past,
        the category should be 'overdue'.
        
        **Feature: integrated-master-schedule, Property 11: Milestone Status Tracking**
        **Validates: Requirements 6.4, 6.5**
        """
        past_date = self.today - timedelta(days=days_past)
        
        category = self.calculator.calculate_milestone_category(
            past_date, MilestoneStatus.PLANNED, self.today
        )
        
        assert category == "overdue", \
            f"Past planned milestone should be 'overdue', got '{category}'"
    
    @given(st.integers(min_value=1, max_value=365))
    @settings(max_examples=100)
    def test_property_11_future_planned_milestone_is_on_time(
        self,
        days_future: int
    ):
        """
        Property 11.6: Future Planned Milestone Is On Time
        
        When a PLANNED milestone has a target date in the future,
        the category should be 'on_time'.
        
        **Feature: integrated-master-schedule, Property 11: Milestone Status Tracking**
        **Validates: Requirements 6.4, 6.5**
        """
        future_date = self.today + timedelta(days=days_future)
        
        category = self.calculator.calculate_milestone_category(
            future_date, MilestoneStatus.PLANNED, self.today
        )
        
        assert category == "on_time", \
            f"Future planned milestone should be 'on_time', got '{category}'"

    @given(
        st.integers(min_value=1, max_value=14),
        st.integers(min_value=15, max_value=365)
    )
    @settings(max_examples=100)
    def test_property_11_risk_window_detection(
        self,
        days_within_window: int,
        risk_window_days: int
    ):
        """
        Property 11.7: Risk Window Detection
        
        A PLANNED milestone within the risk window should be identified
        as at-risk.
        
        **Feature: integrated-master-schedule, Property 11: Milestone Status Tracking**
        **Validates: Requirements 6.4, 6.5**
        """
        # Ensure days_within_window is less than risk_window_days
        assume(days_within_window < risk_window_days)
        
        target_date = self.today + timedelta(days=days_within_window)
        
        is_at_risk, risk_factors = self.calculator.is_milestone_at_risk(
            target_date=target_date,
            status=MilestoneStatus.PLANNED,
            today=self.today,
            risk_window_days=risk_window_days
        )
        
        assert is_at_risk, \
            f"Milestone due in {days_within_window} days should be at-risk with {risk_window_days} day window"
        assert len(risk_factors) > 0, \
            "At-risk milestone should have at least one risk factor"
    
    @given(
        st.integers(min_value=15, max_value=365),
        st.integers(min_value=1, max_value=14)
    )
    @settings(max_examples=100)
    def test_property_11_outside_risk_window_not_at_risk(
        self,
        days_outside_window: int,
        risk_window_days: int
    ):
        """
        Property 11.8: Outside Risk Window Not At Risk
        
        A PLANNED milestone outside the risk window (with no other risk factors)
        should not be identified as at-risk.
        
        **Feature: integrated-master-schedule, Property 11: Milestone Status Tracking**
        **Validates: Requirements 6.4, 6.5**
        """
        # Ensure days_outside_window is greater than risk_window_days
        assume(days_outside_window > risk_window_days)
        
        target_date = self.today + timedelta(days=days_outside_window)
        
        is_at_risk, risk_factors = self.calculator.is_milestone_at_risk(
            target_date=target_date,
            status=MilestoneStatus.PLANNED,
            today=self.today,
            risk_window_days=risk_window_days
        )
        
        assert not is_at_risk, \
            f"Milestone due in {days_outside_window} days should not be at-risk with {risk_window_days} day window"
        assert len(risk_factors) == 0, \
            "Non-at-risk milestone should have no risk factors"
    
    @given(
        st.integers(min_value=1, max_value=30),
        st.integers(min_value=0, max_value=99)
    )
    @settings(max_examples=100)
    def test_property_11_linked_task_overdue_triggers_risk(
        self,
        days_overdue: int,
        task_progress: int
    ):
        """
        Property 11.9: Linked Task Overdue Triggers Risk
        
        When a linked task is overdue and not complete, the milestone
        should be identified as at-risk.
        
        **Feature: integrated-master-schedule, Property 11: Milestone Status Tracking**
        **Validates: Requirements 6.4, 6.5**
        """
        target_date = self.today + timedelta(days=30)  # Future milestone
        linked_task_end_date = self.today - timedelta(days=days_overdue)
        
        is_at_risk, risk_factors = self.calculator.is_milestone_at_risk(
            target_date=target_date,
            status=MilestoneStatus.PLANNED,
            today=self.today,
            risk_window_days=7,  # Short window so target date doesn't trigger
            linked_task_progress=task_progress,
            linked_task_end_date=linked_task_end_date
        )
        
        assert is_at_risk, \
            f"Milestone with overdue linked task should be at-risk"
        assert any("overdue" in factor.lower() for factor in risk_factors), \
            "Risk factors should mention overdue linked task"
    
    @given(
        st.integers(min_value=1, max_value=7),
        st.integers(min_value=0, max_value=49)
    )
    @settings(max_examples=100)
    def test_property_11_low_progress_near_deadline_triggers_risk(
        self,
        days_to_target: int,
        task_progress: int
    ):
        """
        Property 11.10: Low Progress Near Deadline Triggers Risk
        
        When a linked task has low progress (<50%) and the milestone
        is due within 7 days, it should be identified as at-risk.
        
        **Feature: integrated-master-schedule, Property 11: Milestone Status Tracking**
        **Validates: Requirements 6.4, 6.5**
        """
        target_date = self.today + timedelta(days=days_to_target)
        linked_task_end_date = self.today + timedelta(days=days_to_target + 1)  # Not overdue
        
        is_at_risk, risk_factors = self.calculator.is_milestone_at_risk(
            target_date=target_date,
            status=MilestoneStatus.PLANNED,
            today=self.today,
            risk_window_days=0,  # Disable window risk
            linked_task_progress=task_progress,
            linked_task_end_date=linked_task_end_date
        )
        
        assert is_at_risk, \
            f"Milestone with {task_progress}% progress due in {days_to_target} days should be at-risk"
        assert any("complete" in factor.lower() for factor in risk_factors), \
            "Risk factors should mention incomplete task"
    
    @given(
        st.integers(min_value=1, max_value=7),
        st.integers(min_value=1, max_value=10)
    )
    @settings(max_examples=100)
    def test_property_11_incomplete_deliverables_near_deadline_triggers_risk(
        self,
        days_to_target: int,
        incomplete_count: int
    ):
        """
        Property 11.11: Incomplete Deliverables Near Deadline Triggers Risk
        
        When there are incomplete deliverables and the milestone is due
        within 7 days, it should be identified as at-risk.
        
        **Feature: integrated-master-schedule, Property 11: Milestone Status Tracking**
        **Validates: Requirements 6.4, 6.5**
        """
        target_date = self.today + timedelta(days=days_to_target)
        
        is_at_risk, risk_factors = self.calculator.is_milestone_at_risk(
            target_date=target_date,
            status=MilestoneStatus.PLANNED,
            today=self.today,
            risk_window_days=0,  # Disable window risk
            incomplete_deliverables_count=incomplete_count
        )
        
        assert is_at_risk, \
            f"Milestone with {incomplete_count} incomplete deliverables due in {days_to_target} days should be at-risk"
        assert any("deliverable" in factor.lower() for factor in risk_factors), \
            "Risk factors should mention incomplete deliverables"
    
    @given(milestone_status_strategy())
    @settings(max_examples=100)
    def test_property_11_non_planned_milestone_not_at_risk(
        self,
        status: MilestoneStatus
    ):
        """
        Property 11.12: Non-Planned Milestone Not At Risk
        
        Only PLANNED milestones can be identified as at-risk.
        Achieved, missed, or already at-risk milestones should not
        be flagged as at-risk by the risk detection.
        
        **Feature: integrated-master-schedule, Property 11: Milestone Status Tracking**
        **Validates: Requirements 6.4, 6.5**
        """
        assume(status != MilestoneStatus.PLANNED)
        
        target_date = self.today + timedelta(days=1)  # Very close deadline
        
        is_at_risk, risk_factors = self.calculator.is_milestone_at_risk(
            target_date=target_date,
            status=status,
            today=self.today,
            risk_window_days=30,  # Large window
            incomplete_deliverables_count=5  # Many incomplete
        )
        
        assert not is_at_risk, \
            f"Non-planned milestone with status {status.value} should not be flagged as at-risk"
        assert len(risk_factors) == 0, \
            "Non-planned milestone should have no risk factors"
    
    @given(deliverables_list_strategy(min_size=1, max_size=10))
    @settings(max_examples=100)
    def test_property_11_progress_bounds(
        self,
        deliverables: List[Dict[str, Any]]
    ):
        """
        Property 11.13: Progress Bounds
        
        Milestone progress should always be between 0 and 100 (inclusive).
        
        **Feature: integrated-master-schedule, Property 11: Milestone Status Tracking**
        **Validates: Requirements 6.4, 6.5**
        """
        progress = self.calculator.calculate_milestone_progress(
            MilestoneStatus.PLANNED, deliverables
        )
        
        assert 0 <= progress <= 100, \
            f"Progress {progress} should be between 0 and 100"
    
    @given(deliverables_list_strategy(min_size=0, max_size=10))
    @settings(max_examples=100)
    def test_property_11_achieved_milestone_has_100_progress(
        self,
        deliverables: List[Dict[str, Any]]
    ):
        """
        Property 11.14: Achieved Milestone Has 100% Progress
        
        An achieved milestone should always have 100% progress
        regardless of deliverables.
        
        **Feature: integrated-master-schedule, Property 11: Milestone Status Tracking**
        **Validates: Requirements 6.4, 6.5**
        """
        progress = self.calculator.calculate_milestone_progress(
            MilestoneStatus.ACHIEVED, deliverables
        )
        
        assert progress == 100, \
            f"Achieved milestone should have 100% progress, got {progress}%"
    
    @given(deliverables_list_strategy(min_size=0, max_size=10))
    @settings(max_examples=100)
    def test_property_11_missed_milestone_has_0_progress(
        self,
        deliverables: List[Dict[str, Any]]
    ):
        """
        Property 11.15: Missed Milestone Has 0% Progress
        
        A missed milestone should always have 0% progress
        regardless of deliverables.
        
        **Feature: integrated-master-schedule, Property 11: Milestone Status Tracking**
        **Validates: Requirements 6.4, 6.5**
        """
        progress = self.calculator.calculate_milestone_progress(
            MilestoneStatus.MISSED, deliverables
        )
        
        assert progress == 0, \
            f"Missed milestone should have 0% progress, got {progress}%"
    
    @given(st.integers(min_value=1, max_value=20))
    @settings(max_examples=100)
    def test_property_11_all_completed_deliverables_gives_100_progress(
        self,
        num_deliverables: int
    ):
        """
        Property 11.16: All Completed Deliverables Gives 100% Progress
        
        When all deliverables are completed, progress should be 100%.
        
        **Feature: integrated-master-schedule, Property 11: Milestone Status Tracking**
        **Validates: Requirements 6.4, 6.5**
        """
        deliverables = [
            {"name": f"Deliverable-{i}", "status": "completed"}
            for i in range(num_deliverables)
        ]
        
        progress = self.calculator.calculate_milestone_progress(
            MilestoneStatus.PLANNED, deliverables
        )
        
        assert progress == 100, \
            f"All completed deliverables should give 100% progress, got {progress}%"
    
    @given(st.integers(min_value=1, max_value=20))
    @settings(max_examples=100)
    def test_property_11_no_completed_deliverables_gives_0_progress(
        self,
        num_deliverables: int
    ):
        """
        Property 11.17: No Completed Deliverables Gives 0% Progress
        
        When no deliverables are completed, progress should be 0%.
        
        **Feature: integrated-master-schedule, Property 11: Milestone Status Tracking**
        **Validates: Requirements 6.4, 6.5**
        """
        deliverables = [
            {"name": f"Deliverable-{i}", "status": "pending"}
            for i in range(num_deliverables)
        ]
        
        progress = self.calculator.calculate_milestone_progress(
            MilestoneStatus.PLANNED, deliverables
        )
        
        assert progress == 0, \
            f"No completed deliverables should give 0% progress, got {progress}%"
    
    def test_property_11_empty_deliverables_gives_0_progress(self):
        """
        Property 11.18: Empty Deliverables Gives 0% Progress
        
        When there are no deliverables, progress should be 0%.
        
        **Feature: integrated-master-schedule, Property 11: Milestone Status Tracking**
        **Validates: Requirements 6.4, 6.5**
        """
        progress = self.calculator.calculate_milestone_progress(
            MilestoneStatus.PLANNED, []
        )
        
        assert progress == 0, \
            f"Empty deliverables should give 0% progress, got {progress}%"

    @given(
        st.integers(min_value=1, max_value=10),
        st.integers(min_value=1, max_value=10)
    )
    @settings(max_examples=100)
    def test_property_11_progress_proportional_to_completed_deliverables(
        self,
        completed_count: int,
        pending_count: int
    ):
        """
        Property 11.19: Progress Proportional to Completed Deliverables
        
        Progress should be proportional to the ratio of completed deliverables.
        
        **Feature: integrated-master-schedule, Property 11: Milestone Status Tracking**
        **Validates: Requirements 6.4, 6.5**
        """
        deliverables = [
            {"name": f"Completed-{i}", "status": "completed"}
            for i in range(completed_count)
        ] + [
            {"name": f"Pending-{i}", "status": "pending"}
            for i in range(pending_count)
        ]
        
        progress = self.calculator.calculate_milestone_progress(
            MilestoneStatus.PLANNED, deliverables
        )
        
        expected_progress = int((completed_count / (completed_count + pending_count)) * 100)
        
        assert progress == expected_progress, \
            f"Progress should be {expected_progress}%, got {progress}%"
    
    @given(milestones_list_strategy(min_size=1, max_size=20))
    @settings(max_examples=100)
    def test_property_11_status_report_counts_sum_to_total(
        self,
        milestones: List[Dict[str, Any]]
    ):
        """
        Property 11.20: Status Report Counts Sum to Total
        
        The sum of all category counts in the status report should
        equal the total number of milestones.
        
        **Feature: integrated-master-schedule, Property 11: Milestone Status Tracking**
        **Validates: Requirements 6.4, 6.5**
        """
        report = self.calculator.generate_status_report(milestones, self.today)
        
        category_sum = (
            report["on_time"] +
            report["at_risk"] +
            report["overdue"] +
            report["achieved"] +
            report["missed"]
        )
        
        assert category_sum == report["total_milestones"], \
            f"Category sum {category_sum} should equal total {report['total_milestones']}"
    
    @given(milestones_list_strategy(min_size=1, max_size=20))
    @settings(max_examples=100)
    def test_property_11_status_report_counts_non_negative(
        self,
        milestones: List[Dict[str, Any]]
    ):
        """
        Property 11.21: Status Report Counts Non-Negative
        
        All category counts in the status report should be non-negative.
        
        **Feature: integrated-master-schedule, Property 11: Milestone Status Tracking**
        **Validates: Requirements 6.4, 6.5**
        """
        report = self.calculator.generate_status_report(milestones, self.today)
        
        assert report["total_milestones"] >= 0
        assert report["on_time"] >= 0
        assert report["at_risk"] >= 0
        assert report["overdue"] >= 0
        assert report["achieved"] >= 0
        assert report["missed"] >= 0
    
    def test_property_11_empty_milestones_report(self):
        """
        Property 11.22: Empty Milestones Report
        
        An empty milestone list should produce a report with all zeros.
        
        **Feature: integrated-master-schedule, Property 11: Milestone Status Tracking**
        **Validates: Requirements 6.4, 6.5**
        """
        report = self.calculator.generate_status_report([], self.today)
        
        assert report["total_milestones"] == 0
        assert report["on_time"] == 0
        assert report["at_risk"] == 0
        assert report["overdue"] == 0
        assert report["achieved"] == 0
        assert report["missed"] == 0
    
    @given(
        milestone_status_strategy(),
        milestone_status_strategy()
    )
    @settings(max_examples=100)
    def test_property_11_status_transition_validation_is_deterministic(
        self,
        current_status: MilestoneStatus,
        new_status: MilestoneStatus
    ):
        """
        Property 11.23: Status Transition Validation Is Deterministic
        
        The same status transition should always produce the same result.
        
        **Feature: integrated-master-schedule, Property 11: Milestone Status Tracking**
        **Validates: Requirements 6.4, 6.5**
        """
        result1 = self.calculator.is_valid_status_transition(current_status, new_status)
        result2 = self.calculator.is_valid_status_transition(current_status, new_status)
        result3 = self.calculator.is_valid_status_transition(current_status, new_status)
        
        assert result1 == result2 == result3, \
            "Status transition validation should be deterministic"
    
    def test_property_11_planned_can_transition_to_achieved(self):
        """
        Property 11.24: Planned Can Transition to Achieved
        
        A PLANNED milestone should be able to transition to ACHIEVED.
        
        **Feature: integrated-master-schedule, Property 11: Milestone Status Tracking**
        **Validates: Requirements 6.4, 6.5**
        """
        is_valid = self.calculator.is_valid_status_transition(
            MilestoneStatus.PLANNED, MilestoneStatus.ACHIEVED
        )
        
        assert is_valid, "PLANNED should be able to transition to ACHIEVED"
    
    def test_property_11_planned_can_transition_to_missed(self):
        """
        Property 11.25: Planned Can Transition to Missed
        
        A PLANNED milestone should be able to transition to MISSED.
        
        **Feature: integrated-master-schedule, Property 11: Milestone Status Tracking**
        **Validates: Requirements 6.4, 6.5**
        """
        is_valid = self.calculator.is_valid_status_transition(
            MilestoneStatus.PLANNED, MilestoneStatus.MISSED
        )
        
        assert is_valid, "PLANNED should be able to transition to MISSED"
    
    def test_property_11_planned_can_transition_to_at_risk(self):
        """
        Property 11.26: Planned Can Transition to At Risk
        
        A PLANNED milestone should be able to transition to AT_RISK.
        
        **Feature: integrated-master-schedule, Property 11: Milestone Status Tracking**
        **Validates: Requirements 6.4, 6.5**
        """
        is_valid = self.calculator.is_valid_status_transition(
            MilestoneStatus.PLANNED, MilestoneStatus.AT_RISK
        )
        
        assert is_valid, "PLANNED should be able to transition to AT_RISK"
    
    def test_property_11_at_risk_can_recover_to_planned(self):
        """
        Property 11.27: At Risk Can Recover to Planned
        
        An AT_RISK milestone should be able to recover to PLANNED.
        
        **Feature: integrated-master-schedule, Property 11: Milestone Status Tracking**
        **Validates: Requirements 6.4, 6.5**
        """
        is_valid = self.calculator.is_valid_status_transition(
            MilestoneStatus.AT_RISK, MilestoneStatus.PLANNED
        )
        
        assert is_valid, "AT_RISK should be able to recover to PLANNED"
    
    def test_property_11_missed_can_recover_to_planned(self):
        """
        Property 11.28: Missed Can Recover to Planned
        
        A MISSED milestone should be able to recover to PLANNED.
        
        **Feature: integrated-master-schedule, Property 11: Milestone Status Tracking**
        **Validates: Requirements 6.4, 6.5**
        """
        is_valid = self.calculator.is_valid_status_transition(
            MilestoneStatus.MISSED, MilestoneStatus.PLANNED
        )
        
        assert is_valid, "MISSED should be able to recover to PLANNED"
    
    def test_property_11_achieved_can_reopen_to_planned(self):
        """
        Property 11.29: Achieved Can Reopen to Planned
        
        An ACHIEVED milestone should be able to reopen to PLANNED.
        
        **Feature: integrated-master-schedule, Property 11: Milestone Status Tracking**
        **Validates: Requirements 6.4, 6.5**
        """
        is_valid = self.calculator.is_valid_status_transition(
            MilestoneStatus.ACHIEVED, MilestoneStatus.PLANNED
        )
        
        assert is_valid, "ACHIEVED should be able to reopen to PLANNED"
    
    @given(milestone_status_strategy())
    @settings(max_examples=100)
    def test_property_11_same_status_transition_invalid(
        self,
        status: MilestoneStatus
    ):
        """
        Property 11.30: Same Status Transition Invalid
        
        Transitioning to the same status should be invalid.
        
        **Feature: integrated-master-schedule, Property 11: Milestone Status Tracking**
        **Validates: Requirements 6.4, 6.5**
        """
        is_valid = self.calculator.is_valid_status_transition(status, status)
        
        assert not is_valid, \
            f"Transitioning from {status.value} to {status.value} should be invalid"


def run_property_tests():
    """Run all property-based tests."""
    print("🚀 Running Milestone Status Tracking Property Tests")
    print("=" * 60)
    print("Property 11: Milestone Status Tracking")
    print("Validates: Requirements 6.4, 6.5")
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
        print("\n🎉 All milestone status tracking property tests passed!")
    else:
        print("\n❌ Some property tests failed.")
    
    sys.exit(0 if success else 1)
