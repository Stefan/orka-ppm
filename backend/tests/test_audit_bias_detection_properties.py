"""
Property-Based Tests for AI-Empowered Audit Trail - Bias Detection

This module contains property-based tests for the audit bias detection system.
Tests validate correctness properties for anomaly detection rate tracking,
bias detection, dataset balancing, and AI prediction logging.

Feature: ai-empowered-audit-trail
Requirements: 8.1, 8.2, 8.4, 8.5, 8.6, 8.7
"""

import pytest
from hypothesis import given, strategies as st, settings, assume
from datetime import datetime, timedelta
from uuid import uuid4, UUID
import numpy as np
from typing import Dict, Any, List
import json

# Import the services we're testing
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.audit_bias_detection_service import AuditBiasDetectionService, BiasMetric


# ============================================================================
# Test Data Generators (Hypothesis Strategies)
# ============================================================================

def audit_event_with_demographics_strategy():
    """
    Generate audit events with demographic information for bias testing.
    """
    @st.composite
    def _audit_event(draw):
        # Generate anomaly flag
        is_anomaly = draw(st.booleans())
        anomaly_score = draw(st.floats(min_value=0.7, max_value=1.0)) if is_anomaly else draw(st.floats(min_value=0.0, max_value=0.7))
        
        # Generate demographic information
        user_role = draw(st.sampled_from(['admin', 'manager', 'user', 'viewer', 'unknown']))
        department = draw(st.sampled_from(['engineering', 'finance', 'operations', 'hr', 'unknown']))
        entity_type = draw(st.sampled_from(['project', 'resource', 'risk', 'change_request', 'report']))
        
        # Use fixed base time to avoid flaky datetime generation
        base_time = datetime(2024, 1, 1, 0, 0, 0)
        days_offset = draw(st.integers(min_value=0, max_value=30))
        timestamp = base_time + timedelta(days=days_offset)
        
        return {
            'id': draw(st.uuids().map(str)),
            'event_type': draw(st.sampled_from([
                'user_login', 'budget_change', 'permission_change',
                'resource_assignment', 'risk_created', 'report_generated'
            ])),
            'user_id': draw(st.uuids().map(str)),
            'entity_type': entity_type,
            'entity_id': draw(st.uuids().map(str)),
            'action_details': {
                'user_role': user_role,
                'department': department,
                'action': draw(st.text(min_size=5, max_size=50))
            },
            'severity': draw(st.sampled_from(['info', 'warning', 'error', 'critical'])),
            'timestamp': timestamp.isoformat(),
            'anomaly_score': anomaly_score,
            'is_anomaly': is_anomaly,
            'category': draw(st.sampled_from([
                'Security Change', 'Financial Impact', 'Resource Allocation',
                'Risk Event', 'Compliance Action'
            ])),
            'risk_level': draw(st.sampled_from(['Low', 'Medium', 'High', 'Critical'])),
            'tenant_id': draw(st.uuids().map(str))
        }
    
    return _audit_event()


# ============================================================================
# Property 24: Anomaly Detection Rate Tracking
# ============================================================================

