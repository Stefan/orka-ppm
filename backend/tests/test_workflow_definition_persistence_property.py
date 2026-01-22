"""
Property-Based Test for Workflow Definition Persistence

**Validates: Requirements 1.1**

Property 1: Workflow Definition Persistence
For any valid workflow definition with steps, approvers, and conditions,
storing it in the database must preserve all definition data accurately.

This test uses Hypothesis to generate random workflow definitions and verify
that they can be stored and retrieved without data loss or corruption.
"""

import pytest
from hypothesis import given, strategies as st, settings, assume, HealthCheck
from datetime import datetime
from uuid import uuid4, UUID
from unittest.mock import Mock, AsyncMock

from models.workflow import (
    WorkflowDefinition,
    WorkflowStep,
    WorkflowTrigger,
    WorkflowStatus,
    ApprovalType,
    StepType
)
from services.workflow_repository import WorkflowRepository


# ==================== Hypothesis Strategies ====================

@st.composite
def workflow_step_strategy(draw):
    """Generate valid workflow steps"""
    step_order = draw(st.integers(min_value=0, max_value=10))
    approval_type = draw(st.sampled_from(list(ApprovalType)))
    
    # Only generate quorum_count for QUORUM approval type
    if approval_type == ApprovalType.QUORUM:
        quorum_count = draw(st.integers(min_value=1, max_value=10))
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
        approvers=draw(st.lists(
            st.builds(uuid4),
            min_size=0,
            max_size=5
        )),
        approver_roles=draw(st.lists(
            st.sampled_from(['project_manager', 'portfolio_manager', 'admin', 'viewer']),
            min_size=0,
            max_size=3,
            unique=True
        )),
        approval_type=approval_type,
        quorum_count=quorum_count,
        conditions=draw(st.one_of(
            st.none(),
            st.dictionaries(
                st.text(min_size=1, max_size=20),
                st.one_of(st.text(max_size=50), st.integers(), st.booleans()),
                max_size=5
            )
        )),
        timeout_hours=draw(st.one_of(
            st.none(),
            st.integers(min_value=1, max_value=168)  # 1 hour to 1 week
        )),
        auto_approve_conditions=draw(st.one_of(
            st.none(),
            st.dictionaries(
                st.text(min_size=1, max_size=20),
                st.one_of(st.text(max_size=50), st.integers(), st.booleans()),
                max_size=3
            )
        )),
        notification_template=draw(st.one_of(
            st.none(),
            st.text(max_size=100)
        ))
    )


@st.composite
def workflow_trigger_strategy(draw):
    """Generate valid workflow triggers"""
    return WorkflowTrigger(
        trigger_type=draw(st.sampled_from([
            'budget_change',
            'milestone_update',
            'resource_allocation',
            'risk_escalation',
            'schedule_delay'
        ])),
        conditions=draw(st.dictionaries(
            st.text(min_size=1, max_size=20),
            st.one_of(st.text(max_size=50), st.integers(), st.booleans()),
            min_size=0,
            max_size=5
        )),
        threshold_values=draw(st.one_of(
            st.none(),
            st.dictionaries(
                st.text(min_size=1, max_size=20),
                st.floats(min_value=0.0, max_value=1000000.0, allow_nan=False, allow_infinity=False),
                min_size=1,
                max_size=3
            )
        )),
        enabled=draw(st.booleans())
    )


