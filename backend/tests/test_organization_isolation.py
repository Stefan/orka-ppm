"""
Organization Isolation Tests for AI-Empowered PPM Features

This module tests that all features properly isolate data by organization_id:
1. Users can only access their organization's data
2. Imports are scoped to organization
3. Workflows are isolated by organization
4. Audit logs are filtered by organization

Feature: ai-empowered-ppm-features
Task: 23.2 Verify organization isolation across all features
"""

import pytest
from uuid import uuid4
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
class TestAIAgentOrganizationIsolation:
    """Test that AI agents only access data from the user's organization"""
    
    async def test_rag_agent_organization_filtering(
        self,
        supabase_client,
        openai_client
    ):
        """
        Test RAG agent filters by organization:
        1. Create data for two organizations
        2. Query as user from org A
        3. Verify only org A data is accessed
        """
        # Arrange
        org_a_id = str(uuid4())
        org_b_id = str(uuid4())
        user_a_id = str(uuid4())
        
        # Create test data for both organizations
        supabase_client.table("projects").insert([
            {
                "id": str(uuid4()),
                "name": "Org A Project",
                "organization_id": org_a_id,
                "budget": 100000
            },
            {
                "id": str(uuid4()),
                "name": "Org B Project",
                "organization_id": org_b_id,
                "budget": 200000
            }
        ]).execute()
        
        agent = RAGReporterAgent(supabase_client, openai_client)
        
        # Act
        result = await agent.generate_report(
            query="What projects do we have?",
            organization_id=org_a_id,
            user_id=user_a_id
        )
        
        # Assert - Response should only reference Org A data
        # The agent should have only retrieved Org A projects
        context_call = supabase_client.table("projects").select.call_args
        assert any(
            call[1].get("organization_id") == org_a_id
            for call in supabase_client.method_calls
            if "eq" in str(call)
        )
    
    async def test_optimizer_agent_organization_filtering(
        self,
        supabase_client
    ):
        """
        Test Resource Optimizer filters by organization:
        1. Create resources for two organizations
        2. Request optimization as user from org A
        3. Verify only org A resources are considered
        """
        # Arrange
        org_a_id = str(uuid4())
        org_b_id = str(uuid4())
        user_a_id = str(uuid4())
        
        # Create test resources
        supabase_client.table("resources").insert([
            {
                "id": str(uuid4()),
                "name": "Resource A",
                "organization_id": org_a_id,
                "hourly_rate": 100
            },
            {
                "id": str(uuid4()),
                "name": "Resource B",
                "organization_id": org_b_id,
                "hourly_rate": 150
            }
        ]).execute()
        
        agent = ResourceOptimizerAgent(supabase_client)
        
        # Act
        result = await agent.optimize_resources(
            organization_id=org_a_id,
            user_id=user_a_id
        )
        
        # Assert - Only Org A resources in recommendations
        if "recommendations" in result:
            for rec in result["recommendations"]:
                # Verify resource belongs to org A
                resource = supabase_client.table("resources")\
                    .select("*")\
                    .eq("id", rec["resource_id"])\
                    .single()\
                    .execute()
                
                assert resource.data["organization_id"] == org_a_id


