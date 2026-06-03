from fastapi import APIRouter, HTTPException, Request, Depends
from ...db import init_db, get_db
from ..schemas import (
    SettingIn, SystemConfigIn, BackupCreate, BackupConfig, 
    RoleIn, RoleUpdate, PasswordChange, PasswordReset,
    TaxConfigIn, DiscountRuleIn, DiscountRuleUpdate,
    UserAccountIn, UserAccountUpdate
)
from ...utils import hash_password, verify_password
from ...audit import log_audit
from ...gdrive import gdrive_service
from datetime import datetime
from typing import Optional
from bson import ObjectId
import json

router = APIRouter()


def serialize_doc(doc):
    """Convert MongoDB document to JSON-serializable dict"""
    if doc is None:
        return None
    if isinstance(doc, list):
        return [serialize_doc(d) for d in doc]
    if isinstance(doc, dict):
        result = {}
        for key, value in doc.items():
            if isinstance(value, ObjectId):
                result[key] = str(value)
            elif isinstance(value, dict):
                result[key] = serialize_doc(value)
            elif isinstance(value, list):
                result[key] = [serialize_doc(v) if isinstance(v, dict) else str(v) if isinstance(v, ObjectId) else v for v in value]
            else:
                result[key] = value
        return result
    return doc


def to_object_id(id_str: str):
    """Convert string ID to ObjectId, or return the string if invalid"""
    try:
        return ObjectId(id_str)
    except Exception:
        return id_str


def get_safe_db():
    """Get database instance with proper error handling for user settings"""
    try:
        db = get_db()
        if db is None:
            raise HTTPException(status_code=503, detail='Database connection failed')
        return db
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=f'Database unavailable: {str(e)}')
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Database error: {str(e)}')


def format_last_login(raw_last_login):
    """Format last login timestamp for user response"""
    if isinstance(raw_last_login, datetime):
        return raw_last_login.isoformat() + 'Z'
    elif raw_last_login:
        return str(raw_last_login)
    return 'Never'


# ============ GENERAL SETTINGS ============
@router.get('/', tags=['settings'])
async def list_settings(category: Optional[str] = None):
    """List all settings with optional category filter"""
    try:
        db = get_safe_db()
        coll = db.get_collection('settings')
        filt = {}
        if category:
            filt['category'] = category
        docs = await coll.find(filt).to_list(1000)
        return serialize_doc(docs)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Failed to list settings: {str(e)}')


@router.get('/key/{key}', tags=['settings'])
async def get_setting(key: str):
    """Get a specific setting by key"""
    try:
        db = get_safe_db()
        coll = db.get_collection('settings')
        doc = await coll.find_one({'key': key})
        if not doc:
            raise HTTPException(status_code=404, detail='Not found')
        return serialize_doc(doc)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Failed to get setting: {str(e)}')


@router.post('/', tags=['settings'])
async def upsert_setting(s: SettingIn, request: Request):
    """Create or update a setting"""
    try:
        db = get_safe_db()
        coll = db.get_collection('settings')
        result = await coll.update_one(
            {'key': s.key},
            {
                '$set': {
                    'value': s.value,
                    'description': s.description,
                    'category': s.category,
                    'updatedBy': request.headers.get('x-user-name'),
                    'updatedAt': datetime.utcnow().isoformat()
                },
                '$setOnInsert': {
                    'createdAt': datetime.utcnow().isoformat()
                }
            },
            upsert=True
        )
        await log_audit(
            action='update_setting',
            resource='setting',
            resourceId=s.key,
            userId=request.headers.get('x-user-id'),
            userName=request.headers.get('x-user-name'),
            details={'key': s.key, 'category': s.category},
            ip=request.client.host if request.client else None
        )
        doc = await coll.find_one({'key': s.key})
        return serialize_doc(doc)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Failed to upsert setting: {str(e)}')


