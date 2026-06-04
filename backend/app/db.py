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


async def seed_db():
    """Seed the database with default roles and staff if empty"""
    global db
    if db is None:
        db = get_db()
    
    # 1. Seed Roles
    try:
        roles_coll = db.get_collection('roles')
        roles_count = await roles_coll.count_documents({})
        if roles_count == 0:
            from datetime import datetime
            default_roles = [
                {
                    '_id': 'admin',
                    'name': 'Admin',
                    'description': 'Full system access with all permissions',
                    'permissions': {
                        'dashboard': True, 'menu': True, 'orders': True, 'kitchen': True,
                        'tables': True, 'inventory': True, 'staff': True, 'billing': True,
                        'delivery': True, 'offers': True, 'reports': True, 'notifications': True, 'settings': True
                    },
                    'createdAt': datetime.utcnow().isoformat()
                },
                {
                    '_id': 'manager',
                    'name': 'Manager',
                    'description': 'Restaurant operations management',
                    'permissions': {
                        'dashboard': True, 'menu': True, 'orders': True, 'kitchen': True,
                        'tables': True, 'inventory': True, 'staff': True, 'billing': True,
                        'delivery': True, 'offers': True, 'reports': True, 'notifications': True, 'settings': False
                    },
                    'createdAt': datetime.utcnow().isoformat()
                },
                {
                    '_id': 'chef',
                    'name': 'Chef',
                    'description': 'Kitchen and menu management',
                    'permissions': {
                        'dashboard': True, 'menu': True, 'orders': True, 'kitchen': True,
                        'tables': False, 'inventory': True, 'staff': False, 'billing': False,
                        'delivery': False, 'offers': False, 'reports': False, 'notifications': True, 'settings': False
                    },
                    'createdAt': datetime.utcnow().isoformat()
                },
                {
                    '_id': 'waiter',
                    'name': 'Waiter',
                    'description': 'Order and table management',
                    'permissions': {
                        'dashboard': True, 'menu': True, 'orders': True, 'kitchen': False,
                        'tables': True, 'inventory': False, 'staff': False, 'billing': True,
                        'delivery': False, 'offers': False, 'reports': False, 'notifications': True, 'settings': False
                    },
                    'createdAt': datetime.utcnow().isoformat()
                },
                {
                    '_id': 'cashier',
                    'name': 'Cashier',
                    'description': 'Billing and payment management',
                    'permissions': {
                        'dashboard': True, 'menu': True, 'orders': True, 'kitchen': False,
                        'tables': False, 'inventory': False, 'staff': False, 'billing': True,
                        'delivery': False, 'offers': True, 'reports': True, 'notifications': True, 'settings': False
                    },
                    'createdAt': datetime.utcnow().isoformat()
                },
                {
                    '_id': 'delivery',
                    'name': 'Delivery',
                    'description': 'Delivery and order management',
                    'permissions': {
                        'dashboard': True, 'menu': True, 'orders': True, 'kitchen': False,
                        'tables': False, 'inventory': False, 'staff': False, 'billing': False,
                        'delivery': True, 'offers': False, 'reports': False, 'notifications': True, 'settings': False
                    },
                    'createdAt': datetime.utcnow().isoformat()
                }
            ]
            await roles_coll.insert_many(default_roles)
            print("[DB] Default roles seeded successfully")
    except Exception as e:
        print(f"[DB] Error seeding default roles: {e}")

    # 2. Seed Staff
    try:
        staff_coll = db.get_collection('staff')
        staff_count = await staff_coll.count_documents({})
        if staff_count == 0:
            from datetime import datetime
            from .utils import hash_password
            
            default_staff = [
                {
                    'name': 'Admin User',
                    'email': 'admin@restaurant.com',
                    'role': 'admin',
                    'password_hash': hash_password('password123'),
                    'phone': '+91 9999999999',
                    'shift': 'morning',
                    'department': 'Administration',
                    'salary': 75000,
                    'hireDate': datetime.utcnow().isoformat(),
                    'active': True,
                    'createdAt': datetime.utcnow().isoformat()
                },
                {
                    'name': 'Rahul Sharma',
                    'email': 'rahul@restaurant.com',
                    'role': 'chef',
                    'password_hash': hash_password('password123'),
                    'phone': '+91 9876543210',
                    'shift': 'morning',
                    'department': 'Kitchen',
                    'salary': 45000,
                    'hireDate': datetime.utcnow().isoformat(),
                    'active': True,
                    'kitchenStation': 'HEAD_CHEF',
                    'kitchenPin': '0000',
                    'createdAt': datetime.utcnow().isoformat()
                },
                {
                    'name': 'Amit Kumar',
                    'email': 'amit@restaurant.com',
                    'role': 'manager',
                    'password_hash': hash_password('password123'),
                    'phone': '+91 9876543212',
                    'shift': 'morning',
                    'department': 'Management',
                    'salary': 55000,
                    'hireDate': datetime.utcnow().isoformat(),
                    'active': True,
                    'createdAt': datetime.utcnow().isoformat()
                },
                {
                    'name': 'Priya Patel',
                    'email': 'priya@restaurant.com',
                    'role': 'waiter',
                    'password_hash': hash_password('password123'),
                    'phone': '+91 9876543211',
                    'shift': 'evening',
                    'department': 'Service',
                    'salary': 25000,
                    'hireDate': datetime.utcnow().isoformat(),
                    'active': True,
                    'createdAt': datetime.utcnow().isoformat()
                },
                {
                    'name': 'Sneha Reddy',
                    'email': 'sneha@restaurant.com',
                    'role': 'cashier',
                    'password_hash': hash_password('password123'),
                    'phone': '+91 9876543213',
                    'shift': 'morning',
                    'department': 'Billing',
                    'salary': 28000,
                    'hireDate': datetime.utcnow().isoformat(),
                    'active': True,
                    'createdAt': datetime.utcnow().isoformat()
                }
            ]
            await staff_coll.insert_many(default_staff)
            print("[DB] Default staff seeded successfully")
    except Exception as e:
        print(f"[DB] Error seeding default staff: {e}")

