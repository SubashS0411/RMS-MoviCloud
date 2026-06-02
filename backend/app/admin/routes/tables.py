"""
Table Management Routes
- CRUD for tables
- Table status updates
- Reservations
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from datetime import datetime, timedelta
from bson import ObjectId
from ...db import get_db
from ...audit import log_audit

router = APIRouter(tags=["Tables"])


def serialize_doc(doc):
    """Convert MongoDB document to JSON-serializable dict"""
    if doc is None:
        return None
    doc["_id"] = str(doc["_id"])
    return doc


# ============ TABLES ============

@router.get("")
async def list_tables(
    status: Optional[str] = None,
    location: Optional[str] = None,
    capacity: Optional[int] = None,
):
    """Get all tables with optional filters"""
    db = get_db()
    query = {}
    
    if status and status != "all":
        query["status"] = status
    if location and location != "all":
        query["location"] = location
    if capacity:
        query["capacity"] = {"$gte": capacity}
    
    tables = await db.tables.find(query).sort("name", 1).to_list(100)
    total = await db.tables.count_documents(query if query else {})
    
    return {"data": [serialize_doc(table) for table in tables], "total": total}


@router.get("/stats")
async def get_table_stats():
    """Get table statistics"""
    db = get_db()
    
    total = await db.tables.count_documents({})
    available = await db.tables.count_documents({"status": "available"})
    occupied = await db.tables.count_documents({"status": "occupied"})
    reserved = await db.tables.count_documents({"status": "reserved"})
    cleaning = await db.tables.count_documents({"status": "cleaning"})
    
    # Get locations
    locations = await db.tables.distinct("location")
    
    # Total capacity
    capacity_pipeline = [
        {"$group": {"_id": None, "total": {"$sum": "$capacity"}}}
    ]
    capacity_result = await db.tables.aggregate(capacity_pipeline).to_list(1)
    total_capacity = capacity_result[0]["total"] if capacity_result else 0
    
    return {
        "total": total,
        "available": available,
        "occupied": occupied,
        "reserved": reserved,
        "cleaning": cleaning,
        "locations": locations,
        "totalCapacity": total_capacity,
    }


@router.get("/locations")
async def get_locations():
    """Get all unique table locations"""
    db = get_db()
    locations = await db.tables.distinct("location")
    return locations


@router.get("/{table_id}")
async def get_table(table_id: str):
    """Get single table"""
    db = get_db()
    table = await db.tables.find_one({"_id": ObjectId(table_id)})
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    return serialize_doc(table)


@router.post("")
async def create_table(data: dict):
    """Create new table"""
    try:
        db = get_db()
        
        data["createdAt"] = datetime.utcnow()
        data["status"] = data.get("status", "available")

        # Auto-generate a human-readable tableId if not supplied
        if not data.get("tableId"):
            data["tableId"] = (
                data.get("displayNumber")
                or data.get("name")
                or data.get("tableNumber")
            )
        
        result = await db.tables.insert_one(data)
        created = await db.tables.find_one({"_id": result.inserted_id})
        
        # Try to log audit but don't fail if it doesn't work
        try:
            await log_audit("create", "table", str(result.inserted_id), {"name": data.get("name")})
        except Exception as e:
            print(f"Audit log error: {e}")
        
        return serialize_doc(created)
    except Exception as e:
        print(f"Error creating table: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to create table: {str(e)}")


@router.put("/{table_id}")
async def update_table(table_id: str, data: dict):
    """Update table"""
    db = get_db()
    
    data["updatedAt"] = datetime.utcnow()
    data.pop("_id", None)
    
    result = await db.tables.update_one(
        {"_id": ObjectId(table_id)},
        {"$set": data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Table not found")
    
    updated = await db.tables.find_one({"_id": ObjectId(table_id)})
    await log_audit("update", "table", table_id)
    
    return serialize_doc(updated)


@router.patch("/{table_id}/status")
async def update_table_status(table_id: str, status: str, data: Optional[dict] = None, guests: Optional[int] = None):
    """Update table status"""
    db = get_db()
    
    valid_statuses = ["available", "occupied", "reserved", "cleaning", "eating", "order_accepted", "served", "checked_out", "walk-in-blocked"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    update_data = {"status": status, "updatedAt": datetime.utcnow()}
    
    # Handle data from request body (preferred for complex data)
    if data:
        if status == "occupied":
            update_data["currentGuests"] = data.get("guests", guests)
            update_data["occupiedAt"] = datetime.utcnow()
        elif status == "reserved":
            update_data["reservedFor"] = data.get("customerName")
            update_data["reservationTime"] = data.get("time")
        elif status == "available":
            update_data["currentGuests"] = None
            update_data["waiter"] = None
            update_data["orders"] = []
            update_data["totalBill"] = 0
        elif status == "walk-in-blocked":
            update_data["blockingStartTime"] = datetime.utcnow()
            update_data["blockingTimeout"] = data.get("blockingTimeout")
            update_data["customerName"] = data.get("customerName")
            update_data["guestCount"] = data.get("guestCount")
        elif status == "cleaning":
            update_data["cleaningStartedAt"] = datetime.utcnow()
            update_data["cleaningEndTime"] = data.get("cleaningEndTime")
    else:
        # Handle query parameter for guests (backward compatibility)
        if status == "occupied" and guests:
            update_data["currentGuests"] = guests
            update_data["occupiedAt"] = datetime.utcnow()
        elif status == "available":
            update_data["currentGuests"] = None
            update_data["waiter"] = None
            update_data["orders"] = []
            update_data["totalBill"] = 0
    
    result = await db.tables.update_one(
        {"_id": ObjectId(table_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Table not found")
    
    await log_audit("status_update", "table", table_id, {"newStatus": status})
    
    return {"success": True, "status": status}


@router.delete("/{table_id}")
async def delete_table(table_id: str):
    """Delete table"""
    db = get_db()
    
    table = await db.tables.find_one({"_id": ObjectId(table_id)})
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    if table.get("status") == "occupied":
        raise HTTPException(status_code=400, detail="Cannot delete occupied table")
    
    await db.tables.delete_one({"_id": ObjectId(table_id)})
    await log_audit("delete", "table", table_id, {"name": table.get("name")})
    
    return {"success": True}


@router.post("/{table_id}/waiter")
async def assign_waiter(table_id: str, waiter_id: str, waiter_name: str):
    """Assign waiter to table"""
    db = get_db()
    
    table = await db.tables.find_one({"_id": ObjectId(table_id)})
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    if table.get("status") not in ["occupied", "eating"]:
        raise HTTPException(status_code=400, detail="Waiter can only be assigned to occupied tables")
    
    await db.tables.update_one(
        {"_id": ObjectId(table_id)},
        {"$set": {
            "waiterId": waiter_id,
            "waiterName": waiter_name,
            "updatedAt": datetime.utcnow()
        }}
    )
    
    await log_audit("assign_waiter", "table", table_id, {"waiterId": waiter_id, "waiterName": waiter_name})
    
    return {"success": True, "waiterId": waiter_id, "waiterName": waiter_name}


@router.delete("/{table_id}/waiter")
async def remove_waiter(table_id: str):
    """Remove waiter from table"""
    db = get_db()
    
    table = await db.tables.find_one({"_id": ObjectId(table_id)})
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    await db.tables.update_one(
        {"_id": ObjectId(table_id)},
        {"$set": {
            "waiterId": None,
            "waiterName": None,
            "updatedAt": datetime.utcnow()
        }}
    )
    
    await log_audit("remove_waiter", "table", table_id)
    
    return {"success": True}


# ============ RESERVATIONS ============

@router.get("/reservations/all")
async def list_reservations(
    date: Optional[str] = None,
    status: Optional[str] = None,
):
    """Get all reservations"""
    db = get_db()
    query = {}
    
    if date:
        query["date"] = date
    if status and status != "all":
        query["status"] = status
    
    reservations = await db.reservations.find(query).sort("time", 1).to_list(100)
    return [serialize_doc(res) for res in reservations]


@router.post("/reservations")
async def create_reservation(data: dict):
    """Create reservation"""
    db = get_db()
    
    data["createdAt"] = datetime.utcnow()
    data["status"] = data.get("status", "confirmed")
    
    result = await db.reservations.insert_one(data)
    
    # Update table status
    if data.get("tableId"):
        await db.tables.update_one(
            {"_id": ObjectId(data["tableId"])},
            {"$set": {"status": "reserved", "reservedFor": data.get("customerName")}}
        )
    
    created = await db.reservations.find_one({"_id": result.inserted_id})
    await log_audit("create", "reservation", str(result.inserted_id))
    
    return serialize_doc(created)


@router.put("/reservations/{reservation_id}")
async def update_reservation(reservation_id: str, data: dict):
    """Update reservation details"""
    db = get_db()
    
    existing = await db.reservations.find_one({"_id": ObjectId(reservation_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Reservation not found")
    
    data["updatedAt"] = datetime.utcnow()
    data.pop("_id", None)
    
    # If table is changing, update table statuses
    old_table_id = existing.get("tableId")
    new_table_id = data.get("tableId")
    
    if old_table_id != new_table_id:
        # Free old table
        if old_table_id:
            await db.tables.update_one(
                {"_id": ObjectId(old_table_id)},
                {"$set": {"status": "available", "reservedFor": None}}
            )
        # Reserve new table
        if new_table_id:
            await db.tables.update_one(
                {"_id": ObjectId(new_table_id)},
                {"$set": {"status": "reserved", "reservedFor": data.get("customerName")}}
            )
    
    await db.reservations.update_one(
        {"_id": ObjectId(reservation_id)},
        {"$set": data}
    )
    
    updated = await db.reservations.find_one({"_id": ObjectId(reservation_id)})
    await log_audit("update", "reservation", reservation_id)
    
    return serialize_doc(updated)


@router.patch("/reservations/{reservation_id}/status")
async def update_reservation_status(reservation_id: str, status: str):
    """Update reservation status"""
    db = get_db()
    
    valid_statuses = ["confirmed", "arrived", "completed", "cancelled", "no-show"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status")
    
    reservation = await db.reservations.find_one({"_id": ObjectId(reservation_id)})
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    
    await db.reservations.update_one(
        {"_id": ObjectId(reservation_id)},
        {"$set": {"status": status, "updatedAt": datetime.utcnow()}}
    )
    
    # If cancelled, free up the table
    if status in ["cancelled", "no-show", "completed"] and reservation.get("tableId"):
        await db.tables.update_one(
            {"_id": ObjectId(reservation["tableId"])},
            {"$set": {"status": "available", "reservedFor": None}}
        )
    
    return {"success": True, "status": status}


@router.delete("/reservations/{reservation_id}")
async def delete_reservation(reservation_id: str):
    """Delete reservation"""
    db = get_db()
    
    reservation = await db.reservations.find_one({"_id": ObjectId(reservation_id)})
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    
    # Free up the table
    if reservation.get("tableId"):
        await db.tables.update_one(
            {"_id": ObjectId(reservation["tableId"])},
            {"$set": {"status": "available", "reservedFor": None}}
        )
    
    await db.reservations.delete_one({"_id": ObjectId(reservation_id)})
    
    return {"success": True}


@router.post("/reset-all")
async def reset_all_tables():
    """Reset all tables to available status (admin use)"""
    db = get_db()
    reset_data = {
        "status": "available",
        "updatedAt": datetime.utcnow(),
        "currentGuests": 0,
        "guestCount": 0,
        "waiterId": None,
        "waiterName": None,
        "currentOrderId": None,
        "kitchenStatus": None,
        "cleaningEndTime": None,
    }
    result = await db.tables.update_many({}, {"$set": reset_data})
    await log_audit("reset_all", "table", "all", {"modified": result.modified_count})
    return {"success": True, "modified": result.modified_count}


# ============ RESERVATION TIME SLOTS ============

@router.get("/time-slots")
async def list_time_slots():
    """List all reservation time slots (admin view)"""
    db = get_db()
    coll = db.get_collection("reservation_time_slots")
    rows = await coll.find().sort("startTime", 1).to_list(100)
    return [
        {
            "id": str(r["_id"]),
            "label": r.get("label", ""),
            "startTime": r.get("startTime", ""),
            "endTime": r.get("endTime", ""),
        }
        for r in rows
    ]


@router.post("/time-slots")
async def create_time_slot(data: dict):
    """Create a new reservation time slot"""
    db = get_db()
    coll = db.get_collection("reservation_time_slots")
    doc = {
        "label": data.get("label", ""),
        "startTime": data.get("startTime", ""),
        "endTime": data.get("endTime", ""),
        "createdAt": datetime.utcnow(),
    }
    result = await coll.insert_one(doc)
    doc["_id"] = result.inserted_id
    return {"id": str(result.inserted_id), **{k: v for k, v in doc.items() if k != "_id"}}


@router.delete("/time-slots/{slot_id}")
async def delete_time_slot(slot_id: str):
    """Delete a reservation time slot"""
    db = get_db()
    coll = db.get_collection("reservation_time_slots")
    result = await coll.delete_one({"_id": ObjectId(slot_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Time slot not found")
    return {"success": True}
