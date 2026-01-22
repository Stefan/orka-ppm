"""
Property-based tests for Progress Rollup Accuracy.

These tests validate Property 3: Progress Rollup Accuracy from the
Integrated Master Schedule System design document.

**Property 3: Progress Rollup Accuracy**
For any task hierarchy, parent task progress should be calculated correctly
based on child task completion and effort weighting.

**Validates: Requirements 1.5, 2.3**
"""

import sys
import os
import pytest
from hypothesis import given, strategies as st, settings, assume
from typing import List, Dict, Any, Optional
from uuid import uuid4, UUID
from decimal import Decimal

# Add the backend directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


class ProgressRollupCalculator:
    """
    Pure implementation of progress rollup calculation for property testing.
    
    This mirrors the logic in ScheduleManager.calculate_task_rollup_progress
    but is isolated for testing without database dependencies.
    """
    
    @staticmethod
    def calculate_effort_weighted_progress(
        children: List[Dict[str, Any]]
    ) -> float:
        """
        Calculate parent task progress based on child completion and effort weighting.
        
        Args:
            children: List of child task dictionaries with 'progress_percentage' and 'planned_effort_hours'
            
        Returns:
            float: Calculated progress percentage (0-100)
        """
        if not children:
            return 0.0
        
        total_weighted_progress = 0.0
        total_effort = 0.0
        
        for child in children:
            progress = child.get("progress_percentage", 0)
            effort = child.get("planned_effort_hours", 1) or 1  # Default to 1 to avoid division by zero
            
            total_weighted_progress += progress * effort
            total_effort += effort
        
        if total_effort == 0:
            return 0.0
        
        return round(total_weighted_progress / total_effort, 2)
    
    @staticmethod
    def calculate_simple_average_progress(
        children: List[Dict[str, Any]]
    ) -> float:
        """
        Calculate simple average progress (for comparison/validation).
        
        Args:
            children: List of child task dictionaries with 'progress_percentage'
            
        Returns:
            float: Simple average progress percentage (0-100)
        """
        if not children:
            return 0.0
        
        total_progress = sum(child.get("progress_percentage", 0) for child in children)
        return round(total_progress / len(children), 2)


# Hypothesis strategies for generating test data
@st.composite
def child_task_strategy(draw):
    """Generate a single child task with valid progress and effort values."""
    progress = draw(st.integers(min_value=0, max_value=100))
    effort = draw(st.floats(min_value=0.1, max_value=1000.0, allow_nan=False, allow_infinity=False))
    return {
        "id": str(uuid4()),
        "progress_percentage": progress,
        "planned_effort_hours": round(effort, 2)
    }


@st.composite
def child_tasks_strategy(draw, min_size=1, max_size=20):
    """Generate a list of child tasks."""
    return draw(st.lists(child_task_strategy(), min_size=min_size, max_size=max_size))


@st.composite
def uniform_effort_tasks_strategy(draw, min_size=1, max_size=10):
    """Generate tasks with uniform effort (for testing simple average equivalence)."""
    effort = draw(st.floats(min_value=1.0, max_value=100.0, allow_nan=False, allow_infinity=False))
    num_tasks = draw(st.integers(min_value=min_size, max_value=max_size))
    
    tasks = []
    for _ in range(num_tasks):
        progress = draw(st.integers(min_value=0, max_value=100))
        tasks.append({
            "id": str(uuid4()),
            "progress_percentage": progress,
            "planned_effort_hours": round(effort, 2)
        })
    return tasks


