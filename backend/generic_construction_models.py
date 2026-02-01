"""
Pydantic models for Generic Construction/Engineering PPM Features
"""

from pydantic import BaseModel, Field, validator
from typing import List, Dict, Any, Optional, Union
from datetime import datetime, date
from decimal import Decimal
from enum import Enum
from uuid import UUID


# Enums
class ShareablePermissionLevel(str, Enum):
    view_basic = "view_basic"
    view_financial = "view_financial"
    view_risks = "view_risks"
    view_resources = "view_resources"
    view_timeline = "view_timeline"


class SimulationType(str, Enum):
    monte_carlo = "monte_carlo"
    what_if = "what_if"
    sensitivity_analysis = "sensitivity_analysis"


class ChangeRequestType(str, Enum):
    scope = "scope"
    schedule = "schedule"
    budget = "budget"
    resource = "resource"
    quality = "quality"
    risk = "risk"


class ChangeRequestStatus(str, Enum):
    draft = "draft"
    submitted = "submitted"
    under_review = "under_review"
    approved = "approved"
    rejected = "rejected"
    implemented = "implemented"
    cancelled = "cancelled"


class POBreakdownType(str, Enum):
    sap_standard = "sap_standard"
    custom_hierarchy = "custom_hierarchy"
    cost_center = "cost_center"
    work_package = "work_package"


class ReportTemplateType(str, Enum):
    executive_summary = "executive_summary"
    project_status = "project_status"
    risk_assessment = "risk_assessment"
    financial_report = "financial_report"
    custom = "custom"