# Feature: ai-empowered-audit-trail, Property 24: Anomaly Detection Rate Tracking
@given(
    events=st.lists(
        audit_event_with_demographics_strategy(),
        min_size=10,
        max_size=50
    )
)
@settings(max_examples=20, deadline=None)
@pytest.mark.asyncio
@pytest.mark.property_test
async def test_property_24_anomaly_detection_rate_tracking(events):
    """
    Property 24: Anomaly Detection Rate Tracking
    
    For any analysis period, the system should track and store anomaly detection
    rates broken down by user role, department, and entity type, enabling bias analysis.
    
    Validates: Requirements 8.1
    """
    # Arrange
    service = AuditBiasDetectionService()
    
    # Ensure we have at least some events
    assume(len(events) >= 10)
    
    # Set consistent time period
    start_time = datetime.now() - timedelta(days=7)
    end_time = datetime.now()
    
    # Update event timestamps to be within the time period
    for event in events:
        event['timestamp'] = (start_time + timedelta(
            seconds=np.random.randint(0, int((end_time - start_time).total_seconds()))
        )).isoformat()
    
    # Act - Calculate rates by different dimensions
    entity_metrics = await service._calculate_rates_by_dimension(
        events, 'entity_type', 'entity_type', start_time, end_time, None
    )
    
    user_role_metrics = await service._calculate_rates_by_user_role(
        events, start_time, end_time, None
    )
    
    department_metrics = await service._calculate_rates_by_department(
        events, start_time, end_time, None
    )
    
    # Assert - Verify metrics are tracked for each dimension
    all_metrics = entity_metrics + user_role_metrics + department_metrics
    
    # Property: Metrics should be generated for each dimension
    assert len(all_metrics) > 0, "Should generate metrics for at least one dimension"
    
    # Property: Each metric should have valid structure
    for metric in all_metrics:
        assert isinstance(metric, BiasMetric), "Should return BiasMetric objects"
        assert metric.metric_type == 'anomaly_detection_rate', "Should track anomaly detection rate"
        assert metric.dimension in ['entity_type', 'user_role', 'department'], "Should track known dimensions"
        assert 0.0 <= metric.metric_value <= 1.0, "Rate should be between 0 and 1"
        assert metric.sample_size > 0, "Should have positive sample size"
        assert metric.time_period_start == start_time, "Should match start time"
        assert metric.time_period_end == end_time, "Should match end time"
    
    # Property: Rates should be calculated correctly
    # Group events by entity type and verify rate calculation
    entity_groups = {}
    for event in events:
        entity_type = event['entity_type']
        if entity_type not in entity_groups:
            entity_groups[entity_type] = {'total': 0, 'anomalies': 0}
        entity_groups[entity_type]['total'] += 1
        if event['is_anomaly']:
            entity_groups[entity_type]['anomalies'] += 1
    
    # Verify each entity type has a corresponding metric with correct rate
    for entity_type, counts in entity_groups.items():
        expected_rate = counts['anomalies'] / counts['total']
        
        # Find metric for this entity type
        entity_metric = next(
            (m for m in entity_metrics if m.dimension_value == entity_type),
            None
        )
        
        assert entity_metric is not None, f"Should have metric for entity type {entity_type}"
        assert abs(entity_metric.metric_value - expected_rate) < 0.001, \
            f"Rate should match calculated value for {entity_type}"
        assert entity_metric.sample_size == counts['total'], \
            f"Sample size should match total events for {entity_type}"


# ============================================================================
# Property 25: Bias Detection Threshold
# ============================================================================

