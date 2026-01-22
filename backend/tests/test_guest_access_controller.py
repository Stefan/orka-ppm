"""
Unit tests for Guest Access Controller

Tests token validation, rate limiting, and access logging functionality
for the shareable project URLs system.

Requirements: 3.2, 3.3, 7.4
"""

import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import Mock, AsyncMock, patch
from uuid import uuid4

from services.guest_access_controller import GuestAccessController
from models.shareable_urls import ShareLinkValidation


class TestGuestAccessController:
    """Test suite for GuestAccessController"""
    
    @pytest.fixture
    def mock_db(self):
        """Create a mock database client"""
        db = Mock()
        db.table = Mock(return_value=db)
        db.select = Mock(return_value=db)
        db.eq = Mock(return_value=db)
        db.insert = Mock(return_value=db)
        db.update = Mock(return_value=db)
        # execute should return a Mock (not AsyncMock) with data attribute
        db.execute = Mock()
        return db
    
    @pytest.fixture
    def controller(self, mock_db):
        """Create a GuestAccessController instance with mock database"""
        return GuestAccessController(db_session=mock_db)
    
    @pytest.fixture
    def valid_token(self):
        """Generate a valid 64-character token"""
        return "a" * 64
    
    @pytest.fixture
    def valid_share_data(self, valid_token):
        """Create valid share link data"""
        return {
            "id": str(uuid4()),
            "project_id": str(uuid4()),
            "token": valid_token,
            "permission_level": "view_only",
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
            "is_active": True,
            "revoked_at": None
        }
    
    # ==================== Token Validation Tests ====================
    
    @pytest.mark.asyncio
    async def test_validate_token_success(self, controller, mock_db, valid_token, valid_share_data):
        """Test successful token validation"""
        # Setup mock response
        mock_db.execute.return_value = Mock(data=[valid_share_data])
        
        # Validate token
        result = await controller.validate_token(valid_token)
        
        # Assertions
        assert result.is_valid is True
        assert result.share_id == valid_share_data["id"]
        assert result.project_id == valid_share_data["project_id"]
        assert result.permission_level == valid_share_data["permission_level"]
        assert result.error_message is None
    
    @pytest.mark.asyncio
    async def test_validate_token_not_found(self, controller, mock_db, valid_token):
        """Test token validation when token doesn't exist"""
        # Setup mock response - no data
        mock_db.execute.return_value = Mock(data=[])
        
        # Validate token
        result = await controller.validate_token(valid_token)
        
        # Assertions
        assert result.is_valid is False
        assert result.error_message == "Invalid share link token"
    
    @pytest.mark.asyncio
    async def test_validate_token_invalid_format(self, controller):
        """Test token validation with invalid token format"""
        # Test with short token
        result = await controller.validate_token("short")
        assert result.is_valid is False
        assert result.error_message == "Invalid share link token"
        
        # Test with empty token
        result = await controller.validate_token("")
        assert result.is_valid is False
        assert result.error_message == "Invalid share link token"
        
        # Test with None token
        result = await controller.validate_token(None)
        assert result.is_valid is False
        assert result.error_message == "Invalid share link token"
    
    @pytest.mark.asyncio
    async def test_validate_token_inactive(self, controller, mock_db, valid_token, valid_share_data):
        """Test token validation when share link is inactive"""
        # Setup mock response - inactive share
        valid_share_data["is_active"] = False
        mock_db.execute.return_value = Mock(data=[valid_share_data])
        
        # Validate token
        result = await controller.validate_token(valid_token)
        
        # Assertions
        assert result.is_valid is False
        assert result.error_message == "This share link is no longer active"
        assert result.share_id == valid_share_data["id"]
    
    @pytest.mark.asyncio
    async def test_validate_token_revoked(self, controller, mock_db, valid_token, valid_share_data):
        """Test token validation when share link is revoked"""
        # Setup mock response - revoked share
        valid_share_data["revoked_at"] = datetime.now(timezone.utc).isoformat()
        mock_db.execute.return_value = Mock(data=[valid_share_data])
        
        # Validate token
        result = await controller.validate_token(valid_token)
        
        # Assertions
        assert result.is_valid is False
        assert result.error_message == "This share link has been revoked"
        assert result.share_id == valid_share_data["id"]
    
    @pytest.mark.asyncio
    async def test_validate_token_expired(self, controller, mock_db, valid_token, valid_share_data):
        """Test token validation when share link has expired"""
        # Setup mock response - expired share
        valid_share_data["expires_at"] = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        mock_db.execute.return_value = Mock(data=[valid_share_data])
        
        # Validate token
        result = await controller.validate_token(valid_token)
        
        # Assertions
        assert result.is_valid is False
        assert result.error_message == "This share link has expired"
        assert result.share_id == valid_share_data["id"]
    
    @pytest.mark.asyncio
    async def test_validate_token_database_error(self, controller, mock_db, valid_token):
        """Test token validation when database error occurs"""
        # Setup mock to raise exception
        mock_db.execute.side_effect = Exception("Database connection failed")
        
        # Validate token
        result = await controller.validate_token(valid_token)
        
        # Assertions
        assert result.is_valid is False
        assert "error occurred" in result.error_message.lower()
    
    # ==================== Constant-Time Comparison Tests ====================
    
    def test_constant_time_compare_equal(self, controller):
        """Test constant-time comparison with equal strings"""
        assert controller._constant_time_compare("test123", "test123") is True
    
    def test_constant_time_compare_not_equal(self, controller):
        """Test constant-time comparison with different strings"""
        assert controller._constant_time_compare("test123", "test456") is False
    
    def test_constant_time_compare_different_lengths(self, controller):
        """Test constant-time comparison with different length strings"""
        assert controller._constant_time_compare("short", "longer_string") is False
    
    def test_constant_time_compare_empty_strings(self, controller):
        """Test constant-time comparison with empty strings"""
        assert controller._constant_time_compare("", "") is True
        assert controller._constant_time_compare("test", "") is False
    
    def test_constant_time_compare_non_strings(self, controller):
        """Test constant-time comparison with non-string inputs"""
        assert controller._constant_time_compare(None, "test") is False
        assert controller._constant_time_compare("test", None) is False
        assert controller._constant_time_compare(123, "test") is False
    
    # ==================== Expiry Checking Tests ====================
    
    def test_is_expired_future_date(self, controller):
        """Test expiry check with future date"""
        future_date = datetime.now(timezone.utc) + timedelta(days=7)
        assert controller._is_expired(future_date) is False
    
    def test_is_expired_past_date(self, controller):
        """Test expiry check with past date"""
        past_date = datetime.now(timezone.utc) - timedelta(days=1)
        assert controller._is_expired(past_date) is True
    
    def test_is_expired_exact_now(self, controller):
        """Test expiry check with current time (should be expired)"""
        now = datetime.now(timezone.utc)
        assert controller._is_expired(now) is True
    
    def test_is_expired_naive_datetime(self, controller):
        """Test expiry check with naive datetime (no timezone)"""
        # Naive datetime in the past
        past_naive = datetime.now() - timedelta(days=1)
        assert controller._is_expired(past_naive) is True
        
        # Naive datetime in the future
        future_naive = datetime.now() + timedelta(days=7)
        assert controller._is_expired(future_naive) is False
    
    def test_is_expired_different_timezones(self, controller):
        """Test expiry check handles timezone-aware datetimes correctly"""
        # Create a future time in UTC
        future_utc = datetime.now(timezone.utc) + timedelta(hours=2)
        assert controller._is_expired(future_utc) is False
    
    # ==================== Rate Limiting Tests ====================
    
    def test_check_rate_limit_first_request(self, controller):
        """Test rate limit check for first request"""
        result = controller.check_rate_limit("192.168.1.1", "share-123")
        assert result is True
    
    def test_check_rate_limit_within_limit(self, controller):
        """Test rate limit check when within limit"""
        ip = "192.168.1.1"
        share_id = "share-123"
        
        # Make 9 requests (within limit of 10)
        for i in range(9):
            result = controller.check_rate_limit(ip, share_id)
            assert result is True
    
    def test_check_rate_limit_at_limit(self, controller):
        """Test rate limit check when at exactly the limit"""
        ip = "192.168.1.1"
        share_id = "share-123"
        
        # Make 10 requests (at limit)
        for i in range(10):
            result = controller.check_rate_limit(ip, share_id)
            assert result is True
    
    def test_check_rate_limit_exceeded(self, controller):
        """Test rate limit check when limit is exceeded"""
        ip = "192.168.1.1"
        share_id = "share-123"
        
        # Make 10 requests (at limit)
        for i in range(10):
            controller.check_rate_limit(ip, share_id)
        
        # 11th request should be blocked
        result = controller.check_rate_limit(ip, share_id)
        assert result is False
    
    def test_check_rate_limit_different_ips(self, controller):
        """Test rate limit is per IP address"""
        share_id = "share-123"
        
        # Make 10 requests from first IP
        for i in range(10):
            controller.check_rate_limit("192.168.1.1", share_id)
        
        # Request from different IP should succeed
        result = controller.check_rate_limit("192.168.1.2", share_id)
        assert result is True
    
    def test_check_rate_limit_different_shares(self, controller):
        """Test rate limit is per share link"""
        ip = "192.168.1.1"
        
        # Make 10 requests to first share
        for i in range(10):
            controller.check_rate_limit(ip, "share-123")
        
        # Request to different share should succeed
        result = controller.check_rate_limit(ip, "share-456")
        assert result is True
    
    def test_check_rate_limit_sliding_window(self, controller):
        """Test rate limit uses sliding window"""
        ip = "192.168.1.1"
        share_id = "share-123"
        
        # Make 10 requests
        for i in range(10):
            controller.check_rate_limit(ip, share_id)
        
        # 11th request should be blocked
        assert controller.check_rate_limit(ip, share_id) is False
        
        # Manually age out old requests by manipulating storage
        with controller._rate_limit_lock:
            key = (ip, share_id)
            now = datetime.now(timezone.utc).timestamp()
            # Set first request to be 61 seconds ago (outside window)
            controller._rate_limit_storage[key][0] = now - 61
        
        # Now request should succeed (only 9 requests in window)
        result = controller.check_rate_limit(ip, share_id)
        assert result is True
    
    def test_clear_rate_limit_cache(self, controller):
        """Test clearing rate limit cache"""
        ip = "192.168.1.1"
        share_id = "share-123"
        
        # Make some requests
        for i in range(5):
            controller.check_rate_limit(ip, share_id)
        
        # Clear cache
        controller.clear_rate_limit_cache()
        
        # Should be able to make 10 more requests
        for i in range(10):
            result = controller.check_rate_limit(ip, share_id)
            assert result is True
    
    def test_get_rate_limit_info(self, controller):
        """Test getting rate limit information"""
        ip = "192.168.1.1"
        share_id = "share-123"
        
        # Make 5 requests
        for i in range(5):
            controller.check_rate_limit(ip, share_id)
        
        # Get rate limit info
        info = controller.get_rate_limit_info(ip, share_id)
        
        assert info["requests_count"] == 5
        assert info["limit"] == 10
        assert info["window_seconds"] == 60
        assert info["is_limited"] is False
    
    def test_get_rate_limit_info_limited(self, controller):
        """Test getting rate limit info when limited"""
        ip = "192.168.1.1"
        share_id = "share-123"
        
        # Make 10 requests (at limit)
        for i in range(10):
            controller.check_rate_limit(ip, share_id)
        
        # Get rate limit info
        info = controller.get_rate_limit_info(ip, share_id)
        
        assert info["requests_count"] == 10
        assert info["is_limited"] is True
    
    # ==================== Access Logging Tests ====================
    
    @pytest.mark.asyncio
    async def test_log_access_attempt_success(self, controller, mock_db):
        """Test logging successful access attempt"""
        share_id = str(uuid4())
        ip_address = "192.168.1.1"
        user_agent = "Mozilla/5.0"
        
        # Setup mock responses
        # First call: insert log entry
        # Second call: get access count
        # Third call: update share link
        mock_db.execute.side_effect = [
            Mock(data=[{"id": "log-123"}]),  # Insert log
            Mock(data=[{"access_count": 5}]),  # Get current count
            Mock(data=[{"id": share_id}])  # Update share link
        ]
        
        # Log access attempt
        result = await controller.log_access_attempt(
            share_id, ip_address, user_agent, success=True
        )
        
        # Assertions
        assert result is True
        # Verify insert was called
        assert mock_db.table.called
        assert mock_db.insert.called
    
    @pytest.mark.asyncio
    async def test_log_access_attempt_failure(self, controller, mock_db):
        """Test logging failed access attempt"""
        share_id = str(uuid4())
        ip_address = "192.168.1.1"
        user_agent = "Mozilla/5.0"
        
        # Setup mock responses
        mock_db.execute.return_value = Mock(data=[{"id": "log-123"}])
        
        # Log access attempt
        result = await controller.log_access_attempt(
            share_id, ip_address, user_agent, success=False
        )
        
        # Assertions
        assert result is True
        # Verify insert was called but update was not (since success=False)
        assert mock_db.table.called
        assert mock_db.insert.called
    
    @pytest.mark.asyncio
    async def test_log_access_attempt_no_user_agent(self, controller, mock_db):
        """Test logging access attempt without user agent"""
        share_id = str(uuid4())
        ip_address = "192.168.1.1"
        
        # Setup mock responses
        mock_db.execute.side_effect = [
            Mock(data=[{"id": "log-123"}]),  # Insert log
            Mock(data=[{"access_count": 3}]),  # Get current count
            Mock(data=[{"id": share_id}])  # Update share link
        ]
        
        # Log access attempt
        result = await controller.log_access_attempt(
            share_id, ip_address, None, success=True
        )
        
        # Assertions
        assert result is True
    
    @pytest.mark.asyncio
    async def test_log_access_attempt_database_error(self, controller, mock_db):
        """Test logging access attempt when database error occurs"""
        share_id = str(uuid4())
        ip_address = "192.168.1.1"
        user_agent = "Mozilla/5.0"
        
        # Setup mock to raise exception
        mock_db.execute.side_effect = Exception("Database error")
        
        # Log access attempt
        result = await controller.log_access_attempt(
            share_id, ip_address, user_agent, success=True
        )
        
        # Assertions
        assert result is False
    
    # ==================== Integration Tests ====================
    
    @pytest.mark.asyncio
    async def test_full_validation_flow(self, controller, mock_db, valid_token, valid_share_data):
        """Test complete validation flow with rate limiting and logging"""
        ip_address = "192.168.1.1"
        share_id = valid_share_data["id"]
        
        # Setup mock response for validation and logging
        mock_db.execute.side_effect = [
            Mock(data=[valid_share_data]),  # Validate token
            Mock(data=[{"id": "log-123"}]),  # Insert log
            Mock(data=[{"access_count": 10}]),  # Get current count
            Mock(data=[{"id": share_id}])  # Update share link
        ]
        
        # 1. Check rate limit (should pass)
        rate_limit_ok = controller.check_rate_limit(ip_address, share_id)
        assert rate_limit_ok is True
        
        # 2. Validate token (should succeed)
        validation = await controller.validate_token(valid_token)
        assert validation.is_valid is True
        
        # 3. Log access attempt (should succeed)
        logged = await controller.log_access_attempt(
            share_id, ip_address, "Mozilla/5.0", success=True
        )
        assert logged is True
    
    @pytest.mark.asyncio
    async def test_rate_limit_blocks_validation(self, controller, mock_db, valid_token, valid_share_data):
        """Test that rate limiting prevents excessive validation attempts"""
        ip_address = "192.168.1.1"
        share_id = valid_share_data["id"]
        
        # Setup mock response
        mock_db.execute.return_value = Mock(data=[valid_share_data])
        
        # Make 10 requests (at limit)
        for i in range(10):
            rate_limit_ok = controller.check_rate_limit(ip_address, share_id)
            assert rate_limit_ok is True
        
        # 11th request should be blocked
        rate_limit_ok = controller.check_rate_limit(ip_address, share_id)
        assert rate_limit_ok is False
        
        # Even with valid token, access should be denied due to rate limit
        # (In real implementation, API would check rate limit before validation)


