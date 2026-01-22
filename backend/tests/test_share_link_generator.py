"""
Unit Tests for ShareLinkGenerator Service

This module contains unit tests for the ShareLinkGenerator service,
testing token generation, share link creation, and management operations.
"""

import pytest
from datetime import datetime, timedelta
from uuid import uuid4, UUID
from unittest.mock import Mock, AsyncMock, patch
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from services.share_link_generator import ShareLinkGenerator
from models.shareable_urls import SharePermissionLevel


class TestTokenGeneration:
    """Test token generation functionality"""
    
    def test_generate_secure_token_returns_64_char_string(self):
        """Token should be exactly 64 characters"""
        generator = ShareLinkGenerator(db_session=None)
        token = generator.generate_secure_token()
        
        assert isinstance(token, str)
        assert len(token) == 64
    
    def test_generate_secure_token_is_url_safe(self):
        """Token should only contain URL-safe characters"""
        generator = ShareLinkGenerator(db_session=None)
        token = generator.generate_secure_token()
        
        # URL-safe base64 uses: A-Z, a-z, 0-9, -, _
        allowed_chars = set('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_')
        token_chars = set(token)
        
        assert token_chars.issubset(allowed_chars)
        assert ' ' not in token
        assert '/' not in token
        assert '+' not in token
        assert '=' not in token
    
    def test_generate_secure_token_produces_unique_tokens(self):
        """Multiple token generations should produce unique tokens"""
        generator = ShareLinkGenerator(db_session=None)
        tokens = [generator.generate_secure_token() for _ in range(100)]
        
        # All tokens should be unique
        assert len(set(tokens)) == len(tokens)
    
    def test_generate_secure_token_has_high_entropy(self):
        """Tokens should have diverse character distribution"""
        generator = ShareLinkGenerator(db_session=None)
        tokens = [generator.generate_secure_token() for _ in range(50)]
        all_chars = ''.join(tokens)
        unique_chars = set(all_chars)
        
        # Should use a good variety of characters
        assert len(unique_chars) >= 40


class TestTokenUniquenessValidation:
    """Test token uniqueness validation"""
    
    @pytest.mark.asyncio
    async def test_validate_token_uniqueness_returns_true_for_new_token(self):
        """Should return True when token doesn't exist"""
        mock_db = Mock()
        mock_result = Mock()
        mock_result.data = []
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_result
        
        generator = ShareLinkGenerator(db_session=mock_db)
        is_unique = await generator.validate_token_uniqueness("new_token_123")
        
        assert is_unique is True
    
    @pytest.mark.asyncio
    async def test_validate_token_uniqueness_returns_false_for_existing_token(self):
        """Should return False when token already exists"""
        mock_db = Mock()
        mock_result = Mock()
        mock_result.data = [{"id": "existing-id"}]
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_result
        
        generator = ShareLinkGenerator(db_session=mock_db)
        is_unique = await generator.validate_token_uniqueness("existing_token")
        
        assert is_unique is False
    
    @pytest.mark.asyncio
    async def test_validate_token_uniqueness_handles_db_error(self):
        """Should return False on database error"""
        mock_db = Mock()
        mock_db.table.side_effect = Exception("Database error")
        
        generator = ShareLinkGenerator(db_session=mock_db)
        is_unique = await generator.validate_token_uniqueness("token")
        
        assert is_unique is False


