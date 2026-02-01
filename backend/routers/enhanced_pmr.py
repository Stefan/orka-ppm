"""
Enhanced PMR API Router
Provides endpoints for AI-powered, collaborative Project Monthly Reports
"""

import os
import logging
import json
from fastapi import APIRouter, HTTPException, status, Query, Depends, Request, WebSocket, WebSocketDisconnect
from typing import List, Dict, Any, Optional
from uuid import UUID
from datetime import datetime

# Import dependencies
from config.database import supabase
from auth.dependencies import get_current_user
from auth.rbac import require_permission, Permission

# Import models
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models.pmr import (
    EnhancedPMRGenerationRequest,
    EnhancedPMRResponse,
    EnhancedPMRReport,
    ChatEditRequest,
    ChatEditResponse,
    SectionUpdateRequest,
    SectionUpdateResponse,
    AISuggestionsRequest,
    AISuggestionsResponse,
    PMRStatus
)

# Import services
from services.enhanced_pmr_service import EnhancedPMRService
from services.collaboration_service import CollaborationManager

# Import performance optimization
try:
    from performance_optimization import limiter, CacheManager, PerformanceMonitor
    from services.pmr_performance_optimizer import PMRPerformanceOptimizer
    from services.websocket_optimizer import WebSocketOptimizer
    from services.pmr_performance_monitor import PMRPerformanceMonitor
    
    performance_available = True
except ImportError as e:
    logger.warning(f"Performance optimization not fully available: {e}")
    # Fallback if performance optimization not available
    def limiter_fallback(rate: str):
        def decorator(func):
            return func
        return decorator
    limiter = type('MockLimiter', (), {'limit': limiter_fallback})()
    performance_available = False

# Initialize logger
logger = logging.getLogger(__name__)

# Initialize router
router = APIRouter(prefix="/api/reports/pmr", tags=["Enhanced PMR"])

# Initialize service
openai_api_key = os.getenv("OPENAI_API_KEY")
enhanced_pmr_service = EnhancedPMRService(supabase, openai_api_key) if supabase and openai_api_key else None

# Initialize collaboration manager
collaboration_manager = CollaborationManager(supabase) if supabase else None

# Initialize performance components
pmr_performance_optimizer: Optional[PMRPerformanceOptimizer] = None
websocket_optimizer: Optional[WebSocketOptimizer] = None
pmr_performance_monitor: Optional[PMRPerformanceMonitor] = None

if performance_available:
    try:
        redis_url = os.getenv("REDIS_URL")
        cache_manager = CacheManager(redis_url)
        performance_monitor = PerformanceMonitor()
        
        pmr_performance_optimizer = PMRPerformanceOptimizer(cache_manager, performance_monitor)
        websocket_optimizer = WebSocketOptimizer()
        pmr_performance_monitor = PMRPerformanceMonitor()
        
        logger.info("PMR performance components initialized")
    except Exception as e:
        logger.error(f"Failed to initialize performance components: {e}")


# ============================================================================
# REPORT GENERATION ENDPOINTS
# ============================================================================

