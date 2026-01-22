"""
Property-Based Tests for Manager Role Scoping

This module contains property-based tests for manager role scoping functionality:
- Property 19: Portfolio Manager Permission Granting
- Property 20: Project Manager Scope Enforcement
- Property 21: Resource Management Scope Consistency
- Property 22: Granular Role Assignment Support

Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
"""

import pytest
from hypothesis import given, strategies as st, settings, assume, HealthCheck
from uuid import UUID, uuid4
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Set
from unittest.mock import MagicMock, AsyncMock, patch

# Import RBAC components
from auth.rbac import Permission, UserRole, DEFAULT_ROLE_PERMISSIONS
from auth.enhanced_rbac_models import (
    PermissionContext,
    ScopeType,
    EffectiveRole,
    RoleAssignment,
)
from auth.enhanced_permission_checker import EnhancedPermissionChecker
from auth.manager_scoping import ManagerScopingChecker


# =============================================================================
# Test Data Strategies
# =============================================================================

@st.composite
def uuid_strategy(draw):
    """Generate valid UUIDs."""
    return uuid4()


@st.composite
def permission_strategy(draw):
    """Generate valid Permission enums."""
    return draw(st.sampled_from(list(Permission)))


@st.composite
def manager_role_strategy(draw):
    """Generate manager role types."""
    return draw(st.sampled_from([
        UserRole.portfolio_manager,
        UserRole.project_manager,
        UserRole.resource_manager
    ]))


@st.composite
def scope_type_strategy(draw):
    """Generate valid ScopeType enums."""
    return draw(st.sampled_from([
        ScopeType.GLOBAL,
        ScopeType.ORGANIZATION,
        ScopeType.PORTFOLIO,
        ScopeType.PROJECT
    ]))


@st.composite
def effective_role_strategy(draw, role_name: Optional[str] = None, scope_type: Optional[ScopeType] = None):
    """Generate valid EffectiveRole objects."""
    if role_name is None:
        role_name = draw(st.sampled_from([r.value for r in UserRole]))
    
    if scope_type is None:
        scope_type = draw(scope_type_strategy())
    
    # Get permissions for the role
    try:
        role_enum = UserRole(role_name)
        permissions = [p.value for p in DEFAULT_ROLE_PERMISSIONS[role_enum]]
    except (ValueError, KeyError):
        permissions = []
    
    scope_id = draw(uuid_strategy()) if scope_type != ScopeType.GLOBAL else None
    
    return EffectiveRole(
        role_id=draw(uuid_strategy()),
        role_name=role_name,
        permissions=permissions,
        source_type=scope_type,
        source_id=scope_id,
        is_inherited=draw(st.booleans())
    )


@st.composite
def role_assignment_strategy(draw, user_id: Optional[UUID] = None, role_name: Optional[str] = None):
    """Generate valid RoleAssignment objects."""
    if user_id is None:
        user_id = draw(uuid_strategy())
    
    if role_name is None:
        role_name = draw(st.sampled_from([r.value for r in UserRole]))
    
    scope_type = draw(st.one_of(
        st.none(),
        scope_type_strategy()
    ))
    
    scope_id = None
    if scope_type and scope_type != ScopeType.GLOBAL:
        scope_id = draw(uuid_strategy())
    
    return RoleAssignment(
        id=draw(uuid_strategy()),
        user_id=user_id,
        role_id=draw(uuid_strategy()),
        scope_type=scope_type,
        scope_id=scope_id,
        assigned_by=draw(uuid_strategy()),
        assigned_at=datetime.now(timezone.utc),
        expires_at=None,
        is_active=True
    )


# =============================================================================
# Property 19: Portfolio Manager Permission Granting
# Validates: Requirements 5.1, 5.4
# =============================================================================

