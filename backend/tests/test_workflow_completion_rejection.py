"""
Unit tests for Workflow Completion and Rejection Handling (Task 3.2)

Tests the workflow completion and rejection handling functionality:
- Completion logic when all approvals are obtained
- Rejection handling with configurable actions (stop, restart, escalate)

Requirements: 2.4, 2.5
"""

import pytest
from datetime import datetime, timedelta
from uuid import uuid4, UUID
from unittest.mock import Mock, AsyncMock, MagicMock, patch

from models.workflow import (
    WorkflowDefinition,
    WorkflowInstance,
    WorkflowApproval,
    WorkflowStep,
    WorkflowStatus,
    ApprovalStatus,
    ApprovalType,
    StepType,
    RejectionAction
)
from services.workflow_engine_core import WorkflowEngineCore
from services.workflow_repository import WorkflowRepository


class TestWorkflowCompletion:
    """
    Test workflow completion logic when all approvals are obtained.
    Validates Requirement 2.4: WHEN all required approvals are obtained, 
    THE Workflow_Engine SHALL mark the workflow instance as completed
    """
    
    @pytest.fixture
    def mock_db(self):
        """Create a mock database client"""
        db = Mock()
        db.table = Mock(return_value=Mock())
        return db
    
    @pytest.fixture
    def engine(self, mock_db):
        """Create a workflow engine with mock database"""
        return WorkflowEngineCore(mock_db)

    @pytest.mark.asyncio
    async def test_workflow_completes_when_all_approvals_obtained(self, engine):
        """Test that workflow is marked as completed when all approvals are obtained"""
        instance_id = uuid4()
        user_id = uuid4()
        
        # Mock instance at final step (step 1 of 2 steps, 0-indexed)
        instance_data = {
            "id": str(instance_id),
            "workflow_id": str(uuid4()),
            "current_step": 1,
            "status": WorkflowStatus.IN_PROGRESS.value
        }
        
        # Mock workflow with 2 steps
        workflow_data = {
            "id": str(uuid4()),
            "template_data": {
                "steps": [
                    {"step_order": 0, "name": "Step 0", "approvers": [], "approval_type": "all"},
                    {"step_order": 1, "name": "Step 1", "approvers": [], "approval_type": "all"}
                ]
            }
        }
        
        engine.repository.get_workflow_instance = AsyncMock(return_value=instance_data)
        engine.repository.get_workflow_for_instance = AsyncMock(return_value=workflow_data)
        engine.repository.update_workflow_instance = AsyncMock(return_value=instance_data)
        
        # Advance workflow from final step
        result = await engine._advance_workflow_step(instance_id, user_id)
        
        # Verify workflow was marked as completed
        assert result["status"] == WorkflowStatus.COMPLETED.value
        assert result["is_complete"] is True
        
        # Verify update was called with completed status and timestamp
        update_call = engine.repository.update_workflow_instance.call_args
        assert update_call[0][0] == instance_id
        assert update_call[0][1]["status"] == WorkflowStatus.COMPLETED.value
        assert "completed_at" in update_call[0][1]

    @pytest.mark.asyncio
    async def test_workflow_completion_sets_timestamp(self, engine):
        """Test that workflow completion sets completed_at timestamp"""
        instance_id = uuid4()
        user_id = uuid4()
        
        instance_data = {
            "id": str(instance_id),
            "workflow_id": str(uuid4()),
            "current_step": 0,
            "status": WorkflowStatus.IN_PROGRESS.value
        }
        
        # Single-step workflow
        workflow_data = {
            "id": str(uuid4()),
            "template_data": {
                "steps": [
                    {"step_order": 0, "name": "Only Step", "approvers": [], "approval_type": "all"}
                ]
            }
        }
        
        engine.repository.get_workflow_instance = AsyncMock(return_value=instance_data)
        engine.repository.get_workflow_for_instance = AsyncMock(return_value=workflow_data)
        engine.repository.update_workflow_instance = AsyncMock(return_value=instance_data)
        
        # Advance from only step
        before_time = datetime.utcnow()
        result = await engine._advance_workflow_step(instance_id, user_id)
        after_time = datetime.utcnow()
        
        # Verify completed_at timestamp was set
        update_call = engine.repository.update_workflow_instance.call_args
        completed_at_str = update_call[0][1]["completed_at"]
        completed_at = datetime.fromisoformat(completed_at_str)
        
        assert before_time <= completed_at <= after_time

    @pytest.mark.asyncio
    async def test_workflow_does_not_complete_before_final_step(self, engine):
        """Test that workflow does not complete before reaching final step"""
        instance_id = uuid4()
        user_id = uuid4()
        
        # Mock instance at step 0 of 3 steps
        instance_data = {
            "id": str(instance_id),
            "workflow_id": str(uuid4()),
            "current_step": 0,
            "status": WorkflowStatus.IN_PROGRESS.value
        }
        
        # Mock workflow with 3 steps
        workflow_data = {
            "id": str(uuid4()),
            "template_data": {
                "steps": [
                    {"step_order": 0, "name": "Step 0", "approvers": [], "approval_type": "all"},
                    {"step_order": 1, "name": "Step 1", "approvers": [], "approval_type": "all"},
                    {"step_order": 2, "name": "Step 2", "approvers": [], "approval_type": "all"}
                ]
            }
        }
        
        engine.repository.get_workflow_instance = AsyncMock(return_value=instance_data)
        engine.repository.get_workflow_for_instance = AsyncMock(return_value=workflow_data)
        engine.repository.update_workflow_instance = AsyncMock(return_value=instance_data)
        engine._create_approvals_for_step = AsyncMock()
        
        # Advance workflow
        result = await engine._advance_workflow_step(instance_id, user_id)
        
        # Verify workflow is still in progress
        assert result["status"] == WorkflowStatus.IN_PROGRESS.value
        assert result["is_complete"] is False
        assert result["current_step"] == 1


