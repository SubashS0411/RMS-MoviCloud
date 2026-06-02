"""Client Reservations routes – FastAPI + Motor (async MongoDB).
Tables migrated from SQLite to MongoDB 'tables' collection (shared with admin).
"""
from __future__ import annotations

from typing import Optional
from datetime import datetime
import re
from fastapi import APIRouter, HTTPException, Query
from bson import ObjectId

from ...db import get_db
from ..schemas import ReservationCreate, WaitingQueueJoin

router = APIRouter()

# ── Default time slots (used when collection is empty) ──
DEFAULT_TIME_SLOTS = [
    {"label": "7:30 AM – 8:50 AM",  "startTime": "07:30", "endTime": "08:50"},
    {"label": "9:10 AM – 10:30 AM", "startTime": "09:10", "endTime": "10:30"},
    {"label": "12:00 PM – 1:20 PM", "startTime": "12:00", "endTime": "13:20"},
    {"label": "1:40 PM – 3:00 PM",  "startTime": "13:40", "endTime": "15:00"},
    {"label": "6:40 PM – 8:00 PM",  "startTime": "18:40", "endTime": "20:00"},
    {"label": "8:20 PM – 9:40 PM",  "startTime": "20:20", "endTime": "21:40"},
]


def _serialize_time_slot(doc: dict) -> dict:
    return {
        "id": str(doc.get("_id", "")),
        "label": doc.get("label", ""),
        "startTime": doc.get("startTime", ""),
        "endTime": doc.get("endTime", ""),
    }


def _utc_now() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _table_filter(table_id: str) -> Optional[dict]:
    """Build a MongoDB filter to find a table by its ID (ObjectId or legacy tableId)."""
    if not table_id:
        return None
    try:
        return {"_id": ObjectId(table_id)}
    except Exception:
        # Fallback: try matching by tableId field (legacy data)
        return {"tableId": table_id}


def _serialize_table(doc: dict) -> dict:
    # Admin stores tables with _id, name, displayNumber etc.
    # Map to the client-expected shape.
    # Prefer the explicit tableId, then displayNumber/name/tableNumber before
    # falling back to the raw ObjectId string.
    table_id = (
        doc.get("tableId")
        or doc.get("displayNumber")
        or doc.get("name")
        or doc.get("tableNumber")
        or str(doc.get("_id", ""))
    )
    table_name = (
        doc.get("tableName")
        or doc.get("displayNumber")
        or doc.get("name")
        or doc.get("tableNumber")
        or table_id
    )
    # Normalise status to lowercase so the client can compare consistently.
    raw_status = doc.get("status") or "available"
    status = raw_status.lower()
    return {
        "tableId": table_id,
        "tableName": table_name,
        "location": doc.get("location", ""),
        "segment": doc.get("segment", ""),
        "capacity": doc.get("capacity", 0),
        "status": status,
    }


def _serialize_reservation(doc: dict) -> dict:
    return {
        "reservationId": doc.get("reservationId"),
        "userId": doc.get("userId"),
        "tableNumber": doc.get("tableNumber"),
        "date": doc.get("date"),
        "timeSlot": doc.get("timeSlot"),
        "guests": doc.get("guests"),
        "location": doc.get("location"),
        "segment": doc.get("segment"),
        "userName": doc.get("userName"),
        "userPhone": doc.get("userPhone"),
        "status": doc.get("status"),
    }


def _serialize_waiting(doc: dict) -> dict:
    return {
        "queueId": doc.get("queueId"),
        "userId": doc.get("userId"),
        "date": doc.get("date"),
        "timeSlot": doc.get("timeSlot"),
        "guests": doc.get("guests"),
        "position": doc.get("position"),
        "estimatedWait": doc.get("estimatedWait"),
    }


@router.get("/time-slots")
async def list_time_slots():
    """Return configured reservation time slots (admin-managed)."""
    db = get_db()
    coll = db.get_collection("reservation_time_slots")
    rows = await coll.find().sort([("startTime", 1)]).to_list(length=100)
    if not rows:
        # Seed defaults on first request
        for slot in DEFAULT_TIME_SLOTS:
            await coll.insert_one({**slot, "createdAt": datetime.utcnow()})
        rows = await coll.find().sort([("startTime", 1)]).to_list(length=100)
    return {"timeSlots": [_serialize_time_slot(s) for s in rows]}


@router.get("/tables")
async def list_tables():
    db = get_db()
    tables = db.get_collection("tables")
    cursor = tables.find().sort([("tableId", 1)])
    rows = await cursor.to_list(length=200)
    return {"tables": [_serialize_table(t) for t in rows]}


