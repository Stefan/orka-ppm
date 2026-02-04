"""Integration tests for Contract Integration API."""

import pytest
from unittest.mock import patch, MagicMock


class TestContractIntegrationAPI:
    def test_router_importable(self):
        with patch("config.database.supabase", MagicMock()):
            with patch("services.contract_integration_manager_service.supabase", MagicMock()):
                from routers.contract_integration import router
                assert router.prefix == "/contract-integration"
