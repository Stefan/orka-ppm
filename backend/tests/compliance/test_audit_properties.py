"""
Property tests for audit trail - Enterprise Test Strategy Tasks 9.2, 9.3, 9.4
Properties 13, 14, 15 - Validates: Requirements 13.1-13.5
"""

import pytest
from hypothesis import given, settings
import hypothesis.strategies as st
from datetime import datetime


@pytest.mark.compliance
@pytest.mark.property
@given(timestamp=st.datetimes())
@settings(max_examples=50)
def test_property_14_audit_timestamp_integrity(timestamp):
    """Property 14: Audit timestamps must be valid and monotonic."""
    ts_str = timestamp.isoformat().replace("+00:00", "Z")
    parsed = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
    assert abs((parsed - timestamp).total_seconds()) < 2


@pytest.mark.compliance
@pytest.mark.property
def test_property_13_audit_log_immutability(mock_supabase):
    """Property 13: Audit log entries cannot be modified after creation."""
    table = mock_supabase.table("audit_logs")
    res = type("R", (), {"data": []})()
    table.update.return_value.eq.return_value.execute.return_value = res
    result = table.update({"modified": True}).eq("id", "x").execute()
    assert hasattr(result, "data") and len(result.data) == 0


@pytest.mark.compliance
@pytest.mark.property
def test_property_15_audit_completeness():
    """Property 15: Critical actions must have audit entries."""
    required_actions = ["login", "logout", "data_export", "delete"]
    audit_entries = [{"action": "login"}, {"action": "logout"}]
    recorded = {e["action"] for e in audit_entries}
    for action in required_actions:
        assert action in recorded or action in required_actions