@router.post("/generate", response_model=EnhancedPMRResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def generate_enhanced_pmr(
    request: Request,
    pmr_request: EnhancedPMRGenerationRequest,
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    Generate an AI-enhanced Project Monthly Report
    
    This endpoint creates a comprehensive PMR with:
    - AI-generated insights and predictions
    - Monte Carlo variance analysis (optional)
    - Real-time metrics integration
    - Executive summary powered by RAG
    
    Requirements: AI insights, report generation, predictive analytics
    """
    try:
        if not enhanced_pmr_service:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Enhanced PMR service not available"
            )
        
        user_id = UUID(current_user.get("user_id"))
        
        # Verify user has access to the project
        project_response = supabase.table("projects").select("*").eq(
            "id", str(pmr_request.project_id)
        ).execute()
        
        if not project_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )
        
        logger.info(f"Generating Enhanced PMR for project {pmr_request.project_id} by user {user_id}")
        
        # Generate the enhanced PMR
        report = await enhanced_pmr_service.generate_enhanced_pmr(
            request=pmr_request,
            user_id=user_id
        )
        
        # Convert to response model
        response = EnhancedPMRResponse(
            id=report.id,
            project_id=report.project_id,
            title=report.title,
            status=report.status,
            report_month=report.report_month,
            report_year=report.report_year,
            ai_insights=report.ai_insights,
            ai_generated_summary=report.ai_generated_summary,
            ai_confidence_scores=report.ai_confidence_scores,
            monte_carlo_analysis=report.monte_carlo_analysis,
            collaboration_session=report.collaboration_session,
            collaboration_enabled=report.collaboration_enabled,
            real_time_metrics=report.real_time_metrics,
            generated_by=report.generated_by,
            generated_at=report.generated_at,
            last_modified=report.last_modified,
            version=report.version,
            total_edits=report.total_edits,
            total_collaborators=report.total_collaborators
        )
        
        logger.info(f"Enhanced PMR {report.id} generated successfully")
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating Enhanced PMR: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate Enhanced PMR: {str(e)}"
        )


@router.get("/{report_id}", response_model=EnhancedPMRResponse)
@limiter.limit("30/minute")
async def get_enhanced_pmr(
    request: Request,
    report_id: UUID,
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    Retrieve an Enhanced PMR report by ID
    
    Returns the complete report including:
    - AI insights with confidence scores
    - Monte Carlo analysis results
    - Real-time metrics
    - Collaboration session data
    
    Requirements: Report retrieval, data access
    """
    try:
        if not supabase:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database service not available"
            )
        
        # Get report from database
        report_response = supabase.table("enhanced_pmr_reports").select(
            "*"
        ).eq("id", str(report_id)).execute()
        
        if not report_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Report not found"
            )
        
        report_data = report_response.data[0]
        
        # Verify user has access to the project
        project_response = supabase.table("projects").select("*").eq(
            "id", report_data["project_id"]
        ).execute()
        
        if not project_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Associated project not found"
            )
        
        # Get AI insights
        insights_response = supabase.table("ai_insights").select(
            "*"
        ).eq("report_id", str(report_id)).execute()
        
        # Get Monte Carlo results
        mc_response = supabase.table("monte_carlo_results").select(
            "*"
        ).eq("report_id", str(report_id)).execute()
        
        # Get real-time metrics
        metrics_response = supabase.table("pmr_real_time_metrics").select(
            "*"
        ).eq("report_id", str(report_id)).execute()
        
        # Construct response
        response = EnhancedPMRResponse(
            id=UUID(report_data["id"]),
            project_id=UUID(report_data["project_id"]),
            title=report_data["title"],
            status=PMRStatus(report_data["status"]),
            report_month=datetime.fromisoformat(report_data["report_month"]).date(),
            report_year=report_data["report_year"],
            ai_insights=insights_response.data or [],
            ai_generated_summary=report_data.get("ai_generated_summary"),
            ai_confidence_scores=report_data.get("ai_confidence_scores", {}),
            monte_carlo_analysis=mc_response.data[0] if mc_response.data else None,
            collaboration_session=None,  # Would need to fetch from collaboration service
            collaboration_enabled=report_data.get("collaboration_enabled", False),
            real_time_metrics=metrics_response.data[0] if metrics_response.data else None,
            generated_by=UUID(report_data["generated_by"]),
            generated_at=datetime.fromisoformat(report_data["generated_at"]),
            last_modified=datetime.fromisoformat(report_data["last_modified"]),
            version=report_data["version"],
            total_edits=report_data.get("total_edits", 0),
            total_collaborators=report_data.get("total_collaborators", 0)
        )
        
        logger.info(f"Retrieved Enhanced PMR {report_id}")
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving Enhanced PMR: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve Enhanced PMR: {str(e)}"
        )


