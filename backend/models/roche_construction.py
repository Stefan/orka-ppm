"""
Pydantic models for Roche Construction/Engineering PPM Features

This module contains all data models for the six specialized Construction/Engineering
PPM features: Shareable Project URLs, Monte Carlo Risk Simulations, What-If Scenario
Analysis, Integrated Change Management, SAP PO Breakdown Management, and Google Suite
Report Generation.
"""

from pydantic import BaseModel, Field, validator, field_validator
from typing import List, Dict, Any, Optional
from datetime import datetime, date
from decimal import Decimal
from enum import Enum
from uuid import UUID


# ============================================================================
# Enums
# ============================================================================

class ShareablePermissionLevel(str, Enum):
    """Permission levels for shareable URLs"""
    view_basic = "view_basic"
    view_financial = "view_financial"
    view_risks = "view_risks"
    view_resources = "view_resources"
    view_timeline = "view_timeline"


class SimulationType(str, Enum):
    """Types of simulations supported"""
    monte_carlo = "monte_carlo"
    what_if = "what_if"
    sensitivity_analysis = "sensitivity_analysis"


class ChangeRequestType(str, Enum):
    """Types of change requests"""
    scope = "scope"
    schedule = "schedule"
    budget = "budget"
    resource = "resource"
    quality = "quality"
    risk = "risk"


class ChangeRequestStatus(str, Enum):
    """Status values for change requests"""
    draft = "draft"
    submitted = "submitted"
    under_review = "under_review"
    approved = "approved"
    rejected = "rejected"
    implemented = "implemented"
    cancelled = "cancelled"


class POBreakdownType(str, Enum):
    """Types of PO breakdown structures"""
    sap_standard = "sap_standard"
    custom_hierarchy = "custom_hierarchy"
    cost_center = "cost_center"
    work_package = "work_package"


class ReportTemplateType(str, Enum):
    """Types of report templates"""
    executive_summary = "executive_summary"
    project_status = "project_status"
    risk_assessment = "risk_assessment"
    financial_report = "financial_report"
    custom = "custom"


class ReportGenerationStatus(str, Enum):
    """Status values for report generation"""
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"


class Priority(str, Enum):
    """Priority levels"""
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class ImpactType(str, Enum):
    """Types of impacts for change request PO links"""
    cost_increase = "cost_increase"
    cost_decrease = "cost_decrease"
    scope_change = "scope_change"
    reallocation = "reallocation"
    new_po = "new_po"
    po_cancellation = "po_cancellation"


# ============================================================================
# Shareable URLs Models
# ============================================================================

class ShareablePermissions(BaseModel):
    """Permissions configuration for shareable URLs"""
    can_view_basic_info: bool = True
    can_view_financial: bool = False
    can_view_risks: bool = False
    can_view_resources: bool = False
    can_view_timeline: bool = True
    allowed_sections: List[str] = Field(default_factory=list)


class ShareableURLCreate(BaseModel):
    """Request model for creating a shareable URL"""
    project_id: UUID
    permissions: ShareablePermissions
    expires_at: datetime
    description: Optional[str] = None
    
    @field_validator('expires_at')
    @classmethod
    def validate_expiration(cls, v: datetime) -> datetime:
        if v <= datetime.now():
            raise ValueError('Expiration time must be in the future')
        return v


class ShareableURLResponse(BaseModel):
    """Response model for shareable URL"""
    id: UUID
    project_id: UUID
    token: str
    permissions: ShareablePermissions
    created_by: UUID
    expires_at: datetime
    access_count: int
    last_accessed: Optional[datetime] = None
    is_revoked: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ShareableURLValidation(BaseModel):
    """Validation result for shareable URL token"""
    is_valid: bool
    permissions: Optional[ShareablePermissions] = None
    project_id: Optional[UUID] = None
    error_message: Optional[str] = None


class ShareableURLAccessLog(BaseModel):
    """Access log entry for shareable URL"""
    id: UUID
    shareable_url_id: UUID
    accessed_at: datetime
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    referer: Optional[str] = None
    access_granted: bool
    denial_reason: Optional[str] = None
    sections_accessed: List[str] = Field(default_factory=list)
    session_duration_seconds: Optional[int] = None
    
    class Config:
        from_attributes = True


# ============================================================================
# Simulation Models
# ============================================================================

class SimulationConfig(BaseModel):
    """Configuration for Monte Carlo simulation"""
    iterations: int = Field(default=10000, ge=1000, le=100000)
    confidence_levels: List[float] = Field(default=[0.1, 0.5, 0.9])
    include_cost_analysis: bool = True
    include_schedule_analysis: bool = True
    risk_correlation_matrix: Optional[Dict[str, Dict[str, float]]] = None
    
    @field_validator('confidence_levels')
    @classmethod
    def validate_confidence_levels(cls, v: List[float]) -> List[float]:
        for level in v:
            if not 0 < level < 1:
                raise ValueError('Confidence levels must be between 0 and 1')
        return sorted(v)


