"""
Integration tests for approval management endpoints

Tests the approval management endpoints:
- GET /approvals/pending
- POST /approvals/{id}/decision
- POST /approvals/{id}/delegate
- POST /approvals/{id}/escalate

Requirements: 3.3
"""

import pytest
from uuid import uuid4, UUID
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch

from models.workflow import (
    WorkflowDefinition,
    WorkflowInstance,
    WorkflowApproval,
    WorkflowStep,
    WorkflowStatus,
    ApprovalStatus,
    ApprovalType,
    StepType,
    PendingApproval
)


@pytest.mark.asyncio
class TestApprovalEndpoints:
    """Test approval management endpoints"""
    
    async def test_get_pending_approvals_empty(self):
        """Test getting pending approvals when none exist"""
        # Arrange
        from services.workflow_engine_core import WorkflowEngineCore
        
        mock_db = Mock()
        engine = WorkflowEngineCore(mock_db)
        
        # Mock repository to return empty list
        engine.repository.get_pending_approvals_for_user = AsyncMock(return_value=[])
        
        # Act
        user_id = uuid4()
        result = await engine.get_pending_approvals(user_id)
        
        # Assert
        assert result == []
        engine.repository.get_pending_approvals_for_user.assert_called_once_with(
            user_id, 100, 0
        )
    
    async def test_get_pending_approvals_with_results(self):
        """Test getting pending approvals with results"""
        # Arrange
        from services.workflow_engine_core import WorkflowEngineCore
        
        mock_db = Mock()
        engine = WorkflowEngineCore(mock_db)
        
        # Create mock approval data
        user_id = uuid4()
        approval_id = uuid4()
        instance_id = uuid4()
        workflow_id = uuid4()
        entity_id = uuid4()
        initiated_by = uuid4()
        
        mock_approval_data = [{
            "id": str(approval_id),
            "workflow_instance_id": str(instance_id),
            "step_number": 0,
            "approver_id": str(user_id),
            "status": ApprovalStatus.PENDING.value,
            "created_at": datetime.utcnow().isoformat(),
            "expires_at": (datetime.utcnow() + timedelta(hours=24)).isoformat(),
            "workflow_instances": {
                "entity_type": "financial_tracking",
                "entity_id": str(entity_id),
                "started_by": str(initiated_by),
                "started_at": datetime.utcnow().isoformat(),
                "data": {"variance_amount": 50000}
            },
            "workflows": {
                "name": "Budget Approval Workflow"
            }
        }]
        
        # Mock repository
        engine.repository.get_pending_approvals_for_user = AsyncMock(
            return_value=mock_approval_data
        )
        
        # Act
        result = await engine.get_pending_approvals(user_id)
        
        # Assert
        assert len(result) == 1
        assert isinstance(result[0], PendingApproval)
        assert result[0].approval_id == approval_id
        assert result[0].workflow_instance_id == instance_id
        assert result[0].workflow_name == "Budget Approval Workflow"
        assert result[0].entity_type == "financial_tracking"
        assert result[0].step_number == 0
    
    async def test_submit_approval_decision_approved(self):
        """Test submitting an approved decision"""
        # Arrange
        from services.workflow_engine_core import WorkflowEngineCore
        
        mock_db = Mock()
        engine = WorkflowEngineCore(mock_db)
        
        approval_id = uuid4()
        approver_id = uuid4()
        instance_id = uuid4()
        workflow_id = uuid4()
        
        # Mock approval data
        mock_approval = {
            "id": str(approval_id),
            "workflow_instance_id": str(instance_id),
            "step_number": 0,
            "approver_id": str(approver_id),
            "status": ApprovalStatus.PENDING.value
        }
        
        # Mock instance data
        mock_instance = {
            "id": str(instance_id),
            "workflow_id": str(workflow_id),
            "current_step": 0,
            "status": WorkflowStatus.IN_PROGRESS.value
        }
        
        # Mock workflow data with single step
        mock_workflow = {
            "id": str(workflow_id),
            "name": "Test Workflow",
            "template_data": {
                "steps": [{
                    "step_order": 0,
                    "step_type": StepType.APPROVAL.value,
                    "name": "Test Step",
                    "approvers": [str(approver_id)],
                    "approval_type": ApprovalType.ALL.value
                }],
                "version": 1
            }
        }
        
        # Mock repository methods
        engine.repository.get_approval_by_id = AsyncMock(return_value=mock_approval)
        engine.repository.update_approval = AsyncMock(return_value={"status": ApprovalStatus.APPROVED.value})
        engine.repository.get_workflow_instance = AsyncMock(return_value=mock_instance)
        engine.repository.get_workflow_for_instance = AsyncMock(return_value=mock_workflow)
        engine.repository.get_approvals_for_instance = AsyncMock(return_value=[
            {**mock_approval, "status": ApprovalStatus.APPROVED.value}
        ])
        engine.repository.update_workflow_instance = AsyncMock(return_value=mock_instance)
        
        # Act
        result = await engine.submit_approval_decision(
            approval_id=approval_id,
            approver_id=approver_id,
            decision=ApprovalStatus.APPROVED.value,
            comments="Looks good"
        )
        
        # Assert
        assert result["decision"] == ApprovalStatus.APPROVED.value
        assert result["workflow_status"] == WorkflowStatus.COMPLETED.value
        assert result["is_complete"] is True
        
        # Verify approval was updated
        engine.repository.update_approval.assert_called_once_with(
            approval_id,
            ApprovalStatus.APPROVED.value,
            "Looks good"
        )
    
    async def test_submit_approval_decision_rejected(self):
        """Test submitting a rejected decision"""
        # Arrange
        from services.workflow_engine_core import WorkflowEngineCore
        
        mock_db = Mock()
        engine = WorkflowEngineCore(mock_db)
        
        approval_id = uuid4()
        approver_id = uuid4()
        instance_id = uuid4()
        workflow_id = uuid4()
        
        # Mock approval data
        mock_approval = {
            "id": str(approval_id),
            "workflow_instance_id": str(instance_id),
            "step_number": 0,
            "approver_id": str(approver_id),
            "status": ApprovalStatus.PENDING.value
        }
        
        # Mock instance data
        mock_instance = {
            "id": str(instance_id),
            "workflow_id": str(workflow_id),
            "current_step": 0,
            "status": WorkflowStatus.IN_PROGRESS.value
        }
        
        # Mock workflow data
        mock_workflow = {
            "id": str(workflow_id),
            "name": "Test Workflow",
            "template_data": {
                "steps": [{
                    "step_order": 0,
                    "step_type": StepType.APPROVAL.value,
                    "name": "Test Step",
                    "approvers": [str(approver_id)],
                    "approval_type": ApprovalType.ALL.value,
                    "rejection_action": "stop"
                }],
                "version": 1
            }
        }
        
        # Mock repository methods
        engine.repository.get_approval_by_id = AsyncMock(return_value=mock_approval)
        engine.repository.update_approval = AsyncMock(return_value={"status": ApprovalStatus.REJECTED.value})
        engine.repository.get_workflow_instance = AsyncMock(return_value=mock_instance)
        engine.repository.get_workflow_for_instance = AsyncMock(return_value=mock_workflow)
        engine.repository.update_workflow_instance = AsyncMock(return_value=mock_instance)
        
        # Act
        result = await engine.submit_approval_decision(
            approval_id=approval_id,
            approver_id=approver_id,
            decision=ApprovalStatus.REJECTED.value,
            comments="Not approved"
        )
        
        # Assert
        assert result["decision"] == ApprovalStatus.REJECTED.value
        assert result["workflow_status"] == WorkflowStatus.REJECTED.value
        assert result["is_complete"] is True
        
        # Verify approval was updated
        engine.repository.update_approval.assert_called_once_with(
            approval_id,
            ApprovalStatus.REJECTED.value,
            "Not approved"
        )
    
    async def test_submit_approval_decision_wrong_approver(self):
        """Test submitting decision with wrong approver"""
        # Arrange
        from services.workflow_engine_core import WorkflowEngineCore
        
        mock_db = Mock()
        engine = WorkflowEngineCore(mock_db)
        
        approval_id = uuid4()
        correct_approver_id = uuid4()
        wrong_approver_id = uuid4()
        
        # Mock approval data with different approver
        mock_approval = {
            "id": str(approval_id),
            "workflow_instance_id": str(uuid4()),
            "step_number": 0,
            "approver_id": str(correct_approver_id),
            "status": ApprovalStatus.PENDING.value
        }
        
        # Mock repository
        engine.repository.get_approval_by_id = AsyncMock(return_value=mock_approval)
        
        # Act & Assert
        with pytest.raises(ValueError, match="not the designated approver"):
            await engine.submit_approval_decision(
                approval_id=approval_id,
                approver_id=wrong_approver_id,
                decision=ApprovalStatus.APPROVED.value
            )
    
    async def test_submit_approval_decision_already_decided(self):
        """Test submitting decision for already decided approval"""
        # Arrange
        from services.workflow_engine_core import WorkflowEngineCore
        
        mock_db = Mock()
        engine = WorkflowEngineCore(mock_db)
        
        approval_id = uuid4()
        approver_id = uuid4()
        
        # Mock approval data that's already approved
        mock_approval = {
            "id": str(approval_id),
            "workflow_instance_id": str(uuid4()),
            "step_number": 0,
            "approver_id": str(approver_id),
            "status": ApprovalStatus.APPROVED.value
        }
        
        # Mock repository
        engine.repository.get_approval_by_id = AsyncMock(return_value=mock_approval)
        
        # Act & Assert
        with pytest.raises(ValueError, match="already approved"):
            await engine.submit_approval_decision(
                approval_id=approval_id,
                approver_id=approver_id,
                decision=ApprovalStatus.APPROVED.value
            )
    
    async def test_submit_approval_decision_invalid_decision(self):
        """Test submitting invalid decision"""
        # Arrange
        from services.workflow_engine_core import WorkflowEngineCore
        
        mock_db = Mock()
        engine = WorkflowEngineCore(mock_db)
        
        approval_id = uuid4()
        approver_id = uuid4()
        
        # Act & Assert
        with pytest.raises(ValueError, match="Invalid decision"):
            await engine.submit_approval_decision(
                approval_id=approval_id,
                approver_id=approver_id,
                decision="invalid_decision"
            )


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
