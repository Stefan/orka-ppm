"""
Approval Workflow Engine Service

Manages multi-step approval processes with configurable workflows.
Handles workflow determination, approval authority validation, and workflow progression.
"""

import asyncio
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID, uuid4
from decimal import Decimal
from enum import Enum
import logging

from config.database import supabase
from models.change_management import (
    ApprovalDecision, ChangeType, PriorityLevel, ChangeStatus,
    ApprovalRequest, ApprovalDecisionRequest, ApprovalResponse,
    PendingApproval
)
from .cache_service import cache_service

logger = logging.getLogger(__name__)

class WorkflowType(str, Enum):
    """Types of approval workflows"""
    STANDARD = "standard"
    EXPEDITED = "expedited"
    EMERGENCY = "emergency"
    HIGH_VALUE = "high_value"
    REGULATORY = "regulatory"

class ApprovalStep:
    """Represents a single approval step in a workflow"""
    def __init__(
        self,
        step_number: int,
        approver_role: str,
        approver_id: Optional[UUID] = None,
        is_required: bool = True,
        is_parallel: bool = False,
        depends_on_step: Optional[int] = None,
        authority_limit: Optional[Decimal] = None,
        deadline_hours: int = 72
    ):
        self.step_number = step_number
        self.approver_role = approver_role
        self.approver_id = approver_id
        self.is_required = is_required
        self.is_parallel = is_parallel
        self.depends_on_step = depends_on_step
        self.authority_limit = authority_limit
        self.deadline_hours = deadline_hours

class WorkflowInstance:
    """Represents an active workflow instance"""
    def __init__(
        self,
        workflow_id: UUID,
        change_request_id: UUID,
        workflow_type: WorkflowType,
        steps: List[ApprovalStep],
        status: str = "active"
    ):
        self.workflow_id = workflow_id
        self.change_request_id = change_request_id
        self.workflow_type = workflow_type
        self.steps = steps
        self.status = status
        self.created_at = datetime.utcnow()

class ApprovalResult:
    """Result of an approval decision"""
    def __init__(
        self,
        approval_id: UUID,
        decision: ApprovalDecision,
        workflow_status: str,
        next_steps: List[ApprovalStep],
        is_complete: bool = False
    ):
        self.approval_id = approval_id
        self.decision = decision
        self.workflow_status = workflow_status
        self.next_steps = next_steps
        self.is_complete = is_complete

class EscalationResult:
    """Result of an escalation action"""
    def __init__(
        self,
        approval_id: UUID,
        escalated_to: UUID,
        escalation_reason: str,
        original_approver: UUID
    ):
        self.approval_id = approval_id
        self.escalated_to = escalated_to
        self.escalation_reason = escalation_reason
        self.original_approver = original_approver

