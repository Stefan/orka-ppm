"""
Feature Toggle System API: global and org-scoped flags.
Design: .kiro/specs/feature-toggle-system/design.md
Base URL: /api/features
"""

import asyncio
import logging
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from auth.dependencies import get_current_user
from auth.rbac import require_admin
from config.database import supabase
from schemas.feature_toggles import (
    FeatureToggleCreate,
    FeatureToggleUpdate,
    FeatureToggleResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/features", tags=["feature-toggles"])


def _organization_id_from_user(user: Dict[str, Any]) -> Optional[str]:
    """Extract organization_id from user (tenant_id as fallback)."""
    org = user.get("organization_id") or user.get("tenant_id")
    if org is None:
        return None
    return str(org) if not isinstance(org, str) else org


def _row_to_response(row: Dict[str, Any]) -> FeatureToggleResponse:
    """Map DB row to API response."""
    return FeatureToggleResponse(
        id=str(row["id"]),
        name=row["name"],
        enabled=row["enabled"],
        organization_id=str(row["organization_id"]) if row.get("organization_id") else None,
        description=row.get("description"),
        created_at=row["created_at"] if isinstance(row["created_at"], str) else row["created_at"].isoformat(),
        updated_at=row["updated_at"] if isinstance(row["updated_at"], str) else row["updated_at"].isoformat(),
    )


async def _broadcast_flag_change(action: str, flag: Dict[str, Any]) -> None:
    """Broadcast flag change via Supabase Realtime. Log errors, do not fail main operation."""
    try:
        if not supabase:
            return
        channel = supabase.channel("feature_flags_changes")
        payload = {"type": "broadcast", "event": "flag_change", "payload": {"action": action, "flag": flag}}
        await asyncio.to_thread(channel.send, payload)
    except Exception as e:
        logger.warning("Feature toggle broadcast failed: %s", e)


@router.get("", response_model=Dict[str, List[FeatureToggleResponse]])
async def get_features(
    user: Dict[str, Any] = Depends(get_current_user),
    list_all: bool = False,
):
    """
    Get feature flags for the current user's organization.
    Returns global flags plus org-specific flags; org overrides global for same name.
    If list_all=true (admin list view), returns all rows without merging.
    """
    if not supabase:
        raise HTTPException(status_code=503, detail="Service unavailable")
    org_id = _organization_id_from_user(user)
    try:
        if org_id:
            response = await asyncio.to_thread(
                lambda: supabase.table("feature_toggles")
                .select("*")
                .or_(f"organization_id.is.null,organization_id.eq.{org_id}")
                .execute()
            )
        else:
            response = await asyncio.to_thread(
                lambda: supabase.table("feature_toggles")
                .select("*")
                .is_("organization_id", "null")
                .execute()
            )
        rows = response.data or []
        if list_all:
            return {"flags": [_row_to_response(r) for r in rows]}
        # Merge: for each name, prefer org-specific over global
        by_name: Dict[str, Dict[str, Any]] = {}
        for r in rows:
            name = r["name"]
            if name not in by_name or r.get("organization_id") is not None:
                by_name[name] = r
        merged = list(by_name.values())
        return {"flags": [_row_to_response(r) for r in merged]}
    except Exception as e:
        logger.exception("Failed to fetch feature toggles")
        raise HTTPException(status_code=503, detail="Failed to fetch feature flags") from e


@router.post("", response_model=FeatureToggleResponse, status_code=status.HTTP_201_CREATED)
async def create_feature(
    body: FeatureToggleCreate,
    user: Dict[str, Any] = Depends(require_admin()),
):
    """Create a new feature flag (admin only)."""
    if not supabase:
        raise HTTPException(status_code=503, detail="Service unavailable")
    insert = {
        "name": body.name,
        "enabled": body.enabled,
        "organization_id": str(body.organization_id) if body.organization_id else None,
        "description": body.description,
    }
    try:
        response = await asyncio.to_thread(
            supabase.table("feature_toggles").insert(insert).execute()
        )
        if not response.data or len(response.data) == 0:
            raise HTTPException(status_code=500, detail="Create failed")
        row = response.data[0]
        await _broadcast_flag_change("created", row)
        return _row_to_response(row)
    except Exception as e:
        err_msg = str(e).lower()
        if "unique" in err_msg or "duplicate" in err_msg or "conflict" in err_msg:
            raise HTTPException(status_code=409, detail="Flag with this name and scope already exists") from e
        if "validation" in err_msg or "value" in err_msg:
            raise HTTPException(status_code=400, detail=str(e)) from e
        raise HTTPException(status_code=500, detail="Failed to create feature flag") from e


@router.put("/{name}", response_model=FeatureToggleResponse)
async def update_feature(
    name: str,
    body: FeatureToggleUpdate,
    user: Dict[str, Any] = Depends(require_admin()),
    organization_id: Optional[UUID] = None,
):
    """Update an existing feature flag by name (admin only). Name cannot be changed."""
    if not supabase:
        raise HTTPException(status_code=503, detail="Service unavailable")
    update_data = body.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    if "organization_id" in update_data and update_data["organization_id"] is not None:
        update_data["organization_id"] = str(update_data["organization_id"])
    query = supabase.table("feature_toggles").update(update_data).eq("name", name)
    if organization_id is not None:
        query = query.eq("organization_id", str(organization_id))
    else:
        query = query.is_("organization_id", "null")
    try:
        response = await asyncio.to_thread(query.execute())
        if not response.data or len(response.data) == 0:
            raise HTTPException(status_code=404, detail="Feature flag not found")
        row = response.data[0]
        await _broadcast_flag_change("updated", row)
        return _row_to_response(row)
    except HTTPException:
        raise
    except Exception as e:
        err_msg = str(e).lower()
        if "validation" in err_msg or "value" in err_msg:
            raise HTTPException(status_code=400, detail=str(e)) from e
        raise HTTPException(status_code=500, detail="Failed to update feature flag") from e


@router.delete("/{name}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_feature(
    name: str,
    user: Dict[str, Any] = Depends(require_admin()),
    organization_id: Optional[UUID] = None,
):
    """Delete a feature flag by name (admin only). Use organization_id query to delete org-scoped flag."""
    if not supabase:
        raise HTTPException(status_code=503, detail="Service unavailable")
    query = supabase.table("feature_toggles").delete().eq("name", name)
    if organization_id is not None:
        query = query.eq("organization_id", str(organization_id))
    else:
        query = query.is_("organization_id", "null")
    try:
        response = await asyncio.to_thread(query.execute())
        if not response.data or len(response.data) == 0:
            raise HTTPException(status_code=404, detail="Feature flag not found")
        await _broadcast_flag_change("deleted", {"name": name, "organization_id": str(organization_id) if organization_id else None})
        return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to delete feature flag") from e
