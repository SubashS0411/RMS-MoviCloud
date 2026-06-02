"""
Complete Workflow Integration - Tables to Orders to Kitchen to Billing
Handles the full guest lifecycle from reservation/walk-in through check-out
"""

from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from typing import Optional, List
from datetime import datetime, timedelta
from bson import ObjectId
from ...db import get_db
from ...audit import log_audit

router = APIRouter(tags=["Workflow"])

# ============ WORKFLOW ENDPOINTS ============

@router.post("/guest-arrived/{table_id}")
async def handle_guest_arrival(table_id: str, background_tasks: BackgroundTasks):
    """
    Handle guest arrival - transitions from 'reserved' or 'walk-in-blocked' to 'occupied'
    Sets up for waiter assignment and order taking
    """
    db = get_db()
    
    # Get the table
    table = await db.tables.find_one({"_id": ObjectId(table_id)})
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    # Check if table is in a state that allows guest arrival
    current_status = table.get("status", "").lower()
    if current_status not in ["reserved", "walk-in-blocked", "available"]:
        raise HTTPException(
            status_code=400, 
            detail=f"Guest cannot arrive at table in '{current_status}' status. Expected 'reserved' or 'walk-in-blocked'"
        )
    
    # Update table to 'occupied' status
    update_data = {
        "status": "occupied",
        "occupiedAt": datetime.utcnow().isoformat() + 'Z',
        "arrivalTime": datetime.utcnow().isoformat() + 'Z',
        "reservationStatus": "arrived",
        "blockingTimeout": None,  # Clear any blocking timer
        "updatedAt": datetime.utcnow().isoformat() + 'Z'
    }
    
    await db.tables.update_one(
        {"_id": ObjectId(table_id)},
        {"$set": update_data}
    )
    
    # Log the action
    await log_audit(
        "guest_arrived",
        "table",
        table_id,
        {"previousStatus": current_status, "newStatus": "occupied"}
    )
    
    return {
        "success": True,
        "message": "Guest arrived. Ready for waiter assignment.",
        "status": "occupied",
        "nextStep": "assign_waiter"
    }


@router.post("/walk-in-booking/{table_id}")
async def handle_walk_in_booking(table_id: str, data: dict, background_tasks: BackgroundTasks):
    """
    Handle walk-in booking - blocks table for 15 minutes waiting for guest arrival
    If guest doesn't arrive in 15 minutes, automatically return to available
    
    Expected data:
    {
        "guestCount": 4,
        "customerName": "John Doe"
    }
    """
    db = get_db()
    
    # Get the table
    table = await db.tables.find_one({"_id": ObjectId(table_id)})
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    # Check if table is available
    if table.get("status", "").lower() != "available":
        raise HTTPException(status_code=400, detail="Table is not available for walk-in booking")
    
    # Check capacity
    guest_count = data.get("guestCount", 0)
    if guest_count > table.get("capacity", 0):
        raise HTTPException(
            status_code=400,
            detail=f"Guest count ({guest_count}) exceeds table capacity ({table.get('capacity')})"
        )
    
    # Set table to 'walk-in-blocked' status for 15 minutes
    blocking_until = datetime.utcnow() + timedelta(minutes=15)
    
    update_data = {
        "status": "walk-in-blocked",
        "blockingStartTime": datetime.utcnow().isoformat() + 'Z',
        "blockingTimeout": blocking_until.isoformat() + 'Z',
        "guestCount": guest_count,
        "customerName": data.get("customerName"),
        "reservationType": "walk-in",
        "reservationStatus": "waiting_for_arrival",
        "updatedAt": datetime.utcnow().isoformat() + 'Z'
    }
    
    await db.tables.update_one(
        {"_id": ObjectId(table_id)},
        {"$set": update_data}
    )
    
    # Schedule automatic status reset if guest doesn't arrive
    background_tasks.add_task(
        auto_release_walk_in_table,
        table_id,
        blocking_until.isoformat()
    )
    
    # Log the action
    await log_audit(
        "walk_in_booking",
        "table",
        table_id,
        {
            "customerName": data.get("customerName"),
            "guestCount": guest_count,
            "blockingUntil": blocking_until.isoformat()
        }
    )
    
    return {
        "success": True,
        "message": f"Table blocked for 15 minutes (until {blocking_until.strftime('%H:%M:%S')}). Guest must arrive to proceed.",
        "status": "walk-in-blocked",
        "blockingTimeout": blocking_until.isoformat() + 'Z',
        "nextStep": "wait_for_guest_arrival"
    }


