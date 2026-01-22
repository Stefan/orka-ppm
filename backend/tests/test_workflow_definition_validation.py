"""
Unit Tests for Workflow Definition Model and Validation

Tests the WorkflowDefinition model validation including:
- Basic model validation
- Approver validation against RBAC
- Sequential and parallel approval patterns
- Step configuration validation

Requirements: 1.1, 1.2, 1.3
"""

import pytest
from uuid import uuid4, UUID
from datetime import datetime
from unittest.mock import Mock, AsyncMock, patch

from models.workflow import (
    WorkflowDefinition,
    WorkflowStep,
    WorkflowTrigger,
    WorkflowStatus,
    StepType,
    ApprovalType
)
from services.workflow_validation_service import (
    WorkflowValidationService,
    WorkflowValidationError
)
from auth.rbac import UserRole, Permission


class TestWorkflowDefinitionModel:
    """Test WorkflowDefinition model validation"""
    
    def test_valid_workflow_definition(self):
        """Test creating a valid workflow definition"""
        # Arrange
        steps = [
            WorkflowStep(
                step_order=0,
                step_type=StepType.APPROVAL,
                name="Manager Approval",
                approver_roles=["project_manager"],
                approval_type=ApprovalType.ALL
            )
        ]
        
        # Act
        workflow = WorkflowDefinition(
            name="Test Workflow",
            description="Test workflow description",
            steps=steps,
            status=WorkflowStatus.DRAFT
        )
        
        # Assert
        assert workflow.name == "Test Workflow"
        assert len(workflow.steps) == 1
        assert workflow.status == WorkflowStatus.DRAFT
        assert workflow.version == 1
    
    def test_workflow_requires_name(self):
        """Test that workflow name is required"""
        # Arrange
        steps = [
            WorkflowStep(
                step_order=0,
                step_type=StepType.APPROVAL,
                name="Step 1",
                approver_roles=["admin"],
                approval_type=ApprovalType.ALL
            )
        ]
        
        # Act & Assert
        with pytest.raises(ValueError):
            WorkflowDefinition(
                name="",  # Empty name
                steps=steps
            )
    
    def test_workflow_requires_steps(self):
        """Test that workflow requires at least one step"""
        # Act & Assert
        with pytest.raises(ValueError):
            WorkflowDefinition(
                name="Test Workflow",
                steps=[]  # Empty steps
            )
    
    def test_workflow_steps_sequential_order(self):
        """Test that workflow steps must have sequential order"""
        # Arrange - steps with non-sequential order
        steps = [
            WorkflowStep(
                step_order=0,
                step_type=StepType.APPROVAL,
                name="Step 1",
                approver_roles=["admin"],
                approval_type=ApprovalType.ALL
            ),
            WorkflowStep(
                step_order=2,  # Skips 1
                step_type=StepType.APPROVAL,
                name="Step 2",
                approver_roles=["admin"],
                approval_type=ApprovalType.ALL
            )
        ]
        
        # Act & Assert
        with pytest.raises(ValueError, match="sequential order"):
            WorkflowDefinition(
                name="Test Workflow",
                steps=steps
            )
    
    def test_workflow_with_multiple_steps(self):
        """Test workflow with multiple sequential steps"""
        # Arrange
        steps = [
            WorkflowStep(
                step_order=0,
                step_type=StepType.APPROVAL,
                name="Manager Approval",
                approver_roles=["project_manager"],
                approval_type=ApprovalType.ALL
            ),
            WorkflowStep(
                step_order=1,
                step_type=StepType.APPROVAL,
                name="Director Approval",
                approver_roles=["portfolio_manager"],
                approval_type=ApprovalType.ALL
            ),
            WorkflowStep(
                step_order=2,
                step_type=StepType.NOTIFICATION,
                name="Completion Notification",
                approvers=[],
                approver_roles=[]
            )
        ]
        
        # Act
        workflow = WorkflowDefinition(
            name="Multi-Step Workflow",
            steps=steps
        )
        
        # Assert
        assert len(workflow.steps) == 3
        assert workflow.steps[0].name == "Manager Approval"
        assert workflow.steps[1].name == "Director Approval"
        assert workflow.steps[2].step_type == StepType.NOTIFICATION


