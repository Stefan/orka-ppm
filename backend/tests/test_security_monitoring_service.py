"""
Unit tests for Security Monitoring Service

Tests suspicious activity detection algorithms, alerting systems,
and security response actions.

Requirements: 4.4, 4.5
"""

import pytest
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from services.security_monitoring_service import SecurityMonitoringService


class TestSecurityMonitoringService:
    """Test suite for SecurityMonitoringService"""
    
    @pytest.fixture
    def mock_db(self):
        """Create a mock database client."""
        db = Mock()
        db.table = Mock(return_value=db)
        db.select = Mock(return_value=db)
        db.eq = Mock(return_value=db)
        db.gte = Mock(return_value=db)
        db.lte = Mock(return_value=db)
        db.order = Mock(return_value=db)
        db.limit = Mock(return_value=db)
        db.insert = Mock(return_value=db)
        db.update = Mock(return_value=db)
        db.execute = Mock(return_value=Mock(data=[]))
        return db
    
    @pytest.fixture
    def security_service(self, mock_db):
        """Create security monitoring service with mock database."""
        with patch('services.security_monitoring_service.ShareLinkNotificationService'):
            return SecurityMonitoringService(db_session=mock_db)
    
    @pytest.mark.asyncio
    async def test_analyze_access_security_no_suspicious_activity(
        self, security_service, mock_db
    ):
        """Test security analysis with no suspicious activity."""
        # Arrange
        share_id = str(uuid4())
        ip_address = "192.168.1.1"
        user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        geo_info = {
            "latitude": 40.7128,
            "longitude": -74.0060,
            "country_code": "US",
            "city": "New York"
        }
        
        # Mock database to return no recent accesses
        mock_db.execute.return_value = Mock(data=[])
        
        # Act
        is_suspicious, reasons, threat_score = await security_service.analyze_access_security(
            share_id, ip_address, user_agent, geo_info
        )
        
        # Assert
        assert is_suspicious is False
        assert len(reasons) == 0
        assert threat_score == 0
    
    @pytest.mark.asyncio
    async def test_analyze_access_security_high_frequency(
        self, security_service, mock_db
    ):
        """Test detection of high frequency access from single IP."""
        # Arrange
        share_id = str(uuid4())
        ip_address = "192.168.1.1"
        user_agent = "Mozilla/5.0"
        geo_info = {}
        
        # Mock database to return many recent accesses from same IP
        recent_accesses = [
            {"id": str(uuid4()), "ip_address": ip_address}
            for _ in range(60)  # Exceeds MAX_ACCESSES_PER_HOUR (50)
        ]
        mock_db.execute.return_value = Mock(data=recent_accesses)
        
        # Act
        is_suspicious, reasons, threat_score = await security_service.analyze_access_security(
            share_id, ip_address, user_agent, geo_info
        )
        
        # Assert
        assert is_suspicious is True
        assert len(reasons) > 0
        assert any(r["type"] == "high_frequency_hourly" for r in reasons)
        assert threat_score >= 30
    
    @pytest.mark.asyncio
    async def test_analyze_access_security_multiple_ips(
        self, security_service, mock_db
    ):
        """Test detection of multiple unique IPs accessing link."""
        # Arrange
        share_id = str(uuid4())
        ip_address = "192.168.1.1"
        user_agent = "Mozilla/5.0"
        geo_info = {}
        
        # Mock database to return accesses from many different IPs
        recent_accesses = [
            {"id": str(uuid4()), "ip_address": f"192.168.1.{i}"}
            for i in range(15)  # Exceeds MAX_UNIQUE_IPS_PER_HOUR (10)
        ]
        mock_db.execute.return_value = Mock(data=recent_accesses)
        
        # Act
        is_suspicious, reasons, threat_score = await security_service.analyze_access_security(
            share_id, ip_address, user_agent, geo_info
        )
        
        # Assert
        assert is_suspicious is True
        assert any(r["type"] == "multiple_ips_hourly" for r in reasons)
        assert threat_score >= 25
    
    @pytest.mark.asyncio
    async def test_analyze_access_security_geographic_anomaly(
        self, security_service, mock_db
    ):
        """Test detection of impossible travel (geographic anomaly)."""
        # Arrange
        share_id = str(uuid4())
        ip_address = "192.168.1.2"
        user_agent = "Mozilla/5.0"
        
        # Current access in Tokyo
        geo_info = {
            "latitude": 35.6762,
            "longitude": 139.6503,
            "country_code": "JP",
            "city": "Tokyo"
        }
        
        # Previous access in New York (10 minutes ago)
        ten_minutes_ago = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
        recent_accesses = [
            {
                "id": str(uuid4()),
                "ip_address": "192.168.1.1",
                "accessed_at": ten_minutes_ago,
                "latitude": 40.7128,
                "longitude": -74.0060
            }
        ]
        mock_db.execute.return_value = Mock(data=recent_accesses)
        
        # Act
        is_suspicious, reasons, threat_score = await security_service.analyze_access_security(
            share_id, ip_address, user_agent, geo_info
        )
        
        # Assert
        assert is_suspicious is True
        assert any(r["type"] == "geographic_anomaly" for r in reasons)
        assert any(r["severity"] == "critical" for r in reasons)
        assert threat_score >= 40
    
    @pytest.mark.asyncio
    async def test_analyze_access_security_bot_detection(
        self, security_service, mock_db
    ):
        """Test detection of bot user agents."""
        # Arrange
        share_id = str(uuid4())
        ip_address = "192.168.1.1"
        user_agent = "python-requests/2.28.0"  # Bot user agent
        geo_info = {}
        
        mock_db.execute.return_value = Mock(data=[])
        
        # Act
        is_suspicious, reasons, threat_score = await security_service.analyze_access_security(
            share_id, ip_address, user_agent, geo_info
        )
        
        # Assert
        assert is_suspicious is True
        assert any(r["type"] == "bot_user_agent" for r in reasons)
        assert threat_score >= 20
    
    @pytest.mark.asyncio
    async def test_analyze_access_security_missing_user_agent(
        self, security_service, mock_db
    ):
        """Test detection of missing user agent."""
        # Arrange
        share_id = str(uuid4())
        ip_address = "192.168.1.1"
        user_agent = None
        geo_info = {}
        
        mock_db.execute.return_value = Mock(data=[])
        
        # Act
        is_suspicious, reasons, threat_score = await security_service.analyze_access_security(
            share_id, ip_address, user_agent, geo_info
        )
        
        # Assert
        assert is_suspicious is True
        assert any(r["type"] == "missing_user_agent" for r in reasons)
        assert threat_score >= 10
    
    @pytest.mark.asyncio
    async def test_handle_suspicious_activity_low_threat(
        self, security_service, mock_db
    ):
        """Test handling of low-threat suspicious activity."""
        # Arrange
        share_id = str(uuid4())
        ip_address = "192.168.1.1"
        suspicious_reasons = [
            {
                "type": "missing_user_agent",
                "description": "No user agent provided",
                "severity": "low"
            }
        ]
        threat_score = 10
        geo_info = {"country_code": "US", "city": "New York"}
        
        # Mock database responses
        mock_db.execute.return_value = Mock(data=[{"id": str(uuid4())}])
        
        # Mock notification service
        security_service.notification_service.send_suspicious_activity_alert = AsyncMock(
            return_value=True
        )
        
        # Act
        result = await security_service.handle_suspicious_activity(
            share_id, ip_address, suspicious_reasons, threat_score, geo_info
        )
        
        # Assert
        assert result["success"] is True
        assert "security_event_logged" in result["actions_taken"]
        assert "creator_notified" in result["actions_taken"]
        assert "link_auto_suspended" not in result["actions_taken"]
        assert result["auto_suspended"] is False
    
    @pytest.mark.asyncio
    async def test_handle_suspicious_activity_high_threat_auto_suspend(
        self, security_service, mock_db
    ):
        """Test auto-suspension for high-threat activity."""
        # Arrange
        share_id = str(uuid4())
        ip_address = "192.168.1.1"
        suspicious_reasons = [
            {
                "type": "geographic_anomaly",
                "description": "Impossible travel detected",
                "severity": "critical"
            },
            {
                "type": "high_frequency_hourly",
                "description": "Excessive accesses",
                "severity": "high"
            }
        ]
        threat_score = 80  # Exceeds AUTO_SUSPEND_SCORE_THRESHOLD (75)
        geo_info = {"country_code": "US", "city": "New York"}
        
        # Mock database responses
        mock_db.execute.return_value = Mock(data=[{"id": str(uuid4())}])
        
        # Mock notification service
        security_service.notification_service.send_suspicious_activity_alert = AsyncMock(
            return_value=True
        )
        
        # Act
        result = await security_service.handle_suspicious_activity(
            share_id, ip_address, suspicious_reasons, threat_score, geo_info
        )
        
        # Assert
        assert result["success"] is True
        assert "link_auto_suspended" in result["actions_taken"]
        assert result["auto_suspended"] is True
        
        # Verify link was suspended
        mock_db.table.assert_any_call("project_shares")
        mock_db.update.assert_called()
    
    @pytest.mark.asyncio
    async def test_get_security_alerts_with_filters(
        self, security_service, mock_db
    ):
        """Test retrieving security alerts with filters."""
        # Arrange
        alert_id = str(uuid4())
        alerts_data = [
            {
                "id": alert_id,
                "share_id": str(uuid4()),
                "alert_type": "suspicious_activity",
                "status": "pending_review",
                "severity": "high",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        ]
        mock_db.execute.return_value = Mock(data=alerts_data)
        
        # Act
        alerts = await security_service.get_security_alerts(
            status="pending_review",
            severity="high",
            limit=50
        )
        
        # Assert
        assert len(alerts) == 1
        assert alerts[0]["id"] == alert_id
        assert alerts[0]["status"] == "pending_review"
        assert alerts[0]["severity"] == "high"
    
    @pytest.mark.asyncio
    async def test_resolve_security_alert(
        self, security_service, mock_db
    ):
        """Test resolving a security alert."""
        # Arrange
        alert_id = str(uuid4())
        reviewed_by = str(uuid4())
        resolution = "False positive - legitimate user"
        action_taken = "no_action"
        
        mock_db.execute.return_value = Mock(data=[{"id": alert_id}])
        
        # Act
        success = await security_service.resolve_security_alert(
            alert_id, reviewed_by, resolution, action_taken
        )
        
        # Assert
        assert success is True
        mock_db.table.assert_called_with("share_security_alerts")
        mock_db.update.assert_called()
    
    @pytest.mark.asyncio
    async def test_calculate_distance(self, security_service):
        """Test geographic distance calculation."""
        # Arrange - New York to Los Angeles
        lat1, lon1 = 40.7128, -74.0060  # New York
        lat2, lon2 = 34.0522, -118.2437  # Los Angeles
        
        # Act
        distance = security_service._calculate_distance(lat1, lon1, lat2, lon2)
        
        # Assert
        # Approximate distance is ~3,944 km
        assert 3900 < distance < 4000
    
    @pytest.mark.asyncio
    async def test_calculate_severity(self, security_service):
        """Test severity calculation from threat score."""
        # Act & Assert
        assert security_service._calculate_severity(10) == "low"
        assert security_service._calculate_severity(30) == "medium"
        assert security_service._calculate_severity(60) == "high"
        assert security_service._calculate_severity(80) == "critical"
    
    @pytest.mark.asyncio
    async def test_check_access_pattern_anomaly_short_sessions(
        self, security_service, mock_db
    ):
        """Test detection of short session patterns."""
        # Arrange
        share_id = str(uuid4())
        ip_address = "192.168.1.1"
        
        # Mock recent accesses with very short sessions
        recent_accesses = [
            {
                "id": str(uuid4()),
                "session_duration": 2,
                "accessed_sections": []
            }
            for _ in range(5)
        ]
        mock_db.execute.return_value = Mock(data=recent_accesses)
        
        # Act
        result = await security_service._check_access_pattern_anomaly(
            share_id, ip_address
        )
        
        # Assert
        assert result is not None
        reason, score = result
        assert reason["type"] == "short_session_pattern"
        assert score >= 10
    
    @pytest.mark.asyncio
    async def test_check_time_pattern_anomaly_odd_hours(
        self, security_service, mock_db
    ):
        """Test detection of odd-hours access pattern."""
        # Arrange
        share_id = str(uuid4())
        
        # Mock accesses mostly during midnight-5am
        base_time = datetime.now(timezone.utc).replace(hour=2, minute=0, second=0)
        recent_accesses = [
            {
                "id": str(uuid4()),
                "accessed_at": (base_time + timedelta(minutes=i*10)).isoformat()
            }
            for i in range(15)  # 15 accesses during odd hours
        ]
        mock_db.execute.return_value = Mock(data=recent_accesses)
        
        # Act
        result = await security_service._check_time_pattern_anomaly(share_id)
        
        # Assert
        assert result is not None
        reason, score = result
        assert reason["type"] == "odd_hours_pattern"
        assert score >= 10


class TestSecurityMonitoringIntegration:
    """Integration tests for security monitoring"""
    
    @pytest.mark.asyncio
    async def test_full_security_workflow(self):
        """Test complete security monitoring workflow."""
        # Arrange
        mock_db = Mock()
        mock_db.table = Mock(return_value=mock_db)
        mock_db.select = Mock(return_value=mock_db)
        mock_db.eq = Mock(return_value=mock_db)
        mock_db.gte = Mock(return_value=mock_db)
        mock_db.insert = Mock(return_value=mock_db)
        mock_db.update = Mock(return_value=mock_db)
        mock_db.execute = Mock(return_value=Mock(data=[]))
        
        with patch('services.security_monitoring_service.ShareLinkNotificationService'):
            security_service = SecurityMonitoringService(db_session=mock_db)
            
            # Simulate suspicious access
            share_id = str(uuid4())
            ip_address = "192.168.1.1"
            user_agent = "curl/7.68.0"  # Bot user agent
            geo_info = {"country_code": "US", "city": "New York"}
            
            # Act - Analyze security
            is_suspicious, reasons, threat_score = await security_service.analyze_access_security(
                share_id, ip_address, user_agent, geo_info
            )
            
            # Assert
            assert is_suspicious is True
            assert len(reasons) > 0
            
            # Act - Handle suspicious activity
            mock_db.execute.return_value = Mock(data=[{"id": str(uuid4())}])
            security_service.notification_service.send_suspicious_activity_alert = AsyncMock(
                return_value=True
            )
            
            result = await security_service.handle_suspicious_activity(
                share_id, ip_address, reasons, threat_score, geo_info
            )
            
            # Assert
            assert result["success"] is True
            assert len(result["actions_taken"]) > 0
