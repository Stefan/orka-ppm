"""
Change Management API Router
Handles change request lifecycle, approvals, impact analysis, and implementation tracking
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from typing import List, Optional
from uuid import UUID
from datetime import date, datetime
import random

from auth.dependencies import get_current_user
from auth.rbac import require_permission, Permission
from models.change_management import (
    ChangeRequestCreate, ChangeRequestUpdate, ChangeRequestResponse,
    ChangeRequestFilters, ApprovalDecisionRequest, ApprovalResponse,
    ImpactAnalysisRequest, ImpactAnalysisResponse, ImplementationPlan,
    ImplementationProgress, ImplementationResponse, ChangeAnalytics,
    PendingApproval, AuditLogEntry, ChangeTemplateCreate, ChangeTemplateResponse,
    ChangeStatus, ChangeType, PriorityLevel, ApprovalDecision
)
from config.database import supabase

router = APIRouter(prefix="/changes", tags=["Change Management"])

# Note: Services will be initialized when they are properly implemented
# For now, we'll create mock implementations to test the API structure

# ============================================================================
# CHANGE REQUEST CRUD ENDPOINTS (Subtask 11.1)
# ============================================================================

@router.post("", response_model=ChangeRequestResponse)
async def create_change_request(
    change_data: ChangeRequestCreate,
    current_user = Depends(require_permission(Permission.project_update))
):
    """
    Create a new change request
    
    Requirements: 1.1, 1.2, 1.4
    """
    try:
        # Mock implementation for testing API structure
        change_id = str(UUID("12345678-1234-5678-9012-123456789012"))
        change_number = f"CR-2024-{random.randint(1000, 9999)}"
        
        # Create mock response
        change_request = ChangeRequestResponse(
            id=change_id,
            change_number=change_number,
            title=change_data.title,
            description=change_data.description,
            justification=change_data.justification,
            change_type=change_data.change_type.value,
            priority=change_data.priority.value,
            status=ChangeStatus.DRAFT.value,
            requested_by=current_user['user_id'],
            requested_date=datetime.now(),
            required_by_date=change_data.required_by_date,
            project_id=str(change_data.project_id),
            project_name="Test Project",
            affected_milestones=[],
            affected_pos=[],
            estimated_cost_impact=change_data.estimated_cost_impact,
            estimated_schedule_impact_days=change_data.estimated_schedule_impact_days,
            estimated_effort_hours=change_data.estimated_effort_hours,
            actual_cost_impact=None,
            actual_schedule_impact_days=None,
            actual_effort_hours=None,
            implementation_progress=None,
            implementation_start_date=None,
            implementation_end_date=None,
            implementation_notes=None,
            pending_approvals=[],
            approval_history=[],
            version=1,
            parent_change_id=None,
            template_id=str(change_data.template_id) if change_data.template_id else None,
            created_at=datetime.now(),
            updated_at=datetime.now(),
            closed_at=None,
            closed_by=None
        )
        
        return change_request
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create change request: {str(e)}")

@router.get("", response_model=List[ChangeRequestResponse])
async def list_change_requests(
    project_id: Optional[UUID] = Query(None, description="Filter by project ID"),
    status: Optional[ChangeStatus] = Query(None, description="Filter by status"),
    change_type: Optional[ChangeType] = Query(None, description="Filter by change type"),
    priority: Optional[PriorityLevel] = Query(None, description="Filter by priority"),
    requested_by: Optional[UUID] = Query(None, description="Filter by requestor"),
    assigned_to_me: bool = Query(False, description="Show only changes assigned to current user"),
    date_from: Optional[date] = Query(None, description="Filter from date"),
    date_to: Optional[date] = Query(None, description="Filter to date"),
    search_term: Optional[str] = Query(None, description="Search in title and description"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    List change requests with filtering and pagination
    
    Requirements: 1.1, 1.2, 1.4
    """
    try:
        # Build filters
        filters = ChangeRequestFilters(
            project_id=project_id,
            status=status,
            change_type=change_type,
            priority=priority,
            requested_by=requested_by,
            assigned_to_me=assigned_to_me,
            date_from=date_from,
            date_to=date_to,
            search_term=search_term,
            page=page,
            page_size=page_size
        )
        
        # If assigned_to_me is True, override requested_by with current user
        if assigned_to_me:
            filters.requested_by = UUID(current_user['user_id'])
        
        change_requests = await change_request_manager.list_change_requests(filters)
        return change_requests
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list change requests: {str(e)}")

