"""
Integration tests for RBAC Audit Trail API Endpoints

Tests the audit trail viewing interface for administrators.

Requirements: 4.5 - Audit trail viewing interface
"""

import pytest
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch

from main import app
from services.rbac_audit_service import RBACAction


@pytest.fixture
def client():
    """Create a test client"""
    return TestClient(app)


@pytest.fixture
def mock_admin_user():
    """Create a mock admin user"""
    return {
        "user_id": str(uuid4()),
        "email": "admin@example.com",
        "organization_id": str(uuid4()),
        "role": "admin"
    }


@pytest.fixture
def sample_audit_logs():
    """Create sample audit log data"""
    user_id = str(uuid4())
    target_user_id = str(uuid4())
    role_id = str(uuid4())
    
    return [
        {
            "id": str(uuid4()),
            "organization_id": str(uuid4()),
            "user_id": user_id,
            "action": RBACAction.ROLE_ASSIGNMENT_CREATED,
            "entity_type": "user_role",
            "entity_id": role_id,
            "details": {
                "target_user_id": target_user_id,
                "role_id": role_id,
                "role_name": "project_manager",
                "scope_type": "project",
                "scope_id": str(uuid4())
            },
            "success": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid4()),
            "organization_id": str(uuid4()),
            "user_id": user_id,
            "action": RBACAction.CUSTOM_ROLE_CREATED,
            "entity_type": "role",
            "entity_id": str(uuid4()),
            "details": {
                "role_name": "custom_analyst",
                "permissions": ["project_read", "financial_read"],
                "permissions_count": 2,
                "description": "Custom analyst role"
            },
            "success": True,
            "created_at": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        }
    ]


class TestGetRoleChangeAuditLogs:
    """Test GET /api/rbac/audit/role-changes endpoint"""
    
    @patch('routers.rbac.require_admin')
    @patch('routers.rbac.audit_service')
    def test_get_audit_logs_success(self, mock_audit_service, mock_require_admin, 
                                    client, mock_admin_user, sample_audit_logs):
        """Test successful retrieval of audit logs"""
        # Arrange
        mock_require_admin.return_value = lambda: mock_admin_user
        mock_audit_service.get_role_change_history.return_value = {
            "logs": sample_audit_logs,
            "total_count": 2,
            "page": 1,
            "per_page": 50,
            "total_pages": 1
        }
        
        # Act
        response = client.get("/api/rbac/audit/role-changes")
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert "logs" in data
        assert "total_count" in data
        assert data["total_count"] == 2
        assert len(data["logs"]) == 2
    
    @patch('routers.rbac.require_admin')
    @patch('routers.rbac.audit_service')
    def test_get_audit_logs_with_pagination(self, mock_audit_service, mock_require_admin,
                                           client, mock_admin_user, sample_audit_logs):
        """Test audit logs retrieval with pagination"""
        # Arrange
        mock_require_admin.return_value = lambda: mock_admin_user
        mock_audit_service.get_role_change_history.return_value = {
            "logs": sample_audit_logs[:1],
            "total_count": 2,
            "page": 1,
            "per_page": 1,
            "total_pages": 2
        }
        
        # Act
        response = client.get("/api/rbac/audit/role-changes?limit=1&offset=0")
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["per_page"] == 1
        assert data["page"] == 1
        assert data["total_pages"] == 2
        mock_audit_service.get_role_change_history.assert_called_once()
        call_kwargs = mock_audit_service.get_role_change_history.call_args[1]
        assert call_kwargs["limit"] == 1
        assert call_kwargs["offset"] == 0
    
    @patch('routers.rbac.require_admin')
    @patch('routers.rbac.audit_service')
    def test_get_audit_logs_with_action_filter(self, mock_audit_service, mock_require_admin,
                                               client, mock_admin_user, sample_audit_logs):
        """Test audit logs retrieval with action filter"""
        # Arrange
        mock_require_admin.return_value = lambda: mock_admin_user
        filtered_logs = [log for log in sample_audit_logs 
                        if log["action"] == RBACAction.ROLE_ASSIGNMENT_CREATED]
        mock_audit_service.get_role_change_history.return_value = {
            "logs": filtered_logs,
            "total_count": 1,
            "page": 1,
            "per_page": 50,
            "total_pages": 1
        }
        
        # Act
        response = client.get(
            f"/api/rbac/audit/role-changes?action={RBACAction.ROLE_ASSIGNMENT_CREATED}"
        )
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert len(data["logs"]) == 1
        assert data["logs"][0]["action"] == RBACAction.ROLE_ASSIGNMENT_CREATED
    
    @patch('routers.rbac.require_admin')
    @patch('routers.rbac.audit_service')
    def test_get_audit_logs_with_role_name_filter(self, mock_audit_service, mock_require_admin,
                                                  client, mock_admin_user, sample_audit_logs):
        """Test audit logs retrieval with role name filter"""
        # Arrange
        mock_require_admin.return_value = lambda: mock_admin_user
        mock_audit_service.get_role_change_history.return_value = {
            "logs": sample_audit_logs[:1],
            "total_count": 1,
            "page": 1,
            "per_page": 50,
            "total_pages": 1
        }
        
        # Act
        response = client.get("/api/rbac/audit/role-changes?role_name=project_manager")
        
        # Assert
        assert response.status_code == 200
        call_kwargs = mock_audit_service.get_role_change_history.call_args[1]
        assert call_kwargs["role_name"] == "project_manager"
    
    @patch('routers.rbac.require_admin')
    @patch('routers.rbac.audit_service')
    def test_get_audit_logs_with_date_filters(self, mock_audit_service, mock_require_admin,
                                              client, mock_admin_user, sample_audit_logs):
        """Test audit logs retrieval with date range filters"""
        # Arrange
        mock_require_admin.return_value = lambda: mock_admin_user
        mock_audit_service.get_role_change_history.return_value = {
            "logs": sample_audit_logs,
            "total_count": 2,
            "page": 1,
            "per_page": 50,
            "total_pages": 1
        }
        
        start_date = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        end_date = datetime.now(timezone.utc).isoformat()
        
        # Act
        response = client.get(
            f"/api/rbac/audit/role-changes?start_date={start_date}&end_date={end_date}"
        )
        
        # Assert
        assert response.status_code == 200
        call_kwargs = mock_audit_service.get_role_change_history.call_args[1]
        assert call_kwargs["start_date"] is not None
        assert call_kwargs["end_date"] is not None
    
    @patch('routers.rbac.require_admin')
    def test_get_audit_logs_invalid_date_format(self, mock_require_admin, 
                                                client, mock_admin_user):
        """Test audit logs retrieval with invalid date format"""
        # Arrange
        mock_require_admin.return_value = lambda: mock_admin_user
        
        # Act
        response = client.get("/api/rbac/audit/role-changes?start_date=invalid-date")
        
        # Assert
        assert response.status_code == 400
        assert "Invalid start_date format" in response.json()["detail"]
    
    @patch('routers.rbac.require_admin')
    @patch('routers.rbac.audit_service')
    def test_get_audit_logs_empty_result(self, mock_audit_service, mock_require_admin,
                                        client, mock_admin_user):
        """Test audit logs retrieval with no results"""
        # Arrange
        mock_require_admin.return_value = lambda: mock_admin_user
        mock_audit_service.get_role_change_history.return_value = {
            "logs": [],
            "total_count": 0,
            "page": 1,
            "per_page": 50,
            "total_pages": 0
        }
        
        # Act
        response = client.get("/api/rbac/audit/role-changes")
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert len(data["logs"]) == 0
        assert data["total_count"] == 0


