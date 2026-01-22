"""
RBAC Middleware for FastAPI Integration

This module provides the RBACMiddleware class for automatic permission checking
on protected endpoints, seamless integration with FastAPI dependency injection,
and context extraction from request parameters and headers.

Features:
- Automatic permission checking on protected endpoints
- Seamless integration with existing FastAPI dependency injection
- Context extraction from request parameters and headers
- Support for endpoint-level permission configuration
- Caching for performance optimization

Requirements: 1.5 - FastAPI Integration Seamlessness
"""

from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Callable, Set, Union, Awaitable
from uuid import UUID
import logging
import re
import jwt

from fastapi import FastAPI, Request, HTTPException, Depends, status
from fastapi.routing import APIRoute
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from .rbac import Permission
from .enhanced_rbac_models import PermissionContext
from .enhanced_permission_checker import EnhancedPermissionChecker, get_enhanced_permission_checker
from .rbac_error_handler import (
    RBACErrorHandler,
    get_rbac_error_handler,
    AuthenticationError,
    PermissionError,
    create_authentication_required_response,
    create_permission_denied_response,
)

logger = logging.getLogger(__name__)


# =============================================================================
# Endpoint Permission Configuration
# =============================================================================

class EndpointPermissionConfig:
    """
    Configuration for endpoint-level permission requirements.
    
    Stores the mapping between endpoints and their required permissions,
    allowing for automatic permission checking in the middleware.
    """
    
    def __init__(self):
        """Initialize the endpoint permission configuration."""
        # Map of (method, path_pattern) -> List[Permission]
        self._endpoint_permissions: Dict[tuple, List[Permission]] = {}
        # Map of (method, path_pattern) -> bool (True = require all, False = require any)
        self._endpoint_require_all: Dict[tuple, bool] = {}
        # Set of paths that should be excluded from permission checking
        self._excluded_paths: Set[str] = {
            "/",
            "/health",
            "/health/comprehensive",
            "/health/user-sync",
            "/docs",
            "/redoc",
            "/openapi.json",
            "/debug",
        }
        # Compiled regex patterns for path matching
        self._path_patterns: Dict[str, re.Pattern] = {}
    
    def register_endpoint(
        self,
        method: str,
        path: str,
        permissions: List[Permission],
        require_all: bool = False
    ) -> None:
        """
        Register permission requirements for an endpoint.
        
        Args:
            method: HTTP method (GET, POST, PUT, DELETE, etc.)
            path: URL path pattern (can include path parameters like {id})
            permissions: List of required permissions
            require_all: If True, all permissions required (AND); if False, any (OR)
        """
        key = (method.upper(), path)
        self._endpoint_permissions[key] = permissions
        self._endpoint_require_all[key] = require_all
        
        # Compile regex pattern for path matching
        pattern = self._path_to_regex(path)
        self._path_patterns[path] = re.compile(pattern)
    
    def _path_to_regex(self, path: str) -> str:
        """
        Convert a FastAPI path pattern to a regex pattern.
        
        Args:
            path: FastAPI path pattern (e.g., "/projects/{project_id}")
            
        Returns:
            Regex pattern string
        """
        # Escape special regex characters except { and }
        escaped = re.escape(path)
        # Replace escaped path parameters with regex groups
        # {param_name} -> (?P<param_name>[^/]+)
        pattern = re.sub(
            r'\\{([^}]+)\\}',
            r'(?P<\1>[^/]+)',
            escaped
        )
        return f"^{pattern}$"

    def get_endpoint_permissions(
        self,
        method: str,
        path: str
    ) -> Optional[tuple]:
        """
        Get permission requirements for an endpoint.
        
        Args:
            method: HTTP method
            path: Request path
            
        Returns:
            Tuple of (permissions, require_all) or None if no permissions required
        """
        method = method.upper()
        
        # Check for exact match first
        key = (method, path)
        if key in self._endpoint_permissions:
            return (
                self._endpoint_permissions[key],
                self._endpoint_require_all.get(key, False)
            )
        
        # Check for pattern matches
        for (reg_method, reg_path), permissions in self._endpoint_permissions.items():
            if reg_method != method:
                continue
            
            pattern = self._path_patterns.get(reg_path)
            if pattern and pattern.match(path):
                return (
                    permissions,
                    self._endpoint_require_all.get((reg_method, reg_path), False)
                )
        
        return None
    
    def is_excluded(self, path: str) -> bool:
        """
        Check if a path is excluded from permission checking.
        
        Args:
            path: Request path
            
        Returns:
            True if the path should be excluded from permission checking
        """
        return path in self._excluded_paths
    
    def exclude_path(self, path: str) -> None:
        """
        Add a path to the exclusion list.
        
        Args:
            path: Path to exclude from permission checking
        """
        self._excluded_paths.add(path)
    
    def extract_path_params(self, path: str, pattern_path: str) -> Dict[str, str]:
        """
        Extract path parameters from a request path.
        
        Args:
            path: Actual request path
            pattern_path: Registered path pattern
            
        Returns:
            Dictionary of parameter names to values
        """
        pattern = self._path_patterns.get(pattern_path)
        if not pattern:
            return {}
        
        match = pattern.match(path)
        if match:
            return match.groupdict()
        return {}


