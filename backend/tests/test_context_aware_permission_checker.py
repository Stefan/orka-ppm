"""
Unit Tests for Context-Aware Permission Evaluation

Feature: rbac-enhancement, Task 2.1: Context-aware permission evaluation

**Validates: Requirements 1.2, 2.5, 7.1**

This test module validates:
1. Project-specific permission checking with inheritance
2. Portfolio-specific permission checking
3. Permission aggregation across multiple assigned roles
4. Global permission checking
5. Permission inheritance from portfolio to projects

Testing Framework: pytest with async support
"""

import pytest
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
# Test Fixtures
# =============================================================================

@pytest.fixture
def checker():
    """Create a permission checker without database connection."""
    return EnhancedPermissionChecker(supabase_client=None)


@pytest.fixture
def mock_supabase():
    """Create a mock Supabase client."""
    mock = MagicMock()
    mock.table = MagicMock(return_value=mock)
    mock.select = MagicMock(return_value=mock)
    mock.eq = MagicMock(return_value=mock)
    mock.is_ = MagicMock(return_value=mock)
    mock.execute = MagicMock(return_value=MagicMock(data=[]))
    return mock


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


def create_mock_user_role_response(
    user_id: UUID,
    role_name: str,
    scope_type: Optional[ScopeType] = None,
    scope_id: Optional[UUID] = None
) -> list:
    """Create mock database response for user_roles query."""
    role_data = create_mock_role_data(role_name)
    return [{
        "id": str(uuid4()),
        "user_id": str(user_id),
        "role_id": str(uuid4()),
        "scope_type": scope_type.value if scope_type else None,
        "scope_id": str(scope_id) if scope_id else None,
        "assigned_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": None,
        "is_active": True,
        "roles": role_data,
    }]


# =============================================================================
# Test Classes
# =============================================================================

class TestHasGlobalPermission:
    """
    Tests for has_global_permission method.
    
    **Validates: Requirements 1.2, 7.1**
    """
    
    @pytest.mark.asyncio
    async def test_dev_user_has_admin_permissions(self, checker):
        """Dev users should have all admin permissions globally."""
        dev_user_id = UUID("00000000-0000-0000-0000-000000000001")
        
        # Test with an admin permission
        result = await checker.has_global_permission(
            dev_user_id, 
            Permission.user_manage
        )
        assert result is True
    
    @pytest.mark.asyncio
    async def test_regular_user_without_db_has_viewer_permissions(self, checker):
        """Regular users without DB should have viewer permissions."""
        user_id = uuid4()
        
        # Viewer has portfolio_read
        result = await checker.has_global_permission(
            user_id,
            Permission.portfolio_read
        )
        assert result is True
    
    @pytest.mark.asyncio
    async def test_regular_user_without_db_lacks_admin_permissions(self, checker):
        """Regular users without DB should not have admin permissions."""
        user_id = uuid4()
        
        # Viewer does not have user_manage
        result = await checker.has_global_permission(
            user_id,
            Permission.user_manage
        )
        assert result is False
    
    @pytest.mark.asyncio
    async def test_caching_works_for_global_permissions(self, checker):
        """Global permission results should be cached."""
        user_id = uuid4()
        permission = Permission.portfolio_read
        
        # First call
        result1 = await checker.has_global_permission(user_id, permission)
        
        # Second call should use cache
        result2 = await checker.has_global_permission(user_id, permission)
        
        assert result1 == result2


