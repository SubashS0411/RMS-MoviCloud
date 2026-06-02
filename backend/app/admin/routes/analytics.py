"""
Analytics Routes
"""

from fastapi import APIRouter
from datetime import datetime, timedelta, timezone
import re
from ...db import get_db

router = APIRouter(tags=["Analytics"])


# -------------------------
# Helper Functions
# -------------------------

def to_number(value, default: float = 0.0) -> float:
    if value is None:
        return default
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        cleaned = value.replace(",", "").strip()
        if cleaned == "":
            return default
        try:
            return float(cleaned)
        except ValueError:
            return default
    return default


def parse_datetime(value):
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo:
            return value.astimezone(timezone.utc).replace(tzinfo=None)
        return value
    if isinstance(value, str):
        text = value.strip()
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        try:
            parsed = datetime.fromisoformat(text)
            if parsed.tzinfo:
                return parsed.astimezone(timezone.utc).replace(tzinfo=None)
            return parsed
        except ValueError:
            return None
    return None


def normalize_status(value) -> str:
    return str(value or "").strip().lower()


def _safe_int(value, default: int = 0) -> int:
    """Safely convert a value to int"""
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def normalize_order_type(order: dict) -> str:
    raw = str(order.get("type") or order.get("orderType") or order.get("order_type") or "unknown").strip().lower()
    if raw in {"dinein", "dine-in", "dine_in"}:
        return "dine-in"
    if raw in {"pickup", "take away", "take-away"}:
        return "takeaway"
    return raw or "unknown"

def extract_items(order: dict):
    items = []
    raw_items = order.get("items") or []

    for raw in raw_items:
        if isinstance(raw, dict):
            quantity = int(to_number(raw.get("quantity") or 1, 1))
            name = raw.get("name") or "Item"
            price = to_number(raw.get("price"), 0)
            category = raw.get("category") or ""
            items.append({
                "name": name,
                "quantity": quantity,
                "price": price,
                "category": category,
            })
    return items


def get_order_datetime(order: dict):
    """Extract datetime from an order document"""
    for field in ("createdAt", "created_at", "date", "orderDate"):
        val = order.get(field)
        if val:
            return parse_datetime(val)
    return None


def get_order_total(order: dict) -> float:
    """Calculate total value of an order"""
    total = to_number(order.get("total") or order.get("totalAmount") or order.get("amount"), None)
    if total is not None:
        return total
    return sum(item["price"] * item["quantity"] for item in extract_items(order))


# -------------------------
# Main Analytics
# -------------------------

