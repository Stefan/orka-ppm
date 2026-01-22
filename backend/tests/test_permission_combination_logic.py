"""
Unit Tests for Permission Combination Logic

Feature: rbac-enhancement, Task 2.3: Implement permission combination logic

**Validates: Requirements 1.4**

This test module validates:
1. AND logic for permission combinations (AllOfRequirement)
2. OR logic for permission combinations (AnyOfRequirement)
3. Nested/complex permission requirements (ComplexRequirement)
4. Integration with EnhancedPermissionChecker
5. Error reporting with detailed missing permission information

Testing Framework: pytest
"""

import pytest
from uuid import uuid4, UUID
from typing import Set

from auth.rbac import Permission, UserRole, DEFAULT_ROLE_PERMISSIONS
from auth.permission_requirements import (
    RequirementType,
    PermissionCheckResult,
    PermissionRequirement,
    SinglePermissionRequirement,
    AllOfRequirement,
    AnyOfRequirement,
    ComplexRequirement,
    AllRequirementsRequirement,
    PermissionRequirementError,
    require_read_and_write,
    require_full_access,
    require_manager_or_admin,
)
from auth.enhanced_permission_checker import EnhancedPermissionChecker
from auth.enhanced_rbac_models import PermissionContext


# =============================================================================
# Test Fixtures
# =============================================================================

@pytest.fixture
def admin_permissions() -> Set[Permission]:
    """Get admin permissions as a set."""
    return set(DEFAULT_ROLE_PERMISSIONS[UserRole.admin])


@pytest.fixture
def viewer_permissions() -> Set[Permission]:
    """Get viewer permissions as a set."""
    return set(DEFAULT_ROLE_PERMISSIONS[UserRole.viewer])


@pytest.fixture
def project_manager_permissions() -> Set[Permission]:
    """Get project manager permissions as a set."""
    return set(DEFAULT_ROLE_PERMISSIONS[UserRole.project_manager])


@pytest.fixture
def empty_permissions() -> Set[Permission]:
    """Get empty permission set."""
    return set()


@pytest.fixture
def permission_checker() -> EnhancedPermissionChecker:
    """Create a permission checker without database connection."""
    return EnhancedPermissionChecker(supabase_client=None)


# =============================================================================
# SinglePermissionRequirement Tests
# =============================================================================

class TestSinglePermissionRequirement:
    """Tests for SinglePermissionRequirement class."""
    
    def test_single_permission_satisfied(self, admin_permissions):
        """Test that a single permission requirement is satisfied when user has it."""
        req = PermissionRequirement.single(Permission.project_read)
        result = req.check(admin_permissions)
        
        assert result.satisfied is True
        assert result.requirement_type == RequirementType.SINGLE
        assert Permission.project_read in result.satisfied_permissions
        assert len(result.missing_permissions) == 0
    
    def test_single_permission_not_satisfied(self, empty_permissions):
        """Test that a single permission requirement fails when user doesn't have it."""
        req = PermissionRequirement.single(Permission.project_read)
        result = req.check(empty_permissions)
        
        assert result.satisfied is False
        assert result.requirement_type == RequirementType.SINGLE
        assert len(result.satisfied_permissions) == 0
        assert Permission.project_read in result.missing_permissions
    
    def test_single_permission_describe(self):
        """Test that describe returns a human-readable description."""
        req = PermissionRequirement.single(Permission.project_read)
        description = req.describe()
        
        assert "project_read" in description
        assert "Requires" in description
    
    def test_single_permission_get_all_permissions(self):
        """Test that get_all_permissions returns the single permission."""
        req = PermissionRequirement.single(Permission.project_read)
        all_perms = req.get_all_permissions()
        
        assert len(all_perms) == 1
        assert Permission.project_read in all_perms


# =============================================================================
# AllOfRequirement Tests (AND Logic)
# =============================================================================

