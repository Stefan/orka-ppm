"""Integration tests for Project Controls API."""

import pytest


class TestProjectControlsAPI:
    def test_project_controls_router_importable(self):
        from routers.project_controls import router
        assert router.prefix == "/project-controls"
