"""
Enhanced Project Monthly Report (PMR) - Pydantic Models
"""

from pydantic import BaseModel, Field, validator
from datetime import datetime, date
from enum import Enum
from uuid import UUID
from typing import Optional, List, Dict, Any, Union
from decimal import Decimal

# Import base models
from .base import BaseResponse


class PMRStatus(str, Enum):
    """PMR report status"""
    draft = "draft"
    review = "review"
    approved = "approved"
    distributed = "distributed"


class PMRTemplateType(str, Enum):
    """PMR template types"""
    executive = "executive"
    technical = "technical"
    financial = "financial"
    custom = "custom"


class AIInsightType(str, Enum):
    """AI insight types"""
    prediction = "prediction"
    recommendation = "recommendation"
    alert = "alert"
    summary = "summary"


class AIInsightCategory(str, Enum):
    """AI insight categories"""
    budget = "budget"
    schedule = "schedule"
    resource = "resource"
    risk = "risk"
    quality = "quality"


class AIInsightPriority(str, Enum):
    """AI insight priority levels"""
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class EditSessionType(str, Enum):
    """Interactive edit session types"""
    chat = "chat"
    direct = "direct"
    collaborative = "collaborative"


class ExportFormat(str, Enum):
    """Export format types"""
    pdf = "pdf"
    excel = "excel"
    slides = "slides"
    word = "word"
    powerpoint = "powerpoint"


class ExportJobStatus(str, Enum):
    """Export job status"""
    queued = "queued"
    processing = "processing"
    completed = "completed"
    failed = "failed"


# Core PMR Models

class PMRReportBase(BaseModel):
    """Base PMR report model"""
    project_id: UUID
    report_month: date
    report_year: int
    template_id: UUID
    title: str
    executive_summary: Optional[str] = None
    ai_generated_insights: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    sections: List[Dict[str, Any]] = Field(default_factory=list)
    metrics: Optional[Dict[str, Any]] = Field(default_factory=dict)
    visualizations: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    status: PMRStatus = PMRStatus.draft
    version: int = 1
    is_active: bool = True

    @validator('report_year')
    def validate_report_year(cls, v):
        current_year = datetime.now().year
        if v < 2020 or v > current_year + 5:
            raise ValueError(f'Report year must be between 2020 and {current_year + 5}')
        return v

    @validator('version')
    def validate_version(cls, v):
        if v < 1:
            raise ValueError('Version must be at least 1')
        return v


class PMRReportCreate(PMRReportBase):
    """PMR report creation model"""
    generated_by: UUID


class PMRReportUpdate(BaseModel):
    """PMR report update model"""
    title: Optional[str] = None
    executive_summary: Optional[str] = None
    sections: Optional[List[Dict[str, Any]]] = None
    metrics: Optional[Dict[str, Any]] = None
    visualizations: Optional[List[Dict[str, Any]]] = None
    status: Optional[PMRStatus] = None
    approved_by: Optional[UUID] = None


class PMRReport(PMRReportBase):
    """Complete PMR report model"""
    id: UUID
    generated_by: UUID
    approved_by: Optional[UUID] = None
    generated_at: datetime
    last_modified: datetime
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PMRReportResponse(BaseResponse):
    """PMR report API response model"""
    project_id: UUID
    report_month: date
    report_year: int
    template_id: UUID
    title: str
    executive_summary: Optional[str]
    ai_generated_insights: List[Dict[str, Any]]
    sections: List[Dict[str, Any]]
    metrics: Dict[str, Any]
    visualizations: List[Dict[str, Any]]
    status: PMRStatus
    generated_by: UUID
    approved_by: Optional[UUID]
    generated_at: datetime
    last_modified: datetime
    version: int
    is_active: bool


# PMR Template Models

class PMRTemplateBase(BaseModel):
    """Base PMR template model"""
    name: str
    description: Optional[str] = None
    template_type: PMRTemplateType
    industry_focus: Optional[str] = None
    sections: List[Dict[str, Any]] = Field(default_factory=list)
    default_metrics: Optional[List[str]] = Field(default_factory=list)
    ai_suggestions: Optional[Dict[str, Any]] = Field(default_factory=dict)
    branding_config: Optional[Dict[str, Any]] = Field(default_factory=dict)
    export_formats: List[ExportFormat] = Field(default_factory=list)
    is_public: bool = False
    usage_count: int = 0
    rating: Optional[Decimal] = None

    @validator('rating')
    def validate_rating(cls, v):
        if v is not None and (v < 0 or v > 5):
            raise ValueError('Rating must be between 0 and 5')
        return v

    @validator('usage_count')
    def validate_usage_count(cls, v):
        if v < 0:
            raise ValueError('Usage count cannot be negative')
        return v


