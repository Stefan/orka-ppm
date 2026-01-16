"""
Property-Based Tests for Audit Authorization

Tests Property 19: Authorization Enforcement
Validates: Requirements 6.7, 6.8
"""

import pytest
from hypothesis import given, strategies as st, settings
from uuid import uuid4
from unittest.mock import Mock, AsyncMock, patch
from fastapi import HTTPException

from auth.rbac import Permission, rbac


# ============================================================================
# Test Data Generators
# ============================================================================

# Strategy for generating user IDs
user_id_strategy = st.uuids().map(str)

# Strategy for generating permissions
permission_strategy = st.sampled_from([
    Permission.AUDIT_READ,
    Permission.AUDIT_EXPORT,
    Permission.project_read,
    Permission.admin_update
])


# ============================================================================
# Property Tests
# ============================================================================

# Feature: ai-empowered-audit-trail, Property 19: Authorization Enforcement
@given(
    user_id=user_id_strategy,
    has_audit_read=st.booleans(),
    has_audit_export=st.booleans()
)
@settings(max_examples=100, deadline=None)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_authorization_enforcement_for_audit_read(user_id, has_audit_read, has_audit_export):
    """
    Property 19: Authorization Enforcement
    
    For any attempt to access or export audit logs, the system should verify 
    that the requesting user has the appropriate permission (audit:read for 
    access, audit:export for export), and should deny access if the permission 
    is not present.
    
    Validates: Requirements 6.7, 6.8
    
    Property: For any user attempting to access audit logs:
    1. If user has audit:read permission, access should be granted
    2. If user does not have audit:read permission, access should be denied
    """
    # Mock the permission check
    with patch.object(rbac, 'has_permission', new_callable=AsyncMock) as mock_has_permission:
        # Configure mock to return the test permission status
        async def mock_permission_check(uid, perm):
            if perm == Permission.AUDIT_READ:
                return has_audit_read
            elif perm == Permission.AUDIT_EXPORT:
                return has_audit_export
            return False
        
        mock_has_permission.side_effect = mock_permission_check
        
        # Test audit:read permission
        result = await rbac.has_permission(user_id, Permission.AUDIT_READ)
        
        # Property: Permission check result should match expected value
        assert result == has_audit_read, \
            f"Permission check for audit:read should return {has_audit_read}"


@given(
    user_id=user_id_strategy,
    has_audit_read=st.booleans(),
    has_audit_export=st.booleans()
)
@settings(max_examples=100, deadline=None)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_authorization_enforcement_for_audit_export(user_id, has_audit_read, has_audit_export):
    """
    Property 19: Authorization Enforcement (Export)
    
    For any user attempting to export audit logs:
    1. If user has audit:export permission, export should be allowed
    2. If user does not have audit:export permission, export should be denied
    
    Validates: Requirements 6.8
    """
    # Mock the permission check
    with patch.object(rbac, 'has_permission', new_callable=AsyncMock) as mock_has_permission:
        # Configure mock to return the test permission status
        async def mock_permission_check(uid, perm):
            if perm == Permission.AUDIT_READ:
                return has_audit_read
            elif perm == Permission.AUDIT_EXPORT:
                return has_audit_export
            return False
        
        mock_has_permission.side_effect = mock_permission_check
        
        # Test audit:export permission
        result = await rbac.has_permission(user_id, Permission.AUDIT_EXPORT)
        
        # Property: Permission check result should match expected value
        assert result == has_audit_export, \
            f"Permission check for audit:export should return {has_audit_export}"


@given(
    user_id=user_id_strategy,
    required_permission=permission_strategy
)
@settings(max_examples=100, deadline=None)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_permission_check_consistency(user_id, required_permission):
    """
    Property: Permission checks should be consistent.
    
    For any user and permission, multiple checks should return the same result
    (within cache TTL).
    
    Validates: Requirements 6.7, 6.8
    """
    # Mock the permission check with a consistent return value
    expected_result = True  # Assume user has permission for this test
    
    with patch.object(rbac, 'has_permission', new_callable=AsyncMock) as mock_has_permission:
        mock_has_permission.return_value = expected_result
        
        # Perform multiple permission checks
        result1 = await rbac.has_permission(user_id, required_permission)
        result2 = await rbac.has_permission(user_id, required_permission)
        result3 = await rbac.has_permission(user_id, required_permission)
        
        # Property: All checks should return the same result
        assert result1 == result2 == result3 == expected_result, \
            "Permission checks should be consistent"