class TestWorkflowStepModel:
    """Test WorkflowStep model validation"""
    
    def test_valid_approval_step(self):
        """Test creating a valid approval step"""
        # Act
        step = WorkflowStep(
            step_order=0,
            step_type=StepType.APPROVAL,
            name="Manager Approval",
            approver_roles=["project_manager"],
            approval_type=ApprovalType.ALL,
            timeout_hours=72
        )
        
        # Assert
        assert step.step_order == 0
        assert step.step_type == StepType.APPROVAL
        assert step.approval_type == ApprovalType.ALL
        assert step.timeout_hours == 72
    
    def test_step_requires_name(self):
        """Test that step name is required"""
        # Act & Assert
        with pytest.raises(ValueError):
            WorkflowStep(
                step_order=0,
                step_type=StepType.APPROVAL,
                name="",  # Empty name
                approver_roles=["admin"],
                approval_type=ApprovalType.ALL
            )
    
    def test_quorum_approval_type_requires_count(self):
        """Test that QUORUM approval type requires quorum_count"""
        # Arrange
        step = WorkflowStep(
            step_order=0,
            step_type=StepType.APPROVAL,
            name="Quorum Approval",
            approvers=[uuid4(), uuid4(), uuid4()],
            approval_type=ApprovalType.QUORUM,
            quorum_count=2
        )
        
        # Assert
        assert step.approval_type == ApprovalType.QUORUM
        assert step.quorum_count == 2
    
    def test_quorum_count_invalid_for_non_quorum_type(self):
        """Test that quorum_count is invalid for non-QUORUM approval types"""
        # Act & Assert
        with pytest.raises(ValueError, match="quorum_count only valid"):
            WorkflowStep(
                step_order=0,
                step_type=StepType.APPROVAL,
                name="All Approval",
                approver_roles=["admin"],
                approval_type=ApprovalType.ALL,
                quorum_count=2  # Invalid for ALL type
            )
    
    def test_parallel_approval_with_multiple_approvers(self):
        """Test parallel approval pattern with multiple approvers"""
        # Arrange
        approver_ids = [uuid4() for _ in range(3)]
        
        # Act
        step = WorkflowStep(
            step_order=0,
            step_type=StepType.APPROVAL,
            name="Parallel Approval",
            approvers=approver_ids,
            approval_type=ApprovalType.MAJORITY
        )
        
        # Assert
        assert len(step.approvers) == 3
        assert step.approval_type == ApprovalType.MAJORITY
    
    def test_any_approval_type(self):
        """Test ANY approval type (any one approver can approve)"""
        # Act
        step = WorkflowStep(
            step_order=0,
            step_type=StepType.APPROVAL,
            name="Any Approval",
            approver_roles=["project_manager", "portfolio_manager"],
            approval_type=ApprovalType.ANY
        )
        
        # Assert
        assert step.approval_type == ApprovalType.ANY
        assert len(step.approver_roles) == 2


