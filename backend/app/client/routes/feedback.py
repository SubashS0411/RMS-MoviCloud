"""Client Feedback routes – FastAPI + Motor (async MongoDB)."""
from __future__ import annotations

import uuid
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException, Query

from ...db import get_db
from ..schemas import FeedbackCreate

router = APIRouter()


def _utc_now() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _serialize_feedback(doc: dict) -> dict:
    return {
        "id": doc.get("id"),
        "userId": doc.get("userId"),
        "orderId": doc.get("orderId"),
        "foodRatings": doc.get("foodRatings", {}),
        "likedAspects": doc.get("likedAspects", []),
        "comment": doc.get("comment"),
        "createdAt": doc.get("createdAt"),
    }


@router.post("/feedback", status_code=201)
async def create_feedback(body: FeedbackCreate):
    db = get_db()
    feedback = db.get_collection("feedback")

    doc = {
        "id": body.id or f"fb-{uuid.uuid4().hex}",
        "userId": body.userId,
        "orderId": body.orderId,
        "foodRatings": body.foodRatings,
        "likedAspects": body.likedAspects,
        "comment": body.comment,
        "createdAt": _utc_now(),
    }

    await feedback.update_one({"id": doc["id"]}, {"$set": doc}, upsert=True)
    return {"feedback": _serialize_feedback(doc)}


@router.get("/feedback")
async def list_feedback(userId: Optional[str] = Query(None)):
    db = get_db()
    feedback = db.get_collection("feedback")
    query = {"userId": userId} if userId else {}
    cursor = feedback.find(query).sort([("createdAt", -1)])
    rows = await cursor.to_list(length=500)
    return {"items": [_serialize_feedback(r) for r in rows]}
