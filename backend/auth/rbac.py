"""
Role-Based Access Control (RBAC) system
"""

from datetime import datetime
from typing import List, Dict, Any, Optional, Callable
from fastapi import Depends, HTTPException
from enum import Enum

from config.database import supabase
from .dependencies import get_current_user

# Permission and Role Enums
class UserRole(str, Enum):
    admin = "admin"
    portfolio_manager = "portfolio_manager"
    project_manager = "project_manager"
    resource_manager = "resource_manager"
    team_member = "team_member"
    viewer = "viewer"

class Permission(str, Enum):
    # Portfolio permissions
    portfolio_create = "portfolio_create"
    portfolio_read = "portfolio_read"
    portfolio_update = "portfolio_update"
    portfolio_delete = "portfolio_delete"
    
    # Project permissions
    project_create = "project_create"
    project_read = "project_read"
    project_update = "project_update"
    project_delete = "project_delete"
    
    # Resource permissions
    resource_create = "resource_create"
    resource_read = "resource_read"
    resource_update = "resource_update"
    resource_delete = "resource_delete"
    resource_allocate = "resource_allocate"
    
    # Financial permissions
    financial_read = "financial_read"
    financial_create = "financial_create"
    financial_update = "financial_update"
    financial_delete = "financial_delete"
    budget_alert_manage = "budget_alert_manage"
    
    # Risk and Issue permissions
    risk_create = "risk_create"
    risk_read = "risk_read"
    risk_update = "risk_update"
    risk_delete = "risk_delete"
    issue_create = "issue_create"
    issue_read = "issue_read"
    issue_update = "issue_update"
    issue_delete = "issue_delete"
    
    # AI permissions
    ai_rag_query = "ai_rag_query"
    ai_resource_optimize = "ai_resource_optimize"
    ai_risk_forecast = "ai_risk_forecast"
    ai_metrics_read = "ai_metrics_read"
    
    # Admin permissions
    user_manage = "user_manage"
    role_manage = "role_manage"
    admin_read = "admin_read"
    admin_update = "admin_update"
    admin_delete = "admin_delete"
    system_admin = "system_admin"
    data_import = "data_import"
    
    # PMR permissions
    pmr_create = "pmr_create"
    pmr_read = "pmr_read"
    pmr_update = "pmr_update"
    pmr_delete = "pmr_delete"
    pmr_approve = "pmr_approve"
    pmr_export = "pmr_export"
    pmr_collaborate = "pmr_collaborate"
    pmr_ai_insights = "pmr_ai_insights"
    pmr_template_manage = "pmr_template_manage"
    pmr_audit_read = "pmr_audit_read"
    
    # Shareable URL permissions
    shareable_url_create = "shareable_url_create"
    shareable_url_read = "shareable_url_read"
    shareable_url_revoke = "shareable_url_revoke"
    shareable_url_manage = "shareable_url_manage"
    
    # Monte Carlo simulation permissions
    simulation_run = "simulation_run"
    simulation_read = "simulation_read"
    simulation_delete = "simulation_delete"
    simulation_manage = "simulation_manage"
    
    # What-If scenario permissions
    scenario_create = "scenario_create"
    scenario_read = "scenario_read"
    scenario_update = "scenario_update"
    scenario_delete = "scenario_delete"
    scenario_compare = "scenario_compare"
    
    # Change management permissions
    change_create = "change_create"
    change_read = "change_read"
    change_update = "change_update"
    change_delete = "change_delete"
    change_approve = "change_approve"
    change_implement = "change_implement"
    change_audit_read = "change_audit_read"
    
    # PO breakdown permissions
    po_breakdown_import = "po_breakdown_import"
    po_breakdown_create = "po_breakdown_create"
    po_breakdown_read = "po_breakdown_read"
    po_breakdown_update = "po_breakdown_update"
    po_breakdown_delete = "po_breakdown_delete"
    
    # Report generation permissions
    report_generate = "report_generate"
    report_read = "report_read"
    report_template_create = "report_template_create"
    report_template_manage = "report_template_manage"
    
    # Audit trail permissions (Requirements 6.7, 6.8)
    AUDIT_READ = "audit:read"
    AUDIT_EXPORT = "audit:export"
    
    # Workflow permissions (Requirements 3.5)
    workflow_create = "workflow_create"
    workflow_read = "workflow_read"
    workflow_update = "workflow_update"
    workflow_delete = "workflow_delete"
    workflow_approve = "workflow_approve"
    workflow_manage = "workflow_manage"

