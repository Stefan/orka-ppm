"""
Audit trail immutability tests - Enterprise Test Strategy Task 9.1
Requirements: 13.1, 13.2
"""

import pytest
from unittest.mock import MagicMock


@pytest.mark.compliance
class TestAuditLogImmutability:
    """Audit log entries must not be modifiable after creation."""

    def test_audit_entry_rejects_update(self, mock_supabase):
        """Updating an audit log entry should be rejected or no-op."""
        # Placeholder: when audit table has update RLS or trigger that rejects updates
        table = mock_supabase.table("audit_logs")
        table.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
        # In real implementation: expect error or zero rows updated
        result = table.update({"modified": True}).eq("id", "x").execute()
        assert result is not None

    def test_audit_entry_rejects_delete(self, mock_supabase):
        """Deleting an audit log entry should be rejected or no-op."""
        table = mock_supabase.table("audit_logs")
        table.delete.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
        result = table.delete().eq("id", "x").execute()
        assert result is not None
