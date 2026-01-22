"""
Pydantic schemas for Workflow API endpoints
"""

from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from uuid import UUID
from datetime import datetime


# Workflow Request Schemas
class CreateWorkflowInstanceRequest(BaseModel):
    """Request model for creating a workflow instance"""
    workflow_id: UUID = Field(..., description="ID of the workflow definition")
    entity_type: str = Field(..., description="Type of entity (e.g., 'project', 'change_request')")
    entity_id: UUID = Field(..., description="ID of the entity")


class SubmitApprovalRequest(BaseModel):
    """Request model for submitting an approval decision"""
    decision: str = Field(..., pattern="^(approved|rejected)$", description="Approval decision: 'approved' or 'rejected'")
    comments: Optional[str] = Field(None, max_length=1000, description="Optional comments about the decision")


# Workflow Response Schemas
class WorkflowStep(BaseModel):
    """Workflow step information"""
    step_number: int = Field(..., description="Step number in the workflow")
    name: str = Field(..., description="Name of the step")
    status: str = Field(..., description="Status: 'pending', 'approved', 'rejected'")
    approver_name: Optional[str] = Field(None, description="Name of the approver")
    decided_at: Optional[datetime] = Field(None, description="When the decision was made")
    comments: Optional[str] = Field(None, description="Comments from the approver")


class WorkflowInstanceResponse(BaseModel):
    """Response model for workflow instance details"""
    id: UUID = Field(..., description="Workflow instance ID")
    workflow_id: UUID = Field(..., description="Workflow definition ID")
    workflow_name: str = Field(..., description="Name of the workflow")
    entity_type: str = Field(..., description="Type of entity")
    entity_id: UUID = Field(..., description="ID of the entity")
    current_step: int = Field(..., description="Current step number")
    status: str = Field(..., description="Workflow status: 'pending', 'in_progress', 'completed', 'rejected'")
    started_by: UUID = Field(..., description="User ID who started the workflow")
    started_at: datetime = Field(..., description="When the workflow was started")
    completed_at: Optional[datetime] = Field(None, description="When the workflow was completed")
    approvals: Dict[int, List[Dict[str, Any]]] = Field(default_factory=dict, description="Approvals by step number")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")


class ApprovalResultResponse(BaseModel):
    """Response model for approval submission"""
    decision: str = Field(..., description="The decision that was submitted")
    workflow_status: str = Field(..., description="Current workflow status")
    is_complete: bool = Field(..., description="Whether the workflow is complete")
    current_step: Optional[int] = Field(None, description="Current step number")


class AdvanceWorkflowResponse(BaseModel):
    """Response model for workflow advancement"""
    status: str = Field(..., description="Workflow status after advancement")
    current_step: int = Field(..., description="Current step number")
    next_steps: List[Dict[str, Any]] = Field(default_factory=list, description="Next steps in the workflow")


# ==================== Workflow Template Schemas ====================


class TemplateInfo(BaseModel):
    """Basic template information"""
    template_type: str = Field(..., description="Type of template")
    name: str = Field(..., description="Template name")
    description: str = Field(..., description="Template description")
    category: str = Field(..., description="Template category")
    priority: str = Field(..., description="Template priority")
    step_count: int = Field(..., description="Number of steps in template")
    customizable_fields: List[str] = Field(..., description="List of customizable fields")


class TemplateListResponse(BaseModel):
    """Response model for listing workflow templates"""
    templates: List[TemplateInfo] = Field(..., description="List of available templates")
    count: int = Field(..., description="Total number of templates")


class TemplateMetadataResponse(BaseModel):
    """Response model for template metadata"""
    template_type: str = Field(..., description="Type of template")
    name: str = Field(..., description="Template name")
    description: str = Field(..., description="Template description")
    metadata: Dict[str, Any] = Field(..., description="Template metadata")
    step_count: int = Field(..., description="Number of steps")
    trigger_count: int = Field(..., description="Number of triggers")


class InstantiateTemplateRequest(BaseModel):
    """Request model for instantiating a workflow template"""
    name: Optional[str] = Field(None, description="Custom name for the workflow (uses template name if not provided)")
    customizations: Optional[Dict[str, Any]] = Field(None, description="Optional customizations to apply")
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "Project X Budget Approval",
                "customizations": {
                    "steps": {
                        "0": {
                            "timeout_hours": 24,
                            "approver_roles": ["finance_manager"]
                        }
                    },
                    "triggers": {
                        "0": {
                            "threshold_values": {
                                "percentage": 8.0
                            }
                        }
                    }
                }
            }
        }


class InstantiateTemplateResponse(BaseModel):
    """Response model for template instantiation"""
    workflow_id: Optional[UUID] = Field(None, description="Workflow ID (will be assigned when saved)")
    name: str = Field(..., description="Workflow name")
    description: Optional[str] = Field(None, description="Workflow description")
    template_type: str = Field(..., description="Template type used")
    status: str = Field(..., description="Workflow status")
    step_count: int = Field(..., description="Number of steps")
    trigger_count: int = Field(..., description="Number of triggers")
    metadata: Dict[str, Any] = Field(..., description="Workflow metadata")
    created_by: Optional[UUID] = Field(None, description="User who created the workflow")
    created_at: Optional[datetime] = Field(None, description="Creation timestamp")


class CustomizeTemplateRequest(BaseModel):
    """Request model for customizing a template"""
    customizations: Dict[str, Any] = Field(..., description="Customizations to apply")
    
    class Config:
        json_schema_extra = {
            "example": {
                "customizations": {
                    "steps": {
                        "0": {
                            "timeout_hours": 36,
                            "approver_roles": ["custom_role"]
                        }
                    }
                }
            }
        }


class CustomizeTemplateResponse(BaseModel):
    """Response model for template customization preview"""
    template_type: str = Field(..., description="Template type")
    name: str = Field(..., description="Template name")
    description: str = Field(..., description="Template description")
    steps: List[Dict[str, Any]] = Field(..., description="Customized steps")
    triggers: List[Dict[str, Any]] = Field(..., description="Customized triggers")
    metadata: Dict[str, Any] = Field(..., description="Template metadata")
    customizations_applied: Dict[str, Any] = Field(..., description="Customizations that were applied")
