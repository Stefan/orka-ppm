"""
Unit tests for HelpLogger (AI Help Chat Enhancement).
Logs help queries, responses, errors, and feedback; all operations scoped by organization.
"""

import pytest
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

backend_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_dir))

from services.help_logger import HelpLogger, get_help_logger


@pytest.mark.unit
class TestHelpLoggerInit:
    """HelpLogger construction and _table."""

    def test_init_with_client(self, mock_supabase):
        logger = HelpLogger(supabase_client=mock_supabase)
        assert logger._client is mock_supabase

    def test_table_raises_when_no_client(self):
        logger = HelpLogger(supabase_client=None)
        # Simulate no env (no create_client fallback)
        with patch.dict("os.environ", {}, clear=False):
            with patch("services.help_logger.create_client", return_value=None):
                with pytest.raises(RuntimeError, match="Supabase client not configured"):
                    logger._table("help_logs")

    def test_table_returns_table_interface(self, mock_supabase):
        logger = HelpLogger(supabase_client=mock_supabase)
        t = logger._table("help_logs")
        assert t is mock_supabase.table.return_value
        mock_supabase.table.assert_called_once_with("help_logs")


@pytest.mark.unit
class TestHelpLoggerLogQuery:
    """log_query inserts into help_logs and returns query_id."""

    def test_log_query_success_returns_uuid(self, mock_supabase):
        logger = HelpLogger(supabase_client=mock_supabase)
        query_id = logger.log_query(
            user_id="user-1",
            organization_id="org-1",
            query="How do I create a project?",
            page_context={"route": "/projects"},
            user_role="admin",
        )
        assert query_id is not None
        assert len(query_id) == 36  # UUID string length
        table = mock_supabase.table.return_value
        table.insert.assert_called_once()
        call_args = table.insert.call_args[0][0]
        assert call_args["user_id"] == "user-1"
        assert call_args["organization_id"] == "org-1"
        assert call_args["query"] == "How do I create a project?"
        assert call_args["page_context"] == {"route": "/projects"}
        assert call_args["user_role"] == "admin"
        assert call_args["success"] is False

    def test_log_query_defaults_page_context_to_empty_dict(self, mock_supabase):
        logger = HelpLogger(supabase_client=mock_supabase)
        logger.log_query(user_id="u", organization_id="o", query="q")
        call_args = mock_supabase.table.return_value.insert.call_args[0][0]
        assert call_args["page_context"] == {}

    def test_log_query_insert_failure_returns_query_id_anyway(self, mock_supabase):
        mock_supabase.table.return_value.insert.return_value.execute.side_effect = Exception("DB error")
        logger = HelpLogger(supabase_client=mock_supabase)
        query_id = logger.log_query(user_id="u", organization_id="o", query="q")
        assert query_id is not None


@pytest.mark.unit
class TestHelpLoggerLogResponse:
    """log_response updates help_logs with response data."""

    def test_log_response_success(self, mock_supabase):
        logger = HelpLogger(supabase_client=mock_supabase)
        logger.log_response(
            query_id="q-id",
            response="Here is how.",
            confidence_score=0.9,
            sources_used=[{"id": "doc1"}],
            response_time_ms=150,
            success=True,
        )
        table = mock_supabase.table.return_value
        table.update.assert_called_once()
        call_args = table.update.call_args[0][0]
        assert call_args["response"] == "Here is how."
        assert call_args["confidence_score"] == 0.9
        assert call_args["sources_used"] == [{"id": "doc1"}]
        assert call_args["response_time_ms"] == 150
        assert call_args["success"] is True
        table.eq.assert_called_with("id", "q-id")

    def test_log_response_clamps_confidence(self, mock_supabase):
        logger = HelpLogger(supabase_client=mock_supabase)
        logger.log_response(query_id="q", response="r", confidence_score=1.5, success=True)
        call_args = mock_supabase.table.return_value.update.call_args[0][0]
        assert call_args["confidence_score"] == 1.0
        logger.log_response(query_id="q", response="r", confidence_score=-0.1, success=True)
        call_args = mock_supabase.table.return_value.update.call_args[0][0]
        assert call_args["confidence_score"] == 0.0

    def test_log_response_failure_logs_warning(self, mock_supabase):
        mock_supabase.table.return_value.update.return_value.eq.return_value.execute.side_effect = Exception("update failed")
        logger = HelpLogger(supabase_client=mock_supabase)
        logger.log_response(query_id="q", response="r", confidence_score=0.5, success=True)
        # No exception propagates
        assert True


@pytest.mark.unit
class TestHelpLoggerLogError:
    """log_error updates help_logs with error info."""

    def test_log_error_success(self, mock_supabase):
        logger = HelpLogger(supabase_client=mock_supabase)
        logger.log_error(
            query_id="q-id",
            error_type="timeout",
            error_message="Request timed out",
            organization_id="org-1",
        )
        table = mock_supabase.table.return_value
        table.update.assert_called_once()
        call_args = table.update.call_args[0][0]
        assert call_args["success"] is False
        assert call_args["error_type"] == "timeout"
        assert call_args["error_message"] == "Request timed out"
        table.eq.assert_called_with("id", "q-id")

    def test_log_error_message_defaults_to_empty(self, mock_supabase):
        logger = HelpLogger(supabase_client=mock_supabase)
        logger.log_error(query_id="q", error_type="network")
        call_args = mock_supabase.table.return_value.update.call_args[0][0]
        assert call_args["error_message"] == ""


