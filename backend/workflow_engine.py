"""
Workflow Engine

Manages workflow instances and approval processes for the AI-Empowered PPM Features.
This is a simplified workflow engine that works with the existing workflow tables.
"""

import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
from uuid import UUID

from config.database import supabase

logger = logging.getLogger(__name__)


class WorkflowEngine:
    """
    Workflow Engine for managing approval workflows.
    
    Handles workflow instance creation, state management, approval processing,
    and Supabase Realtime notifications.
    """
    
    def __init__(self):
        """Initialize the workflow engine with database connection."""
        self.db = supabase
        if not self.db:
            raise RuntimeError("Database connection not available")
    
    async def create_instance(
        self,
        workflow_id: str,
        entity_type: str,
        entity_id: str,
        organization_id: str,
        initiator_id: str
    ) -> str:
        """
        Create a new workflow instance.
        
        Args:
            workflow_id: ID of the workflow definition
            entity_type: Type of entity (e.g., "project", "change_request")
            entity_id: ID of the entity
            organization_id: Organization ID for filtering
            initiator_id: ID of the user initiating the workflow
            
        Returns:
            str: ID of the created workflow instance
            
        Raises:
            ValueError: If workflow not found or invalid parameters
            RuntimeError: If instance creation fails
        """
        try:
            # Get workflow definition
            workflow_result = self.db.table("workflows").select("*").eq(
                "id", workflow_id
            ).execute()
            
            if not workflow_result.data:
                raise ValueError(f"Workflow {workflow_id} not found")
            
            workflow_data = workflow_result.data[0]
            template_data = workflow_data.get("template_data", {})
            steps = template_data.get("steps", [])
            
            if not steps:
                raise ValueError("Workflow has no steps defined")
            
            # Create workflow instance
            instance_data = {
                "workflow_id": workflow_id,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "current_step": 0,
                "status": "pending",
                "data": {
                    "organization_id": organization_id,
                    "initiator_id": initiator_id,
                    "initiated_at": datetime.utcnow().isoformat()
                },
                "started_by": initiator_id,
                "started_at": datetime.utcnow().isoformat(),
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            instance_result = self.db.table("workflow_instances").insert(
                instance_data
            ).execute()
            
            if not instance_result.data:
                raise RuntimeError("Failed to create workflow instance")
            
            instance_id = instance_result.data[0]["id"]
            
            # Create approval records for first step
            await self._create_approval_records(instance_id, steps[0], organization_id)
            
            # Log workflow creation
            await self._log_audit_event(
                organization_id=organization_id,
                user_id=initiator_id,
                action="workflow_created",
                entity_type="workflow_instance",
                entity_id=instance_id,
                details={
                    "workflow_id": workflow_id,
                    "entity_type": entity_type,
                    "entity_id": entity_id
                }
            )
            
            # Send notifications to approvers
            await self._notify_approvers(instance_id, steps[0], organization_id)
            
            return instance_id
            
        except ValueError as e:
            logger.error(f"Validation error creating workflow instance: {e}")
            raise
        except Exception as e:
            logger.error(f"Error creating workflow instance: {e}")
            raise RuntimeError(f"Failed to create workflow instance: {str(e)}")
    
    async def advance_workflow(
        self,
        instance_id: str,
        organization_id: str,
        user_id: str
    ) -> Dict[str, Any]:
        """
        Advance workflow to the next step.
        
        Args:
            instance_id: ID of the workflow instance
            organization_id: Organization ID for filtering
            user_id: ID of the user advancing the workflow
            
        Returns:
            Dict containing workflow status and next steps
            
        Raises:
            ValueError: If instance not found or cannot advance
            RuntimeError: If advancement fails
        """
        try:
            # Get workflow instance
            instance_result = self.db.table("workflow_instances").select("*").eq(
                "id", instance_id
            ).execute()
            
            if not instance_result.data:
                raise ValueError(f"Workflow instance {instance_id} not found")
            
            instance = instance_result.data[0]
            
            # Verify organization
            instance_org_id = instance.get("data", {}).get("organization_id")
            if instance_org_id != organization_id:
                raise ValueError("Workflow instance not found in organization")
            
            # Check if workflow is already completed or rejected
            if instance["status"] in ["completed", "rejected"]:
                raise ValueError(f"Workflow is already {instance['status']}")
            
            # Get workflow definition
            workflow_result = self.db.table("workflows").select("*").eq(
                "id", instance["workflow_id"]
            ).execute()
            
            if not workflow_result.data:
                raise ValueError("Workflow definition not found")
            
            workflow_data = workflow_result.data[0]
            template_data = workflow_data.get("template_data", {})
            steps = template_data.get("steps", [])
            
            current_step = instance["current_step"]
            
            # Check if current step approvals are complete
            approvals_result = self.db.table("workflow_approvals").select("*").eq(
                "workflow_instance_id", instance_id
            ).eq("step_number", current_step).execute()
            
            if not approvals_result.data:
                raise ValueError("No approvals found for current step")
            
            # Check if all required approvals are approved
            all_approved = all(
                approval["status"] == "approved" 
                for approval in approvals_result.data
            )
            
            if not all_approved:
                raise ValueError("Not all approvals for current step are approved")
            
            # Advance to next step
            next_step = current_step + 1
            
            if next_step >= len(steps):
                # Workflow complete
                update_data = {
                    "status": "completed",
                    "completed_at": datetime.utcnow().isoformat(),
                    "updated_at": datetime.utcnow().isoformat()
                }
                
                self.db.table("workflow_instances").update(update_data).eq(
                    "id", instance_id
                ).execute()
                
                # Log completion
                await self._log_audit_event(
                    organization_id=organization_id,
                    user_id=user_id,
                    action="workflow_completed",
                    entity_type="workflow_instance",
                    entity_id=instance_id,
                    details={"final_step": current_step}
                )
                
                # Notify initiator
                initiator_id = instance.get("data", {}).get("initiator_id")
                if initiator_id:
                    await self._send_notification(
                        user_id=initiator_id,
                        notification_type="workflow_completed",
                        data={
                            "workflow_instance_id": instance_id,
                            "entity_type": instance["entity_type"],
                            "entity_id": instance["entity_id"]
                        }
                    )
                
                return {
                    "status": "completed",
                    "current_step": current_step,
                    "next_steps": []
                }
            else:
                # Move to next step
                update_data = {
                    "current_step": next_step,
                    "updated_at": datetime.utcnow().isoformat()
                }
                
                self.db.table("workflow_instances").update(update_data).eq(
                    "id", instance_id
                ).execute()
                
                # Create approval records for next step
                await self._create_approval_records(
                    instance_id, steps[next_step], organization_id
                )
                
                # Log state transition
                await self._log_audit_event(
                    organization_id=organization_id,
                    user_id=user_id,
                    action="workflow_advanced",
                    entity_type="workflow_instance",
                    entity_id=instance_id,
                    details={
                        "from_step": current_step,
                        "to_step": next_step
                    }
                )
                
                # Notify approvers for next step
                await self._notify_approvers(instance_id, steps[next_step], organization_id)
                
                return {
                    "status": "in_progress",
                    "current_step": next_step,
                    "next_steps": [steps[next_step]]
                }
                
        except ValueError as e:
            logger.error(f"Validation error advancing workflow: {e}")
            raise
        except Exception as e:
            logger.error(f"Error advancing workflow {instance_id}: {e}")
            raise RuntimeError(f"Failed to advance workflow: {str(e)}")
    
    async def submit_approval(
        self,
        instance_id: str,
        decision: str,
        comments: Optional[str],
        approver_id: str,
        organization_id: str
    ) -> Dict[str, Any]:
        """
        Submit an approval decision.
        
        Args:
            instance_id: ID of the workflow instance
            decision: Approval decision ("approved" or "rejected")
            comments: Optional comments
            approver_id: ID of the approver
            organization_id: Organization ID for filtering
            
        Returns:
            Dict containing approval result and workflow status
            
        Raises:
            ValueError: If invalid decision or approval not found
            RuntimeError: If submission fails
        """
        try:
            if decision not in ["approved", "rejected"]:
                raise ValueError(f"Invalid decision: {decision}")
            
            # Get workflow instance
            instance_result = self.db.table("workflow_instances").select("*").eq(
                "id", instance_id
            ).execute()
            
            if not instance_result.data:
                raise ValueError(f"Workflow instance {instance_id} not found")
            
            instance = instance_result.data[0]
            
            # Verify organization
            instance_org_id = instance.get("data", {}).get("organization_id")
            if instance_org_id != organization_id:
                raise ValueError("Workflow instance not found in organization")
            
            current_step = instance["current_step"]
            
            # Find approval record for this approver and step
            approval_result = self.db.table("workflow_approvals").select("*").eq(
                "workflow_instance_id", instance_id
            ).eq("step_number", current_step).eq(
                "approver_id", approver_id
            ).execute()
            
            if not approval_result.data:
                raise ValueError("Approval record not found for this approver")
            
            approval = approval_result.data[0]
            
            # Check if already decided
            if approval["status"] != "pending":
                raise ValueError(f"Approval already {approval['status']}")
            
            # Update approval record
            approval_update = {
                "status": decision,
                "comments": comments,
                "approved_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            self.db.table("workflow_approvals").update(approval_update).eq(
                "id", approval["id"]
            ).execute()
            
            # Log approval decision
            await self._log_audit_event(
                organization_id=organization_id,
                user_id=approver_id,
                action="approval_decision",
                entity_type="workflow_approval",
                entity_id=approval["id"],
                details={
                    "workflow_instance_id": instance_id,
                    "decision": decision,
                    "step_number": current_step,
                    "comments": comments
                }
            )
            
            # Handle rejection
            if decision == "rejected":
                # Update workflow instance to rejected
                instance_update = {
                    "status": "rejected",
                    "updated_at": datetime.utcnow().isoformat()
                }
                
                self.db.table("workflow_instances").update(instance_update).eq(
                    "id", instance_id
                ).execute()
                
                # Log rejection
                await self._log_audit_event(
                    organization_id=organization_id,
                    user_id=approver_id,
                    action="workflow_rejected",
                    entity_type="workflow_instance",
                    entity_id=instance_id,
                    details={
                        "rejected_at_step": current_step,
                        "rejected_by": approver_id
                    }
                )
                
                # Notify initiator
                initiator_id = instance.get("data", {}).get("initiator_id")
                if initiator_id:
                    await self._send_notification(
                        user_id=initiator_id,
                        notification_type="workflow_rejected",
                        data={
                            "workflow_instance_id": instance_id,
                            "rejected_by": approver_id,
                            "comments": comments
                        }
                    )
                
                return {
                    "decision": decision,
                    "workflow_status": "rejected",
                    "is_complete": True
                }
            
            # For approved decision, check if step is complete
            all_approvals = self.db.table("workflow_approvals").select("*").eq(
                "workflow_instance_id", instance_id
            ).eq("step_number", current_step).execute()
            
            all_approved = all(
                a["status"] == "approved" 
                for a in all_approvals.data
            )
            
            if all_approved:
                # Try to advance workflow automatically
                try:
                    result = await self.advance_workflow(
                        instance_id, organization_id, approver_id
                    )
                    
                    return {
                        "decision": decision,
                        "workflow_status": result["status"],
                        "is_complete": result["status"] == "completed",
                        "current_step": result["current_step"]
                    }
                except Exception as e:
                    logger.warning(f"Could not auto-advance workflow: {e}")
                    # Return success but indicate manual advancement needed
                    return {
                        "decision": decision,
                        "workflow_status": "pending_advancement",
                        "is_complete": False,
                        "current_step": current_step
                    }
            else:
                # Waiting for other approvals
                return {
                    "decision": decision,
                    "workflow_status": "pending_approvals",
                    "is_complete": False,
                    "current_step": current_step
                }
                
        except ValueError as e:
            logger.error(f"Validation error submitting approval: {e}")
            raise
        except Exception as e:
            logger.error(f"Error submitting approval for instance {instance_id}: {e}")
            raise RuntimeError(f"Failed to submit approval: {str(e)}")
    
    async def get_instance_status(
        self,
        instance_id: str,
        organization_id: str
    ) -> Dict[str, Any]:
        """
        Get workflow instance status.
        
        Args:
            instance_id: ID of the workflow instance
            organization_id: Organization ID for filtering
            
        Returns:
            Dict containing workflow instance details and approval status
            
        Raises:
            ValueError: If instance not found
            RuntimeError: If retrieval fails
        """
        try:
            # Get workflow instance
            instance_result = self.db.table("workflow_instances").select("*").eq(
                "id", instance_id
            ).execute()
            
            if not instance_result.data:
                raise ValueError(f"Workflow instance {instance_id} not found")
            
            instance = instance_result.data[0]
            
            # Verify organization
            instance_org_id = instance.get("data", {}).get("organization_id")
            if instance_org_id != organization_id:
                raise ValueError("Workflow instance not found in organization")
            
            # Get all approvals
            approvals_result = self.db.table("workflow_approvals").select("*").eq(
                "workflow_instance_id", instance_id
            ).order("step_number").execute()
            
            # Get workflow definition
            workflow_result = self.db.table("workflows").select("name").eq(
                "id", instance["workflow_id"]
            ).execute()
            
            workflow_name = workflow_result.data[0]["name"] if workflow_result.data else "Unknown"
            
            # Format approvals by step
            approvals_by_step = {}
            for approval in approvals_result.data:
                step_num = approval["step_number"]
                if step_num not in approvals_by_step:
                    approvals_by_step[step_num] = []
                
                approvals_by_step[step_num].append({
                    "id": approval["id"],
                    "approver_id": approval["approver_id"],
                    "status": approval["status"],
                    "comments": approval["comments"],
                    "approved_at": approval["approved_at"]
                })
            
            return {
                "id": instance["id"],
                "workflow_id": instance["workflow_id"],
                "workflow_name": workflow_name,
                "entity_type": instance["entity_type"],
                "entity_id": instance["entity_id"],
                "current_step": instance["current_step"],
                "status": instance["status"],
                "started_by": instance["started_by"],
                "started_at": instance["started_at"],
                "completed_at": instance.get("completed_at"),
                "approvals": approvals_by_step,
                "created_at": instance["created_at"],
                "updated_at": instance["updated_at"]
            }
            
        except ValueError as e:
            logger.error(f"Validation error getting workflow status: {e}")
            raise
        except Exception as e:
            logger.error(f"Error getting workflow instance status {instance_id}: {e}")
            raise RuntimeError(f"Failed to get workflow status: {str(e)}")
    
    async def _create_approval_records(
        self,
        instance_id: str,
        step_definition: Dict[str, Any],
        organization_id: str
    ) -> None:
        """
        Create approval records for a workflow step.
        
        Args:
            instance_id: ID of the workflow instance
            step_definition: Step definition from workflow template
            organization_id: Organization ID
        """
        try:
            step_number = step_definition.get("step_number", 0)
            approver_role = step_definition.get("approver_role")
            required_approvals = step_definition.get("required_approvals", 1)
            
            # Find approvers for the role
            approvers = await self._find_approvers_for_role(
                approver_role, organization_id, required_approvals
            )
            
            if not approvers:
                logger.warning(f"No approvers found for role {approver_role}")
                return
            
            # Create approval record for each approver
            for approver_id in approvers:
                approval_data = {
                    "workflow_instance_id": instance_id,
                    "step_number": step_number,
                    "approver_id": approver_id,
                    "status": "pending",
                    "created_at": datetime.utcnow().isoformat(),
                    "updated_at": datetime.utcnow().isoformat()
                }
                
                self.db.table("workflow_approvals").insert(approval_data).execute()
                
        except Exception as e:
            logger.error(f"Error creating approval records: {e}")
            raise RuntimeError(f"Failed to create approval records: {str(e)}")
    
    async def _find_approvers_for_role(
        self,
        role: str,
        organization_id: str,
        count: int = 1
    ) -> List[str]:
        """
        Find approvers for a specific role in an organization.
        
        Args:
            role: Role to find approvers for
            organization_id: Organization ID
            count: Number of approvers needed
            
        Returns:
            List of approver user IDs
        """
        try:
            # Query users with the specified role in the organization
            # This is a simplified implementation - in production, you'd have
            # a more sophisticated user/role management system
            
            # For now, return a placeholder - this would need to be implemented
            # based on your actual user/role schema
            logger.warning(f"Approver lookup not fully implemented for role {role}")
            return []
            
        except Exception as e:
            logger.error(f"Error finding approvers for role {role}: {e}")
            return []
    
    async def _notify_approvers(
        self,
        instance_id: str,
        step_definition: Dict[str, Any],
        organization_id: str
    ) -> None:
        """
        Send notifications to approvers for a workflow step.
        
        Args:
            instance_id: ID of the workflow instance
            step_definition: Step definition from workflow template
            organization_id: Organization ID
        """
        try:
            # Get approvals for this step
            step_number = step_definition.get("step_number", 0)
            
            approvals_result = self.db.table("workflow_approvals").select("*").eq(
                "workflow_instance_id", instance_id
            ).eq("step_number", step_number).execute()
            
            # Send notification to each approver
            for approval in approvals_result.data:
                await self._send_notification(
                    user_id=approval["approver_id"],
                    notification_type="approval_required",
                    data={
                        "workflow_instance_id": instance_id,
                        "approval_id": approval["id"],
                        "step_number": step_number
                    }
                )
                
        except Exception as e:
            logger.error(f"Error notifying approvers: {e}")
            # Don't raise - notifications are non-critical
    
    async def _send_notification(
        self,
        user_id: str,
        notification_type: str,
        data: Dict[str, Any]
    ) -> None:
        """
        Send a Supabase Realtime notification to a user.
        
        Args:
            user_id: ID of the user to notify
            notification_type: Type of notification
            data: Notification data
        """
        try:
            # Send notification via Supabase Realtime
            # This uses Supabase's realtime broadcast feature
            channel_name = f"user:{user_id}"
            
            notification_payload = {
                "type": notification_type,
                "timestamp": datetime.utcnow().isoformat(),
                "data": data
            }
            
            # Note: Supabase Realtime notifications are sent via the client SDK
            # The backend can trigger them by inserting into a notifications table
            # that the frontend subscribes to
            
            notification_record = {
                "user_id": user_id,
                "type": notification_type,
                "data": data,
                "read": False,
                "created_at": datetime.utcnow().isoformat()
            }
            
            # Insert into notifications table (if it exists)
            try:
                self.db.table("notifications").insert(notification_record).execute()
            except Exception as e:
                logger.warning(f"Could not insert notification record: {e}")
                
        except Exception as e:
            logger.error(f"Error sending notification to user {user_id}: {e}")
            # Don't raise - notifications are non-critical
    
    async def _log_audit_event(
        self,
        organization_id: str,
        user_id: str,
        action: str,
        entity_type: str,
        entity_id: str,
        details: Dict[str, Any]
    ) -> None:
        """
        Log an audit event for workflow operations.
        
        Args:
            organization_id: Organization ID
            user_id: ID of the user performing the action
            action: Action type
            entity_type: Type of entity
            entity_id: ID of the entity
            details: Additional details
        """
        try:
            audit_data = {
                "organization_id": organization_id,
                "user_id": user_id,
                "action": action,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "details": details,
                "success": True,
                "created_at": datetime.utcnow().isoformat()
            }
            
            self.db.table("audit_logs").insert(audit_data).execute()
            
        except Exception as e:
            logger.error(f"Error logging audit event: {e}")
            # Don't raise - audit logging failures shouldn't break workflow