# Default role permissions configuration
DEFAULT_ROLE_PERMISSIONS = {
    UserRole.admin: [
        # Full access to everything
        Permission.portfolio_create, Permission.portfolio_read, Permission.portfolio_update, Permission.portfolio_delete,
        Permission.project_create, Permission.project_read, Permission.project_update, Permission.project_delete,
        Permission.resource_create, Permission.resource_read, Permission.resource_update, Permission.resource_delete, Permission.resource_allocate,
        Permission.financial_read, Permission.financial_create, Permission.financial_update, Permission.financial_delete, Permission.budget_alert_manage,
        Permission.risk_create, Permission.risk_read, Permission.risk_update, Permission.risk_delete,
        Permission.issue_create, Permission.issue_read, Permission.issue_update, Permission.issue_delete,
        Permission.ai_rag_query, Permission.ai_resource_optimize, Permission.ai_risk_forecast, Permission.ai_metrics_read,
        Permission.user_manage, Permission.role_manage, Permission.system_admin, Permission.data_import,
        Permission.pmr_create, Permission.pmr_read, Permission.pmr_update, Permission.pmr_delete,
        Permission.pmr_approve, Permission.pmr_export, Permission.pmr_collaborate, Permission.pmr_ai_insights,
        Permission.pmr_template_manage, Permission.pmr_audit_read,
        # Generic Construction/Engineering PPM features
        Permission.shareable_url_create, Permission.shareable_url_read, Permission.shareable_url_revoke, Permission.shareable_url_manage,
        Permission.simulation_run, Permission.simulation_read, Permission.simulation_delete, Permission.simulation_manage,
        Permission.scenario_create, Permission.scenario_read, Permission.scenario_update, Permission.scenario_delete, Permission.scenario_compare,
        Permission.change_create, Permission.change_read, Permission.change_update, Permission.change_delete,
        Permission.change_approve, Permission.change_implement, Permission.change_audit_read,
        Permission.po_breakdown_import, Permission.po_breakdown_create, Permission.po_breakdown_read,
        Permission.po_breakdown_update, Permission.po_breakdown_delete,
        Permission.report_generate, Permission.report_read, Permission.report_template_create, Permission.report_template_manage,
        # Audit trail permissions
        Permission.AUDIT_READ, Permission.AUDIT_EXPORT,
        # Workflow permissions
        Permission.workflow_create, Permission.workflow_read, Permission.workflow_update, Permission.workflow_delete,
        Permission.workflow_approve, Permission.workflow_manage
    ],
    UserRole.portfolio_manager: [
        # Portfolio and project management
        Permission.portfolio_create, Permission.portfolio_read, Permission.portfolio_update,
        Permission.project_create, Permission.project_read, Permission.project_update,
        Permission.resource_read, Permission.resource_allocate,
        Permission.financial_read, Permission.financial_create, Permission.financial_update, Permission.budget_alert_manage,
        Permission.risk_read, Permission.risk_update,
        Permission.issue_read, Permission.issue_update,
        Permission.ai_rag_query, Permission.ai_resource_optimize, Permission.ai_risk_forecast, Permission.ai_metrics_read,
        Permission.pmr_create, Permission.pmr_read, Permission.pmr_update, Permission.pmr_approve,
        Permission.pmr_export, Permission.pmr_collaborate, Permission.pmr_ai_insights, Permission.pmr_audit_read,
        # Generic Construction/Engineering PPM features
        Permission.shareable_url_create, Permission.shareable_url_read, Permission.shareable_url_revoke,
        Permission.simulation_run, Permission.simulation_read, Permission.simulation_delete,
        Permission.scenario_create, Permission.scenario_read, Permission.scenario_update, Permission.scenario_delete, Permission.scenario_compare,
        Permission.change_create, Permission.change_read, Permission.change_update, Permission.change_approve,
        Permission.po_breakdown_read, Permission.po_breakdown_update,
        Permission.report_generate, Permission.report_read, Permission.report_template_create,
        # Audit trail permissions
        Permission.AUDIT_READ, Permission.AUDIT_EXPORT,
        # Workflow permissions
        Permission.workflow_create, Permission.workflow_read, Permission.workflow_update,
        Permission.workflow_approve, Permission.workflow_manage
    ],
    UserRole.project_manager: [
        # Project-specific management
        Permission.project_read, Permission.project_update,
        Permission.resource_read, Permission.resource_allocate,
        Permission.financial_read, Permission.financial_create, Permission.financial_update,
        Permission.risk_create, Permission.risk_read, Permission.risk_update,
        Permission.issue_create, Permission.issue_read, Permission.issue_update,
        Permission.ai_rag_query, Permission.ai_resource_optimize, Permission.ai_risk_forecast,
        Permission.pmr_create, Permission.pmr_read, Permission.pmr_update,
        Permission.pmr_export, Permission.pmr_collaborate, Permission.pmr_ai_insights,
        # Generic Construction/Engineering PPM features
        Permission.shareable_url_create, Permission.shareable_url_read,
        Permission.simulation_run, Permission.simulation_read,
        Permission.scenario_create, Permission.scenario_read, Permission.scenario_update, Permission.scenario_compare,
        Permission.change_create, Permission.change_read, Permission.change_update,
        Permission.po_breakdown_read, Permission.po_breakdown_update,
        Permission.report_generate, Permission.report_read,
        # Audit trail permissions
        Permission.AUDIT_READ,
        # Workflow permissions
        Permission.workflow_read, Permission.workflow_approve
    ],
    UserRole.resource_manager: [
        # Resource management focus
        Permission.project_read,
        Permission.resource_create, Permission.resource_read, Permission.resource_update, Permission.resource_allocate,
        Permission.financial_read,
        Permission.risk_read,
        Permission.issue_read,
        Permission.ai_rag_query, Permission.ai_resource_optimize,
        # Generic Construction/Engineering PPM features
        Permission.simulation_read,
        Permission.scenario_read,
        Permission.change_read,
        Permission.po_breakdown_read,
        Permission.report_read,
        # Workflow permissions
        Permission.workflow_read
    ],
    UserRole.team_member: [
        # Basic project participation
        Permission.project_read,
        Permission.resource_read,
        Permission.financial_read,
        Permission.risk_read, Permission.risk_create,
        Permission.issue_read, Permission.issue_create, Permission.issue_update,
        Permission.ai_rag_query,
        # Generic Construction/Engineering PPM features
        Permission.simulation_read,
        Permission.scenario_read,
        Permission.change_create, Permission.change_read,
        Permission.po_breakdown_read,
        Permission.report_read,
        # Workflow permissions
        Permission.workflow_read
    ],
    UserRole.viewer: [
        # Read-only access
        Permission.portfolio_read,
        Permission.project_read,
        Permission.resource_read,
        Permission.financial_read,
        Permission.risk_read,
        Permission.issue_read,
        Permission.ai_rag_query,
        Permission.pmr_read,
        # Generic Construction/Engineering PPM features
        Permission.simulation_read,
        Permission.scenario_read,
        Permission.change_read,
        Permission.po_breakdown_read,
        Permission.report_read,
        # Audit trail permissions (read-only for viewers)
        Permission.AUDIT_READ,
        # Workflow permissions
        Permission.workflow_read
    ]
}

