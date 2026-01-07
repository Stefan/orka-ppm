"""
AI Agent Integration Tests

This module contains specialized integration tests for AI agent workflows,
including Resource Optimizer, Risk Forecaster, RAG Reporter, and Hallucination Validator.

Test Coverage:
- Resource optimization agent workflows
- Risk forecasting agent workflows  
- RAG reporter agent workflows
- Hallucination validation workflows
- AI model performance monitoring
- Cross-agent data flow and coordination

Requirements Validated: 2.1-2.5, 3.1-3.3, 4.1-4.5, 10.1-10.5
"""

import pytest
import json
import time
from datetime import datetime, timedelta
from typing import Dict, List, Any
from unittest.mock import Mock, patch, AsyncMock
from fastapi.testclient import TestClient
import uuid

# Import test setup
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from main import app
from test_e2e_integration import TestDataManager, test_supabase

client = TestClient(app)


class TestResourceOptimizerIntegration:
    """Test Resource Optimizer Agent integration workflows"""
    
    @patch('main.ai_agents')
    def test_resource_optimization_complete_workflow(self, mock_ai_agents):
        """
        Test complete resource optimization workflow with AI agent
        Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5
        """
        # Setup mock AI agent
        mock_resource_optimizer = Mock()
        mock_ai_agents.resource_optimizer = mock_resource_optimizer
        
        # Mock optimization response
        mock_resource_optimizer.analyze_resource_allocation.return_value = {
            "recommendations": [
                {
                    "type": "reallocation",
                    "description": "Move Alice from Project A to Project B for better skill match",
                    "impact_score": 0.8,
                    "confidence_score": 0.85,
                    "reasoning": "Alice's React skills are better utilized in Project B",
                    "affected_resources": ["alice-id"],
                    "affected_projects": ["project-a-id", "project-b-id"],
                    "estimated_benefit": "15% productivity increase"
                },
                {
                    "type": "skill_development",
                    "description": "Train Bob in PostgreSQL for database optimization",
                    "impact_score": 0.6,
                    "confidence_score": 0.75,
                    "reasoning": "Database skills gap identified in current team",
                    "affected_resources": ["bob-id"],
                    "affected_projects": ["project-c-id"],
                    "estimated_benefit": "Reduced external consultant costs"
                }
            ],
            "conflicts": [
                {
                    "type": "over_allocation",
                    "description": "Alice allocated 120% across projects",
                    "severity": "high",
                    "affected_resources": ["alice-id"],
                    "suggested_resolution": "Reduce allocation in Project A to 60%"
                }
            ],
            "optimization_metrics": {
                "current_efficiency": 0.72,
                "projected_efficiency": 0.87,
                "improvement_percentage": 20.8
            }
        }
        
        mock_resource_optimizer.detect_conflicts.return_value = [
            {
                "conflict_id": "conflict-1",
                "type": "over_allocation",
                "severity": "high",
                "description": "Resource over-allocated by 20%",
                "affected_resources": ["alice-id"],
                "resolution_options": [
                    "Reduce allocation in lower priority project",
                    "Hire additional resource",
                    "Extend project timeline"
                ]
            }
        ]
        
        # Create test data
        test_data_manager = TestDataManager()
        try:
            portfolio = test_data_manager.create_test_portfolio("AI Optimization Portfolio")
            project_a = test_data_manager.create_test_project(portfolio["id"], "Project Alpha")
            project_b = test_data_manager.create_test_project(portfolio["id"], "Project Beta")
            alice = test_data_manager.create_test_resource("Alice Frontend")
            bob = test_data_manager.create_test_resource("Bob Backend")
            
            with patch('main.get_current_user') as mock_auth:
                mock_auth.return_value = {"id": "test-user", "email": "test@example.com"}
                
                # Step 1: Allocate resources to create optimization scenario
                allocation_data = {
                    "allocation_percentage": 80,
                    "role": "Frontend Developer",
                    "start_date": datetime.now().date().isoformat(),
                    "end_date": (datetime.now() + timedelta(days=30)).date().isoformat()
                }
                
                response = client.post(
                    f"/resources/{alice['id']}/allocate/{project_a['id']}", 
                    json=allocation_data
                )
                assert response.status_code == 200
                
                # Step 2: Request AI optimization analysis
                optimization_request = {
                    "project_ids": [project_a["id"], project_b["id"]],
                    "optimization_type": "comprehensive",
                    "constraints": {
                        "max_reallocation_percentage": 50,
                        "preserve_critical_allocations": True,
                        "skill_match_weight": 0.7,
                        "availability_weight": 0.3
                    }
                }
                
                response = client.post("/ai/resource-optimization", json=optimization_request)
                assert response.status_code == 200
                optimization_result = response.json()
                
                # Verify AI agent was called with correct parameters
                mock_resource_optimizer.analyze_resource_allocation.assert_called_once()
                call_args = mock_resource_optimizer.analyze_resource_allocation.call_args[0]
                assert project_a["id"] in call_args[0] or project_b["id"] in call_args[0]
                
                # Verify response structure
                assert "recommendations" in optimization_result
                assert "conflicts" in optimization_result
                assert "optimization_metrics" in optimization_result
                
                recommendations = optimization_result["recommendations"]
                assert len(recommendations) == 2
                assert recommendations[0]["type"] == "reallocation"
                assert recommendations[0]["confidence_score"] == 0.85
                
                # Step 3: Apply optimization recommendation
                recommendation_id = recommendations[0].get("id", "rec-1")
                apply_request = {
                    "recommendation_id": recommendation_id,
                    "apply_immediately": True,
                    "notify_stakeholders": True
                }
                
                response = client.post(
                    f"/resources/{alice['id']}/apply-optimization",
                    json=apply_request
                )
                assert response.status_code == 200
                application_result = response.json()
                
                assert application_result["status"] == "applied"
                assert "updated_allocations" in application_result
                
                # Step 4: Verify optimization was logged for monitoring
                response = client.get(f"/ai/operations/resource-optimization")
                assert response.status_code == 200
                operations_log = response.json()
                
                assert len(operations_log) > 0
                latest_operation = operations_log[0]
                assert latest_operation["operation"] == "resource_optimization"
                assert latest_operation["model_id"] == "resource_optimizer"
                
        finally:
            test_data_manager.cleanup()
    
    @patch('main.ai_agents')
    def test_conflict_detection_and_resolution(self, mock_ai_agents):
        """
        Test AI-powered conflict detection and resolution
        Validates: Requirements 2.2, 2.4
        """
        mock_resource_optimizer = Mock()
        mock_ai_agents.resource_optimizer = mock_resource_optimizer
        
        # Mock conflict detection response
        mock_resource_optimizer.detect_conflicts.return_value = [
            {
                "conflict_id": "time-conflict-1",
                "type": "time_overlap",
                "severity": "medium",
                "description": "Resource scheduled for overlapping meetings",
                "affected_resources": ["resource-1"],
                "affected_projects": ["project-1", "project-2"],
                "time_range": {
                    "start": "2024-01-15T09:00:00Z",
                    "end": "2024-01-15T11:00:00Z"
                },
                "resolution_options": [
                    {
                        "option": "reschedule_meeting",
                        "description": "Reschedule Project B meeting to afternoon",
                        "impact_score": 0.2,
                        "feasibility": 0.9
                    },
                    {
                        "option": "delegate_attendance",
                        "description": "Have team lead attend Project A meeting",
                        "impact_score": 0.3,
                        "feasibility": 0.7
                    }
                ]
            }
        ]
        
        test_data_manager = TestDataManager()
        try:
            portfolio = test_data_manager.create_test_portfolio("Conflict Test Portfolio")
            project1 = test_data_manager.create_test_project(portfolio["id"], "Project One")
            project2 = test_data_manager.create_test_project(portfolio["id"], "Project Two")
            resource = test_data_manager.create_test_resource("Conflicted Resource")
            
            with patch('main.get_current_user') as mock_auth:
                mock_auth.return_value = {"id": "test-user", "email": "test@example.com"}
                
                # Create conflicting allocations
                allocation1 = {
                    "allocation_percentage": 60,
                    "role": "Developer",
                    "start_date": datetime.now().date().isoformat(),
                    "end_date": (datetime.now() + timedelta(days=30)).date().isoformat()
                }
                
                allocation2 = {
                    "allocation_percentage": 70,  # Creates 130% allocation
                    "role": "Analyst", 
                    "start_date": datetime.now().date().isoformat(),
                    "end_date": (datetime.now() + timedelta(days=30)).date().isoformat()
                }
                
                client.post(f"/resources/{resource['id']}/allocate/{project1['id']}", json=allocation1)
                client.post(f"/resources/{resource['id']}/allocate/{project2['id']}", json=allocation2)
                
                # Request conflict detection
                conflict_request = {
                    "resource_ids": [resource["id"]],
                    "time_range": {
                        "start": datetime.now().date().isoformat(),
                        "end": (datetime.now() + timedelta(days=30)).date().isoformat()
                    },
                    "conflict_types": ["over_allocation", "time_overlap", "skill_mismatch"]
                }
                
                response = client.post("/ai/detect-conflicts", json=conflict_request)
                assert response.status_code == 200
                conflicts = response.json()
                
                assert "conflicts" in conflicts
                detected_conflicts = conflicts["conflicts"]
                assert len(detected_conflicts) > 0
                
                conflict = detected_conflicts[0]
                assert conflict["type"] == "time_overlap"
                assert conflict["severity"] == "medium"
                assert "resolution_options" in conflict
                
                # Apply conflict resolution
                resolution_request = {
                    "conflict_id": conflict["conflict_id"],
                    "selected_resolution": "reschedule_meeting",
                    "apply_immediately": True
                }
                
                response = client.post("/ai/resolve-conflict", json=resolution_request)
                assert response.status_code == 200
                resolution_result = response.json()
                
                assert resolution_result["status"] == "resolved"
                assert resolution_result["applied_resolution"] == "reschedule_meeting"
                
        finally:
            test_data_manager.cleanup()


