"""Client Orders routes – FastAPI + Motor (async MongoDB)."""
from __future__ import annotations

from typing import Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException, Query


from ...db import get_db
from ..schemas import OrderCreate, OrderUpdate

router = APIRouter()


def _utc_now() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _serialize_order(doc: dict) -> dict:
    return {
        "id": doc.get("id"),
        "userId": doc.get("userId"),
        "items": doc.get("items", []),
        "subtotal": doc.get("subtotal"),
        "tax": doc.get("tax"),
        "loyaltyDiscount": doc.get("loyaltyDiscount"),
        "loyaltyPointsRedeemed": doc.get("loyaltyPointsRedeemed"),
        "total": doc.get("total"),
        "status": doc.get("status"),
        "type": doc.get("type"),
        "date": doc.get("date"),
        "deliveryAddress": doc.get("deliveryAddress"),
        "invoiceUrl": doc.get("invoiceUrl"),
        "tableNumber": doc.get("tableNumber"),
        "customerName": doc.get("customerName"),
        "source": doc.get("source", "client"),
    }


@router.get("/orders")
async def list_orders(userId: Optional[str] = Query(None)):
    db = get_db()
    orders = db.get_collection("orders")
    query = {"userId": userId} if userId else {}
    cursor = orders.find(query).sort([("date", -1)])
    rows = await cursor.to_list(length=1000)
    return {"orders": [_serialize_order(o) for o in rows]}


@router.get("/orders/{order_id}")
async def get_order(order_id: str):
    db = get_db()
    orders = db.get_collection("orders")
    o = await orders.find_one({"id": order_id})
    if not o:
        raise HTTPException(status_code=404, detail="not_found")
    return _serialize_order(o)


@router.post("/orders", status_code=201)
async def create_order(body: OrderCreate):
    db = get_db()
    orders = db.get_collection("orders")

    doc = {
        "id": body.id,
        "userId": body.userId,
        "items": body.items,
        "subtotal": body.subtotal,
        "tax": body.tax,
        "loyaltyDiscount": body.loyaltyDiscount,
        "loyaltyPointsRedeemed": body.loyaltyPointsRedeemed,
        "total": float(body.total),
        "status": body.status,
        "type": body.type,
        "date": body.date,
        "deliveryAddress": body.deliveryAddress,
        "invoiceUrl": body.invoiceUrl,
        "tableNumber": body.tableNumber,
        "customerName": body.customerName,
        "source": body.source or "client",
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow(),
    }

    await orders.update_one({"id": doc["id"]}, {"$set": doc}, upsert=True)

    # Mark the table as occupied when a dine-in order is placed
    if body.type == "dine-in" and body.tableNumber:
        try:
            tables_col = db.get_collection("tables")
            # Try in order: custom tableId field, then displayNumber/name (admin tables),
            # then ObjectId fallback
            table = await tables_col.find_one({"tableId": body.tableNumber})
            if not table:
                table = await tables_col.find_one({"$or": [
                    {"displayNumber": body.tableNumber},
                    {"name": body.tableNumber},
                    {"tableNumber": body.tableNumber},
                ]})
            if table:
                await tables_col.update_one(
                    {"_id": table["_id"]},
                    {"$set": {
                        "status": "occupied",
                        "occupiedAt": datetime.utcnow(),
                        "customerName": body.customerName or "Guest",
                        "currentGuests": 1,
                        "currentOrderId": body.id,
                        "updatedAt": datetime.utcnow(),
                    }}
                )
        except Exception as exc:
            print(f"[warn] could not mark table {body.tableNumber} as occupied: {exc}")

    # Auto-generate invoice immediately upon order placement (customer paid at checkout)
    try:
        invoices_col = db.get_collection("invoices")
        already = await invoices_col.find_one({"orderId": doc["id"]})
        if not already:
            inv_count = await invoices_col.count_documents({})
            inv_number = f"INV-{datetime.utcnow().strftime('%Y%m%d')}-{inv_count + 1001}"

            subtotal = float(body.subtotal or 0.0)
            tax_amount = float(body.tax or 0.0)
            loyalty_discount = float(body.loyaltyDiscount or 0.0)

            if tax_amount and subtotal:
                tax_percent = round(tax_amount / subtotal * 100, 2)
            else:
                tax_percent = 5.0

            invoice_doc = {
                "invoiceNumber": inv_number,
                "orderId": doc["id"],
                "userId": body.userId,
                "customerName": body.customerName or "Guest",
                "tableNumber": body.tableNumber,
                "orderType": body.type,
                "items": [
                    {
                        "name": item.get("name", ""),
                        "quantity": item.get("quantity", 1),
                        "price": item.get("price", 0),
                    }
                    for item in (body.items or [])
                ],
                "subtotal": subtotal,
                "taxPercent": tax_percent,
                "taxAmount": tax_amount,
                "discountType": "flat",
                "discountValue": loyalty_discount,
                "discountAmount": loyalty_discount,
                "grandTotal": float(body.total or 0.0),
                "paymentMethod": "online",
                "status": "paid",
                "source": "client",
                "generatedBy": "Customer (online)",
                "generatedAt": datetime.utcnow().isoformat() + "Z",
                "createdAt": datetime.utcnow(),
            }
            await invoices_col.insert_one(invoice_doc)
    except Exception as exc:
        print(f"[warn] auto-invoice on order creation failed for {doc['id']}: {exc}")

    return _serialize_order(doc)


