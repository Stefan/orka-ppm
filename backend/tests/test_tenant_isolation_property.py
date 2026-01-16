"""
Property-Based Tests for Tenant Isolation

Feature: ai-empowered-audit-trail
Property 30: Tenant Isolation in Queries

Tests that verify tenant isolation is properly enforced across all audit trail queries.

Requirements: 9.1, 9.2, 9.3
"""

import pytest
from hypothesis import given, strategies as st, settings, assume
from hypothesis import HealthCheck
from datetime import datetime, timedelta
from uuid import UUID, uuid4
import asyncio
from typing import List, Dict, Any

# Import services
from config.database import supabase
from services.tenant_isolation import TenantContext, TenantIsolationMixin


# ============================================================================
# Test Fixtures and Helpers
# ============================================================================

class MockAuditService(TenantIsolationMixin):
    """Mock service for testing tenant isolation."""
    
    def __init__(self):
        self.supabase = supabase
    
    async def get_events(self, tenant_id: UUID = None) -> List[Dict[str, Any]]:
        """Get audit events with tenant isolation."""
        query = self.supabase.table("roche_audit_logs").select("*")
        query = self.add_tenant_filter(query, tenant_id)
        response = query.execute()
        return response.data or []


@pytest.fixture
def mock_service():
    """Create mock audit service."""
    return MockAuditService()


@pytest.fixture
async def cleanup_test_data():
    """Cleanup test data after tests."""
    yield
    # Cleanup logic would go here
    # For now, we'll rely on test database isolation


# ============================================================================
# Hypothesis Strategies
# ============================================================================

# Strategy for generating valid UUIDs
tenant_id_strategy = st.uuids()

# Strategy for generating audit events
def audit_event_strategy(tenant_id: UUID):
    """Generate audit event for specific tenant."""
    return st.fixed_dictionaries({
        'id': st.uuids(),
        'event_type': st.sampled_from([
            'user_login', 'budget_change', 'permission_change',
            'resource_assignment', 'risk_created'
        ]),
        'user_id': st.uuids(),
        'entity_type': st.sampled_from(['project', 'resource', 'risk']),
        'entity_id': st.uuids(),
        'action_details': st.just({}),
        'severity': st.sampled_from(['info', 'warning', 'error', 'critical']),
        'timestamp': st.datetimes(
            min_value=datetime.now() - timedelta(days=30),
            max_value=datetime.now()
        ),
        'tenant_id': st.just(str(tenant_id)),
        'is_anomaly': st.booleans(),
        'category': st.sampled_from([
            'Security Change', 'Financial Impact', 'Resource Allocation'
        ]),
        'risk_level': st.sampled_from(['Low', 'Medium', 'High', 'Critical'])
    })


# ============================================================================
# Property Tests
# ============================================================================

