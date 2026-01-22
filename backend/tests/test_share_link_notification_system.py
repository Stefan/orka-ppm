"""
Unit tests for Share Link Notification System

Tests email template generation, notification timing, and delivery.
Covers requirements 8.1, 8.2, 8.3, 8.4, 3.5
"""

import pytest
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from services.share_link_notification_service import ShareLinkNotificationService
from services.share_link_email_templates import ShareLinkEmailTemplates
from models.shareable_urls import SharePermissionLevel


class TestEmailTemplateGeneration:
    """Test email template generation and content."""
    
    @pytest.fixture
    def email_templates(self):
        """Create email templates instance."""
        return ShareLinkEmailTemplates(
            company_name="Test Company",
            support_email="support@test.com"
        )
    
    def test_generate_share_link_email_basic(self, email_templates):
        """Test basic share link email generation."""
        # Arrange
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        
        # Act
        email = email_templates.generate_share_link_email(
            recipient_email="user@example.com",
            project_name="Test Project",
            share_url="https://app.test.com/share/abc123",
            permission_level=SharePermissionLevel.VIEW_ONLY,
            expires_at=expires_at
        )
        
        # Assert
        assert email["subject"] == "Project Access: Test Project"
        assert email["to"] == "user@example.com"
        assert "Test Project" in email["html"]
        assert "Test Project" in email["text"]
        assert "https://app.test.com/share/abc123" in email["html"]
        assert "View Only" in email["html"]

    def test_generate_share_link_email_with_custom_message(self, email_templates):
        """Test share link email with custom message."""
        # Arrange
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        custom_message = "Please review the project status by Friday."
        
        # Act
        email = email_templates.generate_share_link_email(
            recipient_email="user@example.com",
            project_name="Test Project",
            share_url="https://app.test.com/share/abc123",
            permission_level=SharePermissionLevel.LIMITED_DATA,
            expires_at=expires_at,
            custom_message=custom_message,
            sender_name="John Doe"
        )
        
        # Assert
        assert custom_message in email["html"]
        assert custom_message in email["text"]
        assert "John Doe" in email["html"]
        assert "Limited Data" in email["html"]
    
    def test_generate_share_link_email_full_project_permission(self, email_templates):
        """Test share link email with full project permission."""
        # Arrange
        expires_at = datetime.now(timezone.utc) + timedelta(days=30)
        
        # Act
        email = email_templates.generate_share_link_email(
            recipient_email="user@example.com",
            project_name="Important Project",
            share_url="https://app.test.com/share/xyz789",
            permission_level=SharePermissionLevel.FULL_PROJECT,
            expires_at=expires_at
        )
        
        # Assert
        assert "Full Project" in email["html"]
        assert "comprehensive project information" in email["html"]
    
    def test_generate_expiry_warning_email(self, email_templates):
        """Test expiry warning email generation."""
        # Arrange
        expires_at = datetime.now(timezone.utc) + timedelta(hours=12)
        
        # Act
        email = email_templates.generate_expiry_warning_email(
            recipient_email="creator@example.com",
            project_name="Test Project",
            share_url="https://app.test.com/share/abc123",
            expires_at=expires_at,
            hours_remaining=12
        )
        
        # Assert
        assert "⏰" in email["subject"]
        assert "Expiring Soon" in email["subject"]
        assert "Test Project" in email["html"]
        assert "12 hours" in email["html"]
        assert "Manage Share Links" in email["html"]
    
    def test_generate_first_access_notification(self, email_templates):
        """Test first access notification email generation."""
        # Arrange
        accessed_at = datetime.now(timezone.utc)
        
        # Act
        email = email_templates.generate_first_access_notification(
            recipient_email="creator@example.com",
            project_name="Test Project",
            accessed_at=accessed_at,
            ip_address="192.168.1.1",
            location="San Francisco, US"
        )
        
        # Assert
        assert "✓" in email["subject"]
        assert "Accessed" in email["subject"]
        assert "Test Project" in email["html"]
        assert "192.168.1.1" in email["html"]
        assert "San Francisco, US" in email["html"]
    
    def test_generate_first_access_notification_no_location(self, email_templates):
        """Test first access notification without location data."""
        # Arrange
        accessed_at = datetime.now(timezone.utc)
        
        # Act
        email = email_templates.generate_first_access_notification(
            recipient_email="creator@example.com",
            project_name="Test Project",
            accessed_at=accessed_at,
            ip_address="192.168.1.1"
        )
        
        # Assert
        assert "192.168.1.1" in email["html"]
        # Should not crash without location
        assert email["html"] is not None
    
    def test_generate_weekly_summary_email(self, email_templates):
        """Test weekly summary email generation."""
        # Arrange
        start_date = datetime.now(timezone.utc) - timedelta(days=7)
        end_date = datetime.now(timezone.utc)
        
        summary_data = {
            "projects": [
                {"name": "Project A", "accesses": 15, "unique_visitors": 5},
                {"name": "Project B", "accesses": 8, "unique_visitors": 3}
            ],
            "total_accesses": 23,
            "unique_visitors": 8,
            "period_start": start_date,
            "period_end": end_date
        }
        
        # Act
        email = email_templates.generate_weekly_summary_email(
            recipient_email="manager@example.com",
            summary_data=summary_data
        )
        
        # Assert
        assert "📊" in email["subject"]
        assert "Weekly" in email["subject"]
        assert "Project A" in email["html"]
        assert "Project B" in email["html"]
        assert "23" in email["html"]  # Total accesses
        assert "8" in email["html"]   # Unique visitors
    
    def test_generate_weekly_summary_email_no_activity(self, email_templates):
        """Test weekly summary email with no activity."""
        # Arrange
        start_date = datetime.now(timezone.utc) - timedelta(days=7)
        end_date = datetime.now(timezone.utc)
        
        summary_data = {
            "projects": [],
            "total_accesses": 0,
            "unique_visitors": 0,
            "period_start": start_date,
            "period_end": end_date
        }
        
        # Act
        email = email_templates.generate_weekly_summary_email(
            recipient_email="manager@example.com",
            summary_data=summary_data
        )
        
        # Assert
        assert "No share link activity" in email["html"]
    
    def test_generate_link_revoked_email(self, email_templates):
        """Test link revoked notification email generation."""
        # Act
        email = email_templates.generate_link_revoked_email(
            recipient_email="user@example.com",
            project_name="Test Project",
            revoked_by="Admin User",
            revocation_reason="Security policy update"
        )
        
        # Assert
        assert "Revoked" in email["subject"]
        assert "Test Project" in email["html"]
        assert "Admin User" in email["html"]
        assert "Security policy update" in email["html"]
    
    def test_generate_link_revoked_email_no_reason(self, email_templates):
        """Test link revoked email without reason."""
        # Act
        email = email_templates.generate_link_revoked_email(
            recipient_email="user@example.com",
            project_name="Test Project",
            revoked_by="Admin User"
        )
        
        # Assert
        assert "Test Project" in email["html"]
        assert "Admin User" in email["html"]
        # Should not crash without reason
        assert email["html"] is not None
    
    def test_permission_descriptions(self, email_templates):
        """Test permission level descriptions."""
        # Act & Assert
        view_only_desc = email_templates.get_permission_description(SharePermissionLevel.VIEW_ONLY)
        assert "basic project information" in view_only_desc.lower()
        
        limited_data_desc = email_templates.get_permission_description(SharePermissionLevel.LIMITED_DATA)
        assert "milestones" in limited_data_desc.lower()
        
        full_project_desc = email_templates.get_permission_description(SharePermissionLevel.FULL_PROJECT)
        assert "comprehensive" in full_project_desc.lower()


