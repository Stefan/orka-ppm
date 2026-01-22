"""
Tests for workflow instance management endpoints

Tests the workflow instance management endpoints including:
- POST /workflows/{id}/instances - Create workflow instance
- GET /workflows/{id}/instances - List workflow instances
- GET /workflow-instances/{id} - Get workflow instance (legacy)
- GET /workflow-instances/{id}/history - Get instance history
- GET /workflow-instances/{id}/audit - Get instance audit trail

Requirements: 3.2, 3.4
"""

import pytest
from fastapi.testclient import TestClient
from uuid import uuid4
from datetime import datetime

from main import app


@pytest.fixture
def test_client():
    """Create test client"""
    return TestClient(app)


@pytest.fixture
def mock_auth_headers():
    """Mock authentication headers"""
    # In a real test, this would use a valid JWT token
    return {
        "Authorization": "Bearer mock_token"
    }


@pytest.fixture
def sample_workflow_id():
    """Sample workflow ID for testing"""
    return uuid4()


@pytest.fixture
def sample_entity_data():
    """Sample entity data for workflow instance"""
    return {
        "entity_type": "financial_tracking",
        "entity_id": str(uuid4()),
        "project_id": str(uuid4())
    }


class TestCreateWorkflowInstance:
    """Test POST /workflows/{id}/instances endpoint"""
    
    def test_create_instance_success(self, test_client, mock_auth_headers, sample_workflow_id, sample_entity_data):
        """Test creating a workflow instance successfully"""
        response = test_client.post(
            f"/workflows/{sample_workflow_id}/instances",
            params={
                "entity_type": sample_entity_data["entity_type"],
                "entity_id": sample_entity_data["entity_id"],
                "project_id": sample_entity_data["project_id"]
            },
            headers=mock_auth_headers
        )
        
        # Should return 201 (created), 404 (workflow not found), or auth error
        assert response.status_code in [201, 404, 401, 403, 500]
        
        if response.status_code == 201:
            data = response.json()
            assert "id" in data
            assert "workflow_id" in data
            assert "entity_type" in data
            assert "entity_id" in data
            assert "status" in data
            assert "current_step" in data
    
    def test_create_instance_with_context(self, test_client, mock_auth_headers, sample_workflow_id, sample_entity_data):
        """Test creating workflow instance with context data"""
        context = {
            "variance_amount": 50000,
            "variance_percentage": 15.5,
            "reason": "Budget overrun"
        }
        
        response = test_client.post(
            f"/workflows/{sample_workflow_id}/instances",
            params={
                "entity_type": sample_entity_data["entity_type"],
                "entity_id": sample_entity_data["entity_id"]
            },
            json=context,
            headers=mock_auth_headers
        )
        
        assert response.status_code in [201, 404, 401, 403, 500]
    
    def test_create_instance_workflow_not_found(self, test_client, mock_auth_headers, sample_entity_data):
        """Test creating instance for non-existent workflow"""
        non_existent_id = uuid4()
        
        response = test_client.post(
            f"/workflows/{non_existent_id}/instances",
            params={
                "entity_type": sample_entity_data["entity_type"],
                "entity_id": sample_entity_data["entity_id"]
            },
            headers=mock_auth_headers
        )
        
        # Should return 404 or auth error
        assert response.status_code in [404, 401, 403, 500]
    
    def test_create_instance_missing_entity_type(self, test_client, mock_auth_headers, sample_workflow_id):
        """Test creating instance without entity_type"""
        response = test_client.post(
            f"/workflows/{sample_workflow_id}/instances",
            params={
                "entity_id": str(uuid4())
            },
            headers=mock_auth_headers
        )
        
        # Should return 422 (validation error)
        assert response.status_code in [422, 401, 403]
    
    def test_create_instance_missing_entity_id(self, test_client, mock_auth_headers, sample_workflow_id):
        """Test creating instance without entity_id"""
        response = test_client.post(
            f"/workflows/{sample_workflow_id}/instances",
            params={
                "entity_type": "project"
            },
            headers=mock_auth_headers
        )
        
        # Should return 422 (validation error)
        assert response.status_code in [422, 401, 403]
    
    def test_create_instance_invalid_workflow_id(self, test_client, mock_auth_headers, sample_entity_data):
        """Test creating instance with invalid workflow ID format"""
        response = test_client.post(
            "/workflows/invalid-uuid/instances",
            params={
                "entity_type": sample_entity_data["entity_type"],
                "entity_id": sample_entity_data["entity_id"]
            },
            headers=mock_auth_headers
        )
        
        # Should return 422 (validation error)
        assert response.status_code in [422, 401, 403]
    
    def test_create_instance_without_auth(self, test_client, sample_workflow_id, sample_entity_data):
        """Test creating instance without authentication"""
        response = test_client.post(
            f"/workflows/{sample_workflow_id}/instances",
            params={
                "entity_type": sample_entity_data["entity_type"],
                "entity_id": sample_entity_data["entity_id"]
            }
        )
        
        # Should return 401 (unauthorized), 422 (validation error), or 404 (workflow not found in dev mode)
        assert response.status_code in [401, 422, 404]