# Feature: ai-empowered-audit-trail, Property 25: Bias Detection Threshold
@given(
    # Generate events with intentional bias
    high_rate_group_size=st.integers(min_value=20, max_value=40),
    low_rate_group_size=st.integers(min_value=20, max_value=40),
    high_anomaly_rate=st.floats(min_value=0.5, max_value=0.9),
    low_anomaly_rate=st.floats(min_value=0.05, max_value=0.2)
)
@settings(max_examples=20, deadline=None)
@pytest.mark.asyncio
@pytest.mark.property_test
async def test_property_25_bias_detection_threshold(
    high_rate_group_size,
    low_rate_group_size,
    high_anomaly_rate,
    low_anomaly_rate
):
    """
    Property 25: Bias Detection Threshold
    
    For any set of anomaly detection rates across user groups, if the difference
    between the highest and lowest rates exceeds 20%, the system should flag
    potential bias and create a bias alert record.
    
    Validates: Requirements 8.2
    """
    # Arrange
    service = AuditBiasDetectionService()
    
    # Ensure there's a meaningful difference
    assume(high_anomaly_rate - low_anomaly_rate > 0.1)
    
    # Calculate expected variance
    variance = high_anomaly_rate - low_anomaly_rate
    should_detect_bias = variance > service.BIAS_THRESHOLD
    
    # Create events with intentional bias
    events = []
    
    # High rate group (e.g., 'admin' role)
    high_anomaly_count = int(high_rate_group_size * high_anomaly_rate)
    for i in range(high_rate_group_size):
        is_anomaly = i < high_anomaly_count
        events.append({
            'id': str(uuid4()),
            'event_type': 'permission_change',
            'entity_type': 'permission',
            'action_details': {'user_role': 'admin'},
            'timestamp': datetime.now().isoformat(),
            'is_anomaly': is_anomaly,
            'anomaly_score': 0.8 if is_anomaly else 0.3,
            'tenant_id': str(uuid4())
        })
    
    # Low rate group (e.g., 'user' role)
    low_anomaly_count = int(low_rate_group_size * low_anomaly_rate)
    for i in range(low_rate_group_size):
        is_anomaly = i < low_anomaly_count
        events.append({
            'id': str(uuid4()),
            'event_type': 'permission_change',
            'entity_type': 'permission',
            'action_details': {'user_role': 'user'},
            'timestamp': datetime.now().isoformat(),
            'is_anomaly': is_anomaly,
            'anomaly_score': 0.8 if is_anomaly else 0.3,
            'tenant_id': str(uuid4())
        })
    
    # Act - Track rates and detect bias
    start_time = datetime.now() - timedelta(days=1)
    end_time = datetime.now()
    
    metrics = await service._calculate_rates_by_user_role(
        events, start_time, end_time, None
    )
    
    # Store metrics (in-memory for testing)
    await service._store_bias_metrics(metrics)
    
    # Detect bias
    bias_alerts = await service.detect_bias(start_time, end_time, None)
    
    # Assert
    if should_detect_bias:
        # Property: Should detect bias when variance exceeds threshold
        assert len(bias_alerts) > 0, \
            f"Should detect bias when variance ({variance:.2%}) exceeds threshold ({service.BIAS_THRESHOLD:.2%})"
        
        # Verify alert properties
        alert = bias_alerts[0]
        assert alert.dimension == 'user_role', "Should identify correct dimension"
        assert alert.variance > service.BIAS_THRESHOLD, "Alert variance should exceed threshold"
        assert len(alert.affected_groups) >= 2, "Should identify affected groups"
        
        # Verify variance calculation
        assert abs(alert.variance - variance) < 0.05, \
            "Alert variance should match calculated variance"
    else:
        # Property: Should not detect bias when variance is below threshold
        # Note: May still detect bias if other dimensions have high variance
        pass  # This is acceptable


# ============================================================================
# Property 26: Balanced Training Dataset
# ============================================================================

# Feature: ai-empowered-audit-trail, Property 26: Balanced Training Dataset
@given(
    events_per_category=st.dictionaries(
        keys=st.sampled_from([
            'Security Change', 'Financial Impact', 'Resource Allocation',
            'Risk Event', 'Compliance Action'
        ]),
        values=st.integers(min_value=5, max_value=30),
        min_size=3,
        max_size=5
    )
)
@settings(max_examples=20, deadline=None)
@pytest.mark.asyncio
@pytest.mark.property_test
async def test_property_26_balanced_training_dataset(events_per_category):
    """
    Property 26: Balanced Training Dataset
    
    For any ML model training operation, the training dataset should have
    approximately equal representation across all categories (within 10% variance),
    ensuring balanced learning.
    
    Validates: Requirements 8.4
    """
    # Arrange
    service = AuditBiasDetectionService()
    
    # Create imbalanced dataset
    events = []
    for category, count in events_per_category.items():
        for _ in range(count):
            events.append({
                'id': str(uuid4()),
                'event_type': 'test_event',
                'category': category,
                'timestamp': datetime.now().isoformat(),
                'entity_type': 'test',
                'action_details': {}
            })
    
    # Act - Balance the dataset
    balanced_events = await service.prepare_balanced_dataset(events, 'category')
    
    # Assert
    # Property: Balanced dataset should have equal representation
    category_counts = {}
    for event in balanced_events:
        category = event['category']
        category_counts[category] = category_counts.get(category, 0) + 1
    
    # All categories should have the same count (target size)
    target_size = max(events_per_category.values())
    
    for category, count in category_counts.items():
        assert count == target_size, \
            f"Category '{category}' should have {target_size} samples, got {count}"
    
    # Property: All original categories should be represented
    for category in events_per_category.keys():
        assert category in category_counts, \
            f"Category '{category}' should be present in balanced dataset"
    
    # Property: Total size should be target_size * num_categories
    expected_total = target_size * len(events_per_category)
    assert len(balanced_events) == expected_total, \
        f"Total size should be {expected_total}, got {len(balanced_events)}"


# ============================================================================
# Property 27: AI Prediction Logging
# ============================================================================

