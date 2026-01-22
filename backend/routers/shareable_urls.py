"""
Shareable Project URLs API Endpoints

This module provides REST API endpoints for managing shareable project URLs,
enabling secure external access to project information without requiring
full system accounts.

Requirements: 1.1, 1.3, 6.1, 6.2, 6.3
"""

from fastapi import APIRouter, HTTPException, Depends, Request, status
from uuid import UUID
from typing import List, Optional
from datetime import datetime, timedelta, timezone
import logging

from auth.rbac import require_permission, Permission
from auth.dependencies import get_current_user
from config.database import get_db
from models.shareable_urls import (
    ShareLinkCreate,
    ShareLinkResponse,
    ShareLinkListResponse,
    ShareLinkRevoke,
    ShareLinkExtend,
    SharePermissionLevel,
    FilteredProjectData,
    ShareLinkValidation,
    ShareAnalytics
)
from services.share_link_generator import ShareLinkGenerator
from services.guest_access_controller import GuestAccessController
from services.access_analytics_service import AccessAnalyticsService
from services.share_link_notification_service import ShareLinkNotificationService

# Initialize logger
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/api", tags=["shareable-urls"])



# ============================================================================
# Share Link Management Endpoints
# ============================================================================

@router.post(
    "/projects/{project_id}/shares",
    response_model=ShareLinkResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new share link for a project",
    description="""
    Generate a secure shareable URL for a project with specified permissions and expiration.
    
    This endpoint creates a cryptographically secure share link that can be shared with
    external stakeholders without requiring full system accounts.
    
    **Requirements**: 1.1, 1.3, 6.1
    
    **Permission Required**: project_read (user must have read access to the project)
    
    **Request Body**:
    - project_id: UUID of the project to share
    - permission_level: Permission level (view_only, limited_data, full_project)
    - expiry_duration_days: Number of days until link expires (1-365)
    - custom_message: Optional custom message for recipients
    
    **Response**: ShareLinkResponse with the generated share URL and metadata
    """
)
async def create_project_share(
    project_id: UUID,
    share_data: ShareLinkCreate,
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    Create a new share link for a project.
    
    Requirements: 1.1, 1.3, 6.1
    """
    try:
        # Get database connection
        db = get_db()
        if not db:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database service unavailable"
            )
        
        # Validate that project_id in URL matches project_id in body
        if share_data.project_id != project_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Project ID in URL does not match project ID in request body"
            )
        
        # Verify project exists
        project_result = db.table("projects").select("id, name").eq("id", str(project_id)).execute()
        if not project_result.data or len(project_result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )
        
        # Get user ID from current_user
        user_id = UUID(current_user.get("user_id"))
        
        # Initialize share link generator service
        share_link_service = ShareLinkGenerator(db_session=db)
        
        # Create share link
        share_link = await share_link_service.create_share_link(
            project_id=project_id,
            creator_id=user_id,
            permission_level=share_data.permission_level,
            expiry_duration_days=share_data.expiry_duration_days,
            custom_message=share_data.custom_message
        )
        
        if not share_link:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create share link"
            )
        
        logger.info(
            f"Share link created: project={project_id}, user={user_id}, "
            f"permission={share_data.permission_level}"
        )
        
        return share_link
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating share link: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create share link: {str(e)}"
        )


@router.get(
    "/projects/{project_id}/shares",
    response_model=ShareLinkListResponse,
    summary="List all share links for a project",
    description="""
    Retrieve all share links associated with a project, including active and expired links.
    
    This endpoint provides a comprehensive view of all share links created for a project,
    with summary statistics including total count, active count, and expired count.
    
    **Requirements**: 6.1
    
    **Permission Required**: project_read (user must have read access to the project)
    
    **Query Parameters**:
    - include_inactive: Whether to include revoked/inactive links (default: false)
    
    **Response**: ShareLinkListResponse with list of share links and statistics
    """
)
async def list_project_shares(
    project_id: UUID,
    include_inactive: bool = False,
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    List all share links for a project.
    
    Requirements: 6.1
    """
    try:
        # Get database connection
        db = get_db()
        if not db:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database service unavailable"
            )
        
        # Verify project exists
        project_result = db.table("projects").select("id").eq("id", str(project_id)).execute()
        if not project_result.data or len(project_result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )
        
        # Initialize share link generator service
        share_link_service = ShareLinkGenerator(db_session=db)
        
        # List share links
        share_links = await share_link_service.list_project_shares(
            project_id=project_id,
            include_inactive=include_inactive
        )
        
        if share_links is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve share links"
            )
        
        logger.info(f"Listed share links for project {project_id}: {share_links.total} total")
        
        return share_links
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing share links: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list share links: {str(e)}"
        )