# Global endpoint permission configuration
_endpoint_config = EndpointPermissionConfig()


def get_endpoint_config() -> EndpointPermissionConfig:
    """Get the global endpoint permission configuration."""
    return _endpoint_config


# =============================================================================
# Context Extraction
# =============================================================================

class ContextExtractor:
    """
    Extracts permission context from request parameters and headers.
    
    Supports extraction from:
    - Path parameters (e.g., /projects/{project_id})
    - Query parameters (e.g., ?project_id=xxx)
    - Request headers (e.g., X-Project-ID)
    - Request body (for POST/PUT requests)
    
    Requirements: 1.5 - Context extraction from request parameters and headers
    """
    
    # Header names for context extraction
    PROJECT_ID_HEADER = "x-project-id"
    PORTFOLIO_ID_HEADER = "x-portfolio-id"
    ORGANIZATION_ID_HEADER = "x-organization-id"
    RESOURCE_ID_HEADER = "x-resource-id"
    
    # Query parameter names
    PROJECT_ID_PARAM = "project_id"
    PORTFOLIO_ID_PARAM = "portfolio_id"
    ORGANIZATION_ID_PARAM = "organization_id"
    RESOURCE_ID_PARAM = "resource_id"
    
    @classmethod
    async def extract_context(
        cls,
        request: Request,
        path_params: Optional[Dict[str, str]] = None
    ) -> PermissionContext:
        """
        Extract permission context from a request.
        
        Priority order for each context field:
        1. Path parameters
        2. Query parameters
        3. Headers
        4. Request body (for POST/PUT/PATCH)
        
        Args:
            request: FastAPI Request object
            path_params: Optional pre-extracted path parameters
            
        Returns:
            PermissionContext with extracted values
        """
        project_id = None
        portfolio_id = None
        organization_id = None
        resource_id = None
        
        # Extract from path parameters
        if path_params:
            project_id = cls._parse_uuid(path_params.get(cls.PROJECT_ID_PARAM))
            portfolio_id = cls._parse_uuid(path_params.get(cls.PORTFOLIO_ID_PARAM))
            organization_id = cls._parse_uuid(path_params.get(cls.ORGANIZATION_ID_PARAM))
            resource_id = cls._parse_uuid(path_params.get(cls.RESOURCE_ID_PARAM))
        
        # Extract from query parameters (if not already set)
        query_params = dict(request.query_params)
        if not project_id:
            project_id = cls._parse_uuid(query_params.get(cls.PROJECT_ID_PARAM))
        if not portfolio_id:
            portfolio_id = cls._parse_uuid(query_params.get(cls.PORTFOLIO_ID_PARAM))
        if not organization_id:
            organization_id = cls._parse_uuid(query_params.get(cls.ORGANIZATION_ID_PARAM))
        if not resource_id:
            resource_id = cls._parse_uuid(query_params.get(cls.RESOURCE_ID_PARAM))
        
        # Extract from headers (if not already set)
        if not project_id:
            project_id = cls._parse_uuid(request.headers.get(cls.PROJECT_ID_HEADER))
        if not portfolio_id:
            portfolio_id = cls._parse_uuid(request.headers.get(cls.PORTFOLIO_ID_HEADER))
        if not organization_id:
            organization_id = cls._parse_uuid(request.headers.get(cls.ORGANIZATION_ID_HEADER))
        if not resource_id:
            resource_id = cls._parse_uuid(request.headers.get(cls.RESOURCE_ID_HEADER))
        
        # Extract from request body for POST/PUT/PATCH (if not already set)
        if request.method in ("POST", "PUT", "PATCH"):
            body_context = await cls._extract_from_body(request)
            if not project_id:
                project_id = body_context.get("project_id")
            if not portfolio_id:
                portfolio_id = body_context.get("portfolio_id")
            if not organization_id:
                organization_id = body_context.get("organization_id")
            if not resource_id:
                resource_id = body_context.get("resource_id")
        
        return PermissionContext(
            project_id=project_id,
            portfolio_id=portfolio_id,
            organization_id=organization_id,
            resource_id=resource_id
        )

    @classmethod
    async def _extract_from_body(cls, request: Request) -> Dict[str, Optional[UUID]]:
        """
        Extract context IDs from request body.
        
        Args:
            request: FastAPI Request object
            
        Returns:
            Dictionary with extracted UUIDs
        """
        result = {
            "project_id": None,
            "portfolio_id": None,
            "organization_id": None,
            "resource_id": None
        }
        
        try:
            # Try to get cached body or read it
            body = await request.body()
            if not body:
                return result
            
            # Try to parse as JSON
            import json
            try:
                data = json.loads(body)
            except json.JSONDecodeError:
                return result
            
            if not isinstance(data, dict):
                return result
            
            # Extract IDs from body
            result["project_id"] = cls._parse_uuid(data.get(cls.PROJECT_ID_PARAM))
            result["portfolio_id"] = cls._parse_uuid(data.get(cls.PORTFOLIO_ID_PARAM))
            result["organization_id"] = cls._parse_uuid(data.get(cls.ORGANIZATION_ID_PARAM))
            result["resource_id"] = cls._parse_uuid(data.get(cls.RESOURCE_ID_PARAM))
            
        except Exception as e:
            logger.debug(f"Error extracting context from body: {e}")
        
        return result
    
    @staticmethod
    def _parse_uuid(value: Optional[str]) -> Optional[UUID]:
        """
        Parse a string value to UUID.
        
        Args:
            value: String value to parse
            
        Returns:
            UUID if valid, None otherwise
        """
        if not value:
            return None
        
        try:
            return UUID(str(value))
        except (ValueError, TypeError):
            return None
    
    @classmethod
    def create_context_from_dict(cls, data: Dict[str, Any]) -> PermissionContext:
        """
        Create a PermissionContext from a dictionary.
        
        Args:
            data: Dictionary with context fields
            
        Returns:
            PermissionContext instance
        """
        return PermissionContext(
            project_id=cls._parse_uuid(data.get(cls.PROJECT_ID_PARAM)),
            portfolio_id=cls._parse_uuid(data.get(cls.PORTFOLIO_ID_PARAM)),
            organization_id=cls._parse_uuid(data.get(cls.ORGANIZATION_ID_PARAM)),
            resource_id=cls._parse_uuid(data.get(cls.RESOURCE_ID_PARAM))
        )


