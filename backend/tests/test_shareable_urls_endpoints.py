"""
Unit tests for shareable URLs API endpoints

This test suite validates the share link management endpoints including:
- POST /projects/{id}/shares - Create share link
- GET /projects/{id}/shares - List project shares
- DELETE /shares/{id} - Revoke share link
- PUT /shares/{id}/extend - Extend share link expiry
- GET /projects/{id}/share/{token} - Guest access endpoint

Requirements: 1.1, 1.3, 6.1, 6.2, 6.3, 5.1, 5.3, 7.4
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch, AsyncMock
from uuid import uuid4
from datetime import datetime, timedelta
import sys
import os

# Add backend directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from main import app
from models.shareable_urls import (
    SharePermissionLevel,
    ShareLinkResponse,
    ShareLinkListResponse,
    FilteredProjectData
)


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
    db.insert = Mock(return_value=db)
    db.update = Mock(return_value=db)
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
def sample_project_id():
    """Sample project UUID"""
    return uuid4()


@pytest.fixture
def sample_share_link():
    """Sample share link response"""
    project_id = uuid4()
    share_id = uuid4()
    token = "a" * 64  # 64-character token
    
    return ShareLinkResponse(
        id=str(share_id),
        project_id=str(project_id),
        token=token,
        share_url=f"https://app.orka-ppm.com/projects/{project_id}/share/{token}",
        permission_level="view_only",
        expires_at=datetime.now() + timedelta(days=7),
        is_active=True,
        custom_message="Test share link",
        access_count=0,
        last_accessed_at=None,
        last_accessed_ip=None,
        revoked_at=None,
        revoked_by=None,
        revocation_reason=None,
        created_at=datetime.now(),
        updated_at=datetime.now(),
        created_by=str(uuid4())
    )


# ============================================================================
# Test: POST /projects/{id}/shares - Create Share Link
# ============================================================================

@pytest.mark.asyncio
async def test_create_share_link_success(mock_db, mock_current_user, sample_project_id):
    """
    Test successful share link creation
    
    Requirements: 1.1, 1.3, 6.1
    """
    # Mock database responses
    mock_db.execute.return_value = Mock(data=[{"id": str(sample_project_id), "name": "Test Project"}])
    
    # Mock share link generator
    with patch('routers.shareable_urls.ShareLinkGenerator') as MockGenerator:
        mock_generator = MockGenerator.return_value
        mock_generator.create_share_link = AsyncMock(return_value=ShareLinkResponse(
            id=str(uuid4()),
            project_id=str(sample_project_id),
            token="a" * 64,
            share_url=f"https://app.orka-ppm.com/projects/{sample_project_id}/share/{'a' * 64}",
            permission_level="view_only",
            expires_at=datetime.now() + timedelta(days=7),
            is_active=True,
            custom_message="Test message",
            access_count=0,
            last_accessed_at=None,
            last_accessed_ip=None,
            revoked_at=None,
            revoked_by=None,
            revocation_reason=None,
            created_at=datetime.now(),
            updated_at=datetime.now(),
            created_by=str(uuid4())
        ))
        
        # Mock authentication and database
        with patch('routers.shareable_urls.get_db', return_value=mock_db):
            with patch('routers.shareable_urls.require_permission', return_value=lambda: mock_current_user):
                # Make request
                response = client.post(
                    f"/api/projects/{sample_project_id}/shares",
                    json={
                        "project_id": str(sample_project_id),
                        "permission_level": "view_only",
                        "expiry_duration_days": 7,
                        "custom_message": "Test message"
                    }
                )
                
                # Assertions
                assert response.status_code == 201
                data = response.json()
                assert data["project_id"] == str(sample_project_id)
                assert data["permission_level"] == "view_only"
                assert data["is_active"] is True
                assert len(data["token"]) == 64


@pytest.mark.asyncio
async def test_create_share_link_project_not_found(mock_db, mock_current_user, sample_project_id):
    """
    Test share link creation when project doesn't exist
    
    Requirements: 6.1
    """
    # Mock database to return no project
    mock_db.execute.return_value = Mock(data=[])
    
    with patch('routers.shareable_urls.get_db', return_value=mock_db):
        with patch('routers.shareable_urls.require_permission', return_value=lambda: mock_current_user):
            response = client.post(
                f"/api/projects/{sample_project_id}/shares",
                json={
                    "project_id": str(sample_project_id),
                    "permission_level": "view_only",
                    "expiry_duration_days": 7
                }
            )
            
            assert response.status_code == 404
            assert "not found" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_create_share_link_mismatched_project_id(mock_db, mock_current_user):
    """
    Test share link creation with mismatched project IDs
    
    Requirements: 6.1
    """
    project_id_1 = uuid4()
    project_id_2 = uuid4()
    
    with patch('routers.shareable_urls.get_db', return_value=mock_db):
        with patch('routers.shareable_urls.require_permission', return_value=lambda: mock_current_user):
            response = client.post(
                f"/api/projects/{project_id_1}/shares",
                json={
                    "project_id": str(project_id_2),  # Different ID
                    "permission_level": "view_only",
                    "expiry_duration_days": 7
                }
            )
            
            assert response.status_code == 400
            assert "does not match" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_create_share_link_invalid_expiry_days(mock_db, mock_current_user, sample_project_id):
    """
    Test share link creation with invalid expiry duration
    
    Requirements: 1.3
    """
    with patch('routers.shareable_urls.get_db', return_value=mock_db):
        with patch('routers.shareable_urls.require_permission', return_value=lambda: mock_current_user):
            # Test with 0 days (too short)
            response = client.post(
                f"/api/projects/{sample_project_id}/shares",
                json={
                    "project_id": str(sample_project_id),
                    "permission_level": "view_only",
                    "expiry_duration_days": 0
                }
            )
            assert response.status_code == 422  # Validation error
            
            # Test with 400 days (too long)
            response = client.post(
                f"/api/projects/{sample_project_id}/shares",
                json={
                    "project_id": str(sample_project_id),
                    "permission_level": "view_only",
                    "expiry_duration_days": 400
                }
            )
            assert response.status_code == 422  # Validation error


# ============================================================================
# Test: GET /projects/{id}/shares - List Share Links
# ============================================================================

@pytest.mark.asyncio
async def test_list_share_links_success(mock_db, mock_current_user, sample_project_id, sample_share_link):
    """
    Test successful listing of share links
    
    Requirements: 6.1
    """
    # Mock database responses
    mock_db.execute.return_value = Mock(data=[{"id": str(sample_project_id)}])
    
    # Mock share link generator
    with patch('routers.shareable_urls.ShareLinkGenerator') as MockGenerator:
        mock_generator = MockGenerator.return_value
        mock_generator.list_project_shares = AsyncMock(return_value=ShareLinkListResponse(
            share_links=[sample_share_link],
            total=1,
            active_count=1,
            expired_count=0
        ))
        
        with patch('routers.shareable_urls.get_db', return_value=mock_db):
            with patch('routers.shareable_urls.require_permission', return_value=lambda: mock_current_user):
                response = client.get(f"/api/projects/{sample_project_id}/shares")
                
                assert response.status_code == 200
                data = response.json()
                assert data["total"] == 1
                assert data["active_count"] == 1
                assert data["expired_count"] == 0
                assert len(data["share_links"]) == 1


@pytest.mark.asyncio
async def test_list_share_links_empty(mock_db, mock_current_user, sample_project_id):
    """
    Test listing share links when none exist
    
    Requirements: 6.1
    """
    # Mock database responses
    mock_db.execute.return_value = Mock(data=[{"id": str(sample_project_id)}])
    
    with patch('routers.shareable_urls.ShareLinkGenerator') as MockGenerator:
        mock_generator = MockGenerator.return_value
        mock_generator.list_project_shares = AsyncMock(return_value=ShareLinkListResponse(
            share_links=[],
            total=0,
            active_count=0,
            expired_count=0
        ))
        
        with patch('routers.shareable_urls.get_db', return_value=mock_db):
            with patch('routers.shareable_urls.require_permission', return_value=lambda: mock_current_user):
                response = client.get(f"/api/projects/{sample_project_id}/shares")
                
                assert response.status_code == 200
                data = response.json()
                assert data["total"] == 0
                assert len(data["share_links"]) == 0


# ============================================================================
# Test: DELETE /shares/{id} - Revoke Share Link
# ============================================================================

@pytest.mark.asyncio
async def test_revoke_share_link_success(mock_db, mock_current_user):
    """
    Test successful share link revocation
    
    Requirements: 6.2, 6.3
    """
    share_id = uuid4()
    project_id = uuid4()
    
    # Mock database responses
    mock_db.execute.side_effect = [
        Mock(data=[{"id": str(share_id), "project_id": str(project_id), "created_by": str(uuid4())}]),  # Share link exists
        Mock(data=[{"id": str(project_id)}])  # Project exists
    ]
    
    with patch('routers.shareable_urls.ShareLinkGenerator') as MockGenerator:
        mock_generator = MockGenerator.return_value
        mock_generator.revoke_share_link = AsyncMock(return_value=True)
        
        with patch('routers.shareable_urls.get_db', return_value=mock_db):
            with patch('routers.shareable_urls.require_permission', return_value=lambda: mock_current_user):
                response = client.delete(
                    f"/api/shares/{share_id}?revocation_reason=No longer needed"
                )
                
                assert response.status_code == 204


@pytest.mark.asyncio
async def test_revoke_share_link_not_found(mock_db, mock_current_user):
    """
    Test revoking non-existent share link
    
    Requirements: 6.2
    """
    share_id = uuid4()
    
    # Mock database to return no share link
    mock_db.execute.return_value = Mock(data=[])
    
    with patch('routers.shareable_urls.get_db', return_value=mock_db):
        with patch('routers.shareable_urls.require_permission', return_value=lambda: mock_current_user):
            response = client.delete(
                f"/api/shares/{share_id}?revocation_reason=Test"
            )
            
            assert response.status_code == 404


# ============================================================================
# Test: PUT /shares/{id}/extend - Extend Share Link
# ============================================================================

@pytest.mark.asyncio
async def test_extend_share_link_success(mock_db, mock_current_user, sample_share_link):
    """
    Test successful share link expiry extension
    
    Requirements: 6.3
    """
    share_id = uuid4()
    project_id = uuid4()
    
    # Mock database responses
    mock_db.execute.side_effect = [
        Mock(data=[{"id": str(share_id), "project_id": str(project_id), "is_active": True}]),  # Share link exists
        Mock(data=[{"id": str(project_id)}])  # Project exists
    ]
    
    # Create extended share link
    extended_share = sample_share_link.copy()
    extended_share.expires_at = datetime.now() + timedelta(days=14)
    
    with patch('routers.shareable_urls.ShareLinkGenerator') as MockGenerator:
        mock_generator = MockGenerator.return_value
        mock_generator.extend_expiry = AsyncMock(return_value=extended_share)
        
        with patch('routers.shareable_urls.get_db', return_value=mock_db):
            with patch('routers.shareable_urls.require_permission', return_value=lambda: mock_current_user):
                response = client.put(
                    f"/api/shares/{share_id}/extend",
                    json={"additional_days": 7}
                )
                
                assert response.status_code == 200
                data = response.json()
                assert "expires_at" in data


@pytest.mark.asyncio
async def test_extend_inactive_share_link(mock_db, mock_current_user):
    """
    Test extending an inactive share link (should fail)
    
    Requirements: 6.3
    """
    share_id = uuid4()
    project_id = uuid4()
    
    # Mock database to return inactive share link
    mock_db.execute.return_value = Mock(data=[{
        "id": str(share_id),
        "project_id": str(project_id),
        "is_active": False
    }])
    
    with patch('routers.shareable_urls.get_db', return_value=mock_db):
        with patch('routers.shareable_urls.require_permission', return_value=lambda: mock_current_user):
            response = client.put(
                f"/api/shares/{share_id}/extend",
                json={"additional_days": 7}
            )
            
            assert response.status_code == 400
            assert "inactive" in response.json()["detail"].lower()


# ============================================================================
# Test: GET /projects/{id}/share/{token} - Guest Access
# ============================================================================

@pytest.mark.asyncio
async def test_guest_access_success(mock_db):
    """
    Test successful guest access to shared project
    
    Requirements: 5.1, 5.3, 7.4
    """
    project_id = uuid4()
    share_id = uuid4()
    token = "a" * 64
    
    # Mock guest access controller
    with patch('routers.shareable_urls.GuestAccessController') as MockController:
        mock_controller = MockController.return_value
        
        # Mock validation
        from models.shareable_urls import ShareLinkValidation
        mock_controller.validate_token = AsyncMock(return_value=ShareLinkValidation(
            is_valid=True,
            share_id=str(share_id),
            project_id=str(project_id),
            permission_level="view_only",
            error_message=None
        ))
        
        # Mock rate limit check
        mock_controller.check_rate_limit = Mock(return_value=True)
        
        # Mock filtered project data
        mock_controller.get_filtered_project_data = AsyncMock(return_value=FilteredProjectData(
            id=str(project_id),
            name="Test Project",
            description="Test description",
            status="active",
            progress_percentage=50.0,
            start_date=None,
            end_date=None
        ))
        
        # Mock access logging
        mock_controller.log_access_attempt = AsyncMock(return_value=True)
        
        with patch('routers.shareable_urls.get_db', return_value=mock_db):
            response = client.get(f"/api/projects/{project_id}/share/{token}")
            
            assert response.status_code == 200
            data = response.json()
            assert data["id"] == str(project_id)
            assert data["name"] == "Test Project"


@pytest.mark.asyncio
async def test_guest_access_invalid_token(mock_db):
    """
    Test guest access with invalid token
    
    Requirements: 5.3
    """
    project_id = uuid4()
    token = "invalid_token"
    
    with patch('routers.shareable_urls.GuestAccessController') as MockController:
        mock_controller = MockController.return_value
        
        from models.shareable_urls import ShareLinkValidation
        mock_controller.validate_token = AsyncMock(return_value=ShareLinkValidation(
            is_valid=False,
            share_id=None,
            project_id=None,
            permission_level=None,
            error_message="Invalid share link token"
        ))
        
        with patch('routers.shareable_urls.get_db', return_value=mock_db):
            response = client.get(f"/api/projects/{project_id}/share/{token}")
            
            assert response.status_code == 403
            assert "invalid" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_guest_access_rate_limit_exceeded(mock_db):
    """
    Test guest access when rate limit is exceeded
    
    Requirements: 7.4
    """
    project_id = uuid4()
    share_id = uuid4()
    token = "a" * 64
    
    with patch('routers.shareable_urls.GuestAccessController') as MockController:
        mock_controller = MockController.return_value
        
        from models.shareable_urls import ShareLinkValidation
        mock_controller.validate_token = AsyncMock(return_value=ShareLinkValidation(
            is_valid=True,
            share_id=str(share_id),
            project_id=str(project_id),
            permission_level="view_only",
            error_message=None
        ))
        
        # Mock rate limit exceeded
        mock_controller.check_rate_limit = Mock(return_value=False)
        
        with patch('routers.shareable_urls.get_db', return_value=mock_db):
            response = client.get(f"/api/projects/{project_id}/share/{token}")
            
            assert response.status_code == 429
            assert "rate limit" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_guest_access_expired_link(mock_db):
    """
    Test guest access with expired share link
    
    Requirements: 5.3
    """
    project_id = uuid4()
    share_id = uuid4()
    token = "a" * 64
    
    with patch('routers.shareable_urls.GuestAccessController') as MockController:
        mock_controller = MockController.return_value
        
        from models.shareable_urls import ShareLinkValidation
        mock_controller.validate_token = AsyncMock(return_value=ShareLinkValidation(
            is_valid=False,
            share_id=str(share_id),
            project_id=str(project_id),
            permission_level=None,
            error_message="This share link has expired"
        ))
        
        mock_controller.log_access_attempt = AsyncMock(return_value=True)
        
        with patch('routers.shareable_urls.get_db', return_value=mock_db):
            response = client.get(f"/api/projects/{project_id}/share/{token}")
            
            assert response.status_code == 403
            assert "expired" in response.json()["detail"].lower()


# ============================================================================
# Test: Permission Levels
# ============================================================================

@pytest.mark.asyncio
async def test_different_permission_levels(mock_db):
    """
    Test that different permission levels return appropriate data
    
    Requirements: 2.2, 2.3, 2.4, 5.2
    """
    project_id = uuid4()
    share_id = uuid4()
    token = "a" * 64
    
    permission_levels = ["view_only", "limited_data", "full_project"]
    
    for permission_level in permission_levels:
        with patch('routers.shareable_urls.GuestAccessController') as MockController:
            mock_controller = MockController.return_value
            
            from models.shareable_urls import ShareLinkValidation
            mock_controller.validate_token = AsyncMock(return_value=ShareLinkValidation(
                is_valid=True,
                share_id=str(share_id),
                project_id=str(project_id),
                permission_level=permission_level,
                error_message=None
            ))
            
            mock_controller.check_rate_limit = Mock(return_value=True)
            
            # Create filtered data based on permission level
            filtered_data = FilteredProjectData(
                id=str(project_id),
                name="Test Project",
                description="Test description",
                status="active",
                progress_percentage=50.0,
                start_date=None,
                end_date=None,
                milestones=[{"id": "1", "name": "Milestone 1"}] if permission_level != "view_only" else None,
                team_members=[{"id": "1", "name": "User 1"}] if permission_level != "view_only" else None,
                tasks=[{"id": "1", "name": "Task 1"}] if permission_level == "full_project" else None
            )
            
            mock_controller.get_filtered_project_data = AsyncMock(return_value=filtered_data)
            mock_controller.log_access_attempt = AsyncMock(return_value=True)
            
            with patch('routers.shareable_urls.get_db', return_value=mock_db):
                response = client.get(f"/api/projects/{project_id}/share/{token}")
                
                assert response.status_code == 200
                data = response.json()
                
                # Verify permission-based filtering
                if permission_level == "view_only":
                    assert data.get("milestones") is None
                    assert data.get("tasks") is None
                elif permission_level == "limited_data":
                    assert data.get("milestones") is not None
                    assert data.get("tasks") is None
                elif permission_level == "full_project":
                    assert data.get("milestones") is not None
                    assert data.get("tasks") is not None


@pytest.mark.asyncio
async def test_guest_access_malformed_token(mock_db):
    """
    Test guest access with malformed token (wrong length)
    
    Requirements: 5.3
    """
    project_id = uuid4()
    token = "short_token"  # Too short, should be 64 characters
    
    with patch('routers.shareable_urls.GuestAccessController') as MockController:
        mock_controller = MockController.return_value
        
        from models.shareable_urls import ShareLinkValidation
        mock_controller.validate_token = AsyncMock(return_value=ShareLinkValidation(
            is_valid=False,
            share_id=None,
            project_id=None,
            permission_level=None,
            error_message="Invalid share link token"
        ))
        
        with patch('routers.shareable_urls.get_db', return_value=mock_db):
            response = client.get(f"/api/projects/{project_id}/share/{token}")
            
            assert response.status_code == 403
            assert "invalid" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_guest_access_revoked_token(mock_db):
    """
    Test guest access with revoked share link
    
    Requirements: 5.3, 6.2
    """
    project_id = uuid4()
    share_id = uuid4()
    token = "a" * 64
    
    with patch('routers.shareable_urls.GuestAccessController') as MockController:
        mock_controller = MockController.return_value
        
        from models.shareable_urls import ShareLinkValidation
        mock_controller.validate_token = AsyncMock(return_value=ShareLinkValidation(
            is_valid=False,
            share_id=str(share_id),
            project_id=str(project_id),
            permission_level=None,
            error_message="This share link has been revoked"
        ))
        
        mock_controller.log_access_attempt = AsyncMock(return_value=True)
        
        with patch('routers.shareable_urls.get_db', return_value=mock_db):
            response = client.get(f"/api/projects/{project_id}/share/{token}")
            
            assert response.status_code == 403
            assert "revoked" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_guest_access_project_id_mismatch(mock_db):
    """
    Test guest access when project ID in URL doesn't match token's project
    
    Requirements: 5.3
    """
    project_id_in_url = uuid4()
    project_id_in_token = uuid4()  # Different project ID
    share_id = uuid4()
    token = "a" * 64
    
    with patch('routers.shareable_urls.GuestAccessController') as MockController:
        mock_controller = MockController.return_value
        
        from models.shareable_urls import ShareLinkValidation
        mock_controller.validate_token = AsyncMock(return_value=ShareLinkValidation(
            is_valid=True,
            share_id=str(share_id),
            project_id=str(project_id_in_token),  # Different from URL
            permission_level="view_only",
            error_message=None
        ))
        
        with patch('routers.shareable_urls.get_db', return_value=mock_db):
            response = client.get(f"/api/projects/{project_id_in_url}/share/{token}")
            
            assert response.status_code == 400
            assert "does not match" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_guest_access_project_not_found(mock_db):
    """
    Test guest access when project doesn't exist in database
    
    Requirements: 5.3
    """
    project_id = uuid4()
    share_id = uuid4()
    token = "a" * 64
    
    with patch('routers.shareable_urls.GuestAccessController') as MockController:
        mock_controller = MockController.return_value
        
        from models.shareable_urls import ShareLinkValidation
        mock_controller.validate_token = AsyncMock(return_value=ShareLinkValidation(
            is_valid=True,
            share_id=str(share_id),
            project_id=str(project_id),
            permission_level="view_only",
            error_message=None
        ))
        
        mock_controller.check_rate_limit = Mock(return_value=True)
        
        # Mock get_filtered_project_data to return None (project not found)
        mock_controller.get_filtered_project_data = AsyncMock(return_value=None)
        
        with patch('routers.shareable_urls.get_db', return_value=mock_db):
            response = client.get(f"/api/projects/{project_id}/share/{token}")
            
            assert response.status_code == 404
            assert "not found" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_guest_access_database_unavailable(mock_db):
    """
    Test guest access when database is unavailable
    
    Requirements: 5.3
    """
    project_id = uuid4()
    token = "a" * 64
    
    # Mock get_db to return None (database unavailable)
    with patch('routers.shareable_urls.get_db', return_value=None):
        response = client.get(f"/api/projects/{project_id}/share/{token}")
        
        assert response.status_code == 503
        assert "unavailable" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_guest_access_logs_failed_attempts(mock_db):
    """
    Test that failed access attempts are logged for security monitoring
    
    Requirements: 7.4
    """
    project_id = uuid4()
    share_id = uuid4()
    token = "a" * 64
    
    with patch('routers.shareable_urls.GuestAccessController') as MockController:
        mock_controller = MockController.return_value
        
        from models.shareable_urls import ShareLinkValidation
        mock_controller.validate_token = AsyncMock(return_value=ShareLinkValidation(
            is_valid=False,
            share_id=str(share_id),
            project_id=str(project_id),
            permission_level=None,
            error_message="This share link has expired"
        ))
        
        # Mock log_access_attempt to track if it's called
        mock_controller.log_access_attempt = AsyncMock(return_value=True)
        
        with patch('routers.shareable_urls.get_db', return_value=mock_db):
            response = client.get(f"/api/projects/{project_id}/share/{token}")
            
            assert response.status_code == 403
            
            # Verify that log_access_attempt was called with success=False
            mock_controller.log_access_attempt.assert_called_once()
            call_args = mock_controller.log_access_attempt.call_args
            assert call_args[1]['success'] is False
            assert call_args[1]['share_id'] == str(share_id)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
