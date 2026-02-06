"""
Help Chat Security (Task 18).
Input sanitization (SQL/XSS/command injection), PII filtering on responses, security alert logging.
"""

import re
import logging
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

# Patterns that suggest malicious input (Requirement 13.1, 13.6)
SQL_PATTERNS = [
    r"(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|EXEC|EXECUTE|;)\b)",
    r"(--|\#|\/\*|\*\/)",
    r"(\bOR\s+['\"]?\d+['\"]?\s*=\s*['\"]?\d+)",
]
XSS_PATTERNS = [
    r"<script[^>]*>",
    r"javascript:",
    r"on\w+\s*=",
    r"<iframe",
    r"vbscript:",
]
COMMAND_PATTERNS = [
    r"\$\([^)]*\)",
    r"`[^`]*`",
    r"\|\s*\w+",
]

# PII patterns for response filtering (Requirement 13.2)
EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
PHONE_RE = re.compile(r"\+?[\d\s\-()]{10,}")
API_KEY_RE = re.compile(r"(?i)(api[_-]?key|secret|password|token)\s*[:=]\s*['\"]?[\w\-]{8,}['\"]?")


def sanitize_input(text: Optional[str], max_length: int = 10000) -> Tuple[str, bool]:
    """
    Sanitize user query: remove/escape SQL injection, XSS, command injection patterns.
    Returns (sanitized_text, was_modified). If malicious pattern detected, log and strip it.
    Requirement 13.1, 13.6.
    """
    if not text or not isinstance(text, str):
        return "", False
    original = text
    out = text[:max_length]
    modified = False
    for pat in SQL_PATTERNS + XSS_PATTERNS + COMMAND_PATTERNS:
        try:
            m = re.search(pat, out, re.IGNORECASE)
            if m:
                logger.warning("Help chat security: potential injection pattern detected and removed", extra={"pattern": pat[:50]})
                out = re.sub(pat, " ", out, flags=re.IGNORECASE)
                modified = True
        except re.error:
            continue
    out = re.sub(r"\s+", " ", out).strip()
    if len(out) != len(original) or out != original:
        modified = True
    return (out, modified)


def filter_pii(text: Optional[str]) -> str:
    """
    Remove PII from AI-generated response: emails, phone numbers, API keys.
    Requirement 13.2.
    """
    if not text or not isinstance(text, str):
        return ""
    out = text
    out = EMAIL_RE.sub("[email redacted]", out)
    out = PHONE_RE.sub("[phone redacted]", out)
    out = API_KEY_RE.sub(r"\1=[redacted]", out)
    return out


def is_likely_malicious(text: Optional[str]) -> bool:
    """Return True if input looks malicious (for blocking or alerting). Requirement 13.6."""
    if not text:
        return False
    for pat in SQL_PATTERNS + XSS_PATTERNS:
        try:
            if re.search(pat, text, re.IGNORECASE):
                return True
        except re.error:
            continue
    return False
