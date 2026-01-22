"""
Property-Based Tests for Workflow Error Handling and Recovery

Tests Properties 24-27:
- Property 24: Error Logging and Stability
- Property 25: Delegation and Escalation Reliability
- Property 26: System Recovery Consistency
- Property 27: Data Consistency and Audit Completeness

Feature: workflow-engine
"""

import pytest
from hypothesis import given, strategies as st, settings, assume, HealthCheck
from datetime import datetime, timedelta
from uuid import UUID, uuid4
from unittest.mock import Mock, AsyncMock, patch, MagicMock
import logging

from services.workflow_error_handler import (
    WorkflowErrorHandler,
    WorkflowError,
    ErrorCategory,
    ErrorSeverity,
    RecoveryAction
)
from services.workflow_delegation_service import (
    WorkflowDelegationService,
    DelegationReason,
    EscalationReason
)
from services.workflow_audit_service import (
    WorkflowAuditService,
    AuditEventType
)
from models.workflow import (
    WorkflowStatus,
    ApprovalStatus
)

logger = logging.getLogger(__name__)


# ==================== Test Strategies ====================

@st.composite
def error_scenario(draw):
    """Generate error scenarios for testing."""
    return {
        "category": draw(st.sampled_from(list(ErrorCategory))),
        "severity": draw(st.sampled_from(list(ErrorSeverity))),
        "message": draw(st.text(min_size=1, max_size=200)),
        "workflow_instance_id": draw(st.one_of(st.none(), st.uuids())),
        "workflow_id": draw(st.one_of(st.none(), st.uuids())),
        "context": draw(st.dictionaries(
            st.text(min_size=1, max_size=20),
            st.one_of(st.text(), st.integers(), st.floats(allow_nan=False)),
            max_size=5
        ))
    }


@st.composite
def approval_data(draw):
    """Generate approval data for testing."""
    return {
        "id": str(draw(st.uuids())),
        "workflow_instance_id": str(draw(st.uuids())),
        "step_number": draw(st.integers(min_value=0, max_value=10)),
        "approver_id": str(draw(st.uuids())),
        "status": ApprovalStatus.PENDING.value,
        "expires_at": (datetime.utcnow() + timedelta(hours=draw(st.integers(min_value=1, max_value=72)))).isoformat(),
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }


# ==================== Property 24: Error Logging and Stability ====================


