"""
Property-based tests for Risk Forecasting
Feature: ai-ppm-platform, Property 9: Risk Analysis Completeness, Property 10: Risk Register Population
Validates: Requirements 3.1, 3.2, 3.3
"""

import pytest
from hypothesis import given, strategies as st, assume, settings
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from unittest.mock import Mock, patch, MagicMock, AsyncMock
from datetime import date, datetime, timedelta
import uuid
import json
import asyncio

# Import risk forecasting functions and classes
from ai_agents import RiskForecasterAgent
from main import app

# Test data strategies for property-based testing
@st.composite
def project_data_strategy(draw):
    """Generate valid project data for risk forecasting testing"""
    start_date = draw(st.datetimes(
        min_value=datetime(2020, 1, 1),
        max_value=datetime.now() - timedelta(days=30)
    ))
    end_date = draw(st.datetimes(
        min_value=start_date + timedelta(days=30),
        max_value=start_date + timedelta(days=365)
    ))
    
    budget = draw(st.floats(min_value=1000.0, max_value=1000000.0, allow_nan=False, allow_infinity=False))
    spent = draw(st.floats(min_value=0.0, max_value=budget * 1.5, allow_nan=False, allow_infinity=False))
    
    return {
        "id": str(uuid.uuid4()),
        "name": f"Test Project {draw(st.text(min_size=1, max_size=50))}",
        "description": draw(st.one_of(st.none(), st.text(max_size=200))),
        "status": draw(st.sampled_from(["planning", "active", "on-hold", "completed"])),
        "budget": budget,
        "spent": spent,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat()
    }

@st.composite
def multiple_projects_strategy(draw):
    """Generate multiple projects for portfolio-level risk analysis"""
    num_projects = draw(st.integers(min_value=1, max_value=5))
    projects = []
    for _ in range(num_projects):
        projects.append(draw(project_data_strategy()))
    return projects

@st.composite
def risk_prediction_strategy(draw):
    """Generate valid risk prediction data"""
    return {
        "project_id": str(uuid.uuid4()),
        "risk_type": draw(st.sampled_from([
            "budget_overrun", "schedule_delay", "resource_constraint", 
            "technical_risk", "external_dependency"
        ])),
        "description": draw(st.text(min_size=10, max_size=200)),
        "probability": draw(st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False)),
        "impact_score": draw(st.integers(min_value=1, max_value=5)),
        "confidence_score": draw(st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False)),
        "mitigation_suggestions": draw(st.lists(st.text(min_size=5, max_size=100), min_size=1, max_size=5))
    }

