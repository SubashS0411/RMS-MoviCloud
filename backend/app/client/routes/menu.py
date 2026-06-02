"""Client Menu routes – FastAPI + Motor (async MongoDB)."""
from __future__ import annotations

import re
from typing import Optional
from fastapi import APIRouter, Query

from ...db import get_db

router = APIRouter()


def _serialize_menu_item(doc: dict) -> dict:
    item_id = doc.get("id") or str(doc.get("_id", ""))
    # Derive isVeg from the admin-managed dietType field
    diet = doc.get("dietType", "")
    is_veg = (diet == "veg") if diet else bool(doc.get("isVeg"))
    return {
        "id": item_id,
        "name": doc.get("name"),
        "description": doc.get("description"),
        "price": doc.get("price"),
        "image": doc.get("image"),
        "isVeg": is_veg,
        "category": doc.get("category"),
        "available": bool(doc.get("available")),
        "popular": bool(doc.get("popular")),
        "todaysSpecial": bool(doc.get("todaysSpecial")),
        "calories": doc.get("calories"),
        "prepTime": doc.get("prepTime"),
        "offer": doc.get("offer"),
        "cuisine": doc.get("cuisine"),
    }


@router.get("/menu-items")
async def list_menu_items(
    category: Optional[str] = Query(None),
    veg: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
):
    db = get_db()
    menu = db.get_collection("menu_items")
    query: dict = {}

    if category and category != "All":
        query["category"] = category
    if veg in ("true", "false"):
        query["isVeg"] = veg == "true"
    if q:
        pattern = re.escape(q)
        query["$or"] = [
            {"name": {"$regex": pattern, "$options": "i"}},
            {"description": {"$regex": pattern, "$options": "i"}},
        ]

    cursor = menu.find(query).sort([("category", 1), ("name", 1)])
    items = await cursor.to_list(length=5000)
    return {"items": [_serialize_menu_item(i) for i in items]}


@router.get("/menu-items/{item_id}")
async def get_menu_item(item_id: str):
    from fastapi import HTTPException
    db = get_db()
    menu = db.get_collection("menu_items")
    item = await menu.find_one({"id": item_id})
    if not item:
        raise HTTPException(status_code=404, detail="not_found")
    return _serialize_menu_item(item)


@router.get("/menu/categories")
async def list_categories():
    db = get_db()
    menu = db.get_collection("menu_items")
    cats = sorted(set(await menu.distinct("category")))
    return {"categories": ["All", *[c for c in cats if c]]}
