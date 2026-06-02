"""
Offers & Loyalty Routes
- Coupons CRUD
- Membership plans
- Loyalty configuration
"""

from fastapi import APIRouter, HTTPException, Request
from typing import Optional
from datetime import datetime
from bson import ObjectId
from bson.errors import InvalidId
from ...db import get_db
from ...audit import log_audit

router = APIRouter(tags=["Offers"])

ALLOWED_MEMBERSHIP_TIERS = {"silver", "gold", "platinum"}
TIER_DISPLAY_NAMES = {
    "silver": "Silver",
    "gold": "Gold",
    "platinum": "Platinum",
}
TIER_SORT_ORDER = {"silver": 1, "gold": 2, "platinum": 3}


def normalize_membership_tier(value):
    return str(value or "").strip().lower()


def serialize_doc(doc):
    """Convert MongoDB document to JSON-serializable dict"""
    if doc is None:
        return None
    doc["_id"] = str(doc["_id"])
    return doc


async def require_offers_permission(request: Request):
    """Validate staff has offers permission. Returns staff doc or raises 403."""
    db = get_db()
    staff_id = request.headers.get("x-user-id")
    if not staff_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        staff_key = ObjectId(staff_id)
    except (InvalidId, TypeError):
        staff_key = staff_id
    staff = await db.staff.find_one({"_id": staff_key})
    if not staff:
        raise HTTPException(status_code=403, detail="Forbidden")
    role_id = staff.get("role")
    role = await db.roles.find_one({"_id": role_id}) if role_id else None
    if not (role and role.get("permissions", {}).get("offers") is True):
        raise HTTPException(status_code=403, detail="Forbidden")
    return staff


# ============ COUPONS ============

@router.get("/coupons")
async def list_coupons(
    status: Optional[str] = None,
    search: Optional[str] = None,
):
    """Get all coupons"""
    db = get_db()
    query = {}
    
    if status and status != "all":
        query["status"] = status
    if search:
        query["code"] = {"$regex": search, "$options": "i"}
    
    coupons = await db.coupons.find(query).sort("createdAt", -1).to_list(200)
    
    # Update expired status
    now = datetime.utcnow().isoformat()[:10]
    for coupon in coupons:
        if coupon.get("status") == "active" and coupon.get("valid_to", "") < now:
            coupon["status"] = "expired"
            await db.coupons.update_one(
                {"_id": coupon["_id"]},
                {"$set": {"status": "expired"}}
            )
    
    return [serialize_doc(coupon) for coupon in coupons]


@router.get("/coupons/stats")
async def get_coupon_stats():
    """Get coupon statistics"""
    db = get_db()
    
    total = await db.coupons.count_documents({})
    active = await db.coupons.count_documents({"status": "active"})
    expired = await db.coupons.count_documents({"status": "expired"})
    
    # Total usage
    usage_pipeline = [
        {"$group": {"_id": None, "total": {"$sum": "$usage_count"}}}
    ]
    usage_result = await db.coupons.aggregate(usage_pipeline).to_list(1)
    total_usage = usage_result[0]["total"] if usage_result else 0
    
    return {
        "total": total,
        "active": active,
        "expired": expired,
        "totalUsage": total_usage,
    }


@router.get("/coupons/validate/{code}")
async def validate_coupon(code: str, order_total: float = 0):
    """Validate a coupon code"""
    db = get_db()
    
    coupon = await db.coupons.find_one({"code": code.upper()})
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    
    now = datetime.utcnow().isoformat()[:10]
    
    if coupon.get("status") != "active":
        raise HTTPException(status_code=400, detail="Coupon is not active")
    
    if coupon.get("valid_from", "") > now:
        raise HTTPException(status_code=400, detail="Coupon is not yet valid")
    
    if coupon.get("valid_to", "") < now:
        raise HTTPException(status_code=400, detail="Coupon has expired")
    
    if coupon.get("usage_count", 0) >= coupon.get("usage_limit", float("inf")):
        raise HTTPException(status_code=400, detail="Coupon usage limit reached")
    
    if order_total < coupon.get("min_order", 0):
        raise HTTPException(status_code=400, detail=f"Minimum order amount is ₹{coupon.get('min_order')}")
    
    # Calculate discount
    if coupon.get("type") == "percentage":
        discount = order_total * coupon.get("value", 0) / 100
        if coupon.get("max_discount"):
            discount = min(discount, coupon["max_discount"])
    else:
        discount = coupon.get("value", 0)
    
    return {
        "valid": True,
        "code": coupon["code"],
        "type": coupon["type"],
        "value": coupon["value"],
        "discount": round(discount, 2),
    }


