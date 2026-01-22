"""
Unit Tests for RBAC Middleware

Tests for the RBACMiddleware class and related components:
- Automatic permission checking on protected endpoints
- Seamless integration with FastAPI dependency injection
- Context extraction from request parameters and headers
- Support for endpoint-level permission configuration

Requirements: 1.5 - FastAPI Integration Seamlessness
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from uuid import UUID, uuid4
from datetime import datetime, timezone

from fastapi import FastAPI, Request, Depends
from fastapi.testclient import TestClient
from starlette.datastructures import Headers, QueryParams

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from auth.rbac import Permission
from auth.enhanced_rbac_models import PermissionContext, ScopeType
from auth.rbac_middleware import (
    RBACMiddleware,
    EndpointPermissionConfig,
    ContextExtractor,
    UserExtractor,
    get_endpoint_config,
    require_permission_with_context,
    require_any_permission_with_context,
    require_all_permissions_with_context,
    create_project_context_extractor,
    create_portfolio_context_extractor,
    protected_endpoint,
    register_protected_endpoints,
    setup_rbac_middleware,
)


# =============================================================================
# Test Fixtures
# =============================================================================

@pytest.fixture
def endpoint_config():
    """Create a fresh EndpointPermissionConfig for testing."""
    return EndpointPermissionConfig()


@pytest.fixture
def mock_request():
    """Create a mock FastAPI Request object."""
    request = Mock(spec=Request)
    request.method = "GET"
    request.url = Mock()
    request.url.path = "/test"
    request.headers = Headers({})
    request.query_params = QueryParams({})
    request.path_params = {}
    request.state = Mock()
    return request


@pytest.fixture
def mock_permission_checker():
    """Create a mock EnhancedPermissionChecker."""
    checker = AsyncMock()
    checker.check_permission = AsyncMock(return_value=True)
    checker.check_any_permission = AsyncMock(return_value=True)
    checker.check_all_permissions = AsyncMock(return_value=True)
    checker.check_all_permissions_with_details = AsyncMock(return_value=(True, [], []))
    return checker


@pytest.fixture
def test_user_id():
    """Generate a test user UUID."""
    return UUID("12345678-1234-5678-1234-567812345678")


@pytest.fixture
def test_project_id():
    """Generate a test project UUID."""
    return UUID("87654321-4321-8765-4321-876543218765")


@pytest.fixture
def test_portfolio_id():
    """Generate a test portfolio UUID."""
    return UUID("11111111-2222-3333-4444-555555555555")


# =============================================================================
# EndpointPermissionConfig Tests
# =============================================================================

class TestEndpointPermissionConfig:
    """Tests for EndpointPermissionConfig class."""
    
    def test_register_endpoint(self, endpoint_config):
        """Test registering an endpoint with permissions."""
        endpoint_config.register_endpoint(
            method="GET",
            path="/projects/{project_id}",
            permissions=[Permission.project_read],
            require_all=False
        )
        
        result = endpoint_config.get_endpoint_permissions("GET", "/projects/123")
        assert result is not None
        permissions, require_all = result
        assert Permission.project_read in permissions
        assert require_all is False
    
    def test_register_endpoint_with_multiple_permissions(self, endpoint_config):
        """Test registering an endpoint with multiple permissions."""
        endpoint_config.register_endpoint(
            method="POST",
            path="/projects",
            permissions=[Permission.project_create, Permission.portfolio_update],
            require_all=True
        )
        
        result = endpoint_config.get_endpoint_permissions("POST", "/projects")
        assert result is not None
        permissions, require_all = result
        assert Permission.project_create in permissions
        assert Permission.portfolio_update in permissions
        assert require_all is True
    
    def test_get_endpoint_permissions_no_match(self, endpoint_config):
        """Test getting permissions for unregistered endpoint."""
        result = endpoint_config.get_endpoint_permissions("GET", "/unknown")
        assert result is None
    
    def test_is_excluded_default_paths(self, endpoint_config):
        """Test that default paths are excluded."""
        assert endpoint_config.is_excluded("/") is True
        assert endpoint_config.is_excluded("/health") is True
        assert endpoint_config.is_excluded("/docs") is True
        assert endpoint_config.is_excluded("/redoc") is True
        assert endpoint_config.is_excluded("/openapi.json") is True
    
    def test_is_excluded_custom_path(self, endpoint_config):
        """Test excluding a custom path."""
        assert endpoint_config.is_excluded("/custom") is False
        endpoint_config.exclude_path("/custom")
        assert endpoint_config.is_excluded("/custom") is True
    
    def test_path_pattern_matching(self, endpoint_config):
        """Test path pattern matching with parameters."""
        endpoint_config.register_endpoint(
            method="GET",
            path="/portfolios/{portfolio_id}/projects/{project_id}",
            permissions=[Permission.project_read],
            require_all=False
        )
        
        # Should match with actual UUIDs
        result = endpoint_config.get_endpoint_permissions(
            "GET",
            "/portfolios/123e4567-e89b-12d3-a456-426614174000/projects/987fcdeb-51a2-3bc4-d567-890123456789"
        )
        assert result is not None
    
    def test_extract_path_params(self, endpoint_config):
        """Test extracting path parameters."""
        endpoint_config.register_endpoint(
            method="GET",
            path="/projects/{project_id}",
            permissions=[Permission.project_read],
            require_all=False
        )
        
        params = endpoint_config.extract_path_params(
            "/projects/123e4567-e89b-12d3-a456-426614174000",
            "/projects/{project_id}"
        )
        assert "project_id" in params
        assert params["project_id"] == "123e4567-e89b-12d3-a456-426614174000"


# =============================================================================
# ContextExtractor Tests
# =============================================================================

class TestContextExtractor:
    """Tests for ContextExtractor class."""
    
    @pytest.mark.asyncio
    async def test_extract_context_from_query_params(self, test_project_id, test_portfolio_id):
        """Test extracting context from query parameters."""
        request = Mock(spec=Request)
        request.method = "GET"
        request.query_params = QueryParams({
            "project_id": str(test_project_id),
            "portfolio_id": str(test_portfolio_id)
        })
        request.headers = Headers({})
        request.body = AsyncMock(return_value=b"")
        
        context = await ContextExtractor.extract_context(request)
        
        assert context.project_id == test_project_id
        assert context.portfolio_id == test_portfolio_id
    
    @pytest.mark.asyncio
    async def test_extract_context_from_headers(self, test_project_id):
        """Test extracting context from headers."""
        request = Mock(spec=Request)
        request.method = "GET"
        request.query_params = QueryParams({})
        request.headers = Headers({
            "x-project-id": str(test_project_id)
        })
        request.body = AsyncMock(return_value=b"")
        
        context = await ContextExtractor.extract_context(request)
        
        assert context.project_id == test_project_id
    
    @pytest.mark.asyncio
    async def test_extract_context_from_path_params(self, test_project_id):
        """Test extracting context from path parameters."""
        request = Mock(spec=Request)
        request.method = "GET"
        request.query_params = QueryParams({})
        request.headers = Headers({})
        request.body = AsyncMock(return_value=b"")
        
        path_params = {"project_id": str(test_project_id)}
        context = await ContextExtractor.extract_context(request, path_params)
        
        assert context.project_id == test_project_id
    
    @pytest.mark.asyncio
    async def test_extract_context_from_body(self, test_project_id):
        """Test extracting context from request body."""
        import json
        
        request = Mock(spec=Request)
        request.method = "POST"
        request.query_params = QueryParams({})
        request.headers = Headers({})
        request.body = AsyncMock(return_value=json.dumps({
            "project_id": str(test_project_id)
        }).encode())
        
        context = await ContextExtractor.extract_context(request)
        
        assert context.project_id == test_project_id
    
    @pytest.mark.asyncio
    async def test_extract_context_priority(self, test_project_id, test_portfolio_id):
        """Test that path params take priority over query params."""
        path_project_id = uuid4()
        
        request = Mock(spec=Request)
        request.method = "GET"
        request.query_params = QueryParams({
            "project_id": str(test_project_id)  # Should be overridden
        })
        request.headers = Headers({})
        request.body = AsyncMock(return_value=b"")
        
        path_params = {"project_id": str(path_project_id)}
        context = await ContextExtractor.extract_context(request, path_params)
        
        # Path params should take priority
        assert context.project_id == path_project_id
    
    def test_parse_uuid_valid(self):
        """Test parsing a valid UUID string."""
        uuid_str = "12345678-1234-5678-1234-567812345678"
        result = ContextExtractor._parse_uuid(uuid_str)
        assert result == UUID(uuid_str)
    
    def test_parse_uuid_invalid(self):
        """Test parsing an invalid UUID string."""
        result = ContextExtractor._parse_uuid("not-a-uuid")
        assert result is None
    
    def test_parse_uuid_none(self):
        """Test parsing None."""
        result = ContextExtractor._parse_uuid(None)
        assert result is None
    
    def test_create_context_from_dict(self, test_project_id, test_portfolio_id):
        """Test creating context from a dictionary."""
        data = {
            "project_id": str(test_project_id),
            "portfolio_id": str(test_portfolio_id)
        }
        
        context = ContextExtractor.create_context_from_dict(data)
        
        assert context.project_id == test_project_id
        assert context.portfolio_id == test_portfolio_id


# =============================================================================
# UserExtractor Tests
# =============================================================================

class TestUserExtractor:
    """Tests for UserExtractor class."""
    
    @pytest.mark.asyncio
    async def test_get_current_user_no_auth_header(self):
        """Test getting user when no auth header is present (dev fallback)."""
        request = Mock(spec=Request)
        request.headers = Headers({})
        
        user = await UserExtractor.get_current_user(request)
        
        assert user is not None
        assert user["user_id"] == "00000000-0000-0000-0000-000000000001"
        assert user["email"] == "dev@example.com"
    
    @pytest.mark.asyncio
    async def test_get_current_user_with_valid_token(self):
        """Test getting user with a valid JWT token."""
        import jwt
        
        user_id = "12345678-1234-5678-1234-567812345678"
        token = jwt.encode(
            {"sub": user_id, "email": "test@example.com"},
            "secret",
            algorithm="HS256"
        )
        
        request = Mock(spec=Request)
        request.headers = Headers({"authorization": f"Bearer {token}"})
        
        user = await UserExtractor.get_current_user(request)
        
        assert user is not None
        assert user["user_id"] == user_id
        assert user["email"] == "test@example.com"
    
    @pytest.mark.asyncio
    async def test_get_current_user_invalid_header_format(self):
        """Test getting user with invalid auth header format."""
        request = Mock(spec=Request)
        request.headers = Headers({"authorization": "InvalidFormat token"})
        
        user = await UserExtractor.get_current_user(request)
        
        # Should return None for invalid format
        assert user is None
    
    @pytest.mark.asyncio
    async def test_get_current_user_anon_user(self):
        """Test getting user when token has 'anon' as sub."""
        import jwt
        
        token = jwt.encode(
            {"sub": "anon", "email": "anon@example.com"},
            "secret",
            algorithm="HS256"
        )
        
        request = Mock(spec=Request)
        request.headers = Headers({"authorization": f"Bearer {token}"})
        
        user = await UserExtractor.get_current_user(request)
        
        # Should fall back to dev user
        assert user is not None
        assert user["user_id"] == "00000000-0000-0000-0000-000000000001"
    
    def test_get_user_id_valid(self, test_user_id):
        """Test extracting user ID from user dict."""
        user = {"user_id": str(test_user_id)}
        result = UserExtractor.get_user_id(user)
        assert result == test_user_id
    
    def test_get_user_id_none_user(self):
        """Test extracting user ID from None."""
        result = UserExtractor.get_user_id(None)
        assert result is None
    
    def test_get_user_id_missing_id(self):
        """Test extracting user ID when not present."""
        user = {"email": "test@example.com"}
        result = UserExtractor.get_user_id(user)
        assert result is None


# =============================================================================
# RBACMiddleware Tests
# =============================================================================

class TestRBACMiddleware:
    """Tests for RBACMiddleware class."""
    
    @pytest.mark.asyncio
    async def test_middleware_passes_excluded_paths(self, mock_permission_checker):
        """Test that middleware passes through excluded paths."""
        app = FastAPI()
        
        @app.get("/health")
        async def health():
            return {"status": "ok"}
        
        # Add middleware
        app.add_middleware(
            RBACMiddleware,
            permission_checker=mock_permission_checker
        )
        
        client = TestClient(app)
        response = client.get("/health")
        
        assert response.status_code == 200
        # Permission checker should not be called for excluded paths
        mock_permission_checker.check_permission.assert_not_called()
    
    @pytest.mark.asyncio
    async def test_middleware_passes_unprotected_endpoints(self, mock_permission_checker):
        """Test that middleware passes through unprotected endpoints."""
        app = FastAPI()
        
        @app.get("/unprotected")
        async def unprotected():
            return {"status": "ok"}
        
        app.add_middleware(
            RBACMiddleware,
            permission_checker=mock_permission_checker
        )
        
        client = TestClient(app)
        response = client.get("/unprotected")
        
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_middleware_checks_permissions_for_protected_endpoint(self, mock_permission_checker):
        """Test that middleware checks permissions for protected endpoints."""
        app = FastAPI()
        endpoint_config = EndpointPermissionConfig()
        
        @app.get("/protected")
        async def protected():
            return {"status": "ok"}
        
        # Register the endpoint as protected
        endpoint_config.register_endpoint(
            method="GET",
            path="/protected",
            permissions=[Permission.project_read],
            require_all=False
        )
        
        app.add_middleware(
            RBACMiddleware,
            permission_checker=mock_permission_checker,
            endpoint_config=endpoint_config
        )
        
        client = TestClient(app)
        response = client.get("/protected")
        
        assert response.status_code == 200
        # Permission checker should be called
        mock_permission_checker.check_any_permission.assert_called()
    
    @pytest.mark.asyncio
    async def test_middleware_denies_access_without_permission(self):
        """Test that middleware denies access when permission check fails."""
        app = FastAPI()
        endpoint_config = EndpointPermissionConfig()
        
        # Create a permission checker that denies access
        mock_checker = AsyncMock()
        mock_checker.check_any_permission = AsyncMock(return_value=False)
        
        @app.get("/protected")
        async def protected():
            return {"status": "ok"}
        
        endpoint_config.register_endpoint(
            method="GET",
            path="/protected",
            permissions=[Permission.project_read],
            require_all=False
        )
        
        app.add_middleware(
            RBACMiddleware,
            permission_checker=mock_checker,
            endpoint_config=endpoint_config
        )
        
        client = TestClient(app)
        response = client.get("/protected")
        
        assert response.status_code == 403
        assert "insufficient_permissions" in response.json()["error"]
    
    @pytest.mark.asyncio
    async def test_middleware_stores_user_in_request_state(self, mock_permission_checker):
        """Test that middleware stores user info in request state."""
        app = FastAPI()
        endpoint_config = EndpointPermissionConfig()
        stored_user = None
        
        @app.get("/protected")
        async def protected(request: Request):
            nonlocal stored_user
            stored_user = getattr(request.state, 'rbac_user', None)
            return {"status": "ok"}
        
        endpoint_config.register_endpoint(
            method="GET",
            path="/protected",
            permissions=[Permission.project_read],
            require_all=False
        )
        
        app.add_middleware(
            RBACMiddleware,
            permission_checker=mock_permission_checker,
            endpoint_config=endpoint_config
        )
        
        client = TestClient(app)
        response = client.get("/protected")
        
        assert response.status_code == 200
        assert stored_user is not None


# =============================================================================
# Permission Dependency Tests
# =============================================================================

class TestPermissionDependencies:
    """Tests for permission dependency functions."""
    
    @pytest.mark.asyncio
    async def test_require_permission_with_context_success(self, test_user_id, test_project_id):
        """Test require_permission_with_context when permission is granted."""
        app = FastAPI()
        
        # Mock the permission checker
        with patch('auth.rbac_middleware.get_enhanced_permission_checker') as mock_get_checker:
            mock_checker = AsyncMock()
            mock_checker.check_permission = AsyncMock(return_value=True)
            mock_get_checker.return_value = mock_checker
            
            @app.get("/projects/{project_id}")
            async def get_project(
                project_id: str,
                user = Depends(require_permission_with_context(Permission.project_read))
            ):
                return {"project_id": project_id, "user": user}
            
            client = TestClient(app)
            response = client.get(f"/projects/{test_project_id}")
            
            assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_require_permission_with_context_denied(self, test_project_id):
        """Test require_permission_with_context when permission is denied."""
        app = FastAPI()
        
        with patch('auth.rbac_middleware.get_enhanced_permission_checker') as mock_get_checker:
            mock_checker = AsyncMock()
            mock_checker.check_permission = AsyncMock(return_value=False)
            mock_get_checker.return_value = mock_checker
            
            @app.get("/projects/{project_id}")
            async def get_project(
                project_id: str,
                user = Depends(require_permission_with_context(Permission.project_read))
            ):
                return {"project_id": project_id}
            
            client = TestClient(app)
            response = client.get(f"/projects/{test_project_id}")
            
            assert response.status_code == 403
            assert "insufficient_permissions" in response.json()["detail"]["error"]
    
    @pytest.mark.asyncio
    async def test_require_any_permission_with_context_success(self, test_project_id):
        """Test require_any_permission_with_context when at least one permission is granted."""
        app = FastAPI()
        
        with patch('auth.rbac_middleware.get_enhanced_permission_checker') as mock_get_checker:
            mock_checker = AsyncMock()
            mock_checker.check_any_permission = AsyncMock(return_value=True)
            mock_get_checker.return_value = mock_checker
            
            @app.get("/projects/{project_id}")
            async def get_project(
                project_id: str,
                user = Depends(require_any_permission_with_context([
                    Permission.project_read,
                    Permission.portfolio_read
                ]))
            ):
                return {"project_id": project_id}
            
            client = TestClient(app)
            response = client.get(f"/projects/{test_project_id}")
            
            assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_require_all_permissions_with_context_success(self, test_project_id):
        """Test require_all_permissions_with_context when all permissions are granted."""
        app = FastAPI()
        
        with patch('auth.rbac_middleware.get_enhanced_permission_checker') as mock_get_checker:
            mock_checker = AsyncMock()
            mock_checker.check_all_permissions_with_details = AsyncMock(
                return_value=(True, [Permission.project_read, Permission.project_update], [])
            )
            mock_get_checker.return_value = mock_checker
            
            @app.put("/projects/{project_id}")
            async def update_project(
                project_id: str,
                user = Depends(require_all_permissions_with_context([
                    Permission.project_read,
                    Permission.project_update
                ]))
            ):
                return {"project_id": project_id}
            
            client = TestClient(app)
            response = client.put(f"/projects/{test_project_id}")
            
            assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_require_all_permissions_with_context_denied(self, test_project_id):
        """Test require_all_permissions_with_context when some permissions are missing."""
        app = FastAPI()
        
        with patch('auth.rbac_middleware.get_enhanced_permission_checker') as mock_get_checker:
            mock_checker = AsyncMock()
            mock_checker.check_all_permissions_with_details = AsyncMock(
                return_value=(False, [Permission.project_read], [Permission.project_update])
            )
            mock_get_checker.return_value = mock_checker
            
            @app.put("/projects/{project_id}")
            async def update_project(
                project_id: str,
                user = Depends(require_all_permissions_with_context([
                    Permission.project_read,
                    Permission.project_update
                ]))
            ):
                return {"project_id": project_id}
            
            client = TestClient(app)
            response = client.put(f"/projects/{test_project_id}")
            
            assert response.status_code == 403
            assert "missing_permissions" in response.json()["detail"]


# =============================================================================
# Context Extractor Factory Tests
# =============================================================================

class TestContextExtractorFactories:
    """Tests for context extractor factory functions."""
    
    @pytest.mark.asyncio
    async def test_create_project_context_extractor(self, test_project_id):
        """Test project context extractor factory."""
        extractor = create_project_context_extractor()
        
        request = Mock(spec=Request)
        request.path_params = {"project_id": str(test_project_id)}
        request.query_params = QueryParams({})
        request.headers = Headers({})
        request.method = "GET"
        request.body = AsyncMock(return_value=b"")
        
        context = await extractor(request)
        
        assert context.project_id == test_project_id
    
    @pytest.mark.asyncio
    async def test_create_portfolio_context_extractor(self, test_portfolio_id):
        """Test portfolio context extractor factory."""
        extractor = create_portfolio_context_extractor()
        
        request = Mock(spec=Request)
        request.path_params = {"portfolio_id": str(test_portfolio_id)}
        request.query_params = QueryParams({})
        request.headers = Headers({})
        request.method = "GET"
        request.body = AsyncMock(return_value=b"")
        
        context = await extractor(request)
        
        assert context.portfolio_id == test_portfolio_id


# =============================================================================
# Protected Endpoint Decorator Tests
# =============================================================================

class TestProtectedEndpointDecorator:
    """Tests for the @protected_endpoint decorator."""
    
    def test_protected_endpoint_single_permission(self):
        """Test decorator with single permission."""
        @protected_endpoint(Permission.project_read)
        async def get_project():
            pass
        
        assert hasattr(get_project, '_rbac_permissions')
        assert Permission.project_read in get_project._rbac_permissions
        assert get_project._rbac_require_all is False
    
    def test_protected_endpoint_multiple_permissions(self):
        """Test decorator with multiple permissions."""
        @protected_endpoint([Permission.project_read, Permission.project_update], require_all=True)
        async def update_project():
            pass
        
        assert hasattr(update_project, '_rbac_permissions')
        assert Permission.project_read in update_project._rbac_permissions
        assert Permission.project_update in update_project._rbac_permissions
        assert update_project._rbac_require_all is True
    
    def test_register_protected_endpoints(self):
        """Test registering protected endpoints from app."""
        app = FastAPI()
        
        @app.get("/projects/{project_id}")
        @protected_endpoint(Permission.project_read)
        async def get_project(project_id: str):
            return {"project_id": project_id}
        
        @app.post("/projects")
        @protected_endpoint([Permission.project_create, Permission.portfolio_update], require_all=True)
        async def create_project():
            return {"status": "created"}
        
        # Register endpoints
        register_protected_endpoints(app)
        
        # Check that endpoints were registered
        config = get_endpoint_config()
        
        # Note: The global config may have other endpoints registered
        # We just verify our endpoints are there
        result = config.get_endpoint_permissions("GET", "/projects/123")
        assert result is not None
        permissions, require_all = result
        assert Permission.project_read in permissions


# =============================================================================
# Integration Tests
# =============================================================================

class TestRBACMiddlewareIntegration:
    """Integration tests for RBAC middleware with FastAPI."""
    
    def test_full_integration_with_protected_endpoint(self):
        """Test full integration with protected endpoint and middleware."""
        app = FastAPI()
        endpoint_config = EndpointPermissionConfig()
        
        # Create a mock permission checker that grants access
        mock_checker = AsyncMock()
        mock_checker.check_any_permission = AsyncMock(return_value=True)
        mock_checker.check_all_permissions = AsyncMock(return_value=True)
        
        @app.get("/projects/{project_id}")
        async def get_project(project_id: str, request: Request):
            # Access user from request state
            user = getattr(request.state, 'rbac_user', None)
            return {
                "project_id": project_id,
                "user_id": user.get("user_id") if user else None
            }
        
        # Register endpoint
        endpoint_config.register_endpoint(
            method="GET",
            path="/projects/{project_id}",
            permissions=[Permission.project_read],
            require_all=False
        )
        
        # Add middleware
        app.add_middleware(
            RBACMiddleware,
            permission_checker=mock_checker,
            endpoint_config=endpoint_config
        )
        
        client = TestClient(app)
        response = client.get("/projects/test-project-123")
        
        assert response.status_code == 200
        data = response.json()
        assert data["project_id"] == "test-project-123"
        assert data["user_id"] is not None
    
    def test_context_extraction_in_middleware(self):
        """Test that context is properly extracted and passed to permission checker."""
        app = FastAPI()
        endpoint_config = EndpointPermissionConfig()
        captured_context = None
        
        # Create a mock permission checker that captures the context
        async def capture_context(user_id, permissions, context):
            nonlocal captured_context
            captured_context = context
            return True
        
        mock_checker = AsyncMock()
        mock_checker.check_any_permission = AsyncMock(side_effect=capture_context)
        
        @app.get("/projects/{project_id}")
        async def get_project(project_id: str):
            return {"project_id": project_id}
        
        endpoint_config.register_endpoint(
            method="GET",
            path="/projects/{project_id}",
            permissions=[Permission.project_read],
            require_all=False
        )
        
        app.add_middleware(
            RBACMiddleware,
            permission_checker=mock_checker,
            endpoint_config=endpoint_config
        )
        
        client = TestClient(app)
        
        # Make request with project_id in query params
        project_id = "12345678-1234-5678-1234-567812345678"
        response = client.get(f"/projects/{project_id}?portfolio_id=87654321-4321-8765-4321-876543218765")
        
        assert response.status_code == 200
        # Context should have been captured
        assert captured_context is not None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
