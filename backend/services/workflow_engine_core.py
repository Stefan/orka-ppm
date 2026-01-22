"""
Workflow Engine Core

Core workflow engine for managing workflow execution, state transitions,
and approval processing. This is the main orchestration layer that coordinates
workflow lifecycle management.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from uuid import UUID

from supabase import Client

from models.workflow import (
    WorkflowDefinition,
    WorkflowInstance,
    WorkflowApproval,
    WorkflowStep,
    WorkflowStatus,
    ApprovalStatus,
    ApprovalType,
    StepType,
    RejectionAction,
    PendingApproval
)
from services.workflow_repository import WorkflowRepository
from services.workflow_notification_service import WorkflowNotificationService

logger = logging.getLogger(__name__)


class WorkflowEngineCore:
    """
    Core workflow engine for managing workflow execution.
    
    Handles workflow instance creation, state management, approval processing,
    and workflow transitions. Integrates with the repository layer for
    database operations.
    """
    
    def __init__(self, db: Client):
        """
        Initialize workflow engine with database client.
        
        Args:
            db: Supabase client instance
        """
        if not db:
            raise ValueError("Database client is required")
        
        self.db = db
        self.repository = WorkflowRepository(db)
        self.notification_service = WorkflowNotificationService(db)
    
    # ==================== Workflow Instance Management ====================
    
    async def create_workflow_instance(
        self,
        workflow_id: UUID,
        entity_type: str,
        entity_id: UUID,
        initiated_by: UUID,
        context: Optional[Dict[str, Any]] = None,
        project_id: Optional[UUID] = None
    ) -> WorkflowInstance:
        """
        Create and initialize a new workflow instance.
        
        This method creates a workflow instance using the current version of
        the workflow definition and stores the version number with the instance.
        This ensures the instance will always use the same workflow definition
        even if the workflow is updated later.
        
        Args:
            workflow_id: ID of the workflow definition
            entity_type: Type of entity (e.g., "financial_tracking", "project")
            entity_id: ID of the entity
            initiated_by: User ID who initiated the workflow
            context: Optional context data for the workflow
            project_id: Optional associated project ID
            
        Returns:
            Created WorkflowInstance
            
        Raises:
            ValueError: If workflow not found or invalid
            RuntimeError: If instance creation fails
        """
        try:
            # Get workflow definition
            workflow_data = await self.repository.get_workflow(workflow_id)
            if not workflow_data:
                raise ValueError(f"Workflow {workflow_id} not found")
            
            # Validate workflow is active
            if workflow_data.get("status") != WorkflowStatus.ACTIVE.value:
                raise ValueError(f"Workflow {workflow_id} is not active")
            
            # Extract workflow steps and version
            template_data = workflow_data.get("template_data", {})
            steps_data = template_data.get("steps", [])
            workflow_version = template_data.get("version", 1)
            
            if not steps_data:
                raise ValueError("Workflow has no steps defined")
            
            # Create workflow instance
            instance = WorkflowInstance(
                workflow_id=workflow_id,
                workflow_name=workflow_data.get("name"),
                entity_type=entity_type,
                entity_id=entity_id,
                project_id=project_id,
                current_step=0,
                status=WorkflowStatus.PENDING,
                context=context or {},
                initiated_by=initiated_by
            )
            
            # Save instance to database with version tracking
            instance_data = await self.repository.create_workflow_instance_with_version(
                instance,
                workflow_version
            )
            instance.id = UUID(instance_data["id"])
            instance.created_at = datetime.fromisoformat(instance_data["created_at"])
            instance.updated_at = datetime.fromisoformat(instance_data["updated_at"])
            
            # Store version in instance context
            instance.context["workflow_version"] = workflow_version
            
            # Create approval records for first step
            first_step = WorkflowStep(**steps_data[0])
            await self._create_approvals_for_step(
                instance.id,
                first_step,
                workflow_data
            )
            
            # Update instance status to in_progress
            await self.repository.update_workflow_instance(
                instance.id,
                {"status": WorkflowStatus.IN_PROGRESS.value}
            )
            instance.status = WorkflowStatus.IN_PROGRESS
            
            logger.info(
                f"Created workflow instance {instance.id} for workflow {workflow_id} "
                f"version {workflow_version}"
            )
            
            return instance
            
        except ValueError as e:
            logger.error(f"Validation error creating workflow instance: {e}")
            raise
        except Exception as e:
            logger.error(f"Error creating workflow instance: {e}")
            raise RuntimeError(f"Failed to create workflow instance: {str(e)}")
    
    async def get_workflow_instance_status(
        self,
        instance_id: UUID
    ) -> Dict[str, Any]:
        """
        Get detailed status of a workflow instance.
        
        Args:
            instance_id: Workflow instance ID
            
        Returns:
            Dict containing instance status and approval details
            
        Raises:
            ValueError: If instance not found
        """
        try:
            # Get instance data
            instance_data = await self.repository.get_workflow_instance(instance_id)
            if not instance_data:
                raise ValueError(f"Workflow instance {instance_id} not found")
            
            # Get workflow definition
            workflow_data = await self.repository.get_workflow(
                UUID(instance_data["workflow_id"])
            )
            
            # Get all approvals
            approvals = await self.repository.get_approvals_for_instance(instance_id)
            
            # Group approvals by step
            approvals_by_step = {}
            for approval in approvals:
                step_num = approval["step_number"]
                if step_num not in approvals_by_step:
                    approvals_by_step[step_num] = []
                
                approvals_by_step[step_num].append({
                    "id": approval["id"],
                    "approver_id": approval["approver_id"],
                    "status": approval["status"],
                    "comments": approval["comments"],
                    "approved_at": approval.get("approved_at"),
                    "expires_at": approval.get("expires_at")
                })
            
            return {
                "id": instance_data["id"],
                "workflow_id": instance_data["workflow_id"],
                "workflow_name": workflow_data.get("name") if workflow_data else "Unknown",
                "entity_type": instance_data["entity_type"],
                "entity_id": instance_data["entity_id"],
                "project_id": instance_data.get("project_id"),
                "current_step": instance_data["current_step"],
                "status": instance_data["status"],
                "context": instance_data.get("data", {}),
                "initiated_by": instance_data["started_by"],
                "initiated_at": instance_data["started_at"],
                "completed_at": instance_data.get("completed_at"),
                "cancelled_at": instance_data.get("cancelled_at"),
                "approvals": approvals_by_step,
                "created_at": instance_data["created_at"],
                "updated_at": instance_data["updated_at"]
            }
            
        except ValueError as e:
            logger.error(f"Validation error getting instance status: {e}")
            raise
        except Exception as e:
            logger.error(f"Error getting instance status: {e}")
            raise RuntimeError(f"Failed to get instance status: {str(e)}")
    
    # ==================== Approval Processing ====================
    
    async def submit_approval_decision(
        self,
        approval_id: UUID,
        approver_id: UUID,
        decision: str,
        comments: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Submit an approval decision.
        
        Args:
            approval_id: Approval ID
            approver_id: User ID of the approver
            decision: Decision ("approved" or "rejected")
            comments: Optional comments
            
        Returns:
            Dict containing approval result and workflow status
            
        Raises:
            ValueError: If approval not found or invalid decision
            RuntimeError: If submission fails
        """
        try:
            # Validate decision
            if decision not in [ApprovalStatus.APPROVED.value, ApprovalStatus.REJECTED.value]:
                raise ValueError(f"Invalid decision: {decision}")
            
            # Get approval record
            approval_data = await self.repository.get_approval_by_id(approval_id)
            if not approval_data:
                raise ValueError(f"Approval {approval_id} not found")
            
            # Verify approver
            if str(approval_data["approver_id"]) != str(approver_id):
                raise ValueError("User is not the designated approver")
            
            # Check if already decided
            if approval_data["status"] != ApprovalStatus.PENDING.value:
                raise ValueError(f"Approval already {approval_data['status']}")
            
            # Update approval
            updated_approval = await self.repository.update_approval(
                approval_id,
                decision,
                comments
            )
            
            if not updated_approval:
                raise RuntimeError("Failed to update approval")
            
            # Get workflow instance
            instance_id = UUID(approval_data["workflow_instance_id"])
            instance_data = await self.repository.get_workflow_instance(instance_id)
            
            if not instance_data:
                raise ValueError("Workflow instance not found")
            
            # Get workflow data for notification
            workflow_data = await self.repository.get_workflow(
                UUID(instance_data["workflow_id"])
            )
            
            # Send approval decision notification to workflow initiator
            try:
                await self.notification_service.notify_approval_decision(
                    approval_id=approval_id,
                    workflow_instance_id=instance_id,
                    workflow_name=workflow_data.get("name", "Unknown Workflow") if workflow_data else "Unknown Workflow",
                    approver_id=approver_id,
                    decision=ApprovalStatus(decision),
                    initiated_by=UUID(instance_data["started_by"]),
                    comments=comments
                )
            except Exception as e:
                logger.error(f"Error sending approval decision notification: {e}")
            
            # Handle rejection
            if decision == ApprovalStatus.REJECTED.value:
                await self._handle_workflow_rejection(
                    instance_id,
                    approval_data["step_number"],
                    approver_id,
                    comments
                )
                
                return {
                    "decision": decision,
                    "workflow_status": WorkflowStatus.REJECTED.value,
                    "is_complete": True,
                    "current_step": instance_data["current_step"]
                }
            
            # For approved decision, check if step is complete
            step_complete = await self._check_step_completion(
                instance_id,
                approval_data["step_number"]
            )
            
            if step_complete:
                # Try to advance workflow
                advance_result = await self._advance_workflow_step(
                    instance_id,
                    approver_id
                )
                
                return {
                    "decision": decision,
                    "workflow_status": advance_result["status"],
                    "is_complete": advance_result["status"] == WorkflowStatus.COMPLETED.value,
                    "current_step": advance_result["current_step"]
                }
            else:
                # Waiting for other approvals
                return {
                    "decision": decision,
                    "workflow_status": WorkflowStatus.IN_PROGRESS.value,
                    "is_complete": False,
                    "current_step": instance_data["current_step"],
                    "message": "Waiting for additional approvals"
                }
            
        except ValueError as e:
            logger.error(f"Validation error submitting approval: {e}")
            raise
        except Exception as e:
            logger.error(f"Error submitting approval: {e}")
            raise RuntimeError(f"Failed to submit approval: {str(e)}")
    
    async def get_pending_approvals(
        self,
        user_id: UUID,
        limit: int = 100,
        offset: int = 0
    ) -> List[PendingApproval]:
        """
        Get pending approvals for a user.
        
        Args:
            user_id: User ID
            limit: Maximum number of results
            offset: Offset for pagination
            
        Returns:
            List of PendingApproval objects
        """
        try:
            approvals_data = await self.repository.get_pending_approvals_for_user(
                user_id,
                limit,
                offset
            )
            
            pending_approvals = []
            for approval_data in approvals_data:
                instance_data = approval_data.get("workflow_instances", {})
                workflow_data = approval_data.get("workflows", {})
                
                pending_approval = PendingApproval(
                    approval_id=UUID(approval_data["id"]),
                    workflow_instance_id=UUID(approval_data["workflow_instance_id"]),
                    workflow_name=workflow_data.get("name", "Unknown"),
                    entity_type=instance_data.get("entity_type", ""),
                    entity_id=UUID(instance_data.get("entity_id", "00000000-0000-0000-0000-000000000000")),
                    step_number=approval_data["step_number"],
                    step_name=f"Step {approval_data['step_number']}",
                    initiated_by=UUID(instance_data.get("started_by", "00000000-0000-0000-0000-000000000000")),
                    initiated_at=datetime.fromisoformat(instance_data.get("started_at", datetime.utcnow().isoformat())),
                    expires_at=datetime.fromisoformat(approval_data["expires_at"]) if approval_data.get("expires_at") else None,
                    context=instance_data.get("data", {})
                )
                
                pending_approvals.append(pending_approval)
            
            return pending_approvals
            
        except Exception as e:
            logger.error(f"Error getting pending approvals: {e}")
            return []
    
    # ==================== State Management ====================
    
    async def _advance_workflow_step(
        self,
        instance_id: UUID,
        user_id: UUID
    ) -> Dict[str, Any]:
        """
        Advance workflow to the next step.
        
        This method uses the workflow version stored with the instance to
        ensure consistent behavior even if the workflow definition has been
        updated since the instance was created.
        
        Args:
            instance_id: Workflow instance ID
            user_id: User ID performing the advancement
            
        Returns:
            Dict containing new workflow status
        """
        try:
            # Get instance and workflow
            instance_data = await self.repository.get_workflow_instance(instance_id)
            if not instance_data:
                raise ValueError("Workflow instance not found")
            
            # Get the workflow definition for this instance (correct version)
            workflow_data = await self.repository.get_workflow_for_instance(instance_id)
            if not workflow_data:
                raise ValueError("Workflow definition not found")
            
            # Get workflow steps
            template_data = workflow_data.get("template_data", {})
            steps_data = template_data.get("steps", [])
            
            current_step = instance_data["current_step"]
            next_step = current_step + 1
            
            # Check if workflow is complete
            if next_step >= len(steps_data):
                # Mark workflow as completed
                await self.repository.update_workflow_instance(
                    instance_id,
                    {
                        "status": WorkflowStatus.COMPLETED.value,
                        "completed_at": datetime.utcnow().isoformat()
                    }
                )
                
                # Send workflow completion notification
                try:
                    workflow_name = workflow_data.get("name", "Unknown Workflow")
                    initiated_by = UUID(instance_data["started_by"])
                    
                    # Get stakeholders (initiator and any observers)
                    stakeholders = [initiated_by]
                    
                    await self.notification_service.notify_workflow_status_change(
                        workflow_instance_id=instance_id,
                        workflow_name=workflow_name,
                        old_status=WorkflowStatus.IN_PROGRESS,
                        new_status=WorkflowStatus.COMPLETED,
                        initiated_by=initiated_by,
                        stakeholders=stakeholders,
                        context=instance_data.get("data", {})
                    )
                except Exception as e:
                    logger.error(f"Error sending workflow completion notification: {e}")
                
                logger.info(f"Workflow instance {instance_id} completed")
                
                return {
                    "status": WorkflowStatus.COMPLETED.value,
                    "current_step": current_step,
                    "is_complete": True
                }
            
            # Move to next step
            await self.repository.update_workflow_instance(
                instance_id,
                {"current_step": next_step}
            )
            
            # Create approvals for next step
            next_step_def = WorkflowStep(**steps_data[next_step])
            await self._create_approvals_for_step(
                instance_id,
                next_step_def,
                workflow_data
            )
            
            logger.info(
                f"Advanced workflow instance {instance_id} from step {current_step} to {next_step}"
            )
            
            return {
                "status": WorkflowStatus.IN_PROGRESS.value,
                "current_step": next_step,
                "is_complete": False
            }
            
        except Exception as e:
            logger.error(f"Error advancing workflow step: {e}")
            raise RuntimeError(f"Failed to advance workflow: {str(e)}")
    
    async def _handle_workflow_rejection(
        self,
        instance_id: UUID,
        step_number: int,
        rejected_by: UUID,
        comments: Optional[str]
    ) -> None:
        """
        Handle workflow rejection with configurable actions.
        
        Supports three rejection actions:
        - STOP: Mark workflow as rejected and halt (default)
        - RESTART: Reset workflow to beginning and create new approvals
        - ESCALATE: Create escalation approvals for higher authority
        
        Args:
            instance_id: Workflow instance ID
            step_number: Step number where rejection occurred
            rejected_by: User ID who rejected
            comments: Rejection comments
            
        Raises:
            RuntimeError: If rejection handling fails
        """
        try:
            # Get workflow definition for this instance
            workflow_data = await self.repository.get_workflow_for_instance(instance_id)
            if not workflow_data:
                raise ValueError("Workflow definition not found")
            
            # Get the step definition
            template_data = workflow_data.get("template_data", {})
            steps_data = template_data.get("steps", [])
            
            if step_number >= len(steps_data):
                raise ValueError(f"Invalid step number: {step_number}")
            
            step_def = WorkflowStep(**steps_data[step_number])
            rejection_action = step_def.rejection_action
            
            logger.info(
                f"Handling workflow rejection for instance {instance_id} "
                f"at step {step_number} with action: {rejection_action.value}"
            )
            
            # Handle based on rejection action
            if rejection_action == RejectionAction.STOP:
                await self._handle_rejection_stop(
                    instance_id, step_number, rejected_by, comments
                )
            elif rejection_action == RejectionAction.RESTART:
                await self._handle_rejection_restart(
                    instance_id, step_number, rejected_by, comments, workflow_data
                )
            elif rejection_action == RejectionAction.ESCALATE:
                await self._handle_rejection_escalate(
                    instance_id, step_number, rejected_by, comments, step_def, workflow_data
                )
            else:
                # Default to stop if unknown action
                logger.warning(
                    f"Unknown rejection action: {rejection_action}, defaulting to STOP"
                )
                await self._handle_rejection_stop(
                    instance_id, step_number, rejected_by, comments
                )
            
        except Exception as e:
            logger.error(f"Error handling workflow rejection: {e}")
            raise RuntimeError(f"Failed to handle workflow rejection: {str(e)}")
    
    async def _handle_rejection_stop(
        self,
        instance_id: UUID,
        step_number: int,
        rejected_by: UUID,
        comments: Optional[str]
    ) -> None:
        """
        Handle rejection by stopping the workflow.
        
        Args:
            instance_id: Workflow instance ID
            step_number: Step number where rejection occurred
            rejected_by: User ID who rejected
            comments: Rejection comments
        """
        try:
            # Get instance data for notification
            instance_data = await self.repository.get_workflow_instance(instance_id)
            
            await self.repository.update_workflow_instance(
                instance_id,
                {
                    "status": WorkflowStatus.REJECTED.value,
                    "cancelled_at": datetime.utcnow().isoformat(),
                    "cancellation_reason": f"Rejected at step {step_number} by user {rejected_by}: {comments or 'No reason provided'}"
                }
            )
            
            # Send workflow rejection notification
            if instance_data:
                try:
                    workflow_data = await self.repository.get_workflow(
                        UUID(instance_data["workflow_id"])
                    )
                    workflow_name = workflow_data.get("name", "Unknown Workflow") if workflow_data else "Unknown Workflow"
                    initiated_by = UUID(instance_data["started_by"])
                    
                    # Get stakeholders (initiator and any observers)
                    stakeholders = [initiated_by]
                    if rejected_by != initiated_by:
                        stakeholders.append(rejected_by)
                    
                    await self.notification_service.notify_workflow_status_change(
                        workflow_instance_id=instance_id,
                        workflow_name=workflow_name,
                        old_status=WorkflowStatus.IN_PROGRESS,
                        new_status=WorkflowStatus.REJECTED,
                        initiated_by=initiated_by,
                        stakeholders=stakeholders,
                        context={
                            "rejected_at_step": step_number,
                            "rejected_by": str(rejected_by),
                            "comments": comments
                        }
                    )
                except Exception as e:
                    logger.error(f"Error sending workflow rejection notification: {e}")
            
            logger.info(
                f"Workflow instance {instance_id} stopped due to rejection at step {step_number}"
            )
            
        except Exception as e:
            logger.error(f"Error stopping workflow: {e}")
            raise
    
    async def _handle_rejection_restart(
        self,
        instance_id: UUID,
        step_number: int,
        rejected_by: UUID,
        comments: Optional[str],
        workflow_data: Dict[str, Any]
    ) -> None:
        """
        Handle rejection by restarting the workflow from the beginning.
        
        Args:
            instance_id: Workflow instance ID
            step_number: Step number where rejection occurred
            rejected_by: User ID who rejected
            comments: Rejection comments
            workflow_data: Workflow definition data
        """
        try:
            # Get instance data to preserve context
            instance_data = await self.repository.get_workflow_instance(instance_id)
            if not instance_data:
                raise ValueError("Workflow instance not found")
            
            # Update context with restart information
            context = instance_data.get("data", {})
            restart_history = context.get("restart_history", [])
            restart_history.append({
                "rejected_at_step": step_number,
                "rejected_by": str(rejected_by),
                "rejected_at": datetime.utcnow().isoformat(),
                "comments": comments,
                "restart_count": len(restart_history) + 1
            })
            context["restart_history"] = restart_history
            
            # Cancel all pending approvals for this instance
            approvals = await self.repository.get_approvals_for_instance(instance_id)
            for approval in approvals:
                if approval["status"] == ApprovalStatus.PENDING.value:
                    await self.repository.update_approval(
                        UUID(approval["id"]),
                        ApprovalStatus.EXPIRED.value,
                        "Cancelled due to workflow restart"
                    )
            
            # Reset workflow to step 0
            await self.repository.update_workflow_instance(
                instance_id,
                {
                    "current_step": 0,
                    "status": WorkflowStatus.IN_PROGRESS.value,
                    "data": context,
                    "cancelled_at": None,
                    "cancellation_reason": None
                }
            )
            
            # Create new approvals for first step
            template_data = workflow_data.get("template_data", {})
            steps_data = template_data.get("steps", [])
            first_step = WorkflowStep(**steps_data[0])
            
            await self._create_approvals_for_step(
                instance_id,
                first_step,
                workflow_data
            )
            
            logger.info(
                f"Workflow instance {instance_id} restarted from beginning "
                f"after rejection at step {step_number} (restart #{len(restart_history)})"
            )
            
        except Exception as e:
            logger.error(f"Error restarting workflow: {e}")
            raise
    
    async def _handle_rejection_escalate(
        self,
        instance_id: UUID,
        step_number: int,
        rejected_by: UUID,
        comments: Optional[str],
        step_def: WorkflowStep,
        workflow_data: Dict[str, Any]
    ) -> None:
        """
        Handle rejection by escalating to higher authority.
        
        Args:
            instance_id: Workflow instance ID
            step_number: Step number where rejection occurred
            rejected_by: User ID who rejected
            comments: Rejection comments
            step_def: Step definition with escalation configuration
            workflow_data: Workflow definition data
        """
        try:
            # Get instance data to update context
            instance_data = await self.repository.get_workflow_instance(instance_id)
            if not instance_data:
                raise ValueError("Workflow instance not found")
            
            # Update context with escalation information
            context = instance_data.get("data", {})
            escalation_history = context.get("escalation_history", [])
            escalation_history.append({
                "escalated_from_step": step_number,
                "rejected_by": str(rejected_by),
                "escalated_at": datetime.utcnow().isoformat(),
                "comments": comments,
                "escalation_count": len(escalation_history) + 1
            })
            context["escalation_history"] = escalation_history
            context["is_escalated"] = True
            
            # Cancel existing pending approvals for current step
            approvals = await self.repository.get_approvals_for_instance(
                instance_id, step_number
            )
            for approval in approvals:
                if approval["status"] == ApprovalStatus.PENDING.value:
                    await self.repository.update_approval(
                        UUID(approval["id"]),
                        ApprovalStatus.EXPIRED.value,
                        "Cancelled due to escalation"
                    )
            
            # Update instance status
            await self.repository.update_workflow_instance(
                instance_id,
                {
                    "status": WorkflowStatus.IN_PROGRESS.value,
                    "data": context
                }
            )
            
            # Resolve escalation approvers
            escalation_approvers = await self._resolve_escalation_approvers(
                step_def, workflow_data
            )
            
            if not escalation_approvers:
                logger.error(
                    f"No escalation approvers found for step {step_number}, "
                    f"falling back to STOP action"
                )
                await self._handle_rejection_stop(
                    instance_id, step_number, rejected_by, comments
                )
                return
            
            # Create escalation approvals
            expires_at = None
            if step_def.timeout_hours:
                expires_at = datetime.utcnow() + timedelta(hours=step_def.timeout_hours)
            
            for approver_id in escalation_approvers:
                approval = WorkflowApproval(
                    workflow_instance_id=instance_id,
                    step_number=step_number,
                    step_name=f"{step_def.name} (Escalated)",
                    approver_id=approver_id,
                    status=ApprovalStatus.PENDING,
                    expires_at=expires_at
                )
                
                await self.repository.create_approval(approval)
            
            logger.info(
                f"Workflow instance {instance_id} escalated at step {step_number} "
                f"to {len(escalation_approvers)} escalation approvers "
                f"(escalation #{len(escalation_history)})"
            )
            
        except Exception as e:
            logger.error(f"Error escalating workflow: {e}")
            raise
    
    async def _resolve_escalation_approvers(
        self,
        step: WorkflowStep,
        workflow_data: Dict[str, Any]
    ) -> List[UUID]:
        """
        Resolve escalation approver user IDs from step definition.
        
        Args:
            step: Workflow step definition with escalation configuration
            workflow_data: Workflow definition data
            
        Returns:
            List of escalation approver user IDs
        """
        approvers = []
        
        # Add explicit escalation approvers
        if step.escalation_approvers:
            approvers.extend(step.escalation_approvers)
        
        # TODO: Resolve escalation approvers from roles
        # This would integrate with the RBAC system to find users with specific roles
        if step.escalation_roles:
            logger.warning(
                f"Role-based escalation approver resolution not yet implemented "
                f"for roles: {step.escalation_roles}"
            )
        
        return approvers
    
    async def _check_step_completion(
        self,
        instance_id: UUID,
        step_number: int
    ) -> bool:
        """
        Check if a workflow step is complete.
        
        This method uses the workflow version stored with the instance to
        ensure correct approval logic even if the workflow has been updated.
        
        Args:
            instance_id: Workflow instance ID
            step_number: Step number to check
            
        Returns:
            True if step is complete, False otherwise
        """
        try:
            # Get all approvals for the step
            approvals = await self.repository.get_approvals_for_instance(
                instance_id,
                step_number
            )
            
            if not approvals:
                return False
            
            # Get workflow definition for this instance (correct version)
            workflow_data = await self.repository.get_workflow_for_instance(instance_id)
            if not workflow_data:
                return False
            
            template_data = workflow_data.get("template_data", {})
            steps_data = template_data.get("steps", [])
            
            if step_number >= len(steps_data):
                return False
            
            step_def = WorkflowStep(**steps_data[step_number])
            
            # Count approved approvals
            approved_count = sum(
                1 for a in approvals
                if a["status"] == ApprovalStatus.APPROVED.value
            )
            
            total_count = len(approvals)
            
            # Check based on approval type
            if step_def.approval_type == ApprovalType.ANY:
                return approved_count >= 1
            elif step_def.approval_type == ApprovalType.ALL:
                return approved_count == total_count
            elif step_def.approval_type == ApprovalType.MAJORITY:
                return approved_count > (total_count / 2)
            elif step_def.approval_type == ApprovalType.QUORUM:
                quorum = step_def.quorum_count or 1
                return approved_count >= quorum
            
            return False
            
        except Exception as e:
            logger.error(f"Error checking step completion: {e}")
            return False
    
    async def _create_approvals_for_step(
        self,
        instance_id: UUID,
        step: WorkflowStep,
        workflow_data: Dict[str, Any]
    ) -> None:
        """
        Create approval records for a workflow step.
        
        Args:
            instance_id: Workflow instance ID
            step: Workflow step definition
            workflow_data: Workflow definition data
        """
        try:
            # Determine approvers
            approvers = await self._resolve_approvers(step, workflow_data)
            
            if not approvers:
                logger.warning(
                    f"No approvers found for step {step.step_order} in workflow {workflow_data['id']}"
                )
                return
            
            # Calculate expiration if timeout is set
            expires_at = None
            if step.timeout_hours:
                expires_at = datetime.utcnow() + timedelta(hours=step.timeout_hours)
            
            # Get instance data for notifications
            instance_data = await self.repository.get_workflow_instance(instance_id)
            
            # Create approval record for each approver
            for approver_id in approvers:
                approval = WorkflowApproval(
                    workflow_instance_id=instance_id,
                    step_number=step.step_order,
                    step_name=step.name,
                    approver_id=approver_id,
                    status=ApprovalStatus.PENDING,
                    expires_at=expires_at
                )
                
                approval_data = await self.repository.create_approval(approval)
                
                # Send approval request notification
                if approval_data and instance_data:
                    try:
                        await self.notification_service.notify_approval_requested(
                            approval_id=UUID(approval_data["id"]),
                            workflow_instance_id=instance_id,
                            approver_id=approver_id,
                            workflow_name=workflow_data.get("name", "Unknown Workflow"),
                            entity_type=instance_data.get("entity_type", ""),
                            entity_id=UUID(instance_data.get("entity_id")),
                            initiated_by=UUID(instance_data.get("started_by")),
                            context=instance_data.get("data", {})
                        )
                    except Exception as e:
                        logger.error(f"Error sending approval request notification: {e}")
            
            logger.info(
                f"Created {len(approvers)} approval records for step {step.step_order}"
            )
            
        except Exception as e:
            logger.error(f"Error creating approvals for step: {e}")
            raise
    
    async def _resolve_approvers(
        self,
        step: WorkflowStep,
        workflow_data: Dict[str, Any]
    ) -> List[UUID]:
        """
        Resolve approver user IDs from step definition.
        
        Args:
            step: Workflow step definition
            workflow_data: Workflow definition data
            
        Returns:
            List of approver user IDs
        """
        approvers = []
        
        # Add explicit approvers
        if step.approvers:
            approvers.extend(step.approvers)
        
        # TODO: Resolve approvers from roles
        # This would integrate with the RBAC system to find users with specific roles
        if step.approver_roles:
            logger.warning(
                f"Role-based approver resolution not yet implemented for roles: {step.approver_roles}"
            )
        
        return approvers