class TestRiskForecasterIntegration:
    """Test Risk Forecaster Agent integration workflows"""
    
    @patch('main.ai_agents')
    def test_risk_forecasting_complete_workflow(self, mock_ai_agents):
        """
        Test complete risk forecasting workflow with AI agent
        Validates: Requirements 3.1, 3.2, 3.3
        """
        mock_risk_forecaster = Mock()
        mock_ai_agents.risk_forecaster = mock_risk_forecaster
        
        # Mock risk forecasting response
        mock_risk_forecaster.forecast_risks.return_value = [
            {
                "risk_id": "forecast-risk-1",
                "risk_type": "schedule_delay",
                "probability": 0.65,
                "potential_impact": 0.8,
                "timeframe": "next_30_days",
                "indicators": [
                    "Velocity decreased by 20% in last sprint",
                    "3 critical team members on vacation",
                    "Dependency on external API not yet delivered"
                ],
                "suggested_mitigation": "Add 2 additional developers and negotiate API delivery timeline",
                "confidence_level": 0.78,
                "historical_patterns": [
                    "Similar projects delayed by avg 2 weeks when velocity drops >15%",
                    "External dependencies cause 40% of schedule delays"
                ]
            },
            {
                "risk_id": "forecast-risk-2", 
                "risk_type": "budget_overrun",
                "probability": 0.45,
                "potential_impact": 0.6,
                "timeframe": "next_60_days",
                "indicators": [
                    "Current burn rate 15% above planned",
                    "Scope creep identified in 3 user stories",
                    "External consultant costs higher than estimated"
                ],
                "suggested_mitigation": "Implement stricter change control and renegotiate consultant rates",
                "confidence_level": 0.82
            }
        ]
        
        mock_risk_forecaster.analyze_historical_patterns.return_value = [
            {
                "pattern_id": "pattern-1",
                "pattern_type": "seasonal_resource_shortage",
                "description": "Resource availability drops 30% during Q4 holidays",
                "frequency": "annual",
                "impact_projects": ["web_development", "mobile_apps"],
                "mitigation_strategies": ["Plan critical work before November", "Cross-train team members"]
            }
        ]
        
        test_data_manager = TestDataManager()
        try:
            portfolio = test_data_manager.create_test_portfolio("Risk Forecast Portfolio")
            project = test_data_manager.create_test_project(portfolio["id"], "High Risk Project")
            
            with patch('main.get_current_user') as mock_auth:
                mock_auth.return_value = {"id": "test-user", "email": "test@example.com"}
                
                # Step 1: Request risk forecasting for project
                forecast_request = {
                    "project_id": project["id"],
                    "forecast_horizon_days": 90,
                    "risk_categories": ["schedule", "budget", "technical", "resource"],
                    "include_historical_analysis": True,
                    "confidence_threshold": 0.6
                }
                
                response = client.post(f"/ai/risk-forecast/{project['id']}", json=forecast_request)
                assert response.status_code == 200
                forecast_result = response.json()
                
                # Verify AI agent was called
                mock_risk_forecaster.forecast_risks.assert_called_once()
                
                # Verify response structure
                assert "forecasted_risks" in forecast_result
                assert "historical_patterns" in forecast_result
                assert "forecast_metadata" in forecast_result
                
                forecasted_risks = forecast_result["forecasted_risks"]
                assert len(forecasted_risks) == 2
                
                schedule_risk = forecasted_risks[0]
                assert schedule_risk["risk_type"] == "schedule_delay"
                assert schedule_risk["probability"] == 0.65
                assert schedule_risk["confidence_level"] == 0.78
                assert len(schedule_risk["indicators"]) == 3
                
                # Step 2: Auto-populate risk register with forecasted risks
                populate_request = {
                    "forecasted_risks": forecasted_risks,
                    "auto_create_mitigation_tasks": True,
                    "assign_risk_owners": True,
                    "notification_settings": {
                        "notify_project_manager": True,
                        "notify_stakeholders": False
                    }
                }
                
                response = client.post(f"/ai/populate-risk-register/{project['id']}", json=populate_request)
                assert response.status_code == 200
                population_result = response.json()
                
                assert population_result["risks_created"] == 2
                assert "created_risk_ids" in population_result
                
                # Step 3: Verify risks were created in database
                response = client.get(f"/projects/{project['id']}/risks")
                assert response.status_code == 200
                project_risks = response.json()
                
                assert len(project_risks) >= 2
                
                # Find the forecasted risk
                schedule_risk_db = next(
                    (r for r in project_risks if r["title"].lower().find("schedule") != -1), 
                    None
                )
                assert schedule_risk_db is not None
                assert schedule_risk_db["probability"] == 0.65
                assert schedule_risk_db["impact"] == 0.8
                assert schedule_risk_db["category"] == "schedule"
                
                # Step 4: Test risk trend analysis
                trend_request = {
                    "project_ids": [project["id"]],
                    "time_range": {
                        "start": (datetime.now() - timedelta(days=30)).date().isoformat(),
                        "end": datetime.now().date().isoformat()
                    },
                    "risk_categories": ["schedule", "budget"]
                }
                
                response = client.post("/ai/risk-trends", json=trend_request)
                assert response.status_code == 200
                trends = response.json()
                
                assert "risk_trends" in trends
                assert "trend_analysis" in trends
                
        finally:
            test_data_manager.cleanup()
    
    @patch('main.ai_agents')
    def test_risk_pattern_analysis(self, mock_ai_agents):
        """
        Test historical risk pattern analysis
        Validates: Requirements 3.1, 3.3
        """
        mock_risk_forecaster = Mock()
        mock_ai_agents.risk_forecaster = mock_risk_forecaster
        
        # Mock pattern analysis response
        mock_risk_forecaster.analyze_historical_patterns.return_value = [
            {
                "pattern_id": "integration-delays",
                "pattern_type": "technical_integration_delays",
                "description": "Integration tasks consistently take 40% longer than estimated",
                "frequency": "recurring",
                "projects_affected": 8,
                "average_delay_days": 5.2,
                "cost_impact_average": 12000,
                "root_causes": [
                    "Underestimated API complexity",
                    "Third-party service reliability issues",
                    "Insufficient integration testing time"
                ],
                "recommended_adjustments": [
                    "Add 50% buffer to integration estimates",
                    "Implement integration testing earlier in cycle",
                    "Establish SLAs with third-party providers"
                ]
            }
        ]
        
        test_data_manager = TestDataManager()
        try:
            with patch('main.get_current_user') as mock_auth:
                mock_auth.return_value = {"id": "test-user", "email": "test@example.com"}
                
                # Request historical pattern analysis
                pattern_request = {
                    "analysis_period_months": 12,
                    "project_types": ["web_development", "mobile_app", "integration"],
                    "risk_categories": ["technical", "schedule", "resource"],
                    "minimum_pattern_frequency": 3
                }
                
                response = client.post("/ai/analyze-risk-patterns", json=pattern_request)
                assert response.status_code == 200
                patterns = response.json()
                
                assert "patterns" in patterns
                assert "analysis_metadata" in patterns
                
                pattern_list = patterns["patterns"]
                assert len(pattern_list) == 1
                
                integration_pattern = pattern_list[0]
                assert integration_pattern["pattern_type"] == "technical_integration_delays"
                assert integration_pattern["projects_affected"] == 8
                assert integration_pattern["average_delay_days"] == 5.2
                assert len(integration_pattern["root_causes"]) == 3
                assert len(integration_pattern["recommended_adjustments"]) == 3
                
        finally:
            test_data_manager.cleanup()


