"""
Order Management Routes
- CRUD for orders
- Order status updates
- Order statistics
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from datetime import datetime, timedelta
from bson import ObjectId
from ...db import get_db
from ...audit import log_audit


# Helper function to create billing entry when order is served
async def create_billing_entry_for_order(db, order_id: str, order: dict):
    """Create a billing entry when order is marked as served"""
    try:
        # Check if billing entry already exists
        existing_billing = await db.billing.find_one({"orderId": order_id})
        if existing_billing:
            return  # Already has billing entry
        
        # Create billing entry
        billing_entry = {
            "orderId": order_id,
            "orderNumber": order.get("orderNumber", f"#ORD-{order_id[:8]}"),
            "tableNumber": order.get("tableNumber"),
            "customerName": order.get("customerName", "Customer"),
            "items": order.get("items", []),
            "subtotal": order.get("total", 0),
            "taxRate": 5.0,  # Default GST rate
            "taxAmount": order.get("total", 0) * 0.05,
            "discountAmount": 0,
            "grandTotal": order.get("total", 0) * 1.05,
            "status": "pending_payment",
            "type": order.get("type", "dine-in"),
            "waiterId": order.get("waiterId"),
            "waiterName": order.get("waiterName"),
            "createdAt": datetime.utcnow().isoformat() + 'Z',
            "servedAt": datetime.utcnow().isoformat() + 'Z',
        }
        
        result = await db.billing.insert_one(billing_entry)
        
        # Update order with billing reference
        await db.orders.update_one(
            {"_id": order["_id"]},
            {"$set": {
                "billingId": str(result.inserted_id),
                "paymentStatus": "pending_payment",
                "servedAt": datetime.utcnow().isoformat() + 'Z'
            }}
        )
        
        print(f"Created billing entry {result.inserted_id} for order {order_id}")
        
    except Exception as e:
        print(f"Error creating billing entry for order {order_id}: {e}")
        # Don't fail the order status update if billing creation fails
        pass

router = APIRouter(tags=["Orders"])


def serialize_doc(doc):
    """Convert MongoDB document to JSON-serializable dict"""
    if doc is None:
        return None
    doc["_id"] = str(doc["_id"])
    # Preserve the order's own id (e.g. 'ORD-...' from client); fall back to _id
    doc["id"] = doc.get("id") or doc["_id"]
    
    # Convert datetime fields to ISO format with timezone
    datetime_fields = ["createdAt", "updatedAt", "statusUpdatedAt", "completedAt", "cancelledAt", "occupiedAt"]
    for field in datetime_fields:
        if field in doc and doc[field] is not None:
            if isinstance(doc[field], datetime):
                doc[field] = doc[field].isoformat() + 'Z'
            elif isinstance(doc[field], str) and not doc[field].endswith('Z'):
                # Already a string but missing Z, add it
                doc[field] = doc[field] + 'Z' if 'T' in doc[field] else doc[field]
    
    return doc


async def _get_order(db, order_id: str):
    """Find an order by custom id (ORD-...) or by MongoDB _id."""
    # Try the custom string id field first (used by client-placed orders)
    order = await db.orders.find_one({"id": order_id})
    if order:
        return order
    # Fallback: try as ObjectId for admin-created orders
    try:
        order = await db.orders.find_one({"_id": ObjectId(order_id)})
    except Exception:
        pass
    return order


@router.get("/served-for-billing")
async def get_served_orders_for_billing():
    """Get orders that are served and ready for billing"""
    db = get_db()
    
    # Find orders that are served but don't have completed payment
    served_orders = await db.orders.find({
        "status": "served",
        "paymentStatus": {"$ne": "paid"}
    }).sort("servedAt", -1).to_list(100)
    
    return [serialize_doc(order) for order in served_orders]


# ============ ORDERS ============

@router.get("")
async def list_orders(
    status: Optional[str] = None,
    type: Optional[str] = None,
    table: Optional[int] = None,
    waiter_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = Query(200, le=500),
    skip: int = 0,
):
    """Get all orders with optional filters"""
    db = get_db()
    query = {}
    
    if status and status != "all":
        query["status"] = status
    if type and type != "all":
        query["type"] = type
    if table:
        query["tableNumber"] = table
    if waiter_id and waiter_id != "all":
        # Only the waiter's own orders and all client-placed / kiosk orders
        query["$or"] = [
            {"waiterId": waiter_id},
            {"source": "client"},
            {"source": "kiosk"},
        ]
    if date_from:
        query["createdAt"] = {"$gte": datetime.fromisoformat(date_from)}
    if date_to:
        if "createdAt" in query:
            query["createdAt"]["$lte"] = datetime.fromisoformat(date_to)
        else:
            query["createdAt"] = {"$lte": datetime.fromisoformat(date_to)}
    
    orders = await db.orders.find(query).sort("createdAt", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.orders.count_documents(query)
    
    return {"data": [serialize_doc(order) for order in orders], "total": total}


@router.get("/stats")
async def get_order_stats():
    """Get order statistics"""
    db = get_db()
    
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    total_today = await db.orders.count_documents({"createdAt": {"$gte": today}})
    pending = await db.orders.count_documents({"status": {"$in": ["placed", "preparing"]}})
    ready = await db.orders.count_documents({"status": "ready"})
    completed_today = await db.orders.count_documents({
        "status": "completed",
        "createdAt": {"$gte": today}
    })
    
    # Revenue today
    revenue_pipeline = [
        {"$match": {"createdAt": {"$gte": today}, "status": {"$ne": "cancelled"}}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}}}
    ]
    revenue_result = await db.orders.aggregate(revenue_pipeline).to_list(1)
    revenue_today = revenue_result[0]["total"] if revenue_result else 0
    
    # Orders by type
    type_pipeline = [
        {"$match": {"createdAt": {"$gte": today}}},
        {"$group": {"_id": "$type", "count": {"$sum": 1}}}
    ]
    type_result = await db.orders.aggregate(type_pipeline).to_list(10)
    by_type = {t["_id"]: t["count"] for t in type_result if t["_id"]}
    
    return {
        "totalToday": total_today,
        "pending": pending,
        "ready": ready,
        "completedToday": completed_today,
        "revenueToday": revenue_today,
        "byType": by_type,
    }


@router.get("/{order_id}")
async def get_order(order_id: str):
    """Get single order"""
    db = get_db()
    order = await _get_order(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return serialize_doc(order)


@router.post("")
async def create_order(data: dict):
    """Create new order"""
    try:
        db = get_db()
        
        # Remove any incoming id/_id fields from the client
        data.pop("id", None)
        data.pop("_id", None)

        # Pre-generate ObjectId so _id and id are set atomically in one insert,
        # eliminating the race window that caused E11000 dup key: { id: null }
        new_id = ObjectId()
        data["_id"] = new_id
        data["id"] = str(new_id)

        # Generate order number
        count = await db.orders.count_documents({})
        data["orderNumber"] = f"#ORD-{count + 1001}"
        data["createdAt"] = datetime.utcnow().isoformat() + 'Z'
        data["status"] = data.get("status", "placed")
        data["statusUpdatedAt"] = datetime.utcnow().isoformat() + 'Z'

        await db.orders.insert_one(data)
        created = await db.orders.find_one({"_id": new_id})

        # Notify kitchen staff about new order
        await db.notifications.insert_one({
            "type": "order",
            "title": f"New Order {data['orderNumber']}",
            "message": f"New order for Table {data.get('tableNumber', 'N/A')} — {len(data.get('items', []))} item(s) — ₹{data.get('total', 0):.2f}",
            "recipient": "chef",
            "channel": "system",
            "status": "unread",
            "orderId": str(new_id),
            "created_at": datetime.utcnow(),
        })

        # Try to log audit but don't fail if it doesn't work
        try:
            await log_audit("create", "order", str(new_id), {
                "orderNumber": data["orderNumber"],
                "total": data.get("total")
            })
        except Exception as e:
            print(f"Audit log error: {e}")
        
        return serialize_doc(created)
    except Exception as e:
        print(f"Error creating order: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to create order: {str(e)}")


@router.put("/{order_id}")
async def update_order(order_id: str, data: dict):
    """Update order"""
    db = get_db()
    
    data["updatedAt"] = datetime.utcnow().isoformat() + 'Z'
    data.pop("_id", None)
    data.pop("id", None)  # Remove id field to prevent index conflicts

    order = await _get_order(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    oid = order["_id"]

    result = await db.orders.update_one(
        {"_id": oid},
        {"$set": data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    updated = await db.orders.find_one({"_id": oid})
    await log_audit("update", "order", order_id)
    
    return serialize_doc(updated)


# Helper function for inventory deduction (imported from recipes module)
async def call_inventory_deduction(order_id: str, items: list):
    """Helper to call inventory deduction from recipes module"""
    from .recipes import deduct_inventory_for_order
    return await deduct_inventory_for_order({"orderId": order_id, "items": items})


@router.patch("/{order_id}/status")
async def update_order_status(order_id: str, status: str, deduct_inventory: bool = True):
    """
    Update order status with automatic flow integration.
    
    Flow:
    - placed → preparing: Triggers inventory deduction if deduct_inventory=true
    - preparing → ready: Notifies for serving
    - ready → served → completed: Updates billing/payment
    
    Query param `deduct_inventory` can be set to false to skip deduction (for re-printing etc.)
    """
    db = get_db()
    
    valid_statuses = ["placed", "preparing", "ready", "served", "completed", "cancelled"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    # Get current order to check previous status
    order = await _get_order(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    oid = order["_id"]
    previous_status = order.get("status")
    
    # Update status
    result = await db.orders.update_one(
        {"_id": oid},
        {"$set": {"status": status, "statusUpdatedAt": datetime.utcnow().isoformat() + 'Z'}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # FLOW INTEGRATION: Trigger inventory deduction when order starts preparing
    inventory_deducted = False
    deduction_result = None
    
    if status == "preparing" and deduct_inventory:
        items = order.get("items", [])
        if items:
            try:
                deduction_result = await call_inventory_deduction(order_id, items)
                inventory_deducted = True
            except Exception as e:
                # Log but don't fail the order update
                print(f"Inventory deduction error: {e}")
    
    # FLOW INTEGRATION: Create notifications for order status transitions
    order_number = order.get("orderNumber") or f"#ORD-{order_id[:8]}"
    _raw_table = order.get("tableNumber") or order.get("table")
    order_type = str(order.get("type") or order.get("orderType") or "").strip().lower()
    table_number = str(_raw_table) if _raw_table else ("Takeaway" if "takeaway" in order_type or "pickup" in order_type else "N/A")

    if status == "preparing":
        await db.notifications.insert_one({
            "type": "order",
            "title": f"Order {order_number} Preparing",
            "message": f"Order {order_number} (Table {table_number}) is now being prepared in the kitchen.",
            "recipient": "waiter",
            "channel": "system",
            "status": "unread",
            "orderId": order_id,
            "created_at": datetime.utcnow(),
        })

    if status == "ready":
        await db.notifications.insert_one({
            "type": "order-ready",
            "title": f"Order {order_number} Ready",
            "message": f"Order {order_number} (Table {table_number}) is ready for serving.",
            "recipient": "waiter",
            "channel": "system",
            "status": "unread",
            "orderId": order_id,
            "created_at": datetime.utcnow(),
        })

    if status == "served":
        await db.notifications.insert_one({
            "type": "bill-generated",
            "title": f"Order {order_number} Served",
            "message": f"Order {order_number} (Table {table_number}) has been served. Bill ready for payment.",
            "recipient": "cashier",
            "channel": "system",
            "status": "unread",
            "orderId": order_id,
            "created_at": datetime.utcnow(),
        })

    if status == "cancelled":
        await db.notifications.insert_one({
            "type": "order-cancelled",
            "title": f"Order {order_number} Cancelled",
            "message": f"Order {order_number} (Table {table_number}) has been cancelled.",
            "recipient": "chef",
            "channel": "system",
            "status": "unread",
            "orderId": order_id,
            "created_at": datetime.utcnow(),
        })
        await db.notifications.insert_one({
            "type": "order-cancelled",
            "title": f"Order {order_number} Cancelled",
            "message": f"Order {order_number} (Table {table_number}) has been cancelled.",
            "recipient": "waiter",
            "channel": "system",
            "status": "unread",
            "orderId": order_id,
            "created_at": datetime.utcnow(),
        })
    
    # FLOW INTEGRATION: Create billing entry when order is served
    if status == "served" and previous_status != "served":
        # Create billing entry for the served order
        await create_billing_entry_for_order(db, order_id, order)
    
    # FLOW INTEGRATION: Update payment when completed
    if status == "completed" and order.get("paymentStatus") != "paid":
        await db.orders.update_one(
            {"_id": oid},
            {"$set": {"paymentStatus": "settled", "completedAt": datetime.utcnow().isoformat() + 'Z'}}
        )
    
    await log_audit("status_update", "order", order_id, {
        "newStatus": status,
        "previousStatus": previous_status,
        "inventoryDeducted": inventory_deducted
    })
    
    return {
        "success": True, 
        "status": status,
        "previousStatus": previous_status,
        "inventoryDeducted": inventory_deducted,
        "deductionResult": deduction_result
    }


@router.delete("/{order_id}")
async def delete_order(order_id: str):
    """Delete order — hard-deletes from the database so it never reappears"""
    db = get_db()
    
    # Get order details before deleting
    order = await _get_order(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    oid = order["_id"]
    result = await db.orders.delete_one({"_id": oid})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Create notification for deleted order
    order_number = order.get("orderNumber") or f"#ORD-{order_id[:8]}"
    _raw_table = order.get("tableNumber") or order.get("table")
    _order_type = str(order.get("type") or order.get("orderType") or "").strip().lower()
    table_number = str(_raw_table) if _raw_table else ("Takeaway" if "takeaway" in _order_type or "pickup" in _order_type else "N/A")
    total = order.get("total", 0)
    
    await db.notifications.insert_one({
        "type": "order-deleted",
        "title": f"Order {order_number} Deleted",
        "message": f"Table {table_number} - Order permanently deleted",
        "recipient": "Admin",
        "channel": "system",
        "status": "unread",
        "created_at": datetime.utcnow(),
    })
    
    await log_audit("delete", "order", order_id)
    
    return {"success": True}


# ============ KITCHEN DISPLAY ============

@router.get("/kitchen/queue")
async def get_kitchen_queue():
    """Get orders for kitchen display"""
    db = get_db()
    
    orders = await db.orders.find({
        "status": {"$in": ["placed", "preparing", "ready"]}
    }).sort("createdAt", 1).to_list(50)
    
    return [serialize_doc(order) for order in orders]


@router.patch("/{order_id}/item-status")
async def update_item_status(order_id: str, item_index: int, status: str):
    """Update individual item status in order"""
    db = get_db()

    order = await _get_order(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    result = await db.orders.update_one(
        {"_id": order["_id"]},
        {"$set": {f"items.{item_index}.status": status}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    return {"success": True}


# ============ KITCHEN WORKFLOW ENDPOINTS ============

@router.post("/kitchen/start-preparing/{order_id}")
async def start_preparing_order(order_id: str):
    """
    Start preparing an order in kitchen.
    This triggers:
    1. Order status changed to 'preparing'
    2. Inventory deduction based on recipes
    3. Kitchen timer starts
    """
    return await update_order_status(order_id, "preparing", deduct_inventory=True)


@router.post("/kitchen/mark-ready/{order_id}")
async def mark_order_ready(order_id: str):
    """
    Mark order as ready in kitchen.
    This triggers:
    1. Order status changed to 'ready'
    2. Notification sent to waiters
    """
    return await update_order_status(order_id, "ready", deduct_inventory=False)


@router.post("/kitchen/complete/{order_id}")
async def complete_order_serving(order_id: str):
    """
    Complete order serving.
    This triggers:
    1. Order status changed to 'completed'
    2. Payment status updated
    3. Order completion time recorded
    """
    return await update_order_status(order_id, "completed", deduct_inventory=False)


@router.get("/kitchen/active-orders")
async def get_active_kitchen_orders():
    """
    Get all active orders for kitchen display.
    Returns orders in: placed, preparing, ready states
    """
    db = get_db()
    
    orders = await db.orders.find({
        "status": {"$in": ["placed", "preparing", "ready"]}
    }).sort([
        ("status", 1),  # placed first, then preparing, then ready
        ("createdAt", 1)  # oldest first within status
    ]).to_list(100)
    
    # Enhance with timing info
    result = []
    for order in orders:
        doc = serialize_doc(order)
        # Calculate time elapsed
        created = order.get("createdAt")
        if created:
            elapsed = (datetime.utcnow() - created).total_seconds()
            doc["elapsedMinutes"] = int(elapsed / 60)
            # Add urgency flag
            doc["isUrgent"] = elapsed > 600  # 10 minutes
        result.append(doc)
    
    return result


@router.get("/kitchen/stats")
async def get_kitchen_stats():
    """Get kitchen statistics"""
    db = get_db()
    
    placed = await db.orders.count_documents({"status": "placed"})
    preparing = await db.orders.count_documents({"status": "preparing"})
    ready = await db.orders.count_documents({"status": "ready"})
    
    # Average prep time (for completed orders in last hour)
    one_hour_ago = datetime.utcnow() - timedelta(hours=1)
    recent_completed = await db.orders.find({
        "status": "completed",
        "completedAt": {"$gte": one_hour_ago}
    }).to_list(100)
    
    avg_time = 0
    if recent_completed:
        total_time = sum([
            (o.get("completedAt") - o.get("createdAt")).total_seconds() 
            for o in recent_completed 
            if o.get("completedAt") and o.get("createdAt")
        ])
        avg_time = int(total_time / len(recent_completed) / 60) if total_time > 0 else 0
    
    return {
        "pending": placed,
        "inProgress": preparing,
        "readyToServe": ready,
        "avgPrepTimeMinutes": avg_time,
        "totalActive": placed + preparing + ready
    }


# ============ WORKFLOW INTEGRATION ============

@router.post("/workflow/process-order")
async def process_order_workflow(data: dict):
    """
    Complete workflow for processing an order.
    Coordinates between Orders, Kitchen, Inventory, and Billing.
    
    Expected data:
    {
        "orderId": "...",
        "action": "start_preparing|mark_ready|serve|complete|cancel",
        "items": [...] // Only needed for start_preparing
    }
    """
    action = data.get("action")
    order_id = data.get("orderId")
    
    if not order_id or not action:
        raise HTTPException(status_code=400, detail="orderId and action are required")
    
    valid_actions = ["start_preparing", "mark_ready", "serve", "complete", "cancel"]
    if action not in valid_actions:
        raise HTTPException(status_code=400, detail=f"Invalid action. Must be one of: {valid_actions}")
    
    # Map actions to status
    action_to_status = {
        "start_preparing": "preparing",
        "mark_ready": "ready",
        "serve": "served",
        "complete": "completed",
        "cancel": "cancelled"
    }
    
    deduct = action == "start_preparing"
    new_status = action_to_status[action]
    
    return await update_order_status(order_id, new_status, deduct_inventory=deduct)


@router.post("/fix-indexes")
async def fix_orders_indexes():
    """
    Migration endpoint to fix the duplicate key error on orders.
    Drops the problematic 'id' index and removes 'id' field from all documents.
    """
    db = get_db()
    results = {"dropped_index": False, "removed_id_fields": 0, "errors": []}
    
    # Try to drop the id_1 index
    try:
        await db.orders.drop_index("id_1")
        results["dropped_index"] = True
    except Exception as e:
        error_msg = str(e)
        if "not found" in error_msg.lower() or "index not found" in error_msg.lower():
            results["dropped_index"] = "not_found"
        else:
            results["errors"].append(f"Failed to drop index: {error_msg}")
    
    # Remove id field from all documents that have it
    try:
        update_result = await db.orders.update_many(
            {"id": {"$exists": True}},
            {"$unset": {"id": ""}}
        )
        results["removed_id_fields"] = update_result.modified_count
    except Exception as e:
        results["errors"].append(f"Failed to remove id fields: {str(e)}")
    
    return results
