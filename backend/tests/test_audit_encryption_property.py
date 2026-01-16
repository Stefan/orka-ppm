"""
Property-Based Tests for Audit Encryption

Tests Property 21: Sensitive Field Encryption
Validates: Requirements 6.6
"""

import pytest
from hypothesis import given, strategies as st, settings
from uuid import uuid4
from datetime import datetime
import json

from services.audit_encryption_service import AuditEncryptionService


# ============================================================================
# Test Data Generators
# ============================================================================

# Strategy for generating audit event data
audit_event_strategy = st.fixed_dictionaries({
    "id": st.uuids().map(str),
    "event_type": st.sampled_from([
        "user_login", "budget_change", "permission_change",
        "resource_assignment", "risk_created", "report_generated"
    ]),
    "user_id": st.uuids().map(str),
    "entity_type": st.sampled_from(["project", "resource", "risk", "change_request"]),
    "entity_id": st.uuids().map(str),
    "action_details": st.dictionaries(
        keys=st.text(min_size=1, max_size=20, alphabet=st.characters(whitelist_categories=("L", "N"))),
        values=st.one_of(
            st.text(min_size=0, max_size=100),
            st.integers(),
            st.floats(allow_nan=False, allow_infinity=False),
            st.booleans()
        ),
        min_size=0,
        max_size=10
    ),
    "severity": st.sampled_from(["info", "warning", "error", "critical"]),
    "ip_address": st.one_of(
        st.none(),
        st.from_regex(r"^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$", fullmatch=True)
    ),
    "user_agent": st.one_of(
        st.none(),
        st.text(min_size=10, max_size=200)
    ),
    "timestamp": st.datetimes().map(lambda dt: dt.isoformat()),
    "tenant_id": st.uuids().map(str)
})


# ============================================================================
# Property Tests
# ============================================================================

# Feature: ai-empowered-audit-trail, Property 21: Sensitive Field Encryption
@given(event_data=audit_event_strategy)
@settings(max_examples=100, deadline=None)
@pytest.mark.property_test
def test_sensitive_field_encryption(event_data):
    """
    Property 21: Sensitive Field Encryption
    
    For any audit event containing sensitive fields (as defined by the system's 
    sensitivity rules), those fields should be encrypted at rest using AES-256 
    encryption before storage in the database.
    
    Validates: Requirements 6.6
    
    Property: For any audit event with sensitive fields (user_agent, ip_address, 
    action_details), after encryption, the encrypted values should:
    1. Be different from the original values
    2. Be decryptable back to the original values
    3. Not contain the original plaintext
    """
    # Initialize encryption service with a test key
    test_key = AuditEncryptionService.generate_encryption_key()
    encryption_service = AuditEncryptionService(encryption_key=test_key)
    
    # Store original values of sensitive fields
    original_values = {}
    for field in AuditEncryptionService.SENSITIVE_FIELDS:
        if field in event_data and event_data[field] is not None:
            original_values[field] = event_data[field]
    
    # Skip test if no sensitive fields are present
    if not original_values:
        return
    
    # Encrypt the audit event
    encrypted_event = encryption_service.encrypt_audit_event(event_data)
    
    # Verify encrypted fields are different from originals
    for field, original_value in original_values.items():
        encrypted_value = encrypted_event.get(field)
        
        # Property 1: Encrypted value should be different from original
        assert encrypted_value != original_value, \
            f"Encrypted {field} should differ from original"
        
        # Property 2: Encrypted value should not contain plaintext
        # (for string fields, check that original is not substring of encrypted)
        if isinstance(original_value, str) and len(original_value) > 0:
            assert original_value not in encrypted_value, \
                f"Encrypted {field} should not contain plaintext"
    
    # Decrypt the audit event
    decrypted_event = encryption_service.decrypt_audit_event(encrypted_event)
    
    # Verify decrypted fields match originals
    for field, original_value in original_values.items():
        decrypted_value = decrypted_event.get(field)
        
        # Property 3: Decrypted value should match original
        # Convert to string for comparison since encryption works with strings
        assert str(decrypted_value) == str(original_value), \
            f"Decrypted {field} should match original value"


