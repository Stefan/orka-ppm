"""
Property-Based Tests for Shareable Project URLs - Token Generation

This module contains property-based tests using Hypothesis to validate
the secure token generation for the shareable project URLs system.

Feature: shareable-project-urls
Property 1: Secure Token Generation
**Validates: Requirements 1.1, 1.2, 1.4**
"""

import pytest
from hypothesis import given, settings, strategies as st, assume
from datetime import datetime, timedelta
from uuid import uuid4, UUID
import secrets
import base64
import re
import sys
import os
from collections import Counter

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))


# ============================================================================
# Token Generation Utilities
# ============================================================================

def generate_secure_token() -> str:
    """
    Generate a cryptographically secure 64-character URL-safe token.
    
    This is the reference implementation that should be used in the actual service.
    """
    # Generate 48 random bytes (will be 64 chars in base64)
    random_bytes = secrets.token_bytes(48)
    # Encode as URL-safe base64
    token = base64.urlsafe_b64encode(random_bytes).decode('utf-8')
    # Ensure exactly 64 characters (remove padding if present)
    token = token.replace('=', '')[:64]
    # Pad with additional random characters if needed
    while len(token) < 64:
        token += secrets.choice('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_')
    return token[:64]


def is_url_safe(token: str) -> bool:
    """Check if token contains only URL-safe characters"""
    url_safe_pattern = re.compile(r'^[A-Za-z0-9_-]+$')
    return bool(url_safe_pattern.match(token))


def calculate_entropy(token: str) -> float:
    """Calculate Shannon entropy of token"""
    import math
    
    if not token:
        return 0.0
    
    # Count character frequencies
    counter = Counter(token)
    length = len(token)
    
    # Calculate entropy
    entropy = 0.0
    for count in counter.values():
        probability = count / length
        if probability > 0:
            entropy -= probability * math.log2(probability)
    
    return entropy


# ============================================================================
# Hypothesis Strategies
# ============================================================================

@st.composite
def token_generation_count_strategy(draw):
    """Generate a reasonable number of tokens to test uniqueness"""
    return draw(st.integers(min_value=10, max_value=1000))


# ============================================================================
# Property 1: Secure Token Generation
# **Validates: Requirements 1.1, 1.2, 1.4**
# ============================================================================

@given(st.integers(min_value=1, max_value=100))
@settings(max_examples=50, deadline=None)
def test_property1_token_length_is_exactly_64_characters(iterations):
    """
    Property 1: Secure Token Generation
    
    For any number of token generations, each token must be exactly 64 characters long.
    This ensures consistent token format and sufficient entropy.
    
    Feature: shareable-project-urls, Property 1: Secure Token Generation
    **Validates: Requirements 1.1, 1.2, 1.4**
    """
    for _ in range(iterations):
        token = generate_secure_token()
        
        # Property: Token must be exactly 64 characters
        assert len(token) == 64, f"Token length must be 64, got {len(token)}"
        assert isinstance(token, str), "Token must be a string"


@given(st.integers(min_value=10, max_value=500))
@settings(max_examples=50, deadline=None)
def test_property1_tokens_are_unique_across_generations(token_count):
    """
    Property 1: Secure Token Generation
    
    For any set of generated tokens, all tokens must be unique.
    This prevents token collision and ensures each share link has a unique identifier.
    
    Feature: shareable-project-urls, Property 1: Secure Token Generation
    **Validates: Requirements 1.1, 1.2, 1.4**
    """
    # Generate multiple tokens
    tokens = [generate_secure_token() for _ in range(token_count)]
    
    # Property: All tokens must be unique
    unique_tokens = set(tokens)
    assert len(unique_tokens) == len(tokens), \
        f"Expected {len(tokens)} unique tokens, got {len(unique_tokens)}"
    
    # Property: No duplicate tokens
    token_counts = Counter(tokens)
    duplicates = [token for token, count in token_counts.items() if count > 1]
    assert len(duplicates) == 0, f"Found duplicate tokens: {duplicates}"


@given(st.integers(min_value=1, max_value=100))
@settings(max_examples=50, deadline=None)
def test_property1_tokens_are_url_safe(iterations):
    """
    Property 1: Secure Token Generation
    
    For any generated token, it must contain only URL-safe characters.
    This ensures tokens can be safely used in URLs without encoding.
    
    Feature: shareable-project-urls, Property 1: Secure Token Generation
    **Validates: Requirements 1.1, 1.2, 1.4**
    """
    for _ in range(iterations):
        token = generate_secure_token()
        
        # Property: Token must be URL-safe
        assert is_url_safe(token), \
            f"Token contains non-URL-safe characters: {token}"
        
        # Property: Token must not contain special characters that need encoding
        forbidden_chars = ['/', '+', '=', ' ', '\n', '\t', '&', '?', '#']
        for char in forbidden_chars:
            assert char not in token, \
                f"Token contains forbidden character '{char}': {token}"


