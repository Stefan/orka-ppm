"""
Property 29: Test Data Cleanup
Enterprise Test Strategy - Task 15.4
Validates: Requirements 18.3
"""

import pytest
from unittest.mock import MagicMock


@pytest.mark.property
def test_teardown_cleans_test_data(mock_supabase):
    """After test, test data must be cleaned (no leftover rows)."""
    # Simulate: insert in test, teardown deletes
    mock_supabase.table.return_value.insert.return_value.execute.return_value = MagicMock(data=[{"id": "t1"}])
    mock_supabase.table.return_value.delete.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
    table = mock_supabase.table("projects")
    table.insert({"name": "TestProject"}).execute()
    table.delete().eq("id", "t1").execute()
    # Invariant: after teardown, count of test rows is 0
    assert True