# =============================================================================
# User Extraction
# =============================================================================

class UserExtractor:
    """
    Extracts user information from JWT tokens in requests.
    
    Supports:
    - Bearer token authentication
    - Development mode fallback
    """
    
    # Development mode user IDs
    DEV_USER_IDS = {
        "00000000-0000-0000-0000-000000000001",
        "bf1b1732-2449-4987-9fdb-fefa2a93b816"
    }
    
    @classmethod
    async def get_current_user(cls, request: Request) -> Optional[Dict[str, Any]]:
        """
        Extract user information from the request.
        
        Args:
            request: FastAPI Request object
            
        Returns:
            Dictionary with user_id and email, or None if not authenticated
        """
        # Get Authorization header
        auth_header = request.headers.get("authorization")
        
        if not auth_header:
            # Development mode fallback
            logger.debug("No authorization header, using development fallback")
            return {
                "user_id": "00000000-0000-0000-0000-000000000001",
                "email": "dev@example.com"
            }
        
        # Parse Bearer token
        if not auth_header.startswith("Bearer "):
            logger.warning("Invalid authorization header format")
            return None
        
        token = auth_header[7:]  # Remove "Bearer " prefix
        
        try:
            # Decode JWT without verification (for development)
            # In production, this should verify the signature
            payload = jwt.decode(token, options={"verify_signature": False})
            
            user_id = payload.get("sub")
            if not user_id or user_id == "anon":
                # Development fallback
                user_id = "00000000-0000-0000-0000-000000000001"
                logger.debug(f"Using default user ID: {user_id}")
            
            return {
                "user_id": user_id,
                "email": payload.get("email", "dev@example.com")
            }
            
        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid JWT token: {e}")
            return None
        except Exception as e:
            logger.error(f"Error decoding JWT: {e}")
            # Development fallback
            return {
                "user_id": "00000000-0000-0000-0000-000000000001",
                "email": "dev@example.com"
            }
    
    @classmethod
    def get_user_id(cls, user: Optional[Dict[str, Any]]) -> Optional[UUID]:
        """
        Extract user ID as UUID from user dictionary.
        
        Args:
            user: User dictionary from get_current_user
            
        Returns:
            User ID as UUID, or None
        """
        if not user:
            return None
        
        user_id = user.get("user_id")
        if not user_id:
            return None
        
        try:
            return UUID(str(user_id))
        except (ValueError, TypeError):
            return None


