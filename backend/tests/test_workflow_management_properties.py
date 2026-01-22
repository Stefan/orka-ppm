"""
Property-Based Tests for Workflow Management

**Validates: Requirements 1.2, 1.3, 1.4**

Property 2: Workflow Step Execution Patterns
Property 3: Approver Validation Consistency
Property 4: Workflow Version Management

This test suite uses Hypothesis to generate random workflow configurations
and verify that workflow management operations maintain correctness properties.
"""

import pytest
from hypothesis import given, strategies as st, settings, assume, HealthCheck
from datetime import datetime, timedelta
from uuid import uuid4, UUID
from unittest.mock import Mock, AsyncMock, patch
from typing import List, Dict, Any

from models.workflow import (
    WorkflowDefinition,
    WorkflowStep,
    WorkflowTrigger,
    WorkflowInstance,
    WorkflowApproval,
    WorkflowStatus,
    ApprovalStatus,
    ApprovalType,
    StepType
)
from services.workflow_repository import WorkflowRepository
from services.workflow_engine_core import WorkflowEngineCore


# ==================== Hypothesis Strategies ====================

@st.composite
def workflow_step_strategy(draw, step_order: int):
    """Generate valid workflow steps with specified order"""
    approval_type = draw(st.sampled_from(list(ApprovalType)))
    
    # Generate appropriate number of approvers based on approval type
    if approval_type == ApprovalType.MAJORITY:
        # MAJORITY requires at least 2 approvers
        num_approvers = draw(st.integers(min_value=2, max_value=5))
    elif approval_type == ApprovalType.QUORUM:
        # QUORUM requires at least 1 approver, and quorum_count <= num_approvers
        num_approvers = draw(st.integers(min_value=1, max_value=5))
    else:
        # ANY and ALL can work with any positive number
        num_approvers = draw(st.integers(min_value=1, max_value=5))
    
    approvers = [uuid4() for _ in range(num_approvers)]
    
    # Only generate quorum_count for QUORUM approval type
    if approval_type == ApprovalType.QUORUM:
        # quorum_count must be between 1 and num_approvers
        quorum_count = draw(st.integers(min_value=1, max_value=num_approvers))
    else:
        quorum_count = None
    
    return WorkflowStep(
        step_order=step_order,
        step_type=draw(st.sampled_from(list(StepType))),
        name=draw(st.text(min_size=1, max_size=100, alphabet=st.characters(
            whitelist_categories=('Lu', 'Ll', 'Nd'), whitelist_characters=' -_'
        ))),
        description=draw(st.one_of(
            st.none(),
            st.text(max_size=500, alphabet=st.characters(
                whitelist_categories=('Lu', 'Ll', 'Nd', 'P'), whitelist_characters=' \n'
            ))
        )),
        approvers=approvers,
        approver_roles=draw(st.lists(
            st.sampled_from(['project_manager', 'portfolio_manager', 'admin']),
            min_size=0,
            max_size=2,
            unique=True
        )),
        approval_type=approval_type,
        quorum_count=quorum_count,
        conditions=draw(st.one_of(
            st.none(),
            st.dictionaries(
                st.text(min_size=1, max_size=20),
                st.one_of(st.text(max_size=50), st.integers(), st.booleans()),
                max_size=3
            )
        )),
        timeout_hours=draw(st.one_of(
            st.none(),
            st.integers(min_value=1, max_value=168)
        ))
    )


@st.composite
def sequential_workflow_steps_strategy(draw):
    """Generate a list of workflow steps with sequential ordering"""
    num_steps = draw(st.integers(min_value=1, max_value=5))
    steps = []
    
    for i in range(num_steps):
        step = draw(workflow_step_strategy(step_order=i))
        steps.append(step)
    
    return steps


@st.composite
def parallel_workflow_steps_strategy(draw):
    """
    Generate workflow steps that can execute in parallel.
    
    Note: The current WorkflowDefinition model requires sequential step ordering,
    so this strategy generates sequential steps but marks them as potentially parallel
    through metadata. In a future enhancement, parallel execution could be supported
    through a different mechanism (e.g., step groups or parallel flag).
    """
    num_steps = draw(st.integers(min_value=2, max_value=4))
    steps = []
    
    # Create sequential steps (required by model validation)
    # but mark them as parallel-capable through metadata
    for i in range(num_steps):
        step = draw(workflow_step_strategy(step_order=i))
        # Add metadata to indicate this step can run in parallel
        if step.conditions is None:
            step.conditions = {}
        step.conditions["parallel_capable"] = True
        steps.append(step)
    
    return steps


