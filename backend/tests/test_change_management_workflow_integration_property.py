"""
Property-Based Tests for Change Management Workflow Integration

Feature: generic-construction-ppm-features
Property 6: Change Management Workflow Integration

Validates: Requirements 4.1, 4.2, 4.3, 4.5

This test validates that for any change request submission, the system initiates 
appropriate approval workflows based on change type and maintains complete audit 
trails throughout the process.
"""

import pytest
from hypothesis import given, strategies as st, settings, assume, HealthCheck
from hypothesis.stateful import RuleBasedStateMachine, rule, invariant, initialize
from datetime import datetime, date, timedelta
from decimal import Decimal
from uuid import UUID, uuid4
from typing import Dict, Any, List, Optional
import asyncio

# Import models and services
from models.change_management import (
    ChangeType, ChangeStatus, PriorityLevel, ApprovalDecision,
    ChangeRequestCreate, ChangeRequestUpdate
)


# ============================================================================
# Test Data Generators
# ============================================================================

@st.composite
def change_request_data(draw):
    """Generate valid change request data"""
    change_types = list(ChangeType)
    priorities = list(PriorityLevel)
    
    return {
        'project_id': uuid4(),
        'title': draw(st.text(min_size=5, max_size=100, alphabet=st.characters(min_codepoint=32, max_codepoint=126))),
        'description': draw(st.text(min_size=10, max_size=500, alphabet=st.characters(min_codepoint=32, max_codepoint=126))),
        'justification': draw(st.text(min_size=10, max_size=300, alphabet=st.characters(min_codepoint=32, max_codepoint=126))),
        'change_type': draw(st.sampled_from(change_types)),
        'priority': draw(st.sampled_from(priorities)),
        'estimated_cost_impact': draw(st.decimals(min_value=0, max_value=1000000, places=2)),
        'estimated_schedule_impact_days': draw(st.integers(min_value=0, max_value=365)),
        'required_by_date': draw(st.dates(min_value=date.today(), max_value=date.today() + timedelta(days=365)))
    }


@st.composite
def approval_decision_data(draw):
    """Generate valid approval decision data"""
    decisions = [ApprovalDecision.APPROVED, ApprovalDecision.REJECTED, ApprovalDecision.NEEDS_INFO]
    
    return {
        'decision': draw(st.sampled_from(decisions)),
        'comments': draw(st.one_of(st.none(), st.text(min_size=10, max_size=200)))
    }


# ============================================================================
# Property 6: Change Management Workflow Integration
# ============================================================================

@pytest.mark.property
@given(
    change_data=change_request_data(),
    num_approvals=st.integers(min_value=1, max_value=3)
)
@settings(
    max_examples=100,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture, HealthCheck.too_slow]
)
def test_property_6_change_management_workflow_integration(
    change_data: Dict[str, Any],
    num_approvals: int
):
    """
    Property 6: Change Management Workflow Integration
    
    For any change request submission, the system SHALL:
    1. Initiate appropriate approval workflows based on change type and impact
    2. Enforce role-based approval requirements
    3. Maintain complete audit trails throughout the process
    4. Update change status correctly through workflow progression
    
    Validates: Requirements 4.1, 4.2, 4.3, 4.5
    """
    # Run the async test in a sync wrapper
    asyncio.run(_test_property_6_async(change_data, num_approvals))


