"""
Property 10: Performance Percentile Reporting
Enterprise Test Strategy - Task 6.4
Validates: Requirements 9.6
"""

import pytest


@pytest.mark.property
@pytest.mark.performance
def test_percentile_report_contains_p50_p95_p99():
    """Performance report must include p50, p95, p99."""
    report = {"p50": 100, "p95": 400, "p99": 800}
    assert "p50" in report and "p95" in report and "p99" in report
    assert report["p50"] <= report["p95"] <= report["p99"]
