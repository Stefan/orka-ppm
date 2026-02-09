"""
Data models for Change Order Management system.

Formal change order processing with cost impact analysis,
multi-level approval workflows, and contract integration.
"""

from enum import Enum
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from decimal import Decimal
from uuid import UUID
from pydantic import BaseModel, Field


class ChangeOrderCategory(str, Enum):
    """Change order categories per construction/engineering standards."""
    OWNER_DIRECTED = "owner_directed"
    DESIGN_CHANGE = "design_change"
    FIELD_CONDITION = "field_condition"
    REGULATORY = "regulatory"


class ChangeOrderSource(str, Enum):
    """Source of the change order."""
    OWNER = "owner"
    DESIGNER = "designer"
    CONTRACTOR = "contractor"
    REGULATORY_AGENCY = "regulatory_agency"


class ChangeOrderStatus(str, Enum):
    """Change order lifecycle status."""
    DRAFT = "draft"
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    IMPLEMENTED = "implemented"


class CostCategory(str, Enum):
    """Cost categories for line items."""
    LABOR = "labor"
    MATERIAL = "material"
    EQUIPMENT = "equipment"
    SUBCONTRACT = "subcontract"
    OTHER = "other"


class PricingMethod(str, Enum):
    """Pricing methods for change orders."""
    UNIT_RATES = "unit_rates"
    LUMP_SUM = "lump_sum"
    COST_PLUS = "cost_plus"
    NEGOTIATED = "negotiated"


class ApprovalStatus(str, Enum):
    """Approval status for change order approvals."""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CONDITIONAL = "conditional"


class DocumentType(str, Enum):
    """Change order document types."""
    DRAWING = "drawing"
    SPECIFICATION = "specification"
    CALCULATION = "calculation"
    PHOTO = "photo"
    CORRESPONDENCE = "correspondence"


class AccessLevel(str, Enum):
    """Document access levels."""
    PUBLIC = "public"
    PROJECT_TEAM = "project_team"
    MANAGEMENT = "management"
    CONFIDENTIAL = "confidential"


# =============================================================================
# Change Order Models
# =============================================================================


class ChangeOrderLineItemCreate(BaseModel):
    """Create request for change order line item."""
    description: str = Field(..., min_length=1)
    work_package_id: Optional[UUID] = None
    trade_category: str = Field(..., min_length=1)
    unit_of_measure: str = Field(..., min_length=1)
    quantity: float = Field(..., gt=0)
    unit_rate: float = Field(..., ge=0)
    markup_percentage: float = Field(0.0, ge=0, le=100)
    overhead_percentage: float = Field(0.0, ge=0, le=100)
    contingency_percentage: float = Field(0.0, ge=0, le=100)
    cost_category: CostCategory
    is_add: bool = True


class ChangeOrderLineItem(BaseModel):
    """Change order line item model."""
    id: UUID
    change_order_id: UUID
    line_number: int
    description: str
    work_package_id: Optional[UUID] = None
    trade_category: str
    unit_of_measure: str
    quantity: float
    unit_rate: float
    extended_cost: float
    markup_percentage: float = 0.0
    overhead_percentage: float = 0.0
    contingency_percentage: float = 0.0
    total_cost: float
    cost_category: str
    is_add: bool = True


class ChangeOrderCreate(BaseModel):
    """Create request for change order."""
    project_id: UUID
    title: str = Field(..., min_length=5, max_length=255)
    description: str = Field(..., min_length=10)
    justification: str = Field(..., min_length=10)
    change_category: ChangeOrderCategory
    change_source: ChangeOrderSource
    impact_type: List[str] = Field(
        default_factory=lambda: ["cost"],
        description="e.g. cost, schedule, scope, quality"
    )
    priority: str = "medium"
    original_contract_value: float = Field(..., gt=0)
    proposed_schedule_impact_days: int = Field(0, ge=0)
    contract_reference: Optional[str] = None
    line_items: List[ChangeOrderLineItemCreate] = Field(default_factory=list)


class ChangeOrderUpdate(BaseModel):
    """Update request for change order."""
    title: Optional[str] = Field(None, min_length=5, max_length=255)
    description: Optional[str] = Field(None, min_length=10)
    justification: Optional[str] = Field(None, min_length=10)
    change_category: Optional[ChangeOrderCategory] = None
    change_source: Optional[ChangeOrderSource] = None
    impact_type: Optional[List[str]] = None
    priority: Optional[str] = None
    original_contract_value: Optional[float] = Field(None, gt=0)
    proposed_schedule_impact_days: Optional[int] = Field(None, ge=0)
    contract_reference: Optional[str] = None


class ChangeOrder(BaseModel):
    """Full change order model."""
    id: UUID
    project_id: UUID
    change_order_number: str
    title: str
    description: str
    justification: str
    change_category: str
    change_source: str
    impact_type: List[str]
    priority: str = "medium"
    status: str = "draft"
    original_contract_value: float
    proposed_cost_impact: float
    approved_cost_impact: Optional[float] = None
    proposed_schedule_impact_days: int = 0
    approved_schedule_impact_days: Optional[int] = None
    created_by: UUID
    submitted_date: Optional[datetime] = None
    required_approval_date: Optional[datetime] = None
    approved_date: Optional[datetime] = None
    implementation_date: Optional[datetime] = None
    contract_reference: Optional[str] = None
    is_active: bool = True
    created_at: datetime
    updated_at: datetime


