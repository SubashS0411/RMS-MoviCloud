"""
Catalog Management Routes
- Cuisines
- Categories
- Addons (toppings, sides, etc.)
"""

from fastapi import APIRouter, HTTPException
from typing import Optional
from datetime import datetime
from bson import ObjectId
from bson.errors import InvalidId

from ...db import get_db
from ...audit import log_audit
from ..schemas import CuisineIn, CuisineOut, CategoryIn, CategoryOut, AddonIn, AddonOut

router = APIRouter(tags=["Catalog"])


def serialize_doc(doc):
    if not doc:
        return None
    doc["_id"] = str(doc["_id"])
    doc["id"] = doc["_id"]
    return doc


def validate_object_id(id: str):
    try:
        return ObjectId(id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid ID format")


# ================= CUISINES =================

@router.get("/cuisines")
async def list_cuisines():
    """Get all cuisines"""
    db = get_db()
    cuisines = await db.cuisines.find().sort("name", 1).to_list(100)
    return [serialize_doc(c) for c in cuisines]


@router.post("/cuisines")
async def create_cuisine(data: CuisineIn):
    """Create a new cuisine"""
    db = get_db()
    
    # Check if already exists
    existing = await db.cuisines.find_one({"name": data.name})
    if existing:
        raise HTTPException(status_code=400, detail="Cuisine already exists")
    
    now = datetime.utcnow()
    cuisine_data = {
        "name": data.name,
        "description": data.description or "",
        "createdAt": now,
        "updatedAt": now
    }
    
    result = await db.cuisines.insert_one(cuisine_data)
    created = await db.cuisines.find_one({"_id": result.inserted_id})
    
    await log_audit("create", "cuisine", str(result.inserted_id), {
        "name": data.name
    })
    
    return serialize_doc(created)


@router.put("/cuisines/{cuisine_id}")
async def update_cuisine(cuisine_id: str, data: CuisineIn):
    """Update a cuisine"""
    db = get_db()
    obj_id = validate_object_id(cuisine_id)
    
    update_data = {"name": data.name, "description": data.description or "", "updatedAt": datetime.utcnow()}
    
    result = await db.cuisines.update_one(
        {"_id": obj_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Cuisine not found")
    
    updated = await db.cuisines.find_one({"_id": obj_id})
    
    await log_audit("update", "cuisine", cuisine_id, {"name": data.name})
    
    return serialize_doc(updated)


@router.delete("/cuisines/{cuisine_id}")
async def delete_cuisine(cuisine_id: str):
    """Delete a cuisine"""
    db = get_db()
    obj_id = validate_object_id(cuisine_id)
    
    result = await db.cuisines.delete_one({"_id": obj_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cuisine not found")
    
    await log_audit("delete", "cuisine", cuisine_id, {})
    
    return {"message": "Cuisine deleted"}


# ================= CATEGORIES =================

@router.get("/categories")
async def list_categories():
    """Get all categories"""
    db = get_db()
    categories = await db.categories.find().sort("name", 1).to_list(100)
    return [serialize_doc(c) for c in categories]


@router.post("/categories")
async def create_category(data: CategoryIn):
    """Create a new category"""
    db = get_db()
    
    # Normalize the name
    normalized_name = data.name.lower().replace(" ", "-")
    
    # Check if already exists
    existing = await db.categories.find_one({"name": normalized_name})
    if existing:
        raise HTTPException(status_code=400, detail="Category already exists")
    
    now = datetime.utcnow()
    category_data = {
        "name": normalized_name,
        "displayName": data.displayName or data.name,
        "description": data.description or "",
        "createdAt": now,
        "updatedAt": now
    }
    
    result = await db.categories.insert_one(category_data)
    created = await db.categories.find_one({"_id": result.inserted_id})
    
    await log_audit("create", "category", str(result.inserted_id), {
        "name": normalized_name
    })
    
    return serialize_doc(created)


@router.put("/categories/{category_id}")
async def update_category(category_id: str, data: CategoryIn):
    """Update a category"""
    db = get_db()
    obj_id = validate_object_id(category_id)
    
    normalized_name = data.name.lower().replace(" ", "-")
    
    update_data = {
        "name": normalized_name,
        "displayName": data.displayName or data.name,
        "description": data.description or "",
        "updatedAt": datetime.utcnow()
    }
    
    result = await db.categories.update_one(
        {"_id": obj_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    
    updated = await db.categories.find_one({"_id": obj_id})
    
    await log_audit("update", "category", category_id, {"name": normalized_name})
    
    return serialize_doc(updated)


@router.delete("/categories/{category_id}")
async def delete_category(category_id: str):
    """Delete a category"""
    db = get_db()
    obj_id = validate_object_id(category_id)
    
    result = await db.categories.delete_one({"_id": obj_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    
    await log_audit("delete", "category", category_id, {})
    
    return {"message": "Category deleted"}


# ================= ADDONS =================

@router.get("/addons")
async def list_addons():
    """Get all addons"""
    db = get_db()
    addons = await db.addons.find().sort("name", 1).to_list(100)
    return [serialize_doc(a) for a in addons]


@router.post("/addons")
async def create_addon(data: AddonIn):
    """Create a new addon"""
    db = get_db()
    
    # Check if already exists
    existing = await db.addons.find_one({"name": data.name})
    if existing:
        raise HTTPException(status_code=400, detail="Addon already exists")
    
    now = datetime.utcnow()
    addon_data = {
        "name": data.name,
        "description": data.description or "",
        "price": data.price or 0,
        "createdAt": now,
        "updatedAt": now
    }
    
    result = await db.addons.insert_one(addon_data)
    created = await db.addons.find_one({"_id": result.inserted_id})
    
    await log_audit("create", "addon", str(result.inserted_id), {
        "name": data.name
    })
    
    return serialize_doc(created)


@router.put("/addons/{addon_id}")
async def update_addon(addon_id: str, data: AddonIn):
    """Update an addon"""
    db = get_db()
    obj_id = validate_object_id(addon_id)
    
    update_data = {
        "name": data.name,
        "description": data.description or "",
        "price": data.price or 0,
        "updatedAt": datetime.utcnow()
    }
    
    result = await db.addons.update_one(
        {"_id": obj_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Addon not found")
    
    updated = await db.addons.find_one({"_id": obj_id})
    
    await log_audit("update", "addon", addon_id, {"name": data.name})
    
    return serialize_doc(updated)


@router.delete("/addons/{addon_id}")
async def delete_addon(addon_id: str):
    """Delete an addon"""
    db = get_db()
    obj_id = validate_object_id(addon_id)
    
    result = await db.addons.delete_one({"_id": obj_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Addon not found")
    
    await log_audit("delete", "addon", addon_id, {})
    
    return {"message": "Addon deleted"}
