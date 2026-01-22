"""
Unit tests for RBAC Audit Service

Tests comprehensive audit logging for role and permission changes.

Requirements: 4.5 - Audit logging for role and permission changes
"""

import pytest
from datetime import datetime, timezone
from uuid import uuid4, UUID
from unittest.mock import Mock, MagicMock, patch

from services.rbac_audit_service import (
    RBACAuditService,
    RBACAction,
    RBACEntityType
)


@pytest.fixture
def mock_supabase():
    """Create a mock Supabase client"""
    mock = Mock()
    mock.table = Mock(return_value=mock)
    mock.insert = Mock(return_value=mock)
    mock.select = Mock(return_value=mock)
    mock.eq = Mock(return_value=mock)
    mock.in_ = Mock(return_value=mock)
    mock.contains = Mock(return_value=mock)
    mock.gte = Mock(return_value=mock)
    mock.lte = Mock(return_value=mock)
    mock.order = Mock(return_value=mock)
    mock.range = Mock(return_value=mock)
    mock.limit = Mock(return_value=mock)
    mock.execute = Mock()
    return mock


@pytest.fixture
def audit_service(mock_supabase):
    """Create an audit service with mocked Supabase client"""
    return RBACAuditService(supabase_client=mock_supabase)


class TestRoleAssignmentLogging:
    """Test role assignment audit logging"""
    
    def test_log_role_assignment_success(self, audit_service, mock_supabase):
        """Test successful role assignment logging"""
        # Arrange
        user_id = uuid4()
        target_user_id = uuid4()
        role_id = uuid4()
        role_name = "project_manager"
        org_id = uuid4()
        
        mock_response = Mock()
        mock_response.data = [{"id": str(uuid4())}]
        mock_supabase.execute.return_value = mock_response
        
        # Act
        result = audit_service.log_role_assignment(
            user_id=user_id,
            target_user_id=target_user_id,
            role_id=role_id,
            role_name=role_name,
            organization_id=org_id,
            success=True
        )
        
        # Assert
        assert result is not None
        mock_supabase.table.assert_called_with("audit_logs")
        mock_supabase.insert.assert_called_once()
        
        # Verify the audit log structure
        call_args = mock_supabase.insert.call_args[0][0]
        assert call_args["action"] == RBACAction.ROLE_ASSIGNMENT_CREATED
        assert call_args["entity_type"] == RBACEntityType.USER_ROLE
        assert call_args["user_id"] == str(user_id)
        assert call_args["success"] is True
        assert call_args["details"]["target_user_id"] == str(target_user_id)
        assert call_args["details"]["role_name"] == role_name
    
    def test_log_role_assignment_with_scope(self, audit_service, mock_supabase):
        """Test role assignment logging with scope information"""
        # Arrange
        user_id = uuid4()
        target_user_id = uuid4()
        role_id = uuid4()
        role_name = "project_manager"
        scope_type = "project"
        scope_id = uuid4()
        
        mock_response = Mock()
        mock_response.data = [{"id": str(uuid4())}]
        mock_supabase.execute.return_value = mock_response
        
        # Act
        result = audit_service.log_role_assignment(
            user_id=user_id,
            target_user_id=target_user_id,
            role_id=role_id,
            role_name=role_name,
            scope_type=scope_type,
            scope_id=scope_id,
            success=True
        )
        
        # Assert
        assert result is not None
        call_args = mock_supabase.insert.call_args[0][0]
        assert call_args["details"]["scope_type"] == scope_type
        assert call_args["details"]["scope_id"] == str(scope_id)
    
    def test_log_role_assignment_failure(self, audit_service, mock_supabase):
        """Test logging of failed role assignment"""
        # Arrange
        user_id = uuid4()
        target_user_id = uuid4()
        role_id = uuid4()
        role_name = "admin"
        error_message = "Insufficient permissions"
        
        mock_response = Mock()
        mock_response.data = [{"id": str(uuid4())}]
        mock_supabase.execute.return_value = mock_response
        
        # Act
        result = audit_service.log_role_assignment(
            user_id=user_id,
            target_user_id=target_user_id,
            role_id=role_id,
            role_name=role_name,
            success=False,
            error_message=error_message
        )
        
        # Assert
        assert result is not None
        call_args = mock_supabase.insert.call_args[0][0]
        assert call_args["success"] is False
        assert call_args["details"]["error_message"] == error_message