class PMRTemplateCreate(PMRTemplateBase):
    """PMR template creation model"""
    created_by: UUID
    organization_id: Optional[UUID] = None


class PMRTemplateUpdate(BaseModel):
    """PMR template update model"""
    name: Optional[str] = None
    description: Optional[str] = None
    sections: Optional[List[Dict[str, Any]]] = None
    default_metrics: Optional[List[str]] = None
    ai_suggestions: Optional[Dict[str, Any]] = None
    branding_config: Optional[Dict[str, Any]] = None
    export_formats: Optional[List[ExportFormat]] = None
    is_public: Optional[bool] = None
    rating: Optional[Decimal] = None


class PMRTemplate(PMRTemplateBase):
    """Complete PMR template model"""
    id: UUID
    created_by: UUID
    organization_id: Optional[UUID]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PMRTemplateResponse(BaseResponse):
    """PMR template API response model"""
    name: str
    description: Optional[str]
    template_type: PMRTemplateType
    industry_focus: Optional[str]
    sections: List[Dict[str, Any]]
    default_metrics: List[str]
    ai_suggestions: Dict[str, Any]
    branding_config: Dict[str, Any]
    export_formats: List[ExportFormat]
    is_public: bool
    created_by: UUID
    organization_id: Optional[UUID]
    usage_count: int
    rating: Optional[Decimal]


# AI Insight Models

class AIInsightBase(BaseModel):
    """Base AI insight model"""
    insight_type: AIInsightType
    category: AIInsightCategory
    title: str
    content: str
    confidence_score: Decimal = Field(ge=0.0, le=1.0)
    supporting_data: Optional[Dict[str, Any]] = Field(default_factory=dict)
    predicted_impact: Optional[str] = None
    recommended_actions: Optional[List[str]] = Field(default_factory=list)
    priority: AIInsightPriority = AIInsightPriority.medium
    validated: bool = False
    validation_notes: Optional[str] = None

    @validator('confidence_score')
    def validate_confidence_score(cls, v):
        if v < 0.0 or v > 1.0:
            raise ValueError('Confidence score must be between 0.0 and 1.0')
        return v


class AIInsightCreate(AIInsightBase):
    """AI insight creation model"""
    report_id: UUID


class AIInsightUpdate(BaseModel):
    """AI insight update model"""
    title: Optional[str] = None
    content: Optional[str] = None
    confidence_score: Optional[Decimal] = None
    predicted_impact: Optional[str] = None
    recommended_actions: Optional[List[str]] = None
    priority: Optional[AIInsightPriority] = None
    validated: Optional[bool] = None
    validation_notes: Optional[str] = None


class AIInsight(AIInsightBase):
    """Complete AI insight model"""
    id: UUID
    report_id: UUID
    generated_at: datetime
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AIInsightResponse(BaseResponse):
    """AI insight API response model"""
    report_id: UUID
    insight_type: AIInsightType
    category: AIInsightCategory
    title: str
    content: str
    confidence_score: Decimal
    supporting_data: Dict[str, Any]
    predicted_impact: Optional[str]
    recommended_actions: List[str]
    priority: AIInsightPriority
    generated_at: datetime
    validated: bool
    validation_notes: Optional[str]


# Interactive Edit Session Models

class EditSessionBase(BaseModel):
    """Base edit session model"""
    session_type: EditSessionType = EditSessionType.chat
    chat_messages: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    changes_made: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    active_section: Optional[str] = None
    is_active: bool = True


class EditSessionCreate(EditSessionBase):
    """Edit session creation model"""
    report_id: UUID
    user_id: UUID


class EditSessionUpdate(BaseModel):
    """Edit session update model"""
    chat_messages: Optional[List[Dict[str, Any]]] = None
    changes_made: Optional[List[Dict[str, Any]]] = None
    active_section: Optional[str] = None
    is_active: Optional[bool] = None