@router.delete('/key/{key}', tags=['settings'])
async def delete_setting(key: str, request: Request):
    """Delete a setting by key"""
    try:
        db = get_safe_db()
        coll = db.get_collection('settings')
        res = await coll.delete_one({'key': key})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail='Not found')
        
        await log_audit(
            action='delete_setting',
            resource='setting',
            resourceId=key,
            userId=request.headers.get('x-user-id'),
            userName=request.headers.get('x-user-name'),
            ip=request.client.host if request.client else None
        )
        return {'success': True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Failed to delete setting: {str(e)}')


# ============ SYSTEM CONFIGURATION ============
@router.get('/system-config', tags=['system-config'])
async def get_system_config():
    """Get all system configuration settings"""
    try:
        db = get_safe_db()
        coll = db.get_collection('system_config')
        doc = await coll.find_one({'_id': 'main_config'})
        if not doc:
            # Return default configuration
            return {
                '_id': 'main_config',
                'restaurantName': 'Restaurant Management System',
                'address': '',
                'city': '',
                'state': '',
                'pincode': '',
                'contactNumber': '',
                'email': '',
                'website': '',
                'operatingHours': '',
                'currency': 'INR',
                'timezone': 'Asia/Kolkata',
                'language': 'English',
                'dateFormat': 'DD/MM/YYYY',
                'timeFormat': '12-hour',
                'logoUrl': '/favicon.png'
            }
        return serialize_doc(doc)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Failed to get system config: {str(e)}')


@router.post('/system-config', tags=['system-config'])
async def update_system_config(config: SystemConfigIn, request: Request):
    """Update system configuration"""
    try:
        db = get_safe_db()
        coll = db.get_collection('system_config')
        
        update_data = config.model_dump(exclude_unset=True)
        update_data['updatedAt'] = datetime.utcnow().isoformat()
        update_data['updatedBy'] = request.headers.get('x-user-name')
        
        await coll.update_one(
            {'_id': 'main_config'},
            {
                '$set': update_data,
                '$setOnInsert': {'createdAt': datetime.utcnow().isoformat()}
            },
            upsert=True
        )
        
        await log_audit(
            action='update_system_config',
            resource='system_config',
            resourceId='main_config',
            userId=request.headers.get('x-user-id'),
            userName=request.headers.get('x-user-name'),
            details={'updated_fields': list(update_data.keys())},
            ip=request.client.host if request.client else None
        )
        
        return serialize_doc(await coll.find_one({'_id': 'main_config'}))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Failed to update system config: {str(e)}')


# ============ ROLES & PERMISSIONS ============
@router.get('/roles', tags=['roles'])
async def list_roles():
    """List all roles with their permissions"""
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

    try:
        db = get_db()
        coll = db.get_collection('roles')
        docs = await coll.find().to_list(100)
    except Exception:
        return serialize_doc(default_roles)
    
    if not docs:
        # Initialize with default roles
        await coll.insert_many(default_roles)
        docs = default_roles
    
    return serialize_doc(docs)


@router.get('/roles/{role_id}', tags=['roles'])
async def get_role(role_id: str):
    """Get a specific role by ID"""
    db = get_db()
    coll = db.get_collection('roles')
    doc = await coll.find_one({'_id': role_id})
    if not doc:
        raise HTTPException(status_code=404, detail='Role not found')
    return serialize_doc(doc)


@router.post('/roles', tags=['roles'])
async def create_role(role: RoleIn, request: Request):
    """Create a new role"""
    db = get_db()
    coll = db.get_collection('roles')
    
    # Check if role name already exists
    existing = await coll.find_one({'name': role.name})
    if existing:
        raise HTTPException(status_code=409, detail='Role name already exists')
    
    doc = {
        '_id': role.name.lower().replace(' ', '_'),
        'name': role.name,
        'description': role.description,
        'permissions': role.permissions.model_dump(),
        'createdAt': datetime.utcnow().isoformat()
    }
    
    await coll.insert_one(doc)
    
    await log_audit(
        action='create_role',
        resource='role',
        resourceId=doc['_id'],
        userId=request.headers.get('x-user-id'),
        userName=request.headers.get('x-user-name'),
        details={'name': role.name},
        ip=request.client.host if request.client else None
    )
    
    return serialize_doc(doc)


@router.put('/roles/{role_id}', tags=['roles'])
async def update_role(role_id: str, role: RoleUpdate, request: Request):
    """Update a role's permissions"""
    db = get_db()
    coll = db.get_collection('roles')
    
    # Get existing role
    existing = await coll.find_one({'_id': role_id})
    if not existing:
        raise HTTPException(status_code=404, detail='Role not found')
    
    update_data = {}
    if role.name is not None:
        update_data['name'] = role.name
    if role.description is not None:
        update_data['description'] = role.description
    if role.permissions is not None:
        update_data['permissions'] = role.permissions.model_dump()
    
    update_data['updatedAt'] = datetime.utcnow().isoformat()
    
    await coll.update_one({'_id': role_id}, {'$set': update_data})
    
    await log_audit(
        action='update_role',
        resource='role',
        resourceId=role_id,
        userId=request.headers.get('x-user-id'),
        userName=request.headers.get('x-user-name'),
        details={'name': role.name},
        ip=request.client.host if request.client else None
    )
    
    return serialize_doc(await coll.find_one({'_id': role_id}))


@router.delete('/roles/{role_id}', tags=['roles'])
async def delete_role(role_id: str, request: Request):
    """Delete a role (except built-in roles)"""
    protected_roles = ['admin', 'manager', 'chef', 'waiter', 'cashier', 'delivery']
    if role_id in protected_roles:
        raise HTTPException(status_code=400, detail='Cannot delete built-in roles')
    
    db = get_db()
    coll = db.get_collection('roles')
    res = await coll.delete_one({'_id': role_id})
    
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail='Role not found')
    
    await log_audit(
        action='delete_role',
        resource='role',
        resourceId=role_id,
        userId=request.headers.get('x-user-id'),
        userName=request.headers.get('x-user-name'),
        ip=request.client.host if request.client else None
    )
    
    return {'success': True}


