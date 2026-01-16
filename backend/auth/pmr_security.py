"""
PMR Security Middleware and Dependencies
Provides security checks and access control for PMR endpoints
"""

from fastapi import Depends, HTTPException, Request
from typing import Dict, Any, Optional
from uuid import UUID

from .dependencies import get_current_user
from .rbac import rbac, Permission
from services.pmr_audit_service import pmr_audit_service, AuditAction
from services.pmr_privacy_service import pmr_privacy_service


async def require_pmr_permission(
    permission: Permission,
    report_id: Optional[UUID] = None
):
    """
    Dependency to require PMR-specific permissions
    
    Args:
        permission: Required permission
        report_id: Optional report ID for resource-specific checks
    """
    async def permission_checker(
        current_user: Dict[str, Any] = Depends(get_current_user),
        request: Request = None
    ):
        user_id = current_user.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="User not authenticated")
        
        # Check if user has the required permission
        has_perm = await rbac.has_permission(user_id, permission)
        
        if not has_perm:
            # Log permission denied event
            await pmr_audit_service.log_audit_event(
                action=AuditAction.PERMISSION_DENIED,
                user_id=UUID(user_id),
                report_id=report_id,
                details={
                    "required_permission": permission.value,
                    "endpoint": str(request.url) if request else None
                },
                ip_address=request.client.host if request else None,
                severity="warning"
            )
            
            raise HTTPException(
                status_code=403,
                detail=f"Insufficient permissions. Required: {permission.value}"
            )
        
        # If report_id is provided, check resource-specific access
        if report_id:
            access_permissions = await pmr_privacy_service.get_data_access_permissions(
                UUID(user_id), report_id
            )
            
            if not access_permissions.get("can_view", False):
                # Log unauthorized access attempt
                await pmr_audit_service.log_audit_event(
                    action=AuditAction.PERMISSION_DENIED,
                    user_id=UUID(user_id),
                    report_id=report_id,
                    details={
                        "reason": "No access to report",
                        "endpoint": str(request.url) if request else None
                    },
                    ip_address=request.client.host if request else None,
                    severity="warning"
                )
                
                raise HTTPException(
                    status_code=403,
                    detail="You do not have access to this report"
                )
        
        return current_user
    
    return permission_checker


async def require_pmr_read_access(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Dependency to require PMR read access"""
    user_id = current_user.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")
    
    has_perm = await rbac.has_permission(user_id, Permission.pmr_read)
    if not has_perm:
        raise HTTPException(
            status_code=403,
            detail="Insufficient permissions to read PMR reports"
        )
    
    return current_user


async def require_pmr_write_access(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Dependency to require PMR write access"""
    user_id = current_user.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")
    
    has_perm = await rbac.has_any_permission(
        user_id,
        [Permission.pmr_create, Permission.pmr_update]
    )
    
    if not has_perm:
        raise HTTPException(
            status_code=403,
            detail="Insufficient permissions to modify PMR reports"
        )
    
    return current_user


async def require_pmr_approve_access(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Dependency to require PMR approval access"""
    user_id = current_user.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")
    
    has_perm = await rbac.has_permission(user_id, Permission.pmr_approve)
    if not has_perm:
        raise HTTPException(
            status_code=403,
            detail="Insufficient permissions to approve PMR reports"
        )
    
    return current_user


async def require_pmr_export_access(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Dependency to require PMR export access"""
    user_id = current_user.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")
    
    has_perm = await rbac.has_permission(user_id, Permission.pmr_export)
    if not has_perm:
        raise HTTPException(
            status_code=403,
            detail="Insufficient permissions to export PMR reports"
        )
    
    return current_user


async def require_pmr_collaborate_access(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Dependency to require PMR collaboration access"""
    user_id = current_user.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")
    
    has_perm = await rbac.has_permission(user_id, Permission.pmr_collaborate)
    if not has_perm:
        raise HTTPException(
            status_code=403,
            detail="Insufficient permissions to collaborate on PMR reports"
        )
    
    return current_user


async def require_pmr_audit_access(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Dependency to require PMR audit trail access"""
    user_id = current_user.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")
    
    has_perm = await rbac.has_permission(user_id, Permission.pmr_audit_read)
    if not has_perm:
        raise HTTPException(
            status_code=403,
            detail="Insufficient permissions to view PMR audit trails"
        )
    
    return current_user


async def log_pmr_access(
    report_id: UUID,
    action: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    request: Request = None
):
    """
    Log PMR access for audit trail
    
    Args:
        report_id: ID of the PMR report
        action: Action being performed
        current_user: Current user information
        request: FastAPI request object
    """
    user_id = current_user.get("user_id")
    
    await pmr_audit_service.log_audit_event(
        action=action,
        user_id=UUID(user_id),
        report_id=report_id,
        details={
            "endpoint": str(request.url) if request else None,
            "method": request.method if request else None
        },
        ip_address=request.client.host if request else None,
        user_agent=request.headers.get("user-agent") if request else None
    )


async def check_report_access(
    report_id: UUID,
    required_access: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> bool:
    """
    Check if user has specific access to a report
    
    Args:
        report_id: ID of the PMR report
        required_access: Type of access required (view, edit, export, etc.)
        current_user: Current user information
    
    Returns:
        True if user has access, raises HTTPException otherwise
    """
    user_id = UUID(current_user.get("user_id"))
    
    access_permissions = await pmr_privacy_service.get_data_access_permissions(
        user_id, report_id
    )
    
    access_key = f"can_{required_access}"
    if not access_permissions.get(access_key, False):
        raise HTTPException(
            status_code=403,
            detail=f"You do not have {required_access} access to this report"
        )
    
    return True


class PMRSecurityContext:
    """Context manager for PMR security operations"""
    
    def __init__(
        self,
        user_id: UUID,
        report_id: Optional[UUID] = None,
        action: Optional[str] = None,
        request: Optional[Request] = None
    ):
        self.user_id = user_id
        self.report_id = report_id
        self.action = action
        self.request = request
    
    async def __aenter__(self):
        """Log the start of an operation"""
        if self.action and self.report_id:
            await pmr_audit_service.log_audit_event(
                action=f"{self.action}_started",
                user_id=self.user_id,
                report_id=self.report_id,
                details={
                    "endpoint": str(self.request.url) if self.request else None
                },
                ip_address=self.request.client.host if self.request else None
            )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Log the completion or failure of an operation"""
        if self.action and self.report_id:
            if exc_type is None:
                # Operation succeeded
                await pmr_audit_service.log_audit_event(
                    action=f"{self.action}_completed",
                    user_id=self.user_id,
                    report_id=self.report_id,
                    details={
                        "status": "success"
                    },
                    severity="info"
                )
            else:
                # Operation failed
                await pmr_audit_service.log_audit_event(
                    action=f"{self.action}_failed",
                    user_id=self.user_id,
                    report_id=self.report_id,
                    details={
                        "error": str(exc_val),
                        "error_type": exc_type.__name__ if exc_type else None
                    },
                    severity="error"
                )
        
        return False  # Don't suppress exceptions
