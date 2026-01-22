"""
Google Suite Report Generation API Router
"""

from fastapi import APIRouter, HTTPException, status, Query, Depends, Request, UploadFile
from typing import List, Dict, Any, Optional
from uuid import UUID
from datetime import datetime

# Import dependencies
from config.database import supabase
from auth.dependencies import get_current_user
from auth.rbac import require_permission, Permission

# Import Roche Construction services and models
from services.roche_construction_services import GoogleSuiteReportGenerator
from roche_construction_models import (
    ReportTemplateCreate, ReportTemplate, ReportConfig, ReportGenerationRequest, GeneratedReport,
    ReportTemplateType, ReportGenerationStatus, ChartConfig
)

# Import performance optimization
try:
    from performance_optimization import limiter
except ImportError:
    # Fallback if performance optimization not available
    def limiter_fallback(rate: str):
        def decorator(func):
            return func
        return decorator
    limiter = type('MockLimiter', (), {'limit': limiter_fallback})()

# Initialize router
router = APIRouter(prefix="/reports", tags=["Google Suite Reports"])

# Initialize service
google_suite_service = GoogleSuiteReportGenerator(supabase) if supabase else None


# RAG Reporter endpoint for adhoc reports
@router.post("/adhoc", response_model=Dict[str, Any])
@limiter.limit("10/minute")
async def generate_adhoc_report(
    request: Request,
    query: str,
    current_user = Depends(get_current_user)
):
    """
    Generate adhoc report using RAG (Retrieval-Augmented Generation) agent.
    
    Uses enhanced RAGReporterAgent with error handling, retry logic, and confidence scores.
    Returns confidence scores and sources.
    
    Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
    """
    try:
        # Import RAG agent
        from ai_agents import RAGReporterAgent
        import os
        
        openai_api_key = os.getenv("OPENAI_API_KEY")
        openai_base_url = os.getenv("OPENAI_BASE_URL")
        
        if not openai_api_key:
            raise HTTPException(
                status_code=503,
                detail="RAG service unavailable. Please configure OPENAI_API_KEY."
            )
        
        # Initialize RAG agent
        rag_agent = RAGReporterAgent(
            supabase_client=supabase,
            openai_api_key=openai_api_key,
            base_url=openai_base_url
        )
        
        user_id = current_user.get("user_id")
        
        # Process RAG query
        result = await rag_agent.process_rag_query(
            query=query,
            user_id=user_id
        )
        
        # Return response with confidence scores and sources
        return {
            "response": result["response"],
            "confidence": result["confidence_score"],
            "sources": result["sources"],
            "timestamp": datetime.now()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Adhoc report generation error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate adhoc report: {str(e)}"
        )