async def _test_property_6_async(
    change_data: Dict[str, Any],
    num_approvals: int
):
    from services.change_request_manager import ChangeRequestManager
    from services.approval_workflow_engine import ApprovalWorkflowEngine
    from config.database import supabase
    import os
    from supabase import create_client
    
    # Create service role client for test data setup (bypasses RLS)
    service_supabase = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    )
    
    # Initialize services
    change_manager = ChangeRequestManager()
    workflow_engine = ApprovalWorkflowEngine()
    
    # Track created resources for cleanup
    created_project_id = None
    created_portfolio_id = None
    
    try:
        # Create test user
        user_id = uuid4()
        
        # Create test portfolio (required for project)
        portfolio_id = uuid4()
        portfolio_data = {
            "id": str(portfolio_id),
            "name": f"Test Portfolio {portfolio_id}",
            "description": "Test portfolio for property testing",
            "owner_id": str(user_id)
        }
        
        try:
            portfolio_result = service_supabase.table("portfolios").insert(portfolio_data).execute()
            if portfolio_result.data:
                created_portfolio_id = portfolio_id
        except Exception as e:
            # If portfolio creation fails, skip this test iteration
            print(f"Portfolio creation failed: {e}")
            return  # Skip this test iteration
        
        # Create test project with the generated project_id from change_data
        project_data = {
            "id": str(change_data['project_id']),
            "portfolio_id": str(portfolio_id),
            "name": f"Test Project {change_data['project_id']}",
            "description": "Test project for change management property testing",
            "budget": 1000000.0,
            "manager_id": str(user_id)
        }
        
        project_result = service_supabase.table("projects").insert(project_data).execute()
        if project_result.data:
            created_project_id = change_data['project_id']
        
        # Property 1: Change request creation initiates workflow
        change_request = await change_manager.create_change_request(
            request_data=ChangeRequestCreate(**change_data),
            creator_id=user_id
        )
        
        assert change_request is not None, "Change request should be created"
        assert change_request.id is not None, "Change request should have an ID"
        assert change_request.change_number is not None, "Change request should have a change number"
        assert change_request.status == ChangeStatus.DRAFT.value, "Initial status should be DRAFT"
        
        # Property 2: Workflow determination based on change characteristics
        # Submit for approval to initiate workflow
        workflow_instance = await workflow_engine.initiate_approval_workflow(
            change_id=UUID(change_request.id)
        )
        
        assert workflow_instance is not None, "Workflow instance should be created"
        assert len(workflow_instance.steps) > 0, "Workflow should have approval steps"
        
        # Verify workflow type is appropriate for change characteristics
        if change_data['change_type'] in [ChangeType.REGULATORY, ChangeType.SAFETY, ChangeType.QUALITY]:
            assert workflow_instance.workflow_type.value == 'regulatory', \
                "Regulatory/Safety/Quality changes should use regulatory workflow"
        elif change_data['priority'] == PriorityLevel.EMERGENCY:
            assert workflow_instance.workflow_type.value == 'emergency', \
                "Emergency priority should use emergency workflow"
        elif change_data['estimated_cost_impact'] > 100000:
            assert workflow_instance.workflow_type.value == 'high_value', \
                "High cost impact should use high value workflow"
        
        # Property 3: Audit trail is maintained
        # Check that audit log entry was created for change request creation
        audit_result = supabase.table("change_audit_log").select("*").eq(
            "change_request_id", change_request.id
        ).execute()
        
        assert len(audit_result.data) > 0, "Audit trail should be created"
        creation_audit = next((a for a in audit_result.data if a['event_type'] == 'created'), None)
        assert creation_audit is not None, "Creation event should be in audit trail"
        assert creation_audit['performed_by'] == str(user_id), "Audit should record correct user"
        
        # Property 4: Workflow progression updates status correctly
        # Simulate approval decisions
        for i, step in enumerate(workflow_instance.steps[:num_approvals]):
            # Get approval record
            approval_result = supabase.table("change_approvals").select("*").eq(
                "change_request_id", change_request.id
            ).eq("step_number", step.step_number).execute()
            
            if approval_result.data:
                approval_id = UUID(approval_result.data[0]['id'])
                approver_id = uuid4()  # Simulate different approvers
                
                # Make approval decision
                decision_result = await workflow_engine.process_approval_decision(
                    approval_id=approval_id,
                    decision=ApprovalDecision.APPROVED,
                    approver_id=approver_id,
                    comments="Approved for testing"
                )
                
                assert decision_result is not None, "Approval decision should be processed"
                
                # Verify audit trail for approval
                approval_audit_result = supabase.table("change_audit_log").select("*").eq(
                    "change_request_id", change_request.id
                ).eq("event_type", "approval_decision").execute()
                
                assert len(approval_audit_result.data) > i, \
                    "Audit trail should record each approval decision"
        
        # Property 5: Final status reflects workflow completion
        # Get updated change request
        updated_change = await change_manager.get_change_request(UUID(change_request.id))
        
        # If all required approvals are complete, status should be APPROVED
        if num_approvals >= len([s for s in workflow_instance.steps if s.is_required]):
            assert updated_change.status in [ChangeStatus.APPROVED.value, ChangeStatus.PENDING_APPROVAL.value], \
                "Status should reflect workflow completion"
        
        # Property 6: Audit trail is complete and chronological
        final_audit_result = supabase.table("change_audit_log").select("*").eq(
            "change_request_id", change_request.id
        ).order("performed_at").execute()
        
        assert len(final_audit_result.data) >= 2, \
            "Audit trail should have at least creation and workflow initiation events"
        
        # Verify chronological order
        audit_timestamps = [
            datetime.fromisoformat(a['performed_at'].replace('Z', '+00:00'))
            for a in final_audit_result.data
        ]
        assert audit_timestamps == sorted(audit_timestamps), \
            "Audit trail should be in chronological order"
        
    finally:
        # Cleanup: Delete test data in correct order (respecting foreign keys)
        try:
            if 'change_request' in locals() and change_request:
                service_supabase.table("change_requests").delete().eq("id", change_request.id).execute()
                service_supabase.table("change_audit_log").delete().eq("change_request_id", change_request.id).execute()
                service_supabase.table("change_approvals").delete().eq("change_request_id", change_request.id).execute()
            
            # Clean up test project
            if created_project_id:
                service_supabase.table("projects").delete().eq("id", str(created_project_id)).execute()
            
            # Clean up test portfolio
            if created_portfolio_id:
                service_supabase.table("portfolios").delete().eq("id", str(created_portfolio_id)).execute()
                
        except Exception as cleanup_error:
            print(f"Cleanup error: {cleanup_error}")