# =============================================================================
# RBAC Middleware
# =============================================================================

class RBACMiddleware(BaseHTTPMiddleware):
    """
    FastAPI middleware for automatic permission checking on protected endpoints.
    
    This middleware:
    1. Extracts user from JWT token
    2. Checks if endpoint requires permissions
    3. Extracts permission context from request
    4. Validates user has required permissions
    5. Returns appropriate error responses for failures
    
    Requirements: 1.5 - FastAPI Integration Seamlessness
    """
    
    def __init__(
        self,
        app: ASGIApp,
        permission_checker: Optional[EnhancedPermissionChecker] = None,
        error_handler: Optional[RBACErrorHandler] = None,
        endpoint_config: Optional[EndpointPermissionConfig] = None,
        enable_logging: bool = True
    ):
        """
        Initialize the RBAC middleware.
        
        Args:
            app: The ASGI application
            permission_checker: EnhancedPermissionChecker instance
            error_handler: RBACErrorHandler instance
            endpoint_config: EndpointPermissionConfig instance
            enable_logging: Whether to enable security event logging
        """
        super().__init__(app)
        self.permission_checker = permission_checker or get_enhanced_permission_checker()
        self.error_handler = error_handler or get_rbac_error_handler()
        self.endpoint_config = endpoint_config or get_endpoint_config()
        self.enable_logging = enable_logging
    
    async def dispatch(self, request: Request, call_next: Callable) -> Any:
        """
        Process the request through RBAC middleware.
        
        Args:
            request: The incoming request
            call_next: The next middleware/handler in the chain
            
        Returns:
            Response from the handler or error response
        """
        # Skip permission checking for excluded paths
        if self.endpoint_config.is_excluded(request.url.path):
            return await call_next(request)
        
        # Get endpoint permission requirements
        perm_config = self.endpoint_config.get_endpoint_permissions(
            request.method,
            request.url.path
        )
        
        # If no permissions configured for this endpoint, pass through
        if not perm_config:
            return await call_next(request)
        
        permissions, require_all = perm_config
        
        # Extract user from request
        user = await UserExtractor.get_current_user(request)
        
        if not user:
            # User not authenticated
            if self.enable_logging:
                await self.error_handler.log_security_event(
                    event_type=self.error_handler._security_events[0].event_type 
                    if self.error_handler._security_events else "authentication_failed",
                    request=request
                )
            return create_authentication_required_response(
                message="Authentication required",
                reason="No valid authentication token provided"
            )
        
        user_id = UserExtractor.get_user_id(user)
        if not user_id:
            return create_authentication_required_response(
                message="Authentication required",
                reason="Invalid user ID in token"
            )
        
        # Extract permission context from request
        context = await ContextExtractor.extract_context(request)
        
        # Check permissions
        try:
            if require_all:
                has_permission = await self.permission_checker.check_all_permissions(
                    user_id, permissions, context
                )
            else:
                has_permission = await self.permission_checker.check_any_permission(
                    user_id, permissions, context
                )
            
            if not has_permission:
                # Permission denied
                if self.enable_logging:
                    from .rbac_error_handler import SecurityEventType
                    await self.error_handler.log_security_event(
                        event_type=SecurityEventType.PERMISSION_DENIED,
                        user_id=str(user_id),
                        permissions=[p.value for p in permissions],
                        context=context.model_dump() if context else None,
                        request=request
                    )
                
                # Return appropriate error response
                if len(permissions) == 1:
                    return create_permission_denied_response(
                        permission=permissions[0],
                        context=context,
                        message=f"Permission '{permissions[0].value}' required"
                    )
                else:
                    perm_names = [p.value for p in permissions]
                    logic = "all" if require_all else "any"
                    return JSONResponse(
                        status_code=status.HTTP_403_FORBIDDEN,
                        content={
                            "error": "insufficient_permissions",
                            "message": f"Missing required permissions ({logic} of: {', '.join(perm_names)})",
                            "required_permissions": perm_names,
                            "require_all": require_all,
                            "context": context.model_dump() if context else None,
                            "timestamp": datetime.now(timezone.utc).isoformat()
                        }
                    )
            
            # Permission granted, continue to handler
            # Store user and context in request state for use in handlers
            request.state.rbac_user = user
            request.state.rbac_user_id = user_id
            request.state.rbac_context = context
            
            return await call_next(request)
            
        except Exception as e:
            logger.error(f"Error in RBAC middleware: {e}")
            # On error, deny access for security
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "error": "internal_error",
                    "message": "An error occurred while checking permissions",
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            )


