"""
Tests for RBAC Error Handler Module

This module tests the HTTP status code handling and error responses
for permission failures in the RBAC system.

Tests cover:
- Proper 401/403 error responses for permission failures
- Detailed error messages with required permissions information
- Permission denial logging and security event tracking

Requirements: 1.3 - HTTP Status Code Correctness
"""

import pytest
from datetime import datetime, timezone
from uuid import UUID, uuid4
from unittest.mock import Mock, AsyncMock, patch
from fastapi import Request, status
from fastapi.testclient import TestClient

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from auth.rbac import Permission
from auth.enhanced_rbac_models import PermissionContext
from auth.rbac_error_handler import (
    SecurityEventType,
    PermissionError,
    MultiplePermissionsError,
    AuthenticationError,
    SecurityEvent,
    PermissionDeniedResponse,
    AuthenticationRequiredResponse,
    RBACErrorHandler,
    create_permission_denied_response,
    create_authentication_required_response,
    raise_permission_denied,
    raise_authentication_required,
    get_rbac_error_handler,
)


class TestPermissionError:
    """Tests for PermissionError exception class."""
    
    def test_permission_error_creation_with_uuid(self):
        """Test creating PermissionError with UUID user_id."""
        user_id = uuid4()
        permission = Permission.project_read
        
        error = PermissionError(user_id, permission)
        
        assert error.user_id == user_id
        assert error.permission == permission
        assert error.context is None
        assert "lacks permission" in str(error)
    
    def test_permission_error_creation_with_string_id(self):
        """Test creating PermissionError with string user_id."""
        user_id_str = "123e4567-e89b-12d3-a456-426614174000"
        permission = Permission.project_update
        
        error = PermissionError(user_id_str, permission)
        
        assert str(error.user_id) == user_id_str
        assert error.permission == permission
    
    def test_permission_error_with_context(self):
        """Test creating PermissionError with context."""
        user_id = uuid4()
        permission = Permission.project_delete
        context = PermissionContext(project_id=uuid4())
        
        error = PermissionError(user_id, permission, context)
        
        assert error.context == context
        assert error.context.project_id is not None
    
    def test_permission_error_with_custom_message(self):
        """Test creating PermissionError with custom message."""
        user_id = uuid4()
        permission = Permission.admin_read
        custom_message = "Custom error message"
        
        error = PermissionError(user_id, permission, message=custom_message)
        
        assert error.message == custom_message
        assert str(error) == custom_message
    
    def test_permission_error_to_dict(self):
        """Test converting PermissionError to dictionary."""
        user_id = uuid4()
        permission = Permission.financial_read
        context = PermissionContext(portfolio_id=uuid4())
        
        error = PermissionError(user_id, permission, context)
        error_dict = error.to_dict()
        
        assert error_dict["user_id"] == str(user_id)
        assert error_dict["permission"] == permission.value
        assert error_dict["context"] is not None
        assert "timestamp" in error_dict
    
    def test_permission_error_timestamp(self):
        """Test that PermissionError has a timestamp."""
        error = PermissionError(uuid4(), Permission.project_read)
        
        assert error.timestamp is not None
        assert isinstance(error.timestamp, datetime)
        # Timestamp should be recent (within last minute)
        time_diff = datetime.now(timezone.utc) - error.timestamp
        assert time_diff.total_seconds() < 60


class TestMultiplePermissionsError:
    """Tests for MultiplePermissionsError exception class."""
    
    def test_multiple_permissions_error_creation(self):
        """Test creating MultiplePermissionsError."""
        user_id = uuid4()
        required = [Permission.project_read, Permission.project_update]
        missing = [Permission.project_update]
        
        error = MultiplePermissionsError(user_id, required, missing)
        
        assert error.user_id == user_id
        assert error.required_permissions == required
        assert error.missing_permissions == missing
    
    def test_multiple_permissions_error_message(self):
        """Test MultiplePermissionsError message contains missing permissions."""
        user_id = uuid4()
        required = [Permission.project_read, Permission.project_update, Permission.project_delete]
        missing = [Permission.project_update, Permission.project_delete]
        
        error = MultiplePermissionsError(user_id, required, missing)
        
        assert "project_update" in str(error)
        assert "project_delete" in str(error)
    
    def test_multiple_permissions_error_to_dict(self):
        """Test converting MultiplePermissionsError to dictionary."""
        user_id = uuid4()
        required = [Permission.project_read, Permission.project_update]
        missing = [Permission.project_update]
        
        error = MultiplePermissionsError(user_id, required, missing)
        error_dict = error.to_dict()
        
        assert error_dict["user_id"] == str(user_id)
        assert len(error_dict["required_permissions"]) == 2
        assert len(error_dict["missing_permissions"]) == 1