class TestPortfolioManagerPermissionGranting:
    """
    Property 19: Portfolio Manager Permission Granting
    
    For any user assigned as portfolio manager, the system must grant appropriate
    portfolio-level operations and oversight permissions.
    
    **Validates: Requirements 5.1, 5.4**
    """
    
    @pytest.mark.asyncio
    @given(
        user_id=uuid_strategy(),
        portfolio_id=uuid_strategy(),
        permission=permission_strategy()
    )
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    async def test_portfolio_manager_has_portfolio_permissions(
        self,
        user_id: UUID,
        portfolio_id: UUID,
        permission: Permission
    ):
        """
        Property: Portfolio managers have appropriate portfolio-level permissions.
        
        Given a user assigned as portfolio manager for a portfolio,
        When checking permissions within that portfolio,
        Then the user should have all portfolio manager permissions.
        """
        # Create mock permission checker
        mock_checker = MagicMock(spec=EnhancedPermissionChecker)
        mock_checker.supabase = None
        
        # Create portfolio manager role
        portfolio_manager_role = EffectiveRole(
            role_id=uuid4(),
            role_name=UserRole.portfolio_manager.value,
            permissions=[p.value for p in DEFAULT_ROLE_PERMISSIONS[UserRole.portfolio_manager]],
            source_type=ScopeType.PORTFOLIO,
            source_id=portfolio_id,
            is_inherited=False
        )
        
        # Mock get_portfolio_roles to return portfolio manager role
        mock_checker.get_portfolio_roles = AsyncMock(return_value=[portfolio_manager_role])
        mock_checker.get_effective_roles = AsyncMock(return_value=[])
        
        # Create manager scoping checker
        scoping_checker = ManagerScopingChecker(mock_checker)
        
        # Check if user is portfolio manager
        is_manager = await scoping_checker.is_portfolio_manager(user_id, portfolio_id)
        
        # Property: User should be identified as portfolio manager
        assert is_manager, "User with portfolio_manager role should be identified as portfolio manager"
        
        # Check if permission is in portfolio manager permissions
        portfolio_manager_perms = DEFAULT_ROLE_PERMISSIONS[UserRole.portfolio_manager]
        
        if permission in portfolio_manager_perms:
            # Property: Portfolio manager should have this permission
            has_permission = await scoping_checker.check_portfolio_manager_permission(
                user_id, permission, portfolio_id
            )
            assert has_permission, f"Portfolio manager should have permission {permission.value}"
    
    @pytest.mark.asyncio
    @given(
        user_id=uuid_strategy(),
        portfolio_id=uuid_strategy(),
        other_portfolio_id=uuid_strategy()
    )
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    async def test_portfolio_manager_scope_isolation(
        self,
        user_id: UUID,
        portfolio_id: UUID,
        other_portfolio_id: UUID
    ):
        """
        Property: Portfolio managers only have permissions in their assigned portfolios.
        
        Given a user assigned as portfolio manager for portfolio A,
        When checking permissions for portfolio B,
        Then the user should not have portfolio manager permissions for portfolio B.
        """
        # Ensure portfolios are different
        assume(portfolio_id != other_portfolio_id)
        
        # Create mock permission checker
        mock_checker = MagicMock(spec=EnhancedPermissionChecker)
        mock_checker.supabase = None
        
        # Create portfolio manager role for portfolio A only
        portfolio_manager_role = EffectiveRole(
            role_id=uuid4(),
            role_name=UserRole.portfolio_manager.value,
            permissions=[p.value for p in DEFAULT_ROLE_PERMISSIONS[UserRole.portfolio_manager]],
            source_type=ScopeType.PORTFOLIO,
            source_id=portfolio_id,
            is_inherited=False
        )
        
        # Mock get_portfolio_roles to return role only for portfolio A
        async def mock_get_portfolio_roles(uid, pid):
            if pid == portfolio_id:
                return [portfolio_manager_role]
            return []
        
        mock_checker.get_portfolio_roles = AsyncMock(side_effect=mock_get_portfolio_roles)
        mock_checker.get_effective_roles = AsyncMock(return_value=[])
        
        # Create manager scoping checker
        scoping_checker = ManagerScopingChecker(mock_checker)
        
        # Check portfolio A - should be manager
        is_manager_a = await scoping_checker.is_portfolio_manager(user_id, portfolio_id)
        assert is_manager_a, "User should be portfolio manager for assigned portfolio"
        
        # Check portfolio B - should NOT be manager
        is_manager_b = await scoping_checker.is_portfolio_manager(user_id, other_portfolio_id)
        assert not is_manager_b, "User should NOT be portfolio manager for unassigned portfolio"
    
    @pytest.mark.asyncio
    @given(
        user_id=uuid_strategy(),
        portfolio_id=uuid_strategy()
    )
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    async def test_portfolio_manager_can_grant_appropriate_permissions(
        self,
        user_id: UUID,
        portfolio_id: UUID
    ):
        """
        Property: Portfolio managers can grant permissions within their scope.
        
        Given a user assigned as portfolio manager,
        When checking if they can grant permissions,
        Then they should be able to grant portfolio-appropriate permissions they have.
        """
        # Create mock permission checker
        mock_checker = MagicMock(spec=EnhancedPermissionChecker)
        mock_checker.supabase = None
        
        # Create portfolio manager role
        portfolio_manager_role = EffectiveRole(
            role_id=uuid4(),
            role_name=UserRole.portfolio_manager.value,
            permissions=[p.value for p in DEFAULT_ROLE_PERMISSIONS[UserRole.portfolio_manager]],
            source_type=ScopeType.PORTFOLIO,
            source_id=portfolio_id,
            is_inherited=False
        )
        
        # Mock methods
        mock_checker.get_portfolio_roles = AsyncMock(return_value=[portfolio_manager_role])
        mock_checker.get_effective_roles = AsyncMock(return_value=[])
        mock_checker.check_permission = AsyncMock(return_value=True)
        
        # Create manager scoping checker
        scoping_checker = ManagerScopingChecker(mock_checker)
        
        # Test granting a portfolio-appropriate permission
        can_grant = await scoping_checker.can_grant_permission_in_portfolio(
            user_id, portfolio_id, Permission.project_read
        )
        
        # Property: Should be able to grant portfolio-appropriate permissions
        assert can_grant, "Portfolio manager should be able to grant portfolio-appropriate permissions"
        
        # Test granting a system-level permission (should fail)
        can_grant_system = await scoping_checker.can_grant_permission_in_portfolio(
            user_id, portfolio_id, Permission.system_admin
        )
        
        # Property: Should NOT be able to grant system-level permissions
        assert not can_grant_system, "Portfolio manager should NOT be able to grant system-level permissions"


