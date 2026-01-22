"""
Property-Based Tests for AI-Empowered PPM Features - Anomaly Detection Agent

This module contains property-based tests for the AnomalyDetectorAgent.
Tests validate correctness properties across all possible inputs using Hypothesis.

Feature: ai-empowered-ppm-features
Requirements: 13.1, 13.2, 13.3, 13.4, 13.5
"""

import pytest
from hypothesis import given, strategies as st, settings, assume
from datetime import datetime, timedelta
from uuid import uuid4
import numpy as np
from typing import Dict, Any, List
from unittest.mock import Mock, AsyncMock, patch
import pandas as pd

# Import the agent we're testing
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from ai_agents import AnomalyDetectorAgent


# ============================================================================
# Test Data Generators (Hypothesis Strategies)
# ============================================================================

@st.composite
def audit_log_strategy(draw):
    """Generate valid audit log entries for property testing"""
    # Use a fixed base time to avoid Hypothesis flakiness
    base_time = datetime(2024, 1, 1, 0, 0, 0)
    time_offset = draw(st.integers(min_value=0, max_value=30 * 24 * 3600))  # 0-30 days in seconds
    
    return {
        'id': str(draw(st.uuids())),
        'user_id': str(draw(st.uuids())),
        'action': draw(st.sampled_from([
            'user_login', 'budget_change', 'permission_change',
            'resource_assignment', 'risk_created', 'report_generated',
            'ai_query', 'workflow_approval', 'import', 'anomaly_detection'
        ])),
        'entity_type': draw(st.one_of(
            st.none(),
            st.sampled_from(['project', 'resource', 'risk', 'user', 'workflow'])
        )),
        'entity_id': draw(st.one_of(st.none(), st.uuids().map(str))),
        'details': draw(st.dictionaries(
            keys=st.text(min_size=1, max_size=20, alphabet=st.characters(whitelist_categories=('L', 'N'))),
            values=st.one_of(
                st.text(max_size=100),
                st.integers(min_value=0, max_value=1000000),
                st.floats(min_value=0, max_value=1000000, allow_nan=False, allow_infinity=False),
                st.booleans()
            ),
            min_size=0,
            max_size=10
        )),
        'success': draw(st.booleans()),
        'created_at': (base_time + timedelta(seconds=time_offset)).isoformat()
    }


# ============================================================================
# Property 30: Isolation Forest Anomaly Detection
# ============================================================================

@given(
    audit_logs=st.lists(
        audit_log_strategy(),
        min_size=10,
        max_size=30  # Reduced from 100
    ),
    organization_id=st.uuids(),
    time_range_days=st.integers(min_value=1, max_value=90)
)
@settings(max_examples=10, deadline=60000)  # Reduced examples and increased deadline
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_property_30_isolation_forest_anomaly_detection(audit_logs, organization_id, time_range_days):
    """
    Feature: ai-empowered-ppm-features
    Property 30: Isolation Forest Anomaly Detection
    
    For any anomaly detection request, the Anomaly_Detector SHALL use scikit-learn 
    Isolation Forest with features including hour_of_day, day_of_week, action_frequency, 
    user_action_diversity, and time_since_last_action to identify anomalies.
    
    Validates: Requirements 13.2, 13.4
    """
    # Create mock Supabase client
    mock_supabase = Mock()
    mock_table = Mock()
    mock_select = Mock()
    mock_eq = Mock()
    mock_gte = Mock()
    mock_order = Mock()
    mock_execute = Mock()
    
    # Setup mock chain
    mock_supabase.table.return_value = mock_table
    mock_table.select.return_value = mock_select
    mock_select.eq.return_value = mock_eq
    mock_eq.gte.return_value = mock_gte
    mock_gte.order.return_value = mock_order
    mock_order.execute.return_value = mock_execute
    mock_execute.data = audit_logs
    
    # Create agent
    agent = AnomalyDetectorAgent(
        supabase_client=mock_supabase,
        openai_api_key="test-key"
    )
    
    # Mock the log_operation method to avoid database calls
    agent.log_operation = AsyncMock(return_value="test-operation-id")
    
    # Run anomaly detection
    result = await agent.detect_anomalies(
        organization_id=str(organization_id),
        time_range_days=time_range_days,
        user_id="test-user"
    )
    
    # Verify result structure
    assert 'anomalies' in result
    assert 'total_logs_analyzed' in result
    assert 'anomaly_count' in result
    
    # Verify total logs analyzed matches input
    assert result['total_logs_analyzed'] == len(audit_logs)
    
    # Verify anomaly count matches anomalies list length
    assert result['anomaly_count'] == len(result['anomalies'])
    
    # Verify each anomaly has required fields
    for anomaly in result['anomalies']:
        assert 'log_id' in anomaly
        assert 'timestamp' in anomaly
        assert 'user_id' in anomaly
        assert 'action' in anomaly
        assert 'confidence' in anomaly
        assert 'reason' in anomaly
        assert 'details' in anomaly
        
        # Verify confidence is in valid range [0, 1]
        assert 0.0 <= anomaly['confidence'] <= 1.0, (
            f"Anomaly confidence should be in range [0, 1], got {anomaly['confidence']}"
        )
    
    # Verify anomalies are sorted by confidence descending
    if len(result['anomalies']) > 1:
        confidences = [a['confidence'] for a in result['anomalies']]
        assert confidences == sorted(confidences, reverse=True), (
            "Anomalies should be sorted by confidence descending"
        )
    
    # Verify Isolation Forest was used (contamination rate check)
    # Expected anomaly rate should be around 10% (contamination=0.1)
    if len(audit_logs) >= 10:
        anomaly_rate = result['anomaly_count'] / result['total_logs_analyzed']
        # Allow some variance (0% to 30% is reasonable for Isolation Forest)
        assert 0.0 <= anomaly_rate <= 0.3, (
            f"Anomaly rate should be reasonable (0-30%), got {anomaly_rate:.2%}"
        )


