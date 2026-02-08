"""
Saved Views API – No-Code-Views (Cora-Surpass Phase 2.3).
CRUD for user saved view definitions (filters, sort, columns per scope).
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from auth.dependencies import get_current_user
from config.database import supabase, service_supabase
from models.saved_views import SavedViewCreate, SavedViewUpdate, SavedViewResponse
from utils.converters import convert_uuids

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/saved-views", tags=["saved-views"])

# Use service role for saved_views so RLS does not block (auth.uid() is null with anon key). We enforce user_id from JWT.
_db = service_supabase if service_supabase else supabase


def _user_id_from_user(user: Dict[str, Any]) -> str:
    uid = user.get("user_id") or user.get("id") or user.get("sub")
    if not uid:
        raise HTTPException(status_code=401, detail="User ID not found")
    return str(uid)


@router.get("", response_model=List[SavedViewResponse])
async def list_saved_views(
    scope: str = Query(None, description="Filter by scope (e.g. financials, projects)"),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """List saved views for the current user."""
    if not _db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    user_id = _user_id_from_user(current_user)
    try:
        query = _db.table("saved_views").select("*").eq("user_id", user_id)
        if scope:
            query = query.eq("scope", scope)
        response = query.order("updated_at", desc=True).execute()
        return [SavedViewResponse(**convert_uuids(row)) for row in (response.data or [])]
    except Exception as e:
        logger.exception("List saved_views: %s", e)
        raise HTTPException(status_code=500, detail="Failed to list saved views")


@router.post("", response_model=SavedViewResponse, status_code=201)
async def create_saved_view(
    body: SavedViewCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Create a saved view."""
    if not _db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    user_id = _user_id_from_user(current_user)
    org_id = current_user.get("organization_id") or current_user.get("tenant_id")
    row = {
        "user_id": user_id,
        "organization_id": str(org_id) if org_id else None,
        "name": body.name,
        "scope": body.scope,
        "definition": body.definition,
    }
    try:
        response = _db.table("saved_views").insert(row).execute()
        if not response.data:
            raise HTTPException(status_code=400, detail="Insert failed")
        return SavedViewResponse(**convert_uuids(response.data[0]))
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Create saved_view: %s", e)
        raise HTTPException(status_code=500, detail="Failed to create saved view")


@router.get("/{view_id}", response_model=SavedViewResponse)
async def get_saved_view(
  view_id: UUID,
  current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Get one saved view by id."""
    if not _db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    user_id = _user_id_from_user(current_user)
    response = (
        _db.table("saved_views")
        .select("*")
        .eq("id", str(view_id))
        .eq("user_id", user_id)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Saved view not found")
    return SavedViewResponse(**convert_uuids(response.data[0]))


@router.patch("/{view_id}", response_model=SavedViewResponse)
async def update_saved_view(
  view_id: UUID,
  body: SavedViewUpdate,
  current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Update a saved view (name and/or definition)."""
    if not _db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    user_id = _user_id_from_user(current_user)
    updates: Dict[str, Any] = {}
    if body.name is not None:
        updates["name"] = body.name
    if body.definition is not None:
        updates["definition"] = body.definition
    if not updates:
        return await get_saved_view(view_id, current_user)
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    try:
        response = (
            _db.table("saved_views")
            .update(updates)
            .eq("id", str(view_id))
            .eq("user_id", user_id)
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=404, detail="Saved view not found")
        return SavedViewResponse(**convert_uuids(response.data[0]))
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Update saved_view: %s", e)
        raise HTTPException(status_code=500, detail="Failed to update saved view")


@router.delete("/{view_id}", status_code=204)
async def delete_saved_view(
  view_id: UUID,
  current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Delete a saved view."""
    if not _db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    user_id = _user_id_from_user(current_user)
    response = (
        _db.table("saved_views")
        .delete()
        .eq("id", str(view_id))
        .eq("user_id", user_id)
        .execute()
    )
    if response.data is not None and len(response.data) == 0:
        raise HTTPException(status_code=404, detail="Saved view not found")
