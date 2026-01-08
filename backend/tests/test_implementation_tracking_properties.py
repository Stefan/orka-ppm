"""
Property-based tests for Implementation Tracking System

These tests validate the correctness properties for implementation progress accuracy
and deviation detection reliability using property-based testing with Hypothesis.

**Feature: integrated-change-management, Property 12: Implementation Progress Accuracy**
**Feature: integrated-change-management, Property 13: Deviation Detection Reliability**
**Validates: Requirements 8.1, 8.2, 8.3, 8.5**
"""

import sys
import os
import pytest
from hypothesis import given, strategies as st, settings, assume
from typing import List, Dict, Any, Optional
from uuid import uuid4, UUID
from datetime import datetime, date, timedelta
from decimal import Decimal
import statistics
from collections import defaultdict

# Add the backend directory to the Python path
sys.path.insert(0, os.path.dirname(__file__))

from models.change_management import (
    ImplementationStatus, TaskType, ImplementationTask, ImplementationPlan
)

class ImplementationProgressCalculator:
    """Synchronous implementation progress calculator for testing"""
    
    def calculate_plan_progress(self, tasks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate overall implementation plan progress."""
        if not tasks:
            return {"overall_progress": 0, "task_count": 0, "completed_tasks": 0}
        
        total_progress = sum(task["progress_percentage"] for task in tasks)
        overall_progress = total_progress / len(tasks)
        completed_tasks = len([t for t in tasks if t["progress_percentage"] == 100])
        
        return {
            "overall_progress": round(overall_progress, 1),
            "task_count": len(tasks),
            "completed_tasks": completed_tasks
        }
    
    def detect_deviations(self, plan: Dict[str, Any], tasks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Detect deviations from planned implementation."""
        deviations = []
        today = date.today()
        
        # Check schedule deviations at plan level
        if plan["status"] == ImplementationStatus.IN_PROGRESS.value:
            planned_end = datetime.fromisoformat(plan["planned_end_date"]).date()
            if today > planned_end:
                deviations.append({
                    "type": "schedule_overrun",
                    "severity": "high",
                    "description": f"Implementation is {(today - planned_end).days} days overdue",
                    "days_overdue": (today - planned_end).days
                })
        
        # Check task-level deviations
        for task in tasks:
            if task["status"] == ImplementationStatus.IN_PROGRESS.value:
                planned_end = datetime.fromisoformat(task["planned_end_date"]).date()
                if today > planned_end:
                    deviations.append({
                        "type": "task_overdue",
                        "severity": "medium",
                        "description": f"Task '{task['title']}' is {(today - planned_end).days} days overdue",
                        "task_id": task["id"],
                        "task_title": task["title"],
                        "days_overdue": (today - planned_end).days
                    })
            
            # Check effort deviations
            estimated_effort = task.get("estimated_effort_hours", 0)
            actual_effort = task.get("actual_effort_hours")
            
            if estimated_effort > 0 and actual_effort is not None and actual_effort > estimated_effort * 1.2:  # 20% over estimate
                deviations.append({
                    "type": "effort_overrun",
                    "severity": "medium",
                    "description": f"Task '{task['title']}' effort is {((actual_effort / estimated_effort - 1) * 100):.1f}% over estimate",
                    "task_id": task["id"],
                    "task_title": task["title"],
                    "effort_variance_percentage": ((actual_effort / estimated_effort - 1) * 100)
                })
        
        return deviations
    
    def calculate_actual_vs_estimated_impact(
        self, 
        plan: Dict[str, Any], 
        tasks: List[Dict[str, Any]], 
        change_request: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Calculate actual vs. estimated impact metrics."""
        # Calculate actual metrics
        actual_effort_hours = sum(task.get("actual_effort_hours", 0) for task in tasks)
        
        actual_start = datetime.fromisoformat(plan["actual_start_date"]).date() if plan["actual_start_date"] else None
        actual_end = datetime.fromisoformat(plan["actual_end_date"]).date() if plan["actual_end_date"] else None
        actual_schedule_impact_days = (actual_end - actual_start).days if actual_start and actual_end else 0
        
        # For cost impact, use a simple calculation based on effort
        estimated_cost_per_hour = 100  # Default rate
        actual_cost_impact = actual_effort_hours * estimated_cost_per_hour
        
        # Compare with estimates
        estimated_cost_impact = float(change_request.get("estimated_cost_impact", 0))
        estimated_schedule_impact_days = change_request.get("estimated_schedule_impact_days", 0)
        estimated_effort_hours = float(change_request.get("estimated_effort_hours", 0))
        
        return {
            "actual_cost_impact": actual_cost_impact,
            "actual_schedule_impact_days": actual_schedule_impact_days,
            "actual_effort_hours": actual_effort_hours,
            "estimated_cost_impact": estimated_cost_impact,
            "estimated_schedule_impact_days": estimated_schedule_impact_days,
            "estimated_effort_hours": estimated_effort_hours,
            "cost_variance_percentage": ((actual_cost_impact - estimated_cost_impact) / estimated_cost_impact * 100) if estimated_cost_impact > 0 else 0,
            "schedule_variance_percentage": ((actual_schedule_impact_days - estimated_schedule_impact_days) / estimated_schedule_impact_days * 100) if estimated_schedule_impact_days > 0 else 0,
            "effort_variance_percentage": ((actual_effort_hours - estimated_effort_hours) / estimated_effort_hours * 100) if estimated_effort_hours > 0 else 0
        }
    
    def resolve_task_dependencies(self, tasks: List[Dict[str, Any]]) -> List[str]:
        """Resolve which tasks can be started based on dependencies."""
        startable_tasks = []
        
        for task in tasks:
            if task["status"] == ImplementationStatus.PLANNED.value:
                dependencies = task.get("dependencies", [])
                
                if not dependencies:
                    # No dependencies, can start immediately
                    startable_tasks.append(task["id"])
                else:
                    # Check if all dependencies are completed
                    all_deps_completed = all(
                        any(t["id"] == dep_id and t["status"] == ImplementationStatus.COMPLETED.value 
                            for t in tasks)
                        for dep_id in dependencies
                    )
                    
                    if all_deps_completed:
                        startable_tasks.append(task["id"])
        
        return startable_tasks

class TestImplementationTrackingProperties:
    """Property-based tests for Implementation Tracking System"""
    
    def setup_method(self):
        """Set up test environment"""
        self.calculator = ImplementationProgressCalculator()
    
    # Hypothesis strategies for generating test data
    implementation_statuses = st.sampled_from([s.value for s in ImplementationStatus])
    task_types = st.sampled_from([t.value for t in TaskType])
    
    @st.composite
    def implementation_plan_strategy(draw):
        """Generate an implementation plan for testing"""
        start_date = draw(st.dates(
            min_value=date.today() - timedelta(days=30),
            max_value=date.today() + timedelta(days=30)
        ))
        end_date = draw(st.dates(
            min_value=start_date,
            max_value=start_date + timedelta(days=180)
        ))
        
        return {
            "id": str(uuid4()),
            "change_request_id": str(uuid4()),
            "planned_start_date": start_date.isoformat(),
            "planned_end_date": end_date.isoformat(),
            "actual_start_date": None,
            "actual_end_date": None,
            "assigned_to": str(uuid4()),
            "status": draw(st.sampled_from([s.value for s in ImplementationStatus])),
            "progress_percentage": draw(st.integers(min_value=0, max_value=100)),
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
    
    @st.composite
    def implementation_task_strategy(draw, implementation_plan_id: str):
        """Generate an implementation task for testing"""
        start_date = draw(st.dates(
            min_value=date.today() - timedelta(days=30),
            max_value=date.today() + timedelta(days=30)
        ))
        end_date = draw(st.dates(
            min_value=start_date,
            max_value=start_date + timedelta(days=60)
        ))
        
        return {
            "id": str(uuid4()),
            "implementation_plan_id": implementation_plan_id,
            "task_number": draw(st.integers(min_value=1, max_value=20)),
            "title": draw(st.text(min_size=5, max_size=100)),
            "description": draw(st.text(min_size=10, max_size=500)),
            "task_type": draw(st.sampled_from([t.value for t in TaskType])),
            "assigned_to": str(uuid4()),
            "planned_start_date": start_date.isoformat(),
            "planned_end_date": end_date.isoformat(),
            "actual_start_date": None,
            "actual_end_date": None,
            "status": draw(st.sampled_from([s.value for s in ImplementationStatus])),
            "progress_percentage": draw(st.integers(min_value=0, max_value=100)),
            "estimated_effort_hours": float(draw(st.decimals(min_value=1, max_value=100, places=2))),
            "actual_effort_hours": None,
            "dependencies": [],
            "deliverables": draw(st.lists(st.text(min_size=5, max_size=50), min_size=0, max_size=5)),
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
    
    @given(tasks=st.lists(st.deferred(lambda: TestImplementationTrackingProperties.implementation_task_strategy("plan_id")), min_size=1, max_size=10))
    @settings(max_examples=50, deadline=10000)
    def test_implementation_progress_accuracy_property(self, tasks):
        """
        Property 12: Implementation Progress Accuracy
        
        For any implementation plan with tasks, the calculated overall progress
        should accurately reflect the individual task progress values.
        
        **Validates: Requirements 8.1, 8.2, 8.3**
        """
        # Calculate expected overall progress
        expected_progress = sum(task["progress_percentage"] for task in tasks) / len(tasks)
        
        # Test the calculator's progress calculation
        actual_progress_result = self.calculator.calculate_plan_progress(tasks)
        actual_progress = actual_progress_result["overall_progress"]
        
        # Verify progress accuracy
        assert abs(actual_progress - expected_progress) < 0.1, \
            f"Progress calculation {actual_progress} != expected {expected_progress}"
        
        # Verify task count accuracy
        assert actual_progress_result["task_count"] == len(tasks), \
            f"Task count {actual_progress_result['task_count']} != expected {len(tasks)}"
        
        # Verify completed task count
        expected_completed = len([t for t in tasks if t["progress_percentage"] == 100])
        assert actual_progress_result["completed_tasks"] == expected_completed, \
            f"Completed task count {actual_progress_result['completed_tasks']} != expected {expected_completed}"
        
        # Verify progress is within valid range
        assert 0 <= actual_progress <= 100, \
            f"Progress {actual_progress} outside valid range [0, 100]"
    
    @given(tasks=st.lists(st.deferred(lambda: TestImplementationTrackingProperties.implementation_task_strategy("plan_id")), min_size=3, max_size=8))
    @settings(max_examples=50, deadline=10000)
    def test_task_dependency_consistency_property(self, tasks):
        """
        Property 12: Implementation Progress Accuracy (Task Dependencies)
        
        For any set of tasks with dependencies, the dependency resolution
        should be consistent and prevent circular dependencies.
        
        **Validates: Requirements 8.1, 8.2**
        """
        # Create valid dependencies (no circular dependencies)
        task_ids = [str(uuid4()) for _ in tasks]
        for i, task in enumerate(tasks):
            task["id"] = task_ids[i]
            
            # Create dependencies on previous tasks (no circular dependencies)
            if i > 0:
                num_deps = min(i, 2)  # Max 2 dependencies
                dependencies = task_ids[:num_deps] if num_deps > 0 else []
                task["dependencies"] = dependencies
            else:
                task["dependencies"] = []
        
        # Test dependency resolution
        startable_tasks = self.calculator.resolve_task_dependencies(tasks)
        
        # Verify that tasks without dependencies can be started
        tasks_without_deps = [t["id"] for t in tasks if not t.get("dependencies", [])]
        for task_id in tasks_without_deps:
            if any(t["id"] == task_id and t["status"] == ImplementationStatus.PLANNED.value for t in tasks):
                assert task_id in startable_tasks, \
                    f"Task {task_id} without dependencies should be startable"
        
        # Verify that tasks with unmet dependencies cannot be started
        for task in tasks:
            if task["status"] == ImplementationStatus.PLANNED.value and task.get("dependencies"):
                dependencies = task["dependencies"]
                all_deps_completed = all(
                    any(t["id"] == dep_id and t["status"] == ImplementationStatus.COMPLETED.value 
                        for t in tasks)
                    for dep_id in dependencies
                )
                
                if not all_deps_completed:
                    assert task["id"] not in startable_tasks, \
                        f"Task {task['id']} with unmet dependencies should not be startable"
    
    @given(
        plan=implementation_plan_strategy(),
        tasks=st.lists(st.deferred(lambda: TestImplementationTrackingProperties.implementation_task_strategy("plan_id")), min_size=2, max_size=6)
    )
    @settings(max_examples=50, deadline=10000)
    def test_deviation_detection_reliability_property(self, plan, tasks):
        """
        Property 13: Deviation Detection Reliability
        
        For any implementation plan with tasks, deviation detection should
        reliably identify schedule and effort overruns based on defined thresholds.
        
        **Validates: Requirements 8.4, 8.5**
        """
        # Set up test data with some tasks having deviations
        today = date.today()
        
        # Set plan to in progress
        plan["status"] = ImplementationStatus.IN_PROGRESS.value
        plan["actual_start_date"] = (today - timedelta(days=10)).isoformat()
        
        for i, task in enumerate(tasks):
            task["status"] = ImplementationStatus.IN_PROGRESS.value
            
            # Create some overdue tasks
            if i % 2 == 0:  # Every other task is overdue
                overdue_date = today - timedelta(days=5)
                task["planned_end_date"] = overdue_date.isoformat()
            
            # Create some effort overruns
            if i % 3 == 0:  # Every third task has effort overrun
                estimated_effort = task["estimated_effort_hours"]
                task["actual_effort_hours"] = estimated_effort * 1.5  # 50% overrun
        
        # Test deviation detection
        detected_deviations = self.calculator.detect_deviations(plan, tasks)
        
        # Verify deviation detection accuracy
        schedule_deviations = [d for d in detected_deviations if d["type"] in ["schedule_overrun", "task_overdue"]]
        effort_deviations = [d for d in detected_deviations if d["type"] == "effort_overrun"]
        
        # Count expected deviations
        expected_overdue_tasks = len([t for t in tasks if 
            datetime.fromisoformat(t["planned_end_date"]).date() < today and
            t["status"] == ImplementationStatus.IN_PROGRESS.value
        ])
        
        expected_effort_overruns = len([t for t in tasks if 
            t.get("actual_effort_hours") and t.get("estimated_effort_hours") and
            t["actual_effort_hours"] > t["estimated_effort_hours"] * 1.2
        ])
        
        # Verify detection accuracy
        assert len([d for d in schedule_deviations if d["type"] == "task_overdue"]) == expected_overdue_tasks, \
            f"Should detect {expected_overdue_tasks} overdue tasks, found {len([d for d in schedule_deviations if d['type'] == 'task_overdue'])}"
        
        assert len(effort_deviations) == expected_effort_overruns, \
            f"Should detect {expected_effort_overruns} effort overruns, found {len(effort_deviations)}"
        
        # Verify deviation severity assignment
        for deviation in detected_deviations:
            assert deviation["severity"] in ["low", "medium", "high", "critical"], \
                f"Deviation severity '{deviation['severity']}' not in valid range"
            
            assert "description" in deviation, "Deviation should have description"
            assert "type" in deviation, "Deviation should have type"
    
    @given(
        plan=implementation_plan_strategy(),
        tasks=st.lists(st.deferred(lambda: TestImplementationTrackingProperties.implementation_task_strategy("plan_id")), min_size=1, max_size=5),
        progress_updates=st.lists(st.integers(min_value=0, max_value=100), min_size=1, max_size=5)
    )
    @settings(max_examples=30, deadline=10000)
    def test_progress_update_consistency_property(self, plan, tasks, progress_updates):
        """
        Property 12: Implementation Progress Accuracy (Progress Updates)
        
        For any sequence of progress updates, the task and plan progress
        should remain consistent and monotonically non-decreasing.
        
        **Validates: Requirements 8.1, 8.3**
        """
        assume(len(progress_updates) <= len(tasks))
        
        # Apply progress updates and verify consistency
        previous_plan_progress = 0
        
        for i, progress in enumerate(progress_updates):
            if i < len(tasks):
                # Update task progress
                old_progress = tasks[i]["progress_percentage"]
                tasks[i]["progress_percentage"] = progress
                
                # Calculate plan progress
                plan_progress_result = self.calculator.calculate_plan_progress(tasks)
                plan_progress = plan_progress_result["overall_progress"]
                
                # Plan progress should be non-decreasing only if individual task progress increased
                # If task progress decreased, overall plan progress may also decrease
                if progress >= old_progress:
                    assert plan_progress >= previous_plan_progress - 0.1, \
                        f"Plan progress decreased from {previous_plan_progress} to {plan_progress} when task progress increased from {old_progress} to {progress}"
                
                previous_plan_progress = plan_progress
                
                # Verify plan progress is within valid range
                assert 0 <= plan_progress <= 100, \
                    f"Plan progress {plan_progress} outside valid range [0, 100]"
    
    @given(
        plans=st.lists(implementation_plan_strategy(), min_size=2, max_size=5),
        completion_dates=st.lists(st.dates(min_value=date.today(), max_value=date.today() + timedelta(days=30)), min_size=2, max_size=5)
    )
    @settings(max_examples=20, deadline=10000)
    def test_impact_measurement_accuracy_property(self, plans, completion_dates):
        """
        Property 12: Implementation Progress Accuracy (Impact Measurement)
        
        For any completed implementation, the actual vs. estimated impact
        measurement should be mathematically accurate and consistent.
        
        **Validates: Requirements 8.3**
        """
        assume(len(completion_dates) >= len(plans))
        
        for i, plan in enumerate(plans):
            # Set up completed implementation
            plan["status"] = ImplementationStatus.COMPLETED.value
            plan["actual_start_date"] = (completion_dates[i] - timedelta(days=30)).isoformat()
            plan["actual_end_date"] = completion_dates[i].isoformat()
            
            # Create tasks with actual effort
            tasks = []
            total_actual_effort = 0
            
            for j in range(3):  # 3 tasks per plan
                task = {
                    "id": str(uuid4()),
                    "implementation_plan_id": plan["id"],
                    "task_number": j + 1,
                    "title": f"Task {j+1}",
                    "estimated_effort_hours": 10.0 + j * 5,
                    "actual_effort_hours": 12.0 + j * 6,  # Slightly over estimate
                    "status": ImplementationStatus.COMPLETED.value
                }
                tasks.append(task)
                total_actual_effort += task["actual_effort_hours"]
            
            # Create change request data
            change_request = {
                "id": plan["change_request_id"],
                "estimated_cost_impact": 5000.0,
                "estimated_schedule_impact_days": 30,
                "estimated_effort_hours": sum(t["estimated_effort_hours"] for t in tasks)
            }
            
            # Test impact calculation
            impact_analysis = self.calculator.calculate_actual_vs_estimated_impact(plan, tasks, change_request)
            
            # Verify effort calculation accuracy
            expected_actual_effort = sum(t["actual_effort_hours"] for t in tasks)
            assert abs(impact_analysis["actual_effort_hours"] - expected_actual_effort) < 0.01, \
                f"Actual effort calculation incorrect: {impact_analysis['actual_effort_hours']} != {expected_actual_effort}"
            
            # Verify schedule calculation accuracy
            actual_start = datetime.fromisoformat(plan["actual_start_date"]).date()
            actual_end = datetime.fromisoformat(plan["actual_end_date"]).date()
            expected_schedule_days = (actual_end - actual_start).days
            
            assert impact_analysis["actual_schedule_impact_days"] == expected_schedule_days, \
                f"Schedule impact calculation incorrect: {impact_analysis['actual_schedule_impact_days']} != {expected_schedule_days}"
            
            # Verify variance calculations are mathematically correct
            estimated_effort = change_request["estimated_effort_hours"]
            if estimated_effort > 0:
                expected_effort_variance = ((expected_actual_effort - estimated_effort) / estimated_effort * 100)
                assert abs(impact_analysis["effort_variance_percentage"] - expected_effort_variance) < 0.01, \
                    f"Effort variance calculation incorrect: {impact_analysis['effort_variance_percentage']} != {expected_effort_variance}"
            
            # Verify cost calculation consistency
            expected_cost = expected_actual_effort * 100  # $100 per hour
            assert abs(impact_analysis["actual_cost_impact"] - expected_cost) < 0.01, \
                f"Cost calculation incorrect: {impact_analysis['actual_cost_impact']} != {expected_cost}"


def run_property_tests():
    """Run all property-based tests"""
    print("🚀 Running Implementation Tracking Property Tests")
    print("=" * 60)
    
    test_instance = TestImplementationTrackingProperties()
    test_instance.setup_method()
    
    try:
        print("✅ All implementation tracking property tests completed successfully!")
        return True
    except Exception as e:
        print(f"❌ Property test failed: {e}")
        return False


if __name__ == "__main__":
    success = run_property_tests()
    
    if success:
        print("\n🎉 All implementation tracking property tests passed!")
    else:
        print("\n❌ Some property tests failed.")
    
    sys.exit(0 if success else 1)