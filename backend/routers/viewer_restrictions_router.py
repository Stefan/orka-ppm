"""
API Router for Viewer Restrictions

This module provides API endpoints for viewer role restrictions:
- UI indicators for read-only access
- Financial data access level checking
- Report access control
- Write operation prevention

Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
"""

from typing import Optional, Dict, Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from auth.dependencies import get_current_user
from auth.viewer_restrictions import get_viewer_restriction_checker
from auth.enhanced_rbac_models import PermissionContext
from auth.rbac import Permission

router = APIRouter(prefix="/api/rbac", tags=["viewer-restrictions"])


class ViewerIndicatorsResponse(BaseModel):
    """Response model for viewer UI indicators"""
    is_read_only: bool
    disabled_features: list[str]
    ui_message: Optional[str]
    show_read_only_badge: bool
    financial_access_level: Optional[str] = None


class FinancialAccessResponse(BaseModel):
    """Response model for financial data access level"""
    access_level: str = Field(
        description="Access level: 'full', 'summary', or 'none'"
    )
    can_view_details: bool
    can_edit: bool


class ReportAccessRequest(BaseModel):
    """Request model for report access checking"""
    report_type: str
    report_scope: Optional[PermissionContext] = None
    user_context: Optional[PermissionContext] = None


class ReportAccessResponse(BaseModel):
    """Response model for report access checking"""
    can_access: bool
    access_level: str
    denial_reason: Optional[str] = None


class WriteOperationRequest(BaseModel):
    """Request model for write operation checking"""
    operation: str
    context: Optional[PermissionContext] = None


class WriteOperationResponse(BaseModel):
    """Response model for write operation checking"""
    is_allowed: bool
    error_message: Optional[str] = None


