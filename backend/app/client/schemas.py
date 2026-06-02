"""Client Pydantic schemas for request/response validation."""
from __future__ import annotations

from typing import Any, Optional, List
from pydantic import BaseModel, Field, EmailStr


# ── Auth ──
class UserRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    phone: str = Field(..., min_length=7, max_length=20)
    address: str = Field(..., min_length=3, max_length=250)
    password: str = Field(..., min_length=6, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    phone: Optional[str] = Field(None, min_length=7, max_length=20)
    address: Optional[str] = Field(None, min_length=3, max_length=250)
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=6, max_length=128)
    favorites: Optional[List[str]] = None
    loyaltyPoints: Optional[int] = None
    membership: Optional[dict] = None


# ── Orders ──
class OrderCreate(BaseModel):
    id: str
    userId: Optional[str] = None
    items: list
    subtotal: Optional[float] = None
    tax: Optional[float] = None
    loyaltyDiscount: Optional[float] = None
    loyaltyPointsRedeemed: Optional[int] = None
    total: float
    status: str = "preparing"
    type: str = "dine-in"
    date: Optional[str] = None
    deliveryAddress: Optional[str] = None
    invoiceUrl: Optional[str] = None
    tableNumber: Optional[str] = None
    customerName: Optional[str] = None
    source: Optional[str] = None


class OrderUpdate(BaseModel):
    status: Optional[str] = None
    invoiceUrl: Optional[str] = None


# ── Reservations ──
class ReservationCreate(BaseModel):
    reservationId: str
    userId: str
    date: str
    timeSlot: str
    guests: int
    location: str
    segment: str
    userName: str
    userPhone: str
    tableNumber: Optional[str] = None
    status: str = "Confirmed"


class WaitingQueueJoin(BaseModel):
    queueId: str
    userId: str
    date: str
    timeSlot: str
    guests: int


# ── Walk-in Queue ──
class QueueJoin(BaseModel):
    id: str
    name: str
    guests: int
    notificationMethod: str
    contact: str
    hall: str
    segment: str
    queueDate: str
    notifiedAt5Min: bool = False


class QueueUpdate(BaseModel):
    notifiedAt5Min: Optional[bool] = None
    estimatedWaitMinutes: Optional[float] = None


# ── Feedback ──
class FeedbackCreate(BaseModel):
    id: Optional[str] = None
    userId: str
    orderId: str
    foodRatings: dict
    likedAspects: list
    comment: Optional[str] = None


# ── Chat ──
class ChatMessage(BaseModel):
    message: str
    userId: Optional[str] = None


# ── Notifications ──
class MarkReadRequest(BaseModel):
    id: str
