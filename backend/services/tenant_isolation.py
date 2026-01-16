"""
Tenant Isolation Utilities

This module provides utilities for enforcing tenant isolation in queries
and operations across the audit trail system.

Requirements: 9.1, 9.2, 9.3
"""

import logging
from typing import Optional, Dict, Any, List
from uuid import UUID
from functools import wraps
from fastapi import HTTPException, status

logger = logging.getLogger(__name__)


class TenantContext:
    """
    Thread-safe context for storing current tenant information.
    
    This class provides a way to store and retrieve the current tenant_id
    for the duration of a request.
    """
    
    _tenant_id: Optional[UUID] = None
    _user_id: Optional[UUID] = None
    
    @classmethod
    def set_tenant(cls, tenant_id: UUID, user_id: Optional[UUID] = None):
        """
        Set the current tenant context.
        
        Args:
            tenant_id: UUID of the current tenant
            user_id: Optional UUID of the current user
        """
        cls._tenant_id = tenant_id
        cls._user_id = user_id
        logger.debug(f"Tenant context set: tenant_id={tenant_id}, user_id={user_id}")
    
    @classmethod
    def get_tenant_id(cls) -> Optional[UUID]:
        """
        Get the current tenant ID from context.
        
        Returns:
            UUID of current tenant or None if not set
        """
        return cls._tenant_id
    
    @classmethod
    def get_user_id(cls) -> Optional[UUID]:
        """
        Get the current user ID from context.
        
        Returns:
            UUID of current user or None if not set
        """
        return cls._user_id
    
    @classmethod
    def clear(cls):
        """Clear the tenant context."""
        cls._tenant_id = None
        cls._user_id = None
        logger.debug("Tenant context cleared")
    
    @classmethod
    def require_tenant(cls) -> UUID:
        """
        Get the current tenant ID, raising an exception if not set.
        
        Returns:
            UUID of current tenant
            
        Raises:
            HTTPException: If tenant context is not set
        """
        tenant_id = cls.get_tenant_id()
        if tenant_id is None:
            logger.error("Tenant context not set when required")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tenant context required but not set"
            )
        return tenant_id


def require_tenant_context(func):
    """
    Decorator to ensure tenant context is set before executing a function.
    
    Usage:
        @require_tenant_context
        async def my_function():
            tenant_id = TenantContext.get_tenant_id()
            # ... use tenant_id
    """
    @wraps(func)
    async def wrapper(*args, **kwargs):
        TenantContext.require_tenant()
        return await func(*args, **kwargs)
    
    return wrapper