@router.get("/coupons/{coupon_id}")
async def get_coupon(coupon_id: str):
    """Get single coupon"""
    db = get_db()
    coupon = await db.coupons.find_one({"_id": ObjectId(coupon_id)})
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    return serialize_doc(coupon)


@router.post("/coupons")
async def create_coupon(data: dict, request: Request):
    """Create new coupon"""
    db = get_db()
    await require_offers_permission(request)
    
    # Check for duplicate code
    if data.get("code"):
        existing = await db.coupons.find_one({"code": data["code"].upper()})
        if existing:
            raise HTTPException(status_code=400, detail="Coupon code already exists")
        data["code"] = data["code"].upper()
    
    data["createdAt"] = datetime.utcnow()
    data["status"] = data.get("status", "active")
    data["usage_count"] = 0
    
    result = await db.coupons.insert_one(data)
    created = await db.coupons.find_one({"_id": result.inserted_id})
    
    await log_audit("create", "coupon", str(result.inserted_id), {"code": data.get("code")})
    
    return serialize_doc(created)


@router.put("/coupons/{coupon_id}")
async def update_coupon(coupon_id: str, data: dict, request: Request):
    """Update coupon"""
    db = get_db()
    await require_offers_permission(request)
    
    data["updatedAt"] = datetime.utcnow()
    data.pop("_id", None)
    
    if data.get("code"):
        data["code"] = data["code"].upper()
    
    result = await db.coupons.update_one(
        {"_id": ObjectId(coupon_id)},
        {"$set": data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Coupon not found")
    
    updated = await db.coupons.find_one({"_id": ObjectId(coupon_id)})
    await log_audit("update", "coupon", coupon_id)
    
    return serialize_doc(updated)


@router.post("/coupons/{coupon_id}/use")
async def use_coupon(coupon_id: str):
    """Increment coupon usage count"""
    db = get_db()
    
    result = await db.coupons.update_one(
        {"_id": ObjectId(coupon_id)},
        {"$inc": {"usage_count": 1}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Coupon not found")
    
    return {"success": True}


@router.delete("/coupons/{coupon_id}")
async def delete_coupon(coupon_id: str, request: Request):
    """Delete coupon"""
    db = get_db()
    await require_offers_permission(request)
    
    result = await db.coupons.delete_one({"_id": ObjectId(coupon_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Coupon not found")
    
    await log_audit("delete", "coupon", coupon_id)
    
    return {"success": True}


# ============ MEMBERSHIP PLANS ============

@router.get("/memberships")
async def list_memberships():
    """Get all membership plans"""
    db = get_db()
    plans = await db.membership_plans.find().to_list(200)

    best_by_tier = {}
    for plan in plans:
        tier_key = normalize_membership_tier(plan.get("tier"))
        if tier_key not in ALLOWED_MEMBERSHIP_TIERS:
            continue

        plan["tier"] = tier_key
        plan["name"] = TIER_DISPLAY_NAMES[tier_key]
        current = best_by_tier.get(tier_key)

        if current is None:
            best_by_tier[tier_key] = plan
            continue

        current_status = str(current.get("status") or "").lower()
        plan_status = str(plan.get("status") or "").lower()
        if plan_status == "active" and current_status != "active":
            best_by_tier[tier_key] = plan
            continue

        current_updated = current.get("updatedAt") or current.get("createdAt") or datetime.min
        plan_updated = plan.get("updatedAt") or plan.get("createdAt") or datetime.min
        if plan_updated > current_updated:
            best_by_tier[tier_key] = plan

    deduped = list(best_by_tier.values())
    deduped.sort(key=lambda p: (TIER_SORT_ORDER.get(normalize_membership_tier(p.get("tier")), 99), p.get("monthlyPrice", 0)))
    return [serialize_doc(plan) for plan in deduped]


@router.get("/memberships/{plan_id}")
async def get_membership(plan_id: str):
    """Get single membership plan"""
    db = get_db()
    plan = await db.membership_plans.find_one({"_id": ObjectId(plan_id)})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    return serialize_doc(plan)


@router.post("/memberships")
async def create_membership(data: dict, request: Request):
    """Create membership plan"""
    db = get_db()
    await require_offers_permission(request)

    tier = normalize_membership_tier(data.get("tier"))
    if tier not in ALLOWED_MEMBERSHIP_TIERS:
        raise HTTPException(status_code=400, detail="Tier must be one of: silver, gold, platinum")

    existing_by_tier = await db.membership_plans.find().to_list(200)
    has_same_tier = any(normalize_membership_tier(plan.get("tier")) == tier for plan in existing_by_tier)
    if has_same_tier:
        raise HTTPException(status_code=400, detail=f"A '{tier}' membership plan already exists")

    data["tier"] = tier
    data["name"] = TIER_DISPLAY_NAMES[tier]
    
    data["createdAt"] = datetime.utcnow()
    data["status"] = data.get("status", "active")
    
    result = await db.membership_plans.insert_one(data)
    created = await db.membership_plans.find_one({"_id": result.inserted_id})
    
    await log_audit("create", "membership", str(result.inserted_id))
    
    return serialize_doc(created)


@router.put("/memberships/{plan_id}")
async def update_membership(plan_id: str, data: dict, request: Request):
    """Update membership plan"""
    db = get_db()
    await require_offers_permission(request)

    current_plan = await db.membership_plans.find_one({"_id": ObjectId(plan_id)})
    if not current_plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    incoming_tier = normalize_membership_tier(data.get("tier") or current_plan.get("tier"))
    if incoming_tier not in ALLOWED_MEMBERSHIP_TIERS:
        raise HTTPException(status_code=400, detail="Tier must be one of: silver, gold, platinum")

    all_plans = await db.membership_plans.find().to_list(200)
    for plan in all_plans:
        if str(plan.get("_id")) == plan_id:
            continue
        if normalize_membership_tier(plan.get("tier")) == incoming_tier:
            raise HTTPException(status_code=400, detail=f"A '{incoming_tier}' membership plan already exists")

    data["tier"] = incoming_tier
    data["name"] = TIER_DISPLAY_NAMES[incoming_tier]
    
    data["updatedAt"] = datetime.utcnow()
    data.pop("_id", None)
    
    result = await db.membership_plans.update_one(
        {"_id": ObjectId(plan_id)},
        {"$set": data}
    )
    
    updated = await db.membership_plans.find_one({"_id": ObjectId(plan_id)})
    return serialize_doc(updated)


@router.delete("/memberships/{plan_id}")
async def delete_membership(plan_id: str, request: Request):
    """Delete membership plan"""
    db = get_db()
    await require_offers_permission(request)
    
    result = await db.membership_plans.delete_one({"_id": ObjectId(plan_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    return {"success": True}


# ============ LOYALTY CONFIGURATION ============

@router.get("/loyalty-config")
async def get_loyalty_config():
    """Get loyalty program configuration"""
    db = get_db()
    
    config = await db.settings.find_one({"key": "loyalty_config"})
    if not config:
        # Return defaults
        return {
            "pointsPerHundred": 10,
            "maxPointsPerOrder": 100,
            "loyaltyEnabled": True,
            "pointsPerRupee": 10,
            "minRedeemablePoints": 50,
            "expiryMonths": 12,
            "autoExpiryEnabled": True,
        }
    
    return config.get("value", {})


@router.post("/loyalty-config")
async def update_loyalty_config(data: dict, request: Request):
    """Update loyalty configuration"""
    db = get_db()
    await require_offers_permission(request)
    
    await db.settings.update_one(
        {"key": "loyalty_config"},
        {"$set": {
            "key": "loyalty_config",
            "value": data,
            "updatedAt": datetime.utcnow()
        }},
        upsert=True
    )
    
    await log_audit("update", "loyalty_config", "loyalty_config")
    
    return {"success": True, "config": data}


# ============ FEEDBACK ============

FEEDBACK_BASE_POINTS = 50  # Points for any feedback
FEEDBACK_DETAIL_BONUS = 25  # Bonus if comment > 50 chars


@router.get("/feedback")
async def list_feedback(
    customer_id: Optional[str] = None,
    order_id: Optional[str] = None,
):
    """Get all customer feedback"""
    db = get_db()
    query = {}
    
    if customer_id:
        query["customerId"] = customer_id
    if order_id:
        query["orderId"] = order_id
    
    feedbacks = await db.feedback.find(query).sort("submittedAt", -1).to_list(200)
    return [serialize_doc(f) for f in feedbacks]


@router.get("/feedback/stats")
async def get_feedback_stats():
    """Get feedback statistics"""
    db = get_db()
    
    pipeline = [
        {
            "$group": {
                "_id": None,
                "totalFeedback": {"$sum": 1},
                "totalPointsAwarded": {"$sum": "$pointsAwarded"},
                "averageRating": {"$avg": "$rating"},
            }
        }
    ]
    
    result = await db.feedback.aggregate(pipeline).to_list(1)
    
    if result:
        stats = result[0]
        return {
            "totalFeedback": stats.get("totalFeedback", 0),
            "totalPointsAwarded": stats.get("totalPointsAwarded", 0),
            "averageRating": round(stats.get("averageRating", 0), 1),
        }
    
    return {"totalFeedback": 0, "totalPointsAwarded": 0, "averageRating": 0}


@router.post("/feedback")
async def create_feedback(data: dict):
    """
    Submit customer feedback and award loyalty points.
    
    Points: 50 base + 25 bonus if comment > 50 characters
    """
    db = get_db()
    
    # Validate required fields
    required = ["customerName", "customerId", "orderId", "rating", "comment"]
    for field in required:
        if field not in data or not data[field]:
            raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
    
    # Calculate loyalty points
    comment = data.get("comment", "")
    points = FEEDBACK_BASE_POINTS
    if len(comment) > 50:
        points += FEEDBACK_DETAIL_BONUS
    
    # Create feedback document
    feedback_doc = {
        "customerName": data["customerName"],
        "customerId": data["customerId"],
        "orderId": data["orderId"],
        "rating": int(data["rating"]),
        "comment": comment,
        "pointsAwarded": points,
        "submittedAt": datetime.utcnow(),
    }
    
    result = await db.feedback.insert_one(feedback_doc)
    feedback_doc["_id"] = result.inserted_id
    
    # Award loyalty points to customer
    await db.customers.update_one(
        {"_id": data["customerId"]},
        {
            "$inc": {"loyaltyPoints": points},
            "$push": {
                "pointsHistory": {
                    "type": "feedback",
                    "points": points,
                    "description": f"Feedback for order {data['orderId']}",
                    "date": datetime.utcnow(),
                }
            }
        },
        upsert=False  # Only update if customer exists
    )
    
    await log_audit("create", "feedback", str(result.inserted_id))
    
    return {
        **serialize_doc(feedback_doc),
        "message": f"Thank you! You earned {points} loyalty points.",
    }


@router.delete("/feedback/{feedback_id}")
async def delete_feedback(feedback_id: str, request: Request):
    """Delete feedback (admin only)"""
    db = get_db()
    await require_offers_permission(request)
    
    try:
        obj_id = ObjectId(feedback_id)
    except (InvalidId, TypeError):
        obj_id = feedback_id
    
    result = await db.feedback.delete_one({"_id": obj_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Feedback not found")
    
    await log_audit("delete", "feedback", feedback_id)
    
    return {"success": True}

