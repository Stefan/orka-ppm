"""
Data models for integrated change management system
"""

from enum import Enum
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from decimal import Decimal
from uuid import UUID
from pydantic import BaseModel, Field


class ChangeType(str, Enum):
    SCOPE = "scope"
    SCHEDULE = "schedule"
    BUDGET = "budget"
    DESIGN = "design"
    REGULATORY = "regulatory"
    RESOURCE = "resource"
    QUALITY = "quality"
    SAFETY = "safety"
    EMERGENCY = "emergency"


class ChangeStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    ON_HOLD = "on_hold"
    IMPLEMENTING = "implementing"
    IMPLEMENTED = "implemented"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class PriorityLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"
    EMERGENCY = "emergency"


class ApprovalDecision(str, Enum):
    APPROVED = "approved"
    REJECTED = "rejected"
    NEEDS_INFO = "needs_info"
    DELEGATED = "delegated"


class ChangeRequestCreate(BaseModel):
    title: str = Field(..., min_length=5, max_length=255)
    description: str = Field(..., min_length=10)
    justification: Optional[str] = None
    change_type: ChangeType
    priority: PriorityLevel = PriorityLevel.MEDIUM
    project_id: UUID
    required_by_date: Optional[date] = None
    
    # Impact estimates
    estimated_cost_impact: Optional[Decimal] = Field(None, ge=0)
    estimated_schedule_impact_days: Optional[int] = Field(None, ge=0)
    estimated_effort_hours: Optional[Decimal] = Field(None, ge=0)
    
    # Linkages
    affected_milestones: List[UUID] = Field(default_factory=list)
    affected_pos: List[UUID] = Field(default_factory=list)
    
    # Template usage
    template_id: Optional[UUID] = None
    template_data: Optional[Dict[str, Any]] = None


class ChangeRequestUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=5, max_length=255)
    description: Optional[str] = Field(None, min_length=10)
    justification: Optional[str] = None
    priority: Optional[PriorityLevel] = None
    required_by_date: Optional[date] = None
    estimated_cost_impact: Optional[Decimal] = Field(None, ge=0)
    estimated_schedule_impact_days: Optional[int] = Field(None, ge=0)
    estimated_effort_hours: Optional[Decimal] = Field(None, ge=0)


class ChangeRequestResponse(BaseModel):
    id: str
    change_number: str
    title: str
    description: str
    justification: Optional[str]
    change_type: str
    priority: str
    status: str
    
    # Requestor information
    requested_by: str
    requested_date: datetime
    required_by_date: Optional[date]
    
    # Project linkage
    project_id: str
    project_name: Optional[str]
    affected_milestones: List[Dict[str, Any]]
    affected_pos: List[Dict[str, Any]]
    
    # Impact data
    estimated_cost_impact: Optional[Decimal]
    estimated_schedule_impact_days: Optional[int]
    actual_cost_impact: Optional[Decimal]
    actual_schedule_impact_days: Optional[int]
    
    # Implementation tracking
    implementation_progress: Optional[int]
    implementation_start_date: Optional[date]
    implementation_end_date: Optional[date]
    
    # Approval status
    pending_approvals: List[Dict[str, Any]]
    approval_history: List[Dict[str, Any]]
    
    # Metadata
    version: int
    created_at: datetime
    updated_at: datetime
    closed_at: Optional[datetime]


class ApprovalRequest(BaseModel):
    change_request_id: UUID
    approver_id: UUID
    step_number: int
    is_required: bool = True
    is_parallel: bool = False
    depends_on_step: Optional[int] = None
    due_date: Optional[datetime] = None


class ApprovalDecisionRequest(BaseModel):
    decision: ApprovalDecision
    comments: Optional[str] = None
    conditions: Optional[str] = None


class ChangeRequest(BaseModel):
    """Full change request model for internal use"""
    id: str
    change_number: str
    title: str
    description: str
    justification: Optional[str]
    change_type: ChangeType
    priority: PriorityLevel
    status: ChangeStatus
    
    # Requestor information
    requested_by: str
    requested_date: datetime
    required_by_date: Optional[date]
    
    # Project linkage
    project_id: str
    affected_milestones: List[str] = Field(default_factory=list)
    affected_pos: List[str] = Field(default_factory=list)
    
    # Impact estimates
    estimated_cost_impact: Optional[Decimal] = None
    estimated_schedule_impact_days: Optional[int] = None
    estimated_effort_hours: Optional[Decimal] = None
    
    # Actual impacts
    actual_cost_impact: Optional[Decimal] = None
    actual_schedule_impact_days: Optional[int] = None
    actual_effort_hours: Optional[Decimal] = None
    
    # Implementation tracking
    implementation_start_date: Optional[date] = None
    implementation_end_date: Optional[date] = None
    implementation_notes: Optional[str] = None
    
    # Metadata
    template_id: Optional[str] = None
    version: int = 1
    parent_change_id: Optional[str] = None
    
    created_at: datetime
    updated_at: datetime
    closed_at: Optional[datetime] = None
    closed_by: Optional[str] = None


