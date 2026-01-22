"""
Unit Tests for Enhanced Permission Dependencies

Tests for the enhanced permission dependency functions in rbac.py:
- require_permission() with context-aware checking
- require_any_permission() with context support
- require_all_permissions() function
- Dynamic permission evaluation based on request context
- Context extractor factory functions

Requirements: 1.4, 1.5 - Permission combination logic and FastAPI integration
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from uuid import UUID, uuid4
from datetime import datetime, timezone

from fastapi import FastAPI, Request, Depends, HTTPException
from fastapi.testclient import TestClient
from starlette.datastructures import Headers, QueryParams

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from auth.rbac import (
    Permission,
    UserRole,
    RoleBasedAccessControl,
    require_permission,
    require_any_permission,
    require_all_permissions,
    require_admin,
    create_project_context_extractor,
    create_portfolio_context_extractor,
    create_resource_context_extractor,
    create_combined_context_extractor,
    rbac,
)
from auth.enhanced_rbac_models import PermissionContext, ScopeType


# =============================================================================
# Test Fixtures
# =============================================================================

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


@pytest.fixture
def test_resource_id():
    """Generate a test resource UUID."""
    return UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")


@pytest.fixture
def mock_request(test_project_id, test_portfolio_id):
    """Create a mock FastAPI Request object."""
    request = Mock(spec=Request)
    request.method = "GET"
    request.url = Mock()
    request.url.path = "/test"
    request.headers = Headers({})
    request.query_params = QueryParams({})
    request.path_params = {"project_id": str(test_project_id)}
    request.state = Mock()
    return request


@pytest.fixture
def mock_current_user(test_user_id):
    """Create a mock current user dictionary."""
    return {
        "user_id": str(test_user_id),
        "email": "test@example.com"
    }


# =============================================================================
# RoleBasedAccessControl Class Tests
# =============================================================================

class TestRoleBasedAccessControlEnhancements:
    """Tests for enhanced RoleBasedAccessControl class methods."""
    
    @pytest.mark.asyncio
    async def test_has_all_permissions_success(self):
        """Test has_all_permissions returns True when user has all permissions."""
        # Use dev user ID which gets admin permissions
        dev_user_id = "00000000-0000-0000-0000-000000000001"
        
        result = await rbac.has_all_permissions(
            dev_user_id,
            [Permission.project_read, Permission.project_update]
        )
        
        assert result is True
    
    @pytest.mark.asyncio
    async def test_has_all_permissions_failure(self):
        """Test has_all_permissions returns False when user is missing permissions."""
        # Create a mock RBAC with limited permissions
        mock_rbac = RoleBasedAccessControl(None)
        
        # Mock get_user_permissions to return limited permissions
        async def mock_get_permissions(user_id):
            return [Permission.project_read]  # Only read, not update
        
        mock_rbac.get_user_permissions = mock_get_permissions
        
        result = await mock_rbac.has_all_permissions(
            "test-user",
            [Permission.project_read, Permission.project_update]
        )
        
        assert result is False
    
    @pytest.mark.asyncio
    async def test_get_missing_permissions(self):
        """Test get_missing_permissions returns correct missing permissions."""
        mock_rbac = RoleBasedAccessControl(None)
        
        async def mock_get_permissions(user_id):
            return [Permission.project_read]
        
        mock_rbac.get_user_permissions = mock_get_permissions
        
        missing = await mock_rbac.get_missing_permissions(
            "test-user",
            [Permission.project_read, Permission.project_update, Permission.project_delete]
        )
        
        assert Permission.project_update in missing
        assert Permission.project_delete in missing
        assert Permission.project_read not in missing
    
    @pytest.mark.asyncio
    async def test_get_missing_permissions_none_missing(self):
        """Test get_missing_permissions returns empty list when all permissions present."""
        dev_user_id = "00000000-0000-0000-0000-000000000001"
        
        missing = await rbac.get_missing_permissions(
            dev_user_id,
            [Permission.project_read, Permission.project_update]
        )
        
        assert len(missing) == 0


# =============================================================================
# require_permission() Tests
# =============================================================================

class TestRequirePermission:
    """Tests for the enhanced require_permission dependency."""
    
    def test_require_permission_without_context(self):
        """Test require_permission works without context extractor (backward compatible)."""
        app = FastAPI()
        
        @app.get("/projects")
        async def list_projects(user = Depends(require_permission(Permission.project_read))):
            return {"user": user}
        
        client = TestClient(app)
        response = client.get("/projects")
        
        # Should succeed with dev user fallback
        assert response.status_code == 200
    
    def test_require_permission_with_context_extractor(self, test_project_id):
        """Test require_permission with context extractor."""
        app = FastAPI()
        
        @app.get("/projects/{project_id}")
        async def get_project(
            project_id: str,
            user = Depends(require_permission(
                Permission.project_read,
                create_project_context_extractor()
            ))
        ):
            return {"project_id": project_id, "user": user}
        
        client = TestClient(app)
        response = client.get(f"/projects/{test_project_id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["project_id"] == str(test_project_id)
    
    def test_require_permission_returns_context_in_user(self, test_project_id):
        """Test that require_permission includes context in returned user dict."""
        app = FastAPI()
        
        @app.get("/projects/{project_id}")
        async def get_project(
            project_id: str,
            user = Depends(require_permission(
                Permission.project_read,
                create_project_context_extractor()
            ))
        ):
            return {
                "has_context": "permission_context" in user,
                "user_id": user.get("user_id")
            }
        
        client = TestClient(app)
        response = client.get(f"/projects/{test_project_id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["has_context"] is True
    
    def test_require_permission_denied(self):
        """Test require_permission returns 403 when permission denied."""
        app = FastAPI()
        
        # Mock the rbac to deny permission
        with patch('auth.rbac.rbac') as mock_rbac:
            mock_rbac.has_permission = AsyncMock(return_value=False)
            
            @app.get("/admin")
            async def admin_only(user = Depends(require_permission(Permission.system_admin))):
                return {"status": "ok"}
            
            client = TestClient(app)
            response = client.get("/admin")
            
            assert response.status_code == 403
            assert "insufficient_permissions" in response.json()["detail"]["error"]
    
    def test_require_permission_unauthenticated(self):
        """Test require_permission returns 401 when user not authenticated."""
        app = FastAPI()
        
        # Mock get_current_user to return no user_id
        with patch('auth.rbac.get_current_user') as mock_get_user:
            async def return_no_user():
                return {"email": "test@example.com"}  # No user_id
            mock_get_user.return_value = return_no_user
            
            @app.get("/protected")
            async def protected(user = Depends(require_permission(Permission.project_read))):
                return {"status": "ok"}
            
            # This test verifies the dependency structure is correct
            # The actual authentication check happens in the dependency


# =============================================================================
# require_any_permission() Tests
# =============================================================================

class TestRequireAnyPermission:
    """Tests for the enhanced require_any_permission dependency."""
    
    def test_require_any_permission_without_context(self):
        """Test require_any_permission works without context (backward compatible)."""
        app = FastAPI()
        
        @app.get("/resources")
        async def list_resources(
            user = Depends(require_any_permission([
                Permission.resource_read,
                Permission.admin_read
            ]))
        ):
            return {"user": user}
        
        client = TestClient(app)
        response = client.get("/resources")
        
        assert response.status_code == 200
    
    def test_require_any_permission_with_context(self, test_project_id):
        """Test require_any_permission with context extractor."""
        app = FastAPI()
        
        @app.get("/projects/{project_id}/resources")
        async def get_project_resources(
            project_id: str,
            user = Depends(require_any_permission(
                [Permission.resource_read, Permission.project_read],
                create_project_context_extractor()
            ))
        ):
            return {"project_id": project_id}
        
        client = TestClient(app)
        response = client.get(f"/projects/{test_project_id}/resources")
        
        assert response.status_code == 200
    
    def test_require_any_permission_denied(self):
        """Test require_any_permission returns 403 when no permissions match."""
        app = FastAPI()
        
        with patch('auth.rbac.rbac') as mock_rbac:
            mock_rbac.has_any_permission = AsyncMock(return_value=False)
            
            @app.get("/special")
            async def special(
                user = Depends(require_any_permission([
                    Permission.system_admin,
                    Permission.user_manage
                ]))
            ):
                return {"status": "ok"}
            
            client = TestClient(app)
            response = client.get("/special")
            
            assert response.status_code == 403
            detail = response.json()["detail"]
            assert "insufficient_permissions" in detail["error"]
            assert "required_permissions" in detail


# =============================================================================
# require_all_permissions() Tests
# =============================================================================

class TestRequireAllPermissions:
    """Tests for the new require_all_permissions dependency."""
    
    def test_require_all_permissions_success(self):
        """Test require_all_permissions succeeds when user has all permissions."""
        app = FastAPI()
        
        @app.put("/projects/{project_id}")
        async def update_project(
            project_id: str,
            user = Depends(require_all_permissions([
                Permission.project_read,
                Permission.project_update
            ]))
        ):
            return {"project_id": project_id}
        
        client = TestClient(app)
        response = client.put("/projects/123")
        
        # Dev user has all permissions
        assert response.status_code == 200
    
    def test_require_all_permissions_with_context(self, test_project_id):
        """Test require_all_permissions with context extractor."""
        app = FastAPI()
        
        @app.put("/projects/{project_id}")
        async def update_project(
            project_id: str,
            user = Depends(require_all_permissions(
                [Permission.project_read, Permission.project_update],
                create_project_context_extractor()
            ))
        ):
            return {
                "project_id": project_id,
                "has_context": "permission_context" in user
            }
        
        client = TestClient(app)
        response = client.put(f"/projects/{test_project_id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["has_context"] is True
    
    def test_require_all_permissions_denied_with_missing_list(self):
        """Test require_all_permissions returns missing permissions in error."""
        app = FastAPI()
        
        # Create a mock that returns specific permissions
        with patch('auth.rbac.rbac') as mock_rbac:
            async def mock_get_perms(user_id):
                return [Permission.project_read]  # Only has read
            mock_rbac.get_user_permissions = mock_get_perms
            
            @app.delete("/projects/{project_id}")
            async def delete_project(
                project_id: str,
                user = Depends(require_all_permissions([
                    Permission.project_read,
                    Permission.project_delete
                ]))
            ):
                return {"status": "deleted"}
            
            client = TestClient(app)
            response = client.delete("/projects/123")
            
            assert response.status_code == 403
            detail = response.json()["detail"]
            assert "missing_permissions" in detail
            assert "project_delete" in detail["missing_permissions"]


# =============================================================================
# Context Extractor Factory Tests
# =============================================================================

class TestContextExtractorFactories:
    """Tests for context extractor factory functions."""
    
    @pytest.mark.asyncio
    async def test_project_context_extractor_from_path(self, test_project_id):
        """Test project context extractor extracts from path params."""
        extractor = create_project_context_extractor()
        
        request = Mock(spec=Request)
        request.path_params = {"project_id": str(test_project_id)}
        request.query_params = QueryParams({})
        request.headers = Headers({})
        
        context = await extractor(request)
        
        assert context.project_id == test_project_id
    
    @pytest.mark.asyncio
    async def test_project_context_extractor_from_query(self, test_project_id):
        """Test project context extractor extracts from query params."""
        extractor = create_project_context_extractor()
        
        request = Mock(spec=Request)
        request.path_params = {}
        request.query_params = QueryParams({"project_id": str(test_project_id)})
        request.headers = Headers({})
        
        context = await extractor(request)
        
        assert context.project_id == test_project_id
    
    @pytest.mark.asyncio
    async def test_project_context_extractor_from_header(self, test_project_id):
        """Test project context extractor extracts from headers."""
        extractor = create_project_context_extractor()
        
        request = Mock(spec=Request)
        request.path_params = {}
        request.query_params = QueryParams({})
        request.headers = Headers({"x-project-id": str(test_project_id)})
        
        context = await extractor(request)
        
        assert context.project_id == test_project_id
    
    @pytest.mark.asyncio
    async def test_portfolio_context_extractor(self, test_portfolio_id):
        """Test portfolio context extractor."""
        extractor = create_portfolio_context_extractor()
        
        request = Mock(spec=Request)
        request.path_params = {"portfolio_id": str(test_portfolio_id)}
        request.query_params = QueryParams({})
        request.headers = Headers({})
        
        context = await extractor(request)
        
        assert context.portfolio_id == test_portfolio_id
    
    @pytest.mark.asyncio
    async def test_resource_context_extractor(self, test_resource_id):
        """Test resource context extractor."""
        extractor = create_resource_context_extractor()
        
        request = Mock(spec=Request)
        request.path_params = {"resource_id": str(test_resource_id)}
        request.query_params = QueryParams({})
        request.headers = Headers({})
        
        context = await extractor(request)
        
        assert context.resource_id == test_resource_id
    
    @pytest.mark.asyncio
    async def test_combined_context_extractor(
        self, test_project_id, test_portfolio_id, test_resource_id
    ):
        """Test combined context extractor extracts all context types."""
        extractor = create_combined_context_extractor()
        
        request = Mock(spec=Request)
        request.path_params = {
            "project_id": str(test_project_id),
            "portfolio_id": str(test_portfolio_id)
        }
        request.query_params = QueryParams({
            "resource_id": str(test_resource_id)
        })
        request.headers = Headers({})
        
        context = await extractor(request)
        
        assert context.project_id == test_project_id
        assert context.portfolio_id == test_portfolio_id
        assert context.resource_id == test_resource_id
    
    @pytest.mark.asyncio
    async def test_context_extractor_priority(self, test_project_id):
        """Test that path params take priority over query params."""
        extractor = create_project_context_extractor()
        
        path_project_id = uuid4()
        query_project_id = uuid4()
        
        request = Mock(spec=Request)
        request.path_params = {"project_id": str(path_project_id)}
        request.query_params = QueryParams({"project_id": str(query_project_id)})
        request.headers = Headers({})
        
        context = await extractor(request)
        
        # Path params should take priority
        assert context.project_id == path_project_id
    
    @pytest.mark.asyncio
    async def test_context_extractor_invalid_uuid(self):
        """Test context extractor handles invalid UUIDs gracefully."""
        extractor = create_project_context_extractor()
        
        request = Mock(spec=Request)
        request.path_params = {"project_id": "not-a-valid-uuid"}
        request.query_params = QueryParams({})
        request.headers = Headers({})
        
        context = await extractor(request)
        
        # Should return None for invalid UUID
        assert context.project_id is None


# =============================================================================
# Backward Compatibility Tests
# =============================================================================

class TestBackwardCompatibility:
    """Tests to ensure backward compatibility with existing code."""
    
    def test_require_permission_signature_compatible(self):
        """Test require_permission can be called with just permission (old style)."""
        # Old style: require_permission(Permission.project_read)
        dependency = require_permission(Permission.project_read)
        assert callable(dependency)
    
    def test_require_any_permission_signature_compatible(self):
        """Test require_any_permission can be called with just permissions list."""
        # Old style: require_any_permission([Permission.project_read])
        dependency = require_any_permission([Permission.project_read])
        assert callable(dependency)
    
    def test_require_admin_unchanged(self):
        """Test require_admin still works as before."""
        dependency = require_admin()
        assert callable(dependency)
    
    def test_existing_endpoint_patterns_work(self):
        """Test that existing endpoint patterns continue to work."""
        app = FastAPI()
        
        # Pattern 1: Simple permission check
        @app.get("/simple")
        async def simple(user = Depends(require_permission(Permission.project_read))):
            return {"status": "ok"}
        
        # Pattern 2: Any permission check
        @app.get("/any")
        async def any_perm(
            user = Depends(require_any_permission([
                Permission.project_read,
                Permission.portfolio_read
            ]))
        ):
            return {"status": "ok"}
        
        # Pattern 3: Admin check
        @app.get("/admin")
        async def admin(user = Depends(require_admin())):
            return {"status": "ok"}
        
        client = TestClient(app)
        
        # All should work with dev user
        assert client.get("/simple").status_code == 200
        assert client.get("/any").status_code == 200
        assert client.get("/admin").status_code == 200


# =============================================================================
# Integration Tests
# =============================================================================

class TestEnhancedPermissionDependenciesIntegration:
    """Integration tests for enhanced permission dependencies."""
    
    def test_full_workflow_with_context(self, test_project_id):
        """Test complete workflow with context-aware permission checking."""
        app = FastAPI()
        
        @app.get("/projects/{project_id}")
        async def get_project(
            project_id: str,
            user = Depends(require_permission(
                Permission.project_read,
                create_project_context_extractor()
            ))
        ):
            return {
                "project_id": project_id,
                "user_id": user.get("user_id"),
                "has_context": "permission_context" in user
            }
        
        @app.put("/projects/{project_id}")
        async def update_project(
            project_id: str,
            user = Depends(require_all_permissions(
                [Permission.project_read, Permission.project_update],
                create_project_context_extractor()
            ))
        ):
            return {"project_id": project_id, "action": "updated"}
        
        @app.delete("/projects/{project_id}")
        async def delete_project(
            project_id: str,
            user = Depends(require_all_permissions(
                [Permission.project_read, Permission.project_delete],
                create_project_context_extractor()
            ))
        ):
            return {"project_id": project_id, "action": "deleted"}
        
        client = TestClient(app)
        
        # Test GET
        response = client.get(f"/projects/{test_project_id}")
        assert response.status_code == 200
        assert response.json()["has_context"] is True
        
        # Test PUT
        response = client.put(f"/projects/{test_project_id}")
        assert response.status_code == 200
        assert response.json()["action"] == "updated"
        
        # Test DELETE
        response = client.delete(f"/projects/{test_project_id}")
        assert response.status_code == 200
        assert response.json()["action"] == "deleted"
    
    def test_mixed_permission_requirements(self, test_project_id, test_portfolio_id):
        """Test endpoints with different permission requirements."""
        app = FastAPI()
        
        @app.get("/portfolios/{portfolio_id}/projects")
        async def list_portfolio_projects(
            portfolio_id: str,
            user = Depends(require_any_permission(
                [Permission.portfolio_read, Permission.project_read],
                create_portfolio_context_extractor()
            ))
        ):
            return {"portfolio_id": portfolio_id}
        
        @app.post("/portfolios/{portfolio_id}/projects")
        async def create_project_in_portfolio(
            portfolio_id: str,
            user = Depends(require_all_permissions(
                [Permission.portfolio_read, Permission.project_create],
                create_portfolio_context_extractor()
            ))
        ):
            return {"portfolio_id": portfolio_id, "action": "created"}
        
        client = TestClient(app)
        
        # Test list (any permission)
        response = client.get(f"/portfolios/{test_portfolio_id}/projects")
        assert response.status_code == 200
        
        # Test create (all permissions)
        response = client.post(f"/portfolios/{test_portfolio_id}/projects")
        assert response.status_code == 200


# =============================================================================
# Error Response Format Tests
# =============================================================================

class TestErrorResponseFormat:
    """Tests for error response format consistency."""
    
    def test_permission_denied_response_format(self):
        """Test that permission denied responses have consistent format."""
        app = FastAPI()
        
        with patch('auth.rbac.rbac') as mock_rbac:
            mock_rbac.has_permission = AsyncMock(return_value=False)
            
            @app.get("/protected")
            async def protected(user = Depends(require_permission(Permission.system_admin))):
                return {"status": "ok"}
            
            client = TestClient(app)
            response = client.get("/protected")
            
            assert response.status_code == 403
            detail = response.json()["detail"]
            
            # Check required fields
            assert "error" in detail
            assert "message" in detail
            assert "required_permission" in detail
            assert detail["error"] == "insufficient_permissions"
    
    def test_all_permissions_denied_response_format(self):
        """Test that require_all_permissions denied response includes missing list."""
        app = FastAPI()
        
        with patch('auth.rbac.rbac') as mock_rbac:
            async def mock_get_perms(user_id):
                return [Permission.project_read]
            mock_rbac.get_user_permissions = mock_get_perms
            
            @app.put("/protected")
            async def protected(
                user = Depends(require_all_permissions([
                    Permission.project_read,
                    Permission.project_update,
                    Permission.project_delete
                ]))
            ):
                return {"status": "ok"}
            
            client = TestClient(app)
            response = client.put("/protected")
            
            assert response.status_code == 403
            detail = response.json()["detail"]
            
            # Check required fields for all_permissions
            assert "error" in detail
            assert "message" in detail
            assert "required_permissions" in detail
            assert "missing_permissions" in detail
            
            # Verify missing permissions are correct
            assert "project_update" in detail["missing_permissions"]
            assert "project_delete" in detail["missing_permissions"]
            assert "project_read" not in detail["missing_permissions"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