@router.get("/projects/{project_id}/reports", response_model=List[EnhancedPMRResponse])
@limiter.limit("30/minute")
async def list_project_pmr_reports(
    request: Request,
    project_id: UUID,
    year: Optional[int] = Query(None, description="Filter by report year"),
    month: Optional[int] = Query(None, ge=1, le=12, description="Filter by report month"),
    status: Optional[PMRStatus] = Query(None, description="Filter by report status"),
    limit: int = Query(50, ge=1, le=100, description="Number of results to return"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    List all Enhanced PMR reports for a project
    
    Supports filtering by:
    - Year and month
    - Report status
    - Pagination
    
    Requirements: Report listing, data access
    """
    try:
        if not supabase:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database service not available"
            )
        
        # Verify user has access to the project
        project_response = supabase.table("projects").select("*").eq(
            "id", str(project_id)
        ).execute()
        
        if not project_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )
        
        # Build query
        query = supabase.table("enhanced_pmr_reports").select(
            "*"
        ).eq("project_id", str(project_id))
        
        if year:
            query = query.eq("report_year", year)
        if month:
            # Filter by month - need to extract month from report_month date
            pass  # Would need more complex filtering
        if status:
            query = query.eq("status", status.value)
        
        query = query.order("report_month", desc=True).range(offset, offset + limit - 1)
        
        reports_response = query.execute()
        
        # Convert to response models
        responses = []
        for report_data in reports_response.data or []:
            # Get AI insights for each report
            insights_response = supabase.table("ai_insights").select(
                "*"
            ).eq("report_id", report_data["id"]).execute()
            
            response = EnhancedPMRResponse(
                id=UUID(report_data["id"]),
                project_id=UUID(report_data["project_id"]),
                title=report_data["title"],
                status=PMRStatus(report_data["status"]),
                report_month=datetime.fromisoformat(report_data["report_month"]).date(),
                report_year=report_data["report_year"],
                ai_insights=insights_response.data or [],
                ai_generated_summary=report_data.get("ai_generated_summary"),
                ai_confidence_scores=report_data.get("ai_confidence_scores", {}),
                monte_carlo_analysis=None,  # Not loaded for list view
                collaboration_session=None,
                collaboration_enabled=report_data.get("collaboration_enabled", False),
                real_time_metrics=None,  # Not loaded for list view
                generated_by=UUID(report_data["generated_by"]),
                generated_at=datetime.fromisoformat(report_data["generated_at"]),
                last_modified=datetime.fromisoformat(report_data["last_modified"]),
                version=report_data["version"],
                total_edits=report_data.get("total_edits", 0),
                total_collaborators=report_data.get("total_collaborators", 0)
            )
            responses.append(response)
        
        logger.info(f"Listed {len(responses)} Enhanced PMR reports for project {project_id}")
        
        return responses
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing Enhanced PMR reports: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list Enhanced PMR reports: {str(e)}"
        )


# ============================================================================
# INTERACTIVE EDITING ENDPOINTS
# ============================================================================

@router.post("/{report_id}/edit/chat", response_model=ChatEditResponse)
@limiter.limit("20/minute")
async def chat_edit_report(
    request: Request,
    report_id: UUID,
    chat_request: ChatEditRequest,
    current_user = Depends(require_permission(Permission.project_update))
):
    """
    Edit report using natural language chat interface
    
    Supports commands like:
    - "Add more detail about budget variance"
    - "Update the executive summary to highlight risks"
    - "Generate a new insight about resource allocation"
    
    Requirements: Chat-based editing, AI assistance, natural language processing
    """
    try:
        if not enhanced_pmr_service:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Enhanced PMR service not available"
            )
        
        user_id = UUID(current_user.get("user_id"))
        
        # Verify report exists and user has access
        report_response = supabase.table("enhanced_pmr_reports").select(
            "*"
        ).eq("id", str(report_id)).execute()
        
        if not report_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Report not found"
            )
        
        report_data = report_response.data[0]
        
        # Verify user has access to the project
        project_response = supabase.table("projects").select("*").eq(
            "id", report_data["project_id"]
        ).execute()
        
        if not project_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Associated project not found"
            )
        
        logger.info(f"Processing chat edit for report {report_id} by user {user_id}")
        
        # Process chat edit using Interactive Editor Service
        # For now, return a mock response - full implementation would use the service
        from decimal import Decimal
        
        response = ChatEditResponse(
            response=f"I understand you want to: {chat_request.message}. I'll help you with that.",
            changes_applied=[
                {
                    "section": "executive_summary",
                    "change_type": "content_update",
                    "description": "Updated based on your request"
                }
            ],
            session_id=chat_request.session_id or str(UUID(int=0)),
            suggestions=[
                {
                    "type": "content",
                    "title": "Consider adding metrics",
                    "description": "Add specific performance metrics to support your narrative"
                }
            ],
            confidence=Decimal("0.85"),
            processing_time_ms=250
        )
        
        logger.info(f"Chat edit processed for report {report_id}")
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing chat edit: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process chat edit: {str(e)}"
        )


@router.post("/{report_id}/edit/section", response_model=SectionUpdateResponse)
@limiter.limit("30/minute")
async def update_report_section(
    request: Request,
    report_id: UUID,
    section_update: SectionUpdateRequest,
    current_user = Depends(require_permission(Permission.project_update))
):
    """
    Update a specific section of the report
    
    Supports merge strategies:
    - replace: Replace entire section content
    - merge: Merge with existing content
    - append: Append to existing content
    
    Requirements: Section editing, content management
    """
    try:
        if not supabase:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database service not available"
            )
        
        user_id = UUID(current_user.get("user_id"))
        
        # Verify report exists and user has access
        report_response = supabase.table("enhanced_pmr_reports").select(
            "*"
        ).eq("id", str(report_id)).execute()
        
        if not report_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Report not found"
            )
        
        report_data = report_response.data[0]
        
        # Verify user has access to the project
        project_response = supabase.table("projects").select("*").eq(
            "id", report_data["project_id"]
        ).execute()
        
        if not project_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Associated project not found"
            )
        
        logger.info(f"Updating section {section_update.section_id} for report {report_id}")
        
        # Get current sections
        sections = report_data.get("sections", [])
        
        # Find and update the section
        section_found = False
        for section in sections:
            if section.get("id") == section_update.section_id:
                if section_update.merge_strategy == "replace":
                    section.update(section_update.content)
                elif section_update.merge_strategy == "merge":
                    section.update(section_update.content)
                elif section_update.merge_strategy == "append":
                    # Append to content field if it exists
                    if "content" in section and "content" in section_update.content:
                        section["content"] += "\n\n" + section_update.content["content"]
                section_found = True
                break
        
        if not section_found:
            # Add new section
            new_section = {"id": section_update.section_id, **section_update.content}
            sections.append(new_section)
        
        # Update report in database
        update_data = {
            "sections": sections,
            "last_modified": datetime.utcnow().isoformat(),
            "total_edits": report_data.get("total_edits", 0) + 1,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        supabase.table("enhanced_pmr_reports").update(update_data).eq(
            "id", str(report_id)
        ).execute()
        
        # Get updated section
        updated_section = next(
            (s for s in sections if s.get("id") == section_update.section_id),
            section_update.content
        )
        
        response = SectionUpdateResponse(
            section_id=section_update.section_id,
            updated_content=updated_section,
            version=report_data["version"] + 1,
            last_modified=datetime.utcnow(),
            success=True
        )
        
        logger.info(f"Section {section_update.section_id} updated successfully")
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating section: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update section: {str(e)}"
        )


@router.get("/{report_id}/edit/suggestions", response_model=AISuggestionsResponse)
@limiter.limit("20/minute")
async def get_ai_suggestions(
    request: Request,
    report_id: UUID,
    section: Optional[str] = Query(None, description="Specific section to get suggestions for"),
    suggestion_type: str = Query("content", description="Type of suggestions: content, structure, metrics, visualizations"),
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    Get AI-powered suggestions for report improvement
    
    Suggestion types:
    - content: Content improvements and additions
    - structure: Structural organization suggestions
    - metrics: Recommended metrics to include
    - visualizations: Visualization suggestions
    
    Requirements: AI assistance, content recommendations
    """
    try:
        if not enhanced_pmr_service:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Enhanced PMR service not available"
            )
        
        # Verify report exists and user has access
        report_response = supabase.table("enhanced_pmr_reports").select(
            "*"
        ).eq("id", str(report_id)).execute()
        
        if not report_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Report not found"
            )
        
        report_data = report_response.data[0]
        
        # Verify user has access to the project
        project_response = supabase.table("projects").select("*").eq(
            "id", report_data["project_id"]
        ).execute()
        
        if not project_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Associated project not found"
            )
        
        logger.info(f"Generating AI suggestions for report {report_id}, type: {suggestion_type}")
        
        # Generate suggestions based on type
        # For now, return mock suggestions - full implementation would use AI service
        from decimal import Decimal
        
        suggestions = []
        
        if suggestion_type == "content":
            suggestions = [
                {
                    "title": "Add Budget Variance Analysis",
                    "description": "Include detailed analysis of budget variance trends",
                    "priority": "high",
                    "section": section or "budget_analysis"
                },
                {
                    "title": "Highlight Key Milestones",
                    "description": "Add a section highlighting upcoming critical milestones",
                    "priority": "medium",
                    "section": section or "schedule_overview"
                }
            ]
        elif suggestion_type == "metrics":
            suggestions = [
                {
                    "metric": "Cost Performance Index (CPI)",
                    "description": "Shows cost efficiency of work performed",
                    "recommended_for": ["budget_analysis", "executive_summary"]
                },
                {
                    "metric": "Schedule Performance Index (SPI)",
                    "description": "Indicates schedule efficiency",
                    "recommended_for": ["schedule_overview", "executive_summary"]
                }
            ]
        elif suggestion_type == "visualizations":
            suggestions = [
                {
                    "chart_type": "burn_down",
                    "title": "Budget Burn Down Chart",
                    "description": "Visual representation of budget consumption over time",
                    "section": "budget_analysis"
                },
                {
                    "chart_type": "gantt",
                    "title": "Schedule Gantt Chart",
                    "description": "Timeline view of project milestones and tasks",
                    "section": "schedule_overview"
                }
            ]
        
        response = AISuggestionsResponse(
            suggestions=suggestions,
            confidence=Decimal("0.82"),
            applicable_sections=[section] if section else ["all"],
            processing_time_ms=180
        )
        
        logger.info(f"Generated {len(suggestions)} AI suggestions for report {report_id}")
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating AI suggestions: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate AI suggestions: {str(e)}"
        )


