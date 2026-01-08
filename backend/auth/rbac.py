"""
Role-Based Access Control (RBAC) system
"""

from datetime import datetime
from typing import List, Dict, Any
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
        Permission.user_manage, Permission.role_manage, Permission.system_admin, Permission.data_import
    ],
    UserRole.portfolio_manager: [
        # Portfolio and project management
        Permission.portfolio_create, Permission.portfolio_read, Permission.portfolio_update,
        Permission.project_create, Permission.project_read, Permission.project_update,
        Permission.resource_read, Permission.resource_allocate,
        Permission.financial_read, Permission.financial_create, Permission.financial_update, Permission.budget_alert_manage,
        Permission.risk_read, Permission.risk_update,
        Permission.issue_read, Permission.issue_update,
        Permission.ai_rag_query, Permission.ai_resource_optimize, Permission.ai_risk_forecast, Permission.ai_metrics_read
    ],
    UserRole.project_manager: [
        # Project-specific management
        Permission.project_read, Permission.project_update,
        Permission.resource_read, Permission.resource_allocate,
        Permission.financial_read, Permission.financial_create, Permission.financial_update,
        Permission.risk_create, Permission.risk_read, Permission.risk_update,
        Permission.issue_create, Permission.issue_read, Permission.issue_update,
        Permission.ai_rag_query, Permission.ai_resource_optimize, Permission.ai_risk_forecast
    ],
    UserRole.resource_manager: [
        # Resource management focus
        Permission.project_read,
        Permission.resource_create, Permission.resource_read, Permission.resource_update, Permission.resource_allocate,
        Permission.financial_read,
        Permission.risk_read,
        Permission.issue_read,
        Permission.ai_rag_query, Permission.ai_resource_optimize
    ],
    UserRole.team_member: [
        # Basic project participation
        Permission.project_read,
        Permission.resource_read,
        Permission.financial_read,
        Permission.risk_read, Permission.risk_create,
        Permission.issue_read, Permission.issue_create, Permission.issue_update,
        Permission.ai_rag_query
    ],
    UserRole.viewer: [
        # Read-only access
        Permission.portfolio_read,
        Permission.project_read,
        Permission.resource_read,
        Permission.financial_read,
        Permission.risk_read,
        Permission.issue_read,
        Permission.ai_rag_query
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
            if user_id == "00000000-0000-0000-0000-000000000001":
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
def require_permission(required_permission: Permission):
    """Dependency to require a specific permission"""
    async def permission_checker(current_user = Depends(get_current_user)):
        user_id = current_user.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="User not authenticated")
        
        has_perm = await rbac.has_permission(user_id, required_permission)
        if not has_perm:
            raise HTTPException(
                status_code=403, 
                detail=f"Insufficient permissions. Required: {required_permission.value}"
            )
        
        return current_user
    
    return permission_checker

def require_any_permission(required_permissions: List[Permission]):
    """Dependency to require any of the specified permissions"""
    async def permission_checker(current_user = Depends(get_current_user)):
        user_id = current_user.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="User not authenticated")
        
        has_any_perm = await rbac.has_any_permission(user_id, required_permissions)
        if not has_any_perm:
            perm_names = [perm.value for perm in required_permissions]
            raise HTTPException(
                status_code=403, 
                detail=f"Insufficient permissions. Required one of: {', '.join(perm_names)}"
            )
        
        return current_user
    
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