class RoleBasedAccessControl:
    """Role-Based Access Control system for managing user permissions"""
    
    def __init__(self, supabase_client):
        self.supabase = supabase_client
        self._permission_cache = {}
        self._cache_ttl = 300  # 5 minutes cache TTL
        self._cache_timestamps = {}
    
    async def get_user_permissions(self, user_id: str) -> List[Permission]:
        """Get all permissions for a user based on their roles"""
        try:
            # Check cache first
            cache_key = f"user_permissions_{user_id}"
            if self._is_cache_valid(cache_key):
                return self._permission_cache[cache_key]
            
            # Development fix: Give admin permissions to default development user
            if user_id in ["00000000-0000-0000-0000-000000000001", "bf1b1732-2449-4987-9fdb-fefa2a93b816"]:
                print(f"🔧 Development mode: Granting admin permissions to user {user_id}")
                permissions = DEFAULT_ROLE_PERMISSIONS[UserRole.admin]
                self._update_cache(cache_key, permissions)
                return permissions
            
            if not self.supabase:
                # Fallback: return admin permissions for development
                permissions = DEFAULT_ROLE_PERMISSIONS[UserRole.admin]
                self._update_cache(cache_key, permissions)
                return permissions
            
            # Get user's role assignments
            response = self.supabase.table("user_roles").select(
                "role_id, roles(name, permissions)"
            ).eq("user_id", user_id).execute()
            
            if not response.data:
                # No roles assigned, return viewer permissions as default
                permissions = DEFAULT_ROLE_PERMISSIONS[UserRole.viewer]
                self._update_cache(cache_key, permissions)
                return permissions
            
            # Collect all permissions from all roles
            all_permissions = set()
            for assignment in response.data:
                role_data = assignment.get("roles", {})
                role_permissions = role_data.get("permissions", [])
                
                # Convert string permissions to Permission enum
                for perm_str in role_permissions:
                    try:
                        permission = Permission(perm_str)
                        all_permissions.add(permission)
                    except ValueError:
                        print(f"Warning: Invalid permission '{perm_str}' found in role")
                        continue
            
            permissions = list(all_permissions)
            self._update_cache(cache_key, permissions)
            return permissions
            
        except Exception as e:
            print(f"Error getting user permissions: {e}")
            # Fallback to viewer permissions on error
            return DEFAULT_ROLE_PERMISSIONS[UserRole.viewer]
    
    async def has_permission(self, user_id: str, required_permission: Permission) -> bool:
        """Check if user has a specific permission"""
        try:
            user_permissions = await self.get_user_permissions(user_id)
            return required_permission in user_permissions
        except Exception as e:
            print(f"Error checking permission: {e}")
            return False
    
    async def has_any_permission(self, user_id: str, required_permissions: List[Permission]) -> bool:
        """Check if user has any of the specified permissions"""
        try:
            user_permissions = await self.get_user_permissions(user_id)
            return any(perm in user_permissions for perm in required_permissions)
        except Exception as e:
            print(f"Error checking permissions: {e}")
            return False
    
    async def has_all_permissions(self, user_id: str, required_permissions: List[Permission]) -> bool:
        """
        Check if user has all of the specified permissions (AND logic).
        
        Args:
            user_id: The user's ID
            required_permissions: List of permissions that are ALL required
            
        Returns:
            True if the user has ALL of the specified permissions, False otherwise
            
        Requirements: 1.4 - Permission combination logic (AND)
        """
        try:
            user_permissions = await self.get_user_permissions(user_id)
            return all(perm in user_permissions for perm in required_permissions)
        except Exception as e:
            print(f"Error checking all permissions: {e}")
            return False
    
    async def get_missing_permissions(
        self, 
        user_id: str, 
        required_permissions: List[Permission]
    ) -> List[Permission]:
        """
        Get the list of permissions the user is missing from the required set.
        
        Useful for error reporting to tell users exactly what they need.
        
        Args:
            user_id: The user's ID
            required_permissions: List of permissions to check
            
        Returns:
            List of permissions the user is missing
            
        Requirements: 1.4 - Permission combination logic
        """
        try:
            user_permissions = await self.get_user_permissions(user_id)
            return [perm for perm in required_permissions if perm not in user_permissions]
        except Exception as e:
            print(f"Error getting missing permissions: {e}")
            return list(required_permissions)
    
    def _is_cache_valid(self, cache_key: str) -> bool:
        """Check if cache entry is still valid"""
        if cache_key not in self._permission_cache:
            return False
        
        timestamp = self._cache_timestamps.get(cache_key, 0)
        return (datetime.now().timestamp() - timestamp) < self._cache_ttl
    
    def _update_cache(self, cache_key: str, permissions: List[Permission]):
        """Update permission cache"""
        self._permission_cache[cache_key] = permissions
        self._cache_timestamps[cache_key] = datetime.now().timestamp()
    
    def _clear_user_cache(self, user_id: str):
        """Clear cached permissions for a user"""
        cache_key = f"user_permissions_{user_id}"
        if cache_key in self._permission_cache:
            del self._permission_cache[cache_key]
        if cache_key in self._cache_timestamps:
            del self._cache_timestamps[cache_key]

