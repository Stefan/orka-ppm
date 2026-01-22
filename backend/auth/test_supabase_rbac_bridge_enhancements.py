"""
Test suite for SupabaseRBACBridge enhancements (Task 4.2)

This test suite validates:
- JWT token enhancement with role information
- Advanced caching with Redis integration
- Auth system bridging functionality

Requirements: 2.3, 2.4
"""

import pytest
import jwt
from datetime import datetime, timezone, timedelta
from uuid import UUID, uuid4
from unittest.mock import Mock, AsyncMock, patch

from auth.supabase_rbac_bridge import SupabaseRBACBridge, get_supabase_rbac_bridge
from auth.rbac import Permission, UserRole, DEFAULT_ROLE_PERMISSIONS


class TestJWTTokenEnhancement:
    """Test JWT token enhancement functionality (Requirement 2.3)"""
    
    @pytest.fixture
    def bridge(self):
        """Create a bridge instance for testing"""
        mock_supabase = Mock()
        mock_service_supabase = Mock()
        return SupabaseRBACBridge(
            supabase_client=mock_supabase,
            service_supabase_client=mock_service_supabase
        )
    
    @pytest.mark.asyncio
    async def test_enhance_jwt_token_with_roles(self, bridge):
        """Test that JWT tokens are enhanced with role information"""
        user_id = UUID("00000000-0000-0000-0000-000000000001")
        
        # Mock get_enhanced_user_info to return test data
        test_user_info = {
            "user_id": str(user_id),
            "roles": ["admin", "project_manager"],
            "role_ids": ["role-1", "role-2"],
            "permissions": ["project_read", "project_update"],
            "effective_roles": [
                {
                    "role_id": "role-1",
                    "role_name": "admin",
                    "permissions": ["project_read", "project_update"],
                    "source_type": "global",
                    "source_id": None,
                    "is_inherited": False
                }
            ]
        }
        
        with patch.object(bridge, 'get_enhanced_user_info', return_value=test_user_info):
            enhanced_payload = await bridge.enhance_jwt_token(user_id)
        
        # Verify enhanced payload contains role information
        assert enhanced_payload["sub"] == str(user_id)
        assert "roles" in enhanced_payload
        assert "admin" in enhanced_payload["roles"]
        assert "project_manager" in enhanced_payload["roles"]
        assert "permissions" in enhanced_payload
        assert "project_read" in enhanced_payload["permissions"]
        assert "effective_roles" in enhanced_payload
        assert "enhanced_at" in enhanced_payload
    
    @pytest.mark.asyncio
    async def test_create_enhanced_token_string(self, bridge):
        """Test creating a complete enhanced JWT token string"""
        user_id = UUID("00000000-0000-0000-0000-000000000001")
        secret_key = "test-secret-key-12345678901234567890"
        
        # Mock get_enhanced_user_info
        test_user_info = {
            "user_id": str(user_id),
            "roles": ["admin"],
            "role_ids": ["role-1"],
            "permissions": ["project_read"],
            "effective_roles": []
        }
        
        with patch.object(bridge, 'get_enhanced_user_info', return_value=test_user_info):
            token = await bridge.create_enhanced_token_string(
                user_id,
                secret_key,
                expires_in_seconds=3600
            )
        
        # Verify token was created
        assert token is not None
        assert isinstance(token, str)
        
        # Decode and verify token contents
        decoded = jwt.decode(token, secret_key, algorithms=["HS256"])
        assert decoded["sub"] == str(user_id)
        assert "roles" in decoded
        assert "admin" in decoded["roles"]
        assert "iat" in decoded
        assert "exp" in decoded
    
    @pytest.mark.asyncio
    async def test_extract_roles_from_token(self, bridge):
        """Test extracting role information from enhanced tokens"""
        user_id = "00000000-0000-0000-0000-000000000001"
        
        # Create a test token with role information
        payload = {
            "sub": user_id,
            "roles": ["admin", "project_manager"],
            "role_ids": ["role-1", "role-2"],
            "permissions": ["project_read", "project_update"],
            "effective_roles": [],
            "enhanced_at": datetime.now(timezone.utc).isoformat()
        }
        
        token = jwt.encode(payload, "test-secret", algorithm="HS256")
        
        # Extract roles from token
        role_info = await bridge.extract_roles_from_token(token)
        
        # Verify extracted information
        assert role_info["user_id"] == user_id
        assert role_info["is_enhanced"] is True
        assert "admin" in role_info["roles"]
        assert "project_manager" in role_info["roles"]
        assert "project_read" in role_info["permissions"]
    
    @pytest.mark.asyncio
    async def test_validate_enhanced_token(self, bridge):
        """Test validating enhanced JWT tokens"""
        user_id = "00000000-0000-0000-0000-000000000001"
        secret_key = "test-secret-key-12345678901234567890"
        
        # Create a valid token
        payload = {
            "sub": user_id,
            "roles": ["admin"],
            "permissions": ["project_read"],
            "iat": int(datetime.now(timezone.utc).timestamp()),
            "exp": int((datetime.now(timezone.utc) + timedelta(hours=1)).timestamp()),
            "enhanced_at": datetime.now(timezone.utc).isoformat()
        }
        
        token = jwt.encode(payload, secret_key, algorithm="HS256")
        
        # Validate token
        validated = await bridge.validate_enhanced_token(token, secret_key)
        
        # Verify validation succeeded
        assert validated is not None
        assert validated["sub"] == user_id
        assert "roles" in validated
        assert "admin" in validated["roles"]
    
    @pytest.mark.asyncio
    async def test_validate_expired_token(self, bridge):
        """Test that expired tokens are rejected"""
        user_id = "00000000-0000-0000-0000-000000000001"
        secret_key = "test-secret-key-12345678901234567890"
        
        # Create an expired token
        payload = {
            "sub": user_id,
            "roles": ["admin"],
            "iat": int((datetime.now(timezone.utc) - timedelta(hours=2)).timestamp()),
            "exp": int((datetime.now(timezone.utc) - timedelta(hours=1)).timestamp())
        }
        
        token = jwt.encode(payload, secret_key, algorithm="HS256")
        
        # Validate token (should fail)
        validated = await bridge.validate_enhanced_token(token, secret_key)
        
        # Verify validation failed
        assert validated is None