class TestCreateShareLink:
    """Test share link creation"""
    
    @pytest.mark.asyncio
    async def test_create_share_link_success(self):
        """Should successfully create a share link"""
        mock_db = Mock()
        
        # Mock token uniqueness check (returns empty list = unique)
        mock_unique_result = Mock()
        mock_unique_result.data = []
        
        # Mock insert result
        mock_insert_result = Mock()
        mock_insert_result.data = [{
            "id": "share-123",
            "project_id": "project-456",
            "token": "test_token_64_chars_long_abcdefghijklmnopqrstuvwxyz1234567890",
            "created_by": "user-789",
            "permission_level": "view_only",
            "expires_at": (datetime.now() + timedelta(days=7)).isoformat(),
            "is_active": True,
            "custom_message": "Test message",
            "access_count": 0,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }]
        
        # Setup mock chain
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_unique_result
        mock_db.table.return_value.insert.return_value.execute.return_value = mock_insert_result
        
        generator = ShareLinkGenerator(db_session=mock_db, base_url="https://test.com")
        
        result = await generator.create_share_link(
            project_id=uuid4(),
            creator_id=uuid4(),
            permission_level=SharePermissionLevel.VIEW_ONLY,
            expiry_duration_days=7,
            custom_message="Test message"
        )
        
        assert result is not None
        assert result.permission_level == "view_only"
        assert result.is_active is True
        assert result.access_count == 0
        assert "https://test.com/projects/" in result.share_url
    
    @pytest.mark.asyncio
    async def test_create_share_link_validates_expiry_duration(self):
        """Should reject invalid expiry durations"""
        generator = ShareLinkGenerator(db_session=Mock())
        
        # Test too short
        result = await generator.create_share_link(
            project_id=uuid4(),
            creator_id=uuid4(),
            permission_level=SharePermissionLevel.VIEW_ONLY,
            expiry_duration_days=0
        )
        assert result is None
        
        # Test too long
        result = await generator.create_share_link(
            project_id=uuid4(),
            creator_id=uuid4(),
            permission_level=SharePermissionLevel.VIEW_ONLY,
            expiry_duration_days=366
        )
        assert result is None
    
    @pytest.mark.asyncio
    async def test_create_share_link_retries_on_token_collision(self):
        """Should retry token generation on collision"""
        mock_db = Mock()
        
        # First check returns collision, second returns unique
        mock_collision_result = Mock()
        mock_collision_result.data = [{"id": "existing"}]
        
        mock_unique_result = Mock()
        mock_unique_result.data = []
        
        mock_insert_result = Mock()
        mock_insert_result.data = [{
            "id": "share-123",
            "project_id": "project-456",
            "token": "unique_token_64_chars_long_abcdefghijklmnopqrstuvwxyz123456",
            "created_by": "user-789",
            "permission_level": "view_only",
            "expires_at": (datetime.now() + timedelta(days=7)).isoformat(),
            "is_active": True,
            "custom_message": None,
            "access_count": 0,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }]
        
        # Setup mock to return collision first, then unique
        select_mock = mock_db.table.return_value.select.return_value.eq.return_value.execute
        select_mock.side_effect = [mock_collision_result, mock_unique_result]
        
        mock_db.table.return_value.insert.return_value.execute.return_value = mock_insert_result
        
        generator = ShareLinkGenerator(db_session=mock_db)
        
        result = await generator.create_share_link(
            project_id=uuid4(),
            creator_id=uuid4(),
            permission_level=SharePermissionLevel.VIEW_ONLY,
            expiry_duration_days=7
        )
        
        assert result is not None
        # Should have called select twice (collision + unique check)
        assert select_mock.call_count == 2


