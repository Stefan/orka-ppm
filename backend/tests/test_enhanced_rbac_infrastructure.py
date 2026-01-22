"""
Unit Tests for Enhanced RBAC Infrastructure

Tests for:
- PermissionContext model
- RoleAssignment model
- EnhancedPermissionChecker class

Requirements: 1.1, 1.2, 7.1
"""

import pytest
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from auth.enhanced_rbac_models import (
    ScopeType,
    PermissionContext,
    RoleAssignment,
    RoleAssignmentRequest,
    EffectiveRole,
)
from auth.enhanced_permission_checker import EnhancedPermissionChecker
from auth.rbac import Permission, UserRole, DEFAULT_ROLE_PERMISSIONS


class TestPermissionContext:
    """Tests for the PermissionContext model."""
    
    def test_create_empty_context(self):
        """Test creating an empty (global) context."""
        context = PermissionContext()
        
        assert context.project_id is None
        assert context.portfolio_id is None
        assert context.organization_id is None
        assert context.resource_id is None
        assert context.is_global()
        assert context.get_scope_type() == ScopeType.GLOBAL
    
    def test_create_project_context(self):
        """Test creating a project-scoped context."""
        project_id = uuid4()
        context = PermissionContext(project_id=project_id)
        
        assert context.project_id == project_id
        assert not context.is_global()
        assert context.get_scope_type() == ScopeType.PROJECT
        assert context.get_scope_id() == project_id
    
    def test_create_portfolio_context(self):
        """Test creating a portfolio-scoped context."""
        portfolio_id = uuid4()
        context = PermissionContext(portfolio_id=portfolio_id)
        
        assert context.portfolio_id == portfolio_id
        assert not context.is_global()
        assert context.get_scope_type() == ScopeType.PORTFOLIO
        assert context.get_scope_id() == portfolio_id
    
    def test_create_organization_context(self):
        """Test creating an organization-scoped context."""
        org_id = uuid4()
        context = PermissionContext(organization_id=org_id)
        
        assert context.organization_id == org_id
        assert not context.is_global()
        assert context.get_scope_type() == ScopeType.ORGANIZATION
        assert context.get_scope_id() == org_id
    
    def test_scope_type_priority(self):
        """Test that project scope takes priority over portfolio and organization."""
        project_id = uuid4()
        portfolio_id = uuid4()
        org_id = uuid4()
        
        context = PermissionContext(
            project_id=project_id,
            portfolio_id=portfolio_id,
            organization_id=org_id
        )
        
        # Project should be the most specific scope
        assert context.get_scope_type() == ScopeType.PROJECT
        assert context.get_scope_id() == project_id
    
    def test_portfolio_priority_over_organization(self):
        """Test that portfolio scope takes priority over organization."""
        portfolio_id = uuid4()
        org_id = uuid4()
        
        context = PermissionContext(
            portfolio_id=portfolio_id,
            organization_id=org_id
        )
        
        assert context.get_scope_type() == ScopeType.PORTFOLIO
        assert context.get_scope_id() == portfolio_id
    
    def test_cache_key_generation(self):
        """Test cache key generation for different contexts."""
        # Global context
        global_context = PermissionContext()
        assert global_context.to_cache_key() == "global"
        
        # Project context
        project_id = uuid4()
        project_context = PermissionContext(project_id=project_id)
        assert f"proj:{project_id}" in project_context.to_cache_key()
        
        # Full context
        org_id = uuid4()
        portfolio_id = uuid4()
        full_context = PermissionContext(
            organization_id=org_id,
            portfolio_id=portfolio_id,
            project_id=project_id
        )
        cache_key = full_context.to_cache_key()
        assert f"org:{org_id}" in cache_key
        assert f"port:{portfolio_id}" in cache_key
        assert f"proj:{project_id}" in cache_key


