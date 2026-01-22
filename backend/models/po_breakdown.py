"""
Comprehensive Pydantic models for SAP PO Breakdown Management

This module contains all data models for the SAP PO Breakdown Management feature,
including PO breakdown structures, import configurations, variance calculations,
hierarchy management, and audit trail models.

**Validates: Requirements 1.1, 1.2, 2.1, 3.1**
"""

from pydantic import BaseModel, Field, field_validator, model_validator
from typing import List, Dict, Any, Optional, Union
from datetime import datetime, date
from decimal import Decimal
from enum import Enum
from uuid import UUID

from .base import BaseResponse


# ============================================================================
# Enums
# ============================================================================

class POBreakdownType(str, Enum):
    """Types of PO breakdown structures"""
    sap_standard = "sap_standard"
    custom_hierarchy = "custom_hierarchy"
    cost_center = "cost_center"
    work_package = "work_package"


class ImportStatus(str, Enum):
    """Status values for import operations"""
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"
    partially_completed = "partially_completed"
    rolled_back = "rolled_back"


class ConflictType(str, Enum):
    """Types of import conflicts"""
    duplicate_code = "duplicate_code"
    duplicate_sap_reference = "duplicate_sap_reference"
    parent_not_found = "parent_not_found"
    invalid_hierarchy = "invalid_hierarchy"
    amount_mismatch = "amount_mismatch"
    circular_reference = "circular_reference"
    depth_exceeded = "depth_exceeded"


class ConflictResolution(str, Enum):
    """Resolution strategies for import conflicts"""
    skip = "skip"
    update = "update"
    create_new = "create_new"
    merge = "merge"
    manual = "manual"


class VarianceStatus(str, Enum):
    """Status values for variance analysis"""
    on_track = "on_track"
    minor_variance = "minor_variance"
    significant_variance = "significant_variance"
    critical_variance = "critical_variance"


class VarianceAlertType(str, Enum):
    """Types of variance alerts"""
    budget_exceeded = "budget_exceeded"
    commitment_exceeded = "commitment_exceeded"
    negative_variance = "negative_variance"
    trend_deteriorating = "trend_deteriorating"
    threshold_warning = "threshold_warning"


class TrendDirection(str, Enum):
    """Direction of variance trends"""
    improving = "improving"
    stable = "stable"
    deteriorating = "deteriorating"


class AlertSeverity(str, Enum):
    """Severity levels for alerts"""
    info = "info"
    warning = "warning"
    critical = "critical"
    urgent = "urgent"


# ============================================================================
# Core PO Breakdown Models
# ============================================================================

class POBreakdownCreate(BaseModel):
    """
    Request model for creating a PO breakdown item.
    
    **Validates: Requirements 1.1, 1.2, 2.1**
    """
    name: str = Field(..., min_length=1, max_length=255, description="Name of the PO breakdown item")
    code: Optional[str] = Field(None, max_length=50, description="Unique code within project scope")
    sap_po_number: Optional[str] = Field(None, max_length=50, description="SAP Purchase Order number")
    sap_line_item: Optional[str] = Field(None, max_length=20, description="SAP line item number")
    parent_breakdown_id: Optional[UUID] = Field(None, description="Parent breakdown ID for hierarchy")
    cost_center: Optional[str] = Field(None, max_length=50, description="SAP cost center code")
    gl_account: Optional[str] = Field(None, max_length=50, description="General Ledger account code")
    planned_amount: Decimal = Field(default=Decimal('0.00'), ge=0, description="Planned budget amount")
    committed_amount: Decimal = Field(default=Decimal('0.00'), ge=0, description="Committed amount")
    actual_amount: Decimal = Field(default=Decimal('0.00'), ge=0, description="Actual spent amount")
    currency: str = Field(default='USD', max_length=3, description="Currency code (ISO 4217)")
    breakdown_type: POBreakdownType = Field(..., description="Type of breakdown structure")
    category: Optional[str] = Field(None, max_length=100, description="Category classification")
    subcategory: Optional[str] = Field(None, max_length=100, description="Subcategory classification")
    custom_fields: Dict[str, Any] = Field(default_factory=dict, description="Flexible JSONB custom fields")
    tags: List[str] = Field(default_factory=list, description="Tags for cross-cutting organization")
    notes: Optional[str] = Field(None, description="Additional notes")
    
    @field_validator('currency')
    @classmethod
    def validate_currency(cls, v: str) -> str:
        """Validate currency code format"""
        if len(v) != 3 or not v.isalpha():
            raise ValueError('Currency must be a 3-letter ISO 4217 code')
        return v.upper()
    
    @field_validator('tags')
    @classmethod
    def validate_tags(cls, v: List[str]) -> List[str]:
        """Validate and normalize tags"""
        return [tag.strip().lower() for tag in v if tag.strip()]