@router.get("")
async def get_analytics():
    db = get_db()
    all_orders = await db.orders.find({}).to_list(50000)

    # Total orders
    total_orders = len(all_orders)
    invoice_count = await db.invoices.count_documents({})
    active_orders = sum(1 for o in all_orders if normalize_status(o.get("status")) in ["pending", "confirmed", "preparing", "ready"])

    # Revenue: invoices are the primary source of truth for actual payments.
    # Use grandTotal from paid invoices + revenue from completed orders that have no invoice.
    all_invoices = await db.invoices.find({"status": "paid"}).to_list(50000)
    completed_orders = len(all_invoices)  # paid invoices = completed transactions

    # All gross revenue from paid invoices
    invoice_revenue = sum(
        to_number(inv.get("grandTotal") or inv.get("total") or inv.get("amount"), 0)
        for inv in all_invoices
    )

    # Build a set of order IDs that already have a paid invoice (to avoid double-counting)
    invoiced_order_ids: set = set()
    for inv in all_invoices:
        oid = str(inv.get("orderId") or "").strip()
        if oid:
            invoiced_order_ids.add(oid)

    # Revenue from completed orders that DON'T have a corresponding paid invoice
    order_only_revenue = sum(
        get_order_total(o)
        for o in all_orders
        if normalize_status(o.get("status")) == "completed"
        and str(o.get("id") or "") not in invoiced_order_ids
        and str(o.get("_id") or "") not in invoiced_order_ids
    )

    total_revenue = invoice_revenue + order_only_revenue

    avg_order_value = round(total_revenue / invoice_count, 2) if invoice_count > 0 else 0.0

    # Popular items with revenue and prep time
    popular_map = {}
    item_prep_times = {}  # Track prep times for each item
    
    for order in all_orders:
        # Calculate prep time for this order
        prep_time = None
        if normalize_status(order.get("status")) in ["completed", "delivered"]:
            created_at = get_order_datetime(order)
            completed_at = parse_datetime(order.get("completedAt") or order.get("completed_at"))
            
            if created_at and completed_at:
                prep_time_mins = (completed_at - created_at).total_seconds() / 60
                if 0 < prep_time_mins < 300:  # Sanity check: between 0 and 5 hours
                    prep_time = prep_time_mins
        
        for item in extract_items(order):
            key = item["name"]
            if key not in popular_map:
                popular_map[key] = {"name": key, "count": 0, "revenue": 0.0}
                item_prep_times[key] = []
            
            popular_map[key]["count"] += item["quantity"]
            popular_map[key]["revenue"] += item["price"] * item["quantity"]
            
            # Add prep time if available
            if prep_time is not None:
                item_prep_times[key].append(prep_time)
    
    # Calculate average prep time for each item
    for key, data in popular_map.items():
        prep_times = item_prep_times.get(key, [])
        if prep_times:
            data["avgPrepTime"] = round(sum(prep_times) / len(prep_times))
        else:
            data["avgPrepTime"] = 0

    popular_items = sorted(popular_map.values(), key=lambda item: item["count"], reverse=True)[:10]

    # Table occupancy
    total_tables = _safe_int(await db.tables.count_documents({}))
    occupied_tables = _safe_int(await db.tables.count_documents({"status": "occupied"}))
    table_occupancy = round((occupied_tables / total_tables * 100), 1) if total_tables > 0 else 0.0

    # Order type breakdown
    order_types = {}
    for order in all_orders:
        order_type = normalize_order_type(order)
        order_types[order_type] = order_types.get(order_type, 0) + 1

    # Category distribution
    category_map = {}
    for order in all_orders:
        for item in extract_items(order):
            category = item.get("category") or "Other"
            category_map[category] = category_map.get(category, 0) + item["quantity"]
    categories = [{"name": name, "value": count} for name, count in sorted(category_map.items(), key=lambda row: row[1], reverse=True)]

    # Total customers
    total_customers = await db.customers.count_documents({})
    if total_customers == 0:
        customer_keys = set()
        for order in all_orders:
            key = (
                str(order.get("customerId") or "").strip()
                or str(order.get("customerPhone") or "").strip()
                or str(order.get("customerName") or "").strip().lower()
            )
            if key:
                customer_keys.add(key)
        total_customers = len(customer_keys)

    # Staff counts
    total_staff = await db.staff.count_documents({"active": True})
    on_duty_staff = await db.staff.count_documents({"active": True, "status": "on-duty"})
    on_leave_staff = await db.staff.count_documents({"active": True, "status": "on-leave"})

    return {
        "success": True,
        "data": {
            "totalOrders": total_orders,
            "completedOrders": completed_orders,
            "invoiceCount": invoice_count,
            "activeOrders": active_orders,
            "totalRevenue": round(total_revenue, 2),
            "avgOrderValue": avg_order_value,
            "popularItems": popular_items,
            "tableOccupancy": table_occupancy,
            "totalCustomers": total_customers,
            "orderTypes": order_types,
            "categoryDistribution": categories,
            "totalStaff": total_staff,
            "onDutyStaff": on_duty_staff,
            "onLeaveStaff": on_leave_staff,
        }
    }


