"""
Shareable URL endpoints for Roche Construction PPM Features
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from uuid import UUID
from typing import List, Optional
from datetime import datetime

from auth.rbac import require_permission, Permission
from auth.dependencies import get_current_user
from config.database import supabase
from config.settings import settings
from models.roche_construction import (
    ShareableURLCreate,
    ShareableURLResponse,
    ShareableURLValidation
)
from services.roche_construction_services import ShareableURLService
from services.roche_audit_service import audit_service, AuditEventType

router = APIRouter(prefix="/projects", tags=["shareable-urls"])

# Initialize service
shareable_url_service = None
if supabase and settings.SECRET_KEY:
    shareable_url_service = ShareableURLService(supabase, settings.SECRET_KEY)


@router.post("/{project_id}/share", response_model=ShareableURLResponse, status_code=201)
async def create_shareable_url(
    project_id: UUID,
    url_data: ShareableURLCreate,
    current_user = Depends(require_permission(Permission.shareable_url_create))
):
    """
    Generate a new shareable URL for a project with embedded permissions.
    
    This endpoint creates a secure, time-limited URL that can be shared with
    external stakeholders without requiring full system accounts.
    
    **Requirements**: 1.1, 1.2, 1.3, 9.1
    """
    try:
        if not shareable_url_service:
            raise HTTPException(
                status_code=503, 
                detail="Shareable URL service unavailable - missing configuration"
            )
        
        # Verify project exists and user has access
        project_result = supabase.table("projects").select("id").eq(
            "id", str(project_id)
        ).execute()
        
        if not project_result.data:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Validate that project_id in URL matches project_id in body
        if url_data.project_id != project_id:
            raise HTTPException(
                status_code=400, 
                detail="Project ID in URL does not match project ID in request body"
            )
        
        # Get user ID from current_user
        user_id = UUID(current_user.get("user_id"))
        
        # Generate shareable URL
        shareable_url = await shareable_url_service.generate_shareable_url(
            project_id=project_id,
            permissions=url_data.permissions,
            expiration=url_data.expires_at,
            user_id=user_id,
            description=url_data.description
        )
        
        # Log audit event
        await audit_service.log_shareable_url_event(
            event_type=AuditEventType.SHAREABLE_URL_CREATED,
            url_id=UUID(shareable_url.id),
            user_id=user_id,
            project_id=project_id,
            permissions=url_data.permissions.dict()
        )
        
        return shareable_url
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to create shareable URL: {str(e)}"
        )


@router.get("/shared/{token}", response_model=ShareableURLValidation)
async def validate_shareable_url(token: str, request: Request):
    """
    Validate a shareable URL token and return access permissions.
    
    This endpoint validates the token, checks expiration, and returns the
    embedded permissions if the URL is valid. It also logs the access attempt
    for audit purposes.
    
    **Requirements**: 1.2, 1.4, 1.5
    """
    try:
        if not shareable_url_service:
            raise HTTPException(
                status_code=503, 
                detail="Shareable URL service unavailable - missing configuration"
            )
        
        # Validate the token
        validation_result = await shareable_url_service.validate_shareable_url(token)
        
        # Log access attempt (audit requirement 1.5)
        if validation_result.is_valid:
            try:
                # Extract client information for audit log
                client_ip = request.client.host if request.client else None
                user_agent = request.headers.get("user-agent")
                referer = request.headers.get("referer")
                
                # Log the access
                log_data = {
                    "shareable_url_token": token,
                    "accessed_at": datetime.now().isoformat(),
                    "ip_address": client_ip,
                    "user_agent": user_agent,
                    "referer": referer,
                    "access_granted": True,
                    "sections_accessed": []
                }
                
                # Store access log (best effort - don't fail validation if logging fails)
                try:
                    supabase.table("shareable_url_access_log").insert(log_data).execute()
                except Exception as log_error:
                    print(f"Warning: Failed to log shareable URL access: {log_error}")
                    
            except Exception as audit_error:
                print(f"Warning: Failed to create audit log: {audit_error}")
        else:
            # Log failed access attempt
            try:
                client_ip = request.client.host if request.client else None
                log_data = {
                    "shareable_url_token": token,
                    "accessed_at": datetime.now().isoformat(),
                    "ip_address": client_ip,
                    "access_granted": False,
                    "denial_reason": validation_result.error_message
                }
                supabase.table("shareable_url_access_log").insert(log_data).execute()
            except Exception as log_error:
                print(f"Warning: Failed to log failed access attempt: {log_error}")
        
        return validation_result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to validate shareable URL: {str(e)}"
        )


@router.delete("/shared/{url_id}", status_code=204)
async def revoke_shareable_url(
    url_id: UUID,
    current_user = Depends(require_permission(Permission.shareable_url_revoke))
):
    """
    Revoke a shareable URL to prevent further access.
    
    This endpoint marks a shareable URL as revoked, preventing any future
    access attempts even if the URL has not expired.
    
    **Requirements**: 1.4
    """
    try:
        if not shareable_url_service:
            raise HTTPException(
                status_code=503, 
                detail="Shareable URL service unavailable - missing configuration"
            )
        
        # Get user ID from current_user
        user_id = UUID(current_user.get("user_id"))
        
        # Verify the URL exists and user has permission to revoke it
        url_result = supabase.table("shareable_urls").select("*").eq(
            "id", str(url_id)
        ).execute()
        
        if not url_result.data:
            raise HTTPException(status_code=404, detail="Shareable URL not found")
        
        url_data = url_result.data[0]
        
        # Check if user has permission to revoke (must be creator or have project access)
        project_id = UUID(url_data["project_id"])
        project_result = supabase.table("projects").select("id").eq(
            "id", str(project_id)
        ).execute()
        
        if not project_result.data:
            raise HTTPException(
                status_code=403, 
                detail="You do not have permission to revoke this URL"
            )
        
        # Revoke the URL
        success = await shareable_url_service.revoke_shareable_url(url_id, user_id)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to revoke shareable URL")
        
        return None  # 204 No Content
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to revoke shareable URL: {str(e)}"
        )


@router.get("/{project_id}/shared-urls", response_model=List[ShareableURLResponse])
async def list_project_shareable_urls(
    project_id: UUID,
    current_user = Depends(require_permission(Permission.shareable_url_read))
):
    """
    List all shareable URLs for a project.
    
    This endpoint returns all shareable URLs (both active and revoked) for a
    project, allowing project managers to track and manage external access.
    
    **Requirements**: 1.5
    """
    try:
        if not shareable_url_service:
            raise HTTPException(
                status_code=503, 
                detail="Shareable URL service unavailable - missing configuration"
            )
        
        # Verify project exists and user has access
        project_result = supabase.table("projects").select("id").eq(
            "id", str(project_id)
        ).execute()
        
        if not project_result.data:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Get all shareable URLs for the project
        shareable_urls = await shareable_url_service.list_project_shareable_urls(project_id)
        
        return shareable_urls
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to list shareable URLs: {str(e)}"
        )