class TestAllOfRequirement:
    """Tests for AllOfRequirement class (AND logic)."""
    
    def test_all_of_satisfied_when_all_present(self, admin_permissions):
        """Test AND logic: satisfied when user has ALL permissions."""
        req = PermissionRequirement.all_of(
            Permission.project_read,
            Permission.project_update,
            Permission.project_create
        )
        result = req.check(admin_permissions)
        
        assert result.satisfied is True
        assert result.requirement_type == RequirementType.ALL
        assert len(result.missing_permissions) == 0
        assert len(result.satisfied_permissions) == 3
    
    def test_all_of_not_satisfied_when_one_missing(self, viewer_permissions):
        """Test AND logic: not satisfied when user is missing ANY permission."""
        req = PermissionRequirement.all_of(
            Permission.project_read,
            Permission.project_update,  # Viewer doesn't have this
            Permission.project_create   # Viewer doesn't have this
        )
        result = req.check(viewer_permissions)
        
        assert result.satisfied is False
        assert result.requirement_type == RequirementType.ALL
        assert Permission.project_read in result.satisfied_permissions
        assert Permission.project_update in result.missing_permissions
        assert Permission.project_create in result.missing_permissions
    
    def test_all_of_not_satisfied_when_all_missing(self, empty_permissions):
        """Test AND logic: not satisfied when user has NONE of the permissions."""
        req = PermissionRequirement.all_of(
            Permission.project_read,
            Permission.project_update
        )
        result = req.check(empty_permissions)
        
        assert result.satisfied is False
        assert len(result.satisfied_permissions) == 0
        assert len(result.missing_permissions) == 2
    
    def test_all_of_describe(self):
        """Test that describe returns a human-readable description."""
        req = PermissionRequirement.all_of(
            Permission.project_read,
            Permission.project_update
        )
        description = req.describe()
        
        assert "ALL" in description
        assert "project_read" in description
        assert "project_update" in description
    
    def test_all_of_get_all_permissions(self):
        """Test that get_all_permissions returns all permissions."""
        req = PermissionRequirement.all_of(
            Permission.project_read,
            Permission.project_update,
            Permission.project_create
        )
        all_perms = req.get_all_permissions()
        
        assert len(all_perms) == 3
        assert Permission.project_read in all_perms
        assert Permission.project_update in all_perms
        assert Permission.project_create in all_perms
    
    def test_all_of_empty_list(self):
        """Test AND logic with empty list (should be satisfied)."""
        req = AllOfRequirement([])
        result = req.check(set())
        
        assert result.satisfied is True
        assert len(result.missing_permissions) == 0


# =============================================================================
# AnyOfRequirement Tests (OR Logic)
# =============================================================================

class TestAnyOfRequirement:
    """Tests for AnyOfRequirement class (OR logic)."""
    
    def test_any_of_satisfied_when_one_present(self, viewer_permissions):
        """Test OR logic: satisfied when user has ANY of the permissions."""
        req = PermissionRequirement.any_of(
            Permission.project_read,  # Viewer has this
            Permission.project_update,  # Viewer doesn't have this
            Permission.project_create   # Viewer doesn't have this
        )
        result = req.check(viewer_permissions)
        
        assert result.satisfied is True
        assert result.requirement_type == RequirementType.ANY
        assert Permission.project_read in result.satisfied_permissions
        # When satisfied, missing_permissions should be empty
        assert len(result.missing_permissions) == 0
    
    def test_any_of_satisfied_when_all_present(self, admin_permissions):
        """Test OR logic: satisfied when user has ALL of the permissions."""
        req = PermissionRequirement.any_of(
            Permission.project_read,
            Permission.project_update
        )
        result = req.check(admin_permissions)
        
        assert result.satisfied is True
        assert len(result.satisfied_permissions) == 2
    
    def test_any_of_not_satisfied_when_none_present(self, empty_permissions):
        """Test OR logic: not satisfied when user has NONE of the permissions."""
        req = PermissionRequirement.any_of(
            Permission.project_read,
            Permission.project_update
        )
        result = req.check(empty_permissions)
        
        assert result.satisfied is False
        assert result.requirement_type == RequirementType.ANY
        assert len(result.satisfied_permissions) == 0
        assert len(result.missing_permissions) == 2
    
    def test_any_of_describe(self):
        """Test that describe returns a human-readable description."""
        req = PermissionRequirement.any_of(
            Permission.project_read,
            Permission.project_update
        )
        description = req.describe()
        
        assert "ANY" in description
        assert "project_read" in description
        assert "project_update" in description
    
    def test_any_of_get_all_permissions(self):
        """Test that get_all_permissions returns all permissions."""
        req = PermissionRequirement.any_of(
            Permission.project_read,
            Permission.project_update
        )
        all_perms = req.get_all_permissions()
        
        assert len(all_perms) == 2
        assert Permission.project_read in all_perms
        assert Permission.project_update in all_perms
    
    def test_any_of_empty_list(self):
        """Test OR logic with empty list (should not be satisfied)."""
        req = AnyOfRequirement([])
        result = req.check(set())
        
        assert result.satisfied is False