# Initialize RBAC system
rbac = RoleBasedAccessControl(supabase)

# Permission dependency functions
def require_permission(
    required_permission: Permission,
    context_extractor: Any = None
):
    """
    Dependency to require a specific permission with optional context-aware checking.
    
    This function supports both simple permission checking and context-aware checking
    for scoped permissions (project, portfolio, organization).
    
    Args:
        required_permission: The permission required to access the endpoint
        context_extractor: Optional callable that extracts PermissionContext from Request.
                          If provided, enables context-aware permission checking.
                          Can be an async function: async def extractor(request: Request) -> PermissionContext
    
    Returns:
        FastAPI dependency function that validates the permission
    
    Example (simple):
        @app.get("/projects")
        async def list_projects(user = Depends(require_permission(Permission.project_read))):
            ...
    
    Example (context-aware):
        async def extract_project_context(request: Request) -> PermissionContext:
            project_id = request.path_params.get("project_id")
            return PermissionContext(project_id=UUID(project_id) if project_id else None)
        
        @app.get("/projects/{project_id}")
        async def get_project(
            project_id: str,
            user = Depends(require_permission(Permission.project_read, extract_project_context))
        ):
            ...
    
    Requirements: 1.4, 1.5 - Context-aware permission checking with FastAPI integration
    """
    from fastapi import Request
    
    async def permission_checker(request: Request, current_user = Depends(get_current_user)):
        user_id = current_user.get("user_id")
        if not user_id:
            raise HTTPException(
                status_code=401, 
                detail={
                    "error": "authentication_required",
                    "message": "User not authenticated"
                }
            )
        
        # Extract context if context_extractor is provided
        context = None
        if context_extractor is not None:
            try:
                # Support both sync and async context extractors
                import inspect
                if inspect.iscoroutinefunction(context_extractor):
                    context = await context_extractor(request)
                else:
                    context = context_extractor(request)
            except Exception as e:
                # Log but don't fail - fall back to non-context check
                print(f"Warning: Context extraction failed: {e}")
                context = None
        
        # Use enhanced permission checker if context is provided
        if context is not None:
            try:
                from .enhanced_permission_checker import get_enhanced_permission_checker
                from uuid import UUID
                
                enhanced_checker = get_enhanced_permission_checker()
                user_uuid = UUID(user_id) if isinstance(user_id, str) else user_id
                has_perm = await enhanced_checker.check_permission(user_uuid, required_permission, context)
            except ImportError:
                # Fall back to basic permission check if enhanced checker not available
                has_perm = await rbac.has_permission(user_id, required_permission)
        else:
            # Use basic permission check without context
            has_perm = await rbac.has_permission(user_id, required_permission)
        
        if not has_perm:
            raise HTTPException(
                status_code=403, 
                detail={
                    "error": "insufficient_permissions",
                    "message": f"Permission '{required_permission.value}' required",
                    "required_permission": required_permission.value,
                    "context": context.model_dump() if context and hasattr(context, 'model_dump') else None
                }
            )
        
        # Return user with context information if available
        result = dict(current_user)
        if context is not None:
            result["permission_context"] = context
        return result
    
    return permission_checker