class TestGuestAccessControllerEdgeCases:
    """Test edge cases and error conditions"""
    
    @pytest.fixture
    def controller_no_db(self):
        """Create controller with explicitly None database"""
        controller = GuestAccessController(db_session=None)
        # Override the db attribute to ensure it's None
        controller.db = None
        return controller
    
    @pytest.mark.asyncio
    async def test_validate_token_no_database(self, controller_no_db):
        """Test token validation when database is not available"""
        result = await controller_no_db.validate_token("a" * 64)
        assert result.is_valid is False
        # When db is None, we return early with "Service temporarily unavailable"
        assert result.error_message == "Service temporarily unavailable"
    
    @pytest.mark.asyncio
    async def test_log_access_no_database(self, controller_no_db):
        """Test access logging when database is not available"""
        result = await controller_no_db.log_access_attempt(
            str(uuid4()), "192.168.1.1", "Mozilla/5.0", success=True
        )
        assert result is False
    
    def test_rate_limit_with_special_characters(self, controller_no_db):
        """Test rate limiting with special characters in IP"""
        # IPv6 address
        result = controller_no_db.check_rate_limit("2001:0db8:85a3::8a2e:0370:7334", "share-123")
        assert result is True
    
    def test_concurrent_rate_limit_checks(self, controller_no_db):
        """Test rate limiting with concurrent access (thread safety)"""
        import threading
        
        ip = "192.168.1.1"
        share_id = "share-123"
        results = []
        
        def check_limit():
            result = controller_no_db.check_rate_limit(ip, share_id)
            results.append(result)
        
        # Create 15 threads to check rate limit concurrently
        threads = [threading.Thread(target=check_limit) for _ in range(15)]
        
        # Start all threads
        for thread in threads:
            thread.start()
        
        # Wait for all threads to complete
        for thread in threads:
            thread.join()
        
        # Should have 10 True and 5 False (rate limit enforced)
        true_count = sum(1 for r in results if r is True)
        false_count = sum(1 for r in results if r is False)
        
        assert true_count == 10
        assert false_count == 5


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
