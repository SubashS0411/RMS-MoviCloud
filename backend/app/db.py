from motor.motor_asyncio import AsyncIOMotorClient
import os

_client = None
db = None
_using_mock = False


def _mongo_timeout_ms() -> int:
    value = os.getenv('MONGODB_TIMEOUT_MS', '5000')
    try:
        return max(1000, int(value))
    except ValueError:
        return 5000


def _env_truthy(name: str) -> bool:
    value = os.getenv(name, '').strip().lower()
    return value in {'1', 'true', 'yes', 'on'}


def _init_mock_db() -> bool:
    global _client, db, _using_mock
    try:
        from mongomock_motor import AsyncMongoMockClient
        _client = AsyncMongoMockClient()
        db = _client['restaurant_db']
        _using_mock = True
        print("[DB] Using MongoMock for local testing (No MongoDB required)")
        return True
    except ImportError:
        return False


def force_mock_db() -> bool:
    """Force switch database client to MongoMock."""
    return _init_mock_db()


def is_using_mock_db() -> bool:
    return _using_mock


def init_db(uri: str = None):
    global _client, db, _using_mock
    if _client is not None:
        return db

    if uri is None:
        uri = os.getenv('MONGODB_URI')

    if _env_truthy('MONGODB_USE_MOCK'):
        if _init_mock_db():
            return db
        raise RuntimeError('MONGODB_USE_MOCK is set but mongomock-motor is not installed')

    # Prefer a real MongoDB instance when URI is configured.
    if uri:
        timeout_ms = _mongo_timeout_ms()
        _client = AsyncIOMotorClient(
            uri,
            serverSelectionTimeoutMS=timeout_ms,
            connectTimeoutMS=timeout_ms,
            socketTimeoutMS=timeout_ms,
        )
        _using_mock = False
        # Try to get database from URI, fallback to 'restaurant_db'
        default_db = _client.get_default_database()
        if default_db is not None:
            db = default_db
        else:
            db = _client['restaurant_db']
        return db

    # If no URI is set, fall back to an in-memory mock DB for local/dev usage.
    if _init_mock_db():
        return db
    raise RuntimeError('MONGODB_URI must be set (or install mongomock-motor for local mock DB)')


def get_db():
    """Get the database instance"""
    global db
    if db is None:
        init_db()
    if db is None:
        raise RuntimeError('Database not initialized. Unable to connect to database.')
    return db
