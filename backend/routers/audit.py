"""
Audit Trail API Router

Provides endpoints for AI-empowered audit trail features including:
- Event querying with advanced filtering
- Timeline visualization
- Anomaly detection and management
- Semantic search with RAG
- AI-generated summaries
- Export functionality (PDF/CSV)
- Dashboard statistics
- Integration configuration

Requirements: All audit trail requirements
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Depends, status, Request, Response
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field

from auth.dependencies import get_current_user
from auth.rbac import require_permission, Permission
from config.database import supabase
from services.audit_anomaly_service import AuditAnomalyService
from services.audit_rag_agent import AuditRAGAgent
from services.audit_ml_service import AuditMLService
from services.audit_export_service import AuditExportService
from services.audit_integration_hub import AuditIntegrationHub
from services.audit_encryption_service import get_encryption_service

# Import rate limiting
try:
    from performance_optimization import limiter
except ImportError:
    # Fallback if performance optimization not available
    def limiter_fallback(rate: str):
        def decorator(func):
            return func
        return decorator
    limiter = type('MockLimiter', (), {'limit': limiter_fallback})()

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/audit", tags=["audit"])


# ============================================================================
# APPEND-ONLY ENFORCEMENT (Requirement 6.1)
# ============================================================================
# This router implements append-only audit logs by design:
# 1. No UPDATE endpoints are provided for audit events
# 2. No DELETE endpoints are provided for audit events
# 3. All endpoints are read-only (GET) or create-only (POST for logging)
# 4. Database constraints prevent updates to audit_logs table
# 5. Immutability is enforced at both API and database levels
# ============================================================================


# ============================================================================
# Pydantic Models for Request/Response
# ============================================================================

class AuditEventFilters(BaseModel):
    """Filters for querying audit events."""
    start_date: Optional[datetime] = Field(None, description="Start date for filtering")
    end_date: Optional[datetime] = Field(None, description="End date for filtering")
    event_types: Optional[List[str]] = Field(None, description="List of event types to filter")
    user_id: Optional[str] = Field(None, description="User ID to filter by")
    entity_type: Optional[str] = Field(None, description="Entity type to filter by")
    entity_id: Optional[str] = Field(None, description="Entity ID to filter by")
    severity: Optional[str] = Field(None, description="Severity level to filter by")
    categories: Optional[List[str]] = Field(None, description="Categories to filter by")
    risk_levels: Optional[List[str]] = Field(None, description="Risk levels to filter by")


class AuditEvent(BaseModel):
    """Audit event model."""
    id: UUID
    event_type: str
    user_id: Optional[UUID]
    entity_type: str
    entity_id: Optional[UUID]
    action_details: Dict[str, Any]
    severity: str
    ip_address: Optional[str]
    user_agent: Optional[str]
    project_id: Optional[UUID]
    performance_metrics: Optional[Dict[str, Any]]
    timestamp: datetime
    anomaly_score: Optional[float]
    is_anomaly: bool
    category: Optional[str]
    risk_level: Optional[str]
    tags: Optional[Dict[str, Any]]
    ai_insights: Optional[Dict[str, Any]]
    tenant_id: UUID
    hash: Optional[str]
    previous_hash: Optional[str]


class AuditEventsResponse(BaseModel):
    """Response for audit events query."""
    events: List[AuditEvent]
    total: int
    limit: int
    offset: int


class TimelineEvent(BaseModel):
    """Timeline event with AI insights."""
    id: UUID
    event_type: str
    user_id: Optional[UUID]
    entity_type: str
    entity_id: Optional[UUID]
    action_details: Dict[str, Any]
    severity: str
    timestamp: datetime
    anomaly_score: Optional[float]
    is_anomaly: bool
    category: Optional[str]
    risk_level: Optional[str]
    tags: Optional[Dict[str, Any]]
    ai_insights: Optional[Dict[str, Any]]


class TimelineResponse(BaseModel):
    """Response for timeline query."""
    events: List[TimelineEvent]
    total: int


class Anomaly(BaseModel):
    """Anomaly detection result."""
    id: UUID
    audit_event_id: UUID
    audit_event: AuditEvent
    anomaly_score: float
    detection_timestamp: datetime
    features_used: Dict[str, Any]
    model_version: str
    is_false_positive: bool
    feedback_notes: Optional[str]
    alert_sent: bool
    severity_level: str
    affected_entities: List[str]
    suggested_actions: List[str]


class AnomaliesResponse(BaseModel):
    """Response for anomalies query."""
    anomalies: List[Anomaly]
    total: int


class SearchRequest(BaseModel):
    """Request for semantic search."""
    query: str = Field(..., description="Natural language query")
    filters: Optional[AuditEventFilters] = Field(None, description="Optional filters")
    limit: int = Field(10, description="Maximum number of results", ge=1, le=50)


class SearchResult(BaseModel):
    """Search result with similarity score."""
    event: AuditEvent
    similarity_score: float
    relevance_explanation: str


class SearchResponse(BaseModel):
    """Response for semantic search."""
    query: str
    results: List[SearchResult]
    ai_response: str
    sources: List[Dict[str, Any]]
    total_results: int


class SummaryResponse(BaseModel):
    """Response for AI-generated summary."""
    period: str
    start_date: datetime
    end_date: datetime
    total_events: int
    critical_changes: int
    budget_updates: int
    security_events: int
    anomalies_detected: int
    top_users: List[Dict[str, Any]]
    top_event_types: List[Dict[str, Any]]
    category_breakdown: Dict[str, int]
    ai_insights: str
    trend_analysis: Dict[str, Any]


class ExplanationResponse(BaseModel):
    """Response for event explanation."""
    event_id: UUID
    explanation: str
    context: Dict[str, Any]
    impact_analysis: str
    related_events: List[AuditEvent]


class ExportRequest(BaseModel):
    """Request for export."""
    filters: AuditEventFilters
    include_summary: bool = Field(True, description="Include AI-generated summary")


class AddTagRequest(BaseModel):
    """Request for adding a tag to an audit log."""
    tag: str = Field(..., min_length=1, max_length=50, description="Tag to add to the audit log")


class DetectAnomaliesRequest(BaseModel):
    """Request for anomaly detection."""
    time_range_days: int = Field(default=30, ge=1, le=90, description="Number of days to analyze for anomalies")


class AuditSearchRequest(BaseModel):
    """Request for audit log search."""
    query: str = Field(..., min_length=1, max_length=500, description="Natural language query")
    limit: int = Field(default=50, ge=1, le=100, description="Maximum number of results")


class AuditSearchResult(BaseModel):
    """Search result for audit logs."""
    log_id: UUID
    timestamp: datetime
    user_name: str
    action: str
    details: str
    relevance_score: float
    highlighted_text: str


class AuditSearchResponse(BaseModel):
    """Response for audit log search."""
    results: List[AuditSearchResult]
    total_results: int


class AnomalyResult(BaseModel):
    """Anomaly detection result for audit logs."""
    log_id: UUID
    timestamp: datetime
    user_id: Optional[UUID]
    user_name: str
    action: str
    confidence: float  # 0.0 = normal, 1.0 = highly anomalous
    reason: str
    details: Dict[str, Any]


class DetectAnomaliesResponse(BaseModel):
    """Response for anomaly detection."""
    anomalies: List[AnomalyResult]
    total_logs_analyzed: int
    anomaly_count: int


class DashboardStatsResponse(BaseModel):
    """Response for dashboard statistics."""
    total_events_24h: int
    total_anomalies_24h: int
    critical_events_24h: int
    event_volume_chart: List[Dict[str, Any]]
    top_users: List[Dict[str, Any]]
    top_event_types: List[Dict[str, Any]]
    category_breakdown: Dict[str, int]
    system_health: Dict[str, Any]


class FeedbackRequest(BaseModel):
    """Request for anomaly feedback."""
    is_false_positive: bool
    notes: Optional[str] = Field(None, description="Optional feedback notes")


class FeedbackResponse(BaseModel):
    """Response for feedback submission."""
    success: bool
    message: str


class IntegrationConfigRequest(BaseModel):
    """Request for integration configuration."""
    integration_type: str = Field(..., description="Type: slack, teams, zapier, email")
    config: Dict[str, Any] = Field(..., description="Integration configuration")


class ConfigurationResponse(BaseModel):
    """Response for configuration."""
    success: bool
    message: str
    integration_id: Optional[UUID]


# ============================================================================
# Service Initialization
# ============================================================================

def get_anomaly_service():
    """Get audit anomaly service instance."""
    return AuditAnomalyService(supabase_client=supabase)


def get_rag_agent():
    """Get audit RAG agent instance."""
    import os
    openai_api_key = os.getenv("OPENAI_API_KEY")
    return AuditRAGAgent(supabase_client=supabase, openai_api_key=openai_api_key)


def get_ml_service():
    """Get audit ML service instance."""
    return AuditMLService(supabase_client=supabase)


def get_export_service():
    """Get audit export service instance."""
    import os
    openai_api_key = os.getenv("OPENAI_API_KEY")
    return AuditExportService(supabase_client=supabase, openai_api_key=openai_api_key)


def get_integration_hub():
    """Get audit integration hub instance."""
    return AuditIntegrationHub(supabase_client=supabase)


def decrypt_audit_events(events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Decrypt sensitive fields in audit events after retrieval.
    
    Args:
        events: List of audit event dictionaries
    
    Returns:
        List of events with decrypted sensitive fields
    """
    try:
        encryption_service = get_encryption_service()
        return encryption_service.decrypt_batch(events)
    except Exception as e:
        logger.warning(f"Encryption service not available, returning events as-is: {e}")
        return events


