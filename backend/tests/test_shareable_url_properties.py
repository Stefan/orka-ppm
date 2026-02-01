"""
Property-Based Tests for Shareable URL System

This module contains property-based tests using Hypothesis to validate
universal correctness properties of the shareable URL system.

Feature: generic-construction-ppm-features
Property 1: Shareable URL Security and Access Control
Property 2: URL Expiration and Lifecycle Management
"""

import pytest
from hypothesis import given, settings, strategies as st
from datetime import datetime, timedelta
from uuid import uuid4
from unittest.mock import Mock
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from services.generic_construction_services import ShareableURLService, TokenManager
from models.generic_construction import ShareablePermissions


# ============================================================================
# Hypothesis Strategies
# ============================================================================

@st.composite
def shareable_permissions_strategy(draw):
    """Generate random but valid ShareablePermissions"""
    return ShareablePermissions(
        can_view_basic_info=draw(st.booleans()),
        can_view_financial=draw(st.booleans()),
        can_view_risks=draw(st.booleans()),
        can_view_resources=draw(st.booleans()),
        can_view_timeline=draw(st.booleans()),
        allowed_sections=draw(st.lists(
            st.sampled_from(['dashboard', 'risks', 'resources', 'timeline', 'financials']),
            max_size=5,
            unique=True
        ))
    )


@st.composite
def future_datetime_strategy(draw, min_days=1, max_days=365):
    """Generate a datetime in the future"""
    days_ahead = draw(st.integers(min_value=min_days, max_value=max_days))
    hours_ahead = draw(st.integers(min_value=0, max_value=23))
    minutes_ahead = draw(st.integers(min_value=0, max_value=59))
    
    future_time = datetime.now() + timedelta(
        days=days_ahead,
        hours=hours_ahead,
        minutes=minutes_ahead
    )
    return future_time


@st.composite
def shareable_url_data_strategy(draw):
    """Generate valid shareable URL creation data"""
    return {
        'project_id': uuid4(),
        'permissions': draw(shareable_permissions_strategy()),
        'expiration': draw(future_datetime_strategy()),
        'user_id': uuid4(),
        'description': draw(st.one_of(st.none(), st.text(min_size=1, max_size=200)))
    }


# ============================================================================
# Property 1: Shareable URL Security and Access Control
# ============================================================================

@given(shareable_url_data_strategy())
@settings(max_examples=100, deadline=None)
def test_property1_generated_tokens_are_cryptographically_secure(url_data):
    """
    Property 1: Shareable URL Security and Access Control
    
    Test that all generated tokens are cryptographically secure.
    
    A token is considered secure if:
    1. It is non-empty and sufficiently long
    2. It is properly encrypted and can be decrypted
    3. It contains the embedded payload
    4. It includes a unique nonce for each generation
    
    Feature: generic-construction-ppm-features, Property 1: Shareable URL Security and Access Control
    Validates: Requirements 1.1, 1.2, 1.3, 9.1
    """
    # Setup
    secret_key = "test_secret_key_for_property_testing"
    token_manager = TokenManager(secret_key)
    
    # Create payload
    payload = {
        'project_id': str(url_data['project_id']),
        'permissions': url_data['permissions'].model_dump(),
        'exp': int(url_data['expiration'].timestamp()),
        'created_by': str(url_data['user_id'])
    }
    
    # Generate token
    token = token_manager.generate_secure_token(payload)
    
    # Property: Token must be non-empty and sufficiently long
    assert isinstance(token, str), "Token must be a string"
    assert len(token) > 32, "Token must be sufficiently long for security"
    
    # Property: Token must be decryptable
    try:
        decrypted_payload = token_manager.validate_token(token)
    except Exception as e:
        pytest.fail(f"Token validation failed: {e}")
    
    # Property: Decrypted payload must contain original data
    assert decrypted_payload['project_id'] == payload['project_id']
    assert decrypted_payload['permissions'] == payload['permissions']
    assert decrypted_payload['exp'] == payload['exp']
    
    # Property: Each token must have a unique nonce
    assert 'nonce' in decrypted_payload
    assert len(decrypted_payload['nonce']) > 0


@given(shareable_url_data_strategy())
@settings(max_examples=100, deadline=None)
def test_property1_different_tokens_for_same_permissions(url_data):
    """
    Property 1: Shareable URL Security and Access Control
    
    Test that generating multiple URLs with the same permissions produces
    different tokens (due to unique nonces and timestamps).
    
    This ensures that tokens cannot be predicted or reused.
    
    Feature: generic-construction-ppm-features, Property 1: Shareable URL Security and Access Control
    Validates: Requirements 1.1, 1.2, 1.3, 9.1
    """
    # Setup
    secret_key = "test_secret_key_uniqueness"
    token_manager = TokenManager(secret_key)
    
    # Create payload
    payload = {
        'project_id': str(url_data['project_id']),
        'permissions': url_data['permissions'].model_dump(),
        'exp': int(url_data['expiration'].timestamp()),
        'created_by': str(url_data['user_id'])
    }
    
    # Generate multiple tokens with same payload
    token1 = token_manager.generate_secure_token(payload.copy())
    token2 = token_manager.generate_secure_token(payload.copy())
    token3 = token_manager.generate_secure_token(payload.copy())
    
    # Property: All tokens must be different
    assert token1 != token2
    assert token2 != token3
    assert token1 != token3
    
    # Property: All tokens must be valid
    try:
        decrypted1 = token_manager.validate_token(token1)
        decrypted2 = token_manager.validate_token(token2)
        decrypted3 = token_manager.validate_token(token3)
        
        # Verify they have different nonces
        assert decrypted1['nonce'] != decrypted2['nonce']
        assert decrypted2['nonce'] != decrypted3['nonce']
        assert decrypted1['nonce'] != decrypted3['nonce']
    except Exception as e:
        pytest.fail(f"Token validation failed: {e}")