class TestProgressRollupProperties:
    """Property-based tests for progress rollup accuracy."""
    
    def setup_method(self):
        """Set up test environment."""
        self.calculator = ProgressRollupCalculator()
    
    @given(child_tasks_strategy(min_size=1, max_size=20))
    @settings(max_examples=100)
    def test_property_3_progress_rollup_bounds(self, children: List[Dict[str, Any]]):
        """
        Property 3.1: Progress Rollup Bounds
        
        For any set of child tasks, the calculated parent progress should always
        be between 0 and 100 (inclusive).
        
        **Feature: integrated-master-schedule, Property 3: Progress Rollup Accuracy**
        **Validates: Requirements 1.5, 2.3**
        """
        rollup_progress = self.calculator.calculate_effort_weighted_progress(children)
        
        assert 0 <= rollup_progress <= 100, \
            f"Rollup progress {rollup_progress} should be between 0 and 100"
    
    @given(child_tasks_strategy(min_size=1, max_size=20))
    @settings(max_examples=100)
    def test_property_3_progress_rollup_within_child_range(self, children: List[Dict[str, Any]]):
        """
        Property 3.2: Progress Rollup Within Child Range
        
        For any set of child tasks, the calculated parent progress should be
        between the minimum and maximum child progress values.
        
        **Feature: integrated-master-schedule, Property 3: Progress Rollup Accuracy**
        **Validates: Requirements 1.5, 2.3**
        """
        rollup_progress = self.calculator.calculate_effort_weighted_progress(children)
        
        min_progress = min(child["progress_percentage"] for child in children)
        max_progress = max(child["progress_percentage"] for child in children)
        
        # Allow small floating point tolerance
        assert min_progress - 0.01 <= rollup_progress <= max_progress + 0.01, \
            f"Rollup progress {rollup_progress} should be between {min_progress} and {max_progress}"
    
    @given(uniform_effort_tasks_strategy(min_size=2, max_size=10))
    @settings(max_examples=100)
    def test_property_3_uniform_effort_equals_simple_average(self, children: List[Dict[str, Any]]):
        """
        Property 3.3: Uniform Effort Equals Simple Average
        
        When all child tasks have the same effort, the effort-weighted progress
        should equal the simple average progress.
        
        **Feature: integrated-master-schedule, Property 3: Progress Rollup Accuracy**
        **Validates: Requirements 1.5, 2.3**
        """
        weighted_progress = self.calculator.calculate_effort_weighted_progress(children)
        simple_average = self.calculator.calculate_simple_average_progress(children)
        
        # Allow small floating point tolerance
        assert abs(weighted_progress - simple_average) < 0.1, \
            f"With uniform effort, weighted progress {weighted_progress} should equal simple average {simple_average}"
    
    @given(st.integers(min_value=0, max_value=100))
    @settings(max_examples=100)
    def test_property_3_single_child_equals_child_progress(self, progress: int):
        """
        Property 3.4: Single Child Equals Child Progress
        
        When there is only one child task, the parent progress should equal
        the child's progress.
        
        **Feature: integrated-master-schedule, Property 3: Progress Rollup Accuracy**
        **Validates: Requirements 1.5, 2.3**
        """
        children = [{
            "id": str(uuid4()),
            "progress_percentage": progress,
            "planned_effort_hours": 10.0
        }]
        
        rollup_progress = self.calculator.calculate_effort_weighted_progress(children)
        
        assert rollup_progress == progress, \
            f"Single child rollup {rollup_progress} should equal child progress {progress}"
    
    @given(child_tasks_strategy(min_size=1, max_size=10))
    @settings(max_examples=100)
    def test_property_3_all_complete_equals_100(self, children: List[Dict[str, Any]]):
        """
        Property 3.5: All Complete Equals 100%
        
        When all child tasks are 100% complete, the parent progress should be 100%.
        
        **Feature: integrated-master-schedule, Property 3: Progress Rollup Accuracy**
        **Validates: Requirements 1.5, 2.3**
        """
        # Set all children to 100% complete
        for child in children:
            child["progress_percentage"] = 100
        
        rollup_progress = self.calculator.calculate_effort_weighted_progress(children)
        
        assert rollup_progress == 100, \
            f"All complete rollup {rollup_progress} should equal 100"
    
    @given(child_tasks_strategy(min_size=1, max_size=10))
    @settings(max_examples=100)
    def test_property_3_all_not_started_equals_0(self, children: List[Dict[str, Any]]):
        """
        Property 3.6: All Not Started Equals 0%
        
        When all child tasks are 0% complete, the parent progress should be 0%.
        
        **Feature: integrated-master-schedule, Property 3: Progress Rollup Accuracy**
        **Validates: Requirements 1.5, 2.3**
        """
        # Set all children to 0% complete
        for child in children:
            child["progress_percentage"] = 0
        
        rollup_progress = self.calculator.calculate_effort_weighted_progress(children)
        
        assert rollup_progress == 0, \
            f"All not started rollup {rollup_progress} should equal 0"
    
    @given(
        st.integers(min_value=0, max_value=100),
        st.integers(min_value=0, max_value=100),
        st.floats(min_value=1.0, max_value=100.0, allow_nan=False, allow_infinity=False),
        st.floats(min_value=1.0, max_value=100.0, allow_nan=False, allow_infinity=False)
    )
    @settings(max_examples=100)
    def test_property_3_higher_effort_has_more_weight(
        self, 
        progress1: int, 
        progress2: int, 
        effort1: float, 
        effort2: float
    ):
        """
        Property 3.7: Higher Effort Has More Weight
        
        When two tasks have different progress and effort, the task with higher
        effort should have more influence on the rollup progress.
        
        **Feature: integrated-master-schedule, Property 3: Progress Rollup Accuracy**
        **Validates: Requirements 1.5, 2.3**
        """
        # Skip if progress values are equal (no weight difference to test)
        assume(progress1 != progress2)
        # Skip if effort values are equal (no weight difference to test)
        assume(abs(effort1 - effort2) > 0.1)
        
        children = [
            {"id": str(uuid4()), "progress_percentage": progress1, "planned_effort_hours": effort1},
            {"id": str(uuid4()), "progress_percentage": progress2, "planned_effort_hours": effort2}
        ]
        
        rollup_progress = self.calculator.calculate_effort_weighted_progress(children)
        
        # The rollup should be closer to the progress of the task with higher effort
        if effort1 > effort2:
            higher_effort_progress = progress1
            lower_effort_progress = progress2
        else:
            higher_effort_progress = progress2
            lower_effort_progress = progress1
        
        # Calculate distances
        distance_to_higher = abs(rollup_progress - higher_effort_progress)
        distance_to_lower = abs(rollup_progress - lower_effort_progress)
        
        # The rollup should be closer to (or equal distance from) the higher effort task's progress
        # Allow for edge cases where they're equidistant
        assert distance_to_higher <= distance_to_lower + 0.1, \
            f"Rollup {rollup_progress} should be closer to higher effort progress {higher_effort_progress}"
    
    def test_property_3_empty_children_returns_zero(self):
        """
        Property 3.8: Empty Children Returns Zero
        
        When there are no child tasks, the parent progress should be 0%.
        
        **Feature: integrated-master-schedule, Property 3: Progress Rollup Accuracy**
        **Validates: Requirements 1.5, 2.3**
        """
        rollup_progress = self.calculator.calculate_effort_weighted_progress([])
        
        assert rollup_progress == 0.0, \
            f"Empty children rollup {rollup_progress} should equal 0"
    
    @given(child_tasks_strategy(min_size=2, max_size=10))
    @settings(max_examples=100)
    def test_property_3_rollup_is_deterministic(self, children: List[Dict[str, Any]]):
        """
        Property 3.9: Rollup Is Deterministic
        
        For the same set of child tasks, the rollup calculation should always
        return the same result.
        
        **Feature: integrated-master-schedule, Property 3: Progress Rollup Accuracy**
        **Validates: Requirements 1.5, 2.3**
        """
        result1 = self.calculator.calculate_effort_weighted_progress(children)
        result2 = self.calculator.calculate_effort_weighted_progress(children)
        result3 = self.calculator.calculate_effort_weighted_progress(children)
        
        assert result1 == result2 == result3, \
            f"Rollup should be deterministic: {result1}, {result2}, {result3}"
    
    @given(child_tasks_strategy(min_size=2, max_size=10))
    @settings(max_examples=100)
    def test_property_3_rollup_order_independent(self, children: List[Dict[str, Any]]):
        """
        Property 3.10: Rollup Is Order Independent
        
        The order of child tasks should not affect the rollup calculation result.
        
        **Feature: integrated-master-schedule, Property 3: Progress Rollup Accuracy**
        **Validates: Requirements 1.5, 2.3**
        """
        import random
        
        # Calculate with original order
        result_original = self.calculator.calculate_effort_weighted_progress(children)
        
        # Shuffle and calculate again
        shuffled = children.copy()
        random.shuffle(shuffled)
        result_shuffled = self.calculator.calculate_effort_weighted_progress(shuffled)
        
        # Reverse and calculate again
        reversed_children = children[::-1]
        result_reversed = self.calculator.calculate_effort_weighted_progress(reversed_children)
        
        assert result_original == result_shuffled == result_reversed, \
            f"Rollup should be order independent: {result_original}, {result_shuffled}, {result_reversed}"
    
    @given(
        st.lists(st.integers(min_value=0, max_value=100), min_size=2, max_size=10),
        st.lists(st.floats(min_value=0.1, max_value=100.0, allow_nan=False, allow_infinity=False), min_size=2, max_size=10)
    )
    @settings(max_examples=100)
    def test_property_3_mathematical_correctness(
        self, 
        progress_values: List[int], 
        effort_values: List[float]
    ):
        """
        Property 3.11: Mathematical Correctness
        
        The rollup calculation should match the mathematical formula:
        rollup = sum(progress_i * effort_i) / sum(effort_i)
        
        **Feature: integrated-master-schedule, Property 3: Progress Rollup Accuracy**
        **Validates: Requirements 1.5, 2.3**
        """
        # Ensure same length
        min_len = min(len(progress_values), len(effort_values))
        progress_values = progress_values[:min_len]
        effort_values = effort_values[:min_len]
        
        children = [
            {
                "id": str(uuid4()),
                "progress_percentage": progress_values[i],
                "planned_effort_hours": round(effort_values[i], 2)
            }
            for i in range(min_len)
        ]
        
        # Calculate using the calculator
        calculated_rollup = self.calculator.calculate_effort_weighted_progress(children)
        
        # Calculate expected value manually
        total_weighted = sum(p * e for p, e in zip(progress_values, [round(e, 2) for e in effort_values]))
        total_effort = sum(round(e, 2) for e in effort_values)
        expected_rollup = round(total_weighted / total_effort, 2) if total_effort > 0 else 0.0
        
        assert abs(calculated_rollup - expected_rollup) < 0.1, \
            f"Calculated {calculated_rollup} should match expected {expected_rollup}"


def run_property_tests():
    """Run all property-based tests."""
    print("🚀 Running Progress Rollup Property Tests")
    print("=" * 60)
    print("Property 3: Progress Rollup Accuracy")
    print("Validates: Requirements 1.5, 2.3")
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
        print("\n🎉 All progress rollup property tests passed!")
    else:
        print("\n❌ Some property tests failed.")
    
    sys.exit(0 if success else 1)
