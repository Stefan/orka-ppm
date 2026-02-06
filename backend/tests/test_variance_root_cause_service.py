"""
Unit tests for variance root-cause suggestions (variance_anomaly_ai.get_root_cause_suggestions).
Target: 80%+ coverage for variance-alerts-ai spec.
"""
import pytest
from services.variance_anomaly_ai import get_root_cause_suggestions


def test_root_cause_over_budget_high_severity():
    causes = get_root_cause_suggestions(
        alert_id="alert-1",
        project_id="proj-1",
        variance_percentage=18.0,
        variance_amount=50000.0,
        severity="high",
    )
    assert len(causes) >= 1
    assert all("cause" in c and "confidence_pct" in c for c in causes)
    assert all(0 <= c["confidence_pct"] <= 100 for c in causes)
    texts = [c["cause"] for c in causes]
    assert any("Vendor" in t or "Accruals" in t or "Resource" in t for t in texts)


def test_root_cause_over_budget_critical():
    causes = get_root_cause_suggestions(
        alert_id="a2",
        project_id="p2",
        variance_percentage=25.0,
        variance_amount=100000.0,
        severity="critical",
    )
    assert len(causes) <= 3
    assert causes[0]["confidence_pct"] >= causes[-1]["confidence_pct"]


def test_root_cause_under_budget():
    causes = get_root_cause_suggestions(
        alert_id="a3",
        project_id="p3",
        variance_percentage=-10.0,
        variance_amount=-20000.0,
        severity="medium",
    )
    assert len(causes) >= 1
    assert any("Under-spend" in c["cause"] or "delayed" in c["cause"].lower() for c in causes)


def test_root_cause_empty_details():
    causes = get_root_cause_suggestions(
        alert_id="a4",
        project_id="p4",
        variance_percentage=5.0,
        variance_amount=5000.0,
        severity="low",
        details=None,
    )
    assert isinstance(causes, list)
    assert all(isinstance(c, dict) and "cause" in c and "confidence_pct" in c for c in causes)


def test_root_cause_returns_at_most_three():
    causes = get_root_cause_suggestions(
        alert_id="a5",
        project_id="p5",
        variance_percentage=20.0,
        variance_amount=99999.0,
        severity="critical",
    )
    assert len(causes) <= 3