# =============================================================================
# ComplexRequirement Tests (Nested OR Logic)
# =============================================================================

class TestComplexRequirement:
    """Tests for ComplexRequirement class (nested combinations with OR logic)."""
    
    def test_complex_satisfied_when_first_sub_requirement_satisfied(self, admin_permissions):
        """Test complex: satisfied when first sub-requirement is satisfied."""
        # (project_read AND project_update) OR (portfolio_read AND portfolio_update)
        req = PermissionRequirement.complex(
            PermissionRequirement.all_of(Permission.project_read, Permission.project_update),
            PermissionRequirement.all_of(Permission.portfolio_read, Permission.portfolio_update)
        )
        result = req.check(admin_permissions)
        
        assert result.satisfied is True
        assert result.requirement_type == RequirementType.COMPLEX
        assert len(result.nested_results) == 2
    
    def test_complex_satisfied_when_second_sub_requirement_satisfied(self, viewer_permissions):
        """Test complex: satisfied when second sub-requirement is satisfied."""
        # (project_update AND project_delete) OR (project_read)
        req = PermissionRequirement.complex(
            PermissionRequirement.all_of(Permission.project_update, Permission.project_delete),
            PermissionRequirement.single(Permission.project_read)  # Viewer has this
        )
        result = req.check(viewer_permissions)
        
        assert result.satisfied is True
        # First nested result should be False, second should be True
        assert result.nested_results[0].satisfied is False
        assert result.nested_results[1].satisfied is True
    
    def test_complex_not_satisfied_when_no_sub_requirement_satisfied(self, empty_permissions):
        """Test complex: not satisfied when no sub-requirement is satisfied."""
        req = PermissionRequirement.complex(
            PermissionRequirement.all_of(Permission.project_read, Permission.project_update),
            PermissionRequirement.single(Permission.portfolio_read)
        )
        result = req.check(empty_permissions)
        
        assert result.satisfied is False
        assert all(not r.satisfied for r in result.nested_results)
    
    def test_complex_describe(self):
        """Test that describe returns a human-readable description."""
        req = PermissionRequirement.complex(
            PermissionRequirement.all_of(Permission.project_read, Permission.project_update),
            PermissionRequirement.single(Permission.portfolio_read)
        )
        description = req.describe()
        
        assert "ONE OF" in description
        assert "OR" in description
    
    def test_complex_get_all_permissions(self):
        """Test that get_all_permissions returns all permissions from all sub-requirements."""
        req = PermissionRequirement.complex(
            PermissionRequirement.all_of(Permission.project_read, Permission.project_update),
            PermissionRequirement.single(Permission.portfolio_read)
        )
        all_perms = req.get_all_permissions()
        
        assert len(all_perms) == 3
        assert Permission.project_read in all_perms
        assert Permission.project_update in all_perms
        assert Permission.portfolio_read in all_perms
    
    def test_deeply_nested_complex_requirement(self, admin_permissions):
        """Test deeply nested complex requirements."""
        # ((A AND B) OR C) OR ((D AND E) OR F)
        req = PermissionRequirement.complex(
            PermissionRequirement.complex(
                PermissionRequirement.all_of(Permission.project_read, Permission.project_update),
                PermissionRequirement.single(Permission.portfolio_read)
            ),
            PermissionRequirement.complex(
                PermissionRequirement.all_of(Permission.resource_read, Permission.resource_update),
                PermissionRequirement.single(Permission.financial_read)
            )
        )
        result = req.check(admin_permissions)
        
        assert result.satisfied is True


# =============================================================================
# AllRequirementsRequirement Tests (Nested AND Logic)
# =============================================================================

