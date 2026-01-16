"""
Property-Based Tests for Audit Event Filtering

Tests Properties 4 and 30 from the design document:
- Property 4: Filter Result Correctness
- Property 30: Tenant Isolation in Queries

Requirements: 2.5, 2.6, 2.7, 4.9, 4.10, 9.1, 9.2, 9.3
"""

import pytest
from hypothesis import given, strategies as st, settings, HealthCheck
from datetime import datetime, timedelta
from uuid import uuid4, UUID
from typing import List, Dict, Any
import asyncio

from config.database import supabase


# ============================================================================
# Test Data Generators
# ============================================================================

def generate_audit_event_dict(
    tenant_id: UUID,
    event_type: str = None,
    severity: str = None,
    category: str = None,
    risk_level: str = None,
    timestamp: datetime = None
) -> Dict[str, Any]:
    """Generate a test audit event dictionary."""
    return {
        "id": str(uuid4()),
        "event_type": event_type or "test_event",
        "user_id": None,  # Set to None to avoid foreign key constraint
        "entity_type": "project",
        "entity_id": None,  # Set to None to avoid foreign key constraint
        "action_details": {"action": "test"},
        "severity": severity or "info",
        "ip_address": "127.0.0.1",
        "user_agent": "test-agent",
        "project_id": None,  # Set to None to avoid foreign key constraint
        "performance_metrics": {},
        "timestamp": (timestamp or datetime.now()).isoformat(),
        "anomaly_score": 0.5,
        "is_anomaly": False,
        "category": category,
        "risk_level": risk_level,
        "tags": {},
        "ai_insights": {},
        "tenant_id": str(tenant_id),
        "hash": "test_hash",
        "previous_hash": "test_prev_hash"
    }


# ============================================================================
# Property Tests
# ============================================================================

