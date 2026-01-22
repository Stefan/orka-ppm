"""
RBAC Error Handler Module

This module provides comprehensive HTTP status code handling and error responses
for permission failures in the RBAC system.

Features:
- Proper 401/403 error responses for permission failures
- Detailed error messages with required permissions information
- Permission denial logging and security event tracking

Requirements: 1.3 - HTTP Status Code Correctness
"""

from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Union
from uuid import UUID
from enum import Enum
import logging
import json

from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, Field, ConfigDict

from .rbac import Permission
from .enhanced_rbac_models import PermissionContext

# Import PermissionRequirement types for error handling
# These are imported lazily to avoid circular imports
TYPE_CHECKING = False
if TYPE_CHECKING:
    from .permission_requirements import PermissionRequirement, PermissionCheckResult

logger = logging.getLogger(__name__)


class SecurityEventType(str, Enum):
    """Types of security events for logging"""
    PERMISSION_DENIED = "permission_denied"
    AUTHENTICATION_FAILED = "authentication_failed"
    AUTHENTICATION_EXPIRED = "authentication_expired"
    INVALID_TOKEN = "invalid_token"
    UNAUTHORIZED_ACCESS_ATTEMPT = "unauthorized_access_attempt"
    ROLE_ESCALATION_ATTEMPT = "role_escalation_attempt"
    SUSPICIOUS_ACTIVITY = "suspicious_activity"


class PermissionError(Exception):
    """
    Exception raised when a user lacks required permission.
    
    This exception captures detailed information about the permission failure
    for logging and error response generation.
    
    Requirements: 1.3 - Permission validation failure handling
    """
    
    def __init__(
        self,
        user_id: Union[UUID, str],
        permission: Permission,
        context: Optional[PermissionContext] = None,
        message: Optional[str] = None
    ):
        """
        Initialize PermissionError.
        
        Args:
            user_id: The user's UUID or string ID
            permission: The permission that was denied
            context: Optional context for scoped permission checking
            message: Optional custom error message
        """
        self.user_id = user_id if isinstance(user_id, UUID) else UUID(str(user_id)) if user_id else None
        self.permission = permission
        self.context = context
        self.timestamp = datetime.now(timezone.utc)
        
        default_message = f"User {user_id} lacks permission {permission.value}"
        self.message = message or default_message
        super().__init__(self.message)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert error to dictionary for logging/serialization."""
        return {
            "user_id": str(self.user_id) if self.user_id else None,
            "permission": self.permission.value,
            "context": self.context.model_dump() if self.context else None,
            "timestamp": self.timestamp.isoformat(),
            "message": self.message
        }


class MultiplePermissionsError(Exception):
    """
    Exception raised when a user lacks multiple required permissions.
    
    Used for AND logic permission checks where all permissions are required.
    """
    
    def __init__(
        self,
        user_id: Union[UUID, str],
        required_permissions: List[Permission],
        missing_permissions: List[Permission],
        context: Optional[PermissionContext] = None,
        message: Optional[str] = None
    ):
        """
        Initialize MultiplePermissionsError.
        
        Args:
            user_id: The user's UUID or string ID
            required_permissions: All permissions that were required
            missing_permissions: Permissions the user is missing
            context: Optional context for scoped permission checking
            message: Optional custom error message
        """
        self.user_id = user_id if isinstance(user_id, UUID) else UUID(str(user_id)) if user_id else None
        self.required_permissions = required_permissions
        self.missing_permissions = missing_permissions
        self.context = context
        self.timestamp = datetime.now(timezone.utc)
        
        missing_names = [p.value for p in missing_permissions]
        default_message = f"User {user_id} lacks permissions: {', '.join(missing_names)}"
        self.message = message or default_message
        super().__init__(self.message)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert error to dictionary for logging/serialization."""
        return {
            "user_id": str(self.user_id) if self.user_id else None,
            "required_permissions": [p.value for p in self.required_permissions],
            "missing_permissions": [p.value for p in self.missing_permissions],
            "context": self.context.model_dump() if self.context else None,
            "timestamp": self.timestamp.isoformat(),
            "message": self.message
        }


