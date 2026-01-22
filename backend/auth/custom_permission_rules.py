"""
Custom Permission Rules

This module provides example custom permission rules that demonstrate
the extensibility of the permission system.

Requirements: 7.5 - Custom permission logic based on business rules
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID
import logging

from .rbac import Permission
from .enhanced_rbac_models import PermissionContext
from .dynamic_permission_evaluator import CustomPermissionRule

logger = logging.getLogger(__name__)


class ProjectOwnerRule(CustomPermissionRule):
    """
    Custom rule that grants full project permissions to project owners.
    
    Business rule: Users who created a project should have full access
    to that project regardless of their assigned role.
    """
    
    def __init__(self, supabase_client=None):
        super().__init__(
            name="project_owner",
            description="Grant full permissions to project owners"
        )
        self.supabase = supabase_client
    
    async def evaluate(
        self,
        user_id: UUID,
        permission: Permission,
        context: Optional[PermissionContext],
        base_result: bool
    ) -> bool:
        """
        Check if user is the project owner and grant permission if so.
        
        Args:
            user_id: The user's UUID
            permission: The permission being checked
            context: The permission context
            base_result: The result from standard permission checking
            
        Returns:
            True if user is project owner, False otherwise
        """
        # If already has permission, no need to check
        if base_result:
            return True
        
        # Only applies to project-scoped permissions
        if not context or not context.project_id:
            return False
        
        # Only grant project-related permissions
        if not permission.value.startswith("project_"):
            return False
        
        try:
            if not self.supabase:
                return False
            
            # Check if user is the project owner
            response = self.supabase.table("projects").select(
                "created_by"
            ).eq("id", str(context.project_id)).execute()
            
            if response.data and len(response.data) > 0:
                created_by = response.data[0].get("created_by")
                if created_by == str(user_id):
                    logger.info(
                        f"Granting {permission.value} to project owner {user_id} "
                        f"for project {context.project_id}"
                    )
                    return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error evaluating project owner rule: {e}")
            return False


class EmergencyAccessRule(CustomPermissionRule):
    """
    Custom rule for emergency access scenarios.
    
    Business rule: During emergency situations, designated users can
    temporarily access resources they normally wouldn't have access to.
    """
    
    def __init__(self, supabase_client=None):
        super().__init__(
            name="emergency_access",
            description="Grant emergency access during critical situations"
        )
        self.supabase = supabase_client
        self._emergency_mode_active = False
        self._emergency_users: set = set()
    
    def activate_emergency_mode(self, emergency_user_ids: list):
        """
        Activate emergency mode for specific users.
        
        Args:
            emergency_user_ids: List of user UUIDs to grant emergency access
        """
        self._emergency_mode_active = True
        self._emergency_users = set(str(uid) for uid in emergency_user_ids)
        logger.warning(
            f"Emergency mode activated for {len(emergency_user_ids)} users"
        )
    
    def deactivate_emergency_mode(self):
        """Deactivate emergency mode."""
        self._emergency_mode_active = False
        self._emergency_users.clear()
        logger.info("Emergency mode deactivated")
    
    async def evaluate(
        self,
        user_id: UUID,
        permission: Permission,
        context: Optional[PermissionContext],
        base_result: bool
    ) -> bool:
        """
        Grant permission if emergency mode is active for this user.
        
        Args:
            user_id: The user's UUID
            permission: The permission being checked
            context: The permission context
            base_result: The result from standard permission checking
            
        Returns:
            True if emergency access is granted, False otherwise
        """
        if base_result:
            return True
        
        if not self._emergency_mode_active:
            return False
        
        if str(user_id) in self._emergency_users:
            logger.warning(
                f"Emergency access granted to user {user_id} for {permission.value}"
            )
            return True
        
        return False


class DataClassificationRule(CustomPermissionRule):
    """
    Custom rule based on data classification levels.
    
    Business rule: Users can only access data at or below their
    clearance level (e.g., public, internal, confidential, secret).
    """
    
    def __init__(self, supabase_client=None):
        super().__init__(
            name="data_classification",
            description="Enforce data classification access controls"
        )
        self.supabase = supabase_client
        
        # Classification levels (higher number = more restricted)
        self._classification_levels = {
            "public": 0,
            "internal": 1,
            "confidential": 2,
            "secret": 3
        }
    
    async def evaluate(
        self,
        user_id: UUID,
        permission: Permission,
        context: Optional[PermissionContext],
        base_result: bool
    ) -> bool:
        """
        Check if user's clearance level allows access to the resource.
        
        Args:
            user_id: The user's UUID
            permission: The permission being checked
            context: The permission context
            base_result: The result from standard permission checking
            
        Returns:
            True if user has sufficient clearance, False otherwise
        """
        # If already has permission, no need to check
        if base_result:
            return True
        
        # Only applies to read permissions with resource context
        if not permission.value.endswith("_read"):
            return False
        
        if not context or not context.resource_id:
            return False
        
        try:
            if not self.supabase:
                return False
            
            # Get user's clearance level
            user_response = self.supabase.table("user_clearances").select(
                "clearance_level"
            ).eq("user_id", str(user_id)).execute()
            
            if not user_response.data or len(user_response.data) == 0:
                # No clearance = public only
                user_clearance = "public"
            else:
                user_clearance = user_response.data[0].get("clearance_level", "public")
            
            # Get resource's classification level
            resource_response = self.supabase.table("resource_classifications").select(
                "classification_level"
            ).eq("resource_id", str(context.resource_id)).execute()
            
            if not resource_response.data or len(resource_response.data) == 0:
                # No classification = public
                resource_classification = "public"
            else:
                resource_classification = resource_response.data[0].get(
                    "classification_level", "public"
                )
            
            # Check if user's clearance is sufficient
            user_level = self._classification_levels.get(user_clearance, 0)
            resource_level = self._classification_levels.get(resource_classification, 0)
            
            if user_level >= resource_level:
                logger.debug(
                    f"User {user_id} with clearance {user_clearance} "
                    f"granted access to {resource_classification} resource"
                )
                return True
            
            logger.info(
                f"User {user_id} with clearance {user_clearance} "
                f"denied access to {resource_classification} resource"
            )
            return False
            
        except Exception as e:
            logger.error(f"Error evaluating data classification rule: {e}")
            return False


class BusinessHoursRule(CustomPermissionRule):
    """
    Custom rule that restricts certain operations to business hours.
    
    Business rule: Sensitive operations (like deletions) can only be
    performed during business hours when support staff are available.
    """
    
    def __init__(
        self,
        start_hour: int = 9,
        end_hour: int = 17,
        business_days: list = None
    ):
        super().__init__(
            name="business_hours",
            description="Restrict sensitive operations to business hours"
        )
        self.start_hour = start_hour
        self.end_hour = end_hour
        # 0 = Monday, 6 = Sunday
        self.business_days = business_days or [0, 1, 2, 3, 4]  # Mon-Fri
    
    async def evaluate(
        self,
        user_id: UUID,
        permission: Permission,
        context: Optional[PermissionContext],
        base_result: bool
    ) -> bool:
        """
        Check if current time is within business hours for sensitive operations.
        
        Args:
            user_id: The user's UUID
            permission: The permission being checked
            context: The permission context
            base_result: The result from standard permission checking
            
        Returns:
            True if within business hours or not a sensitive operation
        """
        # If doesn't have base permission, deny regardless of time
        if not base_result:
            return False
        
        # Only restrict delete operations
        if not permission.value.endswith("_delete"):
            return True
        
        # Check if current time is within business hours
        now = datetime.now(timezone.utc)
        
        # Check day of week
        if now.weekday() not in self.business_days:
            logger.info(
                f"Denying {permission.value} for user {user_id} - "
                f"outside business days"
            )
            return False
        
        # Check hour of day
        if not (self.start_hour <= now.hour < self.end_hour):
            logger.info(
                f"Denying {permission.value} for user {user_id} - "
                f"outside business hours ({self.start_hour}-{self.end_hour})"
            )
            return False
        
        return True


class DelegationRule(CustomPermissionRule):
    """
    Custom rule for permission delegation.
    
    Business rule: Users can temporarily delegate their permissions to
    other users (e.g., when on vacation).
    """
    
    def __init__(self, supabase_client=None):
        super().__init__(
            name="delegation",
            description="Allow users to delegate permissions to others"
        )
        self.supabase = supabase_client
    
    async def evaluate(
        self,
        user_id: UUID,
        permission: Permission,
        context: Optional[PermissionContext],
        base_result: bool
    ) -> bool:
        """
        Check if user has delegated permissions from another user.
        
        Args:
            user_id: The user's UUID
            permission: The permission being checked
            context: The permission context
            base_result: The result from standard permission checking
            
        Returns:
            True if permission is delegated to this user, False otherwise
        """
        if base_result:
            return True
        
        try:
            if not self.supabase:
                return False
            
            # Check for active delegations to this user
            now = datetime.now(timezone.utc).isoformat()
            
            response = self.supabase.table("permission_delegations").select(
                "delegator_id, permission"
            ).eq("delegate_id", str(user_id)).eq(
                "permission", permission.value
            ).eq("is_active", True).gt("expires_at", now).execute()
            
            if response.data and len(response.data) > 0:
                delegator_id = response.data[0].get("delegator_id")
                logger.info(
                    f"User {user_id} granted {permission.value} via "
                    f"delegation from user {delegator_id}"
                )
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error evaluating delegation rule: {e}")
            return False


# Factory function to create common custom rules
def create_standard_custom_rules(supabase_client=None) -> list:
    """
    Create a set of standard custom permission rules.
    
    Args:
        supabase_client: Optional Supabase client for database operations
        
    Returns:
        List of CustomPermissionRule instances
    """
    return [
        ProjectOwnerRule(supabase_client),
        EmergencyAccessRule(supabase_client),
        DataClassificationRule(supabase_client),
        BusinessHoursRule(),
        DelegationRule(supabase_client),
    ]