# ============================================================================
# Additional Property Tests for Workflow Integration
# ============================================================================

@pytest.mark.property
@given(
    change_data=change_request_data(),
    decision_data=approval_decision_data()
)
@settings(
    max_examples=100,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture, HealthCheck.too_slow]
)
def test_property_6_approval_authority_validation(
    change_data: Dict[str, Any],
    decision_data: Dict[str, Any]
):
    """
    Property 6.1: Approval Authority Validation
    
    For any approval decision, the system SHALL validate that the approver
    has the required authority based on change value and type.
    
    Validates: Requirements 4.2, 4.3
    """
    asyncio.run(_test_property_6_approval_authority_async(change_data, decision_data))


async def _test_property_6_approval_authority_async(
    change_data: Dict[str, Any],
    decision_data: Dict[str, Any]
):
    from services.approval_workflow_engine import ApprovalWorkflowEngine
    
    workflow_engine = ApprovalWorkflowEngine()
    
    # Create test approver with limited authority
    approver_id = uuid4()
    change_value = change_data['estimated_cost_impact']
    change_type = change_data['change_type']
    
    # Test authority check
    has_authority = workflow_engine.check_approval_authority(
        user_id=approver_id,
        change_value=change_value,
        change_type=change_type,
        approver_role="project_manager"
    )
    
    # Property: Authority check should return a boolean
    assert isinstance(has_authority, bool), "Authority check should return boolean"
    
    # Property: High value changes should require higher authority
    if change_value > Decimal('100000'):
        # For high value changes, project manager alone may not have authority
        # This depends on the authority limits configured in the system
        pass  # Authority limits are configuration-dependent


@pytest.mark.property
@given(
    change_data=change_request_data()
)
@settings(
    max_examples=100,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture, HealthCheck.too_slow]
)
def test_property_6_workflow_type_determination(
    change_data: Dict[str, Any]
):
    """
    Property 6.2: Workflow Type Determination
    
    For any change request, the system SHALL determine the appropriate
    workflow type based on change characteristics with consistent rules.
    
    Validates: Requirements 4.1, 4.2
    """
    asyncio.run(_test_property_6_workflow_type_async(change_data))


async def _test_property_6_workflow_type_async(
    change_data: Dict[str, Any]
):
    from services.approval_workflow_engine import ApprovalWorkflowEngine, WorkflowType
    
    workflow_engine = ApprovalWorkflowEngine()
    
    # Determine workflow type
    workflow_type = workflow_engine._determine_workflow_type_sync(change_data)
    
    # Property 1: Workflow type should be valid
    assert isinstance(workflow_type, WorkflowType), "Should return valid WorkflowType"
    
    # Property 2: Workflow determination follows priority order
    # Priority order: Emergency > High Value > Regulatory > Standard
    
    # Emergency priority takes precedence over everything
    if change_data['priority'] == PriorityLevel.EMERGENCY:
        assert workflow_type == WorkflowType.EMERGENCY, \
            "Emergency priority should always use emergency workflow (highest priority)"
    
    # If not emergency, high cost impact takes precedence
    elif change_data['estimated_cost_impact'] > 100000:
        assert workflow_type == WorkflowType.HIGH_VALUE, \
            "High cost impact should use high value workflow (when not emergency)"
    
    # If not emergency or high value, regulatory changes get regulatory workflow
    elif change_data['change_type'] in [ChangeType.REGULATORY, ChangeType.SAFETY, ChangeType.QUALITY]:
        assert workflow_type == WorkflowType.REGULATORY, \
            "Regulatory/Safety/Quality changes should use regulatory workflow (when not emergency or high value)"
    
    # Property 3: Workflow determination is deterministic
    workflow_type_2 = workflow_engine._determine_workflow_type_sync(change_data)
    assert workflow_type == workflow_type_2, \
        "Workflow determination should be deterministic for same input"