class POBreakdownResponse(BaseModel):
    """
    Response model for PO breakdown item with full details.
    
    **Validates: Requirements 1.1, 1.2, 2.1, 3.1, 4.6**
    """
    id: UUID
    project_id: UUID
    name: str
    code: Optional[str] = None
    sap_po_number: Optional[str] = None
    sap_line_item: Optional[str] = None
    hierarchy_level: int = Field(ge=0, le=10, description="Depth in hierarchy (0-10)")
    parent_breakdown_id: Optional[UUID] = None
    display_order: Optional[int] = Field(None, ge=0, description="Display order among siblings")
    
    # SAP Relationship Preservation (Requirement 4.6)
    original_sap_parent_id: Optional[UUID] = Field(
        None, 
        description="Original SAP parent ID before custom modifications"
    )
    sap_hierarchy_path: Optional[List[UUID]] = Field(
        None,
        description="Original SAP hierarchy path from root to this item"
    )
    has_custom_parent: bool = Field(
        default=False,
        description="True if parent has been changed from original SAP structure"
    )
    
    cost_center: Optional[str] = None
    gl_account: Optional[str] = None
    planned_amount: Decimal
    committed_amount: Decimal
    actual_amount: Decimal
    remaining_amount: Decimal = Field(description="Calculated: planned - actual")
    currency: str
    exchange_rate: Decimal = Field(default=Decimal('1.0'), description="Exchange rate to base currency")
    breakdown_type: POBreakdownType
    category: Optional[str] = None
    subcategory: Optional[str] = None
    custom_fields: Dict[str, Any] = Field(default_factory=dict)
    tags: List[str] = Field(default_factory=list)
    notes: Optional[str] = None
    import_batch_id: Optional[UUID] = None
    import_source: Optional[str] = None
    version: int = Field(ge=1, description="Version number for audit trail")
    is_active: bool = True
    created_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    children: Optional[List['POBreakdownResponse']] = None
    variance_data: Optional['VarianceData'] = None
    
    class Config:
        from_attributes = True


class POBreakdownUpdate(BaseModel):
    """
    Request model for updating a PO breakdown item.
    
    **Validates: Requirements 2.1, 3.1**
    """
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    code: Optional[str] = Field(None, max_length=50)
    parent_breakdown_id: Optional[UUID] = None
    cost_center: Optional[str] = Field(None, max_length=50)
    gl_account: Optional[str] = Field(None, max_length=50)
    planned_amount: Optional[Decimal] = Field(None, ge=0)
    committed_amount: Optional[Decimal] = Field(None, ge=0)
    actual_amount: Optional[Decimal] = Field(None, ge=0)
    currency: Optional[str] = Field(None, max_length=3)
    category: Optional[str] = Field(None, max_length=100)
    subcategory: Optional[str] = Field(None, max_length=100)
    custom_fields: Optional[Dict[str, Any]] = None
    tags: Optional[List[str]] = None
    notes: Optional[str] = None


# ============================================================================
# Import Configuration Models
# ============================================================================