class TestRiskAnalysisCompleteness:
    """Property 9: Risk Analysis Completeness tests"""

    @settings(max_examples=10, deadline=None)
    @given(project_data=project_data_strategy())
    def test_risk_analysis_identifies_potential_risks(self, project_data):
        """
        Property 9: Risk Analysis Completeness
        For any project with available data, the Risk Forecaster Agent should identify potential risks with probability and impact scores
        Validates: Requirements 3.1, 3.3
        """
        # Create a mock Supabase client
        mock_supabase = Mock()
        mock_table = Mock()
        mock_supabase.table.return_value = mock_table
        mock_table.select.return_value = mock_table
        mock_table.eq.return_value = mock_table
        mock_table.execute.return_value = Mock(data=[project_data])
        
        # Create RiskForecasterAgent instance
        agent = RiskForecasterAgent(mock_supabase, "test-api-key")
        
        # Run the risk analysis
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            risks = loop.run_until_complete(agent._analyze_project_risks(project_data))
        finally:
            loop.close()
        
        # Verify that risks were identified
        assert isinstance(risks, list), "Risk analysis should return a list of risks"
        assert len(risks) > 0, "Risk analysis should identify at least one potential risk for any project"
        
        # Verify each risk has required properties
        for risk in risks:
            assert "project_id" in risk, "Each risk should have a project_id"
            assert "risk_type" in risk, "Each risk should have a risk_type"
            assert "description" in risk, "Each risk should have a description"
            assert "probability" in risk, "Each risk should have a probability score"
            assert "impact_score" in risk, "Each risk should have an impact score"
            assert "confidence_score" in risk, "Each risk should have a confidence score"
            
            # Verify probability is in valid range (0-1)
            assert 0.0 <= risk["probability"] <= 1.0, f"Risk probability should be between 0 and 1, got {risk['probability']}"
            
            # Verify impact score is in valid range (1-5)
            assert 1 <= risk["impact_score"] <= 5, f"Risk impact score should be between 1 and 5, got {risk['impact_score']}"
            
            # Verify confidence score is in valid range (0-1)
            assert 0.0 <= risk["confidence_score"] <= 1.0, f"Risk confidence score should be between 0 and 1, got {risk['confidence_score']}"
            
            # Verify project_id matches
            assert risk["project_id"] == project_data["id"], "Risk should be associated with the correct project"
            
            # Verify description is meaningful
            assert len(risk["description"]) > 0, "Risk description should not be empty"
            
            # Verify mitigation suggestions are provided
            assert "mitigation_suggestions" in risk, "Each risk should have mitigation suggestions"
            assert isinstance(risk["mitigation_suggestions"], list), "Mitigation suggestions should be a list"
            assert len(risk["mitigation_suggestions"]) > 0, "Each risk should have at least one mitigation suggestion"

    @settings(max_examples=5, deadline=None)
    @given(projects_data=multiple_projects_strategy())
    def test_risk_analysis_handles_multiple_projects(self, projects_data):
        """
        Property 9: Risk Analysis Completeness - Multiple Projects
        For any set of projects, the Risk Forecaster Agent should analyze each project independently and provide comprehensive risk coverage
        Validates: Requirements 3.1, 3.3
        """
        # Create a mock Supabase client
        mock_supabase = Mock()
        mock_table = Mock()
        mock_supabase.table.return_value = mock_table
        mock_table.select.return_value = mock_table
        mock_table.eq.return_value = mock_table
        mock_table.execute.return_value = Mock(data=projects_data)
        
        # Create RiskForecasterAgent instance
        agent = RiskForecasterAgent(mock_supabase, "test-api-key")
        
        # Run risk analysis for all projects
        all_risks = []
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            for project in projects_data:
                project_risks = loop.run_until_complete(agent._analyze_project_risks(project))
                all_risks.extend(project_risks)
        finally:
            loop.close()
        
        # Verify risks were identified for the portfolio
        assert len(all_risks) > 0, "Risk analysis should identify risks across the project portfolio"
        
        # Verify each project has associated risks
        project_ids = {project["id"] for project in projects_data}
        risk_project_ids = {risk["project_id"] for risk in all_risks}
        
        # At least some projects should have risks identified
        assert len(risk_project_ids.intersection(project_ids)) > 0, "Risk analysis should identify risks for at least some projects in the portfolio"
        
        # Verify risk diversity - should identify different types of risks
        risk_types = {risk["risk_type"] for risk in all_risks}
        assert len(risk_types) > 0, "Risk analysis should identify different types of risks"
        
        # Verify probability and impact distribution
        probabilities = [risk["probability"] for risk in all_risks]
        impacts = [risk["impact_score"] for risk in all_risks]
        
        assert min(probabilities) >= 0.0 and max(probabilities) <= 1.0, "All risk probabilities should be in valid range"
        assert min(impacts) >= 1 and max(impacts) <= 5, "All risk impact scores should be in valid range"