@router.get("/reservations")
async def list_reservations(userId: Optional[str] = Query(None)):
    db = get_db()
    reservations = db.get_collection("reservations")
    query = {"userId": userId} if userId else {}
    cursor = reservations.find(query).sort([("date", -1), ("timeSlot", 1)])
    rows = await cursor.to_list(length=1000)
    return {"reservations": [_serialize_reservation(r) for r in rows]}


@router.post("/reservations", status_code=201)
async def create_reservation(body: ReservationCreate):
    db = get_db()
    reservations = db.get_collection("reservations")

    table_number = body.tableNumber
    if table_number is None:
        table_number = await _get_next_available_table(db, body.date, body.timeSlot)
        if table_number is None:
            raise HTTPException(status_code=409, detail="no_tables_available")

    doc = {
        "reservationId": body.reservationId,
        "userId": body.userId,
        "tableNumber": str(table_number),
        "date": body.date,
        "timeSlot": body.timeSlot,
        "guests": body.guests,
        "location": body.location,
        "segment": body.segment,
        "userName": body.userName,
        "userPhone": body.userPhone,
        "status": body.status,
        "createdAt": _utc_now(),
        "updatedAt": _utc_now(),
    }

    await reservations.update_one(
        {"reservationId": doc["reservationId"]},
        {"$set": doc},
        upsert=True,
    )

    # Mark the table as reserved in the tables collection so admin sees it
    tables_coll = db.get_collection("tables")
    table_filter = _table_filter(str(table_number))
    if table_filter:
        result = await tables_coll.update_one(
            table_filter,
            {"$set": {
                "status": "reserved",
                "reservedFor": body.userName,
                "reservationTime": body.timeSlot,
                "reservationDate": body.date,
                "updatedAt": datetime.utcnow(),
            }},
        )

    return _serialize_reservation(doc)


@router.delete("/reservations/{reservation_id}")
async def delete_reservation(reservation_id: str):
    db = get_db()
    reservations = db.get_collection("reservations")

    # Find the reservation first so we can free the table
    reservation = await reservations.find_one({"reservationId": reservation_id})
    if not reservation:
        raise HTTPException(status_code=404, detail="not_found")

    await reservations.delete_one({"reservationId": reservation_id})

    # Free the table back to available in the tables collection
    table_number = reservation.get("tableNumber")
    if table_number:
        tables_coll = db.get_collection("tables")
        table_filter = _table_filter(str(table_number))
        if table_filter:
            await tables_coll.update_one(
                table_filter,
                {"$set": {
                    "status": "available",
                    "reservedFor": None,
                    "reservationTime": None,
                    "reservationDate": None,
                    "updatedAt": datetime.utcnow(),
                }},
            )

    return {"ok": True}


@router.get("/reservations/active")
async def get_active_reservation(userId: str = Query(...)):
    """Check if the user has a reservation whose time slot is active right now."""
    db = get_db()
    reservations = db.get_collection("reservations")

    now = datetime.now()
    today_str = now.strftime("%Y-%m-%d")
    current_minutes = now.hour * 60 + now.minute

    # Get user's reservations for today
    cursor = reservations.find({"userId": userId, "date": today_str})
    today_reservations = await cursor.to_list(length=100)

    for res in today_reservations:
        time_slot = res.get("timeSlot", "")
        start_min, end_min = _parse_time_slot_range(time_slot)

        # Already activated — only keep showing it while the time slot hasn't ended
        if res.get("status") == "Active":
            if end_min is None or current_minutes <= end_min:
                return {"active": True, "reservation": _serialize_reservation(res)}
            # Time slot is over — treat as inactive
            continue

        # Pending reservation — show once the window starts and until it ends
        if start_min is not None and start_min <= current_minutes <= end_min:
            return {"active": True, "reservation": _serialize_reservation(res)}

    return {"active": False, "reservation": None}


