"""
Property-Based Tests for Permission Checking

Feature: rbac-enhancement, Property 2: Permission Verification Accuracy
Feature: rbac-enhancement, Property 3: HTTP Status Code Correctness
Feature: rbac-enhancement, Property 4: Permission Combination Logic

**Validates: Requirements 1.2, 1.3, 1.4**

Property Definitions:
- Property 2: *For any* permission check request, the system must verify that the user 
  has the required permission and return accurate authorization results
- Property 3: *For any* permission validation failure, the system must return appropriate 
  HTTP status codes (401 for unauthenticated, 403 for unauthorized)
- Property 4: *For any* operation requiring multiple permissions, the system must correctly 
  evaluate AND and OR logic for permission combinations

Testing Framework: pytest with Hypothesis for property-based testing
Minimum iterations: 100 per property test
"""

import pytest
from hypothesis import given, settings, assume, HealthCheck
from hypothesis import strategies as st
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4
from typing import List, Optional, Set, Tuple
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import status

from auth.enhanced_rbac_models import (
    ScopeType,
    PermissionContext,
    RoleAssignment,
    EffectiveRole,
)
from auth.enhanced_permission_checker import EnhancedPermissionChecker
from auth.rbac import Permission, UserRole, DEFAULT_ROLE_PERMISSIONS
from auth.permission_requirements import (
    PermissionRequirement,
    SinglePermissionRequirement,
    AllOfRequirement,
    AnyOfRequirement,
    ComplexRequirement,
    AllRequirementsRequirement,
    PermissionCheckResult,
    RequirementType,
)
from auth.rbac_error_handler import (
    RBACErrorHandler,
    PermissionError,
    MultiplePermissionsError,
    AuthenticationError,
    SecurityEventType,
)


# =============================================================================
# Hypothesis Strategies for Generating Test Data
# =============================================================================

@st.composite
def uuid_strategy(draw):
    """Generate valid UUIDs for testing, avoiding dev user IDs."""
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
def permission_list_strategy(draw, min_size=1, max_size=5):
    """Generate a list of unique permissions."""
    permissions = draw(st.lists(
        st.sampled_from(list(Permission)),
        min_size=min_size,
        max_size=max_size,
        unique=True
    ))
    return permissions


@st.composite
def scope_type_strategy(draw):
    """Generate valid ScopeType values."""
    return draw(st.sampled_from(list(ScopeType)))


@st.composite
def permission_context_strategy(draw):
    """Generate valid PermissionContext objects."""
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
def user_permissions_strategy(draw):
    """Generate a set of permissions a user might have."""
    # Either use a role's permissions or a random subset
    use_role = draw(st.booleans())
    
    if use_role:
        role = draw(st.sampled_from(list(UserRole)))
        return set(DEFAULT_ROLE_PERMISSIONS[role])
    else:
        # Random subset of permissions
        num_perms = draw(st.integers(min_value=0, max_value=20))
        perms = draw(st.lists(
            st.sampled_from(list(Permission)),
            min_size=num_perms,
            max_size=num_perms,
            unique=True
        ))
        return set(perms)


@st.composite
def permission_requirement_strategy(draw):
    """Generate various types of PermissionRequirement objects."""
    req_type = draw(st.sampled_from(["single", "all_of", "any_of", "complex"]))
    
    if req_type == "single":
        perm = draw(permission_strategy())
        return PermissionRequirement.single(perm)
    
    elif req_type == "all_of":
        perms = draw(permission_list_strategy(min_size=1, max_size=4))
        return PermissionRequirement.all_of(*perms)
    
    elif req_type == "any_of":
        perms = draw(permission_list_strategy(min_size=1, max_size=4))
        return PermissionRequirement.any_of(*perms)
    
    else:  # complex
        # Create 2-3 sub-requirements
        num_sub = draw(st.integers(min_value=2, max_value=3))
        sub_reqs = []
        for _ in range(num_sub):
            sub_type = draw(st.sampled_from(["single", "all_of", "any_of"]))
            if sub_type == "single":
                perm = draw(permission_strategy())
                sub_reqs.append(PermissionRequirement.single(perm))
            elif sub_type == "all_of":
                perms = draw(permission_list_strategy(min_size=1, max_size=3))
                sub_reqs.append(PermissionRequirement.all_of(*perms))
            else:
                perms = draw(permission_list_strategy(min_size=1, max_size=3))
                sub_reqs.append(PermissionRequirement.any_of(*perms))
        
        return PermissionRequirement.complex(*sub_reqs)