@router.get("/{change_id}", response_model=ChangeRequestResponse)
async def get_change_request(
    change_id: UUID,
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    Get a specific change request by ID
    
    Requirements: 1.1, 1.2, 1.4
    """
    try:
        change_request = await change_request_manager.get_change_request(change_id)
        if not change_request:
            raise HTTPException(status_code=404, detail="Change request not found")
        
        return change_request
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get change request: {str(e)}")

@router.put("/{change_id}", response_model=ChangeRequestResponse)
async def update_change_request(
    change_id: UUID,
    updates: ChangeRequestUpdate,
    current_user = Depends(require_permission(Permission.project_update))
):
    """
    Update a change request
    
    Requirements: 1.1, 1.2, 1.4
    """
    try:
        # Check if change request exists
        existing_change = await change_request_manager.get_change_request(change_id)
        if not existing_change:
            raise HTTPException(status_code=404, detail="Change request not found")
        
        # Update the change request
        updated_change = await change_request_manager.update_change_request(
            change_id=change_id,
            updates=updates,
            updated_by=UUID(current_user['user_id'])
        )
        
        # Send notification if status changed
        if updates.status and updates.status != existing_change.status:
            await change_notification_system.notify_stakeholders(
                change_id=change_id,
                event_type="status_changed",
                stakeholder_roles=["requestor", "approver", "project_manager"]
            )
        
        return updated_change
        
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update change request: {str(e)}")

@router.delete("/{change_id}")
async def cancel_change_request(
    change_id: UUID,
    current_user = Depends(require_permission(Permission.project_update))
):
    """
    Cancel a change request (soft delete by setting status to cancelled)
    
    Requirements: 1.1, 1.2, 1.4
    """
    try:
        # Check if change request exists
        existing_change = await change_request_manager.get_change_request(change_id)
        if not existing_change:
            raise HTTPException(status_code=404, detail="Change request not found")
        
        # Check if change can be cancelled
        if existing_change.status in [ChangeStatus.IMPLEMENTED, ChangeStatus.CLOSED]:
            raise HTTPException(
                status_code=400, 
                detail="Cannot cancel a change request that is already implemented or closed"
            )
        
        # Update status to cancelled
        updates = ChangeRequestUpdate(status=ChangeStatus.CANCELLED)
        await change_request_manager.update_change_request(
            change_id=change_id,
            updates=updates,
            updated_by=UUID(current_user['user_id'])
        )
        
        # Send cancellation notification
        await change_notification_system.notify_stakeholders(
            change_id=change_id,
            event_type="change_cancelled",
            stakeholder_roles=["requestor", "approver", "project_manager"]
        )
        
        return {"message": "Change request cancelled successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to cancel change request: {str(e)}")

# ============================================================================
# APPROVAL WORKFLOW ENDPOINTS (Subtask 11.2)
# ============================================================================

@router.post("/{change_id}/submit-for-approval")
async def submit_for_approval(
    change_id: UUID,
    current_user = Depends(require_permission(Permission.project_update))
):
    """
    Submit a change request for approval workflow
    
    Requirements: 2.1, 2.3, 2.5
    """
    try:
        # Check if change request exists
        change_request = await change_request_manager.get_change_request(change_id)
        if not change_request:
            raise HTTPException(status_code=404, detail="Change request not found")
        
        # Check if change request is in a valid state for submission
        if change_request.status not in [ChangeStatus.DRAFT, ChangeStatus.UNDER_REVIEW]:
            raise HTTPException(
                status_code=400,
                detail=f"Change request cannot be submitted from status: {change_request.status}"
            )
        
        # Initiate approval workflow
        workflow_instance = await approval_workflow_engine.initiate_approval_workflow(
            change_id=change_id,
            workflow_type="standard"  # Could be determined based on change characteristics
        )
        
        # Update change request status
        updates = ChangeRequestUpdate(status=ChangeStatus.PENDING_APPROVAL)
        await change_request_manager.update_change_request(
            change_id=change_id,
            updates=updates,
            updated_by=UUID(current_user['user_id'])
        )
        
        # Send notifications to approvers
        await change_notification_system.notify_stakeholders(
            change_id=change_id,
            event_type="approval_requested",
            stakeholder_roles=["approver"]
        )
        
        return {
            "message": "Change request submitted for approval",
            "workflow_id": str(workflow_instance.id),
            "approval_steps": len(workflow_instance.steps)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit for approval: {str(e)}")

@router.post("/approvals/{approval_id}/decide")
async def make_approval_decision(
    approval_id: UUID,
    decision: ApprovalDecisionRequest,
    current_user = Depends(get_current_user)
):
    """
    Make an approval decision on a change request
    
    Requirements: 2.1, 2.3, 2.5
    """
    try:
        # Process the approval decision
        approval_result = await approval_workflow_engine.process_approval_decision(
            approval_id=approval_id,
            decision=decision.decision,
            approver_id=UUID(current_user['user_id']),
            comments=decision.comments
        )
        
        # Get the change request to send notifications
        change_id = approval_result.change_request_id
        
        # Send notifications based on decision
        if decision.decision == ApprovalDecision.APPROVED:
            event_type = "approval_granted"
        elif decision.decision == ApprovalDecision.REJECTED:
            event_type = "approval_rejected"
        elif decision.decision == ApprovalDecision.NEEDS_INFO:
            event_type = "approval_needs_info"
        else:
            event_type = "approval_delegated"
        
        await change_notification_system.notify_stakeholders(
            change_id=UUID(change_id),
            event_type=event_type,
            stakeholder_roles=["requestor", "project_manager"]
        )
        
        # If all approvals are complete and approved, update change status
        if approval_result.workflow_complete and approval_result.final_decision == "approved":
            updates = ChangeRequestUpdate(status=ChangeStatus.APPROVED)
            await change_request_manager.update_change_request(
                change_id=UUID(change_id),
                updates=updates,
                updated_by=UUID(current_user['user_id'])
            )
        elif approval_result.workflow_complete and approval_result.final_decision == "rejected":
            updates = ChangeRequestUpdate(status=ChangeStatus.REJECTED)
            await change_request_manager.update_change_request(
                change_id=UUID(change_id),
                updates=updates,
                updated_by=UUID(current_user['user_id'])
            )
        
        return {
            "message": f"Approval decision '{decision.decision}' recorded successfully",
            "workflow_complete": approval_result.workflow_complete,
            "final_decision": approval_result.final_decision if approval_result.workflow_complete else None,
            "next_approver": approval_result.next_approver_id if not approval_result.workflow_complete else None
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process approval decision: {str(e)}")

@router.get("/approvals/pending", response_model=List[PendingApproval])
async def get_pending_approvals(
    current_user = Depends(get_current_user)
):
    """
    Get pending approvals for the current user
    
    Requirements: 2.1, 2.3, 2.5
    """
    try:
        pending_approvals = await approval_workflow_engine.get_pending_approvals(
            user_id=UUID(current_user['user_id'])
        )
        
        return pending_approvals
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get pending approvals: {str(e)}")

@router.get("/{change_id}/approvals", response_model=List[ApprovalResponse])
async def get_change_approvals(
    change_id: UUID,
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    Get all approvals for a specific change request
    
    Requirements: 2.1, 2.3, 2.5
    """
    try:
        # Check if change request exists
        change_request = await change_request_manager.get_change_request(change_id)
        if not change_request:
            raise HTTPException(status_code=404, detail="Change request not found")
        
        approvals = await approval_workflow_engine.get_change_approvals(change_id)
        return approvals
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get change approvals: {str(e)}")

@router.post("/approvals/{approval_id}/escalate")
async def escalate_approval(
    approval_id: UUID,
    escalate_to: UUID,
    reason: str,
    current_user = Depends(require_permission(Permission.project_update))
):
    """
    Escalate an overdue approval to another approver
    
    Requirements: 2.1, 2.3, 2.5
    """
    try:
        escalation_result = await approval_workflow_engine.escalate_approval(
            approval_id=approval_id,
            escalate_to=escalate_to,
            escalated_by=UUID(current_user['user_id']),
            reason=reason
        )
        
        # Send escalation notification
        await change_notification_system.notify_stakeholders(
            change_id=UUID(escalation_result.change_request_id),
            event_type="approval_escalated",
            stakeholder_roles=["approver", "project_manager"]
        )
        
        return {
            "message": "Approval escalated successfully",
            "escalated_to": str(escalate_to),
            "original_approver": str(escalation_result.original_approver_id)
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to escalate approval: {str(e)}")
# ============================================================================
# IMPACT ANALYSIS ENDPOINTS (Subtask 11.3)
# ============================================================================

@router.post("/{change_id}/analyze-impact")
async def analyze_change_impact(
    change_id: UUID,
    analysis_request: ImpactAnalysisRequest,
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    Perform impact analysis on a change request
    
    Requirements: 3.1, 3.2, 3.4
    """
    try:
        # Check if change request exists
        change_request = await change_request_manager.get_change_request(change_id)
        if not change_request:
            raise HTTPException(status_code=404, detail="Change request not found")
        
        # Perform comprehensive impact analysis
        impact_analysis = await impact_analysis_calculator.perform_comprehensive_analysis(
            change_request_id=change_id,
            include_scenarios=analysis_request.include_scenarios,
            detailed_breakdown=analysis_request.detailed_breakdown,
            analyzed_by=UUID(current_user['user_id'])
        )
        
        # Update change request with impact analysis
        updates = ChangeRequestUpdate(
            estimated_cost_impact=impact_analysis.total_cost_impact,
            estimated_schedule_impact_days=impact_analysis.schedule_impact_days
        )
        await change_request_manager.update_change_request(
            change_id=change_id,
            updates=updates,
            updated_by=UUID(current_user['user_id'])
        )
        
        # Send notification about completed analysis
        await change_notification_system.notify_stakeholders(
            change_id=change_id,
            event_type="impact_analysis_completed",
            stakeholder_roles=["requestor", "approver", "project_manager"]
        )
        
        return impact_analysis
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze change impact: {str(e)}")

@router.get("/{change_id}/impact", response_model=ImpactAnalysisResponse)
async def get_impact_analysis(
    change_id: UUID,
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    Get existing impact analysis for a change request
    
    Requirements: 3.1, 3.2, 3.4
    """
    try:
        # Check if change request exists
        change_request = await change_request_manager.get_change_request(change_id)
        if not change_request:
            raise HTTPException(status_code=404, detail="Change request not found")
        
        # Get impact analysis
        impact_analysis = await impact_analysis_calculator.get_impact_analysis(change_id)
        if not impact_analysis:
            raise HTTPException(status_code=404, detail="Impact analysis not found for this change request")
        
        return impact_analysis
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get impact analysis: {str(e)}")

@router.put("/{change_id}/impact")
async def update_impact_analysis(
    change_id: UUID,
    impact_updates: dict,
    current_user = Depends(require_permission(Permission.project_update))
):
    """
    Update impact analysis for a change request
    
    Requirements: 3.1, 3.2, 3.4
    """
    try:
        # Check if change request exists
        change_request = await change_request_manager.get_change_request(change_id)
        if not change_request:
            raise HTTPException(status_code=404, detail="Change request not found")
        
        # Check if impact analysis exists
        existing_analysis = await impact_analysis_calculator.get_impact_analysis(change_id)
        if not existing_analysis:
            raise HTTPException(status_code=404, detail="Impact analysis not found for this change request")
        
        # Update impact analysis
        updated_analysis = await impact_analysis_calculator.update_impact_analysis(
            change_id=change_id,
            updates=impact_updates,
            updated_by=UUID(current_user['user_id'])
        )
        
        # Update change request with new impact estimates if provided
        if 'total_cost_impact' in impact_updates or 'schedule_impact_days' in impact_updates:
            change_updates = ChangeRequestUpdate()
            if 'total_cost_impact' in impact_updates:
                change_updates.estimated_cost_impact = impact_updates['total_cost_impact']
            if 'schedule_impact_days' in impact_updates:
                change_updates.estimated_schedule_impact_days = impact_updates['schedule_impact_days']
            
            await change_request_manager.update_change_request(
                change_id=change_id,
                updates=change_updates,
                updated_by=UUID(current_user['user_id'])
            )
        
        # Send notification about updated analysis
        await change_notification_system.notify_stakeholders(
            change_id=change_id,
            event_type="impact_analysis_updated",
            stakeholder_roles=["requestor", "approver", "project_manager"]
        )
        
        return updated_analysis
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update impact analysis: {str(e)}")

@router.post("/{change_id}/impact/scenarios")
async def generate_impact_scenarios(
    change_id: UUID,
    scenario_parameters: dict = None,
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    Generate impact scenarios (best-case, worst-case, most-likely) for a change request
    
    Requirements: 3.1, 3.2, 3.4
    """
    try:
        # Check if change request exists
        change_request = await change_request_manager.get_change_request(change_id)
        if not change_request:
            raise HTTPException(status_code=404, detail="Change request not found")
        
        # Generate scenarios
        scenarios = await impact_analysis_calculator.generate_impact_scenarios(
            change_id=change_id,
            parameters=scenario_parameters or {}
        )
        
        return {
            "change_request_id": str(change_id),
            "scenarios": scenarios,
            "generated_at": datetime.now().isoformat(),
            "generated_by": current_user['user_id']
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate impact scenarios: {str(e)}")

@router.get("/{change_id}/impact/baseline-updates")
async def get_baseline_updates(
    change_id: UUID,
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    Get baseline updates that would be applied if the change is approved
    
    Requirements: 3.1, 3.2, 3.4
    """
    try:
        # Check if change request exists
        change_request = await change_request_manager.get_change_request(change_id)
        if not change_request:
            raise HTTPException(status_code=404, detail="Change request not found")
        
        # Calculate baseline updates
        baseline_updates = await impact_analysis_calculator.calculate_baseline_updates(change_id)
        
        return baseline_updates
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get baseline updates: {str(e)}")
# ============================================================================
# IMPLEMENTATION TRACKING ENDPOINTS (Subtask 11.4)
# ============================================================================

@router.post("/{change_id}/start-implementation")
async def start_implementation(
    change_id: UUID,
    implementation_plan: ImplementationPlan,
    current_user = Depends(require_permission(Permission.project_update))
):
    """
    Start implementation of an approved change request
    
    Requirements: 8.1, 8.2, 8.3
    """
    try:
        # Check if change request exists and is approved
        change_request = await change_request_manager.get_change_request(change_id)
        if not change_request:
            raise HTTPException(status_code=404, detail="Change request not found")
        
        if change_request.status != ChangeStatus.APPROVED:
            raise HTTPException(
                status_code=400,
                detail=f"Change request must be approved before implementation. Current status: {change_request.status}"
            )
        
        # Create implementation plan
        implementation = await implementation_tracker.create_implementation_plan(
            change_request_id=change_id,
            implementation_plan=implementation_plan,
            created_by=UUID(current_user['user_id'])
        )
        
        # Update change request status
        updates = ChangeRequestUpdate(
            status=ChangeStatus.IMPLEMENTING,
            implementation_start_date=implementation_plan.implementation_plan.get('start_date')
        )
        await change_request_manager.update_change_request(
            change_id=change_id,
            updates=updates,
            updated_by=UUID(current_user['user_id'])
        )
        
        # Send notification about implementation start
        await change_notification_system.notify_stakeholders(
            change_id=change_id,
            event_type="implementation_started",
            stakeholder_roles=["requestor", "implementation_team", "project_manager"]
        )
        
        return implementation
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start implementation: {str(e)}")

@router.put("/{change_id}/implementation/progress")
async def update_implementation_progress(
    change_id: UUID,
    progress_update: ImplementationProgress,
    current_user = Depends(require_permission(Permission.project_update))
):
    """
    Update implementation progress for a change request
    
    Requirements: 8.1, 8.2, 8.3
    """
    try:
        # Check if change request exists and is being implemented
        change_request = await change_request_manager.get_change_request(change_id)
        if not change_request:
            raise HTTPException(status_code=404, detail="Change request not found")
        
        if change_request.status != ChangeStatus.IMPLEMENTING:
            raise HTTPException(
                status_code=400,
                detail=f"Change request is not in implementation status. Current status: {change_request.status}"
            )
        
        # Update implementation progress
        updated_implementation = await implementation_tracker.update_implementation_progress(
            change_request_id=change_id,
            progress_update=progress_update,
            updated_by=UUID(current_user['user_id'])
        )
        
        # If implementation is complete (100%), update change request status
        if progress_update.progress_percentage == 100:
            updates = ChangeRequestUpdate(
                status=ChangeStatus.IMPLEMENTED,
                implementation_end_date=date.today(),
                implementation_notes=progress_update.lessons_learned
            )
            await change_request_manager.update_change_request(
                change_id=change_id,
                updates=updates,
                updated_by=UUID(current_user['user_id'])
            )
            
            # Send completion notification
            await change_notification_system.notify_stakeholders(
                change_id=change_id,
                event_type="implementation_completed",
                stakeholder_roles=["requestor", "approver", "project_manager"]
            )
        
        # Send progress update notification
        await change_notification_system.notify_stakeholders(
            change_id=change_id,
            event_type="implementation_progress_updated",
            stakeholder_roles=["requestor", "project_manager"]
        )
        
        return updated_implementation
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update implementation progress: {str(e)}")

@router.get("/{change_id}/implementation", response_model=ImplementationResponse)
async def get_implementation_status(
    change_id: UUID,
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    Get implementation status and details for a change request
    
    Requirements: 8.1, 8.2, 8.3
    """
    try:
        # Check if change request exists
        change_request = await change_request_manager.get_change_request(change_id)
        if not change_request:
            raise HTTPException(status_code=404, detail="Change request not found")
        
        # Get implementation details
        implementation = await implementation_tracker.get_implementation_status(change_id)
        if not implementation:
            raise HTTPException(status_code=404, detail="Implementation not found for this change request")
        
        return implementation
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get implementation status: {str(e)}")

@router.get("/{change_id}/implementation/tasks")
async def get_implementation_tasks(
    change_id: UUID,
    status_filter: Optional[str] = Query(None, description="Filter tasks by status"),
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    Get implementation tasks for a change request
    
    Requirements: 8.1, 8.2, 8.3
    """
    try:
        # Check if change request exists
        change_request = await change_request_manager.get_change_request(change_id)
        if not change_request:
            raise HTTPException(status_code=404, detail="Change request not found")
        
        # Get implementation tasks
        tasks = await implementation_tracker.get_implementation_tasks(
            change_request_id=change_id,
            status_filter=status_filter
        )
        
        return tasks
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get implementation tasks: {str(e)}")

@router.post("/{change_id}/implementation/deviations")
async def report_implementation_deviation(
    change_id: UUID,
    deviation_data: dict,
    current_user = Depends(require_permission(Permission.project_update))
):
    """
    Report a deviation during implementation
    
    Requirements: 8.1, 8.2, 8.3
    """
    try:
        # Check if change request exists and is being implemented
        change_request = await change_request_manager.get_change_request(change_id)
        if not change_request:
            raise HTTPException(status_code=404, detail="Change request not found")
        
        if change_request.status != ChangeStatus.IMPLEMENTING:
            raise HTTPException(
                status_code=400,
                detail=f"Change request is not in implementation status. Current status: {change_request.status}"
            )
        
        # Report deviation
        deviation = await implementation_tracker.report_deviation(
            change_request_id=change_id,
            deviation_data=deviation_data,
            reported_by=UUID(current_user['user_id'])
        )
        
        # Send deviation alert
        await change_notification_system.notify_stakeholders(
            change_id=change_id,
            event_type="implementation_deviation",
            stakeholder_roles=["project_manager", "approver"]
        )
        
        return deviation
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to report implementation deviation: {str(e)}")

@router.get("/{change_id}/implementation/lessons-learned")
async def get_lessons_learned(
    change_id: UUID,
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    Get lessons learned from change implementation
    
    Requirements: 8.1, 8.2, 8.3
    """
    try:
        # Check if change request exists
        change_request = await change_request_manager.get_change_request(change_id)
        if not change_request:
            raise HTTPException(status_code=404, detail="Change request not found")
        
        # Get lessons learned
        lessons_learned = await implementation_tracker.get_lessons_learned(change_id)
        
        return lessons_learned
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get lessons learned: {str(e)}")
# ============================================================================
# ANALYTICS AND REPORTING ENDPOINTS (Subtask 11.5)
# ============================================================================

@router.get("/analytics", response_model=ChangeAnalytics)
async def get_change_analytics(
    project_id: Optional[UUID] = Query(None, description="Filter by project ID"),
    date_from: Optional[date] = Query(None, description="Analytics from date"),
    date_to: Optional[date] = Query(None, description="Analytics to date"),
    change_type: Optional[ChangeType] = Query(None, description="Filter by change type"),
    include_trends: bool = Query(True, description="Include trend analysis"),
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    Get change management analytics with filtering options
    
    Requirements: 6.3, 9.1, 9.5
    """
    try:
        # Build analytics filters
        filters = {
            'project_id': project_id,
            'date_from': date_from,
            'date_to': date_to,
            'change_type': change_type,
            'include_trends': include_trends
        }
        
        # Get analytics data
        analytics = await change_analytics_service.get_comprehensive_analytics(filters)
        
        return analytics
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get change analytics: {str(e)}")

@router.get("/{change_id}/audit-trail", response_model=List[AuditLogEntry])
async def get_change_audit_trail(
    change_id: UUID,
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    date_from: Optional[date] = Query(None, description="Filter from date"),
    date_to: Optional[date] = Query(None, description="Filter to date"),
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    Get complete audit trail for a change request
    
    Requirements: 6.3, 9.1, 9.5
    """
    try:
        # Check if change request exists
        change_request = await change_request_manager.get_change_request(change_id)
        if not change_request:
            raise HTTPException(status_code=404, detail="Change request not found")
        
        # Build audit trail filters
        filters = {
            'event_type': event_type,
            'date_from': date_from,
            'date_to': date_to
        }
        
        # Get audit trail
        audit_trail = await change_analytics_service.get_audit_trail(change_id, filters)
        
        return audit_trail
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get audit trail: {str(e)}")

@router.get("/reports/executive-summary")
async def get_executive_summary(
    project_id: Optional[UUID] = Query(None, description="Filter by project ID"),
    date_from: Optional[date] = Query(None, description="Report from date"),
    date_to: Optional[date] = Query(None, description="Report to date"),
    report_format: str = Query("json", description="Report format: json, pdf, excel"),
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    Get executive summary report for change management
    
    Requirements: 6.3, 9.1, 9.5
    """
    try:
        # Build report parameters
        report_params = {
            'project_id': project_id,
            'date_from': date_from,
            'date_to': date_to,
            'report_format': report_format
        }
        
        # Generate executive summary
        executive_summary = await change_analytics_service.generate_executive_summary(report_params)
        
        return executive_summary
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate executive summary: {str(e)}")

@router.get("/reports/performance-metrics")
async def get_performance_metrics(
    project_id: Optional[UUID] = Query(None, description="Filter by project ID"),
    date_from: Optional[date] = Query(None, description="Metrics from date"),
    date_to: Optional[date] = Query(None, description="Metrics to date"),
    metric_type: Optional[str] = Query(None, description="Specific metric type"),
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    Get change management performance metrics
    
    Requirements: 6.3, 9.1, 9.5
    """
    try:
        # Build metrics parameters
        metrics_params = {
            'project_id': project_id,
            'date_from': date_from,
            'date_to': date_to,
            'metric_type': metric_type
        }
        
        # Get performance metrics
        performance_metrics = await change_analytics_service.get_performance_metrics(metrics_params)
        
        return performance_metrics
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get performance metrics: {str(e)}")

@router.get("/reports/compliance")
async def get_compliance_report(
    project_id: Optional[UUID] = Query(None, description="Filter by project ID"),
    date_from: Optional[date] = Query(None, description="Report from date"),
    date_to: Optional[date] = Query(None, description="Report to date"),
    regulatory_framework: Optional[str] = Query(None, description="Specific regulatory framework"),
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    Get compliance report for change management
    
    Requirements: 6.3, 9.1, 9.5
    """
    try:
        # Build compliance report parameters
        compliance_params = {
            'project_id': project_id,
            'date_from': date_from,
            'date_to': date_to,
            'regulatory_framework': regulatory_framework
        }
        
        # Generate compliance report
        compliance_report = await change_analytics_service.generate_compliance_report(compliance_params)
        
        return compliance_report
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate compliance report: {str(e)}")

@router.get("/reports/trend-analysis")
async def get_trend_analysis(
    project_id: Optional[UUID] = Query(None, description="Filter by project ID"),
    analysis_period: str = Query("monthly", description="Analysis period: daily, weekly, monthly, quarterly"),
    trend_type: Optional[str] = Query(None, description="Specific trend type"),
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    Get trend analysis for change management patterns
    
    Requirements: 6.3, 9.1, 9.5
    """
    try:
        # Build trend analysis parameters
        trend_params = {
            'project_id': project_id,
            'analysis_period': analysis_period,
            'trend_type': trend_type
        }
        
        # Get trend analysis
        trend_analysis = await change_analytics_service.get_trend_analysis(trend_params)
        
        return trend_analysis
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get trend analysis: {str(e)}")

@router.get("/reports/impact-accuracy")
async def get_impact_accuracy_report(
    project_id: Optional[UUID] = Query(None, description="Filter by project ID"),
    date_from: Optional[date] = Query(None, description="Report from date"),
    date_to: Optional[date] = Query(None, description="Report to date"),
    impact_type: Optional[str] = Query(None, description="Impact type: cost, schedule, scope"),
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    Get impact estimation accuracy report
    
    Requirements: 6.3, 9.1, 9.5
    """
    try:
        # Build accuracy report parameters
        accuracy_params = {
            'project_id': project_id,
            'date_from': date_from,
            'date_to': date_to,
            'impact_type': impact_type
        }
        
        # Generate impact accuracy report
        accuracy_report = await change_analytics_service.get_impact_accuracy_report(accuracy_params)
        
        return accuracy_report
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get impact accuracy report: {str(e)}")

# ============================================================================
# TEMPLATE MANAGEMENT ENDPOINTS
# ============================================================================

@router.get("/templates", response_model=List[ChangeTemplateResponse])
async def list_change_templates(
    change_type: Optional[ChangeType] = Query(None, description="Filter by change type"),
    is_active: bool = Query(True, description="Filter by active status"),
    current_user = Depends(get_current_user)
):
    """
    List available change request templates
    """
    try:
        templates = await change_request_manager.list_change_templates(
            change_type=change_type,
            is_active=is_active
        )
        
        return templates
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list change templates: {str(e)}")

@router.post("/templates", response_model=ChangeTemplateResponse)
async def create_change_template(
    template_data: ChangeTemplateCreate,
    current_user = Depends(require_permission(Permission.system_admin))
):
    """
    Create a new change request template
    """
    try:
        template = await change_request_manager.create_change_template(
            template_data=template_data,
            created_by=UUID(current_user['user_id'])
        )
        
        return template
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create change template: {str(e)}")

@router.get("/templates/{template_id}", response_model=ChangeTemplateResponse)
async def get_change_template(
    template_id: UUID,
    current_user = Depends(get_current_user)
):
    """
    Get a specific change request template
    """
    try:
        template = await change_request_manager.get_change_template(template_id)
        if not template:
            raise HTTPException(status_code=404, detail="Change template not found")
        
        return template
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get change template: {str(e)}")