class SimulationStatistics(BaseModel):
    """Statistical results from simulation"""
    mean_cost: Optional[float] = None
    std_cost: Optional[float] = None
    mean_schedule: Optional[float] = None
    std_schedule: Optional[float] = None
    correlation_coefficient: Optional[float] = None


class SimulationCreate(BaseModel):
    """Request model for creating a simulation"""
    project_id: UUID
    simulation_type: SimulationType
    name: str
    description: Optional[str] = None
    config: SimulationConfig


class SimulationResult(BaseModel):
    """Simulation result with statistical analysis"""
    id: UUID
    project_id: UUID
    simulation_type: SimulationType
    name: str
    description: Optional[str] = None
    config: SimulationConfig
    results: Dict[str, Any]
    statistics: Optional[SimulationStatistics] = None
    percentiles: Dict[str, float]  # P10, P50, P90
    distribution_data: Optional[Dict[str, List[float]]] = None
    execution_time_ms: Optional[int] = None
    iterations_completed: Optional[int] = None
    created_by: UUID
    created_at: datetime
    is_cached: bool = True
    cache_expires_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class ProjectSimulationStats(BaseModel):
    """Aggregated simulation statistics for a project"""
    total_simulations: int
    monte_carlo_count: int
    what_if_count: int
    avg_execution_time_ms: Optional[float] = None
    latest_simulation_date: Optional[datetime] = None


# ============================================================================
# Scenario Analysis Models
# ============================================================================

class ProjectChanges(BaseModel):
    """Parameter changes for what-if scenario"""
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    budget: Optional[Decimal] = None
    resource_allocations: Optional[Dict[str, float]] = None
    milestone_dates: Optional[Dict[str, date]] = None
    risk_adjustments: Optional[Dict[str, Dict[str, float]]] = None


class TimelineImpact(BaseModel):
    """Timeline impact analysis results"""
    original_duration: int  # days
    new_duration: int
    duration_change: int
    critical_path_affected: bool
    affected_milestones: List[str]


class CostImpact(BaseModel):
    """Cost impact analysis results"""
    original_cost: Decimal
    new_cost: Decimal
    cost_change: Decimal
    cost_change_percentage: float
    affected_categories: List[str]


class ResourceImpact(BaseModel):
    """Resource impact analysis results"""
    utilization_changes: Dict[str, float]
    over_allocated_resources: List[str]
    under_allocated_resources: List[str]
    new_resource_requirements: List[str]


class ScenarioConfig(BaseModel):
    """Configuration for what-if scenario"""
    name: str
    description: Optional[str] = None
    parameter_changes: ProjectChanges
    analysis_scope: List[str] = Field(default=['timeline', 'cost', 'resources'])


class ScenarioCreate(BaseModel):
    """Request model for creating a scenario"""
    project_id: UUID
    base_scenario_id: Optional[UUID] = None
    config: ScenarioConfig


class ScenarioAnalysis(BaseModel):
    """What-if scenario analysis with impact results"""
    id: UUID
    project_id: UUID
    name: str
    description: Optional[str] = None
    base_scenario_id: Optional[UUID] = None
    parameter_changes: ProjectChanges
    timeline_impact: Optional[TimelineImpact] = None
    cost_impact: Optional[CostImpact] = None
    resource_impact: Optional[ResourceImpact] = None
    created_by: UUID
    created_at: datetime
    updated_at: datetime
    is_active: bool
    is_baseline: bool
    
    class Config:
        from_attributes = True


class ScenarioComparison(BaseModel):
    """Comparison results between multiple scenarios"""
    scenarios: List[ScenarioAnalysis]
    comparison_matrix: Dict[str, Dict[str, Any]]
    recommendations: List[str]


# ============================================================================
# Change Management Models
# ============================================================================

class ImpactAssessment(BaseModel):
    """Impact assessment for change request"""
    cost_impact: Optional[Decimal] = None
    schedule_impact: Optional[int] = None  # days
    resource_impact: Optional[Dict[str, Any]] = None
    risk_impact: Optional[Dict[str, Any]] = None
    quality_impact: Optional[str] = None
    stakeholder_impact: Optional[List[str]] = None


class ChangeRequestCreate(BaseModel):
    """Request model for creating a change request"""
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
    """Request model for updating a change request"""
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
    """Change request with full details"""
    id: UUID
    project_id: UUID
    change_number: str
    title: str
    description: str
    change_type: ChangeRequestType
    priority: Priority
    impact_assessment: ImpactAssessment
    justification: str
    business_case: Optional[str] = None
    requested_by: UUID
    assigned_to: Optional[UUID] = None
    status: ChangeRequestStatus
    workflow_instance_id: Optional[UUID] = None
    estimated_cost_impact: Optional[Decimal] = None
    estimated_schedule_impact: Optional[int] = None
    actual_cost_impact: Optional[Decimal] = None
    actual_schedule_impact: Optional[int] = None
    approved_at: Optional[datetime] = None
    approved_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ApprovalDecision(BaseModel):
    """Approval or rejection decision for change request"""
    decision: str = Field(..., pattern="^(approve|reject)$")
    comments: Optional[str] = None
    conditions: Optional[List[str]] = None


