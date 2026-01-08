"""
Change Management Pydantic models
"""

from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import List, Optional, Dict, Any
from uuid import UUID
from enum import Enum
from decimal import Decimal

from .base import BaseResponse

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

class ImplementationStatus(str, Enum):
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    ON_HOLD = "on_hold"

class TaskType(str, Enum):
    IMPLEMENTATION = "implementation"
    TESTING = "testing"
    DOCUMENTATION = "documentation"
    TRAINING = "training"
    DEPLOYMENT = "deployment"
    REVIEW = "review"
    APPROVAL = "approval"

# Request models
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
    status: Optional[ChangeStatus] = None
    
    # Impact estimates
    estimated_cost_impact: Optional[Decimal] = Field(None, ge=0)
    estimated_schedule_impact_days: Optional[int] = Field(None, ge=0)
    estimated_effort_hours: Optional[Decimal] = Field(None, ge=0)
    
    # Actual impacts
    actual_cost_impact: Optional[Decimal] = None
    actual_schedule_impact_days: Optional[int] = None
    actual_effort_hours: Optional[Decimal] = None
    
    # Implementation tracking
    implementation_start_date: Optional[date] = None
    implementation_end_date: Optional[date] = None
    implementation_notes: Optional[str] = None
# Response models
class ChangeRequestResponse(BaseResponse):
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
    estimated_effort_hours: Optional[Decimal]
    actual_cost_impact: Optional[Decimal]
    actual_schedule_impact_days: Optional[int]
    actual_effort_hours: Optional[Decimal]
    
    # Implementation tracking
    implementation_progress: Optional[int]
    implementation_start_date: Optional[date]
    implementation_end_date: Optional[date]
    implementation_notes: Optional[str]
    
    # Approval status
    pending_approvals: List[Dict[str, Any]]
    approval_history: List[Dict[str, Any]]
    
    # Metadata
    version: int
    parent_change_id: Optional[str]
    template_id: Optional[str]
    closed_at: Optional[datetime]
    closed_by: Optional[str]

class ChangeTemplateCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=255)
    description: Optional[str] = None
    change_type: ChangeType
    template_data: Dict[str, Any] = Field(..., description="Form fields, validation rules, etc.")
    is_active: bool = True

class ChangeTemplateResponse(BaseResponse):
    name: str
    description: Optional[str]
    change_type: str
    template_data: Dict[str, Any]
    is_active: bool
    created_by: str

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

class ApprovalResponse(BaseResponse):
    change_request_id: str
    step_number: int
    approver_id: str
    approver_role: Optional[str]
    decision: Optional[str]
    decision_date: Optional[datetime]
    comments: Optional[str]
    conditions: Optional[str]
    is_required: bool
    is_parallel: bool
    depends_on_step: Optional[int]
    due_date: Optional[datetime]
    escalation_date: Optional[datetime]
    escalated_to: Optional[str]

class ImpactAnalysisRequest(BaseModel):
    change_request_id: UUID
    include_scenarios: bool = True
    detailed_breakdown: bool = False

class ImpactAnalysisResponse(BaseModel):
    change_request_id: str
    
    # Schedule impact
    critical_path_affected: bool
    schedule_impact_days: int
    affected_activities: List[Dict[str, Any]]
    
    # Cost impact
    total_cost_impact: Decimal
    direct_costs: Decimal
    indirect_costs: Decimal
    cost_savings: Decimal
    cost_breakdown: Dict[str, Any]
    
    # Resource impact
    additional_resources_needed: List[Dict[str, Any]]
    resource_reallocation: List[Dict[str, Any]]
    
    # Risk impact
    new_risks: List[Dict[str, Any]]
    modified_risks: List[Dict[str, Any]]
    risk_mitigation_costs: Decimal
    
    # Quality and compliance
    quality_impact_assessment: Optional[str]
    compliance_requirements: Dict[str, Any]
    regulatory_approvals_needed: List[Dict[str, Any]]
    
    # Scenarios
    scenarios: Dict[str, Dict[str, Any]]
    
    analyzed_by: str
    analyzed_at: datetime
    approved_by: Optional[str]
    approved_at: Optional[datetime]
