"""
Unit tests for share link analytics and reporting functionality.

Tests cover:
- Time-series analytics data generation
- Summary report generation with key metrics
- Email notification system for various events
- Integration with existing notification infrastructure

Requirements: 4.3, 3.5, 4.5, 8.3, 8.4
"""

import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from uuid import uuid4

from services.access_analytics_service import AccessAnalyticsService
from services.share_link_notification_service import ShareLinkNotificationService
from models.shareable_urls import ShareAnalytics


class TestTimeSeriesAnalytics:
    """Test time-series analytics functionality."""
    
    @pytest.fixture
    def mock_db(self):
        """Create mock database client."""
        db = Mock()
        db.table = Mock(return_value=db)
        db.select = Mock(return_value=db)
        db.eq = Mock(return_value=db)
        db.gte = Mock(return_value=db)
        db.lte = Mock(return_value=db)
        return db
    
    @pytest.fixture
    def analytics_service(self, mock_db):
        """Create analytics service with mock database."""
        with patch('services.access_analytics_service.ShareLinkNotificationService'):
            return AccessAnalyticsService(db_session=mock_db)
    
    @pytest.mark.asyncio
    async def test_get_time_series_analytics_with_data(self, analytics_service, mock_db):
        """Test time-series analytics returns properly formatted data."""
        # Arrange
        share_id = str(uuid4())
        now = datetime.now(timezone.utc)
        
        # Mock access logs
        mock_logs = [
            {
                "id": str(uuid4()),
                "share_id": share_id,
                "accessed_at": (now - timedelta(days=2)).isoformat(),
                "ip_address": "192.168.1.1",
                "country_code": "US",
                "device_type": "Desktop",
                "browser": "Chrome",
                "session_duration": 120
            },
            {
                "id": str(uuid4()),
                "share_id": share_id,
                "accessed_at": (now - timedelta(days=1)).isoformat(),
                "ip_address": "192.168.1.2",
                "country_code": "US",
                "device_type": "Mobile",
                "browser": "Safari",
                "session_duration": 90
            },
            {
                "id": str(uuid4()),
                "share_id": share_id,
                "accessed_at": now.isoformat(),
                "ip_address": "192.168.1.1",
                "country_code": "CA",
                "device_type": "Desktop",
                "browser": "Chrome",
                "session_duration": 150
            }
        ]
        
        mock_db.execute = Mock(return_value=Mock(data=mock_logs))
        
        # Act
        result = await analytics_service.get_time_series_analytics(
            share_id=share_id,
            granularity="day"
        )
        
        # Assert
        assert "access_over_time" in result
        assert "unique_visitors_over_time" in result
        assert "session_duration_trend" in result
        assert "geographic_trend" in result
        assert "device_type_trend" in result
        assert "browser_trend" in result
        
        # Verify access over time has data
        assert len(result["access_over_time"]) > 0
        assert all("time" in item and "count" in item for item in result["access_over_time"])
        
        # Verify unique visitors tracking
        assert len(result["unique_visitors_over_time"]) > 0
        
        # Verify session duration trend
        assert len(result["session_duration_trend"]) > 0
        assert all("average_duration" in item for item in result["session_duration_trend"])
    
    @pytest.mark.asyncio
    async def test_get_time_series_analytics_empty_data(self, analytics_service, mock_db):
        """Test time-series analytics with no access logs."""
        # Arrange
        share_id = str(uuid4())
        mock_db.execute = Mock(return_value=Mock(data=[]))
        
        # Act
        result = await analytics_service.get_time_series_analytics(share_id=share_id)
        
        # Assert
        assert result["access_over_time"] == []
        assert result["unique_visitors_over_time"] == []
        assert result["session_duration_trend"] == []
    
    @pytest.mark.asyncio
    async def test_get_time_series_analytics_hourly_granularity(self, analytics_service, mock_db):
        """Test time-series analytics with hourly granularity."""
        # Arrange
        share_id = str(uuid4())
        now = datetime.now(timezone.utc)
        
        mock_logs = [
            {
                "id": str(uuid4()),
                "share_id": share_id,
                "accessed_at": (now - timedelta(hours=2)).isoformat(),
                "ip_address": "192.168.1.1",
                "country_code": "US",
                "device_type": "Desktop",
                "browser": "Chrome",
                "session_duration": 120
            },
            {
                "id": str(uuid4()),
                "share_id": share_id,
                "accessed_at": (now - timedelta(hours=1)).isoformat(),
                "ip_address": "192.168.1.2",
                "country_code": "US",
                "device_type": "Mobile",
                "browser": "Safari",
                "session_duration": 90
            }
        ]
        
        mock_db.execute = Mock(return_value=Mock(data=mock_logs))
        
        # Act
        result = await analytics_service.get_time_series_analytics(
            share_id=share_id,
            granularity="hour"
        )
        
        # Assert
        assert len(result["access_over_time"]) > 0
        # Verify hourly format (YYYY-MM-DD HH:00)
        for item in result["access_over_time"]:
            assert ":00" in item["time"]


