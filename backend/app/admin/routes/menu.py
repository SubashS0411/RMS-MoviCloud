"""
Menu Management Routes
- CRUD for menu items
- Categories management
- Combo meals
"""

from fastapi import APIRouter, HTTPException
from typing import Optional
from datetime import datetime
from bson import ObjectId
from bson.errors import InvalidId

from ...db import get_db
from ...audit import log_audit
from ..schemas import MenuItemIn, MenuItemUpdate

router = APIRouter(tags=["Menu"], redirect_slashes=False)


# ================= UTIL =================

def serialize_doc(doc):
    if not doc:
        return None
    doc["_id"] = str(doc["_id"])
    doc["id"] = doc["_id"]  # Add id field for frontend compatibility
    return doc


def validate_object_id(id: str):
    try:
        return ObjectId(id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid ID format")


# ================= MENU ITEMS =================

@router.get("")
@router.get("/")
async def list_menu_items(
    category: Optional[str] = None,
    available: Optional[bool] = None,
    dietType: Optional[str] = None,
    search: Optional[str] = None,
):
    db = get_db()
    query = {}

    if category and category != "all":
        query["category"] = category

    if available is not None:
        query["available"] = available

    if dietType and dietType != "all":
        query["dietType"] = dietType

    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]

    items = await db.menu_items.find(query).sort("name", 1).to_list(5000)
    print(f"[Menu] Query: {query}")
    print(f"[Menu] Found {len(items)} menu items in database")
    return [serialize_doc(item) for item in items]