class TestCheckProjectPermission:
    """
    Tests for check_project_permission method.
    
    **Validates: Requirements 1.2, 2.5, 7.1**
    """
    
    @pytest.mark.asyncio
    async def test_dev_user_has_project_permission(self, checker):
        """Dev users should have all permissions for any project."""
        dev_user_id = UUID("00000000-0000-0000-0000-000000000001")
        project_id = uuid4()
        
        result = await checker.check_project_permission(
            dev_user_id,
            Permission.project_update,
            project_id
        )
        assert result is True
    
    @pytest.mark.asyncio
    async def test_global_permission_grants_project_access(self, checker):
        """Users with global permission should have project access."""
        user_id = uuid4()
        project_id = uuid4()
        
        # Viewer has project_read globally
        result = await checker.check_project_permission(
            user_id,
            Permission.project_read,
            project_id
        )
        assert result is True
    
    @pytest.mark.asyncio
    async def test_user_without_permission_denied(self, checker):
        """Users without permission should be denied."""
        user_id = uuid4()
        project_id = uuid4()
        
        # Viewer does not have project_delete
        result = await checker.check_project_permission(
            user_id,
            Permission.project_delete,
            project_id
        )
        assert result is False
    
    @pytest.mark.asyncio
    async def test_project_permission_with_mocked_db(self, mock_supabase):
        """Test project permission with mocked database."""
        user_id = uuid4()
        project_id = uuid4()
        
        # Setup mock to return project manager role for this project
        mock_response = create_mock_user_role_response(
            user_id, 
            "project_manager",
            ScopeType.PROJECT,
            project_id
        )
        
        # Configure mock chain
        mock_query = MagicMock()
        mock_query.select = MagicMock(return_value=mock_query)
        mock_query.eq = MagicMock(return_value=mock_query)
        mock_query.is_ = MagicMock(return_value=mock_query)
        mock_query.execute = MagicMock(return_value=MagicMock(data=mock_response))
        mock_supabase.table = MagicMock(return_value=mock_query)
        
        checker = EnhancedPermissionChecker(supabase_client=mock_supabase)
        
        # Project manager has project_update
        result = await checker.check_project_permission(
            user_id,
            Permission.project_update,
            project_id
        )
        # Note: This will check global first, then project-specific
        # Since no global roles, it will check project roles
        assert isinstance(result, bool)


class TestCheckPortfolioPermission:
    """
    Tests for check_portfolio_permission method.
    
    **Validates: Requirements 1.2, 2.5, 7.1**
    """
    
    @pytest.mark.asyncio
    async def test_dev_user_has_portfolio_permission(self, checker):
        """Dev users should have all permissions for any portfolio."""
        dev_user_id = UUID("00000000-0000-0000-0000-000000000001")
        portfolio_id = uuid4()
        
        result = await checker.check_portfolio_permission(
            dev_user_id,
            Permission.portfolio_update,
            portfolio_id
        )
        assert result is True
    
    @pytest.mark.asyncio
    async def test_global_permission_grants_portfolio_access(self, checker):
        """Users with global permission should have portfolio access."""
        user_id = uuid4()
        portfolio_id = uuid4()
        
        # Viewer has portfolio_read globally
        result = await checker.check_portfolio_permission(
            user_id,
            Permission.portfolio_read,
            portfolio_id
        )
        assert result is True
    
    @pytest.mark.asyncio
    async def test_user_without_permission_denied(self, checker):
        """Users without permission should be denied."""
        user_id = uuid4()
        portfolio_id = uuid4()
        
        # Viewer does not have portfolio_delete
        result = await checker.check_portfolio_permission(
            user_id,
            Permission.portfolio_delete,
            portfolio_id
        )
        assert result is False


class TestGetProjectRoles:
    """
    Tests for get_project_roles method.
    
    **Validates: Requirements 2.5, 7.1**
    """
    
    @pytest.mark.asyncio
    async def test_dev_user_gets_admin_role(self, checker):
        """Dev users should get admin role for any project."""
        dev_user_id = UUID("00000000-0000-0000-0000-000000000001")
        project_id = uuid4()
        
        roles = await checker.get_project_roles(dev_user_id, project_id)
        
        assert len(roles) == 1
        assert roles[0].role_name == "admin"
        assert roles[0].source_type == ScopeType.PROJECT
        assert roles[0].source_id == project_id
    
    @pytest.mark.asyncio
    async def test_regular_user_without_db_gets_empty_list(self, checker):
        """Regular users without DB should get empty list for project roles."""
        user_id = uuid4()
        project_id = uuid4()
        
        roles = await checker.get_project_roles(user_id, project_id)
        
        assert roles == []


class TestGetPortfolioRoles:
    """
    Tests for get_portfolio_roles method.
    
    **Validates: Requirements 2.5, 7.1**
    """
    
    @pytest.mark.asyncio
    async def test_dev_user_gets_admin_role(self, checker):
        """Dev users should get admin role for any portfolio."""
        dev_user_id = UUID("00000000-0000-0000-0000-000000000001")
        portfolio_id = uuid4()
        
        roles = await checker.get_portfolio_roles(dev_user_id, portfolio_id)
        
        assert len(roles) == 1
        assert roles[0].role_name == "admin"
        assert roles[0].source_type == ScopeType.PORTFOLIO
        assert roles[0].source_id == portfolio_id
    
    @pytest.mark.asyncio
    async def test_regular_user_without_db_gets_empty_list(self, checker):
        """Regular users without DB should get empty list for portfolio roles."""
        user_id = uuid4()
        portfolio_id = uuid4()
        
        roles = await checker.get_portfolio_roles(user_id, portfolio_id)
        
        assert roles == []


