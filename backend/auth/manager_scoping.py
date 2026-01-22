"""
Manager Role Scoping and Restrictions

This module provides specialized permission checking for manager roles:
- Portfolio managers: Portfolio-level permissions and oversight
- Project managers: Project-specific permissions within assigned projects
- Resource managers: Resource allocation within manager scope

Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
"""

from datetime import datetime, timezone
from typing import List, Optional, Set, Dict, Any
from uuid import UUID
import logging

from .rbac import Permission, UserRole
from .enhanced_rbac_models import (
    PermissionContext,
    ScopeType,
    EffectiveRole,
)
from .enhanced_permission_checker import EnhancedPermissionChecker

logger = logging.getLogger(__name__)


class ManagerScopingChecker:
    """
    Specialized permission checker for manager role scoping.
    
    This class provides:
    - Portfolio manager permission granting and oversight
    - Project manager scope enforcement
    - Resource management scope controls
    - Granular role assignment support
    
    Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
    """
    
    def __init__(self, permission_checker: EnhancedPermissionChecker):
        """
        Initialize the ManagerScopingChecker.
        
        Args:
            permission_checker: EnhancedPermissionChecker instance for base permission checking
        """
        self.permission_checker = permission_checker
        self.supabase = permission_checker.supabase
    
    # =========================================================================
    # Portfolio Manager Permission Implementation
    # Requirements: 5.1, 5.4 - Portfolio manager permission granting and oversight
    # =========================================================================
    
    async def check_portfolio_manager_permission(
        self,
        user_id: UUID,
        permission: Permission,
        portfolio_id: UUID
    ) -> bool:
        """
        Check if a user has portfolio manager permissions for a specific portfolio.
        
        Portfolio managers have:
        - Full permissions within their assigned portfolios
        - Oversight capabilities for all projects in their portfolios
        - Ability to grant permissions to others within their portfolio scope
        
        Args:
            user_id: The user's UUID
            permission: The permission to check
            portfolio_id: The portfolio's UUID
            
        Returns:
            True if the user has the permission as a portfolio manager, False otherwise
            
        Requirements: 5.1 - Portfolio manager permission granting
        """
        try:
            # Check if user is a portfolio manager for this portfolio
            is_portfolio_manager = await self.is_portfolio_manager(user_id, portfolio_id)
            
            if not is_portfolio_manager:
                return False
            
            # Portfolio managers have portfolio-level permissions
            portfolio_manager_permissions = self._get_portfolio_manager_permissions()
            
            return permission in portfolio_manager_permissions
            
        except Exception as e:
            logger.error(f"Error checking portfolio manager permission: {e}")
            return False
    
    async def is_portfolio_manager(
        self,
        user_id: UUID,
        portfolio_id: UUID
    ) -> bool:
        """
        Check if a user is a portfolio manager for a specific portfolio.
        
        Args:
            user_id: The user's UUID
            portfolio_id: The portfolio's UUID
            
        Returns:
            True if the user is a portfolio manager for this portfolio
            
        Requirements: 5.1, 5.4 - Portfolio manager identification
        """
        try:
            # Get portfolio-scoped roles for the user
            portfolio_roles = await self.permission_checker.get_portfolio_roles(
                user_id, portfolio_id
            )
            
            # Check if any role is portfolio_manager
            for role in portfolio_roles:
                if role.role_name == UserRole.portfolio_manager.value:
                    return True
            
            # Also check global portfolio_manager role
            global_roles = await self.permission_checker.get_effective_roles(user_id, None)
            for role in global_roles:
                if (role.role_name == UserRole.portfolio_manager.value and 
                    role.source_type == ScopeType.GLOBAL):
                    return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error checking if user is portfolio manager: {e}")
            return False
    
    async def get_managed_portfolios(
        self,
        user_id: UUID
    ) -> List[UUID]:
        """
        Get all portfolios that a user manages.
        
        Args:
            user_id: The user's UUID
            
        Returns:
            List of portfolio UUIDs that the user manages
            
        Requirements: 5.1, 5.4 - Portfolio manager scope identification
        """
        try:
            if not self.supabase:
                return []
            
            user_id_str = str(user_id)
            
            # Query user_roles for portfolio-scoped portfolio_manager assignments
            response = self.supabase.table("user_roles").select(
                "scope_id, roles(name)"
            ).eq("user_id", user_id_str).eq(
                "scope_type", ScopeType.PORTFOLIO.value
            ).eq("is_active", True).execute()
            
            if not response.data:
                return []
            
            # Filter for portfolio_manager role
            portfolio_ids = []
            for assignment in response.data:
                role_data = assignment.get("roles", {})
                if role_data.get("name") == UserRole.portfolio_manager.value:
                    scope_id = assignment.get("scope_id")
                    if scope_id:
                        try:
                            portfolio_ids.append(UUID(scope_id))
                        except (ValueError, TypeError):
                            continue
            
            return portfolio_ids
            
        except Exception as e:
            logger.error(f"Error getting managed portfolios: {e}")
            return []
    
    async def can_grant_permission_in_portfolio(
        self,
        user_id: UUID,
        portfolio_id: UUID,
        permission_to_grant: Permission
    ) -> bool:
        """
        Check if a portfolio manager can grant a specific permission within their portfolio.
        
        Portfolio managers can grant permissions that are within their own permission set
        and appropriate for the portfolio scope.
        
        Args:
            user_id: The portfolio manager's UUID
            portfolio_id: The portfolio's UUID
            permission_to_grant: The permission to be granted
            
        Returns:
            True if the manager can grant this permission, False otherwise
            
        Requirements: 5.1, 5.4 - Portfolio manager permission granting capability
        """
        try:
            # Check if user is a portfolio manager for this portfolio
            if not await self.is_portfolio_manager(user_id, portfolio_id):
                return False
            
            # Portfolio managers can grant permissions they have themselves
            context = PermissionContext(portfolio_id=portfolio_id)
            has_permission = await self.permission_checker.check_permission(
                user_id, permission_to_grant, context
            )
            
            if not has_permission:
                return False
            
            # Additional check: permission must be appropriate for portfolio scope
            # (e.g., can't grant system_admin within a portfolio)
            portfolio_appropriate_permissions = self._get_portfolio_grantable_permissions()
            
            return permission_to_grant in portfolio_appropriate_permissions
            
        except Exception as e:
            logger.error(f"Error checking if can grant permission in portfolio: {e}")
            return False
    
    # =========================================================================
    # Project Manager Scope Enforcement
    # Requirements: 5.2, 5.5 - Project manager scope enforcement
    # =========================================================================
    
    async def check_project_manager_permission(
        self,
        user_id: UUID,
        permission: Permission,
        project_id: UUID
    ) -> bool:
        """
        Check if a user has project manager permissions for a specific project.
        
        Project managers have:
        - Full permissions within their assigned projects only
        - No access to projects they are not assigned to
        - Project-specific management capabilities
        
        Args:
            user_id: The user's UUID
            permission: The permission to check
            project_id: The project's UUID
            
        Returns:
            True if the user has the permission as a project manager, False otherwise
            
        Requirements: 5.2 - Project manager scope enforcement
        """
        try:
            # Check if user is a project manager for this project
            is_project_manager = await self.is_project_manager(user_id, project_id)
            
            if not is_project_manager:
                return False
            
            # Project managers have project-level permissions
            project_manager_permissions = self._get_project_manager_permissions()
            
            return permission in project_manager_permissions
            
        except Exception as e:
            logger.error(f"Error checking project manager permission: {e}")
            return False
    
    async def is_project_manager(
        self,
        user_id: UUID,
        project_id: UUID
    ) -> bool:
        """
        Check if a user is a project manager for a specific project.
        
        Args:
            user_id: The user's UUID
            project_id: The project's UUID
            
        Returns:
            True if the user is a project manager for this project
            
        Requirements: 5.2, 5.5 - Project manager identification
        """
        try:
            # Get project-scoped roles for the user
            project_roles = await self.permission_checker.get_project_roles(
                user_id, project_id
            )
            
            # Check if any role is project_manager
            for role in project_roles:
                if role.role_name == UserRole.project_manager.value:
                    return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error checking if user is project manager: {e}")
            return False
    
    async def get_managed_projects(
        self,
        user_id: UUID
    ) -> List[UUID]:
        """
        Get all projects that a user manages.
        
        Args:
            user_id: The user's UUID
            
        Returns:
            List of project UUIDs that the user manages
            
        Requirements: 5.2, 5.5 - Project manager scope identification
        """
        try:
            if not self.supabase:
                return []
            
            user_id_str = str(user_id)
            
            # Query user_roles for project-scoped project_manager assignments
            response = self.supabase.table("user_roles").select(
                "scope_id, roles(name)"
            ).eq("user_id", user_id_str).eq(
                "scope_type", ScopeType.PROJECT.value
            ).eq("is_active", True).execute()
            
            if not response.data:
                return []
            
            # Filter for project_manager role
            project_ids = []
            for assignment in response.data:
                role_data = assignment.get("roles", {})
                if role_data.get("name") == UserRole.project_manager.value:
                    scope_id = assignment.get("scope_id")
                    if scope_id:
                        try:
                            project_ids.append(UUID(scope_id))
                        except (ValueError, TypeError):
                            continue
            
            return project_ids
            
        except Exception as e:
            logger.error(f"Error getting managed projects: {e}")
            return []
    
    async def enforce_project_scope(
        self,
        user_id: UUID,
        project_id: UUID,
        permission: Permission
    ) -> bool:
        """
        Enforce that a project manager can only access their assigned projects.
        
        This method ensures that project managers cannot access projects
        outside their assigned scope.
        
        Args:
            user_id: The user's UUID
            project_id: The project's UUID being accessed
            permission: The permission being requested
            
        Returns:
            True if access is allowed, False otherwise
            
        Requirements: 5.2, 5.5 - Project manager scope enforcement
        """
        try:
            # Check if user has global permissions (admins, portfolio managers)
            has_global = await self.permission_checker.has_global_permission(
                user_id, permission
            )
            if has_global:
                return True
            
            # Check if user has portfolio-level access to this project's portfolio
            portfolio_id = await self.permission_checker.get_project_portfolio(project_id)
            if portfolio_id:
                has_portfolio = await self.permission_checker.check_portfolio_permission(
                    user_id, permission, portfolio_id
                )
                if has_portfolio:
                    return True
            
            # Check if user is a project manager for this specific project
            is_manager = await self.is_project_manager(user_id, project_id)
            if not is_manager:
                return False
            
            # Verify the permission is within project manager scope
            return await self.check_project_manager_permission(
                user_id, permission, project_id
            )
            
        except Exception as e:
            logger.error(f"Error enforcing project scope: {e}")
            return False
    
    # =========================================================================
    # Resource Management Scope Controls
    # Requirements: 5.3 - Resource management scope controls
    # =========================================================================
    
    async def check_resource_management_scope(
        self,
        user_id: UUID,
        permission: Permission,
        resource_id: UUID,
        context: Optional[PermissionContext] = None
    ) -> bool:
        """
        Check if a user has resource management permissions within their scope.
        
        Resource management permissions are scoped to:
        - Projects the user manages (project managers)
        - Portfolios the user manages (portfolio managers)
        - Global scope (admins, resource managers)
        
        Args:
            user_id: The user's UUID
            permission: The permission to check
            resource_id: The resource's UUID
            context: Optional context with project/portfolio information
            
        Returns:
            True if the user has resource management permission in scope, False otherwise
            
        Requirements: 5.3 - Resource management scope consistency
        """
        try:
            # Check if user has global resource management permissions
            has_global = await self.permission_checker.has_global_permission(
                user_id, permission
            )
            if has_global:
                return True
            
            # If context is provided, check scoped permissions
            if context:
                # Check portfolio-level resource management
                if context.portfolio_id:
                    is_portfolio_manager = await self.is_portfolio_manager(
                        user_id, context.portfolio_id
                    )
                    if is_portfolio_manager:
                        portfolio_perms = self._get_portfolio_manager_permissions()
                        if permission in portfolio_perms:
                            return True
                
                # Check project-level resource management
                if context.project_id:
                    is_project_manager = await self.is_project_manager(
                        user_id, context.project_id
                    )
                    if is_project_manager:
                        project_perms = self._get_project_manager_permissions()
                        if permission in project_perms:
                            return True
            
            # Get resource assignment context from database
            resource_context = await self._get_resource_context(resource_id)
            if resource_context:
                # Check if user manages the project/portfolio this resource is assigned to
                if resource_context.project_id:
                    is_manager = await self.is_project_manager(
                        user_id, resource_context.project_id
                    )
                    if is_manager:
                        project_perms = self._get_project_manager_permissions()
                        if permission in project_perms:
                            return True
                
                if resource_context.portfolio_id:
                    is_manager = await self.is_portfolio_manager(
                        user_id, resource_context.portfolio_id
                    )
                    if is_manager:
                        portfolio_perms = self._get_portfolio_manager_permissions()
                        if permission in portfolio_perms:
                            return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error checking resource management scope: {e}")
            return False
    
    async def get_resource_management_scope(
        self,
        user_id: UUID
    ) -> Dict[str, List[UUID]]:
        """
        Get the complete resource management scope for a user.
        
        Returns a dictionary with:
        - 'projects': List of project IDs the user can manage resources in
        - 'portfolios': List of portfolio IDs the user can manage resources in
        - 'global': Boolean indicating if user has global resource management
        
        Args:
            user_id: The user's UUID
            
        Returns:
            Dictionary with resource management scope information
            
        Requirements: 5.3 - Resource management scope identification
        """
        try:
            scope = {
                'projects': [],
                'portfolios': [],
                'global': False
            }
            
            # Check for global resource management permissions
            has_global = await self.permission_checker.has_global_permission(
                user_id, Permission.resource_allocate
            )
            scope['global'] = has_global
            
            if has_global:
                # Global managers have access to all resources
                return scope
            
            # Get managed projects
            scope['projects'] = await self.get_managed_projects(user_id)
            
            # Get managed portfolios
            scope['portfolios'] = await self.get_managed_portfolios(user_id)
            
            return scope
            
        except Exception as e:
            logger.error(f"Error getting resource management scope: {e}")
            return {'projects': [], 'portfolios': [], 'global': False}
    
    # =========================================================================
    # Helper Methods
    # =========================================================================
    
    def _get_portfolio_manager_permissions(self) -> Set[Permission]:
        """
        Get the set of permissions available to portfolio managers.
        
        Returns:
            Set of Permission enums for portfolio managers
        """
        from .rbac import DEFAULT_ROLE_PERMISSIONS
        return set(DEFAULT_ROLE_PERMISSIONS[UserRole.portfolio_manager])
    
    def _get_project_manager_permissions(self) -> Set[Permission]:
        """
        Get the set of permissions available to project managers.
        
        Returns:
            Set of Permission enums for project managers
        """
        from .rbac import DEFAULT_ROLE_PERMISSIONS
        return set(DEFAULT_ROLE_PERMISSIONS[UserRole.project_manager])
    
    def _get_portfolio_grantable_permissions(self) -> Set[Permission]:
        """
        Get the set of permissions that portfolio managers can grant to others.
        
        Portfolio managers can grant most permissions except system-level ones.
        
        Returns:
            Set of Permission enums that can be granted within a portfolio
        """
        portfolio_perms = self._get_portfolio_manager_permissions()
        
        # Exclude system-level permissions that shouldn't be granted at portfolio level
        excluded = {
            Permission.system_admin,
            Permission.user_manage,
            Permission.role_manage,
            Permission.data_import,
        }
        
        return portfolio_perms - excluded
    
    async def _get_resource_context(
        self,
        resource_id: UUID
    ) -> Optional[PermissionContext]:
        """
        Get the context (project/portfolio) for a resource.
        
        Args:
            resource_id: The resource's UUID
            
        Returns:
            PermissionContext with project/portfolio information, or None
        """
        try:
            if not self.supabase:
                return None
            
            # Query resources table for project/portfolio assignment
            response = self.supabase.table("resources").select(
                "project_id, portfolio_id"
            ).eq("id", str(resource_id)).execute()
            
            if not response.data or len(response.data) == 0:
                return None
            
            data = response.data[0]
            project_id_str = data.get("project_id")
            portfolio_id_str = data.get("portfolio_id")
            
            project_id = UUID(project_id_str) if project_id_str else None
            portfolio_id = UUID(portfolio_id_str) if portfolio_id_str else None
            
            if project_id or portfolio_id:
                return PermissionContext(
                    project_id=project_id,
                    portfolio_id=portfolio_id
                )
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting resource context: {e}")
            return None


# Create a singleton instance
_manager_scoping_checker: Optional[ManagerScopingChecker] = None


def get_manager_scoping_checker() -> ManagerScopingChecker:
    """
    Get or create the singleton ManagerScopingChecker instance.
    
    Returns:
        The ManagerScopingChecker singleton instance
    """
    global _manager_scoping_checker
    
    if _manager_scoping_checker is None:
        from .enhanced_permission_checker import get_enhanced_permission_checker
        permission_checker = get_enhanced_permission_checker()
        _manager_scoping_checker = ManagerScopingChecker(permission_checker)
    
    return _manager_scoping_checker
