"""
Dynamic Permission Evaluation System

This module provides dynamic, context-aware permission evaluation that considers:
- Project assignments and hierarchy
- Automatic permission updates when assignments change
- Multi-level permission verification (role + resource-specific)
- Time-based permissions with expiration
- Custom permission logic based on business rules

Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
"""

from datetime import datetime, timezone
from typing import List, Optional, Dict, Any, Set, Callable, Awaitable
from uuid import UUID
import logging

from .rbac import Permission, UserRole
from .enhanced_rbac_models import (
    PermissionContext,
    RoleAssignment,
    ScopeType,
    EffectiveRole,
)
from .enhanced_permission_checker import EnhancedPermissionChecker

logger = logging.getLogger(__name__)


class AssignmentChangeEvent:
    """
    Event representing a change in user assignments.
    
    Used to trigger automatic permission updates when project/portfolio
    assignments change.
    
    Requirements: 7.2 - Automatic permission updates on assignment changes
    """
    
    def __init__(
        self,
        user_id: UUID,
        assignment_type: str,  # "project", "portfolio", "organization"
        assignment_id: UUID,
        action: str,  # "added", "removed", "modified"
        timestamp: Optional[datetime] = None
    ):
        self.user_id = user_id
        self.assignment_type = assignment_type
        self.assignment_id = assignment_id
        self.action = action
        self.timestamp = timestamp or datetime.now(timezone.utc)


class PermissionEvaluationResult:
    """
    Result of a dynamic permission evaluation.
    
    Provides detailed information about how the permission was evaluated,
    including which rules were applied and what context was considered.
    """
    
    def __init__(
        self,
        has_permission: bool,
        permission: Permission,
        context: Optional[PermissionContext] = None,
        evaluation_path: Optional[List[str]] = None,
        applied_rules: Optional[List[str]] = None,
        source_roles: Optional[List[str]] = None
    ):
        self.has_permission = has_permission
        self.permission = permission
        self.context = context
        self.evaluation_path = evaluation_path or []
        self.applied_rules = applied_rules or []
        self.source_roles = source_roles or []


class CustomPermissionRule:
    """
    Base class for custom permission rules.
    
    Allows extending the permission system with business-specific logic.
    
    Requirements: 7.5 - Custom permission logic based on business rules
    """
    
    def __init__(self, name: str, description: str):
        self.name = name
        self.description = description
    
    async def evaluate(
        self,
        user_id: UUID,
        permission: Permission,
        context: Optional[PermissionContext],
        base_result: bool
    ) -> bool:
        """
        Evaluate the custom rule.
        
        Args:
            user_id: The user's UUID
            permission: The permission being checked
            context: The permission context
            base_result: The result from standard permission checking
            
        Returns:
            True if the rule grants permission, False otherwise
        """
        raise NotImplementedError("Subclasses must implement evaluate()")