class TestNotificationTiming:
    """Test notification timing and delivery logic."""
    
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
        db.execute = Mock(return_value=Mock(data=[]))
        return db
    
    @pytest.fixture
    def notification_service(self, mock_db):
        """Create notification service with mock database."""
        return ShareLinkNotificationService(db_session=mock_db)
    
    @pytest.mark.asyncio
    async def test_send_expiry_warnings_24_hours(self, notification_service, mock_db):
        """Test expiry warnings sent 24 hours before expiration."""
        # Arrange
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(hours=23)  # Within 24 hour window
        
        share_id = str(uuid4())
        project_id = str(uuid4())
        creator_id = str(uuid4())
        
        mock_shares = [{
            "id": share_id,
            "project_id": project_id,
            "token": "test_token",
            "created_by": creator_id,
            "expires_at": expires_at.isoformat(),
            "permission_level": "view_only",
            "custom_message": None
        }]
        
        mock_project = [{"name": "Test Project", "description": "Test"}]
        mock_creator = [{
            "email": "creator@example.com",
            "raw_user_meta_data": {"full_name": "Test Creator"}
        }]
        
        call_count = [0]
        
        def mock_execute():
            call_count[0] += 1
            if call_count[0] == 1:
                return Mock(data=mock_shares)
            elif call_count[0] == 2:
                return Mock(data=mock_project)
            elif call_count[0] == 3:
                return Mock(data=mock_creator)
            else:
                return Mock(data=[{"id": str(uuid4())}])
        
        mock_db.execute = mock_execute
        
        # Act
        result = await notification_service.send_expiry_warnings(hours_before=24)
        
        # Assert
        assert result == 1
    
    @pytest.mark.asyncio
    async def test_send_expiry_warnings_custom_window(self, notification_service, mock_db):
        """Test expiry warnings with custom time window."""
        # Arrange
        mock_db.execute = Mock(return_value=Mock(data=[]))
        
        # Act
        result = await notification_service.send_expiry_warnings(hours_before=48)
        
        # Assert
        assert result == 0
        # Verify the time window was used correctly
        assert mock_db.gte.called
        assert mock_db.lte.called

    @pytest.mark.asyncio
    async def test_first_access_notification_only_once(self, notification_service, mock_db):
        """Test first access notification sent only on first access."""
        # Arrange
        share_id = str(uuid4())
        
        # Mock access count > 1 (not first access)
        mock_db.execute = Mock(return_value=Mock(count=2, data=[]))
        
        # Act
        result = await notification_service.send_first_access_notification(
            share_id=share_id,
            ip_address="192.168.1.1",
            accessed_at=datetime.now(timezone.utc)
        )
        
        # Assert
        assert result is False  # Should not send notification
    
    @pytest.mark.asyncio
    async def test_weekly_summary_date_range(self, notification_service, mock_db):
        """Test weekly summary uses correct date range."""
        # Arrange
        mock_db.execute = Mock(return_value=Mock(data=[]))
        
        # Act
        result = await notification_service.send_weekly_summaries()
        
        # Assert
        assert result == 0
        # Verify table was queried
        assert mock_db.table.called