@given(shareable_url_data_strategy())
@settings(max_examples=100, deadline=None)
def test_property1_permissions_are_preserved_in_token(url_data):
    """
    Property 1: Shareable URL Security and Access Control
    
    Test that permissions embedded in tokens are preserved exactly.
    
    Feature: generic-construction-ppm-features, Property 1: Shareable URL Security and Access Control
    Validates: Requirements 1.1, 1.2, 1.3, 9.1
    """
    # Setup
    secret_key = "test_secret_key_permissions"
    token_manager = TokenManager(secret_key)
    
    # Create payload with permissions
    payload = {
        'project_id': str(url_data['project_id']),
        'permissions': url_data['permissions'].model_dump(),
        'exp': int(url_data['expiration'].timestamp()),
        'created_by': str(url_data['user_id'])
    }
    
    # Generate and validate token
    token = token_manager.generate_secure_token(payload)
    decrypted = token_manager.validate_token(token)
    
    # Property: Permissions must be exactly preserved
    assert decrypted['permissions'] == payload['permissions']
    assert decrypted['permissions']['can_view_basic_info'] == url_data['permissions'].can_view_basic_info
    assert decrypted['permissions']['can_view_financial'] == url_data['permissions'].can_view_financial
    assert decrypted['permissions']['can_view_risks'] == url_data['permissions'].can_view_risks
    assert decrypted['permissions']['can_view_resources'] == url_data['permissions'].can_view_resources
    assert decrypted['permissions']['can_view_timeline'] == url_data['permissions'].can_view_timeline


# ============================================================================
# Property 2: URL Expiration and Lifecycle Management
# ============================================================================

@given(shareable_url_data_strategy())
@settings(max_examples=100, deadline=None)
def test_property2_token_expiration_is_enforced(url_data):
    """
    Property 2: URL Expiration and Lifecycle Management
    
    Test that token expiration is correctly embedded and can be checked.
    
    Feature: generic-construction-ppm-features, Property 2: URL Expiration and Lifecycle Management
    Validates: Requirements 1.4, 1.5, 9.5
    """
    # Setup
    secret_key = "test_secret_key_expiration"
    token_manager = TokenManager(secret_key)
    
    # Test with future expiration
    future_payload = {
        'project_id': str(url_data['project_id']),
        'permissions': url_data['permissions'].model_dump(),
        'exp': int(url_data['expiration'].timestamp()),
        'created_by': str(url_data['user_id'])
    }
    
    future_token = token_manager.generate_secure_token(future_payload)
    
    # Property: Future tokens should not be expired
    assert not token_manager.is_token_expired(future_token)
    
    # Test with past expiration
    past_expiration = datetime.now() - timedelta(days=1)
    past_payload = {
        'project_id': str(url_data['project_id']),
        'permissions': url_data['permissions'].model_dump(),
        'exp': int(past_expiration.timestamp()),
        'created_by': str(url_data['user_id'])
    }
    
    past_token = token_manager.generate_secure_token(past_payload)
    
    # Property: Past tokens should be expired
    assert token_manager.is_token_expired(past_token)


@given(shareable_url_data_strategy())
@settings(max_examples=100, deadline=None)
def test_property2_invalid_tokens_are_rejected(url_data):
    """
    Property 2: URL Expiration and Lifecycle Management
    
    Test that invalid or malformed tokens are always rejected.
    
    Feature: generic-construction-ppm-features, Property 2: URL Expiration and Lifecycle Management
    Validates: Requirements 1.4, 1.5, 9.5
    """
    # Setup
    secret_key = "test_secret_key_validation"
    token_manager = TokenManager(secret_key)
    
    # Property: Invalid tokens must raise ValueError
    invalid_tokens = [
        "invalid_token",
        "",
        "a" * 100,
        "not-a-real-token-12345",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid"
    ]
    
    for invalid_token in invalid_tokens:
        with pytest.raises(ValueError):
            token_manager.validate_token(invalid_token)


@given(shareable_url_data_strategy())
@settings(max_examples=100, deadline=None)
def test_property2_token_contains_audit_information(url_data):
    """
    Property 2: URL Expiration and Lifecycle Management
    
    Test that tokens contain necessary audit information (timestamp, nonce).
    
    Feature: generic-construction-ppm-features, Property 2: URL Expiration and Lifecycle Management
    Validates: Requirements 1.4, 1.5, 9.5
    """
    # Setup
    secret_key = "test_secret_key_audit"
    token_manager = TokenManager(secret_key)
    
    # Create payload
    payload = {
        'project_id': str(url_data['project_id']),
        'permissions': url_data['permissions'].model_dump(),
        'exp': int(url_data['expiration'].timestamp()),
        'created_by': str(url_data['user_id'])
    }
    
    # Generate token
    token = token_manager.generate_secure_token(payload)
    decrypted = token_manager.validate_token(token)
    
    # Property: Token must contain audit fields
    assert 'iat' in decrypted, "Token must have issued-at timestamp"
    assert 'nonce' in decrypted, "Token must have unique nonce"
    assert 'created_by' in decrypted, "Token must have creator ID"
    
    # Property: Audit fields must be valid
    assert isinstance(decrypted['iat'], int)
    assert isinstance(decrypted['nonce'], str)
    assert len(decrypted['nonce']) > 0
    assert decrypted['created_by'] == str(url_data['user_id'])
