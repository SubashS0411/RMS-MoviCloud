from motor.motor_asyncio import AsyncIOMotorClient
import os

_client = None
db = None


def _mongo_timeout_ms() -> int:
    value = os.getenv('MONGODB_TIMEOUT_MS', '5000')
    try:
        return max(1000, int(value))
    except ValueError:
        return 5000

def init_db(uri: str = None):
    global _client, db
    if _client is not None:
        return db

    if uri is None:
        uri = os.getenv('MONGODB_URI')

    # Prefer a real MongoDB instance when URI is configured.
    if uri:
        timeout_ms = _mongo_timeout_ms()
        _client = AsyncIOMotorClient(
            uri,
            serverSelectionTimeoutMS=timeout_ms,
            connectTimeoutMS=timeout_ms,
            socketTimeoutMS=timeout_ms,
        )
        # Try to get database from URI, fallback to 'restaurant_db'
        default_db = _client.get_default_database()
        if default_db is not None:
            db = default_db
        else:
            db = _client['restaurant_db']
        return db

    # If no URI is set, fall back to an in-memory mock DB for local/dev usage.
    try:
        from mongomock_motor import AsyncMongoMockClient
        _client = AsyncMongoMockClient()
        db = _client['restaurant_db']
        print("[DB] Using MongoMock for local testing (No MongoDB required)")
        return db
    except ImportError as exc:
        raise RuntimeError('MONGODB_URI must be set (or install mongomock-motor for local mock DB)') from exc


def get_db():
    """Get the database instance"""
    global db
    if db is None:
        try:
            init_db()
        except Exception as exc:
            raise RuntimeError('Database not initialized. Unable to connect to database.') from exc
    return db
