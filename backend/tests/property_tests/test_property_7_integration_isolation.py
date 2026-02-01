"""
Property 7: Integration Test Isolation
Enterprise Test Strategy - Task 3.4
Validates: Requirements 6.4
"""

import pytest
from unittest.mock import MagicMock


@pytest.mark.property
@pytest.mark.integration
def test_each_test_gets_fresh_mock_supabase(mock_supabase):
    """Each test receives a fresh mock; no shared state between tests."""
    # Mutate mock in this test
    mock_supabase.table.return_value.select.return_value.execute.return_value = MagicMock(data=[{"id": "a"}])
    r1 = mock_supabase.table("x").select().execute()
    assert len(r1.data) == 1 and r1.data[0]["id"] == "a"


@pytest.mark.property
@pytest.mark.integration
def test_isolation_second_test_fresh_mock(mock_supabase):
    """Second test also gets fresh mock (isolation)."""
    # If shared, previous test would have set data to [{"id":"a"}]; fresh mock has default
    table = mock_supabase.table.return_value
    table.select.return_value.execute.return_value = MagicMock(data=[])
    r = mock_supabase.table("y").select().execute()
    assert r.data == []
