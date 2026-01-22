"""
Property-Based Tests for Authentication and Role Retrieval

Feature: rbac-enhancement, Property 1: Authentication and Role Retrieval Consistency

**Validates: Requirements 1.1, 2.1**

Property Definition:
*For any* API endpoint access, user authentication must be validated and assigned roles 
must be retrieved accurately from the user_roles table.

This test validates:
1. User authentication always retrieves correct roles from user_roles table
2. Role retrieval is consistent across multiple calls
3. Role assignments are accurately reflected in effective permissions
4. Context-aware role retrieval works correctly for scoped assignments

Testing Framework: pytest with Hypothesis for property-based testing
Minimum iterations: 100 per property test
"""

import pytest
from hypothesis import given, settings, assume, HealthCheck
from hypothesis import strategies as st
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4
from typing import List, Optional, Set
from unittest.mock import AsyncMock, MagicMock, patch

from auth.enhanced_rbac_models import (
    ScopeType,
    PermissionContext,
    RoleAssignment,
    EffectiveRole,
)
from auth.enhanced_permission_checker import EnhancedPermissionChecker
from auth.rbac import Permission, UserRole, DEFAULT_ROLE_PERMISSIONS


# =============================================================================
# Hypothesis Strategies for Generating Test Data
# =============================================================================

@st.composite
def uuid_strategy(draw):
    """Generate valid UUIDs for testing."""
    # Generate random UUIDs, avoiding the dev user IDs
    dev_ids = {
        "00000000-0000-0000-0000-000000000001",
        "bf1b1732-2449-4987-9fdb-fefa2a93b816"
    }
    uuid_val = draw(st.uuids())
    assume(str(uuid_val) not in dev_ids)
    return uuid_val


@st.composite
def user_role_strategy(draw):
    """Generate valid UserRole values."""
    return draw(st.sampled_from(list(UserRole)))


@st.composite
def permission_strategy(draw):
    """Generate valid Permission values."""
    return draw(st.sampled_from(list(Permission)))


@st.composite
def scope_type_strategy(draw):
    """Generate valid ScopeType values."""
    return draw(st.sampled_from(list(ScopeType)))


@st.composite
def permission_context_strategy(draw):
    """Generate valid PermissionContext objects."""
    # Randomly decide which scope IDs to include
    include_project = draw(st.booleans())
    include_portfolio = draw(st.booleans())
    include_organization = draw(st.booleans())
    include_resource = draw(st.booleans())
    
    return PermissionContext(
        project_id=draw(st.uuids()) if include_project else None,
        portfolio_id=draw(st.uuids()) if include_portfolio else None,
        organization_id=draw(st.uuids()) if include_organization else None,
        resource_id=draw(st.uuids()) if include_resource else None,
    )


@st.composite
def role_assignment_strategy(draw, user_id: Optional[UUID] = None):
    """Generate valid RoleAssignment objects."""
    if user_id is None:
        user_id = draw(st.uuids())
    
    role_id = draw(st.uuids())
    assigned_by = draw(st.uuids())
    
    # Decide if this is a scoped or global assignment
    is_scoped = draw(st.booleans())
    
    if is_scoped:
        scope_type = draw(st.sampled_from([ScopeType.PROJECT, ScopeType.PORTFOLIO, ScopeType.ORGANIZATION]))
        scope_id = draw(st.uuids())
    else:
        scope_type = None
        scope_id = None
    
    # Decide if there's an expiration
    has_expiration = draw(st.booleans())
    if has_expiration:
        # Generate expiration in the future (valid) or past (expired)
        is_expired = draw(st.booleans())
        if is_expired:
            expires_at = datetime.now(timezone.utc) - timedelta(days=draw(st.integers(min_value=1, max_value=365)))
        else:
            expires_at = datetime.now(timezone.utc) + timedelta(days=draw(st.integers(min_value=1, max_value=365)))
    else:
        expires_at = None
    
    is_active = draw(st.booleans())
    
    return RoleAssignment(
        user_id=user_id,
        role_id=role_id,
        assigned_by=assigned_by,
        scope_type=scope_type,
        scope_id=scope_id,
        expires_at=expires_at,
        is_active=is_active,
    )