class AuthenticationError(Exception):
    """
    Exception raised when authentication fails.
    
    This is used for 401 Unauthorized responses.
    """
    
    def __init__(
        self,
        message: str = "Authentication required",
        reason: Optional[str] = None
    ):
        """
        Initialize AuthenticationError.
        
        Args:
            message: Error message
            reason: Specific reason for authentication failure
        """
        self.message = message
        self.reason = reason
        self.timestamp = datetime.now(timezone.utc)
        super().__init__(self.message)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert error to dictionary for logging/serialization."""
        return {
            "message": self.message,
            "reason": self.reason,
            "timestamp": self.timestamp.isoformat()
        }


class SecurityEvent(BaseModel):
    """Model for security events to be logged."""
    event_type: SecurityEventType
    user_id: Optional[str] = None
    permission: Optional[str] = None
    permissions: Optional[List[str]] = None
    context: Optional[Dict[str, Any]] = None
    request_path: Optional[str] = None
    request_method: Optional[str] = None
    client_ip: Optional[str] = None
    user_agent: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    additional_data: Optional[Dict[str, Any]] = None
    
    model_config = ConfigDict(
        ser_json_timedelta='iso8601'
    )


class PermissionDeniedResponse(BaseModel):
    """Response model for permission denied errors (403)."""
    error: str = "insufficient_permissions"
    message: str
    required_permission: Optional[str] = None
    required_permissions: Optional[List[str]] = None
    context: Optional[Dict[str, Any]] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    model_config = ConfigDict(
        ser_json_timedelta='iso8601'
    )


class AuthenticationRequiredResponse(BaseModel):
    """Response model for authentication required errors (401)."""
    error: str = "authentication_required"
    message: str
    reason: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    model_config = ConfigDict(
        ser_json_timedelta='iso8601'
    )


class RBACErrorHandler:
    """
    Handler for RBAC-related errors with proper HTTP status codes and logging.
    
    This class provides:
    - Proper 401/403 error responses for permission failures
    - Detailed error messages with required permissions information
    - Permission denial logging and security event tracking
    
    Requirements: 1.3 - HTTP Status Code Correctness
    """
    
    def __init__(self, supabase_client=None, enable_logging: bool = True):
        """
        Initialize RBACErrorHandler.
        
        Args:
            supabase_client: Optional Supabase client for database logging
            enable_logging: Whether to enable security event logging
        """
        self.supabase = supabase_client
        self.enable_logging = enable_logging
        self._security_events: List[SecurityEvent] = []  # In-memory buffer for events
    
    async def handle_permission_denied(
        self,
        error: PermissionError,
        request: Optional[Request] = None
    ) -> JSONResponse:
        """
        Handle a permission denied error and return appropriate response.
        
        This method:
        1. Logs the security event
        2. Returns a 403 Forbidden response with detailed error information
        
        Args:
            error: The PermissionError that was raised
            request: Optional FastAPI request object for additional context
            
        Returns:
            JSONResponse with 403 status code and error details
            
        Requirements: 1.3 - Return 403 for unauthorized users
        """
        # Log security event
        await self.log_security_event(
            event_type=SecurityEventType.PERMISSION_DENIED,
            user_id=str(error.user_id) if error.user_id else None,
            permission=error.permission.value,
            context=error.context.model_dump() if error.context else None,
            request=request
        )
        
        # Build response
        response_data = PermissionDeniedResponse(
            error="insufficient_permissions",
            message=f"Permission '{error.permission.value}' required",
            required_permission=error.permission.value,
            context=error.context.model_dump() if error.context else None
        )
        
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content=response_data.model_dump(mode='json')
        )
    
    async def handle_multiple_permissions_denied(
        self,
        error: MultiplePermissionsError,
        request: Optional[Request] = None
    ) -> JSONResponse:
        """
        Handle a multiple permissions denied error and return appropriate response.
        
        Args:
            error: The MultiplePermissionsError that was raised
            request: Optional FastAPI request object for additional context
            
        Returns:
            JSONResponse with 403 status code and error details
            
        Requirements: 1.3 - Return 403 for unauthorized users
        """
        # Log security event
        await self.log_security_event(
            event_type=SecurityEventType.PERMISSION_DENIED,
            user_id=str(error.user_id) if error.user_id else None,
            permissions=[p.value for p in error.missing_permissions],
            context=error.context.model_dump() if error.context else None,
            request=request,
            additional_data={
                "required_permissions": [p.value for p in error.required_permissions],
                "missing_permissions": [p.value for p in error.missing_permissions]
            }
        )
        
        # Build response
        missing_names = [p.value for p in error.missing_permissions]
        required_names = [p.value for p in error.required_permissions]
        
        response_data = PermissionDeniedResponse(
            error="insufficient_permissions",
            message=f"Missing permissions: {', '.join(missing_names)}",
            required_permissions=required_names,
            context=error.context.model_dump() if error.context else None
        )
        
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content=response_data.model_dump(mode='json')
        )
    
    async def handle_authentication_failed(
        self,
        error: Optional[AuthenticationError] = None,
        request: Optional[Request] = None,
        reason: Optional[str] = None
    ) -> JSONResponse:
        """
        Handle an authentication failure and return appropriate response.
        
        This method:
        1. Logs the security event
        2. Returns a 401 Unauthorized response
        
        Args:
            error: Optional AuthenticationError that was raised
            request: Optional FastAPI request object for additional context
            reason: Optional reason for authentication failure
            
        Returns:
            JSONResponse with 401 status code and error details
            
        Requirements: 1.3 - Return 401 for unauthenticated users
        """
        # Determine reason
        auth_reason = reason
        if error:
            auth_reason = error.reason or reason
        
        # Log security event
        await self.log_security_event(
            event_type=SecurityEventType.AUTHENTICATION_FAILED,
            request=request,
            additional_data={"reason": auth_reason} if auth_reason else None
        )
        
        # Build response
        message = "Authentication required"
        if error:
            message = error.message
        
        response_data = AuthenticationRequiredResponse(
            error="authentication_required",
            message=message,
            reason=auth_reason
        )
        
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content=response_data.model_dump(mode='json'),
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    async def handle_permission_requirement_denied(
        self,
        user_id: Union[UUID, str],
        requirement: 'PermissionRequirement',
        result: 'PermissionCheckResult',
        context: Optional[PermissionContext] = None,
        request: Optional[Request] = None
    ) -> JSONResponse:
        """
        Handle a complex permission requirement denial and return appropriate response.
        
        This method handles failures from PermissionRequirement checks, providing
        detailed information about which specific permissions were missing.
        
        Args:
            user_id: The user's UUID or string ID
            requirement: The PermissionRequirement that was not satisfied
            result: The detailed PermissionCheckResult
            context: Optional permission context
            request: Optional FastAPI request object for additional context
            
        Returns:
            JSONResponse with 403 status code and detailed error information
            
        Requirements: 1.3, 1.4 - Return 403 with detailed missing permission info
        """
        user_id_str = str(user_id) if user_id else None
        
        # Get all missing permissions from the result
        missing_permissions = list(result.get_all_missing_permissions())
        missing_names = [p.value for p in missing_permissions]
        
        # Log security event
        await self.log_security_event(
            event_type=SecurityEventType.PERMISSION_DENIED,
            user_id=user_id_str,
            permissions=missing_names,
            context=context.model_dump() if context else None,
            request=request,
            additional_data={
                "requirement_description": requirement.describe(),
                "requirement_type": result.requirement_type.value if hasattr(result.requirement_type, 'value') else str(result.requirement_type),
                "missing_permissions": missing_names
            }
        )
        
        # Build response with detailed error information
        response_data = PermissionDeniedResponse(
            error="insufficient_permissions",
            message=result.get_human_readable_error(),
            required_permissions=[p.value for p in requirement.get_all_permissions()],
            context=context.model_dump() if context else None
        )
        
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content=response_data.model_dump(mode='json')
        )
    
    async def log_security_event(
        self,
        event_type: SecurityEventType,
        user_id: Optional[str] = None,
        permission: Optional[str] = None,
        permissions: Optional[List[str]] = None,
        context: Optional[Dict[str, Any]] = None,
        request: Optional[Request] = None,
        additional_data: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Log a security event for audit and monitoring purposes.
        
        This method logs security events to:
        1. Python logger (always)
        2. In-memory buffer (for testing/monitoring)
        3. Database (if Supabase client is available)
        
        Args:
            event_type: Type of security event
            user_id: Optional user ID involved in the event
            permission: Optional single permission involved
            permissions: Optional list of permissions involved
            context: Optional permission context
            request: Optional FastAPI request for additional info
            additional_data: Optional additional data to log
            
        Requirements: 1.3 - Permission denial logging and security event tracking
        """
        if not self.enable_logging:
            return
        
        # Extract request information
        request_path = None
        request_method = None
        client_ip = None
        user_agent = None
        
        if request:
            request_path = str(request.url.path)
            request_method = request.method
            client_ip = self._get_client_ip(request)
            user_agent = request.headers.get("user-agent")
        
        # Create security event
        event = SecurityEvent(
            event_type=event_type,
            user_id=user_id,
            permission=permission,
            permissions=permissions,
            context=context,
            request_path=request_path,
            request_method=request_method,
            client_ip=client_ip,
            user_agent=user_agent,
            additional_data=additional_data
        )
        
        # Log to Python logger
        log_message = self._format_log_message(event)
        if event_type in [SecurityEventType.PERMISSION_DENIED, SecurityEventType.AUTHENTICATION_FAILED]:
            logger.warning(log_message)
        elif event_type in [SecurityEventType.ROLE_ESCALATION_ATTEMPT, SecurityEventType.SUSPICIOUS_ACTIVITY]:
            logger.error(log_message)
        else:
            logger.info(log_message)
        
        # Add to in-memory buffer
        self._security_events.append(event)
        
        # Trim buffer if too large
        if len(self._security_events) > 1000:
            self._security_events = self._security_events[-500:]
        
        # Log to database if available
        await self._log_to_database(event)
    
    async def _log_to_database(self, event: SecurityEvent) -> None:
        """
        Log security event to database.
        
        Args:
            event: The security event to log
        """
        if not self.supabase:
            return
        
        try:
            # Insert into security_events or audit_logs table
            event_data = {
                "event_type": event.event_type.value,
                "user_id": event.user_id,
                "permission": event.permission,
                "permissions": event.permissions,
                "context": json.dumps(event.context) if event.context else None,
                "request_path": event.request_path,
                "request_method": event.request_method,
                "client_ip": event.client_ip,
                "user_agent": event.user_agent,
                "additional_data": json.dumps(event.additional_data) if event.additional_data else None,
                "created_at": event.timestamp.isoformat()
            }
            
            # Try to insert into security_events table
            # If table doesn't exist, log to audit_logs
            try:
                self.supabase.table("security_events").insert(event_data).execute()
            except Exception:
                # Fallback to audit_logs table
                audit_data = {
                    "action": f"security_{event.event_type.value}",
                    "user_id": event.user_id,
                    "details": json.dumps({
                        "permission": event.permission,
                        "permissions": event.permissions,
                        "context": event.context,
                        "request_path": event.request_path,
                        "request_method": event.request_method,
                        "client_ip": event.client_ip,
                        "additional_data": event.additional_data
                    }),
                    "created_at": event.timestamp.isoformat()
                }
                self.supabase.table("audit_logs").insert(audit_data).execute()
                
        except Exception as e:
            logger.error(f"Failed to log security event to database: {e}")
    
    def _get_client_ip(self, request: Request) -> Optional[str]:
        """
        Extract client IP from request, handling proxies.
        
        Args:
            request: FastAPI request object
            
        Returns:
            Client IP address or None
        """
        # Check for forwarded headers (behind proxy)
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip
        
        # Direct connection
        if request.client:
            return request.client.host
        
        return None
    
    def _format_log_message(self, event: SecurityEvent) -> str:
        """
        Format security event for logging.
        
        Args:
            event: The security event to format
            
        Returns:
            Formatted log message string
        """
        parts = [f"Security Event: {event.event_type.value}"]
        
        if event.user_id:
            parts.append(f"user_id={event.user_id}")
        
        if event.permission:
            parts.append(f"permission={event.permission}")
        elif event.permissions:
            parts.append(f"permissions={','.join(event.permissions)}")
        
        if event.request_path:
            parts.append(f"path={event.request_path}")
        
        if event.request_method:
            parts.append(f"method={event.request_method}")
        
        if event.client_ip:
            parts.append(f"ip={event.client_ip}")
        
        return " | ".join(parts)
    
    def get_recent_events(
        self,
        event_type: Optional[SecurityEventType] = None,
        user_id: Optional[str] = None,
        limit: int = 100
    ) -> List[SecurityEvent]:
        """
        Get recent security events from in-memory buffer.
        
        Args:
            event_type: Optional filter by event type
            user_id: Optional filter by user ID
            limit: Maximum number of events to return
            
        Returns:
            List of matching security events
        """
        events = self._security_events
        
        if event_type:
            events = [e for e in events if e.event_type == event_type]
        
        if user_id:
            events = [e for e in events if e.user_id == user_id]
        
        return events[-limit:]
    
    def clear_events(self) -> None:
        """Clear the in-memory security events buffer."""
        self._security_events.clear()


