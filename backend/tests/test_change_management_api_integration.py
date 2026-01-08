"""
Integration tests for Change Management API endpoints
Tests complete change request lifecycle via API
"""

import pytest
import asyncio
from fastapi.testclient import TestClient
from datetime import date, datetime
from uuid import uuid4, UUID
from decimal import Decimal

from main import app
from models.change_management import (
    ChangeType, ChangeStatus, PriorityLevel, ApprovalDecision
)

client = TestClient(app)

# Test data
TEST_PROJECT_ID = str(uuid4())
TEST_USER_ID = str(uuid4())
TEST_APPROVER_ID = str(uuid4())

@pytest.fixture
def auth_headers():
    """Mock authentication headers for testing"""
    return {
        "Authorization": f"Bearer test-token-{TEST_USER_ID}",
        "Content-Type": "application/json"
    }

@pytest.fixture
def test_change_request_data():
    """Test change request data"""
    return {
        "title": "Test Change Request - API Integration",
        "description": "This is a test change request for API integration testing",
        "justification": "Testing the complete change management API workflow",
        "change_type": ChangeType.SCOPE.value,
        "priority": PriorityLevel.MEDIUM.value,
        "project_id": TEST_PROJECT_ID,
        "required_by_date": "2024-12-31",
        "estimated_cost_impact": 10000.00,
        "estimated_schedule_impact_days": 5,
        "estimated_effort_hours": 40.0,
        "affected_milestones": [],
        "affected_pos": []
    }