@pytest.mark.unit
class TestHelpLoggerLogFeedback:
    """log_feedback insert or update in help_query_feedback."""

    def test_log_feedback_insert_when_no_existing(self, mock_supabase):
        mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(data=[], count=0)
        logger = HelpLogger(supabase_client=mock_supabase)
        feedback_id = logger.log_feedback(
            query_id="q1",
            user_id="u1",
            organization_id="org1",
            rating=5,
            comments="Great!",
        )
        assert feedback_id is not None
        table = mock_supabase.table.return_value
        table.insert.assert_called_once()
        call_args = table.insert.call_args[0][0]
        assert call_args["query_id"] == "q1"
        assert call_args["user_id"] == "u1"
        assert call_args["organization_id"] == "org1"
        assert call_args["rating"] == 5
        assert call_args["comments"] == "Great!"

    def test_log_feedback_update_when_existing(self, mock_supabase):
        mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(data=[{"id": "fb-1"}], count=1)
        logger = HelpLogger(supabase_client=mock_supabase)
        feedback_id = logger.log_feedback(
            query_id="q1",
            user_id="u1",
            organization_id="org1",
            rating=3,
            comments="Updated",
        )
        assert feedback_id == "fb-1"
        table = mock_supabase.table.return_value
        table.update.assert_called_once()
        call_args = table.update.call_args[0][0]
        assert call_args["rating"] == 3
        assert call_args["comments"] == "Updated"

    def test_log_feedback_clamps_rating(self, mock_supabase):
        mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(data=[], count=0)
        logger = HelpLogger(supabase_client=mock_supabase)
        logger.log_feedback(query_id="q", user_id="u", organization_id=None, rating=10, comments=None)
        call_args = mock_supabase.table.return_value.insert.call_args[0][0]
        assert call_args["rating"] == 5
        logger.log_feedback(query_id="q", user_id="u", organization_id=None, rating=0, comments=None)
        call_args = mock_supabase.table.return_value.insert.call_args[0][0]
        assert call_args["rating"] == 1

    def test_log_feedback_failure_returns_feedback_id_anyway(self, mock_supabase):
        mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.side_effect = Exception("DB error")
        logger = HelpLogger(supabase_client=mock_supabase)
        feedback_id = logger.log_feedback(query_id="q", user_id="u", organization_id="o", rating=5)
        assert feedback_id is not None


@pytest.mark.unit
class TestHelpLoggerLogAction:
    """log_action updates help_logs with action_type and action_details."""

    def test_log_action_success(self, mock_supabase):
        logger = HelpLogger(supabase_client=mock_supabase)
        logger.log_action(
            query_id="q-id",
            action_type="copy",
            action_details={"text": "snippet"},
        )
        table = mock_supabase.table.return_value
        table.update.assert_called_once()
        call_args = table.update.call_args[0][0]
        assert call_args["action_type"] == "copy"
        assert call_args["action_details"] == {"text": "snippet"}
        table.eq.assert_called_with("id", "q-id")

    def test_log_action_details_default_to_empty(self, mock_supabase):
        logger = HelpLogger(supabase_client=mock_supabase)
        logger.log_action(query_id="q", action_type="click")
        call_args = mock_supabase.table.return_value.update.call_args[0][0]
        assert call_args["action_details"] == {}


@pytest.mark.unit
class TestGetHelpLogger:
    """get_help_logger factory."""

    def test_get_help_logger_with_client(self, mock_supabase):
        # Passed client is used (fake config.database with supabase=None so logic uses passed client)
        import types
        fake_config = types.ModuleType("config")
        fake_db = types.ModuleType("config.database")
        fake_db.supabase = None
        fake_config.database = fake_db
        saved = {k: sys.modules.get(k) for k in ("config", "config.database")}
        sys.modules["config"] = fake_config
        sys.modules["config.database"] = fake_db
        try:
            result = get_help_logger(supabase_client=mock_supabase)
            assert result is not None
            assert result._client is mock_supabase
        finally:
            for k in ("config", "config.database"):
                if saved.get(k) is not None:
                    sys.modules[k] = saved[k]
                else:
                    sys.modules.pop(k, None)

    def test_get_help_logger_fallback_without_config(self):
        # supabase=None and no SUPABASE_* env so HelpLogger keeps _client None
        import types
        fake_config = types.ModuleType("config")
        fake_db = types.ModuleType("config.database")
        fake_db.supabase = None
        fake_config.database = fake_db
        saved = {k: sys.modules.get(k) for k in ("config", "config.database")}
        sys.modules["config"] = fake_config
        sys.modules["config.database"] = fake_db
        try:
            with patch.dict("os.environ", {"SUPABASE_URL": "", "SUPABASE_SERVICE_KEY": ""}, clear=False):
                result = get_help_logger(supabase_client=None)
            assert result is not None
            assert result._client is None
        finally:
            for k in ("config", "config.database"):
                if saved.get(k) is not None:
                    sys.modules[k] = saved[k]
                else:
                    sys.modules.pop(k, None)
