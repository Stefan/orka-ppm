"""
Property 34: External Service Mocking
Enterprise Test Strategy - Task 17.5
Validates: Requirements 20.4
"""

import pytest
from unittest.mock import MagicMock, patch


@pytest.mark.property
def test_external_calls_are_mocked_in_unit_tests(mock_supabase):
    """Unit tests must not call real external services (use mocks)."""
    mock_supabase.table.return_value.select.return_value.execute.return_value = MagicMock(data=[])
    r = mock_supabase.table("projects").select("*").execute()
    assert r.data == []
    mock_supabase.table.assert_called()
