"""
Phase 1 – Security & Scalability: Encryption-at-Rest for sensitive financial data
Enterprise Readiness: Encrypt commitments/actuals amounts and PII before storage
"""

import os
import base64
import hashlib
import json
import logging
from typing import Optional, Any, Dict

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

logger = logging.getLogger(__name__)

# Env to enable encryption (default off for backward compatibility)
ENCRYPT_FINANCIAL_DATA = os.getenv("ENCRYPT_FINANCIAL_DATA", "").lower() in ("1", "true", "yes")


class FinancialEncryptionService:
    """
    Encrypt/decrypt sensitive financial fields (amounts, vendor, etc.) at rest.
    Uses AES-256-GCM. Key from ENCRYPTION_KEY or FINANCIAL_ENCRYPTION_KEY env.
    """

    def __init__(self, key: Optional[bytes] = None):
        key_b64 = key or os.getenv("FINANCIAL_ENCRYPTION_KEY") or os.getenv("ENCRYPTION_KEY")
        if not key_b64:
            self._aes = None
            logger.warning("FinancialEncryptionService: no key set, encryption disabled")
            return
        try:
            raw = base64.b64decode(key_b64) if len(key_b64) >= 44 else key_b64.encode()
            if len(raw) == 32:
                self._aes = AESGCM(raw)
            else:
                kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=b"ppm_financial", iterations=100000)
                self._aes = AESGCM(kdf.derive(raw[:64].ljust(64, b"\0")))
        except Exception as e:
            logger.warning("FinancialEncryptionService: key setup failed: %s", e)
            self._aes = None

    def encrypt_value(self, value: Any) -> Optional[str]:
        """Encrypt a single value; returns base64(iv + ciphertext + tag) or None if disabled."""
        if self._aes is None or value is None:
            return None
        try:
            plain = json.dumps(value) if not isinstance(value, (str, int, float)) else str(value)
            plain_bytes = plain.encode("utf-8")
            iv = os.urandom(12)
            ct = self._aes.encrypt(iv, plain_bytes, None)
            return base64.b64encode(iv + ct).decode("ascii")
        except Exception as e:
            logger.warning("FinancialEncryptionService: encrypt failed: %s", e)
            return None

    def decrypt_value(self, encrypted: Optional[str]) -> Optional[Any]:
        """Decrypt a value; returns original type when possible."""
        if self._aes is None or not encrypted:
            return None
        try:
            raw = base64.b64decode(encrypted)
            iv, ct = raw[:12], raw[12:]
            plain = self._aes.decrypt(iv, ct, None).decode("utf-8")
            try:
                return json.loads(plain)
            except json.JSONDecodeError:
                return plain
        except Exception as e:
            logger.warning("FinancialEncryptionService: decrypt failed: %s", e)
            return None

    def encrypt_row_fields(self, row: Dict[str, Any], fields: list) -> Dict[str, Any]:
        """Return a copy of row with specified fields encrypted (store in encrypted_* columns)."""
        if not ENCRYPT_FINANCIAL_DATA or self._aes is None:
            return row
        out = dict(row)
        for f in fields:
            if f in out and out[f] is not None:
                enc = self.encrypt_value(out[f])
                if enc is not None:
                    out[f"encrypted_{f}"] = enc
                    out[f] = None
        return out

    def decrypt_row_fields(self, row: Dict[str, Any], fields: list) -> Dict[str, Any]:
        """Return a copy of row with encrypted_* fields decrypted into original field names."""
        if self._aes is None:
            return row
        out = dict(row)
        for f in fields:
            enc_key = f"encrypted_{f}"
            if enc_key in out and out[enc_key]:
                dec = self.decrypt_value(out[enc_key])
                if dec is not None:
                    out[f] = dec
        return out


_financial_encryption: Optional[FinancialEncryptionService] = None


def get_financial_encryption() -> FinancialEncryptionService:
    global _financial_encryption
    if _financial_encryption is None:
        _financial_encryption = FinancialEncryptionService()
    return _financial_encryption
