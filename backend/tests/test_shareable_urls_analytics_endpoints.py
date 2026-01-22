"""
Unit tests for shareable URLs analytics and monitoring endpoints

This test suite validates the analytics and monitoring endpoints including:
- GET /shares/{id}/analytics - Get share link analytics
- GET /shares/health - Health check endpoint
- POST /shares/tasks/check-expiry - Background task for expiry notifications

Requirements: 4.3, 3.5
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch, AsyncMock
from uuid import uuid4
from datetime import datetime, timedelta, timezone
import sys
import os

# Add backend directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from main import app
from models.shareable_urls import ShareAnalytics


# Test client
client = TestClient(app)


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def mock_db():
    """Mock database client"""
    db = Mock()
    db.table = Mock(return_value=db)
    db.select = Mock(return_value=db)
    db.eq = Mock(return_value=db)
    db.gte = Mock(return_value=db)
    db.lte = Mock(return_value=db)
    db.limit = Mock(return_value=db)
    db.execute = Mock()
    return db


@pytest.fixture
def mock_current_user():
    """Mock authenticated user"""
    return {
        "user_id": str(uuid4()),
        "email": "test@example.com",
        "role": "project_manager"
    }


@pytest.fixture
def sample_share_id():
    """Sample share link UUID"""
    return uuid4()


@pytest.fixture
def sample_project_id():
    """Sample project UUID"""
    return uuid4()


@pytest.fixture
def sample_analytics():
    """Sample analytics data"""
    return ShareAnalytics(
        total_accesses=150,
        unique_visitors=45,
        unique_countries=8,
        access_by_day=[
            {"date": "2024-01-01", "count": 25},
            {"date": "2024-01-02", "count": 30},
            {"date": "2024-01-03", "count": 20}
        ],
        geographic_distribution=[
            {"country": "US", "count": 80},
            {"country": "UK", "count": 40},
            {"country": "CA", "count": 30}
        ],
        most_viewed_sections=[
            {"section": "overview", "count": 120},
            {"section": "milestones", "count": 85},
            {"section": "timeline", "count": 60}
        ],
        average_session_duration=245.5,
        suspicious_activity_count=2
    )


# ============================================================================
# Test: GET /shares/{id}/analytics - Get Share Link Analytics
# ============================================================================

@patch('routers.shareable_urls.get_db')
@patch('routers.shareable_urls.require_permission')
@patch('routers.shareable_urls.AccessAnalyticsService')
def test_get_share_analytics_success(
    mock_analytics_service_class,
    mock_require_permission,
    mock_get_db,
    mock_db,
    mock_current_user,
    sample_share_id,
    sample_project_id,
    sample_analytics
):
    """
    Test successful retrieval of share link analytics.
    
    Requirements: 4.3
    """
    # Setup mocks
    mock_get_db.return_value = mock_db
    mock_require_permission.return_value = lambda: mock_current_user
    
    # Mock database responses
    mock_db.execute.side_effect = [
        # Share link exists
        Mock(data=[{"id": str(sample_share_id), "project_id": str(sample_project_id)}]),
        # Project exists
        Mock(data=[{"id": str(sample_project_id)}])
    ]
    
    # Mock analytics service
    mock_analytics_service = Mock()
    mock_analytics_service.get_share_analytics = AsyncMock(return_value=sample_analytics)
    mock_analytics_service_class.return_value = mock_analytics_service
    
    # Make request
    response = client.get(
        f"/api/shares/{sample_share_id}/analytics",
        headers={"Authorization": "Bearer test_token"}
    )
    
    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert data["total_accesses"] == 150
    assert data["unique_visitors"] == 45
    assert data["unique_countries"] == 8
    assert len(data["access_by_day"]) == 3
    assert len(data["geographic_distribution"]) == 3
    assert data["suspicious_activity_count"] == 2


@patch('routers.shareable_urls.get_db')
@patch('routers.shareable_urls.require_permission')
def test_get_share_analytics_not_found(
    mock_require_permission,
    mock_get_db,
    mock_db,
    mock_current_user,
    sample_share_id
):
    """
    Test analytics retrieval for non-existent share link.
    
    Requirements: 4.3
    """
    # Setup mocks
    mock_get_db.return_value = mock_db
    mock_require_permission.return_value = lambda: mock_current_user
    
    # Mock database response - share link not found
    mock_db.execute.return_value = Mock(data=[])
    
    # Make request
    response = client.get(
        f"/api/shares/{sample_share_id}/analytics",
        headers={"Authorization": "Bearer test_token"}
    )
    
    # Assertions
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


@patch('routers.shareable_urls.get_db')
@patch('routers.shareable_urls.require_permission')
@patch('routers.shareable_urls.AccessAnalyticsService')
def test_get_share_analytics_with_date_range(
    mock_analytics_service_class,
    mock_require_permission,
    mock_get_db,
    mock_db,
    mock_current_user,
    sample_share_id,
    sample_project_id,
    sample_analytics
):
    """
    Test analytics retrieval with custom date range.
    
    Requirements: 4.3
    """
    # Setup mocks
    mock_get_db.return_value = mock_db
    mock_require_permission.return_value = lambda: mock_current_user
    
    # Mock database responses
    mock_db.execute.side_effect = [
        Mock(data=[{"id": str(sample_share_id), "project_id": str(sample_project_id)}]),
        Mock(data=[{"id": str(sample_project_id)}])
    ]
    
    # Mock analytics service
    mock_analytics_service = Mock()
    mock_analytics_service.get_share_analytics = AsyncMock(return_value=sample_analytics)
    mock_analytics_service_class.return_value = mock_analytics_service
    
    # Make request with date range
    start_date = "2024-01-01T00:00:00Z"
    end_date = "2024-01-31T23:59:59Z"
    response = client.get(
        f"/api/shares/{sample_share_id}/analytics?start_date={start_date}&end_date={end_date}",
        headers={"Authorization": "Bearer test_token"}
    )
    
    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert data["total_accesses"] == 150


@patch('routers.shareable_urls.get_db')
@patch('routers.shareable_urls.require_permission')
def test_get_share_analytics_forbidden(
    mock_require_permission,
    mock_get_db,
    mock_db,
    mock_current_user,
    sample_share_id,
    sample_project_id
):
    """
    Test analytics retrieval without project access.
    
    Requirements: 4.3
    """
    # Setup mocks
    mock_get_db.return_value = mock_db
    mock_require_permission.return_value = lambda: mock_current_user
    
    # Mock database responses
    mock_db.execute.side_effect = [
        # Share link exists
        Mock(data=[{"id": str(sample_share_id), "project_id": str(sample_project_id)}]),
        # Project not found (user doesn't have access)
        Mock(data=[])
    ]
    
    # Make request
    response = client.get(
        f"/api/shares/{sample_share_id}/analytics",
        headers={"Authorization": "Bearer test_token"}
    )
    
    # Assertions
    assert response.status_code == 403
    assert "permission" in response.json()["detail"].lower()


# ============================================================================
# Test: GET /shares/health - Health Check Endpoint
# ============================================================================

@patch('routers.shareable_urls.get_db')
def test_health_check_success(mock_get_db, mock_db):
    """
    Test successful health check with all services healthy.
    
    Requirements: 4.3, 3.5
    """
    # Setup mocks
    mock_get_db.return_value = mock_db
    
    # Mock database responses
    mock_db.execute.side_effect = [
        # Database connectivity check
        Mock(data=[{"id": str(uuid4())}]),
        # Active shares count
        Mock(data=[], count=25),
        # Access logs count
        Mock(data=[], count=1500)
    ]
    
    # Make request
    response = client.get("/api/shares/health")
    
    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "timestamp" in data
    assert "checks" in data
    assert data["checks"]["database"]["status"] == "healthy"
    assert data["checks"]["share_link_generator"]["status"] == "healthy"
    assert data["checks"]["guest_access_controller"]["status"] == "healthy"
    assert data["checks"]["analytics_service"]["status"] == "healthy"
    assert data["checks"]["notification_service"]["status"] == "healthy"
    assert "metrics" in data
    assert data["metrics"]["active_share_links"] == 25
    assert data["metrics"]["total_access_logs"] == 1500


@patch('routers.shareable_urls.get_db')
def test_health_check_database_unavailable(mock_get_db):
    """
    Test health check when database is unavailable.
    
    Requirements: 4.3, 3.5
    """
    # Setup mocks - database not available
    mock_get_db.return_value = None
    
    # Make request
    response = client.get("/api/shares/health")
    
    # Assertions - endpoint raises 503 when unhealthy
    assert response.status_code == 503
    # The detail contains the health status dict
    assert "detail" in response.json()


@patch('routers.shareable_urls.get_db')
def test_health_check_database_error(mock_get_db, mock_db):
    """
    Test health check when database query fails.
    
    Requirements: 4.3, 3.5
    """
    # Setup mocks
    mock_get_db.return_value = mock_db
    
    # Mock database error
    mock_db.execute.side_effect = Exception("Database connection error")
    
    # Make request
    response = client.get("/api/shares/health")
    
    # Assertions - endpoint raises 503 when unhealthy
    assert response.status_code == 503
    # The detail contains the health status dict
    assert "detail" in response.json()


# ============================================================================
# Test: POST /shares/tasks/check-expiry - Background Task
# ============================================================================

@patch('routers.shareable_urls.get_db')
@patch('routers.shareable_urls.get_current_user')
@patch('routers.shareable_urls.ShareLinkNotificationService')
def test_check_expiring_share_links_success(
    mock_notification_service_class,
    mock_get_current_user,
    mock_get_db,
    mock_db,
    mock_current_user
):
    """
    Test successful execution of expiry check background task.
    
    Requirements: 3.5
    """
    # Setup mocks
    mock_get_db.return_value = mock_db
    mock_get_current_user.return_value = mock_current_user
    
    # Mock notification service
    mock_notification_service = Mock()
    mock_notification_service.send_expiry_warnings = AsyncMock(return_value=5)
    mock_notification_service_class.return_value = mock_notification_service
    
    # Make request
    response = client.post(
        "/api/shares/tasks/check-expiry",
        headers={"Authorization": "Bearer test_token"}
    )
    
    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["notifications_sent"] == 5
    assert data["hours_before"] == 24
    assert "timestamp" in data


@patch('routers.shareable_urls.get_db')
@patch('routers.shareable_urls.get_current_user')
@patch('routers.shareable_urls.ShareLinkNotificationService')
def test_check_expiring_share_links_custom_hours(
    mock_notification_service_class,
    mock_get_current_user,
    mock_get_db,
    mock_db,
    mock_current_user
):
    """
    Test expiry check with custom hours_before parameter.
    
    Requirements: 3.5
    """
    # Setup mocks
    mock_get_db.return_value = mock_db
    mock_get_current_user.return_value = mock_current_user
    
    # Mock notification service
    mock_notification_service = Mock()
    mock_notification_service.send_expiry_warnings = AsyncMock(return_value=3)
    mock_notification_service_class.return_value = mock_notification_service
    
    # Make request with custom hours
    response = client.post(
        "/api/shares/tasks/check-expiry?hours_before=48",
        headers={"Authorization": "Bearer test_token"}
    )
    
    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["notifications_sent"] == 3
    assert data["hours_before"] == 48


@patch('routers.shareable_urls.get_db')
@patch('routers.shareable_urls.get_current_user')
def test_check_expiring_share_links_database_unavailable(
    mock_get_current_user,
    mock_get_db,
    mock_current_user
):
    """
    Test expiry check when database is unavailable.
    
    Requirements: 3.5
    """
    # Setup mocks
    mock_get_db.return_value = None
    mock_get_current_user.return_value = mock_current_user
    
    # Make request
    response = client.post(
        "/api/shares/tasks/check-expiry",
        headers={"Authorization": "Bearer test_token"}
    )
    
    # Assertions
    assert response.status_code == 503
    assert "unavailable" in response.json()["detail"].lower()


@patch('routers.shareable_urls.get_db')
@patch('routers.shareable_urls.get_current_user')
@patch('routers.shareable_urls.ShareLinkNotificationService')
def test_check_expiring_share_links_no_expiring_links(
    mock_notification_service_class,
    mock_get_current_user,
    mock_get_db,
    mock_db,
    mock_current_user
):
    """
    Test expiry check when no links are expiring.
    
    Requirements: 3.5
    """
    # Setup mocks
    mock_get_db.return_value = mock_db
    mock_get_current_user.return_value = mock_current_user
    
    # Mock notification service - no notifications sent
    mock_notification_service = Mock()
    mock_notification_service.send_expiry_warnings = AsyncMock(return_value=0)
    mock_notification_service_class.return_value = mock_notification_service
    
    # Make request
    response = client.post(
        "/api/shares/tasks/check-expiry",
        headers={"Authorization": "Bearer test_token"}
    )
    
    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["notifications_sent"] == 0


# ============================================================================
# Edge Cases and Error Handling
# ============================================================================

@patch('routers.shareable_urls.get_db')
@patch('routers.shareable_urls.require_permission')
@patch('routers.shareable_urls.AccessAnalyticsService')
def test_get_share_analytics_service_error(
    mock_analytics_service_class,
    mock_require_permission,
    mock_get_db,
    mock_db,
    mock_current_user,
    sample_share_id,
    sample_project_id
):
    """
    Test analytics retrieval when service fails.
    
    Requirements: 4.3
    """
    # Setup mocks
    mock_get_db.return_value = mock_db
    mock_require_permission.return_value = lambda: mock_current_user
    
    # Mock database responses
    mock_db.execute.side_effect = [
        Mock(data=[{"id": str(sample_share_id), "project_id": str(sample_project_id)}]),
        Mock(data=[{"id": str(sample_project_id)}])
    ]
    
    # Mock analytics service - returns None (failure)
    mock_analytics_service = Mock()
    mock_analytics_service.get_share_analytics = AsyncMock(return_value=None)
    mock_analytics_service_class.return_value = mock_analytics_service
    
    # Make request
    response = client.get(
        f"/api/shares/{sample_share_id}/analytics",
        headers={"Authorization": "Bearer test_token"}
    )
    
    # Assertions
    assert response.status_code == 500
    assert "failed" in response.json()["detail"].lower()


@patch('routers.shareable_urls.get_db')
def test_health_check_partial_service_failure(mock_get_db, mock_db):
    """
    Test health check when some services fail but database is healthy.
    
    Requirements: 4.3, 3.5
    """
    # Setup mocks
    mock_get_db.return_value = mock_db
    
    # Mock database responses - database works but metrics fail
    mock_db.execute.side_effect = [
        # Database connectivity check
        Mock(data=[{"id": str(uuid4())}]),
        # Metrics query fails
        Exception("Metrics query error")
    ]
    
    # Make request
    response = client.get("/api/shares/health")
    
    # Assertions
    assert response.status_code == 200
    data = response.json()
    # Should be healthy or degraded, not unhealthy
    assert data["status"] in ["healthy", "degraded"]
    assert data["checks"]["database"]["status"] == "healthy"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
