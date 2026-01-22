"""
Workflow Engine Models

Pydantic models for workflow definitions, instances, and approvals.
These models represent the core entities in the workflow engine system.
"""

from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import Dict, Any, List, Optional
from uuid import UUID
from enum import Enum


class WorkflowStatus(str, Enum):
    """Workflow and workflow instance status"""
    DRAFT = "draft"
    ACTIVE = "active"
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    REJECTED = "rejected"
    CANCELLED = "cancelled"
    SUSPENDED = "suspended"


class ApprovalStatus(str, Enum):
    """Approval decision status"""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    DELEGATED = "delegated"
    EXPIRED = "expired"


class StepType(str, Enum):
    """Type of workflow step"""
    APPROVAL = "approval"
    NOTIFICATION = "notification"
    CONDITION = "condition"
    AUTOMATED = "automated"


class ApprovalType(str, Enum):
    """Type of approval required for a step"""
    ANY = "any"  # Any one approver can approve
    ALL = "all"  # All approvers must approve
    MAJORITY = "majority"  # Majority of approvers must approve
    QUORUM = "quorum"  # Specific number of approvers must approve


class RejectionAction(str, Enum):
    """Action to take when a workflow is rejected"""
    STOP = "stop"  # Stop the workflow (default)
    RESTART = "restart"  # Restart the workflow from the beginning
    ESCALATE = "escalate"  # Escalate to a higher authority


class WorkflowTrigger(BaseModel):
    """Workflow trigger configuration"""
    trigger_type: str = Field(..., description="Type of trigger (e.g., 'budget_change', 'milestone_update')")
    conditions: Dict[str, Any] = Field(default_factory=dict, description="Trigger conditions")
    threshold_values: Optional[Dict[str, float]] = Field(None, description="Threshold values for trigger")
    enabled: bool = Field(default=True, description="Whether trigger is enabled")

    class Config:
        json_schema_extra = {
            "example": {
                "trigger_type": "budget_change",
                "conditions": {"variance_type": "cost"},
                "threshold_values": {"percentage": 10.0},
                "enabled": True
            }
        }


class WorkflowStep(BaseModel):
    """Workflow step definition"""
    step_order: int = Field(..., ge=0, description="Order of step in workflow (0-indexed)")
    step_type: StepType = Field(default=StepType.APPROVAL, description="Type of step")
    name: str = Field(..., min_length=1, max_length=255, description="Name of the step")
    description: Optional[str] = Field(None, description="Description of the step")
    approvers: List[UUID] = Field(default_factory=list, description="List of approver user IDs")
    approver_roles: List[str] = Field(default_factory=list, description="List of approver role names")
    approval_type: ApprovalType = Field(default=ApprovalType.ALL, description="Type of approval required")
    quorum_count: Optional[int] = Field(None, ge=1, description="Number of approvals needed for quorum")
    conditions: Optional[Dict[str, Any]] = Field(None, description="Conditions for step execution")
    timeout_hours: Optional[int] = Field(None, ge=1, description="Timeout in hours for step completion")
    auto_approve_conditions: Optional[Dict[str, Any]] = Field(None, description="Conditions for auto-approval")
    notification_template: Optional[str] = Field(None, description="Notification template for step")
    rejection_action: RejectionAction = Field(default=RejectionAction.STOP, description="Action to take on rejection")
    escalation_approvers: List[UUID] = Field(default_factory=list, description="Approvers for escalation")
    escalation_roles: List[str] = Field(default_factory=list, description="Roles for escalation")

    @validator('quorum_count')
    def validate_quorum(cls, v, values):
        """Validate quorum count is appropriate for approval type"""
        if v is not None and values.get('approval_type') != ApprovalType.QUORUM:
            raise ValueError("quorum_count only valid for QUORUM approval type")
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "step_order": 0,
                "step_type": "approval",
                "name": "Budget Approval",
                "description": "Approve budget variance",
                "approvers": [],
                "approver_roles": ["portfolio_manager"],
                "approval_type": "all",
                "timeout_hours": 72
            }
        }


class WorkflowDefinition(BaseModel):
    """Workflow definition model"""
    id: Optional[UUID] = Field(None, description="Workflow ID (generated on creation)")
    name: str = Field(..., min_length=1, max_length=255, description="Workflow name")
    description: Optional[str] = Field(None, description="Workflow description")
    steps: List[WorkflowStep] = Field(..., min_items=1, description="Workflow steps")
    triggers: List[WorkflowTrigger] = Field(default_factory=list, description="Workflow triggers")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")
    status: WorkflowStatus = Field(default=WorkflowStatus.DRAFT, description="Workflow status")
    version: int = Field(default=1, ge=1, description="Workflow version")
    created_by: Optional[UUID] = Field(None, description="User who created the workflow")
    created_at: Optional[datetime] = Field(None, description="Creation timestamp")
    updated_at: Optional[datetime] = Field(None, description="Last update timestamp")

    @validator('steps')
    def validate_steps_order(cls, v):
        """Validate steps have sequential order starting from 0"""
        if not v:
            raise ValueError("At least one step is required")
        
        orders = [step.step_order for step in v]
        expected_orders = list(range(len(v)))
        
        if sorted(orders) != expected_orders:
            raise ValueError(f"Steps must have sequential order starting from 0, got {orders}")
        
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Budget Approval Workflow",
                "description": "Approval workflow for budget variances",
                "steps": [
                    {
                        "step_order": 0,
                        "step_type": "approval",
                        "name": "Manager Approval",
                        "approver_roles": ["project_manager"],
                        "approval_type": "all"
                    }
                ],
                "triggers": [
                    {
                        "trigger_type": "budget_change",
                        "conditions": {"variance_type": "cost"},
                        "threshold_values": {"percentage": 10.0}
                    }
                ],
                "status": "active"
            }
        }


