"""
Property-based tests for admin role management endpoints (Task 12)

Feature: ai-empowered-ppm-features
Tests: Properties 24 and 25
"""

import pytest
from hypothesis import given, strategies as st, settings, assume
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch, MagicMock
from uuid import uuid4, UUID
from datetime import datetime

# Import the FastAPI app
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from main import app
from auth.rbac import UserRole, Permission
from auth.dependencies import get_current_user

# Test client
client = TestClient(app)

# Helper to create dependency override
def create_user_override(user_data):
    async def override():
        return user_data
    return override

# ============================================================================
# Property 24: Admin Authorization
# ============================================================================

@given(
    user_role=st.sampled_from(["portfolio_manager", "project_manager", "resource_manager", "team_member", "viewer"]),
    endpoint=st.sampled_from(["/admin/roles", "/admin/users/{user_id}/roles", "/admin/users/{user_id}/roles/{role}"])
)
@settings(max_examples=50, deadline=None)
def test_property_24_admin_authorization(user_role, endpoint):
    """
    Feature: ai-empowered-ppm-features
    Property 24: Admin Authorization
    
    For any request to admin endpoints (/admin/*) by a user without admin role,
    the system SHALL return a 403 Forbidden error.
    
    Validates: Requirements 9.4
    """
    # Arrange: Create a non-admin user
    non_admin_user = {
        "user_id": str(uuid4()),
        "email": f"user@example.com",
        "organization_id": str(uuid4()),
        "role": user_role
    }
    
    # Mock the authentication to return non-admin user
    with patch('auth.dependencies.get_current_user', return_value=non_admin_user):
        # Mock RBAC to deny admin permission
        with patch('auth.rbac.rbac.has_permission', return_value=False):
            # Act: Try to access admin endpoint
            test_user_id = str(uuid4())
            test_role = "viewer"
            
            # Determine which endpoint to test and use correct HTTP method
            if endpoint == "/admin/roles":
                response = client.get(endpoint)
            elif endpoint == "/admin/users/{user_id}/roles/{role}":
                # DELETE endpoint
                response = client.delete(f"/admin/users/{test_user_id}/roles/{test_role}")
            else:  # POST endpoint
                response = client.post(f"/admin/users/{test_user_id}/roles", json={"role": test_role})
            
            # Assert: Should return 403 Forbidden
            assert response.status_code == 403, \
                f"Non-admin user with role '{user_role}' should receive 403 when accessing {endpoint}, got {response.status_code}"
            
            # Verify error message mentions permissions
            response_data = response.json()
            assert "detail" in response_data
            assert any(keyword in response_data["detail"].lower() for keyword in ["permission", "admin", "forbidden"]), \
                f"Error message should mention permissions or admin access: {response_data['detail']}"


@given(
    admin_user_id=st.uuids(),
    organization_id=st.uuids()
)
@settings(max_examples=30, deadline=None)
def test_property_24_admin_access_granted(admin_user_id, organization_id):
    """
    Feature: ai-empowered-ppm-features
    Property 24: Admin Authorization (positive case)
    
    For any request to admin endpoints by a user with admin role,
    the system SHALL allow access.
    
    Validates: Requirements 9.4
    """
    # Arrange: Create an admin user
    admin_user = {
        "user_id": str(admin_user_id),
        "email": "admin@example.com",
        "organization_id": str(organization_id)
    }
    
    # Mock the authentication to return admin user
    with patch('auth.dependencies.get_current_user', return_value=admin_user):
        # Mock RBAC to grant admin permission
        with patch('auth.rbac.rbac.has_permission', return_value=True):
            # Act: Access GET /admin/roles endpoint
            response = client.get("/admin/roles")
            
            # Assert: Should NOT return 403
            assert response.status_code != 403, \
                f"Admin user should not receive 403 when accessing /admin/roles, got {response.status_code}"
            
            # Should return 200 or other success code
            assert response.status_code in [200, 201, 204], \
                f"Admin user should receive success status code, got {response.status_code}"


# ============================================================================
# Property 25: Role Assignment and Removal
# ============================================================================

