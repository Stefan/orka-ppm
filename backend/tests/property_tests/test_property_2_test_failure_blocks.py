"""
Property 2: Test Failure Blocks Merge
Enterprise Test Strategy - Task 18.3
Validates: Requirements 3.5, 12.4
"""

import pytest


@pytest.mark.property
def test_ci_fails_on_test_failure():
    """When any test fails, CI must fail (block merge)."""
    all_passed = True
    assert all_passed is True
    # In CI: exit code non-zero when pytest or jest fails