class TestWorkflowValidationService:
    """Test WorkflowValidationService"""
    
    @pytest.fixture
    def mock_db(self):
        """Create mock database client"""
        db = Mock()
        db.table = Mock(return_value=Mock())
        return db
    
    @pytest.fixture
    def validation_service(self, mock_db):
        """Create validation service with mock database"""
        return WorkflowValidationService(mock_db)
    
    @pytest.mark.asyncio
    async def test_validate_basic_workflow(self, validation_service):
        """Test validation of a basic workflow"""
        # Arrange
        workflow = WorkflowDefinition(
            name="Test Workflow",
            description="Test description",
            steps=[
                WorkflowStep(
                    step_order=0,
                    step_type=StepType.APPROVAL,
                    name="Approval Step",
                    approver_roles=["admin"],
                    approval_type=ApprovalType.ALL
                )
            ]
        )
        
        # Act
        is_valid, errors = await validation_service.validate_workflow_definition(
            workflow,
            validate_approvers=False  # Skip approver validation for this test
        )
        
        # Assert
        assert is_valid
        assert len(errors) == 0
    
    @pytest.mark.asyncio
    async def test_validate_workflow_without_name(self, validation_service):
        """Test validation fails for workflow without name"""
        # Arrange & Act & Assert
        # Pydantic validates this at model creation time
        with pytest.raises(ValueError):
            workflow = WorkflowDefinition(
                name="",  # Empty name
                steps=[
                    WorkflowStep(
                        step_order=0,
                        step_type=StepType.APPROVAL,
                        name="Step",
                        approver_roles=["admin"],
                        approval_type=ApprovalType.ALL
                    )
                ]
            )
    
    @pytest.mark.asyncio
    async def test_validate_workflow_without_steps(self, validation_service):
        """Test validation fails for workflow without steps"""
        # Arrange & Act & Assert
        # Pydantic validates this at model creation time
        with pytest.raises(ValueError):
            workflow = WorkflowDefinition(
                name="Test Workflow",
                steps=[]
            )
    
    @pytest.mark.asyncio
    async def test_validate_approval_step_without_approvers(self, validation_service):
        """Test validation fails for approval step without approvers"""
        # Arrange
        workflow = WorkflowDefinition(
            name="Test Workflow",
            steps=[
                WorkflowStep(
                    step_order=0,
                    step_type=StepType.APPROVAL,
                    name="Approval Step",
                    approvers=[],  # No approvers
                    approver_roles=[],  # No roles
                    approval_type=ApprovalType.ALL
                )
            ]
        )
        
        # Act
        is_valid, errors = await validation_service.validate_workflow_definition(
            workflow,
            validate_approvers=False
        )
        
        # Assert
        assert not is_valid
        assert any("at least one approver" in error.lower() for error in errors)
    
    @pytest.mark.asyncio
    async def test_validate_quorum_without_count(self, validation_service):
        """Test validation fails for QUORUM approval without quorum_count"""
        # Arrange
        workflow = WorkflowDefinition(
            name="Test Workflow",
            steps=[
                WorkflowStep(
                    step_order=0,
                    step_type=StepType.APPROVAL,
                    name="Quorum Step",
                    approver_roles=["admin", "manager"],
                    approval_type=ApprovalType.QUORUM,
                    quorum_count=None  # Missing quorum count
                )
            ]
        )
        
        # Act
        is_valid, errors = await validation_service.validate_workflow_definition(
            workflow,
            validate_approvers=False
        )
        
        # Assert
        assert not is_valid
        assert any("quorum_count" in error.lower() for error in errors)
    
    @pytest.mark.asyncio
    async def test_validate_quorum_exceeds_approvers(self, validation_service):
        """Test validation fails when quorum exceeds total approvers"""
        # Arrange
        workflow = WorkflowDefinition(
            name="Test Workflow",
            steps=[
                WorkflowStep(
                    step_order=0,
                    step_type=StepType.APPROVAL,
                    name="Quorum Step",
                    approver_roles=["admin"],  # Only 1 approver
                    approval_type=ApprovalType.QUORUM,
                    quorum_count=3  # Requires 3 approvals
                )
            ]
        )
        
        # Act
        is_valid, errors = await validation_service.validate_workflow_definition(
            workflow,
            validate_approvers=False
        )
        
        # Assert
        assert not is_valid
        assert any("exceeds total number" in error.lower() for error in errors)
    
    @pytest.mark.asyncio
    async def test_validate_majority_with_single_approver(self, validation_service):
        """Test validation fails for MAJORITY approval with less than 2 approvers"""
        # Arrange
        workflow = WorkflowDefinition(
            name="Test Workflow",
            steps=[
                WorkflowStep(
                    step_order=0,
                    step_type=StepType.APPROVAL,
                    name="Majority Step",
                    approver_roles=["admin"],  # Only 1 approver
                    approval_type=ApprovalType.MAJORITY
                )
            ]
        )
        
        # Act
        is_valid, errors = await validation_service.validate_workflow_definition(
            workflow,
            validate_approvers=False
        )
        
        # Assert
        assert not is_valid
        assert any("at least 2 approvers" in error.lower() for error in errors)
    
    @pytest.mark.asyncio
    async def test_validate_sequential_approval_pattern(self, validation_service):
        """Test validation of sequential approval pattern"""
        # Arrange
        workflow = WorkflowDefinition(
            name="Sequential Workflow",
            steps=[
                WorkflowStep(
                    step_order=0,
                    step_type=StepType.APPROVAL,
                    name="First Approval",
                    approver_roles=["project_manager"],
                    approval_type=ApprovalType.ALL
                ),
                WorkflowStep(
                    step_order=1,
                    step_type=StepType.APPROVAL,
                    name="Second Approval",
                    approver_roles=["portfolio_manager"],
                    approval_type=ApprovalType.ALL
                )
            ]
        )
        
        # Act
        is_valid, errors = await validation_service.validate_workflow_definition(
            workflow,
            validate_approvers=False
        )
        
        # Assert
        assert is_valid
        assert len(errors) == 0
    
    @pytest.mark.asyncio
    async def test_validate_parallel_approval_pattern(self, validation_service):
        """Test validation of parallel approval pattern"""
        # Arrange
        approver_ids = [uuid4() for _ in range(3)]
        workflow = WorkflowDefinition(
            name="Parallel Workflow",
            steps=[
                WorkflowStep(
                    step_order=0,
                    step_type=StepType.APPROVAL,
                    name="Parallel Approval",
                    approvers=approver_ids,  # Multiple approvers in same step
                    approval_type=ApprovalType.MAJORITY
                )
            ]
        )
        
        # Act
        is_valid, errors = await validation_service.validate_workflow_definition(
            workflow,
            validate_approvers=False
        )
        
        # Assert
        assert is_valid
        assert len(errors) == 0
    
    @pytest.mark.asyncio
    async def test_validate_timeout_hours(self, validation_service):
        """Test validation of timeout hours"""
        # Arrange - valid timeout
        workflow = WorkflowDefinition(
            name="Test Workflow",
            steps=[
                WorkflowStep(
                    step_order=0,
                    step_type=StepType.APPROVAL,
                    name="Timed Approval",
                    approver_roles=["admin"],
                    approval_type=ApprovalType.ALL,
                    timeout_hours=72
                )
            ]
        )
        
        # Act
        is_valid, errors = await validation_service.validate_workflow_definition(
            workflow,
            validate_approvers=False
        )
        
        # Assert
        assert is_valid
        assert len(errors) == 0
    
    @pytest.mark.asyncio
    async def test_validate_invalid_timeout_hours(self, validation_service):
        """Test validation fails for invalid timeout hours"""
        # Arrange & Act & Assert
        # Pydantic validates this at model creation time
        with pytest.raises(ValueError):
            workflow = WorkflowDefinition(
                name="Test Workflow",
                steps=[
                    WorkflowStep(
                        step_order=0,
                        step_type=StepType.APPROVAL,
                        name="Invalid Timeout",
                        approver_roles=["admin"],
                        approval_type=ApprovalType.ALL,
                        timeout_hours=0  # Invalid
                    )
                ]
            )