def create_permission_denied_response(
    permission: Permission,
    context: Optional[PermissionContext] = None,
    message: Optional[str] = None
) -> JSONResponse:
    """
    Create a 403 Forbidden response for permission denied.
    
    This is a convenience function for creating permission denied responses
    without needing to instantiate RBACErrorHandler.
    
    Args:
        permission: The permission that was denied
        context: Optional permission context
        message: Optional custom message
        
    Returns:
        JSONResponse with 403 status code
        
    Requirements: 1.3 - Return 403 for unauthorized users
    """
    response_data = PermissionDeniedResponse(
        error="insufficient_permissions",
        message=message or f"Permission '{permission.value}' required",
        required_permission=permission.value,
        context=context.model_dump() if context else None
    )
    
    return JSONResponse(
        status_code=status.HTTP_403_FORBIDDEN,
        content=response_data.model_dump(mode='json')
    )


def create_authentication_required_response(
    message: str = "Authentication required",
    reason: Optional[str] = None
) -> JSONResponse:
    """
    Create a 401 Unauthorized response for authentication required.
    
    This is a convenience function for creating authentication required responses
    without needing to instantiate RBACErrorHandler.
    
    Args:
        message: Error message
        reason: Optional reason for authentication failure
        
    Returns:
        JSONResponse with 401 status code
        
    Requirements: 1.3 - Return 401 for unauthenticated users
    """
    response_data = AuthenticationRequiredResponse(
        error="authentication_required",
        message=message,
        reason=reason
    )
    
    return JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED,
        content=response_data.model_dump(mode='json'),
        headers={"WWW-Authenticate": "Bearer"}
    )