class TestRoleRemovalLogging:
    """Test role removal audit logging"""
    
    def test_log_role_removal_success(self, audit_service, mock_supabase):
        """Test successful role removal logging"""
        # Arrange
        user_id = uuid4()
        target_user_id = uuid4()
        role_id = uuid4()
        role_name = "viewer"
        
        mock_response = Mock()
        mock_response.data = [{"id": str(uuid4())}]
        mock_supabase.execute.return_value = mock_response
        
        # Act
        result = audit_service.log_role_removal(
            user_id=user_id,
            target_user_id=target_user_id,
            role_id=role_id,
            role_name=role_name,
            success=True
        )
        
        # Assert
        assert result is not None
        call_args = mock_supabase.insert.call_args[0][0]
        assert call_args["action"] == RBACAction.ROLE_ASSIGNMENT_REMOVED
        assert call_args["details"]["target_user_id"] == str(target_user_id)
        assert call_args["details"]["role_name"] == role_name


class TestCustomRoleLogging:
    """Test custom role creation, update, and deletion logging"""
    
    def test_log_custom_role_creation(self, audit_service, mock_supabase):
        """Test custom role creation logging"""
        # Arrange
        user_id = uuid4()
        role_id = uuid4()
        role_name = "custom_analyst"
        permissions = ["project_read", "financial_read", "report_read"]
        description = "Custom analyst role with read permissions"
        
        mock_response = Mock()
        mock_response.data = [{"id": str(uuid4())}]
        mock_supabase.execute.return_value = mock_response
        
        # Act
        result = audit_service.log_custom_role_creation(
            user_id=user_id,
            role_id=role_id,
            role_name=role_name,
            permissions=permissions,
            description=description,
            success=True
        )
        
        # Assert
        assert result is not None
        call_args = mock_supabase.insert.call_args[0][0]
        assert call_args["action"] == RBACAction.CUSTOM_ROLE_CREATED
        assert call_args["entity_type"] == RBACEntityType.ROLE
        assert call_args["details"]["role_name"] == role_name
        assert call_args["details"]["permissions"] == permissions
        assert call_args["details"]["permissions_count"] == len(permissions)
        assert call_args["details"]["description"] == description
    
    def test_log_custom_role_update(self, audit_service, mock_supabase):
        """Test custom role update logging with permission changes"""
        # Arrange
        user_id = uuid4()
        role_id = uuid4()
        role_name = "custom_analyst"
        old_permissions = ["project_read", "financial_read"]
        new_permissions = ["project_read", "financial_read", "report_read", "risk_read"]
        old_description = "Old description"
        new_description = "Updated description"
        
        mock_response = Mock()
        mock_response.data = [{"id": str(uuid4())}]
        mock_supabase.execute.return_value = mock_response
        
        # Act
        result = audit_service.log_custom_role_update(
            user_id=user_id,
            role_id=role_id,
            role_name=role_name,
            old_permissions=old_permissions,
            new_permissions=new_permissions,
            old_description=old_description,
            new_description=new_description,
            success=True
        )
        
        # Assert
        assert result is not None
        call_args = mock_supabase.insert.call_args[0][0]
        assert call_args["action"] == RBACAction.CUSTOM_ROLE_UPDATED
        assert call_args["details"]["old_permissions"] == old_permissions
        assert call_args["details"]["new_permissions"] == new_permissions
        assert set(call_args["details"]["added_permissions"]) == {"report_read", "risk_read"}
        assert call_args["details"]["removed_permissions"] == []
        assert call_args["details"]["description_changed"] is True
    
    def test_log_custom_role_deletion(self, audit_service, mock_supabase):
        """Test custom role deletion logging"""
        # Arrange
        user_id = uuid4()
        role_id = uuid4()
        role_name = "deprecated_role"
        permissions = ["project_read"]
        affected_users_count = 5
        
        mock_response = Mock()
        mock_response.data = [{"id": str(uuid4())}]
        mock_supabase.execute.return_value = mock_response
        
        # Act
        result = audit_service.log_custom_role_deletion(
            user_id=user_id,
            role_id=role_id,
            role_name=role_name,
            permissions=permissions,
            affected_users_count=affected_users_count,
            success=True
        )
        
        # Assert
        assert result is not None
        call_args = mock_supabase.insert.call_args[0][0]
        assert call_args["action"] == RBACAction.CUSTOM_ROLE_DELETED
        assert call_args["details"]["role_name"] == role_name
        assert call_args["details"]["affected_users"] == affected_users_count