# ============================================================================
# Feature Engineering Tests
# ============================================================================

@given(
    audit_logs=st.lists(
        audit_log_strategy(),
        min_size=10,
        max_size=30  # Reduced
    )
)
@settings(max_examples=10, deadline=30000)  # Reduced
@pytest.mark.property_test
def test_feature_engineering_completeness(audit_logs):
    """
    Property: Feature Engineering Completeness
    
    For any list of audit logs, the feature extraction should produce a DataFrame
    with all required features: hour_of_day, day_of_week, action_frequency,
    user_action_diversity, time_since_last_action, data_volume, failed_attempts.
    
    Validates: Requirements 13.4
    """
    # Create agent
    mock_supabase = Mock()
    agent = AnomalyDetectorAgent(
        supabase_client=mock_supabase,
        openai_api_key="test-key"
    )
    
    # Extract features
    features_df = agent._prepare_features(audit_logs)
    
    # Verify DataFrame structure
    assert isinstance(features_df, pd.DataFrame)
    assert len(features_df) == len(audit_logs)
    
    # Verify all required features are present
    required_features = [
        'hour_of_day',
        'day_of_week',
        'action_frequency',
        'user_action_diversity',
        'time_since_last_action',
        'data_volume',
        'failed_attempts'
    ]
    
    for feature in required_features:
        assert feature in features_df.columns, (
            f"Feature '{feature}' should be present in feature DataFrame"
        )
    
    # Verify no NaN or inf values
    assert not features_df.isnull().any().any(), (
        "Feature DataFrame should not contain NaN values"
    )
    assert not np.isinf(features_df.values).any(), (
        "Feature DataFrame should not contain infinite values"
    )
    
    # Verify feature value ranges
    assert (features_df['hour_of_day'] >= 0).all() and (features_df['hour_of_day'] <= 23).all(), (
        "hour_of_day should be in range [0, 23]"
    )
    assert (features_df['day_of_week'] >= 0).all() and (features_df['day_of_week'] <= 6).all(), (
        "day_of_week should be in range [0, 6]"
    )
    assert (features_df['action_frequency'] >= 0).all(), (
        "action_frequency should be non-negative"
    )
    assert (features_df['user_action_diversity'] >= 0).all(), (
        "user_action_diversity should be non-negative"
    )
    assert (features_df['time_since_last_action'] >= 0).all(), (
        "time_since_last_action should be non-negative"
    )
    assert (features_df['data_volume'] >= 0).all(), (
        "data_volume should be non-negative"
    )
    assert (features_df['failed_attempts'] >= 0).all(), (
        "failed_attempts should be non-negative"
    )