@router.post("/waiter-assigned/{table_id}")
async def handle_waiter_assignment(table_id: str, data: dict):
    """
    Handle waiter assignment - waiter is ready to take order
    This is called after waiter is assigned to the table
    
    Expected data:
    {
        "waiterId": "waiter_id",
        "waiterName": "John"
    }
    """
    db = get_db()
    
    # Get the table
    table = await db.tables.find_one({"_id": ObjectId(table_id)})
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    # Check if table is occupied
    if table.get("status", "").lower() != "occupied":
        raise HTTPException(status_code=400, detail="Table must be occupied to assign waiter")
    
    # Update table with waiter info
    update_data = {
        "waiterId": data.get("waiterId"),
        "waiterName": data.get("waiterName"),
        "waiterAssignedAt": datetime.utcnow().isoformat() + 'Z',
        "updatedAt": datetime.utcnow().isoformat() + 'Z'
    }
    
    await db.tables.update_one(
        {"_id": ObjectId(table_id)},
        {"$set": update_data}
    )
    
    # Create notification for the assigned waiter
    table_number = table.get("number") or table.get("tableNumber") or table.get("name", f"Table {table_id[:6]}")
    notification = {
        "type": "table-assigned",
        "title": "New Table Assigned",
        "message": f"You have been assigned to {table_number}. Please attend to the guests.",
        "recipient": "waiter",
        "channel": "system",
        "status": "unread",
        "created_at": datetime.utcnow(),
        "metadata": {
            "tableId": table_id,
            "waiterId": data.get("waiterId"),
            "waiterName": data.get("waiterName"),
        }
    }
    await db.notifications.insert_one(notification)
    
    # Log the action
    await log_audit(
        "waiter_assigned",
        "table",
        table_id,
        {
            "waiterId": data.get("waiterId"),
            "waiterName": data.get("waiterName")
        }
    )
    
    return {
        "success": True,
        "message": f"Waiter {data.get('waiterName')} assigned. Ready to take order.",
        "status": "occupied",
        "nextStep": "take_order"
    }


@router.post("/order-created/{table_id}")
async def handle_order_created(table_id: str, data: dict):
    """
    Handle order creation - links order to table
    Called when waiter creates an order for the table
    
    Expected data:
    {
        "orderId": "order_id",
        "orderNumber": "#ORD-1001"
    }
    """
    db = get_db()
    
    # Get the table
    table = await db.tables.find_one({"_id": ObjectId(table_id)})
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    # Update table with current order
    order_id = data.get("orderId")
    
    # Store order in table's orders array
    await db.tables.update_one(
        {"_id": ObjectId(table_id)},
        {
            "$push": {"orders": order_id},
            "$set": {
                "currentOrderId": order_id,
                "orderCreatedAt": datetime.utcnow().isoformat() + 'Z',
                "updatedAt": datetime.utcnow().isoformat() + 'Z'
            }
        }
    )
    
    # Log the action
    await log_audit(
        "order_created",
        "table",
        table_id,
        {"orderId": order_id}
    )
    
    return {
        "success": True,
        "message": "Order created and linked to table",
        "status": "occupied",
        "nextStep": "order_acceptance"
    }