class ImportConfig(BaseModel):
    """
    Configuration for SAP PO data import operations.
    
    **Validates: Requirements 1.1, 1.2**
    """
    column_mappings: Dict[str, str] = Field(
        ..., 
        description="Mapping from CSV column names to model field names"
    )
    hierarchy_column: Optional[str] = Field(
        None, 
        description="Column containing hierarchy level or structure code"
    )
    parent_reference_column: Optional[str] = Field(
        None, 
        description="Column containing parent reference for hierarchy"
    )
    skip_header_rows: int = Field(default=1, ge=0, description="Number of header rows to skip")
    currency_default: str = Field(default='USD', description="Default currency if not specified")
    breakdown_type_default: POBreakdownType = Field(
        default=POBreakdownType.sap_standard,
        description="Default breakdown type"
    )
    conflict_resolution: ConflictResolution = Field(
        default=ConflictResolution.skip,
        description="Default conflict resolution strategy"
    )
    validate_amounts: bool = Field(default=True, description="Validate amount fields")
    create_missing_parents: bool = Field(default=True, description="Auto-create missing parent items")
    max_hierarchy_depth: int = Field(default=10, ge=1, le=10, description="Maximum hierarchy depth")
    delimiter: str = Field(default=',', description="CSV delimiter character")
    encoding: str = Field(default='utf-8', description="File encoding")


class ErrorSeverity(str, Enum):
    """Severity levels for import errors"""
    info = "info"
    warning = "warning"
    error = "error"
    critical = "critical"


class ErrorCategory(str, Enum):
    """Categories for import errors"""
    validation = "validation"
    parsing = "parsing"
    hierarchy = "hierarchy"
    conflict = "conflict"
    database = "database"
    transformation = "transformation"


class ImportError(BaseModel):
    """
    Error details for import failures with enhanced categorization.
    
    **Validates: Requirements 1.5, 10.3, 10.4**
    """
    row_number: int = Field(ge=1, description="Row number in source file")
    field: Optional[str] = Field(None, description="Field that caused the error")
    error_type: str = Field(..., description="Type of error")
    severity: ErrorSeverity = Field(default=ErrorSeverity.error, description="Error severity level")
    category: ErrorCategory = Field(default=ErrorCategory.validation, description="Error category")
    message: str = Field(..., description="Human-readable error message")
    raw_value: Optional[str] = Field(None, description="Original value that caused error")
    suggested_fix: Optional[str] = Field(None, description="Suggested correction")
    can_auto_fix: bool = Field(default=False, description="Whether error can be automatically fixed")
    error_data: Dict[str, Any] = Field(default_factory=dict, description="Additional error context")


class ImportWarning(BaseModel):
    """
    Warning details for import issues.
    
    **Validates: Requirements 1.5, 10.3**
    """
    row_number: int = Field(ge=1)
    field: Optional[str] = None
    warning_type: str
    message: str
    suggestion: Optional[str] = None
    warning_data: Dict[str, Any] = Field(default_factory=dict, description="Additional warning context")


class ImportConflict(BaseModel):
    """
    Details of a conflict detected during import.
    
    **Validates: Requirements 1.4**
    """
    row_number: int = Field(ge=1)
    conflict_type: ConflictType
    existing_record: Dict[str, Any] = Field(description="Existing record data")
    new_record: Dict[str, Any] = Field(description="New record data from import")
    suggested_resolution: ConflictResolution
    field_conflicts: List[str] = Field(default_factory=list, description="Fields with conflicts")
    resolution_applied: Optional[ConflictResolution] = None