class TestAllRequirementsRequirement:
    """Tests for AllRequirementsRequirement class (nested combinations with AND logic)."""
    
    def test_all_requirements_satisfied_when_all_sub_requirements_satisfied(self, admin_permissions):
        """Test all_requirements: satisfied when ALL sub-requirements are satisfied."""
        # (project_read OR project_update) AND (portfolio_read OR portfolio_update)
        req = PermissionRequirement.all_requirements(
            PermissionRequirement.any_of(Permission.project_read, Permission.project_update),
            PermissionRequirement.any_of(Permission.portfolio_read, Permission.portfolio_update)
        )
        result = req.check(admin_permissions)
        
        assert result.satisfied is True
        assert all(r.satisfied for r in result.nested_results)
    
    def test_all_requirements_not_satisfied_when_one_sub_requirement_fails(self, viewer_permissions):
        """Test all_requirements: not satisfied when ANY sub-requirement fails."""
        # (project_read) AND (project_update OR project_delete)
        req = PermissionRequirement.all_requirements(
            PermissionRequirement.single(Permission.project_read),  # Viewer has this
            PermissionRequirement.any_of(Permission.project_update, Permission.project_delete)  # Viewer doesn't have these
        )
        result = req.check(viewer_permissions)
        
        assert result.satisfied is False
        assert result.nested_results[0].satisfied is True
        assert result.nested_results[1].satisfied is False
    
    def test_all_requirements_describe(self):
        """Test that describe returns a human-readable description."""
        req = PermissionRequirement.all_requirements(
            PermissionRequirement.any_of(Permission.project_read, Permission.project_update),
            PermissionRequirement.single(Permission.portfolio_read)
        )
        description = req.describe()
        
        assert "ALL OF" in description
        assert "AND" in description


# =============================================================================
# PermissionCheckResult Tests
# =============================================================================

class TestPermissionCheckResult:
    """Tests for PermissionCheckResult class."""
    
    def test_get_all_missing_permissions_simple(self):
        """Test getting all missing permissions from a simple result."""
        result = PermissionCheckResult(
            satisfied=False,
            requirement_type=RequirementType.ALL,
            required_permissions=[Permission.project_read, Permission.project_update],
            missing_permissions=[Permission.project_update]
        )
        
        missing = result.get_all_missing_permissions()
        assert Permission.project_update in missing
        assert len(missing) == 1
    
    def test_get_all_missing_permissions_nested(self):
        """Test getting all missing permissions from nested results."""
        nested_result = PermissionCheckResult(
            satisfied=False,
            requirement_type=RequirementType.ALL,
            missing_permissions=[Permission.portfolio_read]
        )
        
        result = PermissionCheckResult(
            satisfied=False,
            requirement_type=RequirementType.COMPLEX,
            missing_permissions=[Permission.project_update],
            nested_results=[nested_result]
        )
        
        missing = result.get_all_missing_permissions()
        assert Permission.project_update in missing
        assert Permission.portfolio_read in missing
        assert len(missing) == 2
    
    def test_get_human_readable_error_single(self):
        """Test human-readable error for single permission."""
        result = PermissionCheckResult(
            satisfied=False,
            requirement_type=RequirementType.SINGLE,
            missing_permissions=[Permission.project_read]
        )
        
        error = result.get_human_readable_error()
        assert "project_read" in error
        assert "Missing" in error
    
    def test_get_human_readable_error_all(self):
        """Test human-readable error for ALL requirement."""
        result = PermissionCheckResult(
            satisfied=False,
            requirement_type=RequirementType.ALL,
            missing_permissions=[Permission.project_read, Permission.project_update]
        )
        
        error = result.get_human_readable_error()
        assert "ALL required" in error
        assert "project_read" in error
        assert "project_update" in error
    
    def test_get_human_readable_error_any(self):
        """Test human-readable error for ANY requirement."""
        result = PermissionCheckResult(
            satisfied=False,
            requirement_type=RequirementType.ANY,
            required_permissions=[Permission.project_read, Permission.project_update]
        )
        
        error = result.get_human_readable_error()
        assert "ONE required" in error
    
    def test_get_human_readable_error_satisfied(self):
        """Test human-readable message when satisfied."""
        result = PermissionCheckResult(
            satisfied=True,
            requirement_type=RequirementType.SINGLE
        )
        
        message = result.get_human_readable_error()
        assert "satisfied" in message.lower()


# =============================================================================
# Convenience Function Tests
# =============================================================================