class ImplementationPlan(BaseModel):
    implementation_plan: Dict[str, Any] = Field(..., description="Detailed implementation steps")
    assigned_to: Optional[UUID] = None
    implementation_team: List[UUID] = Field(default_factory=list)
    implementation_milestones: List[Dict[str, Any]] = Field(default_factory=list)
    verification_criteria: Optional[Dict[str, Any]] = None

class ImplementationProgress(BaseModel):
    progress_percentage: int = Field(..., ge=0, le=100)
    completed_tasks: List[Dict[str, Any]] = Field(default_factory=list)
    pending_tasks: List[Dict[str, Any]] = Field(default_factory=list)
    blocked_tasks: List[Dict[str, Any]] = Field(default_factory=list)
    implementation_issues: List[Dict[str, Any]] = Field(default_factory=list)
    lessons_learned: Optional[str] = None

class ImplementationResponse(BaseResponse):
    change_request_id: str
    implementation_plan: Dict[str, Any]
    assigned_to: Optional[str]
    implementation_team: List[str]
    progress_percentage: int
    completed_tasks: List[Dict[str, Any]]
    pending_tasks: List[Dict[str, Any]]
    blocked_tasks: List[Dict[str, Any]]
    implementation_milestones: List[Dict[str, Any]]
    implementation_issues: List[Dict[str, Any]]
    lessons_learned: Optional[str]
    verification_criteria: Optional[Dict[str, Any]]
    verification_results: Optional[Dict[str, Any]]
    validated_by: Optional[str]
    validated_at: Optional[datetime]

class ChangeAnalytics(BaseModel):
    total_changes: int
    changes_by_status: Dict[str, int]
    changes_by_type: Dict[str, int]
    changes_by_priority: Dict[str, int]
    
    # Performance metrics
    average_approval_time_days: float
    average_implementation_time_days: float
    approval_rate_percentage: float
    
    # Impact accuracy
    cost_estimate_accuracy: float
    schedule_estimate_accuracy: float
    
    # Trends
    monthly_change_volume: List[Dict[str, Any]]
    top_change_categories: List[Dict[str, Any]]
    
    # Project-specific metrics
    changes_by_project: List[Dict[str, Any]]
    high_impact_changes: List[Dict[str, Any]]

class ChangeRequestFilters(BaseModel):
    project_id: Optional[UUID] = None
    status: Optional[ChangeStatus] = None
    change_type: Optional[ChangeType] = None
    priority: Optional[PriorityLevel] = None
    requested_by: Optional[UUID] = None
    assigned_to_me: bool = False
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    search_term: Optional[str] = None
    
    # Pagination
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)

class PendingApproval(BaseModel):
    approval_id: str
    change_request_id: str
    change_number: str
    change_title: str
    change_type: str
    priority: str
    requested_by: str
    requested_date: datetime
    step_number: int
    due_date: Optional[datetime]
    is_overdue: bool
    project_name: str
    estimated_cost_impact: Optional[Decimal]

class NotificationPreferences(BaseModel):
    user_id: UUID
    email_notifications: bool = True
    in_app_notifications: bool = True
    sms_notifications: bool = False
    notification_types: List[str] = Field(default_factory=list)
    escalation_enabled: bool = True
    reminder_frequency_hours: int = Field(24, ge=1, le=168)  # 1 hour to 1 week

class AuditLogEntry(BaseModel):
    id: str
    change_request_id: str
    event_type: str
    event_description: Optional[str]
    performed_by: str
    performed_at: datetime
    ip_address: Optional[str]
    user_agent: Optional[str]
    old_values: Optional[Dict[str, Any]]
    new_values: Optional[Dict[str, Any]]
    related_entity_type: Optional[str]
    related_entity_id: Optional[str]
    compliance_notes: Optional[str]
    regulatory_reference: Optional[str]