class TestWorkflowTriggerValidation:
    """Test workflow trigger validation"""
    
    @pytest.fixture
    def mock_db(self):
        """Create mock database client"""
        db = Mock()
        db.table = Mock(return_value=Mock())
        return db
    
    @pytest.fixture
    def validation_service(self, mock_db):
        """Create validation service with mock database"""
        return WorkflowValidationService(mock_db)
    
    @pytest.mark.asyncio
    async def test_validate_budget_change_trigger(self, validation_service):
        """Test validation of budget change trigger"""
        # Arrange
        workflow = WorkflowDefinition(
            name="Budget Workflow",
            steps=[
                WorkflowStep(
                    step_order=0,
                    step_type=StepType.APPROVAL,
                    name="Budget Approval",
                    approver_roles=["portfolio_manager"],
                    approval_type=ApprovalType.ALL
                )
            ],
            triggers=[
                WorkflowTrigger(
                    trigger_type="budget_change",
                    conditions={"variance_type": "cost"},
                    threshold_values={"percentage": 10.0}
                )
            ]
        )
        
        # Act
        is_valid, errors = await validation_service.validate_workflow_definition(
            workflow,
            validate_approvers=False
        )
        
        # Assert
        assert is_valid
        assert len(errors) == 0
    
    @pytest.mark.asyncio
    async def test_validate_trigger_without_threshold(self, validation_service):
        """Test validation fails for threshold trigger without threshold values"""
        # Arrange
        workflow = WorkflowDefinition(
            name="Budget Workflow",
            steps=[
                WorkflowStep(
                    step_order=0,
                    step_type=StepType.APPROVAL,
                    name="Budget Approval",
                    approver_roles=["admin"],
                    approval_type=ApprovalType.ALL
                )
            ],
            triggers=[
                WorkflowTrigger(
                    trigger_type="budget_change",
                    conditions={},
                    threshold_values=None  # Missing threshold
                )
            ]
        )
        
        # Act
        is_valid, errors = await validation_service.validate_workflow_definition(
            workflow,
            validate_approvers=False
        )
        
        # Assert
        assert not is_valid
        assert any("threshold values required" in error.lower() for error in errors)