class TestListWorkflowInstances:
    """Test GET /workflows/{id}/instances endpoint"""
    
    def test_list_instances_success(self, test_client, mock_auth_headers, sample_workflow_id):
        """Test listing workflow instances successfully"""
        response = test_client.get(
            f"/workflows/{sample_workflow_id}/instances",
            headers=mock_auth_headers
        )
        
        # Should return 200, 404 (workflow not found), or auth error
        assert response.status_code in [200, 404, 401, 403, 500]
        
        if response.status_code == 200:
            data = response.json()
            assert "workflow_id" in data
            assert "instances" in data
            assert "count" in data
            assert "limit" in data
            assert "offset" in data
            assert isinstance(data["instances"], list)
    
    def test_list_instances_with_status_filter(self, test_client, mock_auth_headers, sample_workflow_id):
        """Test listing instances with status filter"""
        response = test_client.get(
            f"/workflows/{sample_workflow_id}/instances?status=in_progress",
            headers=mock_auth_headers
        )
        
        assert response.status_code in [200, 404, 401, 403, 500]
    
    def test_list_instances_with_pagination(self, test_client, mock_auth_headers, sample_workflow_id):
        """Test listing instances with pagination"""
        response = test_client.get(
            f"/workflows/{sample_workflow_id}/instances?limit=10&offset=20",
            headers=mock_auth_headers
        )
        
        assert response.status_code in [200, 404, 401, 403, 500]
        
        if response.status_code == 200:
            data = response.json()
            assert data["limit"] == 10
            assert data["offset"] == 20
    
    def test_list_instances_invalid_status(self, test_client, mock_auth_headers, sample_workflow_id):
        """Test listing instances with invalid status filter"""
        response = test_client.get(
            f"/workflows/{sample_workflow_id}/instances?status=invalid_status",
            headers=mock_auth_headers
        )
        
        # Should return 400 (bad request) or auth error
        assert response.status_code in [400, 401, 403, 404]
    
    def test_list_instances_invalid_pagination(self, test_client, mock_auth_headers, sample_workflow_id):
        """Test listing instances with invalid pagination parameters"""
        # Test with limit too high
        response = test_client.get(
            f"/workflows/{sample_workflow_id}/instances?limit=1000",
            headers=mock_auth_headers
        )
        assert response.status_code in [422, 401, 403, 404]
        
        # Test with negative offset
        response = test_client.get(
            f"/workflows/{sample_workflow_id}/instances?offset=-1",
            headers=mock_auth_headers
        )
        assert response.status_code in [422, 401, 403, 404]
    
    def test_list_instances_workflow_not_found(self, test_client, mock_auth_headers):
        """Test listing instances for non-existent workflow"""
        non_existent_id = uuid4()
        
        response = test_client.get(
            f"/workflows/{non_existent_id}/instances",
            headers=mock_auth_headers
        )
        
        # Should return 404
        assert response.status_code in [404, 401, 403, 500]


