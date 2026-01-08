"""
Change Management API Router - Simplified for Testing
Handles change request lifecycle, approvals, impact analysis, and implementation tracking
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from uuid import UUID, uuid4
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

router = APIRouter(prefix="/changes", tags=["Change Management"])

# Mock data store for testing
mock_changes = {}
mock_approvals = {}
mock_impact_analyses = {}
mock_implementations = {}

# ============================================================================
# CHANGE REQUEST CRUD ENDPOINTS (Subtask 11.1)
# ============================================================================

@router.post("", response_model=ChangeRequestResponse)
async def create_change_request(
    change_data: ChangeRequestCreate,
    current_user = Depends(require_permission(Permission.project_update))
):
    """Create a new change request - Requirements: 1.1, 1.2, 1.4"""
    try:
        change_id = str(uuid4())
        change_number = f"CR-2024-{random.randint(1000, 9999)}"
        
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
        
        mock_changes[change_id] = change_request
        return change_request
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create change request: {str(e)}")

@router.get("", response_model=List[ChangeRequestResponse])
async def list_change_requests(
    project_id: Optional[UUID] = Query(None),
    status: Optional[ChangeStatus] = Query(None),
    change_type: Optional[ChangeType] = Query(None),
    priority: Optional[PriorityLevel] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user = Depends(require_permission(Permission.project_read))
):
    """List change requests with filtering - Requirements: 1.1, 1.2, 1.4"""
    try:
        changes = list(mock_changes.values())
        
        # Apply filters
        if project_id:
            changes = [c for c in changes if c.project_id == str(project_id)]
        if status:
            changes = [c for c in changes if c.status == status.value]
        if change_type:
            changes = [c for c in changes if c.change_type == change_type.value]
        if priority:
            changes = [c for c in changes if c.priority == priority.value]
        
        # Apply pagination
        start = (page - 1) * page_size
        end = start + page_size
        return changes[start:end]
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list change requests: {str(e)}")

@router.get("/{change_id}", response_model=ChangeRequestResponse)
async def get_change_request(
    change_id: UUID,
    current_user = Depends(require_permission(Permission.project_read))
):
    """Get a specific change request - Requirements: 1.1, 1.2, 1.4"""
    try:
        change_id_str = str(change_id)
        if change_id_str not in mock_changes:
            raise HTTPException(status_code=404, detail="Change request not found")
        
        return mock_changes[change_id_str]
        
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
    """Update a change request - Requirements: 1.1, 1.2, 1.4"""
    try:
        change_id_str = str(change_id)
        if change_id_str not in mock_changes:
            raise HTTPException(status_code=404, detail="Change request not found")
        
        change = mock_changes[change_id_str]
        
        # Update fields
        if updates.title:
            change.title = updates.title
        if updates.description:
            change.description = updates.description
        if updates.priority:
            change.priority = updates.priority.value
        if updates.status:
            change.status = updates.status.value
        if updates.estimated_cost_impact is not None:
            change.estimated_cost_impact = updates.estimated_cost_impact
        
        change.updated_at = datetime.now()
        return change
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update change request: {str(e)}")

@router.delete("/{change_id}")
async def cancel_change_request(
    change_id: UUID,
    current_user = Depends(require_permission(Permission.project_update))
):
    """Cancel a change request - Requirements: 1.1, 1.2, 1.4"""
    try:
        change_id_str = str(change_id)
        if change_id_str not in mock_changes:
            raise HTTPException(status_code=404, detail="Change request not found")
        
        change = mock_changes[change_id_str]
        if change.status in [ChangeStatus.IMPLEMENTED.value, ChangeStatus.CLOSED.value]:
            raise HTTPException(
                status_code=400, 
                detail="Cannot cancel a change request that is already implemented or closed"
            )
        
        change.status = ChangeStatus.CANCELLED.value
        change.updated_at = datetime.now()
        
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
    """Submit a change request for approval - Requirements: 2.1, 2.3, 2.5"""
    try:
        change_id_str = str(change_id)
        if change_id_str not in mock_changes:
            raise HTTPException(status_code=404, detail="Change request not found")
        
        change = mock_changes[change_id_str]
        if change.status not in [ChangeStatus.DRAFT.value, ChangeStatus.UNDER_REVIEW.value]:
            raise HTTPException(
                status_code=400,
                detail=f"Change request cannot be submitted from status: {change.status}"
            )
        
        change.status = ChangeStatus.PENDING_APPROVAL.value
        change.updated_at = datetime.now()
        
        return {
            "message": "Change request submitted for approval",
            "workflow_id": str(uuid4()),
            "approval_steps": 2
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit for approval: {str(e)}")

@router.get("/approvals/pending", response_model=List[PendingApproval])
async def get_pending_approvals(
    current_user = Depends(get_current_user)
):
    """Get pending approvals for current user - Requirements: 2.1, 2.3, 2.5"""
    try:
        # Mock pending approvals
        pending = []
        for change_id, change in mock_changes.items():
            if change.status == ChangeStatus.PENDING_APPROVAL.value:
                pending.append(PendingApproval(
                    approval_id=str(uuid4()),
                    change_request_id=change_id,
                    change_number=change.change_number,
                    change_title=change.title,
                    change_type=change.change_type,
                    priority=change.priority,
                    requested_by=change.requested_by,
                    requested_date=change.requested_date,
                    step_number=1,
                    due_date=None,
                    is_overdue=False,
                    project_name=change.project_name or "Unknown Project",
                    estimated_cost_impact=change.estimated_cost_impact
                ))
        
        return pending
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get pending approvals: {str(e)}")

# ============================================================================
# IMPACT ANALYSIS ENDPOINTS (Subtask 11.3)
# ============================================================================

@router.post("/{change_id}/analyze-impact")
async def analyze_change_impact(
    change_id: UUID,
    analysis_request: ImpactAnalysisRequest,
    current_user = Depends(require_permission(Permission.project_read))
):
    """Perform impact analysis - Requirements: 3.1, 3.2, 3.4"""
    try:
        change_id_str = str(change_id)
        if change_id_str not in mock_changes:
            raise HTTPException(status_code=404, detail="Change request not found")
        
        # Mock impact analysis
        impact_analysis = ImpactAnalysisResponse(
            change_request_id=change_id_str,
            critical_path_affected=random.choice([True, False]),
            schedule_impact_days=random.randint(1, 30),
            affected_activities=[{"activity": "Design Review", "delay_days": 5}],
            total_cost_impact=random.randint(5000, 50000),
            direct_costs=random.randint(3000, 30000),
            indirect_costs=random.randint(1000, 10000),
            cost_savings=random.randint(0, 5000),
            cost_breakdown={"labor": 15000, "materials": 8000, "overhead": 2000},
            additional_resources_needed=[{"role": "Engineer", "hours": 40}],
            resource_reallocation=[],
            new_risks=[{"risk": "Schedule delay", "probability": "medium"}],
            modified_risks=[],
            risk_mitigation_costs=random.randint(1000, 5000),
            quality_impact_assessment="Minimal impact expected",
            compliance_requirements={},
            regulatory_approvals_needed=[],
            scenarios={
                "best_case": {"cost": 20000, "schedule": 5},
                "worst_case": {"cost": 40000, "schedule": 15},
                "most_likely": {"cost": 30000, "schedule": 10}
            },
            analyzed_by=current_user['user_id'],
            analyzed_at=datetime.now(),
            approved_by=None,
            approved_at=None
        )
        
        mock_impact_analyses[change_id_str] = impact_analysis
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
    """Get existing impact analysis - Requirements: 3.1, 3.2, 3.4"""
    try:
        change_id_str = str(change_id)
        if change_id_str not in mock_changes:
            raise HTTPException(status_code=404, detail="Change request not found")
        
        if change_id_str not in mock_impact_analyses:
            raise HTTPException(status_code=404, detail="Impact analysis not found for this change request")
        
        return mock_impact_analyses[change_id_str]
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get impact analysis: {str(e)}")

# ============================================================================
# IMPLEMENTATION TRACKING ENDPOINTS (Subtask 11.4)
# ============================================================================

@router.post("/{change_id}/start-implementation")
async def start_implementation(
    change_id: UUID,
    implementation_plan: ImplementationPlan,
    current_user = Depends(require_permission(Permission.project_update))
):
    """Start implementation - Requirements: 8.1, 8.2, 8.3"""
    try:
        change_id_str = str(change_id)
        if change_id_str not in mock_changes:
            raise HTTPException(status_code=404, detail="Change request not found")
        
        change = mock_changes[change_id_str]
        if change.status != ChangeStatus.APPROVED.value:
            raise HTTPException(
                status_code=400,
                detail=f"Change request must be approved before implementation. Current status: {change.status}"
            )
        
        # Mock implementation response
        implementation = ImplementationResponse(
            id=str(uuid4()),
            change_request_id=change_id_str,
            implementation_plan=implementation_plan.implementation_plan,
            assigned_to=str(implementation_plan.assigned_to) if implementation_plan.assigned_to else current_user['user_id'],
            implementation_team=[str(uid) for uid in implementation_plan.implementation_team],
            progress_percentage=0,
            completed_tasks=[],
            pending_tasks=[{"task": "Initial setup", "due_date": "2024-02-15"}],
            blocked_tasks=[],
            implementation_milestones=implementation_plan.implementation_milestones,
            implementation_issues=[],
            lessons_learned=None,
            verification_criteria=implementation_plan.verification_criteria,
            verification_results=None,
            validated_by=None,
            validated_at=None,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        change.status = ChangeStatus.IMPLEMENTING.value
        change.updated_at = datetime.now()
        mock_implementations[change_id_str] = implementation
        
        return implementation
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start implementation: {str(e)}")

@router.get("/{change_id}/implementation", response_model=ImplementationResponse)
async def get_implementation_status(
    change_id: UUID,
    current_user = Depends(require_permission(Permission.project_read))
):
    """Get implementation status - Requirements: 8.1, 8.2, 8.3"""
    try:
        change_id_str = str(change_id)
        if change_id_str not in mock_changes:
            raise HTTPException(status_code=404, detail="Change request not found")
        
        if change_id_str not in mock_implementations:
            raise HTTPException(status_code=404, detail="Implementation not found for this change request")
        
        return mock_implementations[change_id_str]
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get implementation status: {str(e)}")

# ============================================================================
# ANALYTICS AND REPORTING ENDPOINTS (Subtask 11.5)
# ============================================================================

@router.get("/analytics", response_model=ChangeAnalytics)
async def get_change_analytics(
    project_id: Optional[UUID] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    current_user = Depends(require_permission(Permission.project_read))
):
    """Get change analytics - Requirements: 6.3, 9.1, 9.5"""
    try:
        # Mock analytics data
        analytics = ChangeAnalytics(
            total_changes=len(mock_changes),
            changes_by_status={
                "draft": len([c for c in mock_changes.values() if c.status == "draft"]),
                "pending_approval": len([c for c in mock_changes.values() if c.status == "pending_approval"]),
                "approved": len([c for c in mock_changes.values() if c.status == "approved"]),
                "implemented": len([c for c in mock_changes.values() if c.status == "implemented"])
            },
            changes_by_type={
                "scope": len([c for c in mock_changes.values() if c.change_type == "scope"]),
                "budget": len([c for c in mock_changes.values() if c.change_type == "budget"]),
                "schedule": len([c for c in mock_changes.values() if c.change_type == "schedule"])
            },
            changes_by_priority={
                "low": len([c for c in mock_changes.values() if c.priority == "low"]),
                "medium": len([c for c in mock_changes.values() if c.priority == "medium"]),
                "high": len([c for c in mock_changes.values() if c.priority == "high"])
            },
            average_approval_time_days=5.2,
            average_implementation_time_days=12.8,
            approval_rate_percentage=85.5,
            cost_estimate_accuracy=78.3,
            schedule_estimate_accuracy=82.1,
            monthly_change_volume=[
                {"month": "2024-01", "count": 15},
                {"month": "2024-02", "count": 22}
            ],
            top_change_categories=[
                {"category": "scope", "count": 45},
                {"category": "budget", "count": 32}
            ],
            changes_by_project=[
                {"project_id": "proj-1", "project_name": "Project A", "count": 12},
                {"project_id": "proj-2", "project_name": "Project B", "count": 8}
            ],
            high_impact_changes=[
                {"change_id": "change-1", "title": "Major Scope Change", "impact": 50000}
            ]
        )
        
        return analytics
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get change analytics: {str(e)}")

@router.get("/{change_id}/audit-trail", response_model=List[AuditLogEntry])
async def get_change_audit_trail(
    change_id: UUID,
    current_user = Depends(require_permission(Permission.project_read))
):
    """Get audit trail - Requirements: 6.3, 9.1, 9.5"""
    try:
        change_id_str = str(change_id)
        if change_id_str not in mock_changes:
            raise HTTPException(status_code=404, detail="Change request not found")
        
        # Mock audit trail
        audit_trail = [
            AuditLogEntry(
                id=str(uuid4()),
                change_request_id=change_id_str,
                event_type="created",
                event_description="Change request created",
                performed_by=current_user['user_id'],
                performed_at=datetime.now(),
                ip_address="127.0.0.1",
                user_agent="Test Client",
                old_values=None,
                new_values={"status": "draft"},
                related_entity_type=None,
                related_entity_id=None,
                compliance_notes=None,
                regulatory_reference=None
            )
        ]
        
        return audit_trail
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get audit trail: {str(e)}")
@router.get("/{change_id}/approvals", response_model=List[ApprovalResponse])
async def get_change_approvals(
    change_id: UUID,
    current_user = Depends(require_permission(Permission.project_read))
):
    """Get all approvals for a specific change request - Requirements: 2.1, 2.3, 2.5"""
    try:
        change_id_str = str(change_id)
        if change_id_str not in mock_changes:
            raise HTTPException(status_code=404, detail="Change request not found")
        
        # Mock approvals for the change request
        approvals = [
            ApprovalResponse(
                id=str(uuid4()),
                change_request_id=change_id_str,
                step_number=1,
                approver_id=current_user['user_id'],
                approver_role="project_manager",
                decision=None,
                decision_date=None,
                comments=None,
                conditions=None,
                is_required=True,
                is_parallel=False,
                depends_on_step=None,
                due_date=None,
                escalation_date=None,
                escalated_to=None,
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
        ]
        
        return approvals
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get change approvals: {str(e)}")