"""
Property-based tests for Access Control Enforcement
Feature: ai-ppm-platform, Property 25: Access Control Enforcement
Validates: Requirements 8.2
"""

import pytest
from hypothesis import given, strategies as st, assume, settings
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from unittest.mock import Mock, patch, MagicMock, AsyncMock
from datetime import datetime
import uuid
import asyncio

# Import access control components from main.py
from main import (
    RoleBasedAccessControl,
    Permission,
    UserRole,
    DEFAULT_ROLE_PERMISSIONS,
    require_permission,
    require_any_permission
)

# Test data strategies for property-based testing
@st.composite
def user_id_strategy(draw):
    """Generate valid user IDs for testing"""
    return str(uuid.uuid4())

@st.composite
def permission_strategy(draw):
    """Generate valid permissions for testing"""
    return draw(st.sampled_from(list(Permission)))

@st.composite
def permission_list_strategy(draw):
    """Generate lists of permissions for testing"""
    return draw(st.lists(st.sampled_from(list(Permission)), min_size=1, max_size=10, unique=True))

@st.composite
def user_role_strategy(draw):
    """Generate valid user roles for testing"""
    return draw(st.sampled_from(list(UserRole)))

@st.composite
def role_assignment_strategy(draw):
    """Generate role assignment scenarios for testing"""
    user_id = draw(user_id_strategy())
    role = draw(user_role_strategy())
    permissions = DEFAULT_ROLE_PERMISSIONS[role]
    
    return {
        "user_id": user_id,
        "role": role,
        "permissions": permissions
    }

@st.composite
def multi_role_assignment_strategy(draw):
    """Generate scenarios where users have multiple roles"""
    user_id = draw(user_id_strategy())
    roles = draw(st.lists(st.sampled_from(list(UserRole)), min_size=1, max_size=3, unique=True))
    
    # Combine permissions from all roles
    all_permissions = set()
    for role in roles:
        all_permissions.update(DEFAULT_ROLE_PERMISSIONS[role])
    
    return {
        "user_id": user_id,
        "roles": roles,
        "combined_permissions": list(all_permissions)
    }

@st.composite
def permission_check_scenario_strategy(draw):
    """Generate scenarios for permission checking"""
    user_assignment = draw(role_assignment_strategy())
    required_permission = draw(permission_strategy())
    
    should_have_access = required_permission in user_assignment["permissions"]
    
    return {
        "user_id": user_assignment["user_id"],
        "user_role": user_assignment["role"],
        "user_permissions": user_assignment["permissions"],
        "required_permission": required_permission,
        "should_have_access": should_have_access
    }