class TestSummaryReports:
    """Test summary report generation functionality."""
    
    @pytest.fixture
    def mock_db(self):
        """Create mock database client."""
        db = Mock()
        db.table = Mock(return_value=db)
        db.select = Mock(return_value=db)
        db.eq = Mock(return_value=db)
        db.gte = Mock(return_value=db)
        db.lte = Mock(return_value=db)
        return db
    
    @pytest.fixture
    def analytics_service(self, mock_db):
        """Create analytics service with mock database."""
        with patch('services.access_analytics_service.ShareLinkNotificationService'):
            return AccessAnalyticsService(db_session=mock_db)
    
    @pytest.mark.asyncio
    async def test_generate_summary_report_comprehensive(self, analytics_service, mock_db):
        """Test comprehensive summary report generation."""
        # Arrange
        share_id = str(uuid4())
        now = datetime.now(timezone.utc)
        
        # Mock analytics data
        mock_analytics = ShareAnalytics(
            total_accesses=100,
            unique_visitors=50,
            unique_countries=5,
            access_by_day=[],
            geographic_distribution=[{"country": "US", "count": 60}],
            most_viewed_sections=[],
            average_session_duration=120.5,
            suspicious_activity_count=2
        )
        
        # Mock access logs
        mock_logs = [
            {
                "id": str(uuid4()),
                "accessed_at": (now - timedelta(days=1)).isoformat(),
                "ip_address": "192.168.1.1",
                "country_code": "US",
                "city": "New York",
                "device_type": "Desktop",
                "browser": "Chrome",
                "browser_version": "120.0",
                "os": "Windows",
                "device_brand": "Dell",
                "is_suspicious": False,
                "session_duration": 120
            },
            {
                "id": str(uuid4()),
                "accessed_at": now.isoformat(),
                "ip_address": "192.168.1.1",
                "country_code": "US",
                "city": "New York",
                "device_type": "Mobile",
                "browser": "Safari",
                "browser_version": "17.0",
                "os": "iOS",
                "device_brand": "Apple",
                "is_suspicious": True,
                "suspicious_reasons": [{"type": "high_frequency"}],
                "session_duration": 90
            }
        ]
        
        # Mock database responses
        def mock_execute():
            return Mock(data=mock_logs)
        
        mock_db.execute = mock_execute
        
        # Mock get_share_analytics
        analytics_service.get_share_analytics = AsyncMock(return_value=mock_analytics)
        
        # Act
        result = await analytics_service.generate_summary_report(share_id=share_id)
        
        # Assert
        assert "period" in result
        assert "overall_statistics" in result
        assert "engagement_metrics" in result
        assert "geographic_insights" in result
        assert "technology_insights" in result
        assert "security_insights" in result
        assert "trend_analysis" in result
        
        # Verify overall statistics
        stats = result["overall_statistics"]
        assert stats["total_accesses"] == 100
        assert stats["unique_visitors"] == 50
        
        # Verify engagement metrics
        engagement = result["engagement_metrics"]
        assert "return_visitors" in engagement
        assert "return_visitor_rate" in engagement
        assert "peak_hour" in engagement
        assert "peak_day" in engagement
        
        # Verify security insights
        security = result["security_insights"]
        assert "total_suspicious_accesses" in security
        assert "suspicious_access_rate" in security
        assert "suspicious_by_type" in security
    
    @pytest.mark.asyncio
    async def test_generate_summary_report_no_data(self, analytics_service, mock_db):
        """Test summary report with no access data."""
        # Arrange
        share_id = str(uuid4())
        mock_db.execute = Mock(return_value=Mock(data=[]))
        analytics_service.get_share_analytics = AsyncMock(return_value=None)
        
        # Act
        result = await analytics_service.generate_summary_report(share_id=share_id)
        
        # Assert
        assert result == {}
    
    @pytest.mark.asyncio
    async def test_generate_summary_report_trend_analysis(self, analytics_service, mock_db):
        """Test trend analysis in summary report."""
        # Arrange
        share_id = str(uuid4())
        now = datetime.now(timezone.utc)
        start_date = now - timedelta(days=30)
        midpoint = start_date + timedelta(days=15)
        
        # Create logs with increasing trend
        mock_logs = []
        # First half: 10 accesses
        for i in range(10):
            mock_logs.append({
                "id": str(uuid4()),
                "accessed_at": (start_date + timedelta(days=i)).isoformat(),
                "ip_address": f"192.168.1.{i}",
                "country_code": "US",
                "city": "New York",
                "device_type": "Desktop",
                "browser": "Chrome",
                "os": "Windows",
                "is_suspicious": False
            })
        
        # Second half: 20 accesses (100% growth)
        for i in range(20):
            mock_logs.append({
                "id": str(uuid4()),
                "accessed_at": (midpoint + timedelta(days=i % 15)).isoformat(),
                "ip_address": f"192.168.2.{i}",
                "country_code": "US",
                "city": "Los Angeles",
                "device_type": "Mobile",
                "browser": "Safari",
                "os": "iOS",
                "is_suspicious": False
            })
        
        mock_analytics = ShareAnalytics(
            total_accesses=30,
            unique_visitors=30,
            unique_countries=1,
            access_by_day=[],
            geographic_distribution=[],
            most_viewed_sections=[],
            average_session_duration=None,
            suspicious_activity_count=0
        )
        
        mock_db.execute = Mock(return_value=Mock(data=mock_logs))
        analytics_service.get_share_analytics = AsyncMock(return_value=mock_analytics)
        
        # Act
        result = await analytics_service.generate_summary_report(
            share_id=share_id,
            start_date=start_date,
            end_date=now
        )
        
        # Assert
        trend = result["trend_analysis"]
        assert trend["first_half_accesses"] == 10
        assert trend["second_half_accesses"] == 20
        assert trend["growth_rate"] == 100.0
        assert trend["trend"] == "increasing"