class TestRejectionHandlingStop:
    """
    Test rejection handling with STOP action.
    Validates Requirement 2.5: WHEN any approval is rejected, THE Workflow_Engine 
    SHALL handle rejection according to workflow configuration (stop)
    """
    
    @pytest.fixture
    def mock_db(self):
        """Create a mock database client"""
        db = Mock()
        db.table = Mock(return_value=Mock())
        return db
    
    @pytest.fixture
    def engine(self, mock_db):
        """Create a workflow engine with mock database"""
        return WorkflowEngineCore(mock_db)

    @pytest.mark.asyncio
    async def test_rejection_stop_marks_workflow_rejected(self, engine):
        """Test that STOP rejection action marks workflow as rejected"""
        instance_id = uuid4()
        step_number = 0
        rejected_by = uuid4()
        comments = "Budget concerns"
        
        # Mock workflow with STOP rejection action
        workflow_data = {
            "template_data": {
                "steps": [
                    {
                        "step_order": 0,
                        "name": "Approval Step",
                        "approvers": [],
                        "approval_type": "all",
                        "rejection_action": "stop"
                    }
                ]
            }
        }
        
        engine.repository.get_workflow_for_instance = AsyncMock(return_value=workflow_data)
        engine.repository.update_workflow_instance = AsyncMock()
        
        # Handle rejection
        await engine._handle_workflow_rejection(
            instance_id, step_number, rejected_by, comments
        )
        
        # Verify workflow was marked as rejected
        update_call = engine.repository.update_workflow_instance.call_args
        assert update_call[0][0] == instance_id
        assert update_call[0][1]["status"] == WorkflowStatus.REJECTED.value
        assert "cancelled_at" in update_call[0][1]
        assert "cancellation_reason" in update_call[0][1]
        assert str(rejected_by) in update_call[0][1]["cancellation_reason"]
        assert comments in update_call[0][1]["cancellation_reason"]

    @pytest.mark.asyncio
    async def test_rejection_stop_includes_rejection_details(self, engine):
        """Test that STOP rejection includes step number and comments"""
        instance_id = uuid4()
        step_number = 2
        rejected_by = uuid4()
        comments = "Insufficient justification"
        
        workflow_data = {
            "template_data": {
                "steps": [
                    {"step_order": 0, "name": "Step 0", "approvers": [], "approval_type": "all"},
                    {"step_order": 1, "name": "Step 1", "approvers": [], "approval_type": "all"},
                    {
                        "step_order": 2,
                        "name": "Step 2",
                        "approvers": [],
                        "approval_type": "all",
                        "rejection_action": "stop"
                    }
                ]
            }
        }
        
        engine.repository.get_workflow_for_instance = AsyncMock(return_value=workflow_data)
        engine.repository.update_workflow_instance = AsyncMock()
        
        # Handle rejection
        await engine._handle_workflow_rejection(
            instance_id, step_number, rejected_by, comments
        )
        
        # Verify cancellation reason includes all details
        update_call = engine.repository.update_workflow_instance.call_args
        cancellation_reason = update_call[0][1]["cancellation_reason"]
        
        assert f"step {step_number}" in cancellation_reason
        assert str(rejected_by) in cancellation_reason
        assert comments in cancellation_reason