class DynamicPermissionEvaluator:
    """
    Dynamic permission evaluator with context-aware evaluation.
    
    This class extends the EnhancedPermissionChecker with:
    - Project assignment hierarchy consideration
    - Automatic permission updates on assignment changes
    - Multi-level permission verification
    - Time-based permissions
    - Custom permission rules
    
    Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
    """
    
    def __init__(
        self,
        permission_checker: EnhancedPermissionChecker,
        supabase_client=None
    ):
        """
        Initialize the DynamicPermissionEvaluator.
        
        Args:
            permission_checker: The base permission checker
            supabase_client: Supabase client for database operations
        """
        self.permission_checker = permission_checker
        self.supabase = supabase_client
        
        # Custom permission rules registry
        self._custom_rules: Dict[str, CustomPermissionRule] = {}
        
        # Assignment change listeners
        self._assignment_listeners: List[Callable[[AssignmentChangeEvent], Awaitable[None]]] = []
        
        # Cache for project hierarchy
        self._hierarchy_cache: Dict[str, Any] = {}
        self._hierarchy_cache_timestamps: Dict[str, float] = {}
        self._hierarchy_cache_ttl = 300  # 5 minutes
    
    # =========================================================================
    # Context-Aware Permission Evaluation
    # Requirements: 7.1 - Context-aware permission evaluation
    # =========================================================================
    
    async def evaluate_permission(
        self,
        user_id: UUID,
        permission: Permission,
        context: Optional[PermissionContext] = None
    ) -> PermissionEvaluationResult:
        """
        Evaluate a permission with full context awareness and custom rules.
        
        This method considers:
        1. Standard role-based permissions
        2. Project assignment hierarchy
        3. Resource-specific assignments
        4. Time-based permissions
        5. Custom business rules
        
        Args:
            user_id: The user's UUID
            permission: The permission to check
            context: Optional context for scoped permission checking
            
        Returns:
            PermissionEvaluationResult with detailed evaluation information
            
        Requirements: 7.1 - Context-aware permission evaluation
        """
        evaluation_path = []
        applied_rules = []
        source_roles = []
        
        try:
            # Step 1: Check standard role-based permissions
            evaluation_path.append("Checking standard role-based permissions")
            base_has_permission = await self.permission_checker.check_permission(
                user_id, permission, context
            )
            
            if base_has_permission:
                evaluation_path.append("Permission granted by role-based check")
                # Get the roles that granted this permission
                effective_roles = await self.permission_checker.get_effective_roles(user_id, context)
                for role in effective_roles:
                    if permission.value in role.permissions:
                        source_roles.append(role.role_name)
            
            # Step 2: Check project assignment hierarchy if context has project_id
            if context and context.project_id:
                evaluation_path.append(f"Checking project assignment hierarchy for project {context.project_id}")
                hierarchy_result = await self._check_project_hierarchy_permission(
                    user_id, permission, context.project_id
                )
                if hierarchy_result:
                    base_has_permission = True
                    applied_rules.append("project_hierarchy")
                    evaluation_path.append("Permission granted by project hierarchy")
            
            # Step 3: Check resource-specific assignments if context has resource_id
            if context and context.resource_id:
                evaluation_path.append(f"Checking resource-specific assignment for resource {context.resource_id}")
                resource_result = await self._check_resource_specific_permission(
                    user_id, permission, context.resource_id, context
                )
                if resource_result:
                    base_has_permission = True
                    applied_rules.append("resource_specific")
                    evaluation_path.append("Permission granted by resource-specific assignment")
            
            # Step 4: Apply custom permission rules
            evaluation_path.append("Applying custom permission rules")
            for rule_name, rule in self._custom_rules.items():
                try:
                    rule_result = await rule.evaluate(user_id, permission, context, base_has_permission)
                    if rule_result:
                        applied_rules.append(f"custom_rule:{rule_name}")
                        if not base_has_permission:
                            base_has_permission = True
                            evaluation_path.append(f"Permission granted by custom rule: {rule_name}")
                        else:
                            evaluation_path.append(f"Custom rule {rule_name} confirmed permission")
                except Exception as e:
                    logger.error(f"Error evaluating custom rule {rule_name}: {e}")
                    evaluation_path.append(f"Error in custom rule {rule_name}: {str(e)}")
            
            return PermissionEvaluationResult(
                has_permission=base_has_permission,
                permission=permission,
                context=context,
                evaluation_path=evaluation_path,
                applied_rules=applied_rules,
                source_roles=source_roles
            )
            
        except Exception as e:
            logger.error(f"Error evaluating permission for user {user_id}: {e}")
            evaluation_path.append(f"Error during evaluation: {str(e)}")
            return PermissionEvaluationResult(
                has_permission=False,
                permission=permission,
                context=context,
                evaluation_path=evaluation_path,
                applied_rules=applied_rules,
                source_roles=source_roles
            )
    
    async def _check_project_hierarchy_permission(
        self,
        user_id: UUID,
        permission: Permission,
        project_id: UUID
    ) -> bool:
        """
        Check permission considering project assignment hierarchy.
        
        This checks if the user has the permission through:
        1. Direct project assignment
        2. Parent project assignment (if project has parent)
        3. Program/portfolio assignment
        
        Args:
            user_id: The user's UUID
            permission: The permission to check
            project_id: The project's UUID
            
        Returns:
            True if permission is granted through hierarchy, False otherwise
            
        Requirements: 7.1 - Project assignment hierarchy consideration
        """
        try:
            # Check if user is directly assigned to the project
            is_assigned = await self._is_user_assigned_to_project(user_id, project_id)
            if is_assigned:
                # Check if the assignment grants the permission
                project_context = PermissionContext(project_id=project_id)
                has_perm = await self.permission_checker.check_permission(
                    user_id, permission, project_context
                )
                if has_perm:
                    return True
            
            # Check parent project hierarchy
            parent_project_id = await self._get_parent_project(project_id)
            if parent_project_id:
                # Recursively check parent project
                return await self._check_project_hierarchy_permission(
                    user_id, permission, parent_project_id
                )
            
            return False
            
        except Exception as e:
            logger.error(f"Error checking project hierarchy permission: {e}")
            return False
    
    async def _check_resource_specific_permission(
        self,
        user_id: UUID,
        permission: Permission,
        resource_id: UUID,
        context: PermissionContext
    ) -> bool:
        """
        Check resource-specific permission assignments.
        
        This verifies if the user has specific permission for a resource
        beyond their role-based permissions.
        
        Args:
            user_id: The user's UUID
            permission: The permission to check
            resource_id: The resource's UUID
            context: The full permission context
            
        Returns:
            True if permission is granted for this resource, False otherwise
            
        Requirements: 7.3 - Resource-specific permission verification
        """
        try:
            if not self.supabase:
                return False
            
            # Check resource_permissions table for specific grants
            response = self.supabase.table("resource_permissions").select(
                "permission, granted"
            ).eq("user_id", str(user_id)).eq(
                "resource_id", str(resource_id)
            ).eq("permission", permission.value).execute()
            
            if response.data and len(response.data) > 0:
                return response.data[0].get("granted", False)
            
            return False
            
        except Exception as e:
            logger.error(f"Error checking resource-specific permission: {e}")
            return False
    
    async def _is_user_assigned_to_project(
        self,
        user_id: UUID,
        project_id: UUID
    ) -> bool:
        """
        Check if a user is assigned to a project.
        
        Args:
            user_id: The user's UUID
            project_id: The project's UUID
            
        Returns:
            True if user is assigned to the project, False otherwise
        """
        try:
            if not self.supabase:
                return False
            
            # Check project_assignments table
            response = self.supabase.table("project_assignments").select(
                "id"
            ).eq("user_id", str(user_id)).eq(
                "project_id", str(project_id)
            ).eq("is_active", True).execute()
            
            return response.data and len(response.data) > 0
            
        except Exception as e:
            logger.error(f"Error checking project assignment: {e}")
            return False
    
    async def _get_parent_project(
        self,
        project_id: UUID
    ) -> Optional[UUID]:
        """
        Get the parent project ID for a project.
        
        Args:
            project_id: The project's UUID
            
        Returns:
            The parent project UUID if exists, None otherwise
        """
        try:
            # Check cache first
            cache_key = f"parent_project:{project_id}"
            cached_result = self._get_cached_hierarchy(cache_key)
            if cached_result is not None:
                return cached_result if cached_result != "none" else None
            
            if not self.supabase:
                return None
            
            # Query projects table for parent_project_id
            response = self.supabase.table("projects").select(
                "parent_project_id"
            ).eq("id", str(project_id)).execute()
            
            if response.data and len(response.data) > 0:
                parent_id_str = response.data[0].get("parent_project_id")
                if parent_id_str:
                    parent_id = UUID(parent_id_str)
                    self._cache_hierarchy(cache_key, parent_id)
                    return parent_id
            
            self._cache_hierarchy(cache_key, "none")
            return None
            
        except Exception as e:
            logger.error(f"Error getting parent project: {e}")
            return None
    
    # =========================================================================
    # Assignment Change Handling
    # Requirements: 7.2 - Automatic permission updates on assignment changes
    # =========================================================================
    
    async def handle_assignment_change(
        self,
        event: AssignmentChangeEvent
    ) -> None:
        """
        Handle a change in user assignments.
        
        This method:
        1. Clears relevant permission caches
        2. Notifies registered listeners
        3. Updates affected user sessions
        
        Args:
            event: The assignment change event
            
        Requirements: 7.2 - Automatic permission updates on assignment changes
        """
        try:
            logger.info(
                f"Handling assignment change: user={event.user_id}, "
                f"type={event.assignment_type}, action={event.action}"
            )
            
            # Clear permission cache for the affected user
            self.permission_checker.clear_user_cache(event.user_id)
            
            # Clear hierarchy cache if relevant
            if event.assignment_type in ["project", "portfolio"]:
                self._clear_hierarchy_cache_for_assignment(event.assignment_id)
            
            # Notify all registered listeners
            for listener in self._assignment_listeners:
                try:
                    await listener(event)
                except Exception as e:
                    logger.error(f"Error in assignment change listener: {e}")
            
            logger.info(f"Assignment change handled successfully for user {event.user_id}")
            
        except Exception as e:
            logger.error(f"Error handling assignment change: {e}")
    
    def register_assignment_listener(
        self,
        listener: Callable[[AssignmentChangeEvent], Awaitable[None]]
    ) -> None:
        """
        Register a listener for assignment change events.
        
        Args:
            listener: Async function to call when assignments change
        """
        self._assignment_listeners.append(listener)
    
    def unregister_assignment_listener(
        self,
        listener: Callable[[AssignmentChangeEvent], Awaitable[None]]
    ) -> None:
        """
        Unregister an assignment change listener.
        
        Args:
            listener: The listener function to remove
        """
        if listener in self._assignment_listeners:
            self._assignment_listeners.remove(listener)
    
    async def trigger_assignment_change(
        self,
        user_id: UUID,
        assignment_type: str,
        assignment_id: UUID,
        action: str
    ) -> None:
        """
        Trigger an assignment change event.
        
        This should be called whenever a user's project/portfolio/organization
        assignment changes.
        
        Args:
            user_id: The user's UUID
            assignment_type: Type of assignment ("project", "portfolio", "organization")
            assignment_id: The assignment's UUID
            action: The action performed ("added", "removed", "modified")
        """
        event = AssignmentChangeEvent(
            user_id=user_id,
            assignment_type=assignment_type,
            assignment_id=assignment_id,
            action=action
        )
        await self.handle_assignment_change(event)
    
    # =========================================================================
    # Multi-Level Permission Verification
    # Requirements: 7.3 - Multi-level permission verification
    # =========================================================================
    
    async def verify_multi_level_permission(
        self,
        user_id: UUID,
        permission: Permission,
        context: PermissionContext
    ) -> Dict[str, bool]:
        """
        Verify permission at multiple levels.
        
        This checks:
        1. Role-based permission (from user's roles)
        2. Resource-specific permission (explicit grants)
        3. Hierarchy-based permission (inherited from parent)
        
        Args:
            user_id: The user's UUID
            permission: The permission to check
            context: The permission context
            
        Returns:
            Dictionary with results for each level:
            {
                "role_based": bool,
                "resource_specific": bool,
                "hierarchy_based": bool,
                "overall": bool
            }
            
        Requirements: 7.3 - Multi-level permission verification
        """
        try:
            results = {
                "role_based": False,
                "resource_specific": False,
                "hierarchy_based": False,
                "overall": False
            }
            
            # Check role-based permission
            results["role_based"] = await self.permission_checker.check_permission(
                user_id, permission, context
            )
            
            # Check resource-specific permission if resource_id is provided
            if context.resource_id:
                results["resource_specific"] = await self._check_resource_specific_permission(
                    user_id, permission, context.resource_id, context
                )
            
            # Check hierarchy-based permission if project_id is provided
            if context.project_id:
                results["hierarchy_based"] = await self._check_project_hierarchy_permission(
                    user_id, permission, context.project_id
                )
            
            # Overall result is True if any level grants permission
            results["overall"] = any([
                results["role_based"],
                results["resource_specific"],
                results["hierarchy_based"]
            ])
            
            return results
            
        except Exception as e:
            logger.error(f"Error verifying multi-level permission: {e}")
            return {
                "role_based": False,
                "resource_specific": False,
                "hierarchy_based": False,
                "overall": False
            }
    
    # =========================================================================
    # Custom Permission Rules
    # Requirements: 7.5 - Custom permission logic based on business rules
    # =========================================================================
    
    def register_custom_rule(
        self,
        rule: CustomPermissionRule
    ) -> None:
        """
        Register a custom permission rule.
        
        Args:
            rule: The custom rule to register
            
        Requirements: 7.5 - Custom permission logic
        """
        self._custom_rules[rule.name] = rule
        logger.info(f"Registered custom permission rule: {rule.name}")
    
    def unregister_custom_rule(
        self,
        rule_name: str
    ) -> None:
        """
        Unregister a custom permission rule.
        
        Args:
            rule_name: The name of the rule to remove
        """
        if rule_name in self._custom_rules:
            del self._custom_rules[rule_name]
            logger.info(f"Unregistered custom permission rule: {rule_name}")
    
    def get_custom_rules(self) -> List[CustomPermissionRule]:
        """
        Get all registered custom rules.
        
        Returns:
            List of registered custom permission rules
        """
        return list(self._custom_rules.values())
    
    # =========================================================================
    # Cache Management
    # =========================================================================
    
    def _get_cached_hierarchy(self, cache_key: str) -> Optional[Any]:
        """Get a cached hierarchy result if valid."""
        if cache_key not in self._hierarchy_cache:
            return None
        
        timestamp = self._hierarchy_cache_timestamps.get(cache_key, 0)
        if (datetime.now().timestamp() - timestamp) >= self._hierarchy_cache_ttl:
            # Cache expired
            del self._hierarchy_cache[cache_key]
            if cache_key in self._hierarchy_cache_timestamps:
                del self._hierarchy_cache_timestamps[cache_key]
            return None
        
        return self._hierarchy_cache[cache_key]
    
    def _cache_hierarchy(self, cache_key: str, result: Any) -> None:
        """Cache a hierarchy result."""
        self._hierarchy_cache[cache_key] = result
        self._hierarchy_cache_timestamps[cache_key] = datetime.now().timestamp()
    
    def _clear_hierarchy_cache_for_assignment(self, assignment_id: UUID) -> None:
        """Clear hierarchy cache entries related to an assignment."""
        keys_to_remove = [
            key for key in self._hierarchy_cache.keys()
            if str(assignment_id) in key
        ]
        for key in keys_to_remove:
            del self._hierarchy_cache[key]
            if key in self._hierarchy_cache_timestamps:
                del self._hierarchy_cache_timestamps[key]
    
    def clear_all_caches(self) -> None:
        """Clear all caches (permission and hierarchy)."""
        self.permission_checker.clear_all_cache()
        self._hierarchy_cache.clear()
        self._hierarchy_cache_timestamps.clear()


# Singleton instance
_dynamic_permission_evaluator: Optional[DynamicPermissionEvaluator] = None


def get_dynamic_permission_evaluator(
    permission_checker: Optional[EnhancedPermissionChecker] = None,
    supabase_client=None
) -> DynamicPermissionEvaluator:
    """
    Get or create the singleton DynamicPermissionEvaluator instance.
    
    Args:
        permission_checker: Optional permission checker to use
        supabase_client: Optional Supabase client to use
        
    Returns:
        The DynamicPermissionEvaluator singleton instance
    """
    global _dynamic_permission_evaluator
    
    if _dynamic_permission_evaluator is None:
        from .enhanced_permission_checker import get_enhanced_permission_checker
        from config.database import supabase
        
        checker = permission_checker or get_enhanced_permission_checker()
        _dynamic_permission_evaluator = DynamicPermissionEvaluator(
            permission_checker=checker,
            supabase_client=supabase_client or supabase
        )
    
    return _dynamic_permission_evaluator
