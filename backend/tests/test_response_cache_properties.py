"""
Property-Based Tests for Response Cache
Feature: ai-help-chat-knowledge-base
Tests Property 24 from the design document
"""

import pytest
from hypothesis import given, strategies as st, settings, assume
from typing import List, Dict, Any
import os
import sys
import uuid
import asyncio
from datetime import datetime, timedelta

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from services.response_cache import ResponseCache


# Test data strategies
@st.composite
def cache_key_strategy(draw):
    """Generate valid cache keys"""
    return draw(st.text(min_size=10, max_size=64, alphabet=st.characters(
        whitelist_categories=('Lu', 'Ll', 'Nd')
    )))


@st.composite
def cache_response_strategy(draw):
    """Generate mock cache responses"""
    return {
        "response": draw(st.text(min_size=50, max_size=500)),
        "citations": draw(st.lists(
            st.fixed_dictionaries({
                "number": st.integers(min_value=1, max_value=10),
                "type": st.sampled_from(["reference", "source"])
            }),
            min_size=0, max_size=5
        )),
        "sources": draw(st.lists(
            st.fixed_dictionaries({
                "id": st.integers(min_value=1, max_value=10),
                "title": st.text(min_size=5, max_size=50),
                "content_preview": st.text(min_size=20, max_size=100)
            }),
            min_size=0, max_size=5
        )),
        "confidence": draw(st.floats(min_value=0.0, max_value=1.0)),
        "language": draw(st.sampled_from(["en", "de", "fr", "es"])),
        "generated_at": datetime.now().isoformat()
    }


@st.composite
def user_context_strategy(draw):
    """Generate user contexts for cache key generation"""
    return {
        "user_id": str(uuid.uuid4()),
        "role": draw(st.sampled_from(["admin", "manager", "user"])),
        "current_page": draw(st.sampled_from(["/dashboard", "/projects", "/help"])),
        "current_project": draw(st.one_of(st.none(), st.uuids().map(str))),
        "current_portfolio": draw(st.one_of(st.none(), st.uuids().map(str)))
    }


@pytest.fixture
async def cache():
    """Create a response cache instance for testing"""
    cache = ResponseCache(max_size=100, default_ttl_seconds=3600)
    await cache.start()

    yield cache

    # Cleanup
    await cache.stop()


@pytest.mark.property_test
class TestCachePerformanceImprovement:
    """
    Property tests for cache performance improvement.
    Property 24: Cache Performance Improvement
    Validates: Requirements 8.4
    """

    @settings(max_examples=20, deadline=10000)
    @given(
        cache_key=cache_key_strategy(),
        response=cache_response_strategy(),
        ttl=st.integers(min_value=60, max_value=86400)
    )
    async def test_cache_store_and_retrieve(self, cache, cache_key, response, ttl):
        """
        Test that cache can store and retrieve responses correctly.

        Property 24: Cache must correctly store and retrieve
        responses without data corruption.
        """
        # Store response
        await cache.set(cache_key, response, ttl)

        # Retrieve response
        retrieved = await cache.get(cache_key)

        # Verify retrieval
        assert retrieved is not None, "Cached response must be retrievable"
        assert retrieved == response, "Retrieved response must match stored response"

    @settings(max_examples=15, deadline=8000)
    @given(
        queries=st.lists(
            st.tuples(
                st.text(min_size=10, max_size=50),  # query
                user_context_strategy(),            # user_context
                st.sampled_from(["en", "de", "fr"]) # language
            ),
            min_size=3, max_size=10
        )
    )
    async def test_cache_key_consistency(self, cache, queries):
        """
        Test that identical queries generate identical cache keys.

        Property 24: Cache key generation must be deterministic
        for identical inputs.
        """
        keys = []

        # Generate keys for all queries
        for query, user_context, language in queries:
            key = cache.generate_key(query, user_context, language)
            keys.append(key)

        # Generate keys again for the same queries
        keys_again = []
        for query, user_context, language in queries:
            key = cache.generate_key(query, user_context, language)
            keys_again.append(key)

        # Keys should be identical
        assert keys == keys_again, "Cache key generation must be deterministic"

    @settings(max_examples=15, deadline=6000)
    @given(
        cache_key=cache_key_strategy(),
        response=cache_response_strategy(),
        ttl=st.integers(min_value=1, max_value=10)  # Short TTL for testing
    )
    async def test_cache_expiration(self, cache, cache_key, response, ttl):
        """
        Test that cache entries expire correctly.

        Property 24: Cache entries must expire after TTL
        and not be retrievable.
        """
        # Store response
        await cache.set(cache_key, response, ttl)

        # Verify it's cached immediately
        retrieved = await cache.get(cache_key)
        assert retrieved is not None, "Response must be cached immediately"

        # Wait for expiration
        await asyncio.sleep(ttl + 1)

        # Verify it's expired
        retrieved = await cache.get(cache_key)
        assert retrieved is None, "Expired response must not be retrievable"

    @settings(max_examples=10, deadline=5000)
    async def test_cache_eviction_under_load(self, cache):
        """
        Test cache behavior under load and eviction.

        Property 24: Cache must handle high load and evict
        entries appropriately when full.
        """
        # Fill cache to capacity
        max_size = cache.max_size
        responses = []

        for i in range(max_size + 10):  # Add more than capacity
            key = f"test_key_{i}"
            response = {
                "response": f"Response {i}",
                "confidence": 0.8,
                "citations": [],
                "sources": []
            }
            responses.append((key, response))
            await cache.set(key, response)

        # Verify cache size is bounded
        stats = await cache.get_stats()
        assert stats["total_entries"] <= max_size, "Cache size must not exceed max_size"

        # Verify some entries are still retrievable
        retrievable_count = 0
        for key, expected_response in responses[:max_size//2]:  # Check first half
            retrieved = await cache.get(key)
            if retrieved is not None:
                retrievable_count += 1
                assert retrieved == expected_response, "Retrieved response must match"

        assert retrievable_count > 0, "At least some entries must remain retrievable after eviction"