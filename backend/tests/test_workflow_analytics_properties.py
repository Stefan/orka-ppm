"""
Property-Based Tests for Workflow Analytics System

**Validates: Requirements 6.1, 6.2, 6.3, 6.5**

Property 20: Metrics Calculation Accuracy
For any workflow execution, metrics (duration, approval times, rejection rates)
must be calculated accurately and stored consistently.

Property 21: Report Data Integrity
For any workflow report generation, the data must be complete, accurate,
and properly formatted for analysis.

This test suite uses Hypothesis to generate random workflow data and verify
that analytics calculations are correct and reports maintain data integrity.
"""

import pytest
from hypothesis import given, strategies as st, settings, assume, HealthCheck
from datetime import datetime, timedelta
from uuid import uuid4, UUID
from unittest.mock import Mock, AsyncMock, patch
from decimal import Decimal

from services.workflow_analytics_service import WorkflowAnalyticsService
from services.workflow_reporting_service import WorkflowReportingService


# ==================== Hypothesis Strategies ====================

@st.composite
def datetime_strategy(draw, min_date=None, max_date=None):
    """Generate valid datetime objects"""
    if min_date is None:
        min_date = datetime(2024, 1, 1)
    if max_date is None:
        max_date = datetime.utcnow()
    
    timestamp = draw(st.datetimes(
        min_value=min_date,
        max_value=max_date
    ))
    return timestamp


@st.composite
def workflow_approval_strategy(draw, created_at=None):
    """Generate valid workflow approval data"""
    if created_at is None:
        created_at = draw(datetime_strategy())
    
    status = draw(st.sampled_from(["approved", "rejected", "pending"]))
    
    # Generate approved_at only for non-pending approvals
    if status != "pending":
        # Approval time is between 1 hour and 7 days after creation
        hours_delay = draw(st.floats(min_value=1.0, max_value=168.0))
        approved_at = created_at + timedelta(hours=hours_delay)
    else:
        approved_at = None
    
    return {
        "id": str(uuid4()),
        "workflow_instance_id": str(uuid4()),
        "step_number": draw(st.integers(min_value=0, max_value=5)),
        "approver_id": str(uuid4()),
        "status": status,
        "comments": draw(st.one_of(
            st.none(),
            st.text(min_size=0, max_size=500)
        )),
        "created_at": created_at.isoformat(),
        "approved_at": approved_at.isoformat() if approved_at else None,
        "updated_at": (approved_at or created_at).isoformat()
    }


@st.composite
def workflow_instance_strategy(draw):
    """Generate valid workflow instance data"""
    started_at = draw(datetime_strategy())
    status = draw(st.sampled_from(["pending", "in_progress", "completed", "rejected"]))
    
    # Generate completed_at only for completed/rejected workflows
    if status in ["completed", "rejected"]:
        # Workflow duration is between 1 hour and 30 days
        hours_duration = draw(st.floats(min_value=1.0, max_value=720.0))
        completed_at = started_at + timedelta(hours=hours_duration)
    else:
        completed_at = None
    
    return {
        "id": str(uuid4()),
        "workflow_id": str(uuid4()),
        "entity_type": draw(st.sampled_from(["project", "change_request", "budget", "resource"])),
        "entity_id": str(uuid4()),
        "current_step": draw(st.integers(min_value=0, max_value=5)),
        "status": status,
        "data": {
            "organization_id": str(uuid4()),
            "initiator_id": str(uuid4()),
            "initiated_at": started_at.isoformat()
        },
        "started_by": str(uuid4()),
        "started_at": started_at.isoformat(),
        "completed_at": completed_at.isoformat() if completed_at else None,
        "created_at": started_at.isoformat(),
        "updated_at": (completed_at or started_at).isoformat()
    }