class ApprovalWorkflowEngine:
    """
    Manages multi-step approval processes with configurable workflows.
    
    Handles:
    - Workflow determination based on change characteristics
    - Support for sequential, parallel, and conditional approvals
    - Approval authority validation system
    """
    
    def __init__(self):
        self.db = supabase
        if not self.db:
            raise RuntimeError("Database connection not available")
        
        # Initialize decision processor and workflow progression
        self.decision_processor = ApprovalDecisionProcessor(self)
        self.workflow_progression = AutomaticWorkflowProgression(self)
        
        # Initialize deadline and escalation managers
        self.deadline_manager = DeadlineManager(self)
        self.escalation_manager = EscalationManager(self)
    
    async def initiate_approval_workflow(
        self,
        change_id: UUID,
        workflow_type: Optional[WorkflowType] = None
    ) -> WorkflowInstance:
        """
        Initiate approval workflow for a change request.
        
        Args:
            change_id: ID of the change request
            workflow_type: Optional specific workflow type to use
            
        Returns:
            WorkflowInstance: Created workflow instance
            
        Raises:
            ValueError: If change request not found or invalid
            RuntimeError: If workflow creation fails
        """
        try:
            # Get change request details
            change_result = self.db.table("change_requests").select("*").eq("id", str(change_id)).execute()
            if not change_result.data:
                raise ValueError(f"Change request {change_id} not found")
            
            change_data = change_result.data[0]
            
            # Determine workflow type if not specified
            if not workflow_type:
                workflow_type = await self._determine_workflow_type(change_data)
            
            # Generate approval path
            approval_steps = self.determine_approval_path(change_data, workflow_type)
            
            # Create workflow instance
            workflow_id = uuid4()
            workflow_instance = WorkflowInstance(
                workflow_id=workflow_id,
                change_request_id=change_id,
                workflow_type=workflow_type,
                steps=approval_steps
            )
            
            # Create approval records in database
            await self._create_approval_records(workflow_instance)
            
            # Update change request status
            await self._update_change_status(change_id, ChangeStatus.PENDING_APPROVAL)
            
            # Log workflow initiation
            await self._log_audit_event(
                change_request_id=change_id,
                event_type="workflow_initiated",
                event_description=f"Approval workflow initiated: {workflow_type.value}",
                workflow_id=workflow_id
            )
            
            return workflow_instance
            
        except Exception as e:
            logger.error(f"Error initiating approval workflow for change {change_id}: {e}")
            raise RuntimeError(f"Failed to initiate approval workflow: {str(e)}")
    
    async def process_approval_decision(
        self,
        approval_id: UUID,
        decision: ApprovalDecision,
        approver_id: UUID,
        comments: Optional[str] = None,
        conditions: Optional[str] = None
    ) -> ApprovalResult:
        """
        Process an approval decision and advance workflow.
        
        Args:
            approval_id: ID of the approval record
            decision: Approval decision
            approver_id: ID of the approver
            comments: Optional comments
            conditions: Optional conditions for conditional approval
            
        Returns:
            ApprovalResult: Result of the decision processing
            
        Raises:
            ValueError: If approval not found or invalid decision
            RuntimeError: If processing fails
        """
        # Use the enhanced decision processor for complex scenarios
        if decision == ApprovalDecision.DELEGATED or conditions:
            return await self.decision_processor.process_approval_decision_advanced(
                approval_id, decision, approver_id, comments, conditions
            )
        else:
            return await self.decision_processor._process_standard_decision(
                approval_id, decision, approver_id, comments
            )
    
    async def process_approval_decision_with_delegation(
        self,
        approval_id: UUID,
        decision: ApprovalDecision,
        approver_id: UUID,
        comments: Optional[str] = None,
        conditions: Optional[str] = None,
        delegation_target: Optional[UUID] = None
    ) -> ApprovalResult:
        """
        Process approval decision with support for delegation.
        
        Args:
            approval_id: ID of the approval record
            decision: Approval decision
            approver_id: ID of the approver
            comments: Optional comments
            conditions: Optional conditions for conditional approval
            delegation_target: Target user for delegation
            
        Returns:
            ApprovalResult: Result of the decision processing
        """
        return await self.decision_processor.process_approval_decision_advanced(
            approval_id, decision, approver_id, comments, conditions, delegation_target
        )
    
    async def fulfill_conditional_requirement(
        self,
        approval_id: UUID,
        requirement_id: int,
        fulfilled_by: UUID,
        evidence: Optional[str] = None
    ) -> bool:
        """
        Fulfill a conditional approval requirement.
        
        Args:
            approval_id: ID of the approval with conditions
            requirement_id: ID of the requirement to fulfill
            fulfilled_by: User fulfilling the requirement
            evidence: Optional evidence of fulfillment
            
        Returns:
            bool: True if requirement was fulfilled
        """
        return await self.decision_processor.fulfill_conditional_requirement(
            approval_id, requirement_id, fulfilled_by, evidence
        )
    
    async def get_conditional_requirements(self, approval_id: UUID) -> Optional[Dict[str, Any]]:
        """Get conditional requirements for an approval"""
        return await self.decision_processor.get_conditional_requirements(approval_id)
    
    async def advance_workflows_automatically(self) -> List[Dict[str, Any]]:
        """
        Check and advance all eligible workflows automatically.
        
        Returns:
            List of advancement results
        """
        return await self.workflow_progression.check_and_advance_workflows()
    
    async def get_pending_approvals(self, user_id: UUID) -> List[PendingApproval]:
        """
        Get pending approvals for a user.
        
        Args:
            user_id: ID of the user
            
        Returns:
            List[PendingApproval]: List of pending approvals
        """
        try:
            # Query pending approvals
            query = """
                SELECT 
                    ca.id as approval_id,
                    ca.change_request_id,
                    cr.change_number,
                    cr.title as change_title,
                    cr.change_type,
                    cr.priority,
                    cr.requested_by,
                    cr.requested_date,
                    ca.step_number,
                    ca.due_date,
                    p.name as project_name,
                    cr.estimated_cost_impact
                FROM change_approvals ca
                JOIN change_requests cr ON ca.change_request_id = cr.id
                JOIN projects p ON cr.project_id = p.id
                WHERE ca.approver_id = %s 
                AND ca.decision IS NULL
                AND cr.status = 'pending_approval'
                ORDER BY ca.due_date ASC, cr.priority DESC
            """
            
            result = self.db.rpc("execute_sql", {"query": query, "params": [str(user_id)]}).execute()
            
            pending_approvals = []
            for row in result.data:
                is_overdue = False
                if row["due_date"]:
                    due_date = datetime.fromisoformat(row["due_date"].replace("Z", "+00:00"))
                    is_overdue = due_date < datetime.utcnow()
                
                pending_approvals.append(PendingApproval(
                    approval_id=row["approval_id"],
                    change_request_id=row["change_request_id"],
                    change_number=row["change_number"],
                    change_title=row["change_title"],
                    change_type=row["change_type"],
                    priority=row["priority"],
                    requested_by=row["requested_by"],
                    requested_date=datetime.fromisoformat(row["requested_date"].replace("Z", "+00:00")),
                    step_number=row["step_number"],
                    due_date=due_date if row["due_date"] else None,
                    is_overdue=is_overdue,
                    project_name=row["project_name"],
                    estimated_cost_impact=Decimal(str(row["estimated_cost_impact"])) if row["estimated_cost_impact"] else None
                ))
            
            return pending_approvals
            
        except Exception as e:
            logger.error(f"Error getting pending approvals for user {user_id}: {e}")
            raise RuntimeError(f"Failed to get pending approvals: {str(e)}")
    
    async def escalate_overdue_approvals(self) -> List[EscalationResult]:
        """
        Escalate overdue approvals to backup approvers or managers.
        
        Returns:
            List[EscalationResult]: List of escalation results
        """
        return await self.escalation_manager.process_escalations()
    
    async def send_deadline_reminders(self) -> List[Dict[str, Any]]:
        """
        Send reminder notifications for approaching deadlines.
        
        Returns:
            List of reminder results
        """
        return await self.deadline_manager.send_deadline_reminders()
    
    async def update_approval_deadline(
        self,
        approval_id: UUID,
        new_deadline: datetime,
        updated_by: UUID,
        reason: str
    ) -> bool:
        """
        Update approval deadline.
        
        Args:
            approval_id: ID of the approval
            new_deadline: New deadline
            updated_by: User making the update
            reason: Reason for deadline change
            
        Returns:
            bool: True if successful
        """
        return await self.deadline_manager.update_approval_deadline(
            approval_id, new_deadline, updated_by, reason
        )
    
    async def delegate_approval(
        self,
        approval_id: UUID,
        delegator_id: UUID,
        delegate_id: UUID,
        delegation_reason: str,
        delegation_duration: Optional[timedelta] = None
    ) -> bool:
        """
        Delegate an approval to another user.
        
        Args:
            approval_id: ID of the approval to delegate
            delegator_id: ID of the user delegating
            delegate_id: ID of the user receiving delegation
            delegation_reason: Reason for delegation
            delegation_duration: Optional duration for delegation
            
        Returns:
            bool: True if successful
        """
        return await self.escalation_manager.delegate_approval(
            approval_id, delegator_id, delegate_id, delegation_reason, delegation_duration
        )
    
    async def setup_backup_approver(
        self,
        primary_approver: UUID,
        backup_approver: UUID,
        approver_role: str,
        is_active: bool = True
    ) -> bool:
        """
        Set up backup approver for a role.
        
        Args:
            primary_approver: Primary approver user ID
            backup_approver: Backup approver user ID
            approver_role: Role for which backup is being set
            is_active: Whether backup is active
            
        Returns:
            bool: True if successful
        """
        return await self.escalation_manager.setup_backup_approver(
            primary_approver, backup_approver, approver_role, is_active
        )
    
    async def cleanup_expired_delegations(self) -> int:
        """
        Clean up expired delegations.
        
        Returns:
            int: Number of delegations cleaned up
        """
        return await self.escalation_manager.cleanup_expired_delegations()
    
    def determine_approval_path(
        self,
        change_data: Dict[str, Any],
        workflow_type: Optional[WorkflowType] = None
    ) -> List[ApprovalStep]:
        """
        Determine the approval path based on change characteristics.
        
        Args:
            change_data: Change request data
            workflow_type: Optional workflow type override
            
        Returns:
            List[ApprovalStep]: List of approval steps
        """
        try:
            change_type = ChangeType(change_data["change_type"])
            priority = PriorityLevel(change_data["priority"])
            cost_impact = Decimal(str(change_data.get("estimated_cost_impact", 0)))
            
            # Determine workflow type if not provided
            if not workflow_type:
                workflow_type = self._determine_workflow_type_sync(change_data)
            
            steps = []
            
            if workflow_type == WorkflowType.EMERGENCY:
                # Emergency workflow: Single emergency approver
                steps.append(ApprovalStep(
                    step_number=1,
                    approver_role="emergency_approver",
                    is_required=True,
                    deadline_hours=4  # 4 hours for emergency
                ))
                
            elif workflow_type == WorkflowType.EXPEDITED:
                # Expedited workflow: Project manager + senior manager
                steps.append(ApprovalStep(
                    step_number=1,
                    approver_role="project_manager",
                    is_required=True,
                    deadline_hours=24
                ))
                
                if cost_impact > 10000:
                    steps.append(ApprovalStep(
                        step_number=2,
                        approver_role="senior_manager",
                        is_required=True,
                        depends_on_step=1,
                        authority_limit=Decimal("50000"),
                        deadline_hours=48
                    ))
                    
            elif workflow_type == WorkflowType.HIGH_VALUE:
                # High value workflow: Multiple levels
                steps.append(ApprovalStep(
                    step_number=1,
                    approver_role="project_manager",
                    is_required=True,
                    deadline_hours=72
                ))
                
                steps.append(ApprovalStep(
                    step_number=2,
                    approver_role="senior_manager",
                    is_required=True,
                    depends_on_step=1,
                    authority_limit=Decimal("100000"),
                    deadline_hours=72
                ))
                
                if cost_impact > 100000:
                    steps.append(ApprovalStep(
                        step_number=3,
                        approver_role="executive",
                        is_required=True,
                        depends_on_step=2,
                        authority_limit=Decimal("500000"),
                        deadline_hours=120
                    ))
                    
            elif workflow_type == WorkflowType.REGULATORY:
                # Regulatory workflow: Technical + compliance + management
                steps.append(ApprovalStep(
                    step_number=1,
                    approver_role="technical_lead",
                    is_required=True,
                    is_parallel=True,
                    deadline_hours=72
                ))
                
                steps.append(ApprovalStep(
                    step_number=1,
                    approver_role="compliance_officer",
                    is_required=True,
                    is_parallel=True,
                    deadline_hours=72
                ))
                
                steps.append(ApprovalStep(
                    step_number=2,
                    approver_role="project_manager",
                    is_required=True,
                    depends_on_step=1,
                    deadline_hours=48
                ))
                
            else:  # STANDARD workflow
                # Standard workflow: Project manager approval
                steps.append(ApprovalStep(
                    step_number=1,
                    approver_role="project_manager",
                    is_required=True,
                    deadline_hours=72
                ))
                
                # Add senior manager for higher cost impacts
                if cost_impact > 25000:
                    steps.append(ApprovalStep(
                        step_number=2,
                        approver_role="senior_manager",
                        is_required=True,
                        depends_on_step=1,
                        authority_limit=Decimal("100000"),
                        deadline_hours=72
                    ))
            
            return steps
            
        except Exception as e:
            logger.error(f"Error determining approval path: {e}")
            raise RuntimeError(f"Failed to determine approval path: {str(e)}")
    
    def check_approval_authority(
        self,
        user_id: UUID,
        change_value: Decimal,
        change_type: ChangeType,
        approver_role: str
    ) -> bool:
        """
        Check if user has approval authority for a change.
        
        Args:
            user_id: ID of the user
            change_value: Financial value of the change
            change_type: Type of change
            approver_role: Required approver role
            
        Returns:
            bool: True if user has authority
        """
        try:
            # Get user roles and authority limits
            user_result = self.db.table("user_profiles").select(
                "roles, approval_limits"
            ).eq("user_id", str(user_id)).execute()
            
            if not user_result.data:
                return False
            
            user_data = user_result.data[0]
            user_roles = user_data.get("roles", [])
            approval_limits = user_data.get("approval_limits", {})
            
            # Check if user has required role
            if approver_role not in user_roles:
                return False
            
            # Check authority limit for the role
            role_limit = approval_limits.get(approver_role)
            if role_limit and change_value > Decimal(str(role_limit)):
                return False
            
            # Special checks for specific change types
            if change_type == ChangeType.REGULATORY:
                if approver_role == "compliance_officer" and "compliance_officer" not in user_roles:
                    return False
            
            if change_type == ChangeType.SAFETY:
                if approver_role == "safety_officer" and "safety_officer" not in user_roles:
                    return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error checking approval authority for user {user_id}: {e}")
            return False
    
    async def _determine_workflow_type(self, change_data: Dict[str, Any]) -> WorkflowType:
        """
        Determine workflow type based on change characteristics (async version).
        
        Args:
            change_data: Change request data
            
        Returns:
            WorkflowType: Determined workflow type
        """
        return self._determine_workflow_type_sync(change_data)
    
    def _determine_workflow_type_sync(self, change_data: Dict[str, Any]) -> WorkflowType:
        """
        Determine workflow type based on change characteristics (sync version).
        
        Business rules precedence:
        1. Emergency priority (highest precedence)
        2. High cost impact (> $100k)
        3. Regulatory/Safety/Quality change types
        4. Critical priority
        5. Standard workflow (default)
        
        Args:
            change_data: Change request data
            
        Returns:
            WorkflowType: Determined workflow type
        """
        try:
            change_type = ChangeType(change_data["change_type"])
            priority = PriorityLevel(change_data["priority"])
            cost_impact = Decimal(str(change_data.get("estimated_cost_impact", 0)))
            
            # 1. Emergency changes (highest precedence)
            if priority == PriorityLevel.EMERGENCY:
                return WorkflowType.EMERGENCY
            
            # 2. High value changes (second precedence)
            if cost_impact > 100000:
                return WorkflowType.HIGH_VALUE
            
            # 3. Regulatory changes (third precedence)
            if change_type in [ChangeType.REGULATORY, ChangeType.SAFETY, ChangeType.QUALITY]:
                return WorkflowType.REGULATORY
            
            # 4. Expedited for critical priority (fourth precedence)
            if priority == PriorityLevel.CRITICAL:
                return WorkflowType.EXPEDITED
            
            # 5. Default to standard workflow
            return WorkflowType.STANDARD
            
        except Exception as e:
            logger.error(f"Error determining workflow type: {e}")
            return WorkflowType.STANDARD
    
    async def _create_approval_records(self, workflow_instance: WorkflowInstance) -> None:
        """
        Create approval records in database for workflow instance.
        
        Args:
            workflow_instance: Workflow instance to create records for
        """
        try:
            for step in workflow_instance.steps:
                # Find approver for the role
                approver_id = await self._find_approver_for_role(
                    step.approver_role,
                    workflow_instance.change_request_id
                )
                
                if not approver_id:
                    logger.warning(f"No approver found for role {step.approver_role}")
                    continue
                
                # Calculate due date
                due_date = datetime.utcnow() + timedelta(hours=step.deadline_hours)
                escalation_date = due_date + timedelta(hours=24)  # Escalate 24h after due
                
                approval_data = {
                    "change_request_id": str(workflow_instance.change_request_id),
                    "step_number": step.step_number,
                    "approver_id": str(approver_id),
                    "approver_role": step.approver_role,
                    "is_required": step.is_required,
                    "is_parallel": step.is_parallel,
                    "depends_on_step": step.depends_on_step,
                    "due_date": due_date.isoformat(),
                    "escalation_date": escalation_date.isoformat(),
                    "created_at": datetime.utcnow().isoformat(),
                    "updated_at": datetime.utcnow().isoformat()
                }
                
                self.db.table("change_approvals").insert(approval_data).execute()
                
        except Exception as e:
            logger.error(f"Error creating approval records: {e}")
            raise RuntimeError(f"Failed to create approval records: {str(e)}")
    
    async def _find_approver_for_role(
        self,
        approver_role: str,
        change_request_id: UUID
    ) -> Optional[UUID]:
        """
        Find an approver for a specific role.
        
        Args:
            approver_role: Role to find approver for
            change_request_id: Change request ID for context
            
        Returns:
            Optional[UUID]: Approver user ID if found
        """
        try:
            # Get project context
            change_result = self.db.table("change_requests").select(
                "project_id"
            ).eq("id", str(change_request_id)).execute()
            
            if not change_result.data:
                return None
            
            project_id = change_result.data[0]["project_id"]
            
            # Find approver based on role and project context
            if approver_role == "project_manager":
                # Find project manager for the project
                project_result = self.db.table("projects").select(
                    "manager_id"
                ).eq("id", project_id).execute()
                
                if project_result.data and project_result.data[0]["manager_id"]:
                    return UUID(project_result.data[0]["manager_id"])
            
            # Find user with the required role
            user_result = self.db.table("user_profiles").select(
                "user_id"
            ).contains("roles", [approver_role]).limit(1).execute()
            
            if user_result.data:
                return UUID(user_result.data[0]["user_id"])
            
            return None
            
        except Exception as e:
            logger.error(f"Error finding approver for role {approver_role}: {e}")
            return None
    
    async def _validate_approver_authority(
        self,
        approval_data: Dict[str, Any],
        approver_id: UUID
    ) -> bool:
        """
        Validate that approver has authority for the approval.
        
        Args:
            approval_data: Approval record data
            approver_id: ID of the approver
            
        Returns:
            bool: True if approver has authority
        """
        try:
            # Check if approver matches the assigned approver or escalated approver
            assigned_approver = UUID(approval_data["approver_id"])
            escalated_to = approval_data.get("escalated_to")
            
            if approver_id == assigned_approver:
                return True
            
            if escalated_to and approver_id == UUID(escalated_to):
                return True
            
            # Check if approver has delegation authority
            delegation_result = self.db.table("approval_delegations").select("*").eq(
                "delegator_id", str(assigned_approver)
            ).eq("delegate_id", str(approver_id)).eq("is_active", True).execute()
            
            if delegation_result.data:
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error validating approver authority: {e}")
            return False
    
    async def _process_workflow_progression(
        self,
        change_id: UUID,
        approval_id: UUID,
        decision: ApprovalDecision
    ) -> Tuple[str, List[ApprovalStep], bool]:
        """
        Process workflow progression after an approval decision.
        
        Args:
            change_id: Change request ID
            approval_id: Approval ID that was decided
            decision: Approval decision
            
        Returns:
            Tuple of (workflow_status, next_steps, is_complete)
        """
        try:
            if decision == ApprovalDecision.REJECTED:
                # Rejection terminates workflow
                await self._update_change_status(change_id, ChangeStatus.REJECTED)
                return "rejected", [], True
            
            if decision == ApprovalDecision.NEEDS_INFO:
                # Request for info pauses workflow
                await self._update_change_status(change_id, ChangeStatus.ON_HOLD)
                return "on_hold", [], False
            
            # For approved or delegated decisions, check if workflow is complete
            all_approvals = self.db.table("change_approvals").select("*").eq(
                "change_request_id", str(change_id)
            ).execute()
            
            if not all_approvals.data:
                return "error", [], False
            
            # Check if all required approvals are complete
            pending_required = []
            for approval in all_approvals.data:
                if approval["is_required"] and not approval["decision"]:
                    # Check dependencies
                    if approval["depends_on_step"]:
                        dependency_met = any(
                            a["step_number"] == approval["depends_on_step"] and 
                            a["decision"] == "approved"
                            for a in all_approvals.data
                        )
                        if dependency_met:
                            pending_required.append(approval)
                    else:
                        pending_required.append(approval)
            
            if not pending_required:
                # All required approvals complete
                await self._update_change_status(change_id, ChangeStatus.APPROVED)
                return "approved", [], True
            
            # Workflow continues with pending approvals
            next_steps = []
            for approval in pending_required:
                step = ApprovalStep(
                    step_number=approval["step_number"],
                    approver_role=approval["approver_role"],
                    approver_id=UUID(approval["approver_id"]),
                    is_required=approval["is_required"],
                    is_parallel=approval["is_parallel"],
                    depends_on_step=approval["depends_on_step"]
                )
                next_steps.append(step)
            
            return "in_progress", next_steps, False
            
        except Exception as e:
            logger.error(f"Error processing workflow progression: {e}")
            return "error", [], False
    
    async def _update_change_status(self, change_id: UUID, status: ChangeStatus) -> None:
        """
        Update change request status.
        
        Args:
            change_id: Change request ID
            status: New status
        """
        try:
            update_data = {
                "status": status.value,
                "updated_at": datetime.utcnow().isoformat()
            }
            
            self.db.table("change_requests").update(update_data).eq("id", str(change_id)).execute()
            
        except Exception as e:
            logger.error(f"Error updating change status: {e}")
            raise RuntimeError(f"Failed to update change status: {str(e)}")
    
    async def _find_escalation_target(
        self,
        original_approver: UUID,
        change_type: str,
        priority: str
    ) -> Optional[UUID]:
        """
        Find escalation target for overdue approval.
        
        Args:
            original_approver: Original approver ID
            change_type: Type of change
            priority: Priority level
            
        Returns:
            Optional[UUID]: Escalation target user ID
        """
        try:
            # Get original approver's manager
            user_result = self.db.table("user_profiles").select(
                "manager_id, roles"
            ).eq("user_id", str(original_approver)).execute()
            
            if user_result.data:
                manager_id = user_result.data[0].get("manager_id")
                if manager_id:
                    return UUID(manager_id)
            
            # Find backup approver with same role
            original_roles = user_result.data[0].get("roles", []) if user_result.data else []
            
            for role in original_roles:
                backup_result = self.db.table("user_profiles").select(
                    "user_id"
                ).contains("roles", [role]).neq("user_id", str(original_approver)).limit(1).execute()
                
                if backup_result.data:
                    return UUID(backup_result.data[0]["user_id"])
            
            return None
            
        except Exception as e:
            logger.error(f"Error finding escalation target: {e}")
            return None
    
    async def _log_audit_event(
        self,
        change_request_id: UUID,
        event_type: str,
        event_description: str,
        performed_by: Optional[UUID] = None,
        workflow_id: Optional[UUID] = None,
        related_entity_type: Optional[str] = None,
        related_entity_id: Optional[UUID] = None
    ) -> None:
        """
        Log audit event for approval workflow operations.
        
        Args:
            change_request_id: ID of the change request
            event_type: Type of event
            event_description: Description of the event
            performed_by: ID of the user who performed the action
            workflow_id: ID of the workflow instance
            related_entity_type: Type of related entity
            related_entity_id: ID of related entity
        """
        try:
            audit_data = {
                "change_request_id": str(change_request_id),
                "event_type": event_type,
                "event_description": event_description,
                "performed_by": str(performed_by) if performed_by else None,
                "performed_at": datetime.utcnow().isoformat(),
                "related_entity_type": related_entity_type,
                "related_entity_id": str(related_entity_id) if related_entity_id else None
            }
            
            if workflow_id:
                audit_data["new_values"] = {"workflow_id": str(workflow_id)}
            
            self.db.table("change_audit_log").insert(audit_data).execute()
            
        except Exception as e:
            logger.error(f"Error logging audit event: {e}")
            # Don't raise exception for audit logging failures