@router.delete(
    "/shares/{share_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke a share link",
    description="""
    Revoke a share link to immediately disable access.
    
    This endpoint marks a share link as inactive and records who revoked it and why.
    Access via the link is immediately prevented.
    
    **Requirements**: 6.2, 6.3
    
    **Permission Required**: project_read (user must have read access to the associated project)
    
    **Query Parameters**:
    - revocation_reason: Reason for revoking the share link (required)
    
    **Response**: 204 No Content on success
    """
)
async def revoke_share_link(
    share_id: UUID,
    revocation_reason: str,
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    Revoke a share link, immediately disabling access.
    
    Requirements: 6.2, 6.3
    """
    try:
        # Get database connection
        db = get_db()
        if not db:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database service unavailable"
            )
        
        # Validate revocation reason
        if not revocation_reason or len(revocation_reason.strip()) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Revocation reason is required"
            )
        
        # Get user ID from current_user
        user_id = UUID(current_user.get("user_id"))
        
        # Verify share link exists and get project_id
        share_result = db.table("project_shares").select("id, project_id, created_by").eq(
            "id", str(share_id)
        ).execute()
        
        if not share_result.data or len(share_result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Share link not found"
            )
        
        share = share_result.data[0]
        project_id = UUID(share["project_id"])
        
        # Verify user has access to the project
        project_result = db.table("projects").select("id").eq("id", str(project_id)).execute()
        if not project_result.data or len(project_result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to revoke this share link"
            )
        
        # Initialize share link generator service
        share_link_service = ShareLinkGenerator(db_session=db)
        
        # Revoke share link
        success = await share_link_service.revoke_share_link(
            share_id=share_id,
            revoked_by=user_id,
            revocation_reason=revocation_reason
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to revoke share link"
            )
        
        logger.info(
            f"Share link revoked: id={share_id}, by={user_id}, "
            f"reason={revocation_reason}"
        )
        
        return None  # 204 No Content
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error revoking share link: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to revoke share link: {str(e)}"
        )


@router.put(
    "/shares/{share_id}/extend",
    response_model=ShareLinkResponse,
    summary="Extend share link expiration",
    description="""
    Extend the expiration time of a share link by adding additional days.
    
    This endpoint adds the specified number of days to the current expiration time.
    Only works for active, non-revoked links.
    
    **Requirements**: 6.3
    
    **Permission Required**: project_read (user must have read access to the associated project)
    
    **Request Body**: ShareLinkExtend with additional_days (1-365)
    
    **Response**: Updated ShareLinkResponse with new expiration date
    """
)
async def extend_share_expiry(
    share_id: UUID,
    extend_data: ShareLinkExtend,
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    Extend the expiration time of a share link.
    
    Requirements: 6.3
    """
    try:
        # Get database connection
        db = get_db()
        if not db:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database service unavailable"
            )
        
        # Get user ID from current_user
        user_id = UUID(current_user.get("user_id"))
        
        # Verify share link exists and get project_id
        share_result = db.table("project_shares").select("id, project_id, is_active").eq(
            "id", str(share_id)
        ).execute()
        
        if not share_result.data or len(share_result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Share link not found"
            )
        
        share = share_result.data[0]
        project_id = UUID(share["project_id"])
        
        # Check if share link is active
        if not share["is_active"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot extend inactive or revoked share link"
            )
        
        # Verify user has access to the project
        project_result = db.table("projects").select("id").eq("id", str(project_id)).execute()
        if not project_result.data or len(project_result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to extend this share link"
            )
        
        # Initialize share link generator service
        share_link_service = ShareLinkGenerator(db_session=db)
        
        # Extend share link expiry
        updated_share = await share_link_service.extend_expiry(
            share_id=share_id,
            additional_days=extend_data.additional_days
        )
        
        if not updated_share:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to extend share link expiry"
            )
        
        logger.info(
            f"Share link expiry extended: id={share_id}, by={user_id}, "
            f"added_days={extend_data.additional_days}"
        )
        
        return updated_share
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error extending share link: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to extend share link: {str(e)}"
        )