class ChangeRequestStats(BaseModel):
    """Aggregated statistics for change requests"""
    total_changes: int
    draft_changes: int
    submitted_changes: int
    under_review_changes: int
    approved_changes: int
    rejected_changes: int
    implemented_changes: int
    total_cost_impact: Decimal
    total_schedule_impact: int


# ============================================================================
# PO Breakdown Models
# ============================================================================

class POBreakdownCreate(BaseModel):
    """Request model for creating a PO breakdown"""
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
    """Request model for updating a PO breakdown"""
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
    """PO breakdown with hierarchical structure"""
    id: UUID
    project_id: UUID
    name: str
    code: Optional[str] = None
    sap_po_number: Optional[str] = None
    sap_line_item: Optional[str] = None
    hierarchy_level: int
    parent_breakdown_id: Optional[UUID] = None
    cost_center: Optional[str] = None
    gl_account: Optional[str] = None
    planned_amount: Decimal
    committed_amount: Decimal
    actual_amount: Decimal
    remaining_amount: Decimal
    currency: str
    breakdown_type: POBreakdownType
    category: Optional[str] = None
    subcategory: Optional[str] = None
    custom_fields: Dict[str, Any] = Field(default_factory=dict)
    tags: List[str] = Field(default_factory=list)
    notes: Optional[str] = None
    import_batch_id: Optional[UUID] = None
    import_source: Optional[str] = None
    version: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ImportConfig(BaseModel):
    """Configuration for CSV import"""
    delimiter: str = ","
    encoding: str = "utf-8"
    has_header: bool = True
    column_mappings: Dict[str, str]  # CSV column -> model field
    default_breakdown_type: POBreakdownType = POBreakdownType.sap_standard
    default_currency: str = "USD"
    skip_validation_errors: bool = False


class ImportResult(BaseModel):
    """Result of CSV import operation"""
    success: bool
    import_batch_id: Optional[UUID] = None
    total_rows: int
    successful_imports: int
    failed_imports: int
    errors: List[str]
    warnings: List[str]
    created_breakdowns: List[UUID]


class ChangeRequestPOLink(BaseModel):
    """Link between change request and PO breakdown"""
    change_request_id: UUID
    po_breakdown_id: UUID
    impact_type: ImpactType
    impact_amount: Optional[Decimal] = None
    impact_percentage: Optional[Decimal] = None
    description: Optional[str] = None


class POBreakdownSummary(BaseModel):
    """Summary statistics for PO breakdowns"""
    total_planned: Decimal
    total_committed: Decimal
    total_actual: Decimal
    total_remaining: Decimal
    breakdown_count: int
    hierarchy_levels: int
    currency: str


# ============================================================================
# Report Generation Models
# ============================================================================

class ChartConfig(BaseModel):
    """Configuration for chart in report"""
    chart_type: str  # 'bar', 'line', 'pie', 'scatter'
    data_source: str
    title: str
    x_axis: Optional[str] = None
    y_axis: Optional[str] = None
    series: Optional[List[str]] = None
    colors: Optional[List[str]] = None


class ReportTemplateCreate(BaseModel):
    """Request model for creating a report template"""
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
    """Report template with configuration"""
    id: UUID
    name: str
    description: Optional[str] = None
    template_type: ReportTemplateType
    google_slides_template_id: Optional[str] = None
    google_drive_folder_id: Optional[str] = None
    data_mappings: Dict[str, str]
    chart_configurations: List[ChartConfig] = Field(default_factory=list)
    slide_layouts: List[Dict[str, Any]] = Field(default_factory=list)
    version: str
    is_active: bool
    is_default: bool
    is_public: bool
    allowed_roles: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    created_by: UUID
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ReportConfig(BaseModel):
    """Configuration for report generation"""
    template_id: UUID
    data_range_start: Optional[date] = None
    data_range_end: Optional[date] = None
    include_charts: bool = True
    include_raw_data: bool = False
    custom_title: Optional[str] = None
    additional_data: Optional[Dict[str, Any]] = None


class ReportGenerationRequest(BaseModel):
    """Request model for generating a report"""
    project_id: UUID
    config: ReportConfig
    name: Optional[str] = None
    description: Optional[str] = None


class GeneratedReport(BaseModel):
    """Generated report with status and links"""
    id: UUID
    project_id: UUID
    template_id: UUID
    name: str
    description: Optional[str] = None
    google_drive_url: Optional[str] = None
    google_slides_id: Optional[str] = None
    google_drive_file_id: Optional[str] = None
    generation_status: ReportGenerationStatus
    progress_percentage: int
    error_message: Optional[str] = None
    generation_time_ms: Optional[int] = None
    generated_by: UUID
    created_at: datetime
    completed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True