def raise_permission_denied(
    user_id: Union[UUID, str],
    permission: Permission,
    context: Optional[PermissionContext] = None
) -> None:
    """
    Raise an HTTPException for permission denied.
    
    This is a convenience function for raising permission denied exceptions
    in FastAPI endpoints.
    
    Args:
        user_id: The user's ID
        permission: The permission that was denied
        context: Optional permission context
        
    Raises:
        HTTPException with 403 status code
        
    Requirements: 1.3 - Return 403 for unauthorized users
    """
    detail = {
        "error": "insufficient_permissions",
        "message": f"Permission '{permission.value}' required",
        "required_permission": permission.value
    }
    
    if context:
        detail["context"] = context.model_dump()
    
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=detail
    )


def raise_authentication_required(
    message: str = "Authentication required",
    reason: Optional[str] = None
) -> None:
    """
    Raise an HTTPException for authentication required.
    
    This is a convenience function for raising authentication required exceptions
    in FastAPI endpoints.
    
    Args:
        message: Error message
        reason: Optional reason for authentication failure
        
    Raises:
        HTTPException with 401 status code
        
    Requirements: 1.3 - Return 401 for unauthenticated users
    """
    detail = {
        "error": "authentication_required",
        "message": message
    }
    
    if reason:
        detail["reason"] = reason
    
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"}
    )


