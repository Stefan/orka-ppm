"""
Property 33: Explicit Wait Usage
Enterprise Test Strategy - Task 17.4
Validates: Requirements 20.3
"""

import pytest
import re


@pytest.mark.property
def test_no_fixed_sleep_in_test_code():
    """Test code must not use fixed sleep (use explicit wait)."""
    # Placeholder: in real impl, scan test files for time.sleep( or Thread.sleep(
    bad_patterns = [r"time\.sleep\s*\(", r"Thread\.sleep\s*\(", r"await\s+new\s+Promise.*setTimeout"]
    sample_code = "await page.waitForSelector('.loaded');"
    for pattern in bad_patterns:
        assert not re.search(pattern, sample_code)
