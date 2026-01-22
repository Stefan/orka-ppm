"""
Unit tests for Workflow Instance Execution Logic (Task 3.1)

Tests the core workflow instance execution functionality:
- Workflow instance creation with proper initialization
- Step-by-step execution with sequence enforcement
- Approval decision processing and state transitions

Requirements: 2.1, 2.2, 2.3
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
    StepType
)
from services.workflow_engine_core import WorkflowEngineCore
from services.workflow_repository import WorkflowRepository


class TestWorkflowInstanceCreation:
    """
    Test workflow instance creation with proper initialization.
    Validates Requirement 2.1: WHEN initiating a workflow, THE Workflow_Engine 
    SHALL create a workflow instance with initial status and metadata
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
    async def test_create_instance_with_valid_workflow(self, engine):
        """Test creating a workflow instance with a valid workflow definition"""
        workflow_id = uuid4()
        entity_id = uuid4()
        initiated_by = uuid4()
        
        # Mock workflow definition
        workflow_data = {
            "id": str(workflow_id),
            "name": "Test Workflow",
            "status": WorkflowStatus.ACTIVE.value,
            "template_data": {
                "version": 1,
                "steps": [
                    {
                        "step_order": 0,
                        "step_type": "approval",
                        "name": "Manager Approval",
                        "approvers": [str(uuid4())],
                        "approval_type": "all"
                    }
                ]
            }
        }
        
        # Mock instance creation
        instance_data = {
            "id": str(uuid4()),
            "workflow_id": str(workflow_id),
            "entity_type": "financial_tracking",
            "entity_id": str(entity_id),
            "current_step": 0,
            "status": WorkflowStatus.PENDING.value,
            "data": {"workflow_version": 1},
            "started_by": str(initiated_by),
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        # Setup mocks
        engine.repository.get_workflow = AsyncMock(return_value=workflow_data)
        engine.repository.create_workflow_instance_with_version = AsyncMock(return_value=instance_data)
        engine.repository.update_workflow_instance = AsyncMock(return_value=instance_data)
        engine._create_approvals_for_step = AsyncMock()
        
        # Create instance
        instance = await engine.create_workflow_instance(
            workflow_id=workflow_id,
            entity_type="financial_tracking",
            entity_id=entity_id,
            initiated_by=initiated_by,
            context={"test": "data"}
        )
        
        # Verify instance was created with proper initialization
        assert instance is not None
        assert instance.workflow_id == workflow_id
        assert instance.entity_type == "financial_tracking"
        assert instance.entity_id == entity_id
        assert instance.current_step == 0
        assert instance.status == WorkflowStatus.IN_PROGRESS
        assert instance.initiated_by == initiated_by
        assert "workflow_version" in instance.context
        
        # Verify repository methods were called
        engine.repository.get_workflow.assert_called_once_with(workflow_id)
        engine.repository.create_workflow_instance_with_version.assert_called_once()
        engine._create_approvals_for_step.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_create_instance_validates_workflow_exists(self, engine):
        """Test that instance creation validates workflow exists"""
        workflow_id = uuid4()
        entity_id = uuid4()
        initiated_by = uuid4()
        
        # Mock workflow not found
        engine.repository.get_workflow = AsyncMock(return_value=None)
        
        # Attempt to create instance
        with pytest.raises(ValueError, match="not found"):
            await engine.create_workflow_instance(
                workflow_id=workflow_id,
                entity_type="test",
                entity_id=entity_id,
                initiated_by=initiated_by
            )
    
    @pytest.mark.asyncio
    async def test_create_instance_validates_workflow_active(self, engine):
        """Test that instance creation validates workflow is active"""
        workflow_id = uuid4()
        entity_id = uuid4()
        initiated_by = uuid4()
        
        # Mock inactive workflow
        workflow_data = {
            "id": str(workflow_id),
            "name": "Inactive Workflow",
            "status": WorkflowStatus.DRAFT.value,
            "template_data": {"steps": []}
        }
        
        engine.repository.get_workflow = AsyncMock(return_value=workflow_data)
        
        # Attempt to create instance
        with pytest.raises(ValueError, match="not active"):
            await engine.create_workflow_instance(
                workflow_id=workflow_id,
                entity_type="test",
                entity_id=entity_id,
                initiated_by=initiated_by
            )
    
    @pytest.mark.asyncio
    async def test_create_instance_validates_workflow_has_steps(self, engine):
        """Test that instance creation validates workflow has steps"""
        workflow_id = uuid4()
        entity_id = uuid4()
        initiated_by = uuid4()
        
        # Mock workflow with no steps
        workflow_data = {
            "id": str(workflow_id),
            "name": "Empty Workflow",
            "status": WorkflowStatus.ACTIVE.value,
            "template_data": {"steps": []}
        }
        
        engine.repository.get_workflow = AsyncMock(return_value=workflow_data)
        
        # Attempt to create instance
        with pytest.raises(ValueError, match="no steps"):
            await engine.create_workflow_instance(
                workflow_id=workflow_id,
                entity_type="test",
                entity_id=entity_id,
                initiated_by=initiated_by
            )
    
    @pytest.mark.asyncio
    async def test_create_instance_stores_workflow_version(self, engine):
        """Test that instance creation stores workflow version for consistency"""
        workflow_id = uuid4()
        entity_id = uuid4()
        initiated_by = uuid4()
        
        # Mock workflow with version 3
        workflow_data = {
            "id": str(workflow_id),
            "name": "Versioned Workflow",
            "status": WorkflowStatus.ACTIVE.value,
            "template_data": {
                "version": 3,
                "steps": [
                    {
                        "step_order": 0,
                        "step_type": "approval",
                        "name": "Approval",
                        "approvers": [str(uuid4())],
                        "approval_type": "all"
                    }
                ]
            }
        }
        
        instance_data = {
            "id": str(uuid4()),
            "workflow_id": str(workflow_id),
            "entity_type": "test",
            "entity_id": str(entity_id),
            "current_step": 0,
            "status": WorkflowStatus.PENDING.value,
            "data": {"workflow_version": 3},
            "started_by": str(initiated_by),
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        engine.repository.get_workflow = AsyncMock(return_value=workflow_data)
        engine.repository.create_workflow_instance_with_version = AsyncMock(return_value=instance_data)
        engine.repository.update_workflow_instance = AsyncMock(return_value=instance_data)
        engine._create_approvals_for_step = AsyncMock()
        
        # Create instance
        instance = await engine.create_workflow_instance(
            workflow_id=workflow_id,
            entity_type="test",
            entity_id=entity_id,
            initiated_by=initiated_by
        )
        
        # Verify version was stored
        assert instance.context["workflow_version"] == 3
        
        # Verify repository was called with correct version
        call_args = engine.repository.create_workflow_instance_with_version.call_args
        assert call_args[0][1] == 3  # Second argument is workflow_version


class TestStepByStepExecution:
    """
    Test step-by-step execution with sequence enforcement.
    Validates Requirement 2.2: WHEN processing approval steps, THE Workflow_Engine 
    SHALL enforce the defined sequence and approval requirements
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
    async def test_advance_workflow_enforces_sequence(self, engine):
        """Test that workflow advancement enforces step sequence"""
        instance_id = uuid4()
        user_id = uuid4()
        
        # Mock instance at step 0
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
        
        # Verify step was incremented
        assert result["current_step"] == 1
        assert result["status"] == WorkflowStatus.IN_PROGRESS.value
        assert result["is_complete"] is False
        
        # Verify update was called with next step
        update_call = engine.repository.update_workflow_instance.call_args
        assert update_call[0][0] == instance_id
        assert update_call[0][1]["current_step"] == 1
    
    @pytest.mark.asyncio
    async def test_advance_workflow_completes_at_final_step(self, engine):
        """Test that workflow completes when advancing from final step"""
        instance_id = uuid4()
        user_id = uuid4()
        
        # Mock instance at final step (step 1 of 2 steps)
        instance_data = {
            "id": str(instance_id),
            "workflow_id": str(uuid4()),
            "current_step": 1,
            "status": WorkflowStatus.IN_PROGRESS.value
        }
        
        # Mock workflow with 2 steps (0 and 1)
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
        
        # Verify workflow was completed
        assert result["status"] == WorkflowStatus.COMPLETED.value
        assert result["is_complete"] is True
        
        # Verify update was called with completed status
        update_call = engine.repository.update_workflow_instance.call_args
        assert update_call[0][1]["status"] == WorkflowStatus.COMPLETED.value
        assert "completed_at" in update_call[0][1]
    
    @pytest.mark.asyncio
    async def test_check_step_completion_with_all_approval_type(self, engine):
        """Test step completion check with ALL approval type"""
        instance_id = uuid4()
        step_number = 0
        
        # Mock workflow with ALL approval type
        workflow_data = {
            "template_data": {
                "steps": [
                    {
                        "step_order": 0,
                        "name": "Step 0",
                        "approvers": [str(uuid4()), str(uuid4())],
                        "approval_type": "all"
                    }
                ]
            }
        }
        
        # Mock 2 approvals, both approved
        approvals = [
            {"id": str(uuid4()), "status": ApprovalStatus.APPROVED.value},
            {"id": str(uuid4()), "status": ApprovalStatus.APPROVED.value}
        ]
        
        engine.repository.get_approvals_for_instance = AsyncMock(return_value=approvals)
        engine.repository.get_workflow_for_instance = AsyncMock(return_value=workflow_data)
        
        # Check step completion
        is_complete = await engine._check_step_completion(instance_id, step_number)
        
        # Verify step is complete (all approvals approved)
        assert is_complete is True
    
    @pytest.mark.asyncio
    async def test_check_step_completion_with_any_approval_type(self, engine):
        """Test step completion check with ANY approval type"""
        instance_id = uuid4()
        step_number = 0
        
        # Mock workflow with ANY approval type
        workflow_data = {
            "template_data": {
                "steps": [
                    {
                        "step_order": 0,
                        "name": "Step 0",
                        "approvers": [str(uuid4()), str(uuid4())],
                        "approval_type": "any"
                    }
                ]
            }
        }
        
        # Mock 2 approvals, only one approved
        approvals = [
            {"id": str(uuid4()), "status": ApprovalStatus.APPROVED.value},
            {"id": str(uuid4()), "status": ApprovalStatus.PENDING.value}
        ]
        
        engine.repository.get_approvals_for_instance = AsyncMock(return_value=approvals)
        engine.repository.get_workflow_for_instance = AsyncMock(return_value=workflow_data)
        
        # Check step completion
        is_complete = await engine._check_step_completion(instance_id, step_number)
        
        # Verify step is complete (any one approval is enough)
        assert is_complete is True
    
    @pytest.mark.asyncio
    async def test_check_step_completion_with_majority_approval_type(self, engine):
        """Test step completion check with MAJORITY approval type"""
        instance_id = uuid4()
        step_number = 0
        
        # Mock workflow with MAJORITY approval type
        workflow_data = {
            "template_data": {
                "steps": [
                    {
                        "step_order": 0,
                        "name": "Step 0",
                        "approvers": [str(uuid4()), str(uuid4()), str(uuid4())],
                        "approval_type": "majority"
                    }
                ]
            }
        }
        
        # Mock 3 approvals, 2 approved (majority)
        approvals = [
            {"id": str(uuid4()), "status": ApprovalStatus.APPROVED.value},
            {"id": str(uuid4()), "status": ApprovalStatus.APPROVED.value},
            {"id": str(uuid4()), "status": ApprovalStatus.PENDING.value}
        ]
        
        engine.repository.get_approvals_for_instance = AsyncMock(return_value=approvals)
        engine.repository.get_workflow_for_instance = AsyncMock(return_value=workflow_data)
        
        # Check step completion
        is_complete = await engine._check_step_completion(instance_id, step_number)
        
        # Verify step is complete (2 out of 3 is majority)
        assert is_complete is True


class TestApprovalDecisionProcessing:
    """
    Test approval decision processing and state transitions.
    Validates Requirement 2.3: WHEN an approver takes action, THE Workflow_Engine 
    SHALL record the approval decision with timestamp and comments
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
    async def test_submit_approval_records_decision(self, engine):
        """Test that approval submission records decision with timestamp"""
        approval_id = uuid4()
        approver_id = uuid4()
        instance_id = uuid4()
        comments = "Approved with conditions"
        
        # Mock approval record
        approval_data = {
            "id": str(approval_id),
            "workflow_instance_id": str(instance_id),
            "approver_id": str(approver_id),
            "step_number": 0,
            "status": ApprovalStatus.PENDING.value
        }
        
        # Mock instance
        instance_data = {
            "id": str(instance_id),
            "workflow_id": str(uuid4()),
            "current_step": 0,
            "status": WorkflowStatus.IN_PROGRESS.value
        }
        
        # Mock updated approval
        updated_approval = {
            **approval_data,
            "status": ApprovalStatus.APPROVED.value,
            "comments": comments,
            "approved_at": datetime.utcnow().isoformat()
        }
        
        engine.repository.get_approval_by_id = AsyncMock(return_value=approval_data)
        engine.repository.update_approval = AsyncMock(return_value=updated_approval)
        engine.repository.get_workflow_instance = AsyncMock(return_value=instance_data)
        engine._check_step_completion = AsyncMock(return_value=False)
        
        # Submit approval
        result = await engine.submit_approval_decision(
            approval_id=approval_id,
            approver_id=approver_id,
            decision=ApprovalStatus.APPROVED.value,
            comments=comments
        )
        
        # Verify approval was updated with decision and comments
        update_call = engine.repository.update_approval.call_args
        assert update_call[0][0] == approval_id
        assert update_call[0][1] == ApprovalStatus.APPROVED.value
        assert update_call[0][2] == comments
        
        # Verify result contains decision
        assert result["decision"] == ApprovalStatus.APPROVED.value
    
    @pytest.mark.asyncio
    async def test_submit_approval_validates_decision(self, engine):
        """Test that approval submission validates decision value"""
        approval_id = uuid4()
        approver_id = uuid4()
        
        # Attempt to submit invalid decision
        with pytest.raises(ValueError, match="Invalid decision"):
            await engine.submit_approval_decision(
                approval_id=approval_id,
                approver_id=approver_id,
                decision="invalid_decision",
                comments="Test"
            )
    
    @pytest.mark.asyncio
    async def test_submit_approval_validates_approver(self, engine):
        """Test that approval submission validates approver"""
        approval_id = uuid4()
        approver_id = uuid4()
        wrong_approver_id = uuid4()
        
        # Mock approval with different approver
        approval_data = {
            "id": str(approval_id),
            "workflow_instance_id": str(uuid4()),
            "approver_id": str(approver_id),
            "step_number": 0,
            "status": ApprovalStatus.PENDING.value
        }
        
        engine.repository.get_approval_by_id = AsyncMock(return_value=approval_data)
        
        # Attempt to submit with wrong approver
        with pytest.raises(ValueError, match="not the designated approver"):
            await engine.submit_approval_decision(
                approval_id=approval_id,
                approver_id=wrong_approver_id,
                decision=ApprovalStatus.APPROVED.value
            )
    
    @pytest.mark.asyncio
    async def test_submit_approval_prevents_duplicate_decisions(self, engine):
        """Test that approval submission prevents duplicate decisions"""
        approval_id = uuid4()
        approver_id = uuid4()
        
        # Mock already-approved approval
        approval_data = {
            "id": str(approval_id),
            "workflow_instance_id": str(uuid4()),
            "approver_id": str(approver_id),
            "step_number": 0,
            "status": ApprovalStatus.APPROVED.value
        }
        
        engine.repository.get_approval_by_id = AsyncMock(return_value=approval_data)
        
        # Attempt to submit again
        with pytest.raises(ValueError, match="already"):
            await engine.submit_approval_decision(
                approval_id=approval_id,
                approver_id=approver_id,
                decision=ApprovalStatus.APPROVED.value
            )
    
    @pytest.mark.asyncio
    async def test_submit_rejection_halts_workflow(self, engine):
        """Test that rejection halts workflow progression"""
        approval_id = uuid4()
        approver_id = uuid4()
        instance_id = uuid4()
        comments = "Rejected due to budget concerns"
        
        # Mock approval record
        approval_data = {
            "id": str(approval_id),
            "workflow_instance_id": str(instance_id),
            "approver_id": str(approver_id),
            "step_number": 0,
            "status": ApprovalStatus.PENDING.value
        }
        
        # Mock instance
        instance_data = {
            "id": str(instance_id),
            "workflow_id": str(uuid4()),
            "current_step": 0,
            "status": WorkflowStatus.IN_PROGRESS.value
        }
        
        # Mock updated approval
        updated_approval = {
            **approval_data,
            "status": ApprovalStatus.REJECTED.value,
            "comments": comments
        }
        
        engine.repository.get_approval_by_id = AsyncMock(return_value=approval_data)
        engine.repository.update_approval = AsyncMock(return_value=updated_approval)
        engine.repository.get_workflow_instance = AsyncMock(return_value=instance_data)
        engine._handle_workflow_rejection = AsyncMock()
        
        # Submit rejection
        result = await engine.submit_approval_decision(
            approval_id=approval_id,
            approver_id=approver_id,
            decision=ApprovalStatus.REJECTED.value,
            comments=comments
        )
        
        # Verify workflow was rejected
        assert result["decision"] == ApprovalStatus.REJECTED.value
        assert result["workflow_status"] == WorkflowStatus.REJECTED.value
        assert result["is_complete"] is True
        
        # Verify rejection handler was called
        engine._handle_workflow_rejection.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_submit_approval_advances_when_step_complete(self, engine):
        """Test that approval submission advances workflow when step is complete"""
        approval_id = uuid4()
        approver_id = uuid4()
        instance_id = uuid4()
        
        # Mock approval record
        approval_data = {
            "id": str(approval_id),
            "workflow_instance_id": str(instance_id),
            "approver_id": str(approver_id),
            "step_number": 0,
            "status": ApprovalStatus.PENDING.value
        }
        
        # Mock instance
        instance_data = {
            "id": str(instance_id),
            "workflow_id": str(uuid4()),
            "current_step": 0,
            "status": WorkflowStatus.IN_PROGRESS.value
        }
        
        # Mock updated approval
        updated_approval = {
            **approval_data,
            "status": ApprovalStatus.APPROVED.value
        }
        
        engine.repository.get_approval_by_id = AsyncMock(return_value=approval_data)
        engine.repository.update_approval = AsyncMock(return_value=updated_approval)
        engine.repository.get_workflow_instance = AsyncMock(return_value=instance_data)
        engine._check_step_completion = AsyncMock(return_value=True)
        engine._advance_workflow_step = AsyncMock(return_value={
            "status": WorkflowStatus.IN_PROGRESS.value,
            "current_step": 1,
            "is_complete": False
        })
        
        # Submit approval
        result = await engine.submit_approval_decision(
            approval_id=approval_id,
            approver_id=approver_id,
            decision=ApprovalStatus.APPROVED.value
        )
        
        # Verify workflow was advanced
        assert result["current_step"] == 1
        engine._advance_workflow_step.assert_called_once()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
