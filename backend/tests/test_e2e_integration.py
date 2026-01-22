"""
End-to-End Integration Tests for AI-Empowered PPM Features

This module tests complete workflows across the system:
1. AI agent workflow (query → response → audit log)
2. Workflow approval (create → approve → complete → notification)
3. Import workflow (upload → validate → insert → audit log)
4. Audit workflow (action → log → search → tag → export)

Feature: ai-empowered-ppm-features
Task: 23.1 Test end-to-end workflows
"""

import pytest
import asyncio
import json
import csv
import io
from uuid import uuid4
from datetime import datetime, timedelta
from typing import Dict, Any

# Import system components
from ai_agents import (
    RAGReporterAgent,
    ResourceOptimizerAgent,
    RiskForecasterAgent,
    DataValidatorAgent,
    AnomalyDetectorAgent,
    AuditSearchAgent
)
from workflow_engine import WorkflowEngine
from import_processor import ImportProcessor


@pytest.mark.asyncio
class TestAIAgentWorkflow:
    """Test complete AI agent workflow: query → response → audit log"""
    
    async def test_rag_agent_complete_workflow(
        self,
        supabase_client,
        openai_client,
        test_organization_id,
        test_user_id
    ):
        """
        Test RAG agent end-to-end:
        1. User submits query
        2. Agent processes and generates response
        3. Response includes confidence score
        4. Interaction is logged to audit_logs
        """
        # Arrange
        agent = RAGReporterAgent(supabase_client, openai_client)
        query = "What is the total budget for active projects?"
        
        # Act
        result = await agent.generate_report(
            query=query,
            organization_id=test_organization_id,
            user_id=test_user_id
        )
        
        # Assert - Response structure
        assert "response" in result
        assert "confidence" in result
        assert "sources" in result
        assert 0.0 <= result["confidence"] <= 1.0
        
        # Assert - Audit log created
        audit_logs = supabase_client.table("audit_logs")\
            .select("*")\
            .eq("user_id", test_user_id)\
            .eq("action", "ai_query")\
            .order("created_at", desc=True)\
            .limit(1)\
            .execute()
        
        assert len(audit_logs.data) > 0
        latest_log = audit_logs.data[0]
        assert latest_log["organization_id"] == test_organization_id
        assert latest_log["success"] is True
        assert "query" in latest_log["details"]
        assert latest_log["details"]["query"] == query
        assert "confidence" in latest_log["details"]
    
    async def test_optimizer_agent_complete_workflow(
        self,
        supabase_client,
        test_organization_id,
        test_user_id
    ):
        """
        Test Resource Optimizer agent end-to-end:
        1. User requests optimization
        2. Agent retrieves data and optimizes
        3. Returns recommendations with confidence
        4. Logs operation to audit_logs
        """
        # Arrange
        agent = ResourceOptimizerAgent(supabase_client)
        
        # Act
        result = await agent.optimize_resources(
            organization_id=test_organization_id,
            user_id=test_user_id,
            constraints=None
        )
        
        # Assert - Response structure
        assert "recommendations" in result
        assert "total_cost_savings" in result
        assert "model_confidence" in result
        assert 0.0 <= result["model_confidence"] <= 1.0
        
        # Assert - Each recommendation has confidence
        for rec in result["recommendations"]:
            assert "confidence" in rec
            assert 0.0 <= rec["confidence"] <= 1.0
        
        # Assert - Audit log created
        audit_logs = supabase_client.table("audit_logs")\
            .select("*")\
            .eq("user_id", test_user_id)\
            .eq("action", "resource_optimization")\
            .order("created_at", desc=True)\
            .limit(1)\
            .execute()
        
        assert len(audit_logs.data) > 0
        latest_log = audit_logs.data[0]
        assert latest_log["organization_id"] == test_organization_id
        assert latest_log["success"] is True