class TestGetUserRoleHistory:
    """Test GET /api/rbac/audit/users/{user_id}/role-history endpoint"""
    
    @patch('routers.rbac.require_admin')
    @patch('routers.rbac.audit_service')
    def test_get_user_role_history_success(self, mock_audit_service, mock_require_admin,
                                          client, mock_admin_user, sample_audit_logs):
        """Test successful retrieval of user role history"""
        # Arrange
        user_id = uuid4()
        mock_require_admin.return_value = lambda: mock_admin_user
        mock_audit_service.get_user_role_history.return_value = sample_audit_logs[:1]
        
        # Act
        response = client.get(f"/api/rbac/audit/users/{user_id}/role-history")
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        mock_audit_service.get_user_role_history.assert_called_once()
    
    @patch('routers.rbac.require_admin')
    @patch('routers.rbac.audit_service')
    def test_get_user_role_history_with_limit(self, mock_audit_service, mock_require_admin,
                                             client, mock_admin_user, sample_audit_logs):
        """Test user role history retrieval with custom limit"""
        # Arrange
        user_id = uuid4()
        mock_require_admin.return_value = lambda: mock_admin_user
        mock_audit_service.get_user_role_history.return_value = sample_audit_logs
        
        # Act
        response = client.get(f"/api/rbac/audit/users/{user_id}/role-history?limit=10")
        
        # Assert
        assert response.status_code == 200
        call_kwargs = mock_audit_service.get_user_role_history.call_args[1]
        assert call_kwargs["limit"] == 10
    
    @patch('routers.rbac.require_admin')
    @patch('routers.rbac.audit_service')
    def test_get_user_role_history_empty(self, mock_audit_service, mock_require_admin,
                                        client, mock_admin_user):
        """Test user role history retrieval with no history"""
        # Arrange
        user_id = uuid4()
        mock_require_admin.return_value = lambda: mock_admin_user
        mock_audit_service.get_user_role_history.return_value = []
        
        # Act
        response = client.get(f"/api/rbac/audit/users/{user_id}/role-history")
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 0