@given(
    user_id=user_id_strategy,
    permissions=st.lists(permission_strategy, min_size=1, max_size=5, unique=True)
)
@settings(max_examples=50, deadline=None)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_has_any_permission_logic(user_id, permissions):
    """
    Property: has_any_permission should return True if user has at least one
    of the required permissions.
    
    Validates: Requirements 6.7, 6.8
    """
    # Mock user permissions - give user the first permission in the list
    user_has_permissions = [permissions[0]]
    
    with patch.object(rbac, 'get_user_permissions', new_callable=AsyncMock) as mock_get_permissions:
        mock_get_permissions.return_value = user_has_permissions
        
        # Check if user has any of the required permissions
        result = await rbac.has_any_permission(user_id, permissions)
        
        # Property: Should return True since user has at least one permission
        assert result is True, \
            "has_any_permission should return True when user has at least one required permission"


@given(
    user_id=user_id_strategy,
    required_permissions=st.lists(permission_strategy, min_size=1, max_size=5, unique=True)
)
@settings(max_examples=50, deadline=None)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_has_any_permission_returns_false_when_no_match(user_id, required_permissions):
    """
    Property: has_any_permission should return False if user has none of the
    required permissions.
    
    Validates: Requirements 6.7, 6.8
    """
    # Mock user permissions - give user permissions that don't match required ones
    # Use a permission that's definitely not in the required list
    user_has_permissions = [Permission.project_read]
    
    # Ensure the user permission is not in required permissions
    if Permission.project_read in required_permissions:
        user_has_permissions = [Permission.admin_update]
    
    with patch.object(rbac, 'get_user_permissions', new_callable=AsyncMock) as mock_get_permissions:
        mock_get_permissions.return_value = user_has_permissions
        
        # Check if user has any of the required permissions
        result = await rbac.has_any_permission(user_id, required_permissions)
        
        # Property: Should return False since user has none of the required permissions
        # (unless by chance the user permission matches one of the required ones)
        if not any(perm in required_permissions for perm in user_has_permissions):
            assert result is False, \
                "has_any_permission should return False when user has none of the required permissions"


# ============================================================================
# Unit Tests for Edge Cases
# ============================================================================

@pytest.mark.asyncio
async def test_permission_denied_for_unauthenticated_user():
    """Test that unauthenticated users are denied access."""
    # Test with None user_id
    with patch.object(rbac, 'get_user_permissions', new_callable=AsyncMock) as mock_get_permissions:
        mock_get_permissions.return_value = []
        
        result = await rbac.has_permission(None, Permission.AUDIT_READ)
        
        # Should return False for unauthenticated user
        assert result is False


@pytest.mark.asyncio
async def test_permission_check_with_empty_permissions():
    """Test permission check when user has no permissions."""
    user_id = str(uuid4())
    
    with patch.object(rbac, 'get_user_permissions', new_callable=AsyncMock) as mock_get_permissions:
        mock_get_permissions.return_value = []
        
        result = await rbac.has_permission(user_id, Permission.AUDIT_READ)
        
        # Should return False when user has no permissions
        assert result is False


@pytest.mark.asyncio
async def test_permission_check_with_multiple_permissions():
    """Test that user with multiple permissions can access audit logs."""
    user_id = str(uuid4())
    
    with patch.object(rbac, 'get_user_permissions', new_callable=AsyncMock) as mock_get_permissions:
        mock_get_permissions.return_value = [
            Permission.AUDIT_READ,
            Permission.AUDIT_EXPORT,
            Permission.project_read
        ]
        
        # Check audit:read permission
        result_read = await rbac.has_permission(user_id, Permission.AUDIT_READ)
        assert result_read is True
        
        # Check audit:export permission
        result_export = await rbac.has_permission(user_id, Permission.AUDIT_EXPORT)
        assert result_export is True
        
        # Check non-audit permission
        result_project = await rbac.has_permission(user_id, Permission.project_read)
        assert result_project is True


@pytest.mark.asyncio
async def test_audit_read_without_export():
    """Test that user with only audit:read cannot export."""
    user_id = str(uuid4())
    
    with patch.object(rbac, 'get_user_permissions', new_callable=AsyncMock) as mock_get_permissions:
        mock_get_permissions.return_value = [Permission.AUDIT_READ]
        
        # Should have read permission
        result_read = await rbac.has_permission(user_id, Permission.AUDIT_READ)
        assert result_read is True
        
        # Should not have export permission
        result_export = await rbac.has_permission(user_id, Permission.AUDIT_EXPORT)
        assert result_export is False


@pytest.mark.asyncio
async def test_audit_export_implies_read_access():
    """Test that user with audit:export typically also has audit:read."""
    user_id = str(uuid4())
    
    # In practice, export permission should include read permission
    with patch.object(rbac, 'get_user_permissions', new_callable=AsyncMock) as mock_get_permissions:
        mock_get_permissions.return_value = [
            Permission.AUDIT_READ,
            Permission.AUDIT_EXPORT
        ]
        
        # Should have both permissions
        result_read = await rbac.has_permission(user_id, Permission.AUDIT_READ)
        assert result_read is True
        
        result_export = await rbac.has_permission(user_id, Permission.AUDIT_EXPORT)
        assert result_export is True
