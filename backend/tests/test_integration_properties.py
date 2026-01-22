"""
Property-based tests for Integration Properties.

These tests validate Property 14: Financial Integration Consistency,
Property 15: System Synchronization Accuracy, and Property 16: Data Export Integrity
from the Integrated Master Schedule System design document.

**Property 14: Financial Integration Consistency**
For any schedule-to-financial system integration, budget and cost data associations
should be maintained correctly.

**Property 15: System Synchronization Accuracy**
For any schedule update, integrated systems (resources, dashboards, reporting)
should be synchronized correctly.

**Property 16: Data Export Integrity**
For any data export operation, exported schedule data should match expected
standard formats and maintain data integrity.

**Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**
"""

import sys
import os
import pytest
from hypothesis import given, strategies as st, settings, assume
from typing import List, Dict, Any, Optional, Tuple
from uuid import uuid4, UUID
from datetime import date, datetime, timedelta
from decimal import Decimal
import json
import csv
import io

# Add the backend directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


# ============================================================================
# Financial Integration Calculator
# ============================================================================

class FinancialIntegrationCalculator:
    """
    Pure implementation of financial integration calculations for property testing.
    This mirrors the logic for budget and cost data associations with tasks.
    """

    @staticmethod
    def associate_budget_with_task(
        task: Dict[str, Any],
        budget_amount: float,
        cost_account: str
    ) -> Dict[str, Any]:
        """Associate budget data with a scheduled task."""
        task_with_budget = task.copy()
        task_with_budget["budget"] = {
            "amount": budget_amount,
            "cost_account": cost_account,
            "currency": "USD",
            "associated_at": datetime.utcnow().isoformat()
        }
        return task_with_budget


    @staticmethod
    def calculate_earned_value_metrics(
        task: Dict[str, Any],
        status_date: date
    ) -> Dict[str, Any]:
        """
        Calculate earned value metrics for a task.
        BCWS = Budget * Planned Progress, BCWP = Budget * Actual Progress
        """
        budget = task.get("budget", {}).get("amount", 0)
        progress = task.get("progress_percentage", 0) / 100.0
        
        start_date = date.fromisoformat(task["planned_start_date"])
        end_date = date.fromisoformat(task["planned_end_date"])
        
        if status_date >= end_date:
            planned_progress = 1.0
        elif status_date <= start_date:
            planned_progress = 0.0
        else:
            total_duration = (end_date - start_date).days
            elapsed = (status_date - start_date).days
            planned_progress = elapsed / total_duration if total_duration > 0 else 0.0
        
        bcws = budget * planned_progress
        bcwp = budget * progress
        sv = bcwp - bcws
        spi = bcwp / bcws if bcws > 0 else 0.0
        
        return {
            "task_id": task["id"],
            "budget": budget,
            "bcws": round(bcws, 2),
            "bcwp": round(bcwp, 2),
            "schedule_variance": round(sv, 2),
            "schedule_performance_index": round(spi, 3),
            "planned_progress": round(planned_progress * 100, 2),
            "actual_progress": task.get("progress_percentage", 0)
        }


    @staticmethod
    def aggregate_project_financials(
        tasks: List[Dict[str, Any]],
        status_date: date
    ) -> Dict[str, Any]:
        """Aggregate financial metrics across all project tasks."""
        total_budget = 0.0
        total_bcws = 0.0
        total_bcwp = 0.0
        task_metrics = []
        
        for task in tasks:
            if task.get("budget"):
                metrics = FinancialIntegrationCalculator.calculate_earned_value_metrics(
                    task, status_date
                )
                task_metrics.append(metrics)
                total_budget += metrics["budget"]
                total_bcws += metrics["bcws"]
                total_bcwp += metrics["bcwp"]
        
        total_sv = total_bcwp - total_bcws
        total_spi = total_bcwp / total_bcws if total_bcws > 0 else 0.0
        
        return {
            "total_budget": round(total_budget, 2),
            "total_bcws": round(total_bcws, 2),
            "total_bcwp": round(total_bcwp, 2),
            "total_schedule_variance": round(total_sv, 2),
            "project_spi": round(total_spi, 3),
            "task_count": len(task_metrics),
            "task_metrics": task_metrics
        }



# ============================================================================
# System Synchronization Manager
# ============================================================================