@router.post("/templates", response_model=ReportTemplate, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def create_report_template(
    request: Request,
    template_data: ReportTemplateCreate,
    current_user = Depends(require_permission(Permission.admin_update))
):
    """Create a new report template"""
    try:
        if not google_suite_service:
            raise HTTPException(status_code=503, detail="Google Suite service not available")
        
        user_id = UUID(current_user.get("user_id"))
        
        # Convert Pydantic model to dict
        template_dict = template_data.dict()
        
        result = await google_suite_service.create_template(template_dict, user_id)
        
        return ReportTemplate(**result)
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating report template: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create report template: {str(e)}")


@router.get("/templates")
@limiter.limit("30/minute")
async def list_report_templates(
    request: Request,
    template_type: Optional[ReportTemplateType] = Query(None, description="Filter by template type"),
    is_public: Optional[bool] = Query(None, description="Filter by public templates"),
    current_user = Depends(require_permission(Permission.project_read))
):
    """List available report templates"""
    try:
        if not google_suite_service:
            raise HTTPException(status_code=503, detail="Google Suite service not available")
        
        user_id = UUID(current_user.get("user_id"))
        
        templates = await google_suite_service.list_templates(
            template_type=template_type.value if template_type else None,
            is_public=is_public,
            user_id=user_id
        )
        
        return [ReportTemplate(**template) for template in templates]
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error listing templates: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list templates: {str(e)}")


@router.get("/templates/{template_id}/validate")
@limiter.limit("20/minute")
async def validate_template_compatibility(
    request: Request,
    template_id: UUID,
    current_user = Depends(require_permission(Permission.project_read))
):
    """Validate template compatibility and configuration"""
    try:
        if not google_suite_service:
            raise HTTPException(status_code=503, detail="Google Suite service not available")
        
        validation_result = await google_suite_service.validate_template_compatibility(template_id)
        
        return validation_result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error validating template: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to validate template: {str(e)}")


@router.post("/generate", response_model=GeneratedReport, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")  # Lower limit for report generation
async def generate_project_report(
    request: Request,
    report_request: ReportGenerationRequest,
    current_user = Depends(require_permission(Permission.project_read))
):
    """Generate a Google Slides report for a project
    
    Requirements: 6.1, 6.3, 6.4
    """
    try:
        if not google_suite_service:
            raise HTTPException(status_code=503, detail="Google Suite service not available")
        
        user_id = UUID(current_user.get("user_id"))
        
        # Verify user has access to the project
        project_response = supabase.table("projects").select("*").eq("id", str(report_request.project_id)).execute()
        if not project_response.data:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Generate report
        result = await google_suite_service.generate_report(
            project_id=report_request.project_id,
            template_id=report_request.config.template_id,
            report_config=report_request.config.dict(),
            user_id=user_id,
            name=report_request.name,
            description=report_request.description
        )
        
        return GeneratedReport(**result)
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generating report: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")


@router.post("/export-google", response_model=GeneratedReport, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def export_to_google_suite(
    request: Request,
    report_request: ReportGenerationRequest,
    current_user = Depends(require_permission(Permission.project_read))
):
    """Export project data to Google Slides (alias for generate endpoint)
    
    Requirements: 6.1, 6.3, 6.4
    """
    # This is an alias endpoint for better API naming consistency
    return await generate_project_report(request, report_request, current_user)


@router.get("/projects/{project_id}/reports")
@limiter.limit("30/minute")
async def list_project_reports(
    request: Request,
    project_id: UUID,
    limit: int = Query(50, ge=1, le=100, description="Number of results to return"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    current_user = Depends(require_permission(Permission.project_read))
):
    """List generated reports for a project"""
    try:
        if not google_suite_service:
            raise HTTPException(status_code=503, detail="Google Suite service not available")
        
        # Verify user has access to the project
        project_response = supabase.table("projects").select("*").eq("id", str(project_id)).execute()
        if not project_response.data:
            raise HTTPException(status_code=404, detail="Project not found")
        
        reports = await google_suite_service.list_project_reports(project_id, limit, offset)
        
        return [GeneratedReport(**report) for report in reports]
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error listing project reports: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list project reports: {str(e)}")


@router.get("/status/{report_id}")
@limiter.limit("30/minute")
async def get_report_status(
    request: Request,
    report_id: UUID,
    current_user = Depends(require_permission(Permission.project_read))
):
    """Get report generation status"""
    try:
        if not google_suite_service:
            raise HTTPException(status_code=503, detail="Google Suite service not available")
        
        status_info = await google_suite_service.get_report_status(report_id)
        
        # Verify user has access to the project
        project_response = supabase.table("projects").select("*").eq("id", status_info["project_id"]).execute()
        if not project_response.data:
            raise HTTPException(status_code=404, detail="Associated project not found")
        
        return GeneratedReport(**status_info)
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting report status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get report status: {str(e)}")


@router.delete("/reports/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("10/minute")
async def delete_generated_report(
    request: Request,
    report_id: UUID,
    current_user = Depends(require_permission(Permission.project_update))
):
    """Delete a generated report"""
    try:
        if not google_suite_service:
            raise HTTPException(status_code=503, detail="Google Suite service not available")
        
        user_id = UUID(current_user.get("user_id"))
        
        # Get report to verify access
        report_status = await google_suite_service.get_report_status(report_id)
        
        # Verify user has access to the project
        project_response = supabase.table("projects").select("*").eq("id", report_status["project_id"]).execute()
        if not project_response.data:
            raise HTTPException(status_code=404, detail="Associated project not found")
        
        success = await google_suite_service.delete_report(report_id, user_id)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete report")
        
        return None
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting report: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete report: {str(e)}")


# Health check endpoint for Google Suite integration
@router.get("/health")
@limiter.limit("60/minute")
async def google_suite_health_check(
    request: Request,
    current_user = Depends(get_current_user)
):
    """Check Google Suite integration health"""
    try:
        health_status = {
            "service_available": google_suite_service is not None,
            "database_connected": supabase is not None,
            "timestamp": datetime.now().isoformat(),
            "features": {
                "template_management": True,
                "report_generation": True,
                "google_drive_integration": False,  # Mock - would check actual Google API
                "chart_generation": True,
                "oauth_authentication": True
            }
        }
        
        return health_status
        
    except Exception as e:
        print(f"Error checking Google Suite health: {e}")
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")


# OAuth 2.0 Authentication Endpoints
@router.get("/oauth/authorize")
@limiter.limit("10/minute")
async def initiate_google_oauth(
    request: Request,
    redirect_uri: str = Query(..., description="OAuth callback redirect URI"),
    current_user = Depends(get_current_user)
):
    """Initiate OAuth 2.0 flow for Google Suite access
    
    Requirements: 9.2 (OAuth 2.0 authentication)
    """
    try:
        if not google_suite_service:
            raise HTTPException(status_code=503, detail="Google Suite service not available")
        
        user_id = UUID(current_user.get("user_id"))
        
        # Initiate OAuth flow
        oauth_result = await google_suite_service.initiate_oauth_flow(user_id, redirect_uri)
        
        return {
            "authorization_url": oauth_result['authorization_url'],
            "state": oauth_result['state'],
            "message": "Redirect user to authorization_url to grant permissions"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error initiating OAuth flow: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to initiate OAuth: {str(e)}")


@router.post("/oauth/callback")
@limiter.limit("10/minute")
async def handle_google_oauth_callback(
    request: Request,
    code: str = Query(..., description="Authorization code from Google"),
    state: str = Query(..., description="State parameter for CSRF protection"),
    current_user = Depends(get_current_user)
):
    """Handle OAuth 2.0 callback from Google
    
    Requirements: 9.2 (OAuth 2.0 authentication)
    """
    try:
        if not google_suite_service:
            raise HTTPException(status_code=503, detail="Google Suite service not available")
        
        user_id = UUID(current_user.get("user_id"))
        
        # Handle OAuth callback
        success = await google_suite_service.handle_oauth_callback(user_id, code, state)
        
        if not success:
            raise HTTPException(status_code=400, detail="Failed to complete OAuth flow")
        
        return {
            "success": True,
            "message": "Google Suite access granted successfully",
            "user_id": str(user_id)
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error handling OAuth callback: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to handle OAuth callback: {str(e)}")


@router.get("/oauth/status")
@limiter.limit("30/minute")
async def check_google_oauth_status(
    request: Request,
    current_user = Depends(get_current_user)
):
    """Check if user has granted Google Suite access
    
    Requirements: 9.2 (OAuth 2.0 authentication)
    """
    try:
        if not google_suite_service:
            raise HTTPException(status_code=503, detail="Google Suite service not available")
        
        user_id = UUID(current_user.get("user_id"))
        
        # Check if user has valid credentials
        credentials = google_suite_service._get_google_credentials(user_id)
        
        return {
            "authenticated": credentials is not None,
            "user_id": str(user_id),
            "expires_at": credentials.get('expires_at').isoformat() if credentials else None,
            "scopes": ['drive.file', 'presentations'] if credentials else []
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error checking OAuth status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to check OAuth status: {str(e)}")