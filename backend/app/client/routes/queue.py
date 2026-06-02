"""Client Walk-in Queue routes – FastAPI + Motor (async MongoDB).
Migrated from SQLite QueueEntry model to MongoDB 'queue_entries' collection.
"""
from __future__ import annotations

from typing import Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException, Query

from ...db import get_db
from ..schemas import QueueJoin, QueueUpdate

router = APIRouter()


def _utc_now() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _serialize_entry(doc: dict) -> dict:
    return {
        "id": doc.get("id"),
        "name": doc.get("name"),
        "guests": doc.get("guests"),
        "notificationMethod": doc.get("notificationMethod"),
        "contact": doc.get("contact"),
        "hall": doc.get("hall"),
        "segment": doc.get("segment"),
        "position": doc.get("position"),
        "estimatedWaitMinutes": doc.get("estimatedWaitMinutes"),
        "joinedAt": doc.get("joinedAt"),
        "queueDate": doc.get("queueDate"),
        "notifiedAt5Min": bool(doc.get("notifiedAt5Min", False)),
    }


@router.get("/queue")
async def list_queue(queueDate: Optional[str] = Query(None)):
    db = get_db()
    coll = db.get_collection("queue_entries")
    query: dict = {}
    if queueDate:
        query["queueDate"] = queueDate
    cursor = coll.find(query).sort([
        ("queueDate", -1), ("hall", 1), ("segment", 1), ("position", 1)
    ])
    rows = await cursor.to_list(length=1000)
    return {"entries": [_serialize_entry(e) for e in rows]}


@router.post("/queue/join", status_code=201)
async def join_queue(body: QueueJoin):
    db = get_db()
    coll = db.get_collection("queue_entries")

    position = await _next_position(db, body.queueDate, body.guests, body.hall, body.segment)
    estimated_wait = float(position * 60)

    doc = {
        "id": body.id,
        "name": body.name,
        "guests": body.guests,
        "notificationMethod": body.notificationMethod,
        "contact": body.contact,
        "hall": body.hall,
        "segment": body.segment,
        "position": position,
        "estimatedWaitMinutes": estimated_wait,
        "joinedAt": _utc_now(),
        "queueDate": body.queueDate,
        "notifiedAt5Min": body.notifiedAt5Min,
    }

    await coll.update_one({"id": doc["id"]}, {"$set": doc}, upsert=True)
    return _serialize_entry(doc)


@router.delete("/queue/{entry_id}")
async def cancel_queue(entry_id: str):
    db = get_db()
    coll = db.get_collection("queue_entries")
    entry = await coll.find_one({"id": entry_id})
    if not entry:
        raise HTTPException(status_code=404, detail="not_found")

    queue_date = entry["queueDate"]
    guests = entry["guests"]
    hall = entry["hall"]
    segment = entry["segment"]

    await coll.delete_one({"id": entry_id})
    await _resequence(db, queue_date, guests, hall, segment)
    return {"ok": True}


@router.patch("/queue/{entry_id}")
async def update_queue_entry(entry_id: str, body: QueueUpdate):
    db = get_db()
    coll = db.get_collection("queue_entries")
    entry = await coll.find_one({"id": entry_id})
    if not entry:
        raise HTTPException(status_code=404, detail="not_found")

    updates: dict = {}
    if body.notifiedAt5Min is not None:
        updates["notifiedAt5Min"] = body.notifiedAt5Min
    if body.estimatedWaitMinutes is not None:
        updates["estimatedWaitMinutes"] = float(body.estimatedWaitMinutes)

    if updates:
        await coll.update_one({"id": entry_id}, {"$set": updates})
        entry.update(updates)

    return _serialize_entry(entry)


async def _next_position(db, queue_date: str, guests: int, hall: str, segment: str) -> int:
    coll = db.get_collection("queue_entries")
    count = await coll.count_documents({
        "queueDate": queue_date, "guests": guests, "hall": hall, "segment": segment,
    })
    return int(count) + 1


async def _resequence(db, queue_date: str, guests: int, hall: str, segment: str) -> None:
    coll = db.get_collection("queue_entries")
    cursor = coll.find({
        "queueDate": queue_date, "guests": guests, "hall": hall, "segment": segment,
    }).sort([("joinedAt", 1)])
    rows = await cursor.to_list(length=1000)

    for idx, row in enumerate(rows, start=1):
        await coll.update_one(
            {"id": row["id"]},
            {"$set": {"position": idx, "estimatedWaitMinutes": float(idx * 60)}},
        )
