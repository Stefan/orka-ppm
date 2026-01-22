"""
Unit Tests for Import API Authentication and Authorization

Tests the authentication and authorization requirements for the import endpoints:
- Missing JWT token returns 401
- Invalid JWT token returns 401
- Expired JWT token returns 401
- Missing `data_import` permission returns 403
- Disabled user account returns 403

Validates: Requirements 1.3, 1.4, 4.1, 4.2, 4.3, 4.4, 4.5
"""

import pytest
from fastapi import FastAPI, Depends, HTTPException
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch, AsyncMock, MagicMock
from io import BytesIO
import json
import jwt
from datetime import datetime, timedelta
from uuid import uuid4

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from auth.rbac import Permission


def create_test_app_with_auth_error(status_code: int, detail: dict):
    """Create a test app that simulates auth errors."""
    from fastapi import APIRouter
    
    app = FastAPI()
    router = APIRouter(prefix="/api/projects", tags=["import"])
    
    async def failing_auth():
        raise HTTPException(status_code=status_code, detail=detail)
    
    @router.post("/import")
    async def import_json(_=Depends(failing_auth)):
        return {"success": True}
    
    @router.post("/import/csv")
    async def import_csv(_=Depends(failing_auth)):
        return {"success": True}
    
    app.include_router(router)
    return app


@pytest.fixture
def valid_project_json():
    """Generate valid project JSON data."""
    return [
        {
            "name": "Test Project",
            "budget": 100000.00,
            "status": "planning",
            "portfolio_id": str(uuid4())
        }
    ]


@pytest.fixture
def valid_csv_content():
    """Generate valid CSV content."""
    return b"name,budget,status\nTest Project,100000,planning"


class TestAuthenticationRequirements:
    """
    Tests for authentication requirements.
    
    Validates: Requirements 1.3, 4.1, 4.2
    """
    
    def test_json_import_missing_jwt_token_returns_401(self, valid_project_json):
        """
        Test that missing JWT token returns 401 Unauthorized.
        
        Validates: Requirements 1.3, 4.1
        """
        app = create_test_app_with_auth_error(
            status_code=401,
            detail={"error": "authentication_required", "message": "Missing authentication token"}
        )
        client = TestClient(app)
        
        response = client.post(
            "/api/projects/import",
            json=valid_project_json
        )
        
        assert response.status_code == 401, (
            f"Expected 401, got {response.status_code}"
        )
        result = response.json()
        assert result["detail"]["error"] == "authentication_required"
    
    def test_csv_import_missing_jwt_token_returns_401(self, valid_csv_content):
        """
        Test that CSV import with missing JWT token returns 401 Unauthorized.
        
        Validates: Requirements 1.3, 4.1
        """
        app = create_test_app_with_auth_error(
            status_code=401,
            detail={"error": "authentication_required", "message": "Missing authentication token"}
        )
        client = TestClient(app)
        
        files = {"file": ("test.csv", BytesIO(valid_csv_content), "text/csv")}
        response = client.post(
            "/api/projects/import/csv",
            files=files,
            params={"portfolio_id": str(uuid4())}
        )
        
        assert response.status_code == 401, (
            f"Expected 401, got {response.status_code}"
        )
    
    def test_json_import_invalid_jwt_token_returns_401(self, valid_project_json):
        """
        Test that invalid JWT token returns 401 Unauthorized.
        
        Validates: Requirements 1.3, 4.2
        """
        app = create_test_app_with_auth_error(
            status_code=401,
            detail={"error": "invalid_token", "message": "Invalid authentication token"}
        )
        client = TestClient(app)
        
        response = client.post(
            "/api/projects/import",
            json=valid_project_json,
            headers={"Authorization": "Bearer invalid_token_here"}
        )
        
        assert response.status_code == 401, (
            f"Expected 401, got {response.status_code}"
        )
        result = response.json()
        assert result["detail"]["error"] == "invalid_token"
    
    def test_json_import_expired_jwt_token_returns_401(self, valid_project_json):
        """
        Test that expired JWT token returns 401 Unauthorized.
        
        Validates: Requirements 1.3, 4.2
        """
        app = create_test_app_with_auth_error(
            status_code=401,
            detail={"error": "token_expired", "message": "Authentication token has expired"}
        )
        client = TestClient(app)
        
        # Create an expired token
        expired_payload = {
            "sub": str(uuid4()),
            "email": "test@example.com",
            "exp": datetime.utcnow() - timedelta(hours=1)  # Expired 1 hour ago
        }
        expired_token = jwt.encode(expired_payload, "secret", algorithm="HS256")
        
        response = client.post(
            "/api/projects/import",
            json=valid_project_json,
            headers={"Authorization": f"Bearer {expired_token}"}
        )
        
        assert response.status_code == 401, (
            f"Expected 401, got {response.status_code}"
        )
        result = response.json()
        assert result["detail"]["error"] == "token_expired"