@router.post("/reservations/{reservation_id}/activate")
async def activate_reservation(reservation_id: str):
    """
    Activate a reservation when the customer arrives / time slot starts.
    - Sets reservation status to Active
    - Changes table status to occupied
    - Auto-assigns the waiter with the fewest currently-assigned tables
    """
    db = get_db()
    reservations = db.get_collection("reservations")
    tables_coll = db.get_collection("tables")
    staff_coll = db.get_collection("staff")

    reservation = await reservations.find_one({"reservationId": reservation_id})
    if not reservation:
        raise HTTPException(status_code=404, detail="not_found")

    table_number = reservation.get("tableNumber")

    # Find waiter with fewest assigned tables
    waiter_id, waiter_name = await _find_least_busy_waiter(db)

    # Update reservation status
    await reservations.update_one(
        {"reservationId": reservation_id},
        {"$set": {"status": "Active", "waiterId": waiter_id, "waiterName": waiter_name, "updatedAt": _utc_now()}},
    )

    # Update table to occupied + assign waiter
    table_display = table_number  # fallback

    # ── Create a dine-in order so waiter sees it on the orders page ──
    orders_coll = db.get_collection("orders")
    order_count = await orders_coll.count_documents({})
    new_order_id = ObjectId()

    if table_number:
        table_filter = _table_filter(str(table_number))
        if table_filter:
            table_doc = await tables_coll.find_one(table_filter)
            if table_doc:
                table_display = table_doc.get("name") or table_doc.get("displayNumber") or table_number
            await tables_coll.update_one(
                table_filter,
                {"$set": {
                    "status": "occupied",
                    "waiterId": waiter_id,
                    "waiterName": waiter_name,
                    "currentOrderId": str(new_order_id),
                    "occupiedAt": datetime.utcnow(),
                    "updatedAt": datetime.utcnow(),
                }},
            )
    order_number = f"#ORD-{order_count + 1001}"

    order_doc = {
        "_id": new_order_id,
        "id": str(new_order_id),
        "orderNumber": order_number,
        "tableNumber": table_display,
        "customerName": reservation.get("userName", "Customer"),
        "items": [],
        "total": 0,
        "status": "placed",
        "type": "dine-in",
        "waiterId": waiter_id,
        "waiterName": waiter_name,
        "reservationId": reservation_id,
        "guests": reservation.get("guests"),
        "createdAt": datetime.utcnow().isoformat() + "Z",
        "statusUpdatedAt": datetime.utcnow().isoformat() + "Z",
    }

    await orders_coll.insert_one(order_doc)

    # Notify the waiter about the new reservation order
    notif_coll = db.get_collection("notifications")
    await notif_coll.insert_one({
        "type": "order",
        "title": f"New Reservation Order {order_number}",
        "message": f"Table {table_display} — {reservation.get('userName', 'Customer')} ({reservation.get('guests', 0)} guests) has requested an order.",
        "recipient": "waiter",
        "recipientId": waiter_id,
        "channel": "system",
        "status": "unread",
        "orderId": str(new_order_id),
        "created_at": datetime.utcnow(),
    })

    return {
        "ok": True,
        "waiterId": waiter_id,
        "waiterName": waiter_name,
        "orderId": str(new_order_id),
        "orderNumber": order_number,
        "reservation": _serialize_reservation({
            **reservation,
            "status": "Active",
            "waiterId": waiter_id,
            "waiterName": waiter_name,
        }),
    }


@router.get("/reservations/availability")
async def availability(
    date: str = Query(...),
    timeSlot: str = Query(...),
    location: str = Query("any"),
    segment: str = Query("any"),
    guests: int = Query(2),
):
    db = get_db()

    # Get reserved table numbers for overlapping time ranges
    reservations = db.get_collection("reservations")
    req_start, req_end = _parse_time_slot_range(timeSlot)
    reserved_cursor = reservations.find({"date": date}, {"tableNumber": 1, "timeSlot": 1})
    reserved_docs = await reserved_cursor.to_list(length=500)
    reserved_table_ids = set()
    for r in reserved_docs:
        r_start, r_end = _parse_time_slot_range(r.get("timeSlot", ""))
        if r_start is not None and req_start is not None:
            # Overlap check: start1 < end2 AND start2 < end1
            if r_start < req_end and req_start < r_end:
                tn = r.get("tableNumber")
                if tn is not None:
                    reserved_table_ids.add(str(tn))

    # Get all tables from MongoDB
    tables_coll = db.get_collection("tables")
    all_tables = await tables_coll.find().sort([("name", 1)]).to_list(length=200)

    def match(t: dict) -> bool:
        loc_match = location == "any" or (t.get("location", "").lower() == location.lower())
        seg_match = segment == "any" or (segment.lower().split(" ")[0] in t.get("segment", "").lower())
        cap_match = (t.get("capacity", 0) >= guests)
        return loc_match and seg_match and cap_match

    filtered = [t for t in all_tables if match(t)]

    result = []
    for t in filtered:
        tid = str(t.get("tableId") or t.get("_id", ""))
        is_available = tid not in reserved_table_ids
        result.append({**_serialize_table(t), "isAvailable": is_available})

    show_waiting = all(not x["isAvailable"] for x in result) and len(result) > 0
    return {"tables": result, "showWaitingQueueOption": show_waiting}