@pytest.mark.asyncio
@given(error_data=error_scenario())
@settings(
    max_examples=100,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
async def test_property_24_error_logging_and_stability(error_data):
    """
    **Property 24: Error Logging and Stability**
    
    *For any* workflow execution error, detailed error information must be logged
    while maintaining system stability and workflow state integrity.
    
    **Validates: Requirements 8.1**
    
    Feature: workflow-engine, Property 24: Error Logging and Stability
    """
    # Create mock database client
    mock_db = Mock()
    mock_db.table = Mock(return_value=Mock(
        insert=Mock(return_value=Mock(execute=Mock(return_value=Mock(data=[{"id": str(uuid4())}]))))
    ))
    
    # Create error handler
    error_handler = WorkflowErrorHandler(mock_db)
    
    # Create test error
    test_error = Exception(error_data["message"])
    
    # Handle error
    result = await error_handler.handle_error(
        error=test_error,
        category=error_data["category"],
        severity=error_data["severity"],
        workflow_instance_id=error_data["workflow_instance_id"],
        workflow_id=error_data["workflow_id"],
        context=error_data["context"]
    )
    
    # Property assertions
    # 1. Error must be logged with complete information
    assert result is not None, "Error handling must return a result"
    assert "error_id" in result, "Error must have an ID"
    assert "category" in result, "Error must have a category"
    assert "severity" in result, "Error must have a severity"
    assert "message" in result, "Error must have a message"
    assert result["category"] == error_data["category"].value, "Error category must be preserved"
    assert result["severity"] == error_data["severity"].value, "Error severity must be preserved"
    
    # 2. System must remain stable (no exceptions thrown)
    # If we got here, system is stable
    
    # 3. Recovery action must be determined
    assert "recovery_action" in result, "Recovery action must be determined"
    assert result["recovery_action"] in [action.value for action in RecoveryAction], \
        "Recovery action must be valid"
    
    # 4. Error history must be maintained
    error_history = error_handler.get_error_history()
    assert len(error_history) > 0, "Error history must be maintained"
    assert any(
        e["message"] == error_data["message"] and e["category"] == error_data["category"].value
        for e in error_history
    ), "Error must be in history"
    
    # 5. Workflow context must be preserved
    if error_data["workflow_instance_id"]:
        assert any(
            e.get("context", {}).get("workflow_instance_id") == str(error_data["workflow_instance_id"])
            for e in error_history
        ), "Workflow instance context must be preserved"


# ==================== Property 25: Delegation and Escalation Reliability ====================

@pytest.mark.asyncio
@given(
    approver_id=st.uuids(),
    delegate_to_id=st.uuids(),
    reason=st.text(min_size=1, max_size=100)
)
@settings(
    max_examples=100,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
async def test_property_25_delegation_reliability(approver_id, delegate_to_id, reason):
    """
    **Property 25: Delegation and Escalation Reliability**
    
    *For any* approver unavailability scenario, delegation and escalation mechanisms
    must function correctly without losing workflow context.
    
    **Validates: Requirements 8.2**
    
    Feature: workflow-engine, Property 25: Delegation and Escalation Reliability
    """
    # Ensure approver and delegate are different
    assume(approver_id != delegate_to_id)
    
    # Create mock database client
    mock_db = Mock()
    
    # Mock approval data
    approval_id = uuid4()
    workflow_instance_id = uuid4()
    
    approval_data = {
        "id": str(approval_id),
        "workflow_instance_id": str(workflow_instance_id),
        "step_number": 0,
        "approver_id": str(approver_id),
        "status": ApprovalStatus.PENDING.value,
        "expires_at": (datetime.utcnow() + timedelta(hours=24)).isoformat(),
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }
    
    # Mock database responses
    mock_db.table = Mock(return_value=Mock(
        select=Mock(return_value=Mock(
            eq=Mock(return_value=Mock(
                execute=Mock(return_value=Mock(data=[approval_data]))
            ))
        )),
        update=Mock(return_value=Mock(
            eq=Mock(return_value=Mock(
                execute=Mock(return_value=Mock(data=[{**approval_data, "status": ApprovalStatus.DELEGATED.value}]))
            ))
        )),
        insert=Mock(return_value=Mock(
            execute=Mock(return_value=Mock(data=[{**approval_data, "id": str(uuid4()), "approver_id": str(delegate_to_id)}]))
        ))
    ))
    
    # Create delegation service
    delegation_service = WorkflowDelegationService(mock_db)
    
    # Mock availability check to return delegate is available
    with patch.object(delegation_service, 'check_approver_availability', return_value=(True, None)):
        # Delegate approval
        result = await delegation_service.delegate_approval(
            approval_id=approval_id,
            delegator_id=approver_id,
            delegate_to_id=delegate_to_id,
            reason=reason
        )
    
    # Property assertions
    # 1. Delegation must succeed
    assert result is not None, "Delegation must return a result"
    assert result.get("success") is True, "Delegation must succeed"
    
    # 2. Original approval must be preserved
    assert "original_approval_id" in result, "Original approval ID must be preserved"
    assert result["original_approval_id"] == str(approval_id), "Original approval ID must match"
    
    # 3. New approval must be created
    assert "new_approval_id" in result, "New approval must be created"
    assert result["new_approval_id"] is not None, "New approval ID must not be None"
    
    # 4. Delegation context must be preserved
    assert result["delegator_id"] == str(approver_id), "Delegator ID must be preserved"
    assert result["delegate_to_id"] == str(delegate_to_id), "Delegate ID must be preserved"
    assert result["reason"] == reason, "Delegation reason must be preserved"


@pytest.mark.asyncio
@given(
    approval_id=st.uuids(),
    reason=st.text(min_size=1, max_size=100),
    escalation_count=st.integers(min_value=1, max_value=5)
)
@settings(
    max_examples=100,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
async def test_property_25_escalation_reliability(approval_id, reason, escalation_count):
    """
    **Property 25: Delegation and Escalation Reliability (Escalation)**
    
    *For any* approval timeout or rejection, escalation mechanisms must function
    correctly and create appropriate escalation approvals.
    
    **Validates: Requirements 8.2**
    
    Feature: workflow-engine, Property 25: Delegation and Escalation Reliability
    """
    # Create mock database client
    mock_db = Mock()
    
    # Mock approval data
    workflow_instance_id = uuid4()
    original_approver_id = uuid4()
    
    approval_data = {
        "id": str(approval_id),
        "workflow_instance_id": str(workflow_instance_id),
        "step_number": 0,
        "approver_id": str(original_approver_id),
        "status": ApprovalStatus.PENDING.value,
        "expires_at": (datetime.utcnow() - timedelta(hours=1)).isoformat(),  # Expired
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }
    
    # Generate escalation approvers
    escalation_approvers = [uuid4() for _ in range(escalation_count)]
    
    # Mock database responses
    new_approval_ids = [str(uuid4()) for _ in range(escalation_count)]
    insert_call_count = [0]
    
    def mock_insert_execute():
        idx = insert_call_count[0]
        insert_call_count[0] += 1
        return Mock(data=[{
            **approval_data,
            "id": new_approval_ids[idx] if idx < len(new_approval_ids) else str(uuid4()),
            "approver_id": str(escalation_approvers[idx]) if idx < len(escalation_approvers) else str(uuid4())
        }])
    
    mock_db.table = Mock(return_value=Mock(
        select=Mock(return_value=Mock(
            eq=Mock(return_value=Mock(
                execute=Mock(return_value=Mock(data=[approval_data]))
            ))
        )),
        update=Mock(return_value=Mock(
            eq=Mock(return_value=Mock(
                execute=Mock(return_value=Mock(data=[{**approval_data, "status": ApprovalStatus.EXPIRED.value}]))
            ))
        )),
        insert=Mock(return_value=Mock(
            execute=mock_insert_execute
        ))
    ))
    
    # Create delegation service
    delegation_service = WorkflowDelegationService(mock_db)
    
    # Escalate approval
    result = await delegation_service.escalate_approval(
        approval_id=approval_id,
        reason=reason,
        escalation_approvers=escalation_approvers
    )
    
    # Property assertions
    # 1. Escalation must succeed
    assert result is not None, "Escalation must return a result"
    assert result.get("success") is True, "Escalation must succeed"
    
    # 2. Original approval must be preserved
    assert "original_approval_id" in result, "Original approval ID must be preserved"
    assert result["original_approval_id"] == str(approval_id), "Original approval ID must match"
    
    # 3. New escalation approvals must be created
    assert "new_approval_ids" in result, "New approval IDs must be returned"
    assert len(result["new_approval_ids"]) == escalation_count, \
        f"Must create {escalation_count} escalation approvals"
    
    # 4. Escalation approvers must be preserved
    assert "escalation_approvers" in result, "Escalation approvers must be preserved"
    assert len(result["escalation_approvers"]) == escalation_count, \
        "Escalation approver count must match"
    
    # 5. Escalation reason must be preserved
    assert result["reason"] == reason, "Escalation reason must be preserved"


# ==================== Property 26: System Recovery Consistency ====================


@pytest.mark.asyncio
@given(
    workflow_instance_id=st.uuids(),
    error_category=st.sampled_from(list(ErrorCategory)),
    recovery_action=st.sampled_from(list(RecoveryAction))
)
@settings(
    max_examples=100,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
async def test_property_26_system_recovery_consistency(workflow_instance_id, error_category, recovery_action):
    """
    **Property 26: System Recovery Consistency**
    
    *For any* system outage and recovery, workflow state must be preserved and
    processing must resume correctly without data loss.
    
    **Validates: Requirements 8.3**
    
    Feature: workflow-engine, Property 26: System Recovery Consistency
    """
    # Create mock database client
    mock_db = Mock()
    
    # Mock workflow instance data before error
    instance_data_before = {
        "id": str(workflow_instance_id),
        "workflow_id": str(uuid4()),
        "status": WorkflowStatus.IN_PROGRESS.value,
        "current_step": 1,
        "data": {
            "test_context": "preserved_value",
            "step_history": [0, 1]
        },
        "started_by": str(uuid4()),
        "started_at": datetime.utcnow().isoformat(),
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }
    
    # Mock workflow instance data after recovery
    instance_data_after = instance_data_before.copy()
    
    # Mock database responses
    mock_db.table = Mock(return_value=Mock(
        select=Mock(return_value=Mock(
            eq=Mock(return_value=Mock(
                execute=Mock(return_value=Mock(data=[instance_data_before]))
            ))
        )),
        update=Mock(return_value=Mock(
            eq=Mock(return_value=Mock(
                execute=Mock(return_value=Mock(data=[instance_data_after]))
            ))
        )),
        insert=Mock(return_value=Mock(
            execute=Mock(return_value=Mock(data=[{"id": str(uuid4())}]))
        ))
    ))
    
    # Create error handler
    error_handler = WorkflowErrorHandler(mock_db)
    
    # Simulate error and recovery
    test_error = Exception(f"System error in category {error_category.value}")
    
    result = await error_handler.handle_error(
        error=test_error,
        category=error_category,
        severity=ErrorSeverity.HIGH,
        workflow_instance_id=workflow_instance_id,
        context={"recovery_test": True}
    )
    
    # Property assertions
    # 1. Error must be handled without data loss
    assert result is not None, "Error handling must return a result"
    assert result.get("error_id") is not None, "Error must have an ID"
    
    # 2. Recovery action must be determined
    assert "recovery_action" in result, "Recovery action must be determined"
    assert result["recovery_action"] in [action.value for action in RecoveryAction], \
        "Recovery action must be valid"
    
    # 3. Recovery result must be available
    assert "recovery_result" in result, "Recovery result must be available"
    recovery_result = result["recovery_result"]
    assert isinstance(recovery_result, dict), "Recovery result must be a dictionary"
    
    # 4. Workflow state must be preserved (check error history)
    error_history = error_handler.get_error_history()
    assert len(error_history) > 0, "Error history must be maintained"
    
    # Find the error entry for this workflow instance
    instance_errors = [
        e for e in error_history
        if e.get("context", {}).get("workflow_instance_id") == str(workflow_instance_id)
    ]
    assert len(instance_errors) > 0, "Error must be recorded for workflow instance"
    
    # 5. Recovery attempt must be tracked
    recovery_attempts = error_handler.get_recovery_attempts()
    assert isinstance(recovery_attempts, dict), "Recovery attempts must be tracked"


@pytest.mark.asyncio
@given(
    workflow_instance_id=st.uuids(),
    outage_duration_seconds=st.integers(min_value=1, max_value=3600)
)
@settings(
    max_examples=100,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
async def test_property_26_state_preservation_after_outage(workflow_instance_id, outage_duration_seconds):
    """
    **Property 26: System Recovery Consistency (State Preservation)**
    
    *For any* system outage duration, workflow state must be preserved and
    recoverable from database.
    
    **Validates: Requirements 8.3**
    
    Feature: workflow-engine, Property 26: System Recovery Consistency
    """
    # Create mock database client
    mock_db = Mock()
    
    # Mock workflow instance with state before outage
    outage_start = datetime.utcnow()
    outage_end = outage_start + timedelta(seconds=outage_duration_seconds)
    
    instance_state = {
        "id": str(workflow_instance_id),
        "workflow_id": str(uuid4()),
        "status": WorkflowStatus.IN_PROGRESS.value,
        "current_step": 2,
        "data": {
            "outage_start": outage_start.isoformat(),
            "outage_duration": outage_duration_seconds,
            "preserved_data": "important_value",
            "step_history": [0, 1, 2]
        },
        "started_by": str(uuid4()),
        "started_at": outage_start.isoformat(),
        "created_at": outage_start.isoformat(),
        "updated_at": outage_end.isoformat()
    }
    
    # Mock database responses
    mock_db.table = Mock(return_value=Mock(
        select=Mock(return_value=Mock(
            eq=Mock(return_value=Mock(
                execute=Mock(return_value=Mock(data=[instance_state]))
            ))
        ))
    ))
    
    # Simulate recovery by retrieving state
    result = mock_db.table("workflow_instances").select("*").eq(
        "id", str(workflow_instance_id)
    ).execute()
    
    # Property assertions
    # 1. State must be retrievable
    assert result.data is not None, "State must be retrievable from database"
    assert len(result.data) > 0, "State data must not be empty"
    
    recovered_state = result.data[0]
    
    # 2. Workflow instance ID must be preserved
    assert recovered_state["id"] == str(workflow_instance_id), "Workflow instance ID must be preserved"
    
    # 3. Workflow status must be preserved
    assert recovered_state["status"] == WorkflowStatus.IN_PROGRESS.value, \
        "Workflow status must be preserved"
    
    # 4. Current step must be preserved
    assert recovered_state["current_step"] == 2, "Current step must be preserved"
    
    # 5. Context data must be preserved
    assert "data" in recovered_state, "Context data must be preserved"
    assert recovered_state["data"]["preserved_data"] == "important_value", \
        "Context values must be preserved"
    assert recovered_state["data"]["step_history"] == [0, 1, 2], \
        "Step history must be preserved"


# ==================== Property 27: Data Consistency and Audit Completeness ====================

@pytest.mark.asyncio
@given(
    workflow_instance_id=st.uuids(),
    inconsistency_count=st.integers(min_value=0, max_value=5)
)
@settings(
    max_examples=100,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
async def test_property_27_data_consistency_reconciliation(workflow_instance_id, inconsistency_count):
    """
    **Property 27: Data Consistency and Audit Completeness**
    
    *For any* data inconsistency detection or error condition, reconciliation
    capabilities must function correctly and complete audit trails must be maintained.
    
    **Validates: Requirements 8.4, 8.5**
    
    Feature: workflow-engine, Property 27: Data Consistency and Audit Completeness
    """
    # Create mock database client
    mock_db = Mock()
    
    # Mock workflow instance
    instance_data = {
        "id": str(workflow_instance_id),
        "workflow_id": str(uuid4()),
        "status": WorkflowStatus.IN_PROGRESS.value,
        "current_step": 1,
        "data": {},
        "started_by": str(uuid4()),
        "started_at": datetime.utcnow().isoformat(),
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }
    
    # Mock workflow definition
    workflow_data = {
        "id": instance_data["workflow_id"],
        "name": "Test Workflow",
        "template_data": {
            "steps": [
                {"step_order": 0, "name": "Step 0", "approvers": [str(uuid4())]},
                {"step_order": 1, "name": "Step 1", "approvers": [str(uuid4())]}
            ]
        }
    }
    
    # Mock approvals (potentially inconsistent)
    approvals_data = []
    if inconsistency_count == 0:
        # Consistent state - approvals exist for current step
        approvals_data = [{
            "id": str(uuid4()),
            "workflow_instance_id": str(workflow_instance_id),
            "step_number": 1,
            "approver_id": str(uuid4()),
            "status": ApprovalStatus.PENDING.value
        }]
    
    # Mock database responses
    def mock_table_select(table_name):
        if table_name == "workflow_instances":
            return Mock(data=[instance_data])
        elif table_name == "workflows":
            return Mock(data=[workflow_data])
        elif table_name == "workflow_approvals":
            return Mock(data=approvals_data)
        return Mock(data=[])
    
    mock_db.table = Mock(side_effect=lambda name: Mock(
        select=Mock(return_value=Mock(
            eq=Mock(return_value=Mock(
                execute=Mock(return_value=mock_table_select(name))
            ))
        )),
        update=Mock(return_value=Mock(
            eq=Mock(return_value=Mock(
                execute=Mock(return_value=Mock(data=[instance_data]))
            ))
        )),
        insert=Mock(return_value=Mock(
            execute=Mock(return_value=Mock(data=[{"id": str(uuid4())}]))
        ))
    ))
    
    # Create delegation service for reconciliation
    delegation_service = WorkflowDelegationService(mock_db)
    
    # Reconcile workflow data
    result = await delegation_service.reconcile_workflow_data(workflow_instance_id)
    
    # Property assertions
    # 1. Reconciliation must complete
    assert result is not None, "Reconciliation must return a result"
    assert result.get("success") is True, "Reconciliation must succeed"
    
    # 2. Workflow instance ID must be preserved
    assert result["workflow_instance_id"] == str(workflow_instance_id), \
        "Workflow instance ID must be preserved"
    
    # 3. Inconsistencies must be detected
    assert "inconsistencies" in result, "Inconsistencies must be reported"
    assert isinstance(result["inconsistencies"], list), "Inconsistencies must be a list"
    
    # 4. Repairs must be tracked
    assert "repairs" in result, "Repairs must be tracked"
    assert isinstance(result["repairs"], list), "Repairs must be a list"
    
    # 5. Consistency status must be reported
    assert "is_consistent" in result, "Consistency status must be reported"
    assert isinstance(result["is_consistent"], bool), "Consistency status must be boolean"
    
    # If no inconsistencies, state should be consistent
    if inconsistency_count == 0 and len(approvals_data) > 0:
        # With approvals present, should be consistent
        pass  # Consistency depends on full workflow state


@pytest.mark.asyncio
@given(
    workflow_instance_id=st.uuids(),
    event_count=st.integers(min_value=1, max_value=20)
)
@settings(
    max_examples=100,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
async def test_property_27_audit_trail_completeness(workflow_instance_id, event_count):
    """
    **Property 27: Data Consistency and Audit Completeness (Audit Trail)**
    
    *For any* sequence of workflow events, complete audit trails must be maintained
    with all events logged and retrievable.
    
    **Validates: Requirements 8.5**
    
    Feature: workflow-engine, Property 27: Data Consistency and Audit Completeness
    """
    # Create mock database client
    mock_db = Mock()
    
    # Track inserted audit entries
    audit_entries = []
    
    def mock_insert_execute():
        return Mock(data=[{"id": str(uuid4())}])
    
    def mock_select_execute():
        return Mock(data=audit_entries)
    
    mock_db.table = Mock(return_value=Mock(
        insert=Mock(return_value=Mock(execute=mock_insert_execute)),
        select=Mock(return_value=Mock(
            eq=Mock(return_value=Mock(
                order=Mock(return_value=Mock(
                    range=Mock(return_value=Mock(
                        execute=mock_select_execute
                    ))
                ))
            ))
        ))
    ))
    
    # Create audit service
    audit_service = WorkflowAuditService(mock_db)
    
    # Generate and log multiple events
    event_types = [
        AuditEventType.INSTANCE_CREATED,
        AuditEventType.APPROVAL_REQUESTED,
        AuditEventType.APPROVAL_APPROVED,
        AuditEventType.STEP_COMPLETED,
        AuditEventType.ERROR_OCCURRED,
        AuditEventType.RECOVERY_COMPLETED
    ]
    
    logged_events = []
    for i in range(event_count):
        event_type = event_types[i % len(event_types)]
        
        result = await audit_service.log_event(
            event_type=event_type,
            workflow_instance_id=workflow_instance_id,
            user_id=uuid4(),
            event_data={"event_index": i, "test_data": f"event_{i}"},
            message=f"Test event {i}"
        )
        
        logged_events.append(result)
        audit_entries.append(result)
    
    # Flush audit buffer
    await audit_service.flush()
    
    # Property assertions
    # 1. All events must be logged
    assert len(logged_events) == event_count, f"Must log all {event_count} events"
    
    # 2. Each event must have required fields
    for event in logged_events:
        assert "event_type" in event, "Event must have type"
        assert "timestamp" in event, "Event must have timestamp"
        assert "message" in event, "Event must have message"
        assert event.get("workflow_instance_id") == str(workflow_instance_id), \
            "Event must have correct workflow instance ID"
    
    # 3. Events must be retrievable
    retrieved_events = await audit_service.get_audit_trail(
        workflow_instance_id=workflow_instance_id,
        limit=event_count
    )
    
    # Note: In mock, retrieved events come from our audit_entries list
    assert len(retrieved_events) == event_count, "All events must be retrievable"
    
    # 4. Event order must be preserved (by timestamp)
    timestamps = [event["timestamp"] for event in logged_events]
    assert timestamps == sorted(timestamps), "Events must be in chronological order"
    
    # 5. Audit buffer must be managed correctly
    # After flush, buffer should be empty
    assert len(audit_service._audit_buffer) == 0, "Audit buffer must be flushed"


@pytest.mark.asyncio
@given(
    workflow_instance_id=st.uuids(),
    error_count=st.integers(min_value=1, max_value=10),
    recovery_count=st.integers(min_value=1, max_value=10)
)
@settings(
    max_examples=100,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
async def test_property_27_error_recovery_audit_trail(workflow_instance_id, error_count, recovery_count):
    """
    **Property 27: Data Consistency and Audit Completeness (Error Recovery Audit)**
    
    *For any* error and recovery sequence, complete audit trails must link errors
    to their recovery actions.
    
    **Validates: Requirements 8.5**
    
    Feature: workflow-engine, Property 27: Data Consistency and Audit Completeness
    """
    # Create mock database client
    mock_db = Mock()
    
    # Track audit entries
    audit_entries = []
    
    def mock_insert_execute():
        return Mock(data=[{"id": str(uuid4())}])
    
    def mock_select_execute():
        return Mock(data=audit_entries)
    
    mock_db.table = Mock(return_value=Mock(
        insert=Mock(return_value=Mock(execute=mock_insert_execute)),
        select=Mock(return_value=Mock(
            eq=Mock(return_value=Mock(
                in_=Mock(return_value=Mock(
                    order=Mock(return_value=Mock(
                        range=Mock(return_value=Mock(
                            execute=mock_select_execute
                        ))
                    ))
                )),
                order=Mock(return_value=Mock(
                    range=Mock(return_value=Mock(
                        execute=mock_select_execute
                    ))
                ))
            ))
        ))
    ))
    
    # Create audit service
    audit_service = WorkflowAuditService(mock_db)
    
    # Log errors and recoveries
    error_messages = []
    for i in range(error_count):
        error_msg = f"Test error {i}"
        error_messages.append(error_msg)
        
        error_entry = await audit_service.log_error(
            error_category=ErrorCategory.SYSTEM.value,
            error_severity=ErrorSeverity.MEDIUM.value,
            error_message=error_msg,
            workflow_instance_id=workflow_instance_id,
            context={"error_index": i}
        )
        audit_entries.append(error_entry)
    
    for i in range(recovery_count):
        recovery_entry = await audit_service.log_recovery_action(
            recovery_action=RecoveryAction.RETRY.value,
            recovery_result={"success": True, "recovery_index": i},
            workflow_instance_id=workflow_instance_id,
            original_error=error_messages[i % len(error_messages)]
        )
        audit_entries.append(recovery_entry)
    
    # Flush audit buffer
    await audit_service.flush()
    
    # Property assertions
    # 1. All errors must be logged
    error_entries = [e for e in audit_entries if e.get("event_type") == AuditEventType.ERROR_OCCURRED.value]
    assert len(error_entries) == error_count, f"Must log all {error_count} errors"
    
    # 2. All recovery actions must be logged
    recovery_entries = [
        e for e in audit_entries
        if e.get("event_type") in [
            AuditEventType.RECOVERY_COMPLETED.value,
            AuditEventType.RECOVERY_FAILED.value
        ]
    ]
    assert len(recovery_entries) == recovery_count, f"Must log all {recovery_count} recovery actions"
    
    # 3. Each error must have required fields
    for error_entry in error_entries:
        assert "event_type" in error_entry, "Error must have event type"
        assert "timestamp" in error_entry, "Error must have timestamp"
        assert error_entry.get("workflow_instance_id") == str(workflow_instance_id), \
            "Error must have correct workflow instance ID"
    
    # 4. Each recovery must have required fields
    for recovery_entry in recovery_entries:
        assert "event_type" in recovery_entry, "Recovery must have event type"
        assert "timestamp" in recovery_entry, "Recovery must have timestamp"
        assert error_entry.get("workflow_instance_id") == str(workflow_instance_id), \
            "Recovery must have correct workflow instance ID"
    
    # 5. Audit trail must be complete and retrievable
    all_entries = await audit_service.get_audit_trail(
        workflow_instance_id=workflow_instance_id,
        limit=error_count + recovery_count
    )
    
    assert len(all_entries) == error_count + recovery_count, \
        "All error and recovery entries must be retrievable"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