@given(
    admin_user_id=st.uuids(),
    target_user_id=st.uuids(),
    organization_id=st.uuids(),
    role=st.sampled_from(["admin", "portfolio_manager", "project_manager", "resource_manager", "team_member", "viewer"])
)
@settings(max_examples=50, deadline=None)
def test_property_25_role_assignment_logging(admin_user_id, target_user_id, organization_id, role):
    """
    Feature: ai-empowered-ppm-features
    Property 25: Role Assignment and Removal
    
    For any valid role assignment or removal request by an admin,
    the system SHALL update the user's roles AND log the change to audit_logs
    with both admin_user_id and affected_user_id.
    
    Validates: Requirements 9.2, 9.3, 9.5
    """
    # Arrange: Create admin user
    admin_user = {
        "user_id": str(admin_user_id),
        "email": "admin@example.com",
        "organization_id": str(organization_id)
    }
    
    # Track audit log calls
    audit_log_calls = []
    
    # Mock Supabase client
    mock_supabase = MagicMock()
    
    def table_side_effect(table_name):
        mock_t = MagicMock()
        
        def select_side_effect(*args, **kwargs):
            mock_s = MagicMock()
            
            def eq_side_effect(field, value):
                mock_e = MagicMock()
                
                def eq2_side_effect(field2, value2):
                    mock_e2 = MagicMock()
                    # No existing role assignment
                    mock_e2.execute.return_value.data = []
                    return mock_e2
                
                mock_e.eq = eq2_side_effect
                # User exists
                mock_e.execute.return_value.data = [
                    {
                        "user_id": str(target_user_id),
                        "role": "viewer",
                        "is_active": True
                    }
                ]
                return mock_e
            
            mock_s.eq = eq_side_effect
            return mock_s
        
        def insert_side_effect(data):
            mock_i = MagicMock()
            # Capture audit log calls
            if table_name == "audit_logs":
                audit_log_calls.append(data)
            mock_i.execute.return_value.data = [{"id": str(uuid4())}]
            return mock_i
        
        mock_t.select = select_side_effect
        mock_t.insert = insert_side_effect
        return mock_t
    
    mock_supabase.table = table_side_effect
    
    # Use dependency override for proper FastAPI dependency injection
    async def override_get_current_user():
        return admin_user
    
    # Apply dependency overrides
    app.dependency_overrides[get_current_user] = override_get_current_user
    
    try:
        # Act: Assign role - patch RBAC permission check
        with patch('routers.admin.supabase', mock_supabase):
            with patch('auth.rbac.rbac.has_permission', return_value=True):
                response = client.post(
                    f"/admin/users/{target_user_id}/roles",
                    json={"role": role}
                )
        
        # Assert: Should succeed
        assert response.status_code in [200, 201], \
            f"Role assignment should succeed, got {response.status_code}: {response.text}"
        
        # Verify audit log was created
        assert len(audit_log_calls) > 0, "Audit log should be created for role assignment"
        
        # Find the audit log entry (last call should be audit log)
        audit_log = audit_log_calls[-1] if audit_log_calls else None
        
        if audit_log:
            # Verify audit log contains required fields
            assert "user_id" in audit_log, "Audit log should contain user_id (admin)"
            assert "action" in audit_log, "Audit log should contain action"
            assert "entity_id" in audit_log, "Audit log should contain entity_id (target user)"
            assert "details" in audit_log, "Audit log should contain details"
            
            # Verify admin_user_id and affected_user_id are in the log
            assert audit_log["user_id"] == str(admin_user_id), \
                "Audit log user_id should be the admin user"
            assert audit_log["entity_id"] == str(target_user_id), \
                "Audit log entity_id should be the affected user"
            
            # Verify details contain both user IDs
            details = audit_log.get("details", {})
            assert "admin_user_id" in details, "Audit log details should contain admin_user_id"
            assert "affected_user_id" in details, "Audit log details should contain affected_user_id"
            assert details["admin_user_id"] == str(admin_user_id), \
                "Admin user ID should match in details"
            assert details["affected_user_id"] == str(target_user_id), \
                "Affected user ID should match in details"
    finally:
        # Clean up dependency overrides
        app.dependency_overrides.clear()