class TestRejectionHandlingRestart:
    """
    Test rejection handling with RESTART action.
    Validates Requirement 2.5: WHEN any approval is rejected, THE Workflow_Engine 
    SHALL handle rejection according to workflow configuration (restart)
    """
    
    @pytest.fixture
    def mock_db(self):
        """Create a mock database client"""
        db = Mock()
        db.table = Mock(return_value=Mock())
        return db
    
    @pytest.fixture
    def engine(self, mock_db):
        """Create a workflow engine with mock database"""
        return WorkflowEngineCore(mock_db)

    @pytest.mark.asyncio
    async def test_rejection_restart_resets_to_beginning(self, engine):
        """Test that RESTART rejection action resets workflow to step 0"""
        instance_id = uuid4()
        step_number = 2
        rejected_by = uuid4()
        comments = "Need to reconsider from start"
        
        # Mock instance at step 2
        instance_data = {
            "id": str(instance_id),
            "workflow_id": str(uuid4()),
            "current_step": 2,
            "status": WorkflowStatus.IN_PROGRESS.value,
            "data": {}
        }
        
        # Mock workflow with RESTART rejection action
        workflow_data = {
            "template_data": {
                "steps": [
                    {"step_order": 0, "name": "Step 0", "approvers": [str(uuid4())], "approval_type": "all"},
                    {"step_order": 1, "name": "Step 1", "approvers": [str(uuid4())], "approval_type": "all"},
                    {
                        "step_order": 2,
                        "name": "Step 2",
                        "approvers": [str(uuid4())],
                        "approval_type": "all",
                        "rejection_action": "restart"
                    }
                ]
            }
        }
        
        engine.repository.get_workflow_for_instance = AsyncMock(return_value=workflow_data)
        engine.repository.get_workflow_instance = AsyncMock(return_value=instance_data)
        engine.repository.get_approvals_for_instance = AsyncMock(return_value=[])
        engine.repository.update_workflow_instance = AsyncMock()
        engine._create_approvals_for_step = AsyncMock()
        
        # Handle rejection with restart
        await engine._handle_workflow_rejection(
            instance_id, step_number, rejected_by, comments
        )
        
        # Verify workflow was reset to step 0
        update_call = engine.repository.update_workflow_instance.call_args
        assert update_call[0][0] == instance_id
        assert update_call[0][1]["current_step"] == 0
        assert update_call[0][1]["status"] == WorkflowStatus.IN_PROGRESS.value
        
        # Verify new approvals were created for first step
        engine._create_approvals_for_step.assert_called_once()

    @pytest.mark.asyncio
    async def test_rejection_restart_preserves_history(self, engine):
        """Test that RESTART rejection preserves restart history in context"""
        instance_id = uuid4()
        step_number = 1
        rejected_by = uuid4()
        comments = "Restart needed"
        
        instance_data = {
            "id": str(instance_id),
            "workflow_id": str(uuid4()),
            "current_step": 1,
            "status": WorkflowStatus.IN_PROGRESS.value,
            "data": {}
        }
        
        workflow_data = {
            "template_data": {
                "steps": [
                    {"step_order": 0, "name": "Step 0", "approvers": [str(uuid4())], "approval_type": "all"},
                    {
                        "step_order": 1,
                        "name": "Step 1",
                        "approvers": [str(uuid4())],
                        "approval_type": "all",
                        "rejection_action": "restart"
                    }
                ]
            }
        }
        
        engine.repository.get_workflow_for_instance = AsyncMock(return_value=workflow_data)
        engine.repository.get_workflow_instance = AsyncMock(return_value=instance_data)
        engine.repository.get_approvals_for_instance = AsyncMock(return_value=[])
        engine.repository.update_workflow_instance = AsyncMock()
        engine._create_approvals_for_step = AsyncMock()
        
        # Handle rejection with restart
        await engine._handle_workflow_rejection(
            instance_id, step_number, rejected_by, comments
        )
        
        # Verify restart history was added to context
        update_call = engine.repository.update_workflow_instance.call_args
        context = update_call[0][1]["data"]
        
        assert "restart_history" in context
        assert len(context["restart_history"]) == 1
        
        restart_entry = context["restart_history"][0]
        assert restart_entry["rejected_at_step"] == step_number
        assert restart_entry["rejected_by"] == str(rejected_by)
        assert restart_entry["comments"] == comments
        assert restart_entry["restart_count"] == 1

    @pytest.mark.asyncio
    async def test_rejection_restart_cancels_pending_approvals(self, engine):
        """Test that RESTART rejection cancels all pending approvals"""
        instance_id = uuid4()
        step_number = 1
        rejected_by = uuid4()
        
        instance_data = {
            "id": str(instance_id),
            "workflow_id": str(uuid4()),
            "current_step": 1,
            "status": WorkflowStatus.IN_PROGRESS.value,
            "data": {}
        }
        
        workflow_data = {
            "template_data": {
                "steps": [
                    {"step_order": 0, "name": "Step 0", "approvers": [str(uuid4())], "approval_type": "all"},
                    {
                        "step_order": 1,
                        "name": "Step 1",
                        "approvers": [str(uuid4())],
                        "approval_type": "all",
                        "rejection_action": "restart"
                    }
                ]
            }
        }
        
        # Mock pending approvals
        pending_approvals = [
            {"id": str(uuid4()), "status": ApprovalStatus.PENDING.value},
            {"id": str(uuid4()), "status": ApprovalStatus.PENDING.value},
            {"id": str(uuid4()), "status": ApprovalStatus.APPROVED.value}  # Already approved
        ]
        
        engine.repository.get_workflow_for_instance = AsyncMock(return_value=workflow_data)
        engine.repository.get_workflow_instance = AsyncMock(return_value=instance_data)
        engine.repository.get_approvals_for_instance = AsyncMock(return_value=pending_approvals)
        engine.repository.update_approval = AsyncMock()
        engine.repository.update_workflow_instance = AsyncMock()
        engine._create_approvals_for_step = AsyncMock()
        
        # Handle rejection with restart
        await engine._handle_workflow_rejection(
            instance_id, step_number, rejected_by, "Restart"
        )
        
        # Verify only pending approvals were cancelled (2 out of 3)
        assert engine.repository.update_approval.call_count == 2