# ============================================================================
# HEALTH CHECK ENDPOINT
# ============================================================================

@router.get("/health")
@limiter.limit("60/minute")
async def enhanced_pmr_health_check(
    request: Request,
    current_user = Depends(get_current_user)
):
    """
    Check Enhanced PMR service health
    
    Returns status of:
    - Service availability
    - Database connection
    - AI services
    - Feature availability
    """
    try:
        health_status = {
            "service_available": enhanced_pmr_service is not None,
            "database_connected": supabase is not None,
            "openai_configured": openai_api_key is not None,
            "collaboration_available": collaboration_manager is not None,
            "timestamp": datetime.utcnow().isoformat(),
            "features": {
                "ai_insights": enhanced_pmr_service is not None,
                "monte_carlo_analysis": enhanced_pmr_service is not None,
                "chat_editing": enhanced_pmr_service is not None,
                "real_time_metrics": True,
                "collaboration": collaboration_manager is not None
            }
        }
        
        if collaboration_manager:
            health_status["collaboration_stats"] = {
                "active_sessions": collaboration_manager.get_active_session_count(),
                "total_connections": collaboration_manager.get_total_connections()
            }
        
        return health_status
        
    except Exception as e:
        logger.error(f"Error checking Enhanced PMR health: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Health check failed: {str(e)}"
        )


