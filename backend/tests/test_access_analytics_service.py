"""
Unit tests for AccessAnalyticsService

Tests comprehensive access event logging, IP geolocation, user agent parsing,
and suspicious activity detection for shareable project URLs.

Requirements: 4.1, 4.2, 4.4
"""

import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock, patch, AsyncMock
from uuid import uuid4

from services.access_analytics_service import AccessAnalyticsService
from models.shareable_urls import ShareAnalytics


class TestAccessAnalyticsService:
    """Test suite for AccessAnalyticsService"""
    
    @pytest.fixture
    def mock_db(self):
        """Create a mock database client"""
        db = Mock()
        db.table = Mock(return_value=db)
        db.select = Mock(return_value=db)
        db.eq = Mock(return_value=db)
        db.gte = Mock(return_value=db)
        db.lte = Mock(return_value=db)
        db.insert = Mock(return_value=db)
        db.update = Mock(return_value=db)
        # execute should return a Mock with data attribute, not a coroutine
        db.execute = Mock(return_value=Mock(data=[]))
        return db
    
    @pytest.fixture
    def service(self, mock_db):
        """Create AccessAnalyticsService instance with mock database"""
        return AccessAnalyticsService(db_session=mock_db)
    
    # ==================== User Agent Parsing Tests ====================
    
    def test_parse_user_agent_chrome_desktop(self, service):
        """Test parsing Chrome desktop user agent"""
        ua_string = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        
        result = service._parse_user_agent(ua_string)
        
        assert result["browser"] == "Chrome"
        assert result["os"] == "Windows"
        assert result["device_type"] == "Desktop"
        assert result["is_bot"] is False
    
    def test_parse_user_agent_safari_mobile(self, service):
        """Test parsing Safari mobile user agent"""
        ua_string = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        
        result = service._parse_user_agent(ua_string)
        
        assert result["browser"] == "Mobile Safari"
        assert result["os"] == "iOS"
        assert result["device_type"] == "Mobile"
        assert result["device_brand"] == "Apple"
        assert result["is_bot"] is False
    
    def test_parse_user_agent_bot(self, service):
        """Test parsing bot user agent"""
        ua_string = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
        
        result = service._parse_user_agent(ua_string)
        
        assert result["is_bot"] is True
        assert result["device_type"] == "Bot"
    
    def test_parse_user_agent_empty(self, service):
        """Test parsing empty user agent"""
        result = service._parse_user_agent(None)
        
        assert result["browser"] == "Unknown"
        assert result["os"] == "Unknown"
        assert result["device_type"] == "Unknown"
        assert result["is_bot"] is False
    
    def test_parse_user_agent_invalid(self, service):
        """Test parsing invalid user agent"""
        result = service._parse_user_agent("invalid-user-agent-string")
        
        # Should not crash and return Unknown values
        assert "browser" in result
        assert "os" in result
        assert "device_type" in result
    
    # ==================== IP Geolocation Tests ====================
    
    def test_get_ip_geolocation_private_ip(self, service):
        """Test geolocation for private IP addresses"""
        result = service._get_ip_geolocation("192.168.1.1")
        
        assert result["is_private"] is True
        assert result["country_code"] is None
        assert result["city"] is None
    
    def test_get_ip_geolocation_localhost(self, service):
        """Test geolocation for localhost"""
        result = service._get_ip_geolocation("127.0.0.1")
        
        assert result["is_private"] is True
        assert result["country_code"] is None
    
    def test_is_private_ip_various_ranges(self, service):
        """Test private IP detection for various ranges"""
        assert service._is_private_ip("10.0.0.1") is True
        assert service._is_private_ip("172.16.0.1") is True
        assert service._is_private_ip("192.168.0.1") is True
        assert service._is_private_ip("127.0.0.1") is True
        assert service._is_private_ip("8.8.8.8") is False
        assert service._is_private_ip("1.1.1.1") is False
    
    # ==================== Distance Calculation Tests ====================
    
    def test_calculate_distance_same_location(self, service):
        """Test distance calculation for same location"""
        distance = service._calculate_distance(40.7128, -74.0060, 40.7128, -74.0060)
        
        assert distance == pytest.approx(0, abs=0.1)
    
    def test_calculate_distance_new_york_to_london(self, service):
        """Test distance calculation between New York and London"""
        # New York: 40.7128° N, 74.0060° W
        # London: 51.5074° N, 0.1278° W
        distance = service._calculate_distance(40.7128, -74.0060, 51.5074, -0.1278)
        
        # Approximate distance is ~5570 km
        assert 5500 < distance < 5600
    
    def test_calculate_distance_sydney_to_tokyo(self, service):
        """Test distance calculation between Sydney and Tokyo"""
        # Sydney: -33.8688° S, 151.2093° E
        # Tokyo: 35.6762° N, 139.6503° E
        distance = service._calculate_distance(-33.8688, 151.2093, 35.6762, 139.6503)
        
        # Approximate distance is ~7800 km
        assert 7700 < distance < 7900
    
    # ==================== Access Event Logging Tests ====================
    
    def test_log_access_event_success(self, service, mock_db):
        """Test successful access event logging"""
        share_id = str(uuid4())
        ip_address = "203.0.113.1"
        user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0"
        
        # Mock database response
        mock_db.execute.return_value = Mock(data=[{"id": str(uuid4())}])
        
        # Since the method is async but doesn't actually await, we need to run it
        import asyncio
        log_id = asyncio.run(service.log_access_event(
            share_id=share_id,
            ip_address=ip_address,
            user_agent=user_agent,
            accessed_sections=["overview", "timeline"],
            session_duration=120
        ))
        
        assert log_id is not None
        assert mock_db.table.called
        assert mock_db.insert.called
    
    @pytest.mark.asyncio
    async def test_log_access_event_with_suspicious_activity(self, service, mock_db):
        """Test access event logging with suspicious activity detection"""
        share_id = str(uuid4())
        ip_address = "203.0.113.1"
        
        # Mock recent accesses to trigger suspicious activity
        recent_accesses = [
            {
                "ip_address": ip_address,
                "accessed_at": (datetime.now(timezone.utc) - timedelta(minutes=i)).isoformat(),
                "latitude": None,
                "longitude": None
            }
            for i in range(60)  # 60 accesses in last hour
        ]
        
        # Mock database responses
        mock_db.execute.side_effect = [
            Mock(data=recent_accesses),  # Recent accesses query
            Mock(data=[{"id": str(uuid4())}]),  # Insert log entry
            Mock(data=[{"project_id": str(uuid4()), "created_by": str(uuid4())}]),  # Share details
            Mock(data=[{"name": "Test Project"}]),  # Project details
            Mock(data=[{"email": "creator@example.com"}])  # Creator email
        ]
        
        log_id = await service.log_access_event(
            share_id=share_id,
            ip_address=ip_address,
            user_agent="Mozilla/5.0"
        )
        
        assert log_id is not None
    
    @pytest.mark.asyncio
    async def test_log_access_event_no_database(self, service):
        """Test access event logging without database"""
        service.db = None
        
        log_id = await service.log_access_event(
            share_id=str(uuid4()),
            ip_address="203.0.113.1",
            user_agent="Mozilla/5.0"
        )
        
        assert log_id is None
    
    # ==================== Suspicious Activity Detection Tests ====================
    
    @pytest.mark.asyncio
    async def test_detect_suspicious_activity_high_frequency(self, service, mock_db):
        """Test detection of high frequency access from single IP"""
        share_id = str(uuid4())
        ip_address = "203.0.113.1"
        
        # Mock 60 recent accesses from same IP
        recent_accesses = [
            {
                "ip_address": ip_address,
                "accessed_at": (datetime.now(timezone.utc) - timedelta(minutes=i)).isoformat(),
                "latitude": None,
                "longitude": None
            }
            for i in range(60)
        ]
        
        mock_db.execute.return_value = Mock(data=recent_accesses)
        
        reasons = await service._detect_suspicious_activity(
            share_id, ip_address, {}
        )
        
        assert len(reasons) > 0
        assert any(r["type"] == "high_frequency" for r in reasons)
    
    @pytest.mark.asyncio
    async def test_detect_suspicious_activity_multiple_ips(self, service, mock_db):
        """Test detection of multiple IPs accessing same share link"""
        share_id = str(uuid4())
        
        # Mock accesses from 15 different IPs
        recent_accesses = [
            {
                "ip_address": f"203.0.113.{i}",
                "accessed_at": (datetime.now(timezone.utc) - timedelta(minutes=i)).isoformat(),
                "latitude": None,
                "longitude": None
            }
            for i in range(15)
        ]
        
        mock_db.execute.return_value = Mock(data=recent_accesses)
        
        reasons = await service._detect_suspicious_activity(
            share_id, "203.0.113.1", {}
        )
        
        assert len(reasons) > 0
        assert any(r["type"] == "multiple_ips" for r in reasons)
    
    @pytest.mark.asyncio
    async def test_detect_suspicious_activity_geographic_anomaly(self, service, mock_db):
        """Test detection of geographic anomalies"""
        share_id = str(uuid4())
        ip_address = "203.0.113.1"
        
        # Mock recent access from New York
        recent_accesses = [
            {
                "ip_address": "203.0.113.2",
                "accessed_at": (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat(),
                "latitude": 40.7128,  # New York
                "longitude": -74.0060
            }
        ]
        
        mock_db.execute.return_value = Mock(data=recent_accesses)
        
        # Current access from London (should trigger anomaly)
        geo_info = {
            "latitude": 51.5074,  # London
            "longitude": -0.1278
        }
        
        reasons = await service._detect_suspicious_activity(
            share_id, ip_address, geo_info
        )
        
        assert len(reasons) > 0
        assert any(r["type"] == "geographic_anomaly" for r in reasons)
    
    @pytest.mark.asyncio
    async def test_detect_suspicious_activity_no_issues(self, service, mock_db):
        """Test no suspicious activity detected for normal access"""
        share_id = str(uuid4())
        ip_address = "203.0.113.1"
        
        # Mock normal access pattern (few accesses)
        recent_accesses = [
            {
                "ip_address": ip_address,
                "accessed_at": (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat(),
                "latitude": None,
                "longitude": None
            }
        ]
        
        mock_db.execute.return_value = Mock(data=recent_accesses)
        
        reasons = await service._detect_suspicious_activity(
            share_id, ip_address, {}
        )
        
        assert len(reasons) == 0
    
    # ==================== Analytics Tests ====================
    
    @pytest.mark.asyncio
    async def test_get_share_analytics_success(self, service, mock_db):
        """Test successful analytics retrieval"""
        share_id = str(uuid4())
        
        # Mock access logs
        access_logs = [
            {
                "ip_address": "203.0.113.1",
                "accessed_at": (datetime.now(timezone.utc) - timedelta(days=i)).isoformat(),
                "country_code": "US",
                "accessed_sections": ["overview", "timeline"],
                "session_duration": 120,
                "is_suspicious": False
            }
            for i in range(10)
        ]
        
        mock_db.execute.return_value = Mock(data=access_logs)
        
        analytics = await service.get_share_analytics(share_id)
        
        assert analytics is not None
        assert analytics.total_accesses == 10
        assert analytics.unique_visitors > 0
        assert analytics.unique_countries > 0
        assert len(analytics.access_by_day) > 0
        assert len(analytics.geographic_distribution) > 0
    
    @pytest.mark.asyncio
    async def test_get_share_analytics_no_data(self, service, mock_db):
        """Test analytics with no access logs"""
        share_id = str(uuid4())
        
        mock_db.execute.return_value = Mock(data=[])
        
        analytics = await service.get_share_analytics(share_id)
        
        assert analytics is not None
        assert analytics.total_accesses == 0
        assert analytics.unique_visitors == 0
        assert len(analytics.access_by_day) == 0
    
    @pytest.mark.asyncio
    async def test_get_share_analytics_with_date_range(self, service, mock_db):
        """Test analytics with custom date range"""
        share_id = str(uuid4())
        start_date = datetime.now(timezone.utc) - timedelta(days=7)
        end_date = datetime.now(timezone.utc)
        
        mock_db.execute.return_value = Mock(data=[])
        
        analytics = await service.get_share_analytics(
            share_id,
            start_date=start_date,
            end_date=end_date
        )
        
        assert analytics is not None
        assert mock_db.gte.called
        assert mock_db.lte.called
    
    @pytest.mark.asyncio
    async def test_get_share_analytics_calculates_metrics(self, service, mock_db):
        """Test analytics metric calculations"""
        share_id = str(uuid4())
        
        # Mock diverse access logs
        access_logs = [
            {
                "ip_address": "203.0.113.1",
                "accessed_at": datetime.now(timezone.utc).isoformat(),
                "country_code": "US",
                "accessed_sections": ["overview"],
                "session_duration": 100,
                "is_suspicious": False
            },
            {
                "ip_address": "203.0.113.2",
                "accessed_at": datetime.now(timezone.utc).isoformat(),
                "country_code": "UK",
                "accessed_sections": ["timeline"],
                "session_duration": 200,
                "is_suspicious": True
            },
            {
                "ip_address": "203.0.113.1",  # Same IP as first
                "accessed_at": datetime.now(timezone.utc).isoformat(),
                "country_code": "US",
                "accessed_sections": ["overview", "timeline"],
                "session_duration": 150,
                "is_suspicious": False
            }
        ]
        
        mock_db.execute.return_value = Mock(data=access_logs)
        
        analytics = await service.get_share_analytics(share_id)
        
        assert analytics.total_accesses == 3
        assert analytics.unique_visitors == 2  # Two unique IPs
        assert analytics.unique_countries == 2  # US and UK
        assert analytics.suspicious_activity_count == 1
        assert analytics.average_session_duration == pytest.approx(150, abs=1)
        assert len(analytics.most_viewed_sections) > 0
    
    # ==================== Update Methods Tests ====================
    
    @pytest.mark.asyncio
    async def test_update_access_sections_success(self, service, mock_db):
        """Test successful update of accessed sections"""
        log_id = str(uuid4())
        sections = ["overview", "timeline", "documents"]
        
        mock_db.execute.return_value = Mock(data=[{"id": log_id}])
        
        result = await service.update_access_sections(log_id, sections)
        
        assert result is True
        assert mock_db.update.called
    
    @pytest.mark.asyncio
    async def test_update_access_sections_failure(self, service, mock_db):
        """Test failed update of accessed sections"""
        log_id = str(uuid4())
        
        mock_db.execute.return_value = Mock(data=[])
        
        result = await service.update_access_sections(log_id, ["overview"])
        
        assert result is False
    
    @pytest.mark.asyncio
    async def test_update_session_duration_success(self, service, mock_db):
        """Test successful update of session duration"""
        log_id = str(uuid4())
        duration = 300
        
        mock_db.execute.return_value = Mock(data=[{"id": log_id}])
        
        result = await service.update_session_duration(log_id, duration)
        
        assert result is True
        assert mock_db.update.called
    
    @pytest.mark.asyncio
    async def test_update_session_duration_no_database(self, service):
        """Test session duration update without database"""
        service.db = None
        
        result = await service.update_session_duration(str(uuid4()), 300)
        
        assert result is False
    
    # ==================== Edge Cases and Error Handling ====================
    
    @pytest.mark.asyncio
    async def test_log_access_event_handles_exception(self, service, mock_db):
        """Test access event logging handles exceptions gracefully"""
        mock_db.execute.side_effect = Exception("Database error")
        
        log_id = await service.log_access_event(
            share_id=str(uuid4()),
            ip_address="203.0.113.1",
            user_agent="Mozilla/5.0"
        )
        
        assert log_id is None
    
    @pytest.mark.asyncio
    async def test_get_share_analytics_handles_exception(self, service, mock_db):
        """Test analytics retrieval handles exceptions gracefully"""
        mock_db.execute.side_effect = Exception("Database error")
        
        analytics = await service.get_share_analytics(str(uuid4()))
        
        assert analytics is None
    
    def test_parse_user_agent_handles_exception(self, service):
        """Test user agent parsing handles exceptions gracefully"""
        # This should not crash even with malformed input
        result = service._parse_user_agent("" * 10000)  # Very long string
        
        assert "browser" in result
        assert "os" in result
    
    @pytest.mark.asyncio
    async def test_detect_suspicious_activity_no_database(self, service):
        """Test suspicious activity detection without database"""
        service.db = None
        
        reasons = await service._detect_suspicious_activity(
            str(uuid4()), "203.0.113.1", {}
        )
        
        assert len(reasons) == 0


class TestAccessAnalyticsIntegration:
    """Integration tests for AccessAnalyticsService"""
    
    @pytest.mark.asyncio
    async def test_full_access_logging_workflow(self):
        """Test complete access logging workflow"""
        # This would be an integration test with real database
        # For now, it's a placeholder for future integration testing
        pass
    
    @pytest.mark.asyncio
    async def test_suspicious_activity_alert_workflow(self):
        """Test complete suspicious activity detection and alerting workflow"""
        # This would be an integration test with real database
        # For now, it's a placeholder for future integration testing
        pass


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
