"""
Unit Tests for Import API Endpoint Routing

Tests the API endpoint routing requirements:
- POST method accepted on both endpoints
- Other HTTP methods rejected
- Correct paths: `/api/projects/import` and `/api/projects/import/csv`

Validates: Requirements 1.5, 2.4
"""

import pytest
from fastapi import FastAPI, Depends, HTTPException
from fastapi.testclient import TestClient
from io import BytesIO
from uuid import uuid4

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app


@pytest.fixture
def client():
    """Create test client."""
    return TestClient(app)


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


class TestJSONImportEndpointRouting:
    """
    Tests for JSON import endpoint routing.
    
    Validates: Requirements 1.5
    """
    
    def test_post_method_accepted_on_json_import(self, client, valid_project_json):
        """
        Test that POST method is accepted on /api/projects/import.
        
        Validates: Requirements 1.5
        """
        response = client.post(
            "/api/projects/import",
            json=valid_project_json
        )
        
        # Should not return 405 Method Not Allowed
        assert response.status_code != 405, (
            f"POST method should be accepted, got {response.status_code}"
        )
        # Should return a valid response (200, 400, 401, 403, etc.)
        assert response.status_code in [200, 400, 401, 403, 422, 500, 503], (
            f"Unexpected status code: {response.status_code}"
        )
    
    def test_get_method_rejected_on_json_import(self, client):
        """
        Test that GET method is rejected on /api/projects/import.
        
        Validates: Requirements 1.5
        """
        response = client.get("/api/projects/import")
        
        assert response.status_code == 405, (
            f"GET method should be rejected with 405, got {response.status_code}"
        )
    
    def test_put_method_rejected_on_json_import(self, client, valid_project_json):
        """
        Test that PUT method is rejected on /api/projects/import.
        
        Validates: Requirements 1.5
        """
        response = client.put(
            "/api/projects/import",
            json=valid_project_json
        )
        
        assert response.status_code == 405, (
            f"PUT method should be rejected with 405, got {response.status_code}"
        )
    
    def test_delete_method_rejected_on_json_import(self, client):
        """
        Test that DELETE method is rejected on /api/projects/import.
        
        Validates: Requirements 1.5
        """
        response = client.delete("/api/projects/import")
        
        assert response.status_code == 405, (
            f"DELETE method should be rejected with 405, got {response.status_code}"
        )
    
    def test_patch_method_rejected_on_json_import(self, client, valid_project_json):
        """
        Test that PATCH method is rejected on /api/projects/import.
        
        Validates: Requirements 1.5
        """
        response = client.patch(
            "/api/projects/import",
            json=valid_project_json
        )
        
        assert response.status_code == 405, (
            f"PATCH method should be rejected with 405, got {response.status_code}"
        )
    
    def test_correct_path_json_import(self, client, valid_project_json):
        """
        Test that the correct path /api/projects/import is accessible.
        
        Validates: Requirements 1.5
        """
        response = client.post(
            "/api/projects/import",
            json=valid_project_json
        )
        
        # Should not return 404 Not Found
        assert response.status_code != 404, (
            f"Path /api/projects/import should exist, got 404"
        )
    
    def test_wrong_path_returns_404(self, client, valid_project_json):
        """
        Test that wrong paths return 404 or 405.
        
        Validates: Requirements 1.5
        """
        wrong_paths = [
            "/api/project/import",  # Missing 's'
            "/api/projects/imports",  # Extra 's'
            "/api/import/projects",  # Wrong order
        ]
        
        for path in wrong_paths:
            response = client.post(path, json=valid_project_json)
            # Wrong paths should return 404 (not found) or 405 (method not allowed)
            # Both indicate the correct endpoint is not accessible at that path
            assert response.status_code in [404, 405], (
                f"Path {path} should return 404 or 405, got {response.status_code}"
            )