class ImportResult(BaseModel):
    """
    Result of a CSV/Excel import operation with comprehensive tracking.
    
    **Validates: Requirements 1.5, 1.6, 10.3, 10.4**
    """
    batch_id: UUID = Field(description="Unique import batch identifier")
    status: ImportStatus
    status_message: Optional[str] = Field(None, description="Detailed status message")
    
    # Record counts
    total_records: int = Field(ge=0)
    processed_records: int = Field(ge=0)
    successful_records: int = Field(ge=0)
    failed_records: int = Field(ge=0)
    skipped_records: int = Field(default=0, ge=0, description="Records skipped due to conflicts")
    updated_records: int = Field(default=0, description="Number of existing records updated")
    
    # Error tracking
    conflicts: List[ImportConflict] = Field(default_factory=list)
    errors: List[ImportError] = Field(default_factory=list)
    warnings: List[ImportWarning] = Field(default_factory=list)
    error_count: int = Field(default=0, ge=0, description="Total error count")
    warning_count: int = Field(default=0, ge=0, description="Total warning count")
    conflict_count: int = Field(default=0, ge=0, description="Total conflict count")
    
    # Error summary by category
    errors_by_category: Dict[str, int] = Field(default_factory=dict, description="Error counts by category")
    errors_by_severity: Dict[str, int] = Field(default_factory=dict, description="Error counts by severity")
    
    # Processing metrics
    processing_time_ms: int = Field(ge=0, description="Processing time in milliseconds")
    created_hierarchies: int = Field(default=0, description="Number of hierarchy levels created")
    max_hierarchy_depth: int = Field(default=0, ge=0, description="Maximum hierarchy depth in import")
    
    # Created items
    created_breakdown_ids: List[UUID] = Field(default_factory=list)
    
    # Rollback support
    can_rollback: bool = Field(default=True, description="Whether import can be rolled back")
    rollback_instructions: Optional[str] = Field(None, description="Instructions for rollback")


class ImportBatchStatus(BaseModel):
    """
    Detailed status information for an import batch.
    
    **Validates: Requirements 1.6, 10.3, 10.4**
    """
    id: UUID
    project_id: UUID
    source: str
    file_name: Optional[str] = None
    file_size_bytes: Optional[int] = None
    file_type: Optional[str] = None
    
    # Status
    status: ImportStatus
    status_message: Optional[str] = None
    
    # Metrics
    total_records: int
    processed_records: int
    successful_records: int
    failed_records: int
    skipped_records: int
    updated_records: int
    created_hierarchies: int
    max_hierarchy_depth: int
    
    # Error tracking
    error_count: int
    warning_count: int
    conflict_count: int
    errors_by_category: Dict[str, int] = Field(default_factory=dict)
    errors_by_severity: Dict[str, int] = Field(default_factory=dict)
    
    # Timing
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    processing_time_ms: Optional[int] = None
    
    # Rollback
    can_rollback: bool
    rolled_back_at: Optional[datetime] = None
    rolled_back_by: Optional[UUID] = None
    rollback_reason: Optional[str] = None
    
    # Created items
    created_breakdown_ids: List[UUID] = Field(default_factory=list)
    
    # Audit
    imported_by: UUID
    created_at: datetime
    updated_at: datetime


class ImportBatchErrorDetail(BaseModel):
    """
    Detailed error information from import batch.
    
    **Validates: Requirements 10.3, 10.4**
    """
    id: UUID
    batch_id: UUID
    row_number: int
    field: Optional[str]
    error_type: str
    severity: ErrorSeverity
    category: ErrorCategory
    message: str
    raw_value: Optional[str]
    suggested_fix: Optional[str]
    can_auto_fix: bool
    error_data: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


# ============================================================================
# Hierarchy Models
# ============================================================================

class CategorySummary(BaseModel):
    """Financial summary for a category"""
    category: str
    total_planned: Decimal
    total_committed: Decimal
    total_actual: Decimal
    total_remaining: Decimal
    item_count: int


class LevelSummary(BaseModel):
    """Financial summary for a hierarchy level"""
    level: int
    total_planned: Decimal
    total_committed: Decimal
    total_actual: Decimal
    total_remaining: Decimal
    item_count: int


