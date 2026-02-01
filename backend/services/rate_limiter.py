"""
Rate Limiting Service for RAG Knowledge Base
Implements rate limiting using slowapi library to prevent abuse
"""

import logging
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from collections import defaultdict
import asyncio

logger = logging.getLogger(__name__)


class RateLimitExceeded(Exception):
    """Exception raised when rate limit is exceeded"""
    pass


class RateLimiter:
    """
    Rate limiter for API endpoints.

    Features:
    - Configurable limits per user/time window
    - Sliding window rate limiting
    - Different limits for different user roles
    - Automatic cleanup of old entries
    """

    def __init__(
        self,
        default_limit: int = 100,  # requests per hour
        window_seconds: int = 3600,  # 1 hour window
        cleanup_interval: int = 300  # 5 minutes cleanup
    ):
        self.default_limit = default_limit
        self.window_seconds = window_seconds
        self.cleanup_interval = cleanup_interval

        # Storage: user_id -> list of request timestamps
        self.requests: Dict[str, list] = defaultdict(list)

        # Role-based limits
        self.role_limits = {
            "admin": 1000,  # Higher limit for admins
            "manager": 500,
            "user": 100,
            "anonymous": 10  # Lower limit for anonymous users
        }

        # Start cleanup task
        self._cleanup_task: Optional[asyncio.Task] = None

    async def start(self):
        """Start the cleanup task"""
        if self._cleanup_task is None:
            self._cleanup_task = asyncio.create_task(self._periodic_cleanup())

    async def stop(self):
        """Stop the cleanup task"""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
            self._cleanup_task = None

    def get_limit_for_user(self, user_id: str, role: str = "user") -> int:
        """
        Get rate limit for a user based on their role.

        Args:
            user_id: User identifier
            role: User role

        Returns:
            Maximum requests allowed per time window
        """
        return self.role_limits.get(role, self.default_limit)

    async def check_rate_limit(self, user_id: str, role: str = "user") -> bool:
        """
        Check if request is within rate limits.

        Args:
            user_id: User identifier
            role: User role

        Returns:
            True if request is allowed, False if rate limited

        Raises:
            RateLimitExceeded: If rate limit is exceeded
        """
        limit = self.get_limit_for_user(user_id, role)

        # Get current request timestamps for user
        user_requests = self.requests[user_id]

        # Remove old requests outside the time window
        cutoff_time = datetime.now() - timedelta(seconds=self.window_seconds)
        user_requests[:] = [ts for ts in user_requests if ts > cutoff_time]

        # Check if under limit
        if len(user_requests) >= limit:
            logger.warning(f"Rate limit exceeded for user {user_id} (role: {role})")
            raise RateLimitExceeded(f"Rate limit exceeded. Maximum {limit} requests per {self.window_seconds} seconds.")

        # Add current request
        user_requests.append(datetime.now())
        return True

    async def get_remaining_requests(self, user_id: str, role: str = "user") -> int:
        """
        Get remaining requests allowed for user.

        Args:
            user_id: User identifier
            role: User role

        Returns:
            Number of remaining requests
        """
        limit = self.get_limit_for_user(user_id, role)
        user_requests = self.requests[user_id]

        # Clean old requests
        cutoff_time = datetime.now() - timedelta(seconds=self.window_seconds)
        user_requests[:] = [ts for ts in user_requests if ts > cutoff_time]

        return max(0, limit - len(user_requests))

    async def reset_user_limit(self, user_id: str):
        """
        Reset rate limit for a specific user.

        Args:
            user_id: User identifier
        """
        if user_id in self.requests:
            del self.requests[user_id]
            logger.info(f"Rate limit reset for user {user_id}")

    def get_stats(self) -> Dict[str, Any]:
        """Get rate limiting statistics"""
        total_users = len(self.requests)
        total_requests = sum(len(requests) for requests in self.requests.values())

        # Clean all old requests for accurate stats
        cutoff_time = datetime.now() - timedelta(seconds=self.window_seconds)
        cleaned_requests = 0

        for user_requests in self.requests.values():
            old_count = len(user_requests)
            user_requests[:] = [ts for ts in user_requests if ts > cutoff_time]
            cleaned_requests += old_count - len(user_requests)

        return {
            "total_users": total_users,
            "total_active_requests": total_requests - cleaned_requests,
            "default_limit": self.default_limit,
            "window_seconds": self.window_seconds,
            "role_limits": self.role_limits.copy()
        }

    async def _periodic_cleanup(self):
        """Periodically clean up old request records"""
        while True:
            try:
                await asyncio.sleep(self.cleanup_interval)
                await self._cleanup_old_requests()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error during rate limit cleanup: {str(e)}")

    async def _cleanup_old_requests(self):
        """Remove old request records"""
        cutoff_time = datetime.now() - timedelta(seconds=self.window_seconds)
        cleaned_count = 0

        for user_requests in self.requests.values():
            old_count = len(user_requests)
            user_requests[:] = [ts for ts in user_requests if ts > cutoff_time]
            cleaned_count += old_count - len(user_requests)

        if cleaned_count > 0:
            logger.debug(f"Cleaned up {cleaned_count} old rate limit records")


# Global rate limiter instance
rate_limiter = RateLimiter()


async def check_user_rate_limit(user_id: str, role: str = "user") -> bool:
    """
    Check rate limit for a user (convenience function).

    Args:
        user_id: User identifier
        role: User role

    Returns:
        True if allowed

    Raises:
        RateLimitExceeded: If rate limit exceeded
    """
    return await rate_limiter.check_rate_limit(user_id, role)


async def get_user_remaining_requests(user_id: str, role: str = "user") -> int:
    """
    Get remaining requests for a user (convenience function).

    Args:
        user_id: User identifier
        role: User role

    Returns:
        Number of remaining requests
    """
    return await rate_limiter.get_remaining_requests(user_id, role)