class ConditionalApprovalTracker:
    """Tracks conditional approval requirements and their fulfillment"""
    
    def __init__(self, approval_id: UUID, conditions: str):
        self.approval_id = approval_id
        self.conditions = conditions
        self.requirements = self._parse_conditions(conditions)
        self.fulfilled_requirements = []
        self.created_at = datetime.utcnow()
    
    def _parse_conditions(self, conditions: str) -> List[Dict[str, Any]]:
        """Parse conditions string into structured requirements"""
        # Simple parsing - in production this could be more sophisticated
        requirements = []
        if conditions:
            for i, condition in enumerate(conditions.split(';')):
                requirements.append({
                    'id': i + 1,
                    'description': condition.strip(),
                    'fulfilled': False,
                    'fulfilled_by': None,
                    'fulfilled_at': None
                })
        return requirements
    
    def fulfill_requirement(self, requirement_id: int, fulfilled_by: UUID) -> bool:
        """Mark a requirement as fulfilled"""
        for req in self.requirements:
            if req['id'] == requirement_id:
                req['fulfilled'] = True
                req['fulfilled_by'] = str(fulfilled_by)
                req['fulfilled_at'] = datetime.utcnow().isoformat()
                return True
        return False
    
    def are_all_requirements_fulfilled(self) -> bool:
        """Check if all requirements are fulfilled"""
        return all(req['fulfilled'] for req in self.requirements)

