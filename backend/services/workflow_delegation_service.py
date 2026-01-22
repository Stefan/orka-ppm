"""
Workflow Delegation and Escalation Service

Handles approver unavailability detection, delegation workflows,
escalation for timeouts, and data consistency reconciliation.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from uuid import UUID

from supabase import Client

from models.workflow import (
    WorkflowApproval,
    ApprovalStatus,
    WorkflowStatus
)

logger = logging.getLogger(__name__)


class DelegationReason(str):
    """Reasons for delegation"""
    UNAVAILABLE = "unavailable"
    OUT_OF_OFFICE = "out_of_office"
    TIMEOUT = "timeout"
    MANUAL = "manual"
    CONFLICT_OF_INTEREST = "conflict_of_interest"


class EscalationReason(str):
    """Reasons for escalation"""
    TIMEOUT = "timeout"
    REJECTION = "rejection"
    APPROVER_UNAVAILABLE = "approver_unavailable"
    MANUAL = "manual"
    SYSTEM_ERROR = "system_error"


class WorkflowDelegationService:
    """
    Service for handling workflow delegation and escalation.
    
    Provides:
    - Approver unavailability detection
    - Delegation workflows
    - Escalation for timeouts
    - Data consistency reconciliation
    """
    
    def __init__(self, db: Client):
        """
        Initialize delegation service with database client.
        
        Args:
            db: Supabase client instance
        """
        if not db:
            raise ValueError("Database client is required")
        
        self.db = db
        self._delegation_cache: Dict[str, Dict[str, Any]] = {}
    
    # ==================== Approver Unavailability Detection ====================
    
    async def check_approver_availability(
        self,
        approver_id: UUID,
        check_date: Optional[datetime] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Check if an approver is available.
        
        Args:
            approver_id: Approver user ID
            check_date: Date to check availability (defaults to now)
            
        Returns:
            Tuple of (is_available, unavailability_reason)
        """
        try:
            check_date = check_date or datetime.utcnow()
            
            # Check user status
            user_result = self.db.table("user_profiles").select(
                "status, out_of_office_until, out_of_office_reason"
            ).eq("user_id", str(approver_id)).execute()
            
            if not user_result.data:
                return False, "user_not_found"
            
            user_data = user_result.data[0]
            
            # Check if user is inactive
            if user_data.get("status") == "inactive":
                return False, "user_inactive"
            
            # Check out of office status
            ooo_until = user_data.get("out_of_office_until")
            if ooo_until:
                ooo_date = datetime.fromisoformat(ooo_until)
                if check_date <= ooo_date:
                    reason = user_data.get("out_of_office_reason", "out_of_office")
                    return False, reason
            
            # Check for active delegation rules
            delegation_result = self.db.table("workflow_delegation_rules").select("*").eq(
                "delegator_id", str(approver_id)
            ).eq("is_active", True).execute()
            
            if delegation_result.data:
                for rule in delegation_result.data:
                    start_date = datetime.fromisoformat(rule["start_date"])
                    end_date = datetime.fromisoformat(rule["end_date"]) if rule.get("end_date") else None
                    
                    if start_date <= check_date and (not end_date or check_date <= end_date):
                        return False, "delegated"
            
            return True, None
            
        except Exception as e:
            logger.error(f"Error checking approver availability: {e}", exc_info=True)
            # Assume available on error to avoid blocking workflows
            return True, None
    
    async def detect_unavailable_approvers(
        self,
        workflow_instance_id: UUID
    ) -> List[Dict[str, Any]]:
        """
        Detect unavailable approvers for a workflow instance.
        
        Args:
            workflow_instance_id: Workflow instance ID
            
        Returns:
            List of unavailable approver records
        """
        try:
            # Get pending approvals for instance
            approvals_result = self.db.table("workflow_approvals").select("*").eq(
                "workflow_instance_id", str(workflow_instance_id)
            ).eq("status", ApprovalStatus.PENDING.value).execute()
            
            if not approvals_result.data:
                return []
            
            unavailable_approvers = []
            
            for approval in approvals_result.data:
                approver_id = UUID(approval["approver_id"])
                is_available, reason = await self.check_approver_availability(approver_id)
                
                if not is_available:
                    unavailable_approvers.append({
                        "approval_id": approval["id"],
                        "approver_id": str(approver_id),
                        "step_number": approval["step_number"],
                        "unavailability_reason": reason,
                        "expires_at": approval.get("expires_at")
                    })
            
            return unavailable_approvers
            
        except Exception as e:
            logger.error(
                f"Error detecting unavailable approvers for instance {workflow_instance_id}: {e}",
                exc_info=True
            )
            return []
    
    # ==================== Delegation Workflows ====================
    
    async def delegate_approval(
        self,
        approval_id: UUID,
        delegator_id: UUID,
        delegate_to_id: UUID,
        reason: str,
        comments: Optional[str] = None,
        expires_at: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Delegate an approval to another user.
        
        Args:
            approval_id: Approval ID to delegate
            delegator_id: User ID of the delegator
            delegate_to_id: User ID of the delegate
            reason: Reason for delegation
            comments: Optional comments
            expires_at: Optional expiration date for delegation
            
        Returns:
            Dict containing delegation result
            
        Raises:
            ValueError: If approval not found or invalid delegation
        """
        try:
            # Get approval record
            approval_result = self.db.table("workflow_approvals").select("*").eq(
                "id", str(approval_id)
            ).execute()
            
            if not approval_result.data:
                raise ValueError(f"Approval {approval_id} not found")
            
            approval = approval_result.data[0]
            
            # Verify delegator is the approver
            if str(approval["approver_id"]) != str(delegator_id):
                raise ValueError("User is not the designated approver")
            
            # Check if already delegated or decided
            if approval["status"] != ApprovalStatus.PENDING.value:
                raise ValueError(f"Approval already {approval['status']}")
            
            # Check if delegate is available
            is_available, unavailability_reason = await self.check_approver_availability(delegate_to_id)
            if not is_available:
                raise ValueError(f"Delegate is unavailable: {unavailability_reason}")
            
            # Update approval with delegation
            update_data = {
                "status": ApprovalStatus.DELEGATED.value,
                "delegated_to": str(delegate_to_id),
                "delegated_at": datetime.utcnow().isoformat(),
                "comments": comments or f"Delegated to another approver: {reason}",
                "updated_at": datetime.utcnow().isoformat()
            }
            
            update_result = self.db.table("workflow_approvals").update(update_data).eq(
                "id", str(approval_id)
            ).execute()
            
            if not update_result.data:
                raise RuntimeError("Failed to update approval with delegation")
            
            # Create new approval for delegate
            new_approval_data = {
                "workflow_instance_id": approval["workflow_instance_id"],
                "step_number": approval["step_number"],
                "approver_id": str(delegate_to_id),
                "status": ApprovalStatus.PENDING.value,
                "expires_at": expires_at.isoformat() if expires_at else approval.get("expires_at"),
                "comments": f"Delegated from {delegator_id}: {reason}",
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            new_approval_result = self.db.table("workflow_approvals").insert(
                new_approval_data
            ).execute()
            
            if not new_approval_result.data:
                raise RuntimeError("Failed to create delegated approval")
            
            # Log delegation
            await self._log_delegation(
                approval_id=approval_id,
                delegator_id=delegator_id,
                delegate_to_id=delegate_to_id,
                reason=reason,
                comments=comments
            )
            
            logger.info(
                f"Approval {approval_id} delegated from {delegator_id} to {delegate_to_id}"
            )
            
            return {
                "success": True,
                "original_approval_id": str(approval_id),
                "new_approval_id": new_approval_result.data[0]["id"],
                "delegator_id": str(delegator_id),
                "delegate_to_id": str(delegate_to_id),
                "reason": reason
            }
            
        except ValueError as e:
            logger.error(f"Validation error delegating approval: {e}")
            raise
        except Exception as e:
            logger.error(f"Error delegating approval: {e}", exc_info=True)
            raise RuntimeError(f"Failed to delegate approval: {str(e)}")
    
    async def auto_delegate_unavailable_approvers(
        self,
        workflow_instance_id: UUID
    ) -> List[Dict[str, Any]]:
        """
        Automatically delegate approvals for unavailable approvers.
        
        Args:
            workflow_instance_id: Workflow instance ID
            
        Returns:
            List of delegation results
        """
        try:
            # Detect unavailable approvers
            unavailable = await self.detect_unavailable_approvers(workflow_instance_id)
            
            if not unavailable:
                return []
            
            delegation_results = []
            
            for unavailable_approver in unavailable:
                try:
                    # Find delegate based on delegation rules
                    delegate_id = await self._find_delegate(
                        UUID(unavailable_approver["approver_id"]),
                        workflow_instance_id
                    )
                    
                    if not delegate_id:
                        logger.warning(
                            f"No delegate found for unavailable approver {unavailable_approver['approver_id']}"
                        )
                        continue
                    
                    # Delegate approval
                    result = await self.delegate_approval(
                        approval_id=UUID(unavailable_approver["approval_id"]),
                        delegator_id=UUID(unavailable_approver["approver_id"]),
                        delegate_to_id=delegate_id,
                        reason=unavailable_approver["unavailability_reason"],
                        comments="Auto-delegated due to approver unavailability"
                    )
                    
                    delegation_results.append(result)
                    
                except Exception as e:
                    logger.error(
                        f"Error auto-delegating approval {unavailable_approver['approval_id']}: {e}",
                        exc_info=True
                    )
            
            return delegation_results
            
        except Exception as e:
            logger.error(
                f"Error auto-delegating unavailable approvers for instance {workflow_instance_id}: {e}",
                exc_info=True
            )
            return []
    
    async def _find_delegate(
        self,
        approver_id: UUID,
        workflow_instance_id: UUID
    ) -> Optional[UUID]:
        """
        Find a suitable delegate for an approver.
        
        Args:
            approver_id: Approver user ID
            workflow_instance_id: Workflow instance ID
            
        Returns:
            Delegate user ID or None if not found
        """
        try:
            # Check for active delegation rules
            delegation_result = self.db.table("workflow_delegation_rules").select("*").eq(
                "delegator_id", str(approver_id)
            ).eq("is_active", True).order("created_at", desc=True).execute()
            
            if delegation_result.data:
                for rule in delegation_result.data:
                    delegate_id = UUID(rule["delegate_to_id"])
                    
                    # Check if delegate is available
                    is_available, _ = await self.check_approver_availability(delegate_id)
                    if is_available:
                        return delegate_id
            
            # If no delegation rule, try to find manager or backup approver
            # This would integrate with organizational hierarchy
            # For now, return None
            return None
            
        except Exception as e:
            logger.error(f"Error finding delegate for approver {approver_id}: {e}", exc_info=True)
            return None
    
    # ==================== Escalation for Timeouts ====================
    
    async def check_and_escalate_timeouts(
        self,
        workflow_instance_id: Optional[UUID] = None
    ) -> List[Dict[str, Any]]:
        """
        Check for timed-out approvals and escalate them.
        
        Args:
            workflow_instance_id: Optional specific workflow instance to check
            
        Returns:
            List of escalation results
        """
        try:
            # Build query for pending approvals with expiration
            query = self.db.table("workflow_approvals").select("*").eq(
                "status", ApprovalStatus.PENDING.value
            ).not_.is_("expires_at", "null")
            
            if workflow_instance_id:
                query = query.eq("workflow_instance_id", str(workflow_instance_id))
            
            approvals_result = query.execute()
            
            if not approvals_result.data:
                return []
            
            escalation_results = []
            current_time = datetime.utcnow()
            
            for approval in approvals_result.data:
                expires_at = datetime.fromisoformat(approval["expires_at"])
                
                # Check if approval has timed out
                if current_time > expires_at:
                    try:
                        result = await self.escalate_approval(
                            approval_id=UUID(approval["id"]),
                            reason=EscalationReason.TIMEOUT,
                            comments=f"Approval timed out at {expires_at.isoformat()}"
                        )
                        
                        escalation_results.append(result)
                        
                    except Exception as e:
                        logger.error(
                            f"Error escalating timed-out approval {approval['id']}: {e}",
                            exc_info=True
                        )
            
            return escalation_results
            
        except Exception as e:
            logger.error(f"Error checking and escalating timeouts: {e}", exc_info=True)
            return []
    
    async def escalate_approval(
        self,
        approval_id: UUID,
        reason: str,
        comments: Optional[str] = None,
        escalation_approvers: Optional[List[UUID]] = None
    ) -> Dict[str, Any]:
        """
        Escalate an approval to higher authority.
        
        Args:
            approval_id: Approval ID to escalate
            reason: Reason for escalation
            comments: Optional comments
            escalation_approvers: Optional list of escalation approver IDs
            
        Returns:
            Dict containing escalation result
            
        Raises:
            ValueError: If approval not found
        """
        try:
            # Get approval record
            approval_result = self.db.table("workflow_approvals").select("*").eq(
                "id", str(approval_id)
            ).execute()
            
            if not approval_result.data:
                raise ValueError(f"Approval {approval_id} not found")
            
            approval = approval_result.data[0]
            
            # Mark original approval as expired
            update_data = {
                "status": ApprovalStatus.EXPIRED.value,
                "comments": comments or f"Escalated: {reason}",
                "updated_at": datetime.utcnow().isoformat()
            }
            
            update_result = self.db.table("workflow_approvals").update(update_data).eq(
                "id", str(approval_id)
            ).execute()
            
            if not update_result.data:
                raise RuntimeError("Failed to update approval with escalation")
            
            # Determine escalation approvers
            if not escalation_approvers:
                escalation_approvers = await self._find_escalation_approvers(
                    workflow_instance_id=UUID(approval["workflow_instance_id"]),
                    step_number=approval["step_number"],
                    original_approver_id=UUID(approval["approver_id"])
                )
            
            if not escalation_approvers:
                raise ValueError("No escalation approvers found")
            
            # Create escalation approvals
            new_approval_ids = []
            for escalation_approver_id in escalation_approvers:
                new_approval_data = {
                    "workflow_instance_id": approval["workflow_instance_id"],
                    "step_number": approval["step_number"],
                    "approver_id": str(escalation_approver_id),
                    "status": ApprovalStatus.PENDING.value,
                    "expires_at": (datetime.utcnow() + timedelta(hours=48)).isoformat(),  # 48 hour escalation timeout
                    "comments": f"Escalated from approval {approval_id}: {reason}",
                    "created_at": datetime.utcnow().isoformat(),
                    "updated_at": datetime.utcnow().isoformat()
                }
                
                new_approval_result = self.db.table("workflow_approvals").insert(
                    new_approval_data
                ).execute()
                
                if new_approval_result.data:
                    new_approval_ids.append(new_approval_result.data[0]["id"])
            
            # Log escalation
            await self._log_escalation(
                approval_id=approval_id,
                reason=reason,
                comments=comments,
                escalation_approvers=escalation_approvers
            )
            
            logger.info(
                f"Approval {approval_id} escalated to {len(escalation_approvers)} approvers"
            )
            
            return {
                "success": True,
                "original_approval_id": str(approval_id),
                "new_approval_ids": new_approval_ids,
                "escalation_approvers": [str(a) for a in escalation_approvers],
                "reason": reason
            }
            
        except ValueError as e:
            logger.error(f"Validation error escalating approval: {e}")
            raise
        except Exception as e:
            logger.error(f"Error escalating approval: {e}", exc_info=True)
            raise RuntimeError(f"Failed to escalate approval: {str(e)}")
    
    async def _find_escalation_approvers(
        self,
        workflow_instance_id: UUID,
        step_number: int,
        original_approver_id: UUID
    ) -> List[UUID]:
        """
        Find escalation approvers for a workflow step.
        
        Args:
            workflow_instance_id: Workflow instance ID
            step_number: Step number
            original_approver_id: Original approver ID
            
        Returns:
            List of escalation approver IDs
        """
        try:
            # Get workflow instance
            instance_result = self.db.table("workflow_instances").select("*").eq(
                "id", str(workflow_instance_id)
            ).execute()
            
            if not instance_result.data:
                return []
            
            instance = instance_result.data[0]
            
            # Get workflow definition
            workflow_result = self.db.table("workflows").select("*").eq(
                "id", instance["workflow_id"]
            ).execute()
            
            if not workflow_result.data:
                return []
            
            workflow = workflow_result.data[0]
            template_data = workflow.get("template_data", {})
            steps = template_data.get("steps", [])
            
            if step_number >= len(steps):
                return []
            
            step = steps[step_number]
            
            # Get escalation approvers from step definition
            escalation_approvers = step.get("escalation_approvers", [])
            if escalation_approvers:
                return [UUID(a) for a in escalation_approvers]
            
            # If no explicit escalation approvers, try to find manager
            # This would integrate with organizational hierarchy
            # For now, return empty list
            return []
            
        except Exception as e:
            logger.error(f"Error finding escalation approvers: {e}", exc_info=True)
            return []
    
    # ==================== Data Consistency Reconciliation ====================
    
    async def reconcile_workflow_data(
        self,
        workflow_instance_id: UUID
    ) -> Dict[str, Any]:
        """
        Reconcile and repair workflow data inconsistencies.
        
        Args:
            workflow_instance_id: Workflow instance ID
            
        Returns:
            Dict containing reconciliation result
        """
        try:
            inconsistencies = []
            repairs = []
            
            # Get workflow instance
            instance_result = self.db.table("workflow_instances").select("*").eq(
                "id", str(workflow_instance_id)
            ).execute()
            
            if not instance_result.data:
                return {
                    "success": False,
                    "error": "Workflow instance not found"
                }
            
            instance = instance_result.data[0]
            
            # Check 1: Verify workflow definition exists
            workflow_result = self.db.table("workflows").select("*").eq(
                "id", instance["workflow_id"]
            ).execute()
            
            if not workflow_result.data:
                inconsistencies.append({
                    "type": "missing_workflow_definition",
                    "severity": "critical",
                    "message": f"Workflow definition {instance['workflow_id']} not found"
                })
            
            # Check 2: Verify approvals exist for current step
            approvals_result = self.db.table("workflow_approvals").select("*").eq(
                "workflow_instance_id", str(workflow_instance_id)
            ).eq("step_number", instance["current_step"]).execute()
            
            if not approvals_result.data and instance["status"] == WorkflowStatus.IN_PROGRESS.value:
                inconsistencies.append({
                    "type": "missing_approvals",
                    "severity": "high",
                    "message": f"No approvals found for current step {instance['current_step']}"
                })
                
                # Attempt repair: Create missing approvals
                if workflow_result.data:
                    try:
                        workflow = workflow_result.data[0]
                        template_data = workflow.get("template_data", {})
                        steps = template_data.get("steps", [])
                        
                        if instance["current_step"] < len(steps):
                            step = steps[instance["current_step"]]
                            approvers = step.get("approvers", [])
                            
                            for approver_id in approvers:
                                approval_data = {
                                    "workflow_instance_id": str(workflow_instance_id),
                                    "step_number": instance["current_step"],
                                    "approver_id": approver_id,
                                    "status": ApprovalStatus.PENDING.value,
                                    "created_at": datetime.utcnow().isoformat(),
                                    "updated_at": datetime.utcnow().isoformat()
                                }
                                
                                self.db.table("workflow_approvals").insert(approval_data).execute()
                            
                            repairs.append({
                                "type": "created_missing_approvals",
                                "message": f"Created {len(approvers)} missing approvals for step {instance['current_step']}"
                            })
                    except Exception as e:
                        logger.error(f"Error repairing missing approvals: {e}", exc_info=True)
            
            # Check 3: Verify status consistency
            if instance["status"] == WorkflowStatus.COMPLETED.value and not instance.get("completed_at"):
                inconsistencies.append({
                    "type": "missing_completion_timestamp",
                    "severity": "medium",
                    "message": "Workflow marked as completed but no completion timestamp"
                })
                
                # Attempt repair: Set completion timestamp
                try:
                    self.db.table("workflow_instances").update({
                        "completed_at": datetime.utcnow().isoformat()
                    }).eq("id", str(workflow_instance_id)).execute()
                    
                    repairs.append({
                        "type": "set_completion_timestamp",
                        "message": "Set missing completion timestamp"
                    })
                except Exception as e:
                    logger.error(f"Error setting completion timestamp: {e}", exc_info=True)
            
            # Check 4: Verify no orphaned approvals
            all_approvals_result = self.db.table("workflow_approvals").select("*").eq(
                "workflow_instance_id", str(workflow_instance_id)
            ).execute()
            
            if all_approvals_result.data and workflow_result.data:
                workflow = workflow_result.data[0]
                template_data = workflow.get("template_data", {})
                steps = template_data.get("steps", [])
                max_step = len(steps) - 1
                
                for approval in all_approvals_result.data:
                    if approval["step_number"] > max_step:
                        inconsistencies.append({
                            "type": "orphaned_approval",
                            "severity": "low",
                            "message": f"Approval {approval['id']} for non-existent step {approval['step_number']}"
                        })
            
            logger.info(
                f"Reconciliation complete for workflow instance {workflow_instance_id}: "
                f"{len(inconsistencies)} inconsistencies found, {len(repairs)} repairs made"
            )
            
            return {
                "success": True,
                "workflow_instance_id": str(workflow_instance_id),
                "inconsistencies": inconsistencies,
                "repairs": repairs,
                "is_consistent": len(inconsistencies) == 0
            }
            
        except Exception as e:
            logger.error(
                f"Error reconciling workflow data for instance {workflow_instance_id}: {e}",
                exc_info=True
            )
            return {
                "success": False,
                "error": str(e)
            }
    
    # ==================== Logging ====================
    
    async def _log_delegation(
        self,
        approval_id: UUID,
        delegator_id: UUID,
        delegate_to_id: UUID,
        reason: str,
        comments: Optional[str]
    ) -> None:
        """
        Log delegation action to audit trail.
        
        Args:
            approval_id: Approval ID
            delegator_id: Delegator user ID
            delegate_to_id: Delegate user ID
            reason: Delegation reason
            comments: Optional comments
        """
        try:
            audit_data = {
                "event_type": "workflow_delegation",
                "approval_id": str(approval_id),
                "delegator_id": str(delegator_id),
                "delegate_to_id": str(delegate_to_id),
                "reason": reason,
                "comments": comments,
                "created_at": datetime.utcnow().isoformat()
            }
            
            self.db.table("workflow_audit_logs").insert(audit_data).execute()
            
        except Exception as e:
            logger.error(f"Error logging delegation: {e}", exc_info=True)
    
    async def _log_escalation(
        self,
        approval_id: UUID,
        reason: str,
        comments: Optional[str],
        escalation_approvers: List[UUID]
    ) -> None:
        """
        Log escalation action to audit trail.
        
        Args:
            approval_id: Approval ID
            reason: Escalation reason
            comments: Optional comments
            escalation_approvers: List of escalation approver IDs
        """
        try:
            audit_data = {
                "event_type": "workflow_escalation",
                "approval_id": str(approval_id),
                "reason": reason,
                "comments": comments,
                "escalation_approvers": [str(a) for a in escalation_approvers],
                "created_at": datetime.utcnow().isoformat()
            }
            
            self.db.table("workflow_audit_logs").insert(audit_data).execute()
            
        except Exception as e:
            logger.error(f"Error logging escalation: {e}", exc_info=True)