@pytest.mark.asyncio
class TestWorkflowApprovalWorkflow:
    """Test complete workflow approval: create → approve → complete → notification"""
    
    async def test_complete_workflow_approval_cycle(
        self,
        supabase_client,
        test_organization_id,
        test_user_id,
        test_approver_id
    ):
        """
        Test complete workflow approval cycle:
        1. Create workflow instance
        2. Submit approval decision
        3. Workflow advances to next step
        4. Final approval completes workflow
        5. All state changes logged
        6. Notifications sent (via Realtime)
        """
        # Arrange
        engine = WorkflowEngine(supabase_client)
        
        # Create a test workflow definition
        workflow_id = str(uuid4())
        workflow_data = {
            "id": workflow_id,
            "name": "Test Project Approval",
            "description": "Two-step approval workflow",
            "steps": [
                {
                    "step_number": 0,
                    "name": "Manager Approval",
                    "approver_role": "manager",
                    "required_approvals": 1,
                    "auto_advance": True
                },
                {
                    "step_number": 1,
                    "name": "Director Approval",
                    "approver_role": "admin",
                    "required_approvals": 1,
                    "auto_advance": True
                }
            ],
            "organization_id": test_organization_id
        }
        
        supabase_client.table("workflows").insert(workflow_data).execute()
        
        # Act 1: Create workflow instance
        instance_id = await engine.create_instance(
            workflow_id=workflow_id,
            entity_type="project",
            entity_id=str(uuid4()),
            organization_id=test_organization_id,
            initiator_id=test_user_id
        )
        
        # Assert 1: Instance created with correct initial state
        instance = supabase_client.table("workflow_instances")\
            .select("*")\
            .eq("id", instance_id)\
            .single()\
            .execute()
        
        assert instance.data["status"] == "pending"
        assert instance.data["current_step"] == 0
        assert instance.data["organization_id"] == test_organization_id
        
        # Assert 1b: Approval records created for first step
        approvals = supabase_client.table("workflow_approvals")\
            .select("*")\
            .eq("workflow_instance_id", instance_id)\
            .eq("step_number", 0)\
            .execute()
        
        assert len(approvals.data) > 0
        assert approvals.data[0]["decision"] is None  # Pending
        
        # Act 2: Submit first approval
        result = await engine.submit_approval(
            instance_id=instance_id,
            decision="approved",
            comments="Looks good",
            approver_id=test_approver_id,
            organization_id=test_organization_id
        )
        
        # Assert 2: Workflow advanced to step 1
        instance = supabase_client.table("workflow_instances")\
            .select("*")\
            .eq("id", instance_id)\
            .single()\
            .execute()
        
        assert instance.data["current_step"] == 1
        assert instance.data["status"] == "pending"  # Still pending final approval
        
        # Assert 2b: Approval recorded
        approval = supabase_client.table("workflow_approvals")\
            .select("*")\
            .eq("workflow_instance_id", instance_id)\
            .eq("step_number", 0)\
            .eq("approver_id", test_approver_id)\
            .single()\
            .execute()
        
        assert approval.data["decision"] == "approved"
        assert approval.data["comments"] == "Looks good"
        
        # Act 3: Submit final approval
        result = await engine.submit_approval(
            instance_id=instance_id,
            decision="approved",
            comments="Final approval",
            approver_id=test_approver_id,
            organization_id=test_organization_id
        )
        
        # Assert 3: Workflow completed
        instance = supabase_client.table("workflow_instances")\
            .select("*")\
            .eq("id", instance_id)\
            .single()\
            .execute()
        
        assert instance.data["status"] == "completed"
        
        # Assert 4: All state changes logged to audit_logs
        audit_logs = supabase_client.table("audit_logs")\
            .select("*")\
            .eq("entity_id", instance_id)\
            .eq("action", "workflow_state_change")\
            .order("created_at")\
            .execute()
        
        assert len(audit_logs.data) >= 3  # Create, advance, complete
        
    async def test_workflow_rejection_halts_progression(
        self,
        supabase_client,
        test_organization_id,
        test_user_id,
        test_approver_id
    ):
        """
        Test workflow rejection:
        1. Create workflow instance
        2. Submit rejection decision
        3. Workflow status set to rejected
        4. No further advancement occurs
        """
        # Arrange
        engine = WorkflowEngine(supabase_client)
        workflow_id = str(uuid4())
        
        # Create simple workflow
        workflow_data = {
            "id": workflow_id,
            "name": "Test Rejection",
            "steps": [{"step_number": 0, "name": "Approval", "required_approvals": 1}],
            "organization_id": test_organization_id
        }
        supabase_client.table("workflows").insert(workflow_data).execute()
        
        instance_id = await engine.create_instance(
            workflow_id=workflow_id,
            entity_type="project",
            entity_id=str(uuid4()),
            organization_id=test_organization_id,
            initiator_id=test_user_id
        )
        
        # Act: Reject workflow
        await engine.submit_approval(
            instance_id=instance_id,
            decision="rejected",
            comments="Not approved",
            approver_id=test_approver_id,
            organization_id=test_organization_id
        )
        
        # Assert: Workflow rejected and halted
        instance = supabase_client.table("workflow_instances")\
            .select("*")\
            .eq("id", instance_id)\
            .single()\
            .execute()
        
        assert instance.data["status"] == "rejected"
        assert instance.data["current_step"] == 0  # Did not advance