@router.get("/daily")
async def get_daily_analytics(date: str = None):
    """Get analytics for a specific date"""
    db = get_db()
    
    if date:
        target_date = datetime.fromisoformat(date)
    else:
        target_date = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    next_day = target_date + timedelta(days=1)
    
    all_orders = await db.orders.find({}).to_list(50000)
    day_orders = []
    for order in all_orders:
        order_dt = get_order_datetime(order)
        if order_dt and target_date <= order_dt < next_day:
            day_orders.append(order)

    total_orders = len(day_orders)
    completed_count = sum(1 for order in day_orders if normalize_status(order.get("status")) == "completed")

    # Revenue: invoices are primary source; add completed orders without an invoice.
    day_invoices = await db.invoices.find({
        "status": "paid",
        "createdAt": {"$gte": target_date, "$lt": next_day},
    }).to_list(50000)

    invoice_revenue = sum(
        to_number(inv.get("grandTotal") or inv.get("total") or inv.get("amount"), 0)
        for inv in day_invoices
    )

    invoiced_day_order_ids: set = set()
    for inv in day_invoices:
        oid = str(inv.get("orderId") or "").strip()
        if oid:
            invoiced_day_order_ids.add(oid)

    order_only_revenue = sum(
        get_order_total(o)
        for o in day_orders
        if normalize_status(o.get("status")) == "completed"
        and str(o.get("id") or "") not in invoiced_day_order_ids
        and str(o.get("_id") or "") not in invoiced_day_order_ids
    )
    total_revenue = invoice_revenue + order_only_revenue

    hourly_buckets = {}
    # Count all orders (for order count), and revenue for orders without an invoice
    for order in day_orders:
        order_dt = get_order_datetime(order)
        if not order_dt:
            continue
        hour_key = order_dt.hour
        if hour_key not in hourly_buckets:
            hourly_buckets[hour_key] = {"hour": hour_key, "orders": 0, "revenue": 0.0}
        hourly_buckets[hour_key]["orders"] += 1
        if normalize_status(order.get("status")) == "completed":
            # Only count order revenue if no corresponding invoice (to avoid double-counting)
            if (str(order.get("id") or "") not in invoiced_day_order_ids
                    and str(order.get("_id") or "") not in invoiced_day_order_ids):
                hourly_buckets[hour_key]["revenue"] += get_order_total(order)
    # Add ALL paid invoice revenue into hourly buckets
    for inv in day_invoices:
        inv_dt = parse_datetime(inv.get("createdAt"))
        if not inv_dt:
            continue
        hour_key = inv_dt.hour
        if hour_key not in hourly_buckets:
            hourly_buckets[hour_key] = {"hour": hour_key, "orders": 0, "revenue": 0.0}
        hourly_buckets[hour_key]["revenue"] += to_number(
            inv.get("grandTotal") or inv.get("total") or inv.get("amount"), 0
        )

    hourly_result = [hourly_buckets[hour] for hour in sorted(hourly_buckets.keys())]

    return {
        "date": target_date.isoformat()[:10],
        "orders": total_orders,
        "revenue": round(total_revenue, 2),
        "completed": completed_count,
        "hourly": [{"hour": h["hour"], "orders": h["orders"], "revenue": round(h["revenue"], 2)} for h in hourly_result]
    }


@router.get("/weekly")
async def get_weekly_analytics(days: int = 7):
    """Get analytics for the past N days (default 7). Use days=30 for month, days=365 for year."""
    db = get_db()

    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today - timedelta(days=days - 1)

    all_orders = await db.orders.find({}).to_list(50000)

    current_week_orders = []
    previous_week_orders = []
    prev_week_start = week_start - timedelta(days=days)
    for order in all_orders:
        order_dt = get_order_datetime(order)
        if not order_dt:
            continue
        if week_start <= order_dt < (today + timedelta(days=1)):
            current_week_orders.append(order)
        elif prev_week_start <= order_dt < week_start:
            previous_week_orders.append(order)

    daily_buckets = {}
    for offset in range(days):
        d = week_start + timedelta(days=offset)
        key = d.strftime("%Y-%m-%d")
        daily_buckets[key] = {"date": key, "orders": 0, "revenue": 0.0}

    # Build invoiced order IDs for the week to avoid double-counting
    week_invoices = await db.invoices.find({
        "status": "paid",
        "createdAt": {"$gte": week_start, "$lt": today + timedelta(days=1)},
    }).to_list(50000)
    invoiced_week_order_ids: set = set()
    for inv in week_invoices:
        oid = str(inv.get("orderId") or "").strip()
        if oid:
            invoiced_week_order_ids.add(oid)

    for order in current_week_orders:
        order_dt = get_order_datetime(order)
        if not order_dt:
            continue
        key = order_dt.strftime("%Y-%m-%d")
        if key in daily_buckets:
            daily_buckets[key]["orders"] += 1
            if normalize_status(order.get("status")) == "completed":
                # Only count order revenue if no corresponding invoice
                if (str(order.get("id") or "") not in invoiced_week_order_ids
                        and str(order.get("_id") or "") not in invoiced_week_order_ids):
                    daily_buckets[key]["revenue"] += get_order_total(order)

    # Add ALL paid invoice revenue into daily buckets
    for inv in week_invoices:
        inv_dt = parse_datetime(inv.get("createdAt"))
        if not inv_dt:
            continue
        key = inv_dt.strftime("%Y-%m-%d")
        if key in daily_buckets:
            daily_buckets[key]["revenue"] += to_number(
                inv.get("grandTotal") or inv.get("total") or inv.get("amount"), 0
            )

    daily_result = [
        {"date": row["date"], "orders": row["orders"], "revenue": round(row["revenue"], 2)}
        for row in [daily_buckets[k] for k in sorted(daily_buckets.keys())]
    ]

    current_item_counts = {}
    current_item_revenue = {}
    for order in current_week_orders:
        for item in extract_items(order):
            name = item["name"]
            current_item_counts[name] = current_item_counts.get(name, 0) + item["quantity"]
            current_item_revenue[name] = current_item_revenue.get(name, 0.0) + (item["price"] * item["quantity"])

    prev_counts = {}
    for order in previous_week_orders:
        for item in extract_items(order):
            name = item["name"]
            prev_counts[name] = prev_counts.get(name, 0) + item["quantity"]

    top_items = sorted(current_item_counts.items(), key=lambda row: row[1], reverse=True)[:10]

    def trend(item_name, curr_count):
        prev = prev_counts.get(item_name, 0)
        if prev == 0:
            # New item - return high positive value to indicate growth
            return 100 if curr_count > 0 else 0
        change = ((curr_count - prev) / prev) * 100
        return round(change)

    return {
        "startDate": week_start.isoformat()[:10],
        "endDate": today.isoformat()[:10],
        "daily": daily_result,
        "topItems": [{
            "name": name,
            "count": count,
            "revenue": round(current_item_revenue.get(name, 0.0), 2),
            "trend": trend(name, count)
        } for name, count in top_items]
    }


