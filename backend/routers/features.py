"""
Features overview API: list features for catalog, optional webhook for auto-update.
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from pydantic import BaseModel

from config.database import supabase
from auth.dependencies import get_current_user

router = APIRouter(prefix="/api/v1/features", tags=["features"])


class FeatureResponse(BaseModel):
    id: str
    name: str
    parent_id: Optional[str]
    description: Optional[str]
    screenshot_url: Optional[str]
    link: Optional[str]
    icon: Optional[str]
    created_at: str
    updated_at: str


@router.get("", response_model=List[FeatureResponse])
async def list_features(current_user: dict = Depends(get_current_user)):
    """
    List all features for the catalog (hierarchical; client builds tree from parent_id).
    """
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    response = supabase.table("feature_catalog").select("*").order("name").execute()
    if response.data is None:
        return []
    return [FeatureResponse(**row) for row in response.data]


@router.post("/update")
async def webhook_update(
    current_user: dict = Depends(get_current_user),
):
    """
    Webhook for auto-update on Git push.
    Optional: trigger Playwright screenshots and AI scan; update features table.
    Idempotent and safe to call repeatedly.
    """
    # Placeholder: in production, verify webhook secret and trigger screenshot job
    return {"ok": True, "message": "Webhook received"}