class ChangeOrderResponse(BaseModel):
    """API response for change order."""
    id: str
    project_id: str
    change_order_number: str
    title: str
    description: str
    justification: str
    change_category: str
    change_source: str
    impact_type: List[str]
    priority: str
    status: str
    original_contract_value: float
    proposed_cost_impact: float
    approved_cost_impact: Optional[float] = None
    proposed_schedule_impact_days: int
    approved_schedule_impact_days: Optional[int] = None
    created_by: str
    submitted_date: Optional[datetime] = None
    required_approval_date: Optional[datetime] = None
    approved_date: Optional[datetime] = None
    implementation_date: Optional[datetime] = None
    contract_reference: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ChangeOrderDetailResponse(ChangeOrderResponse):
    """Detailed change order response with line items."""
    line_items: List[ChangeOrderLineItem] = Field(default_factory=list)


# =============================================================================
# Cost Impact Analysis Models
# =============================================================================


class CostImpactAnalysisCreate(BaseModel):
    """Create request for cost impact analysis."""
    direct_costs: Dict[str, float] = Field(default_factory=dict)
    indirect_costs: Dict[str, float] = Field(default_factory=dict)
    schedule_impact_costs: Dict[str, float] = Field(default_factory=dict)
    risk_adjustments: Dict[str, float] = Field(default_factory=dict)
    confidence_level: float = Field(0.8, ge=0, le=1.0)
    pricing_method: PricingMethod
    benchmarking_data: Optional[Dict[str, Any]] = None


class CostImpactAnalysis(BaseModel):
    """Cost impact analysis model."""
    id: UUID
    change_order_id: UUID
    analysis_date: datetime
    direct_costs: Dict[str, float]
    indirect_costs: Dict[str, float]
    schedule_impact_costs: Dict[str, float]
    risk_adjustments: Dict[str, float]
    total_cost_impact: float
    confidence_level: float
    cost_breakdown_structure: Optional[Dict[str, Any]] = None
    pricing_method: str
    benchmarking_data: Optional[Dict[str, Any]] = None
    analyzed_by: UUID


class CostImpactAnalysisResponse(BaseModel):
    """API response for cost impact analysis."""
    id: str
    change_order_id: str
    analysis_date: datetime
    direct_costs: Dict[str, float]
    indirect_costs: Dict[str, float]
    schedule_impact_costs: Dict[str, float]
    risk_adjustments: Dict[str, float]
    total_cost_impact: float
    confidence_level: float
    cost_breakdown_structure: Optional[Dict[str, Any]] = None
    pricing_method: str
    benchmarking_data: Optional[Dict[str, Any]] = None
    analyzed_by: str


class CostScenarioRequest(BaseModel):
    """Request for cost scenario generation."""
    scenarios: List[str] = Field(
        default_factory=lambda: ["optimistic", "most_likely", "pessimistic"]
    )


class CostScenarioResponse(BaseModel):
    """Response for a single cost scenario."""
    scenario_name: str
    total_cost: float
    breakdown: Dict[str, float]
    confidence_level: float


# =============================================================================
# Approval Workflow Models
# =============================================================================


class ApprovalWorkflowConfig(BaseModel):
    """Configuration for approval workflow initiation."""
    approval_levels: Optional[List[Dict[str, Any]]] = None
    required_approval_date: Optional[datetime] = None


class ApprovalDecision(BaseModel):
    """Approval decision submission."""
    comments: Optional[str] = None
    conditions: Optional[List[str]] = None


class RejectionReason(BaseModel):
    """Rejection reason for change order."""
    comments: str = Field(..., min_length=10)
    conditions: Optional[List[str]] = None


class ChangeOrderApproval(BaseModel):
    """Change order approval record."""
    id: UUID
    change_order_id: UUID
    approval_level: int
    approver_role: str
    approver_user_id: UUID
    approval_limit: Optional[float] = None
    status: str = "pending"
    approval_date: Optional[datetime] = None
    comments: Optional[str] = None
    conditions: Optional[List[str]] = None
    delegated_to: Optional[UUID] = None
    is_required: bool = True
    sequence_order: int


class ApprovalWorkflowResponse(BaseModel):
    """API response for approval workflow."""
    change_order_id: str
    workflow_status: str
    current_level: int
    total_levels: int
    pending_approvals: List[Dict[str, Any]]


class PendingApprovalResponse(BaseModel):
    """Response for pending approval."""
    id: str
    change_order_id: str
    change_order_number: str
    change_order_title: str
    approval_level: int
    proposed_cost_impact: float
    due_date: Optional[datetime] = None


class ApprovalResponse(BaseModel):
    """Response for approval decision."""
    approval_id: str
    status: str
    message: str