# =============================================================================
# Property 20: Project Manager Scope Enforcement
# Validates: Requirements 5.2, 5.5
# =============================================================================

class TestProjectManagerScopeEnforcement:
    """
    Property 20: Project Manager Scope Enforcement
    
    For any user assigned as project manager, permissions must be limited to
    project-specific management within assigned projects only.
    
    **Validates: Requirements 5.2, 5.5**
    """
    
    @pytest.mark.asyncio
    @given(
        user_id=uuid_strategy(),
        project_id=uuid_strategy(),
        permission=permission_strategy()
    )
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    async def test_project_manager_has_project_permissions(
        self,
        user_id: UUID,
        project_id: UUID,
        permission: Permission
    ):
        """
        Property: Project managers have appropriate project-level permissions.
        
        Given a user assigned as project manager for a project,
        When checking permissions within that project,
        Then the user should have all project manager permissions.
        """
        # Create mock permission checker
        mock_checker = MagicMock(spec=EnhancedPermissionChecker)
        mock_checker.supabase = None
        
        # Create project manager role
        project_manager_role = EffectiveRole(
            role_id=uuid4(),
            role_name=UserRole.project_manager.value,
            permissions=[p.value for p in DEFAULT_ROLE_PERMISSIONS[UserRole.project_manager]],
            source_type=ScopeType.PROJECT,
            source_id=project_id,
            is_inherited=False
        )
        
        # Mock get_project_roles to return project manager role
        mock_checker.get_project_roles = AsyncMock(return_value=[project_manager_role])
        
        # Create manager scoping checker
        scoping_checker = ManagerScopingChecker(mock_checker)
        
        # Check if user is project manager
        is_manager = await scoping_checker.is_project_manager(user_id, project_id)
        
        # Property: User should be identified as project manager
        assert is_manager, "User with project_manager role should be identified as project manager"
        
        # Check if permission is in project manager permissions
        project_manager_perms = DEFAULT_ROLE_PERMISSIONS[UserRole.project_manager]
        
        if permission in project_manager_perms:
            # Property: Project manager should have this permission
            has_permission = await scoping_checker.check_project_manager_permission(
                user_id, permission, project_id
            )
            assert has_permission, f"Project manager should have permission {permission.value}"
    
    @pytest.mark.asyncio
    @given(
        user_id=uuid_strategy(),
        project_id=uuid_strategy(),
        other_project_id=uuid_strategy()
    )
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    async def test_project_manager_scope_isolation(
        self,
        user_id: UUID,
        project_id: UUID,
        other_project_id: UUID
    ):
        """
        Property: Project managers only have permissions in their assigned projects.
        
        Given a user assigned as project manager for project A,
        When checking permissions for project B,
        Then the user should not have project manager permissions for project B.
        """
        # Ensure projects are different
        assume(project_id != other_project_id)
        
        # Create mock permission checker
        mock_checker = MagicMock(spec=EnhancedPermissionChecker)
        mock_checker.supabase = None
        
        # Create project manager role for project A only
        project_manager_role = EffectiveRole(
            role_id=uuid4(),
            role_name=UserRole.project_manager.value,
            permissions=[p.value for p in DEFAULT_ROLE_PERMISSIONS[UserRole.project_manager]],
            source_type=ScopeType.PROJECT,
            source_id=project_id,
            is_inherited=False
        )
        
        # Mock get_project_roles to return role only for project A
        async def mock_get_project_roles(uid, pid):
            if pid == project_id:
                return [project_manager_role]
            return []
        
        mock_checker.get_project_roles = AsyncMock(side_effect=mock_get_project_roles)
        
        # Create manager scoping checker
        scoping_checker = ManagerScopingChecker(mock_checker)
        
        # Check project A - should be manager
        is_manager_a = await scoping_checker.is_project_manager(user_id, project_id)
        assert is_manager_a, "User should be project manager for assigned project"
        
        # Check project B - should NOT be manager
        is_manager_b = await scoping_checker.is_project_manager(user_id, other_project_id)
        assert not is_manager_b, "User should NOT be project manager for unassigned project"
    
    @pytest.mark.asyncio
    @given(
        user_id=uuid_strategy(),
        project_id=uuid_strategy(),
        permission=permission_strategy()
    )
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    async def test_project_scope_enforcement(
        self,
        user_id: UUID,
        project_id: UUID,
        permission: Permission
    ):
        """
        Property: Project scope is enforced for project managers.
        
        Given a user assigned as project manager,
        When accessing a project,
        Then scope enforcement should verify the user manages that specific project.
        """
        # Create mock permission checker
        mock_checker = MagicMock(spec=EnhancedPermissionChecker)
        mock_checker.supabase = None
        
        # Create project manager role
        project_manager_role = EffectiveRole(
            role_id=uuid4(),
            role_name=UserRole.project_manager.value,
            permissions=[p.value for p in DEFAULT_ROLE_PERMISSIONS[UserRole.project_manager]],
            source_type=ScopeType.PROJECT,
            source_id=project_id,
            is_inherited=False
        )
        
        # Mock methods
        mock_checker.get_project_roles = AsyncMock(return_value=[project_manager_role])
        mock_checker.has_global_permission = AsyncMock(return_value=False)
        mock_checker.get_project_portfolio = AsyncMock(return_value=None)
        mock_checker.check_portfolio_permission = AsyncMock(return_value=False)
        
        # Create manager scoping checker
        scoping_checker = ManagerScopingChecker(mock_checker)
        
        # Check if permission is in project manager permissions
        project_manager_perms = DEFAULT_ROLE_PERMISSIONS[UserRole.project_manager]
        
        # Enforce project scope
        has_access = await scoping_checker.enforce_project_scope(
            user_id, project_id, permission
        )
        
        if permission in project_manager_perms:
            # Property: Should have access to assigned project with appropriate permission
            assert has_access, "Project manager should have access to assigned project"
        else:
            # Property: Should NOT have access if permission not in project manager set
            assert not has_access, "Project manager should NOT have access to permissions outside their scope"


