"""
Property-Based Tests for Data Validator Agent
Feature: ai-empowered-ppm-features
Tests Properties 10-13
"""

import pytest
from hypothesis import given, strategies as st, settings, assume, HealthCheck
from datetime import datetime, timedelta
import uuid
from unittest.mock import Mock
import sys
import os
import asyncio

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from ai_agents import DataValidatorAgent

# Test strategies
@st.composite
def project_with_budget_overrun(draw):
    budget = float(draw(st.decimals(min_value=1000, max_value=1000000, places=2)))
    overrun_percentage = draw(st.floats(min_value=0.01, max_value=0.50))
    actual_cost = budget * (1 + overrun_percentage)
    
    return {
        "id": str(uuid.uuid4()),
        "name": draw(st.text(min_size=1, max_size=50)),
        "budget": budget,
        "actual_cost": actual_cost,
        "overrun_percentage": overrun_percentage * 100
    }

class TestDataValidatorProperties:
    @pytest.fixture
    def mock_supabase(self):
        mock = Mock()
        mock.table = Mock(return_value=mock)
        mock.select = Mock(return_value=mock)
        mock.eq = Mock(return_value=mock)
        mock.insert = Mock(return_value=mock)
        mock.execute = Mock(return_value=Mock(data=[]))
        return mock
    
    @pytest.fixture
    def validator_agent(self, mock_supabase):
        return DataValidatorAgent(
            supabase_client=mock_supabase,
            openai_api_key="test-key"
        )
    
    @given(project=project_with_budget_overrun())
    @settings(
        max_examples=10, 
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    def test_property_10_budget_overrun_detection(self, project, validator_agent, mock_supabase):
        """
        Property 10: Budget Overrun Detection
        Validates: Requirements 4.1
        """
        organization_id = str(uuid.uuid4())
        user_id = str(uuid.uuid4())
        
        projects_data = [{
            "id": project["id"],
            "name": project["name"],
            "budget": project["budget"],
            "status": "active"
        }]
        
        financials_data = [{"id": str(uuid.uuid4()), "amount": project["actual_cost"]}]
        
        call_counter = {"count": 0}
        def mock_execute_side_effect():
            call_counter["count"] += 1
            if call_counter["count"] == 1:
                return Mock(data=projects_data)
            elif call_counter["count"] == 2:
                return Mock(data=financials_data)
            return Mock(data=[])
        
        mock_supabase.execute.side_effect = mock_execute_side_effect
        
        result = asyncio.run(validator_agent.validate_data(
            organization_id=organization_id,
            validation_scope="financials",
            user_id=user_id
        ))
        
        assert result["total_issues"] > 0
        overrun_issues = [i for i in result["issues"] if "over budget" in i["description"].lower()]
        assert len(overrun_issues) > 0
        
        overrun_issue = overrun_issues[0]
        overrun_pct = project["overrun_percentage"]
        
        if overrun_pct > 20:
            assert overrun_issue["severity"] == "HIGH"
        elif overrun_pct > 10:
            assert overrun_issue["severity"] == "MEDIUM"
        else:
            assert overrun_issue["severity"] == "LOW"
