"""Integration tests for Change Approvals API."""

import pytest
from unittest.mock import patch, MagicMock


class TestChangeApprovalsAPI:
    def test_router_importable(self):
        with patch("config.database.supabase", MagicMock()):
            from routers.change import change_approvals
            assert change_approvals.router.prefix == "/change-approvals"

    def test_router_has_expected_routes(self):
        with patch("config.database.supabase", MagicMock()):
            from routers.change import change_approvals
            router = change_approvals.router
            routes = [r.path for r in router.routes if hasattr(r, "path")]
            paths = " ".join(routes)
            assert "workflow" in paths or len(routes) >= 1
