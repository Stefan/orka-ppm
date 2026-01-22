"""
Performance tests for share link caching and database optimization.

These tests verify:
- Caching effectiveness and invalidation
- Database query performance under load
- Concurrent access handling

Requirements: Performance considerations
"""

import pytest
import asyncio
import time
from datetime import datetime, timedelta, timezone
from uuid import uuid4
from unittest.mock import Mock, AsyncMock, patch

from services.guest_access_controller import GuestAccessController
from services.share_link_generator import ShareLinkGenerator
from services.share_link_cleanup import ShareLinkCleanupService
from models.shareable_urls import SharePermissionLevel
from performance_optimization import CacheManager


class TestCachingEffectiveness:
    """Test caching effectiveness and invalidation."""
    
    @pytest.mark.asyncio
    async def test_token_validation_cache_hit(self):
        """Test that token validation uses cache on subsequent calls."""
        # Setup
        mock_db = Mock()
        mock_cache = AsyncMock(spec=CacheManager)
        
        # First call - cache miss
        mock_cache.get.return_value = None
        mock_cache.set = AsyncMock()
        
        # Mock database response
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = Mock(
            data=[{
                "id": str(uuid4()),
                "project_id": str(uuid4()),
                "token": "a" * 64,
                "permission_level": "view_only",
                "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
                "is_active": True,
                "revoked_at": None
            }]
        )
        
        controller = GuestAccessController(db_session=mock_db, cache_manager=mock_cache)
        
        # First call - should query database
        token = "a" * 64
        result1 = await controller.validate_token(token)
        
        assert result1.is_valid
        assert mock_cache.get.call_count == 1
        assert mock_cache.set.call_count == 1
        
        # Second call - should use cache
        mock_cache.get.return_value = result1.dict()
        result2 = await controller.validate_token(token)
        
        assert result2.is_valid
        assert mock_cache.get.call_count == 2
        # Database should not be queried again
        assert mock_db.table.return_value.select.return_value.eq.return_value.execute.call_count == 1
    
    @pytest.mark.asyncio
    async def test_project_data_cache_hit(self):
        """Test that filtered project data uses cache on subsequent calls."""
        # Setup
        mock_db = Mock()
        mock_cache = AsyncMock(spec=CacheManager)
        
        # First call - cache miss
        mock_cache.get.return_value = None
        mock_cache.set = AsyncMock()
        
        project_id = uuid4()
        
        # Mock database response
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = Mock(
            data=[{
                "id": str(project_id),
                "name": "Test Project",
                "description": "Test Description",
                "status": "active",
                "progress_percentage": 50.0,
                "start_date": "2026-01-01",
                "end_date": "2026-12-31"
            }]
        )
        
        controller = GuestAccessController(db_session=mock_db, cache_manager=mock_cache)
        
        # First call - should query database
        result1 = await controller.get_filtered_project_data(
            project_id,
            SharePermissionLevel.VIEW_ONLY
        )
        
        assert result1 is not None
        assert result1.name == "Test Project"
        assert mock_cache.get.call_count == 1
        assert mock_cache.set.call_count == 1
        
        # Second call - should use cache
        mock_cache.get.return_value = result1.dict()
        result2 = await controller.get_filtered_project_data(
            project_id,
            SharePermissionLevel.VIEW_ONLY
        )
        
        assert result2 is not None
        assert result2.name == "Test Project"
        assert mock_cache.get.call_count == 2
        # Database should not be queried again
        assert mock_db.table.return_value.select.return_value.eq.return_value.execute.call_count == 1
    
    @pytest.mark.asyncio
    async def test_cache_invalidation_on_revoke(self):
        """Test that cache is invalidated when share link is revoked."""
        # Setup
        mock_db = Mock()
        mock_cache = AsyncMock(spec=CacheManager)
        
        share_id = uuid4()
        token = "a" * 64
        
        # Mock database responses
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = Mock(
            data=[{"token": token}]
        )
        mock_db.table.return_value.update.return_value.eq.return_value.execute.return_value = Mock(
            data=[{"id": str(share_id)}]
        )
        
        generator = ShareLinkGenerator(db_session=mock_db, cache_manager=mock_cache)
        
        # Revoke share link
        result = await generator.revoke_share_link(
            share_id,
            uuid4(),
            "Test revocation"
        )
        
        assert result is True
        # Cache should be invalidated
        assert mock_cache.delete.call_count == 1
        cache_key = mock_cache.delete.call_args[0][0]
        assert cache_key == f"share_token_validation:{token}"
    
    @pytest.mark.asyncio
    async def test_cache_ttl_respected(self):
        """Test that cache TTL is respected for different data types."""
        # Setup
        mock_db = Mock()
        mock_cache = AsyncMock(spec=CacheManager)
        mock_cache.get.return_value = None
        
        controller = GuestAccessController(db_session=mock_db, cache_manager=mock_cache)
        
        # Mock database response for token validation
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = Mock(
            data=[{
                "id": str(uuid4()),
                "project_id": str(uuid4()),
                "token": "a" * 64,
                "permission_level": "view_only",
                "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
                "is_active": True,
                "revoked_at": None
            }]
        )
        
        # Test token validation cache TTL (1 minute)
        await controller.validate_token("a" * 64)
        
        # Check that cache was set with correct TTL
        assert mock_cache.set.call_count == 1
        call_args = mock_cache.set.call_args
        assert call_args[1]['ttl'] == controller.TOKEN_VALIDATION_CACHE_TTL  # 60 seconds
        
        # Reset mock
        mock_cache.reset_mock()
        mock_cache.get.return_value = None
        
        # Mock database response for project data
        project_id = uuid4()
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = Mock(
            data=[{
                "id": str(project_id),
                "name": "Test Project",
                "description": "Test",
                "status": "active",
                "progress_percentage": 50.0
            }]
        )
        
        # Test project data cache TTL (5 minutes)
        await controller.get_filtered_project_data(
            project_id,
            SharePermissionLevel.VIEW_ONLY
        )
        
        # Check that cache was set with correct TTL
        assert mock_cache.set.call_count == 1
        call_args = mock_cache.set.call_args
        assert call_args[1]['ttl'] == controller.PROJECT_DATA_CACHE_TTL  # 300 seconds