class TestRAGReporterIntegration:
    """Test RAG Reporter Agent integration workflows"""
    
    @patch('main.ai_agents')
    def test_rag_report_generation_workflow(self, mock_ai_agents):
        """
        Test complete RAG report generation workflow
        Validates: Requirements 4.1, 4.2, 4.3
        """
        mock_rag_reporter = Mock()
        mock_hallucination_validator = Mock()
        mock_ai_agents.rag_reporter = mock_rag_reporter
        mock_ai_agents.hallucination_validator = mock_hallucination_validator
        
        # Mock RAG reporter response
        mock_rag_reporter.generate_report.return_value = {
            "report": """
            # Project Status Report: Alpha Development
            
            ## Executive Summary
            Project Alpha is currently 68% complete and on track for Q2 delivery. 
            The team has successfully delivered 15 out of 22 planned features.
            
            ## Key Metrics
            - Budget utilization: 72% ($72,000 of $100,000)
            - Timeline progress: 68% complete
            - Team velocity: 24 story points per sprint (target: 25)
            - Active risks: 3 medium, 1 high
            
            ## Recent Achievements
            - User authentication system completed
            - Payment integration successfully tested
            - Mobile responsive design implemented
            
            ## Upcoming Milestones
            - Beta release: March 15, 2024
            - User acceptance testing: March 20-30, 2024
            - Production deployment: April 5, 2024
            """,
            "sources": [
                {
                    "type": "project_data",
                    "table": "projects",
                    "record_id": "project-alpha-id",
                    "fields_used": ["status", "budget", "actual_cost", "completion_percentage"]
                },
                {
                    "type": "milestone_data", 
                    "table": "milestones",
                    "record_count": 5,
                    "fields_used": ["name", "due_date", "status"]
                },
                {
                    "type": "risk_data",
                    "table": "risks", 
                    "record_count": 4,
                    "fields_used": ["title", "severity", "status", "probability"]
                }
            ],
            "confidence": 0.92,
            "generation_metadata": {
                "query_processing_time_ms": 245,
                "context_retrieval_time_ms": 180,
                "report_generation_time_ms": 890,
                "total_time_ms": 1315
            }
        }
        
        # Mock hallucination validator response
        mock_hallucination_validator.validate_report.return_value = {
            "is_valid": True,
            "confidence": 0.94,
            "inconsistencies": [],
            "fact_checks": [
                {
                    "claim": "Project Alpha is currently 68% complete",
                    "verified": True,
                    "source": "projects.completion_percentage",
                    "confidence": 0.98
                },
                {
                    "claim": "Budget utilization: 72% ($72,000 of $100,000)",
                    "verified": True,
                    "source": "projects.budget, projects.actual_cost",
                    "confidence": 0.96
                },
                {
                    "claim": "Team velocity: 24 story points per sprint",
                    "verified": True,
                    "source": "sprint_metrics.average_velocity",
                    "confidence": 0.89
                }
            ],
            "validation_metadata": {
                "validation_time_ms": 420,
                "facts_checked": 12,
                "sources_verified": 3
            }
        }
        
        test_data_manager = TestDataManager()
        try:
            portfolio = test_data_manager.create_test_portfolio("RAG Test Portfolio")
            project = test_data_manager.create_test_project(portfolio["id"], "Alpha Development")
            
            with patch('main.get_current_user') as mock_auth:
                mock_auth.return_value = {"id": "test-user", "email": "test@example.com"}
                
                # Step 1: Generate report with natural language query
                query_request = {
                    "query": "Generate a comprehensive status report for Project Alpha including budget, timeline, risks, and recent achievements",
                    "report_type": "project_status",
                    "context_filters": {
                        "project_ids": [project["id"]],
                        "include_risks": True,
                        "include_milestones": True,
                        "include_budget_details": True
                    },
                    "output_format": "markdown",
                    "detail_level": "comprehensive"
                }
                
                response = client.post("/ai/generate-report", json=query_request)
                assert response.status_code == 200
                report_result = response.json()
                
                # Verify AI agents were called
                mock_rag_reporter.generate_report.assert_called_once()
                mock_hallucination_validator.validate_report.assert_called_once()
                
                # Verify response structure
                assert "report" in report_result
                assert "validation_result" in report_result
                assert "sources" in report_result
                assert "metadata" in report_result
                
                # Verify report content
                report_content = report_result["report"]
                assert "Project Status Report: Alpha Development" in report_content
                assert "68% complete" in report_content
                assert "Budget utilization: 72%" in report_content
                
                # Verify validation results
                validation = report_result["validation_result"]
                assert validation["is_valid"] is True
                assert validation["confidence"] == 0.94
                assert len(validation["inconsistencies"]) == 0
                assert len(validation["fact_checks"]) == 3
                
                # Verify sources
                sources = report_result["sources"]
                assert len(sources) == 3
                assert any(s["type"] == "project_data" for s in sources)
                assert any(s["type"] == "milestone_data" for s in sources)
                assert any(s["type"] == "risk_data" for s in sources)
                
                # Step 2: Test different query types
                financial_query = {
                    "query": "What is the financial status of all projects in the portfolio?",
                    "report_type": "financial_summary",
                    "context_filters": {
                        "portfolio_ids": [portfolio["id"]],
                        "include_budget_variance": True,
                        "include_cost_breakdown": True
                    }
                }
                
                response = client.post("/ai/generate-report", json=financial_query)
                assert response.status_code == 200
                
                # Step 3: Test resource utilization query
                resource_query = {
                    "query": "Show me resource utilization across all active projects",
                    "report_type": "resource_utilization",
                    "context_filters": {
                        "project_status": ["active", "planning"],
                        "include_skill_analysis": True
                    }
                }
                
                response = client.post("/ai/generate-report", json=resource_query)
                assert response.status_code == 200
                
        finally:
            test_data_manager.cleanup()
    
    @patch('main.ai_agents')
    def test_hallucination_validation_workflow(self, mock_ai_agents):
        """
        Test hallucination validation workflow
        Validates: Requirements 4.4, 4.5
        """
        mock_hallucination_validator = Mock()
        mock_ai_agents.hallucination_validator = mock_hallucination_validator
        
        # Mock validation response with inconsistencies
        mock_hallucination_validator.validate_report.return_value = {
            "is_valid": False,
            "confidence": 0.65,
            "inconsistencies": [
                {
                    "type": "data_mismatch",
                    "severity": "high",
                    "claim": "Project budget is $150,000",
                    "actual_value": "$100,000",
                    "source": "projects.budget",
                    "description": "Report claims budget of $150k but database shows $100k"
                },
                {
                    "type": "temporal_inconsistency",
                    "severity": "medium", 
                    "claim": "Project completed last month",
                    "actual_value": "Project status: active",
                    "source": "projects.status",
                    "description": "Report claims completion but project is still active"
                }
            ],
            "fact_checks": [
                {
                    "claim": "Team has 5 developers",
                    "verified": True,
                    "source": "project_resources.count",
                    "confidence": 0.95
                },
                {
                    "claim": "Project budget is $150,000",
                    "verified": False,
                    "source": "projects.budget",
                    "confidence": 0.98,
                    "actual_value": "$100,000"
                }
            ],
            "validation_metadata": {
                "validation_time_ms": 680,
                "facts_checked": 8,
                "sources_verified": 4,
                "inconsistencies_found": 2
            }
        }
        
        test_data_manager = TestDataManager()
        try:
            with patch('main.get_current_user') as mock_auth:
                mock_auth.return_value = {"id": "test-user", "email": "test@example.com"}
                
                # Test validation of potentially hallucinated content
                validation_request = {
                    "content": """
                    Project Alpha has a budget of $150,000 and was completed last month.
                    The team consists of 5 developers and 2 designers.
                    Current progress is 100% with all milestones delivered on time.
                    """,
                    "content_type": "project_report",
                    "context_filters": {
                        "project_name": "Alpha",
                        "verify_against_database": True
                    },
                    "validation_level": "strict"
                }
                
                response = client.post("/ai/validate-content", json=validation_request)
                assert response.status_code == 200
                validation_result = response.json()
                
                # Verify validation results
                assert validation_result["is_valid"] is False
                assert validation_result["confidence"] == 0.65
                assert len(validation_result["inconsistencies"]) == 2
                
                # Check inconsistencies
                inconsistencies = validation_result["inconsistencies"]
                budget_inconsistency = next(
                    (i for i in inconsistencies if i["type"] == "data_mismatch"), 
                    None
                )
                assert budget_inconsistency is not None
                assert budget_inconsistency["severity"] == "high"
                assert "$150,000" in budget_inconsistency["claim"]
                assert "$100,000" in budget_inconsistency["actual_value"]
                
                # Check fact verification
                fact_checks = validation_result["fact_checks"]
                assert len(fact_checks) == 2
                
                team_size_check = next(
                    (f for f in fact_checks if "5 developers" in f["claim"]), 
                    None
                )
                assert team_size_check is not None
                assert team_size_check["verified"] is True
                
                budget_check = next(
                    (f for f in fact_checks if "$150,000" in f["claim"]), 
                    None
                )
                assert budget_check is not None
                assert budget_check["verified"] is False
                
        finally:
            test_data_manager.cleanup()