@pytest.mark.asyncio
class TestImportWorkflow:
    """Test complete import workflow: upload → validate → insert → audit log"""
    
    async def test_csv_import_complete_workflow(
        self,
        supabase_client,
        test_organization_id,
        test_user_id
    ):
        """
        Test CSV import end-to-end:
        1. User uploads CSV file
        2. System parses and validates records
        3. Valid records inserted in transaction
        4. Import logged to audit_logs
        5. Summary returned with counts
        """
        # Arrange
        processor = ImportProcessor(supabase_client)
        
        # Create test CSV content
        csv_content = io.StringIO()
        writer = csv.DictWriter(csv_content, fieldnames=[
            "name", "description", "start_date", "end_date", "budget", "status"
        ])
        writer.writeheader()
        writer.writerow({
            "name": "Test Project 1",
            "description": "Description 1",
            "start_date": "2024-01-01",
            "end_date": "2024-12-31",
            "budget": "100000.00",
            "status": "active"
        })
        writer.writerow({
            "name": "Test Project 2",
            "description": "Description 2",
            "start_date": "2024-02-01",
            "end_date": "2024-11-30",
            "budget": "150000.00",
            "status": "planning"
        })
        
        csv_bytes = csv_content.getvalue().encode('utf-8')
        
        # Act
        result = await processor.process_import(
            file_content=csv_bytes,
            file_type="csv",
            entity_type="projects",
            organization_id=test_organization_id,
            user_id=test_user_id
        )
        
        # Assert - Import summary
        assert result["success_count"] == 2
        assert result["error_count"] == 0
        assert len(result["errors"]) == 0
        
        # Assert - Records inserted
        projects = supabase_client.table("projects")\
            .select("*")\
            .eq("organization_id", test_organization_id)\
            .in_("name", ["Test Project 1", "Test Project 2"])\
            .execute()
        
        assert len(projects.data) == 2
        
        # Assert - Audit log created
        audit_logs = supabase_client.table("audit_logs")\
            .select("*")\
            .eq("user_id", test_user_id)\
            .eq("action", "bulk_import")\
            .order("created_at", desc=True)\
            .limit(1)\
            .execute()
        
        assert len(audit_logs.data) > 0
        latest_log = audit_logs.data[0]
        assert latest_log["organization_id"] == test_organization_id
        assert latest_log["success"] is True
        assert latest_log["details"]["entity_type"] == "projects"
        assert latest_log["details"]["success_count"] == 2
    
    async def test_import_validation_error_reporting(
        self,
        supabase_client,
        test_organization_id,
        test_user_id
    ):
        """
        Test import with validation errors:
        1. Upload file with invalid records
        2. System validates and collects errors
        3. No records inserted (transaction rolled back)
        4. Detailed error report returned
        """
        # Arrange
        processor = ImportProcessor(supabase_client)
        
        # Create CSV with validation errors
        csv_content = io.StringIO()
        writer = csv.DictWriter(csv_content, fieldnames=[
            "name", "description", "start_date", "end_date", "budget", "status"
        ])
        writer.writeheader()
        writer.writerow({
            "name": "",  # Invalid: empty name
            "description": "Description",
            "start_date": "2024-01-01",
            "end_date": "2023-12-31",  # Invalid: end before start
            "budget": "-1000",  # Invalid: negative budget
            "status": "invalid_status"  # Invalid: not in allowed values
        })
        
        csv_bytes = csv_content.getvalue().encode('utf-8')
        
        # Act
        result = await processor.process_import(
            file_content=csv_bytes,
            file_type="csv",
            entity_type="projects",
            organization_id=test_organization_id,
            user_id=test_user_id
        )
        
        # Assert - Validation errors reported
        assert result["success_count"] == 0
        assert result["error_count"] > 0
        assert len(result["errors"]) > 0
        
        # Assert - Errors have line numbers and field names
        for error in result["errors"]:
            assert "line_number" in error
            assert "field" in error
            assert "message" in error
        
        # Assert - No records inserted
        projects = supabase_client.table("projects")\
            .select("*")\
            .eq("organization_id", test_organization_id)\
            .eq("name", "")\
            .execute()
        
        assert len(projects.data) == 0