@given(
    event_data=audit_event_strategy,
    field_name=st.sampled_from(AuditEncryptionService.SENSITIVE_FIELDS)
)
@settings(max_examples=100, deadline=None)
@pytest.mark.property_test
def test_individual_field_encryption_decryption(event_data, field_name):
    """
    Property: Individual field encryption and decryption should be reversible.
    
    For any sensitive field value, encrypting and then decrypting should
    return the original value.
    
    Validates: Requirements 6.6
    """
    # Initialize encryption service
    test_key = AuditEncryptionService.generate_encryption_key()
    encryption_service = AuditEncryptionService(encryption_key=test_key)
    
    # Get field value
    field_value = event_data.get(field_name)
    
    # Skip if field is None
    if field_value is None:
        return
    
    # Encrypt the field
    encrypted_value = encryption_service.encrypt_field(field_value)
    
    # Verify encrypted value is different
    assert encrypted_value != str(field_value), \
        "Encrypted value should differ from original"
    
    # Decrypt the field
    decrypted_value = encryption_service.decrypt_field(encrypted_value)
    
    # Verify decrypted value matches original
    assert decrypted_value == str(field_value), \
        "Decrypted value should match original"


@given(events=st.lists(audit_event_strategy, min_size=1, max_size=20))
@settings(max_examples=50, deadline=None)
@pytest.mark.property_test
def test_batch_encryption_decryption(events):
    """
    Property: Batch encryption and decryption should preserve all event data.
    
    For any list of audit events, encrypting and then decrypting the batch
    should return events with the same sensitive field values.
    
    Validates: Requirements 6.6
    """
    # Initialize encryption service
    test_key = AuditEncryptionService.generate_encryption_key()
    encryption_service = AuditEncryptionService(encryption_key=test_key)
    
    # Store original sensitive field values for each event
    original_sensitive_values = []
    for event in events:
        event_values = {}
        for field in AuditEncryptionService.SENSITIVE_FIELDS:
            if field in event and event[field] is not None:
                event_values[field] = event[field]
        original_sensitive_values.append(event_values)
    
    # Encrypt batch
    encrypted_events = encryption_service.encrypt_batch(events)
    
    # Verify batch size is preserved
    assert len(encrypted_events) == len(events), \
        "Batch encryption should preserve event count"
    
    # Decrypt batch
    decrypted_events = encryption_service.decrypt_batch(encrypted_events)
    
    # Verify batch size is preserved
    assert len(decrypted_events) == len(events), \
        "Batch decryption should preserve event count"
    
    # Verify all sensitive fields are correctly decrypted
    for i, (original_values, decrypted_event) in enumerate(zip(original_sensitive_values, decrypted_events)):
        for field, original_value in original_values.items():
            decrypted_value = decrypted_event.get(field)
            assert str(decrypted_value) == str(original_value), \
                f"Event {i}: Decrypted {field} should match original"


@given(event_data=audit_event_strategy)
@settings(max_examples=100, deadline=None)
@pytest.mark.property_test
def test_encryption_does_not_modify_non_sensitive_fields(event_data):
    """
    Property: Encryption should only modify sensitive fields.
    
    For any audit event, non-sensitive fields should remain unchanged
    after encryption.
    
    Validates: Requirements 6.6
    """
    # Initialize encryption service
    test_key = AuditEncryptionService.generate_encryption_key()
    encryption_service = AuditEncryptionService(encryption_key=test_key)
    
    # Identify non-sensitive fields
    non_sensitive_fields = [
        field for field in event_data.keys()
        if field not in AuditEncryptionService.SENSITIVE_FIELDS
    ]
    
    # Store original values of non-sensitive fields
    original_non_sensitive = {
        field: event_data[field]
        for field in non_sensitive_fields
    }
    
    # Encrypt the event
    encrypted_event = encryption_service.encrypt_audit_event(event_data)
    
    # Verify non-sensitive fields are unchanged
    for field, original_value in original_non_sensitive.items():
        encrypted_value = encrypted_event.get(field)
        assert encrypted_value == original_value, \
            f"Non-sensitive field {field} should not be modified by encryption"