class TestGetRoleModificationHistory:
    """Test GET /api/rbac/audit/roles/{role_id}/modification-history endpoint"""
    
    @patch('routers.rbac.require_admin')
    @patch('routers.rbac.audit_service')
    def test_get_role_modification_history_success(self, mock_audit_service, mock_require_admin,
                                                   client, mock_admin_user, sample_audit_logs):
        """Test successful retrieval of role modification history"""
        # Arrange
        role_id = uuid4()
        mock_require_admin.return_value = lambda: mock_admin_user
        mock_audit_service.get_role_modification_history.return_value = sample_audit_logs[1:]
        
        # Act
        response = client.get(f"/api/rbac/audit/roles/{role_id}/modification-history")
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        mock_audit_service.get_role_modification_history.assert_called_once()
    
    @patch('routers.rbac.require_admin')
    @patch('routers.rbac.audit_service')
    def test_get_role_modification_history_with_limit(self, mock_audit_service, mock_require_admin,
                                                      client, mock_admin_user, sample_audit_logs):
        """Test role modification history retrieval with custom limit"""
        # Arrange
        role_id = uuid4()
        mock_require_admin.return_value = lambda: mock_admin_user
        mock_audit_service.get_role_modification_history.return_value = sample_audit_logs
        
        # Act
        response = client.get(f"/api/rbac/audit/roles/{role_id}/modification-history?limit=25")
        
        # Assert
        assert response.status_code == 200
        call_kwargs = mock_audit_service.get_role_modification_history.call_args[1]
        assert call_kwargs["limit"] == 25


class TestAuditLogSecurity:
    """Test security aspects of audit log endpoints"""
    
    def test_audit_logs_require_admin_permission(self, client):
        """Test that audit log endpoints require admin permission"""
        # Act
        response = client.get("/api/rbac/audit/role-changes")
        
        # Assert - should fail without admin permission
        # The actual status code depends on authentication setup
        assert response.status_code in [401, 403]
    
    @patch('routers.rbac.require_admin')
    @patch('routers.rbac.audit_service')
    def test_audit_logs_organization_isolation(self, mock_audit_service, mock_require_admin,
                                              client, mock_admin_user, sample_audit_logs):
        """Test that audit logs respect organization boundaries"""
        # Arrange
        mock_require_admin.return_value = lambda: mock_admin_user
        
        # Filter logs to only include those from admin's organization
        org_id = mock_admin_user["organization_id"]
        filtered_logs = [log for log in sample_audit_logs 
                        if log["organization_id"] == org_id]
        
        mock_audit_service.get_role_change_history.return_value = {
            "logs": filtered_logs,
            "total_count": len(filtered_logs),
            "page": 1,
            "per_page": 50,
            "total_pages": 1
        }
        
        # Act
        response = client.get("/api/rbac/audit/role-changes")
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        # All returned logs should be from the same organization
        for log in data["logs"]:
            assert log["organization_id"] == org_id


class TestAuditLogDataIntegrity:
    """Test data integrity of audit logs"""
    
    @patch('routers.rbac.require_admin')
    @patch('routers.rbac.audit_service')
    def test_audit_log_contains_required_fields(self, mock_audit_service, mock_require_admin,
                                                client, mock_admin_user, sample_audit_logs):
        """Test that audit logs contain all required fields"""
        # Arrange
        mock_require_admin.return_value = lambda: mock_admin_user
        mock_audit_service.get_role_change_history.return_value = {
            "logs": sample_audit_logs,
            "total_count": 2,
            "page": 1,
            "per_page": 50,
            "total_pages": 1
        }
        
        # Act
        response = client.get("/api/rbac/audit/role-changes")
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        
        required_fields = ["id", "organization_id", "user_id", "action", 
                          "entity_type", "entity_id", "details", "success", "created_at"]
        
        for log in data["logs"]:
            for field in required_fields:
                assert field in log, f"Missing required field: {field}"
    
    @patch('routers.rbac.require_admin')
    @patch('routers.rbac.audit_service')
    def test_audit_log_timestamps_are_valid(self, mock_audit_service, mock_require_admin,
                                           client, mock_admin_user, sample_audit_logs):
        """Test that audit log timestamps are valid ISO format"""
        # Arrange
        mock_require_admin.return_value = lambda: mock_admin_user
        mock_audit_service.get_role_change_history.return_value = {
            "logs": sample_audit_logs,
            "total_count": 2,
            "page": 1,
            "per_page": 50,
            "total_pages": 1
        }
        
        # Act
        response = client.get("/api/rbac/audit/role-changes")
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        
        for log in data["logs"]:
            # Should be able to parse as ISO format datetime
            datetime.fromisoformat(log["created_at"].replace('Z', '+00:00'))


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
