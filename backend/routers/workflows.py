"""
Workflow API endpoints for managing approval workflows

This router provides endpoints for creating, managing, and advancing workflows
in the AI-Empowered PPM Features system.

Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 7.1, 7.2, 7.3, 7.4, 7.5
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query
from typing import Dict, Any, List, Optional
from uuid import UUID
from datetime import datetime, timedelta
import logging

from auth.dependencies import get_current_user
from auth.rbac import require_permission, Permission
from config.database import supabase
from services.workflow_engine_core import WorkflowEngineCore
from services.workflow_templates import workflow_template_system, WorkflowTemplateType
from models.workflow import (
    WorkflowDefinition,
    WorkflowStatus,
    WorkflowStep,
    WorkflowTrigger,
    ApprovalStatus,
    WorkflowApproval
)
from schemas.workflows import (
    CreateWorkflowInstanceRequest,
    SubmitApprovalRequest,
    WorkflowInstanceResponse,
    ApprovalResultResponse,
    AdvanceWorkflowResponse,
    TemplateListResponse,
    TemplateMetadataResponse,
    InstantiateTemplateRequest,
    InstantiateTemplateResponse,
    CustomizeTemplateRequest,
    CustomizeTemplateResponse
)

router = APIRouter(prefix="/api/workflows", tags=["workflows"])
logger = logging.getLogger(__name__)

# Initialize workflow engine lazily
_workflow_engine = None


def get_workflow_engine() -> WorkflowEngineCore:
    """Get or initialize workflow engine"""
    global _workflow_engine
    if _workflow_engine is None:
        try:
            if not supabase:
                raise RuntimeError("Database service unavailable")
            _workflow_engine = WorkflowEngineCore(supabase)
        except Exception as e:
            logger.error(f"Failed to initialize workflow engine: {e}")
            raise HTTPException(
                status_code=503,
                detail="Workflow engine unavailable"
            )
    return _workflow_engine


# ==================== Workflow Definition CRUD Endpoints ====================


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_workflow(
    workflow: WorkflowDefinition,
    current_user = Depends(require_permission(Permission.workflow_create))
):
    """
    Create a new workflow definition.
    
    Creates a workflow definition with steps, approvers, triggers, and conditions.
    The workflow is created in DRAFT status by default and must be activated
    before it can be used to create workflow instances.
    
    Args:
        workflow: Workflow definition to create
        current_user: Authenticated user with workflow_create permission
        
    Returns:
        Created workflow definition with generated ID
        
    Raises:
        HTTPException 400: Invalid workflow definition
        HTTPException 401: Unauthorized (no valid JWT)
        HTTPException 403: Forbidden (insufficient permissions)
        HTTPException 422: Validation error
        HTTPException 503: Database service unavailable
        
    Requirements: 3.1, 3.5
    """
    try:
        if not supabase:
            raise HTTPException(
                status_code=503,
                detail="Database service unavailable"
            )
        
        # Get user ID from current_user
        user_id = current_user.get("user_id")
        if not user_id:
            raise HTTPException(
                status_code=400,
                detail="User ID not found in user context"
            )
        
        # Set created_by field
        workflow.created_by = UUID(user_id)
        
        # Get workflow engine
        engine = get_workflow_engine()
        
        # Create workflow using repository
        workflow_data = await engine.repository.create_workflow(workflow)
        
        logger.info(f"Created workflow: {workflow_data['id']} by user {user_id}")
        
        return workflow_data
        
    except ValueError as e:
        logger.error(f"Validation error creating workflow: {e}")
        raise HTTPException(
            status_code=422,
            detail=str(e)
        )
    except RuntimeError as e:
        logger.error(f"Runtime error creating workflow: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create workflow: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Unexpected error creating workflow: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create workflow: {str(e)}"
        )


@router.get("/")
async def list_workflows(
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user = Depends(require_permission(Permission.workflow_read))
):
    """
    List workflow definitions with optional filtering.
    
    Returns a paginated list of workflow definitions. Can be filtered by status.
    
    Args:
        status_filter: Optional status filter (draft, active, suspended)
        limit: Maximum number of results (1-500, default 100)
        offset: Offset for pagination (default 0)
        current_user: Authenticated user with workflow_read permission
        
    Returns:
        List of workflow definitions
        
    Raises:
        HTTPException 401: Unauthorized (no valid JWT)
        HTTPException 403: Forbidden (insufficient permissions)
        HTTPException 503: Database service unavailable
        
    Requirements: 3.1, 3.5
    """
    try:
        if not supabase:
            raise HTTPException(
                status_code=503,
                detail="Database service unavailable"
            )
        
        # Get workflow engine
        engine = get_workflow_engine()
        
        # Parse status filter if provided
        workflow_status = None
        if status_filter:
            try:
                workflow_status = WorkflowStatus(status_filter)
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid status: {status_filter}. Must be one of: draft, active, suspended, pending, in_progress, completed, rejected, cancelled"
                )
        
        # List workflows using repository
        workflows = await engine.repository.list_workflows(
            status=workflow_status,
            limit=limit,
            offset=offset
        )
        
        return {
            "workflows": workflows,
            "count": len(workflows),
            "limit": limit,
            "offset": offset
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing workflows: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list workflows: {str(e)}"
        )


@router.get("/{workflow_id}")
async def get_workflow(
    workflow_id: UUID,
    current_user = Depends(require_permission(Permission.workflow_read))
):
    """
    Get a specific workflow definition by ID.
    
    Returns the complete workflow definition including all steps, triggers,
    and metadata.
    
    Args:
        workflow_id: Workflow definition ID
        current_user: Authenticated user with workflow_read permission
        
    Returns:
        Workflow definition
        
    Raises:
        HTTPException 401: Unauthorized (no valid JWT)
        HTTPException 403: Forbidden (insufficient permissions)
        HTTPException 404: Workflow not found
        HTTPException 503: Database service unavailable
        
    Requirements: 3.1, 3.5
    """
    try:
        if not supabase:
            raise HTTPException(
                status_code=503,
                detail="Database service unavailable"
            )
        
        # Get workflow engine
        engine = get_workflow_engine()
        
        # Get workflow using repository
        workflow_data = await engine.repository.get_workflow(workflow_id)
        
        if not workflow_data:
            raise HTTPException(
                status_code=404,
                detail=f"Workflow {workflow_id} not found"
            )
        
        return workflow_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting workflow {workflow_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get workflow: {str(e)}"
        )


@router.put("/{workflow_id}")
async def update_workflow(
    workflow_id: UUID,
    workflow: WorkflowDefinition,
    current_user = Depends(require_permission(Permission.workflow_update))
):
    """
    Update a workflow definition.
    
    Updates an existing workflow definition. This creates a new version of the
    workflow while preserving existing workflow instances that use the old version.
    
    Args:
        workflow_id: Workflow definition ID to update
        workflow: Updated workflow definition
        current_user: Authenticated user with workflow_update permission
        
    Returns:
        Updated workflow definition with new version number
        
    Raises:
        HTTPException 400: Invalid workflow definition
        HTTPException 401: Unauthorized (no valid JWT)
        HTTPException 403: Forbidden (insufficient permissions)
        HTTPException 404: Workflow not found
        HTTPException 422: Validation error
        HTTPException 503: Database service unavailable
        
    Requirements: 3.1, 3.5
    """
    try:
        if not supabase:
            raise HTTPException(
                status_code=503,
                detail="Database service unavailable"
            )
        
        # Get user ID from current_user
        user_id = current_user.get("user_id")
        if not user_id:
            raise HTTPException(
                status_code=400,
                detail="User ID not found in user context"
            )
        
        # Get workflow engine
        engine = get_workflow_engine()
        
        # Check if workflow exists
        existing_workflow = await engine.repository.get_workflow(workflow_id)
        if not existing_workflow:
            raise HTTPException(
                status_code=404,
                detail=f"Workflow {workflow_id} not found"
            )
        
        # Create new version of workflow
        updated_workflow = await engine.repository.create_workflow_version(
            workflow_id,
            workflow
        )
        
        logger.info(f"Updated workflow: {workflow_id} to version {updated_workflow.get('template_data', {}).get('version', 'unknown')} by user {user_id}")
        
        return updated_workflow
        
    except ValueError as e:
        logger.error(f"Validation error updating workflow: {e}")
        raise HTTPException(
            status_code=422,
            detail=str(e)
        )
    except HTTPException:
        raise
    except RuntimeError as e:
        logger.error(f"Runtime error updating workflow: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update workflow: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Unexpected error updating workflow: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update workflow: {str(e)}"
        )


@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workflow(
    workflow_id: UUID,
    current_user = Depends(require_permission(Permission.workflow_delete))
):
    """
    Delete a workflow definition.
    
    Deletes a workflow definition. This operation will fail if there are
    active workflow instances using this workflow.
    
    Args:
        workflow_id: Workflow definition ID to delete
        current_user: Authenticated user with workflow_delete permission
        
    Returns:
        No content (204)
        
    Raises:
        HTTPException 400: Cannot delete (active instances exist)
        HTTPException 401: Unauthorized (no valid JWT)
        HTTPException 403: Forbidden (insufficient permissions)
        HTTPException 404: Workflow not found
        HTTPException 503: Database service unavailable
        
    Requirements: 3.1, 3.5
    """
    try:
        if not supabase:
            raise HTTPException(
                status_code=503,
                detail="Database service unavailable"
            )
        
        # Get user ID from current_user
        user_id = current_user.get("user_id")
        if not user_id:
            raise HTTPException(
                status_code=400,
                detail="User ID not found in user context"
            )
        
        # Get workflow engine
        engine = get_workflow_engine()
        
        # Check if workflow exists
        existing_workflow = await engine.repository.get_workflow(workflow_id)
        if not existing_workflow:
            raise HTTPException(
                status_code=404,
                detail=f"Workflow {workflow_id} not found"
            )
        
        # Check for active instances
        active_instances = await engine.repository.list_workflow_instances(
            workflow_id=workflow_id,
            status=WorkflowStatus.IN_PROGRESS,
            limit=1
        )
        
        if active_instances:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete workflow with active instances. Please complete or cancel all instances first."
            )
        
        # Delete workflow using repository
        success = await engine.repository.delete_workflow(workflow_id)
        
        if not success:
            raise HTTPException(
                status_code=500,
                detail="Failed to delete workflow"
            )
        
        logger.info(f"Deleted workflow: {workflow_id} by user {user_id}")
        
        return None
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting workflow {workflow_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete workflow: {str(e)}"
        )


# ==================== Workflow Instance Management Endpoints ====================


@router.post("/{workflow_id}/instances", status_code=status.HTTP_201_CREATED)
async def create_workflow_instance(
    workflow_id: UUID,
    entity_type: str = Query(..., description="Type of entity (e.g., 'project', 'financial_tracking')"),
    entity_id: UUID = Query(..., description="ID of the entity"),
    project_id: Optional[UUID] = Query(None, description="Optional associated project ID"),
    context: Optional[Dict[str, Any]] = None,
    current_user = Depends(require_permission(Permission.workflow_approve))
):
    """
    Create and initiate a new workflow instance.
    
    Creates a workflow instance for a specific entity and initiates the approval
    process. The workflow must be in ACTIVE status to create instances.
    
    Args:
        workflow_id: Workflow definition ID
        entity_type: Type of entity (e.g., "project", "financial_tracking", "milestone")
        entity_id: ID of the entity
        project_id: Optional associated project ID
        context: Optional context data for the workflow
        current_user: Authenticated user with workflow_approve permission
        
    Returns:
        Created workflow instance with initial status
        
    Raises:
        HTTPException 400: Invalid workflow or entity
        HTTPException 401: Unauthorized (no valid JWT)
        HTTPException 403: Forbidden (insufficient permissions)
        HTTPException 404: Workflow not found
        HTTPException 503: Workflow engine unavailable
        
    Requirements: 3.2, 3.5
    """
    try:
        # Get user context
        user_id = current_user.get("user_id")
        if not user_id:
            raise HTTPException(
                status_code=400,
                detail="User ID not found in user context"
            )
        
        # Get workflow engine
        engine = get_workflow_engine()
        
        # Create workflow instance
        try:
            instance = await engine.create_workflow_instance(
                workflow_id=workflow_id,
                entity_type=entity_type,
                entity_id=entity_id,
                initiated_by=UUID(user_id),
                context=context or {},
                project_id=project_id
            )
            
            # Get full instance status
            instance_status = await engine.get_workflow_instance_status(instance.id)
            
            logger.info(
                f"Created workflow instance {instance.id} for workflow {workflow_id} "
                f"by user {user_id}"
            )
            
            return instance_status
            
        except ValueError as e:
            error_msg = str(e)
            if "not found" in error_msg.lower():
                raise HTTPException(status_code=404, detail=error_msg)
            else:
                raise HTTPException(status_code=400, detail=error_msg)
        except RuntimeError as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to create workflow instance: {str(e)}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating workflow instance: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create workflow instance: {str(e)}"
        )


@router.get("/{workflow_id}/instances")
async def list_workflow_instances(
    workflow_id: UUID,
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user = Depends(require_permission(Permission.workflow_read))
):
    """
    List workflow instances for a specific workflow.
    
    Returns a paginated list of workflow instances. Can be filtered by status.
    
    Args:
        workflow_id: Workflow definition ID
        status_filter: Optional status filter (pending, in_progress, completed, rejected, cancelled)
        limit: Maximum number of results (1-500, default 100)
        offset: Offset for pagination (default 0)
        current_user: Authenticated user with workflow_read permission
        
    Returns:
        List of workflow instances
        
    Raises:
        HTTPException 401: Unauthorized (no valid JWT)
        HTTPException 403: Forbidden (insufficient permissions)
        HTTPException 404: Workflow not found
        HTTPException 503: Database service unavailable
        
    Requirements: 3.2, 3.5
    """
    try:
        if not supabase:
            raise HTTPException(
                status_code=503,
                detail="Database service unavailable"
            )
        
        # Get workflow engine
        engine = get_workflow_engine()
        
        # Verify workflow exists
        workflow_data = await engine.repository.get_workflow(workflow_id)
        if not workflow_data:
            raise HTTPException(
                status_code=404,
                detail=f"Workflow {workflow_id} not found"
            )
        
        # Parse status filter if provided
        workflow_status = None
        if status_filter:
            try:
                workflow_status = WorkflowStatus(status_filter)
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid status: {status_filter}. Must be one of: pending, in_progress, completed, rejected, cancelled"
                )
        
        # List instances using repository
        instances = await engine.repository.list_workflow_instances(
            workflow_id=workflow_id,
            status=workflow_status,
            limit=limit,
            offset=offset
        )
        
        return {
            "workflow_id": str(workflow_id),
            "instances": instances,
            "count": len(instances),
            "limit": limit,
            "offset": offset
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing workflow instances: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list workflow instances: {str(e)}"
        )


@router.get("/instances/{instance_id}/history")
async def get_workflow_instance_history(
    instance_id: UUID,
    current_user = Depends(require_permission(Permission.workflow_read))
):
    """
    Get workflow instance history and audit trail.
    
    Returns a complete audit trail of all events and decisions for a workflow
    instance, including approvals, rejections, escalations, and state changes.
    
    Args:
        instance_id: Workflow instance ID
        current_user: Authenticated user with workflow_read permission
        
    Returns:
        Workflow instance history with audit trail
        
    Raises:
        HTTPException 401: Unauthorized (no valid JWT)
        HTTPException 403: Forbidden (insufficient permissions)
        HTTPException 404: Workflow instance not found
        HTTPException 503: Database service unavailable
        
    Requirements: 3.4, 3.5
    """
    try:
        if not supabase:
            raise HTTPException(
                status_code=503,
                detail="Database service unavailable"
            )
        
        # Get workflow engine
        engine = get_workflow_engine()
        
        # Get instance data
        instance_data = await engine.repository.get_workflow_instance(instance_id)
        if not instance_data:
            raise HTTPException(
                status_code=404,
                detail=f"Workflow instance {instance_id} not found"
            )
        
        # Get all approvals for the instance
        approvals = await engine.repository.get_approvals_for_instance(instance_id)
        
        # Build audit trail
        audit_trail = []
        
        # Add instance creation event
        audit_trail.append({
            "event_type": "instance_created",
            "timestamp": instance_data["created_at"],
            "user_id": instance_data["started_by"],
            "details": {
                "workflow_id": instance_data["workflow_id"],
                "entity_type": instance_data["entity_type"],
                "entity_id": instance_data["entity_id"],
                "initial_status": WorkflowStatus.PENDING.value
            }
        })
        
        # Add instance started event if different from creation
        if instance_data.get("started_at") and instance_data["started_at"] != instance_data["created_at"]:
            audit_trail.append({
                "event_type": "instance_started",
                "timestamp": instance_data["started_at"],
                "user_id": instance_data["started_by"],
                "details": {
                    "status": WorkflowStatus.IN_PROGRESS.value,
                    "current_step": 0
                }
            })
        
        # Add approval events
        for approval in approvals:
            # Approval created
            audit_trail.append({
                "event_type": "approval_created",
                "timestamp": approval["created_at"],
                "user_id": approval["approver_id"],
                "details": {
                    "approval_id": approval["id"],
                    "step_number": approval["step_number"],
                    "status": ApprovalStatus.PENDING.value,
                    "expires_at": approval.get("expires_at")
                }
            })
            
            # Approval decision if made
            if approval["status"] != ApprovalStatus.PENDING.value and approval.get("approved_at"):
                audit_trail.append({
                    "event_type": "approval_decision",
                    "timestamp": approval["approved_at"],
                    "user_id": approval["approver_id"],
                    "details": {
                        "approval_id": approval["id"],
                        "step_number": approval["step_number"],
                        "decision": approval["status"],
                        "comments": approval.get("comments")
                    }
                })
        
        # Add context events from instance data
        context = instance_data.get("data", {})
        
        # Add restart events if any
        restart_history = context.get("restart_history", [])
        for restart in restart_history:
            audit_trail.append({
                "event_type": "workflow_restarted",
                "timestamp": restart.get("rejected_at"),
                "user_id": restart.get("rejected_by"),
                "details": {
                    "rejected_at_step": restart.get("rejected_at_step"),
                    "restart_count": restart.get("restart_count"),
                    "comments": restart.get("comments")
                }
            })
        
        # Add escalation events if any
        escalation_history = context.get("escalation_history", [])
        for escalation in escalation_history:
            audit_trail.append({
                "event_type": "workflow_escalated",
                "timestamp": escalation.get("escalated_at"),
                "user_id": escalation.get("rejected_by"),
                "details": {
                    "escalated_from_step": escalation.get("escalated_from_step"),
                    "escalation_count": escalation.get("escalation_count"),
                    "comments": escalation.get("comments")
                }
            })
        
        # Add completion event if completed
        if instance_data.get("completed_at"):
            audit_trail.append({
                "event_type": "instance_completed",
                "timestamp": instance_data["completed_at"],
                "user_id": None,  # System event
                "details": {
                    "status": WorkflowStatus.COMPLETED.value,
                    "final_step": instance_data["current_step"]
                }
            })
        
        # Add cancellation event if cancelled
        if instance_data.get("cancelled_at"):
            audit_trail.append({
                "event_type": "instance_cancelled",
                "timestamp": instance_data["cancelled_at"],
                "user_id": None,  # May be system or user
                "details": {
                    "status": instance_data["status"],
                    "reason": instance_data.get("cancellation_reason")
                }
            })
        
        # Sort audit trail by timestamp
        audit_trail.sort(key=lambda x: x["timestamp"])
        
        return {
            "instance_id": str(instance_id),
            "workflow_id": instance_data["workflow_id"],
            "entity_type": instance_data["entity_type"],
            "entity_id": instance_data["entity_id"],
            "current_status": instance_data["status"],
            "current_step": instance_data["current_step"],
            "started_by": instance_data["started_by"],
            "started_at": instance_data["started_at"],
            "completed_at": instance_data.get("completed_at"),
            "cancelled_at": instance_data.get("cancelled_at"),
            "audit_trail": audit_trail,
            "event_count": len(audit_trail)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting workflow instance history: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get workflow instance history: {str(e)}"
        )


@router.get("/instances/{instance_id}/audit")
async def get_workflow_instance_audit_trail(
    instance_id: UUID,
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user = Depends(require_permission(Permission.workflow_read))
):
    """
    Get detailed audit trail for a workflow instance.
    
    Returns a filtered and paginated audit trail with detailed event information.
    Supports filtering by event type for focused analysis.
    
    Args:
        instance_id: Workflow instance ID
        event_type: Optional event type filter (instance_created, approval_decision, etc.)
        limit: Maximum number of results (1-500, default 100)
        offset: Offset for pagination (default 0)
        current_user: Authenticated user with workflow_read permission
        
    Returns:
        Paginated audit trail events
        
    Raises:
        HTTPException 401: Unauthorized (no valid JWT)
        HTTPException 403: Forbidden (insufficient permissions)
        HTTPException 404: Workflow instance not found
        HTTPException 503: Database service unavailable
        
    Requirements: 3.4, 3.5
    """
    try:
        # Get full history first
        history_response = await get_workflow_instance_history(instance_id, current_user)
        
        audit_trail = history_response["audit_trail"]
        
        # Filter by event type if specified
        if event_type:
            audit_trail = [
                event for event in audit_trail
                if event["event_type"] == event_type
            ]
        
        # Apply pagination
        total_count = len(audit_trail)
        paginated_trail = audit_trail[offset:offset + limit]
        
        return {
            "instance_id": str(instance_id),
            "events": paginated_trail,
            "count": len(paginated_trail),
            "total_count": total_count,
            "limit": limit,
            "offset": offset,
            "event_type_filter": event_type
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting workflow audit trail: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get workflow audit trail: {str(e)}"
        )


# ==================== Approval Management Endpoints ====================


@router.get("/approvals/pending")
async def get_pending_approvals(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user = Depends(require_permission(Permission.workflow_approve))
):
    """
    Get pending approvals for the current user.
    
    Returns a list of workflow approvals that are pending the current user's
    decision. Includes workflow context and metadata to help the user make
    informed decisions.
    
    Args:
        limit: Maximum number of results (1-500, default 100)
        offset: Offset for pagination (default 0)
        current_user: Authenticated user with workflow_approve permission
        
    Returns:
        List of pending approvals with workflow context
        
    Raises:
        HTTPException 401: Unauthorized (no valid JWT)
        HTTPException 403: Forbidden (insufficient permissions)
        HTTPException 503: Database service unavailable
        
    Requirements: 3.3, 3.5
    """
    try:
        if not supabase:
            raise HTTPException(
                status_code=503,
                detail="Database service unavailable"
            )
        
        # Get user ID from current_user
        user_id = current_user.get("user_id")
        if not user_id:
            raise HTTPException(
                status_code=400,
                detail="User ID not found in user context"
            )
        
        # Get workflow engine
        engine = get_workflow_engine()
        
        # Get pending approvals for user
        pending_approvals = await engine.get_pending_approvals(
            user_id=UUID(user_id),
            limit=limit,
            offset=offset
        )
        
        # Convert to response format
        approvals_response = []
        for approval in pending_approvals:
            approvals_response.append({
                "approval_id": str(approval.approval_id),
                "workflow_instance_id": str(approval.workflow_instance_id),
                "workflow_name": approval.workflow_name,
                "entity_type": approval.entity_type,
                "entity_id": str(approval.entity_id),
                "step_number": approval.step_number,
                "step_name": approval.step_name,
                "initiated_by": str(approval.initiated_by),
                "initiated_by_name": approval.initiated_by_name,
                "initiated_at": approval.initiated_at.isoformat(),
                "expires_at": approval.expires_at.isoformat() if approval.expires_at else None,
                "context": approval.context
            })
        
        return {
            "approvals": approvals_response,
            "count": len(approvals_response),
            "limit": limit,
            "offset": offset
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting pending approvals: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get pending approvals: {str(e)}"
        )


@router.post("/approvals/{approval_id}/decision")
async def submit_approval_decision(
    approval_id: UUID,
    decision: str = Query(..., pattern="^(approved|rejected)$", description="Approval decision: 'approved' or 'rejected'"),
    comments: Optional[str] = Query(None, max_length=2000, description="Optional comments about the decision"),
    current_user = Depends(require_permission(Permission.workflow_approve))
):
    """
    Submit an approval decision.
    
    Allows an approver to approve or reject a pending approval. The decision
    is validated against the approver's identity and the approval status.
    The workflow will automatically advance or handle rejection based on the
    workflow configuration.
    
    Args:
        approval_id: Approval ID
        decision: Approval decision ("approved" or "rejected")
        comments: Optional comments about the decision
        current_user: Authenticated user with workflow_approve permission
        
    Returns:
        Approval result with workflow status
        
    Raises:
        HTTPException 400: Invalid decision or approval already decided
        HTTPException 401: Unauthorized (no valid JWT)
        HTTPException 403: User is not the designated approver or insufficient permissions
        HTTPException 404: Approval not found
        HTTPException 503: Database service unavailable
        
    Requirements: 3.3, 3.5
    """
    try:
        if not supabase:
            raise HTTPException(
                status_code=503,
                detail="Database service unavailable"
            )
        
        # Get user ID from current_user
        user_id = current_user.get("user_id")
        if not user_id:
            raise HTTPException(
                status_code=400,
                detail="User ID not found in user context"
            )
        
        # Get workflow engine
        engine = get_workflow_engine()
        
        # Submit approval decision
        try:
            result = await engine.submit_approval_decision(
                approval_id=approval_id,
                approver_id=UUID(user_id),
                decision=decision,
                comments=comments
            )
            
            logger.info(
                f"Approval decision submitted: {approval_id} by user {user_id} - {decision}"
            )
            
            return {
                "approval_id": str(approval_id),
                "decision": result["decision"],
                "workflow_status": result["workflow_status"],
                "is_complete": result["is_complete"],
                "current_step": result.get("current_step"),
                "message": result.get("message")
            }
            
        except ValueError as e:
            error_msg = str(e)
            if "not found" in error_msg.lower():
                raise HTTPException(status_code=404, detail=error_msg)
            elif "not the designated approver" in error_msg.lower():
                raise HTTPException(status_code=403, detail=error_msg)
            else:
                raise HTTPException(status_code=400, detail=error_msg)
        except RuntimeError as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to submit approval decision: {str(e)}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting approval decision: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to submit approval decision: {str(e)}"
        )


@router.post("/approvals/{approval_id}/delegate")
async def delegate_approval(
    approval_id: UUID,
    delegate_to: UUID = Query(..., description="User ID to delegate the approval to"),
    comments: Optional[str] = Query(None, max_length=2000, description="Optional comments about the delegation"),
    current_user = Depends(require_permission(Permission.workflow_approve))
):
    """
    Delegate an approval to another user.
    
    Allows an approver to delegate their approval responsibility to another
    user. The original approver must be the designated approver, and the
    delegate must have appropriate permissions.
    
    Args:
        approval_id: Approval ID
        delegate_to: User ID to delegate to
        comments: Optional comments about the delegation
        current_user: Authenticated user with workflow_approve permission
        
    Returns:
        Delegation result with updated approval information
        
    Raises:
        HTTPException 400: Invalid delegation or approval already decided
        HTTPException 401: Unauthorized (no valid JWT)
        HTTPException 403: User is not the designated approver or insufficient permissions
        HTTPException 404: Approval not found
        HTTPException 503: Database service unavailable
        
    Requirements: 3.3, 3.5
    """
    try:
        if not supabase:
            raise HTTPException(
                status_code=503,
                detail="Database service unavailable"
            )
        
        # Get user ID from current_user
        user_id = current_user.get("user_id")
        if not user_id:
            raise HTTPException(
                status_code=400,
                detail="User ID not found in user context"
            )
        
        # Get workflow engine
        engine = get_workflow_engine()
        
        # Get approval record to verify approver
        approval_data = await engine.repository.get_approval_by_id(approval_id)
        if not approval_data:
            raise HTTPException(
                status_code=404,
                detail=f"Approval {approval_id} not found"
            )
        
        # Verify user is the designated approver
        if str(approval_data["approver_id"]) != str(user_id):
            raise HTTPException(
                status_code=403,
                detail="User is not the designated approver"
            )
        
        # Check if already decided
        if approval_data["status"] != ApprovalStatus.PENDING.value:
            raise HTTPException(
                status_code=400,
                detail=f"Approval already {approval_data['status']}"
            )
        
        # Update approval with delegation
        try:
            updated_approval = await engine.repository.update_approval(
                approval_id,
                ApprovalStatus.DELEGATED.value,
                comments
            )
            
            if not updated_approval:
                raise RuntimeError("Failed to update approval")
            
            # Update the approver_id to the delegate
            delegation_updates = {
                "approver_id": str(delegate_to),
                "status": ApprovalStatus.PENDING.value,
                "delegated_to": str(delegate_to),
                "delegated_at": datetime.utcnow().isoformat(),
                "comments": f"Delegated by {user_id}: {comments or 'No reason provided'}",
                "updated_at": datetime.utcnow().isoformat()
            }
            
            result = supabase.table("workflow_approvals").update(
                delegation_updates
            ).eq("id", str(approval_id)).execute()
            
            if not result.data:
                raise RuntimeError("Failed to update delegation")
            
            logger.info(
                f"Approval delegated: {approval_id} from user {user_id} to {delegate_to}"
            )
            
            return {
                "approval_id": str(approval_id),
                "status": "delegated",
                "delegated_to": str(delegate_to),
                "delegated_by": str(user_id),
                "comments": comments,
                "message": "Approval successfully delegated"
            }
            
        except Exception as e:
            logger.error(f"Error delegating approval: {e}")
            raise RuntimeError(f"Failed to delegate approval: {str(e)}")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error delegating approval: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delegate approval: {str(e)}"
        )


@router.post("/approvals/{approval_id}/escalate")
async def escalate_approval(
    approval_id: UUID,
    escalate_to: Optional[List[UUID]] = Query(None, description="Optional list of user IDs to escalate to"),
    comments: Optional[str] = Query(None, max_length=2000, description="Optional comments about the escalation"),
    current_user = Depends(require_permission(Permission.workflow_manage))
):
    """
    Escalate an approval to higher authority.
    
    Allows authorized users to escalate an approval when the designated approver
    is unavailable or when the approval requires higher-level review. If escalation
    approvers are not specified, the system will use the escalation configuration
    from the workflow step definition.
    
    Args:
        approval_id: Approval ID
        escalate_to: Optional list of user IDs to escalate to (uses workflow config if not provided)
        comments: Optional comments about the escalation
        current_user: Authenticated user with workflow_manage permission
        
    Returns:
        Escalation result with updated approval information
        
    Raises:
        HTTPException 400: Invalid escalation or approval already decided
        HTTPException 401: Unauthorized (no valid JWT)
        HTTPException 403: Insufficient permissions
        HTTPException 404: Approval not found
        HTTPException 503: Database service unavailable
        
    Requirements: 3.3, 3.5
    """
    try:
        if not supabase:
            raise HTTPException(
                status_code=503,
                detail="Database service unavailable"
            )
        
        # Get user ID from current_user
        user_id = current_user.get("user_id")
        if not user_id:
            raise HTTPException(
                status_code=400,
                detail="User ID not found in user context"
            )
        
        # Get workflow engine
        engine = get_workflow_engine()
        
        # Get approval record
        approval_data = await engine.repository.get_approval_by_id(approval_id)
        if not approval_data:
            raise HTTPException(
                status_code=404,
                detail=f"Approval {approval_id} not found"
            )
        
        # Check if already decided
        if approval_data["status"] != ApprovalStatus.PENDING.value:
            raise HTTPException(
                status_code=400,
                detail=f"Approval already {approval_data['status']}"
            )
        
        # Get workflow instance and step definition
        instance_id = UUID(approval_data["workflow_instance_id"])
        step_number = approval_data["step_number"]
        
        instance_data = await engine.repository.get_workflow_instance(instance_id)
        if not instance_data:
            raise HTTPException(
                status_code=404,
                detail="Workflow instance not found"
            )
        
        # Get workflow definition for this instance
        workflow_data = await engine.repository.get_workflow_for_instance(instance_id)
        if not workflow_data:
            raise HTTPException(
                status_code=404,
                detail="Workflow definition not found"
            )
        
        # Get step definition
        template_data = workflow_data.get("template_data", {})
        steps_data = template_data.get("steps", [])
        
        if step_number >= len(steps_data):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid step number: {step_number}"
            )
        
        step_def = WorkflowStep(**steps_data[step_number])
        
        # Determine escalation approvers
        escalation_approvers = escalate_to if escalate_to else []
        
        if not escalation_approvers:
            # Use escalation approvers from step definition
            escalation_approvers = await engine._resolve_escalation_approvers(
                step_def, workflow_data
            )
        
        if not escalation_approvers:
            raise HTTPException(
                status_code=400,
                detail="No escalation approvers available. Please specify escalate_to parameter."
            )
        
        # Mark current approval as expired
        await engine.repository.update_approval(
            approval_id,
            ApprovalStatus.EXPIRED.value,
            f"Escalated by {user_id}: {comments or 'No reason provided'}"
        )
        
        # Update instance context with escalation information
        context = instance_data.get("data", {})
        escalation_history = context.get("escalation_history", [])
        escalation_history.append({
            "escalated_from_step": step_number,
            "escalated_by": str(user_id),
            "escalated_at": datetime.utcnow().isoformat(),
            "comments": comments,
            "escalation_count": len(escalation_history) + 1,
            "original_approval_id": str(approval_id)
        })
        context["escalation_history"] = escalation_history
        context["is_escalated"] = True
        
        await engine.repository.update_workflow_instance(
            instance_id,
            {"data": context}
        )
        
        # Create new approval records for escalation approvers
        expires_at = None
        if step_def.timeout_hours:
            expires_at = datetime.utcnow() + timedelta(hours=step_def.timeout_hours)
        
        created_approvals = []
        for approver_id in escalation_approvers:
            approval = WorkflowApproval(
                workflow_instance_id=instance_id,
                step_number=step_number,
                step_name=f"{step_def.name} (Escalated)",
                approver_id=approver_id,
                status=ApprovalStatus.PENDING,
                expires_at=expires_at
            )
            
            created_approval = await engine.repository.create_approval(approval)
            created_approvals.append(str(created_approval["id"]))
        
        logger.info(
            f"Approval escalated: {approval_id} by user {user_id} "
            f"to {len(escalation_approvers)} escalation approvers"
        )
        
        return {
            "approval_id": str(approval_id),
            "status": "escalated",
            "escalated_by": str(user_id),
            "escalation_approvers": [str(a) for a in escalation_approvers],
            "new_approval_ids": created_approvals,
            "comments": comments,
            "message": f"Approval successfully escalated to {len(escalation_approvers)} approvers"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error escalating approval: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to escalate approval: {str(e)}"
        )


# ==================== Legacy Workflow Instance Endpoints ====================


@router.post("/approve-project", response_model=ApprovalResultResponse)
async def approve_project(
    workflow_id: UUID,
    entity_type: str,
    entity_id: UUID,
    decision: str,
    comments: str = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Create or update a workflow instance with approval decision.
    
    This endpoint handles the approval workflow for projects and other entities.
    It creates a new workflow instance if one doesn't exist, or submits an
    approval decision to an existing workflow.
    
    Args:
        workflow_id: ID of the workflow definition
        entity_type: Type of entity (e.g., "project", "change_request")
        entity_id: ID of the entity being approved
        decision: Approval decision ("approved" or "rejected")
        comments: Optional comments about the decision
        current_user: Authenticated user from JWT token
        
    Returns:
        ApprovalResultResponse with decision, workflow status, and completion info
        
    Raises:
        HTTPException 400: Invalid decision or workflow not found
        HTTPException 401: Unauthorized (no valid JWT)
        HTTPException 403: Forbidden (wrong organization)
        HTTPException 422: Validation error
        HTTPException 503: Workflow engine unavailable
        
    Requirements: 7.1, 7.4, 7.5
    """
    try:
        # Validate decision
        if decision not in ["approved", "rejected"]:
            raise HTTPException(
                status_code=422,
                detail={
                    "error": "validation_failed",
                    "fields": {
                        "decision": f"Invalid decision: {decision}. Must be 'approved' or 'rejected'"
                    }
                }
            )
        
        # Get user context
        user_id = current_user.get("user_id")
        organization_id = current_user.get("organization_id")
        
        if not organization_id:
            raise HTTPException(
                status_code=400,
                detail="Organization ID not found in user context"
            )
        
        if not user_id:
            raise HTTPException(
                status_code=400,
                detail="User ID not found in user context"
            )
        
        # Get workflow engine
        engine = get_workflow_engine()
        
        # Check if workflow instance already exists for this entity
        # This is a simplified implementation - in production you'd query for existing instances
        try:
            # Try to find existing workflow instance
            # For now, we'll create a new instance and submit approval
            instance_id = await engine.create_instance(
                workflow_id=str(workflow_id),
                entity_type=entity_type,
                entity_id=str(entity_id),
                organization_id=organization_id,
                initiator_id=user_id
            )
            
            # Submit approval decision
            result = await engine.submit_approval(
                instance_id=instance_id,
                decision=decision,
                comments=comments,
                approver_id=user_id,
                organization_id=organization_id
            )
            
            return ApprovalResultResponse(
                decision=result["decision"],
                workflow_status=result["workflow_status"],
                is_complete=result["is_complete"],
                current_step=result.get("current_step")
            )
            
        except ValueError as e:
            raise HTTPException(
                status_code=400,
                detail=str(e)
            )
        except RuntimeError as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to process approval: {str(e)}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in approve_project endpoint: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process approval: {str(e)}"
        )


