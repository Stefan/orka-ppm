"""Unit tests for Change Order Approval Workflow Service."""

import pytest
from unittest.mock import patch, MagicMock


class TestChangeOrderApprovalWorkflowService:
    def test_init_requires_database(self):
        with patch("config.database.supabase", None):
            with patch("services.change_order_approval_workflow_service.supabase", None):
                from services.change_order_approval_workflow_service import ChangeOrderApprovalWorkflowService
                with pytest.raises(RuntimeError, match="Database connection not available"):
                    ChangeOrderApprovalWorkflowService()

    def test_init_succeeds_with_database(self):
        mock_db = MagicMock()
        with patch("config.database.supabase", mock_db):
            with patch("services.change_order_approval_workflow_service.supabase", mock_db):
                from services.change_order_approval_workflow_service import ChangeOrderApprovalWorkflowService
                svc = ChangeOrderApprovalWorkflowService()
                assert svc.db is not None