def require_any_permission(
    required_permissions: List[Permission],
    context_extractor: Any = None
):
    """
    Dependency to require any of the specified permissions (OR logic) with optional context.
    
    This function checks if the user has at least one of the specified permissions.
    Supports context-aware checking for scoped permissions.
    
    Args:
        required_permissions: List of permissions where at least one is required
        context_extractor: Optional callable that extracts PermissionContext from Request.
                          If provided, enables context-aware permission checking.
    
    Returns:
        FastAPI dependency function that validates the permissions
    
    Example:
        @app.get("/resources")
        async def list_resources(
            user = Depends(require_any_permission([
                Permission.resource_read,
                Permission.admin_read
            ]))
        ):
            ...
    
    Requirements: 1.4, 1.5 - Permission combination logic (OR) with FastAPI integration
    """
    from fastapi import Request
    
    async def permission_checker(request: Request, current_user = Depends(get_current_user)):
        user_id = current_user.get("user_id")
        if not user_id:
            raise HTTPException(
                status_code=401, 
                detail={
                    "error": "authentication_required",
                    "message": "User not authenticated"
                }
            )
        
        # Extract context if context_extractor is provided
        context = None
        if context_extractor is not None:
            try:
                import inspect
                if inspect.iscoroutinefunction(context_extractor):
                    context = await context_extractor(request)
                else:
                    context = context_extractor(request)
            except Exception as e:
                print(f"Warning: Context extraction failed: {e}")
                context = None
        
        # Use enhanced permission checker if context is provided
        if context is not None:
            try:
                from .enhanced_permission_checker import get_enhanced_permission_checker
                from uuid import UUID
                
                enhanced_checker = get_enhanced_permission_checker()
                user_uuid = UUID(user_id) if isinstance(user_id, str) else user_id
                has_any_perm = await enhanced_checker.check_any_permission(
                    user_uuid, required_permissions, context
                )
            except ImportError:
                has_any_perm = await rbac.has_any_permission(user_id, required_permissions)
        else:
            has_any_perm = await rbac.has_any_permission(user_id, required_permissions)
        
        if not has_any_perm:
            perm_names = [perm.value for perm in required_permissions]
            raise HTTPException(
                status_code=403, 
                detail={
                    "error": "insufficient_permissions",
                    "message": f"At least one of these permissions required: {', '.join(perm_names)}",
                    "required_permissions": perm_names,
                    "context": context.model_dump() if context and hasattr(context, 'model_dump') else None
                }
            )
        
        result = dict(current_user)
        if context is not None:
            result["permission_context"] = context
        return result
    
    return permission_checker