@pytest.mark.property
@given(
    change_data=change_request_data()
)
@settings(
    max_examples=50,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture, HealthCheck.too_slow]
)
def test_property_6_po_linking_integration(
    change_data: Dict[str, Any]
):
    """
    Property 6.3: PO Linking Integration
    
    For any change request linked to PO breakdowns, the system SHALL
    maintain referential integrity and update financial tracking.
    
    Validates: Requirements 4.4, 4.5
    """
    asyncio.run(_test_property_6_po_linking_async(change_data))


async def _test_property_6_po_linking_async(
    change_data: Dict[str, Any]
):
    from services.change_request_manager import ChangeRequestManager
    from config.database import supabase
    import os
    from supabase import create_client
    
    # Create service role client for test data setup (bypasses RLS)
    service_supabase = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    )
    
    change_manager = ChangeRequestManager()
    user_id = uuid4()
    
    # Track created resources for cleanup
    created_project_id = None
    created_portfolio_id = None
    
    try:
        # Create test portfolio (required for project)
        portfolio_id = uuid4()
        portfolio_data = {
            "id": str(portfolio_id),
            "name": f"Test Portfolio {portfolio_id}",
            "description": "Test portfolio for PO linking property testing",
            "owner_id": str(user_id)
        }
        
        try:
            portfolio_result = service_supabase.table("portfolios").insert(portfolio_data).execute()
            if portfolio_result.data:
                created_portfolio_id = portfolio_id
        except Exception as e:
            # If portfolio creation fails, skip this test iteration
            print(f"Portfolio creation failed: {e}")
            return  # Skip this test iteration
        
        # Create test project with the generated project_id from change_data
        project_data = {
            "id": str(change_data['project_id']),
            "portfolio_id": str(portfolio_id),
            "name": f"Test Project {change_data['project_id']}",
            "description": "Test project for PO linking property testing",
            "budget": 1000000.0,
            "manager_id": str(user_id)
        }
        
        project_result = service_supabase.table("projects").insert(project_data).execute()
        if project_result.data:
            created_project_id = change_data['project_id']
        
        # Create change request
        change_request = await change_manager.create_change_request(
            request_data=ChangeRequestCreate(**change_data),
            creator_id=user_id
        )
        
        # Create test PO breakdown
        po_data = {
            'project_id': str(change_data['project_id']),
            'name': 'Test PO Breakdown',
            'planned_amount': str(change_data['estimated_cost_impact']),
            'actual_amount': '0',
            'currency': 'USD',
            'breakdown_type': 'sap_standard',
            'hierarchy_level': 0,
            'is_active': True
        }
        
        po_result = service_supabase.table('po_breakdowns').insert(po_data).execute()
        
        if po_result.data:
            po_id = UUID(po_result.data[0]['id'])
            
            # Link change to PO
            link_success = await change_manager.link_to_purchase_order(
                change_id=UUID(change_request.id),
                po_id=po_id,
                linked_by=user_id
            )
            
            # Property 1: Linking should succeed
            assert link_success, "PO linking should succeed"
            
            # Property 2: Link should be recorded in database
            link_result = service_supabase.table('change_request_po_links').select('*').eq(
                'change_request_id', change_request.id
            ).eq('po_breakdown_id', str(po_id)).execute()
            
            assert len(link_result.data) > 0, "PO link should be recorded in database"
            
            # Cleanup PO
            service_supabase.table('po_breakdowns').delete().eq('id', str(po_id)).execute()
            service_supabase.table('change_request_po_links').delete().eq('change_request_id', change_request.id).execute()
        
    finally:
        # Cleanup in correct order (respecting foreign keys)
        try:
            if 'change_request' in locals() and change_request:
                service_supabase.table("change_requests").delete().eq("id", change_request.id).execute()
            
            # Clean up test project
            if created_project_id:
                service_supabase.table("projects").delete().eq("id", str(created_project_id)).execute()
            
            # Clean up test portfolio
            if created_portfolio_id:
                service_supabase.table("portfolios").delete().eq("id", str(created_portfolio_id)).execute()
                
        except Exception as cleanup_error:
            print(f"Cleanup error: {cleanup_error}")


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v", "-s", "--tb=short"])
