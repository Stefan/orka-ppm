"""
RBAC Audit Service

Comprehensive audit logging service for role and permission changes.
Provides detailed tracking of all RBAC operations with context and metadata.

Requirements: 4.5 - Audit logging for role and permission changes
"""

from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from uuid import UUID
import logging

from config.database import supabase

logger = logging.getLogger(__name__)


class RBACAction:
    """Constants for RBAC audit actions"""
    ROLE_ASSIGNMENT_CREATED = "role_assignment_created"
    ROLE_ASSIGNMENT_REMOVED = "role_assignment_removed"
    ROLE_ASSIGNMENT_UPDATED = "role_assignment_updated"
    CUSTOM_ROLE_CREATED = "custom_role_created"
    CUSTOM_ROLE_UPDATED = "custom_role_updated"
    CUSTOM_ROLE_DELETED = "custom_role_deleted"
    PERMISSION_GRANTED = "permission_granted"
    PERMISSION_REVOKED = "permission_revoked"
    ROLE_PERMISSIONS_MODIFIED = "role_permissions_modified"
    SCOPE_CHANGED = "scope_changed"


class RBACEntityType:
    """Constants for RBAC entity types"""
    USER_ROLE = "user_role"
    ROLE = "role"
    PERMISSION = "permission"
    ROLE_ASSIGNMENT = "role_assignment"


