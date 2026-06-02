"""Client Chat routes – FastAPI + Motor (async MongoDB).
Migrated from SQLite MenuItem queries to MongoDB 'menu_items' collection.
"""
from __future__ import annotations

from fastapi import APIRouter

from ...db import get_db
from ..schemas import ChatMessage

router = APIRouter()


@router.post("/chat")
async def chat(body: ChatMessage):
    message = body.message.strip().lower()
    if not message:
        return {"reply": "Please type a message."}

    db = get_db()
    menu = db.get_collection("menu_items")

    if "special" in message:
        cursor = menu.find({"todaysSpecial": True}).limit(6)
        specials = await cursor.to_list(length=6)
        return {
            "reply": "Here are today's specials.",
            "items": [
                {
                    "id": i.get("id"),
                    "name": i.get("name"),
                    "price": i.get("price"),
                    "image": i.get("image"),
                    "category": i.get("category"),
                    "isVeg": bool(i.get("isVeg")),
                }
                for i in specials
            ],
        }

    if "popular" in message:
        cursor = menu.find({"popular": True}).limit(6)
        popular = await cursor.to_list(length=6)
        return {
            "reply": "Here are some popular items.",
            "items": [
                {
                    "id": i.get("id"),
                    "name": i.get("name"),
                    "price": i.get("price"),
                    "image": i.get("image"),
                    "category": i.get("category"),
                    "isVeg": bool(i.get("isVeg")),
                }
                for i in popular
            ],
        }

    return {"reply": "I can help with menu, specials, and popular items. Try 'today specials'."}