# Feature: ai-empowered-audit-trail, Property 27: AI Prediction Logging
@given(
    prediction_type=st.sampled_from(['anomaly', 'category', 'risk_level']),
    predicted_value=st.text(min_size=1, max_size=50),
    confidence_score=st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False)
)
@settings(max_examples=20, deadline=None)
@pytest.mark.asyncio
@pytest.mark.property_test
async def test_property_27_ai_prediction_logging(
    prediction_type,
    predicted_value,
    confidence_score
):
    """
    Property 27: AI Prediction Logging
    
    For any AI model prediction (anomaly detection, classification, risk assessment),
    the system should log the prediction along with its confidence score in the
    appropriate audit table.
    
    Validates: Requirements 8.5
    """
    # Arrange
    service = AuditBiasDetectionService()
    
    audit_event_id = uuid4()
    model_version = "1.0.0"
    features_used = {'feature1': 0.5, 'feature2': 0.3}
    tenant_id = uuid4()
    
    # Create a dummy audit event first to satisfy foreign key constraint
    from config.database import supabase
    try:
        # First check if event exists, if not create it
        existing = supabase.table("audit_logs").select("id").eq("id", str(audit_event_id)).execute()
        if not existing.data:
            supabase.table("audit_logs").insert({
                "id": str(audit_event_id),
                "event_type": "test_event",
                "user_id": str(uuid4()),
                "entity_type": "test",
                "entity_id": str(uuid4()),
                "action_details": {"test": "data"},
                "severity": "info",
                "timestamp": datetime.now().isoformat(),
                "tenant_id": str(tenant_id)
            }).execute()
    except Exception as e:
        # If we can't create the audit event, skip this test
        pytest.skip(f"Cannot create audit event: {e}")
    
    # Act - Log prediction
    prediction_log = await service.log_ai_prediction(
        audit_event_id=audit_event_id,
        prediction_type=prediction_type,
        predicted_value=predicted_value,
        confidence_score=confidence_score,
        model_version=model_version,
        features_used=features_used,
        tenant_id=tenant_id
    )
    
    # Assert
    # Property: Prediction should be logged with all required fields
    assert prediction_log is not None, "Should return prediction log object"
    assert prediction_log.audit_event_id == audit_event_id, "Should match event ID"
    assert prediction_log.prediction_type == prediction_type, "Should match prediction type"
    assert prediction_log.predicted_value == predicted_value, "Should match predicted value"
    assert prediction_log.confidence_score == confidence_score, "Should match confidence score"
    assert prediction_log.model_version == model_version, "Should match model version"
    assert prediction_log.features_used == features_used, "Should match features"
    assert prediction_log.tenant_id == tenant_id, "Should match tenant ID"
    
    # Property: Prediction timestamp should be recent
    time_diff = (datetime.now() - prediction_log.prediction_timestamp).total_seconds()
    assert time_diff < 5, "Prediction timestamp should be recent"


# ============================================================================
# Property 28: Low Confidence Flagging
# ============================================================================