# Implementation Tracking Models

class ImplementationTask(BaseModel):
    id: Optional[str] = None
    implementation_plan_id: str
    task_number: int
    title: str
    description: Optional[str] = None
    task_type: TaskType = TaskType.IMPLEMENTATION
    assigned_to: UUID
    planned_start_date: date
    planned_end_date: date
    actual_start_date: Optional[date] = None
    actual_end_date: Optional[date] = None
    status: ImplementationStatus = ImplementationStatus.PLANNED
    progress_percentage: int = Field(0, ge=0, le=100)
    estimated_effort_hours: Decimal = Field(Decimal('0'), ge=0)
    actual_effort_hours: Optional[Decimal] = None
    dependencies: List[UUID] = Field(default_factory=list)
    deliverables: List[str] = Field(default_factory=list)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class ImplementationPlan(BaseModel):
    id: Optional[str] = None
    change_request_id: UUID
    planned_start_date: date
    planned_end_date: date
    actual_start_date: Optional[date] = None
    actual_end_date: Optional[date] = None
    assigned_to: UUID
    status: ImplementationStatus = ImplementationStatus.PLANNED
    progress_percentage: int = Field(0, ge=0, le=100)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class ImplementationMilestone(BaseModel):
    id: Optional[str] = None
    implementation_plan_id: str
    title: str
    description: Optional[str] = None
    milestone_type: str = "deliverable"
    target_date: date
    actual_date: Optional[date] = None
    status: ImplementationStatus = ImplementationStatus.PLANNED
    dependencies: List[UUID] = Field(default_factory=list)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class ImplementationProgressNote(BaseModel):
    id: Optional[str] = None
    implementation_task_id: str
    note: str
    progress_percentage: int = Field(..., ge=0, le=100)
    created_by: UUID
    created_at: Optional[datetime] = None

class ImplementationLessonsLearned(BaseModel):
    id: Optional[str] = None
    implementation_plan_id: str
    change_request_id: str
    lessons_learned: str
    category: Optional[str] = None
    impact_on_future_changes: Optional[str] = None
    created_by: UUID
    created_at: Optional[datetime] = None

class ImplementationDeviation(BaseModel):
    id: Optional[str] = None
    implementation_plan_id: str
    deviation_type: str  # 'schedule', 'cost', 'scope', 'quality'
    severity: str = "medium"  # 'low', 'medium', 'high', 'critical'
    description: str
    root_cause: Optional[str] = None
    corrective_action: Optional[str] = None
    impact_assessment: Optional[str] = None
    detected_date: date = Field(default_factory=date.today)
    resolved_date: Optional[date] = None
    status: str = "open"  # 'open', 'in_progress', 'resolved', 'closed'
    created_by: UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class ImplementationStatusSummary(BaseModel):
    implementation_plan: ImplementationPlan
    progress_summary: Dict[str, Any]
    schedule_status: Dict[str, Any]
    tasks: List[ImplementationTask]
    milestones: List[Dict[str, Any]]
    recent_progress_notes: List[ImplementationProgressNote]
    deviations: List[ImplementationDeviation]
    status_updated_at: datetime

class ImplementationCreateRequest(BaseModel):
    change_request_id: UUID
    planned_start_date: date
    planned_end_date: date
    assigned_to: UUID
    tasks: List[Dict[str, Any]]

class TaskProgressUpdate(BaseModel):
    progress_percentage: int = Field(..., ge=0, le=100)
    status: Optional[ImplementationStatus] = None
    actual_effort_hours: Optional[Decimal] = None
    notes: Optional[str] = None

class ImplementationCompletionRequest(BaseModel):
    actual_end_date: Optional[date] = None
    lessons_learned: Optional[str] = None

class MilestoneCreateRequest(BaseModel):
    title: str
    description: str
    target_date: date
    milestone_type: str = "deliverable"
    dependencies: Optional[List[UUID]] = None