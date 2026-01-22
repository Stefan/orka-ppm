"""
Enhanced Permission Checker with Context-Aware Evaluation

This module provides the EnhancedPermissionChecker class that supports:
- Context-aware permission evaluation
- Scoped permission checking (project, portfolio, organization)
- Permission aggregation across multiple roles
- Caching for performance optimization
- Portfolio-to-project permission inheritance

Requirements: 1.1, 1.2, 2.5, 7.1
"""

from datetime import datetime, timezone
from typing import List, Optional, Dict, Any, Set, Tuple
from uuid import UUID
import logging

from .rbac import Permission, UserRole, DEFAULT_ROLE_PERMISSIONS
from .enhanced_rbac_models import (
    PermissionContext,
    RoleAssignment,
    ScopeType,
    EffectiveRole,
    UserPermissionsResponse,
)
from .permission_cache import PermissionCache, get_permission_cache

logger = logging.getLogger(__name__)


class EnhancedPermissionChecker:
    """
    Enhanced permission checker with context-aware evaluation.
    
    This class provides comprehensive permission checking that considers:
    - User's global role assignments
    - Scoped role assignments (project, portfolio, organization)
    - Permission inheritance through scope hierarchy
    - Time-based permission expiration
    - Caching for performance optimization
    
    Requirements:
    - 1.1: Validate user authentication and retrieve assigned roles
    - 1.2: Verify user has required permission for requested operation
    - 7.1: Context-aware permission evaluation
    """
    
    def __init__(
        self,
        supabase_client=None,
        cache_ttl: int = 300,
        permission_cache: Optional[PermissionCache] = None
    ):
        """
        Initialize the EnhancedPermissionChecker.
        
        Args:
            supabase_client: Supabase client for database operations
            cache_ttl: Cache time-to-live in seconds (default: 5 minutes)
            permission_cache: Optional PermissionCache instance (creates one if not provided)
        """
        self.supabase = supabase_client
        
        # Use provided cache or create new one
        self.cache = permission_cache or get_permission_cache()
        
        # Legacy cache for backward compatibility (deprecated)
        self._permission_cache: Dict[str, Any] = {}
        self._cache_timestamps: Dict[str, float] = {}
        self._cache_ttl = cache_ttl
        
        # Development mode user IDs that get admin permissions
        self._dev_user_ids = {
            "00000000-0000-0000-0000-000000000001",
            "bf1b1732-2449-4987-9fdb-fefa2a93b816"
        }
    
    async def check_permission(
        self,
        user_id: UUID,
        permission: Permission,
        context: Optional[PermissionContext] = None
    ) -> bool:
        """
        Check if a user has a specific permission, optionally within a context.
        
        This method evaluates permissions considering:
        1. Global role assignments
        2. Scoped role assignments matching the context
        3. Permission inheritance from parent scopes
        
        Args:
            user_id: The user's UUID
            permission: The permission to check
            context: Optional context for scoped permission checking
            
        Returns:
            True if the user has the permission, False otherwise
            
        Requirements: 1.2 - Permission verification
        """
        try:
            # Check cache first using new caching system
            cached_result = await self.cache.get_cached_permission(
                user_id, permission.value, context
            )
            if cached_result is not None:
                return cached_result
            
            # Get user's effective permissions for the context
            user_permissions = await self.get_user_permissions(user_id, context)
            has_permission = permission in user_permissions
            
            # Cache the result using new caching system
            await self.cache.cache_permission(
                user_id, permission.value, has_permission, context
            )
            
            return has_permission
            
        except Exception as e:
            logger.error(f"Error checking permission for user {user_id}: {e}")
            return False
    
    async def check_any_permission(
        self,
        user_id: UUID,
        permissions: List[Permission],
        context: Optional[PermissionContext] = None
    ) -> bool:
        """
        Check if a user has any of the specified permissions.
        
        Args:
            user_id: The user's UUID
            permissions: List of permissions to check (OR logic)
            context: Optional context for scoped permission checking
            
        Returns:
            True if the user has at least one of the permissions
            
        Requirements: 1.4 - Permission combination logic (OR)
        """
        try:
            user_permissions = await self.get_user_permissions(user_id, context)
            return any(perm in user_permissions for perm in permissions)
        except Exception as e:
            logger.error(f"Error checking any permission for user {user_id}: {e}")
            return False
    
    async def check_all_permissions(
        self,
        user_id: UUID,
        permissions: List[Permission],
        context: Optional[PermissionContext] = None
    ) -> bool:
        """
        Check if a user has all of the specified permissions.
        
        Args:
            user_id: The user's UUID
            permissions: List of permissions to check (AND logic)
            context: Optional context for scoped permission checking
            
        Returns:
            True if the user has all of the permissions
            
        Requirements: 1.4 - Permission combination logic (AND)
        """
        try:
            user_permissions = await self.get_user_permissions(user_id, context)
            return all(perm in user_permissions for perm in permissions)
        except Exception as e:
            logger.error(f"Error checking all permissions for user {user_id}: {e}")
            return False
    
    async def get_user_permissions(
        self,
        user_id: UUID,
        context: Optional[PermissionContext] = None
    ) -> List[Permission]:
        """
        Get all effective permissions for a user, optionally within a context.
        
        This method aggregates permissions from:
        1. Global role assignments
        2. Scoped role assignments matching the context
        3. Inherited permissions from parent scopes
        
        Args:
            user_id: The user's UUID
            context: Optional context for scoped permission retrieval
            
        Returns:
            List of Permission enums the user has
            
        Requirements: 1.1, 2.5 - Role retrieval and permission aggregation
        """
        try:
            user_id_str = str(user_id)
            
            # Check cache for permissions using new caching system
            cached_perms = await self.cache.get_cached_permissions(user_id, context)
            if cached_perms is not None:
                return cached_perms
            
            # Development mode: grant admin permissions to dev users
            if user_id_str in self._dev_user_ids:
                logger.debug(f"Development mode: Granting admin permissions to user {user_id_str}")
                permissions = DEFAULT_ROLE_PERMISSIONS[UserRole.admin]
                await self.cache.cache_permissions(user_id, permissions, context)
                return permissions
            
            # Get effective roles for the user in the given context
            effective_roles = await self.get_effective_roles(user_id, context)
            
            # Aggregate permissions from all effective roles
            all_permissions: Set[Permission] = set()
            for role in effective_roles:
                for perm_str in role.permissions:
                    try:
                        permission = Permission(perm_str)
                        all_permissions.add(permission)
                    except ValueError:
                        logger.warning(f"Invalid permission '{perm_str}' found in role {role.role_name}")
                        continue
            
            permissions = list(all_permissions)
            await self.cache.cache_permissions(user_id, permissions, context)
            return permissions
            
        except Exception as e:
            logger.error(f"Error getting user permissions for {user_id}: {e}")
            # Fallback to viewer permissions on error
            return DEFAULT_ROLE_PERMISSIONS[UserRole.viewer]
    
    async def get_effective_roles(
        self,
        user_id: UUID,
        context: Optional[PermissionContext] = None
    ) -> List[EffectiveRole]:
        """
        Get all effective roles for a user, optionally within a context.
        
        This method retrieves roles from:
        1. Global role assignments
        2. Organization-scoped assignments (if context has organization_id)
        3. Portfolio-scoped assignments (if context has portfolio_id)
        4. Project-scoped assignments (if context has project_id)
        
        Args:
            user_id: The user's UUID
            context: Optional context for scoped role retrieval
            
        Returns:
            List of EffectiveRole objects representing the user's roles
            
        Requirements: 1.1 - Retrieve assigned roles
        """
        try:
            user_id_str = str(user_id)
            
            # Development mode: return admin role for dev users
            if user_id_str in self._dev_user_ids:
                return [
                    EffectiveRole(
                        role_id=UUID("00000000-0000-0000-0000-000000000000"),
                        role_name="admin",
                        permissions=[p.value for p in DEFAULT_ROLE_PERMISSIONS[UserRole.admin]],
                        source_type=ScopeType.GLOBAL,
                        source_id=None,
                        is_inherited=False
                    )
                ]
            
            # If no Supabase client, return default viewer role
            if not self.supabase:
                return [
                    EffectiveRole(
                        role_id=UUID("00000000-0000-0000-0000-000000000000"),
                        role_name="viewer",
                        permissions=[p.value for p in DEFAULT_ROLE_PERMISSIONS[UserRole.viewer]],
                        source_type=ScopeType.GLOBAL,
                        source_id=None,
                        is_inherited=False
                    )
                ]
            
            effective_roles: List[EffectiveRole] = []
            
            # Get global role assignments
            global_roles = await self._get_role_assignments(user_id_str, None, None)
            for assignment, role_data in global_roles:
                effective_roles.append(
                    EffectiveRole(
                        role_id=UUID(assignment["role_id"]),
                        role_name=role_data.get("name", "unknown"),
                        permissions=role_data.get("permissions", []),
                        source_type=ScopeType.GLOBAL,
                        source_id=None,
                        is_inherited=False
                    )
                )
            
            # Get scoped role assignments if context is provided
            if context:
                # Organization-scoped roles
                if context.organization_id:
                    org_roles = await self._get_role_assignments(
                        user_id_str, ScopeType.ORGANIZATION, str(context.organization_id)
                    )
                    for assignment, role_data in org_roles:
                        effective_roles.append(
                            EffectiveRole(
                                role_id=UUID(assignment["role_id"]),
                                role_name=role_data.get("name", "unknown"),
                                permissions=role_data.get("permissions", []),
                                source_type=ScopeType.ORGANIZATION,
                                source_id=context.organization_id,
                                is_inherited=False
                            )
                        )
                
                # Portfolio-scoped roles
                if context.portfolio_id:
                    portfolio_roles = await self._get_role_assignments(
                        user_id_str, ScopeType.PORTFOLIO, str(context.portfolio_id)
                    )
                    for assignment, role_data in portfolio_roles:
                        effective_roles.append(
                            EffectiveRole(
                                role_id=UUID(assignment["role_id"]),
                                role_name=role_data.get("name", "unknown"),
                                permissions=role_data.get("permissions", []),
                                source_type=ScopeType.PORTFOLIO,
                                source_id=context.portfolio_id,
                                is_inherited=False
                            )
                        )
                
                # Project-scoped roles
                if context.project_id:
                    project_roles = await self._get_role_assignments(
                        user_id_str, ScopeType.PROJECT, str(context.project_id)
                    )
                    for assignment, role_data in project_roles:
                        effective_roles.append(
                            EffectiveRole(
                                role_id=UUID(assignment["role_id"]),
                                role_name=role_data.get("name", "unknown"),
                                permissions=role_data.get("permissions", []),
                                source_type=ScopeType.PROJECT,
                                source_id=context.project_id,
                                is_inherited=False
                            )
                        )
            
            # If no roles found, return default viewer role
            if not effective_roles:
                effective_roles.append(
                    EffectiveRole(
                        role_id=UUID("00000000-0000-0000-0000-000000000000"),
                        role_name="viewer",
                        permissions=[p.value for p in DEFAULT_ROLE_PERMISSIONS[UserRole.viewer]],
                        source_type=ScopeType.GLOBAL,
                        source_id=None,
                        is_inherited=False
                    )
                )
            
            return effective_roles
            
        except Exception as e:
            logger.error(f"Error getting effective roles for user {user_id}: {e}")
            # Return default viewer role on error
            return [
                EffectiveRole(
                    role_id=UUID("00000000-0000-0000-0000-000000000000"),
                    role_name="viewer",
                    permissions=[p.value for p in DEFAULT_ROLE_PERMISSIONS[UserRole.viewer]],
                    source_type=ScopeType.GLOBAL,
                    source_id=None,
                    is_inherited=False
                )
            ]
    
    # =========================================================================
    # Context-Aware Permission Checking Methods
    # Requirements: 1.2, 2.5, 7.1
    # =========================================================================
    
    async def has_global_permission(
        self,
        user_id: UUID,
        permission: Permission
    ) -> bool:
        """
        Check if a user has a permission through global role assignments.
        
        Global permissions apply regardless of context and are checked first
        in the permission hierarchy.
        
        Args:
            user_id: The user's UUID
            permission: The permission to check
            
        Returns:
            True if the user has the permission globally, False otherwise
            
        Requirements: 1.2, 7.1 - Global permission checking
        """
        try:
            user_id_str = str(user_id)
            
            # Check cache first
            cache_key = f"global_perm:{user_id_str}:{permission.value}"
            cached_result = self._get_cached_permission(cache_key)
            if cached_result is not None:
                return cached_result
            
            # Development mode: dev users have all admin permissions
            if user_id_str in self._dev_user_ids:
                admin_permissions = DEFAULT_ROLE_PERMISSIONS[UserRole.admin]
                result = permission in admin_permissions
                self._cache_permission(cache_key, result)
                return result
            
            # Get global roles only (no context)
            global_roles = await self.get_effective_roles(user_id, None)
            
            # Check if any global role has the permission
            for role in global_roles:
                if role.source_type == ScopeType.GLOBAL:
                    if permission.value in role.permissions:
                        self._cache_permission(cache_key, True)
                        return True
            
            self._cache_permission(cache_key, False)
            return False
            
        except Exception as e:
            logger.error(f"Error checking global permission for user {user_id}: {e}")
            return False
    
    async def check_project_permission(
        self,
        user_id: UUID,
        permission: Permission,
        project_id: UUID
    ) -> bool:
        """
        Check if a user has a permission within a specific project context.
        
        This method implements the permission hierarchy:
        1. Check global permissions first
        2. Check project-specific role assignments
        3. Check portfolio-level permissions (inherited to projects)
        
        Args:
            user_id: The user's UUID
            permission: The permission to check
            project_id: The project's UUID
            
        Returns:
            True if the user has the permission for this project, False otherwise
            
        Requirements: 1.2, 2.5, 7.1 - Context-aware project permission checking
        """
        try:
            user_id_str = str(user_id)
            
            # Check cache first
            cache_key = f"proj_perm:{user_id_str}:{permission.value}:{project_id}"
            cached_result = self._get_cached_permission(cache_key)
            if cached_result is not None:
                return cached_result
            
            # 1. Check global permissions first
            if await self.has_global_permission(user_id, permission):
                self._cache_permission(cache_key, True)
                return True
            
            # 2. Check project-specific role assignments
            project_roles = await self.get_project_roles(user_id, project_id)
            for role in project_roles:
                if permission.value in role.permissions:
                    self._cache_permission(cache_key, True)
                    return True
            
            # 3. Check portfolio-level permissions if project belongs to a portfolio
            portfolio_id = await self.get_project_portfolio(project_id)
            if portfolio_id:
                result = await self.check_portfolio_permission(user_id, permission, portfolio_id)
                self._cache_permission(cache_key, result)
                return result
            
            self._cache_permission(cache_key, False)
            return False
            
        except Exception as e:
            logger.error(f"Error checking project permission for user {user_id}, project {project_id}: {e}")
            return False
    
    async def check_portfolio_permission(
        self,
        user_id: UUID,
        permission: Permission,
        portfolio_id: UUID
    ) -> bool:
        """
        Check if a user has a permission within a specific portfolio context.
        
        This method implements the permission hierarchy:
        1. Check global permissions first
        2. Check portfolio-specific role assignments
        3. Check organization-level permissions (if applicable)
        
        Args:
            user_id: The user's UUID
            permission: The permission to check
            portfolio_id: The portfolio's UUID
            
        Returns:
            True if the user has the permission for this portfolio, False otherwise
            
        Requirements: 1.2, 2.5, 7.1 - Context-aware portfolio permission checking
        """
        try:
            user_id_str = str(user_id)
            
            # Check cache first
            cache_key = f"port_perm:{user_id_str}:{permission.value}:{portfolio_id}"
            cached_result = self._get_cached_permission(cache_key)
            if cached_result is not None:
                return cached_result
            
            # 1. Check global permissions first
            if await self.has_global_permission(user_id, permission):
                self._cache_permission(cache_key, True)
                return True
            
            # 2. Check portfolio-specific role assignments
            portfolio_roles = await self.get_portfolio_roles(user_id, portfolio_id)
            for role in portfolio_roles:
                if permission.value in role.permissions:
                    self._cache_permission(cache_key, True)
                    return True
            
            # 3. Check organization-level permissions (if portfolio has organization)
            organization_id = await self.get_portfolio_organization(portfolio_id)
            if organization_id:
                result = await self.check_organization_permission(user_id, permission, organization_id)
                self._cache_permission(cache_key, result)
                return result
            
            self._cache_permission(cache_key, False)
            return False
            
        except Exception as e:
            logger.error(f"Error checking portfolio permission for user {user_id}, portfolio {portfolio_id}: {e}")
            return False
    
    async def check_organization_permission(
        self,
        user_id: UUID,
        permission: Permission,
        organization_id: UUID
    ) -> bool:
        """
        Check if a user has a permission within a specific organization context.
        
        Args:
            user_id: The user's UUID
            permission: The permission to check
            organization_id: The organization's UUID
            
        Returns:
            True if the user has the permission for this organization, False otherwise
            
        Requirements: 1.2, 7.1 - Context-aware organization permission checking
        """
        try:
            user_id_str = str(user_id)
            
            # Check cache first
            cache_key = f"org_perm:{user_id_str}:{permission.value}:{organization_id}"
            cached_result = self._get_cached_permission(cache_key)
            if cached_result is not None:
                return cached_result
            
            # 1. Check global permissions first
            if await self.has_global_permission(user_id, permission):
                self._cache_permission(cache_key, True)
                return True
            
            # 2. Check organization-specific role assignments
            context = PermissionContext(organization_id=organization_id)
            org_roles = await self.get_effective_roles(user_id, context)
            
            for role in org_roles:
                if role.source_type == ScopeType.ORGANIZATION and role.source_id == organization_id:
                    if permission.value in role.permissions:
                        self._cache_permission(cache_key, True)
                        return True
            
            self._cache_permission(cache_key, False)
            return False
            
        except Exception as e:
            logger.error(f"Error checking organization permission for user {user_id}, org {organization_id}: {e}")
            return False
    
    async def get_project_roles(
        self,
        user_id: UUID,
        project_id: UUID
    ) -> List[EffectiveRole]:
        """
        Get all roles assigned to a user for a specific project.
        
        This returns only project-scoped role assignments, not global or
        inherited roles.
        
        Args:
            user_id: The user's UUID
            project_id: The project's UUID
            
        Returns:
            List of EffectiveRole objects for project-specific assignments
            
        Requirements: 2.5, 7.1 - Project-specific role retrieval
        """
        try:
            user_id_str = str(user_id)
            
            # Development mode: dev users get admin role for all projects
            if user_id_str in self._dev_user_ids:
                return [
                    EffectiveRole(
                        role_id=UUID("00000000-0000-0000-0000-000000000000"),
                        role_name="admin",
                        permissions=[p.value for p in DEFAULT_ROLE_PERMISSIONS[UserRole.admin]],
                        source_type=ScopeType.PROJECT,
                        source_id=project_id,
                        is_inherited=False
                    )
                ]
            
            if not self.supabase:
                return []
            
            # Get project-scoped role assignments
            project_roles = await self._get_role_assignments(
                user_id_str, ScopeType.PROJECT, str(project_id)
            )
            
            effective_roles: List[EffectiveRole] = []
            for assignment, role_data in project_roles:
                effective_roles.append(
                    EffectiveRole(
                        role_id=UUID(assignment["role_id"]),
                        role_name=role_data.get("name", "unknown"),
                        permissions=role_data.get("permissions", []),
                        source_type=ScopeType.PROJECT,
                        source_id=project_id,
                        is_inherited=False
                    )
                )
            
            return effective_roles
            
        except Exception as e:
            logger.error(f"Error getting project roles for user {user_id}, project {project_id}: {e}")
            return []
    
    async def get_portfolio_roles(
        self,
        user_id: UUID,
        portfolio_id: UUID
    ) -> List[EffectiveRole]:
        """
        Get all roles assigned to a user for a specific portfolio.
        
        This returns only portfolio-scoped role assignments, not global or
        inherited roles.
        
        Args:
            user_id: The user's UUID
            portfolio_id: The portfolio's UUID
            
        Returns:
            List of EffectiveRole objects for portfolio-specific assignments
            
        Requirements: 2.5, 7.1 - Portfolio-specific role retrieval
        """
        try:
            user_id_str = str(user_id)
            
            # Development mode: dev users get admin role for all portfolios
            if user_id_str in self._dev_user_ids:
                return [
                    EffectiveRole(
                        role_id=UUID("00000000-0000-0000-0000-000000000000"),
                        role_name="admin",
                        permissions=[p.value for p in DEFAULT_ROLE_PERMISSIONS[UserRole.admin]],
                        source_type=ScopeType.PORTFOLIO,
                        source_id=portfolio_id,
                        is_inherited=False
                    )
                ]
            
            if not self.supabase:
                return []
            
            # Get portfolio-scoped role assignments
            portfolio_roles = await self._get_role_assignments(
                user_id_str, ScopeType.PORTFOLIO, str(portfolio_id)
            )
            
            effective_roles: List[EffectiveRole] = []
            for assignment, role_data in portfolio_roles:
                effective_roles.append(
                    EffectiveRole(
                        role_id=UUID(assignment["role_id"]),
                        role_name=role_data.get("name", "unknown"),
                        permissions=role_data.get("permissions", []),
                        source_type=ScopeType.PORTFOLIO,
                        source_id=portfolio_id,
                        is_inherited=False
                    )
                )
            
            return effective_roles
            
        except Exception as e:
            logger.error(f"Error getting portfolio roles for user {user_id}, portfolio {portfolio_id}: {e}")
            return []
    
    async def get_project_portfolio(
        self,
        project_id: UUID
    ) -> Optional[UUID]:
        """
        Get the portfolio ID that a project belongs to.
        
        This is used for permission inheritance - if a user has portfolio-level
        permissions, they inherit those permissions for all projects in that portfolio.
        
        Args:
            project_id: The project's UUID
            
        Returns:
            The portfolio UUID if the project belongs to a portfolio, None otherwise
            
        Requirements: 7.1 - Portfolio-to-project permission inheritance
        """
        try:
            # Check cache first
            cache_key = f"proj_portfolio:{project_id}"
            cached_result = self._get_cached_permission(cache_key)
            if cached_result is not None:
                return cached_result if cached_result != "none" else None
            
            if not self.supabase:
                return None
            
            # Query the projects table for portfolio_id
            response = self.supabase.table("projects").select(
                "portfolio_id"
            ).eq("id", str(project_id)).execute()
            
            if response.data and len(response.data) > 0:
                portfolio_id_str = response.data[0].get("portfolio_id")
                if portfolio_id_str:
                    portfolio_id = UUID(portfolio_id_str)
                    self._cache_permission(cache_key, portfolio_id)
                    return portfolio_id
            
            self._cache_permission(cache_key, "none")
            return None
            
        except Exception as e:
            logger.error(f"Error getting portfolio for project {project_id}: {e}")
            return None
    
    async def get_portfolio_organization(
        self,
        portfolio_id: UUID
    ) -> Optional[UUID]:
        """
        Get the organization ID that a portfolio belongs to.
        
        This is used for permission inheritance - if a user has organization-level
        permissions, they inherit those permissions for all portfolios in that organization.
        
        Args:
            portfolio_id: The portfolio's UUID
            
        Returns:
            The organization UUID if the portfolio belongs to an organization, None otherwise
            
        Requirements: 7.1 - Organization-to-portfolio permission inheritance
        """
        try:
            # Check cache first
            cache_key = f"port_org:{portfolio_id}"
            cached_result = self._get_cached_permission(cache_key)
            if cached_result is not None:
                return cached_result if cached_result != "none" else None
            
            if not self.supabase:
                return None
            
            # Query the portfolios table for organization_id
            response = self.supabase.table("portfolios").select(
                "organization_id"
            ).eq("id", str(portfolio_id)).execute()
            
            if response.data and len(response.data) > 0:
                org_id_str = response.data[0].get("organization_id")
                if org_id_str:
                    org_id = UUID(org_id_str)
                    self._cache_permission(cache_key, org_id)
                    return org_id
            
            self._cache_permission(cache_key, "none")
            return None
            
        except Exception as e:
            logger.error(f"Error getting organization for portfolio {portfolio_id}: {e}")
            return None
    
    async def aggregate_permissions_from_roles(
        self,
        roles: List[EffectiveRole]
    ) -> Set[Permission]:
        """
        Aggregate permissions from multiple roles into a single set.
        
        This method combines permissions from all provided roles, handling
        the union of permissions across multiple role assignments.
        
        Args:
            roles: List of EffectiveRole objects to aggregate
            
        Returns:
            Set of Permission enums representing all aggregated permissions
            
        Requirements: 2.5 - Permission aggregation across multiple roles
        """
        all_permissions: Set[Permission] = set()
        
        for role in roles:
            for perm_str in role.permissions:
                try:
                    permission = Permission(perm_str)
                    all_permissions.add(permission)
                except ValueError:
                    logger.warning(f"Invalid permission '{perm_str}' found in role {role.role_name}")
                    continue
        
        return all_permissions
    
    async def get_all_context_permissions(
        self,
        user_id: UUID,
        context: PermissionContext
    ) -> Set[Permission]:
        """
        Get all permissions for a user considering the full context hierarchy.
        
        This method aggregates permissions from:
        1. Global role assignments
        2. Organization-scoped assignments (if context has organization_id)
        3. Portfolio-scoped assignments (if context has portfolio_id)
        4. Project-scoped assignments (if context has project_id)
        5. Inherited permissions from parent scopes
        
        Args:
            user_id: The user's UUID
            context: The permission context
            
        Returns:
            Set of all effective permissions for the user in this context
            
        Requirements: 2.5, 7.1 - Full context permission aggregation
        """
        try:
            all_permissions: Set[Permission] = set()
            
            # Get effective roles for the context
            effective_roles = await self.get_effective_roles(user_id, context)
            
            # Aggregate permissions from all roles
            all_permissions = await self.aggregate_permissions_from_roles(effective_roles)
            
            # If we have a project context, also check for inherited portfolio permissions
            if context.project_id and not context.portfolio_id:
                portfolio_id = await self.get_project_portfolio(context.project_id)
                if portfolio_id:
                    portfolio_context = PermissionContext(portfolio_id=portfolio_id)
                    portfolio_roles = await self.get_effective_roles(user_id, portfolio_context)
                    
                    # Add inherited permissions
                    for role in portfolio_roles:
                        if role.source_type == ScopeType.PORTFOLIO:
                            for perm_str in role.permissions:
                                try:
                                    permission = Permission(perm_str)
                                    all_permissions.add(permission)
                                except ValueError:
                                    continue
            
            return all_permissions
            
        except Exception as e:
            logger.error(f"Error getting all context permissions for user {user_id}: {e}")
            return set()
    
    async def _get_role_assignments(
        self,
        user_id: str,
        scope_type: Optional[ScopeType],
        scope_id: Optional[str]
    ) -> List[tuple]:
        """
        Get role assignments from the database.
        
        Args:
            user_id: The user's ID string
            scope_type: Optional scope type filter
            scope_id: Optional scope ID filter
            
        Returns:
            List of tuples (assignment_data, role_data)
        """
        try:
            # Build query for user_roles with role data
            query = self.supabase.table("user_roles").select(
                "id, user_id, role_id, scope_type, scope_id, assigned_at, expires_at, is_active, roles(id, name, permissions, is_active)"
            ).eq("user_id", user_id)
            
            # Filter by scope if provided
            if scope_type is None:
                # Global assignments have NULL scope_type
                query = query.is_("scope_type", "null")
            else:
                query = query.eq("scope_type", scope_type.value)
                if scope_id:
                    query = query.eq("scope_id", scope_id)
            
            # Filter for active assignments
            query = query.eq("is_active", True)
            
            response = query.execute()
            
            if not response.data:
                return []
            
            # Filter out expired assignments and inactive roles
            valid_assignments = []
            now = datetime.now(timezone.utc)
            
            for assignment in response.data:
                # Check expiration
                expires_at = assignment.get("expires_at")
                if expires_at:
                    try:
                        expiry = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
                        if expiry < now:
                            continue
                    except (ValueError, TypeError):
                        pass
                
                # Check role is active
                role_data = assignment.get("roles", {})
                if not role_data or not role_data.get("is_active", True):
                    continue
                
                valid_assignments.append((assignment, role_data))
            
            return valid_assignments
            
        except Exception as e:
            logger.error(f"Error getting role assignments: {e}")
            return []
    
    def _build_cache_key(
        self,
        user_id: str,
        permission: str,
        context: Optional[PermissionContext]
    ) -> str:
        """Build a cache key for permission checking."""
        context_key = context.to_cache_key() if context else "global"
        return f"perm:{user_id}:{permission}:{context_key}"
    
    def _get_cached_permission(self, cache_key: str) -> Optional[Any]:
        """Get a cached permission result if valid."""
        if cache_key not in self._permission_cache:
            return None
        
        timestamp = self._cache_timestamps.get(cache_key, 0)
        if (datetime.now().timestamp() - timestamp) >= self._cache_ttl:
            # Cache expired
            del self._permission_cache[cache_key]
            if cache_key in self._cache_timestamps:
                del self._cache_timestamps[cache_key]
            return None
        
        return self._permission_cache[cache_key]
    
    def _cache_permission(self, cache_key: str, result: Any) -> None:
        """Cache a permission result."""
        self._permission_cache[cache_key] = result
        self._cache_timestamps[cache_key] = datetime.now().timestamp()
    
    def clear_user_cache(self, user_id: UUID) -> None:
        """
        Clear all cached permissions for a user.
        
        Should be called when user's roles change.
        
        Args:
            user_id: The user's UUID
        """
        # Use new caching system (async wrapper needed)
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # If event loop is running, schedule the task
                asyncio.create_task(self.cache.invalidate_user_cache(user_id))
            else:
                # If no event loop, run synchronously
                loop.run_until_complete(self.cache.invalidate_user_cache(user_id))
        except Exception as e:
            logger.warning(f"Error clearing cache for user {user_id}: {e}")
        
        # Also clear legacy cache for backward compatibility
        user_id_str = str(user_id)
        keys_to_remove = [
            key for key in self._permission_cache.keys()
            if user_id_str in key
        ]
        for key in keys_to_remove:
            del self._permission_cache[key]
            if key in self._cache_timestamps:
                del self._cache_timestamps[key]
    
    def clear_all_cache(self) -> None:
        """Clear all cached permissions."""
        # Use new caching system
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.create_task(self.cache.clear_all_cache())
            else:
                loop.run_until_complete(self.cache.clear_all_cache())
        except Exception as e:
            logger.warning(f"Error clearing all cache: {e}")
        
        # Also clear legacy cache
        self._permission_cache.clear()
        self._cache_timestamps.clear()
    
    # =========================================================================
    # Permission Combination Logic Methods
    # Requirements: 1.4 - Permission combination logic (AND/OR)
    # =========================================================================
    
    async def check_permission_requirement(
        self,
        user_id: UUID,
        requirement: 'PermissionRequirement',
        context: Optional[PermissionContext] = None
    ) -> 'PermissionCheckResult':
        """
        Check if a user satisfies a complex permission requirement.
        
        This method supports:
        - Single permission requirements
        - AND logic (all permissions required)
        - OR logic (any permission required)
        - Nested/complex combinations
        
        Args:
            user_id: The user's UUID
            requirement: The PermissionRequirement to check
            context: Optional context for scoped permission checking
            
        Returns:
            PermissionCheckResult with detailed information about what was satisfied/missing
            
        Requirements: 1.4 - Permission combination logic
        """
        from .permission_requirements import PermissionRequirement, PermissionCheckResult
        
        try:
            # Get user's effective permissions for the context
            user_permissions = await self.get_user_permissions(user_id, context)
            user_permissions_set = set(user_permissions)
            
            # Check the requirement against user's permissions
            result = requirement.check(user_permissions_set)
            
            return result
            
        except Exception as e:
            logger.error(f"Error checking permission requirement for user {user_id}: {e}")
            # Return a failed result on error
            from .permission_requirements import RequirementType
            return PermissionCheckResult(
                satisfied=False,
                requirement_type=RequirementType.COMPLEX,
                description=f"Error checking requirement: {str(e)}"
            )
    
    async def check_complex_permission(
        self,
        user_id: UUID,
        requirement: 'PermissionRequirement',
        context: Optional[PermissionContext] = None
    ) -> bool:
        """
        Check if a user satisfies a complex permission requirement.
        
        Simplified version that returns just a boolean.
        
        Args:
            user_id: The user's UUID
            requirement: The PermissionRequirement to check
            context: Optional context for scoped permission checking
            
        Returns:
            True if the requirement is satisfied, False otherwise
            
        Requirements: 1.4 - Permission combination logic
        """
        result = await self.check_permission_requirement(user_id, requirement, context)
        return result.satisfied
    
    async def check_all_permissions_with_details(
        self,
        user_id: UUID,
        permissions: List[Permission],
        context: Optional[PermissionContext] = None
    ) -> Tuple[bool, List[Permission], List[Permission]]:
        """
        Check if a user has all of the specified permissions with detailed results.
        
        Args:
            user_id: The user's UUID
            permissions: List of permissions to check (AND logic)
            context: Optional context for scoped permission checking
            
        Returns:
            Tuple of (all_satisfied, satisfied_permissions, missing_permissions)
            
        Requirements: 1.4 - Permission combination logic (AND)
        """
        try:
            user_permissions = await self.get_user_permissions(user_id, context)
            user_permissions_set = set(user_permissions)
            
            satisfied = []
            missing = []
            
            for perm in permissions:
                if perm in user_permissions_set:
                    satisfied.append(perm)
                else:
                    missing.append(perm)
            
            return (len(missing) == 0, satisfied, missing)
            
        except Exception as e:
            logger.error(f"Error checking all permissions for user {user_id}: {e}")
            return (False, [], list(permissions))
    
    async def check_any_permission_with_details(
        self,
        user_id: UUID,
        permissions: List[Permission],
        context: Optional[PermissionContext] = None
    ) -> Tuple[bool, List[Permission], List[Permission]]:
        """
        Check if a user has any of the specified permissions with detailed results.
        
        Args:
            user_id: The user's UUID
            permissions: List of permissions to check (OR logic)
            context: Optional context for scoped permission checking
            
        Returns:
            Tuple of (any_satisfied, satisfied_permissions, unsatisfied_permissions)
            
        Requirements: 1.4 - Permission combination logic (OR)
        """
        try:
            user_permissions = await self.get_user_permissions(user_id, context)
            user_permissions_set = set(user_permissions)
            
            satisfied = []
            unsatisfied = []
            
            for perm in permissions:
                if perm in user_permissions_set:
                    satisfied.append(perm)
                else:
                    unsatisfied.append(perm)
            
            return (len(satisfied) > 0, satisfied, unsatisfied)
            
        except Exception as e:
            logger.error(f"Error checking any permission for user {user_id}: {e}")
            return (False, [], list(permissions))
    
    async def get_missing_permissions(
        self,
        user_id: UUID,
        required_permissions: List[Permission],
        context: Optional[PermissionContext] = None
    ) -> List[Permission]:
        """
        Get the list of permissions the user is missing from the required set.
        
        Useful for error reporting to tell users exactly what they need.
        
        Args:
            user_id: The user's UUID
            required_permissions: List of permissions to check
            context: Optional context for scoped permission checking
            
        Returns:
            List of permissions the user is missing
            
        Requirements: 1.4 - Permission combination logic
        """
        try:
            user_permissions = await self.get_user_permissions(user_id, context)
            user_permissions_set = set(user_permissions)
            
            missing = [
                perm for perm in required_permissions
                if perm not in user_permissions_set
            ]
            
            return missing
            
        except Exception as e:
            logger.error(f"Error getting missing permissions for user {user_id}: {e}")
            return list(required_permissions)
    
    async def check_multi_step_operation(
        self,
        user_id: UUID,
        steps: List[Tuple[str, 'PermissionRequirement']],
        context: Optional[PermissionContext] = None
    ) -> Tuple[bool, List[Tuple[str, bool, 'PermissionCheckResult']]]:
        """
        Check permissions for a multi-step operation.
        
        Each step has a name and a permission requirement. All steps must
        be satisfied for the operation to proceed.
        
        Args:
            user_id: The user's UUID
            steps: List of (step_name, requirement) tuples
            context: Optional context for scoped permission checking
            
        Returns:
            Tuple of (all_steps_satisfied, list of (step_name, satisfied, result))
            
        Requirements: 1.4 - Complex permission requirements for multi-step operations
        """
        from .permission_requirements import PermissionRequirement, PermissionCheckResult
        
        try:
            # Get user's permissions once for all steps
            user_permissions = await self.get_user_permissions(user_id, context)
            user_permissions_set = set(user_permissions)
            
            step_results = []
            all_satisfied = True
            
            for step_name, requirement in steps:
                result = requirement.check(user_permissions_set)
                step_results.append((step_name, result.satisfied, result))
                if not result.satisfied:
                    all_satisfied = False
            
            return (all_satisfied, step_results)
            
        except Exception as e:
            logger.error(f"Error checking multi-step operation for user {user_id}: {e}")
            from .permission_requirements import RequirementType
            # Return failed results for all steps
            failed_results = []
            for step_name, requirement in steps:
                failed_result = PermissionCheckResult(
                    satisfied=False,
                    requirement_type=RequirementType.COMPLEX,
                    description=f"Error checking step '{step_name}': {str(e)}"
                )
                failed_results.append((step_name, False, failed_result))
            return (False, failed_results)


# Create a singleton instance for use across the application
_enhanced_permission_checker: Optional[EnhancedPermissionChecker] = None


def get_enhanced_permission_checker(supabase_client=None) -> EnhancedPermissionChecker:
    """
    Get or create the singleton EnhancedPermissionChecker instance.
    
    Args:
        supabase_client: Optional Supabase client to use
        
    Returns:
        The EnhancedPermissionChecker singleton instance
    """
    global _enhanced_permission_checker
    
    if _enhanced_permission_checker is None:
        from config.database import supabase
        _enhanced_permission_checker = EnhancedPermissionChecker(
            supabase_client or supabase
        )
    
    return _enhanced_permission_checker