class HierarchyFinancialSummary(BaseModel):
    """
    Aggregated financial summary for a project hierarchy.
    
    **Validates: Requirements 2.1, 3.1**
    """
    total_planned: Decimal
    total_committed: Decimal
    total_actual: Decimal
    total_remaining: Decimal
    variance_amount: Decimal = Field(description="Total variance (actual - planned)")
    variance_percentage: Decimal = Field(description="Variance as percentage of planned")
    currency: str
    by_category: Dict[str, CategorySummary] = Field(default_factory=dict)
    by_level: Dict[int, LevelSummary] = Field(default_factory=dict)


class POHierarchyResponse(BaseModel):
    """
    Complete hierarchy response for a project.
    
    **Validates: Requirements 2.1, 2.6**
    """
    project_id: UUID
    root_items: List[POBreakdownResponse] = Field(default_factory=list)
    total_levels: int = Field(ge=0, le=10)
    total_items: int = Field(ge=0)
    financial_summary: HierarchyFinancialSummary
    last_updated: datetime


class HierarchyMoveRequest(BaseModel):
    """
    Request to move an item within the hierarchy.
    
    **Validates: Requirements 2.4**
    """
    new_parent_id: Optional[UUID] = Field(None, description="New parent ID (None for root)")
    new_position: Optional[int] = Field(None, ge=0, description="Position among siblings")
    validate_only: bool = Field(default=False, description="Only validate, don't execute")


class HierarchyValidationResult(BaseModel):
    """Result of hierarchy validation"""
    is_valid: bool
    errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    affected_items: List[UUID] = Field(default_factory=list)
    new_hierarchy_level: Optional[int] = None


class SAPRelationshipInfo(BaseModel):
    """
    Information about original SAP relationships.
    
    **Validates: Requirements 4.6**
    """
    breakdown_id: UUID
    original_parent_id: Optional[UUID] = None
    current_parent_id: Optional[UUID] = None
    has_custom_parent: bool
    sap_hierarchy_path: List[UUID] = Field(default_factory=list)
    can_restore: bool = Field(description="Whether original SAP structure can be restored")
    restore_warnings: List[str] = Field(default_factory=list)


class SAPRelationshipRestoreRequest(BaseModel):
    """
    Request to restore original SAP relationships.
    
    **Validates: Requirements 4.6**
    """
    breakdown_ids: List[UUID] = Field(
        ...,
        min_length=1,
        description="List of breakdown IDs to restore to original SAP structure"
    )
    restore_descendants: bool = Field(
        default=False,
        description="Whether to also restore descendants to their original SAP parents"
    )
    validate_only: bool = Field(
        default=False,
        description="Only validate restoration, don't execute"
    )


class SAPRelationshipRestoreResult(BaseModel):
    """
    Result of SAP relationship restoration.
    
    **Validates: Requirements 4.6**
    """
    successful_restorations: List[UUID] = Field(default_factory=list)
    failed_restorations: List[Dict[str, Any]] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    total_restored: int = Field(ge=0)
    total_failed: int = Field(ge=0)


# ============================================================================
# Variance Models
# ============================================================================

class VarianceData(BaseModel):
    """
    Variance calculation data for a single item.
    
    **Validates: Requirements 3.1, 3.4**
    """
    planned_vs_actual: Decimal = Field(description="Planned minus actual")
    planned_vs_committed: Decimal = Field(description="Planned minus committed")
    committed_vs_actual: Decimal = Field(description="Committed minus actual")
    variance_percentage: Decimal = Field(description="Variance as percentage of planned")
    variance_status: VarianceStatus
    trend_direction: TrendDirection = Field(default=TrendDirection.stable)
    last_calculated: datetime


class VarianceOutlier(BaseModel):
    """Outlier item with significant variance"""
    breakdown_id: UUID
    breakdown_name: str
    variance_amount: Decimal
    variance_percentage: Decimal
    variance_status: VarianceStatus
    category: Optional[str] = None


class VarianceTrend(BaseModel):
    """Variance trend data point"""
    date: date
    variance_amount: Decimal
    variance_percentage: Decimal
    status: VarianceStatus