class TestRejectionHandlingEscalate:
    """
    Test rejection handling with ESCALATE action.
    Validates Requirement 2.5: WHEN any approval is rejected, THE Workflow_Engine 
    SHALL handle rejection according to workflow configuration (escalate)
    """
    
    @pytest.fixture
    def mock_db(self):
        """Create a mock database client"""
        db = Mock()
        db.table = Mock(return_value=Mock())
        return db
    
    @pytest.fixture
    def engine(self, mock_db):
        """Create a workflow engine with mock database"""
        return WorkflowEngineCore(mock_db)

    @pytest.mark.asyncio
    async def test_rejection_escalate_creates_escalation_approvals(self, engine):
        """Test that ESCALATE rejection creates new approvals for escalation approvers"""
        instance_id = uuid4()
        step_number = 0
        rejected_by = uuid4()
        comments = "Escalate to senior management"
        
        # Escalation approvers
        escalation_approver_1 = uuid4()
        escalation_approver_2 = uuid4()
        
        instance_data = {
            "id": str(instance_id),
            "workflow_id": str(uuid4()),
            "current_step": 0,
            "status": WorkflowStatus.IN_PROGRESS.value,
            "data": {}
        }
        
        # Mock workflow with ESCALATE rejection action
        workflow_data = {
            "template_data": {
                "steps": [
                    {
                        "step_order": 0,
                        "name": "Manager Approval",
                        "approvers": [str(uuid4())],
                        "approval_type": "all",
                        "rejection_action": "escalate",
                        "escalation_approvers": [str(escalation_approver_1), str(escalation_approver_2)],
                        "timeout_hours": 48
                    }
                ]
            }
        }
        
        engine.repository.get_workflow_for_instance = AsyncMock(return_value=workflow_data)
        engine.repository.get_workflow_instance = AsyncMock(return_value=instance_data)
        engine.repository.get_approvals_for_instance = AsyncMock(return_value=[])
        engine.repository.update_workflow_instance = AsyncMock()
        engine.repository.create_approval = AsyncMock()
        
        # Handle rejection with escalation
        await engine._handle_workflow_rejection(
            instance_id, step_number, rejected_by, comments
        )
        
        # Verify escalation approvals were created
        assert engine.repository.create_approval.call_count == 2
        
        # Verify approvals have correct properties
        for call in engine.repository.create_approval.call_args_list:
            approval = call[0][0]
            assert approval.workflow_instance_id == instance_id
            assert approval.step_number == step_number
            assert "(Escalated)" in approval.step_name
            assert approval.status == ApprovalStatus.PENDING
            assert approval.expires_at is not None

    @pytest.mark.asyncio
    async def test_rejection_escalate_preserves_history(self, engine):
        """Test that ESCALATE rejection preserves escalation history"""
        instance_id = uuid4()
        step_number = 0
        rejected_by = uuid4()
        comments = "Escalate"
        
        escalation_approver = uuid4()
        
        instance_data = {
            "id": str(instance_id),
            "workflow_id": str(uuid4()),
            "current_step": 0,
            "status": WorkflowStatus.IN_PROGRESS.value,
            "data": {}
        }
        
        workflow_data = {
            "template_data": {
                "steps": [
                    {
                        "step_order": 0,
                        "name": "Approval",
                        "approvers": [str(uuid4())],
                        "approval_type": "all",
                        "rejection_action": "escalate",
                        "escalation_approvers": [str(escalation_approver)]
                    }
                ]
            }
        }
        
        engine.repository.get_workflow_for_instance = AsyncMock(return_value=workflow_data)
        engine.repository.get_workflow_instance = AsyncMock(return_value=instance_data)
        engine.repository.get_approvals_for_instance = AsyncMock(return_value=[])
        engine.repository.update_workflow_instance = AsyncMock()
        engine.repository.create_approval = AsyncMock()
        
        # Handle rejection with escalation
        await engine._handle_workflow_rejection(
            instance_id, step_number, rejected_by, comments
        )
        
        # Verify escalation history was added to context
        update_call = engine.repository.update_workflow_instance.call_args
        context = update_call[0][1]["data"]
        
        assert "escalation_history" in context
        assert len(context["escalation_history"]) == 1
        assert context["is_escalated"] is True
        
        escalation_entry = context["escalation_history"][0]
        assert escalation_entry["escalated_from_step"] == step_number
        assert escalation_entry["rejected_by"] == str(rejected_by)
        assert escalation_entry["comments"] == comments
        assert escalation_entry["escalation_count"] == 1

    @pytest.mark.asyncio
    async def test_rejection_escalate_cancels_current_step_approvals(self, engine):
        """Test that ESCALATE rejection cancels pending approvals for current step"""
        instance_id = uuid4()
        step_number = 0
        rejected_by = uuid4()
        
        escalation_approver = uuid4()
        
        instance_data = {
            "id": str(instance_id),
            "workflow_id": str(uuid4()),
            "current_step": 0,
            "status": WorkflowStatus.IN_PROGRESS.value,
            "data": {}
        }
        
        workflow_data = {
            "template_data": {
                "steps": [
                    {
                        "step_order": 0,
                        "name": "Approval",
                        "approvers": [str(uuid4())],
                        "approval_type": "all",
                        "rejection_action": "escalate",
                        "escalation_approvers": [str(escalation_approver)]
                    }
                ]
            }
        }
        
        # Mock pending approvals for current step
        pending_approvals = [
            {"id": str(uuid4()), "status": ApprovalStatus.PENDING.value},
            {"id": str(uuid4()), "status": ApprovalStatus.PENDING.value}
        ]
        
        engine.repository.get_workflow_for_instance = AsyncMock(return_value=workflow_data)
        engine.repository.get_workflow_instance = AsyncMock(return_value=instance_data)
        engine.repository.get_approvals_for_instance = AsyncMock(return_value=pending_approvals)
        engine.repository.update_approval = AsyncMock()
        engine.repository.update_workflow_instance = AsyncMock()
        engine.repository.create_approval = AsyncMock()
        
        # Handle rejection with escalation
        await engine._handle_workflow_rejection(
            instance_id, step_number, rejected_by, "Escalate"
        )
        
        # Verify pending approvals were cancelled
        assert engine.repository.update_approval.call_count == 2
        
        # Verify they were marked as expired
        for call in engine.repository.update_approval.call_args_list:
            assert call[0][1] == ApprovalStatus.EXPIRED.value

    @pytest.mark.asyncio
    async def test_rejection_escalate_falls_back_to_stop_if_no_escalators(self, engine):
        """Test that ESCALATE falls back to STOP if no escalation approvers configured"""
        instance_id = uuid4()
        step_number = 0
        rejected_by = uuid4()
        comments = "Escalate but no escalators"
        
        instance_data = {
            "id": str(instance_id),
            "workflow_id": str(uuid4()),
            "current_step": 0,
            "status": WorkflowStatus.IN_PROGRESS.value,
            "data": {}
        }
        
        # Mock workflow with ESCALATE but no escalation approvers
        workflow_data = {
            "template_data": {
                "steps": [
                    {
                        "step_order": 0,
                        "name": "Approval",
                        "approvers": [str(uuid4())],
                        "approval_type": "all",
                        "rejection_action": "escalate",
                        "escalation_approvers": [],  # No escalation approvers!
                        "escalation_roles": []
                    }
                ]
            }
        }
        
        engine.repository.get_workflow_for_instance = AsyncMock(return_value=workflow_data)
        engine.repository.get_workflow_instance = AsyncMock(return_value=instance_data)
        engine.repository.get_approvals_for_instance = AsyncMock(return_value=[])
        engine.repository.update_workflow_instance = AsyncMock()
        
        # Handle rejection with escalation (should fall back to stop)
        await engine._handle_workflow_rejection(
            instance_id, step_number, rejected_by, comments
        )
        
        # Verify workflow was stopped (rejected) instead
        update_call = engine.repository.update_workflow_instance.call_args
        assert update_call[0][1]["status"] == WorkflowStatus.REJECTED.value


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