# =============================================================================
# Enhanced Permission Dependencies for FastAPI
# =============================================================================

def require_permission_with_context(
    permission: Permission,
    context_extractor: Optional[Callable[[Request], Awaitable[PermissionContext]]] = None
) -> Callable:
    """
    Create a FastAPI dependency that requires a specific permission with context.
    
    This is an enhanced version of require_permission that supports context-aware
    permission checking.
    
    Args:
        permission: The required permission
        context_extractor: Optional async function to extract context from request
        
    Returns:
        FastAPI dependency function
        
    Requirements: 1.5 - Seamless integration with FastAPI dependency injection
    
    Example:
        @app.get("/projects/{project_id}")
        async def get_project(
            project_id: str,
            user = Depends(require_permission_with_context(
                Permission.project_read,
                context_extractor=extract_project_context
            ))
        ):
            ...
    """
    async def permission_dependency(request: Request) -> Dict[str, Any]:
        # Get current user
        user = await UserExtractor.get_current_user(request)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "error": "authentication_required",
                    "message": "Authentication required"
                },
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        user_id = UserExtractor.get_user_id(user)
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "error": "authentication_required",
                    "message": "Invalid user ID"
                },
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        # Extract context
        context = None
        if context_extractor:
            context = await context_extractor(request)
        else:
            context = await ContextExtractor.extract_context(request)
        
        # Check permission
        permission_checker = get_enhanced_permission_checker()
        has_permission = await permission_checker.check_permission(
            user_id, permission, context
        )
        
        if not has_permission:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "insufficient_permissions",
                    "message": f"Permission '{permission.value}' required",
                    "required_permission": permission.value,
                    "context": context.model_dump() if context else None
                }
            )
        
        # Return user info with context
        return {
            **user,
            "user_id_uuid": user_id,
            "context": context
        }
    
    return permission_dependency


