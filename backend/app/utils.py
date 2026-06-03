import logging
from passlib.hash import pbkdf2_sha256

logger = logging.getLogger(__name__)

def hash_password(password: str) -> str:
    return pbkdf2_sha256.hash(password)

def verify_password(password: str, hash: str) -> bool:
    try:
        return pbkdf2_sha256.verify(password, hash)
    except Exception as e:
        logger.error(f"Error verifying password: {e}")
        return False
