"""
Unit Tests for Workflow Version Management

Tests for workflow version creation, instance version tracking,
and migration logic.
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
from services.workflow_version_service import WorkflowVersionService
from services.workflow_repository import WorkflowRepository


@pytest.fixture
def mock_db():
    """Create a mock database client."""
    return MagicMock()


@pytest.fixture
def version_service(mock_db):
    """Create a workflow version service with mocked dependencies."""
    return WorkflowVersionService(mock_db)


@pytest.fixture
def sample_workflow_definition():
    """Create a sample workflow definition."""
    return WorkflowDefinition(
        name="Test Workflow",
        description="Test workflow description",
        steps=[
            WorkflowStep(
                step_order=0,
                step_type=StepType.APPROVAL,
                name="Manager Approval",
                approver_roles=["manager"],
                approval_type=ApprovalType.ALL
            )
        ],
        triggers=[
            WorkflowTrigger(
                trigger_type="budget_change",
                conditions={"variance_type": "cost"},
                threshold_values={"percentage": 10.0}
            )
        ],
        status=WorkflowStatus.ACTIVE,
        version=1
    )


@pytest.fixture
def sample_workflow_data():
    """Create sample workflow data as returned from database."""
    return {
        "id": str(uuid4()),
        "name": "Test Workflow",
        "description": "Test workflow description",
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
                    "timeout_hours": None,
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


class TestWorkflowVersionCreation:
    """Tests for creating new workflow versions."""
    
    @pytest.mark.asyncio
    async def test_create_new_version_success(
        self,
        version_service,
        sample_workflow_definition,
        sample_workflow_data
    ):
        """Test successful creation of a new workflow version."""
        workflow_id = UUID(sample_workflow_data["id"])
        user_id = uuid4()
        
        # Mock repository methods
        version_service.repository.get_workflow = AsyncMock(return_value=sample_workflow_data)
        version_service.repository.create_workflow_version = AsyncMock(
            return_value={
                **sample_workflow_data,
                "template_data": {
                    **sample_workflow_data["template_data"],
                    "version": 2
                },
                "version_history": [
                    {
                        "version": 1,
                        "steps": sample_workflow_data["template_data"]["steps"],
                        "triggers": sample_workflow_data["template_data"]["triggers"],
                        "metadata": {},
                        "created_at": sample_workflow_data["updated_at"],
                        "archived_at": datetime.utcnow().isoformat()
                    }
                ]
            }
        )
        version_service._count_active_instances = AsyncMock(return_value=3)
        
        # Create new version
        result = await version_service.create_new_version(
            workflow_id,
            sample_workflow_definition,
            user_id
        )
        
        # Verify result
        assert result["workflow_id"] == str(workflow_id)
        assert result["version"] == 2
        assert result["previous_version"] == 1
        assert result["active_instances_preserved"] == 3
        assert result["status"] == "active"
        
        # Verify repository was called
        version_service.repository.get_workflow.assert_called_once_with(workflow_id)
        version_service.repository.create_workflow_version.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_create_new_version_workflow_not_found(
        self,
        version_service,
        sample_workflow_definition
    ):
        """Test creating version for non-existent workflow."""
        workflow_id = uuid4()
        user_id = uuid4()
        
        # Mock repository to return None
        version_service.repository.get_workflow = AsyncMock(return_value=None)
        
        # Should raise ValueError
        with pytest.raises(ValueError, match="not found"):
            await version_service.create_new_version(
                workflow_id,
                sample_workflow_definition,
                user_id
            )
    
    @pytest.mark.asyncio
    async def test_create_new_version_preserves_active_instances(
        self,
        version_service,
        sample_workflow_definition,
        sample_workflow_data
    ):
        """Test that creating a new version preserves active instances."""
        workflow_id = UUID(sample_workflow_data["id"])
        user_id = uuid4()
        
        # Mock repository methods
        version_service.repository.get_workflow = AsyncMock(return_value=sample_workflow_data)
        version_service.repository.create_workflow_version = AsyncMock(
            return_value={
                **sample_workflow_data,
                "template_data": {
                    **sample_workflow_data["template_data"],
                    "version": 2
                }
            }
        )
        version_service._count_active_instances = AsyncMock(return_value=5)
        
        # Create new version
        result = await version_service.create_new_version(
            workflow_id,
            sample_workflow_definition,
            user_id
        )
        
        # Verify active instances are reported
        assert result["active_instances_preserved"] == 5


class TestWorkflowVersionHistory:
    """Tests for workflow version history."""
    
    @pytest.mark.asyncio
    async def test_get_version_history(self, version_service, sample_workflow_data):
        """Test retrieving version history for a workflow."""
        workflow_id = UUID(sample_workflow_data["id"])
        
        # Mock repository methods
        version_service.repository.list_workflow_versions = AsyncMock(
            return_value=[
                {
                    "version": 2,
                    "created_at": datetime.utcnow().isoformat(),
                    "is_current": True,
                    "step_count": 1,
                    "trigger_count": 1
                },
                {
                    "version": 1,
                    "created_at": datetime.utcnow().isoformat(),
                    "is_current": False,
                    "step_count": 1,
                    "trigger_count": 1
                }
            ]
        )
        version_service._count_instances_by_version = AsyncMock(
            side_effect=[3, 5]  # v2 has 3 instances, v1 has 5
        )
        
        # Get version history
        history = await version_service.get_version_history(workflow_id)
        
        # Verify results
        assert len(history) == 2
        assert history[0]["version"] == 2
        assert history[0]["instance_count"] == 3
        assert history[1]["version"] == 1
        assert history[1]["instance_count"] == 5
    
    @pytest.mark.asyncio
    async def test_get_workflow_version(self, version_service, sample_workflow_data):
        """Test retrieving a specific workflow version."""
        workflow_id = UUID(sample_workflow_data["id"])
        version = 1
        
        # Mock repository method
        version_service.repository.get_workflow_version = AsyncMock(
            return_value=sample_workflow_data
        )
        
        # Get specific version
        result = await version_service.get_workflow_version(workflow_id, version)
        
        # Verify result
        assert result is not None
        assert result["id"] == sample_workflow_data["id"]
        version_service.repository.get_workflow_version.assert_called_once_with(
            workflow_id,
            version
        )


class TestInstanceVersionMigration:
    """Tests for migrating instances to different versions."""
    
    @pytest.mark.asyncio
    async def test_migrate_instance_to_version_success(self, version_service):
        """Test successful instance migration to a different version."""
        instance_id = uuid4()
        workflow_id = uuid4()
        user_id = uuid4()
        target_version = 2
        
        # Mock instance data
        instance_data = {
            "id": str(instance_id),
            "workflow_id": str(workflow_id),
            "status": "in_progress",
            "data": {
                "workflow_version": 1
            }
        }
        
        # Mock workflow data
        workflow_data = {
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
            return_value=workflow_data
        )
        version_service.repository.update_workflow_instance = AsyncMock(
            return_value=instance_data
        )
        
        # Migrate instance
        result = await version_service.migrate_instance_to_version(
            instance_id,
            target_version,
            user_id
        )
        
        # Verify result
        assert result["instance_id"] == str(instance_id)
        assert result["from_version"] == 1
        assert result["to_version"] == 2
        assert result["status"] == "success"
        
        # Verify update was called with correct data
        version_service.repository.update_workflow_instance.assert_called_once()
        call_args = version_service.repository.update_workflow_instance.call_args
        updated_data = call_args[0][1]["data"]
        assert updated_data["workflow_version"] == 2
        assert "version_migration" in updated_data
    
    @pytest.mark.asyncio
    async def test_migrate_completed_instance_fails(self, version_service):
        """Test that migrating a completed instance fails."""
        instance_id = uuid4()
        user_id = uuid4()
        target_version = 2
        
        # Mock completed instance
        instance_data = {
            "id": str(instance_id),
            "workflow_id": str(uuid4()),
            "status": "completed",
            "data": {"workflow_version": 1}
        }
        
        version_service.repository.get_workflow_instance = AsyncMock(
            return_value=instance_data
        )
        
        # Should raise ValueError
        with pytest.raises(ValueError, match="Cannot migrate completed"):
            await version_service.migrate_instance_to_version(
                instance_id,
                target_version,
                user_id
            )
    
    @pytest.mark.asyncio
    async def test_migrate_to_same_version_fails(self, version_service):
        """Test that migrating to the same version fails."""
        instance_id = uuid4()
        workflow_id = uuid4()
        user_id = uuid4()
        current_version = 1
        
        # Mock instance data
        instance_data = {
            "id": str(instance_id),
            "workflow_id": str(workflow_id),
            "status": "in_progress",
            "data": {"workflow_version": current_version}
        }
        
        # Mock workflow data
        workflow_data = {
            "id": str(workflow_id),
            "template_data": {"version": current_version}
        }
        
        version_service.repository.get_workflow_instance = AsyncMock(
            return_value=instance_data
        )
        version_service.repository.get_workflow_version = AsyncMock(
            return_value=workflow_data
        )
        
        # Should raise ValueError
        with pytest.raises(ValueError, match="already using version"):
            await version_service.migrate_instance_to_version(
                instance_id,
                current_version,
                user_id
            )


class TestVersionComparison:
    """Tests for comparing workflow versions."""
    
    @pytest.mark.asyncio
    async def test_compare_versions_with_changes(self, version_service):
        """Test comparing two versions with differences."""
        workflow_id = uuid4()
        
        # Mock version 1
        workflow_v1 = {
            "id": str(workflow_id),
            "name": "Test Workflow",
            "description": "Original description",
            "template_data": {
                "version": 1,
                "steps": [{"step_order": 0, "name": "Step 1"}],
                "triggers": [{"trigger_type": "budget_change"}],
                "metadata": {}
            }
        }
        
        # Mock version 2 with changes
        workflow_v2 = {
            "id": str(workflow_id),
            "name": "Test Workflow",
            "description": "Updated description",
            "template_data": {
                "version": 2,
                "steps": [
                    {"step_order": 0, "name": "Step 1"},
                    {"step_order": 1, "name": "Step 2"}
                ],
                "triggers": [{"trigger_type": "budget_change"}],
                "metadata": {"key": "value"}
            }
        }
        
        # Mock repository method
        version_service.repository.get_workflow_version = AsyncMock(
            side_effect=[workflow_v1, workflow_v2]
        )
        
        # Compare versions
        result = await version_service.compare_versions(workflow_id, 1, 2)
        
        # Verify comparison results
        assert result["workflow_id"] == str(workflow_id)
        assert result["version1"] == 1
        assert result["version2"] == 2
        assert result["changes"]["steps_changed"] is True
        assert result["changes"]["step_count_v1"] == 1
        assert result["changes"]["step_count_v2"] == 2
        assert result["changes"]["triggers_changed"] is False
        assert result["changes"]["metadata_changed"] is True
        assert result["description_changed"] is True
    
    @pytest.mark.asyncio
    async def test_compare_versions_no_changes(self, version_service):
        """Test comparing identical versions."""
        workflow_id = uuid4()
        
        # Mock identical versions
        workflow_data = {
            "id": str(workflow_id),
            "name": "Test Workflow",
            "description": "Description",
            "template_data": {
                "version": 1,
                "steps": [{"step_order": 0, "name": "Step 1"}],
                "triggers": [],
                "metadata": {}
            }
        }
        
        version_service.repository.get_workflow_version = AsyncMock(
            side_effect=[workflow_data, workflow_data]
        )
        
        # Compare versions
        result = await version_service.compare_versions(workflow_id, 1, 1)
        
        # Verify no changes detected
        assert result["changes"]["steps_changed"] is False
        assert result["changes"]["triggers_changed"] is False
        assert result["changes"]["metadata_changed"] is False
        assert result["description_changed"] is False


class TestVersionTracking:
    """Tests for version tracking in workflow instances."""
    
    @pytest.mark.asyncio
    async def test_count_instances_by_version(self, version_service):
        """Test counting instances by version."""
        workflow_id = uuid4()
        
        # Mock instances with different versions
        instances = [
            {"id": str(uuid4()), "data": {"workflow_version": 1}},
            {"id": str(uuid4()), "data": {"workflow_version": 1}},
            {"id": str(uuid4()), "data": {"workflow_version": 2}},
            {"id": str(uuid4()), "data": {"workflow_version": 1}},
            {"id": str(uuid4()), "data": {}}  # No version (legacy)
        ]
        
        version_service.repository.list_workflow_instances = AsyncMock(
            return_value=instances
        )
        
        # Count version 1 instances
        count = await version_service._count_instances_by_version(workflow_id, 1)
        
        # Should count 4 instances (3 with v1 + 1 legacy defaulting to v1)
        assert count == 4
    
    @pytest.mark.asyncio
    async def test_count_active_instances(self, version_service):
        """Test counting active workflow instances."""
        workflow_id = uuid4()
        
        # Mock active instances
        active_instances = [
            {"id": str(uuid4()), "status": "in_progress"},
            {"id": str(uuid4()), "status": "in_progress"},
            {"id": str(uuid4()), "status": "in_progress"}
        ]
        
        version_service.repository.list_workflow_instances = AsyncMock(
            return_value=active_instances
        )
        
        # Count active instances
        count = await version_service._count_active_instances(workflow_id)
        
        assert count == 3
        version_service.repository.list_workflow_instances.assert_called_once_with(
            workflow_id=workflow_id,
            status=WorkflowStatus.IN_PROGRESS
        )
