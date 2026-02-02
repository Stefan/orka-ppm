"""
Integration tests for schedule management API (Task 18).
Tests schedule lifecycle, audit trail, notifications, caching.
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


@pytest.fixture
def mock_supabase():
    with patch("config.database.supabase") as m:
        yield m


@pytest.fixture
def mock_get_current_user():
    with patch("auth.dependencies.get_current_user", return_value={"id": "user-123"}):
        yield


class TestScheduleAuditService:
    """Test schedule audit trail service."""

    @pytest.mark.asyncio
    async def test_get_schedule_audit_trail_returns_structure(self, mock_supabase):
        from services.schedule_audit_service import ScheduleAuditService

        mock_supabase.table.return_value.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(data=[])
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
        mock_supabase.table.return_value.select.return_value.in_.return_value.execute.return_value = MagicMock(data=[])

        svc = ScheduleAuditService()
        svc.db = mock_supabase
        from uuid import UUID
        result = await svc.get_schedule_audit_trail(UUID("00000000-0000-0000-0000-000000000001"), limit=10)
        assert "schedule_id" in result
        assert "entries" in result
        assert "total" in result
        assert isinstance(result["entries"], list)


class TestScheduleNotificationsService:
    """Test schedule notifications service."""

    @pytest.mark.asyncio
    async def test_get_schedule_notifications_returns_structure(self, mock_supabase):
        from services.schedule_notifications_service import ScheduleNotificationsService

        mock_supabase.table.return_value.select.return_value.lte.return_value.in_.return_value.execute.return_value = MagicMock(data=[])
        mock_supabase.table.return_value.select.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(data=[])

        svc = ScheduleNotificationsService()
        svc.db = mock_supabase
        result = await svc.get_schedule_notifications(days_ahead=14)
        assert "milestone_alerts" in result
        assert "task_assignments" in result
        assert isinstance(result["milestone_alerts"], list)
        assert isinstance(result["task_assignments"], list)


class TestScheduleCache:
    """Test schedule cache (Task 17.1)."""

    def test_set_and_get_schedule_cached(self):
        from services.schedule_cache import set_schedule_cached, get_schedule_cached, invalidate_schedule
        from uuid import UUID

        sid = UUID("00000000-0000-0000-0000-000000000001")
        data = {"id": str(sid), "name": "Test"}
        set_schedule_cached(sid, data)
        assert get_schedule_cached(sid) == data
        invalidate_schedule(sid)
        assert get_schedule_cached(sid) is None