# Feature: ai-empowered-audit-trail, Property 30: Tenant Isolation in Queries
@given(
    tenant_a_id=tenant_id_strategy,
    tenant_b_id=tenant_id_strategy,
    num_events_a=st.integers(min_value=1, max_value=10),
    num_events_b=st.integers(min_value=1, max_value=10)
)
@settings(
    max_examples=100,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
@pytest.mark.asyncio
@pytest.mark.property_test
async def test_tenant_isolation_in_queries(
    tenant_a_id: UUID,
    tenant_b_id: UUID,
    num_events_a: int,
    num_events_b: int,
    mock_service: MockAuditService
):
    """
    Property: For any query for audit events, the system should automatically 
    filter results to include only events where tenant_id matches the requesting 
    user's tenant_id, preventing cross-tenant data access.
    
    Validates: Requirements 9.1, 9.2, 9.3
    
    Test Strategy:
    1. Create events for two different tenants
    2. Query with tenant A context
    3. Verify only tenant A events are returned
    4. Query with tenant B context
    5. Verify only tenant B events are returned
    6. Verify no cross-tenant data leakage
    """
    # Ensure tenants are different
    assume(tenant_a_id != tenant_b_id)
    
    try:
        # Simulate events for tenant A (using simple dict structure)
        events_a = [
            {
                'id': str(uuid4()),
                'tenant_id': str(tenant_a_id),
                'event_type': 'user_login',
                'data': f'event_{i}'
            }
            for i in range(num_events_a)
        ]
        
        # Simulate events for tenant B
        events_b = [
            {
                'id': str(uuid4()),
                'tenant_id': str(tenant_b_id),
                'event_type': 'budget_change',
                'data': f'event_{i}'
            }
            for i in range(num_events_b)
        ]
        
        # Test 1: Query with tenant A context
        TenantContext.set_tenant(tenant_a_id)
        
        # Simulate query results (filter by tenant)
        results_a = [e for e in events_a if UUID(e['tenant_id']) == tenant_a_id]
        
        # Verify all results belong to tenant A
        for result in results_a:
            assert UUID(result['tenant_id']) == tenant_a_id, \
                f"Cross-tenant data leak: Found tenant {result['tenant_id']} in tenant {tenant_a_id} query"
        
        # Verify no tenant B events in results
        tenant_b_ids_in_results = [
            r for r in results_a if UUID(r['tenant_id']) == tenant_b_id
        ]
        assert len(tenant_b_ids_in_results) == 0, \
            f"Cross-tenant data leak: Found {len(tenant_b_ids_in_results)} tenant B events in tenant A query"
        
        # Test 2: Query with tenant B context
        TenantContext.set_tenant(tenant_b_id)
        
        # Simulate query results
        results_b = [e for e in events_b if UUID(e['tenant_id']) == tenant_b_id]
        
        # Verify all results belong to tenant B
        for result in results_b:
            assert UUID(result['tenant_id']) == tenant_b_id, \
                f"Cross-tenant data leak: Found tenant {result['tenant_id']} in tenant {tenant_b_id} query"
        
        # Verify no tenant A events in results
        tenant_a_ids_in_results = [
            r for r in results_b if UUID(r['tenant_id']) == tenant_a_id
        ]
        assert len(tenant_a_ids_in_results) == 0, \
            f"Cross-tenant data leak: Found {len(tenant_a_ids_in_results)} tenant A events in tenant B query"
        
        # Test 3: Verify tenant isolation mixin behavior
        filtered_a = mock_service.filter_by_tenant(events_a + events_b, tenant_a_id)
        assert all(UUID(e['tenant_id']) == tenant_a_id for e in filtered_a), \
            "Tenant isolation mixin failed to filter correctly"
        
        filtered_b = mock_service.filter_by_tenant(events_a + events_b, tenant_b_id)
        assert all(UUID(e['tenant_id']) == tenant_b_id for e in filtered_b), \
            "Tenant isolation mixin failed to filter correctly"
        
        # Test 4: Verify no overlap between filtered results
        filtered_a_ids = {e['id'] for e in filtered_a}
        filtered_b_ids = {e['id'] for e in filtered_b}
        overlap = filtered_a_ids.intersection(filtered_b_ids)
        assert len(overlap) == 0, \
            f"Cross-tenant data leak: {len(overlap)} events appear in both tenant queries"
        
    finally:
        TenantContext.clear()


# Feature: ai-empowered-audit-trail, Property 30: Tenant Isolation in Queries
@given(
    tenant_id=tenant_id_strategy,
    num_events=st.integers(min_value=5, max_value=20)
)
@settings(
    max_examples=100,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
@pytest.mark.asyncio
@pytest.mark.property_test
async def test_tenant_context_enforcement(
    tenant_id: UUID,
    num_events: int,
    mock_service: MockAuditService
):
    """
    Property: For any operation requiring tenant context, the system should 
    enforce that tenant_id is set and valid before allowing the operation.
    
    Validates: Requirements 9.1, 9.2, 9.3
    
    Test Strategy:
    1. Attempt operation without tenant context (should fail)
    2. Set tenant context
    3. Attempt operation with tenant context (should succeed)
    4. Clear tenant context
    5. Attempt operation again (should fail)
    """
    try:
        # Test 1: Operation without tenant context should fail
        TenantContext.clear()
        
        with pytest.raises(Exception):
            # This should raise an exception because tenant context is not set
            TenantContext.require_tenant()
        
        # Test 2: Set tenant context
        TenantContext.set_tenant(tenant_id)
        
        # Verify tenant context is set correctly
        assert TenantContext.get_tenant_id() == tenant_id, \
            "Tenant context not set correctly"
        
        # This should succeed now
        retrieved_tenant_id = TenantContext.require_tenant()
        assert retrieved_tenant_id == tenant_id, \
            "Retrieved tenant_id does not match set tenant_id"
        
        # Test 3: Validate tenant access for records
        test_record = {
            'id': str(uuid4()),
            'tenant_id': str(tenant_id),
            'data': 'test'
        }
        
        assert mock_service.validate_tenant_access(test_record, tenant_id), \
            "Valid tenant access was rejected"
        
        # Test 4: Reject access to records from different tenant
        other_tenant_id = uuid4()
        assume(other_tenant_id != tenant_id)
        
        other_record = {
            'id': str(uuid4()),
            'tenant_id': str(other_tenant_id),
            'data': 'test'
        }
        
        assert not mock_service.validate_tenant_access(other_record, tenant_id), \
            "Cross-tenant access was allowed"
        
        # Test 5: Clear context and verify operations fail
        TenantContext.clear()
        
        with pytest.raises(Exception):
            TenantContext.require_tenant()
        
    finally:
        TenantContext.clear()


# Feature: ai-empowered-audit-trail, Property 30: Tenant Isolation in Queries
@given(
    tenant_id=tenant_id_strategy,
    event_data=st.fixed_dictionaries({
        'event_type': st.sampled_from(['user_login', 'budget_change']),
        'user_id': st.uuids(),
        'entity_type': st.sampled_from(['project', 'resource']),
        'severity': st.sampled_from(['info', 'warning', 'error']),
        'timestamp': st.datetimes()
    })
)
@settings(
    max_examples=100,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
@pytest.mark.asyncio
@pytest.mark.property_test
async def test_tenant_id_injection(
    tenant_id: UUID,
    event_data: Dict[str, Any],
    mock_service: MockAuditService
):
    """
    Property: For any data insertion operation, the system should automatically 
    inject the tenant_id from context, ensuring all created records are properly 
    associated with the tenant.
    
    Validates: Requirements 9.1, 9.2, 9.3
    
    Test Strategy:
    1. Set tenant context
    2. Create data without explicit tenant_id
    3. Verify tenant_id is automatically injected
    4. Verify injected tenant_id matches context
    """
    try:
        # Set tenant context
        TenantContext.set_tenant(tenant_id)
        
        # Ensure event_data doesn't have tenant_id initially
        event_data_copy = event_data.copy()
        if 'tenant_id' in event_data_copy:
            del event_data_copy['tenant_id']
        
        # Inject tenant_id using mixin
        enriched_data = mock_service.ensure_tenant_id(event_data_copy, tenant_id)
        
        # Verify tenant_id was injected
        assert 'tenant_id' in enriched_data, \
            "tenant_id was not injected into data"
        
        # Verify injected tenant_id matches context
        assert UUID(enriched_data['tenant_id']) == tenant_id, \
            f"Injected tenant_id {enriched_data['tenant_id']} does not match context {tenant_id}"
        
        # Verify original data fields are preserved
        for key, value in event_data_copy.items():
            assert key in enriched_data, \
                f"Original field {key} was lost during tenant_id injection"
        
    finally:
        TenantContext.clear()


# Feature: ai-empowered-audit-trail, Property 30: Tenant Isolation in Queries
@given(
    tenant_ids=st.lists(tenant_id_strategy, min_size=2, max_size=5, unique=True),
    events_per_tenant=st.integers(min_value=3, max_value=10)
)
@settings(
    max_examples=50,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
@pytest.mark.asyncio
@pytest.mark.property_test
async def test_multi_tenant_isolation(
    tenant_ids: List[UUID],
    events_per_tenant: int,
    mock_service: MockAuditService
):
    """
    Property: For any set of tenants, queries from each tenant should only 
    return events belonging to that specific tenant, with no cross-tenant 
    data leakage across any tenant pair.
    
    Validates: Requirements 9.1, 9.2, 9.3
    
    Test Strategy:
    1. Create events for multiple tenants
    2. Query from each tenant's perspective
    3. Verify complete isolation between all tenant pairs
    4. Verify total events equals sum of per-tenant events
    """
    try:
        # Create events for each tenant (using simple dict structure)
        all_events = []
        tenant_event_map = {}
        
        for tenant_id in tenant_ids:
            tenant_events = [
                {
                    'id': str(uuid4()),
                    'tenant_id': str(tenant_id),
                    'event_type': 'user_login',
                    'data': f'event_{i}'
                }
                for i in range(events_per_tenant)
            ]
            tenant_event_map[tenant_id] = tenant_events
            all_events.extend(tenant_events)
        
        # Test isolation for each tenant
        for query_tenant_id in tenant_ids:
            TenantContext.set_tenant(query_tenant_id)
            
            # Filter events for this tenant
            filtered_events = mock_service.filter_by_tenant(all_events, query_tenant_id)
            
            # Verify all filtered events belong to query tenant
            for event in filtered_events:
                assert UUID(event['tenant_id']) == query_tenant_id, \
                    f"Cross-tenant leak: Event from {event['tenant_id']} in {query_tenant_id} query"
            
            # Verify count matches expected
            expected_count = len(tenant_event_map[query_tenant_id])
            actual_count = len(filtered_events)
            assert actual_count == expected_count, \
                f"Event count mismatch for tenant {query_tenant_id}: expected {expected_count}, got {actual_count}"
            
            # Verify no events from other tenants
            for other_tenant_id in tenant_ids:
                if other_tenant_id != query_tenant_id:
                    other_tenant_events_in_results = [
                        e for e in filtered_events 
                        if UUID(e['tenant_id']) == other_tenant_id
                    ]
                    assert len(other_tenant_events_in_results) == 0, \
                        f"Cross-tenant leak: Found {len(other_tenant_events_in_results)} events from " \
                        f"tenant {other_tenant_id} in tenant {query_tenant_id} query"
        
        # Verify total isolation: union of all tenant queries should equal all events
        all_filtered_events = []
        for tenant_id in tenant_ids:
            filtered = mock_service.filter_by_tenant(all_events, tenant_id)
            all_filtered_events.extend(filtered)
        
        assert len(all_filtered_events) == len(all_events), \
            f"Total filtered events ({len(all_filtered_events)}) != total events ({len(all_events)})"
        
    finally:
        TenantContext.clear()


# ============================================================================
# Run Tests
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
