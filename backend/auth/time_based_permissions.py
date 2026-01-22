"""
Time-Based Permission System

This module provides time-based permission management with:
- Permission expiration enforcement
- Scheduled permission grants
- Temporary access management
- Time-window based permissions

Requirements: 7.4 - Time-based permissions with expiration enforcement
"""

from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from uuid import UUID
import logging

from .rbac import Permission
from .enhanced_rbac_models import (
    PermissionContext,
    RoleAssignment,
)

logger = logging.getLogger(__name__)


class TimeBasedPermission:
    """
    Model for time-based permission grants.
    
    Supports:
    - Expiration dates for temporary access
    - Start dates for scheduled access
    - Recurring time windows (e.g., business hours only)
    
    Requirements: 7.4 - Time-based permissions
    """
    
    def __init__(
        self,
        user_id: UUID,
        permission: Permission,
        context: Optional[PermissionContext] = None,
        starts_at: Optional[datetime] = None,
        expires_at: Optional[datetime] = None,
        time_windows: Optional[List[Dict[str, Any]]] = None,
        is_active: bool = True
    ):
        """
        Initialize a time-based permission.
        
        Args:
            user_id: The user's UUID
            permission: The permission being granted
            context: Optional context for scoped permission
            starts_at: When the permission becomes active
            expires_at: When the permission expires
            time_windows: Optional list of recurring time windows
            is_active: Whether the permission is currently active
        """
        self.user_id = user_id
        self.permission = permission
        self.context = context
        self.starts_at = starts_at
        self.expires_at = expires_at
        self.time_windows = time_windows or []
        self.is_active = is_active
    
    def is_valid_at(self, check_time: Optional[datetime] = None) -> bool:
        """
        Check if the permission is valid at a specific time.
        
        Args:
            check_time: The time to check (defaults to now)
            
        Returns:
            True if the permission is valid at the given time
        """
        if not self.is_active:
            return False
        
        check_time = check_time or datetime.now(timezone.utc)
        
        # Check start time
        if self.starts_at and check_time < self.starts_at:
            return False
        
        # Check expiration
        if self.expires_at and check_time > self.expires_at:
            return False
        
        # Check time windows if specified
        if self.time_windows:
            return self._is_within_time_window(check_time)
        
        return True
    
    def _is_within_time_window(self, check_time: datetime) -> bool:
        """
        Check if the time is within any of the allowed time windows.
        
        Time windows can specify:
        - Days of week (e.g., Monday-Friday)
        - Hours of day (e.g., 9:00-17:00)
        - Specific dates
        
        Args:
            check_time: The time to check
            
        Returns:
            True if within an allowed time window
        """
        for window in self.time_windows:
            if self._matches_time_window(check_time, window):
                return True
        return False
    
    def _matches_time_window(self, check_time: datetime, window: Dict[str, Any]) -> bool:
        """
        Check if a time matches a specific time window.
        
        Args:
            check_time: The time to check
            window: The time window specification
            
        Returns:
            True if the time matches the window
        """
        # Check day of week if specified
        if "days_of_week" in window:
            # 0 = Monday, 6 = Sunday
            if check_time.weekday() not in window["days_of_week"]:
                return False
        
        # Check hour range if specified
        if "start_hour" in window and "end_hour" in window:
            current_hour = check_time.hour + (check_time.minute / 60.0)
            if not (window["start_hour"] <= current_hour <= window["end_hour"]):
                return False
        
        # Check specific date range if specified
        if "start_date" in window and "end_date" in window:
            start_date = datetime.fromisoformat(window["start_date"])
            end_date = datetime.fromisoformat(window["end_date"])
            if not (start_date <= check_time <= end_date):
                return False
        
        return True
    
    def time_until_expiration(self) -> Optional[timedelta]:
        """
        Get the time remaining until this permission expires.
        
        Returns:
            Timedelta until expiration, or None if no expiration set
        """
        if not self.expires_at:
            return None
        
        now = datetime.now(timezone.utc)
        if now >= self.expires_at:
            return timedelta(0)
        
        return self.expires_at - now
    
    def time_until_activation(self) -> Optional[timedelta]:
        """
        Get the time remaining until this permission becomes active.
        
        Returns:
            Timedelta until activation, or None if already active or no start time
        """
        if not self.starts_at:
            return None
        
        now = datetime.now(timezone.utc)
        if now >= self.starts_at:
            return timedelta(0)
        
        return self.starts_at - now