class ApprovalDecisionProcessor:
    """Handles complex approval decision processing logic"""
    
    def __init__(self, workflow_engine: 'ApprovalWorkflowEngine'):
        self.workflow_engine = workflow_engine
        self.db = workflow_engine.db
        self.conditional_trackers: Dict[UUID, ConditionalApprovalTracker] = {}
    
    async def process_approval_decision_advanced(
        self,
        approval_id: UUID,
        decision: ApprovalDecision,
        approver_id: UUID,
        comments: Optional[str] = None,
        conditions: Optional[str] = None,
        delegation_target: Optional[UUID] = None
    ) -> ApprovalResult:
        """
        Advanced approval decision processing with conditional approvals and delegation.
        
        Args:
            approval_id: ID of the approval record
            decision: Approval decision
            approver_id: ID of the approver
            comments: Optional comments
            conditions: Optional conditions for conditional approval
            delegation_target: Target user for delegation
            
        Returns:
            ApprovalResult: Result of the decision processing
        """
        try:
            # Get approval record
            approval_result = self.db.table("change_approvals").select("*").eq("id", str(approval_id)).execute()
            if not approval_result.data:
                raise ValueError(f"Approval {approval_id} not found")
            
            approval_data = approval_result.data[0]
            change_id = UUID(approval_data["change_request_id"])
            
            # Validate approver authority
            if not await self.workflow_engine._validate_approver_authority(approval_data, approver_id):
                raise ValueError("Approver does not have authority for this approval")
            
            # Process different decision types
            if decision == ApprovalDecision.DELEGATED:
                return await self._process_delegation(
                    approval_id, approver_id, delegation_target, comments
                )
            
            elif decision == ApprovalDecision.APPROVED and conditions:
                return await self._process_conditional_approval(
                    approval_id, approver_id, conditions, comments
                )
            
            elif decision == ApprovalDecision.NEEDS_INFO:
                return await self._process_information_request(
                    approval_id, approver_id, comments
                )
            
            else:
                # Standard approval or rejection
                return await self._process_standard_decision(
                    approval_id, decision, approver_id, comments
                )
                
        except Exception as e:
            logger.error(f"Error processing advanced approval decision {approval_id}: {e}")
            raise RuntimeError(f"Failed to process approval decision: {str(e)}")
    
    async def _process_delegation(
        self,
        approval_id: UUID,
        delegator_id: UUID,
        delegation_target: UUID,
        comments: Optional[str]
    ) -> ApprovalResult:
        """Process approval delegation"""
        try:
            # Validate delegation target has appropriate authority
            approval_data = self.db.table("change_approvals").select("*").eq("id", str(approval_id)).execute().data[0]
            change_data = self.db.table("change_requests").select("*").eq("id", approval_data["change_request_id"]).execute().data[0]
            
            change_value = Decimal(str(change_data.get("estimated_cost_impact", 0)))
            change_type = ChangeType(change_data["change_type"])
            
            if not self.workflow_engine.check_approval_authority(
                delegation_target, change_value, change_type, approval_data["approver_role"]
            ):
                raise ValueError("Delegation target does not have sufficient authority")
            
            # Create delegation record
            delegation_data = {
                "delegator_id": str(delegator_id),
                "delegate_id": str(delegation_target),
                "approval_id": str(approval_id),
                "delegation_reason": comments or "Approval delegated",
                "is_active": True,
                "created_at": datetime.utcnow().isoformat()
            }
            
            self.db.table("approval_delegations").insert(delegation_data).execute()
            
            # Update approval record
            update_data = {
                "decision": ApprovalDecision.DELEGATED.value,
                "decision_date": datetime.utcnow().isoformat(),
                "comments": comments,
                "delegated_to": str(delegation_target),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            self.db.table("change_approvals").update(update_data).eq("id", str(approval_id)).execute()
            
            # Log delegation
            await self.workflow_engine._log_audit_event(
                change_request_id=UUID(approval_data["change_request_id"]),
                event_type="approval_delegated",
                event_description=f"Approval delegated to {delegation_target}",
                performed_by=delegator_id,
                related_entity_type="approval",
                related_entity_id=approval_id
            )
            
            return ApprovalResult(
                approval_id=approval_id,
                decision=ApprovalDecision.DELEGATED,
                workflow_status="delegated",
                next_steps=[],
                is_complete=False
            )
            
        except Exception as e:
            logger.error(f"Error processing delegation: {e}")
            raise RuntimeError(f"Failed to process delegation: {str(e)}")
    
    async def _process_conditional_approval(
        self,
        approval_id: UUID,
        approver_id: UUID,
        conditions: str,
        comments: Optional[str]
    ) -> ApprovalResult:
        """Process conditional approval with requirement tracking"""
        try:
            # Create conditional approval tracker
            tracker = ConditionalApprovalTracker(approval_id, conditions)
            self.conditional_trackers[approval_id] = tracker
            
            # Update approval record
            update_data = {
                "decision": ApprovalDecision.APPROVED.value,
                "decision_date": datetime.utcnow().isoformat(),
                "comments": comments,
                "conditions": conditions,
                "updated_at": datetime.utcnow().isoformat()
            }
            
            self.db.table("change_approvals").update(update_data).eq("id", str(approval_id)).execute()
            
            # Create conditional approval requirements record
            requirements_data = {
                "approval_id": str(approval_id),
                "conditions": conditions,
                "requirements": tracker.requirements,
                "all_fulfilled": False,
                "created_at": datetime.utcnow().isoformat()
            }
            
            self.db.table("conditional_approval_requirements").insert(requirements_data).execute()
            
            # Log conditional approval
            approval_data = self.db.table("change_approvals").select("change_request_id").eq("id", str(approval_id)).execute().data[0]
            await self.workflow_engine._log_audit_event(
                change_request_id=UUID(approval_data["change_request_id"]),
                event_type="conditional_approval",
                event_description=f"Conditional approval granted with {len(tracker.requirements)} requirements",
                performed_by=approver_id,
                related_entity_type="approval",
                related_entity_id=approval_id
            )
            
            return ApprovalResult(
                approval_id=approval_id,
                decision=ApprovalDecision.APPROVED,
                workflow_status="conditional_approval",
                next_steps=[],
                is_complete=False
            )
            
        except Exception as e:
            logger.error(f"Error processing conditional approval: {e}")
            raise RuntimeError(f"Failed to process conditional approval: {str(e)}")
    
    async def _process_information_request(
        self,
        approval_id: UUID,
        approver_id: UUID,
        information_needed: Optional[str]
    ) -> ApprovalResult:
        """Process request for additional information"""
        try:
            # Update approval record
            update_data = {
                "decision": ApprovalDecision.NEEDS_INFO.value,
                "decision_date": datetime.utcnow().isoformat(),
                "comments": information_needed,
                "updated_at": datetime.utcnow().isoformat()
            }
            
            self.db.table("change_approvals").update(update_data).eq("id", str(approval_id)).execute()
            
            # Get change request and update status
            approval_data = self.db.table("change_approvals").select("change_request_id").eq("id", str(approval_id)).execute().data[0]
            change_id = UUID(approval_data["change_request_id"])
            
            await self.workflow_engine._update_change_status(change_id, ChangeStatus.ON_HOLD)
            
            # Create information request record
            info_request_data = {
                "change_request_id": str(change_id),
                "approval_id": str(approval_id),
                "requested_by": str(approver_id),
                "information_needed": information_needed,
                "status": "pending",
                "created_at": datetime.utcnow().isoformat()
            }
            
            self.db.table("information_requests").insert(info_request_data).execute()
            
            # Log information request
            await self.workflow_engine._log_audit_event(
                change_request_id=change_id,
                event_type="information_requested",
                event_description="Additional information requested",
                performed_by=approver_id,
                related_entity_type="approval",
                related_entity_id=approval_id
            )
            
            return ApprovalResult(
                approval_id=approval_id,
                decision=ApprovalDecision.NEEDS_INFO,
                workflow_status="information_requested",
                next_steps=[],
                is_complete=False
            )
            
        except Exception as e:
            logger.error(f"Error processing information request: {e}")
            raise RuntimeError(f"Failed to process information request: {str(e)}")
    
    async def _process_standard_decision(
        self,
        approval_id: UUID,
        decision: ApprovalDecision,
        approver_id: UUID,
        comments: Optional[str]
    ) -> ApprovalResult:
        """Process standard approval or rejection decision"""
        try:
            # Get approval record first
            approval_result = self.db.table("change_approvals").select("*").eq("id", str(approval_id)).execute()
            if not approval_result.data:
                raise ValueError(f"Approval {approval_id} not found")
            
            approval_data = approval_result.data[0]
            change_id = UUID(approval_data["change_request_id"])
            
            # CRITICAL: Validate dependencies before allowing approval
            if decision == ApprovalDecision.APPROVED and approval_data.get("depends_on_step"):
                await self._validate_approval_dependencies(approval_data, change_id)
            
            # Update approval record
            update_data = {
                "decision": decision.value,
                "decision_date": datetime.utcnow().isoformat(),
                "comments": comments,
                "updated_at": datetime.utcnow().isoformat()
            }
            
            self.db.table("change_approvals").update(update_data).eq("id", str(approval_id)).execute()
            
            # Log decision
            await self.workflow_engine._log_audit_event(
                change_request_id=change_id,
                event_type="approval_decision",
                event_description=f"Approval decision: {decision.value}",
                performed_by=approver_id,
                related_entity_type="approval",
                related_entity_id=approval_id
            )
            
            # Process workflow progression
            workflow_status, next_steps, is_complete = await self.workflow_engine._process_workflow_progression(
                change_id, approval_id, decision
            )
            
            return ApprovalResult(
                approval_id=approval_id,
                decision=decision,
                workflow_status=workflow_status,
                next_steps=next_steps,
                is_complete=is_complete
            )
            
        except Exception as e:
            logger.error(f"Error processing standard decision: {e}")
            raise RuntimeError(f"Failed to process standard decision: {str(e)}")
    
    async def _validate_approval_dependencies(
        self,
        approval_data: Dict[str, Any],
        change_id: UUID
    ) -> None:
        """
        Validate that all dependencies for an approval are satisfied.
        
        Args:
            approval_data: The approval record being processed
            change_id: The change request ID
            
        Raises:
            ValueError: If dependencies are not satisfied
        """
        depends_on_step = approval_data.get("depends_on_step")
        if not depends_on_step:
            return  # No dependencies to validate
        
        # Get all approvals for this change request
        all_approvals = self.db.table("change_approvals").select("*").eq(
            "change_request_id", str(change_id)
        ).execute()
        
        if not all_approvals.data:
            raise ValueError("No approvals found for change request")
        
        # Find the dependency approval
        dependency_approval = None
        for approval in all_approvals.data:
            if approval["step_number"] == depends_on_step:
                dependency_approval = approval
                break
        
        if not dependency_approval:
            raise ValueError(f"Dependency approval for step {depends_on_step} not found")
        
        # Check if dependency is approved
        if dependency_approval["decision"] != ApprovalDecision.APPROVED.value:
            raise ValueError(
                f"Cannot approve step {approval_data['step_number']} because "
                f"dependency step {depends_on_step} is not approved "
                f"(current status: {dependency_approval.get('decision', 'pending')})"
            )
    
    async def fulfill_conditional_requirement(
        self,
        approval_id: UUID,
        requirement_id: int,
        fulfilled_by: UUID,
        evidence: Optional[str] = None
    ) -> bool:
        """
        Fulfill a conditional approval requirement.
        
        Args:
            approval_id: ID of the approval with conditions
            requirement_id: ID of the requirement to fulfill
            fulfilled_by: User fulfilling the requirement
            evidence: Optional evidence of fulfillment
            
        Returns:
            bool: True if requirement was fulfilled and workflow can proceed
        """
        try:
            tracker = self.conditional_trackers.get(approval_id)
            if not tracker:
                # Load tracker from database
                req_result = self.db.table("conditional_approval_requirements").select("*").eq(
                    "approval_id", str(approval_id)
                ).execute()
                
                if not req_result.data:
                    return False
                
                req_data = req_result.data[0]
                tracker = ConditionalApprovalTracker(approval_id, req_data["conditions"])
                tracker.requirements = req_data["requirements"]
                self.conditional_trackers[approval_id] = tracker
            
            # Fulfill the requirement
            if not tracker.fulfill_requirement(requirement_id, fulfilled_by):
                return False
            
            # Update database
            update_data = {
                "requirements": tracker.requirements,
                "updated_at": datetime.utcnow().isoformat()
            }
            
            # Check if all requirements are fulfilled
            if tracker.are_all_requirements_fulfilled():
                update_data["all_fulfilled"] = True
                update_data["fulfilled_at"] = datetime.utcnow().isoformat()
                
                # Resume workflow progression
                approval_data = self.db.table("change_approvals").select("change_request_id").eq("id", str(approval_id)).execute().data[0]
                change_id = UUID(approval_data["change_request_id"])
                
                await self.workflow_engine._process_workflow_progression(
                    change_id, approval_id, ApprovalDecision.APPROVED
                )
            
            self.db.table("conditional_approval_requirements").update(update_data).eq(
                "approval_id", str(approval_id)
            ).execute()
            
            return True
            
        except Exception as e:
            logger.error(f"Error fulfilling conditional requirement: {e}")
            return False
    
    async def get_conditional_requirements(self, approval_id: UUID) -> Optional[Dict[str, Any]]:
        """Get conditional requirements for an approval"""
        try:
            result = self.db.table("conditional_approval_requirements").select("*").eq(
                "approval_id", str(approval_id)
            ).execute()
            
            if result.data:
                return result.data[0]
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting conditional requirements: {e}")
            return None

class AutomaticWorkflowProgression:
    """Handles automatic workflow progression logic"""
    
    def __init__(self, workflow_engine: 'ApprovalWorkflowEngine'):
        self.workflow_engine = workflow_engine
        self.db = workflow_engine.db
    
    async def check_and_advance_workflows(self) -> List[Dict[str, Any]]:
        """
        Check all active workflows and advance them if conditions are met.
        
        Returns:
            List of workflow advancement results
        """
        try:
            # Find workflows that might be ready to advance
            pending_changes = self.db.table("change_requests").select("id").eq(
                "status", "pending_approval"
            ).execute()
            
            advancement_results = []
            
            for change in pending_changes.data:
                change_id = UUID(change["id"])
                result = await self._check_workflow_advancement(change_id)
                if result:
                    advancement_results.append(result)
            
            return advancement_results
            
        except Exception as e:
            logger.error(f"Error checking workflow advancement: {e}")
            return []
    
    async def _check_workflow_advancement(self, change_id: UUID) -> Optional[Dict[str, Any]]:
        """Check if a specific workflow can be advanced"""
        try:
            # Get all approvals for the change
            approvals = self.db.table("change_approvals").select("*").eq(
                "change_request_id", str(change_id)
            ).execute()
            
            if not approvals.data:
                return None
            
            # Check parallel approvals
            parallel_groups = {}
            sequential_steps = {}
            
            for approval in approvals.data:
                step_num = approval["step_number"]
                
                if approval["is_parallel"]:
                    if step_num not in parallel_groups:
                        parallel_groups[step_num] = []
                    parallel_groups[step_num].append(approval)
                else:
                    sequential_steps[step_num] = approval
            
            # Check if any parallel groups are complete
            for step_num, group in parallel_groups.items():
                if self._is_parallel_group_complete(group):
                    # Activate dependent steps
                    await self._activate_dependent_steps(change_id, step_num)
            
            # Check if workflow is complete
            if self._is_workflow_complete(approvals.data):
                await self.workflow_engine._update_change_status(change_id, ChangeStatus.APPROVED)
                return {
                    "change_id": str(change_id),
                    "status": "completed",
                    "action": "workflow_completed"
                }
            
            return None
            
        except Exception as e:
            logger.error(f"Error checking workflow advancement for {change_id}: {e}")
            return None
    
    def _is_parallel_group_complete(self, group: List[Dict[str, Any]]) -> bool:
        """Check if a parallel approval group is complete"""
        required_approvals = [a for a in group if a["is_required"]]
        
        for approval in required_approvals:
            if not approval["decision"] or approval["decision"] not in ["approved"]:
                return False
        
        return True
    
    async def _activate_dependent_steps(self, change_id: UUID, completed_step: int) -> None:
        """Activate steps that depend on a completed step"""
        try:
            # Find dependent steps
            dependent_approvals = self.db.table("change_approvals").select("*").eq(
                "change_request_id", str(change_id)
            ).eq("depends_on_step", completed_step).execute()
            
            for approval in dependent_approvals.data:
                if not approval["decision"]:
                    # Send notification to approver
                    # This would integrate with the notification system
                    logger.info(f"Activating dependent approval {approval['id']}")
            
        except Exception as e:
            logger.error(f"Error activating dependent steps: {e}")
    
    def _is_workflow_complete(self, approvals: List[Dict[str, Any]]) -> bool:
        """Check if entire workflow is complete"""
        required_approvals = [a for a in approvals if a["is_required"]]
        
        for approval in required_approvals:
            if not approval["decision"] or approval["decision"] not in ["approved"]:
                return False
        
        return True

class DeadlineManager:
    """Manages approval deadlines and reminder notifications"""
    
    def __init__(self, workflow_engine: 'ApprovalWorkflowEngine'):
        self.workflow_engine = workflow_engine
        self.db = workflow_engine.db
    
    async def send_deadline_reminders(self) -> List[Dict[str, Any]]:
        """
        Send reminder notifications for approaching deadlines.
        
        Returns:
            List of reminder results
        """
        try:
            # Find approvals with approaching deadlines (within 24 hours)
            reminder_threshold = datetime.utcnow() + timedelta(hours=24)
            
            approaching_deadlines = self.db.table("change_approvals").select(
                "*, change_requests(change_number, title, priority)"
            ).is_("decision", "null").lte(
                "due_date", reminder_threshold.isoformat()
            ).gte(
                "due_date", datetime.utcnow().isoformat()
            ).execute()
            
            reminder_results = []
            
            for approval in approaching_deadlines.data:
                # Check if reminder was already sent recently
                if await self._was_reminder_sent_recently(UUID(approval["id"])):
                    continue
                
                # Send reminder notification
                reminder_sent = await self._send_deadline_reminder(approval)
                
                if reminder_sent:
                    # Record reminder sent
                    await self._record_reminder_sent(UUID(approval["id"]))
                    
                    reminder_results.append({
                        "approval_id": approval["id"],
                        "approver_id": approval["approver_id"],
                        "change_number": approval["change_requests"]["change_number"],
                        "due_date": approval["due_date"],
                        "reminder_sent": True
                    })
            
            return reminder_results
            
        except Exception as e:
            logger.error(f"Error sending deadline reminders: {e}")
            return []
    
    async def _was_reminder_sent_recently(self, approval_id: UUID, hours: int = 12) -> bool:
        """Check if reminder was sent recently"""
        try:
            cutoff_time = datetime.utcnow() - timedelta(hours=hours)
            
            result = self.db.table("approval_reminders").select("id").eq(
                "approval_id", str(approval_id)
            ).gte("sent_at", cutoff_time.isoformat()).execute()
            
            return len(result.data) > 0
            
        except Exception as e:
            logger.error(f"Error checking recent reminders: {e}")
            return False
    
    async def _send_deadline_reminder(self, approval_data: Dict[str, Any]) -> bool:
        """Send deadline reminder notification"""
        try:
            # This would integrate with the notification system
            # For now, we'll just log and record the reminder
            
            logger.info(f"Sending deadline reminder for approval {approval_data['id']}")
            
            # In a real implementation, this would:
            # 1. Get approver's notification preferences
            # 2. Send email/in-app notification
            # 3. Handle delivery failures
            
            return True
            
        except Exception as e:
            logger.error(f"Error sending deadline reminder: {e}")
            return False
    
    async def _record_reminder_sent(self, approval_id: UUID) -> None:
        """Record that a reminder was sent"""
        try:
            reminder_data = {
                "approval_id": str(approval_id),
                "reminder_type": "deadline_approaching",
                "sent_at": datetime.utcnow().isoformat(),
                "delivery_status": "sent"
            }
            
            self.db.table("approval_reminders").insert(reminder_data).execute()
            
        except Exception as e:
            logger.error(f"Error recording reminder: {e}")
    
    async def update_approval_deadline(
        self,
        approval_id: UUID,
        new_deadline: datetime,
        updated_by: UUID,
        reason: str
    ) -> bool:
        """
        Update approval deadline.
        
        Args:
            approval_id: ID of the approval
            new_deadline: New deadline
            updated_by: User making the update
            reason: Reason for deadline change
            
        Returns:
            bool: True if successful
        """
        try:
            # Get current approval data
            approval_result = self.db.table("change_approvals").select("*").eq("id", str(approval_id)).execute()
            if not approval_result.data:
                return False
            
            approval_data = approval_result.data[0]
            old_deadline = approval_data.get("due_date")
            
            # Update deadline
            update_data = {
                "due_date": new_deadline.isoformat(),
                "escalation_date": (new_deadline + timedelta(hours=24)).isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            self.db.table("change_approvals").update(update_data).eq("id", str(approval_id)).execute()
            
            # Log deadline change
            await self.workflow_engine._log_audit_event(
                change_request_id=UUID(approval_data["change_request_id"]),
                event_type="deadline_updated",
                event_description=f"Approval deadline updated: {reason}",
                performed_by=updated_by,
                old_values={"due_date": old_deadline},
                new_values={"due_date": new_deadline.isoformat()},
                related_entity_type="approval",
                related_entity_id=approval_id
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Error updating approval deadline: {e}")
            return False

class EscalationManager:
    """Manages approval escalations and backup approver functionality"""
    
    def __init__(self, workflow_engine: 'ApprovalWorkflowEngine'):
        self.workflow_engine = workflow_engine
        self.db = workflow_engine.db
    
    async def process_escalations(self) -> List[EscalationResult]:
        """
        Process all pending escalations.
        
        Returns:
            List[EscalationResult]: List of escalation results
        """
        try:
            # Find overdue approvals that need escalation
            overdue_approvals = await self._find_overdue_approvals()
            
            escalation_results = []
            
            for approval in overdue_approvals:
                escalation_result = await self._escalate_approval(approval)
                if escalation_result:
                    escalation_results.append(escalation_result)
            
            return escalation_results
            
        except Exception as e:
            logger.error(f"Error processing escalations: {e}")
            return []
    
    async def _find_overdue_approvals(self) -> List[Dict[str, Any]]:
        """Find approvals that are overdue and need escalation"""
        try:
            current_time = datetime.utcnow()
            
            # Find approvals past escalation date that haven't been escalated
            overdue_query = """
                SELECT ca.*, cr.priority, cr.change_type, cr.change_number, cr.title
                FROM change_approvals ca
                JOIN change_requests cr ON ca.change_request_id = cr.id
                WHERE ca.decision IS NULL
                AND ca.escalation_date < %s
                AND ca.escalated_to IS NULL
                AND cr.status = 'pending_approval'
                ORDER BY cr.priority DESC, ca.escalation_date ASC
            """
            
            result = self.db.rpc("execute_sql", {
                "query": overdue_query,
                "params": [current_time.isoformat()]
            }).execute()
            
            return result.data
            
        except Exception as e:
            logger.error(f"Error finding overdue approvals: {e}")
            return []
    
    async def _escalate_approval(self, approval_data: Dict[str, Any]) -> Optional[EscalationResult]:
        """Escalate a single approval"""
        try:
            approval_id = UUID(approval_data["id"])
            original_approver = UUID(approval_data["approver_id"])
            
            # Find escalation target
            escalation_target = await self._find_escalation_target(
                original_approver,
                approval_data["change_type"],
                approval_data["priority"]
            )
            
            if not escalation_target:
                logger.warning(f"No escalation target found for approval {approval_id}")
                return None
            
            # Update approval record
            escalation_data = {
                "escalated_to": str(escalation_target),
                "escalation_date": datetime.utcnow().isoformat(),
                "escalation_reason": "overdue_deadline",
                "updated_at": datetime.utcnow().isoformat()
            }
            
            self.db.table("change_approvals").update(escalation_data).eq("id", str(approval_id)).execute()
            
            # Create escalation record
            escalation_record = {
                "approval_id": str(approval_id),
                "original_approver": str(original_approver),
                "escalated_to": str(escalation_target),
                "escalation_reason": "overdue_deadline",
                "escalation_type": "automatic",
                "escalated_at": datetime.utcnow().isoformat()
            }
            
            self.db.table("approval_escalations").insert(escalation_record).execute()
            
            # Send escalation notification
            await self._send_escalation_notification(approval_data, escalation_target)
            
            # Log escalation
            await self.workflow_engine._log_audit_event(
                change_request_id=UUID(approval_data["change_request_id"]),
                event_type="approval_escalated",
                event_description=f"Approval escalated due to overdue deadline",
                related_entity_type="approval",
                related_entity_id=approval_id
            )
            
            return EscalationResult(
                approval_id=approval_id,
                escalated_to=escalation_target,
                escalation_reason="overdue_deadline",
                original_approver=original_approver
            )
            
        except Exception as e:
            logger.error(f"Error escalating approval: {e}")
            return None
    
    async def _send_escalation_notification(
        self,
        approval_data: Dict[str, Any],
        escalation_target: UUID
    ) -> None:
        """Send notification about escalation"""
        try:
            # This would integrate with the notification system
            logger.info(f"Sending escalation notification to {escalation_target} for approval {approval_data['id']}")
            
            # In a real implementation, this would:
            # 1. Send urgent notification to escalation target
            # 2. Notify original approver about escalation
            # 3. Notify change requestor about escalation
            
        except Exception as e:
            logger.error(f"Error sending escalation notification: {e}")
    
    async def delegate_approval(
        self,
        approval_id: UUID,
        delegator_id: UUID,
        delegate_id: UUID,
        delegation_reason: str,
        delegation_duration: Optional[timedelta] = None
    ) -> bool:
        """
        Delegate an approval to another user.
        
        Args:
            approval_id: ID of the approval to delegate
            delegator_id: ID of the user delegating
            delegate_id: ID of the user receiving delegation
            delegation_reason: Reason for delegation
            delegation_duration: Optional duration for delegation
            
        Returns:
            bool: True if successful
        """
        try:
            # Validate delegation
            approval_result = self.db.table("change_approvals").select("*").eq("id", str(approval_id)).execute()
            if not approval_result.data:
                return False
            
            approval_data = approval_result.data[0]
            
            # Check if delegator has authority
            if UUID(approval_data["approver_id"]) != delegator_id:
                return False
            
            # Validate delegate has appropriate authority
            change_result = self.db.table("change_requests").select("*").eq("id", approval_data["change_request_id"]).execute()
            if not change_result.data:
                return False
            
            change_data = change_result.data[0]
            change_value = Decimal(str(change_data.get("estimated_cost_impact", 0)))
            change_type = ChangeType(change_data["change_type"])
            
            if not self.workflow_engine.check_approval_authority(
                delegate_id, change_value, change_type, approval_data["approver_role"]
            ):
                return False
            
            # Create delegation record
            expiry_date = None
            if delegation_duration:
                expiry_date = (datetime.utcnow() + delegation_duration).isoformat()
            
            delegation_data = {
                "approval_id": str(approval_id),
                "delegator_id": str(delegator_id),
                "delegate_id": str(delegate_id),
                "delegation_reason": delegation_reason,
                "is_active": True,
                "expires_at": expiry_date,
                "created_at": datetime.utcnow().isoformat()
            }
            
            self.db.table("approval_delegations").insert(delegation_data).execute()
            
            # Update approval record
            update_data = {
                "delegated_to": str(delegate_id),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            self.db.table("change_approvals").update(update_data).eq("id", str(approval_id)).execute()
            
            # Log delegation
            await self.workflow_engine._log_audit_event(
                change_request_id=UUID(approval_data["change_request_id"]),
                event_type="approval_delegated",
                event_description=f"Approval delegated: {delegation_reason}",
                performed_by=delegator_id,
                related_entity_type="approval",
                related_entity_id=approval_id
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Error delegating approval: {e}")
            return False
    
    async def setup_backup_approver(
        self,
        primary_approver: UUID,
        backup_approver: UUID,
        approver_role: str,
        is_active: bool = True
    ) -> bool:
        """
        Set up backup approver for a role.
        
        Args:
            primary_approver: Primary approver user ID
            backup_approver: Backup approver user ID
            approver_role: Role for which backup is being set
            is_active: Whether backup is active
            
        Returns:
            bool: True if successful
        """
        try:
            # Validate backup approver has appropriate authority
            # This would check against role requirements and authority limits
            
            backup_data = {
                "primary_approver": str(primary_approver),
                "backup_approver": str(backup_approver),
                "approver_role": approver_role,
                "is_active": is_active,
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            # Check if backup already exists
            existing = self.db.table("backup_approvers").select("id").eq(
                "primary_approver", str(primary_approver)
            ).eq("approver_role", approver_role).execute()
            
            if existing.data:
                # Update existing backup
                self.db.table("backup_approvers").update(backup_data).eq("id", existing.data[0]["id"]).execute()
            else:
                # Create new backup
                self.db.table("backup_approvers").insert(backup_data).execute()
            
            return True
            
        except Exception as e:
            logger.error(f"Error setting up backup approver: {e}")
            return False
    
    async def get_backup_approver(self, primary_approver: UUID, approver_role: str) -> Optional[UUID]:
        """Get backup approver for a primary approver and role"""
        try:
            result = self.db.table("backup_approvers").select("backup_approver").eq(
                "primary_approver", str(primary_approver)
            ).eq("approver_role", approver_role).eq("is_active", True).execute()
            
            if result.data:
                return UUID(result.data[0]["backup_approver"])
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting backup approver: {e}")
            return None
    
    async def cleanup_expired_delegations(self) -> int:
        """Clean up expired delegations"""
        try:
            current_time = datetime.utcnow()
            
            # Find expired delegations
            expired = self.db.table("approval_delegations").select("id").eq(
                "is_active", True
            ).lt("expires_at", current_time.isoformat()).execute()
            
            if not expired.data:
                return 0
            
            # Deactivate expired delegations
            expired_ids = [d["id"] for d in expired.data]
            
            self.db.table("approval_delegations").update({
                "is_active": False,
                "updated_at": current_time.isoformat()
            }).in_("id", expired_ids).execute()
            
            return len(expired_ids)
            
        except Exception as e:
            logger.error(f"Error cleaning up expired delegations: {e}")
            return 0