# ==================== User Workflow Instances Endpoints ====================
# Must be declared before /instances/{id} so "my-workflows" is not matched as UUID.


@router.get("/instances/my-workflows")
async def get_my_workflow_instances():
    """
    Get workflow instances where the current user is involved.

    Returns workflows where the user is either the initiator or an approver.
    This endpoint supports the dashboard workflow display.

    Args:
        current_user: Authenticated user

    Returns:
        Dict containing list of workflow instances

    Requirements: 7.2, 7.4
    """
    # For now, return empty workflows list to avoid database queries
    # TODO: Implement proper workflow instance retrieval
    return {"workflows": []}


# ==================== Single Instance Endpoints ====================


@router.get("/instances/{id}", response_model=WorkflowInstanceResponse)
async def get_workflow_instance(
    id: UUID,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Retrieve workflow instance by ID.
    
    Returns the full workflow status including all steps and approvals,
    filtered by the user's organization.
    
    Args:
        id: Workflow instance ID
        current_user: Authenticated user from JWT token
        
    Returns:
        WorkflowInstanceResponse with full workflow details
        
    Raises:
        HTTPException 401: Unauthorized (no valid JWT)
        HTTPException 403: Forbidden (wrong organization)
        HTTPException 404: Workflow instance not found
        HTTPException 503: Workflow engine unavailable
        
    Requirements: 7.2, 7.4
    """
    try:
        # Get user context
        organization_id = current_user.get("organization_id")
        
        if not organization_id:
            raise HTTPException(
                status_code=400,
                detail="Organization ID not found in user context"
            )
        
        # Get workflow engine
        engine = get_workflow_engine()
        
        # Get workflow instance status
        try:
            status_data = await engine.get_instance_status(
                instance_id=str(id),
                organization_id=organization_id
            )
            
            return WorkflowInstanceResponse(**status_data)
            
        except ValueError as e:
            # Workflow not found or wrong organization
            raise HTTPException(
                status_code=404,
                detail=str(e)
            )
        except RuntimeError as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to retrieve workflow: {str(e)}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_workflow_instance endpoint: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve workflow instance: {str(e)}"
        )


@router.post("/instances/{id}/advance", response_model=AdvanceWorkflowResponse)
async def advance_workflow_instance(
    id: UUID,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Advance workflow to the next step.
    
    Moves the workflow to the next step if all conditions are met
    (all required approvals for current step are complete).
    Validates user permissions before advancing.
    
    Args:
        id: Workflow instance ID
        current_user: Authenticated user from JWT token
        
    Returns:
        AdvanceWorkflowResponse with updated workflow status
        
    Raises:
        HTTPException 400: Cannot advance (not all approvals complete)
        HTTPException 401: Unauthorized (no valid JWT)
        HTTPException 403: Forbidden (insufficient permissions)
        HTTPException 404: Workflow instance not found
        HTTPException 503: Workflow engine unavailable
        
    Requirements: 7.3, 7.4
    """
    try:
        # Get user context
        user_id = current_user.get("user_id")
        organization_id = current_user.get("organization_id")
        
        if not organization_id:
            raise HTTPException(
                status_code=400,
                detail="Organization ID not found in user context"
            )
        
        if not user_id:
            raise HTTPException(
                status_code=400,
                detail="User ID not found in user context"
            )
        
        # Get workflow engine
        engine = get_workflow_engine()
        
        # Advance workflow
        try:
            result = await engine.advance_workflow(
                instance_id=str(id),
                organization_id=organization_id,
                user_id=user_id
            )
            
            return AdvanceWorkflowResponse(
                status=result["status"],
                current_step=result["current_step"],
                next_steps=result.get("next_steps", [])
            )
            
        except ValueError as e:
            # Workflow not found, wrong organization, or cannot advance
            error_msg = str(e)
            if "not found" in error_msg.lower():
                raise HTTPException(status_code=404, detail=error_msg)
            elif "permission" in error_msg.lower():
                raise HTTPException(status_code=403, detail=error_msg)
            else:
                raise HTTPException(status_code=400, detail=error_msg)
        except RuntimeError as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to advance workflow: {str(e)}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in advance_workflow_instance endpoint: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to advance workflow: {str(e)}"
        )