def require_any_permission_with_context(
    permissions: List[Permission],
    context_extractor: Optional[Callable[[Request], Awaitable[PermissionContext]]] = None
) -> Callable:
    """
    Create a FastAPI dependency that requires any of the specified permissions.
    
    Args:
        permissions: List of permissions where at least one is required (OR logic)
        context_extractor: Optional async function to extract context from request
        
    Returns:
        FastAPI dependency function
        
    Requirements: 1.4, 1.5 - Permission combination logic with FastAPI integration
    """
    async def permission_dependency(request: Request) -> Dict[str, Any]:
        # Get current user
        user = await UserExtractor.get_current_user(request)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "error": "authentication_required",
                    "message": "Authentication required"
                },
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        user_id = UserExtractor.get_user_id(user)
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "error": "authentication_required",
                    "message": "Invalid user ID"
                },
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        # Extract context
        context = None
        if context_extractor:
            context = await context_extractor(request)
        else:
            context = await ContextExtractor.extract_context(request)
        
        # Check permissions (OR logic)
        permission_checker = get_enhanced_permission_checker()
        has_permission = await permission_checker.check_any_permission(
            user_id, permissions, context
        )
        
        if not has_permission:
            perm_names = [p.value for p in permissions]
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "insufficient_permissions",
                    "message": f"At least one of these permissions required: {', '.join(perm_names)}",
                    "required_permissions": perm_names,
                    "context": context.model_dump() if context else None
                }
            )
        
        return {
            **user,
            "user_id_uuid": user_id,
            "context": context
        }
    
    return permission_dependency


def require_all_permissions_with_context(
    permissions: List[Permission],
    context_extractor: Optional[Callable[[Request], Awaitable[PermissionContext]]] = None
) -> Callable:
    """
    Create a FastAPI dependency that requires all of the specified permissions.
    
    Args:
        permissions: List of permissions that are all required (AND logic)
        context_extractor: Optional async function to extract context from request
        
    Returns:
        FastAPI dependency function
        
    Requirements: 1.4, 1.5 - Permission combination logic with FastAPI integration
    """
    async def permission_dependency(request: Request) -> Dict[str, Any]:
        # Get current user
        user = await UserExtractor.get_current_user(request)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "error": "authentication_required",
                    "message": "Authentication required"
                },
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        user_id = UserExtractor.get_user_id(user)
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "error": "authentication_required",
                    "message": "Invalid user ID"
                },
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        # Extract context
        context = None
        if context_extractor:
            context = await context_extractor(request)
        else:
            context = await ContextExtractor.extract_context(request)
        
        # Check permissions (AND logic)
        permission_checker = get_enhanced_permission_checker()
        all_satisfied, satisfied, missing = await permission_checker.check_all_permissions_with_details(
            user_id, permissions, context
        )
        
        if not all_satisfied:
            missing_names = [p.value for p in missing]
            required_names = [p.value for p in permissions]
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "insufficient_permissions",
                    "message": f"Missing required permissions: {', '.join(missing_names)}",
                    "required_permissions": required_names,
                    "missing_permissions": missing_names,
                    "context": context.model_dump() if context else None
                }
            )
        
        return {
            **user,
            "user_id_uuid": user_id,
            "context": context
        }
    
    return permission_dependency


# =============================================================================
# Context Extractor Factories
# =============================================================================

def create_project_context_extractor() -> Callable[[Request], Awaitable[PermissionContext]]:
    """
    Create a context extractor for project-scoped endpoints.
    
    Returns:
        Async function that extracts project context from request
    """
    async def extractor(request: Request) -> PermissionContext:
        # Try to get project_id from path parameters
        project_id = request.path_params.get("project_id")
        if project_id:
            try:
                return PermissionContext(project_id=UUID(project_id))
            except (ValueError, TypeError):
                pass
        
        # Fall back to general context extraction
        return await ContextExtractor.extract_context(request)
    
    return extractor


def create_portfolio_context_extractor() -> Callable[[Request], Awaitable[PermissionContext]]:
    """
    Create a context extractor for portfolio-scoped endpoints.
    
    Returns:
        Async function that extracts portfolio context from request
    """
    async def extractor(request: Request) -> PermissionContext:
        # Try to get portfolio_id from path parameters
        portfolio_id = request.path_params.get("portfolio_id")
        if portfolio_id:
            try:
                return PermissionContext(portfolio_id=UUID(portfolio_id))
            except (ValueError, TypeError):
                pass
        
        # Fall back to general context extraction
        return await ContextExtractor.extract_context(request)
    
    return extractor


# =============================================================================
# Decorator for Endpoint Permission Configuration
# =============================================================================