class TestCSVImportEndpointRouting:
    """
    Tests for CSV import endpoint routing.
    
    Validates: Requirements 2.4
    """
    
    def test_post_method_accepted_on_csv_import(self, client, valid_csv_content):
        """
        Test that POST method is accepted on /api/projects/import/csv.
        
        Validates: Requirements 2.4
        """
        files = {"file": ("test.csv", BytesIO(valid_csv_content), "text/csv")}
        response = client.post(
            "/api/projects/import/csv",
            files=files,
            params={"portfolio_id": str(uuid4())}
        )
        
        # Should not return 405 Method Not Allowed
        assert response.status_code != 405, (
            f"POST method should be accepted, got {response.status_code}"
        )
        # Should return a valid response (200, 400, 401, 403, 422, etc.)
        assert response.status_code in [200, 400, 401, 403, 422, 500, 503], (
            f"Unexpected status code: {response.status_code}"
        )
    
    def test_get_method_rejected_on_csv_import(self, client):
        """
        Test that GET method is rejected on /api/projects/import/csv.
        
        Validates: Requirements 2.4
        """
        response = client.get("/api/projects/import/csv")
        
        assert response.status_code == 405, (
            f"GET method should be rejected with 405, got {response.status_code}"
        )
    
    def test_put_method_rejected_on_csv_import(self, client, valid_csv_content):
        """
        Test that PUT method is rejected on /api/projects/import/csv.
        
        Validates: Requirements 2.4
        """
        files = {"file": ("test.csv", BytesIO(valid_csv_content), "text/csv")}
        response = client.put(
            "/api/projects/import/csv",
            files=files
        )
        
        assert response.status_code == 405, (
            f"PUT method should be rejected with 405, got {response.status_code}"
        )
    
    def test_delete_method_rejected_on_csv_import(self, client):
        """
        Test that DELETE method is rejected on /api/projects/import/csv.
        
        Validates: Requirements 2.4
        """
        response = client.delete("/api/projects/import/csv")
        
        assert response.status_code == 405, (
            f"DELETE method should be rejected with 405, got {response.status_code}"
        )
    
    def test_patch_method_rejected_on_csv_import(self, client, valid_csv_content):
        """
        Test that PATCH method is rejected on /api/projects/import/csv.
        
        Validates: Requirements 2.4
        """
        files = {"file": ("test.csv", BytesIO(valid_csv_content), "text/csv")}
        response = client.patch(
            "/api/projects/import/csv",
            files=files
        )
        
        assert response.status_code == 405, (
            f"PATCH method should be rejected with 405, got {response.status_code}"
        )
    
    def test_correct_path_csv_import(self, client, valid_csv_content):
        """
        Test that the correct path /api/projects/import/csv is accessible.
        
        Validates: Requirements 2.4
        """
        files = {"file": ("test.csv", BytesIO(valid_csv_content), "text/csv")}
        response = client.post(
            "/api/projects/import/csv",
            files=files,
            params={"portfolio_id": str(uuid4())}
        )
        
        # Should not return 404 Not Found
        assert response.status_code != 404, (
            f"Path /api/projects/import/csv should exist, got 404"
        )
    
    def test_wrong_csv_path_returns_404(self, client, valid_csv_content):
        """
        Test that wrong CSV paths return 404.
        
        Validates: Requirements 2.4
        """
        files = {"file": ("test.csv", BytesIO(valid_csv_content), "text/csv")}
        wrong_paths = [
            "/api/projects/import/CSV",  # Wrong case
            "/api/projects/csv/import",  # Wrong order
            "/api/project/import/csv",  # Missing 's'
        ]
        
        for path in wrong_paths:
            response = client.post(path, files=files)
            assert response.status_code == 404, (
                f"Path {path} should return 404, got {response.status_code}"
            )


class TestEndpointContentTypes:
    """
    Tests for endpoint content type handling.
    
    Validates: Requirements 1.5, 2.4
    """
    
    def test_json_import_accepts_json_content_type(self, client, valid_project_json):
        """
        Test that JSON import endpoint accepts application/json content type.
        
        Validates: Requirements 1.5
        """
        response = client.post(
            "/api/projects/import",
            json=valid_project_json,
            headers={"Content-Type": "application/json"}
        )
        
        # Should not return 415 Unsupported Media Type
        assert response.status_code != 415, (
            f"application/json should be accepted, got {response.status_code}"
        )
    
    def test_csv_import_accepts_multipart_form_data(self, client, valid_csv_content):
        """
        Test that CSV import endpoint accepts multipart/form-data content type.
        
        Validates: Requirements 2.4
        """
        files = {"file": ("test.csv", BytesIO(valid_csv_content), "text/csv")}
        response = client.post(
            "/api/projects/import/csv",
            files=files,
            params={"portfolio_id": str(uuid4())}
        )
        
        # Should not return 415 Unsupported Media Type
        assert response.status_code != 415, (
            f"multipart/form-data should be accepted, got {response.status_code}"
        )


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
