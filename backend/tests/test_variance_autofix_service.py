"""
Unit tests for variance auto-fix suggestions (variance_anomaly_ai.get_auto_fix_suggestions).
Target: 80%+ coverage for variance-alerts-ai spec.
"""
import pytest
from services.variance_anomaly_ai import get_auto_fix_suggestions


def test_autofix_over_budget_returns_etc_and_accruals():
    suggestions = get_auto_fix_suggestions(
        alert_id="alert-1",
        project_id="proj-1",
        variance_percentage=12.0,
        variance_amount=30000.0,
        currency_code="USD",
    )
    assert len(suggestions) >= 1
    ids = [s["id"] for s in suggestions]
    assert any("etc" in i.lower() for i in ids) or any(s.get("metric") == "ETC" for s in suggestions)
    assert all("description" in s and "metric" in s and "impact" in s for s in suggestions)


def test_autofix_under_budget_returns_replan():
    suggestions = get_auto_fix_suggestions(
        alert_id="a2",
        project_id="p2",
        variance_percentage=-8.0,
        variance_amount=-15000.0,
        currency_code="EUR",
    )
    assert len(suggestions) >= 1
    assert any("Planned" in s.get("metric", "") or "scope" in s.get("description", "").lower() for s in suggestions)


def test_autofix_ids_are_unique_per_alert():
    suggestions = get_auto_fix_suggestions(
        alert_id="unique-alert-99",
        project_id="p99",
        variance_percentage=10.0,
        variance_amount=10000.0,
    )
    ids = [s["id"] for s in suggestions]
    assert len(ids) == len(set(ids))
    assert all("unique-alert-99" in i for i in ids)


def test_autofix_currency_in_description():
    suggestions = get_auto_fix_suggestions(
        alert_id="a3",
        project_id="p3",
        variance_percentage=15.0,
        variance_amount=25000.0,
        currency_code="GBP",
    )
    etc_sugg = next((s for s in suggestions if s.get("metric") == "ETC"), None)
    if etc_sugg:
        assert "GBP" in etc_sugg.get("description", "") or "GBP" in str(etc_sugg.get("unit", ""))


def test_autofix_details_optional():
    suggestions = get_auto_fix_suggestions(
        alert_id="a4",
        project_id="p4",
        variance_percentage=5.0,
        variance_amount=5000.0,
        details=None,
    )
    assert isinstance(suggestions, list)
    assert all("id" in s and "description" in s and "metric" in s for s in suggestions)