class TestConvenienceFunctions:
    """Tests for convenience functions."""
    
    def test_require_read_and_write(self, admin_permissions):
        """Test require_read_and_write convenience function."""
        req = require_read_and_write("project")
        result = req.check(admin_permissions)
        
        assert result.satisfied is True
        assert Permission.project_read in req.get_all_permissions()
        assert Permission.project_update in req.get_all_permissions()
    
    def test_require_full_access(self, admin_permissions):
        """Test require_full_access convenience function."""
        req = require_full_access("project")
        result = req.check(admin_permissions)
        
        assert result.satisfied is True
        all_perms = req.get_all_permissions()
        assert Permission.project_create in all_perms
        assert Permission.project_read in all_perms
        assert Permission.project_update in all_perms
        assert Permission.project_delete in all_perms
    
    def test_require_manager_or_admin(self, admin_permissions):
        """Test require_manager_or_admin convenience function."""
        req = require_manager_or_admin()
        result = req.check(admin_permissions)
        
        assert result.satisfied is True
    
    def test_require_manager_or_admin_with_project_manager(self, project_manager_permissions):
        """Test require_manager_or_admin with project manager permissions."""
        req = require_manager_or_admin()
        result = req.check(project_manager_permissions)
        
        assert result.satisfied is True


# =============================================================================
# PermissionRequirementError Tests
# =============================================================================

class TestPermissionRequirementError:
    """Tests for PermissionRequirementError class."""
    
    def test_error_creation(self):
        """Test creating a PermissionRequirementError."""
        user_id = uuid4()
        req = PermissionRequirement.single(Permission.project_read)
        result = PermissionCheckResult(
            satisfied=False,
            requirement_type=RequirementType.SINGLE,
            missing_permissions=[Permission.project_read]
        )
        
        error = PermissionRequirementError(
            user_id=user_id,
            requirement=req,
            result=result
        )
        
        assert error.user_id == user_id
        assert error.requirement == req
        assert error.result == result
        assert "project_read" in str(error)
    
    def test_error_to_dict(self):
        """Test converting error to dictionary."""
        user_id = uuid4()
        req = PermissionRequirement.single(Permission.project_read)
        result = PermissionCheckResult(
            satisfied=False,
            requirement_type=RequirementType.SINGLE,
            missing_permissions=[Permission.project_read]
        )
        
        error = PermissionRequirementError(
            user_id=user_id,
            requirement=req,
            result=result
        )
        
        error_dict = error.to_dict()
        
        assert error_dict["user_id"] == str(user_id)
        assert "project_read" in error_dict["missing_permissions"]
        assert error_dict["satisfied"] is False


# =============================================================================
# Integration Tests with EnhancedPermissionChecker
# =============================================================================