class TestExpiryNotifications:
    """Test expiry warning notification functionality."""
    
    @pytest.fixture
    def mock_db(self):
        """Create mock database client."""
        db = Mock()
        db.table = Mock(return_value=db)
        db.select = Mock(return_value=db)
        db.eq = Mock(return_value=db)
        db.gte = Mock(return_value=db)
        db.lte = Mock(return_value=db)
        db.insert = Mock(return_value=db)
        return db
    
    @pytest.fixture
    def notification_service(self, mock_db):
        """Create notification service with mock database."""
        return ShareLinkNotificationService(db_session=mock_db)
    
    @pytest.mark.asyncio
    async def test_send_expiry_warnings_success(self, notification_service, mock_db):
        """Test sending expiry warnings for links expiring soon."""
        # Arrange
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(hours=12)
        
        share_id = str(uuid4())
        project_id = str(uuid4())
        creator_id = str(uuid4())
        
        # Mock share links expiring soon
        mock_shares = [{
            "id": share_id,
            "project_id": project_id,
            "token": "test_token",
            "created_by": creator_id,
            "expires_at": expires_at.isoformat(),
            "permission_level": "view_only",
            "custom_message": None
        }]
        
        # Mock project data
        mock_project = [{
            "name": "Test Project",
            "description": "Test description"
        }]
        
        # Mock creator data
        mock_creator = [{
            "email": "creator@example.com",
            "raw_user_meta_data": {"full_name": "Test Creator"}
        }]
        
        # Setup mock responses
        def mock_execute():
            if mock_db.table.call_count == 1:
                return Mock(data=mock_shares)
            elif mock_db.table.call_count == 2:
                return Mock(data=mock_project)
            elif mock_db.table.call_count == 3:
                return Mock(data=mock_creator)
            else:
                return Mock(data=[{"id": str(uuid4())}])
        
        mock_db.execute = mock_execute
        
        # Act
        result = await notification_service.send_expiry_warnings(hours_before=24)
        
        # Assert
        assert result == 1
        # Verify email was queued
        assert mock_db.insert.called
    
    @pytest.mark.asyncio
    async def test_send_expiry_warnings_no_expiring_links(self, notification_service, mock_db):
        """Test expiry warnings when no links are expiring."""
        # Arrange
        mock_db.execute = Mock(return_value=Mock(data=[]))
        
        # Act
        result = await notification_service.send_expiry_warnings()
        
        # Assert
        assert result == 0
    
    @pytest.mark.asyncio
    async def test_expiry_warning_email_format(self, notification_service):
        """Test expiry warning email formatting."""
        # Arrange
        expires_at = datetime.now(timezone.utc) + timedelta(hours=12)
        
        # Act
        email_body = notification_service._format_expiry_warning_email(
            project_name="Test Project",
            creator_name="John Doe",
            expires_at=expires_at,
            hours_remaining=12.0,
            permission_level="limited_data",
            share_id=str(uuid4())
        )
        
        # Assert
        assert "Test Project" in email_body
        assert "John Doe" in email_body
        assert "12.0 hours" in email_body
        assert "Limited Data" in email_body
        assert "⏰" in email_body  # Warning emoji