class EditSession(EditSessionBase):
    """Complete edit session model"""
    id: UUID
    report_id: UUID
    user_id: UUID
    started_at: datetime
    last_activity: datetime
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class EditSessionResponse(BaseResponse):
    """Edit session API response model"""
    report_id: UUID
    user_id: UUID
    session_type: EditSessionType
    chat_messages: List[Dict[str, Any]]
    changes_made: List[Dict[str, Any]]
    active_section: Optional[str]
    started_at: datetime
    last_activity: datetime
    is_active: bool


# Export Job Models

class ExportJobBase(BaseModel):
    """Base export job model"""
    export_format: ExportFormat
    template_config: Optional[Dict[str, Any]] = Field(default_factory=dict)
    export_options: Optional[Dict[str, Any]] = Field(default_factory=dict)
    status: ExportJobStatus = ExportJobStatus.queued
    file_url: Optional[str] = None
    file_size: Optional[int] = None
    error_message: Optional[str] = None

    @validator('file_size')
    def validate_file_size(cls, v):
        if v is not None and v < 0:
            raise ValueError('File size cannot be negative')
        return v


class ExportJobCreate(ExportJobBase):
    """Export job creation model"""
    report_id: UUID
    requested_by: UUID


class ExportJobUpdate(BaseModel):
    """Export job update model"""
    status: Optional[ExportJobStatus] = None
    file_url: Optional[str] = None
    file_size: Optional[int] = None
    error_message: Optional[str] = None
    completed_at: Optional[datetime] = None


class ExportJob(ExportJobBase):
    """Complete export job model"""
    id: UUID
    report_id: UUID
    requested_by: UUID
    started_at: datetime
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ExportJobResponse(BaseResponse):
    """Export job API response model"""
    report_id: UUID
    export_format: ExportFormat
    template_config: Dict[str, Any]
    status: ExportJobStatus
    file_url: Optional[str]
    file_size: Optional[int]
    export_options: Dict[str, Any]
    requested_by: UUID
    started_at: datetime
    completed_at: Optional[datetime]
    error_message: Optional[str]


# Request/Response Models for API Operations

class PMRGenerationRequest(BaseModel):
    """Request model for PMR generation"""
    project_id: UUID
    report_month: date
    report_year: int
    template_id: UUID
    title: str
    description: Optional[str] = None
    include_ai_insights: bool = True
    include_monte_carlo: bool = False
    custom_sections: Optional[List[Dict[str, Any]]] = None

    @validator('report_year')
    def validate_report_year(cls, v):
        current_year = datetime.now().year
        if v < 2020 or v > current_year + 5:
            raise ValueError(f'Report year must be between 2020 and {current_year + 5}')
        return v