class TestAuditHistoryRetrieval:
    """Test audit history retrieval methods"""
    
    def test_get_role_change_history_basic(self, audit_service, mock_supabase):
        """Test basic role change history retrieval"""
        # Arrange
        mock_response = Mock()
        mock_response.data = [
            {
                "id": str(uuid4()),
                "action": RBACAction.ROLE_ASSIGNMENT_CREATED,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        ]
        mock_response.count = 1
        mock_supabase.execute.return_value = mock_response
        
        # Act
        result = audit_service.get_role_change_history(limit=10, offset=0)
        
        # Assert
        assert result["total_count"] == 1
        assert len(result["logs"]) == 1
        assert result["page"] == 1
        assert result["per_page"] == 10
    
    def test_get_role_change_history_with_filters(self, audit_service, mock_supabase):
        """Test role change history retrieval with filters"""
        # Arrange
        user_id = uuid4()
        role_name = "admin"
        
        mock_response = Mock()
        mock_response.data = []
        mock_response.count = 0
        mock_supabase.execute.return_value = mock_response
        
        # Act
        result = audit_service.get_role_change_history(
            limit=20,
            offset=0,
            user_id=user_id,
            role_name=role_name
        )
        
        # Assert
        mock_supabase.eq.assert_called()
        mock_supabase.contains.assert_called()
    
    def test_get_user_role_history(self, audit_service, mock_supabase):
        """Test user-specific role history retrieval"""
        # Arrange
        target_user_id = uuid4()
        
        mock_response = Mock()
        mock_response.data = [
            {
                "id": str(uuid4()),
                "action": RBACAction.ROLE_ASSIGNMENT_CREATED,
                "details": {"target_user_id": str(target_user_id)}
            }
        ]
        mock_supabase.execute.return_value = mock_response
        
        # Act
        result = audit_service.get_user_role_history(
            target_user_id=target_user_id,
            limit=50
        )
        
        # Assert
        assert len(result) == 1
        mock_supabase.contains.assert_called()
    
    def test_get_role_modification_history(self, audit_service, mock_supabase):
        """Test role-specific modification history retrieval"""
        # Arrange
        role_id = uuid4()
        
        mock_response = Mock()
        mock_response.data = [
            {
                "id": str(uuid4()),
                "action": RBACAction.CUSTOM_ROLE_CREATED,
                "entity_id": str(role_id)
            }
        ]
        mock_supabase.execute.return_value = mock_response
        
        # Act
        result = audit_service.get_role_modification_history(
            role_id=role_id,
            limit=50
        )
        
        # Assert
        assert len(result) == 1
        mock_supabase.eq.assert_called_with("entity_id", str(role_id))


class TestErrorHandling:
    """Test error handling in audit service"""
    
    def test_log_role_assignment_database_error(self, audit_service, mock_supabase):
        """Test handling of database errors during logging"""
        # Arrange
        mock_supabase.execute.side_effect = Exception("Database connection failed")
        
        # Act
        result = audit_service.log_role_assignment(
            user_id=uuid4(),
            target_user_id=uuid4(),
            role_id=uuid4(),
            role_name="test_role",
            success=True
        )
        
        # Assert - should return None on error
        assert result is None
    
    def test_get_role_change_history_database_error(self, audit_service, mock_supabase):
        """Test handling of database errors during history retrieval"""
        # Arrange
        mock_supabase.execute.side_effect = Exception("Query failed")
        
        # Act
        result = audit_service.get_role_change_history(limit=10, offset=0)
        
        # Assert - should return empty result with error
        assert result["total_count"] == 0
        assert len(result["logs"]) == 0
        assert "error" in result


class TestAuditLogCompleteness:
    """Test that audit logs contain all required information"""
    
    def test_audit_log_contains_timestamp(self, audit_service, mock_supabase):
        """Test that audit logs include creation timestamp"""
        # Arrange
        mock_response = Mock()
        mock_response.data = [{"id": str(uuid4())}]
        mock_supabase.execute.return_value = mock_response
        
        # Act
        audit_service.log_role_assignment(
            user_id=uuid4(),
            target_user_id=uuid4(),
            role_id=uuid4(),
            role_name="test_role",
            success=True
        )
        
        # Assert
        call_args = mock_supabase.insert.call_args[0][0]
        assert "created_at" in call_args
        # Verify it's a valid ISO format timestamp
        datetime.fromisoformat(call_args["created_at"].replace('Z', '+00:00'))
    
    def test_audit_log_contains_organization_context(self, audit_service, mock_supabase):
        """Test that audit logs include organization context"""
        # Arrange
        org_id = uuid4()
        mock_response = Mock()
        mock_response.data = [{"id": str(uuid4())}]
        mock_supabase.execute.return_value = mock_response
        
        # Act
        audit_service.log_role_assignment(
            user_id=uuid4(),
            target_user_id=uuid4(),
            role_id=uuid4(),
            role_name="test_role",
            organization_id=org_id,
            success=True
        )
        
        # Assert
        call_args = mock_supabase.insert.call_args[0][0]
        assert call_args["organization_id"] == str(org_id)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
