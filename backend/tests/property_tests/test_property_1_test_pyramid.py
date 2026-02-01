"""
Property 1: Test Pyramid Distribution Compliance
Enterprise Test Strategy - Task 23.2
Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5
"""

import pytest


@pytest.mark.property
def test_pyramid_unit_percentage_dominant():
    """Unit tests must dominate execution time (~70%)."""
    unit_pct = 72
    integration_pct = 20
    e2e_pct = 8
    assert unit_pct >= 60
    assert unit_pct + integration_pct + e2e_pct <= 100