@pytest.mark.asyncio
class TestWorkflowOrganizationIsolation:
    """Test that workflows are isolated by organization"""
    
    async def test_workflow_instance_organization_filtering(
        self,
        supabase_client
    ):
        """
        Test workflow instances are organization-scoped:
        1. Create workflows for two organizations
        2. User from org A queries workflows
        3. Verify only org A workflows returned
        """
        # Arrange
        org_a_id = str(uuid4())
        org_b_id = str(uuid4())
        user_a_id = str(uuid4())
        
        engine = WorkflowEngine(supabase_client)
        
        # Create workflow definitions
        workflow_a_id = str(uuid4())
        workflow_b_id = str(uuid4())
        
        supabase_client.table("workflows").insert([
            {
                "id": workflow_a_id,
                "name": "Workflow A",
                "organization_id": org_a_id,
                "steps": [{"step_number": 0, "name": "Step 1"}]
            },
            {
                "id": workflow_b_id,
                "name": "Workflow B",
                "organization_id": org_b_id,
                "steps": [{"step_number": 0, "name": "Step 1"}]
            }
        ]).execute()
        
        # Create instances
        instance_a_id = await engine.create_instance(
            workflow_id=workflow_a_id,
            entity_type="project",
            entity_id=str(uuid4()),
            organization_id=org_a_id,
            initiator_id=user_a_id
        )
        
        instance_b_id = await engine.create_instance(
            workflow_id=workflow_b_id,
            entity_type="project",
            entity_id=str(uuid4()),
            organization_id=org_b_id,
            initiator_id=str(uuid4())
        )
        
        # Act - Get instance status as user from org A
        status = await engine.get_instance_status(
            instance_id=instance_a_id,
            organization_id=org_a_id
        )
        
        # Assert - Can access org A instance
        assert status is not None
        assert status["organization_id"] == org_a_id
        
        # Act - Try to access org B instance as user from org A
        with pytest.raises(Exception):  # Should raise permission error
            await engine.get_instance_status(
                instance_id=instance_b_id,
                organization_id=org_a_id
            )
    
    async def test_workflow_approval_cross_organization_prevention(
        self,
        supabase_client
    ):
        """
        Test users cannot approve workflows from other organizations:
        1. Create workflow in org A
        2. User from org B attempts approval
        3. Verify approval is rejected
        """
        # Arrange
        org_a_id = str(uuid4())
        org_b_id = str(uuid4())
        user_a_id = str(uuid4())
        user_b_id = str(uuid4())
        
        engine = WorkflowEngine(supabase_client)
        
        # Create workflow in org A
        workflow_id = str(uuid4())
        supabase_client.table("workflows").insert({
            "id": workflow_id,
            "name": "Org A Workflow",
            "organization_id": org_a_id,
            "steps": [{"step_number": 0, "name": "Approval"}]
        }).execute()
        
        instance_id = await engine.create_instance(
            workflow_id=workflow_id,
            entity_type="project",
            entity_id=str(uuid4()),
            organization_id=org_a_id,
            initiator_id=user_a_id
        )
        
        # Act - User from org B tries to approve
        with pytest.raises(Exception):  # Should raise permission error
            await engine.submit_approval(
                instance_id=instance_id,
                decision="approved",
                comments="Trying to approve",
                approver_id=user_b_id,
                organization_id=org_b_id  # Different organization
            )


@pytest.mark.asyncio
class TestImportOrganizationIsolation:
    """Test that imports are scoped to organization"""
    
    async def test_import_organization_scoping(
        self,
        supabase_client
    ):
        """
        Test imports are scoped to organization:
        1. User from org A imports data
        2. Verify all imported records have org A's organization_id
        3. Verify org B cannot access imported data
        """
        # Arrange
        org_a_id = str(uuid4())
        org_b_id = str(uuid4())
        user_a_id = str(uuid4())
        
        processor = ImportProcessor(supabase_client)
        
        # Create CSV content
        import io
        import csv
        
        csv_content = io.StringIO()
        writer = csv.DictWriter(csv_content, fieldnames=[
            "name", "description", "start_date", "end_date", "budget", "status"
        ])
        writer.writeheader()
        writer.writerow({
            "name": "Imported Project",
            "description": "Test",
            "start_date": "2024-01-01",
            "end_date": "2024-12-31",
            "budget": "100000",
            "status": "active"
        })
        
        csv_bytes = csv_content.getvalue().encode('utf-8')
        
        # Act - Import as user from org A
        result = await processor.process_import(
            file_content=csv_bytes,
            file_type="csv",
            entity_type="projects",
            organization_id=org_a_id,
            user_id=user_a_id
        )
        
        # Assert - Import successful
        assert result["success_count"] == 1
        
        # Assert - Imported record has org A's organization_id
        projects = supabase_client.table("projects")\
            .select("*")\
            .eq("name", "Imported Project")\
            .execute()
        
        assert len(projects.data) > 0
        assert projects.data[0]["organization_id"] == org_a_id
        
        # Assert - Org B cannot see the imported project
        org_b_projects = supabase_client.table("projects")\
            .select("*")\
            .eq("organization_id", org_b_id)\
            .eq("name", "Imported Project")\
            .execute()
        
        assert len(org_b_projects.data) == 0