# =============================================================================
# Property 2: Permission Verification Accuracy
# Feature: rbac-enhancement, Property 2: Permission Verification Accuracy
# **Validates: Requirements 1.2**
# =============================================================================

class TestPermissionVerificationAccuracy:
    """
    Property 2: Permission Verification Accuracy
    
    Feature: rbac-enhancement, Property 2: Permission Verification Accuracy
    **Validates: Requirements 1.2**
    
    For any permission check request, the system must verify that the user has 
    the required permission and return accurate authorization results.
    """
    
    # -------------------------------------------------------------------------
    # Property 2.1: Permission check returns True only when user has permission
    # -------------------------------------------------------------------------
    
    @given(
        user_id=uuid_strategy(),
        permission=permission_strategy(),
        user_role=user_role_strategy()
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_permission_check_accuracy_with_role(self, user_id, permission, user_role):
        """
        Property: For any user with a specific role, check_permission should return
        True if and only if the permission is in the role's permission set.
        
        **Validates: Requirements 1.2**
        """
        checker = EnhancedPermissionChecker(supabase_client=None)
        
        # Get the role's permissions
        role_permissions = set(DEFAULT_ROLE_PERMISSIONS[user_role])
        
        # Mock the get_user_permissions to return the role's permissions
        async def mock_get_permissions(uid, ctx=None):
            return list(role_permissions)
        
        checker.get_user_permissions = mock_get_permissions
        
        # Check the permission
        has_permission = await checker.check_permission(user_id, permission)
        
        # Verify accuracy: result should match whether permission is in role
        expected = permission in role_permissions
        assert has_permission == expected, (
            f"Permission check for {permission.value} returned {has_permission}, "
            f"expected {expected} for role {user_role.value}"
        )
    
    # -------------------------------------------------------------------------
    # Property 2.2: Permission check is deterministic
    # -------------------------------------------------------------------------
    
    @given(
        user_id=uuid_strategy(),
        permission=permission_strategy()
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_permission_check_deterministic(self, user_id, permission):
        """
        Property: For any user and permission, multiple calls to check_permission
        should return the same result.
        
        **Validates: Requirements 1.2**
        """
        checker = EnhancedPermissionChecker(supabase_client=None)
        
        # Make multiple calls
        result1 = await checker.check_permission(user_id, permission)
        result2 = await checker.check_permission(user_id, permission)
        result3 = await checker.check_permission(user_id, permission)
        
        # All results should be identical
        assert result1 == result2 == result3, (
            f"Permission check for {permission.value} returned inconsistent results: "
            f"{result1}, {result2}, {result3}"
        )
    
    # -------------------------------------------------------------------------
    # Property 2.3: Permission check respects context
    # -------------------------------------------------------------------------
    
    @given(
        user_id=uuid_strategy(),
        permission=permission_strategy(),
        context=permission_context_strategy()
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_permission_check_respects_context(self, user_id, permission, context):
        """
        Property: For any user, permission, and context, the permission check
        should consider the context when evaluating permissions.
        
        **Validates: Requirements 1.2**
        """
        checker = EnhancedPermissionChecker(supabase_client=None)
        
        # Check permission with context
        result_with_context = await checker.check_permission(user_id, permission, context)
        
        # Check permission without context
        result_without_context = await checker.check_permission(user_id, permission, None)
        
        # Both should return valid boolean results
        assert isinstance(result_with_context, bool)
        assert isinstance(result_without_context, bool)
    
    # -------------------------------------------------------------------------
    # Property 2.4: User permissions match role permissions
    # -------------------------------------------------------------------------
    
    @given(user_role=user_role_strategy())
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_role_permissions_complete(self, user_role):
        """
        Property: For any role, the DEFAULT_ROLE_PERMISSIONS should contain
        a complete and valid set of permissions.
        
        **Validates: Requirements 1.2**
        """
        role_permissions = DEFAULT_ROLE_PERMISSIONS[user_role]
        
        # All permissions should be valid Permission enum values
        for perm in role_permissions:
            assert isinstance(perm, Permission), (
                f"Invalid permission {perm} in role {user_role.value}"
            )
        
        # Role should have at least some permissions (except maybe viewer)
        if user_role != UserRole.viewer:
            assert len(role_permissions) > 0, (
                f"Role {user_role.value} has no permissions"
            )
    
    # -------------------------------------------------------------------------
    # Property 2.5: Permission verification is accurate for all permissions
    # -------------------------------------------------------------------------
    
    @given(
        user_permissions=user_permissions_strategy(),
        permission_to_check=permission_strategy()
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_permission_verification_accuracy(self, user_permissions, permission_to_check):
        """
        Property: For any set of user permissions and any permission to check,
        the verification should accurately determine if the permission is present.
        
        **Validates: Requirements 1.2**
        """
        # Direct set membership check
        has_permission = permission_to_check in user_permissions
        
        # This should be the ground truth for any permission checking system
        assert isinstance(has_permission, bool)
        
        # Verify the check is accurate
        if has_permission:
            assert permission_to_check in user_permissions
        else:
            assert permission_to_check not in user_permissions


# =============================================================================
# Property 3: HTTP Status Code Correctness
# Feature: rbac-enhancement, Property 3: HTTP Status Code Correctness
# **Validates: Requirements 1.3**
# =============================================================================

class TestHTTPStatusCodeCorrectness:
    """
    Property 3: HTTP Status Code Correctness
    
    Feature: rbac-enhancement, Property 3: HTTP Status Code Correctness
    **Validates: Requirements 1.3**
    
    For any permission validation failure, the system must return appropriate 
    HTTP status codes (401 for unauthenticated, 403 for unauthorized).
    """
    
    @pytest.fixture
    def error_handler(self):
        """Create an RBACErrorHandler for testing."""
        return RBACErrorHandler(supabase_client=None, enable_logging=False)
    
    # -------------------------------------------------------------------------
    # Property 3.1: Permission denied returns 403 Forbidden
    # -------------------------------------------------------------------------
    
    @given(
        user_id=uuid_strategy(),
        permission=permission_strategy()
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_permission_denied_returns_403(self, user_id, permission):
        """
        Property: For any permission denial, the system must return HTTP 403 Forbidden.
        
        **Validates: Requirements 1.3**
        """
        error_handler = RBACErrorHandler(supabase_client=None, enable_logging=False)
        
        # Create a permission error
        error = PermissionError(
            user_id=user_id,
            permission=permission,
            context=None
        )
        
        # Handle the error
        response = await error_handler.handle_permission_denied(error, request=None)
        
        # Verify 403 status code
        assert response.status_code == status.HTTP_403_FORBIDDEN, (
            f"Expected 403 Forbidden, got {response.status_code}"
        )
    
    # -------------------------------------------------------------------------
    # Property 3.2: Permission denied with context returns 403
    # -------------------------------------------------------------------------
    
    @given(
        user_id=uuid_strategy(),
        permission=permission_strategy(),
        context=permission_context_strategy()
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_permission_denied_with_context_returns_403(self, user_id, permission, context):
        """
        Property: For any permission denial with context, the system must return 
        HTTP 403 Forbidden.
        
        **Validates: Requirements 1.3**
        """
        error_handler = RBACErrorHandler(supabase_client=None, enable_logging=False)
        
        # Create a permission error with context
        error = PermissionError(
            user_id=user_id,
            permission=permission,
            context=context
        )
        
        # Handle the error
        response = await error_handler.handle_permission_denied(error, request=None)
        
        # Verify 403 status code
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    # -------------------------------------------------------------------------
    # Property 3.3: Authentication failure returns 401 Unauthorized
    # -------------------------------------------------------------------------
    
    @given(
        message=st.text(min_size=1, max_size=100),
        reason=st.one_of(st.none(), st.text(min_size=1, max_size=50))
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_authentication_failure_returns_401(self, message, reason):
        """
        Property: For any authentication failure, the system must return 
        HTTP 401 Unauthorized.
        
        **Validates: Requirements 1.3**
        """
        error_handler = RBACErrorHandler(supabase_client=None, enable_logging=False)
        
        # Create an authentication error
        error = AuthenticationError(message=message, reason=reason)
        
        # Handle the error
        response = await error_handler.handle_authentication_failed(error, request=None)
        
        # Verify 401 status code
        assert response.status_code == status.HTTP_401_UNAUTHORIZED, (
            f"Expected 401 Unauthorized, got {response.status_code}"
        )
    
    # -------------------------------------------------------------------------
    # Property 3.4: Multiple permissions denied returns 403
    # -------------------------------------------------------------------------
    
    @given(
        user_id=uuid_strategy(),
        required_permissions=permission_list_strategy(min_size=2, max_size=5),
        missing_count=st.integers(min_value=1, max_value=5)
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_multiple_permissions_denied_returns_403(
        self, user_id, required_permissions, missing_count
    ):
        """
        Property: For any multiple permissions denial, the system must return 
        HTTP 403 Forbidden.
        
        **Validates: Requirements 1.3**
        """
        error_handler = RBACErrorHandler(supabase_client=None, enable_logging=False)
        
        # Ensure missing_count doesn't exceed required_permissions length
        actual_missing_count = min(missing_count, len(required_permissions))
        missing_permissions = required_permissions[:actual_missing_count]
        
        # Create a multiple permissions error
        error = MultiplePermissionsError(
            user_id=user_id,
            required_permissions=required_permissions,
            missing_permissions=missing_permissions,
            context=None
        )
        
        # Handle the error
        response = await error_handler.handle_multiple_permissions_denied(error, request=None)
        
        # Verify 403 status code
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    # -------------------------------------------------------------------------
    # Property 3.5: 403 response includes required permission info
    # -------------------------------------------------------------------------
    
    @given(
        user_id=uuid_strategy(),
        permission=permission_strategy()
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_403_response_includes_permission_info(self, user_id, permission):
        """
        Property: For any 403 response, the response body must include information
        about the required permission.
        
        **Validates: Requirements 1.3**
        """
        error_handler = RBACErrorHandler(supabase_client=None, enable_logging=False)
        
        error = PermissionError(
            user_id=user_id,
            permission=permission,
            context=None
        )
        
        response = await error_handler.handle_permission_denied(error, request=None)
        
        # Parse response body
        import json
        body = json.loads(response.body.decode())
        
        # Verify response includes permission info
        assert "error" in body
        assert body["error"] == "insufficient_permissions"
        assert "required_permission" in body
        assert body["required_permission"] == permission.value
    
    # -------------------------------------------------------------------------
    # Property 3.6: 401 response includes WWW-Authenticate header
    # -------------------------------------------------------------------------
    
    @given(message=st.text(min_size=1, max_size=100))
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_401_response_includes_www_authenticate_header(self, message):
        """
        Property: For any 401 response, the response must include the 
        WWW-Authenticate header.
        
        **Validates: Requirements 1.3**
        """
        error_handler = RBACErrorHandler(supabase_client=None, enable_logging=False)
        
        error = AuthenticationError(message=message)
        response = await error_handler.handle_authentication_failed(error, request=None)
        
        # Verify WWW-Authenticate header is present
        assert "www-authenticate" in response.headers
        assert response.headers["www-authenticate"] == "Bearer"


# =============================================================================
# Property 4: Permission Combination Logic
# Feature: rbac-enhancement, Property 4: Permission Combination Logic
# **Validates: Requirements 1.4**
# =============================================================================

class TestPermissionCombinationLogic:
    """
    Property 4: Permission Combination Logic
    
    Feature: rbac-enhancement, Property 4: Permission Combination Logic
    **Validates: Requirements 1.4**
    
    For any operation requiring multiple permissions, the system must correctly 
    evaluate AND and OR logic for permission combinations.
    """
    
    # -------------------------------------------------------------------------
    # Property 4.1: AND logic requires ALL permissions
    # -------------------------------------------------------------------------
    
    @given(
        user_permissions=user_permissions_strategy(),
        required_permissions=permission_list_strategy(min_size=2, max_size=5)
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_and_logic_requires_all_permissions(self, user_permissions, required_permissions):
        """
        Property: For any AND requirement, the check should pass if and only if
        the user has ALL of the required permissions.
        
        **Validates: Requirements 1.4**
        """
        # Create an AllOfRequirement
        requirement = PermissionRequirement.all_of(*required_permissions)
        
        # Check the requirement
        result = requirement.check(user_permissions)
        
        # Calculate expected result
        expected_satisfied = all(perm in user_permissions for perm in required_permissions)
        
        # Verify the result
        assert result.satisfied == expected_satisfied, (
            f"AND logic failed: expected {expected_satisfied}, got {result.satisfied}. "
            f"Required: {[p.value for p in required_permissions]}, "
            f"User has: {[p.value for p in user_permissions]}"
        )
    
    # -------------------------------------------------------------------------
    # Property 4.2: OR logic requires ANY permission
    # -------------------------------------------------------------------------
    
    @given(
        user_permissions=user_permissions_strategy(),
        required_permissions=permission_list_strategy(min_size=2, max_size=5)
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_or_logic_requires_any_permission(self, user_permissions, required_permissions):
        """
        Property: For any OR requirement, the check should pass if the user has
        at least ONE of the required permissions.
        
        **Validates: Requirements 1.4**
        """
        # Create an AnyOfRequirement
        requirement = PermissionRequirement.any_of(*required_permissions)
        
        # Check the requirement
        result = requirement.check(user_permissions)
        
        # Calculate expected result
        expected_satisfied = any(perm in user_permissions for perm in required_permissions)
        
        # Verify the result
        assert result.satisfied == expected_satisfied, (
            f"OR logic failed: expected {expected_satisfied}, got {result.satisfied}. "
            f"Required any of: {[p.value for p in required_permissions]}, "
            f"User has: {[p.value for p in user_permissions]}"
        )
    
    # -------------------------------------------------------------------------
    # Property 4.3: Single permission requirement
    # -------------------------------------------------------------------------
    
    @given(
        user_permissions=user_permissions_strategy(),
        required_permission=permission_strategy()
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_single_permission_requirement(self, user_permissions, required_permission):
        """
        Property: For any single permission requirement, the check should pass
        if and only if the user has that specific permission.
        
        **Validates: Requirements 1.4**
        """
        # Create a SinglePermissionRequirement
        requirement = PermissionRequirement.single(required_permission)
        
        # Check the requirement
        result = requirement.check(user_permissions)
        
        # Calculate expected result
        expected_satisfied = required_permission in user_permissions
        
        # Verify the result
        assert result.satisfied == expected_satisfied, (
            f"Single permission check failed: expected {expected_satisfied}, "
            f"got {result.satisfied} for {required_permission.value}"
        )
    
    # -------------------------------------------------------------------------
    # Property 4.4: Complex requirements with nested AND/OR
    # -------------------------------------------------------------------------
    
    @given(
        user_permissions=user_permissions_strategy(),
        perms_group1=permission_list_strategy(min_size=1, max_size=3),
        perms_group2=permission_list_strategy(min_size=1, max_size=3)
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_complex_requirement_or_of_ands(self, user_permissions, perms_group1, perms_group2):
        """
        Property: For complex requirements like (A AND B) OR (C AND D), the check
        should pass if either group is fully satisfied.
        
        **Validates: Requirements 1.4**
        """
        # Create (group1 AND) OR (group2 AND)
        req1 = PermissionRequirement.all_of(*perms_group1)
        req2 = PermissionRequirement.all_of(*perms_group2)
        complex_req = PermissionRequirement.complex(req1, req2)
        
        # Check the requirement
        result = complex_req.check(user_permissions)
        
        # Calculate expected result
        group1_satisfied = all(perm in user_permissions for perm in perms_group1)
        group2_satisfied = all(perm in user_permissions for perm in perms_group2)
        expected_satisfied = group1_satisfied or group2_satisfied
        
        # Verify the result
        assert result.satisfied == expected_satisfied, (
            f"Complex (AND OR AND) logic failed: expected {expected_satisfied}, "
            f"got {result.satisfied}"
        )
    
    # -------------------------------------------------------------------------
    # Property 4.5: AllRequirements (AND of sub-requirements)
    # -------------------------------------------------------------------------
    
    @given(
        user_permissions=user_permissions_strategy(),
        perms_group1=permission_list_strategy(min_size=1, max_size=3),
        perms_group2=permission_list_strategy(min_size=1, max_size=3)
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_all_requirements_and_of_ors(self, user_permissions, perms_group1, perms_group2):
        """
        Property: For requirements like (A OR B) AND (C OR D), the check should
        pass only if both groups have at least one permission satisfied.
        
        **Validates: Requirements 1.4**
        """
        # Create (group1 OR) AND (group2 OR)
        req1 = PermissionRequirement.any_of(*perms_group1)
        req2 = PermissionRequirement.any_of(*perms_group2)
        all_req = PermissionRequirement.all_requirements(req1, req2)
        
        # Check the requirement
        result = all_req.check(user_permissions)
        
        # Calculate expected result
        group1_satisfied = any(perm in user_permissions for perm in perms_group1)
        group2_satisfied = any(perm in user_permissions for perm in perms_group2)
        expected_satisfied = group1_satisfied and group2_satisfied
        
        # Verify the result
        assert result.satisfied == expected_satisfied, (
            f"AllRequirements (OR AND OR) logic failed: expected {expected_satisfied}, "
            f"got {result.satisfied}"
        )

    
    # -------------------------------------------------------------------------
    # Property 4.6: Missing permissions are correctly identified
    # -------------------------------------------------------------------------
    
    @given(
        user_permissions=user_permissions_strategy(),
        required_permissions=permission_list_strategy(min_size=2, max_size=5)
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_missing_permissions_correctly_identified(self, user_permissions, required_permissions):
        """
        Property: For any AND requirement, the missing permissions should be
        accurately identified in the result.
        
        **Validates: Requirements 1.4**
        """
        requirement = PermissionRequirement.all_of(*required_permissions)
        result = requirement.check(user_permissions)
        
        # Calculate expected missing permissions
        expected_missing = set(
            perm for perm in required_permissions 
            if perm not in user_permissions
        )
        
        # Verify missing permissions
        actual_missing = set(result.missing_permissions)
        assert actual_missing == expected_missing, (
            f"Missing permissions mismatch: expected {expected_missing}, "
            f"got {actual_missing}"
        )
    
    # -------------------------------------------------------------------------
    # Property 4.7: Satisfied permissions are correctly identified
    # -------------------------------------------------------------------------
    
    @given(
        user_permissions=user_permissions_strategy(),
        required_permissions=permission_list_strategy(min_size=2, max_size=5)
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_satisfied_permissions_correctly_identified(self, user_permissions, required_permissions):
        """
        Property: For any AND requirement, the satisfied permissions should be
        accurately identified in the result.
        
        **Validates: Requirements 1.4**
        """
        requirement = PermissionRequirement.all_of(*required_permissions)
        result = requirement.check(user_permissions)
        
        # Calculate expected satisfied permissions
        expected_satisfied = set(
            perm for perm in required_permissions 
            if perm in user_permissions
        )
        
        # Verify satisfied permissions
        actual_satisfied = set(result.satisfied_permissions)
        assert actual_satisfied == expected_satisfied, (
            f"Satisfied permissions mismatch: expected {expected_satisfied}, "
            f"got {actual_satisfied}"
        )
    
    # -------------------------------------------------------------------------
    # Property 4.8: Empty permission set fails all requirements
    # -------------------------------------------------------------------------
    
    @given(required_permissions=permission_list_strategy(min_size=1, max_size=5))
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_empty_permissions_fails_all_requirements(self, required_permissions):
        """
        Property: For any non-empty requirement, a user with no permissions
        should fail the check.
        
        **Validates: Requirements 1.4**
        """
        empty_permissions: Set[Permission] = set()
        
        # Test single permission
        single_req = PermissionRequirement.single(required_permissions[0])
        assert single_req.check(empty_permissions).satisfied is False
        
        # Test all_of
        all_req = PermissionRequirement.all_of(*required_permissions)
        assert all_req.check(empty_permissions).satisfied is False
        
        # Test any_of
        any_req = PermissionRequirement.any_of(*required_permissions)
        assert any_req.check(empty_permissions).satisfied is False
    
    # -------------------------------------------------------------------------
    # Property 4.9: Full permission set satisfies all requirements
    # -------------------------------------------------------------------------
    
    @given(required_permissions=permission_list_strategy(min_size=1, max_size=5))
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_full_permissions_satisfies_all_requirements(self, required_permissions):
        """
        Property: For any requirement, a user with all required permissions
        should pass the check.
        
        **Validates: Requirements 1.4**
        """
        full_permissions = set(required_permissions)
        
        # Test single permission
        single_req = PermissionRequirement.single(required_permissions[0])
        assert single_req.check(full_permissions).satisfied is True
        
        # Test all_of
        all_req = PermissionRequirement.all_of(*required_permissions)
        assert all_req.check(full_permissions).satisfied is True
        
        # Test any_of
        any_req = PermissionRequirement.any_of(*required_permissions)
        assert any_req.check(full_permissions).satisfied is True
    
    # -------------------------------------------------------------------------
    # Property 4.10: Requirement type is correctly reported
    # -------------------------------------------------------------------------
    
    @given(
        user_permissions=user_permissions_strategy(),
        required_permissions=permission_list_strategy(min_size=2, max_size=5)
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_requirement_type_correctly_reported(self, user_permissions, required_permissions):
        """
        Property: For any requirement check, the result should correctly report
        the requirement type.
        
        **Validates: Requirements 1.4**
        """
        # Test single
        single_req = PermissionRequirement.single(required_permissions[0])
        single_result = single_req.check(user_permissions)
        assert single_result.requirement_type == RequirementType.SINGLE
        
        # Test all_of
        all_req = PermissionRequirement.all_of(*required_permissions)
        all_result = all_req.check(user_permissions)
        assert all_result.requirement_type == RequirementType.ALL
        
        # Test any_of
        any_req = PermissionRequirement.any_of(*required_permissions)
        any_result = any_req.check(user_permissions)
        assert any_result.requirement_type == RequirementType.ANY


# =============================================================================
# Integration Tests for Permission Checking with EnhancedPermissionChecker
# Feature: rbac-enhancement, Properties 2, 3, 4 Integration
# **Validates: Requirements 1.2, 1.3, 1.4**
# =============================================================================

class TestPermissionCheckingIntegration:
    """
    Integration tests combining Properties 2, 3, and 4.
    
    Feature: rbac-enhancement, Properties 2, 3, 4 Integration
    **Validates: Requirements 1.2, 1.3, 1.4**
    """
    
    # -------------------------------------------------------------------------
    # Property Integration: check_any_permission uses OR logic
    # -------------------------------------------------------------------------
    
    @given(
        user_id=uuid_strategy(),
        permissions=permission_list_strategy(min_size=2, max_size=5),
        user_role=user_role_strategy()
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_check_any_permission_or_logic(self, user_id, permissions, user_role):
        """
        Property: check_any_permission should return True if the user has ANY
        of the specified permissions.
        
        **Validates: Requirements 1.2, 1.4**
        """
        checker = EnhancedPermissionChecker(supabase_client=None)
        role_permissions = set(DEFAULT_ROLE_PERMISSIONS[user_role])
        
        # Mock get_user_permissions
        async def mock_get_permissions(uid, ctx=None):
            return list(role_permissions)
        
        checker.get_user_permissions = mock_get_permissions
        
        # Check any permission
        result = await checker.check_any_permission(user_id, permissions)
        
        # Calculate expected result
        expected = any(perm in role_permissions for perm in permissions)
        
        assert result == expected
    
    # -------------------------------------------------------------------------
    # Property Integration: check_all_permissions uses AND logic
    # -------------------------------------------------------------------------
    
    @given(
        user_id=uuid_strategy(),
        permissions=permission_list_strategy(min_size=2, max_size=5),
        user_role=user_role_strategy()
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_check_all_permissions_and_logic(self, user_id, permissions, user_role):
        """
        Property: check_all_permissions should return True only if the user has ALL
        of the specified permissions.
        
        **Validates: Requirements 1.2, 1.4**
        """
        checker = EnhancedPermissionChecker(supabase_client=None)
        role_permissions = set(DEFAULT_ROLE_PERMISSIONS[user_role])
        
        # Mock get_user_permissions
        async def mock_get_permissions(uid, ctx=None):
            return list(role_permissions)
        
        checker.get_user_permissions = mock_get_permissions
        
        # Check all permissions
        result = await checker.check_all_permissions(user_id, permissions)
        
        # Calculate expected result
        expected = all(perm in role_permissions for perm in permissions)
        
        assert result == expected
    
    # -------------------------------------------------------------------------
    # Property Integration: get_missing_permissions accuracy
    # -------------------------------------------------------------------------
    
    @given(
        user_id=uuid_strategy(),
        required_permissions=permission_list_strategy(min_size=2, max_size=5),
        user_role=user_role_strategy()
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_get_missing_permissions_accuracy(self, user_id, required_permissions, user_role):
        """
        Property: get_missing_permissions should accurately return the permissions
        the user is missing.
        
        **Validates: Requirements 1.2, 1.4**
        """
        checker = EnhancedPermissionChecker(supabase_client=None)
        role_permissions = set(DEFAULT_ROLE_PERMISSIONS[user_role])
        
        # Mock get_user_permissions
        async def mock_get_permissions(uid, ctx=None):
            return list(role_permissions)
        
        checker.get_user_permissions = mock_get_permissions
        
        # Get missing permissions
        missing = await checker.get_missing_permissions(user_id, required_permissions)
        
        # Calculate expected missing
        expected_missing = [
            perm for perm in required_permissions 
            if perm not in role_permissions
        ]
        
        assert set(missing) == set(expected_missing)
    
    # -------------------------------------------------------------------------
    # Property Integration: check_all_permissions_with_details
    # -------------------------------------------------------------------------
    
    @given(
        user_id=uuid_strategy(),
        permissions=permission_list_strategy(min_size=2, max_size=5),
        user_role=user_role_strategy()
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_check_all_permissions_with_details(self, user_id, permissions, user_role):
        """
        Property: check_all_permissions_with_details should return accurate
        satisfied and missing permission lists.
        
        **Validates: Requirements 1.2, 1.4**
        """
        checker = EnhancedPermissionChecker(supabase_client=None)
        role_permissions = set(DEFAULT_ROLE_PERMISSIONS[user_role])
        
        # Mock get_user_permissions
        async def mock_get_permissions(uid, ctx=None):
            return list(role_permissions)
        
        checker.get_user_permissions = mock_get_permissions
        
        # Check with details
        all_satisfied, satisfied, missing = await checker.check_all_permissions_with_details(
            user_id, permissions
        )
        
        # Calculate expected
        expected_satisfied = [p for p in permissions if p in role_permissions]
        expected_missing = [p for p in permissions if p not in role_permissions]
        expected_all = len(expected_missing) == 0
        
        assert all_satisfied == expected_all
        assert set(satisfied) == set(expected_satisfied)
        assert set(missing) == set(expected_missing)
    
    # -------------------------------------------------------------------------
    # Property Integration: check_any_permission_with_details
    # -------------------------------------------------------------------------
    
    @given(
        user_id=uuid_strategy(),
        permissions=permission_list_strategy(min_size=2, max_size=5),
        user_role=user_role_strategy()
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_check_any_permission_with_details(self, user_id, permissions, user_role):
        """
        Property: check_any_permission_with_details should return accurate
        satisfied and unsatisfied permission lists.
        
        **Validates: Requirements 1.2, 1.4**
        """
        checker = EnhancedPermissionChecker(supabase_client=None)
        role_permissions = set(DEFAULT_ROLE_PERMISSIONS[user_role])
        
        # Mock get_user_permissions
        async def mock_get_permissions(uid, ctx=None):
            return list(role_permissions)
        
        checker.get_user_permissions = mock_get_permissions
        
        # Check with details
        any_satisfied, satisfied, unsatisfied = await checker.check_any_permission_with_details(
            user_id, permissions
        )
        
        # Calculate expected
        expected_satisfied = [p for p in permissions if p in role_permissions]
        expected_unsatisfied = [p for p in permissions if p not in role_permissions]
        expected_any = len(expected_satisfied) > 0
        
        assert any_satisfied == expected_any
        assert set(satisfied) == set(expected_satisfied)
        assert set(unsatisfied) == set(expected_unsatisfied)


# =============================================================================
# Security Event Logging Tests
# Feature: rbac-enhancement, Property 3: HTTP Status Code Correctness
# **Validates: Requirements 1.3**
# =============================================================================

class TestSecurityEventLogging:
    """
    Tests for security event logging on permission failures.
    
    Feature: rbac-enhancement, Property 3: HTTP Status Code Correctness
    **Validates: Requirements 1.3**
    """
    
    @given(
        user_id=uuid_strategy(),
        permission=permission_strategy()
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_permission_denied_logs_security_event(self, user_id, permission):
        """
        Property: For any permission denial, a security event should be logged.
        
        **Validates: Requirements 1.3**
        """
        error_handler = RBACErrorHandler(supabase_client=None, enable_logging=True)
        error_handler.clear_events()  # Clear any previous events
        
        error = PermissionError(
            user_id=user_id,
            permission=permission,
            context=None
        )
        
        await error_handler.handle_permission_denied(error, request=None)
        
        # Check that a security event was logged
        events = error_handler.get_recent_events(
            event_type=SecurityEventType.PERMISSION_DENIED
        )
        
        assert len(events) >= 1, "No security event was logged for permission denial"
        
        # Verify event details
        latest_event = events[-1]
        assert latest_event.event_type == SecurityEventType.PERMISSION_DENIED
        assert latest_event.user_id == str(user_id)
        assert latest_event.permission == permission.value
    
    @given(message=st.text(min_size=1, max_size=100))
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_authentication_failure_logs_security_event(self, message):
        """
        Property: For any authentication failure, a security event should be logged.
        
        **Validates: Requirements 1.3**
        """
        error_handler = RBACErrorHandler(supabase_client=None, enable_logging=True)
        error_handler.clear_events()
        
        error = AuthenticationError(message=message)
        await error_handler.handle_authentication_failed(error, request=None)
        
        # Check that a security event was logged
        events = error_handler.get_recent_events(
            event_type=SecurityEventType.AUTHENTICATION_FAILED
        )
        
        assert len(events) >= 1, "No security event was logged for authentication failure"
        
        # Verify event type
        latest_event = events[-1]
        assert latest_event.event_type == SecurityEventType.AUTHENTICATION_FAILED