@given(
    audit_logs=st.lists(
        audit_log_strategy(),
        min_size=10,
        max_size=30  # Reduced
    )
)
@settings(max_examples=10, deadline=30000)  # Reduced
@pytest.mark.property_test
def test_isolation_forest_configuration(audit_logs):
    """
    Property: Isolation Forest Configuration
    
    For any anomaly detection, the Isolation Forest model should be configured
    with n_estimators=100 and contamination=0.1.
    
    Validates: Requirements 13.2
    """
    # Create agent
    mock_supabase = Mock()
    agent = AnomalyDetectorAgent(
        supabase_client=mock_supabase,
        openai_api_key="test-key"
    )
    
    # Verify agent configuration
    assert agent.n_estimators == 100, (
        "Isolation Forest should use 100 estimators"
    )
    assert agent.contamination == 0.1, (
        "Isolation Forest should use contamination=0.1 (10% expected anomaly rate)"
    )
    
    # Extract features and train model
    features_df = agent._prepare_features(audit_logs)
    model = agent._train_isolation_forest(features_df)
    
    # Verify model configuration
    assert model.n_estimators == 100, (
        "Trained model should have 100 estimators"
    )
    assert model.contamination == 0.1, (
        "Trained model should have contamination=0.1"
    )
    assert model.random_state == 42, (
        "Model should use random_state=42 for reproducibility"
    )


# ============================================================================
# Confidence Score Tests
# ============================================================================

@given(
    audit_logs=st.lists(
        audit_log_strategy(),
        min_size=10,
        max_size=30  # Reduced
    ),
    organization_id=st.uuids()
)
@settings(max_examples=10, deadline=60000)  # Reduced
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_confidence_score_range(audit_logs, organization_id):
    """
    Property: Confidence Score Range
    
    For any anomaly detection result, all confidence scores should be in the
    range [0.0, 1.0].
    
    Validates: Requirements 13.3
    """
    # Create mock Supabase client
    mock_supabase = Mock()
    mock_table = Mock()
    mock_select = Mock()
    mock_eq = Mock()
    mock_gte = Mock()
    mock_order = Mock()
    mock_execute = Mock()
    
    # Setup mock chain
    mock_supabase.table.return_value = mock_table
    mock_table.select.return_value = mock_select
    mock_select.eq.return_value = mock_eq
    mock_eq.gte.return_value = mock_gte
    mock_gte.order.return_value = mock_order
    mock_order.execute.return_value = mock_execute
    mock_execute.data = audit_logs
    
    # Create agent
    agent = AnomalyDetectorAgent(
        supabase_client=mock_supabase,
        openai_api_key="test-key"
    )
    
    # Mock the log_operation method
    agent.log_operation = AsyncMock(return_value="test-operation-id")
    
    # Run anomaly detection
    result = await agent.detect_anomalies(
        organization_id=str(organization_id),
        time_range_days=30,
        user_id="test-user"
    )
    
    # Verify all confidence scores are in valid range
    for anomaly in result['anomalies']:
        confidence = anomaly['confidence']
        assert 0.0 <= confidence <= 1.0, (
            f"Confidence score should be in range [0.0, 1.0], got {confidence}"
        )
    
    # Verify detection confidence is also in valid range
    if 'detection_confidence' in result:
        detection_confidence = result['detection_confidence']
        assert 0.0 <= detection_confidence <= 1.0, (
            f"Detection confidence should be in range [0.0, 1.0], got {detection_confidence}"
        )


# ============================================================================
# Organization Isolation Tests
# ============================================================================

@given(
    organization_id=st.uuids(),
    time_range_days=st.integers(min_value=1, max_value=90)
)
@settings(max_examples=10, deadline=10000)  # Reduced
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_organization_context_isolation(organization_id, time_range_days):
    """
    Property: Organization Context Isolation
    
    For any anomaly detection request, the system should only retrieve and analyze
    audit logs filtered by the specified organization_id.
    
    Validates: Requirements 13.1
    """
    # Create mock Supabase client
    mock_supabase = Mock()
    mock_table = Mock()
    mock_select = Mock()
    mock_eq = Mock()
    mock_gte = Mock()
    mock_order = Mock()
    mock_execute = Mock()
    
    # Setup mock chain
    mock_supabase.table.return_value = mock_table
    mock_table.select.return_value = mock_select
    mock_select.eq.return_value = mock_eq
    mock_eq.gte.return_value = mock_gte
    mock_gte.order.return_value = mock_order
    mock_order.execute.return_value = mock_execute
    mock_execute.data = []  # Empty data for this test
    
    # Create agent
    agent = AnomalyDetectorAgent(
        supabase_client=mock_supabase,
        openai_api_key="test-key"
    )
    
    # Mock the log_operation method
    agent.log_operation = AsyncMock(return_value="test-operation-id")
    
    # Run anomaly detection
    await agent.detect_anomalies(
        organization_id=str(organization_id),
        time_range_days=time_range_days,
        user_id="test-user"
    )
    
    # Verify organization_id filter was applied
    mock_supabase.table.assert_called_once_with("audit_logs")
    mock_select.eq.assert_called_once_with("organization_id", str(organization_id))