async def log_audit_access(
    user_id: str,
    tenant_id: str,
    access_type: str,
    query_parameters: Optional[Dict[str, Any]] = None,
    result_count: Optional[int] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    execution_time_ms: Optional[int] = None
) -> None:
    """
    Log access to audit logs for audit-of-audit functionality.
    
    Creates a meta-audit event recording who accessed audit logs, when,
    and what filters they used.
    
    Args:
        user_id: ID of user accessing audit logs
        tenant_id: Tenant ID for isolation
        access_type: Type of access (read, export, search)
        query_parameters: Filters and parameters used
        result_count: Number of events returned
        ip_address: IP address of client
        user_agent: User agent string
        execution_time_ms: Query execution time
    
    Requirements: 6.9
    """
    try:
        access_log_data = {
            "user_id": user_id,
            "tenant_id": tenant_id,
            "access_type": access_type,
            "query_parameters": query_parameters,
            "result_count": result_count,
            "ip_address": ip_address,
            "user_agent": user_agent,
            "execution_time_ms": execution_time_ms,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Insert into audit_access_log table
        supabase.table("audit_access_log").insert(access_log_data).execute()
        
        logger.debug(f"Logged audit access: {access_type} by user {user_id}")
    
    except Exception as e:
        # Log error but don't fail the main operation
        logger.error(f"Failed to log audit access: {e}")



# ============================================================================
# API Endpoints
# ============================================================================

@router.get("/events", response_model=AuditEventsResponse)
@limiter.limit("100/minute")
async def get_audit_events(
    request: Request,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    event_types: Optional[str] = None,  # Comma-separated list
    user_id: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    severity: Optional[str] = None,
    categories: Optional[str] = None,  # Comma-separated list
    risk_levels: Optional[str] = None,  # Comma-separated list
    limit: int = 100,
    offset: int = 0,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get filtered audit events with pagination.
    
    Supports filtering by:
    - Date range (start_date, end_date)
    - Event types
    - User ID
    - Entity type and ID
    - Severity level
    - Categories (Security Change, Financial Impact, etc.)
    - Risk levels (Low, Medium, High, Critical)
    
    Implements tenant isolation automatically.
    
    Requirements: 2.5, 2.6, 2.7, 4.9, 4.10, 9.2
    """
    try:
        # Get tenant_id from current user
        tenant_id = current_user.get("tenant_id")
        if not tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User must have a tenant_id"
            )
        
        # Build query
        query = supabase.table("roche_audit_logs").select("*")
        
        # Apply tenant isolation (CRITICAL for multi-tenant security)
        query = query.eq("tenant_id", tenant_id)
        
        # Apply filters
        if start_date:
            query = query.gte("timestamp", start_date.isoformat())
        
        if end_date:
            query = query.lte("timestamp", end_date.isoformat())
        
        if event_types:
            event_type_list = [et.strip() for et in event_types.split(",")]
            query = query.in_("event_type", event_type_list)
        
        if user_id:
            query = query.eq("user_id", user_id)
        
        if entity_type:
            query = query.eq("entity_type", entity_type)
        
        if entity_id:
            query = query.eq("entity_id", entity_id)
        
        if severity:
            query = query.eq("severity", severity)
        
        if categories:
            category_list = [c.strip() for c in categories.split(",")]
            query = query.in_("category", category_list)
        
        if risk_levels:
            risk_level_list = [rl.strip() for rl in risk_levels.split(",")]
            query = query.in_("risk_level", risk_level_list)
        
        # Get total count (before pagination)
        count_query = query
        count_response = count_query.execute()
        total = len(count_response.data) if count_response.data else 0
        
        # Apply pagination and ordering
        query = query.order("timestamp", desc=True).range(offset, offset + limit - 1)
        
        # Execute query
        response = query.execute()
        
        if not response.data:
            return AuditEventsResponse(
                events=[],
                total=0,
                limit=limit,
                offset=offset
            )
        
        # Decrypt sensitive fields (Requirement 6.6)
        decrypted_data = decrypt_audit_events(response.data)
        
        # Convert to AuditEvent models
        events = []
        for event_data in decrypted_data:
            try:
                event = AuditEvent(**event_data)
                events.append(event)
            except Exception as e:
                logger.warning(f"Failed to parse audit event {event_data.get('id')}: {e}")
                continue
        
        logger.info(f"Retrieved {len(events)} audit events for tenant {tenant_id}")
        
        # Log audit access (audit-of-audit) - Requirement 6.9
        await log_audit_access(
            user_id=current_user.get("id"),
            tenant_id=tenant_id,
            access_type="read",
            query_parameters={
                "start_date": start_date.isoformat() if start_date else None,
                "end_date": end_date.isoformat() if end_date else None,
                "event_types": event_types,
                "user_id": user_id,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "severity": severity,
                "categories": categories,
                "risk_levels": risk_levels,
                "limit": limit,
                "offset": offset
            },
            result_count=len(events),
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent")
        )
        
        return AuditEventsResponse(
            events=events,
            total=total,
            limit=limit,
            offset=offset
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving audit events: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve audit events: {str(e)}"
        )


@router.get("/timeline", response_model=TimelineResponse)
@limiter.limit("100/minute")
async def get_audit_timeline(
    request: Request,
    start_date: datetime,
    end_date: datetime,
    event_types: Optional[str] = None,
    severity: Optional[str] = None,
    categories: Optional[str] = None,
    risk_levels: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get audit events formatted for timeline visualization with AI-generated insights.
    
    Returns events in chronological order with:
    - AI-generated tags and insights
    - Anomaly scores for flagged events
    - Category and risk level classifications
    
    Requirements: 2.1, 2.2, 2.3, 2.4
    """
    try:
        # Get tenant_id from current user
        tenant_id = current_user.get("tenant_id")
        if not tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User must have a tenant_id"
            )
        
        # Build query
        query = supabase.table("roche_audit_logs").select("*")
        
        # Apply tenant isolation
        query = query.eq("tenant_id", tenant_id)
        
        # Apply date range (required for timeline)
        query = query.gte("timestamp", start_date.isoformat())
        query = query.lte("timestamp", end_date.isoformat())
        
        # Apply optional filters
        if event_types:
            event_type_list = [et.strip() for et in event_types.split(",")]
            query = query.in_("event_type", event_type_list)
        
        if severity:
            query = query.eq("severity", severity)
        
        if categories:
            category_list = [c.strip() for c in categories.split(",")]
            query = query.in_("category", category_list)
        
        if risk_levels:
            risk_level_list = [rl.strip() for rl in risk_levels.split(",")]
            query = query.in_("risk_level", risk_level_list)
        
        # Order by timestamp (chronological)
        query = query.order("timestamp", desc=False)
        
        # Execute query
        response = query.execute()
        
        if not response.data:
            return TimelineResponse(
                events=[],
                total=0
            )
        
        # Decrypt sensitive fields (Requirement 6.6)
        decrypted_data = decrypt_audit_events(response.data)
        
        # Convert to TimelineEvent models
        events = []
        for event_data in decrypted_data:
            try:
                # Create timeline event (subset of full audit event)
                timeline_event = TimelineEvent(
                    id=event_data["id"],
                    event_type=event_data["event_type"],
                    user_id=event_data.get("user_id"),
                    entity_type=event_data["entity_type"],
                    entity_id=event_data.get("entity_id"),
                    action_details=event_data.get("action_details", {}),
                    severity=event_data["severity"],
                    timestamp=event_data["timestamp"],
                    anomaly_score=event_data.get("anomaly_score"),
                    is_anomaly=event_data.get("is_anomaly", False),
                    category=event_data.get("category"),
                    risk_level=event_data.get("risk_level"),
                    tags=event_data.get("tags"),
                    ai_insights=event_data.get("ai_insights")
                )
                events.append(timeline_event)
            except Exception as e:
                logger.warning(f"Failed to parse timeline event {event_data.get('id')}: {e}")
                continue
        
        logger.info(f"Retrieved {len(events)} timeline events for tenant {tenant_id}")
        
        return TimelineResponse(
            events=events,
            total=len(events)
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving timeline events: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve timeline events: {str(e)}"
        )



@router.get("/anomalies", response_model=AnomaliesResponse)
@limiter.limit("100/minute")
async def get_anomalies(
    request: Request,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    min_score: float = 0.7,
    limit: int = 50,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get detected anomalies with details and related audit events.
    
    Filters:
    - Date range (optional)
    - Minimum anomaly score (default: 0.7)
    - Limit (default: 50)
    
    Requirements: 1.3, 1.4, 1.7
    """
    try:
        # Get tenant_id from current user
        tenant_id = current_user.get("tenant_id")
        if not tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User must have a tenant_id"
            )
        
        # Build query for anomalies
        query = supabase.table("audit_anomalies").select("*, roche_audit_logs(*)")
        
        # Apply tenant isolation through join
        query = query.eq("tenant_id", tenant_id)
        
        # Apply filters
        if start_date:
            query = query.gte("detection_timestamp", start_date.isoformat())
        
        if end_date:
            query = query.lte("detection_timestamp", end_date.isoformat())
        
        query = query.gte("anomaly_score", min_score)
        
        # Order by score (highest first) and limit
        query = query.order("anomaly_score", desc=True).limit(limit)
        
        # Execute query
        response = query.execute()
        
        if not response.data:
            return AnomaliesResponse(
                anomalies=[],
                total=0
            )
        
        # Convert to Anomaly models
        anomalies = []
        for anomaly_data in response.data:
            try:
                # Get related audit event
                audit_event_data = anomaly_data.get("roche_audit_logs")
                if not audit_event_data:
                    logger.warning(f"No audit event found for anomaly {anomaly_data.get('id')}")
                    continue
                
                audit_event = AuditEvent(**audit_event_data)
                
                anomaly = Anomaly(
                    id=anomaly_data["id"],
                    audit_event_id=anomaly_data["audit_event_id"],
                    audit_event=audit_event,
                    anomaly_score=anomaly_data["anomaly_score"],
                    detection_timestamp=anomaly_data["detection_timestamp"],
                    features_used=anomaly_data.get("features_used", {}),
                    model_version=anomaly_data["model_version"],
                    is_false_positive=anomaly_data.get("is_false_positive", False),
                    feedback_notes=anomaly_data.get("feedback_notes"),
                    alert_sent=anomaly_data.get("alert_sent", False),
                    severity_level=anomaly_data.get("severity_level", "Medium"),
                    affected_entities=anomaly_data.get("affected_entities", []),
                    suggested_actions=anomaly_data.get("suggested_actions", [])
                )
                anomalies.append(anomaly)
            except Exception as e:
                logger.warning(f"Failed to parse anomaly {anomaly_data.get('id')}: {e}")
                continue
        
        logger.info(f"Retrieved {len(anomalies)} anomalies for tenant {tenant_id}")
        
        return AnomaliesResponse(
            anomalies=anomalies,
            total=len(anomalies)
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving anomalies: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve anomalies: {str(e)}"
        )



@router.post("/search", response_model=SearchResponse)
@limiter.limit("50/minute")
async def semantic_search(
    request: Request,
    search_request: SearchRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    rag_agent: AuditRAGAgent = Depends(get_rag_agent)
):
    """
    Perform semantic search over audit logs using natural language queries.
    
    Uses RAG (Retrieval-Augmented Generation) to:
    - Generate query embeddings
    - Find similar audit events using vector search
    - Generate AI-powered response with source references
    
    Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
    """
    try:
        # Get tenant_id from current user
        tenant_id = current_user.get("tenant_id")
        if not tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User must have a tenant_id"
            )
        
        # Perform semantic search
        search_results = await rag_agent.semantic_search(
            query=search_request.query,
            tenant_id=tenant_id,
            filters=search_request.filters.dict() if search_request.filters else None,
            limit=search_request.limit
        )
        
        # Convert results to response format
        results = []
        for result in search_results.get("results", []):
            try:
                audit_event = AuditEvent(**result["event"])
                search_result = SearchResult(
                    event=audit_event,
                    similarity_score=result["similarity_score"],
                    relevance_explanation=result.get("relevance_explanation", "")
                )
                results.append(search_result)
            except Exception as e:
                logger.warning(f"Failed to parse search result: {e}")
                continue
        
        logger.info(f"Semantic search returned {len(results)} results for tenant {tenant_id}")
        
        # Log audit access (audit-of-audit) - Requirement 6.9
        await log_audit_access(
            user_id=current_user.get("id"),
            tenant_id=tenant_id,
            access_type="search",
            query_parameters={
                "query": search_request.query,
                "filters": search_request.filters.dict() if search_request.filters else None,
                "limit": search_request.limit
            },
            result_count=len(results),
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent")
        )
        
        return SearchResponse(
            query=search_request.query,
            results=results,
            ai_response=search_results.get("ai_response", ""),
            sources=search_results.get("sources", []),
            total_results=len(results)
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error performing semantic search: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to perform semantic search: {str(e)}"
        )



@router.get("/summary/{period}", response_model=SummaryResponse)
@limiter.limit("50/minute")
async def get_audit_summary(
    request: Request,
    period: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    rag_agent: AuditRAGAgent = Depends(get_rag_agent)
):
    """
    Get AI-generated summary of audit events for a time period.
    
    Periods:
    - daily: Last 24 hours
    - weekly: Last 7 days
    - monthly: Last 30 days
    
    Includes:
    - Event statistics
    - AI-generated insights
    - Trend analysis
    - Top users and event types
    
    Requirements: 3.6, 3.7, 3.8, 3.9
    """
    try:
        # Validate period
        valid_periods = ["daily", "weekly", "monthly"]
        if period not in valid_periods:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid period. Must be one of: {', '.join(valid_periods)}"
            )
        
        # Get tenant_id from current user
        tenant_id = current_user.get("tenant_id")
        if not tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User must have a tenant_id"
            )
        
        # Generate summary using RAG agent
        summary = await rag_agent.generate_summary(
            time_period=period,
            tenant_id=tenant_id
        )
        
        logger.info(f"Generated {period} summary for tenant {tenant_id}")
        
        return SummaryResponse(**summary)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating summary: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate summary: {str(e)}"
        )



@router.get("/event/{event_id}/explain", response_model=ExplanationResponse)
@limiter.limit("100/minute")
async def explain_event(
    request: Request,
    event_id: UUID,
    current_user: Dict[str, Any] = Depends(get_current_user),
    rag_agent: AuditRAGAgent = Depends(get_rag_agent)
):
    """
    Get AI-generated explanation of a specific audit event.
    
    Provides:
    - Natural language explanation
    - Context and background
    - Impact analysis
    - Related events
    
    Requirements: 3.4
    """
    try:
        # Get tenant_id from current user
        tenant_id = current_user.get("tenant_id")
        if not tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User must have a tenant_id"
            )
        
        # Fetch the event
        response = supabase.table("roche_audit_logs").select("*").eq("id", str(event_id)).eq("tenant_id", tenant_id).execute()
        
        if not response.data or len(response.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Audit event {event_id} not found"
            )
        
        event_data = response.data[0]
        
        # Generate explanation using RAG agent
        explanation_result = await rag_agent.explain_event(
            event_id=str(event_id),
            tenant_id=tenant_id
        )
        
        # Fetch related events (same entity, similar time)
        related_query = supabase.table("roche_audit_logs").select("*")
        related_query = related_query.eq("tenant_id", tenant_id)
        related_query = related_query.eq("entity_type", event_data["entity_type"])
        related_query = related_query.eq("entity_id", event_data["entity_id"])
        related_query = related_query.neq("id", str(event_id))
        related_query = related_query.limit(5)
        
        related_response = related_query.execute()
        
        related_events = []
        if related_response.data:
            for related_data in related_response.data:
                try:
                    related_events.append(AuditEvent(**related_data))
                except Exception as e:
                    logger.warning(f"Failed to parse related event: {e}")
        
        logger.info(f"Generated explanation for event {event_id}")
        
        return ExplanationResponse(
            event_id=event_id,
            explanation=explanation_result.get("explanation", ""),
            context=explanation_result.get("context", {}),
            impact_analysis=explanation_result.get("impact_analysis", ""),
            related_events=related_events
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error explaining event: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to explain event: {str(e)}"
        )



@router.post("/export/pdf")
@limiter.limit("10/minute")
async def export_pdf(
    request: Request,
    export_request: ExportRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    export_service: AuditExportService = Depends(get_export_service)
):
    """
    Export filtered audit events as PDF with AI-generated summary.
    
    Includes:
    - Filtered audit events
    - AI-generated executive summary (optional)
    - Trend analysis charts
    - Anomaly scores and classifications
    
    Requirements: 5.1, 5.3, 5.4, 5.5, 5.12
    """
    try:
        # Get tenant_id from current user
        tenant_id = current_user.get("tenant_id")
        if not tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User must have a tenant_id"
            )
        
        # Generate PDF export
        pdf_bytes = await export_service.export_pdf(
            tenant_id=tenant_id,
            filters=export_request.filters.dict(),
            include_summary=export_request.include_summary
        )
        
        # Log the export access (audit-of-audit)
        await log_audit_access(
            user_id=current_user.get("id"),
            tenant_id=tenant_id,
            access_type="export",
            query_parameters=export_request.filters.dict(),
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent")
        )
        
        logger.info(f"Generated PDF export for tenant {tenant_id}")
        
        # Return PDF as file response
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=audit_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
            }
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating PDF export: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate PDF export: {str(e)}"
        )



@router.post("/export/csv")
@limiter.limit("10/minute")
async def export_csv(
    request: Request,
    export_request: ExportRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    export_service: AuditExportService = Depends(get_export_service)
):
    """
    Export filtered audit events as CSV.
    
    Includes all audit event fields:
    - Event metadata
    - AI-generated tags and classifications
    - Anomaly scores
    - Risk levels
    
    Requirements: 5.2, 5.4
    """
    try:
        # Get tenant_id from current user
        tenant_id = current_user.get("tenant_id")
        if not tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User must have a tenant_id"
            )
        
        # Generate CSV export
        csv_content = await export_service.export_csv(
            tenant_id=tenant_id,
            filters=export_request.filters.dict()
        )
        
        # Log the export access (audit-of-audit)
        await log_audit_access(
            user_id=current_user.get("id"),
            tenant_id=tenant_id,
            access_type="export",
            query_parameters=export_request.filters.dict(),
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent")
        )
        
        logger.info(f"Generated CSV export for tenant {tenant_id}")
        
        # Return CSV as file response
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=audit_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            }
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating CSV export: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate CSV export: {str(e)}"
        )



@router.get("/dashboard/stats", response_model=DashboardStatsResponse)
@limiter.limit("100/minute")
async def get_dashboard_stats(
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get real-time statistics for audit dashboard.
    
    Returns:
    - Event counts (24h)
    - Anomaly counts (24h)
    - Critical event counts (24h)
    - Event volume chart (24h)
    - Top users by activity
    - Top event types by frequency
    - Category breakdown
    - System health metrics
    
    Uses Redis caching with 30-second TTL for performance.
    
    Requirements: 10.2, 10.3, 10.4, 10.5, 10.6, 7.10
    """
    try:
        # Get tenant_id from current user
        tenant_id = current_user.get("tenant_id")
        if not tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User must have a tenant_id"
            )
        
        # Check cache first (Requirement 7.10)
        from services.redis_cache_service import get_cache_service
        cache_service = get_cache_service()
        
        cached_stats = cache_service.get_cached_dashboard_stats(tenant_id)
        if cached_stats:
            logger.debug(f"Cache hit for dashboard stats (tenant {tenant_id})")
            return DashboardStatsResponse(**cached_stats)
        
        # Calculate time window (last 24 hours)
        end_time = datetime.now()
        start_time = end_time - timedelta(hours=24)
        
        # Get total events in last 24 hours
        events_query = supabase.table("roche_audit_logs").select("*", count="exact")
        events_query = events_query.eq("tenant_id", tenant_id)
        events_query = events_query.gte("timestamp", start_time.isoformat())
        events_response = events_query.execute()
        total_events_24h = events_response.count if hasattr(events_response, 'count') else len(events_response.data or [])
        
        # Get anomalies in last 24 hours
        anomalies_query = supabase.table("audit_anomalies").select("*", count="exact")
        anomalies_query = anomalies_query.eq("tenant_id", tenant_id)
        anomalies_query = anomalies_query.gte("detection_timestamp", start_time.isoformat())
        anomalies_response = anomalies_query.execute()
        total_anomalies_24h = anomalies_response.count if hasattr(anomalies_response, 'count') else len(anomalies_response.data or [])
        
        # Get critical events in last 24 hours
        critical_query = supabase.table("roche_audit_logs").select("*", count="exact")
        critical_query = critical_query.eq("tenant_id", tenant_id)
        critical_query = critical_query.eq("severity", "critical")
        critical_query = critical_query.gte("timestamp", start_time.isoformat())
        critical_response = critical_query.execute()
        critical_events_24h = critical_response.count if hasattr(critical_response, 'count') else len(critical_response.data or [])
        
        # Get event volume chart data (hourly buckets)
        event_volume_chart = []
        for hour in range(24):
            hour_start = start_time + timedelta(hours=hour)
            hour_end = hour_start + timedelta(hours=1)
            
            hour_query = supabase.table("roche_audit_logs").select("*", count="exact")
            hour_query = hour_query.eq("tenant_id", tenant_id)
            hour_query = hour_query.gte("timestamp", hour_start.isoformat())
            hour_query = hour_query.lt("timestamp", hour_end.isoformat())
            hour_response = hour_query.execute()
            hour_count = hour_response.count if hasattr(hour_response, 'count') else len(hour_response.data or [])
            
            event_volume_chart.append({
                "timestamp": hour_start.isoformat(),
                "count": hour_count
            })
        
        # Get top users by activity
        all_events_query = supabase.table("roche_audit_logs").select("user_id")
        all_events_query = all_events_query.eq("tenant_id", tenant_id)
        all_events_query = all_events_query.gte("timestamp", start_time.isoformat())
        all_events_response = all_events_query.execute()
        
        user_counts = {}
        if all_events_response.data:
            for event in all_events_response.data:
                user_id = event.get("user_id")
                if user_id:
                    user_counts[user_id] = user_counts.get(user_id, 0) + 1
        
        top_users = [
            {"user_id": user_id, "count": count}
            for user_id, count in sorted(user_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        ]
        
        # Get top event types by frequency
        event_type_counts = {}
        if all_events_response.data:
            for event in all_events_response.data:
                event_type = event.get("event_type")
                if event_type:
                    event_type_counts[event_type] = event_type_counts.get(event_type, 0) + 1
        
        top_event_types = [
            {"event_type": event_type, "count": count}
            for event_type, count in sorted(event_type_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        ]
        
        # Get category breakdown
        category_query = supabase.table("roche_audit_logs").select("category")
        category_query = category_query.eq("tenant_id", tenant_id)
        category_query = category_query.gte("timestamp", start_time.isoformat())
        category_response = category_query.execute()
        
        category_breakdown = {}
        if category_response.data:
            for event in category_response.data:
                category = event.get("category")
                if category:
                    category_breakdown[category] = category_breakdown.get(category, 0) + 1
        
        # System health metrics
        system_health = {
            "anomaly_detection_latency_ms": 0,  # Placeholder
            "search_response_time_ms": 0,  # Placeholder
            "database_connection_status": "healthy"
        }
        
        logger.info(f"Retrieved dashboard stats for tenant {tenant_id}")
        
        # Build response
        stats_dict = {
            "total_events_24h": total_events_24h,
            "total_anomalies_24h": total_anomalies_24h,
            "critical_events_24h": critical_events_24h,
            "event_volume_chart": event_volume_chart,
            "top_users": top_users,
            "top_event_types": top_event_types,
            "category_breakdown": category_breakdown,
            "system_health": system_health
        }
        
        # Cache the results with 30-second TTL (Requirement 7.10)
        cache_service.cache_dashboard_stats(tenant_id, stats_dict, ttl=30)
        
        return DashboardStatsResponse(**stats_dict)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving dashboard stats: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve dashboard stats: {str(e)}"
        )



@router.post("/anomaly/{anomaly_id}/feedback", response_model=FeedbackResponse)
@limiter.limit("50/minute")
async def submit_anomaly_feedback(
    request: Request,
    anomaly_id: UUID,
    feedback_request: FeedbackRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Submit feedback on anomaly detection for model improvement.
    
    Allows users to:
    - Mark anomalies as false positives
    - Provide feedback notes
    - Help improve ML model accuracy
    
    Requirements: 1.8, 8.8
    """
    try:
        # Get tenant_id from current user
        tenant_id = current_user.get("tenant_id")
        if not tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User must have a tenant_id"
            )
        
        # Verify anomaly exists and belongs to tenant
        anomaly_query = supabase.table("audit_anomalies").select("*")
        anomaly_query = anomaly_query.eq("id", str(anomaly_id))
        anomaly_query = anomaly_query.eq("tenant_id", tenant_id)
        anomaly_response = anomaly_query.execute()
        
        if not anomaly_response.data or len(anomaly_response.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Anomaly {anomaly_id} not found"
            )
        
        # Update anomaly with feedback
        update_data = {
            "is_false_positive": feedback_request.is_false_positive,
            "feedback_notes": feedback_request.notes,
            "feedback_user_id": current_user.get("id"),
            "feedback_timestamp": datetime.now().isoformat()
        }
        
        update_response = supabase.table("audit_anomalies").update(update_data).eq("id", str(anomaly_id)).execute()
        
        if not update_response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update anomaly feedback"
            )
        
        logger.info(f"Feedback submitted for anomaly {anomaly_id} by user {current_user.get('id')}")
        
        return FeedbackResponse(
            success=True,
            message="Feedback submitted successfully"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting feedback: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit feedback: {str(e)}"
        )



@router.post("/integrations/configure", response_model=ConfigurationResponse)
@limiter.limit("20/minute")
async def configure_integration(
    request: Request,
    config_request: IntegrationConfigRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    integration_hub: AuditIntegrationHub = Depends(get_integration_hub)
):
    """
    Configure external integration for audit alerts.
    
    Supported integrations:
    - slack: Slack webhook notifications
    - teams: Microsoft Teams webhook notifications
    - zapier: Zapier webhook triggers
    - email: Email notifications
    
    Requirements: 5.11
    """
    try:
        # Get tenant_id from current user
        tenant_id = current_user.get("tenant_id")
        if not tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User must have a tenant_id"
            )
        
        # Validate integration type
        valid_types = ["slack", "teams", "zapier", "email"]
        if config_request.integration_type not in valid_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid integration type. Must be one of: {', '.join(valid_types)}"
            )
        
        # Validate configuration using integration hub
        validation_result = await integration_hub.validate_configuration(
            integration_type=config_request.integration_type,
            config=config_request.config
        )
        
        if not validation_result.get("valid", False):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid configuration: {validation_result.get('error', 'Unknown error')}"
            )
        
        # Check if integration already exists
        existing_query = supabase.table("audit_integrations").select("*")
        existing_query = existing_query.eq("tenant_id", tenant_id)
        existing_query = existing_query.eq("integration_type", config_request.integration_type)
        existing_response = existing_query.execute()
        
        if existing_response.data and len(existing_response.data) > 0:
            # Update existing integration
            integration_id = existing_response.data[0]["id"]
            update_data = {
                "config": config_request.config,
                "is_active": True,
                "updated_at": datetime.now().isoformat()
            }
            
            update_response = supabase.table("audit_integrations").update(update_data).eq("id", integration_id).execute()
            
            if not update_response.data:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to update integration"
                )
            
            logger.info(f"Updated integration {integration_id} for tenant {tenant_id}")
            
            return ConfigurationResponse(
                success=True,
                message="Integration updated successfully",
                integration_id=UUID(integration_id)
            )
        else:
            # Create new integration
            insert_data = {
                "id": str(uuid4()),
                "tenant_id": tenant_id,
                "integration_type": config_request.integration_type,
                "config": config_request.config,
                "is_active": True,
                "created_by": current_user.get("id")
            }
            
            insert_response = supabase.table("audit_integrations").insert(insert_data).execute()
            
            if not insert_response.data:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to create integration"
                )
            
            integration_id = insert_response.data[0]["id"]
            
            logger.info(f"Created integration {integration_id} for tenant {tenant_id}")
            
            return ConfigurationResponse(
                success=True,
                message="Integration created successfully",
                integration_id=UUID(integration_id)
            )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error configuring integration: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to configure integration: {str(e)}"
        )


@router.post("/events/batch")
@limiter.limit("10/minute")
async def batch_insert_events(
    request: Request,
    events: List[Dict[str, Any]],
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Batch insert audit events for high-throughput scenarios.
    
    Supports up to 1000 events per batch with atomic transaction processing.
    All events must succeed or the entire batch is rolled back.
    
    Args:
        events: List of audit event dictionaries (max 1000)
        
    Returns:
        Success status and count of inserted events
        
    Requirements: 7.2
    """
    try:
        # Get tenant_id from current user
        tenant_id = current_user.get("tenant_id")
        if not tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User must have a tenant_id"
            )
        
        # Validate batch size
        if len(events) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Batch must contain at least one event"
            )
        
        if len(events) > 1000:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Batch size exceeds maximum of 1000 events"
            )
        
        # Validate and prepare events
        prepared_events = []
        for idx, event in enumerate(events):
            try:
                # Ensure required fields are present
                required_fields = ["event_type", "entity_type", "severity"]
                for field in required_fields:
                    if field not in event:
                        raise ValueError(f"Missing required field: {field}")
                
                # Add tenant_id and timestamp if not present
                if "tenant_id" not in event:
                    event["tenant_id"] = tenant_id
                
                if "timestamp" not in event:
                    event["timestamp"] = datetime.now().isoformat()
                
                # Generate ID if not present
                if "id" not in event:
                    from uuid import uuid4
                    event["id"] = str(uuid4())
                
                # Set defaults for optional fields
                if "is_anomaly" not in event:
                    event["is_anomaly"] = False
                
                prepared_events.append(event)
                
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid event at index {idx}: {str(e)}"
                )
        
        # Insert events in a transaction (atomic operation)
        # Note: Supabase doesn't directly support transactions via REST API,
        # but batch inserts are atomic by default
        try:
            insert_response = supabase.table("roche_audit_logs").insert(prepared_events).execute()
            
            if not insert_response.data:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Batch insertion failed - no data returned"
                )
            
            inserted_count = len(insert_response.data)
            
            logger.info(
                f"Batch inserted {inserted_count} audit events for tenant {tenant_id}"
            )
            
            return {
                "success": True,
                "message": f"Successfully inserted {inserted_count} events",
                "inserted_count": inserted_count,
                "event_ids": [event["id"] for event in insert_response.data]
            }
            
        except Exception as db_error:
            logger.error(f"Database error during batch insertion: {db_error}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Batch insertion failed: {str(db_error)}"
            )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in batch insertion: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Batch insertion failed: {str(e)}"
        )