class ChangeRequestFilters(BaseModel):
    """Filters for listing change requests"""
    project_id: Optional[UUID] = None
    status: Optional[ChangeStatus] = None
    change_type: Optional[ChangeType] = None
    priority: Optional[PriorityLevel] = None
    requested_by: Optional[UUID] = None
    assigned_to_me: bool = False
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    search_term: Optional[str] = None
    page: int = 1
    page_size: int = 20


class ApprovalResponse(BaseModel):
    """Response model for approval information"""
    id: str
    change_request_id: str
    step_number: int
    approver_id: str
    approver_name: Optional[str] = None
    approver_role: str
    decision: Optional[ApprovalDecision] = None
    comments: Optional[str] = None
    is_required: bool
    is_parallel: bool
    due_date: Optional[datetime] = None
    decided_at: Optional[datetime] = None
    created_at: datetime


class PendingApproval(BaseModel):
    """Pending approval for a user"""
    approval_id: str
    change_request_id: str
    change_number: str
    change_title: str
    change_type: str
    priority: str
    requested_by: str
    requested_date: datetime
    step_number: int
    due_date: Optional[datetime] = None
    is_overdue: bool
    project_name: str
    estimated_cost_impact: Optional[Decimal] = None


class ImpactAnalysisRequest(BaseModel):
    """Request for impact analysis"""
    include_scenarios: bool = True
    detailed_breakdown: bool = True
    analysis_scope: List[str] = Field(default_factory=lambda: ['cost', 'schedule', 'resources'])


class ImpactAnalysisResponse(BaseModel):
    """Response model for impact analysis"""
    change_request_id: str
    total_cost_impact: Decimal
    schedule_impact_days: int
    resource_impact: Dict[str, Any]
    risk_impact: Dict[str, Any]
    affected_milestones: List[Dict[str, Any]]
    affected_pos: List[Dict[str, Any]]
    scenarios: Optional[Dict[str, Any]] = None
    analyzed_at: datetime
    analyzed_by: str


class ImplementationPlan(BaseModel):
    """Implementation plan for a change request"""
    implementation_plan: Dict[str, Any]
    estimated_duration_days: int
    assigned_team: List[str]
    milestones: List[Dict[str, Any]]
    dependencies: List[str] = Field(default_factory=list)
    risks: List[Dict[str, Any]] = Field(default_factory=list)


class ImplementationProgress(BaseModel):
    """Progress update for implementation"""
    progress_percentage: int = Field(..., ge=0, le=100)
    completed_tasks: List[str]
    in_progress_tasks: List[str]
    blocked_tasks: List[str] = Field(default_factory=list)
    issues: List[Dict[str, Any]] = Field(default_factory=list)
    lessons_learned: Optional[str] = None
    next_steps: Optional[str] = None


class ImplementationResponse(BaseModel):
    """Response model for implementation status"""
    change_request_id: str
    status: str
    progress_percentage: int
    implementation_plan: Dict[str, Any]
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    completed_tasks: List[str]
    in_progress_tasks: List[str]
    blocked_tasks: List[str]
    issues: List[Dict[str, Any]]
    lessons_learned: Optional[str] = None


class ChangeAnalytics(BaseModel):
    """Analytics data for change management"""
    total_changes: int
    changes_by_status: Dict[str, int]
    changes_by_type: Dict[str, int]
    changes_by_priority: Dict[str, int]
    average_approval_time_days: float
    average_implementation_time_days: float
    total_cost_impact: Decimal
    total_schedule_impact_days: int
    approval_rate: float
    rejection_rate: float
    trends: Optional[Dict[str, Any]] = None


class AuditLogEntry(BaseModel):
    """Audit log entry for change request"""
    id: str
    change_request_id: str
    event_type: str
    event_description: str
    performed_by: str
    performed_at: datetime
    old_values: Optional[Dict[str, Any]] = None
    new_values: Optional[Dict[str, Any]] = None
    related_entity_type: Optional[str] = None
    related_entity_id: Optional[str] = None


class ChangeTemplateCreate(BaseModel):
    """Request model for creating a change template"""
    name: str
    description: Optional[str] = None
    change_type: ChangeType
    template_fields: Dict[str, Any]
    default_values: Dict[str, Any] = Field(default_factory=dict)
    required_fields: List[str] = Field(default_factory=list)
    is_active: bool = True


class ChangeTemplateResponse(BaseModel):
    """Response model for change template"""
    id: str
    name: str
    description: Optional[str] = None
    change_type: str
    template_fields: Dict[str, Any]
    default_values: Dict[str, Any]
    required_fields: List[str]
    is_active: bool
    created_by: str
    created_at: datetime
    updated_at: datetime