class RBACAuditService:
    """
    Service for logging RBAC-related audit events.
    
    Provides comprehensive audit trail for:
    - Role assignments and removals
    - Custom role creation, updates, and deletion
    - Permission changes
    - Scope modifications
    """
    
    def __init__(self, supabase_client=None):
        """Initialize the audit service with optional Supabase client"""
        self.supabase = supabase_client or supabase
        
    def log_role_assignment(
        self,
        user_id: UUID,
        target_user_id: UUID,
        role_id: UUID,
        role_name: str,
        organization_id: Optional[UUID] = None,
        scope_type: Optional[str] = None,
        scope_id: Optional[UUID] = None,
        expires_at: Optional[datetime] = None,
        success: bool = True,
        error_message: Optional[str] = None
    ) -> Optional[str]:
        """
        Log a role assignment event.
        
        Args:
            user_id: ID of the user performing the action (admin)
            target_user_id: ID of the user receiving the role
            role_id: ID of the role being assigned
            role_name: Name of the role being assigned
            organization_id: Organization context
            scope_type: Type of scope (global, organization, portfolio, project)
            scope_id: ID of the scope entity
            expires_at: Expiration time for the role assignment
            success: Whether the operation succeeded
            error_message: Error message if operation failed
            
        Returns:
            Audit log ID if successful, None otherwise
        """
        try:
            audit_log = {
                "organization_id": str(organization_id) if organization_id else "00000000-0000-0000-0000-000000000000",
                "user_id": str(user_id),
                "action": RBACAction.ROLE_ASSIGNMENT_CREATED,
                "entity_type": RBACEntityType.USER_ROLE,
                "entity_id": str(role_id),
                "action_details": {
                    "target_user_id": str(target_user_id),
                    "role_id": str(role_id),
                    "role_name": role_name,
                    "scope_type": scope_type,
                    "scope_id": str(scope_id) if scope_id else None,
                    "expires_at": expires_at.isoformat() if expires_at else None,
                    "error_message": error_message,
                    "success": success
                },
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            response = self.supabase.table("audit_logs").insert(audit_log).execute()
            
            if response.data:
                logger.info(f"Logged role assignment: {role_name} to user {target_user_id}")
                return response.data[0].get("id")
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to log role assignment: {e}")
            return None
    
    def log_role_removal(
        self,
        user_id: UUID,
        target_user_id: UUID,
        role_id: UUID,
        role_name: str,
        organization_id: Optional[UUID] = None,
        scope_type: Optional[str] = None,
        scope_id: Optional[UUID] = None,
        success: bool = True,
        error_message: Optional[str] = None
    ) -> Optional[str]:
        """
        Log a role removal event.
        
        Args:
            user_id: ID of the user performing the action (admin)
            target_user_id: ID of the user losing the role
            role_id: ID of the role being removed
            role_name: Name of the role being removed
            organization_id: Organization context
            scope_type: Type of scope
            scope_id: ID of the scope entity
            success: Whether the operation succeeded
            error_message: Error message if operation failed
            
        Returns:
            Audit log ID if successful, None otherwise
        """
        try:
            audit_log = {
                "organization_id": str(organization_id) if organization_id else "00000000-0000-0000-0000-000000000000",
                "user_id": str(user_id),
                "action": RBACAction.ROLE_ASSIGNMENT_REMOVED,
                "entity_type": RBACEntityType.USER_ROLE,
                "entity_id": str(role_id),
                "action_details": {
                    "target_user_id": str(target_user_id),
                    "role_id": str(role_id),
                    "role_name": role_name,
                    "scope_type": scope_type,
                    "scope_id": str(scope_id) if scope_id else None,
                    "error_message": error_message,
                    "success": success
                },
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            response = self.supabase.table("audit_logs").insert(audit_log).execute()
            
            if response.data:
                logger.info(f"Logged role removal: {role_name} from user {target_user_id}")
                return response.data[0].get("id")
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to log role removal: {e}")
            return None
    
    def log_custom_role_creation(
        self,
        user_id: UUID,
        role_id: UUID,
        role_name: str,
        permissions: List[str],
        description: str,
        organization_id: Optional[UUID] = None,
        success: bool = True,
        error_message: Optional[str] = None
    ) -> Optional[str]:
        """
        Log a custom role creation event.
        
        Args:
            user_id: ID of the user creating the role (admin)
            role_id: ID of the newly created role
            role_name: Name of the new role
            permissions: List of permissions assigned to the role
            description: Role description
            organization_id: Organization context
            success: Whether the operation succeeded
            error_message: Error message if operation failed
            
        Returns:
            Audit log ID if successful, None otherwise
        """
        try:
            audit_log = {
                "organization_id": str(organization_id) if organization_id else "00000000-0000-0000-0000-000000000000",
                "user_id": str(user_id),
                "action": RBACAction.CUSTOM_ROLE_CREATED,
                "entity_type": RBACEntityType.ROLE,
                "entity_id": str(role_id),
                "action_details": {
                    "role_name": role_name,
                    "permissions": permissions,
                    "permissions_count": len(permissions),
                    "description": description,
                    "error_message": error_message,
                    "success": success
                },
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            response = self.supabase.table("audit_logs").insert(audit_log).execute()
            
            if response.data:
                logger.info(f"Logged custom role creation: {role_name}")
                return response.data[0].get("id")
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to log custom role creation: {e}")
            return None
    
    def log_custom_role_update(
        self,
        user_id: UUID,
        role_id: UUID,
        role_name: str,
        old_permissions: List[str],
        new_permissions: List[str],
        old_description: str,
        new_description: str,
        organization_id: Optional[UUID] = None,
        success: bool = True,
        error_message: Optional[str] = None
    ) -> Optional[str]:
        """
        Log a custom role update event.
        
        Args:
            user_id: ID of the user updating the role (admin)
            role_id: ID of the role being updated
            role_name: Name of the role
            old_permissions: Previous permissions list
            new_permissions: New permissions list
            old_description: Previous description
            new_description: New description
            organization_id: Organization context
            success: Whether the operation succeeded
            error_message: Error message if operation failed
            
        Returns:
            Audit log ID if successful, None otherwise
        """
        try:
            # Calculate permission changes
            added_permissions = list(set(new_permissions) - set(old_permissions))
            removed_permissions = list(set(old_permissions) - set(new_permissions))
            
            audit_log = {
                "organization_id": str(organization_id) if organization_id else "00000000-0000-0000-0000-000000000000",
                "user_id": str(user_id),
                "action": RBACAction.CUSTOM_ROLE_UPDATED,
                "entity_type": RBACEntityType.ROLE,
                "entity_id": str(role_id),
                "action_details": {
                    "role_name": role_name,
                    "old_permissions": old_permissions,
                    "new_permissions": new_permissions,
                    "added_permissions": added_permissions,
                    "removed_permissions": removed_permissions,
                    "old_description": old_description,
                    "new_description": new_description,
                    "description_changed": old_description != new_description,
                    "error_message": error_message,
                    "success": success
                },
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            response = self.supabase.table("audit_logs").insert(audit_log).execute()
            
            if response.data:
                logger.info(f"Logged custom role update: {role_name}")
                return response.data[0].get("id")
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to log custom role update: {e}")
            return None
    
    def log_custom_role_deletion(
        self,
        user_id: UUID,
        role_id: UUID,
        role_name: str,
        permissions: List[str],
        affected_users_count: int,
        organization_id: Optional[UUID] = None,
        success: bool = True,
        error_message: Optional[str] = None
    ) -> Optional[str]:
        """
        Log a custom role deletion event.
        
        Args:
            user_id: ID of the user deleting the role (admin)
            role_id: ID of the role being deleted
            role_name: Name of the role
            permissions: Permissions that were assigned to the role
            affected_users_count: Number of users who had this role
            organization_id: Organization context
            success: Whether the operation succeeded
            error_message: Error message if operation failed
            
        Returns:
            Audit log ID if successful, None otherwise
        """
        try:
            audit_log = {
                "organization_id": str(organization_id) if organization_id else "00000000-0000-0000-0000-000000000000",
                "user_id": str(user_id),
                "action": RBACAction.CUSTOM_ROLE_DELETED,
                "entity_type": RBACEntityType.ROLE,
                "entity_id": str(role_id),
                "action_details": {
                    "role_name": role_name,
                    "permissions": permissions,
                    "permissions_count": len(permissions),
                    "affected_users": affected_users_count,
                    "error_message": error_message,
                    "success": success
                },
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            response = self.supabase.table("audit_logs").insert(audit_log).execute()
            
            if response.data:
                logger.info(f"Logged custom role deletion: {role_name}")
                return response.data[0].get("id")
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to log custom role deletion: {e}")
            return None
    
    def get_role_change_history(
        self,
        limit: int = 100,
        offset: int = 0,
        user_id: Optional[UUID] = None,
        target_user_id: Optional[UUID] = None,
        role_name: Optional[str] = None,
        action: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Retrieve role change history with filtering options.
        
        Args:
            limit: Maximum number of records to return
            offset: Number of records to skip
            user_id: Filter by admin user who made the change
            target_user_id: Filter by user who was affected
            role_name: Filter by role name
            action: Filter by action type
            start_date: Filter by start date
            end_date: Filter by end date
            
        Returns:
            Dictionary with audit logs and pagination info
        """
        try:
            # Build query
            query = self.supabase.table("audit_logs").select("*", count="exact")
            
            # Filter by RBAC actions
            rbac_actions = [
                RBACAction.ROLE_ASSIGNMENT_CREATED,
                RBACAction.ROLE_ASSIGNMENT_REMOVED,
                RBACAction.CUSTOM_ROLE_CREATED,
                RBACAction.CUSTOM_ROLE_UPDATED,
                RBACAction.CUSTOM_ROLE_DELETED
            ]
            
            if action:
                query = query.eq("action", action)
            else:
                query = query.in_("action", rbac_actions)
            
            # Apply filters
            if user_id:
                query = query.eq("user_id", str(user_id))
            
            if target_user_id:
                query = query.contains("details", {"target_user_id": str(target_user_id)})
            
            if role_name:
                query = query.contains("details", {"role_name": role_name})
            
            if start_date:
                query = query.gte("created_at", start_date.isoformat())
            
            if end_date:
                query = query.lte("created_at", end_date.isoformat())
            
            # Order by most recent first
            query = query.order("created_at", desc=True)
            
            # Apply pagination
            query = query.range(offset, offset + limit - 1)
            
            response = query.execute()
            
            total_count = response.count if response.count is not None else 0
            
            return {
                "logs": response.data or [],
                "total_count": total_count,
                "page": (offset // limit) + 1,
                "per_page": limit,
                "total_pages": (total_count + limit - 1) // limit if total_count > 0 else 0
            }
            
        except Exception as e:
            logger.error(f"Failed to retrieve role change history: {e}")
            return {
                "logs": [],
                "total_count": 0,
                "page": 1,
                "per_page": limit,
                "total_pages": 0,
                "error": str(e)
            }
    
    def get_user_role_history(
        self,
        target_user_id: UUID,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Get complete role change history for a specific user.
        
        Args:
            target_user_id: ID of the user to get history for
            limit: Maximum number of records to return
            
        Returns:
            List of audit log entries for the user
        """
        try:
            response = self.supabase.table("audit_logs").select("*").in_(
                "action",
                [RBACAction.ROLE_ASSIGNMENT_CREATED, RBACAction.ROLE_ASSIGNMENT_REMOVED]
            ).contains(
                "details",
                {"target_user_id": str(target_user_id)}
            ).order("created_at", desc=True).limit(limit).execute()
            
            return response.data or []
            
        except Exception as e:
            logger.error(f"Failed to retrieve user role history: {e}")
            return []
    
    def get_role_modification_history(
        self,
        role_id: UUID,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Get complete modification history for a specific role.
        
        Args:
            role_id: ID of the role to get history for
            limit: Maximum number of records to return
            
        Returns:
            List of audit log entries for the role
        """
        try:
            response = self.supabase.table("audit_logs").select("*").eq(
                "entity_id", str(role_id)
            ).in_(
                "action",
                [
                    RBACAction.CUSTOM_ROLE_CREATED,
                    RBACAction.CUSTOM_ROLE_UPDATED,
                    RBACAction.CUSTOM_ROLE_DELETED
                ]
            ).order("created_at", desc=True).limit(limit).execute()
            
            return response.data or []
            
        except Exception as e:
            logger.error(f"Failed to retrieve role modification history: {e}")
            return []
