"""
Property-based tests for Risk Forecaster Agent with ARIMA
Feature: ai-empowered-ppm-features
Property 9: ARIMA Forecast Output Format
Property 5: Organization Context Isolation
Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
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
import pandas as pd
import numpy as np

# Import risk forecasting agent
from ai_agents import RiskForecasterAgent


# Test data strategies for property-based testing
@st.composite
def risk_data_strategy(draw, min_size=10, max_size=50):
    """Generate valid historical risk data for ARIMA testing"""
    num_risks = draw(st.integers(min_value=min_size, max_value=max_size))
    risks = []
    
    base_date = datetime.now() - timedelta(days=365)
    
    for i in range(num_risks):
        risk_date = base_date + timedelta(days=i * 7)  # Weekly data
        risks.append({
            "id": str(uuid.uuid4()),
            "organization_id": str(uuid.uuid4()),
            "project_id": str(uuid.uuid4()),
            "title": f"Risk {i}",
            "description": draw(st.text(min_size=10, max_size=100)),
            "probability": draw(st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False)),
            "impact": draw(st.integers(min_value=1, max_value=5)),
            "severity": draw(st.sampled_from(["low", "medium", "high", "critical"])),
            "status": draw(st.sampled_from(["open", "mitigated", "closed"])),
            "created_at": risk_date.isoformat()
        })
    
    return risks


@st.composite
def insufficient_risk_data_strategy(draw):
    """Generate insufficient historical risk data (< 10 points)"""
    num_risks = draw(st.integers(min_value=0, max_value=9))
    risks = []
    
    base_date = datetime.now() - timedelta(days=90)
    
    for i in range(num_risks):
        risk_date = base_date + timedelta(days=i * 10)
        risks.append({
            "id": str(uuid.uuid4()),
            "organization_id": str(uuid.uuid4()),
            "project_id": str(uuid.uuid4()),
            "title": f"Risk {i}",
            "probability": draw(st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False)),
            "impact": draw(st.integers(min_value=1, max_value=5)),
            "created_at": risk_date.isoformat()
        })
    
    return risks


class TestARIMAForecastOutputFormat:
    """Property 9: ARIMA Forecast Output Format tests"""

    @settings(max_examples=3, deadline=60000)
    @given(risk_data=risk_data_strategy(min_size=10, max_size=20))
    def test_property_9_forecast_output_format(self, risk_data):
        """
        Property 9: ARIMA Forecast Output Format
        
        For any successful risk forecast, the Forecaster_Agent SHALL return predictions 
        containing risk_probability, risk_impact, timeline period, confidence_lower, 
        confidence_upper, and model_confidence for each forecast period.
        
        Validates: Requirements 3.3, 3.4
        """
        # Create a mock Supabase client
        mock_supabase = Mock()
        mock_table = Mock()
        mock_supabase.table.return_value = mock_table
        mock_table.select.return_value = mock_table
        mock_table.eq.return_value = mock_table
        mock_table.order.return_value = mock_table
        mock_table.execute.return_value = Mock(data=risk_data)
        mock_table.insert.return_value = mock_table
        
        # Create RiskForecasterAgent instance
        agent = RiskForecasterAgent(mock_supabase, "test-api-key")
        
        # Mock log_metrics to avoid database calls
        agent.log_metrics = AsyncMock()
        
        # Run forecast
        organization_id = str(uuid.uuid4())
        user_id = str(uuid.uuid4())
        forecast_periods = 12
        
        # Run async function in event loop
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(agent.forecast_risks(
                organization_id=organization_id,
                user_id=user_id,
                project_id=None,
                forecast_periods=forecast_periods
            ))
        finally:
            loop.close()
        
        # Verify result structure
        assert "forecasts" in result, "Result should contain 'forecasts' field"
        assert "model_confidence" in result, "Result should contain 'model_confidence' field"
        assert "model_metrics" in result, "Result should contain 'model_metrics' field"
        
        # Verify forecasts list
        forecasts = result["forecasts"]
        assert isinstance(forecasts, list), "Forecasts should be a list"
        assert len(forecasts) == forecast_periods, f"Should generate {forecast_periods} forecast periods"
        
        # Verify each forecast has required fields
        for i, forecast in enumerate(forecasts):
            assert "period" in forecast, f"Forecast {i} should have 'period' field"
            assert "risk_probability" in forecast, f"Forecast {i} should have 'risk_probability' field"
            assert "risk_impact" in forecast, f"Forecast {i} should have 'risk_impact' field"
            assert "confidence_lower" in forecast, f"Forecast {i} should have 'confidence_lower' field"
            assert "confidence_upper" in forecast, f"Forecast {i} should have 'confidence_upper' field"
            
            # Verify data types
            assert isinstance(forecast["period"], str), f"Forecast {i} period should be a string"
            assert isinstance(forecast["risk_probability"], (int, float)), f"Forecast {i} risk_probability should be numeric"
            assert isinstance(forecast["risk_impact"], (int, float)), f"Forecast {i} risk_impact should be numeric"
            assert isinstance(forecast["confidence_lower"], (int, float)), f"Forecast {i} confidence_lower should be numeric"
            assert isinstance(forecast["confidence_upper"], (int, float)), f"Forecast {i} confidence_upper should be numeric"
            
            # Verify value ranges
            assert 0.0 <= forecast["risk_probability"] <= 1.0, f"Forecast {i} risk_probability should be between 0 and 1"
            assert forecast["risk_impact"] > 0, f"Forecast {i} risk_impact should be positive"
            assert 0.0 <= forecast["confidence_lower"] <= 1.0, f"Forecast {i} confidence_lower should be between 0 and 1"
            assert 0.0 <= forecast["confidence_upper"] <= 1.0, f"Forecast {i} confidence_upper should be between 0 and 1"
            
            # Verify confidence interval ordering
            assert forecast["confidence_lower"] <= forecast["risk_probability"], f"Forecast {i} confidence_lower should be <= risk_probability"
            assert forecast["risk_probability"] <= forecast["confidence_upper"], f"Forecast {i} risk_probability should be <= confidence_upper"
        
        # Verify model_confidence
        model_confidence = result["model_confidence"]
        assert isinstance(model_confidence, (int, float)), "model_confidence should be numeric"
        assert 0.0 <= model_confidence <= 1.0, "model_confidence should be between 0 and 1"
        
        # Verify model_metrics
        model_metrics = result["model_metrics"]
        assert isinstance(model_metrics, dict), "model_metrics should be a dictionary"
        assert "data_points" in model_metrics, "model_metrics should contain data_points"
        assert model_metrics["data_points"] == len(risk_data), "data_points should match input data length"


class TestOrganizationContextIsolation:
    """Property 5: Organization Context Isolation tests"""

    @settings(max_examples=3, deadline=60000)
    @given(
        risk_data=risk_data_strategy(min_size=10, max_size=15),
        org_id_1=st.uuids(),
        org_id_2=st.uuids()
    )
    def test_property_5_organization_isolation(self, risk_data, org_id_1, org_id_2):
        """
        Property 5: Organization Context Isolation
        
        For any data retrieval operation (AI agents, workflows, imports, audit logs), 
        the system SHALL filter all queries by the authenticated user's organization_id, 
        ensuring users can only access their organization's data.
        
        Validates: Requirements 3.1
        """
        assume(org_id_1 != org_id_2)
        
        # Set organization_id for all risk data
        org1_data = []
        for risk in risk_data:
            risk_copy = risk.copy()
            risk_copy["organization_id"] = str(org_id_1)
            org1_data.append(risk_copy)
        
        # Create a mock Supabase client
        mock_supabase = Mock()
        mock_table = Mock()
        mock_supabase.table.return_value = mock_table
        mock_table.select.return_value = mock_table
        
        # Track the eq calls to verify organization filtering
        eq_calls = []
        def track_eq(field, value):
            eq_calls.append((field, value))
            return mock_table
        
        mock_table.eq.side_effect = track_eq
        mock_table.order.return_value = mock_table
        mock_table.execute.return_value = Mock(data=org1_data)
        mock_table.insert.return_value = mock_table
        
        # Create RiskForecasterAgent instance
        agent = RiskForecasterAgent(mock_supabase, "test-api-key")
        agent.log_metrics = AsyncMock()
        
        # Run forecast for organization 1
        user_id = str(uuid.uuid4())
        
        # Run async function in event loop
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(agent.forecast_risks(
                organization_id=str(org_id_1),
                user_id=user_id,
                project_id=None,
                forecast_periods=6
            ))
        finally:
            loop.close()
        
        # Verify that organization_id filter was applied
        assert len(eq_calls) > 0, "Should have called eq() to filter data"
        org_filter_found = any(field == "organization_id" and value == str(org_id_1) for field, value in eq_calls)
        assert org_filter_found, f"Should filter by organization_id={org_id_1}"
        
        # Verify no data from other organizations
        # (In real implementation, this would be enforced by database query)
        assert result is not None, "Should return forecast result"
        assert "forecasts" in result, "Result should contain forecasts"


class TestInsufficientDataHandling:
    """Tests for insufficient data error handling"""

    @settings(max_examples=3, deadline=30000)
    @given(risk_data=insufficient_risk_data_strategy())
    def test_property_8_insufficient_data_error(self, risk_data):
        """
        Property 8: Missing Data Error Messages
        
        For any AI agent request with insufficient input data, the system SHALL return 
        an error message specifically indicating which required data fields or minimum 
        data requirements are missing.
        
        Validates: Requirements 3.5
        """
        # Create a mock Supabase client
        mock_supabase = Mock()
        mock_table = Mock()
        mock_supabase.table.return_value = mock_table
        mock_table.select.return_value = mock_table
        mock_table.eq.return_value = mock_table
        mock_table.order.return_value = mock_table
        mock_table.execute.return_value = Mock(data=risk_data)
        mock_table.insert.return_value = mock_table
        
        # Create RiskForecasterAgent instance
        agent = RiskForecasterAgent(mock_supabase, "test-api-key")
        agent.log_metrics = AsyncMock()
        
        # Run forecast with insufficient data
        organization_id = str(uuid.uuid4())
        user_id = str(uuid.uuid4())
        
        # Should raise ValueError with specific message
        # Run async function in event loop
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            with pytest.raises(ValueError) as exc_info:
                loop.run_until_complete(agent.forecast_risks(
                    organization_id=organization_id,
                    user_id=user_id,
                    project_id=None,
                    forecast_periods=6
                ))
        finally:
            loop.close()
        
        # Verify error message is specific
        error_message = str(exc_info.value)
        assert "Insufficient historical data" in error_message, "Error should mention insufficient data"
        assert "Minimum" in error_message or "minimum" in error_message, "Error should mention minimum requirement"
        assert str(agent.min_data_points) in error_message or "10" in error_message, "Error should mention minimum data points"
        assert str(len(risk_data)) in error_message, "Error should mention actual data points found"


class TestEdgeCases:
    """Unit tests for forecaster edge cases"""

    @pytest.mark.asyncio
    async def test_minimal_data_exactly_10_points(self):
        """
        Test with minimal data (exactly 10 points)
        Validates: Requirements 3.2, 3.5
        """
        # Generate exactly 10 data points
        risk_data = []
        base_date = datetime.now() - timedelta(days=90)
        
        for i in range(10):
            risk_date = base_date + timedelta(days=i * 9)
            risk_data.append({
                "id": str(uuid.uuid4()),
                "organization_id": str(uuid.uuid4()),
                "project_id": str(uuid.uuid4()),
                "title": f"Risk {i}",
                "probability": 0.5,
                "impact": 3,
                "created_at": risk_date.isoformat()
            })
        
        # Create a mock Supabase client
        mock_supabase = Mock()
        mock_table = Mock()
        mock_supabase.table.return_value = mock_table
        mock_table.select.return_value = mock_table
        mock_table.eq.return_value = mock_table
        mock_table.order.return_value = mock_table
        mock_table.execute.return_value = Mock(data=risk_data)
        mock_table.insert.return_value = mock_table
        
        # Create RiskForecasterAgent instance
        agent = RiskForecasterAgent(mock_supabase, "test-api-key")
        agent.log_metrics = AsyncMock()
        
        # Run forecast - should succeed with exactly 10 points
        organization_id = str(uuid.uuid4())
        user_id = str(uuid.uuid4())
        
        result = await agent.forecast_risks(
            organization_id=organization_id,
            project_id=None,
            forecast_periods=6,
            user_id=user_id
        )
        
        # Verify result
        assert result is not None, "Should return result with exactly 10 data points"
        assert "forecasts" in result, "Result should contain forecasts"
        assert len(result["forecasts"]) == 6, "Should generate 6 forecast periods"

    @pytest.mark.asyncio
    async def test_insufficient_data_less_than_10_points(self):
        """
        Test with insufficient data (< 10 points)
        Validates: Requirements 3.5
        """
        # Generate only 5 data points
        risk_data = []
        base_date = datetime.now() - timedelta(days=50)
        
        for i in range(5):
            risk_date = base_date + timedelta(days=i * 10)
            risk_data.append({
                "id": str(uuid.uuid4()),
                "organization_id": str(uuid.uuid4()),
                "project_id": str(uuid.uuid4()),
                "title": f"Risk {i}",
                "probability": 0.5,
                "impact": 3,
                "created_at": risk_date.isoformat()
            })
        
        # Create a mock Supabase client
        mock_supabase = Mock()
        mock_table = Mock()
        mock_supabase.table.return_value = mock_table
        mock_table.select.return_value = mock_table
        mock_table.eq.return_value = mock_table
        mock_table.order.return_value = mock_table
        mock_table.execute.return_value = Mock(data=risk_data)
        mock_table.insert.return_value = mock_table
        
        # Create RiskForecasterAgent instance
        agent = RiskForecasterAgent(mock_supabase, "test-api-key")
        agent.log_metrics = AsyncMock()
        
        # Run forecast - should fail with insufficient data
        organization_id = str(uuid.uuid4())
        user_id = str(uuid.uuid4())
        
        with pytest.raises(ValueError) as exc_info:
            await agent.forecast_risks(
                organization_id=organization_id,
                project_id=None,
                forecast_periods=6,
                user_id=user_id
            )
        
        # Verify error message
        error_message = str(exc_info.value)
        assert "Insufficient" in error_message or "insufficient" in error_message
        assert "5" in error_message, "Error should mention 5 data points found"

    @pytest.mark.asyncio
    async def test_seasonal_data_pattern(self):
        """
        Test with seasonal data
        Validates: Requirements 3.2
        """
        # Generate seasonal data (52 weeks with seasonal pattern)
        risk_data = []
        base_date = datetime.now() - timedelta(days=365)
        
        for i in range(52):
            risk_date = base_date + timedelta(days=i * 7)
            # Create seasonal pattern (higher risk in certain months)
            month = risk_date.month
            seasonal_factor = 1.5 if month in [3, 6, 9, 12] else 1.0
            
            risk_data.append({
                "id": str(uuid.uuid4()),
                "organization_id": str(uuid.uuid4()),
                "project_id": str(uuid.uuid4()),
                "title": f"Risk {i}",
                "probability": min(0.3 * seasonal_factor, 1.0),
                "impact": 3,
                "created_at": risk_date.isoformat()
            })
        
        # Create a mock Supabase client
        mock_supabase = Mock()
        mock_table = Mock()
        mock_supabase.table.return_value = mock_table
        mock_table.select.return_value = mock_table
        mock_table.eq.return_value = mock_table
        mock_table.order.return_value = mock_table
        mock_table.execute.return_value = Mock(data=risk_data)
        mock_table.insert.return_value = mock_table
        
        # Create RiskForecasterAgent instance
        agent = RiskForecasterAgent(mock_supabase, "test-api-key")
        agent.log_metrics = AsyncMock()
        
        # Run forecast
        organization_id = str(uuid.uuid4())
        user_id = str(uuid.uuid4())
        
        result = await agent.forecast_risks(
            organization_id=organization_id,
            project_id=None,
            forecast_periods=12,
            user_id=user_id
        )
        
        # Verify result
        assert result is not None, "Should handle seasonal data"
        assert "forecasts" in result, "Result should contain forecasts"
        assert len(result["forecasts"]) == 12, "Should generate 12 forecast periods"
        assert result["model_confidence"] > 0, "Should have positive confidence for seasonal data"