class VarianceRecommendation(BaseModel):
    """Recommendation based on variance analysis"""
    priority: str = Field(description="high, medium, low")
    category: str
    message: str
    affected_items: List[UUID] = Field(default_factory=list)
    suggested_action: str


class ProjectVarianceResult(BaseModel):
    """
    Complete variance analysis for a project.
    
    **Validates: Requirements 3.4, 5.2**
    """
    project_id: UUID
    overall_variance: VarianceData
    by_category: Dict[str, VarianceData] = Field(default_factory=dict)
    by_hierarchy_level: Dict[int, VarianceData] = Field(default_factory=dict)
    top_variances: List[VarianceOutlier] = Field(default_factory=list)
    variance_trends: List[VarianceTrend] = Field(default_factory=list)
    recommendations: List[VarianceRecommendation] = Field(default_factory=list)
    calculated_at: datetime


class VarianceAlert(BaseModel):
    """
    Alert generated from variance analysis.
    
    **Validates: Requirements 3.5, 5.6**
    """
    id: Optional[UUID] = None
    breakdown_id: UUID
    breakdown_name: str
    project_id: UUID
    alert_type: VarianceAlertType
    severity: AlertSeverity
    threshold_exceeded: Decimal = Field(description="Threshold that was exceeded")
    current_variance: Decimal
    current_percentage: Decimal
    message: str
    recommended_actions: List[str] = Field(default_factory=list)
    is_acknowledged: bool = False
    acknowledged_by: Optional[UUID] = None
    acknowledged_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.now)


# ============================================================================
# Version Control and Audit Models
# ============================================================================

class POBreakdownVersion(BaseModel):
    """
    Version record for audit trail.
    
    **Validates: Requirements 6.1, 6.2**
    """
    id: UUID
    breakdown_id: UUID
    version_number: int = Field(ge=1)
    changes: Dict[str, Any] = Field(description="Changed fields with before/after values")
    changed_by: UUID
    changed_at: datetime
    change_reason: Optional[str] = None
    is_import: bool = Field(default=False, description="Whether change was from import")


class AuditLogEntry(BaseModel):
    """Audit log entry for compliance"""
    id: UUID
    entity_type: str = Field(default="po_breakdown")
    entity_id: UUID
    action: str = Field(description="create, update, delete, move, import")
    user_id: UUID
    timestamp: datetime
    old_values: Optional[Dict[str, Any]] = None
    new_values: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


# ============================================================================
# Search and Filter Models
# ============================================================================

class POBreakdownFilter(BaseModel):
    """
    Filter criteria for searching PO breakdowns.
    
    **Validates: Requirements 7.1, 7.2, 7.3, 7.4**
    """
    search_text: Optional[str] = Field(None, description="Text search across name, code, description")
    breakdown_types: Optional[List[POBreakdownType]] = None
    categories: Optional[List[str]] = None
    cost_centers: Optional[List[str]] = None
    gl_accounts: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    hierarchy_levels: Optional[List[int]] = None
    parent_id: Optional[UUID] = None
    include_descendants: bool = Field(default=False, description="Include all descendants when filtering by parent_id")
    min_planned_amount: Optional[Decimal] = None
    max_planned_amount: Optional[Decimal] = None
    min_variance_percentage: Optional[Decimal] = None
    max_variance_percentage: Optional[Decimal] = None
    variance_statuses: Optional[List[VarianceStatus]] = None
    is_active: Optional[bool] = True
    import_batch_id: Optional[UUID] = None
    created_after: Optional[datetime] = None
    created_before: Optional[datetime] = None
    # Logical operation support (Requirement 7.4)
    combine_filters_with_and: bool = Field(
        default=True, 
        description="If True, combine filters with AND logic; if False, use OR logic where applicable"
    )


class FilterLogicOperator(str, Enum):
    """Logical operators for combining filters"""
    AND = "AND"
    OR = "OR"


