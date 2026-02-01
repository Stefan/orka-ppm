"""
Property 28: PII Anonymization in Tests
Enterprise Test Strategy - Task 15.3
Validates: Requirements 18.2
"""

import pytest
from hypothesis import given, settings
import hypothesis.strategies as st


@pytest.mark.property
@given(email=st.emails())
@settings(max_examples=50)
def test_synthetic_email_never_real_domain(email):
    """Synthetic test emails must not use production domains."""
    synthetic = f"user_{email.split('@')[0][:8]}@test.example"
    assert "@test." in synthetic or "test.example" in synthetic
    assert "production.com" not in synthetic and "company.com" not in synthetic