class TestAdvancedCaching:
    """Test advanced caching functionality (Requirement 2.4)"""
    
    @pytest.fixture
    def bridge(self):
        """Create a bridge instance for testing"""
        mock_supabase = Mock()
        mock_service_supabase = Mock()
        return SupabaseRBACBridge(
            supabase_client=mock_supabase,
            service_supabase_client=mock_service_supabase
        )
    
    @pytest.mark.asyncio
    async def test_in_memory_cache_operations(self, bridge):
        """Test basic in-memory caching operations"""
        cache_key = "test_key"
        test_data = {"user_id": "123", "roles": ["admin"]}
        
        # Cache data
        success = await bridge.cache_data_advanced(cache_key, test_data)
        assert success is True
        
        # Retrieve cached data
        cached = await bridge.get_cached_data_advanced(cache_key)
        assert cached is not None
        assert cached["user_id"] == "123"
        assert "admin" in cached["roles"]
    
    @pytest.mark.asyncio
    async def test_cache_expiration(self, bridge):
        """Test that cached data expires after TTL"""
        # Set a very short TTL for testing
        bridge._cache_ttl = 1
        
        cache_key = "test_expiry"
        test_data = {"user_id": "123"}
        
        # Cache data
        await bridge.cache_data_advanced(cache_key, test_data)
        
        # Verify data is cached
        cached = await bridge.get_cached_data_advanced(cache_key)
        assert cached is not None
        
        # Wait for expiration
        import asyncio
        await asyncio.sleep(1.1)
        
        # Verify data has expired
        cached = await bridge.get_cached_data_advanced(cache_key)
        assert cached is None
    
    @pytest.mark.asyncio
    async def test_clear_user_cache(self, bridge):
        """Test clearing all cache entries for a specific user"""
        user_id = "test-user-123"
        
        # Cache multiple entries for the user
        await bridge.cache_data_advanced(f"enhanced_user:{user_id}", {"data": "1"})
        await bridge.cache_data_advanced(f"perms:{user_id}:global", {"data": "2"})
        await bridge.cache_data_advanced(f"other_user:456", {"data": "3"})
        
        # Clear user cache
        success = await bridge.clear_user_cache_advanced(user_id)
        assert success is True
        
        # Verify user's cache entries are cleared
        assert await bridge.get_cached_data_advanced(f"enhanced_user:{user_id}") is None
        assert await bridge.get_cached_data_advanced(f"perms:{user_id}:global") is None
        
        # Verify other user's cache is intact
        assert await bridge.get_cached_data_advanced(f"other_user:456") is not None
    
    @pytest.mark.asyncio
    async def test_cache_statistics(self, bridge):
        """Test retrieving cache statistics"""
        # Cache some data
        await bridge.cache_data_advanced("key1", {"data": "1"})
        await bridge.cache_data_advanced("key2", {"data": "2"})
        
        # Get statistics
        stats = await bridge.get_cache_statistics()
        
        # Verify statistics
        assert "in_memory_entries" in stats
        assert stats["in_memory_entries"] >= 2
        assert "redis_enabled" in stats
        assert "cache_ttl" in stats
        assert stats["cache_ttl"] == bridge._cache_ttl