class ChatEditRequest(BaseModel):
    """Request model for chat-based editing"""
    message: str
    session_id: Optional[str] = None
    context: Optional[Dict[str, Any]] = None

    @validator('message')
    def validate_message(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError('Message cannot be empty')
        if len(v) > 2000:
            raise ValueError('Message too long (max 2000 characters)')
        return v.strip()


class ChatEditResponse(BaseModel):
    """Response model for chat-based editing"""
    response: str
    changes_applied: List[Dict[str, Any]]
    session_id: str
    suggestions: Optional[List[Dict[str, Any]]] = None
    confidence: Decimal
    processing_time_ms: int


class SectionUpdateRequest(BaseModel):
    """Request model for section updates"""
    section_id: str
    content: Dict[str, Any]
    merge_strategy: str = "replace"  # "replace", "merge", "append"

    @validator('merge_strategy')
    def validate_merge_strategy(cls, v):
        if v not in ["replace", "merge", "append"]:
            raise ValueError('Merge strategy must be "replace", "merge", or "append"')
        return v


class SectionUpdateResponse(BaseModel):
    """Response model for section updates"""
    section_id: str
    updated_content: Dict[str, Any]
    version: int
    last_modified: datetime
    success: bool


class AISuggestionsRequest(BaseModel):
    """Request model for AI suggestions"""
    section: Optional[str] = None
    context: Optional[Dict[str, Any]] = None
    suggestion_type: str = "content"  # "content", "structure", "metrics", "visualizations"

    @validator('suggestion_type')
    def validate_suggestion_type(cls, v):
        if v not in ["content", "structure", "metrics", "visualizations"]:
            raise ValueError('Suggestion type must be one of: content, structure, metrics, visualizations')
        return v


class AISuggestionsResponse(BaseModel):
    """Response model for AI suggestions"""
    suggestions: List[Dict[str, Any]]
    confidence: Decimal
    applicable_sections: List[str]
    processing_time_ms: int


class ValidationRequest(BaseModel):
    """Request model for report validation"""
    validation_type: str = "accuracy"  # "accuracy", "completeness", "consistency"
    check_data_sources: bool = True
    include_recommendations: bool = True

    @validator('validation_type')
    def validate_validation_type(cls, v):
        if v not in ["accuracy", "completeness", "consistency"]:
            raise ValueError('Validation type must be one of: accuracy, completeness, consistency')
        return v


class ValidationResponse(BaseModel):
    """Response model for report validation"""
    is_valid: bool
    validation_score: Decimal
    issues_found: List[Dict[str, Any]]
    recommendations: List[Dict[str, Any]]
    data_freshness: Dict[str, Any]
    validation_timestamp: datetime


class MonteCarloRequest(BaseModel):
    """Request model for Monte Carlo analysis"""
    analysis_type: str = "budget_variance"  # "budget_variance", "schedule_variance", "resource_risk"
    iterations: int = Field(default=1000, ge=100, le=10000)
    confidence_levels: List[Decimal] = Field(default=[0.5, 0.8, 0.95])
    parameters: Optional[Dict[str, Any]] = None

    @validator('analysis_type')
    def validate_analysis_type(cls, v):
        if v not in ["budget_variance", "schedule_variance", "resource_risk"]:
            raise ValueError('Analysis type must be one of: budget_variance, schedule_variance, resource_risk')
        return v

    @validator('confidence_levels')
    def validate_confidence_levels(cls, v):
        for level in v:
            if level <= 0 or level >= 1:
                raise ValueError('Confidence levels must be between 0 and 1')
        return sorted(v)


class MonteCarloResponse(BaseModel):
    """Response model for Monte Carlo analysis"""
    analysis_type: str
    iterations: int
    results: Dict[str, Any]
    confidence_intervals: Dict[str, Dict[str, Decimal]]
    risk_assessment: Dict[str, Any]
    recommendations: List[Dict[str, Any]]
    processing_time_ms: int
    generated_at: datetime


# Template AI Suggestions Models

class TemplateAISuggestionsRequest(BaseModel):
    """Request model for template AI suggestions"""
    project_type: Optional[str] = None
    industry: Optional[str] = None
    stakeholder_types: Optional[List[str]] = None
    reporting_frequency: str = "monthly"

    @validator('reporting_frequency')
    def validate_reporting_frequency(cls, v):
        if v not in ["weekly", "monthly", "quarterly", "annual"]:
            raise ValueError('Reporting frequency must be one of: weekly, monthly, quarterly, annual')
        return v


class TemplateAISuggestionsResponse(BaseModel):
    """Response model for template AI suggestions"""
    suggested_sections: List[Dict[str, Any]]
    recommended_metrics: List[Dict[str, Any]]
    visualization_suggestions: List[Dict[str, Any]]
    branding_recommendations: Dict[str, Any]
    confidence: Decimal
    reasoning: str


# Bulk Operations Models

class BulkReportGenerationRequest(BaseModel):
    """Request model for bulk report generation"""
    project_ids: List[UUID]
    report_month: date
    report_year: int
    template_id: UUID
    include_ai_insights: bool = True
    batch_size: int = Field(default=10, ge=1, le=50)

    @validator('project_ids')
    def validate_project_ids(cls, v):
        if len(v) == 0:
            raise ValueError('At least one project ID is required')
        if len(v) > 100:
            raise ValueError('Maximum 100 projects per batch')
        return v


class BulkReportGenerationResponse(BaseModel):
    """Response model for bulk report generation"""
    batch_id: str
    total_projects: int
    successful_reports: List[UUID]
    failed_reports: List[Dict[str, Any]]
    processing_time_ms: int
    estimated_completion: datetime