# ============ PASSWORD MANAGEMENT ============
@router.post('/change-password', tags=['security'])
async def change_password(payload: PasswordChange, request: Request):
    """Change user password"""
    from bson import ObjectId
    db = get_db()
    coll = db.get_collection('staff')
    
    try:
        user_id = ObjectId(payload.userId)
    except Exception:
        raise HTTPException(status_code=400, detail='Invalid user ID format')
    
    user = await coll.find_one({'_id': user_id})
    if not user:
        raise HTTPException(status_code=404, detail='User not found')
    
    # Verify current password
    if not verify_password(payload.currentPassword, user.get('password_hash', '')):
        raise HTTPException(status_code=401, detail='Current password is incorrect')
    
    # Validate new password
    if len(payload.newPassword) < 8:
        raise HTTPException(status_code=400, detail='Password must be at least 8 characters')
    
    # Update password
    new_hash = hash_password(payload.newPassword)
    await coll.update_one(
        {'_id': user_id},
        {'$set': {
            'password_hash': new_hash,
            'passwordChangedAt': datetime.utcnow().isoformat()
        }}
    )
    
    await log_audit(
        action='change_password',
        resource='staff',
        resourceId=payload.userId,
        userId=request.headers.get('x-user-id'),
        userName=request.headers.get('x-user-name'),
        ip=request.client.host if request.client else None
    )
    
    return {'success': True, 'message': 'Password changed successfully'}


@router.post('/reset-password', tags=['security'])
async def reset_password_request(payload: PasswordReset, request: Request):
    """Request password reset (sends reset link/code)"""
    db = get_db()
    coll = db.get_collection('staff')
    
    user = await coll.find_one({'email': payload.email})
    if not user:
        # Don't reveal whether email exists
        return {'success': True, 'message': 'If the email exists, a reset link has been sent'}
    
    # Generate reset token (in production, send email)
    import secrets
    reset_token = secrets.token_urlsafe(32)
    
    await coll.update_one(
        {'_id': user['_id']},
        {'$set': {
            'resetToken': reset_token,
            'resetTokenExpiry': datetime.utcnow().isoformat()
        }}
    )
    
    await log_audit(
        action='password_reset_request',
        resource='staff',
        resourceId=str(user['_id']),
        userId=request.headers.get('x-user-id'),
        userName=request.headers.get('x-user-name'),
        details={'email': payload.email},
        ip=request.client.host if request.client else None
    )
    
    return {'success': True, 'message': 'Password reset link has been sent to your email'}


# ============ BACKUP & RECOVERY ============
@router.get('/backups', tags=['backup'])
async def list_backups():
    """List all backups (excludes large backupData field for performance)"""
    db = get_db()
    coll = db.get_collection('backups')
    # Exclude the large backupData field when listing
    docs = await coll.find({}, {'backupData': 0}).sort('createdAt', -1).to_list(100)
    return serialize_doc(docs)


@router.get('/backup-config', tags=['backup'])
async def get_backup_config():
    """Get backup configuration"""
    db = get_db()
    coll = db.get_collection('backup_config')
    doc = await coll.find_one({'_id': 'backup_settings'})
    if not doc:
        return {
            '_id': 'backup_settings',
            'autoBackupEnabled': True,
            'frequency': 'daily',
            'backupTime': '02:00',
            'retentionDays': 30,
            'backupLocation': 'local',
            'googleDriveEnabled': False,
            'googleDriveFolderId': None
        }
    return serialize_doc(doc)


@router.post('/backup-config', tags=['backup'])
async def update_backup_config(config: BackupConfig, request: Request):
    """Update backup configuration"""
    db = get_db()
    coll = db.get_collection('backup_config')
    
    update_data = config.model_dump()
    update_data['updatedAt'] = datetime.utcnow().isoformat()
    
    await coll.update_one(
        {'_id': 'backup_settings'},
        {'$set': update_data},
        upsert=True
    )
    
    await log_audit(
        action='update_backup_config',
        resource='backup_config',
        resourceId='backup_settings',
        userId=request.headers.get('x-user-id'),
        userName=request.headers.get('x-user-name'),
        ip=request.client.host if request.client else None
    )
    
    # Update the scheduler with new configuration
    try:
        from ...scheduler import update_backup_schedule
        await update_backup_schedule()
    except Exception as e:
        print(f"[Settings] Warning: Could not update scheduler: {e}")
    
    return serialize_doc(await coll.find_one({'_id': 'backup_settings'}))