@router.get("/staff-performance")
async def get_staff_performance():
    """Get staff performance analytics derived from actual orders and attendance"""
    db = get_db()

    # Get all staff (default include active unless explicitly false)
    staff_docs = await db.staff.find({}).to_list(1000)
    staff_list = [s for s in staff_docs if s.get("active", True) is not False]

    # Fetch all completed orders to calculate orders handled and service time
    all_orders = await db.orders.find({}).to_list(50000)
    
    # Build performance map from actual order data
    perf_map = {}
    for order in all_orders:
        # Get waiter ID from order
        waiter_id = order.get("waiterId") or order.get("waiter_id") or order.get("assignedWaiter")
        if not waiter_id:
            continue
            
        sid = str(waiter_id).strip()
        if not sid:
            continue
            
        if sid not in perf_map:
            perf_map[sid] = {
                "orders_total": 0,
                "service_times": [],
                "ratings": [],
            }
        
        # Count orders handled
        perf_map[sid]["orders_total"] += 1
        
        # Calculate service time (from creation to completion)
        if normalize_status(order.get("status")) == "completed":
            created_at = get_order_datetime(order)
            completed_at = parse_datetime(order.get("completedAt") or order.get("completed_at"))
            
            if created_at and completed_at:
                service_time_mins = (completed_at - created_at).total_seconds() / 60
                if service_time_mins > 0 and service_time_mins < 300:  # Cap at 5 hours (sanity check)
                    perf_map[sid]["service_times"].append(service_time_mins)
        
        # Check for customer rating in order
        rating = to_number(order.get("rating") or order.get("customerRating"), None)
        if rating is not None and 0 <= rating <= 5:
            perf_map[sid]["ratings"].append(rating)

    # Get attendance data
    attendance_docs = await db.attendance.find({}).to_list(10000)
    att_map = {}
    for row in attendance_docs:
        sid = str(row.get("staffId") or "").strip()
        if not sid:
            continue
        if sid not in att_map:
            att_map[sid] = {"total": 0, "present": 0}
        att_map[sid]["total"] += 1
        if normalize_status(row.get("status")) == "present":
            att_map[sid]["present"] += 1

    # Build results for each staff member
    results = []
    for s in staff_list:
        sid = str(s["_id"])
        perf = perf_map.get(sid, {"orders_total": 0, "ratings": [], "service_times": []})
        att = att_map.get(sid, {"total": 0, "present": 0})
        
        total_att = att.get("total", 0)
        present_att = att.get("present", 0)
        attendance_pct = f"{round((present_att / total_att) * 100)}%" if total_att > 0 else "—"
        
        # Calculate averages
        avg_rating = round(sum(perf["ratings"]) / len(perf["ratings"]), 1) if perf["ratings"] else None
        avg_service = round(sum(perf["service_times"]) / len(perf["service_times"])) if perf["service_times"] else None
        
        # Calculate performance score based on multiple factors
        if avg_rating:
            performance_score = min(100, round(avg_rating * 20))
        elif perf["orders_total"] > 0:
            # If no rating but has orders, give base score
            performance_score = 50
        else:
            performance_score = None
        
        results.append({
            "id": sid,
            "name": s.get("name", ""),
            "role": s.get("role", ""),
            "orders_handled": perf["orders_total"],
            "avg_service_time": f"{avg_service} mins" if avg_service is not None else "—",
            "rating": avg_rating,
            "attendance": attendance_pct,
            "performance_score": performance_score,
        })

    # Sort by orders handled (primary metric)
    results.sort(key=lambda x: x["orders_handled"], reverse=True)
    return results