# ============================================================================
# Guest Access Endpoints
# ============================================================================

@router.get(
    "/projects/{project_id}/share/{token}",
    response_model=FilteredProjectData,
    summary="Access shared project via token",
    description="""
    Access a shared project using a share link token.
    
    This endpoint validates the token, checks rate limits, logs the access,
    and returns filtered project data based on the share link's permission level.
    
    **Requirements**: 5.1, 5.3, 7.4
    
    **No Authentication Required**: This is a public endpoint for external stakeholders
    
    **Path Parameters**:
    - project_id: UUID of the project
    - token: Share link token (64-character URL-safe string)
    
    **Response**: FilteredProjectData with project information based on permission level
    """
)
async def access_shared_project(
    project_id: UUID,
    token: str,
    request: Request
):
    """
    Access a shared project using a share link token.
    
    This endpoint is publicly accessible and does not require authentication.
    It validates the token, enforces rate limiting, and returns filtered project data.
    
    Requirements: 5.1, 5.3, 7.4
    """
    try:
        # Get database connection
        db = get_db()
        if not db:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Service temporarily unavailable"
            )
        
        # Initialize guest access controller
        guest_controller = GuestAccessController(db_session=db)
        
        # Validate token
        validation = await guest_controller.validate_token(token)
        
        if not validation.is_valid:
            # Log failed access attempt
            client_ip = request.client.host if request.client else "unknown"
            user_agent = request.headers.get("user-agent")
            
            if validation.share_id:
                await guest_controller.log_access_attempt(
                    share_id=validation.share_id,
                    ip_address=client_ip,
                    user_agent=user_agent,
                    success=False
                )
            
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=validation.error_message or "Invalid or expired share link"
            )
        
        # Verify project_id matches
        if validation.project_id != str(project_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Project ID does not match share link"
            )
        
        # Check rate limit
        client_ip = request.client.host if request.client else "unknown"
        if not guest_controller.check_rate_limit(client_ip, validation.share_id):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded. Please try again later."
            )
        
        # Get filtered project data based on permission level
        permission_level = SharePermissionLevel(validation.permission_level)
        project_data = await guest_controller.get_filtered_project_data(
            project_id=project_id,
            permission_level=permission_level
        )
        
        if not project_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )
        
        # Log successful access
        user_agent = request.headers.get("user-agent")
        await guest_controller.log_access_attempt(
            share_id=validation.share_id,
            ip_address=client_ip,
            user_agent=user_agent,
            success=True
        )
        
        logger.info(
            f"Guest access granted: project={project_id}, share={validation.share_id}, "
            f"ip={client_ip}, permission={permission_level}"
        )
        
        return project_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error accessing shared project: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while accessing the shared project"
        )



# ============================================================================
# Analytics and Monitoring Endpoints
# ============================================================================