class CompositeFilter(BaseModel):
    """
    Composite filter for complex multi-criteria filtering with logical operations.
    
    **Validates: Requirements 7.4**
    """
    filters: List[POBreakdownFilter] = Field(..., min_items=1)
    operator: FilterLogicOperator = Field(default=FilterLogicOperator.AND)
    description: Optional[str] = Field(None, description="Human-readable description of the composite filter")


class HierarchyBranchFilter(BaseModel):
    """
    Filter for specific hierarchy branches.
    
    **Validates: Requirements 7.3**
    """
    root_breakdown_id: UUID = Field(..., description="Root of the branch to filter")
    include_root: bool = Field(default=True, description="Include the root item in results")
    max_depth: Optional[int] = Field(None, description="Maximum depth from root to include")
    filter_criteria: Optional[POBreakdownFilter] = Field(None, description="Additional filters to apply within branch")


class SavedFilter(BaseModel):
    """
    Saved filter configuration for reuse.
    
    **Validates: Requirements 7.5**
    """
    id: Optional[UUID] = None
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    filter_criteria: POBreakdownFilter
    is_default: bool = False
    created_by: Optional[UUID] = None
    created_at: Optional[datetime] = None


class SearchResult(BaseModel):
    """Search result with pagination"""
    items: List[POBreakdownResponse]
    total_count: int
    page: int
    page_size: int
    has_more: bool
    filter_applied: Optional[POBreakdownFilter] = None


# ============================================================================
# Export Models
# ============================================================================

class ExportFormat(str, Enum):
    """Supported export formats"""
    csv = "csv"
    excel = "excel"
    json = "json"
    pdf = "pdf"


class ExportConfig(BaseModel):
    """
    Configuration for data export.
    
    **Validates: Requirements 9.1, 9.6**
    """
    format: ExportFormat
    include_hierarchy: bool = Field(default=True, description="Preserve hierarchy in export")
    include_variance_data: bool = Field(default=True)
    include_audit_trail: bool = Field(default=False)
    fields: Optional[List[str]] = Field(None, description="Specific fields to include")
    filter: Optional[POBreakdownFilter] = None
    date_format: str = Field(default="%Y-%m-%d")
    decimal_places: int = Field(default=2, ge=0, le=6)


class ExportResult(BaseModel):
    """Result of export operation"""
    export_id: UUID
    format: ExportFormat
    file_name: str
    file_size_bytes: int
    record_count: int
    generated_at: datetime
    download_url: Optional[str] = None
    expires_at: Optional[datetime] = None


# ============================================================================
# Compliance and Audit Export Models (Task 8.3)
# ============================================================================

class AuditExportFormat(str, Enum):
    """Supported audit export formats"""
    json = "json"
    csv = "csv"
    xml = "xml"


class ComplianceReportFormat(str, Enum):
    """Supported compliance report formats"""
    pdf = "pdf"
    html = "html"
    json = "json"


class DigitalSignatureAlgorithm(str, Enum):
    """Supported digital signature algorithms"""
    rsa_sha256 = "RSA-SHA256"
    ecdsa_sha256 = "ECDSA-SHA256"
    ed25519 = "Ed25519"


class DigitalSignature(BaseModel):
    """
    Digital signature for compliance reports.
    
    **Validates: Requirement 6.6**
    """
    algorithm: DigitalSignatureAlgorithm
    signature: str = Field(description="Base64-encoded signature")
    public_key_fingerprint: str = Field(description="Fingerprint of the public key used")
    signed_at: datetime
    signed_by: UUID = Field(description="User who signed the report")
    signature_metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional signature metadata (certificate info, etc.)"
    )