class TestRoleAssignment:
    """Tests for the RoleAssignment model."""
    
    def test_create_global_assignment(self):
        """Test creating a global role assignment."""
        user_id = uuid4()
        role_id = uuid4()
        assigned_by = uuid4()
        
        assignment = RoleAssignment(
            user_id=user_id,
            role_id=role_id,
            assigned_by=assigned_by
        )
        
        assert assignment.user_id == user_id
        assert assignment.role_id == role_id
        assert assignment.assigned_by == assigned_by
        assert assignment.scope_type is None
        assert assignment.scope_id is None
        assert assignment.is_active
        assert not assignment.is_expired()
        assert assignment.is_valid()
    
    def test_create_project_scoped_assignment(self):
        """Test creating a project-scoped role assignment."""
        user_id = uuid4()
        role_id = uuid4()
        assigned_by = uuid4()
        project_id = uuid4()
        
        assignment = RoleAssignment(
            user_id=user_id,
            role_id=role_id,
            assigned_by=assigned_by,
            scope_type=ScopeType.PROJECT,
            scope_id=project_id
        )
        
        assert assignment.scope_type == ScopeType.PROJECT
        assert assignment.scope_id == project_id
    
    def test_expired_assignment(self):
        """Test that expired assignments are detected."""
        user_id = uuid4()
        role_id = uuid4()
        assigned_by = uuid4()
        
        # Create an assignment that expired yesterday
        assignment = RoleAssignment(
            user_id=user_id,
            role_id=role_id,
            assigned_by=assigned_by,
            expires_at=datetime.now(timezone.utc) - timedelta(days=1)
        )
        
        assert assignment.is_expired()
        assert not assignment.is_valid()
    
    def test_future_expiration(self):
        """Test that future expiration is not considered expired."""
        user_id = uuid4()
        role_id = uuid4()
        assigned_by = uuid4()
        
        # Create an assignment that expires tomorrow
        assignment = RoleAssignment(
            user_id=user_id,
            role_id=role_id,
            assigned_by=assigned_by,
            expires_at=datetime.now(timezone.utc) + timedelta(days=1)
        )
        
        assert not assignment.is_expired()
        assert assignment.is_valid()
    
    def test_inactive_assignment(self):
        """Test that inactive assignments are not valid."""
        user_id = uuid4()
        role_id = uuid4()
        assigned_by = uuid4()
        
        assignment = RoleAssignment(
            user_id=user_id,
            role_id=role_id,
            assigned_by=assigned_by,
            is_active=False
        )
        
        assert not assignment.is_valid()
    
    def test_matches_global_context(self):
        """Test that global assignments match any context."""
        user_id = uuid4()
        role_id = uuid4()
        assigned_by = uuid4()
        
        assignment = RoleAssignment(
            user_id=user_id,
            role_id=role_id,
            assigned_by=assigned_by
        )
        
        # Global assignment should match any context
        assert assignment.matches_context(None)
        assert assignment.matches_context(PermissionContext())
        assert assignment.matches_context(PermissionContext(project_id=uuid4()))
    
    def test_matches_project_context(self):
        """Test that project-scoped assignments match correct context."""
        user_id = uuid4()
        role_id = uuid4()
        assigned_by = uuid4()
        project_id = uuid4()
        other_project_id = uuid4()
        
        assignment = RoleAssignment(
            user_id=user_id,
            role_id=role_id,
            assigned_by=assigned_by,
            scope_type=ScopeType.PROJECT,
            scope_id=project_id
        )
        
        # Should match context with same project
        assert assignment.matches_context(PermissionContext(project_id=project_id))
        
        # Should not match context with different project
        assert not assignment.matches_context(PermissionContext(project_id=other_project_id))
        
        # Should not match global context
        assert not assignment.matches_context(None)
        assert not assignment.matches_context(PermissionContext())
    
    def test_scope_id_validation(self):
        """Test that scope_id is required when scope_type is set."""
        user_id = uuid4()
        role_id = uuid4()
        assigned_by = uuid4()
        
        # Should raise validation error when scope_type is set but scope_id is not
        with pytest.raises(ValueError):
            RoleAssignment(
                user_id=user_id,
                role_id=role_id,
                assigned_by=assigned_by,
                scope_type=ScopeType.PROJECT,
                scope_id=None
            )


