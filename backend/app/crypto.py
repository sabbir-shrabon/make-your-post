import base64
import hashlib
import logging

from cryptography.fernet import Fernet

from app.config import FACEBOOK_TOKEN_ENCRYPTION_KEY, SECRET_KEY

logger = logging.getLogger(__name__)


def _fernet_for_key(raw_key: str) -> Fernet:
    digest = hashlib.sha256(raw_key.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def _fernet() -> Fernet:
    raw_key = FACEBOOK_TOKEN_ENCRYPTION_KEY or SECRET_KEY or "fallback-secret-key-autoposter"
    return _fernet_for_key(raw_key)


def encrypt_token(token: str) -> str:
    return _fernet().encrypt(token.encode("utf-8")).decode("utf-8")


def decrypt_token(encrypted_token: str) -> str | None:
    if not encrypted_token:
        return None
    keys_to_try = [
        k for k in [
            FACEBOOK_TOKEN_ENCRYPTION_KEY,
            SECRET_KEY,
            "fallback-secret-key-autoposter",
        ] if k
    ]
    unique_keys: list[str] = []
    for k in keys_to_try:
        if k not in unique_keys:
            unique_keys.append(k)

    for raw_key in unique_keys:
        try:
            return _fernet_for_key(raw_key).decrypt(encrypted_token.encode("utf-8")).decode("utf-8")
        except Exception:
            continue

    logger.warning(
        "Failed to decrypt Facebook token — keys may have changed since the token was stored."
    )
    return None