@router.patch("/orders/{order_id}")
async def update_order(order_id: str, body: OrderUpdate):
    db = get_db()
    orders = db.get_collection("orders")
    existing = await orders.find_one({"id": order_id})
    if not existing:
        raise HTTPException(status_code=404, detail="not_found")

    updates: dict = {}
    if body.status is not None:
        updates["status"] = body.status
    if body.invoiceUrl is not None:
        updates["invoiceUrl"] = body.invoiceUrl

    if updates:
        updates["updatedAt"] = _utc_now()
        await orders.update_one({"id": order_id}, {"$set": updates})
        existing.update(updates)

    # Auto-generate invoice when an order from the client app is marked completed
    if body.status == "completed" and existing.get("source") == "client":
        # Only create once — skip if an invoice already exists for this order
        try:
            invoices_col = db.get_collection("invoices")
            already = await invoices_col.find_one({"orderId": order_id})
            if not already:
                inv_count = await invoices_col.count_documents({})
                inv_number = f"INV-{datetime.utcnow().strftime('%Y%m%d')}-{inv_count + 1001}"

                raw_subtotal = existing.get("subtotal") or existing.get("total") or 0.0
                subtotal = float(raw_subtotal)
                tax_amount = float(existing.get("tax") or 0.0)
                loyalty_discount = float(existing.get("loyaltyDiscount") or 0.0)

                if tax_amount and subtotal:
                    tax_percent = round(tax_amount / subtotal * 100, 2)
                else:
                    tax_percent = 5.0

                invoice_doc = {
                    "invoiceNumber": inv_number,
                    "orderId": order_id,
                    "userId": existing.get("userId"),
                    "customerName": existing.get("customerName") or "Guest",
                    "tableNumber": existing.get("tableNumber"),
                    "orderType": existing.get("type"),
                    "items": [
                        {
                            "name": item.get("name", ""),
                            "quantity": item.get("quantity", 1),
                            "price": item.get("price", 0),
                        }
                        for item in (existing.get("items") or [])
                    ],
                    "subtotal": subtotal,
                    "taxPercent": tax_percent,
                    "taxAmount": tax_amount,
                    "discountType": "flat",
                    "discountValue": loyalty_discount,
                    "discountAmount": loyalty_discount,
                    "grandTotal": float(existing.get("total") or 0.0),
                    "paymentMethod": "paid",
                    "status": "paid",
                    "source": "client",
                    "createdAt": datetime.utcnow(),
                }
                await invoices_col.insert_one(invoice_doc)
        except Exception as exc:
            print(f"[warn] auto-invoice on completion failed for order {order_id}: {exc}")

    return _serialize_order(existing)


@router.get("/invoices")
async def list_client_invoices(userId: Optional[str] = Query(None)):
    """Return invoices for a specific customer (by userId / email)."""
    db = get_db()
    query: dict = {"source": "client"}
    if userId:
        query["userId"] = userId
    invoices_col = db.get_collection("invoices")
    cursor = invoices_col.find(query).sort([("createdAt", -1)]).limit(50)
    docs = await cursor.to_list(length=50)

    def _serialize_invoice(doc: dict) -> dict:
        created = doc.get("createdAt")
        if hasattr(created, "isoformat"):
            created = created.isoformat() + "Z"
        return {
            "id": str(doc.get("_id", "")),
            "invoiceNumber": doc.get("invoiceNumber", ""),
            "orderId": doc.get("orderId", ""),
            "customerName": doc.get("customerName", ""),
            "tableNumber": doc.get("tableNumber"),
            "orderType": doc.get("orderType", ""),
            "items": doc.get("items", []),
            "subtotal": doc.get("subtotal", 0),
            "taxPercent": doc.get("taxPercent", 5),
            "taxAmount": doc.get("taxAmount", 0),
            "discountAmount": doc.get("discountAmount", 0),
            "grandTotal": doc.get("grandTotal", 0),
            "paymentMethod": doc.get("paymentMethod", ""),
            "status": doc.get("status", "paid"),
            "createdAt": created or "",
        }

    return {"invoices": [_serialize_invoice(d) for d in docs]}