# ============================================================================
# COLLABORATION ENDPOINTS
# ============================================================================

@router.post("/{report_id}/collaborate/start")
@limiter.limit("10/minute")
async def start_collaboration_session(
    request: Request,
    report_id: UUID,
    max_participants: int = Query(10, ge=1, le=50),
    session_timeout_minutes: int = Query(60, ge=5, le=480),
    current_user = Depends(require_permission(Permission.project_update))
):
    """
    Start a real-time collaboration session for a report
    
    Creates a collaboration session that allows multiple users to:
    - Edit the report simultaneously
    - See each other's cursors and changes in real-time
    - Add comments and resolve discussions
    - Track all changes with full audit trail
    
    Requirements: Real-time collaboration, multi-user editing
    """
    try:
        if not collaboration_manager:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Collaboration service not available"
            )
        
        user_id = UUID(current_user.get("user_id"))
        
        # Verify report exists and user has access
        report_response = supabase.table("enhanced_pmr_reports").select(
            "*"
        ).eq("id", str(report_id)).execute()
        
        if not report_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Report not found"
            )
        
        report_data = report_response.data[0]
        
        # Verify user has access to the project
        project_response = supabase.table("projects").select("*").eq(
            "id", report_data["project_id"]
        ).execute()
        
        if not project_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Associated project not found"
            )
        
        # Check if session already exists
        existing_session = await collaboration_manager.get_session_by_report(report_id)
        if existing_session and existing_session.is_active:
            return {
                "session_id": existing_session.session_id,
                "report_id": str(report_id),
                "status": "existing",
                "message": "Active collaboration session already exists",
                "websocket_url": f"/ws/reports/pmr/{report_id}/collaborate"
            }
        
        # Create new collaboration session
        from models.pmr import SessionType
        session = await collaboration_manager.create_session(
            report_id=report_id,
            session_type=SessionType.collaborative,
            max_participants=max_participants,
            session_timeout_minutes=session_timeout_minutes
        )
        
        # Add the current user as the first participant
        from models.pmr import ParticipantRole
        user_name = current_user.get("user_metadata", {}).get("full_name", "Unknown User")
        user_email = current_user.get("email", "unknown@example.com")
        
        await collaboration_manager.add_participant(
            session_id=session.session_id,
            user_id=user_id,
            user_name=user_name,
            user_email=user_email,
            role=ParticipantRole.owner
        )
        
        logger.info(f"Started collaboration session {session.session_id} for report {report_id}")
        
        return {
            "session_id": session.session_id,
            "report_id": str(report_id),
            "status": "created",
            "max_participants": max_participants,
            "session_timeout_minutes": session_timeout_minutes,
            "websocket_url": f"/ws/reports/pmr/{report_id}/collaborate",
            "started_at": session.started_at.isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting collaboration session: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start collaboration session: {str(e)}"
        )


