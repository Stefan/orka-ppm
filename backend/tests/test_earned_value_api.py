"""Integration tests for Earned Value API."""

import pytest


class TestEarnedValueAPI:
    def test_router_importable(self):
        from routers.earned_value import router
        assert router.prefix == "/earned-value"