class TestNotificationDelivery:
    """Test notification delivery and error handling."""
    
    @pytest.fixture
    def mock_db(self):
        """Create mock database client."""
        db = Mock()
        db.table = Mock(return_value=db)
        db.select = Mock(return_value=db)
        db.eq = Mock(return_value=db)
        db.insert = Mock(return_value=db)
        db.execute = Mock(return_value=Mock(data=[]))
        return db
    
    @pytest.fixture
    def notification_service(self, mock_db):
        """Create notification service with mock database."""
        return ShareLinkNotificationService(db_session=mock_db)
    
    @pytest.mark.asyncio
    async def test_send_share_link_email_success(self, notification_service, mock_db):
        """Test successful share link email sending."""
        # Arrange
        share_id = str(uuid4())
        project_id = str(uuid4())
        
        mock_share = [{
            "id": share_id,
            "project_id": project_id,
            "token": "abc123",
            "permission_level": "view_only",
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
            "custom_message": "Please review"
        }]
        
        mock_project = [{"name": "Test Project", "description": "Test"}]
        
        call_count = [0]
        
        def mock_execute():
            call_count[0] += 1
            if call_count[0] == 1:
                return Mock(data=mock_share)
            elif call_count[0] == 2:
                return Mock(data=mock_project)
            else:
                return Mock(data=[{"id": str(uuid4())}])
        
        mock_db.execute = mock_execute
        
        # Act
        result = await notification_service.send_share_link_email(
            share_id=share_id,
            recipient_email="user@example.com",
            sender_name="John Doe"
        )
        
        # Assert
        assert result is True
        assert mock_db.insert.called
    
    @pytest.mark.asyncio
    async def test_send_share_link_email_invalid_share(self, notification_service, mock_db):
        """Test share link email with invalid share ID."""
        # Arrange
        mock_db.execute = Mock(return_value=Mock(data=[]))
        
        # Act
        result = await notification_service.send_share_link_email(
            share_id=str(uuid4()),
            recipient_email="user@example.com"
        )
        
        # Assert
        assert result is False
    
    @pytest.mark.asyncio
    async def test_send_link_revoked_notification_success(self, notification_service, mock_db):
        """Test successful link revoked notification."""
        # Arrange
        share_id = str(uuid4())
        project_id = str(uuid4())
        
        mock_share = [{"project_id": project_id}]
        mock_project = [{"name": "Test Project"}]
        
        call_count = [0]
        
        def mock_execute():
            call_count[0] += 1
            if call_count[0] == 1:
                return Mock(data=mock_share)
            elif call_count[0] == 2:
                return Mock(data=mock_project)
            else:
                return Mock(data=[{"id": str(uuid4())}])
        
        mock_db.execute = mock_execute
        
        # Act
        result = await notification_service.send_link_revoked_notification(
            share_id=share_id,
            recipient_email="user@example.com",
            revoked_by_name="Admin User",
            revocation_reason="Security policy"
        )
        
        # Assert
        assert result is True
        assert mock_db.insert.called
    
    @pytest.mark.asyncio
    async def test_notification_error_handling(self, notification_service, mock_db):
        """Test notification error handling."""
        # Arrange
        mock_db.execute = Mock(side_effect=Exception("Database error"))
        
        # Act
        result = await notification_service.send_expiry_warnings()
        
        # Assert
        assert result == 0  # Should return 0 on error, not crash
    
    @pytest.mark.asyncio
    async def test_email_queue_insertion(self, notification_service, mock_db):
        """Test email is properly queued for delivery."""
        # Arrange
        share_id = str(uuid4())
        project_id = str(uuid4())
        
        mock_share = [{
            "id": share_id,
            "project_id": project_id,
            "token": "abc123",
            "permission_level": "limited_data",
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
            "custom_message": None
        }]
        
        mock_project = [{"name": "Test Project", "description": "Test"}]
        
        call_count = [0]
        inserted_data = []
        
        def mock_execute():
            call_count[0] += 1
            if call_count[0] == 1:
                return Mock(data=mock_share)
            elif call_count[0] == 2:
                return Mock(data=mock_project)
            else:
                return Mock(data=[{"id": str(uuid4())}])
        
        def mock_insert(data):
            inserted_data.append(data)
            return mock_db
        
        mock_db.execute = mock_execute
        mock_db.insert = mock_insert
        
        # Act
        await notification_service.send_share_link_email(
            share_id=share_id,
            recipient_email="user@example.com"
        )
        
        # Assert
        assert len(inserted_data) > 0
        email_data = inserted_data[0]
        assert email_data["recipient_email"] == "user@example.com"
        assert email_data["notification_type"] == "share_link_created"
        assert email_data["status"] == "pending"