def require_all_permissions(
    required_permissions: List[Permission],
    context_extractor: Any = None
):
    """
    Dependency to require all of the specified permissions (AND logic) with optional context.
    
    This function checks if the user has ALL of the specified permissions.
    Supports context-aware checking for scoped permissions.
    
    Args:
        required_permissions: List of permissions that are ALL required
        context_extractor: Optional callable that extracts PermissionContext from Request.
                          If provided, enables context-aware permission checking.
    
    Returns:
        FastAPI dependency function that validates the permissions
    
    Example:
        @app.put("/projects/{project_id}")
        async def update_project(
            project_id: str,
            user = Depends(require_all_permissions([
                Permission.project_read,
                Permission.project_update
            ]))
        ):
            ...
    
    Requirements: 1.4, 1.5 - Permission combination logic (AND) with FastAPI integration
    """
    from fastapi import Request
    
    async def permission_checker(request: Request, current_user = Depends(get_current_user)):
        user_id = current_user.get("user_id")
        if not user_id:
            raise HTTPException(
                status_code=401, 
                detail={
                    "error": "authentication_required",
                    "message": "User not authenticated"
                }
            )
        
        # Extract context if context_extractor is provided
        context = None
        if context_extractor is not None:
            try:
                import inspect
                if inspect.iscoroutinefunction(context_extractor):
                    context = await context_extractor(request)
                else:
                    context = context_extractor(request)
            except Exception as e:
                print(f"Warning: Context extraction failed: {e}")
                context = None
        
        # Track which permissions are satisfied and which are missing
        satisfied_permissions = []
        missing_permissions = []
        
        # Use enhanced permission checker if context is provided
        if context is not None:
            try:
                from .enhanced_permission_checker import get_enhanced_permission_checker
                from uuid import UUID
                
                enhanced_checker = get_enhanced_permission_checker()
                user_uuid = UUID(user_id) if isinstance(user_id, str) else user_id
                
                # Check each permission individually to track which are missing
                has_all, satisfied_permissions, missing_permissions = \
                    await enhanced_checker.check_all_permissions_with_details(
                        user_uuid, required_permissions, context
                    )
            except ImportError:
                # Fall back to basic check
                user_permissions = await rbac.get_user_permissions(user_id)
                for perm in required_permissions:
                    if perm in user_permissions:
                        satisfied_permissions.append(perm)
                    else:
                        missing_permissions.append(perm)
                has_all = len(missing_permissions) == 0
        else:
            # Use basic permission check without context
            user_permissions = await rbac.get_user_permissions(user_id)
            for perm in required_permissions:
                if perm in user_permissions:
                    satisfied_permissions.append(perm)
                else:
                    missing_permissions.append(perm)
            has_all = len(missing_permissions) == 0
        
        if not has_all:
            required_names = [perm.value for perm in required_permissions]
            missing_names = [perm.value for perm in missing_permissions]
            raise HTTPException(
                status_code=403, 
                detail={
                    "error": "insufficient_permissions",
                    "message": f"Missing required permissions: {', '.join(missing_names)}",
                    "required_permissions": required_names,
                    "missing_permissions": missing_names,
                    "context": context.model_dump() if context and hasattr(context, 'model_dump') else None
                }
            )
        
        result = dict(current_user)
        if context is not None:
            result["permission_context"] = context
        return result
    
    return permission_checker