class WorkflowInstance(BaseModel):
    """Workflow instance model"""
    id: Optional[UUID] = Field(None, description="Instance ID (generated on creation)")
    workflow_id: UUID = Field(..., description="Workflow definition ID")
    workflow_name: Optional[str] = Field(None, description="Workflow name (denormalized)")
    entity_type: str = Field(..., min_length=1, max_length=50, description="Type of entity")
    entity_id: UUID = Field(..., description="ID of the entity")
    project_id: Optional[UUID] = Field(None, description="Associated project ID")
    current_step: int = Field(default=0, ge=0, description="Current step index")
    status: WorkflowStatus = Field(default=WorkflowStatus.PENDING, description="Instance status")
    context: Dict[str, Any] = Field(default_factory=dict, description="Instance context data")
    initiated_by: UUID = Field(..., description="User who initiated the workflow")
    initiated_at: Optional[datetime] = Field(None, description="Initiation timestamp")
    completed_at: Optional[datetime] = Field(None, description="Completion timestamp")
    cancelled_at: Optional[datetime] = Field(None, description="Cancellation timestamp")
    cancellation_reason: Optional[str] = Field(None, description="Reason for cancellation")
    created_at: Optional[datetime] = Field(None, description="Creation timestamp")
    updated_at: Optional[datetime] = Field(None, description="Last update timestamp")

    class Config:
        json_schema_extra = {
            "example": {
                "workflow_id": "123e4567-e89b-12d3-a456-426614174000",
                "entity_type": "financial_tracking",
                "entity_id": "123e4567-e89b-12d3-a456-426614174001",
                "current_step": 0,
                "status": "pending",
                "context": {
                    "variance_amount": 50000,
                    "variance_percentage": 15.5
                },
                "initiated_by": "123e4567-e89b-12d3-a456-426614174002"
            }
        }


class WorkflowApproval(BaseModel):
    """Workflow approval model"""
    id: Optional[UUID] = Field(None, description="Approval ID (generated on creation)")
    workflow_instance_id: UUID = Field(..., description="Workflow instance ID")
    step_number: int = Field(..., ge=0, description="Step number in workflow")
    step_name: Optional[str] = Field(None, description="Step name (denormalized)")
    approver_id: UUID = Field(..., description="Approver user ID")
    approver_name: Optional[str] = Field(None, description="Approver name (denormalized)")
    status: ApprovalStatus = Field(default=ApprovalStatus.PENDING, description="Approval status")
    decision: Optional[str] = Field(None, description="Approval decision")
    comments: Optional[str] = Field(None, max_length=2000, description="Approval comments")
    approved_at: Optional[datetime] = Field(None, description="Approval timestamp")
    expires_at: Optional[datetime] = Field(None, description="Expiration timestamp")
    delegated_to: Optional[UUID] = Field(None, description="User ID if delegated")
    delegated_at: Optional[datetime] = Field(None, description="Delegation timestamp")
    created_at: Optional[datetime] = Field(None, description="Creation timestamp")
    updated_at: Optional[datetime] = Field(None, description="Last update timestamp")

    class Config:
        json_schema_extra = {
            "example": {
                "workflow_instance_id": "123e4567-e89b-12d3-a456-426614174000",
                "step_number": 0,
                "step_name": "Manager Approval",
                "approver_id": "123e4567-e89b-12d3-a456-426614174001",
                "status": "pending"
            }
        }


class PendingApproval(BaseModel):
    """Pending approval view model"""
    approval_id: UUID = Field(..., description="Approval ID")
    workflow_instance_id: UUID = Field(..., description="Workflow instance ID")
    workflow_name: str = Field(..., description="Workflow name")
    entity_type: str = Field(..., description="Entity type")
    entity_id: UUID = Field(..., description="Entity ID")
    step_number: int = Field(..., description="Step number")
    step_name: str = Field(..., description="Step name")
    initiated_by: UUID = Field(..., description="Initiator user ID")
    initiated_by_name: Optional[str] = Field(None, description="Initiator name")
    initiated_at: datetime = Field(..., description="Initiation timestamp")
    expires_at: Optional[datetime] = Field(None, description="Expiration timestamp")
    context: Dict[str, Any] = Field(default_factory=dict, description="Workflow context")

    class Config:
        json_schema_extra = {
            "example": {
                "approval_id": "123e4567-e89b-12d3-a456-426614174000",
                "workflow_instance_id": "123e4567-e89b-12d3-a456-426614174001",
                "workflow_name": "Budget Approval Workflow",
                "entity_type": "financial_tracking",
                "entity_id": "123e4567-e89b-12d3-a456-426614174002",
                "step_number": 0,
                "step_name": "Manager Approval",
                "initiated_by": "123e4567-e89b-12d3-a456-426614174003",
                "initiated_at": "2024-01-15T10:30:00Z",
                "context": {"variance_amount": 50000}
            }
        }