class TestFirstAccessNotifications:
    """Test first access notification functionality."""
    
    @pytest.fixture
    def mock_db(self):
        """Create mock database client."""
        db = Mock()
        db.table = Mock(return_value=db)
        db.select = Mock(return_value=db)
        db.eq = Mock(return_value=db)
        db.insert = Mock(return_value=db)
        return db
    
    @pytest.fixture
    def notification_service(self, mock_db):
        """Create notification service with mock database."""
        return ShareLinkNotificationService(db_session=mock_db)
    
    @pytest.mark.asyncio
    async def test_send_first_access_notification_success(self, notification_service, mock_db):
        """Test sending first access notification."""
        # Arrange
        share_id = str(uuid4())
        project_id = str(uuid4())
        creator_id = str(uuid4())
        now = datetime.now(timezone.utc)
        
        # Mock access count (first access)
        mock_db.execute = Mock(side_effect=[
            Mock(count=1, data=[]),  # Access count
            Mock(data=[{  # Share link
                "project_id": project_id,
                "created_by": creator_id,
                "permission_level": "view_only",
                "token": "test_token"
            }]),
            Mock(data=[{"name": "Test Project"}]),  # Project
            Mock(data=[{  # Creator
                "email": "creator@example.com",
                "raw_user_meta_data": {"full_name": "Test Creator"}
            }]),
            Mock(data=[{"id": str(uuid4())}])  # Email queue
        ])
        
        # Act
        result = await notification_service.send_first_access_notification(
            share_id=share_id,
            ip_address="192.168.1.1",
            accessed_at=now,
            user_agent="Mozilla/5.0",
            country_code="US",
            city="New York"
        )
        
        # Assert
        assert result is True
    
    @pytest.mark.asyncio
    async def test_send_first_access_notification_not_first(self, notification_service, mock_db):
        """Test that notification is not sent for subsequent accesses."""
        # Arrange
        share_id = str(uuid4())
        now = datetime.now(timezone.utc)
        
        # Mock access count (not first access)
        mock_db.execute = Mock(return_value=Mock(count=5, data=[]))
        
        # Act
        result = await notification_service.send_first_access_notification(
            share_id=share_id,
            ip_address="192.168.1.1",
            accessed_at=now
        )
        
        # Assert
        assert result is False
    
    @pytest.mark.asyncio
    async def test_first_access_email_format(self, notification_service):
        """Test first access email formatting."""
        # Arrange
        accessed_at = datetime.now(timezone.utc)
        
        # Act
        email_body = notification_service._format_first_access_email(
            project_name="Test Project",
            creator_name="Jane Doe",
            accessed_at=accessed_at,
            ip_address="192.168.1.1",
            country_code="US",
            city="San Francisco",
            permission_level="full_project"
        )
        
        # Assert
        assert "Test Project" in email_body
        assert "Jane Doe" in email_body
        assert "192.168.1.1" in email_body
        assert "San Francisco, US" in email_body
        assert "Full Project" in email_body
        assert "✅" in email_body  # Success emoji