class TestListProjectShares:
    """Test listing project share links"""
    
    @pytest.mark.asyncio
    async def test_list_project_shares_returns_empty_list_when_none_exist(self):
        """Should return empty list when no shares exist"""
        mock_db = Mock()
        mock_result = Mock()
        mock_result.data = []
        mock_db.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value = mock_result
        
        generator = ShareLinkGenerator(db_session=mock_db)
        result = await generator.list_project_shares(uuid4())
        
        assert result is not None
        assert result.total == 0
        assert result.active_count == 0
        assert result.expired_count == 0
        assert len(result.share_links) == 0
    
    @pytest.mark.asyncio
    async def test_list_project_shares_returns_active_shares(self):
        """Should return list of active shares"""
        mock_db = Mock()
        
        # Create mock result with proper data attribute
        mock_result = Mock()
        mock_result.data = [
            {
                "id": "share-1",
                "project_id": "project-123",
                "token": "token1_64_chars_long_abcdefghijklmnopqrstuvwxyz1234567890ab",
                "created_by": "user-1",
                "permission_level": "view_only",
                "expires_at": (datetime.now() + timedelta(days=7)).isoformat(),
                "is_active": True,
                "custom_message": None,
                "access_count": 5,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            },
            {
                "id": "share-2",
                "project_id": "project-123",
                "token": "token2_64_chars_long_abcdefghijklmnopqrstuvwxyz1234567890cd",
                "created_by": "user-2",
                "permission_level": "limited_data",
                "expires_at": (datetime.now() + timedelta(days=30)).isoformat(),
                "is_active": True,
                "custom_message": "Custom message",
                "access_count": 10,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            }
        ]
        
        # Mock the full chain - the key is that execute() returns mock_result
        mock_order = Mock()
        mock_order.execute = Mock(return_value=mock_result)
        
        mock_eq2 = Mock()
        mock_eq2.order = Mock(return_value=mock_order)
        
        mock_eq1 = Mock()
        mock_eq1.eq = Mock(return_value=mock_eq2)
        
        mock_select = Mock()
        mock_select.eq = Mock(return_value=mock_eq1)
        
        mock_table = Mock()
        mock_table.select = Mock(return_value=mock_select)
        
        mock_db.table = Mock(return_value=mock_table)
        
        generator = ShareLinkGenerator(db_session=mock_db)
        result = await generator.list_project_shares(uuid4())
        
        assert result is not None
        assert result.total == 2
        assert result.active_count == 2
        assert len(result.share_links) == 2
        assert result.share_links[0].access_count == 5
        assert result.share_links[1].access_count == 10
    
    @pytest.mark.asyncio
    async def test_list_project_shares_counts_expired_links(self):
        """Should correctly count expired links"""
        mock_db = Mock()
        
        # Create mock result with proper data attribute
        mock_result = Mock()
        mock_result.data = [
            {
                "id": "share-1",
                "project_id": "project-123",
                "token": "token1_64_chars_long_abcdefghijklmnopqrstuvwxyz1234567890ab",
                "created_by": "user-1",
                "permission_level": "view_only",
                "expires_at": (datetime.now() - timedelta(days=1)).isoformat(),  # Expired
                "is_active": True,
                "custom_message": None,
                "access_count": 5,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            }
        ]
        
        # Mock the full chain - the key is that execute() returns mock_result
        mock_order = Mock()
        mock_order.execute = Mock(return_value=mock_result)
        
        mock_eq2 = Mock()
        mock_eq2.order = Mock(return_value=mock_order)
        
        mock_eq1 = Mock()
        mock_eq1.eq = Mock(return_value=mock_eq2)
        
        mock_select = Mock()
        mock_select.eq = Mock(return_value=mock_eq1)
        
        mock_table = Mock()
        mock_table.select = Mock(return_value=mock_select)
        
        mock_db.table = Mock(return_value=mock_table)
        
        generator = ShareLinkGenerator(db_session=mock_db)
        result = await generator.list_project_shares(uuid4())
        
        assert result is not None
        assert result.total == 1
        assert result.active_count == 0  # Expired, so not active
        assert result.expired_count == 1


class TestRevokeShareLink:
    """Test share link revocation"""
    
    @pytest.mark.asyncio
    async def test_revoke_share_link_success(self):
        """Should successfully revoke a share link"""
        mock_db = Mock()
        mock_result = Mock()
        mock_result.data = [{"id": "share-123", "is_active": False}]
        mock_db.table.return_value.update.return_value.eq.return_value.execute.return_value = mock_result
        
        generator = ShareLinkGenerator(db_session=mock_db)
        result = await generator.revoke_share_link(
            share_id=uuid4(),
            revoked_by=uuid4(),
            revocation_reason="No longer needed"
        )
        
        assert result is True
    
    @pytest.mark.asyncio
    async def test_revoke_share_link_not_found(self):
        """Should return False when share link not found"""
        mock_db = Mock()
        mock_result = Mock()
        mock_result.data = []
        mock_db.table.return_value.update.return_value.eq.return_value.execute.return_value = mock_result
        
        generator = ShareLinkGenerator(db_session=mock_db)
        result = await generator.revoke_share_link(
            share_id=uuid4(),
            revoked_by=uuid4(),
            revocation_reason="Test"
        )
        
        assert result is False