# Create a singleton instance for use across the application
_rbac_error_handler: Optional[RBACErrorHandler] = None


def raise_permission_requirement_denied(
    user_id: Union[UUID, str],
    requirement: 'PermissionRequirement',
    result: 'PermissionCheckResult',
    context: Optional[PermissionContext] = None
) -> None:
    """
    Raise an HTTPException for a complex permission requirement denial.
    
    This is a convenience function for raising permission requirement denied
    exceptions in FastAPI endpoints.
    
    Args:
        user_id: The user's ID
        requirement: The PermissionRequirement that was not satisfied
        result: The detailed PermissionCheckResult
        context: Optional permission context
        
    Raises:
        HTTPException with 403 status code and detailed error information
        
    Requirements: 1.3, 1.4 - Return 403 with detailed missing permission info
    """
    missing_permissions = list(result.get_all_missing_permissions())
    missing_names = [p.value for p in missing_permissions]
    required_names = [p.value for p in requirement.get_all_permissions()]
    
    detail = {
        "error": "insufficient_permissions",
        "message": result.get_human_readable_error(),
        "requirement_description": requirement.describe(),
        "required_permissions": required_names,
        "missing_permissions": missing_names
    }
    
    if context:
        detail["context"] = context.model_dump()
    
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=detail
    )


def get_rbac_error_handler(supabase_client=None) -> RBACErrorHandler:
    """
    Get or create the singleton RBACErrorHandler instance.
    
    Args:
        supabase_client: Optional Supabase client to use
        
    Returns:
        The RBACErrorHandler singleton instance
    """
    global _rbac_error_handler
    
    if _rbac_error_handler is None:
        try:
            from config.database import supabase
            _rbac_error_handler = RBACErrorHandler(
                supabase_client or supabase
            )
        except ImportError:
            _rbac_error_handler = RBACErrorHandler(supabase_client)
    
    return _rbac_error_handler