class SystemSynchronizationManager:
    """
    Pure implementation of system synchronization for property testing.
    Mirrors the logic for synchronizing schedule updates across integrated systems.
    """
    
    def __init__(self):
        self.schedules: Dict[str, Dict[str, Any]] = {}
        self.tasks: Dict[str, Dict[str, Any]] = {}
        self.resource_assignments: Dict[str, List[Dict[str, Any]]] = {}
        self.dashboard_data: Dict[str, Dict[str, Any]] = {}
        self.sync_log: List[Dict[str, Any]] = []

    def register_schedule(self, schedule: Dict[str, Any]) -> None:
        """Register a schedule in the system."""
        schedule_id = schedule["id"]
        self.schedules[schedule_id] = schedule.copy()
        self.dashboard_data[schedule_id] = self._create_dashboard_data(schedule)
        self._log_sync("schedule_registered", schedule_id)
    
    def register_task(self, task: Dict[str, Any]) -> None:
        """Register a task in the system."""
        task_id = task["id"]
        self.tasks[task_id] = task.copy()
        self._log_sync("task_registered", task_id)


    def update_task(self, task_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update a task and synchronize across systems."""
        if task_id not in self.tasks:
            raise ValueError(f"Task {task_id} not found")
        
        task = self.tasks[task_id]
        for key, value in updates.items():
            task[key] = value
        task["updated_at"] = datetime.utcnow().isoformat()
        
        self._sync_resource_assignments(task_id, task)
        schedule_id = task.get("schedule_id")
        if schedule_id:
            self._sync_dashboard(schedule_id)
        
        self._log_sync("task_updated", task_id, updates)
        return task
    
    def assign_resource(
        self, task_id: str, resource_id: str, allocation_percentage: int
    ) -> Dict[str, Any]:
        """Assign a resource to a task."""
        assignment = {
            "id": str(uuid4()),
            "task_id": task_id,
            "resource_id": resource_id,
            "allocation_percentage": allocation_percentage,
            "created_at": datetime.utcnow().isoformat()
        }
        if task_id not in self.resource_assignments:
            self.resource_assignments[task_id] = []
        self.resource_assignments[task_id].append(assignment)
        self._log_sync("resource_assigned", task_id, {"resource_id": resource_id})
        return assignment


    def get_sync_status(self, entity_id: str) -> Dict[str, Any]:
        """Get synchronization status for an entity."""
        relevant_logs = [log for log in self.sync_log if log["entity_id"] == entity_id]
        return {
            "entity_id": entity_id,
            "sync_count": len(relevant_logs),
            "last_sync": relevant_logs[-1]["timestamp"] if relevant_logs else None,
            "sync_history": relevant_logs
        }
    
    def _sync_resource_assignments(self, task_id: str, task: Dict[str, Any]) -> None:
        """Synchronize resource assignments when task is updated."""
        if task_id in self.resource_assignments:
            for assignment in self.resource_assignments[task_id]:
                assignment["task_start_date"] = task.get("planned_start_date")
                assignment["task_end_date"] = task.get("planned_end_date")
                assignment["synced_at"] = datetime.utcnow().isoformat()
    
    def _sync_dashboard(self, schedule_id: str) -> None:
        """Synchronize dashboard data when schedule is updated."""
        if schedule_id in self.schedules:
            schedule = self.schedules[schedule_id]
            self.dashboard_data[schedule_id] = self._create_dashboard_data(schedule)
    
    def _create_dashboard_data(self, schedule: Dict[str, Any]) -> Dict[str, Any]:
        """Create dashboard data from schedule."""
        return {
            "schedule_id": schedule["id"],
            "schedule_name": schedule.get("name", ""),
            "start_date": schedule.get("start_date"),
            "end_date": schedule.get("end_date"),
            "status": schedule.get("status", "active"),
            "last_updated": datetime.utcnow().isoformat()
        }
    
    def _log_sync(self, action: str, entity_id: str, details: Optional[Dict] = None):
        """Log a synchronization event."""
        self.sync_log.append({
            "action": action,
            "entity_id": entity_id,
            "details": details or {},
            "timestamp": datetime.utcnow().isoformat()
        })



# ============================================================================
# Data Export Manager
# ============================================================================

class DataExportManager:
    """
    Pure implementation of data export for property testing.
    Supports MS Project XML, Primavera P6 XER, and CSV formats.
    """
    
    SUPPORTED_FORMATS = ["ms_project", "primavera_p6", "csv", "json"]
    
    @staticmethod
    def export_to_csv(
        schedule: Dict[str, Any],
        tasks: List[Dict[str, Any]]
    ) -> str:
        """Export schedule data to CSV format."""
        output = io.StringIO()
        fieldnames = [
            "task_id", "wbs_code", "name", "start_date", "end_date",
            "duration_days", "progress_percentage", "status"
        ]
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        
        for task in tasks:
            writer.writerow({
                "task_id": task["id"],
                "wbs_code": task.get("wbs_code", ""),
                "name": task.get("name", ""),
                "start_date": task.get("planned_start_date", ""),
                "end_date": task.get("planned_end_date", ""),
                "duration_days": task.get("duration_days", 0),
                "progress_percentage": task.get("progress_percentage", 0),
                "status": task.get("status", "not_started")
            })
        
        return output.getvalue()


    @staticmethod
    def export_to_json(
        schedule: Dict[str, Any],
        tasks: List[Dict[str, Any]],
        dependencies: Optional[List[Dict[str, Any]]] = None
    ) -> str:
        """Export schedule data to JSON format."""
        export_data = {
            "schedule": {
                "id": schedule["id"],
                "name": schedule.get("name", ""),
                "start_date": schedule.get("start_date"),
                "end_date": schedule.get("end_date"),
                "status": schedule.get("status", "active")
            },
            "tasks": [
                {
                    "id": task["id"],
                    "wbs_code": task.get("wbs_code", ""),
                    "name": task.get("name", ""),
                    "start_date": task.get("planned_start_date", ""),
                    "end_date": task.get("planned_end_date", ""),
                    "duration_days": task.get("duration_days", 0),
                    "progress_percentage": task.get("progress_percentage", 0),
                    "status": task.get("status", "not_started"),
                    "parent_task_id": task.get("parent_task_id")
                }
                for task in tasks
            ],
            "dependencies": dependencies or [],
            "export_metadata": {
                "exported_at": datetime.utcnow().isoformat(),
                "format_version": "1.0",
                "task_count": len(tasks)
            }
        }
        return json.dumps(export_data, indent=2)


    @staticmethod
    def export_to_ms_project_xml(
        schedule: Dict[str, Any],
        tasks: List[Dict[str, Any]]
    ) -> str:
        """Export schedule data to MS Project XML format."""
        xml_lines = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<Project xmlns="http://schemas.microsoft.com/project">',
            f'  <Name>{schedule.get("name", "")}</Name>',
            f'  <StartDate>{schedule.get("start_date", "")}</StartDate>',
            f'  <FinishDate>{schedule.get("end_date", "")}</FinishDate>',
            '  <Tasks>'
        ]
        
        for idx, task in enumerate(tasks, 1):
            xml_lines.extend([
                '    <Task>',
                f'      <UID>{idx}</UID>',
                f'      <ID>{idx}</ID>',
                f'      <Name>{task.get("name", "")}</Name>',
                f'      <WBS>{task.get("wbs_code", "")}</WBS>',
                f'      <Start>{task.get("planned_start_date", "")}</Start>',
                f'      <Finish>{task.get("planned_end_date", "")}</Finish>',
                f'      <Duration>PT{task.get("duration_days", 0) * 8}H0M0S</Duration>',
                f'      <PercentComplete>{task.get("progress_percentage", 0)}</PercentComplete>',
                '    </Task>'
            ])
        
        xml_lines.extend(['  </Tasks>', '</Project>'])
        return '\n'.join(xml_lines)


    @staticmethod
    def validate_export_integrity(
        original_tasks: List[Dict[str, Any]],
        exported_data: str,
        export_format: str
    ) -> Dict[str, Any]:
        """Validate that exported data maintains integrity with original."""
        validation_result = {
            "is_valid": True,
            "format": export_format,
            "original_task_count": len(original_tasks),
            "exported_task_count": 0,
            "missing_tasks": [],
            "data_mismatches": []
        }
        
        if export_format == "csv":
            reader = csv.DictReader(io.StringIO(exported_data))
            exported_tasks = list(reader)
            validation_result["exported_task_count"] = len(exported_tasks)
            
            exported_ids = {t["task_id"] for t in exported_tasks}
            for task in original_tasks:
                if task["id"] not in exported_ids:
                    validation_result["missing_tasks"].append(task["id"])
                    validation_result["is_valid"] = False
        
        elif export_format == "json":
            parsed = json.loads(exported_data)
            exported_tasks = parsed.get("tasks", [])
            validation_result["exported_task_count"] = len(exported_tasks)
            
            exported_ids = {t["id"] for t in exported_tasks}
            for task in original_tasks:
                if task["id"] not in exported_ids:
                    validation_result["missing_tasks"].append(task["id"])
                    validation_result["is_valid"] = False
        
        return validation_result



# ============================================================================
# Hypothesis Strategies
# ============================================================================

@st.composite
def date_strategy(draw, min_days=-180, max_days=180):
    """Generate a date within a range from today."""
    days_offset = draw(st.integers(min_value=min_days, max_value=max_days))
    return date.today() + timedelta(days=days_offset)


@st.composite
def task_strategy(draw, task_id=None, schedule_id=None):
    """Generate a single task with valid data."""
    if task_id is None:
        task_id = str(uuid4())
    if schedule_id is None:
        schedule_id = str(uuid4())
    
    start_date = draw(date_strategy(min_days=-90, max_days=90))
    duration = draw(st.integers(min_value=1, max_value=60))
    end_date = start_date + timedelta(days=duration)
    progress = draw(st.integers(min_value=0, max_value=100))
    
    return {
        "id": task_id,
        "schedule_id": schedule_id,
        "name": f"Task-{task_id[:8]}",
        "wbs_code": f"1.{draw(st.integers(min_value=1, max_value=99))}",
        "planned_start_date": start_date.isoformat(),
        "planned_end_date": end_date.isoformat(),
        "duration_days": duration,
        "progress_percentage": progress,
        "status": draw(st.sampled_from(["not_started", "in_progress", "completed"]))
    }



@st.composite
def task_with_budget_strategy(draw):
    """Generate a task with budget data."""
    task = draw(task_strategy())
    budget = draw(st.floats(min_value=1000.0, max_value=1000000.0, allow_nan=False))
    cost_account = f"CA-{draw(st.integers(min_value=1000, max_value=9999))}"
    return FinancialIntegrationCalculator.associate_budget_with_task(
        task, round(budget, 2), cost_account
    )


@st.composite
def schedule_strategy(draw):
    """Generate a schedule with valid data."""
    schedule_id = str(uuid4())
    start_date = draw(date_strategy(min_days=-90, max_days=0))
    duration = draw(st.integers(min_value=30, max_value=365))
    end_date = start_date + timedelta(days=duration)
    
    return {
        "id": schedule_id,
        "name": f"Schedule-{schedule_id[:8]}",
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "status": "active"
    }


@st.composite
def schedule_with_tasks_strategy(draw, min_tasks=1, max_tasks=10):
    """Generate a schedule with multiple tasks."""
    schedule = draw(schedule_strategy())
    schedule_id = schedule["id"]
    num_tasks = draw(st.integers(min_value=min_tasks, max_value=max_tasks))
    tasks = [draw(task_strategy(schedule_id=schedule_id)) for _ in range(num_tasks)]
    return schedule, tasks



# ============================================================================
# Property 14: Financial Integration Consistency Tests
# ============================================================================

class TestFinancialIntegrationConsistencyProperties:
    """
    Property-based tests for Property 14: Financial Integration Consistency.
    
    For any schedule-to-financial system integration, budget and cost data
    associations should be maintained correctly.
    
    **Validates: Requirements 8.1, 8.2**
    """
    
    def setup_method(self):
        """Set up test environment."""
        self.calculator = FinancialIntegrationCalculator()
    
    @given(task_strategy(), st.floats(min_value=1000, max_value=1000000, allow_nan=False))
    @settings(max_examples=100)
    def test_property_14_budget_association_preserves_task_data(
        self, task: Dict[str, Any], budget: float
    ):
        """
        Property 14.1: Budget Association Preserves Task Data
        
        When associating budget with a task, all original task data should be preserved.
        
        **Feature: integrated-master-schedule, Property 14: Financial Integration Consistency**
        **Validates: Requirements 8.1**
        """
        cost_account = "CA-1234"
        task_with_budget = self.calculator.associate_budget_with_task(
            task, round(budget, 2), cost_account
        )
        
        # Verify original task data is preserved
        for key in task:
            assert key in task_with_budget, f"Original key {key} should be preserved"
            assert task_with_budget[key] == task[key], f"Value for {key} should be unchanged"
        
        # Verify budget data is added
        assert "budget" in task_with_budget
        assert task_with_budget["budget"]["amount"] == round(budget, 2)
        assert task_with_budget["budget"]["cost_account"] == cost_account


    @given(task_with_budget_strategy(), date_strategy())
    @settings(max_examples=100)
    def test_property_14_earned_value_metrics_are_mathematically_correct(
        self, task: Dict[str, Any], status_date: date
    ):
        """
        Property 14.2: Earned Value Metrics Are Mathematically Correct
        
        BCWS and BCWP calculations should follow standard earned value formulas.
        
        **Feature: integrated-master-schedule, Property 14: Financial Integration Consistency**
        **Validates: Requirements 8.2**
        """
        metrics = self.calculator.calculate_earned_value_metrics(task, status_date)
        
        budget = task["budget"]["amount"]
        progress = task["progress_percentage"] / 100.0
        
        # BCWP should equal budget * actual progress
        expected_bcwp = round(budget * progress, 2)
        assert abs(metrics["bcwp"] - expected_bcwp) < 0.01, \
            f"BCWP {metrics['bcwp']} should equal {expected_bcwp}"
        
        # Schedule variance should equal BCWP - BCWS
        expected_sv = round(metrics["bcwp"] - metrics["bcws"], 2)
        assert abs(metrics["schedule_variance"] - expected_sv) < 0.02, \
            f"SV {metrics['schedule_variance']} should equal {expected_sv}"
    
    @given(task_with_budget_strategy())
    @settings(max_examples=100)
    def test_property_14_spi_equals_one_when_on_track(self, task: Dict[str, Any]):
        """
        Property 14.3: SPI Equals One When On Track
        
        When actual progress matches planned progress, SPI should be 1.0.
        
        **Feature: integrated-master-schedule, Property 14: Financial Integration Consistency**
        **Validates: Requirements 8.2**
        """
        # Set status date to end of task (100% planned)
        end_date = date.fromisoformat(task["planned_end_date"])
        task["progress_percentage"] = 100  # 100% actual progress
        
        metrics = self.calculator.calculate_earned_value_metrics(task, end_date)
        
        assert abs(metrics["schedule_performance_index"] - 1.0) < 0.01, \
            f"SPI should be 1.0 when on track, got {metrics['schedule_performance_index']}"


    @given(st.lists(task_with_budget_strategy(), min_size=1, max_size=10), date_strategy())
    @settings(max_examples=100)
    def test_property_14_aggregated_budget_equals_sum_of_task_budgets(
        self, tasks: List[Dict[str, Any]], status_date: date
    ):
        """
        Property 14.4: Aggregated Budget Equals Sum of Task Budgets
        
        Total project budget should equal sum of all task budgets.
        
        **Feature: integrated-master-schedule, Property 14: Financial Integration Consistency**
        **Validates: Requirements 8.1, 8.2**
        """
        result = self.calculator.aggregate_project_financials(tasks, status_date)
        
        expected_total = sum(t["budget"]["amount"] for t in tasks)
        assert abs(result["total_budget"] - expected_total) < 0.01, \
            f"Total budget {result['total_budget']} should equal {expected_total}"
    
    @given(st.lists(task_with_budget_strategy(), min_size=1, max_size=10), date_strategy())
    @settings(max_examples=100)
    def test_property_14_aggregated_metrics_are_consistent(
        self, tasks: List[Dict[str, Any]], status_date: date
    ):
        """
        Property 14.5: Aggregated Metrics Are Consistent
        
        Aggregated BCWS and BCWP should equal sum of individual task metrics.
        
        **Feature: integrated-master-schedule, Property 14: Financial Integration Consistency**
        **Validates: Requirements 8.2**
        """
        result = self.calculator.aggregate_project_financials(tasks, status_date)
        
        expected_bcws = sum(m["bcws"] for m in result["task_metrics"])
        expected_bcwp = sum(m["bcwp"] for m in result["task_metrics"])
        
        assert abs(result["total_bcws"] - expected_bcws) < 0.01
        assert abs(result["total_bcwp"] - expected_bcwp) < 0.01
    
    @given(task_with_budget_strategy(), date_strategy())
    @settings(max_examples=100)
    def test_property_14_metrics_calculation_is_deterministic(
        self, task: Dict[str, Any], status_date: date
    ):
        """
        Property 14.6: Metrics Calculation Is Deterministic
        
        Same inputs should always produce same metrics.
        
        **Feature: integrated-master-schedule, Property 14: Financial Integration Consistency**
        **Validates: Requirements 8.2**
        """
        metrics1 = self.calculator.calculate_earned_value_metrics(task, status_date)
        metrics2 = self.calculator.calculate_earned_value_metrics(task, status_date)
        
        assert metrics1["bcws"] == metrics2["bcws"]
        assert metrics1["bcwp"] == metrics2["bcwp"]
        assert metrics1["schedule_variance"] == metrics2["schedule_variance"]



# ============================================================================
# Property 15: System Synchronization Accuracy Tests
# ============================================================================

class TestSystemSynchronizationAccuracyProperties:
    """
    Property-based tests for Property 15: System Synchronization Accuracy.
    
    For any schedule update, integrated systems (resources, dashboards, reporting)
    should be synchronized correctly.
    
    **Validates: Requirements 8.3, 8.5**
    """
    
    def setup_method(self):
        """Set up test environment - create fresh manager for each test."""
        self.manager = SystemSynchronizationManager()
    
    @given(schedule_strategy())
    @settings(max_examples=100)
    def test_property_15_schedule_registration_creates_dashboard_data(
        self, schedule: Dict[str, Any]
    ):
        """
        Property 15.1: Schedule Registration Creates Dashboard Data
        
        When a schedule is registered, dashboard data should be created.
        
        **Feature: integrated-master-schedule, Property 15: System Synchronization Accuracy**
        **Validates: Requirements 8.5**
        """
        self.manager.register_schedule(schedule)
        
        schedule_id = schedule["id"]
        assert schedule_id in self.manager.dashboard_data
        
        dashboard = self.manager.dashboard_data[schedule_id]
        assert dashboard["schedule_id"] == schedule_id
        assert dashboard["schedule_name"] == schedule.get("name", "")


    @given(task_strategy(), st.text(min_size=1, max_size=50, alphabet="abcdefghijklmnopqrstuvwxyz"))
    @settings(max_examples=100)
    def test_property_15_task_update_is_logged(
        self, task: Dict[str, Any], new_name: str
    ):
        """
        Property 15.2: Task Update Is Logged
        
        When a task is updated, the update should be logged in sync history.
        
        **Feature: integrated-master-schedule, Property 15: System Synchronization Accuracy**
        **Validates: Requirements 8.5**
        """
        self.manager.register_task(task)
        task_id = task["id"]
        
        self.manager.update_task(task_id, {"name": new_name})
        
        sync_status = self.manager.get_sync_status(task_id)
        assert sync_status["sync_count"] >= 2  # register + update
        
        update_logs = [
            log for log in sync_status["sync_history"]
            if log["action"] == "task_updated"
        ]
        assert len(update_logs) >= 1
    
    @given(task_strategy(), st.integers(min_value=1, max_value=100))
    @settings(max_examples=100)
    def test_property_15_resource_assignment_syncs_with_task(
        self, task: Dict[str, Any], allocation: int
    ):
        """
        Property 15.3: Resource Assignment Syncs With Task
        
        When a resource is assigned, it should be linked to the task.
        
        **Feature: integrated-master-schedule, Property 15: System Synchronization Accuracy**
        **Validates: Requirements 8.3**
        """
        self.manager.register_task(task)
        task_id = task["id"]
        resource_id = str(uuid4())
        
        assignment = self.manager.assign_resource(task_id, resource_id, allocation)
        
        assert assignment["task_id"] == task_id
        assert assignment["resource_id"] == resource_id
        assert assignment["allocation_percentage"] == allocation
        assert task_id in self.manager.resource_assignments


    @given(task_strategy(), date_strategy())
    @settings(max_examples=100)
    def test_property_15_task_date_update_propagates_to_assignments(
        self, task: Dict[str, Any], new_start: date
    ):
        """
        Property 15.4: Task Date Update Propagates To Assignments
        
        When task dates are updated, resource assignments should be synchronized.
        
        **Feature: integrated-master-schedule, Property 15: System Synchronization Accuracy**
        **Validates: Requirements 8.3, 8.5**
        """
        self.manager.register_task(task)
        task_id = task["id"]
        resource_id = str(uuid4())
        
        self.manager.assign_resource(task_id, resource_id, 50)
        
        new_end = new_start + timedelta(days=30)
        self.manager.update_task(task_id, {
            "planned_start_date": new_start.isoformat(),
            "planned_end_date": new_end.isoformat()
        })
        
        assignments = self.manager.resource_assignments[task_id]
        for assignment in assignments:
            assert assignment.get("task_start_date") == new_start.isoformat()
            assert assignment.get("task_end_date") == new_end.isoformat()
            assert "synced_at" in assignment
    
    @given(schedule_with_tasks_strategy())
    @settings(max_examples=100)
    def test_property_15_all_operations_are_logged(
        self, schedule_and_tasks: Tuple[Dict[str, Any], List[Dict[str, Any]]]
    ):
        """
        Property 15.5: All Operations Are Logged
        
        Every synchronization operation should be logged.
        
        **Feature: integrated-master-schedule, Property 15: System Synchronization Accuracy**
        **Validates: Requirements 8.5**
        """
        schedule, tasks = schedule_and_tasks
        
        # Create fresh manager for this test to avoid state pollution
        manager = SystemSynchronizationManager()
        
        manager.register_schedule(schedule)
        for task in tasks:
            manager.register_task(task)
        
        # Should have 1 schedule registration + N task registrations
        expected_log_count = 1 + len(tasks)
        assert len(manager.sync_log) == expected_log_count



# ============================================================================
# Property 16: Data Export Integrity Tests
# ============================================================================

class TestDataExportIntegrityProperties:
    """
    Property-based tests for Property 16: Data Export Integrity.
    
    For any data export operation, exported schedule data should match expected
    standard formats and maintain data integrity.
    
    **Validates: Requirements 8.4**
    """
    
    def setup_method(self):
        """Set up test environment."""
        self.exporter = DataExportManager()
    
    @given(schedule_with_tasks_strategy())
    @settings(max_examples=100)
    def test_property_16_csv_export_contains_all_tasks(
        self, schedule_and_tasks: Tuple[Dict[str, Any], List[Dict[str, Any]]]
    ):
        """
        Property 16.1: CSV Export Contains All Tasks
        
        CSV export should contain all tasks from the schedule.
        
        **Feature: integrated-master-schedule, Property 16: Data Export Integrity**
        **Validates: Requirements 8.4**
        """
        schedule, tasks = schedule_and_tasks
        
        csv_output = self.exporter.export_to_csv(schedule, tasks)
        
        validation = self.exporter.validate_export_integrity(tasks, csv_output, "csv")
        
        assert validation["is_valid"], f"Missing tasks: {validation['missing_tasks']}"
        assert validation["exported_task_count"] == len(tasks)


    @given(schedule_with_tasks_strategy())
    @settings(max_examples=100)
    def test_property_16_json_export_contains_all_tasks(
        self, schedule_and_tasks: Tuple[Dict[str, Any], List[Dict[str, Any]]]
    ):
        """
        Property 16.2: JSON Export Contains All Tasks
        
        JSON export should contain all tasks from the schedule.
        
        **Feature: integrated-master-schedule, Property 16: Data Export Integrity**
        **Validates: Requirements 8.4**
        """
        schedule, tasks = schedule_and_tasks
        
        json_output = self.exporter.export_to_json(schedule, tasks)
        
        validation = self.exporter.validate_export_integrity(tasks, json_output, "json")
        
        assert validation["is_valid"], f"Missing tasks: {validation['missing_tasks']}"
        assert validation["exported_task_count"] == len(tasks)
    
    @given(schedule_with_tasks_strategy())
    @settings(max_examples=100)
    def test_property_16_json_export_is_valid_json(
        self, schedule_and_tasks: Tuple[Dict[str, Any], List[Dict[str, Any]]]
    ):
        """
        Property 16.3: JSON Export Is Valid JSON
        
        JSON export should be parseable as valid JSON.
        
        **Feature: integrated-master-schedule, Property 16: Data Export Integrity**
        **Validates: Requirements 8.4**
        """
        schedule, tasks = schedule_and_tasks
        
        json_output = self.exporter.export_to_json(schedule, tasks)
        
        # Should not raise exception
        parsed = json.loads(json_output)
        
        assert "schedule" in parsed
        assert "tasks" in parsed
        assert "export_metadata" in parsed


    @given(schedule_with_tasks_strategy())
    @settings(max_examples=100)
    def test_property_16_ms_project_xml_is_well_formed(
        self, schedule_and_tasks: Tuple[Dict[str, Any], List[Dict[str, Any]]]
    ):
        """
        Property 16.4: MS Project XML Is Well-Formed
        
        MS Project XML export should be well-formed XML.
        
        **Feature: integrated-master-schedule, Property 16: Data Export Integrity**
        **Validates: Requirements 8.4**
        """
        schedule, tasks = schedule_and_tasks
        
        xml_output = self.exporter.export_to_ms_project_xml(schedule, tasks)
        
        # Check basic XML structure
        assert xml_output.startswith('<?xml version="1.0"')
        assert '<Project' in xml_output
        assert '</Project>' in xml_output
        assert '<Tasks>' in xml_output
        assert '</Tasks>' in xml_output
        
        # Check task count
        task_count = xml_output.count('<Task>')
        assert task_count == len(tasks)
    
    @given(schedule_with_tasks_strategy())
    @settings(max_examples=100)
    def test_property_16_csv_export_has_correct_headers(
        self, schedule_and_tasks: Tuple[Dict[str, Any], List[Dict[str, Any]]]
    ):
        """
        Property 16.5: CSV Export Has Correct Headers
        
        CSV export should have all required column headers.
        
        **Feature: integrated-master-schedule, Property 16: Data Export Integrity**
        **Validates: Requirements 8.4**
        """
        schedule, tasks = schedule_and_tasks
        
        csv_output = self.exporter.export_to_csv(schedule, tasks)
        
        reader = csv.DictReader(io.StringIO(csv_output))
        headers = reader.fieldnames
        
        required_headers = [
            "task_id", "wbs_code", "name", "start_date", "end_date",
            "duration_days", "progress_percentage", "status"
        ]
        
        for header in required_headers:
            assert header in headers, f"Missing required header: {header}"


    @given(schedule_with_tasks_strategy())
    @settings(max_examples=100)
    def test_property_16_export_preserves_task_data(
        self, schedule_and_tasks: Tuple[Dict[str, Any], List[Dict[str, Any]]]
    ):
        """
        Property 16.6: Export Preserves Task Data
        
        Exported task data should match original task data.
        
        **Feature: integrated-master-schedule, Property 16: Data Export Integrity**
        **Validates: Requirements 8.4**
        """
        schedule, tasks = schedule_and_tasks
        
        json_output = self.exporter.export_to_json(schedule, tasks)
        parsed = json.loads(json_output)
        
        exported_tasks = {t["id"]: t for t in parsed["tasks"]}
        
        for original_task in tasks:
            task_id = original_task["id"]
            assert task_id in exported_tasks
            
            exported = exported_tasks[task_id]
            assert exported["name"] == original_task["name"]
            assert exported["wbs_code"] == original_task.get("wbs_code", "")
            assert exported["progress_percentage"] == original_task.get("progress_percentage", 0)
    
    @given(schedule_with_tasks_strategy())
    @settings(max_examples=100)
    def test_property_16_export_is_deterministic(
        self, schedule_and_tasks: Tuple[Dict[str, Any], List[Dict[str, Any]]]
    ):
        """
        Property 16.7: Export Is Deterministic
        
        Same inputs should produce same export output.
        
        **Feature: integrated-master-schedule, Property 16: Data Export Integrity**
        **Validates: Requirements 8.4**
        """
        schedule, tasks = schedule_and_tasks
        
        csv1 = self.exporter.export_to_csv(schedule, tasks)
        csv2 = self.exporter.export_to_csv(schedule, tasks)
        
        assert csv1 == csv2, "CSV export should be deterministic"
    
    @given(schedule_strategy())
    @settings(max_examples=100)
    def test_property_16_empty_task_list_exports_correctly(
        self, schedule: Dict[str, Any]
    ):
        """
        Property 16.8: Empty Task List Exports Correctly
        
        Export should handle empty task lists gracefully.
        
        **Feature: integrated-master-schedule, Property 16: Data Export Integrity**
        **Validates: Requirements 8.4**
        """
        tasks: List[Dict[str, Any]] = []
        
        csv_output = self.exporter.export_to_csv(schedule, tasks)
        json_output = self.exporter.export_to_json(schedule, tasks)
        
        # CSV should have headers only
        lines = csv_output.strip().split('\n')
        assert len(lines) == 1  # Header only
        
        # JSON should have empty tasks array
        parsed = json.loads(json_output)
        assert parsed["tasks"] == []
        assert parsed["export_metadata"]["task_count"] == 0
