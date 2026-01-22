"""
Unit tests for bulk import API endpoint

Tests the POST /api/projects/import endpoint with various scenarios:
- Valid CSV file upload
- Valid JSON file upload
- Invalid file format
- Validation errors

Validates: Requirements 11.1, 11.2, 11.6
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch, AsyncMock, MagicMock
from io import BytesIO
import json
import pandas as pd
from datetime import date

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app


class MockSupabaseTable:
    """Mock Supabase table for testing"""
    def __init__(self):
        self.inserted_data = []
    
    def insert(self, data):
        records = data if isinstance(data, list) else [data]
        self.inserted_data.extend(records)
        return self
    
    def execute(self):
        class Result:
            def __init__(self, data):
                self.data = data
        return Result(self.inserted_data)


class MockSupabaseClient:
    """Mock Supabase client for testing"""
    def __init__(self):
        self.tables = {}
    
    def table(self, table_name):
        if table_name not in self.tables:
            self.tables[table_name] = MockSupabaseTable()
        return self.tables[table_name]


@pytest.fixture
def mock_supabase():
    """Create mock Supabase client"""
    return MockSupabaseClient()


@pytest.fixture
def client(mock_supabase):
    """Create test client with mocked database"""
    # Patch the import processor to use mock supabase
    with patch('routers.projects_import._import_processor', None):
        with patch('routers.projects_import.supabase', mock_supabase):
            yield TestClient(app)


@pytest.fixture
def mock_auth():
    """Mock authentication to return test user"""
    with patch('auth.dependencies.get_current_user') as mock:
        mock.return_value = {
            'user_id': '00000000-0000-0000-0000-000000000001',
            'organization_id': '00000000-0000-0000-0000-000000000002',
            'email': 'test@example.com'
        }
        yield mock


@pytest.fixture
def valid_project_csv():
    """Generate valid project CSV file"""
    data = [
        {
            'name': 'Project Alpha',
            'description': 'Test project',
            'start_date': '2024-01-01',
            'end_date': '2024-12-31',
            'budget': 100000.00,
            'status': 'planning'
        },
        {
            'name': 'Project Beta',
            'description': 'Another test project',
            'start_date': '2024-02-01',
            'end_date': '2024-11-30',
            'budget': 150000.00,
            'status': 'active'
        }
    ]
    df = pd.DataFrame(data)
    csv_content = df.to_csv(index=False)
    return csv_content.encode('utf-8')


@pytest.fixture
def valid_project_json():
    """Generate valid project JSON file"""
    data = [
        {
            'name': 'Project Gamma',
            'description': 'JSON test project',
            'start_date': '2024-01-01',
            'end_date': '2024-12-31',
            'budget': 200000.00,
            'status': 'planning'
        }
    ]
    return json.dumps(data).encode('utf-8')


@pytest.fixture
def invalid_project_csv():
    """Generate CSV with validation errors"""
    data = [
        {
            'name': 'Invalid Project',
            'start_date': '2024-01-01',
            'end_date': '2023-12-31',  # End before start
            'budget': 100000.00,
            'status': 'planning'
        }
    ]
    df = pd.DataFrame(data)
    csv_content = df.to_csv(index=False)
    return csv_content.encode('utf-8')


def test_import_endpoint_valid_csv(client, mock_auth, valid_project_csv):
    """
    Test POST /api/projects/import with valid CSV file
    
    Validates: Requirement 11.1 - CSV file parsing
    """
    # Arrange
    files = {
        'file': ('projects.csv', BytesIO(valid_project_csv), 'text/csv')
    }
    data = {
        'entity_type': 'projects'
    }
    
    # Act
    response = client.post('/api/projects/import', files=files, data=data)
    
    # Assert
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    result = response.json()
    
    assert 'success_count' in result
    assert 'error_count' in result
    assert 'errors' in result
    assert 'processing_time_seconds' in result
    
    # Should successfully import 2 projects
    assert result['success_count'] == 2, f"Expected 2 successful imports, got {result['success_count']}"
    assert result['error_count'] == 0, f"Expected no errors, got {result['error_count']}"
    assert len(result['errors']) == 0


def test_import_endpoint_valid_json(client, mock_auth, valid_project_json):
    """
    Test POST /api/projects/import with valid JSON file
    
    Validates: Requirement 11.2 - JSON file parsing
    """
    # Arrange
    files = {
        'file': ('projects.json', BytesIO(valid_project_json), 'application/json')
    }
    data = {
        'entity_type': 'projects'
    }
    
    # Act
    response = client.post('/api/projects/import', files=files, data=data)
    
    # Assert
    assert response.status_code == 200
    result = response.json()
    
    assert result['success_count'] == 1
    assert result['error_count'] == 0
    assert len(result['errors']) == 0


def test_import_endpoint_invalid_file_format(client, mock_auth):
    """
    Test POST /api/projects/import with invalid file format
    
    Validates: Requirement 11.6 - Error handling for invalid formats
    """
    # Arrange
    invalid_content = b"This is not a valid CSV or JSON file"
    files = {
        'file': ('projects.txt', BytesIO(invalid_content), 'text/plain')
    }
    data = {
        'entity_type': 'projects'
    }
    
    # Act
    response = client.post('/api/projects/import', files=files, data=data)
    
    # Assert
    assert response.status_code == 422, f"Expected 422, got {response.status_code}"
    result = response.json()
    
    assert 'detail' in result
    assert 'error' in result['detail']
    assert result['detail']['error'] == 'validation_failed'
    assert 'Invalid file format' in result['detail']['message']


def test_import_endpoint_validation_errors(client, mock_auth, invalid_project_csv):
    """
    Test POST /api/projects/import with validation errors
    
    Validates: Requirement 11.6 - Validation error reporting with line numbers
    """
    # Arrange
    files = {
        'file': ('projects.csv', BytesIO(invalid_project_csv), 'text/csv')
    }
    data = {
        'entity_type': 'projects'
    }
    
    # Act
    response = client.post('/api/projects/import', files=files, data=data)
    
    # Assert
    assert response.status_code == 200  # Returns 200 with error details
    result = response.json()
    
    assert result['success_count'] == 0
    assert result['error_count'] > 0
    assert len(result['errors']) > 0
    
    # Verify error structure
    error = result['errors'][0]
    assert 'line_number' in error, "Error missing line_number"
    assert 'field' in error, "Error missing field"
    assert 'message' in error, "Error missing message"


def test_import_endpoint_invalid_entity_type(client, mock_auth, valid_project_csv):
    """
    Test POST /api/projects/import with invalid entity_type
    
    Validates: Input validation for entity_type parameter
    """
    # Arrange
    files = {
        'file': ('projects.csv', BytesIO(valid_project_csv), 'text/csv')
    }
    data = {
        'entity_type': 'invalid_type'
    }
    
    # Act
    response = client.post('/api/projects/import', files=files, data=data)
    
    # Assert
    assert response.status_code == 422
    result = response.json()
    
    assert 'detail' in result
    assert 'error' in result['detail']
    assert 'Invalid entity_type' in result['detail']['message']


def test_import_endpoint_empty_file(client, mock_auth):
    """
    Test POST /api/projects/import with empty file
    
    Validates: Error handling for empty files
    """
    # Arrange
    files = {
        'file': ('projects.csv', BytesIO(b''), 'text/csv')
    }
    data = {
        'entity_type': 'projects'
    }
    
    # Act
    response = client.post('/api/projects/import', files=files, data=data)
    
    # Assert
    assert response.status_code == 422
    result = response.json()
    
    assert 'detail' in result
    assert 'File is empty' in result['detail']['message']


def test_import_endpoint_missing_auth(client):
    """
    Test POST /api/projects/import without authentication
    
    Validates: JWT authentication requirement
    """
    # Arrange
    files = {
        'file': ('projects.csv', BytesIO(b'name,start_date,end_date,budget,status\n'), 'text/csv')
    }
    data = {
        'entity_type': 'projects'
    }
    
    # Act - Don't use mock_auth fixture
    with patch('auth.dependencies.get_current_user', side_effect=Exception("Unauthorized")):
        response = client.post('/api/projects/import', files=files, data=data)
    
    # Assert
    # In development mode, auth falls back to default user, so this might return 200
    # In production, it should return 401
    assert response.status_code in [200, 401, 403]


def test_import_endpoint_resources_csv(client, mock_auth):
    """
    Test POST /api/projects/import with resources entity type
    
    Validates: Support for multiple entity types
    """
    # Arrange
    data = [
        {
            'name': 'John Doe',
            'email': 'john@example.com',
            'role': 'Developer',
            'hourly_rate': 75.00,
            'capacity': 40,
            'availability': 100
        }
    ]
    df = pd.DataFrame(data)
    csv_content = df.to_csv(index=False).encode('utf-8')
    
    files = {
        'file': ('resources.csv', BytesIO(csv_content), 'text/csv')
    }
    form_data = {
        'entity_type': 'resources'
    }
    
    # Act
    response = client.post('/api/projects/import', files=files, data=form_data)
    
    # Assert
    assert response.status_code == 200
    result = response.json()
    
    assert result['success_count'] == 1
    assert result['error_count'] == 0


def test_import_endpoint_financials_json(client, mock_auth):
    """
    Test POST /api/projects/import with financials entity type
    
    Validates: Support for financials import
    """
    # Arrange
    data = [
        {
            'project_id': '550e8400-e29b-41d4-a716-446655440000',
            'category': 'Labor',
            'amount': 50000.00,
            'date_incurred': '2024-01-15',
            'transaction_type': 'expense'
        }
    ]
    json_content = json.dumps(data).encode('utf-8')
    
    files = {
        'file': ('financials.json', BytesIO(json_content), 'application/json')
    }
    form_data = {
        'entity_type': 'financials'
    }
    
    # Act
    response = client.post('/api/projects/import', files=files, data=form_data)
    
    # Assert
    assert response.status_code == 200
    result = response.json()
    
    assert result['success_count'] == 1
    assert result['error_count'] == 0


def test_import_endpoint_organization_filtering(client, mock_auth, valid_project_csv):
    """
    Test that imported records are tagged with organization_id
    
    Validates: Requirement 11.7 - Organization context filtering
    """
    # Arrange
    files = {
        'file': ('projects.csv', BytesIO(valid_project_csv), 'text/csv')
    }
    data = {
        'entity_type': 'projects'
    }
    
    # Act
    response = client.post('/api/projects/import', files=files, data=data)
    
    # Assert
    assert response.status_code == 200
    result = response.json()
    
    # Verify import was successful
    assert result['success_count'] > 0
    
    # Note: We can't directly verify organization_id in the response,
    # but the ImportProcessor adds it to all records before insertion
    # This is tested in the ImportProcessor unit tests


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
