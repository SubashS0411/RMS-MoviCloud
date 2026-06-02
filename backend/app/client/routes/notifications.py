"""Client Notifications routes – FastAPI + Motor (async MongoDB).
Migrated from SQLite Notification model to MongoDB 'client_notifications' collection.
"""
from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, HTTPException, Query

from ...db import get_db
from ..schemas import MarkReadRequest

router = APIRouter()


def _serialize_notification(doc: dict) -> dict:
    return {
        "id": doc.get("id"),
        "type": doc.get("type"),
        "title": doc.get("title"),
        "message": doc.get("message"),
        "referenceId": doc.get("referenceId"),
        "createdAt": doc.get("createdAt"),
        "isRead": bool(doc.get("isRead", False)),
    }


@router.get("/notifications")
async def list_notifications(userId: Optional[str] = Query(None)):
    db = get_db()
    coll = db.get_collection("client_notifications")
    if userId:
        query = {"$or": [{"userId": userId}, {"userId": None}]}
    else:
        query = {}
    cursor = coll.find(query).sort([("createdAt", -1)])
    rows = await cursor.to_list(length=500)
    return {"notifications": [_serialize_notification(n) for n in rows]}


@router.post("/notifications/mark-read")
async def mark_read(body: MarkReadRequest):
    db = get_db()
    coll = db.get_collection("client_notifications")
    result = await coll.update_one({"id": body.id}, {"$set": {"isRead": True}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="not_found")
    return {"ok": True}


@router.post("/notifications/mark-all-read")
async def mark_all_read(userId: Optional[str] = Query(None)):
    db = get_db()
    coll = db.get_collection("client_notifications")
    if userId:
        query = {"$or": [{"userId": userId}, {"userId": None}]}
    else:
        query = {}
    await coll.update_many(query, {"$set": {"isRead": True}})
    return {"ok": True}
