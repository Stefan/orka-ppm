"""
Unit tests for ShareableURLService
Tests secure token generation, validation, and RBAC integration
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from uuid import uuid4, UUID
from unittest.mock import Mock, AsyncMock, patch, MagicMock
import json

# Use anyio for async tests (already installed)
pytestmark = pytest.mark.anyio

from services.roche_construction_services import ShareableURLService, TokenManager
from roche_construction_models import (
    ShareablePermissions,
    ShareableURLCreate,
    ShareableURLResponse,
    ShareableURLValidation
)


class TestTokenManager:
    """Test TokenManager for secure token generation and validation"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.secret_key = "test_secret_key_for_token_generation_12345"
        self.token_manager = TokenManager(self.secret_key)
    
    def test_generate_secure_token_creates_valid_token(self):
        """Test that token generation creates a valid encrypted token"""
        payload = {
            'project_id': str(uuid4()),
            'permissions': {'can_view_basic_info': True},
            'exp': int((datetime.now() + timedelta(days=7)).timestamp())
        }
        
        token = self.token_manager.generate_secure_token(payload)
        
        # Token should be a non-empty string
        assert isinstance(token, str)
        assert len(token) > 0
        
        # Token should be base64 encoded
        import base64
        try:
            base64.urlsafe_b64decode(token.encode())
            assert True
        except Exception:
            pytest.fail("Token is not valid base64")
    
    def test_validate_token_decrypts_correctly(self):
        """Test that token validation correctly decrypts and returns payload"""
        original_payload = {
            'project_id': str(uuid4()),
            'permissions': {'can_view_basic_info': True},
            'exp': int((datetime.now() + timedelta(days=7)).timestamp())
        }
        
        token = self.token_manager.generate_secure_token(original_payload)
        decrypted_payload = self.token_manager.validate_token(token)
        
        # Verify core payload data is preserved
        assert decrypted_payload['project_id'] == original_payload['project_id']
        assert decrypted_payload['permissions'] == original_payload['permissions']
        assert decrypted_payload['exp'] == original_payload['exp']
        
        # Verify additional fields were added
        assert 'iat' in decrypted_payload
        assert 'nonce' in decrypted_payload
    
    def test_validate_token_raises_on_invalid_token(self):
        """Test that validation raises exception for invalid tokens"""
        invalid_token = "invalid_token_string"
        
        with pytest.raises(ValueError, match="Invalid token"):
            self.token_manager.validate_token(invalid_token)
    
    def test_is_token_expired_returns_false_for_valid_token(self):
        """Test that non-expired tokens are correctly identified"""
        payload = {
            'project_id': str(uuid4()),
            'exp': int((datetime.now() + timedelta(days=7)).timestamp())
        }
        
        token = self.token_manager.generate_secure_token(payload)
        is_expired = self.token_manager.is_token_expired(token)
        
        assert is_expired is False
    
    def test_is_token_expired_returns_true_for_expired_token(self):
        """Test that expired tokens are correctly identified"""
        payload = {
            'project_id': str(uuid4()),
            'exp': int((datetime.now() - timedelta(days=1)).timestamp())
        }
        
        token = self.token_manager.generate_secure_token(payload)
        is_expired = self.token_manager.is_token_expired(token)
        
        assert is_expired is True
    
    def test_token_uniqueness_with_same_payload(self):
        """Test that tokens are unique even with identical payloads"""
        payload = {
            'project_id': str(uuid4()),
            'permissions': {'can_view_basic_info': True},
            'exp': int((datetime.now() + timedelta(days=7)).timestamp())
        }
        
        token1 = self.token_manager.generate_secure_token(payload.copy())
        token2 = self.token_manager.generate_secure_token(payload.copy())
        
        # Tokens should be different due to nonce and timestamp
        assert token1 != token2