def require_admin():
    """Dependency to require admin role"""
    async def admin_checker(current_user = Depends(get_current_user)):
        user_id = current_user.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        # Check if user has admin permissions
        has_admin = await rbac.has_permission(user_id, Permission.user_manage)
        if not has_admin:
            raise HTTPException(status_code=403, detail="Admin privileges required")
        return current_user
    return admin_checker


# =============================================================================
# Dynamic Permission Evaluation Functions
# Requirements: 1.4, 1.5, 7.1 - Dynamic permission evaluation based on request context
# =============================================================================

def create_project_context_extractor():
    """
    Create a context extractor for project-scoped endpoints.
    
    This factory function creates an async context extractor that extracts
    project context from request path parameters, query parameters, or headers.
    
    Returns:
        Async function that extracts PermissionContext from Request
    
    Example:
        @app.get("/projects/{project_id}")
        async def get_project(
            project_id: str,
            user = Depends(require_permission(
                Permission.project_read,
                create_project_context_extractor()
            ))
        ):
            ...
    
    Requirements: 7.1 - Dynamic permission evaluation based on request context
    """
    from fastapi import Request
    
    async def extractor(request: Request):
        from .enhanced_rbac_models import PermissionContext
        from uuid import UUID
        
        project_id = None
        
        # Try path parameters first
        if hasattr(request, 'path_params'):
            project_id_str = request.path_params.get("project_id")
            if project_id_str:
                try:
                    project_id = UUID(project_id_str)
                except (ValueError, TypeError):
                    pass
        
        # Try query parameters
        if project_id is None:
            project_id_str = request.query_params.get("project_id")
            if project_id_str:
                try:
                    project_id = UUID(project_id_str)
                except (ValueError, TypeError):
                    pass
        
        # Try headers
        if project_id is None:
            project_id_str = request.headers.get("x-project-id")
            if project_id_str:
                try:
                    project_id = UUID(project_id_str)
                except (ValueError, TypeError):
                    pass
        
        return PermissionContext(project_id=project_id)
    
    return extractor


def create_portfolio_context_extractor():
    """
    Create a context extractor for portfolio-scoped endpoints.
    
    This factory function creates an async context extractor that extracts
    portfolio context from request path parameters, query parameters, or headers.
    
    Returns:
        Async function that extracts PermissionContext from Request
    
    Example:
        @app.get("/portfolios/{portfolio_id}")
        async def get_portfolio(
            portfolio_id: str,
            user = Depends(require_permission(
                Permission.portfolio_read,
                create_portfolio_context_extractor()
            ))
        ):
            ...
    
    Requirements: 7.1 - Dynamic permission evaluation based on request context
    """
    from fastapi import Request
    
    async def extractor(request: Request):
        from .enhanced_rbac_models import PermissionContext
        from uuid import UUID
        
        portfolio_id = None
        
        # Try path parameters first
        if hasattr(request, 'path_params'):
            portfolio_id_str = request.path_params.get("portfolio_id")
            if portfolio_id_str:
                try:
                    portfolio_id = UUID(portfolio_id_str)
                except (ValueError, TypeError):
                    pass
        
        # Try query parameters
        if portfolio_id is None:
            portfolio_id_str = request.query_params.get("portfolio_id")
            if portfolio_id_str:
                try:
                    portfolio_id = UUID(portfolio_id_str)
                except (ValueError, TypeError):
                    pass
        
        # Try headers
        if portfolio_id is None:
            portfolio_id_str = request.headers.get("x-portfolio-id")
            if portfolio_id_str:
                try:
                    portfolio_id = UUID(portfolio_id_str)
                except (ValueError, TypeError):
                    pass
        
        return PermissionContext(portfolio_id=portfolio_id)
    
    return extractor