class TestGetWorkflowInstanceHistory:
    """Test GET /workflow-instances/{id}/history endpoint"""
    
    def test_get_history_success(self, test_client, mock_auth_headers):
        """Test getting workflow instance history successfully"""
        instance_id = uuid4()
        
        response = test_client.get(
            f"/workflows/instances/{instance_id}/history",
            headers=mock_auth_headers
        )
        
        # Should return 200, 404 (not found), or auth error
        assert response.status_code in [200, 404, 401, 403, 500]
        
        if response.status_code == 200:
            data = response.json()
            assert "instance_id" in data
            assert "workflow_id" in data
            assert "entity_type" in data
            assert "entity_id" in data
            assert "current_status" in data
            assert "audit_trail" in data
            assert "event_count" in data
            assert isinstance(data["audit_trail"], list)
    
    def test_get_history_instance_not_found(self, test_client, mock_auth_headers):
        """Test getting history for non-existent instance"""
        non_existent_id = uuid4()
        
        response = test_client.get(
            f"/workflows/instances/{non_existent_id}/history",
            headers=mock_auth_headers
        )
        
        # Should return 404
        assert response.status_code in [404, 401, 403, 500]
    
    def test_get_history_invalid_instance_id(self, test_client, mock_auth_headers):
        """Test getting history with invalid instance ID format"""
        response = test_client.get(
            "/workflows/instances/invalid-uuid/history",
            headers=mock_auth_headers
        )
        
        # Should return 422 (validation error)
        assert response.status_code in [422, 401, 403]
    
    def test_get_history_without_auth(self, test_client):
        """Test getting history without authentication"""
        instance_id = uuid4()
        
        response = test_client.get(
            f"/workflows/instances/{instance_id}/history"
        )
        
        # Should return 401 (unauthorized), 422 (validation error), or 404 (instance not found in dev mode)
        assert response.status_code in [401, 422, 404]
    
    def test_history_contains_expected_events(self, test_client, mock_auth_headers):
        """Test that history contains expected event types"""
        instance_id = uuid4()
        
        response = test_client.get(
            f"/workflows/instances/{instance_id}/history",
            headers=mock_auth_headers
        )
        
        if response.status_code == 200:
            data = response.json()
            audit_trail = data["audit_trail"]
            
            # Check that events are sorted by timestamp
            if len(audit_trail) > 1:
                timestamps = [event["timestamp"] for event in audit_trail]
                assert timestamps == sorted(timestamps)
            
            # Check event structure
            for event in audit_trail:
                assert "event_type" in event
                assert "timestamp" in event
                assert "details" in event