# ── Reservation waiting queue ──

@router.get("/reservation-waiting-queue")
async def list_waiting_queue(userId: Optional[str] = Query(None)):
    db = get_db()
    waiting = db.get_collection("reservation_waiting_queue")
    query = {"userId": userId} if userId else {}
    cursor = waiting.find(query).sort([("date", -1), ("timeSlot", 1), ("position", 1)])
    rows = await cursor.to_list(length=1000)
    return {"entries": [_serialize_waiting(x) for x in rows]}


@router.post("/reservation-waiting-queue", status_code=201)
async def join_waiting_queue(body: WaitingQueueJoin):
    db = get_db()
    waiting = db.get_collection("reservation_waiting_queue")

    position = await _next_waiting_position(db, body.date, body.timeSlot)
    estimated_wait = f"{max(5, position * 10)}-{max(10, position * 10 + 5)} mins"

    entry = {
        "queueId": body.queueId,
        "userId": body.userId,
        "date": body.date,
        "timeSlot": body.timeSlot,
        "guests": body.guests,
        "position": position,
        "estimatedWait": estimated_wait,
        "createdAt": _utc_now(),
        "updatedAt": _utc_now(),
    }

    await waiting.update_one(
        {"queueId": entry["queueId"]},
        {"$set": entry},
        upsert=True,
    )
    return _serialize_waiting(entry)


@router.delete("/reservation-waiting-queue/{queue_id}")
async def delete_waiting_entry(queue_id: str):
    db = get_db()
    waiting = db.get_collection("reservation_waiting_queue")
    result = await waiting.delete_one({"queueId": queue_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="not_found")
    return {"ok": True}


# ── Helpers ──

def _parse_time_slot_range(slot: str):
    """Parse a time slot like '7:30 AM – 8:50 AM' into (start_minutes, end_minutes) since midnight."""
    parts = re.split(r'\s*[–-]\s*', slot)
    if len(parts) != 2:
        return None, None

    def _to_minutes(t: str) -> int:
        m = re.match(r'(\d{1,2}):(\d{2})\s*(AM|PM)', t.strip(), re.IGNORECASE)
        if not m:
            return 0
        hours = int(m.group(1))
        mins = int(m.group(2))
        ampm = m.group(3).upper()
        if ampm == 'PM' and hours != 12:
            hours += 12
        if ampm == 'AM' and hours == 12:
            hours = 0
        return hours * 60 + mins

    return _to_minutes(parts[0]), _to_minutes(parts[1])


async def _find_least_busy_waiter(db):
    """Find the waiter with the fewest currently-assigned (occupied/reserved) tables."""
    staff_coll = db.get_collection("staff")
    tables_coll = db.get_collection("tables")

    # Get all active waiters
    waiters = await staff_coll.find(
        {"role": "waiter", "active": {"$ne": False}}
    ).to_list(length=100)

    if not waiters:
        return None, "Unassigned"

    # Count tables currently assigned to each waiter
    best_waiter = None
    best_count = float('inf')

    for w in waiters:
        wid = str(w["_id"])
        count = await tables_coll.count_documents({
            "waiterId": wid,
            "status": {"$in": ["occupied", "reserved", "eating", "order_accepted", "served"]},
        })
        if count < best_count:
            best_count = count
            best_waiter = w

    if best_waiter:
        return str(best_waiter["_id"]), best_waiter.get("name", "Waiter")
    return None, "Unassigned"


async def _get_next_available_table(db, date: str, time_slot: str):
    reservations = db.get_collection("reservations")
    req_start, req_end = _parse_time_slot_range(time_slot)
    cursor = reservations.find({"date": date}, {"tableNumber": 1, "timeSlot": 1})
    docs = await cursor.to_list(length=500)

    reserved = set()
    for r in docs:
        r_start, r_end = _parse_time_slot_range(r.get("timeSlot", ""))
        if r_start is not None and req_start is not None:
            if r_start < req_end and req_start < r_end:
                tn = r.get("tableNumber")
                if tn:
                    reserved.add(str(tn))

    tables_coll = db.get_collection("tables")
    all_tables = await tables_coll.find().sort([("name", 1)]).to_list(length=200)

    for t in all_tables:
        tid = str(t.get("tableId") or t.get("_id", ""))
        if tid not in reserved:
            return tid
    return None


async def _next_waiting_position(db, date: str, time_slot: str) -> int:
    waiting = db.get_collection("reservation_waiting_queue")
    count = await waiting.count_documents({"date": date, "timeSlot": time_slot})
    return int(count) + 1