@router.post('/backups', tags=['backup'])
async def create_backup(payload: BackupCreate, request: Request):
    """Create a new backup - stores actual data for later restore"""
    db = get_db()
    coll = db.get_collection('backups')
    config_coll = db.get_collection('backup_config')
    
    # Get backup configuration
    backup_config = await config_coll.find_one({'_id': 'backup_settings'})
    google_drive_enabled = backup_config.get('googleDriveEnabled', False) if backup_config else False
    google_drive_folder_id = backup_config.get('googleDriveFolderId') if backup_config else None
    
    # Get list of collections to backup - include all important data collections
    collection_names = payload.collections or [
        'staff', 'settings', 'system_config', 'roles', 'audit_logs',
        'attendance', 'shifts', 'performance_logs', 'menu_items',
        'combo_meals', 'orders', 'customers', 'tables', 'ingredients',
        'recipes', 'suppliers', 'purchases', 'coupons', 'membership_plans',
        'discount_rules', 'invoices', 'payments', 'notifications',
        'tax_config', 'backup_config'
    ]
    
    # Export actual data from each collection
    backup_data = {}
    metadata = {}
    total_docs = 0
    
    for coll_name in collection_names:
        try:
            collection = db.get_collection(coll_name)
            docs = await collection.find().to_list(50000)
            backup_data[coll_name] = serialize_doc(docs)
            metadata[coll_name] = len(docs)
            total_docs += len(docs)
        except Exception as e:
            print(f"[Backup] Warning: Could not backup collection {coll_name}: {e}")
            backup_data[coll_name] = []
            metadata[coll_name] = 0
    
    now = datetime.utcnow()
    backup_name = payload.name or f"{payload.type.title() if payload.type else 'Manual'} Backup - {now.strftime('%Y-%m-%d')}"
    
    # Calculate size of actual data
    data_json = json.dumps(backup_data, default=str)
    backup_size_bytes = len(data_json)
    if backup_size_bytes > 1024 * 1024:
        size_str = f"{backup_size_bytes / (1024 * 1024):.0f} MB"
    else:
        size_str = f"{backup_size_bytes / 1024:.2f} KB"
    
    # Create backup document WITH the actual data stored
    backup_doc = {
        'name': backup_name,
        'type': payload.type or 'manual',
        'collections': collection_names,
        'documentCounts': metadata,
        'totalDocuments': total_docs,
        'size': size_str,
        'date': now.strftime('%Y-%m-%d'),
        'time': now.strftime('%H:%M:%S'),
        'status': 'completed',
        'createdAt': now.isoformat(),
        # Store the actual backup data for restore
        'backupData': backup_data
    }
    
    res = await coll.insert_one(backup_doc)
    
    await log_audit(
        action='create_backup',
        resource='backup',
        resourceId=str(res.inserted_id),
        userId=request.headers.get('x-user-id'),
        userName=request.headers.get('x-user-name'),
        details={
            'collections': collection_names, 
            'totalDocs': total_docs,
            'size': size_str
        },
        ip=request.client.host if request.client else None
    )
    
    # Return without the large backupData field for response
    result = serialize_doc(await coll.find_one({'_id': res.inserted_id}, {'backupData': 0}))
    return result


@router.post('/backups/{backup_id}/restore', tags=['backup'])
async def restore_backup(backup_id: str, request: Request):
    """Restore from a backup - replaces current data with backup data"""
    db = get_db()
    coll = db.get_collection('backups')
    
    backup = await coll.find_one({'_id': to_object_id(backup_id)})
    if not backup:
        raise HTTPException(status_code=404, detail='Backup not found')
    
    # Support both new format (backupData) and old format (content.data)
    backup_data = backup.get('backupData')
    if not backup_data and backup.get('content'):
        backup_data = backup.get('content', {}).get('data')
    
    if not backup_data:
        raise HTTPException(status_code=400, detail='This backup does not contain restorable data. It may be an old backup created before the fix.')
    
    collections_restored = []
    total_restored = 0
    errors = []
    
    # Restore each collection from backup
    for coll_name, docs in backup_data.items():
        if not docs:
            continue
        try:
            collection = db.get_collection(coll_name)
            
            # Clear existing data in the collection
            await collection.delete_many({})
            
            # Convert string IDs back to ObjectIds where needed
            restored_docs = []
            for doc in docs:
                if '_id' in doc:
                    try:
                        doc['_id'] = ObjectId(doc['_id'])
                    except:
                        pass  # Keep as string if not valid ObjectId
                restored_docs.append(doc)
            
            # Insert backup data
            if restored_docs:
                await collection.insert_many(restored_docs)
                collections_restored.append(coll_name)
                total_restored += len(restored_docs)
        except Exception as e:
            errors.append(f"{coll_name}: {str(e)}")
            print(f"[Restore] Error restoring {coll_name}: {e}")
    
    await log_audit(
        action='restore_backup',
        resource='backup',
        resourceId=backup_id,
        userId=request.headers.get('x-user-id'),
        userName=request.headers.get('x-user-name'),
        details={
            'backup_name': backup.get('name'),
            'collections_restored': collections_restored,
            'total_documents': total_restored,
            'errors': errors
        },
        ip=request.client.host if request.client else None
    )
    
    if errors:
        return {
            'success': True, 
            'message': f"Backup '{backup.get('name')}' partially restored. {len(collections_restored)} collections, {total_restored} documents.",
            'warnings': errors
        }
    
    return {
        'success': True, 
        'message': f"Backup '{backup.get('name')}' restored successfully. {len(collections_restored)} collections, {total_restored} documents."
    }