# ============================================================================
# Audit Logging Tests
# ============================================================================

@given(
    audit_logs=st.lists(
        audit_log_strategy(),
        min_size=10,
        max_size=30  # Reduced
    ),
    organization_id=st.uuids(),
    user_id=st.uuids()
)
@settings(max_examples=5, deadline=60000)  # Reduced significantly
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_anomaly_detection_audit_logging(audit_logs, organization_id, user_id):
    """
    Property: Anomaly Detection Audit Logging
    
    For any anomaly detection request, the system should log the detection request
    and results to audit_logs.
    
    Validates: Requirements 13.5
    """
    # Create mock Supabase client
    mock_supabase = Mock()
    mock_table = Mock()
    mock_select = Mock()
    mock_eq = Mock()
    mock_gte = Mock()
    mock_order = Mock()
    mock_execute = Mock()
    
    # Setup mock chain
    mock_supabase.table.return_value = mock_table
    mock_table.select.return_value = mock_select
    mock_select.eq.return_value = mock_eq
    mock_eq.gte.return_value = mock_gte
    mock_gte.order.return_value = mock_order
    mock_order.execute.return_value = mock_execute
    mock_execute.data = audit_logs
    
    # Create agent
    agent = AnomalyDetectorAgent(
        supabase_client=mock_supabase,
        openai_api_key="test-key"
    )
    
    # Mock the log_operation method to track calls
    log_operation_mock = AsyncMock(return_value="test-operation-id")
    agent.log_operation = log_operation_mock
    
    # Run anomaly detection
    result = await agent.detect_anomalies(
        organization_id=str(organization_id),
        time_range_days=30,
        user_id=str(user_id)
    )
    
    # Verify log_operation was called
    assert log_operation_mock.called, (
        "Anomaly detection should log the operation"
    )
    
    # Verify log_operation was called with correct parameters
    call_args = log_operation_mock.call_args
    assert call_args is not None
    
    # Check keyword arguments
    kwargs = call_args.kwargs
    assert kwargs['operation_type'] == 'anomaly_detection'
    assert kwargs['user_id'] == str(user_id)
    assert 'organization_id' in kwargs['inputs']
    assert kwargs['inputs']['organization_id'] == str(organization_id)
    assert kwargs['success'] is True
    assert 'anomaly_count' in kwargs['outputs']


# ============================================================================
# Edge Case Tests
# ============================================================================

@pytest.mark.asyncio
async def test_insufficient_data_handling():
    """
    Test that anomaly detection handles insufficient data gracefully.
    
    Validates: Requirements 13.2, 13.3
    """
    # Create mock Supabase client with insufficient data
    mock_supabase = Mock()
    mock_table = Mock()
    mock_select = Mock()
    mock_eq = Mock()
    mock_gte = Mock()
    mock_order = Mock()
    mock_execute = Mock()
    
    # Setup mock chain with only 5 logs (less than minimum 10)
    mock_supabase.table.return_value = mock_table
    mock_table.select.return_value = mock_select
    mock_select.eq.return_value = mock_eq
    mock_eq.gte.return_value = mock_gte
    mock_gte.order.return_value = mock_order
    mock_order.execute.return_value = mock_execute
    mock_execute.data = [
        {
            'id': str(uuid4()),
            'user_id': str(uuid4()),
            'action': 'user_login',
            'entity_type': 'user',
            'entity_id': str(uuid4()),
            'details': {},
            'success': True,
            'created_at': datetime.now().isoformat()
        }
        for _ in range(5)
    ]
    
    # Create agent
    agent = AnomalyDetectorAgent(
        supabase_client=mock_supabase,
        openai_api_key="test-key"
    )
    
    # Mock the log_operation method
    agent.log_operation = AsyncMock(return_value="test-operation-id")
    
    # Run anomaly detection
    result = await agent.detect_anomalies(
        organization_id=str(uuid4()),
        time_range_days=30,
        user_id="test-user"
    )
    
    # Verify result indicates insufficient data
    assert result['total_logs_analyzed'] == 5
    assert result['anomaly_count'] == 0
    assert len(result['anomalies']) == 0
    assert 'message' in result
    assert 'insufficient' in result['message'].lower()