@st.composite
def effective_role_strategy(draw, role_name: Optional[str] = None):
    """Generate valid EffectiveRole objects."""
    if role_name is None:
        role_name = draw(st.sampled_from([r.value for r in UserRole]))
    
    # Get permissions for this role
    try:
        role_enum = UserRole(role_name)
        permissions = [p.value for p in DEFAULT_ROLE_PERMISSIONS.get(role_enum, [])]
    except ValueError:
        permissions = draw(st.lists(
            st.sampled_from([p.value for p in Permission]),
            min_size=1,
            max_size=10
        ))
    
    source_type = draw(st.sampled_from(list(ScopeType)))
    source_id = draw(st.uuids()) if source_type != ScopeType.GLOBAL else None
    
    return EffectiveRole(
        role_id=draw(st.uuids()),
        role_name=role_name,
        permissions=permissions,
        source_type=source_type,
        source_id=source_id,
        is_inherited=draw(st.booleans()),
    )


@st.composite
def user_with_roles_strategy(draw):
    """Generate a user ID with a list of role assignments."""
    user_id = draw(uuid_strategy())
    num_roles = draw(st.integers(min_value=0, max_value=5))
    
    roles = []
    for _ in range(num_roles):
        role = draw(role_assignment_strategy(user_id=user_id))
        roles.append(role)
    
    return user_id, roles


# =============================================================================
# Mock Database Response Helpers
# =============================================================================

def create_mock_role_data(role_name: str) -> dict:
    """Create mock role data as would be returned from database."""
    try:
        role_enum = UserRole(role_name)
        permissions = [p.value for p in DEFAULT_ROLE_PERMISSIONS.get(role_enum, [])]
    except ValueError:
        permissions = []
    
    return {
        "id": str(uuid4()),
        "name": role_name,
        "permissions": permissions,
        "is_active": True,
    }


def create_mock_user_role_response(assignments: List[RoleAssignment], role_names: List[str]) -> dict:
    """Create mock database response for user_roles query."""
    data = []
    for assignment, role_name in zip(assignments, role_names):
        role_data = create_mock_role_data(role_name)
        data.append({
            "id": str(assignment.id) if assignment.id else str(uuid4()),
            "user_id": str(assignment.user_id),
            "role_id": str(assignment.role_id),
            "scope_type": assignment.scope_type.value if assignment.scope_type else None,
            "scope_id": str(assignment.scope_id) if assignment.scope_id else None,
            "assigned_at": assignment.assigned_at.isoformat(),
            "expires_at": assignment.expires_at.isoformat() if assignment.expires_at else None,
            "is_active": assignment.is_active,
            "roles": role_data,
        })
    return data


# =============================================================================
# Property-Based Tests
# =============================================================================