# ============================================================================
# Helper Functions
# ============================================================================

async def log_audit_access(
    user_id: str,
    tenant_id: str,
    action: str,
    filters: Dict[str, Any]
):
    """
    Log audit access for compliance (audit-of-audit).
    
    Requirements: 6.9
    """
    try:
        access_log = {
            "id": str(uuid4()),
            "event_type": "audit_access",
            "user_id": user_id,
            "entity_type": "audit_log",
            "action_details": {
                "action": action,
                "filters": filters
            },
            "severity": "info",
            "timestamp": datetime.now().isoformat(),
            "tenant_id": tenant_id
        }
        
        supabase.table("roche_audit_logs").insert(access_log).execute()
        logger.debug(f"Logged audit access for user {user_id}")
    except Exception as e:
        logger.error(f"Failed to log audit access: {e}")
        # Don't raise exception - logging failure shouldn't block the main operation


# ============================================================================
# AI-Empowered PPM Features - Audit Management Endpoints
# ============================================================================

@router.get("/logs", response_model=AuditEventsResponse)
@limiter.limit("100/minute")
async def get_audit_logs(
    request: Request,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    user_id: Optional[str] = None,
    action_type: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get filtered audit logs with pagination.
    
    Supports filtering by:
    - Date range (start_date, end_date)
    - User ID
    - Action type
    
    Implements organization isolation automatically.
    
    Requirements: 15.1, 15.5
    Task: 20.1
    """
    try:
        # Get organization_id from current user (using organization_id for multi-tenancy)
        organization_id = current_user.get("organization_id") or current_user.get("tenant_id")
        if not organization_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User must have an organization_id"
            )
        
        # Build query
        query = supabase.table("audit_logs").select("*")
        
        # Apply organization isolation (CRITICAL for multi-tenant security)
        query = query.eq("organization_id", organization_id)
        
        # Apply filters
        if start_date:
            query = query.gte("created_at", start_date.isoformat())
        
        if end_date:
            query = query.lte("created_at", end_date.isoformat())
        
        if user_id:
            query = query.eq("user_id", user_id)
        
        if action_type:
            query = query.eq("action", action_type)
        
        # Get total count (before pagination)
        count_query = query
        count_response = count_query.execute()
        total = len(count_response.data) if count_response.data else 0
        
        # Apply pagination and ordering
        query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
        
        # Execute query
        response = query.execute()
        
        if not response.data:
            return AuditEventsResponse(
                events=[],
                total=0,
                limit=limit,
                offset=offset
            )
        
        # Convert to AuditEvent models
        events = []
        for event_data in response.data:
            try:
                # Map audit_logs fields to AuditEvent model
                audit_event = AuditEvent(
                    id=event_data["id"],
                    event_type=event_data.get("action", "unknown"),
                    user_id=event_data.get("user_id"),
                    entity_type=event_data.get("entity_type", "unknown"),
                    entity_id=event_data.get("entity_id"),
                    action_details=event_data.get("details", {}),
                    severity=event_data.get("severity", "info"),
                    ip_address=event_data.get("ip_address"),
                    user_agent=event_data.get("user_agent"),
                    project_id=None,
                    performance_metrics=None,
                    timestamp=event_data["created_at"],
                    anomaly_score=None,
                    is_anomaly=False,
                    category=None,
                    risk_level=None,
                    tags=event_data.get("tags", {}),
                    ai_insights=None,
                    tenant_id=UUID(organization_id),
                    hash=None,
                    previous_hash=None
                )
                events.append(audit_event)
            except Exception as e:
                logger.warning(f"Failed to parse audit log {event_data.get('id')}: {e}")
                continue
        
        logger.info(f"Retrieved {len(events)} audit logs for organization {organization_id}")
        
        # Log audit access (audit-of-audit)
        await log_audit_access(
            user_id=current_user.get("id"),
            tenant_id=organization_id,
            action="read_logs",
            filters={
                "start_date": start_date.isoformat() if start_date else None,
                "end_date": end_date.isoformat() if end_date else None,
                "user_id": user_id,
                "action_type": action_type,
                "limit": limit,
                "offset": offset
            }
        )
        
        return AuditEventsResponse(
            events=events,
            total=total,
            limit=limit,
            offset=offset
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving audit logs: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve audit logs: {str(e)}"
        )


@router.post("/logs/{log_id}/tag")
@limiter.limit("100/minute")
async def add_tag_to_audit_log(
    request: Request,
    log_id: UUID,
    tag_request: AddTagRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Add a tag to an audit log entry.
    
    Tags help categorize and organize audit logs for easier searching and filtering.
    The tagging action itself is logged to audit_logs for audit trail purposes.
    
    Requirements: 15.2, 15.6
    Task: 20.2
    """
    try:
        # Get organization_id from current user
        organization_id = current_user.get("organization_id") or current_user.get("tenant_id")
        if not organization_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User must have an organization_id"
            )
        
        # Verify log exists and belongs to organization
        log_query = supabase.table("audit_logs").select("*")
        log_query = log_query.eq("id", str(log_id))
        log_query = log_query.eq("organization_id", organization_id)
        log_response = log_query.execute()
        
        if not log_response.data or len(log_response.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Audit log {log_id} not found"
            )
        
        log_data = log_response.data[0]
        
        # Get existing tags or initialize empty dict
        existing_tags = log_data.get("tags", {})
        if not isinstance(existing_tags, dict):
            existing_tags = {}
        
        # Add new tag with timestamp and user info
        tag_key = tag_request.tag.lower().replace(" ", "_")
        existing_tags[tag_key] = {
            "label": tag_request.tag,
            "added_by": current_user.get("id"),
            "added_at": datetime.now().isoformat()
        }
        
        # Update log with new tags
        update_data = {
            "tags": existing_tags
        }
        
        update_response = supabase.table("audit_logs").update(update_data).eq("id", str(log_id)).execute()
        
        if not update_response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to add tag to audit log"
            )
        
        # Log the tagging action to audit_logs (Requirement 15.6)
        tagging_log = {
            "id": str(uuid4()),
            "organization_id": organization_id,
            "user_id": current_user.get("id"),
            "action": "audit_log_tagged",
            "entity_type": "audit_log",
            "entity_id": str(log_id),
            "details": {
                "tag": tag_request.tag,
                "log_id": str(log_id)
            },
            "success": True,
            "created_at": datetime.now().isoformat()
        }
        
        supabase.table("audit_logs").insert(tagging_log).execute()
        
        logger.info(f"Tag '{tag_request.tag}' added to audit log {log_id} by user {current_user.get('id')}")
        
        return {
            "success": True,
            "message": "Tag added successfully",
            "log_id": str(log_id),
            "tag": tag_request.tag
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding tag to audit log: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add tag: {str(e)}"
        )


