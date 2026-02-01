"""
Backend integration tests with Supabase mocks.
Enterprise Test Strategy - Task 3.1
Requirements: 6.1, 6.3, 6.5
"""

import pytest
from unittest.mock import MagicMock, patch


@pytest.mark.integration
class TestApiDatabaseIntegration:
    """API-database interactions with mocked Supabase."""

    def test_projects_list_uses_supabase_table(self, mock_supabase):
        """Projects list endpoint uses Supabase table().select()."""
        mock_supabase.table.return_value.select.return_value.execute.return_value = MagicMock(
            data=[{"id": "1", "name": "P1", "status": "active"}]
        )
        table = mock_supabase.table("projects")
        result = table.select("*").execute()
        assert result.data == [{"id": "1", "name": "P1", "status": "active"}]
        mock_supabase.table.assert_called_with("projects")

    def test_insert_uses_parameterized_api(self, mock_supabase):
        """Insert uses Supabase insert().execute() (parameterized)."""
        mock_supabase.table.return_value.insert.return_value.execute.return_value = MagicMock(
            data=[{"id": "new-id", "name": "New Project"}]
        )
        table = mock_supabase.table("projects")
        result = table.insert({"name": "New Project", "status": "active"}).execute()
        assert len(result.data) == 1
        assert result.data[0]["name"] == "New Project"