class TestDatabasePerformance:
    """Test database query performance under load."""
    
    @pytest.mark.asyncio
    async def test_cleanup_expired_links_performance(self):
        """Test that cleanup of expired links completes in reasonable time."""
        # Setup
        mock_db = Mock()
        
        # Mock 100 expired links
        expired_links = [
            {
                "id": str(uuid4()),
                "token": f"token_{i}",
                "project_id": str(uuid4()),
                "expires_at": (datetime.now(timezone.utc) - timedelta(days=10)).isoformat()
            }
            for i in range(100)
        ]
        
        mock_db.table.return_value.select.return_value.eq.return_value.lt.return_value.execute.return_value = Mock(
            data=expired_links
        )
        mock_db.table.return_value.update.return_value.eq.return_value.execute.return_value = Mock(
            data=[{"id": "test"}]
        )
        
        cleanup_service = ShareLinkCleanupService(db_session=mock_db)
        
        # Measure cleanup time
        start_time = time.time()
        result = await cleanup_service.cleanup_expired_share_links(grace_period_days=7)
        elapsed_time = time.time() - start_time
        
        # Should complete in less than 5 seconds for 100 links
        assert elapsed_time < 5.0
        assert result['cleaned_count'] == 100
    
    @pytest.mark.asyncio
    async def test_archive_logs_performance(self):
        """Test that log archival completes in reasonable time."""
        # Setup
        mock_db = Mock()
        
        # Mock count result
        mock_db.table.return_value.select.return_value.lt.return_value.execute.return_value = Mock(
            count=1000
        )
        
        # Mock delete result
        mock_db.table.return_value.delete.return_value.lt.return_value.execute.return_value = Mock(
            data=[{"id": str(uuid4())} for _ in range(1000)]
        )
        
        cleanup_service = ShareLinkCleanupService(db_session=mock_db)
        
        # Measure archival time
        start_time = time.time()
        result = await cleanup_service.archive_old_access_logs(retention_days=90)
        elapsed_time = time.time() - start_time
        
        # Should complete in less than 3 seconds for 1000 logs
        assert elapsed_time < 3.0
        assert result['archived_count'] == 1000
    
    @pytest.mark.asyncio
    async def test_statistics_query_performance(self):
        """Test that statistics queries complete quickly."""
        # Setup
        mock_db = Mock()
        
        # Mock count results
        mock_db.table.return_value.select.return_value.execute.return_value = Mock(count=10000)
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = Mock(count=5000)
        mock_db.table.return_value.select.return_value.eq.return_value.lt.return_value.execute.return_value = Mock(count=500)
        mock_db.table.return_value.select.return_value.gte.return_value.execute.return_value = Mock(count=2000)
        
        cleanup_service = ShareLinkCleanupService(db_session=mock_db)
        
        # Measure statistics query time
        start_time = time.time()
        result = await cleanup_service.get_cleanup_statistics()
        elapsed_time = time.time() - start_time
        
        # Should complete in less than 2 seconds
        assert elapsed_time < 2.0
        assert 'share_links' in result
        assert 'access_logs' in result


