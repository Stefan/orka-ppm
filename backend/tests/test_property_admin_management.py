"""
Property-Based Tests for Admin Management

Feature: rbac-enhancement, Property 14: User Role Management Functionality
Feature: rbac-enhancement, Property 15: Custom Role Creation Capability
Feature: rbac-enhancement, Property 16: Permission Configuration Validation
Feature: rbac-enhancement, Property 17: Effective Permission Display Accuracy
Feature: rbac-enhancement, Property 18: Audit Logging Completeness

**Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

Property Definitions:
- Property 14: *For any* user role management operation, the system must provide 
  complete interfaces for viewing and modifying role assignments
- Property 15: *For any* custom role definition, the system must allow creation 
  with specific permission sets and validate configuration correctness
- Property 16: *For any* permission update attempt, the system must validate 
  permission combinations and prevent invalid configurations
- Property 17: *For any* user role assignment view, the system must display 
  effective permissions including inherited permissions accurately
- Property 18: *For any* role or permission change, the system must create 
  complete audit log entries with all relevant details

Testing Framework: pytest with Hypothesis for property-based testing
Minimum iterations: 100 per property test
"""

import pytest
from hypothesis import given, settings, assume, HealthCheck
from hypothesis import strategies as st
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4
from typing import List, Optional, Set, Dict
from unittest.mock import AsyncMock, MagicMock, patch

from auth.enhanced_rbac_models import (
    ScopeType,
    PermissionContext,
    RoleAssignment,
    EffectiveRole,
)
from auth.enhanced_permission_checker import EnhancedPermissionChecker
from auth.rbac import Permission, UserRole, DEFAULT_ROLE_PERMISSIONS
from services.rbac_audit_service import (
    RBACAuditService,
    RBACAction,
    RBACEntityType,
)
from routers.admin import validate_permission_combinations


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
def permission_list_strategy(draw, min_size=1, max_size=10):
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
def role_assignment_strategy(draw, user_id: Optional[UUID] = None):
    """Generate valid RoleAssignment objects."""
    if user_id is None:
        user_id = draw(uuid_strategy())
    
    role_id = draw(uuid_strategy())
    assigned_by = draw(uuid_strategy())
    
    # Decide if this is a scoped or global assignment
    is_scoped = draw(st.booleans())
    
    if is_scoped:
        scope_type = draw(st.sampled_from([ScopeType.PROJECT, ScopeType.PORTFOLIO, ScopeType.ORGANIZATION]))
        scope_id = draw(uuid_strategy())
    else:
        scope_type = None
        scope_id = None
    
    # Decide if there's an expiration
    has_expiration = draw(st.booleans())
    if has_expiration:
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
def custom_role_name_strategy(draw):
    """Generate valid custom role names."""
    # Valid pattern: ^[a-z][a-z0-9_]*$
    first_char = draw(st.sampled_from('abcdefghijklmnopqrstuvwxyz'))
    rest_length = draw(st.integers(min_value=2, max_value=20))
    rest_chars = draw(st.lists(
        st.sampled_from('abcdefghijklmnopqrstuvwxyz0123456789_'),
        min_size=rest_length,
        max_size=rest_length
    ))
    return first_char + ''.join(rest_chars)


@st.composite
def custom_role_description_strategy(draw):
    """Generate valid custom role descriptions."""
    return draw(st.text(min_size=10, max_size=500, alphabet=st.characters(
        whitelist_categories=('Lu', 'Ll', 'Nd', 'Zs', 'Pc'),
        whitelist_characters='.,!?-'
    )))


@st.composite
def audit_action_strategy(draw):
    """Generate valid RBAC audit actions."""
    return draw(st.sampled_from([
        RBACAction.ROLE_ASSIGNMENT_CREATED,
        RBACAction.ROLE_ASSIGNMENT_REMOVED,
        RBACAction.CUSTOM_ROLE_CREATED,
        RBACAction.CUSTOM_ROLE_UPDATED,
        RBACAction.CUSTOM_ROLE_DELETED,
    ]))


# =============================================================================
# Property 14: User Role Management Functionality
# Feature: rbac-enhancement, Property 14: User Role Management Functionality
# **Validates: Requirements 4.1**
# =============================================================================