class TenantIsolationMixin:
    """
    Mixin class to add tenant isolation capabilities to service classes.
    
    This mixin provides methods to automatically add tenant_id filtering
    to database queries.
    """
    
    def add_tenant_filter(
        self,
        query,
        tenant_id: Optional[UUID] = None,
        allow_null: bool = False
    ):
        """
        Add tenant_id filter to a Supabase query.
        
        Args:
            query: Supabase query builder object
            tenant_id: Optional tenant ID (uses context if not provided)
            allow_null: If True, also includes records where tenant_id IS NULL
            
        Returns:
            Query with tenant filter applied
            
        Raises:
            HTTPException: If tenant_id is required but not available
        """
        # Get tenant_id from parameter or context
        if tenant_id is None:
            tenant_id = TenantContext.get_tenant_id()
        
        if tenant_id is None:
            logger.error("Tenant ID required for query but not available")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tenant isolation required: tenant_id not available"
            )
        
        # Apply tenant filter
        if allow_null:
            # Include records where tenant_id matches OR is NULL (for shared resources)
            query = query.or_(f"tenant_id.eq.{tenant_id},tenant_id.is.null")
        else:
            # Only include records where tenant_id matches
            query = query.eq("tenant_id", str(tenant_id))
        
        logger.debug(f"Applied tenant filter: tenant_id={tenant_id}, allow_null={allow_null}")
        return query
    
    def validate_tenant_access(
        self,
        record: Dict[str, Any],
        tenant_id: Optional[UUID] = None,
        allow_null: bool = False
    ) -> bool:
        """
        Validate that a record belongs to the current tenant.
        
        Args:
            record: Database record to validate
            tenant_id: Optional tenant ID (uses context if not provided)
            allow_null: If True, allows records where tenant_id IS NULL
            
        Returns:
            True if access is allowed, False otherwise
        """
        # Get tenant_id from parameter or context
        if tenant_id is None:
            tenant_id = TenantContext.get_tenant_id()
        
        if tenant_id is None:
            logger.warning("Cannot validate tenant access: tenant_id not available")
            return False
        
        record_tenant_id = record.get("tenant_id")
        
        # Check if record belongs to tenant
        if record_tenant_id is None:
            # NULL tenant_id (shared resource)
            return allow_null
        
        # Convert to UUID for comparison
        if isinstance(record_tenant_id, str):
            record_tenant_id = UUID(record_tenant_id)
        
        is_allowed = record_tenant_id == tenant_id
        
        if not is_allowed:
            logger.warning(
                f"Tenant access violation: record tenant_id={record_tenant_id}, "
                f"current tenant_id={tenant_id}"
            )
        
        return is_allowed
    
    def ensure_tenant_id(
        self,
        data: Dict[str, Any],
        tenant_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """
        Ensure that data includes tenant_id before insertion/update.
        
        Args:
            data: Data dictionary to modify
            tenant_id: Optional tenant ID (uses context if not provided)
            
        Returns:
            Modified data dictionary with tenant_id
            
        Raises:
            HTTPException: If tenant_id is required but not available
        """
        # Get tenant_id from parameter or context
        if tenant_id is None:
            tenant_id = TenantContext.get_tenant_id()
        
        if tenant_id is None:
            logger.error("Tenant ID required for data but not available")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tenant isolation required: tenant_id not available"
            )
        
        # Add tenant_id to data
        data["tenant_id"] = str(tenant_id)
        logger.debug(f"Added tenant_id to data: {tenant_id}")
        
        return data
    
    def filter_by_tenant(
        self,
        records: List[Dict[str, Any]],
        tenant_id: Optional[UUID] = None,
        allow_null: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Filter a list of records to only include those belonging to the tenant.
        
        This is a safety measure for cases where database-level filtering
        might not be applied.
        
        Args:
            records: List of database records
            tenant_id: Optional tenant ID (uses context if not provided)
            allow_null: If True, includes records where tenant_id IS NULL
            
        Returns:
            Filtered list of records
        """
        # Get tenant_id from parameter or context
        if tenant_id is None:
            tenant_id = TenantContext.get_tenant_id()
        
        if tenant_id is None:
            logger.warning("Cannot filter by tenant: tenant_id not available")
            return []
        
        filtered = [
            record for record in records
            if self.validate_tenant_access(record, tenant_id, allow_null)
        ]
        
        if len(filtered) < len(records):
            logger.warning(
                f"Filtered out {len(records) - len(filtered)} records "
                f"due to tenant isolation"
            )
        
        return filtered


def extract_tenant_from_user(user: Dict[str, Any]) -> Optional[UUID]:
    """
    Extract tenant_id from user object.
    
    This function handles different user object formats and extracts
    the tenant_id in a consistent way.
    
    Args:
        user: User object from authentication
        
    Returns:
        UUID of user's tenant or None if not found
    """
    if not user:
        return None
    
    # Try different possible locations for tenant_id
    tenant_id = None
    
    # Direct tenant_id field
    if "tenant_id" in user:
        tenant_id = user["tenant_id"]
    
    # Nested in user_metadata
    elif "user_metadata" in user and "tenant_id" in user["user_metadata"]:
        tenant_id = user["user_metadata"]["tenant_id"]
    
    # Nested in app_metadata
    elif "app_metadata" in user and "tenant_id" in user["app_metadata"]:
        tenant_id = user["app_metadata"]["tenant_id"]
    
    # Convert to UUID if string
    if tenant_id and isinstance(tenant_id, str):
        try:
            tenant_id = UUID(tenant_id)
        except ValueError:
            logger.error(f"Invalid tenant_id format: {tenant_id}")
            return None
    
    return tenant_id


def set_database_tenant_context(supabase_client, tenant_id: UUID):
    """
    Set tenant context in database session for RLS policies.
    
    This function sets a session variable that can be used by
    PostgreSQL row-level security policies.
    
    Args:
        supabase_client: Supabase client instance
        tenant_id: UUID of the tenant
    """
    try:
        # Set session variable for RLS policies
        # This assumes your RLS policies use current_setting('app.current_tenant_id')
        supabase_client.rpc(
            'set_config',
            {
                'setting': 'app.current_tenant_id',
                'value': str(tenant_id),
                'is_local': True
            }
        ).execute()
        
        logger.debug(f"Set database tenant context: {tenant_id}")
        
    except Exception as e:
        logger.error(f"Failed to set database tenant context: {e}")


# Convenience function for common use case
async def with_tenant_isolation(
    func,
    tenant_id: UUID,
    user_id: Optional[UUID] = None,
    *args,
    **kwargs
):
    """
    Execute a function with tenant context set.
    
    This is a convenience function that sets the tenant context,
    executes the function, and clears the context afterwards.
    
    Args:
        func: Async function to execute
        tenant_id: UUID of the tenant
        user_id: Optional UUID of the user
        *args: Positional arguments for func
        **kwargs: Keyword arguments for func
        
    Returns:
        Result of func execution
    """
    try:
        TenantContext.set_tenant(tenant_id, user_id)
        result = await func(*args, **kwargs)
        return result
    finally:
        TenantContext.clear()