class TestNotificationPreferences:
    """Test notification preferences and opt-out functionality."""
    
    @pytest.fixture
    def mock_db(self):
        """Create mock database client."""
        db = Mock()
        db.table = Mock(return_value=db)
        db.select = Mock(return_value=db)
        db.eq = Mock(return_value=db)
        db.execute = Mock(return_value=Mock(data=[]))
        return db
    
    @pytest.fixture
    def notification_service(self, mock_db):
        """Create notification service with mock database."""
        return ShareLinkNotificationService(db_session=mock_db)
    
    @pytest.mark.asyncio
    async def test_notification_logging(self, notification_service, mock_db):
        """Test notification events are logged."""
        # Arrange
        share_id = str(uuid4())
        project_id = str(uuid4())
        
        # Act
        await notification_service._log_notification(
            notification_type="test_notification",
            share_id=share_id,
            project_id=project_id,
            project_name="Test Project",
            details={"test": "data"}
        )
        
        # Assert
        assert mock_db.insert.called
    
    def test_email_template_branding(self):
        """Test email templates include proper branding."""
        # Arrange
        templates = ShareLinkEmailTemplates(
            company_name="Custom Company",
            support_email="help@custom.com"
        )
        
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        
        # Act
        email = templates.generate_share_link_email(
            recipient_email="user@example.com",
            project_name="Test Project",
            share_url="https://app.test.com/share/abc123",
            permission_level=SharePermissionLevel.VIEW_ONLY,
            expires_at=expires_at
        )
        
        # Assert
        assert "Custom Company" in email["html"]
        assert "help@custom.com" in email["html"]
    
    def test_email_template_contact_information(self):
        """Test email templates include contact information."""
        # Arrange
        templates = ShareLinkEmailTemplates()
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        
        # Act
        email = templates.generate_share_link_email(
            recipient_email="user@example.com",
            project_name="Test Project",
            share_url="https://app.test.com/share/abc123",
            permission_level=SharePermissionLevel.VIEW_ONLY,
            expires_at=expires_at
        )
        
        # Assert
        assert templates.support_email in email["html"]
        assert templates.support_email in email["text"]