# ==================== Workflow Template Endpoints ====================


@router.get("/templates", response_model=TemplateListResponse)
async def list_workflow_templates(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    List all available workflow templates.
    
    Returns a list of predefined workflow templates including budget approval,
    milestone approval, and resource allocation templates.
    
    Args:
        current_user: Authenticated user from JWT token
        
    Returns:
        TemplateListResponse with list of available templates
        
    Raises:
        HTTPException 401: Unauthorized (no valid JWT)
        HTTPException 500: Server error
        
    Requirements: 1.5
    """
    try:
        templates = workflow_template_system.list_templates()
        
        return TemplateListResponse(
            templates=templates,
            count=len(templates)
        )
        
    except Exception as e:
        logger.error(f"Error listing workflow templates: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list templates: {str(e)}"
        )


@router.get("/templates/{template_type}", response_model=TemplateMetadataResponse)
async def get_template_metadata(
    template_type: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get metadata for a specific workflow template.
    
    Returns detailed information about a template including its structure,
    customizable fields, and configuration options.
    
    Args:
        template_type: Type of template (budget_approval, milestone_approval, resource_allocation)
        current_user: Authenticated user from JWT token
        
    Returns:
        TemplateMetadataResponse with template details
        
    Raises:
        HTTPException 401: Unauthorized (no valid JWT)
        HTTPException 404: Template not found
        HTTPException 500: Server error
        
    Requirements: 1.5
    """
    try:
        metadata = workflow_template_system.get_template_metadata(template_type)
        
        if not metadata:
            raise HTTPException(
                status_code=404,
                detail=f"Template type '{template_type}' not found"
            )
        
        return TemplateMetadataResponse(**metadata)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting template metadata: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get template metadata: {str(e)}"
        )


