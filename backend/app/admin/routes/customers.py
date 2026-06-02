"""
Customer Management Routes
- Customer CRUD
- Loyalty points
- Order history
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from datetime import datetime
from bson import ObjectId
from ...db import get_db
from ...audit import log_audit

router = APIRouter(tags=["Customers"])


def serialize_doc(doc):
    """Convert MongoDB document to JSON-serializable dict"""
    if doc is None:
        return None
    doc["_id"] = str(doc["_id"])
    return doc


def calculate_customer_type(total_orders: int, total_spend: float) -> str:
    """Determine customer type based on activity"""
    if total_orders >= 30 or total_spend >= 20000:
        return "VIP"
    elif total_orders >= 5 or total_spend >= 2000:
        return "Regular"
    return "New"


# ============ CUSTOMERS ============

@router.get("")
async def list_customers(
    status: Optional[str] = None,
    type: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(100, le=500),
    skip: int = 0,
):
    """Get all customers"""
    db = get_db()
    query = {}
    
    if status and status != "all":
        query["status"] = status
    if type and type != "all":
        query["type"] = type
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
        ]
    
    customers = await db.customers.find(query).sort("name", 1).skip(skip).limit(limit).to_list(limit)
    total = await db.customers.count_documents(query)
    
    return {"data": [serialize_doc(c) for c in customers], "total": total}


@router.get("/stats")
async def get_customer_stats():
    """Get customer statistics"""
    db = get_db()
    
    total = await db.customers.count_documents({})
    active = await db.customers.count_documents({"status": "Active"})
    vip = await db.customers.count_documents({"type": "VIP"})
    regular = await db.customers.count_documents({"type": "Regular"})
    new = await db.customers.count_documents({"type": "New"})
    
    # Total loyalty points
    points_pipeline = [
        {"$group": {"_id": None, "total": {"$sum": "$loyaltyPoints"}}}
    ]
    points_result = await db.customers.aggregate(points_pipeline).to_list(1)
    total_points = points_result[0]["total"] if points_result else 0
    
    # Total spend
    spend_pipeline = [
        {"$group": {"_id": None, "total": {"$sum": "$totalSpend"}}}
    ]
    spend_result = await db.customers.aggregate(spend_pipeline).to_list(1)
    total_spend = spend_result[0]["total"] if spend_result else 0
    
    return {
        "total": total,
        "active": active,
        "vip": vip,
        "regular": regular,
        "new": new,
        "totalLoyaltyPoints": total_points,
        "totalSpend": total_spend,
    }


@router.get("/{customer_id}")
async def get_customer(customer_id: str):
    """Get single customer"""
    db = get_db()
    customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return serialize_doc(customer)


@router.get("/{customer_id}/orders")
async def get_customer_orders(customer_id: str, limit: int = Query(20, le=100)):
    """Get customer's order history"""
    db = get_db()
    
    orders = await db.orders.find({"customerId": customer_id}).sort("createdAt", -1).limit(limit).to_list(limit)
    return [serialize_doc(order) for order in orders]


@router.post("")
async def create_customer(data: dict):
    """Create new customer"""
    db = get_db()
    
    # Check if email already exists
    if data.get("email"):
        existing = await db.customers.find_one({"email": data["email"]})
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
    
    data["createdAt"] = datetime.utcnow()
    data["joinDate"] = datetime.utcnow().isoformat()
    data["status"] = data.get("status", "Active")
    data["type"] = data.get("type", "New")
    data["totalOrders"] = data.get("totalOrders", 0)
    data["totalSpend"] = data.get("totalSpend", 0)
    data["loyaltyPoints"] = data.get("loyaltyPoints", 0)
    data["tags"] = data.get("tags", [])
    
    result = await db.customers.insert_one(data)
    created = await db.customers.find_one({"_id": result.inserted_id})
    
    await log_audit("create", "customer", str(result.inserted_id), {"name": data.get("name")})
    
    return serialize_doc(created)