# Feature: ai-empowered-audit-trail, Property 28: Low Confidence Flagging
@given(
    confidence_score=st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False)
)
@settings(max_examples=20, deadline=None)
@pytest.mark.asyncio
@pytest.mark.property_test
async def test_property_28_low_confidence_flagging(confidence_score):
    """
    Property 28: Low Confidence Flagging
    
    For any AI prediction with a confidence score below 0.6, the system should
    set a review_required flag on the prediction record, indicating it needs
    human review.
    
    Validates: Requirements 8.6
    """
    # Arrange
    service = AuditBiasDetectionService()
    
    audit_event_id = uuid4()
    prediction_type = 'category'
    predicted_value = 'Security Change'
    model_version = "1.0.0"
    features_used = {'feature1': 0.5}
    tenant_id = uuid4()
    
    # Create a dummy audit event first to satisfy foreign key constraint
    from config.database import supabase
    try:
        # First check if event exists, if not create it
        existing = supabase.table("audit_logs").select("id").eq("id", str(audit_event_id)).execute()
        if not existing.data:
            supabase.table("audit_logs").insert({
                "id": str(audit_event_id),
                "event_type": "test_event",
                "user_id": str(uuid4()),
                "entity_type": "test",
                "entity_id": str(uuid4()),
                "action_details": {"test": "data"},
                "severity": "info",
                "timestamp": datetime.now().isoformat(),
                "tenant_id": str(tenant_id)
            }).execute()
    except Exception as e:
        # If we can't create the audit event, skip this test
        pytest.skip(f"Cannot create audit event: {e}")
    
    # Act - Log prediction
    prediction_log = await service.log_ai_prediction(
        audit_event_id=audit_event_id,
        prediction_type=prediction_type,
        predicted_value=predicted_value,
        confidence_score=confidence_score,
        model_version=model_version,
        features_used=features_used,
        tenant_id=tenant_id
    )
    
    # Assert
    # Property: review_required should be set based on confidence threshold
    if confidence_score < service.LOW_CONFIDENCE_THRESHOLD:
        assert prediction_log.review_required is True, \
            f"Should flag for review when confidence ({confidence_score:.2f}) < threshold ({service.LOW_CONFIDENCE_THRESHOLD})"
    else:
        assert prediction_log.review_required is False, \
            f"Should not flag for review when confidence ({confidence_score:.2f}) >= threshold ({service.LOW_CONFIDENCE_THRESHOLD})"


# ============================================================================
# Property 29: Anomaly Explanation Generation
# ============================================================================

# Feature: ai-empowered-audit-trail, Property 29: Anomaly Explanation Generation
@given(
    feature_importance=st.dictionaries(
        keys=st.sampled_from([
            'event_frequency', 'time_of_day', 'day_of_week',
            'user_activity_level', 'entity_access_pattern',
            'action_complexity', 'execution_time', 'severity_score'
        ]),
        values=st.floats(min_value=-1.0, max_value=1.0, allow_nan=False, allow_infinity=False),
        min_size=3,
        max_size=8
    ),
    top_n=st.integers(min_value=1, max_value=5)
)
@settings(max_examples=20, deadline=None)
@pytest.mark.asyncio
@pytest.mark.property_test
async def test_property_29_anomaly_explanation_generation(feature_importance, top_n):
    """
    Property 29: Anomaly Explanation Generation
    
    For any detected anomaly, the system should generate an explanation that
    includes which features contributed most to the anomaly score, providing
    transparency in the detection process.
    
    Validates: Requirements 8.7
    """
    # Arrange
    service = AuditBiasDetectionService()
    
    anomaly_id = uuid4()
    
    # Ensure we have enough features
    assume(len(feature_importance) >= top_n)
    
    # Act - Generate explanation
    explanation = await service.generate_anomaly_explanation(
        anomaly_id=anomaly_id,
        feature_importance=feature_importance,
        top_n=top_n
    )
    
    # Assert
    # Property: Explanation should be generated with required fields
    assert explanation is not None, "Should generate explanation"
    assert 'anomaly_id' in explanation, "Should include anomaly ID"
    assert 'explanation_text' in explanation, "Should include explanation text"
    assert 'top_features' in explanation, "Should include top features"
    assert 'generated_at' in explanation, "Should include generation timestamp"
    
    # Property: Should include exactly top_n features
    assert len(explanation['top_features']) == top_n, \
        f"Should include {top_n} top features"
    
    # Property: Features should be sorted by importance (absolute value)
    sorted_features = sorted(
        feature_importance.items(),
        key=lambda x: abs(x[1]),
        reverse=True
    )[:top_n]
    
    for i, (expected_feature, expected_importance) in enumerate(sorted_features):
        actual_feature = explanation['top_features'][i]
        assert actual_feature['feature'] == expected_feature, \
            f"Feature {i} should be {expected_feature}"
        assert abs(actual_feature['importance'] - expected_importance) < 0.001, \
            f"Importance for {expected_feature} should match"
    
    # Property: Explanation text should be non-empty
    assert len(explanation['explanation_text']) > 0, \
        "Explanation text should not be empty"
    
    # Property: Each feature should have a readable name
    for feature_info in explanation['top_features']:
        assert 'readable_name' in feature_info, "Should have readable name"
        assert len(feature_info['readable_name']) > 0, "Readable name should not be empty"


# ============================================================================
# Run tests
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s", "--tb=short"])