class TestEnhancedPermissionChecker:
    """Tests for the EnhancedPermissionChecker class."""
    
    @pytest.fixture
    def checker(self):
        """Create a permission checker without database connection."""
        return EnhancedPermissionChecker(supabase_client=None)
    
    @pytest.mark.asyncio
    async def test_dev_user_has_admin_permissions(self, checker):
        """Test that development users get admin permissions."""
        dev_user_id = UUID("00000000-0000-0000-0000-000000000001")
        
        # Dev user should have admin permissions
        has_perm = await checker.check_permission(
            dev_user_id,
            Permission.user_manage
        )
        assert has_perm
        
        # Check multiple admin permissions
        has_all = await checker.check_all_permissions(
            dev_user_id,
            [Permission.user_manage, Permission.role_manage, Permission.system_admin]
        )
        assert has_all
    
    @pytest.mark.asyncio
    async def test_get_dev_user_permissions(self, checker):
        """Test getting permissions for development user."""
        dev_user_id = UUID("00000000-0000-0000-0000-000000000001")
        
        permissions = await checker.get_user_permissions(dev_user_id)
        
        # Should have all admin permissions
        admin_permissions = DEFAULT_ROLE_PERMISSIONS[UserRole.admin]
        for perm in admin_permissions:
            assert perm in permissions
    
    @pytest.mark.asyncio
    async def test_get_dev_user_effective_roles(self, checker):
        """Test getting effective roles for development user."""
        dev_user_id = UUID("00000000-0000-0000-0000-000000000001")
        
        roles = await checker.get_effective_roles(dev_user_id)
        
        assert len(roles) == 1
        assert roles[0].role_name == "admin"
        assert roles[0].source_type == ScopeType.GLOBAL
    
    @pytest.mark.asyncio
    async def test_check_any_permission(self, checker):
        """Test checking any of multiple permissions."""
        dev_user_id = UUID("00000000-0000-0000-0000-000000000001")
        
        # Should have at least one of these permissions
        has_any = await checker.check_any_permission(
            dev_user_id,
            [Permission.project_read, Permission.portfolio_read]
        )
        assert has_any
    
    @pytest.mark.asyncio
    async def test_check_all_permissions(self, checker):
        """Test checking all of multiple permissions."""
        dev_user_id = UUID("00000000-0000-0000-0000-000000000001")
        
        # Should have all of these permissions
        has_all = await checker.check_all_permissions(
            dev_user_id,
            [Permission.project_read, Permission.project_update]
        )
        assert has_all
    
    @pytest.mark.asyncio
    async def test_permission_caching(self, checker):
        """Test that permissions are cached."""
        dev_user_id = UUID("00000000-0000-0000-0000-000000000001")
        
        # First call should populate cache
        await checker.check_permission(dev_user_id, Permission.project_read)
        
        # Cache should have entries
        assert len(checker._permission_cache) > 0
    
    @pytest.mark.asyncio
    async def test_clear_user_cache(self, checker):
        """Test clearing cache for a specific user."""
        dev_user_id = UUID("00000000-0000-0000-0000-000000000001")
        
        # Populate cache
        await checker.check_permission(dev_user_id, Permission.project_read)
        assert len(checker._permission_cache) > 0
        
        # Clear cache for user
        checker.clear_user_cache(dev_user_id)
        
        # Cache should be empty for this user
        user_cache_keys = [k for k in checker._permission_cache.keys() if str(dev_user_id) in k]
        assert len(user_cache_keys) == 0
    
    @pytest.mark.asyncio
    async def test_clear_all_cache(self, checker):
        """Test clearing all cached permissions."""
        dev_user_id = UUID("00000000-0000-0000-0000-000000000001")
        
        # Populate cache
        await checker.check_permission(dev_user_id, Permission.project_read)
        assert len(checker._permission_cache) > 0
        
        # Clear all cache
        checker.clear_all_cache()
        
        assert len(checker._permission_cache) == 0
        assert len(checker._cache_timestamps) == 0
    
    @pytest.mark.asyncio
    async def test_context_aware_permission_check(self, checker):
        """Test permission checking with context."""
        dev_user_id = UUID("00000000-0000-0000-0000-000000000001")
        project_id = uuid4()
        
        context = PermissionContext(project_id=project_id)
        
        # Dev user should have permissions even with context
        has_perm = await checker.check_permission(
            dev_user_id,
            Permission.project_read,
            context
        )
        assert has_perm
    
    @pytest.mark.asyncio
    async def test_non_dev_user_fallback(self, checker):
        """Test that non-dev users without DB get viewer permissions."""
        random_user_id = uuid4()
        
        permissions = await checker.get_user_permissions(random_user_id)
        
        # Should have viewer permissions as fallback
        viewer_permissions = DEFAULT_ROLE_PERMISSIONS[UserRole.viewer]
        for perm in viewer_permissions:
            assert perm in permissions
        
        # Should not have admin-only permissions
        assert Permission.user_manage not in permissions


class TestEffectiveRole:
    """Tests for the EffectiveRole model."""
    
    def test_create_effective_role(self):
        """Test creating an effective role."""
        role_id = uuid4()
        
        role = EffectiveRole(
            role_id=role_id,
            role_name="project_manager",
            permissions=["project_read", "project_update"],
            source_type=ScopeType.PROJECT,
            source_id=uuid4(),
            is_inherited=False
        )
        
        assert role.role_id == role_id
        assert role.role_name == "project_manager"
        assert len(role.permissions) == 2
        assert role.source_type == ScopeType.PROJECT
        assert not role.is_inherited
    
    def test_inherited_role(self):
        """Test creating an inherited effective role."""
        role = EffectiveRole(
            role_id=uuid4(),
            role_name="portfolio_manager",
            permissions=["portfolio_read"],
            source_type=ScopeType.PORTFOLIO,
            source_id=uuid4(),
            is_inherited=True
        )
        
        assert role.is_inherited


class TestRoleAssignmentRequest:
    """Tests for the RoleAssignmentRequest model."""
    
    def test_create_request(self):
        """Test creating a role assignment request."""
        user_id = uuid4()
        role_id = uuid4()
        
        request = RoleAssignmentRequest(
            user_id=user_id,
            role_id=role_id
        )
        
        assert request.user_id == user_id
        assert request.role_id == role_id
        assert request.scope_type is None
        assert request.scope_id is None
        assert request.expires_at is None
    
    def test_create_scoped_request(self):
        """Test creating a scoped role assignment request."""
        user_id = uuid4()
        role_id = uuid4()
        project_id = uuid4()
        expires = datetime.now(timezone.utc) + timedelta(days=30)
        
        request = RoleAssignmentRequest(
            user_id=user_id,
            role_id=role_id,
            scope_type=ScopeType.PROJECT,
            scope_id=project_id,
            expires_at=expires
        )
        
        assert request.scope_type == ScopeType.PROJECT
        assert request.scope_id == project_id
        assert request.expires_at == expires
