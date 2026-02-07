"""Integration tests for Change Analytics API."""

import pytest


class TestChangeAnalyticsAPI:
    def test_router_importable(self):
        from routers.change.change_analytics import router
        assert router.prefix == "/change-analytics"