def protected_endpoint(
    permissions: Union[Permission, List[Permission]],
    require_all: bool = False
) -> Callable:
    """
    Decorator to mark an endpoint as requiring specific permissions.
    
    This decorator registers the endpoint's permission requirements with
    the global endpoint configuration, allowing the middleware to
    automatically check permissions.
    
    Args:
        permissions: Single permission or list of permissions required
        require_all: If True, all permissions required (AND); if False, any (OR)
        
    Returns:
        Decorator function
        
    Example:
        @app.get("/projects/{project_id}")
        @protected_endpoint(Permission.project_read)
        async def get_project(project_id: str):
            ...
        
        @app.post("/projects")
        @protected_endpoint([Permission.project_create, Permission.portfolio_update], require_all=True)
        async def create_project(data: ProjectCreate):
            ...
    """
    if isinstance(permissions, Permission):
        permissions = [permissions]
    
    def decorator(func: Callable) -> Callable:
        # Store permission requirements on the function for later registration
        func._rbac_permissions = permissions
        func._rbac_require_all = require_all
        return func
    
    return decorator


def register_protected_endpoints(app: FastAPI) -> None:
    """
    Register all protected endpoints from the FastAPI app.
    
    This function scans all routes in the app and registers permission
    requirements for endpoints decorated with @protected_endpoint.
    
    Args:
        app: FastAPI application instance
    """
    config = get_endpoint_config()
    
    for route in app.routes:
        if isinstance(route, APIRoute):
            endpoint = route.endpoint
            
            # Check if endpoint has permission requirements
            permissions = getattr(endpoint, '_rbac_permissions', None)
            require_all = getattr(endpoint, '_rbac_require_all', False)
            
            if permissions:
                for method in route.methods:
                    config.register_endpoint(
                        method=method,
                        path=route.path,
                        permissions=permissions,
                        require_all=require_all
                    )
                    logger.info(
                        f"Registered RBAC protection for {method} {route.path}: "
                        f"{[p.value for p in permissions]} (require_all={require_all})"
                    )


# =============================================================================
# Middleware Setup Helper
# =============================================================================

def setup_rbac_middleware(
    app: FastAPI,
    permission_checker: Optional[EnhancedPermissionChecker] = None,
    error_handler: Optional[RBACErrorHandler] = None,
    auto_register_endpoints: bool = True
) -> RBACMiddleware:
    """
    Set up RBAC middleware for a FastAPI application.
    
    This is a convenience function that:
    1. Creates the RBAC middleware
    2. Adds it to the application
    3. Optionally registers protected endpoints
    
    Args:
        app: FastAPI application instance
        permission_checker: Optional EnhancedPermissionChecker instance
        error_handler: Optional RBACErrorHandler instance
        auto_register_endpoints: Whether to automatically register protected endpoints
        
    Returns:
        The created RBACMiddleware instance
        
    Example:
        app = FastAPI()
        rbac_middleware = setup_rbac_middleware(app)
    """
    # Create middleware
    middleware = RBACMiddleware(
        app=app,
        permission_checker=permission_checker,
        error_handler=error_handler
    )
    
    # Add middleware to app
    app.add_middleware(
        RBACMiddleware,
        permission_checker=permission_checker or get_enhanced_permission_checker(),
        error_handler=error_handler or get_rbac_error_handler()
    )
    
    # Register protected endpoints if requested
    if auto_register_endpoints:
        # This needs to be called after all routes are registered
        # So we add a startup event handler
        @app.on_event("startup")
        async def register_rbac_endpoints():
            register_protected_endpoints(app)
    
    logger.info("RBAC middleware setup complete")
    return middleware


# =============================================================================
# Exports
# =============================================================================

__all__ = [
    # Middleware
    "RBACMiddleware",
    "setup_rbac_middleware",
    
    # Configuration
    "EndpointPermissionConfig",
    "get_endpoint_config",
    
    # Context extraction
    "ContextExtractor",
    
    # User extraction
    "UserExtractor",
    
    # Dependencies
    "require_permission_with_context",
    "require_any_permission_with_context",
    "require_all_permissions_with_context",
    
    # Context extractor factories
    "create_project_context_extractor",
    "create_portfolio_context_extractor",
    
    # Decorators
    "protected_endpoint",
    "register_protected_endpoints",
]