class TimeBasedPermissionManager:
    """
    Manager for time-based permissions.
    
    Handles:
    - Creating and managing time-based permission grants
    - Checking permission validity at specific times
    - Automatic expiration enforcement
    - Cleanup of expired permissions
    
    Requirements: 7.4 - Time-based permission management
    """
    
    def __init__(self, supabase_client=None):
        """
        Initialize the TimeBasedPermissionManager.
        
        Args:
            supabase_client: Supabase client for database operations
        """
        self.supabase = supabase_client
        self._time_based_permissions: Dict[str, TimeBasedPermission] = {}
    
    async def grant_temporary_permission(
        self,
        user_id: UUID,
        permission: Permission,
        duration: timedelta,
        context: Optional[PermissionContext] = None,
        starts_at: Optional[datetime] = None
    ) -> TimeBasedPermission:
        """
        Grant a temporary permission that expires after a duration.
        
        Args:
            user_id: The user's UUID
            permission: The permission to grant
            duration: How long the permission should last
            context: Optional context for scoped permission
            starts_at: When the permission should start (defaults to now)
            
        Returns:
            The created TimeBasedPermission
            
        Requirements: 7.4 - Temporary access management
        """
        starts_at = starts_at or datetime.now(timezone.utc)
        expires_at = starts_at + duration
        
        time_perm = TimeBasedPermission(
            user_id=user_id,
            permission=permission,
            context=context,
            starts_at=starts_at,
            expires_at=expires_at
        )
        
        # Store in database if Supabase client is available
        if self.supabase:
            await self._store_time_based_permission(time_perm)
        
        # Store in memory cache
        cache_key = self._build_cache_key(user_id, permission, context)
        self._time_based_permissions[cache_key] = time_perm
        
        logger.info(
            f"Granted temporary permission {permission.value} to user {user_id} "
            f"until {expires_at}"
        )
        
        return time_perm
    
    async def grant_scheduled_permission(
        self,
        user_id: UUID,
        permission: Permission,
        starts_at: datetime,
        expires_at: datetime,
        context: Optional[PermissionContext] = None
    ) -> TimeBasedPermission:
        """
        Grant a permission that is active during a specific time period.
        
        Args:
            user_id: The user's UUID
            permission: The permission to grant
            starts_at: When the permission becomes active
            expires_at: When the permission expires
            context: Optional context for scoped permission
            
        Returns:
            The created TimeBasedPermission
            
        Requirements: 7.4 - Scheduled access management
        """
        time_perm = TimeBasedPermission(
            user_id=user_id,
            permission=permission,
            context=context,
            starts_at=starts_at,
            expires_at=expires_at
        )
        
        # Store in database if Supabase client is available
        if self.supabase:
            await self._store_time_based_permission(time_perm)
        
        # Store in memory cache
        cache_key = self._build_cache_key(user_id, permission, context)
        self._time_based_permissions[cache_key] = time_perm
        
        logger.info(
            f"Granted scheduled permission {permission.value} to user {user_id} "
            f"from {starts_at} to {expires_at}"
        )
        
        return time_perm
    
    async def grant_time_window_permission(
        self,
        user_id: UUID,
        permission: Permission,
        time_windows: List[Dict[str, Any]],
        expires_at: Optional[datetime] = None,
        context: Optional[PermissionContext] = None
    ) -> TimeBasedPermission:
        """
        Grant a permission that is only active during specific time windows.
        
        Example time windows:
        - Business hours: {"days_of_week": [0,1,2,3,4], "start_hour": 9, "end_hour": 17}
        - Weekends: {"days_of_week": [5,6]}
        - Specific period: {"start_date": "2024-01-01", "end_date": "2024-12-31"}
        
        Args:
            user_id: The user's UUID
            permission: The permission to grant
            time_windows: List of time window specifications
            expires_at: Optional overall expiration date
            context: Optional context for scoped permission
            
        Returns:
            The created TimeBasedPermission
            
        Requirements: 7.4 - Time-window based permissions
        """
        time_perm = TimeBasedPermission(
            user_id=user_id,
            permission=permission,
            context=context,
            expires_at=expires_at,
            time_windows=time_windows
        )
        
        # Store in database if Supabase client is available
        if self.supabase:
            await self._store_time_based_permission(time_perm)
        
        # Store in memory cache
        cache_key = self._build_cache_key(user_id, permission, context)
        self._time_based_permissions[cache_key] = time_perm
        
        logger.info(
            f"Granted time-window permission {permission.value} to user {user_id} "
            f"with {len(time_windows)} time windows"
        )
        
        return time_perm
    
    async def check_time_based_permission(
        self,
        user_id: UUID,
        permission: Permission,
        context: Optional[PermissionContext] = None,
        check_time: Optional[datetime] = None
    ) -> bool:
        """
        Check if a user has a time-based permission at a specific time.
        
        Args:
            user_id: The user's UUID
            permission: The permission to check
            context: Optional context for scoped permission
            check_time: The time to check (defaults to now)
            
        Returns:
            True if the user has the permission at the given time
            
        Requirements: 7.4 - Time-based permission checking
        """
        check_time = check_time or datetime.now(timezone.utc)
        
        # Check memory cache first
        cache_key = self._build_cache_key(user_id, permission, context)
        if cache_key in self._time_based_permissions:
            time_perm = self._time_based_permissions[cache_key]
            return time_perm.is_valid_at(check_time)
        
        # Check database if Supabase client is available
        if self.supabase:
            time_perms = await self._load_time_based_permissions(user_id, permission, context)
            for time_perm in time_perms:
                if time_perm.is_valid_at(check_time):
                    # Cache for future checks
                    self._time_based_permissions[cache_key] = time_perm
                    return True
        
        return False
    
    async def get_active_time_based_permissions(
        self,
        user_id: UUID,
        context: Optional[PermissionContext] = None
    ) -> List[TimeBasedPermission]:
        """
        Get all currently active time-based permissions for a user.
        
        Args:
            user_id: The user's UUID
            context: Optional context for scoped permissions
            
        Returns:
            List of active TimeBasedPermission objects
        """
        active_perms = []
        now = datetime.now(timezone.utc)
        
        # Check memory cache
        for cache_key, time_perm in self._time_based_permissions.items():
            if str(user_id) in cache_key and time_perm.is_valid_at(now):
                if context is None or self._context_matches(time_perm.context, context):
                    active_perms.append(time_perm)
        
        # Load from database if Supabase client is available
        if self.supabase:
            db_perms = await self._load_all_time_based_permissions(user_id, context)
            for time_perm in db_perms:
                if time_perm.is_valid_at(now):
                    active_perms.append(time_perm)
        
        return active_perms
    
    async def revoke_time_based_permission(
        self,
        user_id: UUID,
        permission: Permission,
        context: Optional[PermissionContext] = None
    ) -> bool:
        """
        Revoke a time-based permission.
        
        Args:
            user_id: The user's UUID
            permission: The permission to revoke
            context: Optional context for scoped permission
            
        Returns:
            True if the permission was revoked, False if not found
        """
        cache_key = self._build_cache_key(user_id, permission, context)
        
        # Remove from memory cache
        if cache_key in self._time_based_permissions:
            del self._time_based_permissions[cache_key]
        
        # Remove from database if Supabase client is available
        if self.supabase:
            await self._delete_time_based_permission(user_id, permission, context)
        
        logger.info(f"Revoked time-based permission {permission.value} for user {user_id}")
        return True
    
    async def cleanup_expired_permissions(self) -> int:
        """
        Remove expired time-based permissions from cache and database.
        
        Returns:
            Number of permissions cleaned up
            
        Requirements: 7.4 - Automatic expiration enforcement
        """
        now = datetime.now(timezone.utc)
        cleaned_count = 0
        
        # Clean memory cache
        expired_keys = [
            key for key, time_perm in self._time_based_permissions.items()
            if time_perm.expires_at and time_perm.expires_at < now
        ]
        
        for key in expired_keys:
            del self._time_based_permissions[key]
            cleaned_count += 1
        
        # Clean database if Supabase client is available
        if self.supabase:
            db_cleaned = await self._cleanup_expired_in_database()
            cleaned_count += db_cleaned
        
        if cleaned_count > 0:
            logger.info(f"Cleaned up {cleaned_count} expired time-based permissions")
        
        return cleaned_count
    
    # =========================================================================
    # Database Operations
    # =========================================================================
    
    async def _store_time_based_permission(
        self,
        time_perm: TimeBasedPermission
    ) -> None:
        """Store a time-based permission in the database."""
        try:
            data = {
                "user_id": str(time_perm.user_id),
                "permission": time_perm.permission.value,
                "starts_at": time_perm.starts_at.isoformat() if time_perm.starts_at else None,
                "expires_at": time_perm.expires_at.isoformat() if time_perm.expires_at else None,
                "time_windows": time_perm.time_windows,
                "is_active": time_perm.is_active,
            }
            
            # Add context fields if present
            if time_perm.context:
                if time_perm.context.project_id:
                    data["project_id"] = str(time_perm.context.project_id)
                if time_perm.context.portfolio_id:
                    data["portfolio_id"] = str(time_perm.context.portfolio_id)
                if time_perm.context.organization_id:
                    data["organization_id"] = str(time_perm.context.organization_id)
                if time_perm.context.resource_id:
                    data["resource_id"] = str(time_perm.context.resource_id)
            
            self.supabase.table("time_based_permissions").insert(data).execute()
            
        except Exception as e:
            logger.error(f"Error storing time-based permission: {e}")
    
    async def _load_time_based_permissions(
        self,
        user_id: UUID,
        permission: Permission,
        context: Optional[PermissionContext]
    ) -> List[TimeBasedPermission]:
        """Load time-based permissions from the database."""
        try:
            query = self.supabase.table("time_based_permissions").select(
                "*"
            ).eq("user_id", str(user_id)).eq("permission", permission.value).eq("is_active", True)
            
            # Add context filters if present
            if context:
                if context.project_id:
                    query = query.eq("project_id", str(context.project_id))
                if context.portfolio_id:
                    query = query.eq("portfolio_id", str(context.portfolio_id))
            
            response = query.execute()
            
            if not response.data:
                return []
            
            time_perms = []
            for row in response.data:
                time_perm = self._row_to_time_based_permission(row)
                if time_perm:
                    time_perms.append(time_perm)
            
            return time_perms
            
        except Exception as e:
            logger.error(f"Error loading time-based permissions: {e}")
            return []
    
    async def _load_all_time_based_permissions(
        self,
        user_id: UUID,
        context: Optional[PermissionContext]
    ) -> List[TimeBasedPermission]:
        """Load all time-based permissions for a user."""
        try:
            query = self.supabase.table("time_based_permissions").select(
                "*"
            ).eq("user_id", str(user_id)).eq("is_active", True)
            
            response = query.execute()
            
            if not response.data:
                return []
            
            time_perms = []
            for row in response.data:
                time_perm = self._row_to_time_based_permission(row)
                if time_perm:
                    time_perms.append(time_perm)
            
            return time_perms
            
        except Exception as e:
            logger.error(f"Error loading all time-based permissions: {e}")
            return []
    
    async def _delete_time_based_permission(
        self,
        user_id: UUID,
        permission: Permission,
        context: Optional[PermissionContext]
    ) -> None:
        """Delete a time-based permission from the database."""
        try:
            query = self.supabase.table("time_based_permissions").update(
                {"is_active": False}
            ).eq("user_id", str(user_id)).eq("permission", permission.value)
            
            # Add context filters if present
            if context:
                if context.project_id:
                    query = query.eq("project_id", str(context.project_id))
                if context.portfolio_id:
                    query = query.eq("portfolio_id", str(context.portfolio_id))
            
            query.execute()
            
        except Exception as e:
            logger.error(f"Error deleting time-based permission: {e}")
    
    async def _cleanup_expired_in_database(self) -> int:
        """Clean up expired permissions in the database."""
        try:
            now = datetime.now(timezone.utc).isoformat()
            
            response = self.supabase.table("time_based_permissions").update(
                {"is_active": False}
            ).lt("expires_at", now).eq("is_active", True).execute()
            
            return len(response.data) if response.data else 0
            
        except Exception as e:
            logger.error(f"Error cleaning up expired permissions in database: {e}")
            return 0
    
    def _row_to_time_based_permission(self, row: Dict[str, Any]) -> Optional[TimeBasedPermission]:
        """Convert a database row to a TimeBasedPermission object."""
        try:
            # Parse context
            context = None
            if any(key in row for key in ["project_id", "portfolio_id", "organization_id", "resource_id"]):
                context = PermissionContext(
                    project_id=UUID(row["project_id"]) if row.get("project_id") else None,
                    portfolio_id=UUID(row["portfolio_id"]) if row.get("portfolio_id") else None,
                    organization_id=UUID(row["organization_id"]) if row.get("organization_id") else None,
                    resource_id=UUID(row["resource_id"]) if row.get("resource_id") else None,
                )
            
            # Parse dates
            starts_at = None
            if row.get("starts_at"):
                starts_at = datetime.fromisoformat(row["starts_at"].replace("Z", "+00:00"))
            
            expires_at = None
            if row.get("expires_at"):
                expires_at = datetime.fromisoformat(row["expires_at"].replace("Z", "+00:00"))
            
            return TimeBasedPermission(
                user_id=UUID(row["user_id"]),
                permission=Permission(row["permission"]),
                context=context,
                starts_at=starts_at,
                expires_at=expires_at,
                time_windows=row.get("time_windows", []),
                is_active=row.get("is_active", True)
            )
            
        except Exception as e:
            logger.error(f"Error converting row to TimeBasedPermission: {e}")
            return None
    
    # =========================================================================
    # Helper Methods
    # =========================================================================
    
    def _build_cache_key(
        self,
        user_id: UUID,
        permission: Permission,
        context: Optional[PermissionContext]
    ) -> str:
        """Build a cache key for a time-based permission."""
        context_key = context.to_cache_key() if context else "global"
        return f"time_perm:{user_id}:{permission.value}:{context_key}"
    
    def _context_matches(
        self,
        perm_context: Optional[PermissionContext],
        check_context: Optional[PermissionContext]
    ) -> bool:
        """Check if two contexts match."""
        if perm_context is None and check_context is None:
            return True
        if perm_context is None or check_context is None:
            return False
        
        return (
            perm_context.project_id == check_context.project_id and
            perm_context.portfolio_id == check_context.portfolio_id and
            perm_context.organization_id == check_context.organization_id and
            perm_context.resource_id == check_context.resource_id
        )


# Singleton instance
_time_based_permission_manager: Optional[TimeBasedPermissionManager] = None


def get_time_based_permission_manager(
    supabase_client=None
) -> TimeBasedPermissionManager:
    """
    Get or create the singleton TimeBasedPermissionManager instance.
    
    Args:
        supabase_client: Optional Supabase client to use
        
    Returns:
        The TimeBasedPermissionManager singleton instance
    """
    global _time_based_permission_manager
    
    if _time_based_permission_manager is None:
        from config.database import supabase
        _time_based_permission_manager = TimeBasedPermissionManager(
            supabase_client=supabase_client or supabase
        )
    
    return _time_based_permission_manager