class TestExtendExpiry:
    """Test share link expiry extension"""
    
    @pytest.mark.asyncio
    async def test_extend_expiry_success(self):
        """Should successfully extend expiry"""
        mock_db = Mock()
        
        current_expiry = datetime.now() + timedelta(days=7)
        
        # Mock select result
        mock_select_result = Mock()
        mock_select_result.data = [{
            "id": "share-123",
            "project_id": "project-456",
            "token": "token_64_chars_long_abcdefghijklmnopqrstuvwxyz1234567890abcd",
            "created_by": "user-789",
            "permission_level": "view_only",
            "expires_at": current_expiry.isoformat(),
            "is_active": True,
            "custom_message": None,
            "access_count": 0,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }]
        
        # Mock update result
        new_expiry = current_expiry + timedelta(days=7)
        mock_update_result = Mock()
        mock_update_result.data = [{
            "id": "share-123",
            "project_id": "project-456",
            "token": "token_64_chars_long_abcdefghijklmnopqrstuvwxyz1234567890abcd",
            "created_by": "user-789",
            "permission_level": "view_only",
            "expires_at": new_expiry.isoformat(),
            "is_active": True,
            "custom_message": None,
            "access_count": 0,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }]
        
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_select_result
        mock_db.table.return_value.update.return_value.eq.return_value.execute.return_value = mock_update_result
        
        generator = ShareLinkGenerator(db_session=mock_db)
        result = await generator.extend_expiry(
            share_id=uuid4(),
            additional_days=7
        )
        
        assert result is not None
        assert result.expires_at > current_expiry
    
    @pytest.mark.asyncio
    async def test_extend_expiry_validates_additional_days(self):
        """Should reject invalid additional days"""
        generator = ShareLinkGenerator(db_session=Mock())
        
        # Test too short
        result = await generator.extend_expiry(uuid4(), 0)
        assert result is None
        
        # Test too long
        result = await generator.extend_expiry(uuid4(), 366)
        assert result is None
    
    @pytest.mark.asyncio
    async def test_extend_expiry_rejects_inactive_link(self):
        """Should not extend inactive links"""
        mock_db = Mock()
        mock_result = Mock()
        mock_result.data = [{
            "id": "share-123",
            "is_active": False,
            "expires_at": datetime.now().isoformat()
        }]
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_result
        
        generator = ShareLinkGenerator(db_session=mock_db)
        result = await generator.extend_expiry(uuid4(), 7)
        
        assert result is None


class TestCheckCreatorPermission:
    """Test creator permission checking"""
    
    @pytest.mark.asyncio
    async def test_check_creator_permission_returns_true_for_creator(self):
        """Should return True when user is the creator"""
        mock_db = Mock()
        
        # Create a test user ID
        test_user_id = uuid4()
        
        mock_result = Mock()
        mock_result.data = [{
            "created_by": str(test_user_id),
            "project_id": "project-456"
        }]
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_result
        
        generator = ShareLinkGenerator(db_session=mock_db)
        has_permission = await generator.check_creator_permission(
            share_id=uuid4(),
            user_id=test_user_id
        )
        
        assert has_permission is True
    
    @pytest.mark.asyncio
    async def test_check_creator_permission_returns_false_for_non_creator(self):
        """Should return False when user is not the creator"""
        mock_db = Mock()
        mock_result = Mock()
        mock_result.data = [{
            "created_by": "user-123",
            "project_id": "project-456"
        }]
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_result
        
        generator = ShareLinkGenerator(db_session=mock_db)
        has_permission = await generator.check_creator_permission(
            share_id=uuid4(),
            user_id=uuid4()  # Different user
        )
        
        assert has_permission is False
    
    @pytest.mark.asyncio
    async def test_check_creator_permission_returns_false_when_share_not_found(self):
        """Should return False when share link doesn't exist"""
        mock_db = Mock()
        mock_result = Mock()
        mock_result.data = []
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_result
        
        generator = ShareLinkGenerator(db_session=mock_db)
        has_permission = await generator.check_creator_permission(
            share_id=uuid4(),
            user_id=uuid4()
        )
        
        assert has_permission is False


