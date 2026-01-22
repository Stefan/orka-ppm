"""
Unit tests for workflow engine core infrastructure.

Tests the basic functionality of workflow models, repository, and engine core.
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
    WorkflowTrigger
)
from services.workflow_repository import WorkflowRepository
from services.workflow_engine_core import WorkflowEngineCore


class TestWorkflowModels:
    """Test workflow model validation and structure"""
    
    def test_workflow_step_creation(self):
        """Test creating a valid workflow step"""
        step = WorkflowStep(
            step_order=0,
            step_type=StepType.APPROVAL,
            name="Test Approval",
            description="Test step",
            approvers=[uuid4()],
            approval_type=ApprovalType.ALL,
            timeout_hours=24
        )
        
        assert step.step_order == 0
        assert step.step_type == StepType.APPROVAL
        assert step.name == "Test Approval"
        assert step.approval_type == ApprovalType.ALL
        assert step.timeout_hours == 24
    
    def test_workflow_definition_validation(self):
        """Test workflow definition validation"""
        step1 = WorkflowStep(
            step_order=0,
            name="Step 1",
            approvers=[uuid4()],
            approval_type=ApprovalType.ALL
        )
        
        step2 = WorkflowStep(
            step_order=1,
            name="Step 2",
            approvers=[uuid4()],
            approval_type=ApprovalType.ANY
        )
        
        workflow = WorkflowDefinition(
            name="Test Workflow",
            description="Test workflow definition",
            steps=[step1, step2],
            status=WorkflowStatus.ACTIVE
        )
        
        assert workflow.name == "Test Workflow"
        assert len(workflow.steps) == 2
        assert workflow.status == WorkflowStatus.ACTIVE
    
    def test_workflow_definition_invalid_steps_order(self):
        """Test workflow definition rejects invalid step ordering"""
        step1 = WorkflowStep(
            step_order=0,
            name="Step 1",
            approvers=[uuid4()]
        )
        
        step2 = WorkflowStep(
            step_order=2,  # Invalid - should be 1
            name="Step 2",
            approvers=[uuid4()]
        )
        
        with pytest.raises(ValueError, match="sequential order"):
            WorkflowDefinition(
                name="Invalid Workflow",
                steps=[step1, step2]
            )
    
    def test_workflow_instance_creation(self):
        """Test creating a workflow instance"""
        workflow_id = uuid4()
        entity_id = uuid4()
        initiated_by = uuid4()
        
        instance = WorkflowInstance(
            workflow_id=workflow_id,
            entity_type="financial_tracking",
            entity_id=entity_id,
            current_step=0,
            status=WorkflowStatus.PENDING,
            context={"variance_amount": 50000},
            initiated_by=initiated_by
        )
        
        assert instance.workflow_id == workflow_id
        assert instance.entity_type == "financial_tracking"
        assert instance.entity_id == entity_id
        assert instance.current_step == 0
        assert instance.status == WorkflowStatus.PENDING
        assert instance.context["variance_amount"] == 50000
    
    def test_workflow_approval_creation(self):
        """Test creating a workflow approval"""
        instance_id = uuid4()
        approver_id = uuid4()
        
        approval = WorkflowApproval(
            workflow_instance_id=instance_id,
            step_number=0,
            step_name="Test Step",
            approver_id=approver_id,
            status=ApprovalStatus.PENDING
        )
        
        assert approval.workflow_instance_id == instance_id
        assert approval.step_number == 0
        assert approval.approver_id == approver_id
        assert approval.status == ApprovalStatus.PENDING


class TestWorkflowRepository:
    """Test workflow repository database operations"""
    
    @pytest.fixture
    def mock_db(self):
        """Create a mock database client"""
        db = Mock()
        db.table = Mock(return_value=Mock())
        return db
    
    @pytest.fixture
    def repository(self, mock_db):
        """Create a workflow repository with mock database"""
        return WorkflowRepository(mock_db)
    
    def test_repository_initialization(self, mock_db):
        """Test repository initializes with database client"""
        repo = WorkflowRepository(mock_db)
        assert repo.db == mock_db
    
    def test_repository_requires_database(self):
        """Test repository requires database client"""
        with pytest.raises(ValueError, match="Database client is required"):
            WorkflowRepository(None)
    
    @pytest.mark.asyncio
    async def test_create_workflow(self, repository, mock_db):
        """Test creating a workflow definition"""
        workflow = WorkflowDefinition(
            name="Test Workflow",
            description="Test",
            steps=[
                WorkflowStep(
                    step_order=0,
                    name="Step 1",
                    approvers=[uuid4()]
                )
            ]
        )
        
        # Mock database response
        mock_result = Mock()
        mock_result.data = [{
            "id": str(uuid4()),
            "name": "Test Workflow",
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }]
        
        mock_db.table.return_value.insert.return_value.execute.return_value = mock_result
        
        result = await repository.create_workflow(workflow)
        
        assert result is not None
        assert result["name"] == "Test Workflow"
        mock_db.table.assert_called_with("workflows")
    
    @pytest.mark.asyncio
    async def test_get_workflow(self, repository, mock_db):
        """Test getting a workflow by ID"""
        workflow_id = uuid4()
        
        # Mock database response
        mock_result = Mock()
        mock_result.data = [{
            "id": str(workflow_id),
            "name": "Test Workflow"
        }]
        
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_result
        
        result = await repository.get_workflow(workflow_id)
        
        assert result is not None
        assert result["id"] == str(workflow_id)


class TestWorkflowEngineCore:
    """Test workflow engine core functionality"""
    
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
    
    def test_engine_initialization(self, mock_db):
        """Test engine initializes with database client"""
        engine = WorkflowEngineCore(mock_db)
        assert engine.db == mock_db
        assert isinstance(engine.repository, WorkflowRepository)
    
    def test_engine_requires_database(self):
        """Test engine requires database client"""
        with pytest.raises(ValueError, match="Database client is required"):
            WorkflowEngineCore(None)
    
    @pytest.mark.asyncio
    async def test_create_workflow_instance_validation(self, engine):
        """Test workflow instance creation validates workflow exists"""
        workflow_id = uuid4()
        entity_id = uuid4()
        initiated_by = uuid4()
        
        # Mock repository to return None (workflow not found)
        engine.repository.get_workflow = AsyncMock(return_value=None)
        
        with pytest.raises(ValueError, match="not found"):
            await engine.create_workflow_instance(
                workflow_id=workflow_id,
                entity_type="test",
                entity_id=entity_id,
                initiated_by=initiated_by
            )
    
    @pytest.mark.asyncio
    async def test_submit_approval_decision_validation(self, engine):
        """Test approval decision submission validates decision"""
        approval_id = uuid4()
        approver_id = uuid4()
        
        with pytest.raises(ValueError, match="Invalid decision"):
            await engine.submit_approval_decision(
                approval_id=approval_id,
                approver_id=approver_id,
                decision="invalid_decision",
                comments="Test"
            )


class TestWorkflowStateTransitions:
    """Test workflow state management and transitions"""
    
    def test_workflow_status_enum(self):
        """Test workflow status enum values"""
        assert WorkflowStatus.DRAFT.value == "draft"
        assert WorkflowStatus.ACTIVE.value == "active"
        assert WorkflowStatus.PENDING.value == "pending"
        assert WorkflowStatus.IN_PROGRESS.value == "in_progress"
        assert WorkflowStatus.COMPLETED.value == "completed"
        assert WorkflowStatus.REJECTED.value == "rejected"
        assert WorkflowStatus.CANCELLED.value == "cancelled"
    
    def test_approval_status_enum(self):
        """Test approval status enum values"""
        assert ApprovalStatus.PENDING.value == "pending"
        assert ApprovalStatus.APPROVED.value == "approved"
        assert ApprovalStatus.REJECTED.value == "rejected"
        assert ApprovalStatus.DELEGATED.value == "delegated"
    
    def test_approval_type_enum(self):
        """Test approval type enum values"""
        assert ApprovalType.ANY.value == "any"
        assert ApprovalType.ALL.value == "all"
        assert ApprovalType.MAJORITY.value == "majority"
        assert ApprovalType.QUORUM.value == "quorum"


class TestWorkflowTriggers:
    """Test workflow trigger configuration"""
    
    def test_workflow_trigger_creation(self):
        """Test creating a workflow trigger"""
        trigger = WorkflowTrigger(
            trigger_type="budget_change",
            conditions={"variance_type": "cost"},
            threshold_values={"percentage": 10.0},
            enabled=True
        )
        
        assert trigger.trigger_type == "budget_change"
        assert trigger.conditions["variance_type"] == "cost"
        assert trigger.threshold_values["percentage"] == 10.0
        assert trigger.enabled is True
    
    def test_workflow_with_triggers(self):
        """Test workflow definition with triggers"""
        trigger = WorkflowTrigger(
            trigger_type="milestone_update",
            conditions={"status": "completed"}
        )
        
        step = WorkflowStep(
            step_order=0,
            name="Approval",
            approvers=[uuid4()]
        )
        
        workflow = WorkflowDefinition(
            name="Milestone Workflow",
            steps=[step],
            triggers=[trigger]
        )
        
        assert len(workflow.triggers) == 1
        assert workflow.triggers[0].trigger_type == "milestone_update"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
