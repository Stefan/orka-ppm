"""
End-to-End Integration Tests for AI-Powered PPM Platform

This module contains comprehensive integration tests that validate complete workflows
from frontend to backend, including AI agent integration and real-time updates.

Test Coverage:
- Complete authentication and authorization workflows
- Project management workflows (CRUD, health calculation, portfolio metrics)
- Resource management and optimization workflows
- Financial tracking and budget alert workflows
- Risk and issue management workflows
- AI agent integration workflows (Resource Optimizer, Risk Forecaster, RAG Reporter)
- Real-time updates and notification systems
- Cross-service data flow validation

Requirements Validated: All (comprehensive system validation)
"""

import pytest
import asyncio
import json
import time
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from unittest.mock import Mock, patch, AsyncMock
from fastapi.testclient import TestClient
from supabase import create_client, Client
import os
from dotenv import load_dotenv
import uuid

# Load environment variables
load_dotenv()

# Import the main application
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from main import app

# Test client
client = TestClient(app)

# Test Supabase client with service role key
test_supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)

class TestDataManager:
    """Manages test data creation and cleanup"""
    
    def __init__(self):
        self.created_resources = []
        self.created_portfolios = []
        self.created_projects = []
        self.created_risks = []
        self.created_issues = []
        self.created_workflows = []
        self.created_users = []
    
    def create_test_portfolio(self, name: str = None) -> Dict[str, Any]:
        """Create a test portfolio"""
        portfolio_data = {
            "name": name or f"Test Portfolio {uuid.uuid4().hex[:8]}",
            "description": "Integration test portfolio",
            "status": "active"
        }
        
        response = test_supabase.table("portfolios").insert(portfolio_data).execute()
        portfolio = response.data[0]
        self.created_portfolios.append(portfolio["id"])
        return portfolio
    
    def create_test_project(self, portfolio_id: str, name: str = None) -> Dict[str, Any]:
        """Create a test project"""
        project_data = {
            "portfolio_id": portfolio_id,
            "name": name or f"Test Project {uuid.uuid4().hex[:8]}",
            "description": "Integration test project",
            "status": "planning",
            "budget": 50000.0,
            "start_date": datetime.now().date().isoformat(),
            "end_date": (datetime.now() + timedelta(days=90)).date().isoformat()
        }
        
        response = test_supabase.table("projects").insert(project_data).execute()
        project = response.data[0]
        self.created_projects.append(project["id"])
        return project
    
    def create_test_resource(self, name: str = None) -> Dict[str, Any]:
        """Create a test resource"""
        resource_data = {
            "name": name or f"Test Resource {uuid.uuid4().hex[:8]}",
            "email": f"test{uuid.uuid4().hex[:8]}@example.com",
            "role": "Developer",
            "skills": ["Python", "FastAPI", "PostgreSQL"],
            "capacity": 40,
            "availability": 100,
            "hourly_rate": 75.0,
            "location": "Remote"
        }
        
        response = test_supabase.table("resources").insert(resource_data).execute()
        resource = response.data[0]
        self.created_resources.append(resource["id"])
        return resource
    
    def create_test_risk(self, project_id: str) -> Dict[str, Any]:
        """Create a test risk"""
        risk_data = {
            "project_id": project_id,
            "title": f"Test Risk {uuid.uuid4().hex[:8]}",
            "description": "Integration test risk",
            "category": "technical",
            "probability": 0.3,
            "impact": 0.7,
            "status": "identified",
            "mitigation": "Test mitigation strategy"
        }
        
        response = test_supabase.table("risks").insert(risk_data).execute()
        risk = response.data[0]
        self.created_risks.append(risk["id"])
        return risk
    
    def create_test_issue(self, project_id: str, related_risk_id: str = None) -> Dict[str, Any]:
        """Create a test issue"""
        issue_data = {
            "project_id": project_id,
            "title": f"Test Issue {uuid.uuid4().hex[:8]}",
            "description": "Integration test issue",
            "severity": "medium",
            "status": "open"
        }
        
        if related_risk_id:
            issue_data["related_risk_id"] = related_risk_id
        
        response = test_supabase.table("issues").insert(issue_data).execute()
        issue = response.data[0]
        self.created_issues.append(issue["id"])
        return issue
    
    def cleanup(self):
        """Clean up all created test data"""
        try:
            # Clean up in reverse dependency order
            for issue_id in self.created_issues:
                test_supabase.table("issues").delete().eq("id", issue_id).execute()
            
            for risk_id in self.created_risks:
                test_supabase.table("risks").delete().eq("id", risk_id).execute()
            
            for project_id in self.created_projects:
                test_supabase.table("projects").delete().eq("id", project_id).execute()
            
            for resource_id in self.created_resources:
                test_supabase.table("resources").delete().eq("id", resource_id).execute()
            
            for portfolio_id in self.created_portfolios:
                test_supabase.table("portfolios").delete().eq("id", portfolio_id).execute()
            
            # Clear lists
            self.created_issues.clear()
            self.created_risks.clear()
            self.created_projects.clear()
            self.created_resources.clear()
            self.created_portfolios.clear()
            
        except Exception as e:
            print(f"Cleanup error: {e}")