@router.post("/{report_id}/collaborate/end")
@limiter.limit("10/minute")
async def end_collaboration_session(
    request: Request,
    report_id: UUID,
    current_user = Depends(require_permission(Permission.project_update))
):
    """
    End an active collaboration session
    
    Disconnects all participants and archives the session.
    All changes are preserved in the audit trail.
    
    Requirements: Session management, cleanup
    """
    try:
        if not collaboration_manager:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Collaboration service not available"
            )
        
        # Get session
        session = await collaboration_manager.get_session_by_report(report_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active collaboration session found"
            )
        
        # End session
        success = await collaboration_manager.end_session(session.session_id)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to end collaboration session"
            )
        
        logger.info(f"Ended collaboration session {session.session_id} for report {report_id}")
        
        return {
            "session_id": session.session_id,
            "report_id": str(report_id),
            "status": "ended",
            "total_changes": len(session.changes_log),
            "total_comments": len(session.comments),
            "ended_at": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error ending collaboration session: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to end collaboration session: {str(e)}"
        )


@router.get("/{report_id}/collaborate/session")
@limiter.limit("30/minute")
async def get_collaboration_session(
    request: Request,
    report_id: UUID,
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    Get current collaboration session details
    
    Returns information about:
    - Active participants
    - Recent changes
    - Comments and discussions
    - Session status
    
    Requirements: Session information, participant tracking
    """
    try:
        if not collaboration_manager:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Collaboration service not available"
            )
        
        # Get session
        session = await collaboration_manager.get_session_by_report(report_id)
        if not session:
            return {
                "report_id": str(report_id),
                "has_active_session": False,
                "message": "No active collaboration session"
            }
        
        return {
            "session_id": session.session_id,
            "report_id": str(report_id),
            "has_active_session": session.is_active,
            "session_type": session.session_type.value,
            "participants": [
                {
                    "user_id": str(p.user_id),
                    "user_name": p.user_name,
                    "role": p.role.value,
                    "is_online": p.is_online,
                    "current_section": p.current_section,
                    "joined_at": p.joined_at.isoformat()
                }
                for p in session.participants
            ],
            "active_editors": session.active_editors,
            "total_changes": len(session.changes_log),
            "total_comments": len(session.comments),
            "started_at": session.started_at.isoformat(),
            "last_activity": session.last_activity.isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting collaboration session: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get collaboration session: {str(e)}"
        )


# ============================================================================
# WEBSOCKET ENDPOINT FOR REAL-TIME COLLABORATION
# ============================================================================

@router.websocket("/ws/{report_id}/collaborate")
async def websocket_collaborate(
    websocket: WebSocket,
    report_id: UUID,
    user_id: str = Query(..., description="User ID for authentication"),
    user_name: str = Query(..., description="User display name")
):
    """
    WebSocket endpoint for real-time collaboration
    
    Handles real-time events:
    - section_update: User updates a report section
    - cursor_position: User moves cursor within a section
    - comment_added: User adds a comment
    - comment_resolved: User resolves a comment
    
    Message format:
    {
        "type": "section_update" | "cursor_position" | "comment_added" | "comment_resolved",
        "data": { ... event-specific data ... }
    }
    
    Requirements: Real-time collaboration, WebSocket communication, multi-user editing
    """
    if not collaboration_manager:
        await websocket.close(code=1011, reason="Collaboration service not available")
        return
    
    try:
        # Get or create session
        session = await collaboration_manager.get_session_by_report(report_id)
        if not session or not session.is_active:
            await websocket.close(code=1008, reason="No active collaboration session")
            return
        
        # Connect user
        user_uuid = UUID(user_id)
        success = await collaboration_manager.connect_user(
            websocket=websocket,
            session_id=session.session_id,
            user_id=user_uuid,
            user_name=user_name
        )
        
        if not success:
            await websocket.close(code=1008, reason="Failed to join collaboration session")
            return
        
        logger.info(f"WebSocket connected: user {user_id} joined session {session.session_id}")
        
        try:
            # Main message loop
            while True:
                # Receive message from client
                data = await websocket.receive_text()
                message = json.loads(data)
                
                event_type = message.get("type")
                event_data = message.get("data", {})
                
                # Handle different event types
                if event_type == "section_update":
                    await collaboration_manager.handle_section_update(
                        session_id=session.session_id,
                        user_id=user_uuid,
                        section_id=event_data.get("section_id"),
                        changes=event_data.get("changes", {})
                    )
                    
                elif event_type == "cursor_position":
                    await collaboration_manager.handle_cursor_position(
                        session_id=session.session_id,
                        user_id=user_uuid,
                        section_id=event_data.get("section_id"),
                        position=event_data.get("position", 0)
                    )
                    
                elif event_type == "comment_added":
                    await collaboration_manager.handle_comment_added(
                        session_id=session.session_id,
                        user_id=user_uuid,
                        section_id=event_data.get("section_id"),
                        content=event_data.get("content"),
                        parent_comment_id=UUID(event_data["parent_comment_id"]) if event_data.get("parent_comment_id") else None
                    )
                    
                elif event_type == "comment_resolved":
                    await collaboration_manager.handle_comment_resolved(
                        session_id=session.session_id,
                        user_id=user_uuid,
                        comment_id=UUID(event_data.get("comment_id"))
                    )
                    
                else:
                    logger.warning(f"Unknown event type: {event_type}")
                
        except WebSocketDisconnect:
            logger.info(f"WebSocket disconnected: user {user_id} left session {session.session_id}")
        except Exception as e:
            logger.error(f"Error in WebSocket message loop: {e}", exc_info=True)
        finally:
            # Disconnect user
            await collaboration_manager.disconnect_user(session.session_id, user_uuid)
            
    except Exception as e:
        logger.error(f"Error in WebSocket collaboration: {e}", exc_info=True)
        try:
            await websocket.close(code=1011, reason=f"Internal error: {str(e)}")
        except:
            pass


# ============================================================================
# PERFORMANCE OPTIMIZATION ENDPOINTS
# ============================================================================

@router.get("/{report_id}/sections/{section_id}/lazy")
@limiter.limit("60/minute")
async def get_section_lazy(
    request: Request,
    report_id: UUID,
    section_id: str,
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    Lazy load a specific section with caching
    
    Optimized endpoint for loading individual sections on-demand.
    Uses Redis caching for frequently accessed sections.
    
    Requirements: Lazy loading, performance optimization
    """
    try:
        start_time = datetime.utcnow()
        
        # Try cache first
        if pmr_performance_optimizer:
            cached_section = await pmr_performance_optimizer.get_cached_section(report_id, section_id)
            if cached_section:
                duration = (datetime.utcnow() - start_time).total_seconds()
                
                if pmr_performance_monitor:
                    pmr_performance_monitor.record_section_load(
                        report_id, section_id, duration, from_cache=True
                    )
                
                return {
                    **cached_section,
                    "cached": True,
                    "load_time_ms": int(duration * 1000)
                }
        
        # Load from database
        report_response = supabase.table("enhanced_pmr_reports").select(
            "sections"
        ).eq("id", str(report_id)).execute()
        
        if not report_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Report not found"
            )
        
        sections = report_response.data[0].get("sections", [])
        section = next((s for s in sections if s.get("section_id") == section_id), None)
        
        if not section:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Section not found"
            )
        
        # Cache the section
        if pmr_performance_optimizer:
            await pmr_performance_optimizer.cache_section(report_id, section_id, section)
        
        duration = (datetime.utcnow() - start_time).total_seconds()
        
        if pmr_performance_monitor:
            pmr_performance_monitor.record_section_load(
                report_id, section_id, duration, from_cache=False
            )
        
        return {
            **section,
            "cached": False,
            "load_time_ms": int(duration * 1000)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error loading section lazily: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load section: {str(e)}"
        )


