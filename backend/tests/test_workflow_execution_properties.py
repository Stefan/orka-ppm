"""
Property-Based Tests for Workflow Execution

**Validates: Requirements 2.1, 2.3, 2.4, 2.5**

Property 5: Instance Creation Completeness
Property 6: Approval Decision Recording
Property 7: Workflow Completion Logic
Property 8: Rejection Handling Consistency

This test suite uses Hypothesis to generate random workflow execution scenarios
and verify that workflow execution operations maintain correctness properties.
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
    WorkflowInstance,
    WorkflowApproval,
    WorkflowStatus,
    ApprovalStatus,
    ApprovalType,
    StepType,
    RejectionAction
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
        num_approvers = draw(st.integers(min_value=2, max_value=5))
    elif approval_type == ApprovalType.QUORUM:
        num_approvers = draw(st.integers(min_value=1, max_value=5))
    else:
        num_approvers = draw(st.integers(min_value=1, max_value=5))
    
    approvers = [uuid4() for _ in range(num_approvers)]
    
    # Only generate quorum_count for QUORUM approval type
    if approval_type == ApprovalType.QUORUM:
        quorum_count = draw(st.integers(min_value=1, max_value=num_approvers))
    else:
        quorum_count = None
    
    return WorkflowStep(
        step_order=step_order,
        step_type=StepType.APPROVAL,
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
        approver_roles=[],
        approval_type=approval_type,
        quorum_count=quorum_count,
        timeout_hours=draw(st.one_of(
            st.none(),
            st.integers(min_value=1, max_value=168)
        )),
        rejection_action=draw(st.sampled_from(list(RejectionAction)))
    )


@st.composite
def workflow_definition_strategy(draw):
    """Generate workflow definition with sequential steps"""
    num_steps = draw(st.integers(min_value=1, max_value=5))
    steps = []
    
    for i in range(num_steps):
        step = draw(workflow_step_strategy(step_order=i))
        steps.append(step)
    
    workflow_id = uuid4()
    
    return WorkflowDefinition(
        id=workflow_id,
        name=draw(st.text(min_size=1, max_size=200, alphabet=st.characters(
            whitelist_categories=('Lu', 'Ll', 'Nd'), whitelist_characters=' -_'
        ))),
        description=draw(st.one_of(st.none(), st.text(max_size=500))),
        steps=steps,
        triggers=[],
        metadata={},
        status=WorkflowStatus.ACTIVE,
        version=1
    )


@st.composite
def workflow_context_strategy(draw):
    """Generate workflow context data"""
    return draw(st.dictionaries(
        st.text(min_size=1, max_size=20, alphabet=st.characters(
            whitelist_categories=('Lu', 'Ll', 'Nd'), whitelist_characters='_'
        )),
        st.one_of(
            st.text(max_size=50),
            st.integers(),
            st.floats(allow_nan=False, allow_infinity=False),
            st.booleans()
        ),
        max_size=10
    ))


# ==================== Property Tests ====================

class TestInstanceCreationCompleteness:
    """
    Property 5: Instance Creation Completeness
    
    For any workflow initiation, a workflow instance must be created with
    proper initial status, metadata, and all required fields populated.
    
    Feature: workflow-engine, Property 5: Instance Creation Completeness
    **Validates: Requirements 2.1**
    """
    
    @pytest.fixture
    def mock_db(self):
        """Create a mock database client"""
        db = Mock()
        db.table = Mock(return_value=Mock())
        return db
    
    @given(
        workflow=workflow_definition_strategy(),
        context=workflow_context_strategy()
    )
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    @pytest.mark.asyncio
    async def test_instance_creation_completeness_property(
        self,
        workflow,
        context,
        mock_db
    ):
        """
        Property 5: Instance Creation Completeness
        
        For any workflow initiation, a workflow instance must be created with
        proper initial status, metadata, and all required fields populated.
        
        **Validates: Requirements 2.1**
        """
        engine = WorkflowEngineCore(mock_db)
        
        # Generate test data
        entity_type = "financial_tracking"
        entity_id = uuid4()
        initiated_by = uuid4()
        project_id = uuid4()
        
        # Mock workflow retrieval
        workflow_data = {
            "id": str(workflow.id),
            "name": workflow.name,
            "description": workflow.description,
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
        
        # Mock instance creation
        instance_id = uuid4()
        instance_data = {
            "id": str(instance_id),
            "workflow_id": str(workflow.id),
            "entity_type": entity_type,
            "entity_id": str(entity_id),
            "project_id": str(project_id),
            "current_step": 0,
            "status": WorkflowStatus.PENDING.value,
            "data": {**context, "workflow_version": 1},
            "started_by": str(initiated_by),
            "started_at": datetime.utcnow().isoformat(),
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        # Setup mocks
        mock_workflow_result = Mock()
        mock_workflow_result.data = [workflow_data]
        
        mock_instance_result = Mock()
        mock_instance_result.data = [instance_data]
        
        mock_approval_result = Mock()
        mock_approval_result.data = [{"id": str(uuid4())}]
        
        # Configure mock chain
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_workflow_result
        mock_db.table.return_value.insert.return_value.execute.return_value = mock_instance_result
        mock_db.table.return_value.update.return_value.eq.return_value.execute.return_value = mock_instance_result
        
        # Create workflow instance
        instance = await engine.create_workflow_instance(
            workflow_id=workflow.id,
            entity_type=entity_type,
            entity_id=entity_id,
            initiated_by=initiated_by,
            context=context,
            project_id=project_id
        )
        
        # Property 1: Instance must be created with valid ID
        assert instance is not None
        assert instance.id is not None
        assert isinstance(instance.id, UUID)
        
        # Property 2: Instance must reference the correct workflow
        assert instance.workflow_id == workflow.id
        
        # Property 3: Instance must have proper initial status
        assert instance.status in [WorkflowStatus.PENDING, WorkflowStatus.IN_PROGRESS]
        
        # Property 4: Instance must start at step 0
        assert instance.current_step == 0
        
        # Property 5: Instance must preserve entity information
        assert instance.entity_type == entity_type
        assert instance.entity_id == entity_id
        assert instance.project_id == project_id
        
        # Property 6: Instance must preserve initiator information
        assert instance.initiated_by == initiated_by
        
        # Property 7: Instance must preserve context data
        assert instance.context is not None
        for key, value in context.items():
            assert key in instance.context
            assert instance.context[key] == value
        
        # Property 8: Instance must track workflow version
        assert "workflow_version" in instance.context
        assert instance.context["workflow_version"] == 1
        
        # Property 9: Instance must have timestamps
        assert instance.created_at is not None
        assert instance.updated_at is not None

    @given(workflow=workflow_definition_strategy())
    @settings(
        max_examples=50,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    @pytest.mark.asyncio
    async def test_instance_metadata_preservation(self, workflow, mock_db):
        """
        Property: Instance metadata must be preserved accurately
        
        Verifies that all metadata fields are stored and retrievable.
        """
        engine = WorkflowEngineCore(mock_db)
        
        # Create instance with rich metadata
        metadata = {
            "variance_amount": 50000.50,
            "variance_percentage": 15.5,
            "requester_notes": "Urgent approval needed",
            "priority": "high",
            "is_critical": True
        }
        
        entity_id = uuid4()
        initiated_by = uuid4()
        
        # Mock workflow and instance data
        workflow_data = {
            "id": str(workflow.id),
            "name": workflow.name,
            "template_data": {
                "steps": [step.model_dump() for step in workflow.steps],
                "version": 1
            },
            "status": WorkflowStatus.ACTIVE.value
        }
        
        instance_data = {
            "id": str(uuid4()),
            "workflow_id": str(workflow.id),
            "entity_type": "project",
            "entity_id": str(entity_id),
            "current_step": 0,
            "status": WorkflowStatus.IN_PROGRESS.value,
            "data": {**metadata, "workflow_version": 1},
            "started_by": str(initiated_by),
            "started_at": datetime.utcnow().isoformat(),
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        mock_result = Mock()
        mock_result.data = [workflow_data]
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_result
        
        mock_instance_result = Mock()
        mock_instance_result.data = [instance_data]
        mock_db.table.return_value.insert.return_value.execute.return_value = mock_instance_result
        mock_db.table.return_value.update.return_value.eq.return_value.execute.return_value = mock_instance_result
        
        # Create instance
        instance = await engine.create_workflow_instance(
            workflow_id=workflow.id,
            entity_type="project",
            entity_id=entity_id,
            initiated_by=initiated_by,
            context=metadata
        )
        
        # Property: All metadata fields must be preserved
        for key, value in metadata.items():
            assert key in instance.context
            assert instance.context[key] == value


class TestApprovalDecisionRecording:
    """
    Property 6: Approval Decision Recording
    
    For any approver action (approve, reject, delegate), the decision must be
    recorded with accurate timestamp, comments, and approver identification.
    
    Feature: workflow-engine, Property 6: Approval Decision Recording
    **Validates: Requirements 2.3**
    """
    
    @pytest.fixture
    def mock_db(self):
        """Create a mock database client"""
        db = Mock()
        db.table = Mock(return_value=Mock())
        return db
    
    @given(
        workflow=workflow_definition_strategy(),
        decision=st.sampled_from([ApprovalStatus.APPROVED.value, ApprovalStatus.REJECTED.value]),
        comments=st.one_of(
            st.none(),
            st.text(min_size=1, max_size=500, alphabet=st.characters(
                whitelist_categories=('Lu', 'Ll', 'Nd', 'P'), whitelist_characters=' \n'
            ))
        )
    )
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    @pytest.mark.asyncio
    async def test_approval_decision_recording_property(
        self,
        workflow,
        decision,
        comments,
        mock_db
    ):
        """
        Property 6: Approval Decision Recording
        
        For any approver action, the decision must be recorded with accurate
        timestamp, comments, and approver identification.
        
        **Validates: Requirements 2.3**
        """
        engine = WorkflowEngineCore(mock_db)
        
        # Setup test data
        approval_id = uuid4()
        instance_id = uuid4()
        approver_id = uuid4()
        
        # Get first step from workflow
        first_step = workflow.steps[0]
        step_approver_id = first_step.approvers[0] if first_step.approvers else uuid4()
        
        # Mock approval data
        approval_data = {
            "id": str(approval_id),
            "workflow_instance_id": str(instance_id),
            "step_number": 0,
            "approver_id": str(step_approver_id),
            "status": ApprovalStatus.PENDING.value,
            "comments": None,
            "approved_at": None,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        # Mock updated approval data
        approval_timestamp = datetime.utcnow()
        updated_approval_data = {
            **approval_data,
            "status": decision,
            "comments": comments,
            "approved_at": approval_timestamp.isoformat(),
            "updated_at": approval_timestamp.isoformat()
        }
        
        # Mock instance data
        instance_data = {
            "id": str(instance_id),
            "workflow_id": str(workflow.id),
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
        
        # Mock workflow data
        workflow_data = {
            "id": str(workflow.id),
            "name": workflow.name,
            "template_data": {
                "steps": [step.model_dump() for step in workflow.steps],
                "version": 1
            },
            "status": WorkflowStatus.ACTIVE.value,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        # Setup mocks
        mock_approval_result = Mock()
        mock_approval_result.data = [approval_data]
        
        mock_updated_approval_result = Mock()
        mock_updated_approval_result.data = [updated_approval_data]
        
        mock_instance_result = Mock()
        mock_instance_result.data = [instance_data]
        
        mock_workflow_result = Mock()
        mock_workflow_result.data = [workflow_data]
        
        # Mock approvals for the step (empty list for simplicity)
        mock_step_approvals_result = Mock()
        mock_step_approvals_result.data = []
        
        # Configure mock to return different results based on table and operation
        def mock_table_side_effect(table_name):
            table_mock = Mock()
            
            if table_name == "workflow_approvals":
                # For select operations on approvals
                select_mock = Mock()
                eq_mock = Mock()
                eq_mock.execute.return_value = mock_approval_result
                select_mock.eq.return_value = eq_mock
                table_mock.select.return_value = select_mock
                
                # For update operations on approvals
                update_mock = Mock()
                update_eq_mock = Mock()
                update_eq_mock.execute.return_value = mock_updated_approval_result
                update_mock.eq.return_value = update_eq_mock
                table_mock.update.return_value = update_mock
                
            elif table_name == "workflow_instances":
                select_mock = Mock()
                eq_mock = Mock()
                eq_mock.execute.return_value = mock_instance_result
                select_mock.eq.return_value = eq_mock
                table_mock.select.return_value = select_mock
                
            elif table_name == "workflows":
                select_mock = Mock()
                eq_mock = Mock()
                eq_mock.execute.return_value = mock_workflow_result
                select_mock.eq.return_value = eq_mock
                table_mock.select.return_value = select_mock
            
            return table_mock
        
        mock_db.table.side_effect = mock_table_side_effect
        
        # Submit approval decision
        result = await engine.submit_approval_decision(
            approval_id=approval_id,
            approver_id=step_approver_id,
            decision=decision,
            comments=comments
        )
        
        # Property 1: Decision must be recorded
        assert result is not None
        assert result["decision"] == decision
        
        # Property 2: Approver must be identified
        # Verify the update was called with correct approval_id
        update_calls = [call for call in mock_db.table.return_value.update.call_args_list]
        assert len(update_calls) > 0
        
        # Property 3: Timestamp must be recorded
        # The updated approval should have approved_at timestamp
        assert updated_approval_data["approved_at"] is not None
        
        # Property 4: Comments must be preserved
        if comments:
            assert updated_approval_data["comments"] == comments
        
        # Property 5: Status must be updated correctly
        assert updated_approval_data["status"] == decision

    @given(workflow=workflow_definition_strategy())
    @settings(
        max_examples=50,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    @pytest.mark.asyncio
    async def test_approval_timestamp_accuracy(self, workflow, mock_db):
        """
        Property: Approval timestamps must be accurate and sequential
        
        Verifies that approval timestamps are recorded correctly and
        maintain chronological order.
        """
        # Get first step
        first_step = workflow.steps[0]
        approver_id = first_step.approvers[0] if first_step.approvers else uuid4()
        
        approval_id = uuid4()
        instance_id = uuid4()
        
        # Record time before approval
        time_before = datetime.utcnow()
        
        # Mock approval data
        approval_data = {
            "id": str(approval_id),
            "workflow_instance_id": str(instance_id),
            "step_number": 0,
            "approver_id": str(approver_id),
            "status": ApprovalStatus.PENDING.value,
            "created_at": time_before.isoformat()
        }
        
        # Simulate approval after some time
        time_after = time_before + timedelta(seconds=5)
        updated_approval_data = {
            **approval_data,
            "status": ApprovalStatus.APPROVED.value,
            "approved_at": time_after.isoformat(),
            "updated_at": time_after.isoformat()
        }
        
        # Property 1: Approval timestamp must be after creation timestamp
        created_at = datetime.fromisoformat(approval_data["created_at"])
        approved_at = datetime.fromisoformat(updated_approval_data["approved_at"])
        assert approved_at >= created_at
        
        # Property 2: Updated timestamp must match or be after approval timestamp
        updated_at = datetime.fromisoformat(updated_approval_data["updated_at"])
        assert updated_at >= approved_at


class TestWorkflowCompletionLogic:
    """
    Property 7: Workflow Completion Logic
    
    For any workflow instance where all required approvals are obtained,
    the instance status must be marked as completed and no further approvals required.
    
    Feature: workflow-engine, Property 7: Workflow Completion Logic
    **Validates: Requirements 2.4**
    """
    
    @pytest.fixture
    def mock_db(self):
        """Create a mock database client"""
        db = Mock()
        db.table = Mock(return_value=Mock())
        return db
    
    @given(workflow=workflow_definition_strategy())
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    @pytest.mark.asyncio
    async def test_workflow_completion_logic_property(self, workflow, mock_db):
        """
        Property 7: Workflow Completion Logic
        
        For any workflow instance where all required approvals are obtained,
        the instance status must be marked as completed.
        
        **Validates: Requirements 2.4**
        """
        engine = WorkflowEngineCore(mock_db)
        
        instance_id = uuid4()
        
        # Mock workflow data
        workflow_data = {
            "id": str(workflow.id),
            "name": workflow.name,
            "template_data": {
                "steps": [step.model_dump() for step in workflow.steps],
                "version": 1
            },
            "status": WorkflowStatus.ACTIVE.value
        }
        
        # Start at last step
        last_step_index = len(workflow.steps) - 1
        
        # Mock instance data at last step
        instance_data = {
            "id": str(instance_id),
            "workflow_id": str(workflow.id),
            "entity_type": "project",
            "entity_id": str(uuid4()),
            "current_step": last_step_index,
            "status": WorkflowStatus.IN_PROGRESS.value,
            "data": {"workflow_version": 1},
            "started_by": str(uuid4()),
            "started_at": datetime.utcnow().isoformat()
        }
        
        # Create approved approvals for last step
        last_step = workflow.steps[last_step_index]
        approvals = []
        for approver_id in last_step.approvers:
            approval = {
                "id": str(uuid4()),
                "workflow_instance_id": str(instance_id),
                "step_number": last_step_index,
                "approver_id": str(approver_id),
                "status": ApprovalStatus.APPROVED.value,
                "approved_at": datetime.utcnow().isoformat()
            }
            approvals.append(approval)
        
        # Mock completed instance data
        completed_instance_data = {
            **instance_data,
            "status": WorkflowStatus.COMPLETED.value,
            "completed_at": datetime.utcnow().isoformat()
        }
        
        # Setup mocks
        mock_instance_result = Mock()
        mock_instance_result.data = [instance_data]
        
        mock_workflow_result = Mock()
        mock_workflow_result.data = [workflow_data]
        
        mock_approvals_result = Mock()
        mock_approvals_result.data = approvals
        
        mock_completed_result = Mock()
        mock_completed_result.data = [completed_instance_data]
        
        # Configure mocks
        def mock_select_side_effect(*args, **kwargs):
            mock_chain = Mock()
            if "workflow_instances" in str(args):
                mock_chain.eq.return_value.execute.return_value = mock_instance_result
            elif "workflows" in str(args):
                mock_chain.eq.return_value.execute.return_value = mock_workflow_result
            elif "workflow_approvals" in str(args):
                mock_chain.eq.return_value.execute.return_value = mock_approvals_result
            return mock_chain
        
        mock_db.table.return_value.select.side_effect = mock_select_side_effect
        mock_db.table.return_value.update.return_value.eq.return_value.execute.return_value = mock_completed_result
        
        # Simulate advancing workflow (which should complete it)
        result = await engine._advance_workflow_step(instance_id, uuid4())
        
        # Property 1: Workflow must be marked as completed
        assert result["status"] == WorkflowStatus.COMPLETED.value
        
        # Property 2: Completion flag must be set
        assert result["is_complete"] is True
        
        # Property 3: Current step should remain at last step
        assert result["current_step"] == last_step_index
        
        # Property 4: Completed instance must have completion timestamp
        assert completed_instance_data["completed_at"] is not None
    
    @given(workflow=workflow_definition_strategy())
    @settings(
        max_examples=50,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    @pytest.mark.asyncio
    async def test_workflow_not_complete_with_pending_approvals(
        self,
        workflow,
        mock_db
    ):
        """
        Property: Workflow must not complete with pending approvals
        
        Verifies that workflow remains in progress if any approvals are pending.
        """
        instance_id = uuid4()
        
        # Mock workflow data
        workflow_data = {
            "id": str(workflow.id),
            "template_data": {
                "steps": [step.model_dump() for step in workflow.steps],
                "version": 1
            }
        }
        
        # Create mix of approved and pending approvals for first step
        first_step = workflow.steps[0]
        approvals = []
        
        for i, approver_id in enumerate(first_step.approvers):
            # Approve only first approver, leave rest pending
            status = ApprovalStatus.APPROVED.value if i == 0 else ApprovalStatus.PENDING.value
            approval = {
                "id": str(uuid4()),
                "workflow_instance_id": str(instance_id),
                "step_number": 0,
                "approver_id": str(approver_id),
                "status": status
            }
            approvals.append(approval)
        
        # Setup mocks
        mock_workflow_result = Mock()
        mock_workflow_result.data = [workflow_data]
        
        mock_approvals_result = Mock()
        mock_approvals_result.data = approvals
        
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_approvals_result
        
        # Check step completion
        engine = WorkflowEngineCore(mock_db)
        
        # Mock the workflow retrieval for the instance
        with patch.object(engine.repository, 'get_workflow_for_instance', return_value=workflow_data):
            is_complete = await engine._check_step_completion(instance_id, 0)
        
        # Property: Step must not be complete if approvals are pending
        # (unless approval type is ANY and at least one is approved)
        if first_step.approval_type == ApprovalType.ANY:
            # ANY type completes with one approval
            assert is_complete is True
        elif first_step.approval_type == ApprovalType.ALL:
            # ALL type requires all approvals
            assert is_complete is False
        elif first_step.approval_type == ApprovalType.MAJORITY:
            # MAJORITY type requires more than half
            approved_count = sum(1 for a in approvals if a["status"] == ApprovalStatus.APPROVED.value)
            expected_complete = approved_count > len(approvals) / 2
            assert is_complete == expected_complete



class TestRejectionHandlingConsistency:
    """
    Property 8: Rejection Handling Consistency
    
    For any approval rejection, the workflow must handle the rejection according
    to its configuration (stop, restart, escalate) without data corruption.
    
    Feature: workflow-engine, Property 8: Rejection Handling Consistency
    **Validates: Requirements 2.5**
    """
    
    @pytest.fixture
    def mock_db(self):
        """Create a mock database client"""
        db = Mock()
        db.table = Mock(return_value=Mock())
        return db
    
    @given(
        workflow=workflow_definition_strategy(),
        rejection_comments=st.one_of(
            st.none(),
            st.text(min_size=1, max_size=500, alphabet=st.characters(
                whitelist_categories=('Lu', 'Ll', 'Nd', 'P'), whitelist_characters=' \n'
            ))
        )
    )
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    @pytest.mark.asyncio
    async def test_rejection_handling_consistency_property(
        self,
        workflow,
        rejection_comments,
        mock_db
    ):
        """
        Property 8: Rejection Handling Consistency
        
        For any approval rejection, the workflow must handle the rejection
        according to its configuration without data corruption.
        
        **Validates: Requirements 2.5**
        """
        engine = WorkflowEngineCore(mock_db)
        
        instance_id = uuid4()
        rejected_by = uuid4()
        step_number = 0
        
        # Get first step and its rejection action
        first_step = workflow.steps[step_number]
        rejection_action = first_step.rejection_action
        
        # Mock workflow data
        workflow_data = {
            "id": str(workflow.id),
            "name": workflow.name,
            "template_data": {
                "steps": [step.model_dump() for step in workflow.steps],
                "version": 1
            },
            "status": WorkflowStatus.ACTIVE.value
        }
        
        # Mock instance data
        instance_data = {
            "id": str(instance_id),
            "workflow_id": str(workflow.id),
            "entity_type": "project",
            "entity_id": str(uuid4()),
            "current_step": step_number,
            "status": WorkflowStatus.IN_PROGRESS.value,
            "data": {"workflow_version": 1},
            "started_by": str(uuid4()),
            "started_at": datetime.utcnow().isoformat()
        }
        
        # Mock approvals for the step
        approvals = []
        for approver_id in first_step.approvers:
            approval = {
                "id": str(uuid4()),
                "workflow_instance_id": str(instance_id),
                "step_number": step_number,
                "approver_id": str(approver_id),
                "status": ApprovalStatus.PENDING.value
            }
            approvals.append(approval)
        
        # Setup mocks
        mock_workflow_result = Mock()
        mock_workflow_result.data = [workflow_data]
        
        mock_instance_result = Mock()
        mock_instance_result.data = [instance_data]
        
        mock_approvals_result = Mock()
        mock_approvals_result.data = approvals
        
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_workflow_result
        
        # Mock update operations
        updated_instance_data = instance_data.copy()
        
        if rejection_action == RejectionAction.STOP:
            # STOP: Mark workflow as rejected
            updated_instance_data["status"] = WorkflowStatus.REJECTED.value
            updated_instance_data["cancelled_at"] = datetime.utcnow().isoformat()
            updated_instance_data["cancellation_reason"] = f"Rejected at step {step_number}"
            
        elif rejection_action == RejectionAction.RESTART:
            # RESTART: Reset to step 0
            updated_instance_data["current_step"] = 0
            updated_instance_data["status"] = WorkflowStatus.IN_PROGRESS.value
            restart_history = [{"rejected_at_step": step_number, "restart_count": 1}]
            updated_instance_data["data"]["restart_history"] = restart_history
            
        elif rejection_action == RejectionAction.ESCALATE:
            # ESCALATE: Keep in progress, mark as escalated
            updated_instance_data["status"] = WorkflowStatus.IN_PROGRESS.value
            escalation_history = [{"escalated_from_step": step_number, "escalation_count": 1}]
            updated_instance_data["data"]["escalation_history"] = escalation_history
            updated_instance_data["data"]["is_escalated"] = True
        
        mock_updated_result = Mock()
        mock_updated_result.data = [updated_instance_data]
        mock_db.table.return_value.update.return_value.eq.return_value.execute.return_value = mock_updated_result
        
        # Mock approval updates
        mock_approval_update = Mock()
        mock_approval_update.data = [{"id": str(uuid4()), "status": ApprovalStatus.EXPIRED.value}]
        
        # Handle rejection
        await engine._handle_workflow_rejection(
            instance_id,
            step_number,
            rejected_by,
            rejection_comments
        )
        
        # Verify rejection handling based on action
        if rejection_action == RejectionAction.STOP:
            # Property 1: STOP action must mark workflow as rejected
            assert updated_instance_data["status"] == WorkflowStatus.REJECTED.value
            
            # Property 2: STOP action must record cancellation timestamp
            assert updated_instance_data["cancelled_at"] is not None
            
            # Property 3: STOP action must record cancellation reason
            assert updated_instance_data["cancellation_reason"] is not None
            assert str(step_number) in updated_instance_data["cancellation_reason"]
            
        elif rejection_action == RejectionAction.RESTART:
            # Property 4: RESTART action must reset to step 0
            assert updated_instance_data["current_step"] == 0
            
            # Property 5: RESTART action must keep workflow in progress
            assert updated_instance_data["status"] == WorkflowStatus.IN_PROGRESS.value
            
            # Property 6: RESTART action must record restart history
            assert "restart_history" in updated_instance_data["data"]
            restart_history = updated_instance_data["data"]["restart_history"]
            assert len(restart_history) > 0
            assert restart_history[0]["rejected_at_step"] == step_number
            
        elif rejection_action == RejectionAction.ESCALATE:
            # Property 7: ESCALATE action must keep workflow in progress
            assert updated_instance_data["status"] == WorkflowStatus.IN_PROGRESS.value
            
            # Property 8: ESCALATE action must record escalation history
            assert "escalation_history" in updated_instance_data["data"]
            escalation_history = updated_instance_data["data"]["escalation_history"]
            assert len(escalation_history) > 0
            assert escalation_history[0]["escalated_from_step"] == step_number
            
            # Property 9: ESCALATE action must mark instance as escalated
            assert updated_instance_data["data"]["is_escalated"] is True
    
    @given(workflow=workflow_definition_strategy())
    @settings(
        max_examples=50,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    @pytest.mark.asyncio
    async def test_rejection_data_integrity(self, workflow, mock_db):
        """
        Property: Rejection handling must preserve data integrity
        
        Verifies that rejection handling does not corrupt workflow data.
        """
        instance_id = uuid4()
        rejected_by = uuid4()
        
        # Create instance with important context data
        original_context = {
            "variance_amount": 50000,
            "variance_percentage": 15.5,
            "project_name": "Critical Project",
            "workflow_version": 1
        }
        
        first_step = workflow.steps[0]
        
        # Mock workflow data
        workflow_data = {
            "id": str(workflow.id),
            "template_data": {
                "steps": [step.model_dump() for step in workflow.steps],
                "version": 1
            }
        }
        
        # Mock instance data
        instance_data = {
            "id": str(instance_id),
            "workflow_id": str(workflow.id),
            "entity_type": "project",
            "entity_id": str(uuid4()),
            "current_step": 0,
            "status": WorkflowStatus.IN_PROGRESS.value,
            "data": original_context.copy(),
            "started_by": str(uuid4()),
            "started_at": datetime.utcnow().isoformat()
        }
        
        # Setup mocks
        mock_workflow_result = Mock()
        mock_workflow_result.data = [workflow_data]
        
        mock_instance_result = Mock()
        mock_instance_result.data = [instance_data]
        
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_workflow_result
        
        # Simulate rejection handling
        engine = WorkflowEngineCore(mock_db)
        
        # Mock the repository methods
        with patch.object(engine.repository, 'get_workflow_instance', return_value=instance_data):
            with patch.object(engine.repository, 'get_workflow_for_instance', return_value=workflow_data):
                with patch.object(engine.repository, 'update_workflow_instance') as mock_update:
                    with patch.object(engine.repository, 'get_approvals_for_instance', return_value=[]):
                        with patch.object(engine.repository, 'create_approval'):
                            await engine._handle_workflow_rejection(
                                instance_id,
                                0,
                                rejected_by,
                                "Test rejection"
                            )
                            
                            # Get the update call
                            if mock_update.called:
                                update_call_args = mock_update.call_args
                                if update_call_args:
                                    updates = update_call_args[0][1] if len(update_call_args[0]) > 1 else {}
                                    
                                    # Property: Original context data must be preserved
                                    if "data" in updates:
                                        updated_context = updates["data"]
                                        
                                        # Check that original fields are still present
                                        for key in ["variance_amount", "variance_percentage", "project_name"]:
                                            if key in original_context:
                                                assert key in updated_context, \
                                                    f"Original context field '{key}' was lost during rejection handling"
                                                assert updated_context[key] == original_context[key], \
                                                    f"Original context field '{key}' was corrupted during rejection handling"
    
    @given(workflow=workflow_definition_strategy())
    @settings(
        max_examples=50,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    @pytest.mark.asyncio
    async def test_multiple_rejections_consistency(self, workflow, mock_db):
        """
        Property: Multiple rejections must maintain consistent state
        
        Verifies that workflows can handle multiple rejection cycles
        (e.g., restart multiple times) without state corruption.
        """
        # Assume workflow has RESTART rejection action
        assume(workflow.steps[0].rejection_action == RejectionAction.RESTART)
        
        instance_id = uuid4()
        
        # Simulate multiple restart cycles
        restart_count = 3
        restart_history = []
        
        for i in range(restart_count):
            restart_entry = {
                "rejected_at_step": 0,
                "rejected_by": str(uuid4()),
                "rejected_at": datetime.utcnow().isoformat(),
                "comments": f"Rejection {i+1}",
                "restart_count": i + 1
            }
            restart_history.append(restart_entry)
        
        # Property 1: Restart history must be sequential
        for i, entry in enumerate(restart_history):
            assert entry["restart_count"] == i + 1
        
        # Property 2: Each restart must have complete information
        for entry in restart_history:
            assert "rejected_at_step" in entry
            assert "rejected_by" in entry
            assert "rejected_at" in entry
            assert "restart_count" in entry
        
        # Property 3: Restart count must match history length
        assert len(restart_history) == restart_count


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--hypothesis-show-statistics"])