@given(
    admin_user_id=st.uuids(),
    target_user_id=st.uuids(),
    organization_id=st.uuids(),
    role=st.sampled_from(["admin", "portfolio_manager", "project_manager", "resource_manager", "team_member", "viewer"])
)
@settings(max_examples=50, deadline=None)
def test_property_25_role_removal_logging(admin_user_id, target_user_id, organization_id, role):
    """
    Feature: ai-empowered-ppm-features
    Property 25: Role Assignment and Removal (removal case)
    
    For any valid role removal request by an admin,
    the system SHALL remove the user's role AND log the change to audit_logs
    with both admin_user_id and affected_user_id.
    
    Validates: Requirements 9.3, 9.5
    """
    # Arrange: Create admin user
    admin_user = {
        "user_id": str(admin_user_id),
        "email": "admin@example.com",
        "organization_id": str(organization_id)
    }
    
    # Track audit log calls
    audit_log_calls = []
    
    # Mock Supabase client with proper table routing
    mock_supabase = MagicMock()
    
    def table_side_effect(table_name):
        mock_t = MagicMock()
        
        def select_side_effect(*args, **kwargs):
            mock_s = MagicMock()
            
            def eq_side_effect(field, value):
                mock_e = MagicMock()
                
                def eq2_side_effect(field2, value2):
                    mock_e2 = MagicMock()
                    # Existing role assignment
                    mock_e2.execute.return_value.data = [
                        {"user_id": str(target_user_id), "role": role}
                    ]
                    return mock_e2
                
                mock_e.eq = eq2_side_effect
                # User exists
                mock_e.execute.return_value.data = [
                    {
                        "user_id": str(target_user_id),
                        "role": "viewer",
                        "is_active": True
                    }
                ]
                return mock_e
            
            mock_s.eq = eq_side_effect
            return mock_s
        
        def delete_side_effect():
            mock_d = MagicMock()
            
            def eq_side_effect(field, value):
                mock_e = MagicMock()
                
                def eq2_side_effect(field2, value2):
                    mock_e2 = MagicMock()
                    mock_e2.execute.return_value.data = []
                    return mock_e2
                
                mock_e.eq = eq2_side_effect
                return mock_e
            
            mock_d.eq = eq_side_effect
            return mock_d
        
        def insert_side_effect(data):
            mock_i = MagicMock()
            # Capture audit log calls
            if table_name == "audit_logs":
                audit_log_calls.append(data)
            mock_i.execute.return_value.data = [{"id": str(uuid4())}]
            return mock_i
        
        mock_t.select = select_side_effect
        mock_t.delete = delete_side_effect
        mock_t.insert = insert_side_effect
        return mock_t
    
    mock_supabase.table = table_side_effect
    
    # Use dependency override for proper FastAPI dependency injection
    async def override_get_current_user():
        return admin_user
    
    # Apply dependency overrides
    app.dependency_overrides[get_current_user] = override_get_current_user
    
    try:
        # Act: Remove role - patch RBAC permission check
        with patch('routers.admin.supabase', mock_supabase):
            with patch('auth.rbac.rbac.has_permission', return_value=True):
                response = client.delete(f"/admin/users/{target_user_id}/roles/{role}")
        
        # Assert: Should succeed
        assert response.status_code in [200, 204], \
            f"Role removal should succeed, got {response.status_code}: {response.text}"
        
        # Verify audit log was created
        assert len(audit_log_calls) > 0, "Audit log should be created for role removal"
        
        # Find the audit log entry
        audit_log = audit_log_calls[-1] if audit_log_calls else None
        
        if audit_log:
            # Verify audit log contains required fields
            assert "action" in audit_log, "Audit log should contain action"
            assert audit_log["action"] == "role_removal", \
                f"Audit log action should be 'role_removal', got '{audit_log.get('action')}'"
            
            # Verify both user IDs are logged
            assert audit_log["user_id"] == str(admin_user_id), \
                "Audit log user_id should be the admin user"
            assert audit_log["entity_id"] == str(target_user_id), \
                "Audit log entity_id should be the affected user"
            
            details = audit_log.get("details", {})
            assert "admin_user_id" in details, "Audit log details should contain admin_user_id"
            assert "affected_user_id" in details, "Audit log details should contain affected_user_id"
    finally:
        # Clean up dependency overrides
        app.dependency_overrides.clear()


# ============================================================================
# Unit Tests for Edge Cases (Task 12.6)
# ============================================================================

def test_role_listing_returns_all_roles():
    """
    Test that GET /admin/roles returns all available roles.
    
    Validates: Requirements 9.1
    """
    # Arrange: Create admin user
    admin_user = {
        "user_id": str(uuid4()),
        "email": "admin@example.com",
        "organization_id": str(uuid4())
    }
    
    # Act: Get roles
    with patch('auth.dependencies.get_current_user', return_value=admin_user):
        with patch('auth.rbac.rbac.has_permission', return_value=True):
            response = client.get("/admin/roles")
    
    # Assert: Should return all roles
    assert response.status_code == 200, f"Should return 200, got {response.status_code}"
    
    roles = response.json()
    assert isinstance(roles, list), "Response should be a list"
    assert len(roles) == 6, f"Should return 6 roles, got {len(roles)}"
    
    # Verify each role has required fields
    for role in roles:
        assert "role" in role, "Each role should have 'role' field"
        assert "permissions" in role, "Each role should have 'permissions' field"
        assert "description" in role, "Each role should have 'description' field"
        assert isinstance(role["permissions"], list), "Permissions should be a list"


