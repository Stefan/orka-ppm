"""
Unit tests for programs router: _program_aggregates and alert_count.
Spec: programs Task 4.1 – program alerts (e.g. budget overrun).
"""

import pytest
from unittest.mock import MagicMock

# Import the internal helper from the router (test implementation detail)
from routers.programs import _program_aggregates


def test_program_aggregates_alert_count_zero_when_under_budget():
    """When total_actual_cost <= total_budget, alert_count is 0."""
    db = MagicMock()
    db.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[
            {"budget": 100, "actual_cost": 80},
            {"budget": 50, "actual_cost": 40},
        ]
    )
    result = _program_aggregates(db, "prog-1")
    assert result["total_budget"] == 150
    assert result["total_actual_cost"] == 120
    assert result["project_count"] == 2
    assert result["alert_count"] == 0


def test_program_aggregates_alert_count_one_when_over_budget():
    """When total_actual_cost > total_budget, alert_count is 1."""
    db = MagicMock()
    db.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[
            {"budget": 100, "actual_cost": 90},
            {"budget": 50, "actual_cost": 70},
        ]
    )
    result = _program_aggregates(db, "prog-1")
    assert result["total_budget"] == 150
    assert result["total_actual_cost"] == 160
    assert result["project_count"] == 2
    assert result["alert_count"] == 1


def test_program_aggregates_alert_count_zero_when_budget_zero():
    """When total_budget is 0, no budget overrun alert (avoid div/compare edge case)."""
    db = MagicMock()
    db.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[{"budget": 0, "actual_cost": 10}]
    )
    result = _program_aggregates(db, "prog-1")
    assert result["total_budget"] == 0
    assert result["total_actual_cost"] == 10
    assert result["alert_count"] == 0


def test_program_aggregates_empty_projects():
    """Empty project list yields zeros and alert_count 0."""
    db = MagicMock()
    db.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
    result = _program_aggregates(db, "prog-1")
    assert result["total_budget"] == 0
    assert result["total_actual_cost"] == 0
    assert result["project_count"] == 0
    assert result["alert_count"] == 0


def test_program_aggregates_handles_none_budget_or_cost():
    """None budget/actual_cost are treated as 0."""
    db = MagicMock()
    db.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[
            {"budget": None, "actual_cost": 10},
            {"budget": 20, "actual_cost": None},
        ]
    )
    result = _program_aggregates(db, "prog-1")
    assert result["total_budget"] == 20
    assert result["total_actual_cost"] == 10
    assert result["alert_count"] == 0


def test_program_aggregates_exception_returns_safe_defaults():
    """On DB exception, returns safe defaults including alert_count 0."""
    db = MagicMock()
    db.table.return_value.select.return_value.eq.return_value.execute.side_effect = Exception("DB error")
    result = _program_aggregates(db, "prog-1")
    assert result["total_budget"] is None
    assert result["total_actual_cost"] is None
    assert result["project_count"] == 0
    assert result["alert_count"] == 0