def create_resource_context_extractor():
    """
    Create a context extractor for resource-scoped endpoints.
    
    This factory function creates an async context extractor that extracts
    resource context from request path parameters, query parameters, or headers.
    
    Returns:
        Async function that extracts PermissionContext from Request
    
    Requirements: 7.1 - Dynamic permission evaluation based on request context
    """
    from fastapi import Request
    
    async def extractor(request: Request):
        from .enhanced_rbac_models import PermissionContext
        from uuid import UUID
        
        resource_id = None
        
        # Try path parameters first
        if hasattr(request, 'path_params'):
            resource_id_str = request.path_params.get("resource_id")
            if resource_id_str:
                try:
                    resource_id = UUID(resource_id_str)
                except (ValueError, TypeError):
                    pass
        
        # Try query parameters
        if resource_id is None:
            resource_id_str = request.query_params.get("resource_id")
            if resource_id_str:
                try:
                    resource_id = UUID(resource_id_str)
                except (ValueError, TypeError):
                    pass
        
        # Try headers
        if resource_id is None:
            resource_id_str = request.headers.get("x-resource-id")
            if resource_id_str:
                try:
                    resource_id = UUID(resource_id_str)
                except (ValueError, TypeError):
                    pass
        
        return PermissionContext(resource_id=resource_id)
    
    return extractor


def create_combined_context_extractor():
    """
    Create a context extractor that extracts all context types.
    
    This factory function creates an async context extractor that extracts
    project, portfolio, organization, and resource context from the request.
    
    Returns:
        Async function that extracts PermissionContext from Request
    
    Requirements: 7.1 - Dynamic permission evaluation based on request context
    """
    from fastapi import Request
    
    async def extractor(request: Request):
        from .enhanced_rbac_models import PermissionContext
        from uuid import UUID
        
        def parse_uuid(value):
            if not value:
                return None
            try:
                return UUID(str(value))
            except (ValueError, TypeError):
                return None
        
        project_id = None
        portfolio_id = None
        organization_id = None
        resource_id = None
        
        # Extract from path parameters
        if hasattr(request, 'path_params'):
            project_id = parse_uuid(request.path_params.get("project_id"))
            portfolio_id = parse_uuid(request.path_params.get("portfolio_id"))
            organization_id = parse_uuid(request.path_params.get("organization_id"))
            resource_id = parse_uuid(request.path_params.get("resource_id"))
        
        # Extract from query parameters (if not already set)
        if project_id is None:
            project_id = parse_uuid(request.query_params.get("project_id"))
        if portfolio_id is None:
            portfolio_id = parse_uuid(request.query_params.get("portfolio_id"))
        if organization_id is None:
            organization_id = parse_uuid(request.query_params.get("organization_id"))
        if resource_id is None:
            resource_id = parse_uuid(request.query_params.get("resource_id"))
        
        # Extract from headers (if not already set)
        if project_id is None:
            project_id = parse_uuid(request.headers.get("x-project-id"))
        if portfolio_id is None:
            portfolio_id = parse_uuid(request.headers.get("x-portfolio-id"))
        if organization_id is None:
            organization_id = parse_uuid(request.headers.get("x-organization-id"))
        if resource_id is None:
            resource_id = parse_uuid(request.headers.get("x-resource-id"))
        
        return PermissionContext(
            project_id=project_id,
            portfolio_id=portfolio_id,
            organization_id=organization_id,
            resource_id=resource_id
        )
    
    return extractor