@router.put("/{customer_id}")
async def update_customer(customer_id: str, data: dict):
    """Update customer"""
    db = get_db()
    
    data["updatedAt"] = datetime.utcnow()
    data.pop("_id", None)
    
    # Recalculate type if spending/orders changed
    if "totalOrders" in data or "totalSpend" in data:
        current = await db.customers.find_one({"_id": ObjectId(customer_id)})
        if current:
            orders = data.get("totalOrders", current.get("totalOrders", 0))
            spend = data.get("totalSpend", current.get("totalSpend", 0))
            data["type"] = calculate_customer_type(orders, spend)
    
    result = await db.customers.update_one(
        {"_id": ObjectId(customer_id)},
        {"$set": data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    updated = await db.customers.find_one({"_id": ObjectId(customer_id)})
    await log_audit("update", "customer", customer_id)
    
    return serialize_doc(updated)


@router.patch("/{customer_id}/status")
async def update_customer_status(customer_id: str, status: str):
    """Update customer status"""
    db = get_db()
    
    valid_statuses = ["Active", "Blocked", "Inactive"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status")
    
    result = await db.customers.update_one(
        {"_id": ObjectId(customer_id)},
        {"$set": {"status": status, "updatedAt": datetime.utcnow()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    await log_audit("status_update", "customer", customer_id, {"newStatus": status})
    
    return {"success": True, "status": status}


@router.delete("/{customer_id}")
async def delete_customer(customer_id: str):
    """Delete customer"""
    db = get_db()
    
    result = await db.customers.delete_one({"_id": ObjectId(customer_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    await log_audit("delete", "customer", customer_id)
    
    return {"success": True}


# ============ LOYALTY POINTS ============

@router.patch("/{customer_id}/points")
async def update_loyalty_points(customer_id: str, points: int, operation: str = "add", reason: Optional[str] = None):
    """Add or deduct loyalty points"""
    db = get_db()
    
    customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    current_points = customer.get("loyaltyPoints", 0)
    
    if operation == "add":
        new_points = current_points + points
    elif operation == "deduct":
        new_points = max(0, current_points - points)
    else:
        new_points = points  # Set exact value
    
    await db.customers.update_one(
        {"_id": ObjectId(customer_id)},
        {"$set": {"loyaltyPoints": new_points, "updatedAt": datetime.utcnow()}}
    )
    
    # Log points transaction
    await db.loyalty_transactions.insert_one({
        "customerId": customer_id,
        "points": points if operation == "add" else -points,
        "operation": operation,
        "balance": new_points,
        "reason": reason,
        "timestamp": datetime.utcnow()
    })
    
    await log_audit("points_update", "customer", customer_id, {
        "operation": operation,
        "points": points,
        "newBalance": new_points,
        "reason": reason
    })
    
    return {"success": True, "loyaltyPoints": new_points}


@router.get("/{customer_id}/points/history")
async def get_points_history(customer_id: str, limit: int = Query(20, le=100)):
    """Get loyalty points transaction history"""
    db = get_db()
    
    transactions = await db.loyalty_transactions.find(
        {"customerId": customer_id}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    return [serialize_doc(t) for t in transactions]


# ============ RECORD ORDER ============

@router.post("/{customer_id}/record-order")
async def record_customer_order(customer_id: str, order_total: float, points_earned: int = 0):
    """Record an order for customer (updates stats)"""
    db = get_db()
    
    customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    new_orders = customer.get("totalOrders", 0) + 1
    new_spend = customer.get("totalSpend", 0) + order_total
    new_points = customer.get("loyaltyPoints", 0) + points_earned
    new_type = calculate_customer_type(new_orders, new_spend)
    
    await db.customers.update_one(
        {"_id": ObjectId(customer_id)},
        {"$set": {
            "totalOrders": new_orders,
            "totalSpend": new_spend,
            "loyaltyPoints": new_points,
            "type": new_type,
            "lastVisit": datetime.utcnow().isoformat(),
            "updatedAt": datetime.utcnow()
        }}
    )
    
    if points_earned > 0:
        await db.loyalty_transactions.insert_one({
            "customerId": customer_id,
            "points": points_earned,
            "operation": "earned",
            "balance": new_points,
            "timestamp": datetime.utcnow()
        })
    
    return {
        "success": True,
        "totalOrders": new_orders,
        "totalSpend": new_spend,
        "loyaltyPoints": new_points,
        "type": new_type
    }