class TestAuthenticationError:
    """Tests for AuthenticationError exception class."""
    
    def test_authentication_error_default_message(self):
        """Test AuthenticationError with default message."""
        error = AuthenticationError()
        
        assert error.message == "Authentication required"
        assert error.reason is None
    
    def test_authentication_error_custom_message(self):
        """Test AuthenticationError with custom message."""
        error = AuthenticationError(message="Token expired", reason="jwt_expired")
        
        assert error.message == "Token expired"
        assert error.reason == "jwt_expired"
    
    def test_authentication_error_to_dict(self):
        """Test converting AuthenticationError to dictionary."""
        error = AuthenticationError(message="Invalid token", reason="invalid_signature")
        error_dict = error.to_dict()
        
        assert error_dict["message"] == "Invalid token"
        assert error_dict["reason"] == "invalid_signature"
        assert "timestamp" in error_dict


class TestSecurityEvent:
    """Tests for SecurityEvent model."""
    
    def test_security_event_creation(self):
        """Test creating SecurityEvent."""
        event = SecurityEvent(
            event_type=SecurityEventType.PERMISSION_DENIED,
            user_id="user-123",
            permission="project_read",
            request_path="/api/projects"
        )
        
        assert event.event_type == SecurityEventType.PERMISSION_DENIED
        assert event.user_id == "user-123"
        assert event.permission == "project_read"
        assert event.request_path == "/api/projects"
    
    def test_security_event_with_multiple_permissions(self):
        """Test SecurityEvent with multiple permissions."""
        event = SecurityEvent(
            event_type=SecurityEventType.PERMISSION_DENIED,
            user_id="user-123",
            permissions=["project_read", "project_update"]
        )
        
        assert event.permissions == ["project_read", "project_update"]
    
    def test_security_event_timestamp_auto_generated(self):
        """Test that SecurityEvent timestamp is auto-generated."""
        event = SecurityEvent(event_type=SecurityEventType.AUTHENTICATION_FAILED)
        
        assert event.timestamp is not None
        time_diff = datetime.now(timezone.utc) - event.timestamp
        assert time_diff.total_seconds() < 60