@router.get(
    "/viewer-indicators",
    response_model=ViewerIndicatorsResponse,
    summary="Get viewer UI indicators",
    description="Get UI indicators for read-only access display"
)
async def get_viewer_indicators(
    context: Optional[str] = Query(None, description="JSON-encoded PermissionContext"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get UI indicators for viewer read-only access.
    
    Returns information about:
    - Whether user has read-only access
    - Which features are disabled
    - UI messages to display
    - Financial data access level
    
    Requirements: 6.5 - Read-only UI indication
    """
    try:
        user_id = UUID(current_user["user_id"])
        
        # Parse context if provided
        permission_context = None
        if context:
            import json
            context_data = json.loads(context)
            permission_context = PermissionContext(**context_data)
        
        # Get viewer restriction checker
        checker = get_viewer_restriction_checker()
        
        # Get UI indicators
        indicators = await checker.get_ui_indicators(user_id, permission_context)
        
        return ViewerIndicatorsResponse(**indicators)
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid request: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting viewer indicators: {str(e)}")


@router.get(
    "/financial-access-level",
    response_model=FinancialAccessResponse,
    summary="Get financial data access level",
    description="Determine user's financial data access level"
)
async def get_financial_access_level(
    context: Optional[str] = Query(None, description="JSON-encoded PermissionContext"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get the financial data access level for a user.
    
    Access levels:
    - "full": Full access to all financial data
    - "summary": Summary-level access only (viewers)
    - "none": No financial data access
    
    Requirements: 6.3 - Financial data access filtering
    """
    try:
        user_id = UUID(current_user["user_id"])
        
        # Parse context if provided
        permission_context = None
        if context:
            import json
            context_data = json.loads(context)
            permission_context = PermissionContext(**context_data)
        
        # Get viewer restriction checker
        checker = get_viewer_restriction_checker()
        
        # Get access level
        access_level = await checker.get_financial_data_access_level(user_id, permission_context)
        
        return FinancialAccessResponse(
            access_level=access_level,
            can_view_details=(access_level == "full"),
            can_edit=(access_level == "full")
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid request: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting financial access level: {str(e)}")


@router.post(
    "/filter-financial-data",
    summary="Filter financial data based on access level",
    description="Filter financial data to appropriate level for user"
)
async def filter_financial_data(
    financial_data: Dict[str, Any],
    context: Optional[str] = Query(None, description="JSON-encoded PermissionContext"),
    current_user: dict = Depends(get_current_user)
):
    """
    Filter financial data based on user's access level.
    
    For viewers (summary access):
    - Include: totals, aggregates, high-level metrics
    - Exclude: detailed line items, sensitive cost breakdowns
    
    For non-viewers (full access):
    - Include: all financial data
    
    Requirements: 6.3 - Financial data access filtering
    """
    try:
        user_id = UUID(current_user["user_id"])
        
        # Parse context if provided
        permission_context = None
        if context:
            import json
            context_data = json.loads(context)
            permission_context = PermissionContext(**context_data)
        
        # Get viewer restriction checker
        checker = get_viewer_restriction_checker()
        
        # Filter financial data
        filtered_data = await checker.filter_financial_data(
            user_id, financial_data, permission_context
        )
        
        return filtered_data
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid request: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error filtering financial data: {str(e)}")


@router.post(
    "/check-report-access",
    response_model=ReportAccessResponse,
    summary="Check report access",
    description="Check if user can access a specific report"
)
async def check_report_access(
    request: ReportAccessRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Check if a user can access a specific report.
    
    For viewers:
    - Can access reports within their organizational scope
    - Cannot access reports outside their scope
    
    For non-viewers:
    - Can access all reports they have permission for
    
    Requirements: 6.4 - Organizational report access control
    """
    try:
        user_id = UUID(current_user["user_id"])
        
        # Get viewer restriction checker
        checker = get_viewer_restriction_checker()
        
        # Check report access
        can_access, denial_reason = await checker.can_access_report(
            user_id,
            request.report_type,
            request.report_scope,
            request.user_context
        )
        
        # Get access level
        access_level = await checker.get_report_access_level(
            user_id,
            request.report_type,
            request.user_context
        )
        
        return ReportAccessResponse(
            can_access=can_access,
            access_level=access_level,
            denial_reason=denial_reason
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid request: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error checking report access: {str(e)}")


@router.post(
    "/check-write-operation",
    response_model=WriteOperationResponse,
    summary="Check write operation permission",
    description="Check if user can perform a write operation"
)
async def check_write_operation(
    request: WriteOperationRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Check if a user can perform a write operation.
    
    Prevents write operations for viewer-only users.
    
    Requirements: 6.2 - Write operation prevention
    """
    try:
        user_id = UUID(current_user["user_id"])
        
        # Get viewer restriction checker
        checker = get_viewer_restriction_checker()
        
        # Check write operation
        is_allowed, error_message = await checker.prevent_write_operation(
            user_id,
            request.operation,
            request.context
        )
        
        return WriteOperationResponse(
            is_allowed=is_allowed,
            error_message=error_message
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid request: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error checking write operation: {str(e)}")


@router.get(
    "/is-viewer-only",
    summary="Check if user is viewer-only",
    description="Check if user has only viewer-level permissions"
)
async def is_viewer_only(
    context: Optional[str] = Query(None, description="JSON-encoded PermissionContext"),
    current_user: dict = Depends(get_current_user)
):
    """
    Check if a user has only viewer-level permissions.
    
    A user is considered viewer-only if they have no write permissions
    in the given context.
    
    Requirements: 6.1 - Read-only access enforcement
    """
    try:
        user_id = UUID(current_user["user_id"])
        
        # Parse context if provided
        permission_context = None
        if context:
            import json
            context_data = json.loads(context)
            permission_context = PermissionContext(**context_data)
        
        # Get viewer restriction checker
        checker = get_viewer_restriction_checker()
        
        # Check if viewer-only
        is_viewer = await checker.is_viewer_only(user_id, permission_context)
        
        return {
            "is_viewer_only": is_viewer,
            "has_write_access": not is_viewer
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid request: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error checking viewer status: {str(e)}")