class AuditExportConfig(BaseModel):
    """
    Configuration for audit data export.
    
    **Validates: Requirement 6.5**
    """
    format: AuditExportFormat = Field(default=AuditExportFormat.json)
    project_id: Optional[UUID] = Field(None, description="Filter by project")
    breakdown_ids: Optional[List[UUID]] = Field(None, description="Specific breakdowns to export")
    start_date: Optional[datetime] = Field(None, description="Start date for audit records")
    end_date: Optional[datetime] = Field(None, description="End date for audit records")
    include_soft_deleted: bool = Field(default=True, description="Include soft-deleted records")
    include_field_history: bool = Field(default=True, description="Include field-level change history")
    include_user_details: bool = Field(default=True, description="Include user information")
    change_types: Optional[List[str]] = Field(None, description="Filter by change types")
    compression: bool = Field(default=False, description="Compress export file")


class AuditExportResult(BaseModel):
    """
    Result of audit data export.
    
    **Validates: Requirement 6.5**
    """
    export_id: UUID
    format: AuditExportFormat
    file_name: str
    file_size_bytes: int
    record_count: int
    breakdown_count: int
    version_count: int
    date_range: Dict[str, Optional[str]] = Field(
        description="Start and end dates of exported data"
    )
    generated_at: datetime
    generated_by: UUID
    download_url: Optional[str] = None
    expires_at: Optional[datetime] = None
    checksum: str = Field(description="SHA-256 checksum of export file")
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ComplianceReportConfig(BaseModel):
    """
    Configuration for compliance report generation.
    
    **Validates: Requirement 6.6**
    """
    format: ComplianceReportFormat = Field(default=ComplianceReportFormat.pdf)
    project_id: UUID
    report_title: str = Field(default="PO Breakdown Compliance Report")
    report_period_start: datetime
    report_period_end: datetime
    include_executive_summary: bool = Field(default=True)
    include_change_statistics: bool = Field(default=True)
    include_user_activity: bool = Field(default=True)
    include_deletion_audit: bool = Field(default=True)
    include_variance_analysis: bool = Field(default=False)
    include_digital_signature: bool = Field(default=True)
    signature_algorithm: DigitalSignatureAlgorithm = Field(
        default=DigitalSignatureAlgorithm.rsa_sha256
    )
    custom_sections: Optional[List[Dict[str, Any]]] = Field(
        None,
        description="Custom sections to include in report"
    )


class ComplianceReportSection(BaseModel):
    """Section within a compliance report"""
    section_id: str
    title: str
    content: str = Field(description="HTML or text content")
    data: Optional[Dict[str, Any]] = Field(None, description="Structured data for the section")
    charts: Optional[List[Dict[str, Any]]] = Field(None, description="Chart data")
    order: int = Field(ge=0, description="Display order")


class ComplianceReport(BaseModel):
    """
    Complete compliance report with digital signature.
    
    **Validates: Requirement 6.6**
    """
    report_id: UUID
    project_id: UUID
    report_title: str
    report_period_start: datetime
    report_period_end: datetime
    generated_at: datetime
    generated_by: UUID
    format: ComplianceReportFormat
    
    # Report content
    executive_summary: Optional[str] = None
    sections: List[ComplianceReportSection] = Field(default_factory=list)
    
    # Statistics
    total_breakdowns: int
    total_changes: int
    total_users: int
    changes_by_type: Dict[str, int] = Field(default_factory=dict)
    changes_by_user: Dict[str, int] = Field(default_factory=dict)
    
    # Digital signature
    digital_signature: Optional[DigitalSignature] = None
    signature_valid: bool = Field(default=False)
    
    # File information
    file_name: str
    file_size_bytes: int
    download_url: Optional[str] = None
    expires_at: Optional[datetime] = None
    checksum: str = Field(description="SHA-256 checksum of report file")
    
    # Metadata
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ComplianceReportSummary(BaseModel):
    """Summary of a compliance report for listing"""
    report_id: UUID
    project_id: UUID
    report_title: str
    report_period_start: datetime
    report_period_end: datetime
    generated_at: datetime
    generated_by: UUID
    format: ComplianceReportFormat
    has_digital_signature: bool
    signature_valid: bool
    file_name: str
    file_size_bytes: int


# Update forward references
POBreakdownResponse.model_rebuild()
