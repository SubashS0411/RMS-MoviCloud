import asyncio
from datetime import datetime
import traceback
from .db import get_db


async def log_audit(
    action: str,
    resource: str = None,
    resourceId: str = None,
    userId: str = None,
    userName: str = None,
    details: dict = None,
    ip: str = None,
    device: str = None,
    status: str = 'success'
):
    """
    Log an audit entry to the database.
    
    Args:
        action: The action performed (e.g., 'create_staff', 'update_setting')
        resource: The resource type affected (e.g., 'staff', 'setting')
        resourceId: The ID of the affected resource
        userId: The ID of the user who performed the action
        userName: The name/email of the user
        details: Additional details about the action
        ip: The IP address of the client
        device: The device/browser info
        status: The status of the action ('success', 'failed', 'warning')
    """
    try:
        db = get_db()
        coll = db.get_collection('audit_logs')
        doc = {
            'action': action,
            'resource': resource,
            'resourceId': resourceId,
            'userId': userId,
            'userName': userName,
            'details': details,
            'ip': ip,
            'device': device,
            'status': status,
            'createdAt': datetime.utcnow().isoformat()
        }
        await coll.insert_one(doc)
    except Exception as e:
        # Log to console but don't crash the main operation
        print(f"Audit logging failed: {e}")
        traceback.print_exc()