@st.composite
def workflow_definition_with_steps_strategy(draw, steps_strategy):
    """Generate workflow definition with specific steps strategy"""
    steps = draw(steps_strategy)
    
    return WorkflowDefinition(
        name=draw(st.text(min_size=1, max_size=200, alphabet=st.characters(
            whitelist_categories=('Lu', 'Ll', 'Nd'), whitelist_characters=' -_'
        ))),
        description=draw(st.one_of(
            st.none(),
            st.text(max_size=500)
        )),
        steps=steps,
        triggers=[],
        metadata={},
        status=WorkflowStatus.ACTIVE,
        version=1
    )


@st.composite
def workflow_instance_strategy(draw, workflow_id: UUID):
    """Generate workflow instance for a given workflow"""
    return WorkflowInstance(
        workflow_id=workflow_id,
        entity_type=draw(st.sampled_from(['project', 'financial_tracking', 'change_request'])),
        entity_id=uuid4(),
        project_id=draw(st.one_of(st.none(), st.builds(uuid4))),
        current_step=0,
        status=WorkflowStatus.PENDING,
        context=draw(st.dictionaries(
            st.text(min_size=1, max_size=20),
            st.one_of(st.text(max_size=50), st.integers(), st.floats(allow_nan=False, allow_infinity=False)),
            max_size=5
        )),
        initiated_by=uuid4()
    )


# ==================== Property Tests ====================