@router.post("/order-accepted/{table_id}")
async def handle_order_accepted(table_id: str, data: dict):
    """
    Handle order acceptance - order is confirmed and sent to kitchen
    Updates table status to 'order_accepted'
    
    Expected data:
    {
        "orderId": "order_id",
        "kitchenStatus": "accepted"
    }
    """
    db = get_db()
    
    table = await db.tables.find_one({"_id": ObjectId(table_id)})
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    # Update table status to indicate order is accepted
    update_data = {
        "status": "order_accepted",
        "orderAcceptedAt": datetime.utcnow().isoformat() + 'Z',
        "kitchenStatus": "new_order",
        "updatedAt": datetime.utcnow().isoformat() + 'Z'
    }
    
    await db.tables.update_one(
        {"_id": ObjectId(table_id)},
        {"$set": update_data}
    )
    
    # Update the order as well (mark as sent to kitchen)
    if data.get("orderId"):
        try:
            await db.orders.update_one(
                {"_id": ObjectId(data["orderId"])},
                {
                    "$set": {
                        "status": "accepted",
                        "sentToKitchenAt": datetime.utcnow().isoformat() + 'Z',
                        "updatedAt": datetime.utcnow().isoformat() + 'Z'
                    }
                }
            )
        except Exception as e:
            print(f"Warning: Could not update order status: {e}")
    
    # Log the action
    await log_audit(
        "order_accepted",
        "table",
        table_id,
        {"orderId": data.get("orderId")}
    )
    
    return {
        "success": True,
        "message": "Order accepted and sent to kitchen",
        "status": "order_accepted",
        "kitchenStatus": "new_order",
        "nextStep": "kitchen_prepares"
    }


@router.post("/order-preparing/{table_id}")
async def handle_order_preparing(table_id: str, data: dict):
    """
    Handle order preparation - chef has taken the order and started preparing
    Updates table status to 'order_preparing' (or 'eating')
    
    Expected data:
    {
        "orderId": "order_id",
        "chefId": "chef_id",
        "estimatedTimeMinutes": 20
    }
    """
    db = get_db()
    
    table = await db.tables.find_one({"_id": ObjectId(table_id)})
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    # Calculate estimated ready time
    estimated_ready_time = None
    if data.get("estimatedTimeMinutes"):
        estimated_ready_time = (
            datetime.utcnow() + timedelta(minutes=data["estimatedTimeMinutes"])
        ).isoformat() + 'Z'
    
    # Update table status to preparing/eating
    update_data = {
        "status": "eating",  # Changed from "order_preparing" to "eating" as per requirements
        "kitchenStatus": "preparing",
        "chefId": data.get("chefId"),
        "preparationStartedAt": datetime.utcnow().isoformat() + 'Z',
        "estimatedReadyTime": estimated_ready_time,
        "updatedAt": datetime.utcnow().isoformat() + 'Z'
    }
    
    await db.tables.update_one(
        {"_id": ObjectId(table_id)},
        {"$set": update_data}
    )
    
    # Update order status
    if data.get("orderId"):
        try:
            await db.orders.update_one(
                {"_id": ObjectId(data["orderId"])},
                {
                    "$set": {
                        "status": "preparing",
                        "preparationStartedAt": datetime.utcnow().isoformat() + 'Z',
                        "estimatedReadyTime": estimated_ready_time,
                        "updatedAt": datetime.utcnow().isoformat() + 'Z'
                    }
                }
            )
        except Exception as e:
            print(f"Warning: Could not update order status: {e}")
    
    # Log the action
    await log_audit(
        "order_preparing",
        "table",
        table_id,
        {
            "orderId": data.get("orderId"),
            "chefId": data.get("chefId"),
            "estimatedTimeMinutes": data.get("estimatedTimeMinutes")
        }
    )
    
    return {
        "success": True,
        "message": "Chef started preparing order",
        "status": "eating",
        "kitchenStatus": "preparing",
        "estimatedReadyTime": estimated_ready_time,
        "nextStep": "order_ready"
    }


