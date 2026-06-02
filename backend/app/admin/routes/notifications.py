"""
Notification Management Routes
- Admin Inbox Style Notifications
- Notification Settings
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from datetime import datetime
from bson import ObjectId
from ...db import get_db
from ...audit import log_audit

router = APIRouter(tags=["Notifications"])


# ==========================================================
# Utility
# ==========================================================

def serialize_doc(doc):
    if not doc:
        return None

    return {
        "_id": str(doc["_id"]),
        "type": doc.get("type"),
        "title": doc.get("title"),
        "message": doc.get("message"),
        "recipient": doc.get("recipient", "Admin"),
        "channel": doc.get("channel", "system"),
        "status": doc.get("status", "unread"),
        "created_at": doc.get("created_at").isoformat() if doc.get("created_at") else None,
        "orderId": doc.get("orderId"),
        "paymentId": doc.get("paymentId"),
        "expiresAt": doc.get("expiresAt").isoformat() if doc.get("expiresAt") else None,
    }
# ==========================================================
# NOTIFICATIONS (Inbox Style)
# ==========================================================

@router.get("")
async def list_notifications(
    type: Optional[str] = None,
    status: Optional[str] = None,
    channel: Optional[str] = None,
    limit: int = Query(200, le=500),
    skip: int = 0,
):
    db = get_db()
    query = {}

    if type and type != "all":
        query["type"] = type
    if status and status != "all":
        query["status"] = status
    if channel and channel != "all":
        query["channel"] = channel

    notifications = (
        await db.notifications.find(query)
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
        .to_list(length=limit)
    )

    total = await db.notifications.count_documents(query)

    return {
        "data": [serialize_doc(n) for n in notifications],
        "total": total,
    }


@router.get("/stats")
async def get_notification_stats():
    db = get_db()

    total = await db.notifications.count_documents({})
    unread = await db.notifications.count_documents({"status": "unread"})
    read = await db.notifications.count_documents({"status": "read"})

    return {
        "total": total,
        "unread": unread,
        "read": read,
    }


@router.get("/{notification_id}")
async def get_notification(notification_id: str):
    db = get_db()

    try:
        notification = await db.notifications.find_one(
            {"_id": ObjectId(notification_id)}
        )
    except:
        raise HTTPException(status_code=400, detail="Invalid ID")

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    return serialize_doc(notification)


@router.post("")
async def create_notification(data: dict):
    db = get_db()

    notification = {
        "type": data.get("type"),
        "title": data.get("title"),
        "message": data.get("message"),
        "recipient": data.get("recipient", "Admin"),
        "channel": data.get("channel", "system"),
        "status": "unread",
        "created_at": datetime.utcnow(),
    }

    result = await db.notifications.insert_one(notification)
    created = await db.notifications.find_one(
        {"_id": result.inserted_id}
    )

    return serialize_doc(created)


@router.post("/send")
async def send_notification(notification_id: Optional[str] = None, data: Optional[dict] = None):
    """Send a notification (simulated)"""
    db = get_db()

    # If notification_id is provided, mark existing notification as sent
    if notification_id:
        notification = await db.notifications.find_one({"_id": ObjectId(notification_id)})
        if not notification:
            raise HTTPException(status_code=404, detail="Notification not found")

        await db.notifications.update_one(
            {"_id": ObjectId(notification_id)},
            {"$set": {
                "status": "sent",
                "sentAt": datetime.utcnow()
            }}
        )

        await log_audit("send", "notification", notification_id, {
            "type": notification.get("type"),
            "channel": notification.get("channel")
        })

        updated = await db.notifications.find_one({"_id": ObjectId(notification_id)})
        return serialize_doc(updated)

    # Otherwise create and send new notification
    if not data:
        data = {}

    data["timestamp"] = datetime.utcnow()
    data["status"] = "sent"
    data["sentAt"] = datetime.utcnow()

    result = await db.notifications.insert_one(data)
    created = await db.notifications.find_one({"_id": result.inserted_id})

    await log_audit("send", "notification", str(result.inserted_id), {
        "type": data.get("type"),
        "channel": data.get("channel"),
    })

    return serialize_doc(created)


@router.post("/{notification_id}/retry")
async def retry_notification(notification_id: str):
    """Retry a failed notification"""
    db = get_db()

    notification = await db.notifications.find_one({"_id": ObjectId(notification_id)})
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    # Simulate retry
    await db.notifications.update_one(
        {"_id": ObjectId(notification_id)},
        {"$set": {
            "status": "sent",
            "retriedAt": datetime.utcnow(),
            "retryCount": notification.get("retryCount", 0) + 1
        }}
    )

    updated = await db.notifications.find_one({"_id": ObjectId(notification_id)})
    return serialize_doc(updated)


@router.delete("/{notification_id}")
async def delete_notification(notification_id: str):
    db = get_db()

    try:
        result = await db.notifications.delete_one(
            {"_id": ObjectId(notification_id)}
        )
    except:
        raise HTTPException(status_code=400, detail="Invalid ID")

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")

    return {"success": True}


# ==========================================================
# MARK AS READ
# ==========================================================

@router.patch("/{notification_id}/read")
async def mark_as_read(notification_id: str):
    db = get_db()

    await db.notifications.update_one(
        {"_id": ObjectId(notification_id)},
        {"$set": {"status": "read"}}
    )

    return {"success": True}


@router.patch("/mark-all-read")
async def mark_all_read():
    db = get_db()

    await db.notifications.update_many(
        {"status": "unread"},
        {"$set": {"status": "read"}}
    )

    return {"success": True}


# ==========================================================
# BROADCAST
# ==========================================================

@router.post("/broadcast")
async def send_broadcast(data: dict):
    db = get_db()

    # Accept both recipientIds (frontend) and recipients for compatibility
    recipients = data.get("recipientIds", data.get("recipients", []))
    message = data.get("message", "")
    title = data.get("title", "")

    notifications = []

    for recipient in recipients:
        notifications.append(
            {
                "type": "broadcast",
                "title": title,
                "message": message,
                "recipient": recipient,
                "channel": "system",
                "status": "unread",
                "created_at": datetime.utcnow(),
            }
        )

    if notifications:
        await db.notifications.insert_many(notifications)

    await log_audit("broadcast", "notification", None, {"count": len(recipients)})

    return {"success": True, "sentCount": len(notifications)}