@st.composite
def workflow_with_approvals_strategy(draw):
    """Generate workflow instance with associated approvals"""
    instance = draw(workflow_instance_strategy())
    
    # Generate approvals for each step
    num_steps = instance["current_step"] + 1
    approvals = []
    
    started_at = datetime.fromisoformat(instance["started_at"].replace("Z", "+00:00"))
    
    for step_num in range(num_steps):
        # Generate 1-3 approvals per step
        num_approvals = draw(st.integers(min_value=1, max_value=3))
        
        for _ in range(num_approvals):
            # Approvals created after workflow start
            approval_created = started_at + timedelta(hours=step_num * 24)
            approval = draw(workflow_approval_strategy(created_at=approval_created))
            approval["workflow_instance_id"] = instance["id"]
            approval["step_number"] = step_num
            approvals.append(approval)
    
    return instance, approvals


# ==================== Property Tests ====================

class TestWorkflowMetricsCalculationProperty:
    """
    Property-Based Tests for Workflow Metrics Calculation
    
    Feature: workflow-engine, Property 20: Metrics Calculation Accuracy
    **Validates: Requirements 6.1, 6.2**
    """
    
    @pytest.fixture
    def mock_db(self):
        """Create a mock database client"""
        db = Mock()
        db.table = Mock(return_value=Mock())
        return db
    
    @pytest.fixture
    def analytics_service(self, mock_db):
        """Create analytics service with mock database"""
        with patch('services.workflow_analytics_service.supabase', mock_db):
            return WorkflowAnalyticsService()
    
    @given(workflow_data=workflow_with_approvals_strategy())
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    @pytest.mark.asyncio
    async def test_workflow_duration_calculation_accuracy(
        self,
        workflow_data,
        mock_db
    ):
        """
        Property 20.1: Workflow duration must be calculated accurately
        
        For any workflow with start and end times, the calculated duration
        must match the actual time difference.
        
        **Validates: Requirements 6.1**
        """
        instance, approvals = workflow_data
        organization_id = instance["data"]["organization_id"]
        
        # Mock database responses
        mock_instance_result = Mock()
        mock_instance_result.data = [instance]
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_instance_result
        
        mock_approvals_result = Mock()
        mock_approvals_result.data = approvals
        mock_db.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value = mock_approvals_result
        
        # Create service and collect metrics
        with patch('services.workflow_analytics_service.supabase', mock_db):
            service = WorkflowAnalyticsService()
            metrics = await service.collect_workflow_metrics(instance["id"], organization_id)
        
        # Calculate expected duration
        started_at = datetime.fromisoformat(instance["started_at"].replace("Z", "+00:00"))
        
        if instance.get("completed_at"):
            completed_at = datetime.fromisoformat(instance["completed_at"].replace("Z", "+00:00"))
            expected_duration = (completed_at - started_at).total_seconds() / 3600
        else:
            # For in-progress workflows, duration is from start to now
            expected_duration = (datetime.utcnow() - started_at).total_seconds() / 3600
        
        # Property: Calculated duration must match expected duration (within 1 hour tolerance for in-progress)
        if instance.get("completed_at"):
            assert abs(metrics["total_duration_hours"] - expected_duration) < 0.01, \
                f"Duration mismatch: calculated={metrics['total_duration_hours']}, expected={expected_duration}"
        else:
            # For in-progress workflows, allow up to 1 hour difference due to timing
            assert abs(metrics["total_duration_hours"] - expected_duration) < 1.0
    
    @given(workflow_data=workflow_with_approvals_strategy())
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    @pytest.mark.asyncio
    async def test_approval_rate_calculation_accuracy(
        self,
        workflow_data,
        mock_db
    ):
        """
        Property 20.2: Approval and rejection rates must be calculated accurately
        
        For any set of approvals, the calculated rates must match the actual
        proportion of approved/rejected approvals.
        
        **Validates: Requirements 6.1**
        """
        instance, approvals = workflow_data
        organization_id = instance["data"]["organization_id"]
        
        # Mock database responses
        mock_instance_result = Mock()
        mock_instance_result.data = [instance]
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_instance_result
        
        mock_approvals_result = Mock()
        mock_approvals_result.data = approvals
        mock_db.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value = mock_approvals_result
        
        # Create service and collect metrics
        with patch('services.workflow_analytics_service.supabase', mock_db):
            service = WorkflowAnalyticsService()
            metrics = await service.collect_workflow_metrics(instance["id"], organization_id)
        
        # Calculate expected rates
        total_approvals = len(approvals)
        approved_count = sum(1 for a in approvals if a["status"] == "approved")
        rejected_count = sum(1 for a in approvals if a["status"] == "rejected")
        
        expected_approval_rate = approved_count / total_approvals if total_approvals > 0 else 0
        expected_rejection_rate = rejected_count / total_approvals if total_approvals > 0 else 0
        
        # Property: Calculated rates must match expected rates
        assert abs(metrics["approval_metrics"]["approval_rate"] - expected_approval_rate) < 0.0001, \
            f"Approval rate mismatch: calculated={metrics['approval_metrics']['approval_rate']}, expected={expected_approval_rate}"
        
        assert abs(metrics["approval_metrics"]["rejection_rate"] - expected_rejection_rate) < 0.0001, \
            f"Rejection rate mismatch: calculated={metrics['approval_metrics']['rejection_rate']}, expected={expected_rejection_rate}"
        
        # Property: Rates must sum to less than or equal to 1.0 (accounting for pending)
        total_rate = metrics["approval_metrics"]["approval_rate"] + metrics["approval_metrics"]["rejection_rate"]
        assert total_rate <= 1.0, f"Total rate exceeds 1.0: {total_rate}"
    
    @given(workflow_data=workflow_with_approvals_strategy())
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    @pytest.mark.asyncio
    async def test_approval_response_time_calculation(
        self,
        workflow_data,
        mock_db
    ):
        """
        Property 20.3: Approval response times must be calculated accurately
        
        For any approval with creation and approval timestamps, the calculated
        response time must match the actual time difference.
        
        **Validates: Requirements 6.2**
        """
        instance, approvals = workflow_data
        organization_id = instance["data"]["organization_id"]
        
        # Mock database responses
        mock_instance_result = Mock()
        mock_instance_result.data = [instance]
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_instance_result
        
        mock_approvals_result = Mock()
        mock_approvals_result.data = approvals
        mock_db.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value = mock_approvals_result
        
        # Create service and collect metrics
        with patch('services.workflow_analytics_service.supabase', mock_db):
            service = WorkflowAnalyticsService()
            metrics = await service.collect_workflow_metrics(instance["id"], organization_id)
        
        # Verify response times for each step
        for step_metric in metrics["step_metrics"]:
            step_num = step_metric["step_number"]
            
            # Get approvals for this step
            step_approvals = [a for a in approvals if a["step_number"] == step_num]
            
            # Calculate expected average response time
            response_times = []
            for approval in step_approvals:
                if approval["approved_at"]:
                    created_at = datetime.fromisoformat(approval["created_at"].replace("Z", "+00:00"))
                    approved_at = datetime.fromisoformat(approval["approved_at"].replace("Z", "+00:00"))
                    response_time = (approved_at - created_at).total_seconds() / 3600
                    response_times.append(response_time)
            
            if response_times:
                expected_avg = sum(response_times) / len(response_times)
                
                # Property: Calculated average response time must match expected
                assert abs(step_metric["avg_response_time_hours"] - expected_avg) < 0.01, \
                    f"Step {step_num} response time mismatch: calculated={step_metric['avg_response_time_hours']}, expected={expected_avg}"
    
    @given(workflow_data=workflow_with_approvals_strategy())
    @settings(
        max_examples=50,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    @pytest.mark.asyncio
    async def test_metrics_consistency_property(
        self,
        workflow_data,
        mock_db
    ):
        """
        Property 20.4: Metrics must be internally consistent
        
        For any workflow metrics, the sum of status counts must equal total
        approvals, and all calculated values must be non-negative.
        
        **Validates: Requirements 6.1**
        """
        instance, approvals = workflow_data
        organization_id = instance["data"]["organization_id"]
        
        # Mock database responses
        mock_instance_result = Mock()
        mock_instance_result.data = [instance]
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_instance_result
        
        mock_approvals_result = Mock()
        mock_approvals_result.data = approvals
        mock_db.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value = mock_approvals_result
        
        # Create service and collect metrics
        with patch('services.workflow_analytics_service.supabase', mock_db):
            service = WorkflowAnalyticsService()
            metrics = await service.collect_workflow_metrics(instance["id"], organization_id)
        
        approval_metrics = metrics["approval_metrics"]
        
        # Property: Sum of status counts must equal total approvals
        status_sum = (
            approval_metrics["approved_count"] +
            approval_metrics["rejected_count"] +
            approval_metrics["pending_count"]
        )
        assert status_sum == approval_metrics["total_approvals"], \
            f"Status count mismatch: sum={status_sum}, total={approval_metrics['total_approvals']}"
        
        # Property: All counts must be non-negative
        assert approval_metrics["total_approvals"] >= 0
        assert approval_metrics["approved_count"] >= 0
        assert approval_metrics["rejected_count"] >= 0
        assert approval_metrics["pending_count"] >= 0
        
        # Property: All rates must be between 0 and 1
        assert 0 <= approval_metrics["approval_rate"] <= 1
        assert 0 <= approval_metrics["rejection_rate"] <= 1
        
        # Property: All time values must be non-negative
        assert metrics["total_duration_hours"] >= 0
        assert approval_metrics["avg_approval_time_hours"] >= 0


class TestWorkflowReportDataIntegrityProperty:
    """
    Property-Based Tests for Workflow Report Data Integrity
    
    Feature: workflow-engine, Property 21: Report Data Integrity
    **Validates: Requirements 6.3, 6.5**
    """
    
    @pytest.fixture
    def mock_db(self):
        """Create a mock database client"""
        db = Mock()
        db.table = Mock(return_value=Mock())
        return db
    
    @pytest.fixture
    def reporting_service(self, mock_db):
        """Create reporting service with mock database"""
        with patch('services.workflow_reporting_service.supabase', mock_db):
            return WorkflowReportingService()
    
    @given(
        instances=st.lists(
            workflow_instance_strategy(),
            min_size=1,
            max_size=20
        )
    )
    @settings(
        max_examples=50,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    @pytest.mark.asyncio
    async def test_usage_report_data_completeness(
        self,
        instances,
        mock_db
    ):
        """
        Property 21.1: Usage reports must contain complete data
        
        For any set of workflow instances, the generated usage report must
        include all instances and accurately summarize their status distribution.
        
        **Validates: Requirements 6.3**
        """
        # Ensure all instances have the same organization
        organization_id = str(uuid4())
        for instance in instances:
            instance["data"]["organization_id"] = organization_id
        
        # Mock database response
        mock_result = Mock()
        mock_result.data = instances
        mock_db.table.return_value.select.return_value.gte.return_value.lte.return_value.execute.return_value = mock_result
        
        # Create service and generate report
        with patch('services.workflow_reporting_service.supabase', mock_db):
            service = WorkflowReportingService()
            report = await service.generate_usage_pattern_report(organization_id)
        
        # Property: Report must include all instances
        assert report["total_workflows"] == len(instances), \
            f"Instance count mismatch: report={report['total_workflows']}, actual={len(instances)}"
        
        # Property: Status distribution must match actual counts
        expected_status_counts = {
            "completed": sum(1 for i in instances if i["status"] == "completed"),
            "rejected": sum(1 for i in instances if i["status"] == "rejected"),
            "pending": sum(1 for i in instances if i["status"] == "pending"),
            "in_progress": sum(1 for i in instances if i["status"] == "in_progress")
        }
        
        for status, expected_count in expected_status_counts.items():
            actual_count = report["status_distribution"].get(status, 0)
            assert actual_count == expected_count, \
                f"Status count mismatch for {status}: report={actual_count}, expected={expected_count}"
        
        # Property: Sum of status counts must equal total workflows
        status_sum = sum(report["status_distribution"].values())
        assert status_sum == len(instances)
    
    @given(
        instances=st.lists(
            workflow_instance_strategy(),
            min_size=5,
            max_size=30
        )
    )
    @settings(
        max_examples=50,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    @pytest.mark.asyncio
    async def test_export_data_integrity(
        self,
        instances,
        mock_db
    ):
        """
        Property 21.2: Exported data must maintain integrity
        
        For any workflow data export, all instances must be included and
        data must be properly formatted without loss.
        
        **Validates: Requirements 6.5**
        """
        # Ensure all instances have the same organization
        organization_id = str(uuid4())
        for instance in instances:
            instance["data"]["organization_id"] = organization_id
            # Add workflow name for export
            instance["workflows"] = {"name": f"Workflow-{instance['workflow_id'][:8]}"}
        
        # Mock database response
        mock_result = Mock()
        mock_result.data = instances
        mock_db.table.return_value.select.return_value.gte.return_value.lte.return_value.execute.return_value = mock_result
        
        # Mock approvals query (empty for simplicity)
        mock_approvals_result = Mock()
        mock_approvals_result.data = []
        
        # Create service and export data
        with patch('services.workflow_reporting_service.supabase', mock_db):
            service = WorkflowReportingService()
            
            # Test JSON export
            json_export = await service.export_workflow_data(
                organization_id,
                format="json",
                include_approvals=False
            )
            
            # Property: JSON export must include all instances
            assert json_export["record_count"] == len(instances), \
                f"JSON export count mismatch: exported={json_export['record_count']}, actual={len(instances)}"
            
            assert len(json_export["data"]) == len(instances), \
                f"JSON data length mismatch: exported={len(json_export['data'])}, actual={len(instances)}"
            
            # Property: Each exported instance must have required fields
            required_fields = [
                "instance_id", "workflow_id", "workflow_name", "entity_type",
                "status", "started_at", "created_at"
            ]
            
            for exported_instance in json_export["data"]:
                for field in required_fields:
                    assert field in exported_instance, \
                        f"Missing required field '{field}' in exported instance"
            
            # Test CSV export
            csv_export = await service.export_workflow_data(
                organization_id,
                format="csv",
                include_approvals=False
            )
            
            # Property: CSV export must include all instances
            assert csv_export["record_count"] == len(instances), \
                f"CSV export count mismatch: exported={csv_export['record_count']}, actual={len(instances)}"
            
            # Property: CSV data must not be empty
            assert len(csv_export["data"]) > 0, "CSV export data is empty"
            
            # Property: CSV must have header row
            csv_lines = csv_export["data"].strip().split('\n')
            assert len(csv_lines) >= 1, "CSV must have at least a header row"
    
    @given(
        instances=st.lists(
            workflow_instance_strategy(),
            min_size=10,
            max_size=50
        )
    )
    @settings(
        max_examples=30,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    @pytest.mark.asyncio
    async def test_performance_trend_report_accuracy(
        self,
        instances,
        mock_db
    ):
        """
        Property 21.3: Performance trend reports must accurately reflect data
        
        For any set of workflow instances, performance trends must be
        calculated correctly based on actual completion data.
        
        **Validates: Requirements 6.3**
        """
        # Ensure all instances have the same organization
        organization_id = str(uuid4())
        for instance in instances:
            instance["data"]["organization_id"] = organization_id
        
        # Mock database response
        mock_result = Mock()
        mock_result.data = instances
        mock_db.table.return_value.select.return_value.gte.return_value.lte.return_value.execute.return_value = mock_result
        
        # Create service and generate report
        with patch('services.workflow_reporting_service.supabase', mock_db):
            service = WorkflowReportingService()
            report = await service.generate_performance_trend_report(organization_id)
        
        # Property: Report must include all instances
        assert report["total_instances"] == len(instances), \
            f"Instance count mismatch: report={report['total_instances']}, actual={len(instances)}"
        
        # Property: Overall metrics must match actual data
        total_completed = sum(1 for i in instances if i["status"] == "completed")
        total_rejected = sum(1 for i in instances if i["status"] == "rejected")
        
        assert report["overall_metrics"]["total_completed"] == total_completed
        assert report["overall_metrics"]["total_rejected"] == total_rejected
        
        # Property: Completion rate must be between 0 and 1
        assert 0 <= report["overall_metrics"]["completion_rate"] <= 1
        assert 0 <= report["overall_metrics"]["rejection_rate"] <= 1
        
        # Property: Weekly metrics must sum to total instances
        if report["weekly_metrics"]:
            weekly_sum = sum(w["instance_count"] for w in report["weekly_metrics"])
            assert weekly_sum == len(instances), \
                f"Weekly metrics sum mismatch: sum={weekly_sum}, total={len(instances)}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--hypothesis-show-statistics"])