@router.post("/order-ready/{table_id}")
async def handle_order_ready(table_id: str, data: dict):
    """
    Handle order ready - chef finished preparing and marked order as ready
    Updates table status to 'served' immediately
    
    Expected data:
    {
        "orderId": "order_id"
    }
    """
    db = get_db()
    
    table = await db.tables.find_one({"_id": ObjectId(table_id)})
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    # Update table status to served
    update_data = {
        "status": "served",
        "kitchenStatus": "ready",
        "orderReadyAt": datetime.utcnow().isoformat() + 'Z',
        "updatedAt": datetime.utcnow().isoformat() + 'Z'
    }
    
    await db.tables.update_one(
        {"_id": ObjectId(table_id)},
        {"$set": update_data}
    )
    
    # Update order status to ready
    if data.get("orderId"):
        try:
            await db.orders.update_one(
                {"_id": ObjectId(data["orderId"])},
                {
                    "$set": {
                        "status": "ready",
                        "readyAt": datetime.utcnow().isoformat() + 'Z',
                        "updatedAt": datetime.utcnow().isoformat() + 'Z'
                    }
                }
            )
        except Exception as e:
            print(f"Warning: Could not update order status: {e}")
    
    # Log the action
    await log_audit(
        "order_ready",
        "table",
        table_id,
        {"orderId": data.get("orderId")}
    )
    
    return {
        "success": True,
        "message": "Order ready and served",
        "status": "served",
        "kitchenStatus": "ready",
        "nextStep": "bill_generation"
    }


@router.post("/bill-generated/{table_id}")
async def handle_bill_generated(table_id: str, data: dict):
    """
    Handle bill generation - bill is created for the table
    
    Expected data:
    {
        "orderId": "order_id",
        "billId": "bill_id",
        "totalAmount": 500.00,
        "billDetails": {...}
    }
    """
    db = get_db()
    
    table = await db.tables.find_one({"_id": ObjectId(table_id)})
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    # Update table with bill information
    update_data = {
        "billGenerated": True,
        "billId": data.get("billId"),
        "billAmount": data.get("totalAmount"),
        "billGeneratedAt": datetime.utcnow().isoformat() + 'Z',
        "updatedAt": datetime.utcnow().isoformat() + 'Z'
    }
    
    await db.tables.update_one(
        {"_id": ObjectId(table_id)},
        {"$set": update_data}
    )
    
    # Log the action
    await log_audit(
        "bill_generated",
        "table",
        table_id,
        {
            "billId": data.get("billId"),
            "amount": data.get("totalAmount")
        }
    )
    
    return {
        "success": True,
        "message": "Bill generated",
        "status": "served",
        "nextStep": "payment_processing"
    }


@router.post("/payment-completed/{table_id}")
async def handle_payment_completed(table_id: str, data: dict, background_tasks: BackgroundTasks):
    """
    Handle payment completion - payment is done, start cleaning process
    Updates table status to 'checked_out', then schedules transition to 'cleaning'
    After 5 minutes, table returns to 'available' or original 'reserved' status
    
    Expected data:
    {
        "billId": "bill_id",
        "paymentId": "payment_id",
        "amount": 500.00,
        "paymentMethod": "cash",
        "originalStatus": "available"  # What status to return to after cleaning
    }
    """
    db = get_db()
    
    table = await db.tables.find_one({"_id": ObjectId(table_id)})
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    # Update table to 'checked_out' status
    update_data = {
        "status": "checked_out",
        "paymentId": data.get("paymentId"),
        "billId": data.get("billId"),
        "paymentAmount": data.get("amount"),
        "paymentMethod": data.get("paymentMethod"),
        "paymentCompletedAt": datetime.utcnow().isoformat() + 'Z',
        "updatedAt": datetime.utcnow().isoformat() + 'Z'
    }
    
    await db.tables.update_one(
        {"_id": ObjectId(table_id)},
        {"$set": update_data}
    )
    
    # Schedule cleaning phase (5 minutes)
    cleaning_end_time = datetime.utcnow() + timedelta(minutes=5)
    original_status = data.get("originalStatus", "available")
    
    # Immediately set to cleaning status
    await db.tables.update_one(
        {"_id": ObjectId(table_id)},
        {
            "$set": {
                "status": "cleaning",
                "cleaningStartedAt": datetime.utcnow().isoformat() + 'Z',
                "cleaningEndTime": cleaning_end_time.isoformat() + 'Z',
                "originalStatus": original_status,
                "updatedAt": datetime.utcnow().isoformat() + 'Z'
            }
        }
    )
    
    # Schedule automatic status reset after cleaning
    background_tasks.add_task(
        auto_complete_cleaning,
        table_id,
        original_status,
        cleaning_end_time.isoformat()
    )
    
    # Log the action
    await log_audit(
        "payment_completed",
        "table",
        table_id,
        {
            "paymentId": data.get("paymentId"),
            "amount": data.get("amount"),
            "method": data.get("paymentMethod")
        }
    )
    
    return {
        "success": True,
        "message": f"Payment completed. Table now cleaning (ready in 5 minutes)",
        "status": "cleaning",
        "cleaningEndTime": cleaning_end_time.isoformat() + 'Z',
        "nextStatus": original_status,
        "nextStep": "cleaning"
    }