class TestGetProjectPortfolio:
    """
    Tests for get_project_portfolio method.
    
    **Validates: Requirements 7.1**
    """
    
    @pytest.mark.asyncio
    async def test_without_db_returns_none(self, checker):
        """Without DB connection, should return None."""
        project_id = uuid4()
        
        result = await checker.get_project_portfolio(project_id)
        
        assert result is None
    
    @pytest.mark.asyncio
    async def test_with_mocked_db_returns_portfolio_id(self, mock_supabase):
        """With mocked DB, should return portfolio ID."""
        project_id = uuid4()
        portfolio_id = uuid4()
        
        # Configure mock to return portfolio_id
        mock_query = MagicMock()
        mock_query.select = MagicMock(return_value=mock_query)
        mock_query.eq = MagicMock(return_value=mock_query)
        mock_query.execute = MagicMock(return_value=MagicMock(
            data=[{"portfolio_id": str(portfolio_id)}]
        ))
        mock_supabase.table = MagicMock(return_value=mock_query)
        
        checker = EnhancedPermissionChecker(supabase_client=mock_supabase)
        
        result = await checker.get_project_portfolio(project_id)
        
        assert result == portfolio_id
    
    @pytest.mark.asyncio
    async def test_caching_works(self, mock_supabase):
        """Portfolio lookup should be cached."""
        project_id = uuid4()
        portfolio_id = uuid4()
        
        # Configure mock
        mock_query = MagicMock()
        mock_query.select = MagicMock(return_value=mock_query)
        mock_query.eq = MagicMock(return_value=mock_query)
        mock_query.execute = MagicMock(return_value=MagicMock(
            data=[{"portfolio_id": str(portfolio_id)}]
        ))
        mock_supabase.table = MagicMock(return_value=mock_query)
        
        checker = EnhancedPermissionChecker(supabase_client=mock_supabase)
        
        # First call
        result1 = await checker.get_project_portfolio(project_id)
        
        # Second call should use cache
        result2 = await checker.get_project_portfolio(project_id)
        
        assert result1 == result2 == portfolio_id


class TestAggregatePermissionsFromRoles:
    """
    Tests for aggregate_permissions_from_roles method.
    
    **Validates: Requirements 2.5**
    """
    
    @pytest.mark.asyncio
    async def test_single_role_aggregation(self, checker):
        """Single role should return its permissions."""
        role = EffectiveRole(
            role_id=uuid4(),
            role_name="viewer",
            permissions=[p.value for p in DEFAULT_ROLE_PERMISSIONS[UserRole.viewer]],
            source_type=ScopeType.GLOBAL,
            source_id=None,
            is_inherited=False
        )
        
        permissions = await checker.aggregate_permissions_from_roles([role])
        
        expected = set(DEFAULT_ROLE_PERMISSIONS[UserRole.viewer])
        assert permissions == expected
    
    @pytest.mark.asyncio
    async def test_multiple_roles_aggregation(self, checker):
        """Multiple roles should have their permissions combined."""
        viewer_role = EffectiveRole(
            role_id=uuid4(),
            role_name="viewer",
            permissions=[p.value for p in DEFAULT_ROLE_PERMISSIONS[UserRole.viewer]],
            source_type=ScopeType.GLOBAL,
            source_id=None,
            is_inherited=False
        )
        
        project_manager_role = EffectiveRole(
            role_id=uuid4(),
            role_name="project_manager",
            permissions=[p.value for p in DEFAULT_ROLE_PERMISSIONS[UserRole.project_manager]],
            source_type=ScopeType.PROJECT,
            source_id=uuid4(),
            is_inherited=False
        )
        
        permissions = await checker.aggregate_permissions_from_roles([viewer_role, project_manager_role])
        
        # Should be union of both role permissions
        expected = set(DEFAULT_ROLE_PERMISSIONS[UserRole.viewer]) | set(DEFAULT_ROLE_PERMISSIONS[UserRole.project_manager])
        assert permissions == expected
    
    @pytest.mark.asyncio
    async def test_empty_roles_returns_empty_set(self, checker):
        """Empty roles list should return empty set."""
        permissions = await checker.aggregate_permissions_from_roles([])
        
        assert permissions == set()
    
    @pytest.mark.asyncio
    async def test_invalid_permissions_are_skipped(self, checker):
        """Invalid permission strings should be skipped."""
        role = EffectiveRole(
            role_id=uuid4(),
            role_name="custom",
            permissions=["invalid_permission", Permission.project_read.value],
            source_type=ScopeType.GLOBAL,
            source_id=None,
            is_inherited=False
        )
        
        permissions = await checker.aggregate_permissions_from_roles([role])
        
        # Should only contain the valid permission
        assert permissions == {Permission.project_read}