class TestAIModelMonitoring:
    """Test AI model performance monitoring and management"""
    
    @patch('main.ai_agents')
    def test_ai_operation_logging(self, mock_ai_agents):
        """
        Test AI operation logging and monitoring
        Validates: Requirements 10.1, 10.3
        """
        # Setup mock agents
        mock_resource_optimizer = Mock()
        mock_ai_agents.resource_optimizer = mock_resource_optimizer
        
        mock_resource_optimizer.analyze_resource_allocation.return_value = {
            "recommendations": [],
            "execution_time_ms": 1250,
            "confidence_score": 0.87
        }
        
        test_data_manager = TestDataManager()
        try:
            portfolio = test_data_manager.create_test_portfolio("Monitoring Test Portfolio")
            project = test_data_manager.create_test_project(portfolio["id"], "Monitoring Test Project")
            
            with patch('main.get_current_user') as mock_auth:
                mock_auth.return_value = {"id": "test-user", "email": "test@example.com"}
                
                # Step 1: Perform AI operations to generate logs
                optimization_request = {
                    "project_ids": [project["id"]],
                    "optimization_type": "skill_matching"
                }
                
                response = client.post("/ai/resource-optimization", json=optimization_request)
                assert response.status_code == 200
                
                # Step 2: Check operation logs
                response = client.get("/ai/operations/resource-optimization")
                assert response.status_code == 200
                operations = response.json()
                
                assert len(operations) > 0
                latest_op = operations[0]
                assert latest_op["model_id"] == "resource_optimizer"
                assert latest_op["operation"] == "resource_optimization"
                assert "execution_time_ms" in latest_op
                assert "confidence" in latest_op
                assert "user_id" in latest_op
                
                # Step 3: Check performance metrics
                response = client.get("/ai/performance-metrics/resource_optimizer")
                assert response.status_code == 200
                metrics = response.json()
                
                assert "accuracy" in metrics
                assert "response_time_ms" in metrics
                assert "error_rate" in metrics
                assert "user_satisfaction" in metrics
                
                # Step 4: Test A/B testing functionality
                ab_test_config = {
                    "test_name": "resource_optimizer_v2_test",
                    "model_a": "resource_optimizer_v1",
                    "model_b": "resource_optimizer_v2", 
                    "traffic_split": 50,
                    "success_metrics": ["accuracy", "response_time", "user_satisfaction"],
                    "duration_days": 14
                }
                
                response = client.post("/ai/ab-tests/", json=ab_test_config)
                assert response.status_code == 201
                ab_test = response.json()
                
                assert ab_test["test_name"] == "resource_optimizer_v2_test"
                assert ab_test["status"] == "active"
                assert ab_test["traffic_split"] == 50
                
        finally:
            test_data_manager.cleanup()
    
    @patch('main.ai_agents')
    def test_feedback_capture_system(self, mock_ai_agents):
        """
        Test user feedback capture for AI recommendations
        Validates: Requirements 10.5
        """
        test_data_manager = TestDataManager()
        try:
            with patch('main.get_current_user') as mock_auth:
                mock_auth.return_value = {"id": "test-user", "email": "test@example.com"}
                
                # Step 1: Submit feedback for AI recommendation
                feedback_data = {
                    "operation_id": "op-12345",
                    "model_id": "resource_optimizer",
                    "recommendation_id": "rec-67890",
                    "feedback_type": "recommendation_quality",
                    "rating": 4,
                    "comments": "Good recommendation but could consider team preferences",
                    "outcome": "partially_implemented",
                    "outcome_details": {
                        "implemented_percentage": 75,
                        "modifications_made": "Adjusted timeline to account for team availability",
                        "results_observed": "15% productivity improvement as predicted"
                    }
                }
                
                response = client.post("/ai/feedback/", json=feedback_data)
                assert response.status_code == 201
                feedback_result = response.json()
                
                assert feedback_result["feedback_id"] is not None
                assert feedback_result["status"] == "recorded"
                
                # Step 2: Submit negative feedback
                negative_feedback = {
                    "operation_id": "op-12346",
                    "model_id": "risk_forecaster",
                    "recommendation_id": "risk-forecast-123",
                    "feedback_type": "accuracy",
                    "rating": 2,
                    "comments": "Risk forecast was inaccurate - predicted high probability but risk never materialized",
                    "outcome": "not_implemented",
                    "outcome_details": {
                        "reason_not_implemented": "Forecast proved incorrect",
                        "actual_outcome": "No risk materialized despite 80% probability prediction"
                    }
                }
                
                response = client.post("/ai/feedback/", json=negative_feedback)
                assert response.status_code == 201
                
                # Step 3: Get feedback analytics
                response = client.get("/ai/feedback/analytics")
                assert response.status_code == 200
                analytics = response.json()
                
                assert "average_rating" in analytics
                assert "feedback_count" in analytics
                assert "model_performance" in analytics
                
                model_performance = analytics["model_performance"]
                assert "resource_optimizer" in model_performance
                assert "risk_forecaster" in model_performance
                
                # Step 4: Get model-specific feedback
                response = client.get("/ai/feedback/resource_optimizer")
                assert response.status_code == 200
                model_feedback = response.json()
                
                assert len(model_feedback) >= 1
                feedback_item = model_feedback[0]
                assert feedback_item["model_id"] == "resource_optimizer"
                assert feedback_item["rating"] == 4
                assert "Good recommendation" in feedback_item["comments"]
                
        finally:
            test_data_manager.cleanup()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])