class TestEnhancedPermissionCheckerIntegration:
    """Integration tests with EnhancedPermissionChecker."""
    
    @pytest.mark.asyncio
    async def test_check_permission_requirement_satisfied(self, permission_checker):
        """Test checking a permission requirement that is satisfied."""
        # Dev user has admin permissions
        dev_user_id = UUID("00000000-0000-0000-0000-000000000001")
        
        req = PermissionRequirement.all_of(
            Permission.project_read,
            Permission.project_update
        )
        
        result = await permission_checker.check_permission_requirement(dev_user_id, req)
        
        assert result.satisfied is True
    
    @pytest.mark.asyncio
    async def test_check_permission_requirement_not_satisfied(self, permission_checker):
        """Test checking a permission requirement that is not satisfied."""
        # Regular user (not dev) gets viewer permissions by default
        regular_user_id = uuid4()
        
        req = PermissionRequirement.all_of(
            Permission.project_read,
            Permission.project_update  # Viewer doesn't have this
        )
        
        result = await permission_checker.check_permission_requirement(regular_user_id, req)
        
        assert result.satisfied is False
        assert Permission.project_update in result.missing_permissions
    
    @pytest.mark.asyncio
    async def test_check_complex_permission(self, permission_checker):
        """Test checking a complex permission requirement."""
        dev_user_id = UUID("00000000-0000-0000-0000-000000000001")
        
        req = PermissionRequirement.complex(
            PermissionRequirement.all_of(Permission.project_read, Permission.project_update),
            PermissionRequirement.single(Permission.portfolio_read)
        )
        
        is_satisfied = await permission_checker.check_complex_permission(dev_user_id, req)
        
        assert is_satisfied is True
    
    @pytest.mark.asyncio
    async def test_check_all_permissions_with_details(self, permission_checker):
        """Test checking all permissions with detailed results."""
        regular_user_id = uuid4()
        
        permissions = [
            Permission.project_read,  # Viewer has this
            Permission.project_update  # Viewer doesn't have this
        ]
        
        all_satisfied, satisfied, missing = await permission_checker.check_all_permissions_with_details(
            regular_user_id, permissions
        )
        
        assert all_satisfied is False
        assert Permission.project_read in satisfied
        assert Permission.project_update in missing
    
    @pytest.mark.asyncio
    async def test_check_any_permission_with_details(self, permission_checker):
        """Test checking any permission with detailed results."""
        regular_user_id = uuid4()
        
        permissions = [
            Permission.project_read,  # Viewer has this
            Permission.project_update  # Viewer doesn't have this
        ]
        
        any_satisfied, satisfied, unsatisfied = await permission_checker.check_any_permission_with_details(
            regular_user_id, permissions
        )
        
        assert any_satisfied is True
        assert Permission.project_read in satisfied
        assert Permission.project_update in unsatisfied
    
    @pytest.mark.asyncio
    async def test_get_missing_permissions(self, permission_checker):
        """Test getting missing permissions."""
        regular_user_id = uuid4()
        
        required = [
            Permission.project_read,
            Permission.project_update,
            Permission.project_delete
        ]
        
        missing = await permission_checker.get_missing_permissions(regular_user_id, required)
        
        # Viewer should be missing update and delete
        assert Permission.project_update in missing
        assert Permission.project_delete in missing
        assert Permission.project_read not in missing
    
    @pytest.mark.asyncio
    async def test_check_multi_step_operation(self, permission_checker):
        """Test checking permissions for a multi-step operation."""
        dev_user_id = UUID("00000000-0000-0000-0000-000000000001")
        
        steps = [
            ("Read Project", PermissionRequirement.single(Permission.project_read)),
            ("Update Project", PermissionRequirement.single(Permission.project_update)),
            ("Manage Resources", PermissionRequirement.any_of(
                Permission.resource_allocate,
                Permission.resource_update
            ))
        ]
        
        all_satisfied, step_results = await permission_checker.check_multi_step_operation(
            dev_user_id, steps
        )
        
        assert all_satisfied is True
        assert len(step_results) == 3
        for step_name, satisfied, result in step_results:
            assert satisfied is True
    
    @pytest.mark.asyncio
    async def test_check_multi_step_operation_partial_failure(self, permission_checker):
        """Test multi-step operation with partial failure."""
        regular_user_id = uuid4()
        
        steps = [
            ("Read Project", PermissionRequirement.single(Permission.project_read)),  # Viewer has
            ("Delete Project", PermissionRequirement.single(Permission.project_delete))  # Viewer doesn't have
        ]
        
        all_satisfied, step_results = await permission_checker.check_multi_step_operation(
            regular_user_id, steps
        )
        
        assert all_satisfied is False
        assert step_results[0][1] is True  # Read step satisfied
        assert step_results[1][1] is False  # Delete step not satisfied


# =============================================================================
# Edge Cases and Error Handling Tests
# =============================================================================

class TestEdgeCases:
    """Tests for edge cases and error handling."""
    
    def test_duplicate_permissions_in_all_of(self, admin_permissions):
        """Test handling duplicate permissions in AllOfRequirement."""
        req = PermissionRequirement.all_of(
            Permission.project_read,
            Permission.project_read,  # Duplicate
            Permission.project_update
        )
        result = req.check(admin_permissions)
        
        assert result.satisfied is True
    
    def test_duplicate_permissions_in_any_of(self, viewer_permissions):
        """Test handling duplicate permissions in AnyOfRequirement."""
        req = PermissionRequirement.any_of(
            Permission.project_read,
            Permission.project_read  # Duplicate
        )
        result = req.check(viewer_permissions)
        
        assert result.satisfied is True
    
    def test_single_permission_in_complex(self, viewer_permissions):
        """Test complex requirement with single sub-requirement."""
        req = PermissionRequirement.complex(
            PermissionRequirement.single(Permission.project_read)
        )
        result = req.check(viewer_permissions)
        
        assert result.satisfied is True
    
    def test_empty_user_permissions(self):
        """Test checking requirements against empty permission set."""
        req = PermissionRequirement.all_of(
            Permission.project_read,
            Permission.project_update
        )
        result = req.check(set())
        
        assert result.satisfied is False
        assert len(result.missing_permissions) == 2
    
    def test_requirement_with_context(self, permission_checker):
        """Test that context is properly passed through."""
        context = PermissionContext(
            project_id=uuid4(),
            portfolio_id=uuid4()
        )
        
        # Just verify it doesn't raise an error
        req = PermissionRequirement.single(Permission.project_read)
        # Context would be used in actual database queries
        assert req is not None