class TestSuspiciousActivityAlerts:
    """Test suspicious activity alert functionality."""
    
    @pytest.fixture
    def mock_db(self):
        """Create mock database client."""
        db = Mock()
        db.table = Mock(return_value=db)
        db.select = Mock(return_value=db)
        db.eq = Mock(return_value=db)
        db.insert = Mock(return_value=db)
        return db
    
    @pytest.fixture
    def notification_service(self, mock_db):
        """Create notification service with mock database."""
        return ShareLinkNotificationService(db_session=mock_db)
    
    @pytest.mark.asyncio
    async def test_send_suspicious_activity_alert_success(self, notification_service, mock_db):
        """Test sending suspicious activity alert."""
        # Arrange
        share_id = str(uuid4())
        project_id = str(uuid4())
        creator_id = str(uuid4())
        now = datetime.now(timezone.utc)
        
        suspicious_reasons = [
            {
                "type": "high_frequency",
                "description": "Excessive accesses from IP",
                "severity": "high"
            },
            {
                "type": "geographic_anomaly",
                "description": "Rapid location change",
                "severity": "high"
            }
        ]
        
        # Mock database responses
        mock_db.execute = Mock(side_effect=[
            Mock(data=[{  # Share link
                "project_id": project_id,
                "created_by": creator_id,
                "permission_level": "limited_data"
            }]),
            Mock(data=[{"name": "Test Project"}]),  # Project
            Mock(data=[{  # Creator
                "email": "creator@example.com",
                "raw_user_meta_data": {"full_name": "Test Creator"}
            }]),
            Mock(data=[{"id": str(uuid4())}])  # Email queue
        ])
        
        # Act
        result = await notification_service.send_suspicious_activity_alert(
            share_id=share_id,
            ip_address="192.168.1.1",
            suspicious_reasons=suspicious_reasons,
            accessed_at=now,
            country_code="RU",
            city="Moscow"
        )
        
        # Assert
        assert result is True
    
    @pytest.mark.asyncio
    async def test_suspicious_activity_email_format(self, notification_service):
        """Test suspicious activity email formatting."""
        # Arrange
        accessed_at = datetime.now(timezone.utc)
        suspicious_reasons = [
            {
                "type": "high_frequency",
                "description": "50 accesses in 1 hour",
                "severity": "high"
            }
        ]
        
        # Act
        email_body = notification_service._format_suspicious_activity_email(
            project_name="Critical Project",
            creator_name="Admin User",
            accessed_at=accessed_at,
            ip_address="10.0.0.1",
            country_code="CN",
            city="Beijing",
            suspicious_reasons=suspicious_reasons,
            severity="high",
            share_id=str(uuid4())
        )
        
        # Assert
        assert "Critical Project" in email_body
        assert "Admin User" in email_body
        assert "10.0.0.1" in email_body
        assert "Beijing, CN" in email_body
        assert "High Frequency" in email_body
        assert "50 accesses in 1 hour" in email_body
        assert "🚨" in email_body  # Alert emoji
        assert "HIGH PRIORITY" in email_body


