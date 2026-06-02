"""
Recipe Management Routes
- Maps menu items to their required ingredients
- Used for automatic inventory deduction when orders are prepared
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from datetime import datetime
from bson import ObjectId
from ...db import get_db
from ...audit import log_audit

router = APIRouter(tags=["Recipes"])


def serialize_doc(doc):
    """Convert MongoDB document to JSON-serializable dict"""
    if doc is None:
        return None
    doc["_id"] = str(doc["_id"])
    return doc


# ============ RECIPES ============

@router.get("")
async def list_recipes():
    """Get all recipes (menu item to ingredient mappings)"""
    db = get_db()
    recipes = await db.recipes.find().to_list(500)
    return [serialize_doc(r) for r in recipes]


@router.get("/{menu_item_id}")
async def get_recipe(menu_item_id: str):
    """Get recipe for a menu item"""
    db = get_db()
    recipe = await db.recipes.find_one({"menuItemId": menu_item_id})
    if not recipe:
        return {"menuItemId": menu_item_id, "ingredients": []}
    return serialize_doc(recipe)


@router.post("")
async def create_recipe(data: dict):
    """Create or update recipe for a menu item"""
    db = get_db()
    
    menu_item_id = data.get("menuItemId")
    if not menu_item_id:
        raise HTTPException(status_code=400, detail="menuItemId is required")
    
    # Check if recipe exists
    existing = await db.recipes.find_one({"menuItemId": menu_item_id})
    
    if existing:
        # Update existing
        data["updatedAt"] = datetime.utcnow()
        await db.recipes.update_one(
            {"menuItemId": menu_item_id},
            {"$set": data}
        )
        updated = await db.recipes.find_one({"menuItemId": menu_item_id})
        return serialize_doc(updated)
    else:
        # Create new
        data["createdAt"] = datetime.utcnow()
        result = await db.recipes.insert_one(data)
        created = await db.recipes.find_one({"_id": result.inserted_id})
        await log_audit("create", "recipe", str(result.inserted_id))
        return serialize_doc(created)


@router.delete("/{recipe_id}")
async def delete_recipe(recipe_id: str):
    """Delete a recipe"""
    db = get_db()
    result = await db.recipes.delete_one({"_id": ObjectId(recipe_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return {"success": True}


# ============ ORDER-INVENTORY INTEGRATION ============

@router.post("/deduct-for-order")
async def deduct_inventory_for_order(data: dict):
    """
    Deduct inventory for an order.
    Called when order status changes to 'preparing'.
    
    Expected data:
    {
        "orderId": "order_123",
        "items": [
            {"name": "Chicken Biryani", "quantity": 2, "menuItemId": "item_123"},
            {"name": "Margherita Pizza", "quantity": 1, "menuItemId": "item_456"}
        ]
    }
    """
    db = get_db()
    
    order_id = data.get("orderId")
    items = data.get("items", [])
    
    if not order_id or not items:
        raise HTTPException(status_code=400, detail="orderId and items are required")
    
    # Check if we already processed this order
    existing_deduction = await db.deduction_logs.find_one({"orderId": order_id})
    if existing_deduction:
        return {"success": True, "message": "Already processed", "already_processed": True}
    
    deducted_ingredients = []
    errors = []
    
    for item in items:
        item_name = item.get("name", "")
        item_quantity = item.get("quantity", 1)
        menu_item_id = item.get("menuItemId")
        
        # Try to find recipe by menuItemId first, then by name
        recipe = None
        if menu_item_id:
            recipe = await db.recipes.find_one({"menuItemId": menu_item_id})
        
        if not recipe:
            # Try to match by menu item name
            menu_item = await db.menu_items.find_one({
                "name": {"$regex": f"^{item_name}$", "$options": "i"}
            })
            if menu_item:
                recipe = await db.recipes.find_one({"menuItemId": str(menu_item["_id"])})
        
        if not recipe:
            # No recipe found, skip but log
            errors.append(f"No recipe found for '{item_name}'")
            continue
        
        # Deduct each ingredient
        for ing in recipe.get("ingredients", []):
            ingredient_id = ing.get("ingredientId")
            amount_per_unit = ing.get("amount", 0)
            total_deduct = amount_per_unit * item_quantity
            
            if not ingredient_id:
                continue
            
            # Find and update ingredient
            try:
                ingredient = await db.ingredients.find_one({"_id": ObjectId(ingredient_id)})
                if ingredient:
                    current_stock = ingredient.get("stockLevel", 0)
                    new_stock = max(0, current_stock - total_deduct)
                    
                    # Calculate new status
                    min_threshold = ingredient.get("minThreshold", 10)
                    if new_stock <= 0:
                        status = "Out"
                    elif new_stock <= min_threshold * 0.5:
                        status = "Critical"
                    elif new_stock <= min_threshold:
                        status = "Low"
                    else:
                        status = "Healthy"
                    
                    await db.ingredients.update_one(
                        {"_id": ObjectId(ingredient_id)},
                        {"$set": {
                            "stockLevel": new_stock,
                            "status": status,
                            "lastDeduction": datetime.utcnow()
                        }}
                    )
                    
                    deducted_ingredients.append({
                        "ingredientId": ingredient_id,
                        "name": ingredient.get("name"),
                        "amount": total_deduct,
                        "unit": ingredient.get("unit"),
                        "newStock": new_stock,
                        "status": status
                    })
            except Exception as e:
                errors.append(f"Error deducting {ingredient_id}: {str(e)}")
    
    # Create deduction log
    if deducted_ingredients:
        log_entry = {
            "orderId": order_id,
            "items": items,
            "ingredients": deducted_ingredients,
            "timestamp": datetime.utcnow(),
            "errors": errors if errors else None
        }
        await db.deduction_logs.insert_one(log_entry)
    
    return {
        "success": True,
        "deducted": deducted_ingredients,
        "errors": errors if errors else None
    }


@router.get("/ingredients-for-item/{menu_item_name}")
async def get_ingredients_for_item(menu_item_name: str):
    """
    Get required ingredients for a menu item by name.
    Useful for checking availability before accepting an order.
    """
    db = get_db()
    
    # Find menu item
    menu_item = await db.menu_items.find_one({
        "name": {"$regex": f"^{menu_item_name}$", "$options": "i"}
    })
    
    if not menu_item:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    # Find recipe
    recipe = await db.recipes.find_one({"menuItemId": str(menu_item["_id"])})
    
    if not recipe:
        return {"menuItem": menu_item_name, "ingredients": [], "hasRecipe": False}
    
    # Get current stock levels
    ingredient_details = []
    for ing in recipe.get("ingredients", []):
        ingredient_id = ing.get("ingredientId")
        if ingredient_id:
            try:
                ingredient = await db.ingredients.find_one({"_id": ObjectId(ingredient_id)})
                if ingredient:
                    ingredient_details.append({
                        "id": str(ingredient["_id"]),
                        "name": ingredient.get("name"),
                        "required": ing.get("amount", 0),
                        "available": ingredient.get("stockLevel", 0),
                        "unit": ingredient.get("unit"),
                        "status": ingredient.get("status"),
                        "sufficient": ingredient.get("stockLevel", 0) >= ing.get("amount", 0)
                    })
            except:
                pass
    
    return {
        "menuItem": menu_item_name,
        "ingredients": ingredient_details,
        "hasRecipe": True,
        "canPrepare": all(i["sufficient"] for i in ingredient_details) if ingredient_details else True
    }
