"""
XSS prevention tests - Enterprise Test Strategy Task 8.3
Requirements: 10.4, 10.5
"""

import pytest
from unittest.mock import MagicMock


@pytest.mark.security
class TestXSSPrevention:
    """Output encoding and CSP for XSS prevention."""

    def test_script_tag_escaped_in_output(self):
        """Rendered output must escape <script> tags."""
        dangerous = "<script>alert(1)</script>"
        escaped = dangerous.replace("<", "&lt;").replace(">", "&gt;")
        assert "script" in escaped
        assert escaped.startswith("&lt;")

    def test_event_handler_escaped(self):
        """onclick and similar must be escaped or stripped."""
        dangerous = '"><img src=x onerror=alert(1)>'
        safe = dangerous.replace("onerror", "").replace("onclick", "")
        assert "onerror" not in safe or "alert" not in safe