class TestShareableURLService:
    """Test ShareableURLService for URL generation and validation"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.secret_key = "test_secret_key_for_url_service_12345"
        self.mock_supabase = Mock()
        self.service = ShareableURLService(self.mock_supabase, self.secret_key)
        
        # Sample test data
        self.project_id = uuid4()
        self.user_id = uuid4()
        self.permissions = ShareablePermissions(
            can_view_basic_info=True,
            can_view_financial=False,
            can_view_risks=True,
            can_view_resources=False,
            can_view_timeline=True,
            allowed_sections=['overview', 'timeline']
        )
        self.expiration = datetime.now() + timedelta(days=7)
    
    async def test_generate_shareable_url_creates_url_with_token(self):
        """Test that URL generation creates a valid shareable URL"""
        # Mock database response
        mock_url_data = {
            'id': str(uuid4()),
            'project_id': str(self.project_id),
            'token': 'mock_token',
            'permissions': self.permissions.dict(),
            'created_by': str(self.user_id),
            'expires_at': self.expiration.isoformat(),
            'access_count': 0,
            'last_accessed': None,
            'is_revoked': False,
            'created_at': datetime.now().isoformat()
        }
        
        mock_result = Mock()
        mock_result.data = [mock_url_data]
        self.mock_supabase.table.return_value.insert.return_value.execute.return_value = mock_result
        
        # Generate URL
        result = await self.service.generate_shareable_url(
            self.project_id,
            self.permissions,
            self.expiration,
            self.user_id,
            description="Test URL"
        )
        
        # Verify database was called
        self.mock_supabase.table.assert_called_with('shareable_urls')
        
        # Verify result structure (would be ShareableURL in real implementation)
        assert result is not None
    
    async def test_generate_shareable_url_uses_cryptographic_token(self):
        """Test that generated URLs use cryptographically secure tokens
        
        **Validates: Requirements 1.1, 9.1**
        """
        # Mock database response
        mock_result = Mock()
        mock_result.data = [{
            'id': str(uuid4()),
            'project_id': str(self.project_id),
            'token': 'captured_token',
            'permissions': self.permissions.dict(),
            'created_by': str(self.user_id),
            'expires_at': self.expiration.isoformat(),
            'access_count': 0,
            'last_accessed': None,
            'is_revoked': False,
            'created_at': datetime.now().isoformat()
        }]
        
        # Capture the insert call
        insert_mock = Mock()
        insert_mock.execute.return_value = mock_result
        self.mock_supabase.table.return_value.insert.return_value = insert_mock
        
        # Generate URL
        await self.service.generate_shareable_url(
            self.project_id,
            self.permissions,
            self.expiration,
            self.user_id
        )
        
        # Get the data that was inserted
        insert_call_args = self.mock_supabase.table.return_value.insert.call_args
        inserted_data = insert_call_args[0][0]
        
        # Verify token was generated
        assert 'token' in inserted_data
        token = inserted_data['token']
        
        # Token should be non-empty string
        assert isinstance(token, str)
        assert len(token) > 0
        
        # Token should be decryptable by TokenManager
        try:
            payload = self.service.token_manager.validate_token(token)
            assert 'project_id' in payload
            assert 'permissions' in payload
            assert 'exp' in payload
        except Exception as e:
            pytest.fail(f"Token validation failed: {e}")
    
    async def test_validate_shareable_url_enforces_permissions(self):
        """Test that URL validation enforces embedded permissions
        
        **Validates: Requirements 1.2, 1.3**
        """
        # Create a real token with specific permissions
        token_payload = {
            'project_id': str(self.project_id),
            'permissions': self.permissions.dict(),
            'exp': int(self.expiration.timestamp()),
            'created_by': str(self.user_id)
        }
        token = self.service.token_manager.generate_secure_token(token_payload)
        
        # Mock database response
        mock_url_data = {
            'id': str(uuid4()),
            'project_id': str(self.project_id),
            'token': token,
            'permissions': self.permissions.dict(),
            'created_by': str(self.user_id),
            'expires_at': self.expiration.isoformat(),
            'access_count': 0,
            'last_accessed': None,
            'is_revoked': False,
            'created_at': datetime.now().isoformat()
        }
        
        mock_result = Mock()
        mock_result.data = [mock_url_data]
        self.mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_result
        
        # Mock update for access count
        mock_update_result = Mock()
        mock_update_result.data = [mock_url_data]
        self.mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = mock_update_result
        
        # Validate URL
        validation_result = await self.service.validate_shareable_url(token)
        
        # Verify validation succeeded
        assert validation_result.is_valid is True
        assert validation_result.permissions is not None
        assert validation_result.project_id == self.project_id
        
        # Verify permissions match what was embedded
        assert validation_result.permissions.can_view_basic_info == self.permissions.can_view_basic_info
        assert validation_result.permissions.can_view_financial == self.permissions.can_view_financial
        assert validation_result.permissions.can_view_risks == self.permissions.can_view_risks
        assert validation_result.permissions.can_view_resources == self.permissions.can_view_resources
        assert validation_result.permissions.can_view_timeline == self.permissions.can_view_timeline
    
    async def test_validate_shareable_url_rejects_expired_urls(self):
        """Test that expired URLs are rejected
        
        **Validates: Requirements 1.4**
        """
        # Create token with past expiration
        expired_time = datetime.now() - timedelta(days=1)
        token_payload = {
            'project_id': str(self.project_id),
            'permissions': self.permissions.dict(),
            'exp': int(expired_time.timestamp()),
            'created_by': str(self.user_id)
        }
        token = self.service.token_manager.generate_secure_token(token_payload)
        
        # Mock database response with expired URL
        mock_url_data = {
            'id': str(uuid4()),
            'project_id': str(self.project_id),
            'token': token,
            'permissions': self.permissions.dict(),
            'expires_at': expired_time.isoformat(),
            'is_revoked': False
        }
        
        mock_result = Mock()
        mock_result.data = [mock_url_data]
        self.mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_result
        
        # Validate URL
        validation_result = await self.service.validate_shareable_url(token)
        
        # Verify validation failed due to expiration
        assert validation_result.is_valid is False
        assert "expired" in validation_result.error_message.lower()
    
    async def test_validate_shareable_url_rejects_revoked_urls(self):
        """Test that revoked URLs are rejected"""
        # Create valid token
        token_payload = {
            'project_id': str(self.project_id),
            'permissions': self.permissions.dict(),
            'exp': int(self.expiration.timestamp()),
            'created_by': str(self.user_id)
        }
        token = self.service.token_manager.generate_secure_token(token_payload)
        
        # Mock database response with revoked URL
        mock_url_data = {
            'id': str(uuid4()),
            'project_id': str(self.project_id),
            'token': token,
            'permissions': self.permissions.dict(),
            'expires_at': self.expiration.isoformat(),
            'is_revoked': True  # URL is revoked
        }
        
        mock_result = Mock()
        mock_result.data = [mock_url_data]
        self.mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_result
        
        # Validate URL
        validation_result = await self.service.validate_shareable_url(token)
        
        # Verify validation failed due to revocation
        assert validation_result.is_valid is False
        assert "revoked" in validation_result.error_message.lower()
    
    async def test_validate_shareable_url_logs_access_attempts(self):
        """Test that all access attempts are logged
        
        **Validates: Requirements 1.5, 9.5**
        """
        # Create valid token
        token_payload = {
            'project_id': str(self.project_id),
            'permissions': self.permissions.dict(),
            'exp': int(self.expiration.timestamp()),
            'created_by': str(self.user_id)
        }
        token = self.service.token_manager.generate_secure_token(token_payload)
        
        url_id = str(uuid4())
        initial_access_count = 5
        
        # Mock database response
        mock_url_data = {
            'id': url_id,
            'project_id': str(self.project_id),
            'token': token,
            'permissions': self.permissions.dict(),
            'expires_at': self.expiration.isoformat(),
            'access_count': initial_access_count,
            'last_accessed': None,
            'is_revoked': False
        }
        
        mock_result = Mock()
        mock_result.data = [mock_url_data]
        self.mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_result
        
        # Mock update for access count
        mock_update_result = Mock()
        mock_update_result.data = [mock_url_data]
        update_mock = Mock()
        update_mock.execute.return_value = mock_update_result
        self.mock_supabase.table.return_value.update.return_value.eq.return_value = update_mock
        
        # Validate URL
        await self.service.validate_shareable_url(token)
        
        # Verify access count was updated
        update_call_args = self.mock_supabase.table.return_value.update.call_args
        update_data = update_call_args[0][0]
        
        assert 'access_count' in update_data
        assert update_data['access_count'] == initial_access_count + 1
        assert 'last_accessed' in update_data
    
    async def test_revoke_shareable_url_marks_as_revoked(self):
        """Test that URL revocation properly marks URL as revoked"""
        url_id = uuid4()
        
        # Mock successful revocation
        mock_result = Mock()
        mock_result.data = [{'id': str(url_id), 'is_revoked': True}]
        self.mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = mock_result
        
        # Revoke URL
        result = await self.service.revoke_shareable_url(url_id, self.user_id)
        
        # Verify revocation succeeded
        assert result is True
        
        # Verify database was updated with revocation data
        update_call_args = self.mock_supabase.table.return_value.update.call_args
        update_data = update_call_args[0][0]
        
        assert update_data['is_revoked'] is True
        assert 'revoked_by' in update_data
        assert 'revoked_at' in update_data
        assert 'revocation_reason' in update_data
    
    async def test_list_project_shareable_urls_returns_all_urls(self):
        """Test that listing URLs returns all URLs for a project"""
        # Mock database response with multiple URLs
        mock_urls = [
            {
                'id': str(uuid4()),
                'project_id': str(self.project_id),
                'token': 'token1',
                'permissions': self.permissions.dict(),
                'created_by': str(self.user_id),
                'expires_at': self.expiration.isoformat(),
                'access_count': 0,
                'last_accessed': None,
                'is_revoked': False,
                'created_at': datetime.now().isoformat()
            },
            {
                'id': str(uuid4()),
                'project_id': str(self.project_id),
                'token': 'token2',
                'permissions': self.permissions.dict(),
                'created_by': str(self.user_id),
                'expires_at': self.expiration.isoformat(),
                'access_count': 5,
                'last_accessed': datetime.now().isoformat(),
                'is_revoked': False,
                'created_at': datetime.now().isoformat()
            }
        ]
        
        mock_result = Mock()
        mock_result.data = mock_urls
        self.mock_supabase.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value = mock_result
        
        # List URLs
        urls = await self.service.list_project_shareable_urls(self.project_id)
        
        # Verify correct number of URLs returned
        assert len(urls) == 2
        
        # Verify database was queried correctly
        self.mock_supabase.table.assert_called_with('shareable_urls')


class TestShareableURLServiceRBACIntegration:
    """Test RBAC integration for ShareableURLService"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.secret_key = "test_secret_key_rbac_12345"
        self.mock_supabase = Mock()
        self.service = ShareableURLService(self.mock_supabase, self.secret_key)
    
    async def test_generate_url_stores_creator_user_id(self):
        """Test that URL generation stores the creator's user ID for RBAC tracking
        
        **Validates: Requirements 7.1, 9.5**
        """
        project_id = uuid4()
        user_id = uuid4()
        permissions = ShareablePermissions(can_view_basic_info=True)
        expiration = datetime.now() + timedelta(days=7)
        
        # Mock database response
        mock_result = Mock()
        mock_result.data = [{
            'id': str(uuid4()),
            'project_id': str(project_id),
            'token': 'test_token',
            'permissions': permissions.model_dump(),
            'created_by': str(user_id),
            'expires_at': expiration.isoformat(),
            'access_count': 0,
            'last_accessed': None,  # Add missing field
            'is_revoked': False,
            'created_at': datetime.now().isoformat()
        }]
        self.mock_supabase.table.return_value.insert.return_value.execute.return_value = mock_result
        
        # Generate URL
        await self.service.generate_shareable_url(
            project_id,
            permissions,
            expiration,
            user_id
        )
        
        # Verify created_by was stored
        insert_call_args = self.mock_supabase.table.return_value.insert.call_args
        inserted_data = insert_call_args[0][0]
        
        assert 'created_by' in inserted_data
        assert inserted_data['created_by'] == str(user_id)


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