@router.get("/stats")
async def get_menu_stats():
    """Get menu statistics"""
    db = get_db()
    
    total = await db.menu_items.count_documents({})
    available = await db.menu_items.count_documents({"available": True})
    unavailable = await db.menu_items.count_documents({"available": False})
    
    # Count by category
    category_pipeline = [
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    by_category = await db.menu_items.aggregate(category_pipeline).to_list(50)
    
    # Count by diet type
    diet_pipeline = [
        {"$group": {"_id": "$dietType", "count": {"$sum": 1}}}
    ]
    by_diet = await db.menu_items.aggregate(diet_pipeline).to_list(10)
    
    # Average price
    price_pipeline = [
        {"$group": {"_id": None, "avgPrice": {"$avg": "$price"}}}
    ]
    avg_price_result = await db.menu_items.aggregate(price_pipeline).to_list(1)
    avg_price = avg_price_result[0]["avgPrice"] if avg_price_result else 0
    
    # Combos count
    combos_count = await db.combo_meals.count_documents({})
    
    return {
        "total": total,
        "available": available,
        "unavailable": unavailable,
        "byCategory": {c["_id"]: c["count"] for c in by_category if c["_id"]},
        "byDietType": {d["_id"]: d["count"] for d in by_diet if d["_id"]},
        "avgPrice": round(avg_price, 2),
        "combosCount": combos_count
    }


@router.get("/categories")
async def get_menu_categories():
    """Get all unique menu categories"""
    db = get_db()
    categories = await db.menu_items.distinct("category")
    return categories


@router.get("/combos")
async def list_combos():
    db = get_db()
    combos = await db.combo_meals.find().sort("name", 1).to_list(500)
    return [serialize_doc(combo) for combo in combos]


@router.post("/combos")
async def create_combo(data: dict):
    db = get_db()

    now = datetime.utcnow()
    data["createdAt"] = now
    data["updatedAt"] = now
    data["available"] = data.get("available", True)

    result = await db.combo_meals.insert_one(data)
    created = await db.combo_meals.find_one({"_id": result.inserted_id})

    await log_audit("create", "combo", str(result.inserted_id), {
        "name": data.get("name")
    })

    return serialize_doc(created)


@router.put("/combos/{combo_id}")
async def update_combo(combo_id: str, data: dict):
    db = get_db()
    obj_id = validate_object_id(combo_id)

    data["updatedAt"] = datetime.utcnow()
    data.pop("_id", None)

    result = await db.combo_meals.update_one(
        {"_id": obj_id},
        {"$set": data}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Combo not found")

    updated = await db.combo_meals.find_one({"_id": obj_id})
    return serialize_doc(updated)


@router.delete("/combos/{combo_id}")
async def delete_combo(combo_id: str):
    db = get_db()
    obj_id = validate_object_id(combo_id)

    result = await db.combo_meals.delete_one({"_id": obj_id})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Combo not found")

    return {"success": True}


@router.patch("/combos/{combo_id}/availability")
async def toggle_combo_availability(combo_id: str, available: bool):
    db = get_db()
    obj_id = validate_object_id(combo_id)

    result = await db.combo_meals.update_one(
        {"_id": obj_id},
        {"$set": {
            "available": available,
            "updatedAt": datetime.utcnow()
        }}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Combo not found")

    return {"success": True, "available": available}


@router.get("/{item_id}")
async def get_menu_item(item_id: str):
    db = get_db()
    obj_id = validate_object_id(item_id)

    item = await db.menu_items.find_one({"_id": obj_id})
    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")

    return serialize_doc(item)


@router.post("")
@router.post("/")
async def create_menu_item(data: MenuItemIn):
    db = get_db()

    menu_data = data.dict()
    now = datetime.utcnow()
    menu_data["createdAt"] = now
    menu_data["updatedAt"] = now

    result = await db.menu_items.insert_one(menu_data)
    created = await db.menu_items.find_one({"_id": result.inserted_id})

    await log_audit("create", "menu", str(result.inserted_id), {
        "name": menu_data.get("name")
    })

    return serialize_doc(created)


@router.put("/{item_id}")
async def update_menu_item(item_id: str, data: dict):
    db = get_db()
    obj_id = validate_object_id(item_id)

    # Strip MongoDB internal field so it can't be overwritten
    data.pop("_id", None)
    data.pop("id", None)
    data["updatedAt"] = datetime.utcnow()

    result = await db.menu_items.update_one(
        {"_id": obj_id},
        {"$set": data}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Menu item not found")

    updated = await db.menu_items.find_one({"_id": obj_id})

    await log_audit("update", "menu", item_id, {
        "name": data.get("name")
    })

    return serialize_doc(updated)


@router.delete("/{item_id}")
async def delete_menu_item(item_id: str):
    db = get_db()
    obj_id = validate_object_id(item_id)

    item = await db.menu_items.find_one({"_id": obj_id})
    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")

    await db.menu_items.delete_one({"_id": obj_id})

    await log_audit("delete", "menu", item_id, {
        "name": item.get("name")
    })

    return {"success": True}


@router.patch("/{item_id}/availability")
async def toggle_availability(item_id: str, available: Optional[bool] = None):
    db = get_db()
    obj_id = validate_object_id(item_id)

    # If available is not provided, toggle the current state
    if available is None:
        item = await db.menu_items.find_one({"_id": obj_id})
        if not item:
            raise HTTPException(status_code=404, detail="Menu item not found")
        available = not item.get("available", True)

    result = await db.menu_items.update_one(
        {"_id": obj_id},
        {"$set": {
            "available": available,
            "updatedAt": datetime.utcnow()
        }}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Menu item not found")

    return {"success": True, "available": available}


@router.post("/combos/auto-link-items")
async def auto_link_combo_items():
    """
    Auto-links combos to menu items by matching item names found in
    combo descriptions/names against the menu_items collection.
    """
    import re

    db = get_db()
    combos = await db.combo_meals.find().to_list(500)
    menu_items = await db.menu_items.find({}, {"_id": 1, "name": 1}).to_list(1000)

    def normalize(text: str) -> str:
        return re.sub(r'[^a-z0-9 ]', '', text.lower()).strip()

    def tokenize(text: str):
        return set(normalize(text).split())

    # Build sorted list of menu items by name length (longer names first for better matching)
    menu_items_sorted = sorted(menu_items, key=lambda x: len(x.get("name", "")), reverse=True)

    results = {"updated": 0, "skipped": 0, "details": []}

    for combo in combos:
        combo_id = combo["_id"]
        combo_name = combo.get("name", "")
        combo_desc = combo.get("description", "")
        search_text = normalize(combo_name + " " + combo_desc)
        search_tokens = set(search_text.split())

        matched_ids = []

        for item in menu_items_sorted:
            item_name = item.get("name", "")
            item_name_norm = normalize(item_name)
            item_tokens = tokenize(item_name)

            # Skip very short or generic words
            if len(item_name_norm) < 4:
                continue

            # Check if the full item name appears as a substring in the search text
            if item_name_norm in search_text:
                matched_ids.append(str(item["_id"]))
                continue

            # Multi-word items: check if all significant tokens appear in search_text
            significant_tokens = {t for t in item_tokens if len(t) >= 4}
            if len(significant_tokens) >= 2 and significant_tokens.issubset(search_tokens):
                matched_ids.append(str(item["_id"]))

        if matched_ids:
            await db.combo_meals.update_one(
                {"_id": combo_id},
                {"$set": {"items": matched_ids, "updatedAt": datetime.utcnow()}}
            )
            results["updated"] += 1
            results["details"].append({
                "combo": combo_name,
                "matched_items": len(matched_ids),
                "item_ids": matched_ids
            })
        else:
            results["skipped"] += 1

    return results