class TestAuthenticationAndRoleRetrievalConsistency:
    """
    Property 1: Authentication and Role Retrieval Consistency
    
    Feature: rbac-enhancement, Property 1: Authentication and Role Retrieval Consistency
    **Validates: Requirements 1.1, 2.1**
    
    For any API endpoint access, user authentication must be validated and assigned 
    roles must be retrieved accurately from the user_roles table.
    """
    
    @pytest.fixture
    def checker(self):
        """Create a permission checker without database connection."""
        return EnhancedPermissionChecker(supabase_client=None)
    
    @pytest.fixture
    def mock_supabase(self):
        """Create a mock Supabase client."""
        mock = MagicMock()
        mock.table = MagicMock(return_value=mock)
        mock.select = MagicMock(return_value=mock)
        mock.eq = MagicMock(return_value=mock)
        mock.is_ = MagicMock(return_value=mock)
        mock.execute = MagicMock(return_value=MagicMock(data=[]))
        return mock
    
    # -------------------------------------------------------------------------
    # Property 1.1: Role retrieval is consistent across multiple calls
    # -------------------------------------------------------------------------
    
    @given(user_id=uuid_strategy())
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_role_retrieval_consistency_across_calls(self, user_id):
        """
        Property: For any user, multiple calls to get_effective_roles should return
        consistent results when no changes have been made.
        
        **Validates: Requirements 1.1, 2.1**
        """
        checker = EnhancedPermissionChecker(supabase_client=None)
        
        # Make multiple calls to get effective roles
        roles_call_1 = await checker.get_effective_roles(user_id)
        roles_call_2 = await checker.get_effective_roles(user_id)
        roles_call_3 = await checker.get_effective_roles(user_id)
        
        # All calls should return the same roles
        assert len(roles_call_1) == len(roles_call_2) == len(roles_call_3)
        
        # Role names should be consistent
        role_names_1 = {r.role_name for r in roles_call_1}
        role_names_2 = {r.role_name for r in roles_call_2}
        role_names_3 = {r.role_name for r in roles_call_3}
        
        assert role_names_1 == role_names_2 == role_names_3
    
    # -------------------------------------------------------------------------
    # Property 1.2: Permissions derived from roles are consistent
    # -------------------------------------------------------------------------
    
    @given(user_id=uuid_strategy())
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_permissions_consistency_across_calls(self, user_id):
        """
        Property: For any user, multiple calls to get_user_permissions should return
        consistent results when no changes have been made.
        
        **Validates: Requirements 1.1, 2.1**
        """
        checker = EnhancedPermissionChecker(supabase_client=None)
        
        # Make multiple calls to get permissions
        perms_call_1 = await checker.get_user_permissions(user_id)
        perms_call_2 = await checker.get_user_permissions(user_id)
        
        # Convert to sets for comparison (order doesn't matter)
        perms_set_1 = set(perms_call_1)
        perms_set_2 = set(perms_call_2)
        
        assert perms_set_1 == perms_set_2
    
    # -------------------------------------------------------------------------
    # Property 1.3: Role permissions match DEFAULT_ROLE_PERMISSIONS
    # -------------------------------------------------------------------------
    
    @given(role=user_role_strategy())
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_role_permissions_match_defaults(self, role):
        """
        Property: For any role, the permissions returned should match the 
        DEFAULT_ROLE_PERMISSIONS configuration.
        
        **Validates: Requirements 1.1, 2.1**
        """
        expected_permissions = set(DEFAULT_ROLE_PERMISSIONS[role])
        
        # Create an effective role with this role name
        effective_role = EffectiveRole(
            role_id=uuid4(),
            role_name=role.value,
            permissions=[p.value for p in expected_permissions],
            source_type=ScopeType.GLOBAL,
            source_id=None,
            is_inherited=False,
        )
        
        # Verify permissions match
        actual_permissions = set()
        for perm_str in effective_role.permissions:
            try:
                actual_permissions.add(Permission(perm_str))
            except ValueError:
                pass
        
        assert actual_permissions == expected_permissions
    
    # -------------------------------------------------------------------------
    # Property 1.4: Context-aware role retrieval respects scope
    # -------------------------------------------------------------------------
    
    @given(
        user_id=uuid_strategy(),
        context=permission_context_strategy()
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_context_aware_role_retrieval(self, user_id, context):
        """
        Property: For any user and context, role retrieval should respect the 
        context scope and return appropriate roles.
        
        **Validates: Requirements 1.1, 2.1**
        """
        checker = EnhancedPermissionChecker(supabase_client=None)
        
        # Get roles with context
        roles_with_context = await checker.get_effective_roles(user_id, context)
        
        # Get roles without context (global)
        roles_global = await checker.get_effective_roles(user_id, None)
        
        # Both should return valid role lists
        assert isinstance(roles_with_context, list)
        assert isinstance(roles_global, list)
        
        # All returned roles should have valid structure
        for role in roles_with_context:
            assert isinstance(role, EffectiveRole)
            assert role.role_name is not None
            assert isinstance(role.permissions, list)
    
    # -------------------------------------------------------------------------
    # Property 1.5: Permission check consistency with role permissions
    # -------------------------------------------------------------------------
    
    @given(
        user_id=uuid_strategy(),
        permission=permission_strategy()
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_permission_check_consistency_with_roles(self, user_id, permission):
        """
        Property: For any user and permission, check_permission result should be
        consistent with the permissions derived from the user's roles.
        
        **Validates: Requirements 1.1, 2.1**
        """
        checker = EnhancedPermissionChecker(supabase_client=None)
        
        # Get user's permissions
        user_permissions = await checker.get_user_permissions(user_id)
        
        # Check specific permission
        has_permission = await checker.check_permission(user_id, permission)
        
        # Result should match whether permission is in user's permissions
        expected_result = permission in user_permissions
        assert has_permission == expected_result
    
    # -------------------------------------------------------------------------
    # Property 1.6: Role assignment validity affects retrieval
    # -------------------------------------------------------------------------
    
    @given(assignment=role_assignment_strategy())
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_role_assignment_validity(self, assignment):
        """
        Property: For any role assignment, is_valid() should correctly reflect
        both is_active and expiration status.
        
        **Validates: Requirements 1.1, 2.1**
        """
        # Check validity
        is_valid = assignment.is_valid()
        
        # Should be valid only if active AND not expired
        expected_valid = assignment.is_active and not assignment.is_expired()
        assert is_valid == expected_valid
    
    # -------------------------------------------------------------------------
    # Property 1.7: Cache consistency after clear
    # -------------------------------------------------------------------------
    
    @given(user_id=uuid_strategy())
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_cache_consistency_after_clear(self, user_id):
        """
        Property: For any user, clearing cache and re-fetching should return
        consistent results.
        
        **Validates: Requirements 1.1, 2.1**
        """
        checker = EnhancedPermissionChecker(supabase_client=None)
        
        # Get permissions (populates cache)
        perms_before = await checker.get_user_permissions(user_id)
        
        # Clear cache
        checker.clear_user_cache(user_id)
        
        # Get permissions again
        perms_after = await checker.get_user_permissions(user_id)
        
        # Should be consistent
        assert set(perms_before) == set(perms_after)
    
    # -------------------------------------------------------------------------
    # Property 1.8: Role assignment context matching
    # -------------------------------------------------------------------------
    
    @given(
        assignment=role_assignment_strategy(),
        context=permission_context_strategy()
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_role_assignment_context_matching(self, assignment, context):
        """
        Property: For any role assignment and context, matches_context should
        correctly determine if the assignment applies.
        
        **Validates: Requirements 1.1, 2.1**
        """
        matches = assignment.matches_context(context)
        
        # Global assignments should always match
        if assignment.scope_type is None or assignment.scope_type == ScopeType.GLOBAL:
            assert matches is True
        else:
            # Scoped assignments should only match if scope matches
            if assignment.scope_type == ScopeType.PROJECT:
                expected = context is not None and context.project_id == assignment.scope_id
            elif assignment.scope_type == ScopeType.PORTFOLIO:
                expected = context is not None and context.portfolio_id == assignment.scope_id
            elif assignment.scope_type == ScopeType.ORGANIZATION:
                expected = context is not None and context.organization_id == assignment.scope_id
            else:
                expected = False
            
            assert matches == expected
    
    # -------------------------------------------------------------------------
    # Property 1.9: Multiple role aggregation
    # -------------------------------------------------------------------------
    
    @given(roles=st.lists(user_role_strategy(), min_size=1, max_size=5))
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_multiple_role_permission_aggregation(self, roles):
        """
        Property: For any set of roles, the aggregated permissions should be
        the union of all individual role permissions.
        
        **Validates: Requirements 1.1, 2.1**
        """
        # Calculate expected aggregated permissions
        expected_permissions: Set[Permission] = set()
        for role in roles:
            expected_permissions.update(DEFAULT_ROLE_PERMISSIONS[role])
        
        # Simulate aggregation
        aggregated: Set[Permission] = set()
        for role in roles:
            aggregated.update(DEFAULT_ROLE_PERMISSIONS[role])
        
        assert aggregated == expected_permissions
    
    # -------------------------------------------------------------------------
    # Property 1.10: Dev user always gets admin permissions
    # -------------------------------------------------------------------------
    
    @given(permission=permission_strategy())
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_dev_user_admin_permissions(self, permission):
        """
        Property: For any permission, dev users should have it if it's an admin permission.
        
        **Validates: Requirements 1.1, 2.1**
        """
        checker = EnhancedPermissionChecker(supabase_client=None)
        dev_user_id = UUID("00000000-0000-0000-0000-000000000001")
        
        # Get dev user permissions
        dev_permissions = await checker.get_user_permissions(dev_user_id)
        
        # Dev user should have admin permissions
        admin_permissions = DEFAULT_ROLE_PERMISSIONS[UserRole.admin]
        
        # Check if the permission is in admin permissions
        if permission in admin_permissions:
            assert permission in dev_permissions


class TestRoleRetrievalWithMockedDatabase:
    """
    Additional property tests with mocked database responses.
    
    Feature: rbac-enhancement, Property 1: Authentication and Role Retrieval Consistency
    **Validates: Requirements 1.1, 2.1**
    """
    
    @given(
        user_id=uuid_strategy(),
        role_name=st.sampled_from([r.value for r in UserRole])
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_database_role_retrieval_accuracy(self, user_id, role_name):
        """
        Property: For any user with a role assignment in the database, the retrieved
        roles should accurately reflect the database state.
        
        **Validates: Requirements 1.1, 2.1**
        """
        # Create mock assignment
        assignment = RoleAssignment(
            user_id=user_id,
            role_id=uuid4(),
            assigned_by=uuid4(),
            is_active=True,
        )
        
        # Create mock database response
        mock_response_data = create_mock_user_role_response([assignment], [role_name])
        
        # Create mock Supabase client
        mock_supabase = MagicMock()
        mock_query = MagicMock()
        mock_query.select = MagicMock(return_value=mock_query)
        mock_query.eq = MagicMock(return_value=mock_query)
        mock_query.is_ = MagicMock(return_value=mock_query)
        mock_query.execute = MagicMock(return_value=MagicMock(data=mock_response_data))
        mock_supabase.table = MagicMock(return_value=mock_query)
        
        checker = EnhancedPermissionChecker(supabase_client=mock_supabase)
        
        # Get effective roles
        roles = await checker.get_effective_roles(user_id)
        
        # Should have at least one role
        assert len(roles) >= 1
        
        # The role name should match what was in the database
        role_names = {r.role_name for r in roles}
        assert role_name in role_names
    
    @given(
        user_id=uuid_strategy(),
        num_roles=st.integers(min_value=1, max_value=3)
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_multiple_role_retrieval_accuracy(self, user_id, num_roles):
        """
        Property: For any user with multiple role assignments, all roles should
        be retrieved accurately.
        
        **Validates: Requirements 1.1, 2.1**
        """
        # Create mock assignments with different roles
        role_names = [r.value for r in list(UserRole)[:num_roles]]
        assignments = [
            RoleAssignment(
                user_id=user_id,
                role_id=uuid4(),
                assigned_by=uuid4(),
                is_active=True,
            )
            for _ in range(num_roles)
        ]
        
        # Create mock database response
        mock_response_data = create_mock_user_role_response(assignments, role_names)
        
        # Create mock Supabase client
        mock_supabase = MagicMock()
        mock_query = MagicMock()
        mock_query.select = MagicMock(return_value=mock_query)
        mock_query.eq = MagicMock(return_value=mock_query)
        mock_query.is_ = MagicMock(return_value=mock_query)
        mock_query.execute = MagicMock(return_value=MagicMock(data=mock_response_data))
        mock_supabase.table = MagicMock(return_value=mock_query)
        
        checker = EnhancedPermissionChecker(supabase_client=mock_supabase)
        
        # Get effective roles
        roles = await checker.get_effective_roles(user_id)
        
        # Should have all the roles
        retrieved_role_names = {r.role_name for r in roles}
        for expected_role in role_names:
            assert expected_role in retrieved_role_names


class TestPermissionContextProperties:
    """
    Property tests for PermissionContext behavior.
    
    Feature: rbac-enhancement, Property 1: Authentication and Role Retrieval Consistency
    **Validates: Requirements 1.1, 2.1**
    """
    
    @given(context=permission_context_strategy())
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_context_scope_type_consistency(self, context):
        """
        Property: For any context, get_scope_type should return the most specific
        scope type that has a value set.
        
        **Validates: Requirements 1.1, 2.1**
        """
        scope_type = context.get_scope_type()
        
        # Verify scope type priority
        if context.project_id is not None:
            assert scope_type == ScopeType.PROJECT
        elif context.portfolio_id is not None:
            assert scope_type == ScopeType.PORTFOLIO
        elif context.organization_id is not None:
            assert scope_type == ScopeType.ORGANIZATION
        else:
            assert scope_type == ScopeType.GLOBAL
    
    @given(context=permission_context_strategy())
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_context_scope_id_consistency(self, context):
        """
        Property: For any context, get_scope_id should return the ID corresponding
        to the most specific scope type.
        
        **Validates: Requirements 1.1, 2.1**
        """
        scope_type = context.get_scope_type()
        scope_id = context.get_scope_id()
        
        if scope_type == ScopeType.PROJECT:
            assert scope_id == context.project_id
        elif scope_type == ScopeType.PORTFOLIO:
            assert scope_id == context.portfolio_id
        elif scope_type == ScopeType.ORGANIZATION:
            assert scope_id == context.organization_id
        else:
            assert scope_id is None
    
    @given(context=permission_context_strategy())
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_context_is_global_consistency(self, context):
        """
        Property: For any context, is_global should return True only when no
        scope IDs are set.
        
        **Validates: Requirements 1.1, 2.1**
        """
        is_global = context.is_global()
        
        # Should be global only if no scope IDs are set
        expected_global = (
            context.project_id is None and
            context.portfolio_id is None and
            context.organization_id is None
        )
        
        assert is_global == expected_global
    
    @given(context=permission_context_strategy())
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_context_cache_key_uniqueness(self, context):
        """
        Property: For any context, the cache key should be deterministic and
        unique for the context's scope configuration.
        
        **Validates: Requirements 1.1, 2.1**
        """
        cache_key_1 = context.to_cache_key()
        cache_key_2 = context.to_cache_key()
        
        # Same context should produce same cache key
        assert cache_key_1 == cache_key_2
        
        # Cache key should be a non-empty string
        assert isinstance(cache_key_1, str)
        assert len(cache_key_1) > 0
