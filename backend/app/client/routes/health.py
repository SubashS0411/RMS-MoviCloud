"""Client Health check route – FastAPI."""
from __future__ import annotations

from datetime import datetime
from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health():
    return {"ok": True, "time": datetime.utcnow().isoformat() + "Z"}