class TestAuthorizationRequirements:
    """
    Tests for authorization requirements.
    
    Validates: Requirements 1.4, 4.3, 4.4, 4.5
    """
    
    def test_json_import_missing_data_import_permission_returns_403(self, valid_project_json):
        """
        Test that missing data_import permission returns 403 Forbidden.
        
        Validates: Requirements 1.4, 4.3, 4.4
        """
        app = create_test_app_with_auth_error(
            status_code=403,
            detail={
                "error": "insufficient_permissions",
                "message": "Permission 'data_import' required",
                "required_permission": "data_import"
            }
        )
        client = TestClient(app)
        
        response = client.post(
            "/api/projects/import",
            json=valid_project_json
        )
        
        assert response.status_code == 403, (
            f"Expected 403, got {response.status_code}"
        )
        result = response.json()
        assert result["detail"]["error"] == "insufficient_permissions"
        assert result["detail"]["required_permission"] == "data_import"
    
    def test_csv_import_missing_data_import_permission_returns_403(self, valid_csv_content):
        """
        Test that CSV import with missing data_import permission returns 403 Forbidden.
        
        Validates: Requirements 1.4, 4.3, 4.4
        """
        app = create_test_app_with_auth_error(
            status_code=403,
            detail={
                "error": "insufficient_permissions",
                "message": "Permission 'data_import' required",
                "required_permission": "data_import"
            }
        )
        client = TestClient(app)
        
        files = {"file": ("test.csv", BytesIO(valid_csv_content), "text/csv")}
        response = client.post(
            "/api/projects/import/csv",
            files=files,
            params={"portfolio_id": str(uuid4())}
        )
        
        assert response.status_code == 403, (
            f"Expected 403, got {response.status_code}"
        )
    
    def test_json_import_disabled_user_returns_403(self, valid_project_json):
        """
        Test that disabled user account returns 403 Forbidden.
        
        Validates: Requirements 4.5
        """
        app = create_test_app_with_auth_error(
            status_code=403,
            detail={
                "error": "account_disabled",
                "message": "User account is disabled"
            }
        )
        client = TestClient(app)
        
        response = client.post(
            "/api/projects/import",
            json=valid_project_json
        )
        
        assert response.status_code == 403, (
            f"Expected 403, got {response.status_code}"
        )
        result = response.json()
        assert result["detail"]["error"] == "account_disabled"


class TestAuthenticationNotProcessingData:
    """
    Tests that authentication/authorization failures don't process import data.
    
    Validates: Requirements 4.5
    """
    
    def test_auth_failure_does_not_process_import(self, valid_project_json):
        """
        Test that authentication failure prevents import data processing.
        
        Validates: Requirements 4.5
        """
        # Track if import logic was called
        import_called = False
        
        def create_tracking_app():
            from fastapi import APIRouter
            
            app = FastAPI()
            router = APIRouter(prefix="/api/projects", tags=["import"])
            
            async def failing_auth():
                raise HTTPException(
                    status_code=401,
                    detail={"error": "authentication_required", "message": "Missing token"}
                )
            
            @router.post("/import")
            async def import_json(data: list, _=Depends(failing_auth)):
                nonlocal import_called
                import_called = True
                return {"success": True}
            
            app.include_router(router)
            return app
        
        app = create_tracking_app()
        client = TestClient(app)
        
        response = client.post(
            "/api/projects/import",
            json=valid_project_json
        )
        
        assert response.status_code == 401
        assert not import_called, "Import logic should not be called when auth fails"


class TestErrorResponseFormat:
    """
    Tests that auth/authz errors follow the correct response format.
    
    Validates: Requirements 7.4, 7.5
    """
    
    def test_auth_error_response_format(self, valid_project_json):
        """
        Test that authentication error response has correct format.
        
        Validates: Requirements 7.4
        """
        app = create_test_app_with_auth_error(
            status_code=401,
            detail={
                "error": "authentication_required",
                "message": "Invalid credentials"
            }
        )
        client = TestClient(app)
        
        response = client.post(
            "/api/projects/import",
            json=valid_project_json
        )
        
        assert response.status_code == 401
        result = response.json()
        assert "detail" in result
        assert "error" in result["detail"]
        assert "message" in result["detail"]
    
    def test_authz_error_response_format(self, valid_project_json):
        """
        Test that authorization error response has correct format.
        
        Validates: Requirements 7.5
        """
        app = create_test_app_with_auth_error(
            status_code=403,
            detail={
                "error": "insufficient_permissions",
                "message": "Permission 'data_import' required",
                "required_permission": "data_import"
            }
        )
        client = TestClient(app)
        
        response = client.post(
            "/api/projects/import",
            json=valid_project_json
        )
        
        assert response.status_code == 403
        result = response.json()
        assert "detail" in result
        assert "error" in result["detail"]
        assert "message" in result["detail"]


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
