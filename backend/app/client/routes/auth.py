"""Client Auth routes – FastAPI + Motor (async MongoDB)."""
from __future__ import annotations
from typing import Any

import bcrypt
from fastapi import APIRouter, HTTPException
from datetime import datetime
from pymongo.errors import PyMongoError

from ...db import get_db, init_db
from ..schemas import UserRegister, UserLogin, UserUpdate

router = APIRouter()


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _serialize_user(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "name": doc.get("name", ""),
        "email": doc.get("email", ""),
        "phone": doc.get("phone", ""),
        "address": doc.get("address", ""),
        "password": "",
        "loyaltyPoints": doc.get("loyaltyPoints", 0),
        "favorites": doc.get("favorites", []),
        "membership": doc.get("membership"),
    }


def _default_membership() -> dict[str, Any]:
    return {
        "plan": "gold",
        "status": "active",
        "monthlyPrice": 299,
        "pointsBoost": 25,
        "benefits": [
            "+25% loyalty points on all orders",
            "Exclusive member-only coupons",
            "Free delivery on orders above 500",
            "Priority customer support",
        ],
        "expiryDate": "2026-06-30",
    }


def _utc_now() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _get_users_collection():
    """
    Resolve users collection safely and convert DB init issues to a clear HTTP error.
    """
    try:
        db = get_db()
    except RuntimeError:
        try:
            init_db()
            db = get_db()
        except Exception:
            raise HTTPException(status_code=503, detail="database_unavailable")
    return db.get_collection("users")


@router.post("/auth/register", status_code=201)
async def register_user(body: UserRegister):
    email = _normalize_email(body.email)
    users = _get_users_collection()

    try:
        if await users.find_one({"email": email}):
            raise HTTPException(status_code=409, detail="email_exists")

        password_hash = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()

        user_doc = {
            "name": body.name.strip(),
            "email": email,
            "phone": body.phone.strip(),
            "address": body.address.strip(),
            "passwordHash": password_hash,
            "loyaltyPoints": 100,
            "favorites": [],
            "membership": _default_membership(),
            "createdAt": _utc_now(),
            "updatedAt": _utc_now(),
        }

        await users.insert_one(user_doc)
        return {"user": _serialize_user(user_doc)}
    except HTTPException:
        raise
    except PyMongoError:
        raise HTTPException(status_code=503, detail="database_error")
    except Exception:
        raise HTTPException(status_code=500, detail="registration_failed")


@router.post("/auth/login")
async def login_user(body: UserLogin):
    email = _normalize_email(body.email)
    if not email or not body.password:
        raise HTTPException(status_code=400, detail="missing_credentials")

    try:
        users = _get_users_collection()
        user = await users.find_one({"email": email})
        if not user:
            raise HTTPException(status_code=401, detail="invalid_credentials")

        stored_hash = str(user.get("passwordHash", ""))
        if not stored_hash:
            raise HTTPException(status_code=401, detail="invalid_credentials")

        is_valid = bcrypt.checkpw(body.password.encode(), stored_hash.encode())
        if not is_valid:
            raise HTTPException(status_code=401, detail="invalid_credentials")

        return {"user": _serialize_user(user)}
    except HTTPException:
        raise
    except ValueError:
        # Invalid hash format in DB should not crash the API.
        raise HTTPException(status_code=401, detail="invalid_credentials")
    except PyMongoError:
        raise HTTPException(status_code=503, detail="database_error")
    except Exception:
        raise HTTPException(status_code=500, detail="login_failed")


@router.patch("/users/{email}")
async def update_user(email: str, body: UserUpdate):
    users = _get_users_collection()
    current_email = _normalize_email(email)

    try:
        user = await users.find_one({"email": current_email})
        if not user:
            raise HTTPException(status_code=404, detail="not_found")

        updates: dict[str, Any] = {}
        for field in ["name", "phone", "address", "favorites", "loyaltyPoints", "membership"]:
            val = getattr(body, field, None)
            if val is not None:
                updates[field] = val

        if body.email and body.email.strip():
            normalized = _normalize_email(body.email)
            if normalized != current_email:
                if await users.find_one({"email": normalized}):
                    raise HTTPException(status_code=409, detail="email_exists")
                updates["email"] = normalized

        if body.password and body.password.strip():
            updates["passwordHash"] = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()

        if not updates:
            return {"user": _serialize_user(user)}

        updates["updatedAt"] = _utc_now()
        await users.update_one({"email": current_email}, {"$set": updates})
        updated = await users.find_one({"email": updates.get("email", current_email)})
        return {"user": _serialize_user(updated or user)}
    except HTTPException:
        raise
    except PyMongoError:
        raise HTTPException(status_code=503, detail="database_error")
    except Exception:
        raise HTTPException(status_code=500, detail="update_failed")
