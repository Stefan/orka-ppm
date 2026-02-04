"""Unit tests for Contract Integration Manager Service."""

import pytest
from unittest.mock import patch, MagicMock


class TestContractIntegrationManagerService:
    def test_init_requires_database(self):
        with patch("config.database.supabase", None):
            with patch("services.contract_integration_manager_service.supabase", None):
                from services.contract_integration_manager_service import ContractIntegrationManagerService
                with pytest.raises(RuntimeError, match="Database connection not available"):
                    ContractIntegrationManagerService()

    def test_init_succeeds_with_database(self):
        mock_db = MagicMock()
        with patch("config.database.supabase", mock_db):
            with patch("services.contract_integration_manager_service.supabase", mock_db):
                from services.contract_integration_manager_service import ContractIntegrationManagerService
                svc = ContractIntegrationManagerService()
                assert svc.db is not None