class TestRiskRegisterPopulation:
    """Property 10: Risk Register Population tests"""

    @settings(max_examples=10, deadline=None)
    @given(risk_predictions=st.lists(risk_prediction_strategy(), min_size=1, max_size=5))
    def test_risk_register_population_from_predictions(self, risk_predictions):
        """
        Property 10: Risk Register Population
        For any forecasted risk, the Risk Register should be automatically populated with risk details and mitigation strategies
        Validates: Requirements 3.2
        """
        # Create a mock Supabase client
        mock_supabase = Mock()
        mock_table = Mock()
        mock_supabase.table.return_value = mock_table
        mock_table.upsert.return_value = mock_table
        mock_table.execute.return_value = Mock(data=[])
        
        # Create RiskForecasterAgent instance
        agent = RiskForecasterAgent(mock_supabase, "test-api-key")
        
        # Store each risk prediction
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            for prediction in risk_predictions:
                loop.run_until_complete(agent._store_risk_prediction(prediction))
        finally:
            loop.close()
        
        # Verify that upsert was called for each prediction
        assert mock_table.upsert.call_count == len(risk_predictions), f"Should call upsert once for each risk prediction (expected {len(risk_predictions)}, got {mock_table.upsert.call_count})"
        
        # Verify the data passed to upsert contains required fields
        for call_args in mock_table.upsert.call_args_list:
            prediction_data = call_args[0][0]  # First argument to upsert
            
            # Verify required fields are present
            assert "project_id" in prediction_data, "Risk register entry should have project_id"
            assert "risk_type" in prediction_data, "Risk register entry should have risk_type"
            assert "description" in prediction_data, "Risk register entry should have description"
            assert "probability" in prediction_data, "Risk register entry should have probability"
            assert "impact_score" in prediction_data, "Risk register entry should have impact_score"
            assert "mitigation_suggestions" in prediction_data, "Risk register entry should have mitigation_suggestions"
            
            # Verify data types and ranges
            assert isinstance(prediction_data["project_id"], str), "project_id should be a string"
            assert isinstance(prediction_data["risk_type"], str), "risk_type should be a string"
            assert isinstance(prediction_data["description"], str), "description should be a string"
            assert isinstance(prediction_data["probability"], (int, float)), "probability should be numeric"
            assert isinstance(prediction_data["impact_score"], int), "impact_score should be an integer"
            assert isinstance(prediction_data["mitigation_suggestions"], list), "mitigation_suggestions should be a list"
            
            # Verify value ranges
            assert 0.0 <= prediction_data["probability"] <= 1.0, "probability should be between 0 and 1"
            assert 1 <= prediction_data["impact_score"] <= 5, "impact_score should be between 1 and 5"
            assert len(prediction_data["mitigation_suggestions"]) > 0, "should have at least one mitigation suggestion"

    @settings(max_examples=5, deadline=None)
    @given(project_data=project_data_strategy())
    def test_end_to_end_risk_forecasting_and_population(self, project_data):
        """
        Property 10: Risk Register Population - End-to-End
        For any project analysis, forecasted risks should be automatically stored in the risk register with complete details
        Validates: Requirements 3.2
        """
        # Create a mock Supabase client for both reading projects and storing predictions
        mock_supabase = Mock()
        mock_table = Mock()
        mock_supabase.table.return_value = mock_table
        
        # Mock the projects query
        mock_table.select.return_value = mock_table
        mock_table.eq.return_value = mock_table
        mock_table.execute.return_value = Mock(data=[project_data])
        
        # Mock the risk_predictions upsert
        mock_upsert_table = Mock()
        mock_upsert_table.upsert.return_value = mock_upsert_table
        mock_upsert_table.execute.return_value = Mock(data=[])
        
        # Configure table method to return different mocks based on table name
        def table_side_effect(table_name):
            if table_name == "risk_predictions":
                return mock_upsert_table
            else:
                return mock_table
        
        mock_supabase.table.side_effect = table_side_effect
        
        # Create RiskForecasterAgent instance
        agent = RiskForecasterAgent(mock_supabase, "test-api-key")
        
        # Mock the log_metrics method to avoid database calls
        agent.log_metrics = AsyncMock()
        
        # Run the complete risk forecasting process
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(agent.forecast_project_risks("test-user", project_data["id"]))
        finally:
            loop.close()
        
        # Verify the forecasting result structure
        assert "predictions" in result, "Result should contain predictions"
        assert "summary" in result, "Result should contain summary"
        assert isinstance(result["predictions"], list), "Predictions should be a list"
        assert len(result["predictions"]) > 0, "Should generate at least one risk prediction"
        
        # Verify summary statistics
        summary = result["summary"]
        assert "total_risks" in summary, "Summary should include total_risks count"
        assert "high_probability" in summary, "Summary should include high_probability count"
        assert "critical_impact" in summary, "Summary should include critical_impact count"
        assert summary["total_risks"] == len(result["predictions"]), "Summary total_risks should match predictions count"
        
        # Verify that predictions were stored in the risk register
        assert mock_upsert_table.upsert.call_count > 0, "Should store risk predictions in the risk register"
        assert mock_upsert_table.upsert.call_count == len(result["predictions"]), "Should store each prediction in the risk register"
        
        # Verify each stored prediction has complete details
        for call_args in mock_upsert_table.upsert.call_args_list:
            stored_prediction = call_args[0][0]
            
            # Verify all required fields for risk register population
            required_fields = ["project_id", "risk_type", "description", "probability", "impact_score", "confidence_score", "mitigation_suggestions"]
            for field in required_fields:
                assert field in stored_prediction, f"Stored prediction should have {field} field"
            
            # Verify the prediction is associated with the correct project
            assert stored_prediction["project_id"] == project_data["id"], "Stored prediction should be associated with the correct project"
            
            # Verify mitigation strategies are provided
            assert len(stored_prediction["mitigation_suggestions"]) > 0, "Each stored prediction should have mitigation strategies"
            for suggestion in stored_prediction["mitigation_suggestions"]:
                assert isinstance(suggestion, str), "Each mitigation suggestion should be a string"
                assert len(suggestion) > 0, "Each mitigation suggestion should be non-empty"