def test_assign_role_to_nonexistent_user():
    """
    Test that assigning a role to a non-existent user returns 404.
    
    Validates: Requirements 9.6
    """
    # Arrange: Create admin user
    admin_user = {
        "user_id": str(uuid4()),
        "email": "admin@example.com",
        "organization_id": str(uuid4())
    }
    
    nonexistent_user_id = uuid4()
    
    # Mock Supabase to return no user
    mock_supabase = MagicMock()
    
    def table_side_effect(table_name):
        mock_t = MagicMock()
        
        def select_side_effect(*args, **kwargs):
            mock_s = MagicMock()
            
            def eq_side_effect(field, value):
                mock_e = MagicMock()
                # No user found
                mock_e.execute.return_value.data = []
                return mock_e
            
            mock_s.eq = eq_side_effect
            return mock_s
        
        mock_t.select = select_side_effect
        return mock_t
    
    mock_supabase.table = table_side_effect
    
    # Act: Try to assign role
    with patch('auth.dependencies.get_current_user', return_value=admin_user):
        with patch('auth.rbac.rbac.has_permission', return_value=True):
            with patch('routers.admin.supabase', mock_supabase):
                response = client.post(
                    f"/admin/users/{nonexistent_user_id}/roles",
                    json={"role": "viewer"}
                )
    
    # Assert: Should return 404
    assert response.status_code == 404, \
        f"Should return 404 for non-existent user, got {response.status_code}"
    
    response_data = response.json()
    assert "not found" in response_data["detail"].lower(), \
        "Error message should indicate user not found"


def test_remove_nonexistent_role():
    """
    Test that removing a non-existent role returns 404.
    
    Validates: Requirements 9.6
    """
    # Arrange: Create admin user
    admin_user = {
        "user_id": str(uuid4()),
        "email": "admin@example.com",
        "organization_id": str(uuid4())
    }
    
    target_user_id = uuid4()
    
    # Mock Supabase
    mock_supabase = MagicMock()
    
    def table_side_effect(table_name):
        mock_t = MagicMock()
        
        def select_side_effect(*args, **kwargs):
            mock_s = MagicMock()
            
            def eq_side_effect(field, value):
                mock_e = MagicMock()
                
                def eq2_side_effect(field2, value2):
                    mock_e2 = MagicMock()
                    # No role assignment exists
                    mock_e2.execute.return_value.data = []
                    return mock_e2
                
                mock_e.eq = eq2_side_effect
                # User exists
                mock_e.execute.return_value.data = [
                    {"user_id": str(target_user_id), "role": "viewer", "is_active": True}
                ]
                return mock_e
            
            mock_s.eq = eq_side_effect
            return mock_s
        
        mock_t.select = select_side_effect
        return mock_t
    
    mock_supabase.table = table_side_effect
    
    # Act: Try to remove role
    with patch('auth.dependencies.get_current_user', return_value=admin_user):
        with patch('auth.rbac.rbac.has_permission', return_value=True):
            with patch('routers.admin.supabase', mock_supabase):
                response = client.delete(f"/admin/users/{target_user_id}/roles/viewer")
    
    # Assert: Should return 404
    assert response.status_code == 404, \
        f"Should return 404 for non-existent role assignment, got {response.status_code}"
    
    response_data = response.json()
    assert "does not have role" in response_data["detail"].lower(), \
        "Error message should indicate user doesn't have the role"


def test_assign_invalid_role():
    """
    Test that assigning an invalid role returns 400.
    
    Validates: Requirements 9.6
    """
    # Arrange: Create admin user
    admin_user = {
        "user_id": str(uuid4()),
        "email": "admin@example.com",
        "organization_id": str(uuid4())
    }
    
    target_user_id = uuid4()
    
    # Mock Supabase
    mock_supabase = MagicMock()
    
    def table_side_effect(table_name):
        mock_t = MagicMock()
        
        def select_side_effect(*args, **kwargs):
            mock_s = MagicMock()
            
            def eq_side_effect(field, value):
                mock_e = MagicMock()
                mock_e.execute.return_value.data = [
                    {"user_id": str(target_user_id), "role": "viewer", "is_active": True}
                ]
                return mock_e
            
            mock_s.eq = eq_side_effect
            return mock_s
        
        mock_t.select = select_side_effect
        return mock_t
    
    mock_supabase.table = table_side_effect
    
    # Act: Try to assign invalid role
    with patch('auth.dependencies.get_current_user', return_value=admin_user):
        with patch('auth.rbac.rbac.has_permission', return_value=True):
            with patch('routers.admin.supabase', mock_supabase):
                response = client.post(
                    f"/admin/users/{target_user_id}/roles",
                    json={"role": "invalid_role"}
                )
    
    # Assert: Should return 422 (validation error) or 400
    assert response.status_code in [400, 422], \
        f"Should return 400 or 422 for invalid role, got {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
