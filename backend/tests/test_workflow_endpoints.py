"""
Unit tests for Workflow API endpoints

Tests specific scenarios for workflow endpoints:
- Approval submission
- Workflow advancement
- Permission validation

Feature: ai-empowered-ppm-features
**Validates: Requirements 7.1, 7.3, 7.4**
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch, AsyncMock
from uuid import uuid4
from datetime import datetime

from main import app
from workflow_engine import WorkflowEngine
from auth.dependencies import get_current_user

client = TestClient(app)


@pytest.fixture
def mock_current_user():
    """Mock authenticated user"""
    return {
        "user_id": str(uuid4()),
        "organization_id": str(uuid4()),
        "email": "test@example.com",
        "roles": ["manager"]
    }


@pytest.fixture
def mock_workflow_engine():
    """Mock workflow engine"""
    with patch('routers.workflows.get_workflow_engine') as mock:
        engine = Mock(spec=WorkflowEngine)
        mock.return_value = engine
        yield engine


def override_get_current_user(user_data):
    """Create a dependency override for get_current_user"""
    def _override():
        return user_data
    return _override


class TestApproveProjectEndpoint:
    """
    Test POST /workflows/approve-project endpoint
    
    Validates: Requirements 7.1, 7.4
    """
    
    def test_approve_project_success(self, mock_current_user, mock_workflow_engine):
        """Test successful project approval"""
        workflow_id = str(uuid4())
        entity_id = str(uuid4())
        instance_id = str(uuid4())
        
        mock_workflow_engine.create_instance = AsyncMock(return_value=instance_id)
        mock_workflow_engine.submit_approval = AsyncMock(return_value={
            "decision": "approved",
            "workflow_status": "completed",
            "is_complete": True,
            "current_step": 0
        })
        
        app.dependency_overrides[get_current_user] = override_get_current_user(mock_current_user)
        try:
            response = client.post(
                "/workflows/approve-project",
                params={
                    "workflow_id": workflow_id,
                    "entity_type": "project",
                    "entity_id": entity_id,
                    "decision": "approved",
                    "comments": "Looks good"
                }
            )
            assert response.status_code == 200
            data = response.json()
            assert data["decision"] == "approved"
            assert data["workflow_status"] == "completed"
            assert data["is_complete"] is True
        finally:
            app.dependency_overrides.clear()
    
    def test_approve_project_invalid_decision(self, mock_current_user, mock_workflow_engine):
        """Test approval with invalid decision"""
        workflow_id = str(uuid4())
        entity_id = str(uuid4())
        
        app.dependency_overrides[get_current_user] = override_get_current_user(mock_current_user)
        try:
            response = client.post(
                "/workflows/approve-project",
                params={
                    "workflow_id": workflow_id,
                    "entity_type": "project",
                    "entity_id": entity_id,
                    "decision": "maybe",
                    "comments": "Not sure"
                }
            )
            assert response.status_code == 422
            data = response.json()
            assert "validation_failed" in str(data["detail"])
        finally:
            app.dependency_overrides.clear()
    
    def test_approve_project_rejection(self, mock_current_user, mock_workflow_engine):
        """Test project rejection"""
        workflow_id = str(uuid4())
        entity_id = str(uuid4())
        instance_id = str(uuid4())
        
        mock_workflow_engine.create_instance = AsyncMock(return_value=instance_id)
        mock_workflow_engine.submit_approval = AsyncMock(return_value={
            "decision": "rejected",
            "workflow_status": "rejected",
            "is_complete": True,
            "current_step": 0
        })
        
        app.dependency_overrides[get_current_user] = override_get_current_user(mock_current_user)
        try:
            response = client.post(
                "/workflows/approve-project",
                params={
                    "workflow_id": workflow_id,
                    "entity_type": "project",
                    "entity_id": entity_id,
                    "decision": "rejected",
                    "comments": "Needs more work"
                }
            )
            assert response.status_code == 200
            data = response.json()
            assert data["decision"] == "rejected"
            assert data["workflow_status"] == "rejected"
            assert data["is_complete"] is True
        finally:
            app.dependency_overrides.clear()
    
    def test_approve_project_workflow_not_found(self, mock_current_user, mock_workflow_engine):
        """Test approval for non-existent workflow"""
        workflow_id = str(uuid4())
        entity_id = str(uuid4())
        
        mock_workflow_engine.create_instance = AsyncMock(
            side_effect=ValueError("Workflow not found")
        )
        
        app.dependency_overrides[get_current_user] = override_get_current_user(mock_current_user)
        try:
            response = client.post(
                "/workflows/approve-project",
                params={
                    "workflow_id": workflow_id,
                    "entity_type": "project",
                    "entity_id": entity_id,
                    "decision": "approved"
                }
            )
            assert response.status_code == 400
            assert "not found" in response.json()["detail"].lower()
        finally:
            app.dependency_overrides.clear()


class TestGetWorkflowInstanceEndpoint:
    """
    Test GET /workflows/instances/{id} endpoint
    
    Validates: Requirements 7.2, 7.4
    """
    
    def test_get_workflow_instance_success(self, mock_current_user, mock_workflow_engine):
        """Test successful workflow instance retrieval"""
        instance_id = str(uuid4())
        workflow_id = str(uuid4())
        
        mock_workflow_engine.get_instance_status = AsyncMock(return_value={
            "id": instance_id,
            "workflow_id": workflow_id,
            "workflow_name": "Test Workflow",
            "entity_type": "project",
            "entity_id": str(uuid4()),
            "current_step": 0,
            "status": "pending",
            "started_by": mock_current_user["user_id"],
            "started_at": datetime.utcnow().isoformat(),
            "completed_at": None,
            "approvals": {},
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        })
        
        app.dependency_overrides[get_current_user] = override_get_current_user(mock_current_user)
        try:
            response = client.get(f"/workflows/instances/{instance_id}")
            assert response.status_code == 200
            data = response.json()
            assert data["id"] == instance_id
            assert data["workflow_id"] == workflow_id
            assert data["status"] == "pending"
        finally:
            app.dependency_overrides.clear()
    
    def test_get_workflow_instance_not_found(self, mock_current_user, mock_workflow_engine):
        """Test retrieval of non-existent workflow instance"""
        instance_id = str(uuid4())
        
        mock_workflow_engine.get_instance_status = AsyncMock(
            side_effect=ValueError("Workflow instance not found")
        )
        
        app.dependency_overrides[get_current_user] = override_get_current_user(mock_current_user)
        try:
            response = client.get(f"/workflows/instances/{instance_id}")
            assert response.status_code == 404
            assert "not found" in response.json()["detail"].lower()
        finally:
            app.dependency_overrides.clear()
    
    def test_get_workflow_instance_wrong_organization(self, mock_current_user, mock_workflow_engine):
        """Test retrieval of workflow from different organization"""
        instance_id = str(uuid4())
        
        mock_workflow_engine.get_instance_status = AsyncMock(
            side_effect=ValueError("Workflow instance not found in organization")
        )
        
        app.dependency_overrides[get_current_user] = override_get_current_user(mock_current_user)
        try:
            response = client.get(f"/workflows/instances/{instance_id}")
            assert response.status_code == 404
            assert "not found" in response.json()["detail"].lower()
        finally:
            app.dependency_overrides.clear()


class TestAdvanceWorkflowEndpoint:
    """
    Test POST /workflows/instances/{id}/advance endpoint
    
    Validates: Requirements 7.3, 7.4
    """
    
    def test_advance_workflow_success(self, mock_current_user, mock_workflow_engine):
        """Test successful workflow advancement"""
        instance_id = str(uuid4())
        
        mock_workflow_engine.advance_workflow = AsyncMock(return_value={
            "status": "in_progress",
            "current_step": 1,
            "next_steps": [{
                "step_number": 1,
                "name": "Senior Manager Approval",
                "approver_role": "senior_manager"
            }]
        })
        
        app.dependency_overrides[get_current_user] = override_get_current_user(mock_current_user)
        try:
            response = client.post(f"/workflows/instances/{instance_id}/advance")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "in_progress"
            assert data["current_step"] == 1
            assert len(data["next_steps"]) == 1
        finally:
            app.dependency_overrides.clear()
    
    def test_advance_workflow_to_completion(self, mock_current_user, mock_workflow_engine):
        """Test workflow advancement to completion"""
        instance_id = str(uuid4())
        
        mock_workflow_engine.advance_workflow = AsyncMock(return_value={
            "status": "completed",
            "current_step": 2,
            "next_steps": []
        })
        
        app.dependency_overrides[get_current_user] = override_get_current_user(mock_current_user)
        try:
            response = client.post(f"/workflows/instances/{instance_id}/advance")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "completed"
            assert data["next_steps"] == []
        finally:
            app.dependency_overrides.clear()
    
    def test_advance_workflow_not_ready(self, mock_current_user, mock_workflow_engine):
        """Test advancement when approvals not complete"""
        instance_id = str(uuid4())
        
        mock_workflow_engine.advance_workflow = AsyncMock(
            side_effect=ValueError("Not all approvals for current step are approved")
        )
        
        app.dependency_overrides[get_current_user] = override_get_current_user(mock_current_user)
        try:
            response = client.post(f"/workflows/instances/{instance_id}/advance")
            assert response.status_code == 400
            assert "approval" in response.json()["detail"].lower()
        finally:
            app.dependency_overrides.clear()
    
    def test_advance_workflow_already_completed(self, mock_current_user, mock_workflow_engine):
        """Test advancement of already completed workflow"""
        instance_id = str(uuid4())
        
        mock_workflow_engine.advance_workflow = AsyncMock(
            side_effect=ValueError("Workflow is already completed")
        )
        
        app.dependency_overrides[get_current_user] = override_get_current_user(mock_current_user)
        try:
            response = client.post(f"/workflows/instances/{instance_id}/advance")
            assert response.status_code == 400
            assert "completed" in response.json()["detail"].lower()
        finally:
            app.dependency_overrides.clear()
    
    def test_advance_workflow_insufficient_permissions(self, mock_current_user, mock_workflow_engine):
        """Test advancement without sufficient permissions"""
        instance_id = str(uuid4())
        
        mock_workflow_engine.advance_workflow = AsyncMock(
            side_effect=ValueError("Insufficient permissions to advance workflow")
        )
        
        app.dependency_overrides[get_current_user] = override_get_current_user(mock_current_user)
        try:
            response = client.post(f"/workflows/instances/{instance_id}/advance")
            assert response.status_code == 403
            assert "permission" in response.json()["detail"].lower()
        finally:
            app.dependency_overrides.clear()
    
    def test_advance_workflow_not_found(self, mock_current_user, mock_workflow_engine):
        """Test advancement of non-existent workflow"""
        instance_id = str(uuid4())
        
        mock_workflow_engine.advance_workflow = AsyncMock(
            side_effect=ValueError("Workflow instance not found")
        )
        
        app.dependency_overrides[get_current_user] = override_get_current_user(mock_current_user)
        try:
            response = client.post(f"/workflows/instances/{instance_id}/advance")
            assert response.status_code == 404
            assert "not found" in response.json()["detail"].lower()
        finally:
            app.dependency_overrides.clear()


class TestWorkflowEndpointPermissions:
    """
    Test permission validation for workflow endpoints
    
    Validates: Requirements 7.4
    """
    
    def test_endpoints_validate_organization_context(self, mock_workflow_engine):
        """Test that endpoints validate organization context"""
        instance_id = str(uuid4())
        
        mock_user_no_org = {
            "user_id": str(uuid4()),
            "email": "test@example.com"
        }
        
        app.dependency_overrides[get_current_user] = override_get_current_user(mock_user_no_org)
        try:
            response = client.get(f"/workflows/instances/{instance_id}")
            assert response.status_code == 400
            assert "organization" in response.json()["detail"].lower()
        finally:
            app.dependency_overrides.clear()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
