"""
Property tests for Proactive Tips Engine: cooldown, variance rule, notification content.
Validates: ai-help-chat-enhancement Task 9 (Proactive Tip Engine).
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import MagicMock
from services.proactive_tips_engine import ProactiveTipsEngine, TipPriority


@pytest.fixture
def engine():
    return ProactiveTipsEngine(supabase_client=MagicMock())


def test_cooldown_blocks_repeated_trigger(engine):
    """Property 18: Proactive Tip Cooldown - same (rule, user) within cooldown window is blocked."""
    engine._set_cooldown("variance_threshold", "user1")
    assert engine._is_in_cooldown("variance_threshold", "user1") is True
    assert engine._is_in_cooldown("variance_threshold", "user2") is False
    assert engine._is_in_cooldown("overdue", "user1") is False


def test_cooldown_expires_after_window(engine):
    """Cooldown expires after _cooldown_minutes."""
    engine._cooldown_minutes = 1
    engine._set_cooldown("variance_threshold", "user1")
    engine._cooldown["variance_threshold:user1"] = datetime.now() - timedelta(minutes=2)
    assert engine._is_in_cooldown("variance_threshold", "user1") is False


def test_variance_rule_in_tip_rules(engine):
    """Property 15 (partial): Variance threshold rule is present and has expected keys."""
    assert "variance_threshold" in engine.tip_rules
    rule = engine.tip_rules["variance_threshold"]
    assert rule.get("table") == "variance_alerts"
    assert rule.get("condition") == "new"
    assert "title" in rule and "content" in rule
    assert rule.get("priority") == TipPriority.HIGH


def test_notification_content_has_title_and_learn_more(engine):
    """Property 16 (partial): Triggered tip message has title, content, and optional learn_more_query."""
    rule = engine.tip_rules["variance_threshold"]
    message = {"title": rule["title"], "content": rule["content"], "learn_more_query": rule.get("learn_more_query")}
    assert "title" in message and len(message["title"]) > 0
    assert "content" in message and len(message["content"]) > 0