@router.get('/backups/{backup_id}/download', tags=['backup'])
async def download_backup(backup_id: str):
    """Download backup data as JSON - returns the actual stored backup data"""
    db = get_db()
    coll = db.get_collection('backups')
    
    backup = await coll.find_one({'_id': to_object_id(backup_id)})
    if not backup:
        raise HTTPException(status_code=404, detail='Backup not found')
    
    # Support both new format (backupData) and old format (content.data)
    backup_data = backup.get('backupData')
    if not backup_data and backup.get('content'):
        backup_data = backup.get('content', {}).get('data')
    
    if not backup_data:
        raise HTTPException(status_code=400, detail='This backup does not contain downloadable data. It may be an old backup.')
    
    # Return the stored backup data with metadata
    return {
        'backupInfo': {
            'name': backup.get('name'),
            'date': backup.get('date'),
            'time': backup.get('time'),
            'totalDocuments': backup.get('totalDocuments'),
            'collections': backup.get('collections'),
            'documentCounts': backup.get('documentCounts')
        },
        'collections': backup.get('collections', []),
        'data': backup_data,
        'exportedAt': backup.get('createdAt')
    }


@router.post('/backups/upload', tags=['backup'])
async def upload_backup(request: Request):
    """Upload and process a backup file"""
    db = get_db()
    
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail='Invalid JSON data')

    # Accept top-level {collections, data} OR wrapped {backupInfo, collections, data}
    raw_data = body.get('data') or {}
    if not raw_data and 'backupData' in body:
        raw_data = body['backupData']

    if not raw_data:
        raise HTTPException(status_code=400, detail='Invalid backup format. Must contain a data field with collection data.')

    # Create a backup record for the uploaded file
    now = datetime.utcnow()
    import json as _json
    size_bytes = len(_json.dumps(raw_data, default=str).encode('utf-8'))
    size_str = f"{size_bytes / (1024*1024):.2f} MB" if size_bytes > 1024*1024 else f"{size_bytes / 1024:.2f} KB"
    backup_doc = {
        'name': f"Uploaded Backup - {now.strftime('%Y-%m-%d %H:%M')}",
        'type': 'uploaded',
        'collections': body.get('collections', list(raw_data.keys())),
        'documentCounts': {k: len(v) for k, v in raw_data.items() if isinstance(v, list)},
        'totalDocuments': sum(len(v) for v in raw_data.values() if isinstance(v, list)),
        'size': size_str,
        'date': now.strftime('%Y-%m-%d'),
        'time': now.strftime('%H:%M:%S'),
        'status': 'completed',
        'createdAt': now.isoformat(),
        # Store data so restore works
        'backupData': raw_data,
    }
    
    coll = db.get_collection('backups')
    res = await coll.insert_one(backup_doc)
    
    await log_audit(
        action='upload_backup',
        resource='backup',
        resourceId=str(res.inserted_id),
        userId=request.headers.get('x-user-id'),
        userName=request.headers.get('x-user-name'),
        details={'collections': body.get('collections', [])},
        ip=request.client.host if request.client else None
    )
    
    return {'success': True, 'message': 'Backup uploaded successfully', 'backup': serialize_doc(await coll.find_one({'_id': res.inserted_id}))}