class TestAuthSystemBridging:
    """Test auth system bridging functionality (Requirement 2.3)"""
    
    @pytest.fixture
    def bridge(self):
        """Create a bridge instance for testing"""
        mock_supabase = Mock()
        mock_service_supabase = Mock()
        return SupabaseRBACBridge(
            supabase_client=mock_supabase,
            service_supabase_client=mock_service_supabase
        )
    
    @pytest.mark.asyncio
    async def test_get_user_from_jwt_with_enhanced_info(self, bridge):
        """Test extracting user with enhanced info from JWT"""
        user_id = "00000000-0000-0000-0000-000000000001"
        
        # Create a token
        payload = {
            "sub": user_id,
            "email": "test@example.com",
            "roles": ["admin"],
            "permissions": ["project_read"]
        }
        token = jwt.encode(payload, "secret", algorithm="HS256")
        
        # Mock get_enhanced_user_info
        test_user_info = {
            "user_id": user_id,
            "email": "test@example.com",
            "roles": ["admin"],
            "permissions": ["project_read"],
            "effective_roles": []
        }
        
        with patch.object(bridge, 'get_enhanced_user_info', return_value=test_user_info):
            user_info = await bridge.get_user_from_jwt(token)
        
        # Verify user info was retrieved
        assert user_info is not None
        assert user_info["user_id"] == user_id
        assert user_info["email"] == "test@example.com"
        assert "roles" in user_info
        assert "admin" in user_info["roles"]
    
    @pytest.mark.asyncio
    async def test_enhanced_user_info_uses_cache(self, bridge):
        """Test that enhanced user info uses caching"""
        user_id = UUID("00000000-0000-0000-0000-000000000001")
        
        # Mock database response
        mock_roles = [
            {
                "id": "role-1",
                "name": "admin",
                "permissions": ["project_read", "project_update"],
                "scope_type": None,
                "scope_id": None
            }
        ]
        
        with patch.object(bridge, '_get_user_roles_from_db', return_value=mock_roles):
            # First call - should hit database
            user_info1 = await bridge.get_enhanced_user_info(user_id)
            
            # Second call - should hit cache
            user_info2 = await bridge.get_enhanced_user_info(user_id)
        
        # Verify both calls returned data
        assert user_info1 is not None
        assert user_info2 is not None
        assert user_info1["user_id"] == user_info2["user_id"]
        assert user_info1["roles"] == user_info2["roles"]


class TestIntegration:
    """Integration tests for complete auth bridging flow"""
    
    @pytest.mark.asyncio
    async def test_complete_token_enhancement_flow(self):
        """Test complete flow: create user -> enhance token -> validate -> extract roles"""
        # Create bridge
        mock_supabase = Mock()
        mock_service_supabase = Mock()
        bridge = SupabaseRBACBridge(
            supabase_client=mock_supabase,
            service_supabase_client=mock_service_supabase
        )
        
        user_id = UUID("00000000-0000-0000-0000-000000000001")
        secret_key = "test-secret-key-12345678901234567890"
        
        # Mock user info
        test_user_info = {
            "user_id": str(user_id),
            "roles": ["admin", "project_manager"],
            "role_ids": ["role-1", "role-2"],
            "permissions": ["project_read", "project_update", "project_delete"],
            "effective_roles": []
        }
        
        with patch.object(bridge, 'get_enhanced_user_info', return_value=test_user_info):
            # 1. Create enhanced token
            token = await bridge.create_enhanced_token_string(user_id, secret_key)
            assert token is not None
            
            # 2. Validate token
            validated = await bridge.validate_enhanced_token(token, secret_key)
            assert validated is not None
            assert validated["sub"] == str(user_id)
            
            # 3. Extract roles from token
            role_info = await bridge.extract_roles_from_token(token)
            assert role_info["is_enhanced"] is True
            assert "admin" in role_info["roles"]
            assert "project_manager" in role_info["roles"]
            assert len(role_info["permissions"]) == 3


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