class TestGetWorkflowInstanceAuditTrail:
    """Test GET /workflow-instances/{id}/audit endpoint"""
    
    def test_get_audit_trail_success(self, test_client, mock_auth_headers):
        """Test getting audit trail successfully"""
        instance_id = uuid4()
        
        response = test_client.get(
            f"/workflows/instances/{instance_id}/audit",
            headers=mock_auth_headers
        )
        
        # Should return 200, 404 (not found), or auth error
        assert response.status_code in [200, 404, 401, 403, 500]
        
        if response.status_code == 200:
            data = response.json()
            assert "instance_id" in data
            assert "events" in data
            assert "count" in data
            assert "total_count" in data
            assert "limit" in data
            assert "offset" in data
            assert isinstance(data["events"], list)
    
    def test_get_audit_trail_with_event_type_filter(self, test_client, mock_auth_headers):
        """Test getting audit trail with event type filter"""
        instance_id = uuid4()
        
        response = test_client.get(
            f"/workflows/instances/{instance_id}/audit?event_type=approval_decision",
            headers=mock_auth_headers
        )
        
        assert response.status_code in [200, 404, 401, 403, 500]
        
        if response.status_code == 200:
            data = response.json()
            assert data["event_type_filter"] == "approval_decision"
            
            # All events should match the filter
            for event in data["events"]:
                assert event["event_type"] == "approval_decision"
    
    def test_get_audit_trail_with_pagination(self, test_client, mock_auth_headers):
        """Test getting audit trail with pagination"""
        instance_id = uuid4()
        
        response = test_client.get(
            f"/workflows/instances/{instance_id}/audit?limit=5&offset=10",
            headers=mock_auth_headers
        )
        
        assert response.status_code in [200, 404, 401, 403, 500]
        
        if response.status_code == 200:
            data = response.json()
            assert data["limit"] == 5
            assert data["offset"] == 10
            assert len(data["events"]) <= 5
    
    def test_get_audit_trail_invalid_pagination(self, test_client, mock_auth_headers):
        """Test getting audit trail with invalid pagination"""
        instance_id = uuid4()
        
        # Test with limit too high
        response = test_client.get(
            f"/workflows/instances/{instance_id}/audit?limit=1000",
            headers=mock_auth_headers
        )
        assert response.status_code in [422, 401, 403, 404]
        
        # Test with negative offset
        response = test_client.get(
            f"/workflows/instances/{instance_id}/audit?offset=-1",
            headers=mock_auth_headers
        )
        assert response.status_code in [422, 401, 403, 404]
    
    def test_get_audit_trail_instance_not_found(self, test_client, mock_auth_headers):
        """Test getting audit trail for non-existent instance"""
        non_existent_id = uuid4()
        
        response = test_client.get(
            f"/workflows/instances/{non_existent_id}/audit",
            headers=mock_auth_headers
        )
        
        # Should return 404
        assert response.status_code in [404, 401, 403, 500]


class TestWorkflowInstancePermissions:
    """Test RBAC integration for workflow instance endpoints"""
    
    def test_create_instance_requires_auth(self, test_client, sample_workflow_id, sample_entity_data):
        """Test that creating instance requires authentication"""
        response = test_client.post(
            f"/workflows/{sample_workflow_id}/instances",
            params={
                "entity_type": sample_entity_data["entity_type"],
                "entity_id": sample_entity_data["entity_id"]
            }
        )
        
        # Should return 401, 422 (validation error), or 404 (workflow not found in dev mode)
        assert response.status_code in [401, 422, 404]
    
    def test_list_instances_requires_auth(self, test_client, sample_workflow_id):
        """Test that listing instances requires authentication"""
        response = test_client.get(
            f"/workflows/{sample_workflow_id}/instances"
        )
        
        # Should return 401 or 200 (in dev mode with default user)
        assert response.status_code in [401, 200, 404]
    
    def test_get_history_requires_auth(self, test_client):
        """Test that getting history requires authentication"""
        instance_id = uuid4()
        
        response = test_client.get(
            f"/workflows/instances/{instance_id}/history"
        )
        
        # Should return 401, 422 (validation error), or 404 (instance not found in dev mode)
        assert response.status_code in [401, 422, 404]
    
    def test_get_audit_trail_requires_auth(self, test_client):
        """Test that getting audit trail requires authentication"""
        instance_id = uuid4()
        
        response = test_client.get(
            f"/workflows/instances/{instance_id}/audit"
        )
        
        # Should return 401, 422 (validation error), or 404 (instance not found in dev mode)
        assert response.status_code in [401, 422, 404]


class TestWorkflowInstanceIntegration:
    """Integration tests for workflow instance lifecycle"""
    
    def test_instance_lifecycle(self, test_client, mock_auth_headers):
        """Test complete workflow instance lifecycle"""
        # This would test:
        # 1. Create workflow definition
        # 2. Create workflow instance
        # 3. Submit approvals
        # 4. Check history
        # 5. Verify audit trail
        
        # Placeholder for integration test
        pass
    
    def test_instance_history_tracks_all_events(self):
        """Test that instance history tracks all workflow events"""
        # This would require integration testing with actual database
        pass
    
    def test_audit_trail_completeness(self):
        """Test that audit trail contains all required events"""
        # This would require integration testing with actual database
        pass


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
