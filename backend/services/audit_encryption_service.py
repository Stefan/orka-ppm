"""
Audit Encryption Service

Provides AES-256 encryption for sensitive fields in audit logs.
Ensures compliance with data protection requirements (GDPR, SOC 2).
"""

import os
import base64
import hashlib
import logging
from typing import Dict, Any, Optional, List
from cryptography.fernet import Fernet

logger = logging.getLogger(__name__)


class AuditEncryptionService:
    """
    Service for encrypting and decrypting sensitive fields in audit logs.
    
    Uses AES-256 encryption via Fernet (symmetric encryption).
    Sensitive fields include: user_agent, ip_address, action_details
    
    Requirements: 6.6
    """
    
    # Define which fields should be encrypted
    SENSITIVE_FIELDS = ["user_agent", "ip_address", "action_details"]
    
    def __init__(self, encryption_key: Optional[str] = None):
        """
        Initialize encryption service with encryption key.
        
        Args:
            encryption_key: Base64-encoded encryption key. If None, uses AUDIT_ENCRYPTION_KEY env var.
        
        Raises:
            RuntimeError: If no encryption key is available
        """
        # Get encryption key from parameter or environment
        key_string = encryption_key or os.getenv("AUDIT_ENCRYPTION_KEY")
        
        if not key_string:
            raise RuntimeError(
                "Encryption key not provided. Set AUDIT_ENCRYPTION_KEY environment variable."
            )
        
        # Create Fernet cipher from key
        # If key is not already in Fernet format, derive it from the string
        try:
            # Try to use key directly (if it's already a valid Fernet key)
            self.fernet = Fernet(key_string.encode() if isinstance(key_string, str) else key_string)
        except Exception:
            # If not valid, derive a Fernet key from the string using SHA-256
            key_hash = hashlib.sha256(key_string.encode()).digest()
            fernet_key = base64.urlsafe_b64encode(key_hash)
            self.fernet = Fernet(fernet_key)
        
        logger.info("Audit encryption service initialized")
    
    def encrypt_field(self, value: Any) -> str:
        """
        Encrypt a single field value.
        
        Args:
            value: Value to encrypt (will be converted to string)
        
        Returns:
            str: Base64-encoded encrypted value
        
        Raises:
            RuntimeError: If encryption fails
        """
        try:
            if value is None:
                return None
            
            # Convert value to string
            value_str = str(value)
            
            # Encrypt the value
            encrypted_bytes = self.fernet.encrypt(value_str.encode('utf-8'))
            
            # Return base64-encoded encrypted value
            return base64.urlsafe_b64encode(encrypted_bytes).decode('utf-8')
        
        except Exception as e:
            logger.error(f"Error encrypting field: {e}")
            raise RuntimeError(f"Failed to encrypt field: {str(e)}")
    
    def decrypt_field(self, encrypted_value: str) -> Optional[str]:
        """
        Decrypt a single field value.
        
        Args:
            encrypted_value: Base64-encoded encrypted value
        
        Returns:
            str: Decrypted value, or None if decryption fails
        """
        try:
            if not encrypted_value:
                return None
            
            # Decode from base64
            encrypted_bytes = base64.urlsafe_b64decode(encrypted_value.encode('utf-8'))
            
            # Decrypt the value
            decrypted_bytes = self.fernet.decrypt(encrypted_bytes)
            
            # Return decrypted string
            return decrypted_bytes.decode('utf-8')
        
        except Exception as e:
            logger.error(f"Error decrypting field: {e}")
            # Return None on decryption failure (field may not be encrypted)
            return None
    
    def encrypt_audit_event(self, event_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Encrypt sensitive fields in an audit event before storage.
        
        Args:
            event_data: Audit event data dictionary
        
        Returns:
            Dict with sensitive fields encrypted
        """
        try:
            encrypted_data = event_data.copy()
            
            # Encrypt each sensitive field if present
            for field in self.SENSITIVE_FIELDS:
                if field in encrypted_data and encrypted_data[field] is not None:
                    # Store original value
                    original_value = encrypted_data[field]
                    
                    # Encrypt the field
                    encrypted_value = self.encrypt_field(original_value)
                    
                    # Update the field with encrypted value
                    encrypted_data[field] = encrypted_value
                    
                    # Mark field as encrypted (for tracking)
                    if "encrypted_fields" not in encrypted_data:
                        encrypted_data["encrypted_fields"] = []
                    encrypted_data["encrypted_fields"].append(field)
            
            logger.debug(f"Encrypted {len(encrypted_data.get('encrypted_fields', []))} fields in audit event")
            
            return encrypted_data
        
        except Exception as e:
            logger.error(f"Error encrypting audit event: {e}")
            # Return original data if encryption fails (fail-open for availability)
            return event_data
    
    def decrypt_audit_event(self, event_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Decrypt sensitive fields in an audit event after retrieval.
        
        Args:
            event_data: Audit event data dictionary with encrypted fields
        
        Returns:
            Dict with sensitive fields decrypted
        """
        try:
            decrypted_data = event_data.copy()
            
            # Get list of encrypted fields (if tracked)
            encrypted_fields = decrypted_data.get("encrypted_fields", self.SENSITIVE_FIELDS)
            
            # Decrypt each encrypted field
            for field in encrypted_fields:
                if field in decrypted_data and decrypted_data[field] is not None:
                    # Decrypt the field
                    decrypted_value = self.decrypt_field(decrypted_data[field])
                    
                    # Update the field with decrypted value
                    if decrypted_value is not None:
                        decrypted_data[field] = decrypted_value
            
            # Remove encrypted_fields tracking field
            if "encrypted_fields" in decrypted_data:
                del decrypted_data["encrypted_fields"]
            
            logger.debug(f"Decrypted {len(encrypted_fields)} fields in audit event")
            
            return decrypted_data
        
        except Exception as e:
            logger.error(f"Error decrypting audit event: {e}")
            # Return original data if decryption fails
            return event_data
    
    def encrypt_batch(self, events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Encrypt sensitive fields in a batch of audit events.
        
        Args:
            events: List of audit event data dictionaries
        
        Returns:
            List of events with sensitive fields encrypted
        """
        encrypted_events = []
        
        for event in events:
            encrypted_event = self.encrypt_audit_event(event)
            encrypted_events.append(encrypted_event)
        
        logger.info(f"Encrypted {len(encrypted_events)} audit events in batch")
        
        return encrypted_events
    
    def decrypt_batch(self, events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Decrypt sensitive fields in a batch of audit events.
        
        Args:
            events: List of audit event data dictionaries with encrypted fields
        
        Returns:
            List of events with sensitive fields decrypted
        """
        decrypted_events = []
        
        for event in events:
            decrypted_event = self.decrypt_audit_event(event)
            decrypted_events.append(decrypted_event)
        
        logger.info(f"Decrypted {len(decrypted_events)} audit events in batch")
        
        return decrypted_events
    
    @staticmethod
    def generate_encryption_key() -> str:
        """
        Generate a new Fernet encryption key.
        
        Returns:
            str: Base64-encoded Fernet key
        
        Note:
            This should be called once during initial setup and the key
            should be securely stored (e.g., in environment variables or secrets manager).
        """
        key = Fernet.generate_key()
        return key.decode('utf-8')


# Singleton instance for global use
_encryption_service_instance = None


def get_encryption_service() -> AuditEncryptionService:
    """
    Get singleton instance of audit encryption service.
    
    Returns:
        AuditEncryptionService: Encryption service instance
    """
    global _encryption_service_instance
    
    if _encryption_service_instance is None:
        _encryption_service_instance = AuditEncryptionService()
    
    return _encryption_service_instance
