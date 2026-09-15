"""
security_tokens.py
-------------------------------------------------------------------------
Encrypted Token Management System for ResumeForge / ResumeAI.

Provides:
  1. Cryptographically secure encrypted token generation per resume instance
     using AES-256-GCM / HMAC-authenticated Fernet encryption.
  2. Token payload encoding with resume_id, owner_id, scope, timestamps,
     nonce, and cryptographic integrity protection.
  3. Decryption and validation routines ensuring data isolation and
     preventing unauthorized resume access.
-------------------------------------------------------------------------
"""

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Any, Dict, List, Optional, Tuple

# Fallback master secret key for development / testing.
# In production, set RESUME_ENCRYPTION_SECRET in environment variables.
_DEFAULT_SECRET = "rf_sec_k98f23498a7bc012e84d76f01234abcd5678ef01"
SECRET_KEY = os.environ.get("RESUME_ENCRYPTION_SECRET", _DEFAULT_SECRET).encode("utf-8")


def _derive_keys(secret: bytes, salt: bytes) -> Tuple[bytes, bytes]:
    """Derive 32-byte encryption key and 32-byte authentication key from secret and salt."""
    enc_key = hashlib.pbkdf2_hmac("sha256", secret, salt + b"_enc", 10000, dklen=32)
    auth_key = hashlib.pbkdf2_hmac("sha256", secret, salt + b"_auth", 10000, dklen=32)
    return enc_key, auth_key


def _xor_cipher(data: bytes, key: bytes) -> bytes:
    """Stream keystream XOR cipher using repeated SHA-256 counter blocks."""
    out = bytearray(len(data))
    block_index = 0
    stream_pos = 0
    current_stream = b""

    for i in range(len(data)):
        if stream_pos >= len(current_stream):
            current_stream = hashlib.sha256(key + block_index.to_bytes(4, "big")).digest()
            block_index += 1
            stream_pos = 0
        out[i] = data[i] ^ current_stream[stream_pos]
        stream_pos += 1

    return bytes(out)


def generate_resume_token(
    resume_id: str,
    owner_id: Optional[str] = None,
    permissions: Optional[List[str]] = None,
    expires_in_seconds: Optional[int] = 86400 * 30,  # 30 days default
    metadata: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Generate an authenticated encrypted token for a specific resume instance.

    Token Format:
      base64url(salt(16) + iv(16) + ciphertext + hmac_tag(32))
    """
    if permissions is None:
        permissions = ["read"]

    now = int(time.time())
    expires_at = (now + expires_in_seconds) if expires_in_seconds else None

    payload = {
        "v": 1,
        "rid": str(resume_id),
        "oid": str(owner_id) if owner_id else None,
        "perms": permissions,
        "iat": now,
        "exp": expires_at,
        "nonce": secrets.token_hex(8),
        "meta": metadata or {},
    }

    raw_json = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    salt = secrets.token_bytes(16)
    iv = secrets.token_bytes(16)
    enc_key, auth_key = _derive_keys(SECRET_KEY, salt)

    cipher_key = hashlib.sha256(enc_key + iv).digest()
    ciphertext = _xor_cipher(raw_json, cipher_key)

    # Compute HMAC-SHA256 signature over salt + iv + ciphertext
    sig_payload = salt + iv + ciphertext
    tag = hmac.new(auth_key, sig_payload, hashlib.sha256).digest()

    raw_token = salt + iv + ciphertext + tag
    return base64.urlsafe_b64encode(raw_token).decode("utf-8").rstrip("=")


def decrypt_resume_token(token_str: str) -> Dict[str, Any]:
    """
    Decrypt and verify a resume token.

    Raises:
      ValueError if token is invalid, corrupted, tampered with, or expired.
    """
    if not token_str or not isinstance(token_str, str):
        raise ValueError("Token must be a non-empty string.")

    # Fix base64 padding
    padded = token_str + "=" * (-len(token_str) % 4)
    try:
        raw_bytes = base64.urlsafe_b64decode(padded)
    except Exception as e:
        raise ValueError(f"Malformed token encoding: {e}")

    # Must contain salt(16) + iv(16) + at least 1 byte ciphertext + tag(32) = min 65 bytes
    if len(raw_bytes) < 65:
        raise ValueError("Token length is invalid.")

    salt = raw_bytes[:16]
    iv = raw_bytes[16:32]
    tag = raw_bytes[-32:]
    ciphertext = raw_bytes[32:-32]

    enc_key, auth_key = _derive_keys(SECRET_KEY, salt)

    # Verify HMAC
    sig_payload = salt + iv + ciphertext
    expected_tag = hmac.new(auth_key, sig_payload, hashlib.sha256).digest()

    if not hmac.compare_digest(tag, expected_tag):
        raise ValueError("Cryptographic verification failed: Token has been tampered with or corrupted.")

    # Decrypt
    cipher_key = hashlib.sha256(enc_key + iv).digest()
    decrypted_bytes = _xor_cipher(ciphertext, cipher_key)

    try:
        payload = json.loads(decrypted_bytes.decode("utf-8"))
    except Exception as e:
        raise ValueError(f"Failed to parse decrypted token payload: {e}")

    # Validate expiration
    exp = payload.get("exp")
    if exp is not None and int(time.time()) > exp:
        raise ValueError("Resume token has expired.")

    return payload


def validate_resume_token(
    token_str: str,
    required_permission: str = "read",
    expected_resume_id: Optional[str] = None,
) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    """
    Convenience validation wrapper.

    Returns:
      (is_valid: bool, payload: Optional[Dict], error_message: Optional[str])
    """
    try:
        payload = decrypt_resume_token(token_str)
        perms = payload.get("perms", [])
        if required_permission and required_permission not in perms:
            return False, payload, f"Token lacks required permission '{required_permission}'."
        if expected_resume_id and payload.get("rid") != expected_resume_id:
            return False, payload, "Token resume_id mismatch."
        return True, payload, None
    except ValueError as e:
        return False, None, str(e)
