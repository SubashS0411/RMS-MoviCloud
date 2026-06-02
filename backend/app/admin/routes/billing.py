"""
Billing & Payment Routes
- Payments processing
- Payment history
- Reports
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from datetime import datetime, timedelta, timezone
from bson import ObjectId
from ...db import get_db
from ...audit import log_audit

router = APIRouter(tags=["Billing"])

# IST timezone (UTC+5:30) – kept for label/ID generation only
IST = timezone(timedelta(hours=5, minutes=30))

def get_ist_now():
    """Return current time as a naive UTC datetime.

    All stored timestamps use UTC so that the frontend can display them
    correctly once the 'Z' suffix is added by serialize_doc.
    """
    return datetime.utcnow()


def serialize_doc(doc):
    """Convert MongoDB document to JSON-serializable dict"""
    if doc is None:
        return None
    doc["_id"] = str(doc["_id"])
    # Convert datetime fields to ISO 8601 UTC strings so the browser
    # correctly interprets them as UTC ("Z" suffix) instead of local time.
    datetime_fields = [
        "createdAt", "updatedAt", "generatedAt", "paidAt", "servedAt",
        "statusUpdatedAt", "completedAt", "cancelledAt", "expiresAt",
        "occupiedAt", "reservedUntil",
    ]
    for field in datetime_fields:
        if field in doc and doc[field] is not None:
            if isinstance(doc[field], datetime):
                doc[field] = doc[field].isoformat() + "Z"
            elif isinstance(doc[field], str) and "T" in doc[field] and not doc[field].endswith("Z"):
                doc[field] = doc[field] + "Z"
    return doc


# ============ BILLING ENTRIES ============

@router.get("/entries")
async def list_billing_entries(
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = Query(100, le=500),
    skip: int = 0,
):
    """Get all billing entries (served orders ready for payment)"""
    db = get_db()
    query = {}
    
    if status and status != "all":
        query["status"] = status
    if date_from:
        query["createdAt"] = {"$gte": datetime.fromisoformat(date_from)}
    if date_to:
        if "createdAt" in query:
            query["createdAt"]["$lte"] = datetime.fromisoformat(date_to)
        else:
            query["createdAt"] = {"$lte": datetime.fromisoformat(date_to)}
    
    billing_entries = await db.billing.find(query).sort("createdAt", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.billing.count_documents(query)
    
    return {"data": [serialize_doc(entry) for entry in billing_entries], "total": total}


@router.get("/entries/{billing_id}")
async def get_billing_entry(billing_id: str):
    """Get single billing entry"""
    db = get_db()
    billing = await db.billing.find_one({"_id": ObjectId(billing_id)})
    if not billing:
        raise HTTPException(status_code=404, detail="Billing entry not found")
    return serialize_doc(billing)


@router.post("/process-payment")
async def process_order_payment(data: dict):
    """Process payment for a billing entry"""
    db = get_db()
    
    required_fields = ["billingId", "method", "amount"]
    for field in required_fields:
        if field not in data:
            raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
    
    billing_id = data["billingId"]
    payment_method = data["method"]
    amount = float(data["amount"])
    tips = float(data.get("tips", 0))
    
    # Get billing entry
    billing = await db.billing.find_one({"_id": ObjectId(billing_id)})
    if not billing:
        raise HTTPException(status_code=404, detail="Billing entry not found")
    
    # Create payment record
    count = await db.payments.count_documents({})
    payment_data = {
        "transactionId": f"TXN-{get_ist_now().strftime('%Y%m%d')}-{count + 1001}",
        "billingId": billing_id,
        "orderId": billing.get("orderId"),
        "orderNumber": billing.get("orderNumber"),
        "tableNumber": billing.get("tableNumber"),
        "customerName": billing.get("customerName"),
        "amount": amount,
        "tips": tips,
        "totalAmount": amount + tips,
        "method": payment_method,
        "status": "completed",
        "createdAt": get_ist_now(),
    }
    
    payment_result = await db.payments.insert_one(payment_data)
    
    # Update billing entry
    await db.billing.update_one(
        {"_id": ObjectId(billing_id)},
        {"$set": {
            "status": "paid",
            "paymentId": str(payment_result.inserted_id),
            "paymentMethod": payment_method,
            "paidAt": get_ist_now().isoformat() + 'Z',
            "paidAmount": amount,
            "tips": tips,
        }}
    )
    
    # Update order status to completed
    if billing.get("orderId"):
        await db.orders.update_one(
            {"_id": ObjectId(billing["orderId"])},
            {"$set": {
                "status": "completed",
                "paymentStatus": "paid",
                "paymentMethod": payment_method,
                "paidAt": get_ist_now().isoformat() + 'Z',
                "completedAt": get_ist_now().isoformat() + 'Z'
            }}
        )
    
    await log_audit("payment_processed", "billing", billing_id, {
        "amount": amount,
        "method": payment_method,
        "transactionId": payment_data["transactionId"]
    })
    
    # Get created payment
    created_payment = await db.payments.find_one({"_id": payment_result.inserted_id})
    
    return {
        "success": True,
        "payment": serialize_doc(created_payment),
        "transactionId": payment_data["transactionId"]
    }


# ============ PAYMENTS ============

@router.get("")
async def list_payments(
    status: Optional[str] = None,
    method: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = Query(100, le=500),
    skip: int = 0,
):
    """Get all payments"""
    db = get_db()
    query = {}
    
    if status and status != "all":
        query["status"] = status
    if method and method != "all":
        query["method"] = method
    if date_from:
        query["createdAt"] = {"$gte": datetime.fromisoformat(date_from)}
    if date_to:
        if "createdAt" in query:
            query["createdAt"]["$lte"] = datetime.fromisoformat(date_to)
        else:
            query["createdAt"] = {"$lte": datetime.fromisoformat(date_to)}
    
    payments = await db.payments.find(query).sort("createdAt", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.payments.count_documents(query)
    
    return {"data": [serialize_doc(p) for p in payments], "total": total}


@router.get("/stats")
async def get_payment_stats():
    """Get payment statistics"""
    db = get_db()
    
    today = get_ist_now().replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = today - timedelta(days=7)
    month_start = today.replace(day=1)
    
    # Today's revenue
    today_pipeline = [
        {"$match": {"createdAt": {"$gte": today}, "status": "completed"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]
    today_result = await db.payments.aggregate(today_pipeline).to_list(1)
    today_revenue = today_result[0]["total"] if today_result else 0
    today_count = today_result[0]["count"] if today_result else 0
    
    # This week's revenue
    week_pipeline = [
        {"$match": {"createdAt": {"$gte": week_ago}, "status": "completed"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    week_result = await db.payments.aggregate(week_pipeline).to_list(1)
    week_revenue = week_result[0]["total"] if week_result else 0
    
    # This month's revenue
    month_pipeline = [
        {"$match": {"createdAt": {"$gte": month_start}, "status": "completed"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    month_result = await db.payments.aggregate(month_pipeline).to_list(1)
    month_revenue = month_result[0]["total"] if month_result else 0
    
    # By payment method
    method_pipeline = [
        {"$match": {"status": "completed"}},
        {"$group": {"_id": "$method", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]
    method_result = await db.payments.aggregate(method_pipeline).to_list(10)
    by_method = {m["_id"]: {"total": m["total"], "count": m["count"]} for m in method_result if m["_id"]}
    
    # Pending payments
    pending = await db.payments.count_documents({"status": "pending"})
    failed = await db.payments.count_documents({"status": "failed"})
    
    return {
        "todayRevenue": today_revenue,
        "todayTransactions": today_count,
        "weekRevenue": week_revenue,
        "monthRevenue": month_revenue,
        "byMethod": by_method,
        "pending": pending,
        "failed": failed,
    }


@router.get("/{payment_id}")
async def get_payment(payment_id: str):
    """Get single payment"""
    db = get_db()
    payment = await db.payments.find_one({"_id": ObjectId(payment_id)})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return serialize_doc(payment)


@router.post("")
async def create_payment(data: dict):
    """Record a payment"""
    db = get_db()
    
    # Generate transaction ID
    count = await db.payments.count_documents({})
    data["transactionId"] = f"TXN-{get_ist_now().strftime('%Y%m%d')}-{count + 1001}"
    data["createdAt"] = get_ist_now()
    data["status"] = data.get("status", "completed")
    
    result = await db.payments.insert_one(data)
    created = await db.payments.find_one({"_id": result.inserted_id})
    
    # Handle payment status
    if data.get("orderId"):
        if data["status"] == "completed":
            # Update order payment status if successful
            await db.orders.update_one(
                {"_id": ObjectId(data["orderId"])},
                {"$set": {
                    "paymentStatus": "paid",
                    "paymentMethod": data.get("method"),
                    "paidAt": get_ist_now()
                }}
            )
        elif data["status"] == "failed":
            # Reserve order for 15 minutes and notify customer
            reservation_expires = get_ist_now() + timedelta(minutes=15)
            order = await db.orders.find_one({"_id": ObjectId(data["orderId"])})
            
            await db.orders.update_one(
                {"_id": ObjectId(data["orderId"])},
                {"$set": {
                    "paymentStatus": "pending_retry",
                    "reservedUntil": reservation_expires,
                    "paymentAttempts": order.get("paymentAttempts", 0) + 1
                }}
            )
            
            # Create notification for customer
            order_number = order.get("orderNumber", "N/A")
            customer_name = order.get("customerName", "Customer")
            total = order.get("total", 0)
            
            await db.notifications.insert_one({
                "type": "payment-failed",
                "title": f"Payment Failed - Order {order_number}",
                "message": f"{customer_name}, your payment of ₹{total:.2f} failed. Order reserved for 15 minutes. Please retry.",
                "recipient": customer_name,
                "channel": "system",
                "status": "unread",
                "orderId": data["orderId"],
                "paymentId": str(result.inserted_id),
                "expiresAt": reservation_expires,
                "created_at": get_ist_now(),
            })
    
    await log_audit("create", "payment", str(result.inserted_id), {
        "amount": data.get("amount"),
        "method": data.get("method")
    })
    
    return serialize_doc(created)


@router.patch("/{payment_id}/status")
async def update_payment_status(payment_id: str, status: str):
    """Update payment status"""
    db = get_db()
    
    valid_statuses = ["pending", "completed", "failed", "refunded"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status")
    
    result = await db.payments.update_one(
        {"_id": ObjectId(payment_id)},
        {"$set": {"status": status, "updatedAt": get_ist_now()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    await log_audit("status_update", "payment", payment_id, {"status": status})
    
    return {"success": True, "status": status}


@router.post("/{payment_id}/retry")
async def retry_payment(payment_id: str, method: Optional[str] = None):
    """Retry a failed payment"""
    db = get_db()
    
    payment = await db.payments.find_one({"_id": ObjectId(payment_id)})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    if payment.get("status") != "failed":
        raise HTTPException(status_code=400, detail="Can only retry failed payments")
    
    order_id = payment.get("orderId")
    if order_id:
        order = await db.orders.find_one({"_id": ObjectId(order_id)})
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        
        # Check if reservation expired
        reserved_until = order.get("reservedUntil")
        if reserved_until and get_ist_now() > reserved_until:
            # Cancel the order
            await db.orders.update_one(
                {"_id": ObjectId(order_id)},
                {"$set": {"status": "cancelled", "cancelledAt": get_ist_now(), "cancelReason": "Payment timeout"}}
            )
            raise HTTPException(status_code=400, detail="Order reservation expired. Order has been cancelled.")
    
    # Create new payment attempt
    count = await db.payments.count_documents({})
    new_payment = {
        "transactionId": f"TXN-{get_ist_now().strftime('%Y%m%d')}-{count + 1001}",
        "orderId": order_id,
        "amount": payment.get("amount"),
        "method": method or payment.get("method"),
        "status": "pending",
        "retryOf": payment_id,
        "createdAt": get_ist_now()
    }
    
    result = await db.payments.insert_one(new_payment)
    created = await db.payments.find_one({"_id": result.inserted_id})
    
    await log_audit("retry", "payment", str(result.inserted_id), {"originalPaymentId": payment_id})
    
    return serialize_doc(created)


@router.post("/{payment_id}/refund")
async def refund_payment(payment_id: str, amount: Optional[float] = None, reason: Optional[str] = None):
    """Process a refund"""
    db = get_db()
    
    payment = await db.payments.find_one({"_id": ObjectId(payment_id)})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    if payment.get("status") != "completed":
        raise HTTPException(status_code=400, detail="Can only refund completed payments")
    
    refund_amount = amount or payment.get("amount", 0)
    
    # Update original payment
    await db.payments.update_one(
        {"_id": ObjectId(payment_id)},
        {"$set": {
            "status": "refunded",
            "refundedAt": get_ist_now(),
            "refundAmount": refund_amount,
            "refundReason": reason
        }}
    )
    
    # Create refund record
    count = await db.payments.count_documents({})
    refund_record = {
        "transactionId": f"REF-{get_ist_now().strftime('%Y%m%d')}-{count + 1}",
        "originalPaymentId": payment_id,
        "amount": -refund_amount,
        "method": payment.get("method"),
        "type": "refund",
        "status": "completed",
        "reason": reason,
        "createdAt": get_ist_now()
    }
    await db.payments.insert_one(refund_record)
    
    await log_audit("refund", "payment", payment_id, {"amount": refund_amount})
    
    return {"success": True, "refundAmount": refund_amount}


# ============ INVOICES ============

@router.get("/invoices/all")
async def list_invoices(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = Query(100, le=500),
):
    """Get all invoices"""
    db = get_db()
    query = {}
    
    if date_from:
        query["createdAt"] = {"$gte": datetime.fromisoformat(date_from)}
    if date_to:
        if "createdAt" in query:
            query["createdAt"]["$lte"] = datetime.fromisoformat(date_to)
        else:
            query["createdAt"] = {"$lte": datetime.fromisoformat(date_to)}
    
    invoices = await db.invoices.find(query).sort("createdAt", -1).limit(limit).to_list(limit)
    return [serialize_doc(inv) for inv in invoices]


@router.post("/invoices")
async def create_invoice(data: dict):
    """Create invoice and keep payments + orders in sync for revenue tracking."""
    db = get_db()

    # Generate invoice number
    count = await db.invoices.count_documents({})
    data["invoiceNumber"] = f"INV-{get_ist_now().strftime('%Y%m%d')}-{count + 1001}"

    # Use current time for when invoice is actually generated
    now = get_ist_now()
    data["createdAt"] = now
    data["generatedAt"] = now.isoformat() + "Z"
    # generatedBy is passed from the frontend; default to 'Admin' if missing
    if "generatedBy" not in data or not data["generatedBy"]:
        data["generatedBy"] = "Admin"

    result = await db.invoices.insert_one(data)
    created = await db.invoices.find_one({"_id": result.inserted_id})

    # ---- Revenue sync ----
    # When an invoice is paid, create a payment record (so billing stats pick it up)
    # and mark the linked order as completed (so analytics pick it up).
    invoice_status = str(data.get("status") or "").strip().lower()
    if invoice_status == "paid":
        amount = float(
            data.get("grandTotal")
            or data.get("total")
            or data.get("amount")
            or 0
        )
        payment_method = data.get("paymentMethod") or data.get("method") or "cash"
        order_id = data.get("orderId")
        invoice_number = data["invoiceNumber"]

        # 1. Create payment record so billing stats & daily reports count it
        pay_count = await db.payments.count_documents({})
        transaction_id = f"TXN-{now.strftime('%Y%m%d')}-{pay_count + 1001}"
        payment_doc = {
            "transactionId": transaction_id,
            "invoiceId": str(result.inserted_id),
            "invoiceNumber": invoice_number,
            "orderId": order_id,
            "orderNumber": data.get("orderNumber"),
            "tableNumber": data.get("tableNumber"),
            "customerName": data.get("customerName") or "Walk-in Customer",
            "amount": amount,
            "tips": float(data.get("tips", 0)),
            "totalAmount": amount + float(data.get("tips", 0)),
            "method": payment_method,
            "status": "completed",
            "createdAt": now,
        }
        pay_result = await db.payments.insert_one(payment_doc)

        # Store transactionId back on the invoice
        await db.invoices.update_one(
            {"_id": result.inserted_id},
            {"$set": {"transactionId": transaction_id, "paymentId": str(pay_result.inserted_id)}}
        )

        # 2. Mark the linked order as completed so analytics count it
        if order_id:
            # Support both custom string IDs (ORD-...) and ObjectId
            order = await db.orders.find_one({"id": order_id})
            if not order:
                try:
                    order = await db.orders.find_one({"_id": ObjectId(order_id)})
                except Exception:
                    order = None
            if order:
                await db.orders.update_one(
                    {"_id": order["_id"]},
                    {"$set": {
                        "status": "completed",
                        "paymentStatus": "paid",
                        "paymentMethod": payment_method,
                        "paymentId": str(pay_result.inserted_id),
                        "transactionId": transaction_id,
                        "invoiceNumber": invoice_number,
                        "paidAt": now,
                        "completedAt": now,
                        # Store the billed amount so analytics get_order_total() returns the correct value
                        "total": amount,
                        "grandTotal": amount,
                    }}
                )

        await log_audit("invoice_payment", "invoice", str(result.inserted_id), {
            "amount": amount,
            "method": payment_method,
            "transactionId": transaction_id,
            "invoiceNumber": invoice_number,
        })

    # Re-fetch to return the latest state (with transactionId if added)
    created = await db.invoices.find_one({"_id": result.inserted_id})
    return serialize_doc(created)


# ============ TAX SETTINGS ============

@router.get("/tax-settings")
async def get_tax_settings():
    """Get tax configuration"""
    db = get_db()
    
    settings = await db.settings.find_one({"key": "tax_settings"})
    if not settings:
        # Return defaults
        return {
            "gstEnabled": True,
            "cgstRate": 2.5,
            "sgstRate": 2.5,
            "serviceChargeEnabled": True,
            "serviceChargeRate": 5,
            "roundingEnabled": True,
        }
    
    return settings.get("value", {})


@router.post("/tax-settings")
async def update_tax_settings(data: dict):
    """Update tax settings"""
    db = get_db()
    
    await db.settings.update_one(
        {"key": "tax_settings"},
        {"$set": {
            "key": "tax_settings",
            "value": data,
            "updatedAt": get_ist_now()
        }},
        upsert=True
    )
    
    await log_audit("update", "tax_settings", "tax_settings")
    
    return {"success": True, "settings": data}


# ============ DAILY REPORTS ============

@router.get("/reports/daily")
async def get_daily_report(date: Optional[str] = None):
    """Get daily financial report"""
    db = get_db()
    
    if date:
        start = datetime.fromisoformat(date)
    else:
        start = get_ist_now().replace(hour=0, minute=0, second=0, microsecond=0)
    
    end = start + timedelta(days=1)
    
    # Revenue
    revenue_pipeline = [
        {"$match": {"createdAt": {"$gte": start, "$lt": end}, "status": "completed"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]
    revenue_result = await db.payments.aggregate(revenue_pipeline).to_list(1)
    
    # Orders
    orders_pipeline = [
        {"$match": {"createdAt": {"$gte": start, "$lt": end}}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    orders_result = await db.orders.aggregate(orders_pipeline).to_list(10)
    
    # By payment method
    method_pipeline = [
        {"$match": {"createdAt": {"$gte": start, "$lt": end}, "status": "completed"}},
        {"$group": {"_id": "$method", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]
    method_result = await db.payments.aggregate(method_pipeline).to_list(10)
    
    return {
        "date": start.isoformat()[:10],
        "revenue": revenue_result[0]["total"] if revenue_result else 0,
        "transactions": revenue_result[0]["count"] if revenue_result else 0,
        "ordersByStatus": {o["_id"]: o["count"] for o in orders_result if o["_id"]},
        "byPaymentMethod": {m["_id"]: {"total": m["total"], "count": m["count"]} for m in method_result if m["_id"]},
    }


# ============ ORDER-BILLING INTEGRATION ============

@router.post("/process-order-payment")
async def process_order_payment(data: dict):
    """
    Process payment for an order.
    Creates payment record and updates order payment status.
    
    Expected data:
    {
        "orderId": "...",
        "method": "cash|card|upi|wallet",
        "amount": 500.00,
        "tips": 50.00  // optional
    }
    """
    db = get_db()
    
    order_id = data.get("orderId")
    method = data.get("method", "cash")
    amount = data.get("amount")
    tips = data.get("tips", 0)
    
    if not order_id or not amount:
        raise HTTPException(status_code=400, detail="orderId and amount are required")
    
    # Get order details — support both custom string id (ORD-...) and ObjectId
    order = await db.orders.find_one({"id": order_id})
    if not order:
        try:
            order = await db.orders.find_one({"_id": ObjectId(order_id)})
        except Exception:
            pass
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Check if already paid
    if order.get("paymentStatus") == "paid":
        raise HTTPException(status_code=400, detail="Order already paid")
    
    # Generate transaction ID
    count = await db.payments.count_documents({})
    transaction_id = f"TXN-{get_ist_now().strftime('%Y%m%d')}-{count + 1001}"
    
    # Create payment record
    payment_data = {
        "orderId": order_id,
        "orderNumber": order.get("orderNumber"),
        "tableNumber": order.get("tableNumber"),
        "transactionId": transaction_id,
        "amount": amount,
        "tips": tips,
        "total": amount + tips,
        "method": method,
        "status": "completed",
        "createdAt": get_ist_now()
    }
    
    result = await db.payments.insert_one(payment_data)
    
    # Update order payment status (use the _id from the fetched order document)
    await db.orders.update_one(
        {"_id": order["_id"]},
        {"$set": {
            "paymentStatus": "paid",
            "paymentMethod": method,
            "paidAt": get_ist_now(),
            "paymentId": str(result.inserted_id)
        }}
    )
    
    # Create invoice record so it appears in the billing Invoices tab
    inv_count = await db.invoices.count_documents({})
    invoice_number = f"INV-{get_ist_now().strftime('%Y%m%d')}-{inv_count + 1001}"
    items = order.get("items", [])
    subtotal = sum(
        float(i.get("price", 0)) * int(i.get("quantity", 1))
        for i in items
    )
    
    # Use current time for when the invoice/payment was actually processed
    invoice_time = get_ist_now()
    
    invoice_data = {
        "invoiceNumber": invoice_number,
        "orderId": order_id,
        "orderNumber": order.get("orderNumber") or order.get("id"),
        "tableNumber": order.get("tableNumber") or order.get("table"),
        "customerName": order.get("customerName") or order.get("customer_name") or "Walk-in Customer",
        "customerPhone": order.get("customerPhone") or order.get("phone", ""),
        "orderType": order.get("orderType") or order.get("type", "takeaway"),
        "items": items,
        "subtotal": subtotal,
        "taxPercent": 0,
        "taxAmount": 0,
        "discountType": "fixed",
        "discountValue": 0,
        "discountAmount": 0,
        "grandTotal": amount,
        "paymentMethod": method,
        "transactionId": transaction_id,
        "status": "paid",
        "source": order.get("source", "admin"),
        "generatedBy": "System",
        "createdAt": invoice_time,
        "generatedAt": invoice_time.isoformat() + "Z",
    }
    await db.invoices.insert_one(invoice_data)

    await log_audit("payment", "order", order_id, {
        "amount": amount,
        "method": method,
        "transactionId": transaction_id,
        "invoiceNumber": invoice_number
    })
    
    return {
        "success": True,
        "paymentId": str(result.inserted_id),
        "transactionId": transaction_id,
        "invoiceNumber": invoice_number,
        "amount": amount,
        "method": method
    }


@router.get("/order/{order_id}/payment")
async def get_order_payment(order_id: str):
    """Get payment details for an order"""
    db = get_db()
    
    # Find payment by orderId
    payment = await db.payments.find_one({"orderId": order_id})
    if not payment:
        return {"found": False}
    
    return serialize_doc(payment)


@router.post("/checkout")
async def checkout_order(data: dict):
    """
    Complete checkout process for an order.
    Processes payment and marks order as completed in one call.
    
    Expected data:
    {
        "orderId": "...",
        "method": "cash|card|upi|wallet",
        "amount": 500.00,
        "tips": 50.00  // optional
    }
    """
    db = get_db()
    
    # First process payment
    payment_result = await process_order_payment(data)
    
    order_id = data.get("orderId")
    
    # Then mark order as completed
    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {
            "status": "completed",
            "statusUpdatedAt": get_ist_now(),
            "completedAt": get_ist_now()
        }}
    )
    
    await log_audit("checkout", "order", order_id, {
        "payment": payment_result
    })
    
    return {
        "success": True,
        "message": "Order completed and paid",
        "payment": payment_result
    }