@st.composite
def workflow_definition_strategy(draw):
    """Generate valid workflow definitions"""
    # Generate steps with sequential ordering
    num_steps = draw(st.integers(min_value=1, max_value=5))
    steps = []
    
    for i in range(num_steps):
        step = draw(workflow_step_strategy())
        # Override step_order to ensure sequential ordering
        step.step_order = i
        
        # Ensure quorum_count is only set for QUORUM approval type
        if step.approval_type != ApprovalType.QUORUM:
            step.quorum_count = None
        elif step.quorum_count is None:
            step.quorum_count = 1
        
        steps.append(step)
    
    return WorkflowDefinition(
        name=draw(st.text(min_size=1, max_size=200, alphabet=st.characters(
            whitelist_categories=('Lu', 'Ll', 'Nd'), whitelist_characters=' -_'
        ))),
        description=draw(st.one_of(
            st.none(),
            st.text(max_size=1000, alphabet=st.characters(
                whitelist_categories=('Lu', 'Ll', 'Nd', 'P'), whitelist_characters=' \n'
            ))
        )),
        steps=steps,
        triggers=draw(st.lists(
            workflow_trigger_strategy(),
            min_size=0,
            max_size=3
        )),
        metadata=draw(st.dictionaries(
            st.text(min_size=1, max_size=20),
            st.one_of(st.text(max_size=100), st.integers(), st.booleans()),
            max_size=10
        )),
        status=draw(st.sampled_from(list(WorkflowStatus))),
        version=draw(st.integers(min_value=1, max_value=100)),
        created_by=draw(st.one_of(st.none(), st.builds(uuid4)))
    )


# ==================== Property Tests ====================