class TestBulkRevokeShareLinks:
    """Test bulk revoke operations"""
    
    @pytest.mark.asyncio
    async def test_bulk_revoke_empty_list(self):
        """Should handle empty list gracefully"""
        generator = ShareLinkGenerator(db_session=Mock())
        result = await generator.bulk_revoke_share_links(
            share_ids=[],
            revoked_by=uuid4(),
            revocation_reason="Test"
        )
        
        assert result["total_processed"] == 0
        assert result["success_count"] == 0
        assert result["failure_count"] == 0
    
    @pytest.mark.asyncio
    async def test_bulk_revoke_successful(self):
        """Should successfully revoke multiple share links"""
        mock_db = Mock()
        
        # Mock permission check (creator check)
        mock_perm_result = Mock()
        mock_perm_result.data = [{
            "created_by": "user-123",
            "project_id": "project-456"
        }]
        
        # Mock revoke result
        mock_revoke_result = Mock()
        mock_revoke_result.data = [{"id": "share-1", "is_active": False}]
        
        # Setup mock chain
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_perm_result
        mock_db.table.return_value.update.return_value.eq.return_value.execute.return_value = mock_revoke_result
        
        generator = ShareLinkGenerator(db_session=mock_db)
        
        user_id = uuid4()
        share_ids = [uuid4(), uuid4()]
        
        # Mock permission check to return True
        generator.check_creator_permission = AsyncMock(return_value=True)
        generator.revoke_share_link = AsyncMock(return_value=True)
        
        result = await generator.bulk_revoke_share_links(
            share_ids=share_ids,
            revoked_by=user_id,
            revocation_reason="Bulk test"
        )
        
        assert result["total_processed"] == 2
        assert result["success_count"] == 2
        assert result["failure_count"] == 0
        assert len(result["successful"]) == 2
    
    @pytest.mark.asyncio
    async def test_bulk_revoke_with_permission_failures(self):
        """Should handle permission failures correctly"""
        generator = ShareLinkGenerator(db_session=Mock())
        
        user_id = uuid4()
        share_ids = [uuid4(), uuid4(), uuid4()]
        
        # Mock permission check to fail for some shares
        async def mock_permission_check(share_id, user_id):
            # First share has permission, others don't
            return share_id == share_ids[0]
        
        generator.check_creator_permission = mock_permission_check
        generator.revoke_share_link = AsyncMock(return_value=True)
        
        result = await generator.bulk_revoke_share_links(
            share_ids=share_ids,
            revoked_by=user_id,
            revocation_reason="Test"
        )
        
        assert result["total_processed"] == 3
        assert result["success_count"] == 1
        assert result["failure_count"] == 2
        assert len(result["failed"]) == 2
        assert result["failed"][0]["error"] == "insufficient_permissions"
    
    @pytest.mark.asyncio
    async def test_bulk_revoke_limits_to_50_shares(self):
        """Should limit bulk operations to 50 share links"""
        generator = ShareLinkGenerator(db_session=Mock())
        
        # Create 60 share IDs
        share_ids = [uuid4() for _ in range(60)]
        
        generator.check_creator_permission = AsyncMock(return_value=True)
        generator.revoke_share_link = AsyncMock(return_value=True)
        
        result = await generator.bulk_revoke_share_links(
            share_ids=share_ids,
            revoked_by=uuid4(),
            revocation_reason="Test"
        )
        
        # Should only process 50
        assert result["total_processed"] == 50