# Feature: ai-empowered-audit-trail, Property 4: Filter Result Correctness
@pytest.mark.property_test
@pytest.mark.asyncio
@settings(
    max_examples=20,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
@given(
    filter_event_type=st.sampled_from(['user_login', 'budget_change', 'permission_change', 'resource_assignment']),
    filter_severity=st.sampled_from(['info', 'warning', 'error', 'critical']),
    filter_category=st.sampled_from(['Security Change', 'Financial Impact', 'Resource Allocation', 'Risk Event']),
    filter_risk_level=st.sampled_from(['Low', 'Medium', 'High', 'Critical']),
    num_matching_events=st.integers(min_value=1, max_value=10),
    num_non_matching_events=st.integers(min_value=1, max_value=10)
)
async def test_filter_result_correctness(
    filter_event_type: str,
    filter_severity: str,
    filter_category: str,
    filter_risk_level: str,
    num_matching_events: int,
    num_non_matching_events: int
):
    """
    Property: For any filter applied to audit events (date range, event type, 
    severity, category, risk level), all returned events should match the filter 
    criteria, and no events matching the criteria should be excluded from the results.
    
    Validates: Requirements 2.5, 2.6, 2.7, 4.9, 4.10
    """
    tenant_id = uuid4()
    test_events = []
    
    try:
        # Create matching events
        for _ in range(num_matching_events):
            event = generate_audit_event_dict(
                tenant_id=tenant_id,
                event_type=filter_event_type,
                severity=filter_severity,
                category=filter_category,
                risk_level=filter_risk_level
            )
            test_events.append(event)
        
        # Create non-matching events (different event_type)
        other_event_types = ['user_logout', 'data_export', 'report_generated']
        for _ in range(num_non_matching_events):
            event = generate_audit_event_dict(
                tenant_id=tenant_id,
                event_type=other_event_types[_ % len(other_event_types)],
                severity='info',
                category='Compliance Action',
                risk_level='Low'
            )
            test_events.append(event)
        
        # Insert test events
        if test_events:
            response = supabase.table("roche_audit_logs").insert(test_events).execute()
            assert response.data, "Failed to insert test events"
        
        # Query with filters
        query = supabase.table("roche_audit_logs").select("*")
        query = query.eq("tenant_id", str(tenant_id))
        query = query.eq("event_type", filter_event_type)
        query = query.eq("severity", filter_severity)
        query = query.eq("category", filter_category)
        query = query.eq("risk_level", filter_risk_level)
        
        result = query.execute()
        
        # Verify all results match filter criteria
        assert result.data is not None, "Query returned None"
        
        for event in result.data:
            assert event["event_type"] == filter_event_type, \
                f"Event type mismatch: expected {filter_event_type}, got {event['event_type']}"
            assert event["severity"] == filter_severity, \
                f"Severity mismatch: expected {filter_severity}, got {event['severity']}"
            assert event["category"] == filter_category, \
                f"Category mismatch: expected {filter_category}, got {event['category']}"
            assert event["risk_level"] == filter_risk_level, \
                f"Risk level mismatch: expected {filter_risk_level}, got {event['risk_level']}"
        
        # Verify no matching events were excluded
        assert len(result.data) == num_matching_events, \
            f"Expected {num_matching_events} matching events, got {len(result.data)}"
    
    finally:
        # Cleanup: delete test events
        if test_events:
            event_ids = [e["id"] for e in test_events]
            supabase.table("roche_audit_logs").delete().in_("id", event_ids).execute()


# Feature: ai-empowered-audit-trail, Property 30: Tenant Isolation in Queries
@pytest.mark.property_test
@pytest.mark.asyncio
@settings(
    max_examples=20,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
@given(
    num_tenant1_events=st.integers(min_value=1, max_value=10),
    num_tenant2_events=st.integers(min_value=1, max_value=10)
)
async def test_tenant_isolation_in_queries(
    num_tenant1_events: int,
    num_tenant2_events: int
):
    """
    Property: For any query for audit events, the system should automatically 
    filter results to include only events where tenant_id matches the requesting 
    user's tenant_id, preventing cross-tenant data access.
    
    Validates: Requirements 9.1, 9.2, 9.3
    """
    tenant1_id = uuid4()
    tenant2_id = uuid4()
    test_events = []
    
    try:
        # Create events for tenant 1
        for _ in range(num_tenant1_events):
            event = generate_audit_event_dict(tenant_id=tenant1_id)
            test_events.append(event)
        
        # Create events for tenant 2
        for _ in range(num_tenant2_events):
            event = generate_audit_event_dict(tenant_id=tenant2_id)
            test_events.append(event)
        
        # Insert all events
        if test_events:
            response = supabase.table("roche_audit_logs").insert(test_events).execute()
            assert response.data, "Failed to insert test events"
        
        # Query for tenant 1 events
        query1 = supabase.table("roche_audit_logs").select("*")
        query1 = query1.eq("tenant_id", str(tenant1_id))
        result1 = query1.execute()
        
        # Verify only tenant 1 events are returned
        assert result1.data is not None, "Query returned None for tenant 1"
        assert len(result1.data) == num_tenant1_events, \
            f"Expected {num_tenant1_events} events for tenant 1, got {len(result1.data)}"
        
        for event in result1.data:
            assert event["tenant_id"] == str(tenant1_id), \
                f"Cross-tenant data leak: found tenant {event['tenant_id']} in tenant 1 query"
        
        # Query for tenant 2 events
        query2 = supabase.table("roche_audit_logs").select("*")
        query2 = query2.eq("tenant_id", str(tenant2_id))
        result2 = query2.execute()
        
        # Verify only tenant 2 events are returned
        assert result2.data is not None, "Query returned None for tenant 2"
        assert len(result2.data) == num_tenant2_events, \
            f"Expected {num_tenant2_events} events for tenant 2, got {len(result2.data)}"
        
        for event in result2.data:
            assert event["tenant_id"] == str(tenant2_id), \
                f"Cross-tenant data leak: found tenant {event['tenant_id']} in tenant 2 query"
        
        # Verify no cross-tenant contamination
        tenant1_ids = {e["id"] for e in result1.data}
        tenant2_ids = {e["id"] for e in result2.data}
        assert tenant1_ids.isdisjoint(tenant2_ids), \
            "Cross-tenant data leak: same event IDs found in both tenant queries"
    
    finally:
        # Cleanup: delete test events
        if test_events:
            event_ids = [e["id"] for e in test_events]
            supabase.table("roche_audit_logs").delete().in_("id", event_ids).execute()


# Feature: ai-empowered-audit-trail, Property 4: Date Range Filter Correctness
@pytest.mark.property_test
@pytest.mark.asyncio
@settings(
    max_examples=20,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
@given(
    days_offset=st.integers(min_value=1, max_value=30),
    num_events_in_range=st.integers(min_value=1, max_value=10),
    num_events_out_of_range=st.integers(min_value=1, max_value=10)
)
async def test_date_range_filter_correctness(
    days_offset: int,
    num_events_in_range: int,
    num_events_out_of_range: int
):
    """
    Property: For any date range filter applied, all returned events should 
    have timestamps within the specified range.
    
    Validates: Requirements 2.5
    """
    from datetime import timezone
    
    tenant_id = uuid4()
    test_events = []
    
    # Define date range with timezone awareness
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=days_offset)
    
    try:
        # Create events within range
        for i in range(num_events_in_range):
            timestamp = start_date + timedelta(
                days=i * days_offset / num_events_in_range
            )
            event = generate_audit_event_dict(
                tenant_id=tenant_id,
                timestamp=timestamp
            )
            test_events.append(event)
        
        # Create events outside range (before start_date)
        for i in range(num_events_out_of_range):
            timestamp = start_date - timedelta(days=i + 1)
            event = generate_audit_event_dict(
                tenant_id=tenant_id,
                timestamp=timestamp
            )
            test_events.append(event)
        
        # Insert test events
        if test_events:
            response = supabase.table("roche_audit_logs").insert(test_events).execute()
            assert response.data, "Failed to insert test events"
        
        # Query with date range filter
        query = supabase.table("roche_audit_logs").select("*")
        query = query.eq("tenant_id", str(tenant_id))
        query = query.gte("timestamp", start_date.isoformat())
        query = query.lte("timestamp", end_date.isoformat())
        
        result = query.execute()
        
        # Verify all results are within date range
        assert result.data is not None, "Query returned None"
        
        for event in result.data:
            event_timestamp = datetime.fromisoformat(event["timestamp"].replace('Z', '+00:00'))
            assert start_date <= event_timestamp <= end_date, \
                f"Event timestamp {event_timestamp} is outside range [{start_date}, {end_date}]"
        
        # Verify correct count
        assert len(result.data) == num_events_in_range, \
            f"Expected {num_events_in_range} events in range, got {len(result.data)}"
    
    finally:
        # Cleanup: delete test events
        if test_events:
            event_ids = [e["id"] for e in test_events]
            supabase.table("roche_audit_logs").delete().in_("id", event_ids).execute()



# Feature: ai-empowered-audit-trail, Property 3: Chronological Event Ordering
@pytest.mark.property_test
@pytest.mark.asyncio
@settings(
    max_examples=20,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
@given(
    num_events=st.integers(min_value=2, max_value=20)
)
async def test_chronological_event_ordering(num_events: int):
    """
    Property: For any list of audit events displayed in the timeline, the events 
    should be ordered by timestamp in ascending order, such that for any two 
    consecutive events in the list, the first event's timestamp is less than or 
    equal to the second event's timestamp.
    
    Validates: Requirements 2.1
    """
    tenant_id = uuid4()
    test_events = []
    base_time = datetime.now() - timedelta(days=1)
    
    try:
        # Create events with incrementing timestamps
        for i in range(num_events):
            timestamp = base_time + timedelta(minutes=i * 10)
            event = generate_audit_event_dict(
                tenant_id=tenant_id,
                timestamp=timestamp
            )
            test_events.append(event)
        
        # Shuffle events before insertion to ensure ordering is done by query
        import random
        shuffled_events = test_events.copy()
        random.shuffle(shuffled_events)
        
        # Insert shuffled events
        if shuffled_events:
            response = supabase.table("roche_audit_logs").insert(shuffled_events).execute()
            assert response.data, "Failed to insert test events"
        
        # Query events ordered by timestamp (ascending)
        query = supabase.table("roche_audit_logs").select("*")
        query = query.eq("tenant_id", str(tenant_id))
        query = query.order("timestamp", desc=False)
        
        result = query.execute()
        
        # Verify chronological ordering
        assert result.data is not None, "Query returned None"
        assert len(result.data) == num_events, \
            f"Expected {num_events} events, got {len(result.data)}"
        
        # Check that each consecutive pair is in order
        for i in range(len(result.data) - 1):
            current_time = datetime.fromisoformat(result.data[i]["timestamp"].replace('Z', '+00:00'))
            next_time = datetime.fromisoformat(result.data[i + 1]["timestamp"].replace('Z', '+00:00'))
            
            assert current_time <= next_time, \
                f"Events not in chronological order: {current_time} > {next_time} at index {i}"
    
    finally:
        # Cleanup: delete test events
        if test_events:
            event_ids = [e["id"] for e in test_events]
            supabase.table("roche_audit_logs").delete().in_("id", event_ids).execute()