class WorkflowStatusResponse(BaseModel):
    """Response for workflow status."""
    change_order_id: str
    status: str
    approval_levels: List[Dict[str, Any]]
    is_complete: bool
    can_proceed: bool


# =============================================================================
# Contract Integration Models
# =============================================================================


class ContractChangeProvision(BaseModel):
    """Contract change provision model."""
    id: UUID
    project_id: UUID
    contract_section: str
    change_type: str
    approval_authority: str
    monetary_limit: Optional[float] = None
    time_limit_days: Optional[int] = None
    pricing_mechanism: str
    required_documentation: List[str]
    approval_process: str
    is_active: bool = True


class ContractComplianceResponse(BaseModel):
    """API response for contract compliance validation."""
    is_compliant: bool
    issues: List[str] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)
    provisions_applied: List[str] = Field(default_factory=list)


class ContractPricingRequest(BaseModel):
    """Request for contract pricing application."""
    use_contract_rates: bool = True
    pricing_method: Optional[PricingMethod] = None


class ContractPricingResponse(BaseModel):
    """Response for contract pricing application."""
    applied: bool
    pricing_method: str
    total_cost: float
    details: Dict[str, Any]


# =============================================================================
# Document Models
# =============================================================================


class ChangeOrderDocument(BaseModel):
    """Change order document model."""
    id: UUID
    change_order_id: UUID
    document_type: str
    file_name: str
    file_path: str
    file_size: int
    mime_type: str
    version: str = "1.0"
    description: Optional[str] = None
    uploaded_by: UUID
    upload_date: datetime
    is_current_version: bool = True
    access_level: str = "project_team"


# =============================================================================
# Analytics and Metrics Models
# =============================================================================


class ChangeOrderMetrics(BaseModel):
    """Change order metrics model."""
    id: UUID
    project_id: UUID
    measurement_period: str
    period_start_date: date
    period_end_date: date
    total_change_orders: int
    approved_change_orders: int
    rejected_change_orders: int
    pending_change_orders: int
    total_cost_impact: float
    average_processing_time_days: float
    average_approval_time_days: float
    change_order_velocity: float
    cost_growth_percentage: float
    schedule_impact_days: int
    change_categories_breakdown: Dict[str, int]
    change_sources_breakdown: Dict[str, int]


class ChangeOrderMetricsResponse(BaseModel):
    """API response for change order metrics."""
    project_id: str
    period: str
    total_change_orders: int
    approved_change_orders: int
    rejected_change_orders: int
    pending_change_orders: int
    total_cost_impact: float
    average_processing_time_days: float
    average_approval_time_days: float
    change_order_velocity: float
    cost_growth_percentage: float
    schedule_impact_days: int
    change_categories_breakdown: Dict[str, int]
    change_sources_breakdown: Dict[str, int]


class ChangeOrderTrendsResponse(BaseModel):
    """API response for change order trends."""
    project_id: str
    period_months: int
    trends: List[Dict[str, Any]]
    forecasts: Optional[Dict[str, Any]] = None


class ChangeOrderDashboardResponse(BaseModel):
    """API response for change order dashboard."""
    project_id: str
    summary: Dict[str, Any]
    recent_change_orders: List[Dict[str, Any]]
    pending_approvals: List[Dict[str, Any]]
    cost_impact_summary: Dict[str, Any]


class ChangeOrderReportConfig(BaseModel):
    """Configuration for change order report generation."""
    report_type: str = "summary"
    include_trends: bool = True
    date_from: Optional[date] = None
    date_to: Optional[date] = None


class ChangeOrderReportResponse(BaseModel):
    """Response for change order report."""
    report_id: str
    report_type: str
    generated_at: datetime
    content: Dict[str, Any]


# =============================================================================
# AI Estimate and Recommendations (Phase 8)
# =============================================================================


class AIEstimateLineItemInput(BaseModel):
    """Minimal line item input for AI cost estimate."""
    description: str = ""
    quantity: float = Field(1.0, ge=0)
    unit_rate: float = Field(0.0, ge=0)
    cost_category: Optional[str] = None


class AIEstimateRequest(BaseModel):
    """Request for AI-assisted cost impact estimation."""
    description: str = Field(..., min_length=1, description="Change order description")
    line_items: List[AIEstimateLineItemInput] = Field(default_factory=list)
    change_category: Optional[ChangeOrderCategory] = None


class AIEstimateResponse(BaseModel):
    """Response for AI cost impact estimate."""
    estimated_min: float = Field(..., ge=0)
    estimated_max: float = Field(..., ge=0)
    confidence: float = Field(..., ge=0, le=1.0)
    method: str = "rule_based"
    notes: Optional[List[str]] = None


class AIRecommendationItem(BaseModel):
    """Single AI recommendation for approval workflow."""
    text: str
    type: str = Field(..., description="hint | risk | checkpoint")


class AIRecommendationsResponse(BaseModel):
    """Response for AI approval recommendations."""
    recommendations: List[AIRecommendationItem] = Field(default_factory=list)
    variance_audit_context: Optional[Dict[str, Any]] = None