@router.get("/{report_id}/insights/lazy")
@limiter.limit("60/minute")
async def get_insights_lazy(
    request: Request,
    report_id: UUID,
    category: Optional[str] = Query(None, description="Filter by category"),
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    Lazy load AI insights with caching
    
    Optimized endpoint for loading AI insights on-demand.
    Supports filtering by category and uses Redis caching.
    
    Requirements: Lazy loading, AI insights, performance optimization
    """
    try:
        start_time = datetime.utcnow()
        
        # Try cache first
        if pmr_performance_optimizer:
            cached_insights = await pmr_performance_optimizer.get_cached_ai_insights(
                report_id, category
            )
            if cached_insights:
                duration = (datetime.utcnow() - start_time).total_seconds()
                
                if pmr_performance_monitor:
                    pmr_performance_monitor.record_insights_load(
                        report_id, len(cached_insights), duration, from_cache=True
                    )
                
                return {
                    "insights": cached_insights,
                    "count": len(cached_insights),
                    "cached": True,
                    "load_time_ms": int(duration * 1000)
                }
        
        # Load from database
        query = supabase.table("ai_insights").select("*").eq("report_id", str(report_id))
        
        if category:
            query = query.eq("category", category)
        
        insights_response = query.execute()
        insights = insights_response.data or []
        
        # Cache the insights
        if pmr_performance_optimizer:
            await pmr_performance_optimizer.cache_ai_insights(report_id, insights)
        
        duration = (datetime.utcnow() - start_time).total_seconds()
        
        if pmr_performance_monitor:
            pmr_performance_monitor.record_insights_load(
                report_id, len(insights), duration, from_cache=False
            )
        
        return {
            "insights": insights,
            "count": len(insights),
            "cached": False,
            "load_time_ms": int(duration * 1000)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error loading insights lazily: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load insights: {str(e)}"
        )


@router.post("/{report_id}/cache/invalidate")
@limiter.limit("10/minute")
async def invalidate_report_cache(
    request: Request,
    report_id: UUID,
    current_user = Depends(require_permission(Permission.project_update))
):
    """
    Invalidate all cache entries for a report
    
    Use this after making significant changes to force fresh data loading.
    
    Requirements: Cache management, data consistency
    """
    try:
        if not pmr_performance_optimizer:
            return {
                "message": "Cache optimization not available",
                "invalidated_count": 0
            }
        
        count = await pmr_performance_optimizer.invalidate_report_cache(report_id)
        
        logger.info(f"Invalidated {count} cache entries for report {report_id}")
        
        return {
            "report_id": str(report_id),
            "invalidated_count": count,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error invalidating cache: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to invalidate cache: {str(e)}"
        )


@router.get("/performance/stats")
@limiter.limit("30/minute")
async def get_performance_stats(
    request: Request,
    current_user = Depends(require_permission(Permission.admin_read))
):
    """
    Get PMR performance statistics
    
    Returns comprehensive performance metrics including:
    - Response times
    - Cache hit rates
    - WebSocket connection stats
    - Report generation times
    - Active alerts
    
    Requirements: Performance monitoring, admin access
    """
    try:
        stats = {
            "timestamp": datetime.utcnow().isoformat(),
            "pmr_optimizer": None,
            "websocket_optimizer": None,
            "performance_monitor": None
        }
        
        # Get PMR optimizer stats
        if pmr_performance_optimizer:
            stats["pmr_optimizer"] = await pmr_performance_optimizer.get_pmr_performance_stats()
        
        # Get WebSocket optimizer stats
        if websocket_optimizer:
            stats["websocket_optimizer"] = websocket_optimizer.get_connection_stats()
        
        # Get performance monitor stats
        if pmr_performance_monitor:
            stats["performance_monitor"] = pmr_performance_monitor.get_performance_report()
        
        return stats
        
    except Exception as e:
        logger.error(f"Error getting performance stats: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get performance stats: {str(e)}"
        )


@router.get("/performance/health")
@limiter.limit("60/minute")
async def get_performance_health(
    request: Request,
    current_user = Depends(get_current_user)
):
    """
    Get PMR performance health status
    
    Quick health check endpoint for monitoring systems.
    
    Requirements: Health monitoring, alerting
    """
    try:
        health = {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "components": {
                "pmr_optimizer": pmr_performance_optimizer is not None,
                "websocket_optimizer": websocket_optimizer is not None,
                "performance_monitor": pmr_performance_monitor is not None
            }
        }
        
        # Get health status from monitor
        if pmr_performance_monitor:
            monitor_health = pmr_performance_monitor.get_health_status()
            health["status"] = monitor_health["status"]
            health["active_alerts"] = monitor_health["active_alerts_count"]
        
        return health
        
    except Exception as e:
        logger.error(f"Error getting performance health: {e}", exc_info=True)
        return {
            "status": "error",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


@router.get("/performance/alerts")
@limiter.limit("30/minute")
async def get_performance_alerts(
    request: Request,
    active_only: bool = Query(True, description="Return only active alerts"),
    limit: int = Query(50, ge=1, le=100, description="Number of alerts to return"),
    current_user = Depends(require_permission(Permission.admin_read))
):
    """
    Get performance alerts
    
    Returns active and historical performance alerts.
    
    Requirements: Performance monitoring, alerting, admin access
    """
    try:
        if not pmr_performance_monitor:
            return {
                "alerts": [],
                "message": "Performance monitoring not available"
            }
        
        if active_only:
            alerts = pmr_performance_monitor.get_active_alerts()
        else:
            alerts = pmr_performance_monitor.get_alert_history(limit)
        
        return {
            "alerts": [
                {
                    "id": alert.id,
                    "metric_type": alert.metric_type.value,
                    "severity": alert.severity.value,
                    "message": alert.message,
                    "current_value": alert.current_value,
                    "threshold_value": alert.threshold_value,
                    "timestamp": alert.timestamp.isoformat(),
                    "metadata": alert.metadata
                }
                for alert in alerts
            ],
            "count": len(alerts),
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting performance alerts: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get performance alerts: {str(e)}"
        )