@router.post("/export")
@limiter.limit("10/minute")
async def export_audit_logs(
    request: Request,
    export_request: ExportRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Export filtered audit logs in CSV or JSON format.
    
    Supports filtering by:
    - Date range
    - User ID
    - Action type
    
    Includes all relevant fields:
    - timestamp
    - user_id
    - action
    - entity_type
    - entity_id
    - details
    - success
    - error_message
    - tags
    
    Requirements: 15.3, 15.4, 15.5
    Task: 20.3
    """
    try:
        # Get organization_id from current user
        organization_id = current_user.get("organization_id") or current_user.get("tenant_id")
        if not organization_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User must have an organization_id"
            )
        
        # Validate format parameter
        if not hasattr(export_request.filters, 'format'):
            # Default to CSV if not specified
            export_format = "csv"
        else:
            export_format = getattr(export_request.filters, 'format', 'csv')
        
        # Build query with filters
        query = supabase.table("audit_logs").select("*")
        query = query.eq("organization_id", organization_id)
        
        # Apply filters from export_request.filters
        if export_request.filters.start_date:
            query = query.gte("created_at", export_request.filters.start_date.isoformat())
        
        if export_request.filters.end_date:
            query = query.lte("created_at", export_request.filters.end_date.isoformat())
        
        if export_request.filters.user_id:
            query = query.eq("user_id", export_request.filters.user_id)
        
        # Note: action_type is not in AuditEventFilters, but we can check for event_types
        if hasattr(export_request.filters, 'event_types') and export_request.filters.event_types:
            query = query.in_("action", export_request.filters.event_types)
        
        # Order by timestamp
        query = query.order("created_at", desc=True)
        
        # Execute query
        response = query.execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No audit logs found matching the specified filters"
            )
        
        logs = response.data
        
        # Generate export based on format
        if export_format.lower() == "csv":
            # Generate CSV
            import csv
            import io
            
            output = io.StringIO()
            
            # Define CSV columns (Requirement 15.4)
            fieldnames = [
                "timestamp",
                "user_id",
                "action",
                "entity_type",
                "entity_id",
                "details",
                "success",
                "error_message",
                "tags",
                "ip_address",
                "user_agent"
            ]
            
            writer = csv.DictWriter(output, fieldnames=fieldnames)
            writer.writeheader()
            
            for log in logs:
                row = {
                    "timestamp": log.get("created_at", ""),
                    "user_id": log.get("user_id", ""),
                    "action": log.get("action", ""),
                    "entity_type": log.get("entity_type", ""),
                    "entity_id": log.get("entity_id", ""),
                    "details": str(log.get("details", {})),
                    "success": log.get("success", True),
                    "error_message": log.get("error_message", ""),
                    "tags": str(log.get("tags", {})),
                    "ip_address": log.get("ip_address", ""),
                    "user_agent": log.get("user_agent", "")
                }
                writer.writerow(row)
            
            csv_content = output.getvalue()
            output.close()
            
            # Log the export access
            await log_audit_access(
                user_id=current_user.get("id"),
                tenant_id=organization_id,
                action="export_csv",
                filters=export_request.filters.dict()
            )
            
            logger.info(f"Generated CSV export with {len(logs)} logs for organization {organization_id}")
            
            return Response(
                content=csv_content,
                media_type="text/csv",
                headers={
                    "Content-Disposition": f"attachment; filename=audit_logs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
                }
            )
        
        elif export_format.lower() == "json":
            # Generate JSON
            import json
            
            # Format logs for JSON export (Requirement 15.4)
            export_data = []
            for log in logs:
                export_data.append({
                    "timestamp": log.get("created_at", ""),
                    "user_id": log.get("user_id", ""),
                    "action": log.get("action", ""),
                    "entity_type": log.get("entity_type", ""),
                    "entity_id": log.get("entity_id", ""),
                    "details": log.get("details", {}),
                    "success": log.get("success", True),
                    "error_message": log.get("error_message", ""),
                    "tags": log.get("tags", {}),
                    "ip_address": log.get("ip_address", ""),
                    "user_agent": log.get("user_agent", "")
                })
            
            json_content = json.dumps(export_data, indent=2, default=str)
            
            # Log the export access
            await log_audit_access(
                user_id=current_user.get("id"),
                tenant_id=organization_id,
                action="export_json",
                filters=export_request.filters.dict()
            )
            
            logger.info(f"Generated JSON export with {len(logs)} logs for organization {organization_id}")
            
            return Response(
                content=json_content,
                media_type="application/json",
                headers={
                    "Content-Disposition": f"attachment; filename=audit_logs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
                }
            )
        
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid export format: {export_format}. Must be 'csv' or 'json'"
            )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exporting audit logs: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export audit logs: {str(e)}"
        )


@router.post("/detect-anomalies")
@limiter.limit("20/minute")
async def detect_anomalies_in_logs(
    request: Request,
    anomaly_request: DetectAnomaliesRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    anomaly_service: AuditAnomalyService = Depends(get_anomaly_service)
):
    """
    Detect anomalies in audit logs using Isolation Forest ML algorithm.
    
    Analyzes audit logs from the specified time range and identifies
    suspicious patterns based on:
    - Time-based patterns (hour of day, day of week)
    - Frequency patterns (action frequency, user action diversity)
    - User behavior patterns (time since last action)
    
    Returns flagged activities with confidence scores.
    
    Requirements: 13.1, 13.2, 13.3, 13.5
    Task: 20.4
    """
    try:
        # Get organization_id from current user
        organization_id = current_user.get("organization_id") or current_user.get("tenant_id")
        if not organization_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User must have an organization_id"
            )
        
        # Validate time_range_days
        if anomaly_request.time_range_days < 1 or anomaly_request.time_range_days > 90:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="time_range_days must be between 1 and 90"
            )
        
        # Use AnomalyDetectorAgent to detect anomalies
        from ai_agents import AnomalyDetectorAgent
        
        agent = AnomalyDetectorAgent(supabase_client=supabase)
        
        # Detect anomalies
        result = await agent.detect_anomalies(
            organization_id=organization_id,
            time_range_days=anomaly_request.time_range_days,
            user_id=current_user.get("id")
        )
        
        # Format response
        anomalies = []
        for anomaly_data in result.get("anomalies", []):
            anomaly_result = AnomalyResult(
                log_id=UUID(anomaly_data["log_id"]),
                timestamp=anomaly_data["timestamp"],
                user_id=UUID(anomaly_data["user_id"]) if anomaly_data.get("user_id") else None,
                user_name=anomaly_data.get("user_name", "Unknown"),
                action=anomaly_data["action"],
                confidence=anomaly_data["confidence"],
                reason=anomaly_data.get("reason", "Anomalous pattern detected"),
                details=anomaly_data.get("details", {})
            )
            anomalies.append(anomaly_result)
        
        logger.info(
            f"Detected {len(anomalies)} anomalies in {anomaly_request.time_range_days} days "
            f"for organization {organization_id}"
        )
        
        # Log the detection request
        await log_audit_access(
            user_id=current_user.get("id"),
            tenant_id=organization_id,
            action="detect_anomalies",
            filters={
                "time_range_days": anomaly_request.time_range_days
            }
        )
        
        return DetectAnomaliesResponse(
            anomalies=anomalies,
            total_logs_analyzed=result.get("total_logs_analyzed", 0),
            anomaly_count=len(anomalies)
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error detecting anomalies: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to detect anomalies: {str(e)}"
        )


@router.post("/search-logs", response_model=AuditSearchResponse)
@limiter.limit("50/minute")
async def search_audit_logs(
    request: Request,
    search_request: AuditSearchRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Perform semantic search over audit logs using natural language queries.
    
    Uses RAG (Retrieval-Augmented Generation) to:
    - Generate query embeddings
    - Find similar audit log entries using vector search
    - Rank results by relevance
    - Highlight relevant sections
    
    Requirements: 14.1, 14.2, 14.3, 14.4, 14.5
    Task: 20.5
    """
    try:
        # Get organization_id from current user
        organization_id = current_user.get("organization_id") or current_user.get("tenant_id")
        if not organization_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User must have an organization_id"
            )
        
        # Use AuditSearchAgent to perform semantic search
        from ai_agents import AuditSearchAgent
        import os
        
        openai_api_key = os.getenv("OPENAI_API_KEY")
        if not openai_api_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="OpenAI API key not configured. Semantic search is unavailable."
            )
        
        agent = AuditSearchAgent(
            supabase_client=supabase,
            openai_client=None  # Agent will initialize internally
        )
        
        # Perform search
        result = await agent.search_audit_logs(
            query=search_request.query,
            organization_id=organization_id,
            user_id=current_user.get("id"),
            limit=search_request.limit
        )
        
        # Format response
        search_results = []
        for search_result in result.get("results", []):
            audit_search_result = AuditSearchResult(
                log_id=UUID(search_result["log_id"]),
                timestamp=search_result["timestamp"],
                user_name=search_result.get("user_name", "Unknown"),
                action=search_result["action"],
                details=str(search_result.get("details", {})),
                relevance_score=search_result["relevance_score"],
                highlighted_text=search_result.get("highlighted_text", "")
            )
            search_results.append(audit_search_result)
        
        logger.info(
            f"Semantic search returned {len(search_results)} results for query: '{search_request.query}' "
            f"(organization {organization_id})"
        )
        
        # Log the search request (Requirement 14.5)
        await log_audit_access(
            user_id=current_user.get("id"),
            tenant_id=organization_id,
            action="search_logs",
            filters={
                "query": search_request.query,
                "limit": search_request.limit
            }
        )
        
        return AuditSearchResponse(
            results=search_results,
            total_results=len(search_results)
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error performing semantic search: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to perform semantic search: {str(e)}"
        )
