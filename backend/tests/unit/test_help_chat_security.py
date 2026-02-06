"""Unit tests for help chat security (Task 18): sanitize_input, filter_pii, is_likely_malicious."""

import pytest
from services.help_chat_security import sanitize_input, filter_pii, is_likely_malicious


def test_sanitize_input_empty():
    out, mod = sanitize_input(None)
    assert out == ""
    assert mod is False
    out, mod = sanitize_input("")
    assert out == ""
    assert mod is False


def test_sanitize_input_clean():
    out, mod = sanitize_input("How do I create a project?")
    assert out == "How do I create a project?"
    assert mod is False


def test_sanitize_input_sql_like():
    out, mod = sanitize_input("help me'; DROP TABLE users;--")
    assert "DROP" not in out
    assert mod is True


def test_sanitize_input_xss():
    out, mod = sanitize_input("Click <script>alert(1)</script> here")
    assert "<script" not in out
    assert mod is True


def test_sanitize_input_max_length():
    long_text = "a" * 15000
    out, _ = sanitize_input(long_text, max_length=100)
    assert len(out) <= 100


def test_filter_pii_empty():
    assert filter_pii(None) == ""
    assert filter_pii("") == ""


def test_filter_pii_email():
    assert "[email redacted]" in filter_pii("Contact admin@example.com for help")
    assert "admin@example.com" not in filter_pii("Contact admin@example.com for help")


def test_filter_pii_phone():
    assert "[phone redacted]" in filter_pii("Call +1 234 567 8900")
    assert "234" in filter_pii("Call +1 234 567 8900") or "[phone redacted]" in filter_pii("Call +1 234 567 8900")


def test_filter_pii_api_key():
    out = filter_pii("Set api_key=sk-12345678 in config")
    assert "sk-12345678" not in out
    assert "redacted" in out.lower() or "=" in out


def test_is_likely_malicious_false():
    assert is_likely_malicious(None) is False
    assert is_likely_malicious("How do I export reports?") is False


def test_is_likely_malicious_sql():
    assert is_likely_malicious("'; SELECT * FROM users--") is True


def test_is_likely_malicious_xss():
    assert is_likely_malicious("<script>alert(1)</script>") is True