@given(
    event_data=audit_event_strategy,
    different_key=st.text(min_size=32, max_size=64)
)
@settings(max_examples=50, deadline=None)
@pytest.mark.property_test
def test_encryption_with_different_keys_produces_different_ciphertext(event_data, different_key):
    """
    Property: Encrypting the same data with different keys should produce
    different ciphertext.
    
    This ensures that encryption is key-dependent.
    
    Validates: Requirements 6.6
    """
    # Skip if no sensitive fields
    has_sensitive = any(
        field in event_data and event_data[field] is not None
        for field in AuditEncryptionService.SENSITIVE_FIELDS
    )
    if not has_sensitive:
        return
    
    # Initialize two encryption services with different keys
    key1 = AuditEncryptionService.generate_encryption_key()
    key2 = AuditEncryptionService.generate_encryption_key()
    
    # Ensure keys are different
    if key1 == key2:
        return
    
    service1 = AuditEncryptionService(encryption_key=key1)
    service2 = AuditEncryptionService(encryption_key=key2)
    
    # Encrypt with both services
    encrypted1 = service1.encrypt_audit_event(event_data.copy())
    encrypted2 = service2.encrypt_audit_event(event_data.copy())
    
    # Verify that at least one sensitive field has different ciphertext
    different_ciphertext_found = False
    for field in AuditEncryptionService.SENSITIVE_FIELDS:
        if field in event_data and event_data[field] is not None:
            if encrypted1.get(field) != encrypted2.get(field):
                different_ciphertext_found = True
                break
    
    assert different_ciphertext_found, \
        "Encryption with different keys should produce different ciphertext"


# ============================================================================
# Unit Tests for Edge Cases
# ============================================================================

def test_encryption_with_none_values():
    """Test that None values are handled correctly."""
    test_key = AuditEncryptionService.generate_encryption_key()
    encryption_service = AuditEncryptionService(encryption_key=test_key)
    
    event_data = {
        "id": str(uuid4()),
        "event_type": "test_event",
        "user_agent": None,
        "ip_address": None,
        "action_details": None
    }
    
    # Encrypt event
    encrypted_event = encryption_service.encrypt_audit_event(event_data)
    
    # Verify None values remain None
    assert encrypted_event["user_agent"] is None
    assert encrypted_event["ip_address"] is None
    assert encrypted_event["action_details"] is None


def test_encryption_with_empty_strings():
    """Test that empty strings are handled correctly."""
    test_key = AuditEncryptionService.generate_encryption_key()
    encryption_service = AuditEncryptionService(encryption_key=test_key)
    
    event_data = {
        "id": str(uuid4()),
        "event_type": "test_event",
        "user_agent": "",
        "ip_address": "",
        "action_details": ""
    }
    
    # Encrypt event
    encrypted_event = encryption_service.encrypt_audit_event(event_data)
    
    # Decrypt event
    decrypted_event = encryption_service.decrypt_audit_event(encrypted_event)
    
    # Verify empty strings are preserved
    assert decrypted_event["user_agent"] == ""
    assert decrypted_event["ip_address"] == ""
    assert decrypted_event["action_details"] == ""


def test_encryption_service_initialization_without_key():
    """Test that service raises error when no key is provided."""
    import os
    
    # Temporarily remove environment variable if it exists
    original_key = os.environ.get("AUDIT_ENCRYPTION_KEY")
    if original_key:
        del os.environ["AUDIT_ENCRYPTION_KEY"]
    
    try:
        # Should raise RuntimeError
        with pytest.raises(RuntimeError, match="Encryption key not provided"):
            AuditEncryptionService()
    finally:
        # Restore original key
        if original_key:
            os.environ["AUDIT_ENCRYPTION_KEY"] = original_key


def test_generate_encryption_key():
    """Test that key generation produces valid Fernet keys."""
    key1 = AuditEncryptionService.generate_encryption_key()
    key2 = AuditEncryptionService.generate_encryption_key()
    
    # Keys should be different
    assert key1 != key2
    
    # Keys should be valid (can initialize service)
    service1 = AuditEncryptionService(encryption_key=key1)
    service2 = AuditEncryptionService(encryption_key=key2)
    
    assert service1 is not None
    assert service2 is not None
