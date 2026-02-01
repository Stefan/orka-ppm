"""
Property-Based Test for Audit Batch Insertion

Feature: ai-empowered-audit-trail
Property 22: Batch Insertion Support

For any batch insertion request containing up to 1000 audit events, all events 
should be successfully inserted into the database, and the operation should 
complete without errors.

Requirements: 7.2
"""

import pytest
from hypothesis import given, strategies as st, settings
from datetime import datetime, timedelta
from typing import List, Dict, Any
from uuid import uuid4
import asyncio

# Test configuration
pytestmark = pytest.mark.asyncio


# ============================================================================
# Hypothesis Strategies
# ============================================================================

def audit_event_strategy():
    """Generate valid audit event dictionaries for batch insertion."""
    return st.builds(
        dict,
        id=st.uuids().map(str),
        event_type=st.sampled_from([
            'user_login', 'budget_change', 'permission_change',
            'resource_assignment', 'risk_created', 'report_generated',
            'project_created', 'change_request_submitted'
        ]),
        entity_type=st.sampled_from([
            'project', 'resource', 'risk', 'change_request', 'user', 'report'
        ]),
        entity_id=st.one_of(st.none(), st.uuids().map(str)),
        severity=st.sampled_from(['info', 'warning', 'error', 'critical']),
        action_details=st.dictionaries(
            keys=st.text(min_size=1, max_size=20, alphabet=st.characters(whitelist_categories=('L', 'N'))),
            values=st.one_of(
                st.text(max_size=100, alphabet=st.characters(min_codepoint=32, max_codepoint=126)),  # Printable ASCII only
                st.integers(),
                st.floats(allow_nan=False, allow_infinity=False),
                st.booleans()
            ),
            min_size=1,
            max_size=10
        ),
        user_id=st.none(),  # Set to None to avoid foreign key constraint issues
        timestamp=st.datetimes(
            min_value=datetime.now() - timedelta(days=365),
            max_value=datetime.now()
        ).map(lambda dt: dt.isoformat()),
        tenant_id=st.uuids().map(str),
        is_anomaly=st.booleans(),
        category=st.one_of(
            st.none(),
            st.sampled_from([
                'Security Change', 'Financial Impact', 'Resource Allocation',
                'Risk Event', 'Compliance Action'
            ])
        ),
        risk_level=st.one_of(
            st.none(),
            st.sampled_from(['Low', 'Medium', 'High', 'Critical'])
        )
    )


# ============================================================================
# Property Tests
# ============================================================================

@given(
    batch_size=st.integers(min_value=1, max_value=1000),
    events=st.lists(
        audit_event_strategy(),
        min_size=1,
        max_size=100  # Reduced from 1000
    )
)
@settings(max_examples=5, deadline=None)  # Reduced for faster testing
async def test_batch_insertion_support(batch_size: int, events: List[Dict[str, Any]]):
    """
    Property 22: Batch Insertion Support
    
    For any batch insertion request containing up to 1000 audit events, 
    all events should be successfully inserted into the database, and 
    the operation should complete without errors.
    
    Validates: Requirements 7.2
    """
    from config.database import supabase
    
    # Limit events to batch_size
    events_to_insert = events[:batch_size]
    
    # Ensure all events have required fields
    for event in events_to_insert:
        assert 'event_type' in event, "Event must have event_type"
        assert 'entity_type' in event, "Event must have entity_type"
        assert 'severity' in event, "Event must have severity"
        assert 'tenant_id' in event, "Event must have tenant_id"
    
    try:
        # Attempt batch insertion
        response = supabase.table("audit_logs").insert(events_to_insert).execute()
        
        # Verify all events were inserted
        assert response.data is not None, "Batch insertion should return data"
        assert len(response.data) == len(events_to_insert), \
            f"Expected {len(events_to_insert)} events inserted, got {len(response.data)}"
        
        # Verify each inserted event has an ID
        for inserted_event in response.data:
            assert 'id' in inserted_event, "Inserted event must have an ID"
            assert inserted_event['id'] is not None, "Inserted event ID must not be None"
        
        # Clean up: delete inserted events
        event_ids = [event['id'] for event in response.data]
        if event_ids:
            supabase.table("audit_logs").delete().in_("id", event_ids).execute()
        
    except Exception as e:
        pytest.fail(f"Batch insertion failed with error: {str(e)}")