@router.post("/templates/{template_type}/instantiate", response_model=InstantiateTemplateResponse)
async def instantiate_workflow_template(
    template_type: str,
    request: InstantiateTemplateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Instantiate a workflow from a template.
    
    Creates a new workflow definition from a predefined template with optional
    customizations. The workflow is created in DRAFT status and can be activated
    after review.
    
    Args:
        template_type: Type of template to instantiate
        request: Instantiation request with optional customizations
        current_user: Authenticated user from JWT token
        
    Returns:
        InstantiateTemplateResponse with created workflow definition
        
    Raises:
        HTTPException 400: Invalid customizations
        HTTPException 401: Unauthorized (no valid JWT)
        HTTPException 404: Template not found
        HTTPException 422: Validation error
        HTTPException 500: Server error
        
    Requirements: 1.5
    """
    try:
        # Get user ID
        user_id = current_user.get("user_id")
        if not user_id:
            raise HTTPException(
                status_code=400,
                detail="User ID not found in user context"
            )
        
        # Validate customizations if provided
        if request.customizations:
            is_valid, errors = workflow_template_system.validate_customizations(
                template_type,
                request.customizations
            )
            
            if not is_valid:
                raise HTTPException(
                    status_code=422,
                    detail={
                        "error": "validation_failed",
                        "fields": {"customizations": errors}
                    }
                )
        
        # Instantiate template
        try:
            workflow = workflow_template_system.instantiate_template(
                template_type=template_type,
                name=request.name,
                customizations=request.customizations,
                created_by=UUID(user_id)
            )
            
            # Convert to response format
            return InstantiateTemplateResponse(
                workflow_id=workflow.id,
                name=workflow.name,
                description=workflow.description,
                template_type=template_type,
                status=workflow.status.value,
                step_count=len(workflow.steps),
                trigger_count=len(workflow.triggers),
                metadata=workflow.metadata,
                created_by=workflow.created_by,
                created_at=workflow.created_at
            )
            
        except ValueError as e:
            raise HTTPException(
                status_code=404 if "not found" in str(e).lower() else 400,
                detail=str(e)
            )
        except RuntimeError as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to instantiate template: {str(e)}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error instantiating workflow template: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to instantiate template: {str(e)}"
        )


@router.post("/templates/{template_type}/customize", response_model=CustomizeTemplateResponse)
async def preview_template_customization(
    template_type: str,
    request: CustomizeTemplateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Preview template with customizations applied.
    
    Returns a preview of how the template will look with the specified
    customizations without actually creating a workflow. Useful for validating
    customizations before instantiation.
    
    Args:
        template_type: Type of template to customize
        request: Customization request
        current_user: Authenticated user from JWT token
        
    Returns:
        CustomizeTemplateResponse with customized template preview
        
    Raises:
        HTTPException 400: Invalid customizations
        HTTPException 401: Unauthorized (no valid JWT)
        HTTPException 404: Template not found
        HTTPException 422: Validation error
        HTTPException 500: Server error
        
    Requirements: 1.5
    """
    try:
        # Validate customizations
        is_valid, errors = workflow_template_system.validate_customizations(
            template_type,
            request.customizations
        )
        
        if not is_valid:
            raise HTTPException(
                status_code=422,
                detail={
                    "error": "validation_failed",
                    "fields": {"customizations": errors}
                }
            )
        
        # Apply customizations and get preview
        try:
            customized = workflow_template_system.customize_template(
                template_type=template_type,
                customizations=request.customizations
            )
            
            return CustomizeTemplateResponse(
                template_type=template_type,
                name=customized["name"],
                description=customized["description"],
                steps=customized["steps"],
                triggers=customized["triggers"],
                metadata=customized["metadata"],
                customizations_applied=request.customizations
            )
            
        except ValueError as e:
            raise HTTPException(
                status_code=404 if "not found" in str(e).lower() else 400,
                detail=str(e)
            )
        except RuntimeError as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to customize template: {str(e)}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error customizing workflow template: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to customize template: {str(e)}"
        )