class TestRBACErrorHandler:
    """Tests for RBACErrorHandler class."""
    
    @pytest.fixture
    def error_handler(self):
        """Create an RBACErrorHandler instance for testing."""
        return RBACErrorHandler(supabase_client=None, enable_logging=True)
    
    @pytest.fixture
    def mock_request(self):
        """Create a mock FastAPI request."""
        request = Mock(spec=Request)
        request.url = Mock()
        request.url.path = "/api/projects/123"
        request.method = "GET"
        request.headers = {"user-agent": "test-agent"}
        request.client = Mock()
        request.client.host = "127.0.0.1"
        return request
    
    @pytest.mark.asyncio
    async def test_handle_permission_denied_returns_403(self, error_handler, mock_request):
        """Test that handle_permission_denied returns 403 status code."""
        user_id = uuid4()
        permission = Permission.project_read
        error = PermissionError(user_id, permission)
        
        response = await error_handler.handle_permission_denied(error, mock_request)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    @pytest.mark.asyncio
    async def test_handle_permission_denied_response_content(self, error_handler, mock_request):
        """Test that handle_permission_denied returns correct content."""
        user_id = uuid4()
        permission = Permission.project_update
        error = PermissionError(user_id, permission)
        
        response = await error_handler.handle_permission_denied(error, mock_request)
        
        import json
        content = json.loads(response.body.decode())
        
        assert content["error"] == "insufficient_permissions"
        assert content["required_permission"] == "project_update"
        assert "Permission" in content["message"]
    
    @pytest.mark.asyncio
    async def test_handle_permission_denied_with_context(self, error_handler, mock_request):
        """Test handle_permission_denied includes context in response."""
        user_id = uuid4()
        permission = Permission.project_delete
        project_id = uuid4()
        context = PermissionContext(project_id=project_id)
        error = PermissionError(user_id, permission, context)
        
        response = await error_handler.handle_permission_denied(error, mock_request)
        
        import json
        content = json.loads(response.body.decode())
        
        assert content["context"] is not None
        assert content["context"]["project_id"] == str(project_id)
    
    @pytest.mark.asyncio
    async def test_handle_multiple_permissions_denied_returns_403(self, error_handler, mock_request):
        """Test that handle_multiple_permissions_denied returns 403."""
        user_id = uuid4()
        required = [Permission.project_read, Permission.project_update]
        missing = [Permission.project_update]
        error = MultiplePermissionsError(user_id, required, missing)
        
        response = await error_handler.handle_multiple_permissions_denied(error, mock_request)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    @pytest.mark.asyncio
    async def test_handle_multiple_permissions_denied_lists_permissions(self, error_handler, mock_request):
        """Test that response lists required permissions."""
        user_id = uuid4()
        required = [Permission.project_read, Permission.project_update]
        missing = [Permission.project_update]
        error = MultiplePermissionsError(user_id, required, missing)
        
        response = await error_handler.handle_multiple_permissions_denied(error, mock_request)
        
        import json
        content = json.loads(response.body.decode())
        
        assert "required_permissions" in content
        assert "project_read" in content["required_permissions"]
        assert "project_update" in content["required_permissions"]
    
    @pytest.mark.asyncio
    async def test_handle_authentication_failed_returns_401(self, error_handler, mock_request):
        """Test that handle_authentication_failed returns 401 status code."""
        error = AuthenticationError()
        
        response = await error_handler.handle_authentication_failed(error, mock_request)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    @pytest.mark.asyncio
    async def test_handle_authentication_failed_includes_www_authenticate_header(self, error_handler, mock_request):
        """Test that 401 response includes WWW-Authenticate header."""
        error = AuthenticationError()
        
        response = await error_handler.handle_authentication_failed(error, mock_request)
        
        assert "www-authenticate" in response.headers
        assert response.headers["www-authenticate"] == "Bearer"
    
    @pytest.mark.asyncio
    async def test_handle_authentication_failed_response_content(self, error_handler, mock_request):
        """Test that handle_authentication_failed returns correct content."""
        error = AuthenticationError(message="Token expired", reason="jwt_expired")
        
        response = await error_handler.handle_authentication_failed(error, mock_request)
        
        import json
        content = json.loads(response.body.decode())
        
        assert content["error"] == "authentication_required"
        assert content["message"] == "Token expired"
        assert content["reason"] == "jwt_expired"
    
    @pytest.mark.asyncio
    async def test_log_security_event_adds_to_buffer(self, error_handler):
        """Test that log_security_event adds event to in-memory buffer."""
        await error_handler.log_security_event(
            event_type=SecurityEventType.PERMISSION_DENIED,
            user_id="user-123",
            permission="project_read"
        )
        
        events = error_handler.get_recent_events()
        assert len(events) == 1
        assert events[0].event_type == SecurityEventType.PERMISSION_DENIED
        assert events[0].user_id == "user-123"
    
    @pytest.mark.asyncio
    async def test_log_security_event_with_request_info(self, error_handler, mock_request):
        """Test that log_security_event captures request information."""
        await error_handler.log_security_event(
            event_type=SecurityEventType.PERMISSION_DENIED,
            user_id="user-123",
            permission="project_read",
            request=mock_request
        )
        
        events = error_handler.get_recent_events()
        assert len(events) == 1
        assert events[0].request_path == "/api/projects/123"
        assert events[0].request_method == "GET"
        assert events[0].client_ip == "127.0.0.1"
    
    def test_get_recent_events_filter_by_type(self, error_handler):
        """Test filtering recent events by type."""
        # Add events directly to buffer for testing
        error_handler._security_events.append(
            SecurityEvent(event_type=SecurityEventType.PERMISSION_DENIED, user_id="user-1")
        )
        error_handler._security_events.append(
            SecurityEvent(event_type=SecurityEventType.AUTHENTICATION_FAILED, user_id="user-2")
        )
        error_handler._security_events.append(
            SecurityEvent(event_type=SecurityEventType.PERMISSION_DENIED, user_id="user-3")
        )
        
        permission_events = error_handler.get_recent_events(
            event_type=SecurityEventType.PERMISSION_DENIED
        )
        
        assert len(permission_events) == 2
        assert all(e.event_type == SecurityEventType.PERMISSION_DENIED for e in permission_events)
    
    def test_get_recent_events_filter_by_user(self, error_handler):
        """Test filtering recent events by user ID."""
        error_handler._security_events.append(
            SecurityEvent(event_type=SecurityEventType.PERMISSION_DENIED, user_id="user-1")
        )
        error_handler._security_events.append(
            SecurityEvent(event_type=SecurityEventType.PERMISSION_DENIED, user_id="user-2")
        )
        error_handler._security_events.append(
            SecurityEvent(event_type=SecurityEventType.PERMISSION_DENIED, user_id="user-1")
        )
        
        user_events = error_handler.get_recent_events(user_id="user-1")
        
        assert len(user_events) == 2
        assert all(e.user_id == "user-1" for e in user_events)
    
    def test_clear_events(self, error_handler):
        """Test clearing security events buffer."""
        error_handler._security_events.append(
            SecurityEvent(event_type=SecurityEventType.PERMISSION_DENIED)
        )
        error_handler._security_events.append(
            SecurityEvent(event_type=SecurityEventType.AUTHENTICATION_FAILED)
        )
        
        error_handler.clear_events()
        
        assert len(error_handler.get_recent_events()) == 0


