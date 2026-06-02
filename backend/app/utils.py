from passlib.hash import pbkdf2_sha256

def hash_password(password: str) -> str:
    return pbkdf2_sha256.hash(password)

def verify_password(password: str, hash: str) -> bool:
    try:
        return pbkdf2_sha256.verify(password, hash)
    except Exception:
        return False