@pytest.mark.asyncio
class TestAuditLogOrganizationIsolation:
    """Test that audit logs are filtered by organization"""
    
    async def test_audit_log_filtering_by_organization(
        self,
        supabase_client
    ):
        """
        Test audit logs are organization-filtered:
        1. Create audit logs for two organizations
        2. Query logs as user from org A
        3. Verify only org A logs returned
        """
        # Arrange
        org_a_id = str(uuid4())
        org_b_id = str(uuid4())
        user_a_id = str(uuid4())
        user_b_id = str(uuid4())
        
        # Create audit logs for both organizations
        supabase_client.table("audit_logs").insert([
            {
                "id": str(uuid4()),
                "organization_id": org_a_id,
                "user_id": user_a_id,
                "action": "project_created",
                "details": {"name": "Org A Project"},
                "success": True
            },
            {
                "id": str(uuid4()),
                "organization_id": org_b_id,
                "user_id": user_b_id,
                "action": "project_created",
                "details": {"name": "Org B Project"},
                "success": True
            }
        ]).execute()
        
        # Act - Query logs for org A
        logs = supabase_client.table("audit_logs")\
            .select("*")\
            .eq("organization_id", org_a_id)\
            .execute()
        
        # Assert - Only org A logs returned
        assert len(logs.data) > 0
        for log in logs.data:
            assert log["organization_id"] == org_a_id
    
    async def test_audit_search_organization_filtering(
        self,
        supabase_client,
        openai_client
    ):
        """
        Test audit search filters by organization:
        1. Create audit logs for two organizations
        2. Search as user from org A
        3. Verify only org A logs in results
        """
        # Arrange
        org_a_id = str(uuid4())
        org_b_id = str(uuid4())
        user_a_id = str(uuid4())
        
        # Create audit logs
        supabase_client.table("audit_logs").insert([
            {
                "id": str(uuid4()),
                "organization_id": org_a_id,
                "user_id": user_a_id,
                "action": "budget_updated",
                "details": {"project": "Org A Project", "amount": 100000},
                "success": True
            },
            {
                "id": str(uuid4()),
                "organization_id": org_b_id,
                "user_id": str(uuid4()),
                "action": "budget_updated",
                "details": {"project": "Org B Project", "amount": 200000},
                "success": True
            }
        ]).execute()
        
        search_agent = AuditSearchAgent(supabase_client, openai_client)
        
        # Act - Search as user from org A
        result = await search_agent.search_audit_logs(
            query="budget updates",
            organization_id=org_a_id,
            user_id=user_a_id,
            limit=10
        )
        
        # Assert - Only org A logs in results
        assert "results" in result
        for log_result in result["results"]:
            # Verify log belongs to org A
            log = supabase_client.table("audit_logs")\
                .select("*")\
                .eq("id", log_result["log_id"])\
                .single()\
                .execute()
            
            assert log.data["organization_id"] == org_a_id
    
    async def test_anomaly_detection_organization_filtering(
        self,
        supabase_client
    ):
        """
        Test anomaly detection filters by organization:
        1. Create audit logs for two organizations
        2. Run anomaly detection for org A
        3. Verify only org A logs analyzed
        """
        # Arrange
        org_a_id = str(uuid4())
        org_b_id = str(uuid4())
        user_a_id = str(uuid4())
        
        # Create logs for both organizations
        for i in range(10):
            supabase_client.table("audit_logs").insert({
                "id": str(uuid4()),
                "organization_id": org_a_id,
                "user_id": user_a_id,
                "action": "view_project",
                "details": {},
                "success": True
            }).execute()
            
            supabase_client.table("audit_logs").insert({
                "id": str(uuid4()),
                "organization_id": org_b_id,
                "user_id": str(uuid4()),
                "action": "view_project",
                "details": {},
                "success": True
            }).execute()
        
        detector = AnomalyDetectorAgent(supabase_client)
        
        # Act - Detect anomalies for org A
        result = await detector.detect_anomalies(
            organization_id=org_a_id,
            time_range_days=1,
            user_id=user_a_id
        )
        
        # Assert - Only org A logs analyzed
        assert "total_logs_analyzed" in result
        
        # Verify anomalies (if any) are from org A
        if "anomalies" in result and len(result["anomalies"]) > 0:
            for anomaly in result["anomalies"]:
                log = supabase_client.table("audit_logs")\
                    .select("*")\
                    .eq("id", anomaly["log_id"])\
                    .single()\
                    .execute()
                
                assert log.data["organization_id"] == org_a_id


# Fixtures
@pytest.fixture
def supabase_client():
    """Mock or real Supabase client for testing"""
    from unittest.mock import MagicMock
    return MagicMock()


@pytest.fixture
def openai_client():
    """Mock or real OpenAI client for testing"""
    from unittest.mock import MagicMock
    return MagicMock()
