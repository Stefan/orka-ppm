"""
Unit tests for Security Monitoring API Endpoints

Tests the security monitoring REST API endpoints for admin access.

Requirements: 4.4, 4.5
"""

import pytest
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime, timezone
from uuid import uuid4
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


class TestSecurityMonitoringEndpoints:
    """Test suite for security monitoring API endpoints"""
    
    @pytest.fixture
    def mock_current_user(self):
        """Mock authenticated admin user."""
        return {
            "id": str(uuid4()),
            "email": "admin@example.com",
            "role": "admin"
        }
    
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
        db.update = Mock(return_value=db)
        db.execute = Mock(return_value=Mock(data=[]))
        return db
    
    @patch('routers.shareable_urls.get_db')
    @patch('routers.shareable_urls.require_permission')
    @patch('routers.shareable_urls.SecurityMonitoringService')
    def test_get_security_alerts_success(
        self,
        mock_security_service_class,
        mock_require_permission,
        mock_get_db,
        mock_db,
        mock_current_user
    ):
        """Test successful retrieval of security alerts."""
        # Arrange
        mock_get_db.return_value = mock_db
        mock_require_permission.return_value = lambda: mock_current_user
        
        alert_id = str(uuid4())
        alerts_data = [
            {
                "id": alert_id,
                "share_id": str(uuid4()),
                "alert_type": "suspicious_activity",
                "ip_address": "192.168.1.1",
                "threat_score": 50,
                "severity": "high",
                "status": "pending_review",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        ]
        
        mock_security_service = mock_security_service_class.return_value
        mock_security_service.get_security_alerts = AsyncMock(return_value=alerts_data)
        
        # Act
        response = client.get(
            "/api/admin/security/alerts?status=pending_review&severity=high"
        )
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert "alerts" in data
        assert len(data["alerts"]) == 1
        assert data["alerts"][0]["id"] == alert_id

    
    @patch('routers.shareable_urls.get_db')
    @patch('routers.shareable_urls.require_permission')
    @patch('routers.shareable_urls.SecurityMonitoringService')
    def test_resolve_security_alert_success(
        self,
        mock_security_service_class,
        mock_require_permission,
        mock_get_db,
        mock_db,
        mock_current_user
    ):
        """Test successful resolution of security alert."""
        # Arrange
        mock_get_db.return_value = mock_db
        mock_require_permission.return_value = lambda: mock_current_user
        
        alert_id = str(uuid4())
        
        mock_security_service = mock_security_service_class.return_value
        mock_security_service.resolve_security_alert = AsyncMock(return_value=True)
        
        # Act
        response = client.post(
            f"/api/admin/security/alerts/{alert_id}/resolve",
            json={
                "resolution": "False positive - legitimate user",
                "action_taken": "no_action"
            }
        )
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["alert_id"] == alert_id
    
    @patch('routers.shareable_urls.get_db')
    @patch('routers.shareable_urls.require_permission')
    def test_get_security_events_success(
        self,
        mock_require_permission,
        mock_get_db,
        mock_db,
        mock_current_user
    ):
        """Test successful retrieval of security events."""
        # Arrange
        mock_get_db.return_value = mock_db
        mock_require_permission.return_value = lambda: mock_current_user
        
        event_id = str(uuid4())
        events_data = [
            {
                "id": event_id,
                "share_id": str(uuid4()),
                "event_type": "suspicious_activity",
                "ip_address": "192.168.1.1",
                "threat_score": 45,
                "severity": "medium",
                "detected_at": datetime.now(timezone.utc).isoformat()
            }
        ]
        
        mock_db.execute.return_value = Mock(data=events_data)
        
        # Act
        response = client.get("/api/admin/security/events?severity=medium")
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert "events" in data
        assert len(data["events"]) == 1
        assert data["events"][0]["id"] == event_id
    
    @patch('routers.shareable_urls.get_db')
    @patch('routers.shareable_urls.require_permission')
    def test_manually_suspend_share_link_success(
        self,
        mock_require_permission,
        mock_get_db,
        mock_db,
        mock_current_user
    ):
        """Test manual suspension of share link."""
        # Arrange
        mock_get_db.return_value = mock_db
        mock_require_permission.return_value = lambda: mock_current_user
        
        share_id = str(uuid4())
        
        # Mock share link exists and is active
        mock_db.execute.side_effect = [
            Mock(data=[{"id": share_id, "is_active": True}]),  # Select
            Mock(data=[{"id": share_id, "is_active": False}])  # Update
        ]
        
        # Act
        response = client.post(
            f"/api/admin/security/shares/{share_id}/suspend",
            json={"reason": "Suspicious activity detected"}
        )
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["share_id"] == share_id
    
    @patch('routers.shareable_urls.get_db')
    @patch('routers.shareable_urls.require_permission')
    def test_get_security_dashboard_success(
        self,
        mock_require_permission,
        mock_get_db,
        mock_db,
        mock_current_user
    ):
        """Test successful retrieval of security dashboard data."""
        # Arrange
        mock_get_db.return_value = mock_db
        mock_require_permission.return_value = lambda: mock_current_user
        
        # Mock alerts and events data
        alerts_data = [
            {
                "status": "pending_review",
                "severity": "high"
            },
            {
                "status": "resolved",
                "severity": "medium"
            }
        ]
        
        events_data = [
            {
                "detected_at": datetime.now(timezone.utc).isoformat(),
                "threat_score": 50,
                "severity": "high",
                "ip_address": "192.168.1.1"
            }
        ]
        
        mock_db.execute.side_effect = [
            Mock(data=alerts_data),  # Alerts query
            Mock(data=events_data)   # Events query
        ]
        
        # Act
        response = client.get("/api/admin/security/dashboard?days=7")
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert "period" in data
        assert "alert_summary" in data
        assert "event_summary" in data
        assert data["alert_summary"]["total_alerts"] == 2
