"""Unit tests for Change Order Document Manager Service."""

import pytest
from unittest.mock import patch, MagicMock


class TestChangeOrderDocumentManagerService:
    def test_init_requires_database(self):
        with patch("config.database.supabase", None):
            with patch("services.change_order_document_manager_service.supabase", None):
                from services.change_order_document_manager_service import ChangeOrderDocumentManagerService
                with pytest.raises(RuntimeError, match="Database connection not available"):
                    ChangeOrderDocumentManagerService()

    def test_init_succeeds_with_database(self):
        mock_db = MagicMock()
        with patch("config.database.supabase", mock_db):
            with patch("services.change_order_document_manager_service.supabase", mock_db):
                from services.change_order_document_manager_service import ChangeOrderDocumentManagerService
                svc = ChangeOrderDocumentManagerService()
                assert svc.db is not None