class TestConvenienceFunctions:
    """Tests for convenience functions."""
    
    def test_create_permission_denied_response_returns_403(self):
        """Test create_permission_denied_response returns 403."""
        response = create_permission_denied_response(Permission.project_read)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    def test_create_permission_denied_response_content(self):
        """Test create_permission_denied_response content."""
        response = create_permission_denied_response(
            Permission.project_update,
            message="Custom message"
        )
        
        import json
        content = json.loads(response.body.decode())
        
        assert content["error"] == "insufficient_permissions"
        assert content["required_permission"] == "project_update"
        assert content["message"] == "Custom message"
    
    def test_create_authentication_required_response_returns_401(self):
        """Test create_authentication_required_response returns 401."""
        response = create_authentication_required_response()
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_create_authentication_required_response_has_header(self):
        """Test create_authentication_required_response has WWW-Authenticate header."""
        response = create_authentication_required_response()
        
        assert "www-authenticate" in response.headers
    
    def test_raise_permission_denied_raises_http_exception(self):
        """Test raise_permission_denied raises HTTPException."""
        from fastapi import HTTPException
        
        with pytest.raises(HTTPException) as exc_info:
            raise_permission_denied(uuid4(), Permission.project_read)
        
        assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
    
    def test_raise_permission_denied_exception_detail(self):
        """Test raise_permission_denied exception detail."""
        from fastapi import HTTPException
        
        with pytest.raises(HTTPException) as exc_info:
            raise_permission_denied(uuid4(), Permission.project_update)
        
        detail = exc_info.value.detail
        assert detail["error"] == "insufficient_permissions"
        assert detail["required_permission"] == "project_update"
    
    def test_raise_authentication_required_raises_http_exception(self):
        """Test raise_authentication_required raises HTTPException."""
        from fastapi import HTTPException
        
        with pytest.raises(HTTPException) as exc_info:
            raise_authentication_required()
        
        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_raise_authentication_required_with_reason(self):
        """Test raise_authentication_required with reason."""
        from fastapi import HTTPException
        
        with pytest.raises(HTTPException) as exc_info:
            raise_authentication_required(message="Token expired", reason="jwt_expired")
        
        detail = exc_info.value.detail
        assert detail["message"] == "Token expired"
        assert detail["reason"] == "jwt_expired"


class TestResponseModels:
    """Tests for response models."""
    
    def test_permission_denied_response_model(self):
        """Test PermissionDeniedResponse model."""
        response = PermissionDeniedResponse(
            message="Permission required",
            required_permission="project_read"
        )
        
        assert response.error == "insufficient_permissions"
        assert response.message == "Permission required"
        assert response.required_permission == "project_read"
        assert response.timestamp is not None
    
    def test_permission_denied_response_with_multiple_permissions(self):
        """Test PermissionDeniedResponse with multiple permissions."""
        response = PermissionDeniedResponse(
            message="Multiple permissions required",
            required_permissions=["project_read", "project_update"]
        )
        
        assert response.required_permissions == ["project_read", "project_update"]
    
    def test_authentication_required_response_model(self):
        """Test AuthenticationRequiredResponse model."""
        response = AuthenticationRequiredResponse(
            message="Authentication required",
            reason="no_token"
        )
        
        assert response.error == "authentication_required"
        assert response.message == "Authentication required"
        assert response.reason == "no_token"
        assert response.timestamp is not None