class TestBulkExtendExpiry:
    """Test bulk extend expiry operations"""
    
    @pytest.mark.asyncio
    async def test_bulk_extend_empty_list(self):
        """Should handle empty list gracefully"""
        generator = ShareLinkGenerator(db_session=Mock())
        result = await generator.bulk_extend_expiry(
            share_ids=[],
            additional_days=7,
            user_id=uuid4()
        )
        
        assert result["total_processed"] == 0
        assert result["success_count"] == 0
        assert result["failure_count"] == 0
    
    @pytest.mark.asyncio
    async def test_bulk_extend_validates_days(self):
        """Should validate additional days parameter"""
        generator = ShareLinkGenerator(db_session=Mock())
        
        # Test invalid days (too short)
        result = await generator.bulk_extend_expiry(
            share_ids=[uuid4()],
            additional_days=0,
            user_id=uuid4()
        )
        
        assert result["success_count"] == 0
        assert len(result["failed"]) > 0
        assert "invalid_days" in result["failed"][0]["error"]
        
        # Test invalid days (too long)
        result = await generator.bulk_extend_expiry(
            share_ids=[uuid4()],
            additional_days=366,
            user_id=uuid4()
        )
        
        assert result["success_count"] == 0
        assert len(result["failed"]) > 0
    
    @pytest.mark.asyncio
    async def test_bulk_extend_successful(self):
        """Should successfully extend multiple share links"""
        generator = ShareLinkGenerator(db_session=Mock())
        
        share_ids = [uuid4(), uuid4()]
        
        generator.check_creator_permission = AsyncMock(return_value=True)
        
        # Mock extend_expiry to return a response
        mock_response = Mock()
        mock_response.id = "share-123"
        generator.extend_expiry = AsyncMock(return_value=mock_response)
        
        result = await generator.bulk_extend_expiry(
            share_ids=share_ids,
            additional_days=7,
            user_id=uuid4()
        )
        
        assert result["total_processed"] == 2
        assert result["success_count"] == 2
        assert result["failure_count"] == 0
    
    @pytest.mark.asyncio
    async def test_bulk_extend_with_mixed_results(self):
        """Should handle mixed success and failure results"""
        generator = ShareLinkGenerator(db_session=Mock())
        
        share_ids = [uuid4(), uuid4(), uuid4()]
        
        generator.check_creator_permission = AsyncMock(return_value=True)
        
        # Mock extend_expiry to succeed for first, fail for others
        async def mock_extend(share_id, days):
            if share_id == share_ids[0]:
                mock_response = Mock()
                mock_response.id = str(share_id)
                return mock_response
            return None
        
        generator.extend_expiry = mock_extend
        
        result = await generator.bulk_extend_expiry(
            share_ids=share_ids,
            additional_days=7,
            user_id=uuid4()
        )
        
        assert result["total_processed"] == 3
        assert result["success_count"] == 1
        assert result["failure_count"] == 2


class TestBulkDeactivate:
    """Test bulk deactivate operations"""
    
    @pytest.mark.asyncio
    async def test_bulk_deactivate_empty_list(self):
        """Should handle empty list gracefully"""
        generator = ShareLinkGenerator(db_session=Mock())
        result = await generator.bulk_deactivate(
            share_ids=[],
            user_id=uuid4()
        )
        
        assert result["total_processed"] == 0
        assert result["success_count"] == 0
        assert result["failure_count"] == 0
    
    @pytest.mark.asyncio
    async def test_bulk_deactivate_successful(self):
        """Should successfully deactivate multiple share links"""
        generator = ShareLinkGenerator(db_session=Mock())
        
        share_ids = [uuid4(), uuid4()]
        
        generator.check_creator_permission = AsyncMock(return_value=True)
        generator.revoke_share_link = AsyncMock(return_value=True)
        
        result = await generator.bulk_deactivate(
            share_ids=share_ids,
            user_id=uuid4(),
            reason="Bulk deactivation test"
        )
        
        assert result["total_processed"] == 2
        assert result["success_count"] == 2
        assert result["failure_count"] == 0
    
    @pytest.mark.asyncio
    async def test_bulk_deactivate_with_permission_check(self):
        """Should check permissions before deactivating"""
        generator = ShareLinkGenerator(db_session=Mock())
        
        share_ids = [uuid4(), uuid4()]
        
        # First share has permission, second doesn't
        async def mock_permission(share_id, user_id):
            return share_id == share_ids[0]
        
        generator.check_creator_permission = mock_permission
        generator.revoke_share_link = AsyncMock(return_value=True)
        
        result = await generator.bulk_deactivate(
            share_ids=share_ids,
            user_id=uuid4()
        )
        
        assert result["total_processed"] == 2
        assert result["success_count"] == 1
        assert result["failure_count"] == 1
        assert result["failed"][0]["error"] == "insufficient_permissions"
    
    @pytest.mark.asyncio
    async def test_bulk_deactivate_limits_to_50_shares(self):
        """Should limit bulk operations to 50 share links"""
        generator = ShareLinkGenerator(db_session=Mock())
        
        # Create 60 share IDs
        share_ids = [uuid4() for _ in range(60)]
        
        generator.check_creator_permission = AsyncMock(return_value=True)
        generator.revoke_share_link = AsyncMock(return_value=True)
        
        result = await generator.bulk_deactivate(
            share_ids=share_ids,
            user_id=uuid4()
        )
        
        # Should only process 50
        assert result["total_processed"] == 50


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