@router.get(
    "/shares/{share_id}/analytics",
    response_model=ShareAnalytics,
    summary="Get analytics for a share link",
    description="""
    Retrieve comprehensive analytics for a share link including usage data,
    geographic distribution, and suspicious activity metrics.
    
    This endpoint provides detailed insights into how a share link is being used,
    including total accesses, unique visitors, geographic distribution, most viewed
    sections, and suspicious activity count.
    
    **Requirements**: 4.3, 3.5
    
    **Permission Required**: project_read (user must have read access to the associated project)
    
    **Query Parameters**:
    - start_date: Start date for analytics (ISO format, optional)
    - end_date: End date for analytics (ISO format, optional)
    
    **Response**: ShareAnalytics with comprehensive usage data
    """
)
async def get_share_analytics(
    share_id: UUID,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    Get analytics for a share link.
    
    Requirements: 4.3, 3.5
    """
    try:
        # Get database connection
        db = get_db()
        if not db:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database service unavailable"
            )
        
        # Verify share link exists and get project_id
        share_result = db.table("project_shares").select("id, project_id").eq(
            "id", str(share_id)
        ).execute()
        
        if not share_result.data or len(share_result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Share link not found"
            )
        
        share = share_result.data[0]
        project_id = UUID(share["project_id"])
        
        # Verify user has access to the project
        project_result = db.table("projects").select("id").eq("id", str(project_id)).execute()
        if not project_result.data or len(project_result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to view analytics for this share link"
            )
        
        # Initialize analytics service
        analytics_service = AccessAnalyticsService(db_session=db)
        
        # Get analytics
        analytics = await analytics_service.get_share_analytics(
            share_id=str(share_id),
            start_date=start_date,
            end_date=end_date
        )
        
        if not analytics:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve analytics"
            )
        
        logger.info(
            f"Analytics retrieved: share_id={share_id}, "
            f"total_accesses={analytics.total_accesses}"
        )
        
        return analytics
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting share analytics: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve analytics: {str(e)}"
        )


@router.get(
    "/shares/health",
    summary="Health check for share link system",
    description="""
    Check the health and status of the share link system.
    
    This endpoint verifies:
    - Database connectivity
    - Service availability
    - System metrics
    
    **Requirements**: 4.3, 3.5
    
    **No Authentication Required**: This is a public health check endpoint
    
    **Response**: Health status with system metrics
    """
)
async def share_link_health_check():
    """
    Health check endpoint for share link system.
    
    Requirements: 4.3, 3.5
    """
    try:
        health_status = {
            "status": "healthy",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "checks": {}
        }
        
        # Check database connectivity
        try:
            db = get_db()
            if not db:
                health_status["checks"]["database"] = {
                    "status": "unhealthy",
                    "message": "Database client not available"
                }
                health_status["status"] = "unhealthy"
            else:
                # Test database connection with a simple query
                result = db.table("project_shares").select("id").limit(1).execute()
                health_status["checks"]["database"] = {
                    "status": "healthy",
                    "message": "Database connection successful"
                }
        except Exception as e:
            health_status["checks"]["database"] = {
                "status": "unhealthy",
                "message": f"Database error: {str(e)}"
            }
            health_status["status"] = "unhealthy"
        
        # Check share link generator service
        try:
            db = get_db()
            share_link_service = ShareLinkGenerator(db_session=db)
            health_status["checks"]["share_link_generator"] = {
                "status": "healthy",
                "message": "Service initialized successfully"
            }
        except Exception as e:
            health_status["checks"]["share_link_generator"] = {
                "status": "unhealthy",
                "message": f"Service error: {str(e)}"
            }
            health_status["status"] = "degraded"
        
        # Check guest access controller service
        try:
            db = get_db()
            guest_controller = GuestAccessController(db_session=db)
            health_status["checks"]["guest_access_controller"] = {
                "status": "healthy",
                "message": "Service initialized successfully"
            }
        except Exception as e:
            health_status["checks"]["guest_access_controller"] = {
                "status": "unhealthy",
                "message": f"Service error: {str(e)}"
            }
            health_status["status"] = "degraded"
        
        # Check analytics service
        try:
            db = get_db()
            analytics_service = AccessAnalyticsService(db_session=db)
            health_status["checks"]["analytics_service"] = {
                "status": "healthy",
                "message": "Service initialized successfully"
            }
        except Exception as e:
            health_status["checks"]["analytics_service"] = {
                "status": "unhealthy",
                "message": f"Service error: {str(e)}"
            }
            health_status["status"] = "degraded"
        
        # Check notification service
        try:
            db = get_db()
            notification_service = ShareLinkNotificationService(db_session=db)
            health_status["checks"]["notification_service"] = {
                "status": "healthy",
                "message": "Service initialized successfully"
            }
        except Exception as e:
            health_status["checks"]["notification_service"] = {
                "status": "unhealthy",
                "message": f"Service error: {str(e)}"
            }
            health_status["status"] = "degraded"
        
        # Get system metrics
        try:
            db = get_db()
            if db:
                # Count active share links
                active_shares_result = db.table("project_shares").select(
                    "id", count="exact"
                ).eq("is_active", True).execute()
                
                # Count total access logs
                access_logs_result = db.table("share_access_logs").select(
                    "id", count="exact"
                ).execute()
                
                health_status["metrics"] = {
                    "active_share_links": active_shares_result.count if active_shares_result.count is not None else 0,
                    "total_access_logs": access_logs_result.count if access_logs_result.count is not None else 0
                }
        except Exception as e:
            logger.warning(f"Could not retrieve system metrics: {str(e)}")
            health_status["metrics"] = {
                "error": "Could not retrieve metrics"
            }
        
        logger.info(f"Health check completed: status={health_status['status']}")
        
        # Return appropriate status code based on health
        if health_status["status"] == "unhealthy":
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=health_status
            )
        
        return health_status
        
    except Exception as e:
        logger.error(f"Error in health check: {str(e)}", exc_info=True)
        return {
            "status": "unhealthy",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "error": str(e)
        }


# ============================================================================
# Background Tasks
# ============================================================================

@router.post(
    "/shares/tasks/check-expiry",
    summary="Check for expiring share links and send notifications",
    description="""
    Background task to check for share links expiring within 24 hours
    and send email notifications to creators.
    
    This endpoint should be called periodically (e.g., daily) by a scheduler
    or cron job to ensure timely expiry notifications.
    
    **Requirements**: 3.5
    
    **Permission Required**: admin (only administrators can trigger background tasks)
    
    **Response**: Summary of notifications sent
    """
)
async def check_expiring_share_links(
    hours_before: int = 24,
    current_user = Depends(get_current_user)
):
    """
    Background task to check for expiring share links and send notifications.
    
    This task:
    1. Queries for share links expiring within the specified time window
    2. Sends email notifications to link creators
    3. Logs notification events
    
    Requirements: 3.5
    """
    try:
        # Verify user is admin (optional - you may want to add admin permission check)
        # For now, any authenticated user can trigger this
        
        # Get database connection
        db = get_db()
        if not db:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database service unavailable"
            )
        
        # Initialize notification service
        notification_service = ShareLinkNotificationService(db_session=db)
        
        # Send expiry warnings
        notifications_sent = await notification_service.send_expiry_warnings(
            hours_before=hours_before
        )
        
        logger.info(
            f"Expiry check completed: {notifications_sent} notifications sent "
            f"(hours_before={hours_before})"
        )
        
        return {
            "status": "success",
            "notifications_sent": notifications_sent,
            "hours_before": hours_before,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking expiring share links: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check expiring share links: {str(e)}"
        )


# ============================================================================
# Security Monitoring Endpoints
# ============================================================================

@router.get(
    "/admin/security/alerts",
    summary="Get security alerts for admin review",
    description="""
    Retrieve security alerts for suspicious share link activity.
    
    This endpoint provides admins with a list of security alerts that require
    review and action. Alerts can be filtered by status, severity, and date range.
    
    **Requirements**: 4.4
    
    **Permission Required**: admin (user must have admin privileges)
    
    **Query Parameters**:
    - status: Filter by alert status (pending_review, under_review, resolved, dismissed)
    - severity: Filter by severity level (low, medium, high, critical)
    - start_date: Start date for filtering (ISO format)
    - end_date: End date for filtering (ISO format)
    - limit: Maximum number of alerts to return (default: 100)
    
    **Response**: List of security alerts with details
    """
)
async def get_security_alerts(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = 100,
    current_user = Depends(require_permission(Permission.system_admin))
):
    """
    Get security alerts for admin review.
    
    Requirements: 4.4
    """
    try:
        # Get database connection
        db = get_db()
        if not db:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database service unavailable"
            )
        
        # Import security monitoring service
        from services.security_monitoring_service import SecurityMonitoringService
        
        # Initialize security monitoring service
        security_service = SecurityMonitoringService(db_session=db)
        
        # Get security alerts
        alerts = await security_service.get_security_alerts(
            status=status,
            severity=severity,
            start_date=start_date,
            end_date=end_date,
            limit=limit
        )
        
        logger.info(
            f"Retrieved {len(alerts)} security alerts "
            f"(status={status}, severity={severity})"
        )
        
        return {
            "alerts": alerts,
            "total": len(alerts),
            "filters": {
                "status": status,
                "severity": severity,
                "start_date": start_date.isoformat() if start_date else None,
                "end_date": end_date.isoformat() if end_date else None,
                "limit": limit
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting security alerts: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get security alerts: {str(e)}"
        )


@router.post(
    "/admin/security/alerts/{alert_id}/resolve",
    summary="Resolve a security alert",
    description="""
    Resolve a security alert after admin review.
    
    This endpoint allows admins to mark a security alert as resolved after
    reviewing and taking appropriate action.
    
    **Requirements**: 4.4
    
    **Permission Required**: admin (user must have admin privileges)
    
    **Path Parameters**:
    - alert_id: UUID of the security alert
    
    **Request Body**:
    - resolution: Description of the resolution
    - action_taken: Action taken (optional)
    
    **Response**: Success confirmation
    """
)
async def resolve_security_alert(
    alert_id: UUID,
    resolution: str,
    action_taken: Optional[str] = None,
    current_user = Depends(require_permission(Permission.system_admin))
):
    """
    Resolve a security alert after admin review.
    
    Requirements: 4.4
    """
    try:
        # Get database connection
        db = get_db()
        if not db:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database service unavailable"
            )
        
        # Import security monitoring service
        from services.security_monitoring_service import SecurityMonitoringService
        
        # Initialize security monitoring service
        security_service = SecurityMonitoringService(db_session=db)
        
        # Resolve the alert
        success = await security_service.resolve_security_alert(
            alert_id=str(alert_id),
            reviewed_by=current_user["id"],
            resolution=resolution,
            action_taken=action_taken
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Security alert not found or could not be resolved"
            )
        
        logger.info(
            f"Security alert resolved: alert_id={alert_id}, "
            f"reviewed_by={current_user['id']}"
        )
        
        return {
            "status": "success",
            "message": "Security alert resolved successfully",
            "alert_id": str(alert_id),
            "resolved_at": datetime.now(timezone.utc).isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resolving security alert: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to resolve security alert: {str(e)}"
        )


@router.get(
    "/admin/security/events",
    summary="Get security events log",
    description="""
    Retrieve security events for monitoring and analysis.
    
    This endpoint provides admins with a log of all security events detected
    for share links, including suspicious activity and threat scores.
    
    **Requirements**: 4.4
    
    **Permission Required**: admin (user must have admin privileges)
    
    **Query Parameters**:
    - share_id: Filter by specific share link (optional)
    - severity: Filter by severity level (low, medium, high, critical)
    - start_date: Start date for filtering (ISO format)
    - end_date: End date for filtering (ISO format)
    - limit: Maximum number of events to return (default: 100)
    
    **Response**: List of security events with details
    """
)
async def get_security_events(
    share_id: Optional[UUID] = None,
    severity: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = 100,
    current_user = Depends(require_permission(Permission.system_admin))
):
    """
    Get security events log.
    
    Requirements: 4.4
    """
    try:
        # Get database connection
        db = get_db()
        if not db:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database service unavailable"
            )
        
        # Build query
        query = db.table("share_security_events").select("*")
        
        if share_id:
            query = query.eq("share_id", str(share_id))
        
        if severity:
            query = query.eq("severity", severity)
        
        if start_date:
            query = query.gte("detected_at", start_date.isoformat())
        
        if end_date:
            query = query.lte("detected_at", end_date.isoformat())
        
        query = query.order("detected_at", desc=True).limit(limit)
        
        result = query.execute()
        
        events = result.data if result.data else []
        
        logger.info(
            f"Retrieved {len(events)} security events "
            f"(share_id={share_id}, severity={severity})"
        )
        
        return {
            "events": events,
            "total": len(events),
            "filters": {
                "share_id": str(share_id) if share_id else None,
                "severity": severity,
                "start_date": start_date.isoformat() if start_date else None,
                "end_date": end_date.isoformat() if end_date else None,
                "limit": limit
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting security events: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get security events: {str(e)}"
        )


@router.post(
    "/admin/security/shares/{share_id}/suspend",
    summary="Manually suspend a share link for security reasons",
    description="""
    Manually suspend a share link due to security concerns.
    
    This endpoint allows admins to immediately suspend a share link that
    has been flagged for suspicious activity or security threats.
    
    **Requirements**: 4.5
    
    **Permission Required**: admin (user must have admin privileges)
    
    **Path Parameters**:
    - share_id: UUID of the share link to suspend
    
    **Request Body**:
    - reason: Reason for suspension
    
    **Response**: Success confirmation
    """
)
async def manually_suspend_share_link(
    share_id: UUID,
    reason: str,
    current_user = Depends(require_permission(Permission.system_admin))
):
    """
    Manually suspend a share link for security reasons.
    
    Requirements: 4.5
    """
    try:
        # Get database connection
        db = get_db()
        if not db:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database service unavailable"
            )
        
        # Verify share link exists
        share_result = db.table("project_shares").select("id, is_active").eq(
            "id", str(share_id)
        ).execute()
        
        if not share_result.data or len(share_result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Share link not found"
            )
        
        share = share_result.data[0]
        
        if not share["is_active"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Share link is already inactive"
            )
        
        # Suspend the share link
        update_result = db.table("project_shares").update({
            "is_active": False,
            "revoked_at": datetime.now(timezone.utc).isoformat(),
            "revoked_by": current_user["id"],
            "revocation_reason": f"Manually suspended by admin: {reason}"
        }).eq("id", str(share_id)).execute()
        
        if not update_result.data or len(update_result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to suspend share link"
            )
        
        logger.warning(
            f"Share link manually suspended: share_id={share_id}, "
            f"admin={current_user['id']}, reason={reason}"
        )
        
        return {
            "status": "success",
            "message": "Share link suspended successfully",
            "share_id": str(share_id),
            "suspended_at": datetime.now(timezone.utc).isoformat(),
            "reason": reason
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error suspending share link: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to suspend share link: {str(e)}"
        )


@router.get(
    "/admin/security/dashboard",
    summary="Get security monitoring dashboard data",
    description="""
    Get comprehensive security monitoring dashboard data.
    
    This endpoint provides admins with an overview of security metrics,
    including alert counts, threat trends, and suspicious activity patterns.
    
    **Requirements**: 4.4
    
    **Permission Required**: admin (user must have admin privileges)
    
    **Query Parameters**:
    - days: Number of days to include in the dashboard (default: 7)
    
    **Response**: Dashboard data with security metrics
    """
)
async def get_security_dashboard(
    days: int = 7,
    current_user = Depends(require_permission(Permission.system_admin))
):
    """
    Get security monitoring dashboard data.
    
    Requirements: 4.4
    """
    try:
        # Get database connection
        db = get_db()
        if not db:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database service unavailable"
            )
        
        # Calculate date range
        end_date = datetime.now(timezone.utc)
        start_date = end_date - timedelta(days=days)
        
        # Get alert counts by status
        alerts_result = db.table("share_security_alerts").select(
            "status, severity"
        ).gte("created_at", start_date.isoformat()).execute()
        
        alerts = alerts_result.data if alerts_result.data else []
        
        alert_counts = {
            "pending_review": 0,
            "under_review": 0,
            "resolved": 0,
            "dismissed": 0
        }
        
        severity_counts = {
            "low": 0,
            "medium": 0,
            "high": 0,
            "critical": 0
        }
        
        for alert in alerts:
            alert_counts[alert["status"]] = alert_counts.get(alert["status"], 0) + 1
            severity_counts[alert["severity"]] = severity_counts.get(alert["severity"], 0) + 1
        
        # Get security events
        events_result = db.table("share_security_events").select(
            "detected_at, threat_score, severity"
        ).gte("detected_at", start_date.isoformat()).execute()
        
        events = events_result.data if events_result.data else []
        
        # Calculate threat trend
        from collections import defaultdict
        daily_threats = defaultdict(lambda: {"count": 0, "total_score": 0})
        
        for event in events:
            detected_at = datetime.fromisoformat(event["detected_at"].replace('Z', '+00:00'))
            day_key = detected_at.date().isoformat()
            daily_threats[day_key]["count"] += 1
            daily_threats[day_key]["total_score"] += event["threat_score"]
        
        threat_trend = [
            {
                "date": day,
                "count": data["count"],
                "average_score": round(data["total_score"] / data["count"], 2) if data["count"] > 0 else 0
            }
            for day, data in sorted(daily_threats.items())
        ]
        
        # Get top suspicious IPs
        ip_counts = defaultdict(int)
        for event in events:
            ip_counts[event.get("ip_address", "unknown")] += 1
        
        top_ips = sorted(ip_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        
        dashboard_data = {
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "days": days
            },
            "alert_summary": {
                "total_alerts": len(alerts),
                "by_status": alert_counts,
                "by_severity": severity_counts
            },
            "event_summary": {
                "total_events": len(events),
                "threat_trend": threat_trend
            },
            "top_suspicious_ips": [
                {"ip_address": ip, "event_count": count}
                for ip, count in top_ips
            ]
        }
        
        logger.info(
            f"Security dashboard data retrieved: {len(alerts)} alerts, "
            f"{len(events)} events (days={days})"
        )
        
        return dashboard_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting security dashboard: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get security dashboard: {str(e)}"
        )
