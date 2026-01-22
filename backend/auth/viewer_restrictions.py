"""
Viewer Role Restrictions and Controls

This module provides functionality for enforcing viewer role restrictions:
- Read-only access enforcement
- Write operation prevention
- Financial data access filtering
- Organizational report access control

Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
"""

from typing import List, Optional, Set, Dict, Any
from uuid import UUID
import logging

from .rbac import Permission, UserRole, DEFAULT_ROLE_PERMISSIONS
from .enhanced_rbac_models import PermissionContext
from .enhanced_permission_checker import EnhancedPermissionChecker

logger = logging.getLogger(__name__)


class ViewerRestrictionChecker:
    """
    Checker for viewer role restrictions and controls.
    
    This class provides methods to:
    - Enforce read-only access for viewers
    - Prevent write operations
    - Filter financial data based on viewer access level
    - Control organizational report access
    
    Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
    """
    
    # Write permissions that viewers should never have
    WRITE_PERMISSIONS = {
        Permission.portfolio_create,
        Permission.portfolio_update,
        Permission.portfolio_delete,
        Permission.project_create,
        Permission.project_update,
        Permission.project_delete,
        Permission.resource_create,
        Permission.resource_update,
        Permission.resource_delete,
        Permission.resource_allocate,
        Permission.financial_create,
        Permission.financial_update,
        Permission.financial_delete,
        Permission.budget_alert_manage,
        Permission.risk_create,
        Permission.risk_update,
        Permission.risk_delete,
        Permission.issue_create,
        Permission.issue_update,
        Permission.issue_delete,
        Permission.user_manage,
        Permission.role_manage,
        Permission.system_admin,
        Permission.data_import,
        Permission.pmr_create,
        Permission.pmr_update,
        Permission.pmr_delete,
        Permission.pmr_approve,
        Permission.pmr_template_manage,
        Permission.shareable_url_create,
        Permission.shareable_url_revoke,
        Permission.shareable_url_manage,
        Permission.simulation_delete,
        Permission.simulation_manage,
        Permission.scenario_create,
        Permission.scenario_update,
        Permission.scenario_delete,
        Permission.change_create,
        Permission.change_update,
        Permission.change_delete,
        Permission.change_approve,
        Permission.change_implement,
        Permission.po_breakdown_import,
        Permission.po_breakdown_create,
        Permission.po_breakdown_update,
        Permission.po_breakdown_delete,
        Permission.report_template_create,
        Permission.report_template_manage,
        Permission.workflow_create,
        Permission.workflow_update,
        Permission.workflow_delete,
        Permission.workflow_approve,
        Permission.workflow_manage,
    }
    
    # Read permissions that viewers should have
    READ_PERMISSIONS = {
        Permission.portfolio_read,
        Permission.project_read,
        Permission.resource_read,
        Permission.financial_read,
        Permission.risk_read,
        Permission.issue_read,
        Permission.ai_rag_query,
        Permission.pmr_read,
        Permission.simulation_read,
        Permission.scenario_read,
        Permission.change_read,
        Permission.po_breakdown_read,
        Permission.report_read,
        Permission.AUDIT_READ,
        Permission.workflow_read,
    }
    
    def __init__(self, permission_checker: Optional[EnhancedPermissionChecker] = None):
        """
        Initialize the ViewerRestrictionChecker.
        
        Args:
            permission_checker: Optional EnhancedPermissionChecker instance
        """
        self.permission_checker = permission_checker
        if self.permission_checker is None:
            from .enhanced_permission_checker import get_enhanced_permission_checker
            self.permission_checker = get_enhanced_permission_checker()
    
    async def is_viewer_only(
        self,
        user_id: UUID,
        context: Optional[PermissionContext] = None
    ) -> bool:
        """
        Check if a user has only viewer-level permissions.
        
        A user is considered viewer-only if they have no write permissions
        in the given context.
        
        Args:
            user_id: The user's UUID
            context: Optional context for scoped permission checking
            
        Returns:
            True if the user has only viewer permissions, False otherwise
            
        Requirements: 6.1 - Read-only access enforcement
        """
        try:
            # Get user's permissions in the context
            user_permissions = await self.permission_checker.get_user_permissions(user_id, context)
            user_permissions_set = set(user_permissions)
            
            # Check if user has any write permissions
            has_write_permission = bool(user_permissions_set & self.WRITE_PERMISSIONS)
            
            return not has_write_permission
            
        except Exception as e:
            logger.error(f"Error checking if user {user_id} is viewer-only: {e}")
            # Default to viewer-only on error for safety
            return True
    
    async def enforce_read_only_access(
        self,
        user_id: UUID,
        requested_permission: Permission,
        context: Optional[PermissionContext] = None
    ) -> bool:
        """
        Enforce read-only access for viewer roles.
        
        This method checks if:
        1. The user has the requested permission
        2. If the permission is a write permission, the user is not viewer-only
        
        Args:
            user_id: The user's UUID
            requested_permission: The permission being requested
            context: Optional context for scoped permission checking
            
        Returns:
            True if access is allowed, False if denied
            
        Requirements: 6.1, 6.2 - Read-only access enforcement and write prevention
        """
        try:
            # Check if user has the requested permission
            has_permission = await self.permission_checker.check_permission(
                user_id, requested_permission, context
            )
            
            if not has_permission:
                return False
            
            # If it's a write permission, verify user is not viewer-only
            if requested_permission in self.WRITE_PERMISSIONS:
                is_viewer = await self.is_viewer_only(user_id, context)
                if is_viewer:
                    logger.warning(
                        f"Viewer-only user {user_id} attempted write operation: {requested_permission.value}"
                    )
                    return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error enforcing read-only access for user {user_id}: {e}")
            return False
    
    async def prevent_write_operation(
        self,
        user_id: UUID,
        operation: str,
        context: Optional[PermissionContext] = None
    ) -> tuple[bool, Optional[str]]:
        """
        Prevent write operations for viewer-only users.
        
        Args:
            user_id: The user's UUID
            operation: Description of the operation being attempted
            context: Optional context for scoped permission checking
            
        Returns:
            Tuple of (is_allowed, error_message)
            - is_allowed: True if operation is allowed, False if denied
            - error_message: Error message if denied, None if allowed
            
        Requirements: 6.2 - Write operation prevention
        """
        try:
            is_viewer = await self.is_viewer_only(user_id, context)
            
            if is_viewer:
                error_message = (
                    f"Write operation denied: User has read-only access. "
                    f"Operation '{operation}' requires write permissions."
                )
                logger.warning(f"Write operation prevented for viewer user {user_id}: {operation}")
                return (False, error_message)
            
            return (True, None)
            
        except Exception as e:
            logger.error(f"Error preventing write operation for user {user_id}: {e}")
            error_message = f"Error checking write permissions: {str(e)}"
            return (False, error_message)
    
    async def get_financial_data_access_level(
        self,
        user_id: UUID,
        context: Optional[PermissionContext] = None
    ) -> str:
        """
        Determine the financial data access level for a user.
        
        Access levels:
        - "full": Full access to all financial data (non-viewers)
        - "summary": Summary-level access only (viewers)
        - "none": No financial data access
        
        Args:
            user_id: The user's UUID
            context: Optional context for scoped permission checking
            
        Returns:
            Access level string: "full", "summary", or "none"
            
        Requirements: 6.3 - Financial data access filtering
        """
        try:
            # Check if user has financial read permission
            has_financial_read = await self.permission_checker.check_permission(
                user_id, Permission.financial_read, context
            )
            
            if not has_financial_read:
                return "none"
            
            # Check if user is viewer-only
            is_viewer = await self.is_viewer_only(user_id, context)
            
            if is_viewer:
                return "summary"
            else:
                return "full"
            
        except Exception as e:
            logger.error(f"Error determining financial data access level for user {user_id}: {e}")
            return "none"
    
    async def filter_financial_data(
        self,
        user_id: UUID,
        financial_data: Dict[str, Any],
        context: Optional[PermissionContext] = None
    ) -> Dict[str, Any]:
        """
        Filter financial data based on user's access level.
        
        For viewers (summary access):
        - Include: totals, aggregates, high-level metrics
        - Exclude: detailed line items, sensitive cost breakdowns, vendor details
        
        For non-viewers (full access):
        - Include: all financial data
        
        Args:
            user_id: The user's UUID
            financial_data: The financial data to filter
            context: Optional context for scoped permission checking
            
        Returns:
            Filtered financial data dictionary
            
        Requirements: 6.3 - Financial data access filtering
        """
        try:
            access_level = await self.get_financial_data_access_level(user_id, context)
            
            if access_level == "none":
                return {}
            
            if access_level == "full":
                return financial_data
            
            # Summary access - filter to high-level data only
            filtered_data = {}
            
            # Include summary fields
            summary_fields = {
                "total_budget",
                "total_spent",
                "total_remaining",
                "budget_variance",
                "budget_variance_percentage",
                "total_committed",
                "total_forecast",
                "project_id",
                "portfolio_id",
                "currency",
                "last_updated",
                "status",
            }
            
            for field in summary_fields:
                if field in financial_data:
                    filtered_data[field] = financial_data[field]
            
            # Exclude sensitive fields
            # (line_items, vendor_details, cost_breakdowns, etc. are not included)
            
            return filtered_data
            
        except Exception as e:
            logger.error(f"Error filtering financial data for user {user_id}: {e}")
            return {}
    
    async def get_report_access_level(
        self,
        user_id: UUID,
        report_type: str,
        context: Optional[PermissionContext] = None
    ) -> str:
        """
        Determine the report access level for a user.
        
        Access levels:
        - "full": Full access to all reports
        - "organizational": Access to reports at user's organizational level
        - "none": No report access
        
        Args:
            user_id: The user's UUID
            report_type: Type of report being accessed
            context: Optional context for scoped permission checking
            
        Returns:
            Access level string: "full", "organizational", or "none"
            
        Requirements: 6.4 - Organizational report access control
        """
        try:
            # Check if user has report read permission
            has_report_read = await self.permission_checker.check_permission(
                user_id, Permission.report_read, context
            )
            
            if not has_report_read:
                return "none"
            
            # Check if user is viewer-only
            is_viewer = await self.is_viewer_only(user_id, context)
            
            if is_viewer:
                # Viewers get organizational-level access
                return "organizational"
            else:
                # Non-viewers get full access
                return "full"
            
        except Exception as e:
            logger.error(f"Error determining report access level for user {user_id}: {e}")
            return "none"
    
    async def can_access_report(
        self,
        user_id: UUID,
        report_type: str,
        report_scope: Optional[PermissionContext] = None,
        user_context: Optional[PermissionContext] = None
    ) -> tuple[bool, Optional[str]]:
        """
        Check if a user can access a specific report.
        
        For viewers:
        - Can access reports within their organizational scope
        - Cannot access reports outside their scope
        
        For non-viewers:
        - Can access all reports they have permission for
        
        Args:
            user_id: The user's UUID
            report_type: Type of report being accessed
            report_scope: The scope of the report (what it covers)
            user_context: The user's organizational context
            
        Returns:
            Tuple of (can_access, denial_reason)
            
        Requirements: 6.4 - Organizational report access control
        """
        try:
            access_level = await self.get_report_access_level(user_id, report_type, user_context)
            
            if access_level == "none":
                return (False, "User does not have permission to access reports")
            
            if access_level == "full":
                return (True, None)
            
            # Organizational access - check scope matching
            if report_scope is None or user_context is None:
                # If no scope information, allow access
                return (True, None)
            
            # Check if report scope matches user's organizational context
            if report_scope.organization_id and user_context.organization_id:
                if report_scope.organization_id != user_context.organization_id:
                    return (False, "Report is outside user's organizational scope")
            
            if report_scope.portfolio_id and user_context.portfolio_id:
                if report_scope.portfolio_id != user_context.portfolio_id:
                    return (False, "Report is outside user's portfolio scope")
            
            if report_scope.project_id and user_context.project_id:
                if report_scope.project_id != user_context.project_id:
                    return (False, "Report is outside user's project scope")
            
            return (True, None)
            
        except Exception as e:
            logger.error(f"Error checking report access for user {user_id}: {e}")
            return (False, f"Error checking report access: {str(e)}")
    
    async def get_ui_indicators(
        self,
        user_id: UUID,
        context: Optional[PermissionContext] = None
    ) -> Dict[str, Any]:
        """
        Get UI indicators for read-only access.
        
        Returns information about:
        - Whether user has read-only access
        - Which features are disabled
        - UI messages to display
        
        Args:
            user_id: The user's UUID
            context: Optional context for scoped permission checking
            
        Returns:
            Dictionary with UI indicator information
            
        Requirements: 6.5 - Read-only UI indication
        """
        try:
            is_viewer = await self.is_viewer_only(user_id, context)
            
            if not is_viewer:
                return {
                    "is_read_only": False,
                    "disabled_features": [],
                    "ui_message": None,
                    "show_read_only_badge": False,
                }
            
            # Get user's permissions to determine what they can see
            user_permissions = await self.permission_checker.get_user_permissions(user_id, context)
            user_permissions_set = set(user_permissions)
            
            # Determine disabled features
            disabled_features = []
            if Permission.project_create not in user_permissions_set:
                disabled_features.append("create_project")
            if Permission.project_update not in user_permissions_set:
                disabled_features.append("edit_project")
            if Permission.project_delete not in user_permissions_set:
                disabled_features.append("delete_project")
            if Permission.resource_allocate not in user_permissions_set:
                disabled_features.append("allocate_resources")
            if Permission.financial_create not in user_permissions_set:
                disabled_features.append("create_financial_entry")
            if Permission.financial_update not in user_permissions_set:
                disabled_features.append("edit_financial_entry")
            
            return {
                "is_read_only": True,
                "disabled_features": disabled_features,
                "ui_message": "You have read-only access to this content",
                "show_read_only_badge": True,
                "financial_access_level": await self.get_financial_data_access_level(user_id, context),
            }
            
        except Exception as e:
            logger.error(f"Error getting UI indicators for user {user_id}: {e}")
            return {
                "is_read_only": True,
                "disabled_features": [],
                "ui_message": "Access level could not be determined",
                "show_read_only_badge": True,
            }


# Create a singleton instance
_viewer_restriction_checker: Optional[ViewerRestrictionChecker] = None


def get_viewer_restriction_checker(
    permission_checker: Optional[EnhancedPermissionChecker] = None
) -> ViewerRestrictionChecker:
    """
    Get or create the singleton ViewerRestrictionChecker instance.
    
    Args:
        permission_checker: Optional EnhancedPermissionChecker instance
        
    Returns:
        The ViewerRestrictionChecker singleton instance
    """
    global _viewer_restriction_checker
    
    if _viewer_restriction_checker is None:
        _viewer_restriction_checker = ViewerRestrictionChecker(permission_checker)
    
    return _viewer_restriction_checker