class TestChangeRequestCRUD:
    """Test Change Request CRUD operations (Subtask 11.1)"""
    
    def test_create_change_request(self, auth_headers, test_change_request_data):
        """Test creating a new change request"""
        response = client.post("/changes", json=test_change_request_data, headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["title"] == test_change_request_data["title"]
        assert data["description"] == test_change_request_data["description"]
        assert data["change_type"] == test_change_request_data["change_type"]
        assert data["priority"] == test_change_request_data["priority"]
        assert data["status"] == ChangeStatus.DRAFT.value
        assert "change_number" in data
        assert "id" in data
        
        return data["id"]  # Return for use in other tests
    
    def test_create_change_request_validation_error(self, auth_headers):
        """Test change request creation with validation errors"""
        invalid_data = {
            "title": "Too short",  # Too short
            "description": "Short",  # Too short
            "change_type": "invalid_type",  # Invalid enum
            "project_id": "invalid-uuid"  # Invalid UUID
        }
        
        response = client.post("/changes", json=invalid_data, headers=auth_headers)
        assert response.status_code == 422  # Validation error
    
    def test_list_change_requests(self, auth_headers):
        """Test listing change requests with filters"""
        # Test basic listing
        response = client.get("/changes", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Test with filters
        response = client.get(
            f"/changes?project_id={TEST_PROJECT_ID}&status=draft&page=1&page_size=10",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        # Test search functionality
        response = client.get(
            "/changes?search_term=test&page=1&page_size=5",
            headers=auth_headers
        )
        assert response.status_code == 200
    
    def test_get_change_request(self, auth_headers):
        """Test getting a specific change request"""
        # First create a change request
        test_data = {
            "title": "Test Get Change Request",
            "description": "Testing get change request endpoint",
            "change_type": ChangeType.BUDGET.value,
            "project_id": TEST_PROJECT_ID
        }
        
        create_response = client.post("/changes", json=test_data, headers=auth_headers)
        assert create_response.status_code == 200
        change_id = create_response.json()["id"]
        
        # Test getting the change request
        response = client.get(f"/changes/{change_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert data["id"] == change_id
        assert data["title"] == test_data["title"]
        assert data["description"] == test_data["description"]
    
    def test_get_nonexistent_change_request(self, auth_headers):
        """Test getting a non-existent change request"""
        fake_id = str(uuid4())
        response = client.get(f"/changes/{fake_id}", headers=auth_headers)
        assert response.status_code == 404
    
    def test_update_change_request(self, auth_headers):
        """Test updating a change request"""
        # First create a change request
        test_data = {
            "title": "Test Update Change Request",
            "description": "Testing update change request endpoint",
            "change_type": ChangeType.DESIGN.value,
            "project_id": TEST_PROJECT_ID
        }
        
        create_response = client.post("/changes", json=test_data, headers=auth_headers)
        assert create_response.status_code == 200
        change_id = create_response.json()["id"]
        
        # Test updating the change request
        update_data = {
            "title": "Updated Test Change Request",
            "priority": PriorityLevel.HIGH.value,
            "estimated_cost_impact": 15000.00
        }
        
        response = client.put(f"/changes/{change_id}", json=update_data, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert data["title"] == update_data["title"]
        assert data["priority"] == update_data["priority"]
        assert float(data["estimated_cost_impact"]) == update_data["estimated_cost_impact"]
    
    def test_cancel_change_request(self, auth_headers):
        """Test cancelling a change request"""
        # First create a change request
        test_data = {
            "title": "Test Cancel Change Request",
            "description": "Testing cancel change request endpoint",
            "change_type": ChangeType.SCHEDULE.value,
            "project_id": TEST_PROJECT_ID
        }
        
        create_response = client.post("/changes", json=test_data, headers=auth_headers)
        assert create_response.status_code == 200
        change_id = create_response.json()["id"]
        
        # Test cancelling the change request
        response = client.delete(f"/changes/{change_id}", headers=auth_headers)
        assert response.status_code == 200
        
        # Verify the change request is cancelled
        get_response = client.get(f"/changes/{change_id}", headers=auth_headers)
        assert get_response.status_code == 200
        assert get_response.json()["status"] == ChangeStatus.CANCELLED.value

class TestApprovalWorkflow:
    """Test Approval Workflow endpoints (Subtask 11.2)"""
    
    def test_submit_for_approval(self, auth_headers):
        """Test submitting a change request for approval"""
        # First create a change request
        test_data = {
            "title": "Test Approval Workflow",
            "description": "Testing approval workflow endpoints",
            "change_type": ChangeType.SCOPE.value,
            "project_id": TEST_PROJECT_ID
        }
        
        create_response = client.post("/changes", json=test_data, headers=auth_headers)
        assert create_response.status_code == 200
        change_id = create_response.json()["id"]
        
        # Test submitting for approval
        response = client.post(f"/changes/{change_id}/submit-for-approval", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "message" in data
        assert "workflow_id" in data
        assert "approval_steps" in data
    
    def test_get_pending_approvals(self, auth_headers):
        """Test getting pending approvals for current user"""
        response = client.get("/changes/approvals/pending", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_change_approvals(self, auth_headers):
        """Test getting approvals for a specific change request"""
        # First create and submit a change request
        test_data = {
            "title": "Test Change Approvals",
            "description": "Testing change approvals endpoint",
            "change_type": ChangeType.BUDGET.value,
            "project_id": TEST_PROJECT_ID
        }
        
        create_response = client.post("/changes", json=test_data, headers=auth_headers)
        assert create_response.status_code == 200
        change_id = create_response.json()["id"]
        
        # Submit for approval
        client.post(f"/changes/{change_id}/submit-for-approval", headers=auth_headers)
        
        # Test getting approvals
        response = client.get(f"/changes/{change_id}/approvals", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

class TestImpactAnalysis:
    """Test Impact Analysis endpoints (Subtask 11.3)"""
    
    def test_analyze_change_impact(self, auth_headers):
        """Test performing impact analysis on a change request"""
        # First create a change request
        test_data = {
            "title": "Test Impact Analysis",
            "description": "Testing impact analysis endpoints",
            "change_type": ChangeType.SCOPE.value,
            "project_id": TEST_PROJECT_ID,
            "estimated_cost_impact": 20000.00
        }
        
        create_response = client.post("/changes", json=test_data, headers=auth_headers)
        assert create_response.status_code == 200
        change_id = create_response.json()["id"]
        
        # Test impact analysis
        analysis_request = {
            "change_request_id": change_id,
            "include_scenarios": True,
            "detailed_breakdown": True
        }
        
        response = client.post(
            f"/changes/{change_id}/analyze-impact",
            json=analysis_request,
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["change_request_id"] == change_id
        assert "total_cost_impact" in data
        assert "schedule_impact_days" in data
        assert "scenarios" in data
    
    def test_get_impact_analysis(self, auth_headers):
        """Test getting existing impact analysis"""
        # First create a change request and analyze it
        test_data = {
            "title": "Test Get Impact Analysis",
            "description": "Testing get impact analysis endpoint",
            "change_type": ChangeType.DESIGN.value,
            "project_id": TEST_PROJECT_ID
        }
        
        create_response = client.post("/changes", json=test_data, headers=auth_headers)
        assert create_response.status_code == 200
        change_id = create_response.json()["id"]
        
        # Perform analysis first
        analysis_request = {
            "change_request_id": change_id,
            "include_scenarios": False
        }
        client.post(f"/changes/{change_id}/analyze-impact", json=analysis_request, headers=auth_headers)
        
        # Test getting the analysis
        response = client.get(f"/changes/{change_id}/impact", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert data["change_request_id"] == change_id
    
    def test_generate_impact_scenarios(self, auth_headers):
        """Test generating impact scenarios"""
        # First create a change request
        test_data = {
            "title": "Test Impact Scenarios",
            "description": "Testing impact scenarios endpoint",
            "change_type": ChangeType.RESOURCE.value,
            "project_id": TEST_PROJECT_ID
        }
        
        create_response = client.post("/changes", json=test_data, headers=auth_headers)
        assert create_response.status_code == 200
        change_id = create_response.json()["id"]
        
        # Test generating scenarios
        response = client.post(f"/changes/{change_id}/impact/scenarios", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert data["change_request_id"] == change_id
        assert "scenarios" in data
        assert "generated_at" in data

class TestImplementationTracking:
    """Test Implementation Tracking endpoints (Subtask 11.4)"""
    
    def test_start_implementation(self, auth_headers):
        """Test starting implementation of an approved change"""
        # First create and approve a change request
        test_data = {
            "title": "Test Implementation Start",
            "description": "Testing implementation start endpoint",
            "change_type": ChangeType.SCOPE.value,
            "project_id": TEST_PROJECT_ID
        }
        
        create_response = client.post("/changes", json=test_data, headers=auth_headers)
        assert create_response.status_code == 200
        change_id = create_response.json()["id"]
        
        # Update to approved status (simulating approval workflow completion)
        update_data = {"status": ChangeStatus.APPROVED.value}
        client.put(f"/changes/{change_id}", json=update_data, headers=auth_headers)
        
        # Test starting implementation
        implementation_plan = {
            "implementation_plan": {
                "start_date": "2024-02-01",
                "end_date": "2024-02-15",
                "tasks": [
                    {"name": "Task 1", "duration": 5},
                    {"name": "Task 2", "duration": 10}
                ]
            },
            "assigned_to": TEST_USER_ID,
            "implementation_team": [TEST_USER_ID],
            "implementation_milestones": [
                {"name": "Milestone 1", "date": "2024-02-08"}
            ]
        }
        
        response = client.post(
            f"/changes/{change_id}/start-implementation",
            json=implementation_plan,
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["change_request_id"] == change_id
        assert "implementation_plan" in data
    
    def test_get_implementation_status(self, auth_headers):
        """Test getting implementation status"""
        # First create, approve, and start implementation
        test_data = {
            "title": "Test Implementation Status",
            "description": "Testing implementation status endpoint",
            "change_type": ChangeType.BUDGET.value,
            "project_id": TEST_PROJECT_ID
        }
        
        create_response = client.post("/changes", json=test_data, headers=auth_headers)
        assert create_response.status_code == 200
        change_id = create_response.json()["id"]
        
        # Update to approved and start implementation
        update_data = {"status": ChangeStatus.APPROVED.value}
        client.put(f"/changes/{change_id}", json=update_data, headers=auth_headers)
        
        implementation_plan = {
            "implementation_plan": {"tasks": []},
            "assigned_to": TEST_USER_ID
        }
        client.post(f"/changes/{change_id}/start-implementation", json=implementation_plan, headers=auth_headers)
        
        # Test getting implementation status
        response = client.get(f"/changes/{change_id}/implementation", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert data["change_request_id"] == change_id

class TestAnalyticsAndReporting:
    """Test Analytics and Reporting endpoints (Subtask 11.5)"""
    
    def test_get_change_analytics(self, auth_headers):
        """Test getting change analytics"""
        response = client.get("/changes/analytics", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "total_changes" in data
        assert "changes_by_status" in data
        assert "changes_by_type" in data
        assert "average_approval_time_days" in data
    
    def test_get_change_analytics_with_filters(self, auth_headers):
        """Test getting change analytics with filters"""
        params = {
            "project_id": TEST_PROJECT_ID,
            "date_from": "2024-01-01",
            "date_to": "2024-12-31",
            "change_type": ChangeType.SCOPE.value,
            "include_trends": True
        }
        
        response = client.get("/changes/analytics", params=params, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "total_changes" in data
        assert "monthly_change_volume" in data
    
    def test_get_audit_trail(self, auth_headers):
        """Test getting audit trail for a change request"""
        # First create a change request
        test_data = {
            "title": "Test Audit Trail",
            "description": "Testing audit trail endpoint",
            "change_type": ChangeType.QUALITY.value,
            "project_id": TEST_PROJECT_ID
        }
        
        create_response = client.post("/changes", json=test_data, headers=auth_headers)
        assert create_response.status_code == 200
        change_id = create_response.json()["id"]
        
        # Test getting audit trail
        response = client.get(f"/changes/{change_id}/audit-trail", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_executive_summary(self, auth_headers):
        """Test getting executive summary report"""
        response = client.get("/changes/reports/executive-summary", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Executive summary should contain key metrics and insights
        assert isinstance(data, dict)
    
    def test_get_performance_metrics(self, auth_headers):
        """Test getting performance metrics"""
        response = client.get("/changes/reports/performance-metrics", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, dict)
    
    def test_get_compliance_report(self, auth_headers):
        """Test getting compliance report"""
        response = client.get("/changes/reports/compliance", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, dict)

class TestErrorHandling:
    """Test error handling and validation responses"""
    
    def test_unauthorized_access(self):
        """Test accessing endpoints without authentication"""
        response = client.get("/changes")
        assert response.status_code == 401  # Unauthorized
    
    def test_invalid_uuid_format(self, auth_headers):
        """Test endpoints with invalid UUID format"""
        response = client.get("/changes/invalid-uuid", headers=auth_headers)
        assert response.status_code == 422  # Validation error
    
    def test_nonexistent_resource_access(self, auth_headers):
        """Test accessing non-existent resources"""
        fake_id = str(uuid4())
        
        # Test various endpoints with non-existent ID
        endpoints = [
            f"/changes/{fake_id}",
            f"/changes/{fake_id}/impact",
            f"/changes/{fake_id}/implementation",
            f"/changes/{fake_id}/audit-trail"
        ]
        
        for endpoint in endpoints:
            response = client.get(endpoint, headers=auth_headers)
            assert response.status_code == 404

class TestCompleteWorkflow:
    """Test complete change request lifecycle via API"""
    
    def test_complete_change_lifecycle(self, auth_headers):
        """Test complete change request lifecycle from creation to closure"""
        # 1. Create change request
        test_data = {
            "title": "Complete Lifecycle Test",
            "description": "Testing complete change request lifecycle",
            "change_type": ChangeType.SCOPE.value,
            "priority": PriorityLevel.HIGH.value,
            "project_id": TEST_PROJECT_ID,
            "estimated_cost_impact": 25000.00,
            "estimated_schedule_impact_days": 10
        }
        
        create_response = client.post("/changes", json=test_data, headers=auth_headers)
        assert create_response.status_code == 200
        change_id = create_response.json()["id"]
        assert create_response.json()["status"] == ChangeStatus.DRAFT.value
        
        # 2. Submit for approval
        submit_response = client.post(f"/changes/{change_id}/submit-for-approval", headers=auth_headers)
        assert submit_response.status_code == 200
        
        # 3. Perform impact analysis
        analysis_request = {
            "change_request_id": change_id,
            "include_scenarios": True
        }
        analysis_response = client.post(
            f"/changes/{change_id}/analyze-impact",
            json=analysis_request,
            headers=auth_headers
        )
        assert analysis_response.status_code == 200
        
        # 4. Approve the change (simulate approval workflow completion)
        approve_update = {"status": ChangeStatus.APPROVED.value}
        approve_response = client.put(f"/changes/{change_id}", json=approve_update, headers=auth_headers)
        assert approve_response.status_code == 200
        
        # 5. Start implementation
        implementation_plan = {
            "implementation_plan": {
                "tasks": [{"name": "Implementation Task", "duration": 5}]
            },
            "assigned_to": TEST_USER_ID
        }
        impl_response = client.post(
            f"/changes/{change_id}/start-implementation",
            json=implementation_plan,
            headers=auth_headers
        )
        assert impl_response.status_code == 200
        
        # 6. Update implementation progress
        progress_update = {
            "progress_percentage": 50,
            "completed_tasks": [{"name": "Task 1", "completed_at": "2024-02-05"}],
            "pending_tasks": [{"name": "Task 2", "due_date": "2024-02-10"}]
        }
        progress_response = client.put(
            f"/changes/{change_id}/implementation/progress",
            json=progress_update,
            headers=auth_headers
        )
        assert progress_response.status_code == 200
        
        # 7. Complete implementation
        complete_update = {
            "progress_percentage": 100,
            "lessons_learned": "Implementation completed successfully"
        }
        complete_response = client.put(
            f"/changes/{change_id}/implementation/progress",
            json=complete_update,
            headers=auth_headers
        )
        assert complete_response.status_code == 200
        
        # 8. Verify final status
        final_response = client.get(f"/changes/{change_id}", headers=auth_headers)
        assert final_response.status_code == 200
        assert final_response.json()["status"] == ChangeStatus.IMPLEMENTED.value
        
        # 9. Get audit trail
        audit_response = client.get(f"/changes/{change_id}/audit-trail", headers=auth_headers)
        assert audit_response.status_code == 200
        audit_data = audit_response.json()
        assert len(audit_data) > 0  # Should have multiple audit entries

if __name__ == "__main__":
    pytest.main([__file__, "-v"])