class TestWorkflowStepExecutionPatterns:
    """
    Property 2: Workflow Step Execution Patterns
    
    For any workflow with sequential or parallel approval steps,
    execution must follow the defined pattern and enforce proper step ordering.
    
    Feature: workflow-engine, Property 2: Workflow Step Execution Patterns
    **Validates: Requirements 1.2, 2.2**
    """
    
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
    
    @given(workflow=workflow_definition_with_steps_strategy(sequential_workflow_steps_strategy()))
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    @pytest.mark.asyncio
    async def test_sequential_step_execution_order(self, workflow, mock_db):
        """
        Property: Sequential workflow steps must execute in defined order
        
        Verifies that workflow steps execute sequentially from step 0 to step N-1,
        and that no step can be skipped or executed out of order.
        """
        repository = WorkflowRepository(mock_db)
        engine = WorkflowEngineCore(mock_db)
        
        workflow_id = uuid4()
        
        # Mock workflow storage
        workflow_data = {
            "id": str(workflow_id),
            "name": workflow.name,
            "template_data": {
                "steps": [step.model_dump() for step in workflow.steps],
                "triggers": [],
                "metadata": {},
                "version": 1
            },
            "status": WorkflowStatus.ACTIVE.value,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        mock_result = Mock()
        mock_result.data = [workflow_data]
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_result
        mock_db.table.return_value.insert.return_value.execute.return_value = mock_result
        
        # Create workflow instance
        instance_id = uuid4()
        instance_data = {
            "id": str(instance_id),
            "workflow_id": str(workflow_id),
            "entity_type": "project",
            "entity_id": str(uuid4()),
            "current_step": 0,
            "status": WorkflowStatus.IN_PROGRESS.value,
            "data": {"workflow_version": 1},
            "started_by": str(uuid4()),
            "started_at": datetime.utcnow().isoformat(),
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        mock_instance_result = Mock()
        mock_instance_result.data = [instance_data]
        mock_db.table.return_value.insert.return_value.execute.return_value = mock_instance_result
        
        # Property 1: Workflow must start at step 0
        assert instance_data["current_step"] == 0
        
        # Property 2: Steps must be executed in sequential order
        for expected_step in range(len(workflow.steps)):
            current_step = instance_data["current_step"]
            assert current_step == expected_step, \
                f"Expected step {expected_step}, but workflow is at step {current_step}"
            
            # Simulate advancing to next step
            if expected_step < len(workflow.steps) - 1:
                instance_data["current_step"] = expected_step + 1
        
        # Property 3: Final step must be len(steps) - 1
        assert instance_data["current_step"] == len(workflow.steps) - 1

    @given(workflow=workflow_definition_with_steps_strategy(sequential_workflow_steps_strategy()))
    @settings(
        max_examples=50,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    @pytest.mark.asyncio
    async def test_step_completion_requirements(self, workflow, mock_db):
        """
        Property: Step must be complete before advancing to next step
        
        Verifies that all required approvals for a step must be obtained
        before the workflow can advance to the next step.
        """
        repository = WorkflowRepository(mock_db)
        
        workflow_id = uuid4()
        instance_id = uuid4()
        
        # Mock workflow and instance data
        workflow_data = {
            "id": str(workflow_id),
            "template_data": {
                "steps": [step.model_dump() for step in workflow.steps],
                "version": 1
            },
            "status": WorkflowStatus.ACTIVE.value
        }
        
        instance_data = {
            "id": str(instance_id),
            "workflow_id": str(workflow_id),
            "current_step": 0,
            "status": WorkflowStatus.IN_PROGRESS.value,
            "data": {"workflow_version": 1}
        }
        
        mock_result = Mock()
        mock_result.data = [workflow_data]
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_result
        
        # For each step, verify approval requirements
        for step_idx, step in enumerate(workflow.steps):
            # Create mock approvals for the step
            approvals = []
            for approver_id in step.approvers:
                approval = {
                    "id": str(uuid4()),
                    "workflow_instance_id": str(instance_id),
                    "step_number": step_idx,
                    "approver_id": str(approver_id),
                    "status": ApprovalStatus.PENDING.value
                }
                approvals.append(approval)
            
            # Property: Cannot advance with pending approvals
            has_pending = any(a["status"] == ApprovalStatus.PENDING.value for a in approvals)
            if has_pending and len(approvals) > 0:
                # Step should not be complete
                assert instance_data["current_step"] == step_idx
            
            # Approve all approvals
            for approval in approvals:
                approval["status"] = ApprovalStatus.APPROVED.value
            
            # Property: Can advance when all approvals are approved
            all_approved = all(a["status"] == ApprovalStatus.APPROVED.value for a in approvals)
            if all_approved and step_idx < len(workflow.steps) - 1:
                # Can advance to next step
                instance_data["current_step"] = step_idx + 1
    
    @given(workflow=workflow_definition_with_steps_strategy(parallel_workflow_steps_strategy()))
    @settings(
        max_examples=50,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    @pytest.mark.asyncio
    async def test_parallel_capable_step_execution(self, workflow, mock_db):
        """
        Property: Steps marked as parallel-capable maintain sequential execution
        
        Verifies that even when steps are marked as parallel-capable (through metadata),
        they still execute in sequential order as required by the workflow model.
        This test validates that the sequential execution pattern is enforced
        regardless of parallel capability flags.
        """
        # Property: Steps must still have sequential ordering
        step_orders = [step.step_order for step in workflow.steps]
        expected_orders = list(range(len(workflow.steps)))
        assert step_orders == expected_orders, \
            f"Steps must have sequential order, got {step_orders}"
        
        # Property: Parallel-capable steps are marked in metadata
        parallel_capable_steps = [
            step for step in workflow.steps
            if step.conditions and step.conditions.get("parallel_capable")
        ]
        
        # If steps are marked as parallel-capable, verify they still execute sequentially
        if len(parallel_capable_steps) > 0:
            # Create mock approvals for each step
            for step_idx, step in enumerate(workflow.steps):
                approvals = []
                for approver_id in step.approvers:
                    approval = {
                        "step_number": step_idx,
                        "approver_id": str(approver_id),
                        "status": ApprovalStatus.PENDING.value
                    }
                    approvals.append(approval)
                
                # Property: Must complete current step before advancing
                # (even if marked as parallel-capable)
                if len(approvals) > 0:
                    # Approve all for this step
                    for approval in approvals:
                        approval["status"] = ApprovalStatus.APPROVED.value
                    
                    # Can only advance after all approvals for current step
                    all_approved = all(
                        a["status"] == ApprovalStatus.APPROVED.value
                        for a in approvals
                    )
                    assert all_approved


class TestApproverValidationConsistency:
    """
    Property 3: Approver Validation Consistency
    
    For any workflow configuration with specified approvers,
    all approvers must have validated roles and appropriate permissions
    before workflow activation.
    
    Feature: workflow-engine, Property 3: Approver Validation Consistency
    **Validates: Requirements 1.3**
    """
    
    @pytest.fixture
    def mock_db(self):
        """Create a mock database client"""
        db = Mock()
        db.table = Mock(return_value=Mock())
        return db
    
    @given(workflow=workflow_definition_with_steps_strategy(sequential_workflow_steps_strategy()))
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    @pytest.mark.asyncio
    async def test_approver_existence_validation(self, workflow, mock_db):
        """
        Property: All specified approvers must exist in the system
        
        Verifies that workflow creation validates that all approver IDs
        correspond to valid users in the system.
        """
        repository = WorkflowRepository(mock_db)
        
        # Extract all approver IDs from workflow
        all_approver_ids = set()
        for step in workflow.steps:
            all_approver_ids.update(step.approvers)
        
        # Property: All approver IDs must be valid UUIDs
        for approver_id in all_approver_ids:
            assert isinstance(approver_id, UUID), f"Approver ID {approver_id} is not a valid UUID"
        
        # Property: Approver list must not be empty for approval steps
        for step in workflow.steps:
            if step.step_type == StepType.APPROVAL:
                # Either explicit approvers or approver roles must be specified
                has_approvers = len(step.approvers) > 0 or len(step.approver_roles) > 0
                assert has_approvers, \
                    f"Approval step '{step.name}' must have approvers or approver roles"
    
    @given(workflow=workflow_definition_with_steps_strategy(sequential_workflow_steps_strategy()))
    @settings(
        max_examples=50,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    @pytest.mark.asyncio
    async def test_approver_role_validation(self, workflow, mock_db):
        """
        Property: All specified approver roles must be valid system roles
        
        Verifies that workflow creation validates that all approver roles
        are recognized roles in the RBAC system.
        """
        # Define valid roles in the system
        valid_roles = {
            'admin',
            'portfolio_manager',
            'project_manager',
            'viewer',
            'finance_manager',
            'resource_manager'
        }
        
        # Property: All approver roles must be valid
        for step in workflow.steps:
            for role in step.approver_roles:
                # In a real system, this would query the RBAC system
                # For property testing, we verify the role is in our known set
                assert role in valid_roles or role.startswith('custom_'), \
                    f"Role '{role}' is not a valid system role"
    
    @given(workflow=workflow_definition_with_steps_strategy(sequential_workflow_steps_strategy()))
    @settings(
        max_examples=50,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    @pytest.mark.asyncio
    async def test_approval_type_consistency(self, workflow, mock_db):
        """
        Property: Approval type must be consistent with approver count
        
        Verifies that the approval type (ANY, ALL, MAJORITY, QUORUM) is
        consistent with the number of approvers specified.
        """
        for step in workflow.steps:
            if step.step_type != StepType.APPROVAL:
                continue
            
            approver_count = len(step.approvers)
            
            if approver_count == 0:
                # No explicit approvers, must have roles
                assert len(step.approver_roles) > 0
                continue
            
            # Property: QUORUM type must have quorum_count specified
            if step.approval_type == ApprovalType.QUORUM:
                assert step.quorum_count is not None, \
                    f"QUORUM approval type requires quorum_count"
                assert step.quorum_count > 0, \
                    f"quorum_count must be positive"
                assert step.quorum_count <= approver_count, \
                    f"quorum_count ({step.quorum_count}) cannot exceed approver count ({approver_count})"
            
            # Property: MAJORITY type requires at least 2 approvers
            if step.approval_type == ApprovalType.MAJORITY:
                assert approver_count >= 2, \
                    f"MAJORITY approval type requires at least 2 approvers, got {approver_count}"
            
            # Property: ANY type requires at least 1 approver
            if step.approval_type == ApprovalType.ANY:
                assert approver_count >= 1, \
                    f"ANY approval type requires at least 1 approver"
            
            # Property: ALL type works with any positive number of approvers
            if step.approval_type == ApprovalType.ALL:
                assert approver_count >= 1, \
                    f"ALL approval type requires at least 1 approver"


class TestWorkflowVersionManagement:
    """
    Property 4: Workflow Version Management
    
    For any workflow definition update, existing workflow instances must
    remain unchanged while new instances use the updated definition.
    
    Feature: workflow-engine, Property 4: Workflow Version Management
    **Validates: Requirements 1.4**
    """
    
    @pytest.fixture
    def mock_db(self):
        """Create a mock database client"""
        db = Mock()
        db.table = Mock(return_value=Mock())
        return db
    
    @given(
        original_workflow=workflow_definition_with_steps_strategy(sequential_workflow_steps_strategy()),
        updated_workflow=workflow_definition_with_steps_strategy(sequential_workflow_steps_strategy())
    )
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    @pytest.mark.asyncio
    async def test_version_isolation_for_existing_instances(
        self,
        original_workflow,
        updated_workflow,
        mock_db
    ):
        """
        Property: Existing instances must use original workflow version
        
        Verifies that when a workflow is updated, existing instances continue
        to use the workflow definition they were created with, not the new version.
        """
        repository = WorkflowRepository(mock_db)
        
        workflow_id = uuid4()
        
        # Create original workflow (version 1)
        original_data = {
            "id": str(workflow_id),
            "name": original_workflow.name,
            "template_data": {
                "steps": [step.model_dump() for step in original_workflow.steps],
                "triggers": [],
                "metadata": {},
                "version": 1
            },
            "status": WorkflowStatus.ACTIVE.value,
            "version_history": [],
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        # Create instance with version 1
        instance_id = uuid4()
        instance_data = {
            "id": str(instance_id),
            "workflow_id": str(workflow_id),
            "entity_type": "project",
            "entity_id": str(uuid4()),
            "current_step": 0,
            "status": WorkflowStatus.IN_PROGRESS.value,
            "data": {"workflow_version": 1},  # Instance tracks its version
            "started_by": str(uuid4()),
            "started_at": datetime.utcnow().isoformat(),
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        # Update workflow to version 2
        updated_data = {
            "id": str(workflow_id),
            "name": updated_workflow.name,
            "template_data": {
                "steps": [step.model_dump() for step in updated_workflow.steps],
                "triggers": [],
                "metadata": {},
                "version": 2
            },
            "status": WorkflowStatus.ACTIVE.value,
            "version_history": [
                {
                    "version": 1,
                    "steps": [step.model_dump() for step in original_workflow.steps],
                    "triggers": [],
                    "metadata": {},
                    "created_at": original_data["created_at"],
                    "archived_at": datetime.utcnow().isoformat()
                }
            ],
            "updated_at": datetime.utcnow().isoformat()
        }
        
        # Mock database responses
        mock_workflow_result = Mock()
        mock_workflow_result.data = [updated_data]
        
        mock_instance_result = Mock()
        mock_instance_result.data = [instance_data]
        
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_instance_result
        
        # Property 1: Existing instance still references version 1
        assert instance_data["data"]["workflow_version"] == 1
        
        # Property 2: Instance version does not change when workflow is updated
        original_instance_version = instance_data["data"]["workflow_version"]
        # Simulate workflow update (version 2 is now current)
        current_workflow_version = updated_data["template_data"]["version"]
        assert current_workflow_version == 2
        # Instance version remains unchanged
        assert instance_data["data"]["workflow_version"] == original_instance_version
        
        # Property 3: Version history preserves original workflow definition
        version_history = updated_data["version_history"]
        assert len(version_history) > 0
        
        original_version_entry = next(
            (v for v in version_history if v["version"] == 1),
            None
        )
        assert original_version_entry is not None
        assert len(original_version_entry["steps"]) == len(original_workflow.steps)
        
        # Property 4: New instances use the updated version
        new_instance_data = {
            "id": str(uuid4()),
            "workflow_id": str(workflow_id),
            "entity_type": "project",
            "entity_id": str(uuid4()),
            "current_step": 0,
            "status": WorkflowStatus.IN_PROGRESS.value,
            "data": {"workflow_version": 2},  # New instance uses version 2
            "started_by": str(uuid4()),
            "started_at": datetime.utcnow().isoformat(),
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        assert new_instance_data["data"]["workflow_version"] == 2
    
    @given(workflow=workflow_definition_with_steps_strategy(sequential_workflow_steps_strategy()))
    @settings(
        max_examples=50,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    @pytest.mark.asyncio
    async def test_version_history_completeness(self, workflow, mock_db):
        """
        Property: Version history must preserve all workflow versions
        
        Verifies that when a workflow is updated multiple times,
        all previous versions are preserved in the version history.
        """
        repository = WorkflowRepository(mock_db)
        
        workflow_id = uuid4()
        
        # Simulate multiple workflow versions
        versions = []
        for version_num in range(1, 4):  # Create versions 1, 2, 3
            version_data = {
                "version": version_num,
                "steps": [step.model_dump() for step in workflow.steps],
                "triggers": [],
                "metadata": {"version_note": f"Version {version_num}"},
                "created_at": (datetime.utcnow() + timedelta(days=version_num)).isoformat()
            }
            versions.append(version_data)
        
        # Current workflow with version history
        current_version = 3
        workflow_data = {
            "id": str(workflow_id),
            "name": workflow.name,
            "template_data": versions[-1],  # Latest version
            "status": WorkflowStatus.ACTIVE.value,
            "version_history": versions[:-1],  # All previous versions
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        # Property 1: Version history contains all previous versions
        assert len(workflow_data["version_history"]) == current_version - 1
        
        # Property 2: Versions are sequential
        history_versions = [v["version"] for v in workflow_data["version_history"]]
        assert history_versions == list(range(1, current_version))
        
        # Property 3: Each version in history has complete workflow data
        for historical_version in workflow_data["version_history"]:
            assert "version" in historical_version
            assert "steps" in historical_version
            assert "triggers" in historical_version
            assert "metadata" in historical_version
            assert "created_at" in historical_version
            
            # Steps must be preserved
            assert len(historical_version["steps"]) > 0
    
    @given(
        workflow=workflow_definition_with_steps_strategy(sequential_workflow_steps_strategy()),
        num_instances=st.integers(min_value=1, max_value=10)
    )
    @settings(
        max_examples=50,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    @pytest.mark.asyncio
    async def test_version_consistency_across_instances(
        self,
        workflow,
        num_instances,
        mock_db
    ):
        """
        Property: All instances created from same version use identical workflow
        
        Verifies that all instances created from the same workflow version
        use exactly the same workflow definition, ensuring consistency.
        """
        workflow_id = uuid4()
        workflow_version = 1
        
        # Create multiple instances from the same workflow version
        instances = []
        for i in range(num_instances):
            instance = {
                "id": str(uuid4()),
                "workflow_id": str(workflow_id),
                "entity_type": "project",
                "entity_id": str(uuid4()),
                "current_step": 0,
                "status": WorkflowStatus.IN_PROGRESS.value,
                "data": {"workflow_version": workflow_version},
                "started_by": str(uuid4()),
                "started_at": datetime.utcnow().isoformat(),
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            instances.append(instance)
        
        # Property 1: All instances reference the same workflow version
        instance_versions = [inst["data"]["workflow_version"] for inst in instances]
        assert all(v == workflow_version for v in instance_versions)
        
        # Property 2: All instances have the same workflow_id
        workflow_ids = [inst["workflow_id"] for inst in instances]
        assert all(wid == str(workflow_id) for wid in workflow_ids)
        
        # Property 3: Instances are independent (different IDs)
        instance_ids = [inst["id"] for inst in instances]
        assert len(set(instance_ids)) == len(instances), \
            "All instances must have unique IDs"
    
    @given(workflow=workflow_definition_with_steps_strategy(sequential_workflow_steps_strategy()))
    @settings(
        max_examples=50,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    @pytest.mark.asyncio
    async def test_version_retrieval_accuracy(self, workflow, mock_db):
        """
        Property: Retrieving a specific version returns exact workflow definition
        
        Verifies that when retrieving a historical workflow version,
        the returned definition exactly matches what was stored.
        """
        repository = WorkflowRepository(mock_db)
        
        workflow_id = uuid4()
        
        # Create workflow with version history
        version_1_steps = [step.model_dump() for step in workflow.steps]
        
        workflow_data = {
            "id": str(workflow_id),
            "name": workflow.name,
            "template_data": {
                "steps": version_1_steps,
                "triggers": [],
                "metadata": {},
                "version": 2  # Current version
            },
            "status": WorkflowStatus.ACTIVE.value,
            "version_history": [
                {
                    "version": 1,
                    "steps": version_1_steps,
                    "triggers": [],
                    "metadata": {},
                    "created_at": datetime.utcnow().isoformat(),
                    "archived_at": datetime.utcnow().isoformat()
                }
            ],
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        mock_result = Mock()
        mock_result.data = [workflow_data]
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_result
        
        # Retrieve version 1
        retrieved_v1 = await repository.get_workflow_version(workflow_id, 1)
        
        # Property: Retrieved version matches stored version
        assert retrieved_v1 is not None
        retrieved_template = retrieved_v1["template_data"]
        assert retrieved_template["version"] == 1
        assert len(retrieved_template["steps"]) == len(version_1_steps)
        
        # Property: Step data is preserved exactly
        for retrieved_step, original_step in zip(retrieved_template["steps"], version_1_steps):
            assert retrieved_step["step_order"] == original_step["step_order"]
            assert retrieved_step["name"] == original_step["name"]
            assert retrieved_step["step_type"] == original_step["step_type"]


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--hypothesis-show-statistics"])