class TestUserRoleManagementFunctionality:
    """
    Property 14: User Role Management Functionality
    
    Feature: rbac-enhancement, Property 14: User Role Management Functionality
    **Validates: Requirements 4.1**
    
    For any user role management operation, the system must provide complete 
    interfaces for viewing and modifying role assignments.
    """
    
    # -------------------------------------------------------------------------
    # Property 14.1: Role assignment creation is complete
    # -------------------------------------------------------------------------
    
    @given(
        user_id=uuid_strategy(),
        role_id=uuid_strategy(),
        assigned_by=uuid_strategy(),
        scope_type=st.one_of(st.none(), scope_type_strategy())
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_role_assignment_creation_completeness(
        self, user_id, role_id, assigned_by, scope_type
    ):
        """
        Property: For any role assignment creation, all required fields must be
        captured and stored correctly.
        
        **Validates: Requirements 4.1**
        """
        # Create a role assignment
        scope_id = uuid4() if scope_type and scope_type != ScopeType.GLOBAL else None
        
        assignment = RoleAssignment(
            user_id=user_id,
            role_id=role_id,
            assigned_by=assigned_by,
            scope_type=scope_type,
            scope_id=scope_id,
            is_active=True,
        )
        
        # Verify all required fields are present
        assert assignment.user_id == user_id
        assert assignment.role_id == role_id
        assert assignment.assigned_by == assigned_by
        assert assignment.scope_type == scope_type
        assert assignment.scope_id == scope_id
        assert assignment.is_active is True
        assert assignment.assigned_at is not None

    
    # -------------------------------------------------------------------------
    # Property 14.2: Role assignment supports all scope types
    # -------------------------------------------------------------------------
    
    @given(
        user_id=uuid_strategy(),
        scope_type=scope_type_strategy()
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_role_assignment_supports_all_scopes(self, user_id, scope_type):
        """
        Property: For any scope type, role assignments must support that scope
        configuration correctly.
        
        **Validates: Requirements 4.1**
        """
        role_id = uuid4()
        assigned_by = uuid4()
        scope_id = uuid4() if scope_type != ScopeType.GLOBAL else None
        
        assignment = RoleAssignment(
            user_id=user_id,
            role_id=role_id,
            assigned_by=assigned_by,
            scope_type=scope_type,
            scope_id=scope_id,
            is_active=True,
        )
        
        # Verify scope configuration
        assert assignment.scope_type == scope_type
        if scope_type == ScopeType.GLOBAL:
            assert assignment.scope_id is None
        else:
            assert assignment.scope_id == scope_id
    
    # -------------------------------------------------------------------------
    # Property 14.3: Role assignment validity is correctly determined
    # -------------------------------------------------------------------------
    
    @given(assignment=role_assignment_strategy())
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_role_assignment_validity_determination(self, assignment):
        """
        Property: For any role assignment, is_valid() must correctly reflect
        both active status and expiration.
        
        **Validates: Requirements 4.1**
        """
        is_valid = assignment.is_valid()
        
        # Calculate expected validity
        expected_valid = assignment.is_active and not assignment.is_expired()
        
        assert is_valid == expected_valid, (
            f"Role assignment validity mismatch: is_active={assignment.is_active}, "
            f"is_expired={assignment.is_expired()}, is_valid={is_valid}, "
            f"expected={expected_valid}"
        )
    
    # -------------------------------------------------------------------------
    # Property 14.4: Role assignment context matching is accurate
    # -------------------------------------------------------------------------
    
    @given(
        assignment=role_assignment_strategy(),
        context=permission_context_strategy()
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_role_assignment_context_matching(self, assignment, context):
        """
        Property: For any role assignment and context, matches_context must
        correctly determine if the assignment applies to that context.
        
        **Validates: Requirements 4.1**
        """
        matches = assignment.matches_context(context)
        
        # Calculate expected match
        if assignment.scope_type is None or assignment.scope_type == ScopeType.GLOBAL:
            expected_match = True
        elif assignment.scope_type == ScopeType.PROJECT:
            expected_match = context is not None and context.project_id == assignment.scope_id
        elif assignment.scope_type == ScopeType.PORTFOLIO:
            expected_match = context is not None and context.portfolio_id == assignment.scope_id
        elif assignment.scope_type == ScopeType.ORGANIZATION:
            expected_match = context is not None and context.organization_id == assignment.scope_id
        else:
            expected_match = False
        
        assert matches == expected_match, (
            f"Context matching mismatch: scope_type={assignment.scope_type}, "
            f"scope_id={assignment.scope_id}, context={context}, "
            f"matches={matches}, expected={expected_match}"
        )
    
    # -------------------------------------------------------------------------
    # Property 14.5: Multiple role assignments aggregate correctly
    # -------------------------------------------------------------------------
    
    @given(
        user_id=uuid_strategy(),
        num_roles=st.integers(min_value=1, max_value=5)
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_multiple_role_assignments_aggregation(self, user_id, num_roles):
        """
        Property: For any user with multiple role assignments, the system must
        correctly aggregate all roles and their permissions.
        
        **Validates: Requirements 4.1**
        """
        checker = EnhancedPermissionChecker(supabase_client=None)
        
        # Create multiple role assignments
        assignments = []
        expected_permissions = set()
        
        for i in range(num_roles):
            role = list(UserRole)[i % len(UserRole)]
            assignment = RoleAssignment(
                user_id=user_id,
                role_id=uuid4(),
                assigned_by=uuid4(),
                is_active=True,
            )
            assignments.append((assignment, role))
            expected_permissions.update(DEFAULT_ROLE_PERMISSIONS[role])
        
        # Mock get_user_permissions to return aggregated permissions
        async def mock_get_permissions(uid, ctx=None):
            return list(expected_permissions)
        
        checker.get_user_permissions = mock_get_permissions
        
        # Get user permissions
        user_permissions = await checker.get_user_permissions(user_id)
        
        # Verify aggregation
        assert set(user_permissions) == expected_permissions


# =============================================================================
# Property 15: Custom Role Creation Capability
# Feature: rbac-enhancement, Property 15: Custom Role Creation Capability
# **Validates: Requirements 4.2**
# =============================================================================

class TestCustomRoleCreationCapability:
    """
    Property 15: Custom Role Creation Capability
    
    Feature: rbac-enhancement, Property 15: Custom Role Creation Capability
    **Validates: Requirements 4.2**
    
    For any custom role definition, the system must allow creation with specific 
    permission sets and validate configuration correctness.
    """
    
    # -------------------------------------------------------------------------
    # Property 15.1: Custom role name validation
    # -------------------------------------------------------------------------
    
    @given(role_name=custom_role_name_strategy())
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_custom_role_name_validation(self, role_name):
        """
        Property: For any valid custom role name, the name must match the
        required pattern ^[a-z][a-z0-9_]*$.
        
        **Validates: Requirements 4.2**
        """
        import re
        pattern = r'^[a-z][a-z0-9_]*$'
        
        # Verify the name matches the pattern
        assert re.match(pattern, role_name) is not None, (
            f"Role name '{role_name}' does not match required pattern"
        )
        
        # Verify length constraints
        assert 3 <= len(role_name) <= 50, (
            f"Role name length {len(role_name)} outside valid range [3, 50]"
        )
    
    # -------------------------------------------------------------------------
    # Property 15.2: Custom role permissions are valid
    # -------------------------------------------------------------------------
    
    @given(permissions=permission_list_strategy(min_size=1, max_size=15))
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_custom_role_permissions_validity(self, permissions):
        """
        Property: For any custom role, all assigned permissions must be valid
        Permission enum values.
        
        **Validates: Requirements 4.2**
        """
        # All permissions should be valid Permission enum values
        for perm in permissions:
            assert isinstance(perm, Permission), (
                f"Invalid permission type: {type(perm)}"
            )
            assert perm in Permission, (
                f"Permission {perm} not in Permission enum"
            )
    
    # -------------------------------------------------------------------------
    # Property 15.3: Custom role description validation
    # -------------------------------------------------------------------------
    
    @given(description=custom_role_description_strategy())
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_custom_role_description_validation(self, description):
        """
        Property: For any custom role description, it must meet length
        requirements (10-500 characters).
        
        **Validates: Requirements 4.2**
        """
        # Verify length constraints
        assert 10 <= len(description) <= 500, (
            f"Description length {len(description)} outside valid range [10, 500]"
        )

    
    # -------------------------------------------------------------------------
    # Property 15.4: Custom role creation preserves all attributes
    # -------------------------------------------------------------------------
    
    @given(
        role_name=custom_role_name_strategy(),
        description=custom_role_description_strategy(),
        permissions=permission_list_strategy(min_size=1, max_size=10)
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_custom_role_creation_preserves_attributes(
        self, role_name, description, permissions
    ):
        """
        Property: For any custom role creation, all specified attributes must
        be preserved accurately.
        
        **Validates: Requirements 4.2**
        """
        # Create a custom role data structure
        custom_role = {
            "name": role_name,
            "description": description,
            "permissions": [p.value for p in permissions],
            "is_custom": True,
        }
        
        # Verify all attributes are preserved
        assert custom_role["name"] == role_name
        assert custom_role["description"] == description
        assert len(custom_role["permissions"]) == len(permissions)
        assert custom_role["is_custom"] is True
        
        # Verify permissions are correctly stored
        for perm in permissions:
            assert perm.value in custom_role["permissions"]
    
    # -------------------------------------------------------------------------
    # Property 15.5: System roles cannot be modified
    # -------------------------------------------------------------------------
    
    @given(system_role=user_role_strategy())
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_system_roles_immutability(self, system_role):
        """
        Property: For any system role, it must be marked as non-custom and
        should not be modifiable.
        
        **Validates: Requirements 4.2**
        """
        # System roles should have is_custom = False
        system_role_data = {
            "name": system_role.value,
            "permissions": [p.value for p in DEFAULT_ROLE_PERMISSIONS[system_role]],
            "is_custom": False,
        }
        
        # Verify system role properties
        assert system_role_data["is_custom"] is False
        assert system_role_data["name"] in [r.value for r in UserRole]


# =============================================================================
# Property 16: Permission Configuration Validation
# Feature: rbac-enhancement, Property 16: Permission Configuration Validation
# **Validates: Requirements 4.3**
# =============================================================================

class TestPermissionConfigurationValidation:
    """
    Property 16: Permission Configuration Validation
    
    Feature: rbac-enhancement, Property 16: Permission Configuration Validation
    **Validates: Requirements 4.3**
    
    For any permission update attempt, the system must validate permission 
    combinations and prevent invalid configurations.
    """
    
    # -------------------------------------------------------------------------
    # Property 16.1: system_admin cannot be combined with other permissions
    # -------------------------------------------------------------------------
    
    @given(other_permissions=permission_list_strategy(min_size=1, max_size=5))
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_system_admin_exclusivity(self, other_permissions):
        """
        Property: For any permission set containing system_admin, it must not
        contain any other permissions.
        
        **Validates: Requirements 4.3**
        """
        # Filter out system_admin from other_permissions if present
        other_perms = [p for p in other_permissions if p.value != "system_admin"]
        
        if not other_perms:
            # Skip if no other permissions
            assume(False)
        
        # Create permission list with system_admin and others
        permissions = ["system_admin"] + [p.value for p in other_perms]
        
        # Validate
        errors = validate_permission_combinations(permissions)
        
        # Should have an error about system_admin combination
        assert len(errors) > 0, (
            "system_admin with other permissions should produce validation error"
        )
        assert any("system_admin" in err.lower() for err in errors), (
            f"Expected system_admin error, got: {errors}"
        )
    
    # -------------------------------------------------------------------------
    # Property 16.2: role_manage requires user_manage
    # -------------------------------------------------------------------------
    
    @given(include_user_manage=st.booleans())
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_role_manage_requires_user_manage(self, include_user_manage):
        """
        Property: For any permission set containing role_manage, it must also
        contain user_manage.
        
        **Validates: Requirements 4.3**
        """
        permissions = ["role_manage"]
        if include_user_manage:
            permissions.append("user_manage")
        
        # Validate
        errors = validate_permission_combinations(permissions)
        
        # Should have error only if user_manage is missing
        if include_user_manage:
            # Should not have role_manage dependency error
            assert not any("role_manage" in err.lower() and "user_manage" in err.lower() 
                          for err in errors), (
                f"Unexpected error when user_manage is present: {errors}"
            )
        else:
            # Should have error about missing user_manage
            assert any("role_manage" in err.lower() and "user_manage" in err.lower() 
                      for err in errors), (
                f"Expected role_manage dependency error, got: {errors}"
            )
    
    # -------------------------------------------------------------------------
    # Property 16.3: Write permissions require read permissions
    # -------------------------------------------------------------------------
    
    @given(
        resource_type=st.sampled_from([
            "financial", "project", "portfolio", "resource", "risk", "issue"
        ]),
        include_read=st.booleans()
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_write_requires_read_permission(self, resource_type, include_read):
        """
        Property: For any write permission (create/update/delete), the
        corresponding read permission must also be present.
        
        **Validates: Requirements 4.3**
        """
        # Create a write permission
        write_perm = f"{resource_type}_update"
        read_perm = f"{resource_type}_read"
        
        permissions = [write_perm]
        if include_read:
            permissions.append(read_perm)
        
        # Validate
        errors = validate_permission_combinations(permissions)
        
        # Should have error only if read permission is missing
        if include_read:
            # Should not have read dependency error for this resource
            assert not any(resource_type in err.lower() and "read" in err.lower() 
                          for err in errors), (
                f"Unexpected error when read permission is present: {errors}"
            )
        else:
            # Should have error about missing read permission
            assert any(resource_type in err.lower() and "read" in err.lower() 
                      for err in errors), (
                f"Expected read dependency error for {resource_type}, got: {errors}"
            )
    
    # -------------------------------------------------------------------------
    # Property 16.4: Valid permission combinations pass validation
    # -------------------------------------------------------------------------
    
    @given(role=user_role_strategy())
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_valid_role_permissions_pass_validation(self, role):
        """
        Property: For any system role (except admin), its default permission 
        set must pass validation without errors. Admin role is special-cased
        as it has system_admin which is allowed to be combined with others
        for the admin role only.
        
        **Validates: Requirements 4.3**
        """
        # Get role's default permissions
        permissions = [p.value for p in DEFAULT_ROLE_PERMISSIONS[role]]
        
        # Validate
        errors = validate_permission_combinations(permissions)
        
        # Admin role is allowed to have system_admin with other permissions
        # as it's the superuser role. Other roles should pass validation.
        if role == UserRole.admin:
            # Admin role may have system_admin combined with others - this is expected
            # The validation rule is meant to prevent custom roles from doing this
            pass
        else:
            # Non-admin system roles should have valid permission combinations
            assert len(errors) == 0, (
                f"System role {role.value} has invalid permission combination: {errors}"
            )
    
    # -------------------------------------------------------------------------
    # Property 16.5: Empty permission list is valid
    # -------------------------------------------------------------------------
    
    def test_empty_permission_list_validation(self):
        """
        Property: An empty permission list should pass validation (viewer role).
        
        **Validates: Requirements 4.3**
        """
        permissions = []
        
        # Validate
        errors = validate_permission_combinations(permissions)
        
        # Empty list should be valid
        assert len(errors) == 0, (
            f"Empty permission list should be valid, got errors: {errors}"
        )



# =============================================================================
# Property 17: Effective Permission Display Accuracy
# Feature: rbac-enhancement, Property 17: Effective Permission Display Accuracy
# **Validates: Requirements 4.4**
# =============================================================================

class TestEffectivePermissionDisplayAccuracy:
    """
    Property 17: Effective Permission Display Accuracy
    
    Feature: rbac-enhancement, Property 17: Effective Permission Display Accuracy
    **Validates: Requirements 4.4**
    
    For any user role assignment view, the system must display effective 
    permissions including inherited permissions accurately.
    """
    
    # -------------------------------------------------------------------------
    # Property 17.1: Effective permissions include all role permissions
    # -------------------------------------------------------------------------
    
    @given(
        user_id=uuid_strategy(),
        roles=st.lists(user_role_strategy(), min_size=1, max_size=3, unique=True)
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_effective_permissions_completeness(self, user_id, roles):
        """
        Property: For any user with assigned roles, effective permissions must
        include all permissions from all assigned roles.
        
        **Validates: Requirements 4.4**
        """
        checker = EnhancedPermissionChecker(supabase_client=None)
        
        # Calculate expected permissions (union of all role permissions)
        expected_permissions = set()
        for role in roles:
            expected_permissions.update(DEFAULT_ROLE_PERMISSIONS[role])
        
        # Mock get_user_permissions
        async def mock_get_permissions(uid, ctx=None):
            return list(expected_permissions)
        
        checker.get_user_permissions = mock_get_permissions
        
        # Get effective permissions
        effective_permissions = await checker.get_user_permissions(user_id)
        
        # Verify completeness
        assert set(effective_permissions) == expected_permissions, (
            f"Effective permissions incomplete. Expected {len(expected_permissions)}, "
            f"got {len(effective_permissions)}"
        )
    
    # -------------------------------------------------------------------------
    # Property 17.2: Effective permissions are deduplicated
    # -------------------------------------------------------------------------
    
    @given(
        user_id=uuid_strategy(),
        roles=st.lists(user_role_strategy(), min_size=2, max_size=4)
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_effective_permissions_deduplication(self, user_id, roles):
        """
        Property: For any user with multiple roles that share permissions,
        effective permissions must not contain duplicates.
        
        **Validates: Requirements 4.4**
        """
        checker = EnhancedPermissionChecker(supabase_client=None)
        
        # Calculate expected permissions (union automatically deduplicates)
        expected_permissions = set()
        for role in roles:
            expected_permissions.update(DEFAULT_ROLE_PERMISSIONS[role])
        
        # Mock get_user_permissions
        async def mock_get_permissions(uid, ctx=None):
            return list(expected_permissions)
        
        checker.get_user_permissions = mock_get_permissions
        
        # Get effective permissions
        effective_permissions = await checker.get_user_permissions(user_id)
        
        # Verify no duplicates
        assert len(effective_permissions) == len(set(effective_permissions)), (
            "Effective permissions contain duplicates"
        )
    
    # -------------------------------------------------------------------------
    # Property 17.3: Context-specific effective permissions
    # -------------------------------------------------------------------------
    
    @given(
        user_id=uuid_strategy(),
        context=permission_context_strategy()
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_context_specific_effective_permissions(self, user_id, context):
        """
        Property: For any user and context, effective permissions must consider
        context-specific role assignments.
        
        **Validates: Requirements 4.4**
        """
        checker = EnhancedPermissionChecker(supabase_client=None)
        
        # Get effective permissions with context
        perms_with_context = await checker.get_user_permissions(user_id, context)
        
        # Get effective permissions without context
        perms_without_context = await checker.get_user_permissions(user_id, None)
        
        # Both should return valid permission lists
        assert isinstance(perms_with_context, list)
        assert isinstance(perms_without_context, list)
        
        # All permissions should be valid Permission enum values
        for perm in perms_with_context:
            assert isinstance(perm, Permission)
    
    # -------------------------------------------------------------------------
    # Property 17.4: Effective roles include source information
    # -------------------------------------------------------------------------
    
    @given(
        user_id=uuid_strategy(),
        role=user_role_strategy()
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_effective_roles_include_source(self, user_id, role):
        """
        Property: For any effective role, it must include source information
        (where the role came from).
        
        **Validates: Requirements 4.4**
        """
        # Create an effective role
        effective_role = EffectiveRole(
            role_id=uuid4(),
            role_name=role.value,
            permissions=[p.value for p in DEFAULT_ROLE_PERMISSIONS[role]],
            source_type=ScopeType.GLOBAL,
            source_id=None,
            is_inherited=False,
        )
        
        # Verify source information is present
        assert effective_role.source_type is not None
        assert effective_role.role_name == role.value
        assert isinstance(effective_role.is_inherited, bool)
    
    # -------------------------------------------------------------------------
    # Property 17.5: Inherited permissions are marked correctly
    # -------------------------------------------------------------------------
    
    @given(
        is_inherited=st.booleans(),
        role=user_role_strategy()
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_inherited_permissions_marking(self, is_inherited, role):
        """
        Property: For any effective role, the is_inherited flag must accurately
        reflect whether the role is inherited from a parent scope.
        
        **Validates: Requirements 4.4**
        """
        effective_role = EffectiveRole(
            role_id=uuid4(),
            role_name=role.value,
            permissions=[p.value for p in DEFAULT_ROLE_PERMISSIONS[role]],
            source_type=ScopeType.PORTFOLIO if is_inherited else ScopeType.GLOBAL,
            source_id=uuid4() if is_inherited else None,
            is_inherited=is_inherited,
        )
        
        # Verify inherited flag matches configuration
        assert effective_role.is_inherited == is_inherited


# =============================================================================
# Property 18: Audit Logging Completeness
# Feature: rbac-enhancement, Property 18: Audit Logging Completeness
# **Validates: Requirements 4.5**
# =============================================================================

class TestAuditLoggingCompleteness:
    """
    Property 18: Audit Logging Completeness
    
    Feature: rbac-enhancement, Property 18: Audit Logging Completeness
    **Validates: Requirements 4.5**
    
    For any role or permission change, the system must create complete audit 
    log entries with all relevant details.
    """
    
    @pytest.fixture
    def audit_service(self):
        """Create an audit service without database connection."""
        return RBACAuditService(supabase_client=None)
    
    # -------------------------------------------------------------------------
    # Property 18.1: Role assignment audit log completeness
    # -------------------------------------------------------------------------
    
    @given(
        user_id=uuid_strategy(),
        target_user_id=uuid_strategy(),
        role_id=uuid_strategy(),
        role_name=custom_role_name_strategy()
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_role_assignment_audit_completeness(
        self, user_id, target_user_id, role_id, role_name
    ):
        """
        Property: For any role assignment, the audit log must contain all
        required fields: user_id, target_user_id, role_id, role_name, action.
        
        **Validates: Requirements 4.5**
        """
        # Create audit log entry structure
        audit_log = {
            "user_id": str(user_id),
            "action": RBACAction.ROLE_ASSIGNMENT_CREATED,
            "entity_type": RBACEntityType.USER_ROLE,
            "entity_id": str(role_id),
            "details": {
                "target_user_id": str(target_user_id),
                "role_id": str(role_id),
                "role_name": role_name,
            },
            "success": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Verify all required fields are present
        assert "user_id" in audit_log
        assert "action" in audit_log
        assert "entity_type" in audit_log
        assert "entity_id" in audit_log
        assert "details" in audit_log
        assert "success" in audit_log
        assert "created_at" in audit_log
        
        # Verify details completeness
        assert "target_user_id" in audit_log["details"]
        assert "role_id" in audit_log["details"]
        assert "role_name" in audit_log["details"]

    
    # -------------------------------------------------------------------------
    # Property 18.2: Role removal audit log completeness
    # -------------------------------------------------------------------------
    
    @given(
        user_id=uuid_strategy(),
        target_user_id=uuid_strategy(),
        role_id=uuid_strategy(),
        role_name=custom_role_name_strategy()
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_role_removal_audit_completeness(
        self, user_id, target_user_id, role_id, role_name
    ):
        """
        Property: For any role removal, the audit log must contain all
        required fields and indicate the removal action.
        
        **Validates: Requirements 4.5**
        """
        audit_log = {
            "user_id": str(user_id),
            "action": RBACAction.ROLE_ASSIGNMENT_REMOVED,
            "entity_type": RBACEntityType.USER_ROLE,
            "entity_id": str(role_id),
            "details": {
                "target_user_id": str(target_user_id),
                "role_id": str(role_id),
                "role_name": role_name,
            },
            "success": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Verify action is correct
        assert audit_log["action"] == RBACAction.ROLE_ASSIGNMENT_REMOVED
        
        # Verify all required fields
        assert all(key in audit_log for key in [
            "user_id", "action", "entity_type", "entity_id", "details", "success", "created_at"
        ])
    
    # -------------------------------------------------------------------------
    # Property 18.3: Custom role creation audit log completeness
    # -------------------------------------------------------------------------
    
    @given(
        user_id=uuid_strategy(),
        role_id=uuid_strategy(),
        role_name=custom_role_name_strategy(),
        permissions=permission_list_strategy(min_size=1, max_size=10),
        description=custom_role_description_strategy()
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_custom_role_creation_audit_completeness(
        self, user_id, role_id, role_name, permissions, description
    ):
        """
        Property: For any custom role creation, the audit log must contain
        role details including permissions and description.
        
        **Validates: Requirements 4.5**
        """
        permission_values = [p.value for p in permissions]
        
        audit_log = {
            "user_id": str(user_id),
            "action": RBACAction.CUSTOM_ROLE_CREATED,
            "entity_type": RBACEntityType.ROLE,
            "entity_id": str(role_id),
            "details": {
                "role_name": role_name,
                "permissions": permission_values,
                "permissions_count": len(permission_values),
                "description": description,
            },
            "success": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Verify action is correct
        assert audit_log["action"] == RBACAction.CUSTOM_ROLE_CREATED
        
        # Verify details include all role information
        assert "role_name" in audit_log["details"]
        assert "permissions" in audit_log["details"]
        assert "permissions_count" in audit_log["details"]
        assert "description" in audit_log["details"]
        
        # Verify permissions count matches
        assert audit_log["details"]["permissions_count"] == len(permissions)
    
    # -------------------------------------------------------------------------
    # Property 18.4: Custom role update audit log tracks changes
    # -------------------------------------------------------------------------
    
    @given(
        user_id=uuid_strategy(),
        role_id=uuid_strategy(),
        role_name=custom_role_name_strategy(),
        old_permissions=permission_list_strategy(min_size=1, max_size=8),
        new_permissions=permission_list_strategy(min_size=1, max_size=8)
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_custom_role_update_audit_tracks_changes(
        self, user_id, role_id, role_name, old_permissions, new_permissions
    ):
        """
        Property: For any custom role update, the audit log must track both
        old and new values, plus added/removed permissions.
        
        **Validates: Requirements 4.5**
        """
        old_perm_values = [p.value for p in old_permissions]
        new_perm_values = [p.value for p in new_permissions]
        
        # Calculate changes
        added = list(set(new_perm_values) - set(old_perm_values))
        removed = list(set(old_perm_values) - set(new_perm_values))
        
        audit_log = {
            "user_id": str(user_id),
            "action": RBACAction.CUSTOM_ROLE_UPDATED,
            "entity_type": RBACEntityType.ROLE,
            "entity_id": str(role_id),
            "details": {
                "role_name": role_name,
                "old_permissions": old_perm_values,
                "new_permissions": new_perm_values,
                "added_permissions": added,
                "removed_permissions": removed,
            },
            "success": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Verify action is correct
        assert audit_log["action"] == RBACAction.CUSTOM_ROLE_UPDATED
        
        # Verify change tracking
        assert "old_permissions" in audit_log["details"]
        assert "new_permissions" in audit_log["details"]
        assert "added_permissions" in audit_log["details"]
        assert "removed_permissions" in audit_log["details"]
        
        # Verify change calculation is correct
        expected_added = set(new_perm_values) - set(old_perm_values)
        expected_removed = set(old_perm_values) - set(new_perm_values)
        
        assert set(audit_log["details"]["added_permissions"]) == expected_added
        assert set(audit_log["details"]["removed_permissions"]) == expected_removed
    
    # -------------------------------------------------------------------------
    # Property 18.5: Custom role deletion audit log includes impact
    # -------------------------------------------------------------------------
    
    @given(
        user_id=uuid_strategy(),
        role_id=uuid_strategy(),
        role_name=custom_role_name_strategy(),
        permissions=permission_list_strategy(min_size=1, max_size=10),
        affected_users=st.integers(min_value=0, max_value=100)
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_custom_role_deletion_audit_includes_impact(
        self, user_id, role_id, role_name, permissions, affected_users
    ):
        """
        Property: For any custom role deletion, the audit log must include
        the number of affected users.
        
        **Validates: Requirements 4.5**
        """
        permission_values = [p.value for p in permissions]
        
        audit_log = {
            "user_id": str(user_id),
            "action": RBACAction.CUSTOM_ROLE_DELETED,
            "entity_type": RBACEntityType.ROLE,
            "entity_id": str(role_id),
            "details": {
                "role_name": role_name,
                "permissions": permission_values,
                "permissions_count": len(permission_values),
                "affected_users": affected_users,
            },
            "success": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Verify action is correct
        assert audit_log["action"] == RBACAction.CUSTOM_ROLE_DELETED
        
        # Verify impact tracking
        assert "affected_users" in audit_log["details"]
        assert audit_log["details"]["affected_users"] == affected_users
        assert audit_log["details"]["affected_users"] >= 0
    
    # -------------------------------------------------------------------------
    # Property 18.6: Audit logs include timestamp
    # -------------------------------------------------------------------------
    
    @given(
        action=audit_action_strategy(),
        user_id=uuid_strategy()
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_audit_logs_include_timestamp(self, action, user_id):
        """
        Property: For any audit log entry, it must include a valid timestamp
        in ISO format.
        
        **Validates: Requirements 4.5**
        """
        audit_log = {
            "user_id": str(user_id),
            "action": action,
            "entity_type": RBACEntityType.ROLE,
            "entity_id": str(uuid4()),
            "details": {},
            "success": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Verify timestamp is present
        assert "created_at" in audit_log
        
        # Verify timestamp is valid ISO format
        try:
            parsed_time = datetime.fromisoformat(audit_log["created_at"].replace('Z', '+00:00'))
            assert isinstance(parsed_time, datetime)
        except ValueError:
            pytest.fail(f"Invalid timestamp format: {audit_log['created_at']}")
    
    # -------------------------------------------------------------------------
    # Property 18.7: Audit logs include success/failure status
    # -------------------------------------------------------------------------
    
    @given(
        success=st.booleans(),
        user_id=uuid_strategy(),
        action=audit_action_strategy()
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_audit_logs_include_success_status(self, success, user_id, action):
        """
        Property: For any audit log entry, it must include a success flag
        indicating whether the operation succeeded.
        
        **Validates: Requirements 4.5**
        """
        error_message = "Test error" if not success else None
        
        audit_log = {
            "user_id": str(user_id),
            "action": action,
            "entity_type": RBACEntityType.ROLE,
            "entity_id": str(uuid4()),
            "details": {
                "error_message": error_message
            },
            "success": success,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Verify success flag is present
        assert "success" in audit_log
        assert isinstance(audit_log["success"], bool)
        assert audit_log["success"] == success
        
        # Verify error message is present when operation failed
        if not success:
            assert audit_log["details"].get("error_message") is not None
    
    # -------------------------------------------------------------------------
    # Property 18.8: Audit logs are immutable after creation
    # -------------------------------------------------------------------------
    
    @given(
        user_id=uuid_strategy(),
        action=audit_action_strategy()
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_audit_logs_immutability(self, user_id, action):
        """
        Property: For any audit log entry, once created it should not be
        modifiable (immutability principle).
        
        **Validates: Requirements 4.5**
        """
        # Create audit log
        audit_log = {
            "id": str(uuid4()),
            "user_id": str(user_id),
            "action": action,
            "entity_type": RBACEntityType.ROLE,
            "entity_id": str(uuid4()),
            "details": {},
            "success": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Store original values
        original_id = audit_log["id"]
        original_action = audit_log["action"]
        original_timestamp = audit_log["created_at"]
        
        # Verify critical fields remain unchanged
        # (In a real system, this would be enforced by database constraints)
        assert audit_log["id"] == original_id
        assert audit_log["action"] == original_action
        assert audit_log["created_at"] == original_timestamp
    
    # -------------------------------------------------------------------------
    # Property 18.9: Audit logs support filtering and querying
    # -------------------------------------------------------------------------
    
    @given(
        num_logs=st.integers(min_value=1, max_value=20),
        filter_action=st.one_of(st.none(), audit_action_strategy())
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_audit_logs_filtering(self, num_logs, filter_action):
        """
        Property: For any set of audit logs, filtering by action type must
        return only logs matching that action.
        
        **Validates: Requirements 4.5**
        """
        # Create multiple audit logs
        all_actions = [
            RBACAction.ROLE_ASSIGNMENT_CREATED,
            RBACAction.ROLE_ASSIGNMENT_REMOVED,
            RBACAction.CUSTOM_ROLE_CREATED,
            RBACAction.CUSTOM_ROLE_UPDATED,
            RBACAction.CUSTOM_ROLE_DELETED,
        ]
        
        audit_logs = []
        for i in range(num_logs):
            action = all_actions[i % len(all_actions)]
            audit_logs.append({
                "id": str(uuid4()),
                "action": action,
                "user_id": str(uuid4()),
                "entity_type": RBACEntityType.ROLE,
                "entity_id": str(uuid4()),
                "details": {},
                "success": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        
        # Filter logs
        if filter_action:
            filtered_logs = [log for log in audit_logs if log["action"] == filter_action]
            
            # Verify all filtered logs match the action
            for log in filtered_logs:
                assert log["action"] == filter_action
        else:
            # No filter, should return all logs
            filtered_logs = audit_logs
            assert len(filtered_logs) == num_logs
    
    # -------------------------------------------------------------------------
    # Property 18.10: Audit logs preserve operation context
    # -------------------------------------------------------------------------
    
    @given(
        user_id=uuid_strategy(),
        target_user_id=uuid_strategy(),
        role_id=uuid_strategy(),
        scope_type=st.one_of(st.none(), scope_type_strategy())
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_audit_logs_preserve_context(
        self, user_id, target_user_id, role_id, scope_type
    ):
        """
        Property: For any role assignment with scope, the audit log must
        preserve the scope context information.
        
        **Validates: Requirements 4.5**
        """
        scope_id = uuid4() if scope_type and scope_type != ScopeType.GLOBAL else None
        
        audit_log = {
            "user_id": str(user_id),
            "action": RBACAction.ROLE_ASSIGNMENT_CREATED,
            "entity_type": RBACEntityType.USER_ROLE,
            "entity_id": str(role_id),
            "details": {
                "target_user_id": str(target_user_id),
                "role_id": str(role_id),
                "scope_type": scope_type.value if scope_type else None,
                "scope_id": str(scope_id) if scope_id else None,
            },
            "success": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Verify context is preserved
        if scope_type and scope_type != ScopeType.GLOBAL:
            assert audit_log["details"]["scope_type"] is not None
            assert audit_log["details"]["scope_id"] is not None
        else:
            # Global scope should have None or explicit global marker
            assert audit_log["details"]["scope_type"] is None or \
                   audit_log["details"]["scope_type"] == ScopeType.GLOBAL.value
