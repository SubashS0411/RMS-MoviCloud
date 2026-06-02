"""Client Offers routes – FastAPI + Motor (async MongoDB).
Migrated from SQLite Offer model to MongoDB 'client_offers' collection.
"""
from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Query

from ...db import get_db

router = APIRouter()


def _serialize_offer(doc: dict) -> dict:
    return {
        "id": doc.get("id"),
        "title": doc.get("title"),
        "type": doc.get("type"),
        "value": doc.get("value"),
        "minOrderValue": doc.get("minOrderValue"),
        "requiresLoyalty": bool(doc.get("requiresLoyalty", False)),
    }


@router.get("/offers")
async def list_offers():
    db = get_db()
    coll = db.get_collection("client_offers")
    cursor = coll.find().sort([("id", 1)])
    rows = await cursor.to_list(length=100)
    return {"offers": [_serialize_offer(o) for o in rows]}


@router.get("/offers/eligible")
async def eligible_offers(
    subtotal: float = Query(0),
    loyaltyPoints: int = Query(0),
):
    order_value = max(0.0, subtotal)
    points = max(0, loyaltyPoints)

    db = get_db()
    coll = db.get_collection("client_offers")
    all_offers = await coll.find().sort([("id", 1)]).to_list(length=100)

    result = []
    for offer in all_offers:
        min_val = offer.get("minOrderValue", 0) or 0
        if order_value < min_val:
            continue
        if offer.get("requiresLoyalty") and points <= 0:
            continue
        result.append(_serialize_offer(offer))

    return {"offers": result}
