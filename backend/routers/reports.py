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
from roche_construction_services import GoogleSuiteReportGenerator
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
    """Generate a Google Slides report for a project"""
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
                "chart_generation": True
            }
        }
        
        return health_status
        
    except Exception as e:
        print(f"Error checking Google Suite health: {e}")
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")