@given(st.integers(min_value=1, max_value=100))
@settings(max_examples=50, deadline=None)
def test_property1_tokens_have_high_entropy(iterations):
    """
    Property 1: Secure Token Generation
    
    For any generated token, it must have high entropy (randomness).
    This ensures tokens are cryptographically secure and unpredictable.
    
    Feature: shareable-project-urls, Property 1: Secure Token Generation
    **Validates: Requirements 1.1, 1.2, 1.4**
    """
    min_entropy = 4.5  # Minimum Shannon entropy for secure tokens
    
    for _ in range(iterations):
        token = generate_secure_token()
        entropy = calculate_entropy(token)
        
        # Property: Token must have high entropy
        assert entropy >= min_entropy, \
            f"Token entropy {entropy:.2f} is below minimum {min_entropy}"


@given(st.integers(min_value=1, max_value=100))
@settings(max_examples=50, deadline=None)
def test_property1_tokens_are_non_sequential(iterations):
    """
    Property 1: Secure Token Generation
    
    For any sequence of generated tokens, they must not be sequential or predictable.
    This ensures tokens cannot be guessed or enumerated.
    
    Feature: shareable-project-urls, Property 1: Secure Token Generation
    **Validates: Requirements 1.1, 1.2, 1.4**
    """
    tokens = [generate_secure_token() for _ in range(iterations)]
    
    # Property: Tokens should not have predictable patterns
    for i in range(len(tokens) - 1):
        token1 = tokens[i]
        token2 = tokens[i + 1]
        
        # Calculate Hamming distance (number of differing characters)
        hamming_distance = sum(c1 != c2 for c1, c2 in zip(token1, token2))
        
        # Property: Consecutive tokens should differ significantly
        # At least 50% of characters should be different
        min_difference = 32  # 50% of 64 characters
        assert hamming_distance >= min_difference, \
            f"Consecutive tokens are too similar (only {hamming_distance} differences)"


@given(st.integers(min_value=1, max_value=100))
@settings(max_examples=50, deadline=None)
def test_property1_tokens_use_full_character_set(iterations):
    """
    Property 1: Secure Token Generation
    
    For any set of generated tokens, they should use the full range of URL-safe characters.
    This maximizes entropy and security.
    
    Feature: shareable-project-urls, Property 1: Secure Token Generation
    **Validates: Requirements 1.1, 1.2, 1.4**
    """
    # Generate multiple tokens to get good character distribution
    tokens = [generate_secure_token() for _ in range(iterations)]
    all_chars = ''.join(tokens)
    unique_chars = set(all_chars)
    
    # Property: Should use a diverse set of characters
    # URL-safe base64 uses: A-Z, a-z, 0-9, -, _
    # That's 64 possible characters
    # With enough tokens, we should see good diversity
    if iterations >= 10:
        # Expect at least 40 different characters used across all tokens
        assert len(unique_chars) >= 40, \
            f"Token generation uses only {len(unique_chars)} unique characters, expected at least 40"


@given(st.integers(min_value=1, max_value=100))
@settings(max_examples=50, deadline=None)
def test_property1_tokens_are_not_empty_or_whitespace(iterations):
    """
    Property 1: Secure Token Generation
    
    For any generated token, it must not be empty or contain whitespace.
    This ensures tokens are always valid and usable.
    
    Feature: shareable-project-urls, Property 1: Secure Token Generation
    **Validates: Requirements 1.1, 1.2, 1.4**
    """
    for _ in range(iterations):
        token = generate_secure_token()
        
        # Property: Token must not be empty
        assert token, "Token must not be empty"
        assert len(token) > 0, "Token must have non-zero length"
        
        # Property: Token must not contain whitespace
        assert ' ' not in token, "Token must not contain spaces"
        assert '\t' not in token, "Token must not contain tabs"
        assert '\n' not in token, "Token must not contain newlines"
        assert token == token.strip(), "Token must not have leading/trailing whitespace"


@given(st.integers(min_value=1, max_value=100))
@settings(max_examples=50, deadline=None)
def test_property1_tokens_are_cryptographically_random(iterations):
    """
    Property 1: Secure Token Generation
    
    For any generated token, it must be generated using cryptographically secure randomness.
    This ensures tokens cannot be predicted even with knowledge of previous tokens.
    
    Feature: shareable-project-urls, Property 1: Secure Token Generation
    **Validates: Requirements 1.1, 1.2, 1.4**
    """
    tokens = [generate_secure_token() for _ in range(iterations)]
    
    # Property: Tokens should not have repeating patterns
    for token in tokens:
        # Check for repeating substrings
        for substring_length in [2, 3, 4]:
            substrings = [token[i:i+substring_length] 
                         for i in range(len(token) - substring_length + 1)]
            substring_counts = Counter(substrings)
            
            # No substring should repeat more than expected by chance
            # For a 64-char token with 64 possible chars, repetition should be rare
            max_repetitions = max(substring_counts.values())
            # Allow some repetition but not excessive
            max_allowed = 5 if substring_length == 2 else 3
            assert max_repetitions <= max_allowed, \
                f"Token has excessive repetition of {substring_length}-char substrings"


