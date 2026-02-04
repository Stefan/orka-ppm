"""Integration tests for Forecasts API."""

import pytest


class TestForecastsAPI:
    def test_router_importable(self):
        from routers.forecasts import router
        assert router.prefix == "/forecasts"