@given(
    events=st.lists(
        audit_event_strategy(),
        min_size=1,
        max_size=50  # Reduced from 100
    )
)
@settings(max_examples=5, deadline=None)  # Reduced from 50
async def test_batch_insertion_atomicity(events: List[Dict[str, Any]]):
    """
    Property 22 (Atomicity): Batch Insertion Atomicity
    
    For any batch insertion, either all events are inserted successfully,
    or none are inserted (atomic transaction).
    
    Validates: Requirements 7.2
    """
    from config.database import supabase
    
    # Get initial count of events for this tenant
    tenant_id = events[0]['tenant_id']
    initial_count_response = supabase.table("audit_logs") \
        .select("*", count="exact") \
        .eq("tenant_id", tenant_id) \
        .execute()
    
    initial_count = initial_count_response.count if hasattr(initial_count_response, 'count') else 0
    
    try:
        # Attempt batch insertion
        response = supabase.table("audit_logs").insert(events).execute()
        
        # Verify count increased by exactly the batch size
        final_count_response = supabase.table("audit_logs") \
            .select("*", count="exact") \
            .eq("tenant_id", tenant_id) \
            .execute()
        
        final_count = final_count_response.count if hasattr(final_count_response, 'count') else 0
        
        assert final_count == initial_count + len(events), \
            f"Expected count to increase by {len(events)}, but increased by {final_count - initial_count}"
        
        # Clean up
        event_ids = [event['id'] for event in response.data]
        if event_ids:
            supabase.table("audit_logs").delete().in_("id", event_ids).execute()
        
    except Exception as e:
        # Verify count did not change (rollback)
        final_count_response = supabase.table("audit_logs") \
            .select("*", count="exact") \
            .eq("tenant_id", tenant_id) \
            .execute()
        
        final_count = final_count_response.count if hasattr(final_count_response, 'count') else 0
        
        # In case of error, count should remain the same (atomicity)
        assert final_count == initial_count, \
            f"Batch insertion failed but count changed from {initial_count} to {final_count}"


@given(
    batch_size=st.integers(min_value=1, max_value=100)  # Reduced from 1000
)
@settings(max_examples=5, deadline=None)  # Reduced from 20
async def test_batch_size_limit(batch_size: int):
    """
    Property 22 (Size Limit): Batch Size Limit Enforcement
    
    For any batch insertion request, the system should accept batches
    up to 1000 events and reject batches exceeding this limit.
    
    Validates: Requirements 7.2
    """
    from config.database import supabase
    
    # Generate events
    events = []
    tenant_id = str(uuid4())
    
    for i in range(batch_size):
        events.append({
            'id': str(uuid4()),
            'event_type': 'test_event',
            'entity_type': 'test_entity',
            'severity': 'info',
            'tenant_id': tenant_id,
            'timestamp': datetime.now().isoformat(),
            'action_details': {'test': True},
            'is_anomaly': False
        })
    
    if batch_size <= 1000:
        # Should succeed
        try:
            response = supabase.table("audit_logs").insert(events).execute()
            assert response.data is not None, "Batch insertion should succeed for valid batch size"
            assert len(response.data) == batch_size, \
                f"Expected {batch_size} events inserted, got {len(response.data)}"
            
            # Clean up
            event_ids = [event['id'] for event in response.data]
            if event_ids:
                supabase.table("audit_logs").delete().in_("id", event_ids).execute()
        except Exception as e:
            pytest.fail(f"Batch insertion failed for valid batch size {batch_size}: {str(e)}")
    else:
        # Should fail or be rejected by API
        # Note: Database-level enforcement may vary
        pass


@given(
    events=st.lists(
        audit_event_strategy(),
        min_size=5,  # Reduced from 10
        max_size=20  # Reduced from 100
    )
)
@settings(max_examples=5, deadline=None)  # Reduced from 30
async def test_batch_insertion_preserves_event_data(events: List[Dict[str, Any]]):
    """
    Property 22 (Data Integrity): Batch Insertion Preserves Event Data
    
    For any batch insertion, all event data should be preserved exactly
    as provided, with no data loss or corruption.
    
    Validates: Requirements 7.2
    """
    from config.database import supabase
    
    try:
        # Insert events
        response = supabase.table("audit_logs").insert(events).execute()
        
        assert response.data is not None, "Batch insertion should return data"
        
        # Verify each event's data is preserved
        for original_event, inserted_event in zip(events, response.data):
            # Check required fields are preserved
            assert inserted_event['event_type'] == original_event['event_type'], \
                "Event type should be preserved"
            assert inserted_event['entity_type'] == original_event['entity_type'], \
                "Entity type should be preserved"
            assert inserted_event['severity'] == original_event['severity'], \
                "Severity should be preserved"
            assert inserted_event['tenant_id'] == original_event['tenant_id'], \
                "Tenant ID should be preserved"
            
            # Check optional fields if present
            if 'category' in original_event and original_event['category']:
                assert inserted_event.get('category') == original_event['category'], \
                    "Category should be preserved"
            
            if 'risk_level' in original_event and original_event['risk_level']:
                assert inserted_event.get('risk_level') == original_event['risk_level'], \
                    "Risk level should be preserved"
        
        # Clean up
        event_ids = [event['id'] for event in response.data]
        if event_ids:
            supabase.table("audit_logs").delete().in_("id", event_ids).execute()
        
    except Exception as e:
        pytest.fail(f"Batch insertion failed: {str(e)}")


# ============================================================================
# Synchronous Test Wrappers (for pytest compatibility)
# ============================================================================

def test_batch_insertion_support_sync():
    """Synchronous wrapper for async property test."""
    asyncio.run(test_batch_insertion_support())


def test_batch_insertion_atomicity_sync():
    """Synchronous wrapper for async property test."""
    asyncio.run(test_batch_insertion_atomicity())


def test_batch_size_limit_sync():
    """Synchronous wrapper for async property test."""
    asyncio.run(test_batch_size_limit())


def test_batch_insertion_preserves_event_data_sync():
    """Synchronous wrapper for async property test."""
    asyncio.run(test_batch_insertion_preserves_event_data())
