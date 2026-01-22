"""
Integration Tests for Workflow Version Management

Tests the complete workflow version management flow including:
- Creating workflow instances with version tracking
- Updating workflows while preserving existing instances
- Retrieving correct workflow versions for instances
"""

import pytest
from datetime import datetime
from uuid import uuid4, UUID
from unittest.mock import AsyncMock, MagicMock, patch

from models.workflow import (
    WorkflowDefinition,
    WorkflowStep,
    WorkflowTrigger,
    WorkflowStatus,
    StepType,
    ApprovalType
)
from services.workflow_engine_core import WorkflowEngineCore
from services.workflow_version_service import WorkflowVersionService
from services.workflow_repository import WorkflowRepository


@pytest.fixture
def mock_db():
    """Create a mock database client."""
    return MagicMock()


@pytest.fixture
def workflow_engine(mock_db):
    """Create a workflow engine with mocked dependencies."""
    return WorkflowEngineCore(mock_db)


@pytest.fixture
def version_service(mock_db):
    """Create a version service with mocked dependencies."""
    return WorkflowVersionService(mock_db)


@pytest.fixture
def sample_workflow_v1():
    """Create version 1 of a sample workflow."""
    return {
        "id": str(uuid4()),
        "name": "Budget Approval Workflow",
        "description": "Approve budget changes",
        "template_data": {
            "version": 1,
            "steps": [
                {
                    "step_order": 0,
                    "step_type": "approval",
                    "name": "Manager Approval",
                    "approver_roles": ["manager"],
                    "approval_type": "all",
                    "approvers": [],
                    "quorum_count": None,
                    "conditions": None,
                    "timeout_hours": 72,
                    "auto_approve_conditions": None,
                    "notification_template": None,
                    "description": None
                }
            ],
            "triggers": [
                {
                    "trigger_type": "budget_change",
                    "conditions": {"variance_type": "cost"},
                    "threshold_values": {"percentage": 10.0},
                    "enabled": True
                }
            ],
            "metadata": {}
        },
        "status": "active",
        "version_history": [],
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }


@pytest.fixture
def sample_workflow_v2():
    """Create version 2 of a sample workflow with additional step."""
    return {
        "id": str(uuid4()),
        "name": "Budget Approval Workflow",
        "description": "Approve budget changes with director review",
        "template_data": {
            "version": 2,
            "steps": [
                {
                    "step_order": 0,
                    "step_type": "approval",
                    "name": "Manager Approval",
                    "approver_roles": ["manager"],
                    "approval_type": "all",
                    "approvers": [],
                    "quorum_count": None,
                    "conditions": None,
                    "timeout_hours": 72,
                    "auto_approve_conditions": None,
                    "notification_template": None,
                    "description": None
                },
                {
                    "step_order": 1,
                    "step_type": "approval",
                    "name": "Director Approval",
                    "approver_roles": ["director"],
                    "approval_type": "all",
                    "approvers": [],
                    "quorum_count": None,
                    "conditions": None,
                    "timeout_hours": 48,
                    "auto_approve_conditions": None,
                    "notification_template": None,
                    "description": None
                }
            ],
            "triggers": [
                {
                    "trigger_type": "budget_change",
                    "conditions": {"variance_type": "cost"},
                    "threshold_values": {"percentage": 10.0},
                    "enabled": True
                }
            ],
            "metadata": {}
        },
        "status": "active",
        "version_history": [
            {
                "version": 1,
                "steps": [
                    {
                        "step_order": 0,
                        "step_type": "approval",
                        "name": "Manager Approval",
                        "approver_roles": ["manager"],
                        "approval_type": "all"
                    }
                ],
                "triggers": [],
                "metadata": {},
                "created_at": datetime.utcnow().isoformat(),
                "archived_at": datetime.utcnow().isoformat()
            }
        ],
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }


class TestWorkflowVersionLifecycle:
    """Test complete workflow version lifecycle."""
    
    @pytest.mark.asyncio
    async def test_instance_creation_stores_version(
        self,
        workflow_engine,
        sample_workflow_v1
    ):
        """Test that creating an instance stores the workflow version."""
        workflow_id = UUID(sample_workflow_v1["id"])
        entity_id = uuid4()
        user_id = uuid4()
        
        # Mock repository methods
        workflow_engine.repository.get_workflow = AsyncMock(
            return_value=sample_workflow_v1
        )
        workflow_engine.repository.create_workflow_instance_with_version = AsyncMock(
            return_value={
                "id": str(uuid4()),
                "workflow_id": str(workflow_id),
                "entity_type": "financial_tracking",
                "entity_id": str(entity_id),
                "current_step": 0,
                "status": "pending",
                "data": {"workflow_version": 1},
                "started_by": str(user_id),
                "started_at": datetime.utcnow().isoformat(),
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
        )
        workflow_engine.repository.update_workflow_instance = AsyncMock()
        workflow_engine._create_approvals_for_step = AsyncMock()
        
        # Create instance
        instance = await workflow_engine.create_workflow_instance(
            workflow_id=workflow_id,
            entity_type="financial_tracking",
            entity_id=entity_id,
            initiated_by=user_id
        )
        
        # Verify version was stored
        assert instance.context["workflow_version"] == 1
        
        # Verify repository was called with version
        workflow_engine.repository.create_workflow_instance_with_version.assert_called_once()
        call_args = workflow_engine.repository.create_workflow_instance_with_version.call_args
        assert call_args[0][1] == 1  # Version argument
    
    @pytest.mark.asyncio
    async def test_workflow_update_preserves_existing_instances(
        self,
        version_service,
        sample_workflow_v1
    ):
        """Test that updating a workflow preserves existing instances."""
        workflow_id = UUID(sample_workflow_v1["id"])
        user_id = uuid4()
        
        # Create updated workflow definition
        updated_workflow = WorkflowDefinition(
            name="Budget Approval Workflow",
            description="Updated workflow with new step",
            steps=[
                WorkflowStep(
                    step_order=0,
                    step_type=StepType.APPROVAL,
                    name="Manager Approval",
                    approver_roles=["manager"],
                    approval_type=ApprovalType.ALL
                ),
                WorkflowStep(
                    step_order=1,
                    step_type=StepType.APPROVAL,
                    name="Director Approval",
                    approver_roles=["director"],
                    approval_type=ApprovalType.ALL
                )
            ],
            triggers=[],
            status=WorkflowStatus.ACTIVE,
            version=2
        )
        
        # Mock repository methods
        version_service.repository.get_workflow = AsyncMock(
            return_value=sample_workflow_v1
        )
        version_service.repository.create_workflow_version = AsyncMock(
            return_value={
                **sample_workflow_v1,
                "template_data": {
                    "version": 2,
                    "steps": [step.dict() for step in updated_workflow.steps],
                    "triggers": [],
                    "metadata": {}
                },
                "version_history": [
                    {
                        "version": 1,
                        "steps": sample_workflow_v1["template_data"]["steps"],
                        "triggers": sample_workflow_v1["template_data"]["triggers"],
                        "metadata": {},
                        "created_at": sample_workflow_v1["updated_at"],
                        "archived_at": datetime.utcnow().isoformat()
                    }
                ]
            }
        )
        version_service._count_active_instances = AsyncMock(return_value=5)
        
        # Create new version
        result = await version_service.create_new_version(
            workflow_id,
            updated_workflow,
            user_id
        )
        
        # Verify new version was created
        assert result["version"] == 2
        assert result["previous_version"] == 1
        
        # Verify active instances are preserved
        assert result["active_instances_preserved"] == 5
    
    @pytest.mark.asyncio
    async def test_instance_uses_correct_version_after_update(
        self,
        workflow_engine,
        sample_workflow_v1,
        sample_workflow_v2
    ):
        """Test that instances use the correct workflow version."""
        workflow_id = UUID(sample_workflow_v1["id"])
        instance_id = uuid4()
        
        # Mock instance data with version 1
        instance_data = {
            "id": str(instance_id),
            "workflow_id": str(workflow_id),
            "current_step": 0,
            "status": "in_progress",
            "data": {"workflow_version": 1}
        }
        
        # Mock repository methods
        workflow_engine.repository.get_workflow_instance = AsyncMock(
            return_value=instance_data
        )
        workflow_engine.repository.get_workflow_for_instance = AsyncMock(
            return_value=sample_workflow_v1  # Should return v1, not v2
        )
        workflow_engine.repository.update_workflow_instance = AsyncMock()
        workflow_engine._create_approvals_for_step = AsyncMock()
        
        # Advance workflow
        result = await workflow_engine._advance_workflow_step(
            instance_id,
            uuid4()
        )
        
        # Verify correct workflow version was used
        workflow_engine.repository.get_workflow_for_instance.assert_called_once_with(
            instance_id
        )
        
        # Since v1 has only 1 step, advancing should complete the workflow
        assert result["status"] == "completed"
        assert result["is_complete"] is True


class TestVersionRetrieval:
    """Test retrieving specific workflow versions."""
    
    @pytest.mark.asyncio
    async def test_get_workflow_for_instance_returns_correct_version(
        self,
        mock_db,
        sample_workflow_v1,
        sample_workflow_v2
    ):
        """Test that get_workflow_for_instance returns the correct version."""
        repository = WorkflowRepository(mock_db)
        workflow_id = UUID(sample_workflow_v1["id"])
        instance_id = uuid4()
        
        # Mock instance with version 1
        instance_data = {
            "id": str(instance_id),
            "workflow_id": str(workflow_id),
            "data": {"workflow_version": 1}
        }
        
        # Mock repository methods
        repository.get_workflow_instance = AsyncMock(return_value=instance_data)
        repository.get_workflow_version = AsyncMock(return_value=sample_workflow_v1)
        
        # Get workflow for instance
        workflow = await repository.get_workflow_for_instance(instance_id)
        
        # Verify correct version was retrieved
        assert workflow is not None
        assert workflow["template_data"]["version"] == 1
        repository.get_workflow_version.assert_called_once_with(workflow_id, 1)
    
    @pytest.mark.asyncio
    async def test_get_workflow_version_from_history(
        self,
        mock_db,
        sample_workflow_v2
    ):
        """Test retrieving a historical workflow version."""
        repository = WorkflowRepository(mock_db)
        workflow_id = UUID(sample_workflow_v2["id"])
        
        # Mock repository method
        repository.get_workflow = AsyncMock(return_value=sample_workflow_v2)
        
        # Get version 1 (which is in history)
        workflow_v1 = await repository.get_workflow_version(workflow_id, 1)
        
        # Verify historical version was retrieved
        assert workflow_v1 is not None
        assert workflow_v1["template_data"]["version"] == 1
        assert len(workflow_v1["template_data"]["steps"]) == 1


class TestVersionMigration:
    """Test migrating instances between versions."""
    
    @pytest.mark.asyncio
    async def test_migrate_instance_updates_version(
        self,
        version_service
    ):
        """Test that migrating an instance updates its version."""
        instance_id = uuid4()
        workflow_id = uuid4()
        user_id = uuid4()
        
        # Mock instance with version 1
        instance_data = {
            "id": str(instance_id),
            "workflow_id": str(workflow_id),
            "status": "in_progress",
            "data": {"workflow_version": 1}
        }
        
        # Mock workflow version 2
        workflow_v2 = {
            "id": str(workflow_id),
            "template_data": {
                "version": 2,
                "steps": [],
                "triggers": []
            }
        }
        
        # Mock repository methods
        version_service.repository.get_workflow_instance = AsyncMock(
            return_value=instance_data
        )
        version_service.repository.get_workflow_version = AsyncMock(
            return_value=workflow_v2
        )
        version_service.repository.update_workflow_instance = AsyncMock(
            return_value=instance_data
        )
        
        # Migrate instance
        result = await version_service.migrate_instance_to_version(
            instance_id,
            2,
            user_id
        )
        
        # Verify migration result
        assert result["from_version"] == 1
        assert result["to_version"] == 2
        assert result["status"] == "success"
        
        # Verify instance was updated
        version_service.repository.update_workflow_instance.assert_called_once()
        call_args = version_service.repository.update_workflow_instance.call_args
        updated_data = call_args[0][1]["data"]
        assert updated_data["workflow_version"] == 2
        assert "version_migration" in updated_data


class TestVersionComparison:
    """Test comparing workflow versions."""
    
    @pytest.mark.asyncio
    async def test_compare_versions_detects_changes(
        self,
        version_service,
        sample_workflow_v1,
        sample_workflow_v2
    ):
        """Test that version comparison detects changes."""
        workflow_id = UUID(sample_workflow_v1["id"])
        
        # Mock repository method
        version_service.repository.get_workflow_version = AsyncMock(
            side_effect=[sample_workflow_v1, sample_workflow_v2]
        )
        
        # Compare versions
        comparison = await version_service.compare_versions(workflow_id, 1, 2)
        
        # Verify changes were detected
        assert comparison["changes"]["steps_changed"] is True
        assert comparison["changes"]["step_count_v1"] == 1
        assert comparison["changes"]["step_count_v2"] == 2
        assert comparison["description_changed"] is True