class TestSecurityEventTypes:
    """Tests for SecurityEventType enum."""
    
    def test_all_event_types_exist(self):
        """Test that all expected event types exist."""
        expected_types = [
            "permission_denied",
            "authentication_failed",
            "authentication_expired",
            "invalid_token",
            "unauthorized_access_attempt",
            "role_escalation_attempt",
            "suspicious_activity"
        ]
        
        for event_type in expected_types:
            assert hasattr(SecurityEventType, event_type.upper())
    
    def test_event_type_values(self):
        """Test that event type values are correct."""
        assert SecurityEventType.PERMISSION_DENIED.value == "permission_denied"
        assert SecurityEventType.AUTHENTICATION_FAILED.value == "authentication_failed"


class TestGetRBACErrorHandler:
    """Tests for get_rbac_error_handler singleton function."""
    
    def test_get_rbac_error_handler_returns_instance(self):
        """Test that get_rbac_error_handler returns an instance."""
        # Reset singleton for testing
        import auth.rbac_error_handler as module
        module._rbac_error_handler = None
        
        handler = get_rbac_error_handler()
        
        assert handler is not None
        assert isinstance(handler, RBACErrorHandler)
    
    def test_get_rbac_error_handler_returns_same_instance(self):
        """Test that get_rbac_error_handler returns the same instance."""
        handler1 = get_rbac_error_handler()
        handler2 = get_rbac_error_handler()
        
        assert handler1 is handler2


class TestClientIPExtraction:
    """Tests for client IP extraction from requests."""
    
    @pytest.fixture
    def error_handler(self):
        return RBACErrorHandler(enable_logging=True)
    
    def test_extract_ip_from_x_forwarded_for(self, error_handler):
        """Test extracting IP from X-Forwarded-For header."""
        request = Mock(spec=Request)
        request.headers = {"x-forwarded-for": "192.168.1.1, 10.0.0.1"}
        request.client = None
        
        ip = error_handler._get_client_ip(request)
        
        assert ip == "192.168.1.1"
    
    def test_extract_ip_from_x_real_ip(self, error_handler):
        """Test extracting IP from X-Real-IP header."""
        request = Mock(spec=Request)
        request.headers = {"x-real-ip": "192.168.1.2"}
        request.client = None
        
        ip = error_handler._get_client_ip(request)
        
        assert ip == "192.168.1.2"
    
    def test_extract_ip_from_client(self, error_handler):
        """Test extracting IP from request client."""
        request = Mock(spec=Request)
        request.headers = {}
        request.client = Mock()
        request.client.host = "192.168.1.3"
        
        ip = error_handler._get_client_ip(request)
        
        assert ip == "192.168.1.3"
    
    def test_extract_ip_returns_none_when_unavailable(self, error_handler):
        """Test that None is returned when IP is unavailable."""
        request = Mock(spec=Request)
        request.headers = {}
        request.client = None
        
        ip = error_handler._get_client_ip(request)
        
        assert ip is None


class TestLogMessageFormatting:
    """Tests for log message formatting."""
    
    @pytest.fixture
    def error_handler(self):
        return RBACErrorHandler(enable_logging=True)
    
    def test_format_log_message_basic(self, error_handler):
        """Test basic log message formatting."""
        event = SecurityEvent(
            event_type=SecurityEventType.PERMISSION_DENIED,
            user_id="user-123",
            permission="project_read"
        )
        
        message = error_handler._format_log_message(event)
        
        assert "permission_denied" in message
        assert "user-123" in message
        assert "project_read" in message
    
    def test_format_log_message_with_request_info(self, error_handler):
        """Test log message formatting with request info."""
        event = SecurityEvent(
            event_type=SecurityEventType.PERMISSION_DENIED,
            user_id="user-123",
            permission="project_read",
            request_path="/api/projects",
            request_method="GET",
            client_ip="192.168.1.1"
        )
        
        message = error_handler._format_log_message(event)
        
        assert "/api/projects" in message
        assert "GET" in message
        assert "192.168.1.1" in message
    
    def test_format_log_message_with_multiple_permissions(self, error_handler):
        """Test log message formatting with multiple permissions."""
        event = SecurityEvent(
            event_type=SecurityEventType.PERMISSION_DENIED,
            user_id="user-123",
            permissions=["project_read", "project_update"]
        )
        
        message = error_handler._format_log_message(event)
        
        assert "project_read" in message
        assert "project_update" in message


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