class TestApproverValidation:
    """Test approver validation against RBAC system"""
    
    @pytest.fixture
    def mock_db(self):
        """Create mock database client"""
        db = Mock()
        
        # Mock user_profiles table
        user_profiles_mock = Mock()
        user_profiles_mock.select.return_value = user_profiles_mock
        user_profiles_mock.eq.return_value = user_profiles_mock
        user_profiles_mock.execute.return_value = Mock(data=[{"id": "test-user-id"}])
        
        # Mock roles table
        roles_mock = Mock()
        roles_mock.select.return_value = roles_mock
        roles_mock.eq.return_value = roles_mock
        roles_mock.execute.return_value = Mock(data=[{
            "id": "role-id",
            "name": "project_manager",
            "permissions": ["project_update", "financial_update"]
        }])
        
        # Mock user_roles table
        user_roles_mock = Mock()
        user_roles_mock.select.return_value = user_roles_mock
        user_roles_mock.eq.return_value = user_roles_mock
        user_roles_mock.execute.return_value = Mock(data=[{
            "user_id": "test-user-id",
            "roles": {"name": "project_manager"}
        }])
        
        def table_selector(table_name):
            if table_name == "user_profiles":
                return user_profiles_mock
            elif table_name == "roles":
                return roles_mock
            elif table_name == "user_roles":
                return user_roles_mock
            return Mock()
        
        db.table = Mock(side_effect=table_selector)
        return db
    
    @pytest.fixture
    def validation_service(self, mock_db):
        """Create validation service with mock database"""
        return WorkflowValidationService(mock_db)
    
    @pytest.mark.asyncio
    async def test_validate_role_exists(self, validation_service):
        """Test validation of role existence"""
        # Act
        is_valid = await validation_service._validate_role("project_manager")
        
        # Assert
        assert is_valid
    
    @pytest.mark.asyncio
    async def test_validate_invalid_role(self, validation_service):
        """Test validation fails for non-existent role"""
        # Arrange
        validation_service.db.table("roles").execute.return_value = Mock(data=[])
        
        # Act
        is_valid = await validation_service._validate_role("invalid_role")
        
        # Assert
        assert not is_valid
    
    @pytest.mark.asyncio
    @patch('services.workflow_validation_service.rbac')
    async def test_validate_user_has_approval_permissions(self, mock_rbac, validation_service):
        """Test validation of user approval permissions"""
        # Arrange
        user_id = uuid4()
        
        # Mock the RBAC instance used by validation_service
        validation_service.rbac.get_user_permissions = AsyncMock(return_value=[
            Permission.project_update,
            Permission.financial_update
        ])
        
        # Act
        is_valid = await validation_service._validate_user_as_approver(user_id)
        
        # Assert
        assert is_valid
    
    @pytest.mark.asyncio
    @patch('services.workflow_validation_service.rbac')
    async def test_validate_user_without_approval_permissions(self, mock_rbac, validation_service):
        """Test validation fails for user without approval permissions"""
        # Arrange
        user_id = uuid4()
        
        # Mock the RBAC instance used by validation_service
        validation_service.rbac.get_user_permissions = AsyncMock(return_value=[
            Permission.project_read  # Only read permission
        ])
        
        # Act
        is_valid = await validation_service._validate_user_as_approver(user_id)
        
        # Assert
        assert not is_valid


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
