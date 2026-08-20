import base64
import hashlib
import logging

from cryptography.fernet import Fernet

from app.config import FACEBOOK_TOKEN_ENCRYPTION_KEY, SECRET_KEY

logger = logging.getLogger(__name__)


def _fernet_for_key(raw_key: str) -> Fernet:
    digest = hashlib.sha256(raw_key.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def _get_encryption_key() -> str:
    raw_key = (FACEBOOK_TOKEN_ENCRYPTION_KEY or SECRET_KEY or "").strip()
    if not raw_key:
        raise ValueError("Neither FACEBOOK_TOKEN_ENCRYPTION_KEY nor SECRET_KEY is set.")
    return raw_key


def _fernet() -> Fernet:
    return _fernet_for_key(_get_encryption_key())


def encrypt_token(token: str) -> str:
    return _fernet().encrypt(token.encode("utf-8")).decode("utf-8")


def decrypt_token(encrypted_token: str) -> str | None:
    if not encrypted_token:
        return None
    keys_to_try = [
        k.strip() for k in [
            FACEBOOK_TOKEN_ENCRYPTION_KEY,
            SECRET_KEY,
        ] if k and k.strip()
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