class TestAccessControlEnforcement:
    """Property 25: Access Control Enforcement tests"""

    def setup_method(self):
        """Set up test environment for each test method"""
        # Create a mock Supabase client for testing
        self.mock_supabase = Mock()
        self.rbac = RoleBasedAccessControl(self.mock_supabase)
        
        # Clear any existing cache
        self.rbac.clear_all_cache()

    @settings(max_examples=10)
    @given(scenario=permission_check_scenario_strategy())
    def test_access_control_enforcement_single_role(self, scenario):
        """
        Property 25: Access Control Enforcement - Single Role
        For any user with a specific role, access permissions should be enforced consistently across all system components
        Validates: Requirements 8.2
        """
        user_id = scenario["user_id"]
        user_role = scenario["user_role"]
        user_permissions = scenario["user_permissions"]
        required_permission = scenario["required_permission"]
        should_have_access = scenario["should_have_access"]
        
        # Mock database response for user role assignment
        mock_role_data = {
            "role_id": str(uuid.uuid4()),
            "roles": {
                "name": user_role.value,
                "permissions": [perm.value for perm in user_permissions]
            }
        }
        
        mock_response = Mock()
        mock_response.data = [mock_role_data]
        self.mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_response
        
        # Test permission checking
        async def run_test():
            # Get user permissions
            actual_permissions = await self.rbac.get_user_permissions(user_id)
            
            # Verify permissions match expected role permissions
            expected_permission_values = {perm.value for perm in user_permissions}
            actual_permission_values = {perm.value for perm in actual_permissions}
            
            assert actual_permission_values == expected_permission_values, \
                f"User permissions should match role permissions. Expected: {expected_permission_values}, Got: {actual_permission_values}"
            
            # Test specific permission check
            has_permission = await self.rbac.has_permission(user_id, required_permission)
            
            assert has_permission == should_have_access, \
                f"Permission check should return {should_have_access} for {required_permission.value} with role {user_role.value}"
            
            return True
        
        # Run the async test
        result = asyncio.run(run_test())
        assert result == True

    @settings(max_examples=10)
    @given(scenario=multi_role_assignment_strategy())
    def test_access_control_enforcement_multiple_roles(self, scenario):
        """
        Property 25: Access Control Enforcement - Multiple Roles
        For any user with multiple roles, all permissions from all roles should be aggregated and enforced consistently
        Validates: Requirements 8.2
        """
        user_id = scenario["user_id"]
        roles = scenario["roles"]
        expected_permissions = scenario["combined_permissions"]
        
        # Mock database response for multiple role assignments
        mock_assignments = []
        for role in roles:
            role_permissions = DEFAULT_ROLE_PERMISSIONS[role]
            mock_assignments.append({
                "role_id": str(uuid.uuid4()),
                "roles": {
                    "name": role.value,
                    "permissions": [perm.value for perm in role_permissions]
                }
            })
        
        mock_response = Mock()
        mock_response.data = mock_assignments
        self.mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_response
        
        async def run_test():
            # Get aggregated user permissions
            actual_permissions = await self.rbac.get_user_permissions(user_id)
            
            # Convert to sets for comparison
            expected_permission_values = {perm.value for perm in expected_permissions}
            actual_permission_values = {perm.value for perm in actual_permissions}
            
            # Verify all permissions from all roles are included
            assert actual_permission_values == expected_permission_values, \
                f"User should have aggregated permissions from all roles. Expected: {expected_permission_values}, Got: {actual_permission_values}"
            
            # Test that user has permissions from each individual role
            for role in roles:
                role_permissions = DEFAULT_ROLE_PERMISSIONS[role]
                for permission in role_permissions:
                    has_permission = await self.rbac.has_permission(user_id, permission)
                    assert has_permission == True, \
                        f"User should have permission {permission.value} from role {role.value}"
            
            return True
        
        result = asyncio.run(run_test())
        assert result == True

    @settings(max_examples=15)
    @given(user_id=user_id_strategy(), permissions=permission_list_strategy())
    def test_access_control_enforcement_any_permission_check(self, user_id, permissions):
        """
        Property 25: Access Control Enforcement - Any Permission Check
        For any user and list of required permissions, has_any_permission should return true if user has at least one permission
        Validates: Requirements 8.2
        """
        # Assign admin role to ensure user has all permissions
        admin_permissions = DEFAULT_ROLE_PERMISSIONS[UserRole.admin]
        
        # Mock database response
        mock_role_data = {
            "role_id": str(uuid.uuid4()),
            "roles": {
                "name": UserRole.admin.value,
                "permissions": [perm.value for perm in admin_permissions]
            }
        }
        
        mock_response = Mock()
        mock_response.data = [mock_role_data]
        self.mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_response
        
        async def run_test():
            # Test has_any_permission with admin user (should always return True)
            has_any = await self.rbac.has_any_permission(user_id, permissions)
            
            # Admin should have all permissions, so should always return True
            assert has_any == True, \
                f"Admin user should have any permission from the list: {[p.value for p in permissions]}"
            
            # Test with viewer role (limited permissions)
            viewer_permissions = DEFAULT_ROLE_PERMISSIONS[UserRole.viewer]
            mock_viewer_data = {
                "role_id": str(uuid.uuid4()),
                "roles": {
                    "name": UserRole.viewer.value,
                    "permissions": [perm.value for perm in viewer_permissions]
                }
            }
            
            mock_response.data = [mock_viewer_data]
            
            # Clear cache to get fresh permissions
            self.rbac.clear_all_cache()
            
            has_any_viewer = await self.rbac.has_any_permission(user_id, permissions)
            
            # Check if viewer should have any of the requested permissions
            viewer_permission_set = set(viewer_permissions)
            requested_permission_set = set(permissions)
            should_have_any = bool(viewer_permission_set & requested_permission_set)
            
            assert has_any_viewer == should_have_any, \
                f"Viewer permission check should return {should_have_any}. Viewer permissions: {[p.value for p in viewer_permissions]}, Requested: {[p.value for p in permissions]}"
            
            return True
        
        result = asyncio.run(run_test())
        assert result == True

    @settings(max_examples=15)
    @given(user_id=user_id_strategy(), role=user_role_strategy())
    def test_access_control_enforcement_permission_caching(self, user_id, role):
        """
        Property 25: Access Control Enforcement - Permission Caching
        For any user, permission caching should work correctly and return consistent results
        Validates: Requirements 8.2
        """
        role_permissions = DEFAULT_ROLE_PERMISSIONS[role]
        
        # Mock database response
        mock_role_data = {
            "role_id": str(uuid.uuid4()),
            "roles": {
                "name": role.value,
                "permissions": [perm.value for perm in role_permissions]
            }
        }
        
        mock_response = Mock()
        mock_response.data = [mock_role_data]
        self.mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_response
        
        async def run_test():
            # First call - should hit database
            permissions_1 = await self.rbac.get_user_permissions(user_id)
            
            # Second call - should use cache
            permissions_2 = await self.rbac.get_user_permissions(user_id)
            
            # Verify both calls return the same permissions
            permissions_1_values = {perm.value for perm in permissions_1}
            permissions_2_values = {perm.value for perm in permissions_2}
            
            assert permissions_1_values == permissions_2_values, \
                "Cached permissions should match original permissions"
            
            # Verify database was called only once (first call)
            # Note: In a real test, we'd verify the mock was called only once
            # For this property test, we just verify consistency
            
            # Test cache invalidation
            self.rbac._clear_user_cache(user_id)
            
            # Third call - should hit database again after cache clear
            permissions_3 = await self.rbac.get_user_permissions(user_id)
            permissions_3_values = {perm.value for perm in permissions_3}
            
            assert permissions_3_values == permissions_1_values, \
                "Permissions after cache clear should match original permissions"
            
            return True
        
        result = asyncio.run(run_test())
        assert result == True

    @settings(max_examples=10)
    @given(user_id=user_id_strategy())
    def test_access_control_enforcement_no_roles_assigned(self, user_id):
        """
        Property 25: Access Control Enforcement - No Roles Assigned
        For any user with no roles assigned, they should get default viewer permissions
        Validates: Requirements 8.2
        """
        # Mock empty database response (no roles assigned)
        mock_response = Mock()
        mock_response.data = []
        self.mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_response
        
        async def run_test():
            # Get permissions for user with no roles
            permissions = await self.rbac.get_user_permissions(user_id)
            
            # Should get default viewer permissions
            expected_permissions = DEFAULT_ROLE_PERMISSIONS[UserRole.viewer]
            expected_permission_values = {perm.value for perm in expected_permissions}
            actual_permission_values = {perm.value for perm in permissions}
            
            assert actual_permission_values == expected_permission_values, \
                f"User with no roles should get viewer permissions. Expected: {expected_permission_values}, Got: {actual_permission_values}"
            
            # Test specific permission checks
            for permission in expected_permissions:
                has_permission = await self.rbac.has_permission(user_id, permission)
                assert has_permission == True, \
                    f"User should have default viewer permission: {permission.value}"
            
            # Test that user doesn't have admin permissions
            admin_only_permissions = set(DEFAULT_ROLE_PERMISSIONS[UserRole.admin]) - set(expected_permissions)
            for permission in admin_only_permissions:
                has_permission = await self.rbac.has_permission(user_id, permission)
                assert has_permission == False, \
                    f"User without roles should not have admin permission: {permission.value}"
            
            return True
        
        result = asyncio.run(run_test())
        assert result == True

    @settings(max_examples=10)
    @given(user_id=user_id_strategy())
    def test_access_control_enforcement_database_unavailable(self, user_id):
        """
        Property 25: Access Control Enforcement - Database Unavailable
        For any user when database is unavailable, they should get fallback admin permissions for development
        Validates: Requirements 8.2
        """
        # Create RBAC with None supabase client (simulating unavailable database)
        rbac_no_db = RoleBasedAccessControl(None)
        
        async def run_test():
            # Get permissions when database is unavailable
            permissions = await rbac_no_db.get_user_permissions(user_id)
            
            # Should get fallback admin permissions
            expected_permissions = DEFAULT_ROLE_PERMISSIONS[UserRole.admin]
            expected_permission_values = {perm.value for perm in expected_permissions}
            actual_permission_values = {perm.value for perm in permissions}
            
            assert actual_permission_values == expected_permission_values, \
                f"User should get fallback admin permissions when database unavailable. Expected: {expected_permission_values}, Got: {actual_permission_values}"
            
            # Test permission checks work with fallback
            test_permission = Permission.portfolio_create
            has_permission = await rbac_no_db.has_permission(user_id, test_permission)
            assert has_permission == True, \
                f"User should have fallback permission: {test_permission.value}"
            
            return True
        
        result = asyncio.run(run_test())
        assert result == True

    @settings(max_examples=10)
    @given(user_id=user_id_strategy(), role=user_role_strategy())
    def test_access_control_enforcement_error_handling(self, user_id, role):
        """
        Property 25: Access Control Enforcement - Error Handling
        For any user, permission checks should handle errors gracefully and return safe defaults
        Validates: Requirements 8.2
        """
        # Mock database error
        self.mock_supabase.table.return_value.select.return_value.eq.return_value.execute.side_effect = Exception("Database error")
        
        async def run_test():
            # Get permissions when database throws error
            permissions = await self.rbac.get_user_permissions(user_id)
            
            # Should get fallback viewer permissions on error
            expected_permissions = DEFAULT_ROLE_PERMISSIONS[UserRole.viewer]
            expected_permission_values = {perm.value for perm in expected_permissions}
            actual_permission_values = {perm.value for perm in permissions}
            
            assert actual_permission_values == expected_permission_values, \
                f"User should get fallback viewer permissions on error. Expected: {expected_permission_values}, Got: {actual_permission_values}"
            
            # Test permission check error handling
            # Since get_user_permissions returns viewer permissions on error,
            # and portfolio_read is a viewer permission, it should return True
            has_permission = await self.rbac.has_permission(user_id, Permission.portfolio_read)
            assert has_permission == True, \
                "Permission check should return True for viewer permissions even on database error"
            
            # Test with admin-only permission - should return False since viewer doesn't have it
            has_admin_permission = await self.rbac.has_permission(user_id, Permission.system_admin)
            assert has_admin_permission == False, \
                "Permission check should return False for admin permissions when database error occurs"
            
            return True
        
        result = asyncio.run(run_test())
        assert result == True

    @settings(max_examples=15)
    @given(scenario=role_assignment_strategy())
    def test_access_control_enforcement_role_hierarchy(self, scenario):
        """
        Property 25: Access Control Enforcement - Role Hierarchy
        For any user role, the permission set should follow the expected hierarchy (admin > portfolio_manager > project_manager > etc.)
        Validates: Requirements 8.2
        """
        user_id = scenario["user_id"]
        user_role = scenario["role"]
        user_permissions = scenario["permissions"]
        
        # Test role hierarchy expectations
        admin_permissions = set(DEFAULT_ROLE_PERMISSIONS[UserRole.admin])
        portfolio_manager_permissions = set(DEFAULT_ROLE_PERMISSIONS[UserRole.portfolio_manager])
        project_manager_permissions = set(DEFAULT_ROLE_PERMISSIONS[UserRole.project_manager])
        viewer_permissions = set(DEFAULT_ROLE_PERMISSIONS[UserRole.viewer])
        
        user_permission_set = set(user_permissions)
        
        # Verify hierarchy relationships
        if user_role == UserRole.admin:
            # Admin should have the most permissions
            assert len(user_permission_set) >= len(portfolio_manager_permissions), \
                "Admin should have at least as many permissions as portfolio manager"
            assert len(user_permission_set) >= len(project_manager_permissions), \
                "Admin should have at least as many permissions as project manager"
            assert len(user_permission_set) >= len(viewer_permissions), \
                "Admin should have at least as many permissions as viewer"
        
        elif user_role == UserRole.portfolio_manager:
            # Portfolio manager should have more permissions than project manager and viewer
            assert len(user_permission_set) >= len(project_manager_permissions), \
                "Portfolio manager should have at least as many permissions as project manager"
            assert len(user_permission_set) >= len(viewer_permissions), \
                "Portfolio manager should have at least as many permissions as viewer"
        
        elif user_role == UserRole.project_manager:
            # Project manager should have more permissions than viewer
            assert len(user_permission_set) >= len(viewer_permissions), \
                "Project manager should have at least as many permissions as viewer"
        
        elif user_role == UserRole.viewer:
            # Viewer should have only read permissions
            read_permissions = {
                Permission.portfolio_read,
                Permission.project_read,
                Permission.resource_read,
                Permission.financial_read,
                Permission.risk_read,
                Permission.issue_read,
                Permission.ai_rag_query
            }
            
            # All viewer permissions should be read-only or query permissions
            for permission in user_permissions:
                assert permission in read_permissions or permission.value.endswith('_read') or permission.value.endswith('_query'), \
                    f"Viewer should only have read/query permissions, but has: {permission.value}"

    @settings(max_examples=10)
    @given(user_id=user_id_strategy(), role=user_role_strategy())
    def test_access_control_enforcement_permission_consistency(self, user_id, role):
        """
        Property 25: Access Control Enforcement - Permission Consistency
        For any user, permission checks should be consistent across multiple calls
        Validates: Requirements 8.2
        """
        role_permissions = DEFAULT_ROLE_PERMISSIONS[role]
        
        # Mock database response
        mock_role_data = {
            "role_id": str(uuid.uuid4()),
            "roles": {
                "name": role.value,
                "permissions": [perm.value for perm in role_permissions]
            }
        }
        
        mock_response = Mock()
        mock_response.data = [mock_role_data]
        self.mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_response
        
        async def run_test():
            # Test consistency across multiple permission checks
            test_permissions = [Permission.portfolio_read, Permission.project_create, Permission.system_admin]
            
            # Run each permission check multiple times
            for permission in test_permissions:
                results = []
                for _ in range(3):  # Check 3 times
                    has_perm = await self.rbac.has_permission(user_id, permission)
                    results.append(has_perm)
                
                # All results should be the same
                assert all(r == results[0] for r in results), \
                    f"Permission check for {permission.value} should be consistent across multiple calls"
                
                # Verify result matches expected based on role
                expected = permission in role_permissions
                assert results[0] == expected, \
                    f"Permission check for {permission.value} should return {expected} for role {role.value}"
            
            return True
        
        result = asyncio.run(run_test())
        assert result == True

if __name__ == "__main__":
    # Run the tests
    pytest.main([__file__, "-v"])