# ============ BACKGROUND TASKS ============

async def auto_release_walk_in_table(table_id: str, blocking_until_time: str):
    """
    Background task: If walk-in guest doesn't arrive within 15 minutes,
    automatically release the table back to 'available' status
    """
    try:
        db = get_db()
        
        # Parse the blocking time
        blocking_until = datetime.fromisoformat(blocking_until_time.replace('Z', '+00:00'))
        
        # Wait until blocking time expires (or a bit more to be safe)
        wait_seconds = (blocking_until - datetime.utcnow()).total_seconds()
        
        if wait_seconds > 0:
            import asyncio
            await asyncio.sleep(wait_seconds)
        
        # Check if guest has arrived
        table = await db.tables.find_one({"_id": ObjectId(table_id)})
        
        if table and table.get("status") == "walk-in-blocked":
            # Guest didn't arrive, release the table
            await db.tables.update_one(
                {"_id": ObjectId(table_id)},
                {
                    "$set": {
                        "status": "available",
                        "reservationType": None,
                        "reservationStatus": "expired",
                        "blockingTimeout": None,
                        "customerName": None,
                        "guestCount": None,
                        "updatedAt": datetime.utcnow().isoformat() + 'Z'
                    }
                }
            )
            
            # Log the auto-release
            await log_audit(
                "walk_in_timeout",
                "table",
                table_id,
                {"reason": "Guest did not arrive within 15 minutes"}
            )
    except Exception as e:
        print(f"Error in auto_release_walk_in_table: {e}")


async def auto_complete_cleaning(table_id: str, original_status: str, cleaning_end_time: str):
    """
    Background task: After 5 minutes of cleaning, return table to original status
    (usually 'available' or 'reserved')
    """
    try:
        db = get_db()
        
        # Parse the cleaning end time
        end_time = datetime.fromisoformat(cleaning_end_time.replace('Z', '+00:00'))
        
        # Wait until cleaning time expires
        wait_seconds = (end_time - datetime.utcnow()).total_seconds()
        
        if wait_seconds > 0:
            import asyncio
            await asyncio.sleep(wait_seconds)
        
        # Return table to original status
        table = await db.tables.find_one({"_id": ObjectId(table_id)})
        
        if table and table.get("status") == "cleaning":
            # Clear all order/guest data
            final_status = original_status if original_status else "available"
            
            await db.tables.update_one(
                {"_id": ObjectId(table_id)},
                {
                    "$set": {
                        "status": final_status,
                        "currentOrderId": None,
                        "orders": [],
                        "waiterId": None,
                        "waiterName": None,
                        "guestCount": None,
                        "customerName": None,
                        "billGenerated": False,
                        "billId": None,
                        "billAmount": None,
                        "paymentId": None,
                        "occupiedAt": None,
                        "arrivalTime": None,
                        "orderCreatedAt": None,
                        "orderAcceptedAt": None,
                        "preparationStartedAt": None,
                        "orderReadyAt": None,
                        "paymentCompletedAt": None,
                        "cleaningStartedAt": None,
                        "cleaningEndTime": None,
                        "updatedAt": datetime.utcnow().isoformat() + 'Z'
                    }
                }
            )
            
            # Log the cleaning completion
            await log_audit(
                "cleaning_completed",
                "table",
                table_id,
                {"newStatus": final_status}
            )
    except Exception as e:
        print(f"Error in auto_complete_cleaning: {e}")
