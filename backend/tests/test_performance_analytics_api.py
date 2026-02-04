"""Integration tests for Performance Analytics API."""

import pytest


class TestPerformanceAnalyticsAPI:
    def test_router_importable(self):
        from routers.performance_analytics import router
        assert router.prefix == "/performance-analytics"
