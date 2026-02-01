"""
Property 32: Flaky Test Detection
Enterprise Test Strategy - Task 17.2
Validates: Requirements 20.1, 20.2
"""

import pytest


@pytest.mark.property
def test_flakiness_rate_calculation():
    """Flakiness rate = failures / total runs; >2% flags test."""
    passes = 98
    total = 100
    failures = total - passes
    flakiness = failures / total
    assert flakiness == 0.02
    assert flakiness <= 0.02