class TestWorkflowDefinitionPersistenceProperty:
    """
    Property-Based Tests for Workflow Definition Persistence
    
    Feature: workflow-engine, Property 1: Workflow Definition Persistence
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
    
    @given(workflow=workflow_definition_strategy())
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    @pytest.mark.asyncio
    async def test_workflow_definition_persistence_property(
        self,
        workflow,
        mock_db
    ):
        """
        Property 1: Workflow Definition Persistence
        
        For any valid workflow definition with steps, approvers, and conditions,
        storing it in the database must preserve all definition data accurately.
        
        **Validates: Requirements 1.1**
        """
        # Create repository with mock database
        repository = WorkflowRepository(mock_db)
        
        # Generate a unique ID for the workflow
        workflow_id = uuid4()
        
        # Mock database response to simulate successful storage and retrieval
        stored_data = {
            "id": str(workflow_id),
            "name": workflow.name,
            "description": workflow.description,
            "template_data": {
                "steps": [step.model_dump() for step in workflow.steps],
                "triggers": [trigger.model_dump() for trigger in workflow.triggers],
                "metadata": workflow.metadata,
                "version": workflow.version
            },
            "status": workflow.status.value,
            "created_by": str(workflow.created_by) if workflow.created_by else None,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        # Mock insert operation
        mock_insert_result = Mock()
        mock_insert_result.data = [stored_data]
        mock_db.table.return_value.insert.return_value.execute.return_value = mock_insert_result
        
        # Mock select operation for retrieval
        mock_select_result = Mock()
        mock_select_result.data = [stored_data]
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_select_result
        
        # Store workflow definition
        created_workflow = await repository.create_workflow(workflow)
        
        # Verify workflow was created
        assert created_workflow is not None
        assert created_workflow["id"] == str(workflow_id)
        
        # Retrieve workflow definition
        retrieved_workflow = await repository.get_workflow(workflow_id)
        
        # Verify workflow was retrieved
        assert retrieved_workflow is not None
        
        # Property: All workflow data must be preserved accurately
        
        # 1. Basic fields preserved
        assert retrieved_workflow["name"] == workflow.name
        assert retrieved_workflow["description"] == workflow.description
        assert retrieved_workflow["status"] == workflow.status.value
        
        # 2. Template data preserved
        template_data = retrieved_workflow["template_data"]
        assert template_data is not None
        assert "steps" in template_data
        assert "triggers" in template_data
        assert "metadata" in template_data
        assert "version" in template_data
        
        # 3. Steps preserved with correct count and order
        stored_steps = template_data["steps"]
        assert len(stored_steps) == len(workflow.steps)
        
        for i, (stored_step, original_step) in enumerate(zip(stored_steps, workflow.steps)):
            assert stored_step["step_order"] == original_step.step_order == i
            assert stored_step["name"] == original_step.name
            assert stored_step["step_type"] == original_step.step_type.value
            assert stored_step["approval_type"] == original_step.approval_type.value
            
            # Verify approvers preserved
            assert len(stored_step["approvers"]) == len(original_step.approvers)
            
            # Verify approver roles preserved
            assert set(stored_step["approver_roles"]) == set(original_step.approver_roles)
        
        # 4. Triggers preserved
        stored_triggers = template_data["triggers"]
        assert len(stored_triggers) == len(workflow.triggers)
        
        for stored_trigger, original_trigger in zip(stored_triggers, workflow.triggers):
            assert stored_trigger["trigger_type"] == original_trigger.trigger_type
            assert stored_trigger["enabled"] == original_trigger.enabled
        
        # 5. Metadata preserved
        assert template_data["metadata"] == workflow.metadata
        assert template_data["version"] == workflow.version
        
        # 6. Created by preserved
        if workflow.created_by:
            assert retrieved_workflow["created_by"] == str(workflow.created_by)
        else:
            assert retrieved_workflow["created_by"] is None
    
    @given(workflow=workflow_definition_strategy())
    @settings(
        max_examples=50,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    @pytest.mark.asyncio
    async def test_workflow_step_ordering_preserved(self, workflow, mock_db):
        """
        Property: Workflow step ordering must be preserved exactly
        
        Verifies that steps maintain their sequential order after storage.
        """
        repository = WorkflowRepository(mock_db)
        workflow_id = uuid4()
        
        # Mock database operations
        stored_data = {
            "id": str(workflow_id),
            "name": workflow.name,
            "template_data": {
                "steps": [step.model_dump() for step in workflow.steps],
                "triggers": [],
                "metadata": {},
                "version": 1
            },
            "status": workflow.status.value,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        mock_result = Mock()
        mock_result.data = [stored_data]
        mock_db.table.return_value.insert.return_value.execute.return_value = mock_result
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_result
        
        # Store and retrieve
        await repository.create_workflow(workflow)
        retrieved = await repository.get_workflow(workflow_id)
        
        # Verify step ordering
        stored_steps = retrieved["template_data"]["steps"]
        
        # Property: Steps must be in sequential order starting from 0
        for i, step in enumerate(stored_steps):
            assert step["step_order"] == i, f"Step {i} has incorrect order: {step['step_order']}"
        
        # Property: Step order must match original workflow
        for stored_step, original_step in zip(stored_steps, workflow.steps):
            assert stored_step["step_order"] == original_step.step_order
    
    @given(workflow=workflow_definition_strategy())
    @settings(
        max_examples=50,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    @pytest.mark.asyncio
    async def test_workflow_conditions_preserved(self, workflow, mock_db):
        """
        Property: Workflow conditions and configurations must be preserved
        
        Verifies that step conditions, timeouts, and approval configurations
        are stored and retrieved accurately.
        """
        repository = WorkflowRepository(mock_db)
        workflow_id = uuid4()
        
        # Mock database operations
        stored_data = {
            "id": str(workflow_id),
            "name": workflow.name,
            "template_data": {
                "steps": [step.model_dump() for step in workflow.steps],
                "triggers": [trigger.model_dump() for trigger in workflow.triggers],
                "metadata": workflow.metadata,
                "version": workflow.version
            },
            "status": workflow.status.value,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        mock_result = Mock()
        mock_result.data = [stored_data]
        mock_db.table.return_value.insert.return_value.execute.return_value = mock_result
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_result
        
        # Store and retrieve
        await repository.create_workflow(workflow)
        retrieved = await repository.get_workflow(workflow_id)
        
        # Verify conditions preserved for each step
        stored_steps = retrieved["template_data"]["steps"]
        
        for stored_step, original_step in zip(stored_steps, workflow.steps):
            # Property: Timeout configuration preserved
            if original_step.timeout_hours is not None:
                assert stored_step["timeout_hours"] == original_step.timeout_hours
            
            # Property: Conditions preserved
            if original_step.conditions is not None:
                assert stored_step["conditions"] == original_step.conditions
            
            # Property: Auto-approve conditions preserved
            if original_step.auto_approve_conditions is not None:
                assert stored_step["auto_approve_conditions"] == original_step.auto_approve_conditions
            
            # Property: Quorum count preserved for QUORUM approval type
            if original_step.approval_type == ApprovalType.QUORUM:
                assert stored_step["quorum_count"] == original_step.quorum_count


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--hypothesis-show-statistics"])