class TestEmailContentValidation:
    """Test email content validation and security."""
    
    @pytest.fixture
    def email_templates(self):
        """Create email templates instance."""
        return ShareLinkEmailTemplates()
    
    def test_email_contains_required_elements(self, email_templates):
        """Test email contains all required elements."""
        # Arrange
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        
        # Act
        email = email_templates.generate_share_link_email(
            recipient_email="user@example.com",
            project_name="Test Project",
            share_url="https://app.test.com/share/abc123",
            permission_level=SharePermissionLevel.VIEW_ONLY,
            expires_at=expires_at
        )
        
        # Assert - Check required elements
        assert "subject" in email
        assert "html" in email
        assert "text" in email
        assert "to" in email
        
        # Check HTML structure
        assert "<!DOCTYPE html>" in email["html"]
        assert "<html>" in email["html"]
        assert "</html>" in email["html"]
        
        # Check text version exists and has content
        assert len(email["text"]) > 0
        assert "Test Project" in email["text"]
    
    def test_email_security_note_present(self, email_templates):
        """Test email includes security note."""
        # Arrange
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        
        # Act
        email = email_templates.generate_share_link_email(
            recipient_email="user@example.com",
            project_name="Test Project",
            share_url="https://app.test.com/share/abc123",
            permission_level=SharePermissionLevel.VIEW_ONLY,
            expires_at=expires_at
        )
        
        # Assert
        assert "Security Note" in email["html"] or "security" in email["html"].lower()
        assert "do not share" in email["html"].lower() or "unique to you" in email["html"].lower()
    
    def test_email_expiration_information(self, email_templates):
        """Test email includes expiration information."""
        # Arrange
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        
        # Act
        email = email_templates.generate_share_link_email(
            recipient_email="user@example.com",
            project_name="Test Project",
            share_url="https://app.test.com/share/abc123",
            permission_level=SharePermissionLevel.VIEW_ONLY,
            expires_at=expires_at
        )
        
        # Assert
        assert "Expires" in email["html"] or "expir" in email["html"].lower()
        # Check that expiration date is formatted
        assert expires_at.strftime("%B") in email["html"]  # Month name