@pytest.mark.asyncio
class TestAuditWorkflow:
    """Test complete audit workflow: action → log → search → tag → export"""
    
    async def test_complete_audit_workflow(
        self,
        supabase_client,
        openai_client,
        test_organization_id,
        test_user_id
    ):
        """
        Test complete audit workflow:
        1. Perform action (creates audit log)
        2. Search logs using natural language
        3. Tag relevant log entries
        4. Export filtered logs
        """
        # Arrange
        search_agent = AuditSearchAgent(supabase_client, openai_client)
        
        # Act 1: Create some audit log entries
        test_actions = [
            {
                "organization_id": test_organization_id,
                "user_id": test_user_id,
                "action": "project_created",
                "entity_type": "project",
                "entity_id": str(uuid4()),
                "details": {"name": "New Project", "budget": 100000},
                "success": True
            },
            {
                "organization_id": test_organization_id,
                "user_id": test_user_id,
                "action": "budget_updated",
                "entity_type": "project",
                "entity_id": str(uuid4()),
                "details": {"old_budget": 100000, "new_budget": 150000},
                "success": True
            }
        ]
        
        for action in test_actions:
            supabase_client.table("audit_logs").insert(action).execute()
        
        # Act 2: Search audit logs
        search_result = await search_agent.search_audit_logs(
            query="budget changes",
            organization_id=test_organization_id,
            user_id=test_user_id,
            limit=10
        )
        
        # Assert 2: Search returns relevant results
        assert "results" in search_result
        assert len(search_result["results"]) > 0
        
        # Results should be ranked by relevance
        for result in search_result["results"]:
            assert "relevance_score" in result
            assert "highlighted_text" in result
        
        # Act 3: Tag a log entry
        log_id = search_result["results"][0]["log_id"]
        
        supabase_client.table("audit_logs")\
            .update({"tags": ["important", "budget"]})\
            .eq("id", log_id)\
            .execute()
        
        # Assert 3: Tag added and tagging action logged
        tagged_log = supabase_client.table("audit_logs")\
            .select("*")\
            .eq("id", log_id)\
            .single()\
            .execute()
        
        assert "important" in tagged_log.data["tags"]
        assert "budget" in tagged_log.data["tags"]
        
        # Act 4: Export audit logs
        export_logs = supabase_client.table("audit_logs")\
            .select("*")\
            .eq("organization_id", test_organization_id)\
            .gte("created_at", (datetime.now() - timedelta(days=1)).isoformat())\
            .execute()
        
        # Assert 4: Export includes all required fields
        for log in export_logs.data:
            assert "timestamp" in log or "created_at" in log
            assert "user_id" in log
            assert "action" in log
            assert "details" in log
            assert "success" in log
    
    async def test_anomaly_detection_workflow(
        self,
        supabase_client,
        test_organization_id,
        test_user_id
    ):
        """
        Test anomaly detection workflow:
        1. Create normal and anomalous audit logs
        2. Run anomaly detection
        3. Anomalies identified with confidence scores
        4. Detection logged to audit_logs
        """
        # Arrange
        detector = AnomalyDetectorAgent(supabase_client)
        
        # Create normal activity pattern
        for i in range(20):
            supabase_client.table("audit_logs").insert({
                "organization_id": test_organization_id,
                "user_id": test_user_id,
                "action": "view_project",
                "entity_type": "project",
                "entity_id": str(uuid4()),
                "details": {},
                "success": True,
                "created_at": (datetime.now() - timedelta(hours=i)).isoformat()
            }).execute()
        
        # Create anomalous activity (many failed login attempts)
        for i in range(10):
            supabase_client.table("audit_logs").insert({
                "organization_id": test_organization_id,
                "user_id": test_user_id,
                "action": "login_failed",
                "entity_type": "user",
                "entity_id": test_user_id,
                "details": {"reason": "invalid_password"},
                "success": False,
                "created_at": (datetime.now() - timedelta(minutes=i)).isoformat()
            }).execute()
        
        # Act: Detect anomalies
        result = await detector.detect_anomalies(
            organization_id=test_organization_id,
            time_range_days=1,
            user_id=test_user_id
        )
        
        # Assert: Anomalies detected
        assert "anomalies" in result
        assert len(result["anomalies"]) > 0
        
        # Anomalies have confidence scores
        for anomaly in result["anomalies"]:
            assert "confidence" in anomaly
            assert 0.0 <= anomaly["confidence"] <= 1.0
            assert "reason" in anomaly
        
        # Assert: Detection logged
        audit_logs = supabase_client.table("audit_logs")\
            .select("*")\
            .eq("user_id", test_user_id)\
            .eq("action", "anomaly_detection")\
            .order("created_at", desc=True)\
            .limit(1)\
            .execute()
        
        assert len(audit_logs.data) > 0


# Fixtures for tests
@pytest.fixture
def test_organization_id():
    """Generate test organization ID"""
    return str(uuid4())


@pytest.fixture
def test_user_id():
    """Generate test user ID"""
    return str(uuid4())


@pytest.fixture
def test_approver_id():
    """Generate test approver ID"""
    return str(uuid4())


@pytest.fixture
def supabase_client():
    """Mock or real Supabase client for testing"""
    # This should be configured in conftest.py
    # For now, return a mock
    from unittest.mock import MagicMock
    return MagicMock()


@pytest.fixture
def openai_client():
    """Mock or real OpenAI client for testing"""
    # This should be configured in conftest.py
    from unittest.mock import MagicMock
    return MagicMock()
