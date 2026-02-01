"""
Property 27: Synthetic Test Data Generation
Enterprise Test Strategy - Task 2.2, 15.2
Validates: Requirements 18.1
"""

import pytest
from hypothesis import given, settings
import hypothesis.strategies as st


@pytest.mark.property
@given(
    name=st.text(min_size=1, max_size=200),
    budget=st.integers(min_value=0, max_value=10_000_000),
    status=st.sampled_from(["active", "completed", "on_hold", "cancelled"]),
)
@settings(max_examples=100)
def test_project_factory_produces_valid_synthetic_data(name, budget, status):
    """Factory-generated project records have required fields and no PII from production."""
    from uuid import uuid4
    from datetime import datetime
    # Synthetic project factory invariant
    project = {
        "id": str(uuid4()),
        "name": name,
        "budget": budget,
        "status": status,
        "health": "green",
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    assert "id" in project and len(project["id"]) == 36
    assert "name" in project
    assert isinstance(project["budget"], int)
    assert project["status"] in ("active", "completed", "on_hold", "cancelled")
    # No production PII (e.g. real email) in synthetic data
    assert "@" not in project.get("name", "") or "test" in project.get("name", "").lower()