@router.delete('/backups/{backup_id}', tags=['backup'])
async def delete_backup(backup_id: str, request: Request):
    """Delete a backup"""
    db = get_db()
    coll = db.get_collection('backups')
    
    res = await coll.delete_one({'_id': to_object_id(backup_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail='Backup not found')
    
    await log_audit(
        action='delete_backup',
        resource='backup',
        resourceId=backup_id,
        userId=request.headers.get('x-user-id'),
        userName=request.headers.get('x-user-name'),
        ip=request.client.host if request.client else None
    )
    
    return {'success': True}


# ============ GOOGLE DRIVE STATUS ============
@router.get('/gdrive-status', tags=['backup'])
async def get_gdrive_status():
    """Get Google Drive integration status"""
    from ...gdrive import gdrive_service
    
    # Check if packages are available
    try:
        from google.oauth2 import service_credentials
        packages_available = True
    except ImportError:
        packages_available = False
    
    # Check environment variables
    import os
    service_email = os.getenv('GDRIVE_SERVICE_ACCOUNT_EMAIL')
    private_key = os.getenv('GDRIVE_PRIVATE_KEY')
    project_id = os.getenv('GDRIVE_PROJECT_ID')
    
    credentials_found = bool(service_email and private_key and project_id)
    
    # Check JSON file
    from pathlib import Path
    credentials_path = Path(__file__).parent.parent / 'gdrive-credentials.json'
    json_file_exists = credentials_path.exists()
    
    # Get backup config
    db = get_db()
    config_coll = db.get_collection('backup_config')
    config = await config_coll.find_one({'_id': 'backup_settings'})
    
    google_drive_enabled = config.get('googleDriveEnabled', False) if config else False
    google_drive_folder_id = config.get('googleDriveFolderId') if config else None
    
    # Try to initialize and check service
    service_available = gdrive_service.is_available() if packages_available else False
    error_message = gdrive_service.get_error() if not service_available else None
    
    # Count backups in drive if connected
    backups_in_drive = 0
    folder_accessible = False
    if service_available and google_drive_folder_id:
        result = gdrive_service.list_backups(google_drive_folder_id)
        if result.get('success'):
            backups_in_drive = len(result.get('files', []))
            folder_accessible = True
    
    return {
        'configured': packages_available and (credentials_found or json_file_exists),
        'enabled': google_drive_enabled,
        'serviceAvailable': service_available,
        'credentialsFound': credentials_found or json_file_exists,
        'folderAccessible': folder_accessible,
        'backupsInDrive': backups_in_drive,
        'error': error_message,
        'packagesInstalled': packages_available,
    }


# ============ TAX & SERVICE CONFIGURATION ============
@router.get('/tax-config', tags=['tax'])
async def get_tax_config():
    """Get tax and service charge configuration"""
    try:
        db = get_safe_db()
        coll = db.get_collection('tax_config')
        doc = await coll.find_one({'_id': 'main_tax_config'})
        if not doc:
            # Return default tax configuration
            return {
                '_id': 'main_tax_config',
                'gstEnabled': True,
                'gstRate': 5.0,
                'cgstRate': 2.5,
                'sgstRate': 2.5,
                'serviceChargeEnabled': True,
                'serviceChargeRate': 10.0,
                'packagingChargeEnabled': True,
                'packagingChargeRate': 20.0
            }
        return serialize_doc(doc)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Failed to get tax config: {str(e)}')


@router.post('/tax-config', tags=['tax'])
async def update_tax_config(config: TaxConfigIn, request: Request):
    """Update tax and service charge configuration"""
    try:
        db = get_safe_db()
        coll = db.get_collection('tax_config')
        
        update_data = config.model_dump()
        update_data['updatedAt'] = datetime.utcnow().isoformat()
        update_data['updatedBy'] = request.headers.get('x-user-name')
        
        await coll.update_one(
            {'_id': 'main_tax_config'},
            {
                '$set': update_data,
                '$setOnInsert': {'createdAt': datetime.utcnow().isoformat()}
            },
            upsert=True
        )
        
        await log_audit(
            action='update_tax_config',
            resource='tax_config',
            resourceId='main_tax_config',
            userId=request.headers.get('x-user-id'),
            userName=request.headers.get('x-user-name'),
            details={'updated_fields': list(update_data.keys())},
            ip=request.client.host if request.client else None
        )
        
        return serialize_doc(await coll.find_one({'_id': 'main_tax_config'}))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Failed to update tax config: {str(e)}')


# ============ DISCOUNT RULES ============
@router.get('/discounts', tags=['discounts'])
async def list_discount_rules():
    """List all discount rules"""
    db = get_db()
    coll = db.get_collection('discount_rules')
    docs = await coll.find().to_list(100)
    
    if not docs:
        # Initialize with default discount rules
        default_discounts = [
            {
                'name': 'New Customer Discount',
                'type': 'percentage',
                'value': 10,
                'minOrderAmount': 500,
                'maxDiscount': 100,
                'enabled': True,
                'createdAt': datetime.utcnow().isoformat()
            },
            {
                'name': 'Flat ₹50 Off',
                'type': 'fixed',
                'value': 50,
                'minOrderAmount': 300,
                'maxDiscount': 50,
                'enabled': True,
                'createdAt': datetime.utcnow().isoformat()
            },
            {
                'name': 'Large Order Discount',
                'type': 'percentage',
                'value': 15,
                'minOrderAmount': 2000,
                'maxDiscount': 500,
                'enabled': True,
                'createdAt': datetime.utcnow().isoformat()
            }
        ]
        res = await coll.insert_many(default_discounts)
        docs = await coll.find().to_list(100)
    
    return serialize_doc(docs)


@router.get('/discounts/{discount_id}', tags=['discounts'])
async def get_discount_rule(discount_id: str):
    """Get a specific discount rule by ID"""
    db = get_db()
    coll = db.get_collection('discount_rules')
    doc = await coll.find_one({'_id': to_object_id(discount_id)})
    if not doc:
        raise HTTPException(status_code=404, detail='Discount rule not found')
    return serialize_doc(doc)


@router.post('/discounts', tags=['discounts'])
async def create_discount_rule(discount: DiscountRuleIn, request: Request):
    """Create a new discount rule"""
    db = get_db()
    coll = db.get_collection('discount_rules')
    
    doc = {
        'name': discount.name,
        'type': discount.type.value,
        'value': discount.value,
        'minOrderAmount': discount.minOrderAmount,
        'maxDiscount': discount.maxDiscount,
        'enabled': discount.enabled,
        'createdAt': datetime.utcnow().isoformat()
    }
    
    res = await coll.insert_one(doc)
    
    await log_audit(
        action='create_discount_rule',
        resource='discount_rule',
        resourceId=str(res.inserted_id),
        userId=request.headers.get('x-user-id'),
        userName=request.headers.get('x-user-name'),
        details={'name': discount.name, 'type': discount.type.value, 'value': discount.value},
        ip=request.client.host if request.client else None
    )
    
    return serialize_doc(await coll.find_one({'_id': res.inserted_id}))


@router.put('/discounts/{discount_id}', tags=['discounts'])
async def update_discount_rule(discount_id: str, discount: DiscountRuleUpdate, request: Request):
    """Update a discount rule"""
    db = get_db()
    coll = db.get_collection('discount_rules')
    
    existing = await coll.find_one({'_id': to_object_id(discount_id)})
    if not existing:
        raise HTTPException(status_code=404, detail='Discount rule not found')
    
    update_data = {}
    if discount.name is not None:
        update_data['name'] = discount.name
    if discount.type is not None:
        update_data['type'] = discount.type.value
    if discount.value is not None:
        update_data['value'] = discount.value
    if discount.minOrderAmount is not None:
        update_data['minOrderAmount'] = discount.minOrderAmount
    if discount.maxDiscount is not None:
        update_data['maxDiscount'] = discount.maxDiscount
    if discount.enabled is not None:
        update_data['enabled'] = discount.enabled
    
    update_data['updatedAt'] = datetime.utcnow().isoformat()
    
    await coll.update_one({'_id': to_object_id(discount_id)}, {'$set': update_data})
    
    await log_audit(
        action='update_discount_rule',
        resource='discount_rule',
        resourceId=discount_id,
        userId=request.headers.get('x-user-id'),
        userName=request.headers.get('x-user-name'),
        details={'updated_fields': list(update_data.keys())},
        ip=request.client.host if request.client else None
    )
    
    return serialize_doc(await coll.find_one({'_id': to_object_id(discount_id)}))


@router.delete('/discounts/{discount_id}', tags=['discounts'])
async def delete_discount_rule(discount_id: str, request: Request):
    """Delete a discount rule"""
    db = get_db()
    coll = db.get_collection('discount_rules')
    
    res = await coll.delete_one({'_id': to_object_id(discount_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail='Discount rule not found')
    
    await log_audit(
        action='delete_discount_rule',
        resource='discount_rule',
        resourceId=discount_id,
        userId=request.headers.get('x-user-id'),
        userName=request.headers.get('x-user-name'),
        ip=request.client.host if request.client else None
    )
    
    return {'success': True}


@router.post('/discounts/{discount_id}/toggle', tags=['discounts'])
async def toggle_discount_rule(discount_id: str, request: Request):
    """Toggle a discount rule's enabled status"""
    db = get_db()
    coll = db.get_collection('discount_rules')
    
    existing = await coll.find_one({'_id': to_object_id(discount_id)})
    if not existing:
        raise HTTPException(status_code=404, detail='Discount rule not found')
    
    new_enabled = not existing.get('enabled', False)
    
    await coll.update_one(
        {'_id': to_object_id(discount_id)},
        {'$set': {'enabled': new_enabled, 'updatedAt': datetime.utcnow().isoformat()}}
    )
    
    await log_audit(
        action='toggle_discount_rule',
        resource='discount_rule',
        resourceId=discount_id,
        userId=request.headers.get('x-user-id'),
        userName=request.headers.get('x-user-name'),
        details={'enabled': new_enabled},
        ip=request.client.host if request.client else None
    )
    
    return serialize_doc(await coll.find_one({'_id': to_object_id(discount_id)}))


# ============ USER ACCOUNTS (Staff Management for Settings) ============
@router.get('/users', tags=['users'])
async def list_users():
    """List all user accounts (from staff collection)"""
    try:
        db = get_safe_db()
        coll = db.get_collection('staff')
        docs = await coll.find().to_list(100)
        
        # Map staff to user format
        users = []
        for doc in docs:
            # last_login (snake_case) is written by the login endpoint;
            # lastLogin (camelCase) is the legacy field used by create_user.
            raw_last_login = doc.get('last_login') or doc.get('lastLogin')
            users.append({
                '_id': str(doc.get('_id')),
                'name': doc.get('name'),
                'email': doc.get('email'),
                'role': doc.get('role', 'Staff'),
                'status': 'active' if doc.get('active', True) else 'inactive',
                'lastLogin': format_last_login(raw_last_login),
                'createdAt': doc.get('createdAt')
            })
        
        return users
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Failed to list users: {str(e)}')


@router.post('/users', tags=['users'])
async def create_user(user: UserAccountIn, request: Request):
    """Create a new user account"""
    try:
        db = get_safe_db()
        coll = db.get_collection('staff')
        
        # Check if email already exists
        existing = await coll.find_one({'email': user.email})
        if existing:
            raise HTTPException(status_code=409, detail='Email already exists')

        # Enforce only one admin account
        if user.role and user.role.lower() == 'admin':
            admin_exists = await coll.find_one({'role': 'admin'})
            if admin_exists:
                raise HTTPException(status_code=400, detail='An admin account already exists. Only one admin is allowed.')

        # Validate role
        allowed_roles = {'admin', 'manager', 'chef', 'waiter', 'cashier'}
        if user.role and user.role.lower() not in allowed_roles:
            raise HTTPException(status_code=400, detail=f'Invalid role. Allowed roles: {", ".join(sorted(allowed_roles))}')
        
        doc = {
            'name': user.name,
            'email': user.email,
            'role': user.role,
            'password_hash': hash_password(user.password),
            'active': True,
            'lastLogin': 'Never',
            'createdAt': datetime.utcnow().isoformat()
        }
        
        res = await coll.insert_one(doc)
        
        await log_audit(
            action='create_user',
            resource='user',
            resourceId=str(res.inserted_id),
            userId=request.headers.get('x-user-id'),
            userName=request.headers.get('x-user-name'),
            details={'name': user.name, 'email': user.email, 'role': user.role},
            ip=request.client.host if request.client else None
        )
        
        created = await coll.find_one({'_id': res.inserted_id})
        return {
            '_id': str(created.get('_id')),
            'name': created.get('name'),
            'email': created.get('email'),
            'role': created.get('role'),
            'status': 'active',
            'lastLogin': 'Never',
            'createdAt': created.get('createdAt')
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Failed to create user: {str(e)}')


@router.put('/users/{user_id}', tags=['users'])
async def update_user(user_id: str, user: UserAccountUpdate, request: Request):
    """Update a user account"""
    try:
        db = get_safe_db()
        coll = db.get_collection('staff')
        
        existing = await coll.find_one({'_id': to_object_id(user_id)})
        if not existing:
            raise HTTPException(status_code=404, detail='User not found')
        
        update_data = {}
        if user.name is not None:
            update_data['name'] = user.name
        if user.email is not None:
            update_data['email'] = user.email
        if user.role is not None:
            update_data['role'] = user.role
        if user.status is not None:
            update_data['active'] = user.status == 'active'
        if user.password is not None:
            update_data['password_hash'] = hash_password(user.password)
        
        update_data['updatedAt'] = datetime.utcnow().isoformat()
        
        await coll.update_one({'_id': to_object_id(user_id)}, {'$set': update_data})
        
        await log_audit(
            action='update_user',
            resource='user',
            resourceId=user_id,
            userId=request.headers.get('x-user-id'),
            userName=request.headers.get('x-user-name'),
            details={'updated_fields': list(update_data.keys())},
            ip=request.client.host if request.client else None
        )
        
        updated = await coll.find_one({'_id': to_object_id(user_id)})
        raw_ll = updated.get('last_login') or updated.get('lastLogin')
        return {
            '_id': str(updated.get('_id')),
            'name': updated.get('name'),
            'email': updated.get('email'),
            'role': updated.get('role'),
            'status': 'active' if updated.get('active', True) else 'inactive',
            'lastLogin': format_last_login(raw_ll),
            'createdAt': updated.get('createdAt')
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Failed to update user: {str(e)}')


@router.delete('/users/{user_id}', tags=['users'])
async def delete_user(user_id: str, request: Request):
    """Delete a user account"""
    try:
        db = get_safe_db()
        coll = db.get_collection('staff')
        
        # Check if trying to delete admin
        existing = await coll.find_one({'_id': to_object_id(user_id)})
        if existing and existing.get('role', '').lower() == 'admin':
            raise HTTPException(status_code=400, detail='Cannot delete admin user')
        
        res = await coll.delete_one({'_id': to_object_id(user_id)})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail='User not found')
        
        await log_audit(
            action='delete_user',
            resource='user',
            resourceId=user_id,
            userId=request.headers.get('x-user-id'),
            userName=request.headers.get('x-user-name'),
            ip=request.client.host if request.client else None
        )
        
        return {'success': True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Failed to delete user: {str(e)}')


@router.post('/users/{user_id}/toggle-status', tags=['users'])
async def toggle_user_status(user_id: str, request: Request):
    """Toggle a user's active status"""
    try:
        db = get_safe_db()
        coll = db.get_collection('staff')
        
        existing = await coll.find_one({'_id': to_object_id(user_id)})
        if not existing:
            raise HTTPException(status_code=404, detail='User not found')
        
        new_status = not existing.get('active', True)
        
        await coll.update_one(
            {'_id': to_object_id(user_id)},
            {'$set': {'active': new_status, 'updatedAt': datetime.utcnow().isoformat()}}
        )
        
        await log_audit(
            action='toggle_user_status',
            resource='user',
            resourceId=user_id,
            userId=request.headers.get('x-user-id'),
            userName=request.headers.get('x-user-name'),
            details={'active': new_status},
            ip=request.client.host if request.client else None
        )
        
        updated = await coll.find_one({'_id': to_object_id(user_id)})
        raw_ll = updated.get('last_login') or updated.get('lastLogin')
        return {
            '_id': str(updated.get('_id')),
            'name': updated.get('name'),
            'email': updated.get('email'),
            'role': updated.get('role'),
            'status': 'active' if updated.get('active', True) else 'inactive',
            'lastLogin': format_last_login(raw_ll),
            'createdAt': updated.get('createdAt')
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Failed to toggle user status: {str(e)}')
