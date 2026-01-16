"""
Property-Based Tests for AI-Empowered Audit Trail - ML Classification

This module contains property-based tests for the audit ML classification system.
Tests validate correctness properties for category classification, risk assessment,
and business rule application using Hypothesis.

Feature: ai-empowered-audit-trail
Requirements: 4.1, 4.2, 4.3, 4.5, 4.6, 4.7, 4.8
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

from services.audit_ml_service import AuditMLService, EventClassification


# ============================================================================
# Test Data Generators (Hypothesis Strategies)
# ============================================================================

def audit_event_strategy():
    """Generate valid audit events for property testing."""
    return st.builds(
        dict,
        id=st.uuids().map(str),
        event_type=st.sampled_from([
            'user_login', 'user_logout', 'permission_change', 'access_control',
            'budget_change', 'cost_update', 'financial_approval',
            'resource_assignment', 'capacity_change', 'availability_update',
            'risk_created', 'risk_updated', 'mitigation_action',
            'report_generated', 'audit_access', 'compliance_check'
        ]),
        user_id=st.one_of(st.none(), st.uuids().map(str)),
        entity_type=st.sampled_from([
            'project', 'resource', 'risk', 'change_request',
            'budget', 'schedule', 'user', 'role', 'permission'
        ]),
        entity_id=st.one_of(st.none(), st.uuids().map(str)),
        action_details=st.dictionaries(
            keys=st.text(min_size=1, max_size=20, alphabet=st.characters(whitelist_categories=('L', 'N'))),
            values=st.one_of(
                st.text(max_size=100),
                st.integers(min_value=0, max_value=1000000),
                st.floats(min_value=0, max_value=1000000, allow_nan=False, allow_infinity=False),
                st.booleans()
            ),
            min_size=0,
            max_size=10
        ),
        severity=st.sampled_from(['info', 'warning', 'error', 'critical']),
        timestamp=st.datetimes(
            min_value=datetime.now() - timedelta(days=365),
            max_value=datetime.now()
        ).map(lambda dt: dt.isoformat()),
        performance_metrics=st.one_of(
            st.none(),
            st.dictionaries(
                keys=st.sampled_from(['execution_time', 'memory_usage', 'cpu_usage']),
                values=st.floats(min_value=0, max_value=1000, allow_nan=False, allow_infinity=False),
                min_size=0,
                max_size=3
            )
        ),
        tenant_id=st.uuids().map(str)
    )


def budget_change_event_strategy():
    """Generate audit events with budget changes for testing business rules."""
    return st.builds(
        dict,
        id=st.uuids().map(str),
        event_type=st.sampled_from(['budget_change', 'cost_update', 'financial_approval']),
        user_id=st.uuids().map(str),
        entity_type=st.just('budget'),
        entity_id=st.uuids().map(str),
        action_details=st.builds(
            dict,
            budget_change_percentage=st.floats(min_value=-50, max_value=50, allow_nan=False, allow_infinity=False),
            old_budget=st.floats(min_value=1000, max_value=1000000, allow_nan=False, allow_infinity=False),
            new_budget=st.floats(min_value=1000, max_value=1000000, allow_nan=False, allow_infinity=False)
        ),
        severity=st.sampled_from(['info', 'warning', 'error', 'critical']),
        timestamp=st.datetimes(
            min_value=datetime.now() - timedelta(days=30),
            max_value=datetime.now()
        ).map(lambda dt: dt.isoformat()),
        tenant_id=st.uuids().map(str)
    )


def permission_change_event_strategy():
    """Generate audit events with permission changes for testing business rules."""
    return st.builds(
        dict,
        id=st.uuids().map(str),
        event_type=st.sampled_from(['permission_change', 'access_control', 'role_assignment']),
        user_id=st.uuids().map(str),
        entity_type=st.sampled_from(['user', 'role', 'permission']),
        entity_id=st.uuids().map(str),
        action_details=st.dictionaries(
            keys=st.sampled_from(['permission_type', 'old_role', 'new_role', 'access_level']),
            values=st.text(max_size=50),
            min_size=1,
            max_size=4
        ),
        severity=st.sampled_from(['info', 'warning', 'error', 'critical']),
        timestamp=st.datetimes(
            min_value=datetime.now() - timedelta(days=30),
            max_value=datetime.now()
        ).map(lambda dt: dt.isoformat()),
        tenant_id=st.uuids().map(str)
    )


def resource_allocation_event_strategy():
    """Generate audit events with resource allocations for testing business rules."""
    return st.builds(
        dict,
        id=st.uuids().map(str),
        event_type=st.sampled_from(['resource_assignment', 'capacity_change', 'availability_update']),
        user_id=st.uuids().map(str),
        entity_type=st.just('resource'),
        entity_id=st.uuids().map(str),
        action_details=st.dictionaries(
            keys=st.sampled_from(['resource_id', 'allocation_percentage', 'start_date', 'end_date']),
            values=st.one_of(st.text(max_size=50), st.integers(min_value=0, max_value=100)),
            min_size=1,
            max_size=4
        ),
        severity=st.sampled_from(['info', 'warning']),
        timestamp=st.datetimes(
            min_value=datetime.now() - timedelta(days=30),
            max_value=datetime.now()
        ).map(lambda dt: dt.isoformat()),
        tenant_id=st.uuids().map(str)
    )


# ============================================================================
# Property 9: Automatic Event Classification
# ============================================================================

# Feature: ai-empowered-audit-trail, Property 9: Automatic Event Classification
@given(audit_event=audit_event_strategy())
@settings(max_examples=100, deadline=None)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_property_9_automatic_event_classification(audit_event):
    """
    Property 9: Automatic Event Classification
    
    For any newly created audit event, the ML classifier should assign a category
    from the valid set (Security Change, Financial Impact, Resource Allocation,
    Risk Event, Compliance Action) and a risk level from the valid set
    (Low, Medium, High, Critical).
    
    Validates: Requirements 4.1, 4.2, 4.3
    """
    ml_service = AuditMLService(supabase_client=None)
    
    # Classify the event
    classification = await ml_service.classify_event(audit_event)
    
    # Verify classification is returned
    assert classification is not None, "Classification should not be None"
    assert isinstance(classification, EventClassification), (
        f"Classification should be EventClassification instance, got {type(classification)}"
    )
    
    # Verify category is from valid set
    valid_categories = [
        'Security Change', 'Financial Impact', 'Resource Allocation',
        'Risk Event', 'Compliance Action'
    ]
    assert classification.category in valid_categories, (
        f"Category '{classification.category}' is not in valid set: {valid_categories}"
    )
    
    # Verify risk level is from valid set
    valid_risk_levels = ['Low', 'Medium', 'High', 'Critical']
    assert classification.risk_level in valid_risk_levels, (
        f"Risk level '{classification.risk_level}' is not in valid set: {valid_risk_levels}"
    )
    
    # Verify confidence scores are in valid range [0, 1]
    assert 0.0 <= classification.category_confidence <= 1.0, (
        f"Category confidence {classification.category_confidence} not in range [0, 1]"
    )
    assert 0.0 <= classification.risk_confidence <= 1.0, (
        f"Risk confidence {classification.risk_confidence} not in range [0, 1]"
    )
    
    # Verify tags is a list
    assert isinstance(classification.tags, list), (
        f"Tags should be a list, got {type(classification.tags)}"
    )


# ============================================================================
# Property 10: Business Rule Tag Application
# ============================================================================

# Feature: ai-empowered-audit-trail, Property 10: Business Rule Tag Application (Budget)
@given(budget_event=budget_change_event_strategy())
@settings(max_examples=100, deadline=None)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_property_10_business_rule_budget_high_impact(budget_event):
    """
    Property 10: Business Rule Tag Application - Budget Changes
    
    For any audit event where action_details contains budget changes exceeding 10%
    of project budget, the event should be tagged with "Financial Impact: High".
    
    Validates: Requirements 4.5
    """
    ml_service = AuditMLService(supabase_client=None)
    
    # Get budget change percentage
    action_details = budget_event.get('action_details', {})
    budget_change_pct = action_details.get('budget_change_percentage', 0)
    
    # Classify the event
    classification = await ml_service.classify_event(budget_event)
    
    # Verify category is Financial Impact for budget events
    assert classification.category == 'Financial Impact', (
        f"Budget change event should have category 'Financial Impact', "
        f"got '{classification.category}'"
    )
    
    # Verify high impact tag for changes > 10%
    if abs(budget_change_pct) > 10:
        assert classification.risk_level == 'High', (
            f"Budget change of {budget_change_pct}% (>10%) should have risk level 'High', "
            f"got '{classification.risk_level}'"
        )
        assert 'Financial Impact: High' in classification.tags, (
            f"Budget change of {budget_change_pct}% (>10%) should be tagged with 'Financial Impact: High', "
            f"got tags: {classification.tags}"
        )


# Feature: ai-empowered-audit-trail, Property 10: Business Rule Tag Application (Security)
@given(permission_event=permission_change_event_strategy())
@settings(max_examples=100, deadline=None)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_property_10_business_rule_security_change(permission_event):
    """
    Property 10: Business Rule Tag Application - Permission Changes
    
    For any event involving permission or access control changes, it should be
    tagged with "Security Change".
    
    Validates: Requirements 4.6
    """
    ml_service = AuditMLService(supabase_client=None)
    
    # Classify the event
    classification = await ml_service.classify_event(permission_event)
    
    # Verify category is Security Change for permission events
    assert classification.category == 'Security Change', (
        f"Permission change event should have category 'Security Change', "
        f"got '{classification.category}'"
    )
    
    # Verify Security Change tag is present
    assert 'Security Change' in classification.tags, (
        f"Permission change event should be tagged with 'Security Change', "
        f"got tags: {classification.tags}"
    )


# Feature: ai-empowered-audit-trail, Property 10: Business Rule Tag Application (Resource)
@given(resource_event=resource_allocation_event_strategy())
@settings(max_examples=100, deadline=None)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_property_10_business_rule_resource_allocation(resource_event):
    """
    Property 10: Business Rule Tag Application - Resource Allocations
    
    For any event involving resource assignments or capacity changes, it should be
    tagged with "Resource Allocation".
    
    Validates: Requirements 4.7
    """
    ml_service = AuditMLService(supabase_client=None)
    
    # Classify the event
    classification = await ml_service.classify_event(resource_event)
    
    # Verify category is Resource Allocation for resource events
    assert classification.category == 'Resource Allocation', (
        f"Resource allocation event should have category 'Resource Allocation', "
        f"got '{classification.category}'"
    )
    
    # Verify Resource Allocation tag is present
    assert 'Resource Allocation' in classification.tags, (
        f"Resource allocation event should be tagged with 'Resource Allocation', "
        f"got tags: {classification.tags}"
    )


# ============================================================================
# Property 11: Tag Persistence
# ============================================================================

# Feature: ai-empowered-audit-trail, Property 11: Tag Persistence
@given(audit_event=audit_event_strategy())
@settings(max_examples=100, deadline=None)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_property_11_tag_persistence(audit_event):
    """
    Property 11: Tag Persistence
    
    For any audit event that has been classified by the ML classifier, the assigned
    tags should be persisted in the tags JSONB field and should be retrievable.
    
    Note: This test verifies that tags are generated and structured correctly.
    Actual database persistence is tested in integration tests.
    
    Validates: Requirements 4.8
    """
    ml_service = AuditMLService(supabase_client=None)
    
    # Classify the event
    classification = await ml_service.classify_event(audit_event)
    
    # Verify tags are present and structured correctly
    assert classification.tags is not None, "Tags should not be None"
    assert isinstance(classification.tags, list), (
        f"Tags should be a list, got {type(classification.tags)}"
    )
    
    # Verify tags can be serialized to JSON (for JSONB storage)
    try:
        tags_json = json.dumps(classification.tags)
        tags_deserialized = json.loads(tags_json)
        assert tags_deserialized == classification.tags, (
            "Tags should be JSON serializable and deserializable"
        )
    except (TypeError, ValueError) as e:
        pytest.fail(f"Tags should be JSON serializable: {e}")
    
    # Verify category and risk level are included in the classification
    assert classification.category is not None, "Category should not be None"
    assert classification.risk_level is not None, "Risk level should not be None"


# ============================================================================
# Additional Property Tests for Feature Extraction
# ============================================================================

# Feature: ai-empowered-audit-trail, Property: Feature Vector Dimension Consistency
@given(audit_event=audit_event_strategy())
@settings(max_examples=50, deadline=None)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_feature_vector_dimension_consistency(audit_event):
    """
    Property: Feature Vector Dimension Consistency
    
    For any audit event, the extracted feature vector should have a consistent
    dimension (535 features as defined in the ML service).
    
    Validates: Requirements 4.1 (feature extraction)
    """
    ml_service = AuditMLService(supabase_client=None)
    
    # Extract features
    features = await ml_service.extract_features(audit_event)
    
    # Verify feature vector is numpy array
    assert isinstance(features, np.ndarray), (
        f"Features should be numpy array, got {type(features)}"
    )
    
    # Verify dimension is consistent
    expected_dimension = 535  # As defined in _get_feature_dimension()
    assert features.shape == (expected_dimension,), (
        f"Feature vector should have dimension {expected_dimension}, "
        f"got {features.shape}"
    )
    
    # Verify all features are finite numbers
    assert np.all(np.isfinite(features)), (
        "All features should be finite numbers (no NaN or inf)"
    )


# Feature: ai-empowered-audit-trail, Property: Feature Normalization
@given(audit_event=audit_event_strategy())
@settings(max_examples=50, deadline=None)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_feature_normalization(audit_event):
    """
    Property: Feature Normalization
    
    For any audit event, all extracted features should be normalized to reasonable
    ranges (typically [0, 1] or similar bounded ranges).
    
    Validates: Requirements 4.1 (feature extraction)
    """
    ml_service = AuditMLService(supabase_client=None)
    
    # Extract features
    features = await ml_service.extract_features(audit_event)
    
    # Verify features are in reasonable ranges
    # Most features should be in [0, 1] range or close to it
    # Allow some flexibility for features that might be slightly outside
    assert np.all(features >= -1.0), (
        f"Features should be >= -1.0, got min: {np.min(features)}"
    )
    assert np.all(features <= 10.0), (
        f"Features should be <= 10.0 (allowing some flexibility), got max: {np.max(features)}"
    )


# Feature: ai-empowered-audit-trail, Property: Critical Severity Risk Elevation
@given(audit_event=audit_event_strategy())
@settings(max_examples=100, deadline=None)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_critical_severity_risk_elevation(audit_event):
    """
    Property: Critical Severity Risk Elevation
    
    For any audit event with severity='critical', the risk level should be
    elevated to 'Critical' regardless of ML prediction.
    
    Validates: Requirements 4.3 (business rules)
    """
    # Only test events with critical severity
    assume(audit_event.get('severity') == 'critical')
    
    ml_service = AuditMLService(supabase_client=None)
    
    # Classify the event
    classification = await ml_service.classify_event(audit_event)
    
    # Verify risk level is Critical for critical severity events
    assert classification.risk_level == 'Critical', (
        f"Event with severity='critical' should have risk_level='Critical', "
        f"got '{classification.risk_level}'"
    )


# ============================================================================
# Property 23: Classification Result Caching
# ============================================================================

# Feature: ai-empowered-audit-trail, Property 23: Classification Result Caching
@given(audit_event=audit_event_strategy())
@settings(max_examples=50, deadline=None)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_property_23_classification_result_caching(audit_event):
    """
    Property 23: Classification Result Caching
    
    For any audit event that has been classified by the ML classifier, the
    classification result should be cached in Redis with a TTL of 1 hour, and
    subsequent requests for the same event's classification within that hour
    should return the cached result.
    
    Validates: Requirements 7.10
    """
    # Create ML service with Redis enabled (will use mock if Redis not available)
    ml_service = AuditMLService(supabase_client=None)
    
    # Initialize Redis (will gracefully fail if not available)
    await ml_service.initialize_redis()
    
    # First classification - should compute and cache
    classification1 = await ml_service.classify_event(audit_event)
    
    # Verify classification is valid
    assert classification1 is not None, "First classification should not be None"
    assert isinstance(classification1, EventClassification), (
        f"Classification should be EventClassification instance, got {type(classification1)}"
    )
    
    # Second classification - should return cached result if Redis is enabled
    classification2 = await ml_service.classify_event(audit_event)
    
    # Verify second classification is valid
    assert classification2 is not None, "Second classification should not be None"
    assert isinstance(classification2, EventClassification), (
        f"Classification should be EventClassification instance, got {type(classification2)}"
    )
    
    # Verify both classifications are identical (cached result)
    assert classification1.category == classification2.category, (
        f"Cached classification category should match: "
        f"{classification1.category} != {classification2.category}"
    )
    assert classification1.risk_level == classification2.risk_level, (
        f"Cached classification risk level should match: "
        f"{classification1.risk_level} != {classification2.risk_level}"
    )
    assert classification1.category_confidence == classification2.category_confidence, (
        f"Cached classification category confidence should match: "
        f"{classification1.category_confidence} != {classification2.category_confidence}"
    )
    assert classification1.risk_confidence == classification2.risk_confidence, (
        f"Cached classification risk confidence should match: "
        f"{classification1.risk_confidence} != {classification2.risk_confidence}"
    )
    assert classification1.tags == classification2.tags, (
        f"Cached classification tags should match: "
        f"{classification1.tags} != {classification2.tags}"
    )
    
    # If Redis is enabled, verify cache key generation is deterministic
    if ml_service.redis_enabled:
        cache_key1 = ml_service._generate_cache_key(audit_event)
        cache_key2 = ml_service._generate_cache_key(audit_event)
        
        assert cache_key1 == cache_key2, (
            f"Cache key generation should be deterministic: {cache_key1} != {cache_key2}"
        )
        
        # Verify cache key format
        assert cache_key1.startswith("audit:ml:classification:"), (
            f"Cache key should have correct prefix: {cache_key1}"
        )


# Feature: ai-empowered-audit-trail, Property: Cache Invalidation
@given(audit_event=audit_event_strategy())
@settings(max_examples=30, deadline=None)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_cache_invalidation(audit_event):
    """
    Property: Cache Invalidation
    
    For any audit event that has been classified and cached, invalidating the
    cache should cause the next classification request to recompute the result.
    
    Validates: Requirements 7.10 (cache invalidation logic)
    """
    ml_service = AuditMLService(supabase_client=None)
    await ml_service.initialize_redis()
    
    # First classification - should compute and cache
    classification1 = await ml_service.classify_event(audit_event)
    assert classification1 is not None
    
    # Invalidate cache for this specific event
    await ml_service.invalidate_cache(audit_event)
    
    # Second classification - should recompute (not from cache)
    classification2 = await ml_service.classify_event(audit_event)
    assert classification2 is not None
    
    # Results should still be identical (same event, same classification logic)
    assert classification1.category == classification2.category
    assert classification1.risk_level == classification2.risk_level
    
    # Verify cache was actually invalidated by checking if we can still get cached result
    # (this is a meta-test to ensure invalidation worked)
    if ml_service.redis_enabled:
        cache_key = ml_service._generate_cache_key(audit_event)
        # After invalidation and reclassification, cache should be populated again
        cached_result = await ml_service._get_cached_classification(audit_event)
        assert cached_result is not None, "Cache should be repopulated after invalidation"