class TestConcurrentAccess:
    """Test concurrent access handling."""
    
    @pytest.mark.asyncio
    async def test_concurrent_token_validation(self):
        """Test that concurrent token validations are handled correctly."""
        # Setup
        mock_db = Mock()
        mock_cache = AsyncMock(spec=CacheManager)
        mock_cache.get.return_value = None
        mock_cache.set = AsyncMock()
        
        # Mock database response
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = Mock(
            data=[{
                "id": str(uuid4()),
                "project_id": str(uuid4()),
                "token": "a" * 64,
                "permission_level": "view_only",
                "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
                "is_active": True,
                "revoked_at": None
            }]
        )
        
        controller = GuestAccessController(db_session=mock_db, cache_manager=mock_cache)
        
        # Create 10 concurrent validation requests
        token = "a" * 64
        tasks = [controller.validate_token(token) for _ in range(10)]
        
        # Measure concurrent execution time
        start_time = time.time()
        results = await asyncio.gather(*tasks)
        elapsed_time = time.time() - start_time
        
        # All should succeed
        assert all(r.is_valid for r in results)
        
        # Should complete in less than 2 seconds
        assert elapsed_time < 2.0
    
    @pytest.mark.asyncio
    async def test_concurrent_project_data_access(self):
        """Test that concurrent project data access is handled correctly."""
        # Setup
        mock_db = Mock()
        mock_cache = AsyncMock(spec=CacheManager)
        mock_cache.get.return_value = None
        mock_cache.set = AsyncMock()
        
        project_id = uuid4()
        
        # Mock database response
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = Mock(
            data=[{
                "id": str(project_id),
                "name": "Test Project",
                "description": "Test",
                "status": "active",
                "progress_percentage": 50.0
            }]
        )
        
        controller = GuestAccessController(db_session=mock_db, cache_manager=mock_cache)
        
        # Create 10 concurrent data access requests
        tasks = [
            controller.get_filtered_project_data(project_id, SharePermissionLevel.VIEW_ONLY)
            for _ in range(10)
        ]
        
        # Measure concurrent execution time
        start_time = time.time()
        results = await asyncio.gather(*tasks)
        elapsed_time = time.time() - start_time
        
        # All should succeed
        assert all(r is not None for r in results)
        assert all(r.name == "Test Project" for r in results)
        
        # Should complete in less than 3 seconds
        assert elapsed_time < 3.0
    
    @pytest.mark.asyncio
    async def test_rate_limiting_under_concurrent_load(self):
        """Test that rate limiting works correctly under concurrent load."""
        # Setup
        mock_db = Mock()
        controller = GuestAccessController(db_session=mock_db)
        
        ip_address = "192.168.1.1"
        share_id = str(uuid4())
        
        # Create 20 concurrent rate limit checks (limit is 10)
        async def check_limit():
            return controller.check_rate_limit(ip_address, share_id)
        
        tasks = [check_limit() for _ in range(20)]
        
        # Execute concurrently
        results = await asyncio.gather(*tasks)
        
        # First 10 should pass, rest should fail
        passed = sum(1 for r in results if r)
        failed = sum(1 for r in results if not r)
        
        # Should have approximately 10 passes and 10 failures
        # (exact count may vary due to timing)
        assert 8 <= passed <= 12
        assert 8 <= failed <= 12
    
    @pytest.mark.asyncio
    async def test_cache_invalidation_race_condition(self):
        """Test that cache invalidation doesn't cause race conditions."""
        # Setup
        mock_db = Mock()
        mock_cache = AsyncMock(spec=CacheManager)
        
        project_id = uuid4()
        
        controller = GuestAccessController(db_session=mock_db, cache_manager=mock_cache)
        
        # Simulate concurrent cache invalidation and access
        async def invalidate():
            await controller.invalidate_project_cache(project_id)
        
        async def access():
            mock_cache.get.return_value = None
            mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = Mock(
                data=[{
                    "id": str(project_id),
                    "name": "Test",
                    "description": "Test",
                    "status": "active",
                    "progress_percentage": 50.0
                }]
            )
            return await controller.get_filtered_project_data(
                project_id,
                SharePermissionLevel.VIEW_ONLY
            )
        
        # Create mixed tasks
        tasks = []
        for i in range(20):
            if i % 5 == 0:
                tasks.append(invalidate())
            else:
                tasks.append(access())
        
        # Execute concurrently
        start_time = time.time()
        results = await asyncio.gather(*tasks, return_exceptions=True)
        elapsed_time = time.time() - start_time
        
        # Should complete without errors
        assert not any(isinstance(r, Exception) for r in results)
        
        # Should complete in reasonable time
        assert elapsed_time < 5.0


