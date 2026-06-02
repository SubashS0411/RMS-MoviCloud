"""
Inventory Management Routes
- Ingredients CRUD
- Stock management
- Suppliers
- Purchase records
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from datetime import datetime
from bson import ObjectId
from ...db import get_db
from ...audit import log_audit

router = APIRouter(tags=["Inventory"])


def serialize_doc(doc):
    """Convert MongoDB document to JSON-serializable dict"""
    if doc is None:
        return None
    doc["_id"] = str(doc["_id"])
    return doc


def calculate_status(stock_level: float, min_threshold: float) -> str:
    """Calculate ingredient status based on stock level"""
    if stock_level <= 0:
        return "Out"
    elif stock_level <= min_threshold * 0.5:
        return "Critical"
    elif stock_level <= min_threshold:
        return "Low"
    return "Healthy"


# ============ INGREDIENTS ============

@router.get("")
async def list_ingredients(
    category: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
):
    """Get all ingredients"""
    db = get_db()
    query = {}
    
    if category and category != "all":
        query["category"] = category
    if status and status != "all":
        query["status"] = status
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    
    ingredients = await db.ingredients.find(query).sort("name", 1).to_list(500)
    total = await db.ingredients.count_documents(query)
    
    return {"data": [serialize_doc(ing) for ing in ingredients], "total": total}


@router.get("/stats")
async def get_inventory_stats():
    """Get inventory statistics"""
    db = get_db()
    
    total = await db.ingredients.count_documents({})
    low_stock = await db.ingredients.count_documents({"status": {"$in": ["Low", "Critical"]}})
    out_of_stock = await db.ingredients.count_documents({"status": "Out"})
    
    # Total value
    value_pipeline = [
        {"$project": {"value": {"$multiply": ["$stockLevel", "$costPerUnit"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$value"}}}
    ]
    value_result = await db.ingredients.aggregate(value_pipeline).to_list(1)
    total_value = value_result[0]["total"] if value_result else 0
    
    # Categories
    categories = await db.ingredients.distinct("category")
    
    return {
        "total": total,
        "lowStock": low_stock,
        "outOfStock": out_of_stock,
        "totalValue": round(total_value, 2),
        "categories": categories,
    }


@router.get("/categories")
async def get_categories():
    """Get all ingredient categories"""
    db = get_db()
    categories = await db.ingredients.distinct("category")
    return categories


@router.get("/low-stock")
async def get_low_stock():
    """Get low stock alerts"""
    db = get_db()
    
    ingredients = await db.ingredients.find({
        "status": {"$in": ["Low", "Critical", "Out"]}
    }).sort("stockLevel", 1).to_list(100)
    
    return [serialize_doc(ing) for ing in ingredients]


@router.get("/{ingredient_id}")
async def get_ingredient(ingredient_id: str):
    """Get single ingredient"""
    db = get_db()
    ingredient = await db.ingredients.find_one({"_id": ObjectId(ingredient_id)})
    if not ingredient:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    return serialize_doc(ingredient)


@router.post("")
async def create_ingredient(data: dict):
    """Create new ingredient"""
    db = get_db()
    
    data["createdAt"] = datetime.utcnow()
    data["status"] = calculate_status(
        data.get("stockLevel", 0),
        data.get("minThreshold", 10)
    )
    
    result = await db.ingredients.insert_one(data)
    created = await db.ingredients.find_one({"_id": result.inserted_id})
    
    await log_audit("create", "ingredient", str(result.inserted_id), {"name": data.get("name")})
    
    return serialize_doc(created)


@router.put("/{ingredient_id}")
async def update_ingredient(ingredient_id: str, data: dict):
    """Update ingredient"""
    db = get_db()
    
    data["updatedAt"] = datetime.utcnow()
    data.pop("_id", None)
    
    # Recalculate status if stock level changed
    if "stockLevel" in data or "minThreshold" in data:
        current = await db.ingredients.find_one({"_id": ObjectId(ingredient_id)})
        if current:
            stock = data.get("stockLevel", current.get("stockLevel", 0))
            threshold = data.get("minThreshold", current.get("minThreshold", 10))
            data["status"] = calculate_status(stock, threshold)
    
    result = await db.ingredients.update_one(
        {"_id": ObjectId(ingredient_id)},
        {"$set": data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    
    updated = await db.ingredients.find_one({"_id": ObjectId(ingredient_id)})
    await log_audit("update", "ingredient", ingredient_id)
    
    return serialize_doc(updated)


@router.patch("/{ingredient_id}/stock")
async def update_stock(ingredient_id: str, quantity: float, operation: str = "add", type: Optional[str] = None):
    """Add or deduct stock"""
    db = get_db()
    
    # Support both 'type' and 'operation' parameters for frontend compatibility
    # Frontend uses 'type' (add/deduct), backend uses 'operation' (add/deduct/set)
    actual_operation = type if type else operation
    
    ingredient = await db.ingredients.find_one({"_id": ObjectId(ingredient_id)})
    if not ingredient:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    
    current_stock = ingredient.get("stockLevel", 0)
    
    if actual_operation == "add":
        new_stock = current_stock + quantity
    elif actual_operation == "deduct":
        new_stock = max(0, current_stock - quantity)
    else:
        new_stock = quantity  # Set exact value
    
    status = calculate_status(new_stock, ingredient.get("minThreshold", 10))
    
    await db.ingredients.update_one(
        {"_id": ObjectId(ingredient_id)},
        {"$set": {
            "stockLevel": new_stock,
            "status": status,
            "lastDeduction": datetime.utcnow() if actual_operation == "deduct" else None,
            "updatedAt": datetime.utcnow()
        }}
    )
    
    await log_audit("stock_update", "ingredient", ingredient_id, {
        "operation": actual_operation,
        "quantity": quantity,
        "newStock": new_stock
    })
    
    return {"success": True, "stockLevel": new_stock, "status": status}


@router.delete("/{ingredient_id}")
async def delete_ingredient(ingredient_id: str):
    """Delete ingredient"""
    db = get_db()
    
    result = await db.ingredients.delete_one({"_id": ObjectId(ingredient_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    
    await log_audit("delete", "ingredient", ingredient_id)
    
    return {"success": True}


# ============ SUPPLIERS ============

@router.get("/suppliers/all")
async def list_suppliers(status: Optional[str] = None):
    """Get all suppliers"""
    db = get_db()
    query = {}
    
    if status and status != "all":
        query["status"] = status
    
    suppliers = await db.suppliers.find(query).sort("name", 1).to_list(100)
    return [serialize_doc(sup) for sup in suppliers]


@router.post("/suppliers")
async def create_supplier(data: dict):
    """Create supplier"""
    db = get_db()
    
    data["createdAt"] = datetime.utcnow()
    data["status"] = data.get("status", "Active")
    
    result = await db.suppliers.insert_one(data)
    created = await db.suppliers.find_one({"_id": result.inserted_id})
    
    await log_audit("create", "supplier", str(result.inserted_id))
    
    return serialize_doc(created)


@router.put("/suppliers/{supplier_id}")
async def update_supplier(supplier_id: str, data: dict):
    """Update supplier"""
    db = get_db()
    
    data["updatedAt"] = datetime.utcnow()
    data.pop("_id", None)
    
    result = await db.suppliers.update_one(
        {"_id": ObjectId(supplier_id)},
        {"$set": data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    updated = await db.suppliers.find_one({"_id": ObjectId(supplier_id)})
    return serialize_doc(updated)


@router.delete("/suppliers/{supplier_id}")
async def delete_supplier(supplier_id: str):
    """Delete supplier"""
    db = get_db()
    
    result = await db.suppliers.delete_one({"_id": ObjectId(supplier_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    return {"success": True}


# ============ PURCHASE RECORDS ============

@router.get("/purchases/all")
async def list_purchases(
    supplier_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
):
    """Get purchase records"""
    db = get_db()
    query = {}
    
    if supplier_id:
        query["supplierId"] = supplier_id
    if date_from:
        query["date"] = {"$gte": date_from}
    if date_to:
        if "date" in query:
            query["date"]["$lte"] = date_to
        else:
            query["date"] = {"$lte": date_to}
    
    purchases = await db.purchases.find(query).sort("date", -1).to_list(200)
    return [serialize_doc(p) for p in purchases]


@router.post("/purchases")
async def create_purchase(data: dict):
    """Record a purchase"""
    db = get_db()
    
    data["createdAt"] = datetime.utcnow()
    
    result = await db.purchases.insert_one(data)
    
    # Update ingredient stock if linked
    if data.get("ingredientId") and data.get("quantity"):
        await db.ingredients.update_one(
            {"_id": ObjectId(data["ingredientId"])},
            {"$inc": {"stockLevel": data["quantity"]}}
        )
        # Recalculate status
        ingredient = await db.ingredients.find_one({"_id": ObjectId(data["ingredientId"])})
        if ingredient:
            status = calculate_status(ingredient["stockLevel"], ingredient.get("minThreshold", 10))
            await db.ingredients.update_one(
                {"_id": ObjectId(data["ingredientId"])},
                {"$set": {"status": status}}
            )
    
    created = await db.purchases.find_one({"_id": result.inserted_id})
    await log_audit("create", "purchase", str(result.inserted_id))
    
    return serialize_doc(created)


# ============ DEDUCTION LOGS ============

@router.get("/deductions/all")
async def list_deductions(limit: int = Query(50, le=200)):
    """Get recent deduction logs"""
    db = get_db()
    
    deductions = await db.deduction_logs.find().sort("timestamp", -1).limit(limit).to_list(limit)
    return [serialize_doc(d) for d in deductions]


@router.post("/deductions")
async def create_deduction(data: dict):
    """Record ingredient deduction (usually from order)"""
    db = get_db()
    
    data["timestamp"] = datetime.utcnow()
    
    result = await db.deduction_logs.insert_one(data)
    
    # Deduct from ingredients
    for item in data.get("ingredients", []):
        if item.get("ingredientId") and item.get("amount"):
            ingredient = await db.ingredients.find_one({"_id": ObjectId(item["ingredientId"])})
            if ingredient:
                new_stock = max(0, ingredient.get("stockLevel", 0) - item["amount"])
                status = calculate_status(new_stock, ingredient.get("minThreshold", 10))
                await db.ingredients.update_one(
                    {"_id": ObjectId(item["ingredientId"])},
                    {"$set": {
                        "stockLevel": new_stock,
                        "status": status,
                        "lastDeduction": datetime.utcnow()
                    }}
                )
    
    created = await db.deduction_logs.find_one({"_id": result.inserted_id})
    return serialize_doc(created)