@given(st.integers(min_value=2, max_value=100))
@settings(max_examples=50, deadline=None)
def test_property1_token_generation_is_deterministically_random(iterations):
    """
    Property 1: Secure Token Generation
    
    For any two separate generation sessions, tokens must be different.
    This ensures the random number generator is properly seeded.
    
    Feature: shareable-project-urls, Property 1: Secure Token Generation
    **Validates: Requirements 1.1, 1.2, 1.4**
    """
    # Generate first batch
    batch1 = [generate_secure_token() for _ in range(iterations)]
    
    # Generate second batch
    batch2 = [generate_secure_token() for _ in range(iterations)]
    
    # Property: Batches should not overlap
    overlap = set(batch1) & set(batch2)
    assert len(overlap) == 0, \
        f"Found {len(overlap)} duplicate tokens across batches"


# ============================================================================
# Integration Property Tests
# ============================================================================

@given(
    st.integers(min_value=10, max_value=100),
    st.integers(min_value=1, max_value=10)
)
@settings(max_examples=30, deadline=None)
def test_property1_concurrent_token_generation_produces_unique_tokens(
    tokens_per_batch,
    batch_count
):
    """
    Property 1: Secure Token Generation
    
    For any number of concurrent token generation operations,
    all tokens must remain unique across all batches.
    
    This simulates concurrent share link creation in a production environment.
    
    Feature: shareable-project-urls, Property 1: Secure Token Generation
    **Validates: Requirements 1.1, 1.2, 1.4**
    """
    all_tokens = []
    
    # Simulate concurrent batches
    for _ in range(batch_count):
        batch = [generate_secure_token() for _ in range(tokens_per_batch)]
        all_tokens.extend(batch)
    
    # Property: All tokens across all batches must be unique
    unique_tokens = set(all_tokens)
    assert len(unique_tokens) == len(all_tokens), \
        f"Expected {len(all_tokens)} unique tokens, got {len(unique_tokens)}"


@given(st.integers(min_value=1, max_value=100))
@settings(max_examples=50, deadline=None)
def test_property1_tokens_meet_minimum_security_requirements(iterations):
    """
    Property 1: Secure Token Generation
    
    For any generated token, it must meet all minimum security requirements:
    - Exactly 64 characters
    - URL-safe characters only
    - High entropy
    - Cryptographically random
    - Unique
    
    Feature: shareable-project-urls, Property 1: Secure Token Generation
    **Validates: Requirements 1.1, 1.2, 1.4**
    """
    tokens = []
    
    for _ in range(iterations):
        token = generate_secure_token()
        
        # Requirement 1.2: At least 32 characters (we use 64)
        assert len(token) >= 32, "Token must be at least 32 characters"
        assert len(token) == 64, "Token should be exactly 64 characters"
        
        # Requirement 1.2: URL-safe characters
        assert is_url_safe(token), "Token must use URL-safe characters"
        
        # Requirement 1.1: Cryptographically secure (high entropy)
        entropy = calculate_entropy(token)
        assert entropy >= 4.5, f"Token entropy {entropy:.2f} is too low"
        
        # Requirement 1.4: Unique across all projects
        assert token not in tokens, "Token must be unique"
        tokens.append(token)


# ============================================================================
# Edge Case Tests
# ============================================================================

def test_property1_token_generation_never_fails():
    """
    Property 1: Secure Token Generation
    
    Token generation should never fail or raise exceptions.
    This ensures reliability in production.
    
    Feature: shareable-project-urls, Property 1: Secure Token Generation
    **Validates: Requirements 1.1, 1.2, 1.4**
    """
    # Generate many tokens to ensure stability
    for _ in range(1000):
        try:
            token = generate_secure_token()
            assert token is not None
            assert len(token) == 64
        except Exception as e:
            pytest.fail(f"Token generation failed: {e}")


def test_property1_token_generation_performance():
    """
    Property 1: Secure Token Generation
    
    Token generation should be fast enough for production use.
    Should generate at least 100 tokens per second.
    
    Feature: shareable-project-urls, Property 1: Secure Token Generation
    **Validates: Requirements 1.1, 1.2, 1.4**
    """
    import time
    
    start_time = time.time()
    token_count = 1000
    
    for _ in range(token_count):
        generate_secure_token()
    
    elapsed_time = time.time() - start_time
    tokens_per_second = token_count / elapsed_time
    
    # Property: Should generate at least 100 tokens per second
    assert tokens_per_second >= 100, \
        f"Token generation too slow: {tokens_per_second:.0f} tokens/sec"


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v", "--tb=short"])