class TestCacheMemoryUsage:
    """Test cache memory usage and efficiency."""
    
    @pytest.mark.asyncio
    async def test_cache_key_format(self):
        """Test that cache keys are formatted correctly and consistently."""
        # Setup
        mock_db = Mock()
        mock_cache = AsyncMock(spec=CacheManager)
        mock_cache.get.return_value = None
        
        controller = GuestAccessController(db_session=mock_db, cache_manager=mock_cache)
        
        # Test token validation cache key
        token = "a" * 64
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = Mock(
            data=[{
                "id": str(uuid4()),
                "project_id": str(uuid4()),
                "token": token,
                "permission_level": "view_only",
                "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
                "is_active": True,
                "revoked_at": None
            }]
        )
        
        await controller.validate_token(token)
        
        # Check cache key format
        cache_key = mock_cache.get.call_args[0][0]
        assert cache_key == f"share_token_validation:{token}"
        
        # Reset mock
        mock_cache.reset_mock()
        mock_cache.get.return_value = None
        
        # Test project data cache key
        project_id = uuid4()
        permission_level = SharePermissionLevel.LIMITED_DATA
        
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = Mock(
            data=[{
                "id": str(project_id),
                "name": "Test",
                "description": "Test",
                "status": "active",
                "progress_percentage": 50.0
            }]
        )
        
        await controller.get_filtered_project_data(project_id, permission_level)
        
        # Check cache key format
        cache_key = mock_cache.get.call_args[0][0]
        assert cache_key == f"filtered_project:{project_id}:{permission_level.value}"
    
    @pytest.mark.asyncio
    async def test_cache_invalidation_clears_all_variants(self):
        """Test that cache invalidation clears all permission level variants."""
        # Setup
        mock_db = Mock()
        mock_cache = AsyncMock(spec=CacheManager)
        mock_cache.delete = AsyncMock(return_value=True)
        
        controller = GuestAccessController(db_session=mock_db, cache_manager=mock_cache)
        
        project_id = uuid4()
        
        # Invalidate project cache
        cleared_count = await controller.invalidate_project_cache(project_id)
        
        # Should clear all 3 permission level variants
        assert cleared_count == 3
        assert mock_cache.delete.call_count == 3
        
        # Check that all permission levels were cleared
        cache_keys = [call[0][0] for call in mock_cache.delete.call_args_list]
        expected_keys = [
            f"filtered_project:{project_id}:view_only",
            f"filtered_project:{project_id}:limited_data",
            f"filtered_project:{project_id}:full_project"
        ]
        assert set(cache_keys) == set(expected_keys)


# Performance benchmarks (for manual testing)
if __name__ == "__main__":
    print("Running performance benchmarks...")
    print("Note: These are unit tests with mocked dependencies.")
    print("For real performance testing, use load testing tools like Locust or k6.")
    
    # Run tests
    pytest.main([__file__, "-v", "-s"])