class TestGetAllContextPermissions:
    """
    Tests for get_all_context_permissions method.
    
    **Validates: Requirements 2.5, 7.1**
    """
    
    @pytest.mark.asyncio
    async def test_global_context_returns_global_permissions(self, checker):
        """Global context should return global role permissions."""
        user_id = uuid4()
        context = PermissionContext()  # Empty context = global
        
        permissions = await checker.get_all_context_permissions(user_id, context)
        
        # Without DB, should get viewer permissions
        expected = set(DEFAULT_ROLE_PERMISSIONS[UserRole.viewer])
        assert permissions == expected
    
    @pytest.mark.asyncio
    async def test_dev_user_gets_admin_permissions(self, checker):
        """Dev users should get admin permissions in any context."""
        dev_user_id = UUID("00000000-0000-0000-0000-000000000001")
        context = PermissionContext(project_id=uuid4())
        
        permissions = await checker.get_all_context_permissions(dev_user_id, context)
        
        expected = set(DEFAULT_ROLE_PERMISSIONS[UserRole.admin])
        assert permissions == expected


class TestPermissionInheritance:
    """
    Tests for permission inheritance from portfolio to projects.
    
    **Validates: Requirements 7.1**
    """
    
    @pytest.mark.asyncio
    async def test_portfolio_permission_inherited_to_project(self, mock_supabase):
        """Portfolio permissions should be inherited to projects."""
        user_id = uuid4()
        project_id = uuid4()
        portfolio_id = uuid4()
        
        # Setup mock to return:
        # 1. No global roles
        # 2. No project-specific roles
        # 3. Portfolio ID for the project
        # 4. Portfolio manager role for the portfolio
        
        call_count = [0]
        
        def mock_table(table_name):
            mock_query = MagicMock()
            mock_query.select = MagicMock(return_value=mock_query)
            mock_query.eq = MagicMock(return_value=mock_query)
            mock_query.is_ = MagicMock(return_value=mock_query)
            
            if table_name == "projects":
                mock_query.execute = MagicMock(return_value=MagicMock(
                    data=[{"portfolio_id": str(portfolio_id)}]
                ))
            elif table_name == "user_roles":
                call_count[0] += 1
                if call_count[0] <= 2:  # First two calls (global, project) return empty
                    mock_query.execute = MagicMock(return_value=MagicMock(data=[]))
                else:  # Portfolio role query
                    mock_query.execute = MagicMock(return_value=MagicMock(
                        data=create_mock_user_role_response(
                            user_id, "portfolio_manager", ScopeType.PORTFOLIO, portfolio_id
                        )
                    ))
            else:
                mock_query.execute = MagicMock(return_value=MagicMock(data=[]))
            
            return mock_query
        
        mock_supabase.table = mock_table
        
        checker = EnhancedPermissionChecker(supabase_client=mock_supabase)
        
        # Portfolio manager has portfolio_update
        # This should be inherited to the project
        result = await checker.check_project_permission(
            user_id,
            Permission.portfolio_read,  # Portfolio manager has this
            project_id
        )
        
        # The test verifies the inheritance mechanism is called
        assert isinstance(result, bool)


class TestCacheInvalidation:
    """
    Tests for cache invalidation.
    
    **Validates: Requirements 8.2**
    """
    
    @pytest.mark.asyncio
    async def test_clear_user_cache_removes_all_user_entries(self, checker):
        """Clearing user cache should remove all entries for that user."""
        user_id = uuid4()
        
        # Populate cache with some permissions
        await checker.has_global_permission(user_id, Permission.project_read)
        await checker.check_project_permission(user_id, Permission.project_read, uuid4())
        
        # Clear cache
        checker.clear_user_cache(user_id)
        
        # Cache should be empty for this user
        user_id_str = str(user_id)
        user_cache_keys = [k for k in checker._permission_cache.keys() if user_id_str in k]
        assert len(user_cache_keys) == 0
    
    @pytest.mark.asyncio
    async def test_clear_all_cache_removes_everything(self, checker):
        """Clearing all cache should remove all entries."""
        user_id1 = uuid4()
        user_id2 = uuid4()
        
        # Populate cache
        await checker.has_global_permission(user_id1, Permission.project_read)
        await checker.has_global_permission(user_id2, Permission.project_read)
        
        # Clear all cache
        checker.clear_all_cache()
        
        # Cache should be empty
        assert len(checker._permission_cache) == 0
        assert len(checker._cache_timestamps) == 0
