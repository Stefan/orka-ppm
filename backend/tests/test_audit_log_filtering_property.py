"""
Property-Based Test: Audit Log Filtering

Feature: ai-empowered-ppm-features
Property 33: Audit Log Filtering

For any GET request to /audit/logs with filter parameters (date_range, user_id, action_type),
the system SHALL return only logs matching ALL specified filters AND filtered by organization_id.

Validates: Requirements 15.1
Task: 20.6
"""

import pytest
from hypothesis import given, strategies as st, settings
from datetime import datetime, timedelta
from uuid import uuid4
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch, MagicMock
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from main import app
from auth.dependencies import get_current_user


# Hypothesis strategies
@st.composite
def audit_log_strategy(draw):
    """Generate audit log data."""
    return {
        "id": str(uuid4()),
        "organization_id": str(draw(st.uuids())),
        "user_id": str(draw(st.uuids())),
        "action": draw(st.sampled_from(["create", "update", "delete", "read", "login", "logout"])),
        "entity_type": draw(st.sampled_from(["project", "resource", "user", "report"])),
        "entity_id": str(draw(st.uuids())),
        "details": {"test": "data"},
        "success": draw(st.booleans()),
        "created_at": draw(st.datetimes(
            min_value=datetime(2024, 1, 1),
            max_value=datetime(2024, 12, 31)
        )).isoformat(),
        "tags": {}
    }


@given(
    organization_id=st.uuids(),
    start_date=st.datetimes(min_value=datetime(2024, 1, 1), max_value=datetime(2024, 6, 30)),
    end_date=st.datetimes(min_value=datetime(2024, 7, 1), max_value=datetime(2024, 12, 31)),
    user_id=st.uuids(),
    action_type=st.sampled_from(["create", "update", "delete", "read"])
)
@settings(max_examples=50, deadline=None)
def test_audit_log_filtering_property(organization_id, start_date, end_date, user_id, action_type):
    """
    Feature: ai-empowered-ppm-features
    Property 33: Audit Log Filtering
    
    For any GET request to /audit/logs with filter parameters (date_range, user_id, action_type),
    the system SHALL return only logs matching ALL specified filters AND filtered by organization_id.
    
    Validates: Requirements 15.1
    """
    client = TestClient(app)
    
    # Create mock audit logs - some matching filters, some not
    matching_logs = []
    
    # Create 5 logs that match all filters
    for i in range(5):
        log = {
            "id": str(uuid4()),
            "organization_id": str(organization_id),
            "user_id": str(user_id),
            "action": action_type,
            "entity_type": "project",
            "entity_id": str(uuid4()),
            "details": {"index": i},
            "severity": "info",
            "success": True,
            "created_at": (start_date + timedelta(days=i+1)).isoformat(),
            "tags": {}
        }
        matching_logs.append(log)
    
    # Mock Supabase client
    mock_response = Mock()
    mock_response.data = matching_logs  # Only return matching logs
    
    mock_query = Mock()
    mock_query.select = Mock(return_value=mock_query)
    mock_query.eq = Mock(return_value=mock_query)
    mock_query.gte = Mock(return_value=mock_query)
    mock_query.lte = Mock(return_value=mock_query)
    mock_query.order = Mock(return_value=mock_query)
    mock_query.range = Mock(return_value=mock_query)
    mock_query.execute = Mock(return_value=mock_response)
    
    # Mock current user with organization_id
    mock_user = {
        "id": str(uuid4()),
        "user_id": str(uuid4()),
        "organization_id": str(organization_id),
        "email": "test@example.com"
    }
    
    # Use FastAPI dependency override for proper injection
    async def override_get_current_user():
        return mock_user
    
    app.dependency_overrides[get_current_user] = override_get_current_user
    
    try:
        with patch('routers.audit.supabase') as mock_supabase:
            mock_supabase.table = Mock(return_value=mock_query)
            
            # Make request with all filters
            response = client.get(
                "/api/audit/logs",
                params={
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat(),
                    "user_id": str(user_id),
                    "action_type": action_type,
                    "limit": 100,
                    "offset": 0
                }
            )
            
            # Assert response is successful
            assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
            
            data = response.json()
            
            # Property: All returned logs must match ALL filters
            returned_logs = data["events"]
            
            for log in returned_logs:
                # Check organization_id filter (tenant_id in response maps to organization_id)
                assert log["tenant_id"] == str(organization_id), \
                    "Log must belong to the requested organization"
                
                # Check user_id filter
                assert log["user_id"] == str(user_id), \
                    "Log must belong to the requested user"
                
                # Check action_type filter (event_type in response maps to action)
                assert log["event_type"] == action_type, \
                    "Log must have the requested action type"
            
            # Verify Supabase was called with organization filter
            mock_query.eq.assert_any_call("organization_id", str(organization_id))
    finally:
        # Clean up dependency overrides
        app.dependency_overrides.clear()


@given(
    organization_id=st.uuids(),
    other_organization_id=st.uuids()
)
@settings(max_examples=30, deadline=None)
def test_organization_isolation_property(organization_id, other_organization_id):
    """
    Property: Organization isolation must be enforced.
    
    Logs from other organizations must never be returned.
    """
    # Ensure organizations are different
    if organization_id == other_organization_id:
        return
    
    client = TestClient(app)
    
    # Create logs for the user's organization
    user_org_logs = [
        {
            "id": str(uuid4()),
            "organization_id": str(organization_id),
            "user_id": str(uuid4()),
            "action": "create",
            "entity_type": "project",
            "entity_id": str(uuid4()),
            "details": {},
            "severity": "info",
            "success": True,
            "created_at": datetime.now().isoformat(),
            "tags": {}
        }
        for _ in range(5)
    ]
    
    # Mock Supabase to return only user's org logs
    mock_response = Mock()
    mock_response.data = user_org_logs
    
    mock_query = Mock()
    mock_query.select = Mock(return_value=mock_query)
    mock_query.eq = Mock(return_value=mock_query)
    mock_query.gte = Mock(return_value=mock_query)
    mock_query.lte = Mock(return_value=mock_query)
    mock_query.order = Mock(return_value=mock_query)
    mock_query.range = Mock(return_value=mock_query)
    mock_query.execute = Mock(return_value=mock_response)
    
    # Mock current user with organization_id
    mock_user = {
        "id": str(uuid4()),
        "user_id": str(uuid4()),
        "organization_id": str(organization_id),
        "email": "test@example.com"
    }
    
    # Use FastAPI dependency override for proper injection
    async def override_get_current_user():
        return mock_user
    
    app.dependency_overrides[get_current_user] = override_get_current_user
    
    try:
        with patch('routers.audit.supabase') as mock_supabase:
            mock_supabase.table = Mock(return_value=mock_query)
            
            response = client.get("/api/audit/logs")
            
            assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
            
            data = response.json()
            returned_logs = data["events"]
            
            # Property: No logs from other organizations should be returned
            for log in returned_logs:
                assert log["tenant_id"] == str(organization_id), \
                    f"Log from organization {log['tenant_id']} leaked into results for organization {organization_id}"
            
            # Verify organization filter was applied
            mock_query.eq.assert_any_call("organization_id", str(organization_id))
    finally:
        # Clean up dependency overrides
        app.dependency_overrides.clear()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