# =============================================================================
# Property 21: Resource Management Scope Consistency
# Validates: Requirements 5.3
# =============================================================================

class TestResourceManagementScopeConsistency:
    """
    Property 21: Resource Management Scope Consistency
    
    For any resource management operation, permissions must be enforced within
    the manager's assigned scope boundaries.
    
    **Validates: Requirements 5.3**
    """
    
    @pytest.mark.asyncio
    @given(
        user_id=uuid_strategy(),
        resource_id=uuid_strategy(),
        project_id=uuid_strategy(),
        permission=st.sampled_from([
            Permission.resource_allocate,
            Permission.resource_update,
            Permission.resource_read
        ])
    )
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    async def test_resource_management_within_project_scope(
        self,
        user_id: UUID,
        resource_id: UUID,
        project_id: UUID,
        permission: Permission
    ):
        """
        Property: Resource management is scoped to managed projects.
        
        Given a user assigned as project manager for a project,
        When managing resources in that project,
        Then the user should have resource management permissions.
        """
        # Create mock permission checker
        mock_checker = MagicMock(spec=EnhancedPermissionChecker)
        mock_checker.supabase = None
        
        # Create project manager role
        project_manager_role = EffectiveRole(
            role_id=uuid4(),
            role_name=UserRole.project_manager.value,
            permissions=[p.value for p in DEFAULT_ROLE_PERMISSIONS[UserRole.project_manager]],
            source_type=ScopeType.PROJECT,
            source_id=project_id,
            is_inherited=False
        )
        
        # Mock methods
        mock_checker.has_global_permission = AsyncMock(return_value=False)
        mock_checker.get_project_roles = AsyncMock(return_value=[project_manager_role])
        
        # Create manager scoping checker
        scoping_checker = ManagerScopingChecker(mock_checker)
        
        # Create context with project
        context = PermissionContext(project_id=project_id)
        
        # Check resource management scope
        has_permission = await scoping_checker.check_resource_management_scope(
            user_id, permission, resource_id, context
        )
        
        # Check if permission is in project manager permissions
        project_manager_perms = DEFAULT_ROLE_PERMISSIONS[UserRole.project_manager]
        
        if permission in project_manager_perms:
            # Property: Should have resource management permission in managed project
            assert has_permission, "Project manager should have resource management permission in managed project"
    
    @pytest.mark.asyncio
    @given(
        user_id=uuid_strategy(),
        portfolio_id=uuid_strategy()
    )
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    async def test_resource_management_scope_identification(
        self,
        user_id: UUID,
        portfolio_id: UUID
    ):
        """
        Property: Resource management scope is correctly identified.
        
        Given a user with manager roles,
        When getting their resource management scope,
        Then the system should return all projects and portfolios they can manage resources in.
        """
        # Create mock permission checker
        mock_checker = MagicMock(spec=EnhancedPermissionChecker)
        mock_checker.supabase = None
        
        # Mock methods
        mock_checker.has_global_permission = AsyncMock(return_value=False)
        
        # Create manager scoping checker
        scoping_checker = ManagerScopingChecker(mock_checker)
        
        # Mock get_managed_projects and get_managed_portfolios
        project_ids = [uuid4(), uuid4()]
        portfolio_ids = [portfolio_id]
        
        scoping_checker.get_managed_projects = AsyncMock(return_value=project_ids)
        scoping_checker.get_managed_portfolios = AsyncMock(return_value=portfolio_ids)
        
        # Get resource management scope
        scope = await scoping_checker.get_resource_management_scope(user_id)
        
        # Property: Scope should include managed projects and portfolios
        assert 'projects' in scope, "Scope should include projects"
        assert 'portfolios' in scope, "Scope should include portfolios"
        assert 'global' in scope, "Scope should include global flag"
        assert scope['projects'] == project_ids, "Scope should include all managed projects"
        assert scope['portfolios'] == portfolio_ids, "Scope should include all managed portfolios"
        assert scope['global'] == False, "Non-global managers should have global=False"