class ReportGenerationStatus(str, Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"


class Priority(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class ImpactType(str, Enum):
    cost_increase = "cost_increase"
    cost_decrease = "cost_decrease"
    scope_change = "scope_change"
    reallocation = "reallocation"
    new_po = "new_po"
    po_cancellation = "po_cancellation"


# Shareable URLs Models
class ShareablePermissions(BaseModel):
    can_view_basic_info: bool = True
    can_view_financial: bool = False
    can_view_risks: bool = False
    can_view_resources: bool = False
    can_view_timeline: bool = True
    allowed_sections: List[str] = Field(default_factory=list)


class ShareableURLCreate(BaseModel):
    project_id: UUID
    permissions: ShareablePermissions
    expires_at: datetime
    description: Optional[str] = None
    
    @validator('expires_at')
    def validate_expiration(cls, v):
        if v <= datetime.now():
            raise ValueError('Expiration time must be in the future')
        return v


class ShareableURLResponse(BaseModel):
    id: UUID
    project_id: UUID
    token: str
    permissions: ShareablePermissions
    created_by: UUID
    expires_at: datetime
    access_count: int
    last_accessed: Optional[datetime]
    is_revoked: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class ShareableURLValidation(BaseModel):
    is_valid: bool
    permissions: Optional[ShareablePermissions] = None
    project_id: Optional[UUID] = None
    error_message: Optional[str] = None


# Simulation Models
class SimulationConfig(BaseModel):
    iterations: int = Field(default=10000, ge=1000, le=100000)
    confidence_levels: List[float] = Field(default=[0.1, 0.5, 0.9])
    include_cost_analysis: bool = True
    include_schedule_analysis: bool = True
    risk_correlation_matrix: Optional[Dict[str, Dict[str, float]]] = None
    
    @validator('confidence_levels')
    def validate_confidence_levels(cls, v):
        for level in v:
            if not 0 < level < 1:
                raise ValueError('Confidence levels must be between 0 and 1')
        return sorted(v)


class SimulationStatistics(BaseModel):
    mean_cost: Optional[float] = None
    std_cost: Optional[float] = None
    mean_schedule: Optional[float] = None
    std_schedule: Optional[float] = None
    correlation_coefficient: Optional[float] = None


class SimulationCreate(BaseModel):
    project_id: UUID
    simulation_type: SimulationType
    name: str
    description: Optional[str] = None
    config: SimulationConfig


class SimulationResult(BaseModel):
    id: UUID
    project_id: UUID
    simulation_type: SimulationType
    name: str
    description: Optional[str]
    config: SimulationConfig
    results: Dict[str, Any]
    statistics: Optional[SimulationStatistics]
    percentiles: Dict[str, float]  # P10, P50, P90
    execution_time_ms: Optional[int]
    iterations_completed: Optional[int]
    created_by: UUID
    created_at: datetime
    
    class Config:
        from_attributes = True


# Scenario Analysis Models
class ProjectChanges(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    budget: Optional[Decimal] = None
    resource_allocations: Optional[Dict[str, float]] = None
    milestone_dates: Optional[Dict[str, date]] = None
    risk_adjustments: Optional[Dict[str, Dict[str, float]]] = None


class TimelineImpact(BaseModel):
    original_duration: int  # days
    new_duration: int
    duration_change: int
    critical_path_affected: bool
    affected_milestones: List[str]


class CostImpact(BaseModel):
    original_cost: Decimal
    new_cost: Decimal
    cost_change: Decimal
    cost_change_percentage: float
    affected_categories: List[str]


class ResourceImpact(BaseModel):
    utilization_changes: Dict[str, float]
    over_allocated_resources: List[str]
    under_allocated_resources: List[str]
    new_resource_requirements: List[str]


class ScenarioConfig(BaseModel):
    name: str
    description: Optional[str] = None
    parameter_changes: ProjectChanges
    analysis_scope: List[str] = Field(default=['timeline', 'cost', 'resources'])


class ScenarioCreate(BaseModel):
    project_id: UUID
    base_scenario_id: Optional[UUID] = None
    config: ScenarioConfig


class ScenarioAnalysis(BaseModel):
    id: UUID
    project_id: UUID
    name: str
    description: Optional[str]
    base_scenario_id: Optional[UUID]
    parameter_changes: ProjectChanges
    timeline_impact: Optional[TimelineImpact]
    cost_impact: Optional[CostImpact]
    resource_impact: Optional[ResourceImpact]
    created_by: UUID
    created_at: datetime
    updated_at: datetime
    is_active: bool
    is_baseline: bool
    
    class Config:
        from_attributes = True


class ScenarioComparison(BaseModel):
    scenarios: List[ScenarioAnalysis]
    comparison_matrix: Dict[str, Dict[str, Any]]
    recommendations: List[str]


# Change Management Models
class ImpactAssessment(BaseModel):
    cost_impact: Optional[Decimal] = None
    schedule_impact: Optional[int] = None  # days
    resource_impact: Optional[Dict[str, Any]] = None
    risk_impact: Optional[Dict[str, Any]] = None
    quality_impact: Optional[str] = None
    stakeholder_impact: Optional[List[str]] = None


class ChangeRequestCreate(BaseModel):
    project_id: UUID
    title: str
    description: str
    change_type: ChangeRequestType
    priority: Priority = Priority.medium
    impact_assessment: ImpactAssessment
    justification: str
    business_case: Optional[str] = None
    estimated_cost_impact: Optional[Decimal] = None
    estimated_schedule_impact: Optional[int] = None
    auto_submit: bool = False


class ChangeRequestUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[Priority] = None
    impact_assessment: Optional[ImpactAssessment] = None
    justification: Optional[str] = None
    business_case: Optional[str] = None
    estimated_cost_impact: Optional[Decimal] = None
    estimated_schedule_impact: Optional[int] = None
    assigned_to: Optional[UUID] = None


class ChangeRequest(BaseModel):
    id: UUID
    project_id: UUID
    change_number: str
    title: str
    description: str
    change_type: ChangeRequestType
    priority: Priority
    impact_assessment: ImpactAssessment
    justification: str
    business_case: Optional[str]
    requested_by: UUID
    assigned_to: Optional[UUID]
    status: ChangeRequestStatus
    workflow_instance_id: Optional[UUID]
    estimated_cost_impact: Optional[Decimal]
    estimated_schedule_impact: Optional[int]
    actual_cost_impact: Optional[Decimal]
    actual_schedule_impact: Optional[int]
    approved_at: Optional[datetime]
    approved_by: Optional[UUID]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ApprovalDecision(BaseModel):
    decision: str = Field(..., pattern="^(approve|reject)$")
    comments: Optional[str] = None
    conditions: Optional[List[str]] = None


class ChangeRequestStats(BaseModel):
    total_changes: int
    draft_changes: int
    submitted_changes: int
    under_review_changes: int
    approved_changes: int
    rejected_changes: int
    implemented_changes: int
    total_cost_impact: Decimal
    total_schedule_impact: int


# PO Breakdown Models
class POBreakdownCreate(BaseModel):
    project_id: UUID
    name: str
    code: Optional[str] = None
    sap_po_number: Optional[str] = None
    sap_line_item: Optional[str] = None
    parent_breakdown_id: Optional[UUID] = None
    cost_center: Optional[str] = None
    gl_account: Optional[str] = None
    planned_amount: Decimal = Field(ge=0)
    committed_amount: Optional[Decimal] = Field(default=0, ge=0)
    actual_amount: Optional[Decimal] = Field(default=0, ge=0)
    currency: str = "USD"
    breakdown_type: POBreakdownType
    category: Optional[str] = None
    subcategory: Optional[str] = None
    custom_fields: Optional[Dict[str, Any]] = None
    tags: Optional[List[str]] = None
    notes: Optional[str] = None


class POBreakdownUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    planned_amount: Optional[Decimal] = Field(None, ge=0)
    committed_amount: Optional[Decimal] = Field(None, ge=0)
    actual_amount: Optional[Decimal] = Field(None, ge=0)
    cost_center: Optional[str] = None
    gl_account: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    custom_fields: Optional[Dict[str, Any]] = None
    tags: Optional[List[str]] = None
    notes: Optional[str] = None


class POBreakdown(BaseModel):
    id: UUID
    project_id: UUID
    name: str
    code: Optional[str]
    sap_po_number: Optional[str]
    sap_line_item: Optional[str]
    hierarchy_level: int
    parent_breakdown_id: Optional[UUID]
    cost_center: Optional[str]
    gl_account: Optional[str]
    planned_amount: Decimal
    committed_amount: Decimal
    actual_amount: Decimal
    remaining_amount: Decimal
    currency: str
    breakdown_type: POBreakdownType
    category: Optional[str]
    subcategory: Optional[str]
    custom_fields: Dict[str, Any]
    tags: List[str]
    notes: Optional[str]
    import_batch_id: Optional[UUID]
    import_source: Optional[str]
    version: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ImportConfig(BaseModel):
    delimiter: str = ","
    encoding: str = "utf-8"
    has_header: bool = True
    column_mappings: Dict[str, str]  # CSV column -> model field
    default_breakdown_type: POBreakdownType = POBreakdownType.sap_standard
    default_currency: str = "USD"
    skip_validation_errors: bool = False


class ImportResult(BaseModel):
    success: bool
    import_batch_id: Optional[UUID]
    total_rows: int
    successful_imports: int
    failed_imports: int
    errors: List[str]
    warnings: List[str]
    created_breakdowns: List[UUID]


class ChangeRequestPOLink(BaseModel):
    change_request_id: UUID
    po_breakdown_id: UUID
    impact_type: ImpactType
    impact_amount: Optional[Decimal] = None
    impact_percentage: Optional[Decimal] = None
    description: Optional[str] = None


# Report Generation Models
class ChartConfig(BaseModel):
    chart_type: str  # 'bar', 'line', 'pie', 'scatter'
    data_source: str
    title: str
    x_axis: Optional[str] = None
    y_axis: Optional[str] = None
    series: Optional[List[str]] = None
    colors: Optional[List[str]] = None


class ReportTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    template_type: ReportTemplateType
    google_slides_template_id: Optional[str] = None
    google_drive_folder_id: Optional[str] = None
    data_mappings: Dict[str, str]
    chart_configurations: Optional[List[ChartConfig]] = None
    slide_layouts: Optional[List[Dict[str, Any]]] = None
    is_public: bool = False
    allowed_roles: Optional[List[str]] = None
    tags: Optional[List[str]] = None


class ReportTemplate(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    template_type: ReportTemplateType
    google_slides_template_id: Optional[str]
    google_drive_folder_id: Optional[str]
    data_mappings: Dict[str, str]
    chart_configurations: List[ChartConfig]
    slide_layouts: List[Dict[str, Any]]
    version: str
    is_active: bool
    is_default: bool
    is_public: bool
    allowed_roles: List[str]
    tags: List[str]
    created_by: UUID
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ReportConfig(BaseModel):
    template_id: UUID
    data_range_start: Optional[date] = None
    data_range_end: Optional[date] = None
    include_charts: bool = True
    include_raw_data: bool = False
    custom_title: Optional[str] = None
    additional_data: Optional[Dict[str, Any]] = None


class ReportGenerationRequest(BaseModel):
    project_id: UUID
    config: ReportConfig
    name: Optional[str] = None
    description: Optional[str] = None


class GeneratedReport(BaseModel):
    id: UUID
    project_id: UUID
    template_id: UUID
    name: str
    description: Optional[str]
    google_drive_url: Optional[str]
    google_slides_id: Optional[str]
    google_drive_file_id: Optional[str]
    generation_status: ReportGenerationStatus
    progress_percentage: int
    error_message: Optional[str]
    generation_time_ms: Optional[int]
    generated_by: UUID
    created_at: datetime
    completed_at: Optional[datetime]
    
    class Config:
        from_attributes = True


# Statistics and Analytics Models
class ProjectSimulationStats(BaseModel):
    total_simulations: int
    monte_carlo_count: int
    what_if_count: int
    avg_execution_time_ms: Optional[float]
    latest_simulation_date: Optional[datetime]


class ChangeRequestStats(BaseModel):
    total_changes: int
    draft_changes: int
    submitted_changes: int
    approved_changes: int
    rejected_changes: int
    implemented_changes: int
    total_cost_impact: Decimal
    total_schedule_impact: int


class POBreakdownSummary(BaseModel):
    total_planned: Decimal
    total_committed: Decimal
    total_actual: Decimal
    total_remaining: Decimal
    breakdown_count: int
    hierarchy_levels: int
    currency: str


# Access Log Models
class ShareableURLAccessLog(BaseModel):
    id: UUID
    shareable_url_id: UUID
    accessed_at: datetime
    ip_address: Optional[str]
    user_agent: Optional[str]
    referer: Optional[str]
    access_granted: bool
    denial_reason: Optional[str]
    sections_accessed: List[str]
    session_duration_seconds: Optional[int]
    
    class Config:
        from_attributes = True