"""
Help Chat Caching Service - In-Memory Cache for Speed
Reduziert AI-API-Calls durch intelligentes Caching
"""

import hashlib
import json
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

# In-memory cache with TTL
_cache_store: Dict[str, Dict[str, Any]] = {}
CACHE_TTL = 300  # 5 minutes

async def get_cached_response(
    query: str,
    user_id: str,
    context: Optional[Dict[str, Any]] = None,
    language: str = "en"
) -> Optional[Dict[str, Any]]:
    """
    Check in-memory cache for cached AI response.
    Cache-Key: SHA256 Hash of query + user_id + context + language
    """
    try:
        # Generate cache key
        cache_input = f"{query}:{user_id}:{language}"
        if context:
            relevant_context = {
                'route': context.get('route'),
                'userRole': context.get('userRole')
            }
            cache_input += f":{json.dumps(relevant_context, sort_keys=True)}"
        
        cache_key = hashlib.sha256(cache_input.encode()).hexdigest()
        
        # Check in-memory cache
        if cache_key in _cache_store:
            cache_entry = _cache_store[cache_key]
            
            # Check if expired
            if datetime.utcnow() < cache_entry['expires_at']:
                logger.info(f"Cache HIT for query: {query[:50]}... (lang: {language})")
                return cache_entry['response']
            else:
                # Remove expired entry
                del _cache_store[cache_key]
                logger.debug(f"Cache entry expired for: {query[:50]}...")
        
        logger.debug(f"Cache MISS for: {query[:50]}...")
        return None
    except Exception as e:
        logger.debug(f"Cache lookup error: {e}")
        return None

async def set_cached_response(
    query: str,
    user_id: str,
    response: Dict[str, Any],
    context: Optional[Dict[str, Any]] = None,
    ttl: int = CACHE_TTL,
    language: str = "en"
):
    """
    Store AI response in in-memory cache with TTL.
    """
    try:
        # Generate cache key (same logic as get_cached_response)
        cache_input = f"{query}:{user_id}:{language}"
        if context:
            relevant_context = {
                'route': context.get('route'),
                'userRole': context.get('userRole')
            }
            cache_input += f":{json.dumps(relevant_context, sort_keys=True)}"
        
        cache_key = hashlib.sha256(cache_input.encode()).hexdigest()
        
        expires_at = datetime.utcnow() + timedelta(seconds=ttl)
        
        # Store in memory
        _cache_store[cache_key] = {
            'response': response,
            'expires_at': expires_at,
            'created_at': datetime.utcnow()
        }
        
        logger.info(f"Cached response for query: {query[:50]}... (lang: {language}, TTL: {ttl}s)")
        
        # Cleanup old entries if cache is too large
        if len(_cache_store) > 1000:
            await _cleanup_expired_entries()
            
    except Exception as e:
        logger.error(f"Cache write error: {e}")

async def _cleanup_expired_entries():
    """Remove expired entries from cache"""
    try:
        now = datetime.utcnow()
        expired_keys = [
            key for key, entry in _cache_store.items()
            if now >= entry['expires_at']
        ]
        
        for key in expired_keys:
            del _cache_store[key]
        
        if expired_keys:
            logger.info(f"Cleaned up {len(expired_keys)} expired cache entries")
    except Exception as e:
        logger.error(f"Cache cleanup error: {e}")

async def invalidate_cache(user_id: Optional[str] = None):
    """
    Invalidate cache entries.
    If user_id given, only for that user (not implemented for in-memory).
    """
    try:
        if user_id:
            # For in-memory cache, we'd need to track user_id separately
            # For now, just log
            logger.info(f"Cache invalidation requested for user: {user_id} (not implemented for in-memory)")
        else:
            # Clear all expired entries
            await _cleanup_expired_entries()
    except Exception as e:
        logger.error(f"Cache invalidation error: {e}")

async def get_cache_stats() -> Dict[str, Any]:
    """
    Return cache statistics.
    """
    try:
        now = datetime.utcnow()
        active_count = sum(1 for entry in _cache_store.values() if now < entry['expires_at'])
        expired_count = len(_cache_store) - active_count
        
        return {
            'active_entries': active_count,
            'expired_entries': expired_count,
            'total_entries': len(_cache_store),
            'cache_type': 'in-memory'
        }
    except Exception as e:
        logger.error(f"Cache stats error: {e}")
        return {
            'active_entries': 0,
            'expired_entries': 0,
            'total_entries': 0,
            'error': str(e)
        }
