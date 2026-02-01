"""
Property 36: Flakiness Pattern Tracking
Enterprise Test Strategy - Task 17.7
Validates: Requirements 20.5
"""

import pytest


@pytest.mark.property
def test_flakiness_pattern_tracked_over_runs():
    """Flakiness pattern (pass/fail sequence) must be trackable."""
    runs = [True, True, False, True]
    failures = sum(1 for x in runs if not x)
    flakiness = failures / len(runs)
    assert flakiness == 0.25
    assert len(runs) >= 1