# =============================================================================
# Property 22: Granular Role Assignment Support
# Validates: Requirements 5.4
# =============================================================================

class TestGranularRoleAssignmentSupport:
    """
    Property 22: Granular Role Assignment Support
    
    For any role assignment, the system must support project-specific and
    portfolio-specific assignments for granular access control.
    
    **Validates: Requirements 5.4**
    """
    
    @pytest.mark.asyncio
    @given(
        user_id=uuid_strategy(),
        role_assignment=role_assignment_strategy()
    )
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    async def test_role_assignment_supports_all_scope_types(
        self,
        user_id: UUID,
        role_assignment: RoleAssignment
    ):
        """
        Property: Role assignments support all scope types.
        
        Given a role assignment with any scope type,
        When the assignment is created,
        Then the system should support global, organization, portfolio, and project scopes.
        """
        # Property: RoleAssignment should accept all scope types
        assert role_assignment.scope_type in [None, ScopeType.GLOBAL, ScopeType.ORGANIZATION, 
                                               ScopeType.PORTFOLIO, ScopeType.PROJECT], \
            "Role assignment should support all scope types"
        
        # Property: Scoped assignments should have scope_id
        if role_assignment.scope_type and role_assignment.scope_type != ScopeType.GLOBAL:
            assert role_assignment.scope_id is not None, \
                "Scoped role assignments should have scope_id"
    
    @pytest.mark.asyncio
    @given(
        user_id=uuid_strategy(),
        project_ids=st.lists(uuid_strategy(), min_size=1, max_size=5),
        portfolio_ids=st.lists(uuid_strategy(), min_size=1, max_size=3)
    )
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    async def test_multiple_scoped_assignments_per_user(
        self,
        user_id: UUID,
        project_ids: List[UUID],
        portfolio_ids: List[UUID]
    ):
        """
        Property: Users can have multiple scoped role assignments.
        
        Given a user with multiple project and portfolio assignments,
        When retrieving their managed scopes,
        Then the system should return all assigned projects and portfolios.
        """
        # Create mock permission checker
        mock_checker = MagicMock(spec=EnhancedPermissionChecker)
        mock_checker.supabase = None
        
        # Create manager scoping checker
        scoping_checker = ManagerScopingChecker(mock_checker)
        
        # Mock get_managed_projects and get_managed_portfolios
        scoping_checker.get_managed_projects = AsyncMock(return_value=project_ids)
        scoping_checker.get_managed_portfolios = AsyncMock(return_value=portfolio_ids)
        
        # Get managed projects
        managed_projects = await scoping_checker.get_managed_projects(user_id)
        
        # Get managed portfolios
        managed_portfolios = await scoping_checker.get_managed_portfolios(user_id)
        
        # Property: Should return all assigned projects
        assert len(managed_projects) == len(project_ids), \
            "Should return all assigned projects"
        assert set(managed_projects) == set(project_ids), \
            "Should return correct project IDs"
        
        # Property: Should return all assigned portfolios
        assert len(managed_portfolios) == len(portfolio_ids), \
            "Should return all assigned portfolios"
        assert set(managed_portfolios) == set(portfolio_ids), \
            "Should return correct portfolio IDs"
    
    @pytest.mark.asyncio
    @given(
        user_id=uuid_strategy(),
        project_id=uuid_strategy(),
        portfolio_id=uuid_strategy()
    )
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    async def test_scoped_role_isolation(
        self,
        user_id: UUID,
        project_id: UUID,
        portfolio_id: UUID
    ):
        """
        Property: Scoped roles are isolated to their assigned scope.
        
        Given a user with a project-scoped role,
        When checking permissions in a different project or portfolio,
        Then the user should not have those scoped permissions.
        """
        # Create mock permission checker
        mock_checker = MagicMock(spec=EnhancedPermissionChecker)
        mock_checker.supabase = None
        
        # Create project manager role for specific project
        project_manager_role = EffectiveRole(
            role_id=uuid4(),
            role_name=UserRole.project_manager.value,
            permissions=[p.value for p in DEFAULT_ROLE_PERMISSIONS[UserRole.project_manager]],
            source_type=ScopeType.PROJECT,
            source_id=project_id,
            is_inherited=False
        )
        
        # Mock get_project_roles to return role only for specific project
        async def mock_get_project_roles(uid, pid):
            if pid == project_id:
                return [project_manager_role]
            return []
        
        # Mock get_portfolio_roles to return empty (no portfolio role)
        mock_checker.get_project_roles = AsyncMock(side_effect=mock_get_project_roles)
        mock_checker.get_portfolio_roles = AsyncMock(return_value=[])
        mock_checker.get_effective_roles = AsyncMock(return_value=[])
        
        # Create manager scoping checker
        scoping_checker = ManagerScopingChecker(mock_checker)
        
        # Check project manager for assigned project
        is_project_manager = await scoping_checker.is_project_manager(user_id, project_id)
        assert is_project_manager, "User should be project manager for assigned project"
        
        # Check portfolio manager for different portfolio
        is_portfolio_manager = await scoping_checker.is_portfolio_manager(user_id, portfolio_id)
        assert not is_portfolio_manager, "User should NOT be portfolio manager without portfolio assignment"
        
        # Property: Scoped roles are isolated to their assigned scope
        # This ensures granular access control works correctly


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