class TestWeeklySummaries:
    """Test weekly summary email functionality."""
    
    @pytest.fixture
    def mock_db(self):
        """Create mock database client."""
        db = Mock()
        db.table = Mock(return_value=db)
        db.select = Mock(return_value=db)
        db.eq = Mock(return_value=db)
        db.gte = Mock(return_value=db)
        db.insert = Mock(return_value=db)
        return db
    
    @pytest.fixture
    def notification_service(self, mock_db):
        """Create notification service with mock database."""
        return ShareLinkNotificationService(db_session=mock_db)
    
    @pytest.mark.asyncio
    async def test_send_weekly_summaries_success(self, notification_service, mock_db):
        """Test sending weekly summary emails."""
        # Arrange
        creator_id = str(uuid4())
        share_id = str(uuid4())
        project_id = str(uuid4())
        
        # Mock active shares
        mock_shares = [{
            "id": share_id,
            "project_id": project_id,
            "created_by": creator_id,
            "permission_level": "view_only",
            "created_at": datetime.now(timezone.utc).isoformat()
        }]
        
        # Mock creator
        mock_creator = [{
            "email": "creator@example.com",
            "raw_user_meta_data": {"full_name": "Test Creator"}
        }]
        
        # Mock access logs
        mock_logs = [
            {
                "id": str(uuid4()),
                "accessed_at": datetime.now(timezone.utc).isoformat(),
                "ip_address": "192.168.1.1",
                "is_suspicious": False
            },
            {
                "id": str(uuid4()),
                "accessed_at": datetime.now(timezone.utc).isoformat(),
                "ip_address": "192.168.1.2",
                "is_suspicious": False
            }
        ]
        
        # Mock project
        mock_project = [{"name": "Test Project"}]
        
        # Setup mock responses
        call_count = [0]
        
        def mock_execute():
            call_count[0] += 1
            if call_count[0] == 1:
                return Mock(data=mock_shares)
            elif call_count[0] == 2:
                return Mock(data=mock_creator)
            elif call_count[0] == 3:
                return Mock(data=mock_logs)
            elif call_count[0] == 4:
                return Mock(data=mock_project)
            else:
                return Mock(data=[{"id": str(uuid4())}])
        
        mock_db.execute = mock_execute
        
        # Act
        result = await notification_service.send_weekly_summaries()
        
        # Assert
        assert result == 1
    
    @pytest.mark.asyncio
    async def test_send_weekly_summaries_no_active_shares(self, notification_service, mock_db):
        """Test weekly summaries when no active shares exist."""
        # Arrange
        mock_db.execute = Mock(return_value=Mock(data=[]))
        
        # Act
        result = await notification_service.send_weekly_summaries()
        
        # Assert
        assert result == 0
    
    @pytest.mark.asyncio
    async def test_weekly_summary_email_format(self, notification_service):
        """Test weekly summary email formatting."""
        # Arrange
        start_date = datetime.now(timezone.utc) - timedelta(days=7)
        end_date = datetime.now(timezone.utc)
        
        summary_data = [
            {
                "project_name": "Project Alpha",
                "share_id": str(uuid4()),
                "permission_level": "view_only",
                "access_count": 25,
                "unique_visitors": 10,
                "suspicious_count": 0
            },
            {
                "project_name": "Project Beta",
                "share_id": str(uuid4()),
                "permission_level": "full_project",
                "access_count": 50,
                "unique_visitors": 20,
                "suspicious_count": 2
            }
        ]
        
        # Act
        email_body = notification_service._format_weekly_summary_email(
            creator_name="Project Manager",
            summary_data=summary_data,
            start_date=start_date,
            end_date=end_date
        )
        
        # Assert
        assert "Project Manager" in email_body
        assert "Project Alpha" in email_body
        assert "Project Beta" in email_body
        assert "75" in email_body  # Total accesses (25 + 50)
        assert "30" in email_body  # Total unique visitors (10 + 20)
        assert "2" in email_body  # Total suspicious
        assert "📊" in email_body  # Chart emoji
        assert "⚠️ 2 suspicious" in email_body  # Suspicious badge


class TestNotificationIntegration:
    """Test integration between analytics and notification services."""
    
    @pytest.fixture
    def mock_db(self):
        """Create mock database client."""
        db = Mock()
        db.table = Mock(return_value=db)
        db.select = Mock(return_value=db)
        db.eq = Mock(return_value=db)
        db.gte = Mock(return_value=db)
        db.lte = Mock(return_value=db)
        db.insert = Mock(return_value=db)
        return db
    
    @pytest.mark.asyncio
    async def test_log_access_triggers_notifications(self, mock_db):
        """Test that logging access triggers appropriate notifications."""
        # Arrange
        with patch('services.access_analytics_service.ShareLinkNotificationService') as MockNotificationService:
            mock_notification_service = MockNotificationService.return_value
            mock_notification_service.send_first_access_notification = AsyncMock(return_value=True)
            mock_notification_service.send_suspicious_activity_alert = AsyncMock(return_value=True)
            
            analytics_service = AccessAnalyticsService(db_session=mock_db)
            analytics_service.notification_service = mock_notification_service
            
            # Mock database responses
            mock_db.execute = Mock(return_value=Mock(data=[{"id": str(uuid4())}]))
            
            # Mock suspicious activity detection
            analytics_service._detect_suspicious_activity = AsyncMock(return_value=[
                {"type": "high_frequency", "description": "Test", "severity": "high"}
            ])
            
            # Act
            await analytics_service.log_access_event(
                share_id=str(uuid4()),
                ip_address="192.168.1.1",
                user_agent="Mozilla/5.0",
                accessed_sections=["overview"],
                session_duration=120
            )
            
            # Assert
            mock_notification_service.send_first_access_notification.assert_called_once()
            mock_notification_service.send_suspicious_activity_alert.assert_called_once()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