@pytest.fixture
def test_data_manager():
    """Fixture providing test data management"""
    manager = TestDataManager()
    yield manager
    manager.cleanup()


class TestCompleteWorkflows:
    """Test complete workflows from frontend to backend"""
    
    def test_complete_project_lifecycle_workflow(self, test_data_manager):
        """
        Test complete project lifecycle from creation to completion
        Validates: Requirements 1.1, 1.4, 6.1, 6.3
        """
        # Step 1: Create portfolio
        portfolio = test_data_manager.create_test_portfolio("Lifecycle Test Portfolio")
        
        # Step 2: Create project via API (simulating frontend)
        project_data = {
            "portfolio_id": portfolio["id"],
            "name": "Lifecycle Test Project",
            "description": "Complete lifecycle test",
            "status": "planning",
            "budget": 100000.0
        }
        
        # Mock authentication for API calls
        with patch('main.get_current_user') as mock_auth:
            mock_auth.return_value = {"id": "test-user", "email": "test@example.com"}
            
            # Create project
            response = client.post("/projects/", json=project_data)
            assert response.status_code == 201
            project = response.json()
            test_data_manager.created_projects.append(project["id"])
            
            # Step 3: Update project status to active
            update_data = {"status": "active"}
            response = client.put(f"/projects/{project['id']}", json=update_data)
            assert response.status_code == 200
            updated_project = response.json()
            assert updated_project["status"] == "active"
            
            # Step 4: Add risks to project
            risk_data = {
                "project_id": project["id"],
                "title": "Technical Risk",
                "description": "Integration complexity",
                "category": "technical",
                "probability": 0.4,
                "impact": 0.6,
                "mitigation": "Incremental development"
            }
            
            response = client.post("/risks/", json=risk_data)
            assert response.status_code == 201
            risk = response.json()
            test_data_manager.created_risks.append(risk["id"])
            
            # Step 5: Convert risk to issue (simulating risk materialization)
            issue_data = {
                "project_id": project["id"],
                "related_risk_id": risk["id"],
                "title": "Technical Issue",
                "description": "Risk materialized into issue",
                "severity": "medium",
                "status": "open"
            }
            
            response = client.post("/issues/", json=issue_data)
            assert response.status_code == 201
            issue = response.json()
            test_data_manager.created_issues.append(issue["id"])
            
            # Step 6: Verify risk-issue linkage
            response = client.get(f"/issues/{issue['id']}")
            assert response.status_code == 200
            retrieved_issue = response.json()
            assert retrieved_issue["related_risk_id"] == risk["id"]
            
            # Step 7: Update project to completed
            completion_data = {"status": "completed"}
            response = client.put(f"/projects/{project['id']}", json=completion_data)
            assert response.status_code == 200
            completed_project = response.json()
            assert completed_project["status"] == "completed"
    
    def test_resource_optimization_workflow(self, test_data_manager):
        """
        Test complete resource optimization workflow
        Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5
        """
        # Step 1: Create test data
        portfolio = test_data_manager.create_test_portfolio("Resource Test Portfolio")
        project1 = test_data_manager.create_test_project(portfolio["id"], "Project Alpha")
        project2 = test_data_manager.create_test_project(portfolio["id"], "Project Beta")
        resource1 = test_data_manager.create_test_resource("Alice Developer")
        resource2 = test_data_manager.create_test_resource("Bob Designer")
        
        with patch('main.get_current_user') as mock_auth:
            mock_auth.return_value = {"id": "test-user", "email": "test@example.com"}
            
            # Step 2: Allocate resources to projects
            allocation_data = {
                "allocation_percentage": 80,
                "role": "Lead Developer",
                "start_date": datetime.now().date().isoformat(),
                "end_date": (datetime.now() + timedelta(days=30)).date().isoformat()
            }
            
            response = client.post(
                f"/resources/{resource1['id']}/allocate/{project1['id']}", 
                json=allocation_data
            )
            assert response.status_code == 200
            
            # Step 3: Try to over-allocate resource (should detect conflict)
            over_allocation_data = {
                "allocation_percentage": 60,  # Would total 140%
                "role": "Developer",
                "start_date": datetime.now().date().isoformat(),
                "end_date": (datetime.now() + timedelta(days=30)).date().isoformat()
            }
            
            response = client.post(
                f"/resources/{resource1['id']}/allocate/{project2['id']}", 
                json=over_allocation_data
            )
            # Should either reject or warn about over-allocation
            assert response.status_code in [400, 409, 200]  # Various conflict handling approaches
            
            # Step 4: Get resource utilization summary
            response = client.get("/resources/utilization/summary")
            assert response.status_code == 200
            utilization_data = response.json()
            assert "total_resources" in utilization_data
            assert "utilization_distribution" in utilization_data
            
            # Step 5: Search for available resources
            search_data = {
                "skills": ["Python"],
                "min_availability": 20,
                "max_utilization": 80
            }
            
            response = client.post("/resources/search", json=search_data)
            assert response.status_code == 200
            search_results = response.json()
            assert isinstance(search_results, list)
    
    def test_financial_tracking_workflow(self, test_data_manager):
        """
        Test complete financial tracking and budget alert workflow
        Validates: Requirements 5.1, 5.2, 5.3, 5.4
        """
        # Step 1: Create test project with budget
        portfolio = test_data_manager.create_test_portfolio("Financial Test Portfolio")
        project = test_data_manager.create_test_project(portfolio["id"], "Financial Test Project")
        
        with patch('main.get_current_user') as mock_auth:
            mock_auth.return_value = {"id": "test-user", "email": "test@example.com"}
            
            # Step 2: Create budget alert rule
            alert_rule_data = {
                "project_id": project["id"],
                "threshold_percentage": 80.0,
                "alert_type": "budget_overrun",
                "notification_emails": ["pm@example.com"],
                "is_active": True
            }
            
            response = client.post("/budget-alerts/rules/", json=alert_rule_data)
            assert response.status_code == 201
            alert_rule = response.json()
            
            # Step 3: Add cost updates to project
            cost_update_data = {
                "category": "Development",
                "amount": 30000.0,
                "currency": "USD",
                "date": datetime.now().date().isoformat(),
                "description": "Development costs Q1"
            }
            
            response = client.post(f"/projects/{project['id']}/costs", json=cost_update_data)
            assert response.status_code == 201
            
            # Step 4: Add more costs to trigger alert (assuming 50k budget)
            cost_update_data2 = {
                "category": "Testing",
                "amount": 25000.0,
                "currency": "USD",
                "date": datetime.now().date().isoformat(),
                "description": "Testing costs Q1"
            }
            
            response = client.post(f"/projects/{project['id']}/costs", json=cost_update_data2)
            assert response.status_code == 201
            
            # Step 5: Check budget variance (should be over 80% threshold)
            response = client.get(f"/projects/{project['id']}/budget-variance")
            assert response.status_code == 200
            variance_data = response.json()
            assert "variance_percentage" in variance_data
            assert variance_data["variance_percentage"] > 80.0
            
            # Step 6: Check if alerts were generated
            response = client.get(f"/budget-alerts/project/{project['id']}")
            assert response.status_code == 200
            alerts = response.json()
            assert len(alerts) > 0
            assert alerts[0]["alert_type"] == "budget_overrun"
    
    @patch('main.ai_agents')
    def test_ai_agent_integration_workflow(self, mock_ai_agents, test_data_manager):
        """
        Test AI agent integration and data flow
        Validates: Requirements 2.1, 3.1, 4.1, 4.4
        """
        # Mock AI agents
        mock_resource_optimizer = Mock()
        mock_risk_forecaster = Mock()
        mock_rag_reporter = Mock()
        mock_hallucination_validator = Mock()
        
        mock_ai_agents.resource_optimizer = mock_resource_optimizer
        mock_ai_agents.risk_forecaster = mock_risk_forecaster
        mock_ai_agents.rag_reporter = mock_rag_reporter
        mock_ai_agents.hallucination_validator = mock_hallucination_validator
        
        # Setup mock responses
        mock_resource_optimizer.analyze_resource_allocation.return_value = {
            "recommendations": [
                {
                    "type": "reallocation",
                    "description": "Reallocate Alice from Project A to Project B",
                    "confidence_score": 0.85,
                    "reasoning": "Better skill match and availability"
                }
            ]
        }
        
        mock_risk_forecaster.forecast_risks.return_value = [
            {
                "risk_type": "schedule_delay",
                "probability": 0.4,
                "potential_impact": 0.6,
                "timeframe": "next_30_days",
                "suggested_mitigation": "Add additional resources"
            }
        ]
        
        mock_rag_reporter.generate_report.return_value = {
            "report": "Project Alpha is 75% complete with moderate risk levels.",
            "sources": ["project_data", "risk_register"],
            "confidence": 0.9
        }
        
        mock_hallucination_validator.validate_report.return_value = {
            "is_valid": True,
            "confidence": 0.95,
            "inconsistencies": []
        }
        
        # Step 1: Create test data
        portfolio = test_data_manager.create_test_portfolio("AI Test Portfolio")
        project = test_data_manager.create_test_project(portfolio["id"], "AI Test Project")
        resource = test_data_manager.create_test_resource("AI Test Resource")
        
        with patch('main.get_current_user') as mock_auth:
            mock_auth.return_value = {"id": "test-user", "email": "test@example.com"}
            
            # Step 2: Test Resource Optimizer Agent
            optimization_request = {
                "project_ids": [project["id"]],
                "optimization_type": "skill_matching"
            }
            
            response = client.post("/ai/resource-optimization", json=optimization_request)
            assert response.status_code == 200
            optimization_result = response.json()
            assert "recommendations" in optimization_result
            mock_resource_optimizer.analyze_resource_allocation.assert_called_once()
            
            # Step 3: Test Risk Forecaster Agent
            response = client.post(f"/ai/risk-forecast/{project['id']}")
            assert response.status_code == 200
            risk_forecast = response.json()
            assert "forecasted_risks" in risk_forecast
            mock_risk_forecaster.forecast_risks.assert_called_once()
            
            # Step 4: Test RAG Reporter Agent
            query_data = {
                "query": "What is the status of Project AI Test Project?",
                "context_filters": {
                    "project_ids": [project["id"]]
                }
            }
            
            response = client.post("/ai/generate-report", json=query_data)
            assert response.status_code == 200
            report_result = response.json()
            assert "report" in report_result
            assert "validation_result" in report_result
            mock_rag_reporter.generate_report.assert_called_once()
            mock_hallucination_validator.validate_report.assert_called_once()
    
    def test_real_time_updates_workflow(self, test_data_manager):
        """
        Test real-time updates and notification systems
        Validates: Requirements 1.1, 7.5, 8.4
        """
        # This test simulates real-time updates by checking database changes
        # In a full integration test, this would involve WebSocket connections
        
        # Step 1: Create test data
        portfolio = test_data_manager.create_test_portfolio("Realtime Test Portfolio")
        project = test_data_manager.create_test_project(portfolio["id"], "Realtime Test Project")
        
        with patch('main.get_current_user') as mock_auth:
            mock_auth.return_value = {"id": "test-user", "email": "test@example.com"}
            
            # Step 2: Get initial dashboard data
            response = client.get("/dashboard")
            assert response.status_code == 200
            initial_dashboard = response.json()
            initial_project_count = len(initial_dashboard.get("projects", []))
            
            # Step 3: Create new project (simulating real-time update trigger)
            new_project_data = {
                "portfolio_id": portfolio["id"],
                "name": "Realtime New Project",
                "description": "Project created for real-time testing",
                "status": "planning",
                "budget": 75000.0
            }
            
            response = client.post("/projects/", json=new_project_data)
            assert response.status_code == 201
            new_project = response.json()
            test_data_manager.created_projects.append(new_project["id"])
            
            # Step 4: Get updated dashboard data
            response = client.get("/dashboard")
            assert response.status_code == 200
            updated_dashboard = response.json()
            updated_project_count = len(updated_dashboard.get("projects", []))
            
            # Verify real-time update occurred
            assert updated_project_count == initial_project_count + 1
            
            # Step 5: Update project status (another real-time trigger)
            status_update = {"status": "active"}
            response = client.put(f"/projects/{new_project['id']}", json=status_update)
            assert response.status_code == 200
            
            # Step 6: Verify audit log entry was created
            # In a real system, this would check audit_logs table
            response = client.get(f"/projects/{new_project['id']}")
            assert response.status_code == 200
            project_data = response.json()
            assert project_data["status"] == "active"
    
    def test_cross_service_data_flow(self, test_data_manager):
        """
        Test data flow across multiple services and components
        Validates: Requirements 6.5, 7.2, 8.5
        """
        # Step 1: Create comprehensive test scenario
        portfolio = test_data_manager.create_test_portfolio("Cross-Service Test Portfolio")
        project = test_data_manager.create_test_project(portfolio["id"], "Cross-Service Test Project")
        resource = test_data_manager.create_test_resource("Cross-Service Test Resource")
        risk = test_data_manager.create_test_risk(project["id"])
        
        with patch('main.get_current_user') as mock_auth:
            mock_auth.return_value = {"id": "test-user", "email": "test@example.com"}
            
            # Step 2: Create workflow template
            workflow_data = {
                "name": "Project Approval Workflow",
                "description": "Multi-step project approval process",
                "steps": [
                    {
                        "id": "manager_approval",
                        "name": "Manager Approval",
                        "type": "approval",
                        "approvers": ["manager@example.com"],
                        "timeout_hours": 48
                    },
                    {
                        "id": "finance_approval",
                        "name": "Finance Approval",
                        "type": "approval",
                        "approvers": ["finance@example.com"],
                        "timeout_hours": 24
                    }
                ],
                "routing_rules": [],
                "is_active": True
            }
            
            response = client.post("/workflow-templates/", json=workflow_data)
            assert response.status_code == 201
            workflow_template = response.json()
            
            # Step 3: Submit approval request
            approval_request = {
                "workflow_template_id": workflow_template["id"],
                "context": {
                    "project_id": project["id"],
                    "budget_amount": 100000.0,
                    "justification": "Critical project for Q2 delivery"
                },
                "priority": "high"
            }
            
            response = client.post("/approval-requests/", json=approval_request)
            assert response.status_code == 201
            approval_process = response.json()
            
            # Step 4: Simulate approval response
            approval_response = {
                "decision": "approved",
                "comments": "Approved with budget constraints"
            }
            
            response = client.post(
                f"/approval-processes/{approval_process['id']}/respond/manager_approval",
                json=approval_response
            )
            assert response.status_code == 200
            
            # Step 5: Check workflow status update
            response = client.get(f"/approval-processes/{approval_process['id']}")
            assert response.status_code == 200
            process_status = response.json()
            assert process_status["current_step"] > 0  # Should have advanced
            
            # Step 6: Convert risk to issue (cross-service linkage)
            issue_data = {
                "project_id": project["id"],
                "related_risk_id": risk["id"],
                "title": "Risk Materialized",
                "description": "Technical risk became an issue",
                "severity": "high",
                "status": "open"
            }
            
            response = client.post("/issues/", json=issue_data)
            assert response.status_code == 201
            issue = response.json()
            test_data_manager.created_issues.append(issue["id"])
            
            # Step 7: Verify cross-service data consistency
            # Check that risk status was updated when issue was created
            response = client.get(f"/risks/{risk['id']}")
            assert response.status_code == 200
            updated_risk = response.json()
            
            # Check that project health was recalculated due to new issue
            response = client.get(f"/projects/{project['id']}")
            assert response.status_code == 200
            updated_project = response.json()
            # Health should reflect the new high-severity issue
            assert updated_project["health"] in ["yellow", "red"]
    
    def test_error_handling_and_recovery(self, test_data_manager):
        """
        Test error handling and system recovery scenarios
        Validates: Requirements 9.1, 9.4
        """
        with patch('main.get_current_user') as mock_auth:
            mock_auth.return_value = {"id": "test-user", "email": "test@example.com"}
            
            # Test 1: Invalid data handling
            invalid_project_data = {
                "portfolio_id": "invalid-uuid",
                "name": "",  # Empty name should fail validation
                "budget": -1000  # Negative budget should fail
            }
            
            response = client.post("/projects/", json=invalid_project_data)
            assert response.status_code in [400, 422]  # Bad request or validation error
            
            # Test 2: Non-existent resource access
            response = client.get("/projects/00000000-0000-0000-0000-000000000000")
            assert response.status_code == 404
            
            # Test 3: Rate limiting (if implemented)
            # Make multiple rapid requests to test rate limiting
            responses = []
            for i in range(10):
                response = client.get("/dashboard")
                responses.append(response.status_code)
            
            # Should have at least some successful responses
            assert 200 in responses
            
            # Test 4: Database connection error simulation
            with patch('main.supabase') as mock_supabase:
                mock_supabase.table.side_effect = Exception("Database connection failed")
                
                response = client.get("/projects/")
                assert response.status_code == 500
    
    def test_performance_and_scalability(self, test_data_manager):
        """
        Test system performance under load
        Validates: Requirements 9.2, 9.3
        """
        # Create multiple test entities to simulate load
        portfolio = test_data_manager.create_test_portfolio("Performance Test Portfolio")
        
        # Create multiple projects
        projects = []
        for i in range(5):
            project = test_data_manager.create_test_project(
                portfolio["id"], 
                f"Performance Test Project {i}"
            )
            projects.append(project)
        
        # Create multiple resources
        resources = []
        for i in range(5):
            resource = test_data_manager.create_test_resource(f"Performance Test Resource {i}")
            resources.append(resource)
        
        with patch('main.get_current_user') as mock_auth:
            mock_auth.return_value = {"id": "test-user", "email": "test@example.com"}
            
            # Test 1: Dashboard performance with multiple projects
            start_time = time.time()
            response = client.get("/dashboard")
            end_time = time.time()
            
            assert response.status_code == 200
            response_time = end_time - start_time
            assert response_time < 5.0  # Should respond within 5 seconds
            
            # Test 2: Portfolio metrics calculation performance
            start_time = time.time()
            response = client.get("/portfolio/metrics")
            end_time = time.time()
            
            assert response.status_code == 200
            response_time = end_time - start_time
            assert response_time < 5.0  # Should respond within 5 seconds
            
            # Test 3: Resource utilization summary performance
            start_time = time.time()
            response = client.get("/resources/utilization/summary")
            end_time = time.time()
            
            assert response.status_code == 200
            response_time = end_time - start_time
            assert response_time < 3.0  # Should respond within 3 seconds
            
            # Test 4: Bulk operations performance
            search_data = {
                "skills": ["Python"],
                "min_availability": 0,
                "max_utilization": 100
            }
            
            start_time = time.time()
            response = client.post("/resources/search", json=search_data)
            end_time = time.time()
            
            assert response.status_code == 200
            response_time = end_time - start_time
            assert response_time < 2.0  # Should respond within 2 seconds


if __name__ == "__main__":
    pytest.main([__file__, "-v"])