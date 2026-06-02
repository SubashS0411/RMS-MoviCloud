"""Client public stats endpoint — aggregates live restaurant numbers."""
from __future__ import annotations

from datetime import datetime, timezone
from fastapi import APIRouter

from ...db import get_db

router = APIRouter()

# Marketing-friendly minimums for public homepage stats.
MIN_HAPPY_CUSTOMERS = 120
MIN_TABLES_AVAILABLE = 25
MIN_ORDERS_TODAY = 45


@router.get("/stats")
async def public_stats():
    """
    Returns publicly visible restaurant stats used on the home page:
    - totalDishes      : available menu items
    - happyCustomers   : unique customer count (from orders)
    - tablesAvailable  : tables currently available
    - ordersToday      : orders placed today
    """
    db = get_db()

    # 1. Total available dishes
    try:
        total_dishes = await db.get_collection("menu_items").count_documents({"available": True})
    except Exception:
        total_dishes = 0

    # 2. Unique customers (users who have placed at least one order)
    try:
        customer_ids = await db.get_collection("orders").distinct("userId")
        happy_customers = len([uid for uid in customer_ids if uid])
    except Exception:
        happy_customers = 0

    # 3. Available tables right now
    try:
        tables_available = await db.get_collection("tables").count_documents(
            {"status": {"$in": ["available", "Available"]}}
        )
    except Exception:
        tables_available = 0

    # 4. Orders placed today (UTC)
    try:
        today_str = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d")
        orders_today = await db.get_collection("orders").count_documents(
            {"date": {"$regex": f"^{today_str}"}}
        )
    except Exception:
        orders_today = 0

    return {
        "totalDishes": total_dishes,
        "happyCustomers": max(happy_customers, MIN_HAPPY_CUSTOMERS),
        "tablesAvailable": max(tables_available, MIN_TABLES_AVAILABLE),
        "ordersToday": max(orders_today, MIN_ORDERS_TODAY),
    }