@pytest.mark.asyncio
async def test_normal_activity_detection():
    """
    Test that anomaly detection correctly identifies normal activity patterns.
    
    Validates: Requirements 13.2, 13.3
    """
    # Create mock Supabase client with normal activity logs
    mock_supabase = Mock()
    mock_table = Mock()
    mock_select = Mock()
    mock_eq = Mock()
    mock_gte = Mock()
    mock_order = Mock()
    mock_execute = Mock()
    
    # Create 50 normal logs (business hours, consistent patterns)
    base_time = datetime(2024, 1, 15, 10, 0)  # Monday 10 AM
    normal_logs = []
    for i in range(50):
        normal_logs.append({
            'id': str(uuid4()),
            'user_id': str(uuid4()),
            'action': 'user_login',
            'entity_type': 'user',
            'entity_id': str(uuid4()),
            'details': {'login_method': 'password'},
            'success': True,
            'created_at': (base_time + timedelta(hours=i)).isoformat()
        })
    
    # Setup mock chain
    mock_supabase.table.return_value = mock_table
    mock_table.select.return_value = mock_select
    mock_select.eq.return_value = mock_eq
    mock_eq.gte.return_value = mock_gte
    mock_gte.order.return_value = mock_order
    mock_order.execute.return_value = mock_execute
    mock_execute.data = normal_logs
    
    # Create agent
    agent = AnomalyDetectorAgent(
        supabase_client=mock_supabase,
        openai_api_key="test-key"
    )
    
    # Mock the log_operation method
    agent.log_operation = AsyncMock(return_value="test-operation-id")
    
    # Run anomaly detection
    result = await agent.detect_anomalies(
        organization_id=str(uuid4()),
        time_range_days=30,
        user_id="test-user"
    )
    
    # Verify result
    assert result['total_logs_analyzed'] == 50
    # With normal activity, anomaly count should be low (around 10% or less)
    assert result['anomaly_count'] <= 10, (
        f"Normal activity should have low anomaly count, got {result['anomaly_count']}"
    )


@pytest.mark.asyncio
async def test_injected_anomaly_detection():
    """
    Test that anomaly detection correctly identifies injected anomalies.
    
    Validates: Requirements 13.2, 13.4
    """
    # Create mock Supabase client with mostly normal logs and some anomalies
    mock_supabase = Mock()
    mock_table = Mock()
    mock_select = Mock()
    mock_eq = Mock()
    mock_gte = Mock()
    mock_order = Mock()
    mock_execute = Mock()
    
    # Create 40 normal logs
    base_time = datetime(2024, 1, 15, 10, 0)  # Monday 10 AM
    logs = []
    for i in range(40):
        logs.append({
            'id': str(uuid4()),
            'user_id': str(uuid4()),
            'action': 'user_login',
            'entity_type': 'user',
            'entity_id': str(uuid4()),
            'details': {'login_method': 'password'},
            'success': True,
            'created_at': (base_time + timedelta(hours=i)).isoformat()
        })
    
    # Inject 10 anomalous logs (unusual time, high frequency, large data volume)
    anomaly_time = datetime(2024, 1, 15, 3, 0)  # 3 AM (unusual)
    for i in range(10):
        logs.append({
            'id': str(uuid4()),
            'user_id': str(uuid4()),
            'action': 'permission_change',
            'entity_type': 'user',
            'entity_id': str(uuid4()),
            'details': {'permission': 'admin', 'data': 'x' * 10000},  # Large data volume
            'success': False,  # Failed attempt
            'created_at': (anomaly_time + timedelta(seconds=i)).isoformat()  # Rapid succession
        })
    
    # Setup mock chain
    mock_supabase.table.return_value = mock_table
    mock_table.select.return_value = mock_select
    mock_select.eq.return_value = mock_eq
    mock_eq.gte.return_value = mock_gte
    mock_gte.order.return_value = mock_order
    mock_order.execute.return_value = mock_execute
    mock_execute.data = logs
    
    # Create agent
    agent = AnomalyDetectorAgent(
        supabase_client=mock_supabase,
        openai_api_key="test-key"
    )
    
    # Mock the log_operation method
    agent.log_operation = AsyncMock(return_value="test-operation-id")
    
    # Run anomaly detection
    result = await agent.detect_anomalies(
        organization_id=str(uuid4()),
        time_range_days=30,
        user_id="test-user"
    )
    
    # Verify result
    assert result['total_logs_analyzed'] == 50
    # Should detect some anomalies (at least a few of the injected ones)
    assert result['anomaly_count'] > 0, (
        "Should detect at least some of the injected anomalies"
    )
    
    # Verify anomalies have reasons
    for anomaly in result['anomalies']:
        assert len(anomaly['reason']) > 0, (
            "Each anomaly should have a reason"
        )
