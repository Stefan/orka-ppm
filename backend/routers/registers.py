"""
Unified Registers API (Register-Arten).
CRUD per type + AI recommendations.
Spec: .kiro/specs/registers-unified/
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from uuid import UUID
from typing import Optional

from auth.dependencies import get_current_user
from config.database import supabase
from models.registers import (
    RegisterCreate,
    RegisterUpdate,
    RegisterResponse,
    RegisterListResponse,
    AIRecommendRequest,
    AIRecommendResponse,
    REGISTER_TYPES,
)
from utils.converters import convert_uuids

router = APIRouter(prefix="/api/registers", tags=["registers"])


def _validate_register_type(type_str: str) -> str:
    if type_str not in REGISTER_TYPES:
        raise HTTPException(status_code=404, detail=f"Unknown register type: {type_str}")
    return type_str


def _org_id(current_user: dict) -> str:
    org_id = current_user.get("organization_id") or current_user.get("tenant_id")
    if not org_id:
        raise HTTPException(status_code=403, detail="No organization assigned")
    return str(org_id)


@router.get("/{type}", response_model=RegisterListResponse)
async def list_registers(
    type: str,
    project_id: Optional[UUID] = Query(None),
    task_id: Optional[UUID] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    count_exact: bool = Query(False, description="Request exact total (slower)"),
    current_user: dict = Depends(get_current_user),
):
    """List register entries for the given type. Default count_exact=False for faster response."""
    _validate_register_type(type)
    org_id = _org_id(current_user)
    if not supabase:
        raise HTTPException(status_code=503, detail="Database service unavailable")
    try:
        if count_exact:
            query = supabase.table("registers").select("*", count="exact")
        else:
            query = supabase.table("registers").select("*")
        query = query.eq("type", type).eq("organization_id", org_id)
        if project_id is not None:
            query = query.eq("project_id", str(project_id))
        if task_id is not None:
            query = query.eq("task_id", str(task_id))
        if status:
            query = query.eq("status", status)
        query = query.order("updated_at", desc=True).range(offset, offset + limit - 1)
        response = query.execute()
        items = [convert_uuids(row) for row in (response.data or [])]
        if count_exact and hasattr(response, "count") and response.count is not None:
            total = response.count
        else:
            total = offset + len(items)
        return RegisterListResponse(items=items, total=total, limit=limit, offset=offset)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list registers: {str(e)}")


@router.post("/{type}", response_model=RegisterResponse, status_code=201)
async def create_register(
    type: str,
    body: RegisterCreate,
    current_user: dict = Depends(get_current_user),
):
    """Create a register entry of the given type."""
    _validate_register_type(type)
    org_id = _org_id(current_user)
    if not supabase:
        raise HTTPException(status_code=503, detail="Database service unavailable")
    try:
        row = {
            "type": type,
            "organization_id": org_id,
            "project_id": str(body.project_id) if body.project_id else None,
            "task_id": str(body.task_id) if body.task_id else None,
            "data": body.data,
            "status": body.status or "open",
        }
        response = supabase.table("registers").insert(row).execute()
        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to create register")
        return convert_uuids(response.data[0])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create register: {str(e)}")


@router.get("/{type}/{id}", response_model=RegisterResponse)
async def get_register(
    type: str,
    id: UUID,
    current_user: dict = Depends(get_current_user),
):
    """Get a single register entry by id. type must match."""
    _validate_register_type(type)
    _org_id(current_user)
    if not supabase:
        raise HTTPException(status_code=503, detail="Database service unavailable")
    try:
        response = (
            supabase.table("registers")
            .select("*")
            .eq("id", str(id))
            .eq("type", type)
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=404, detail="Register not found")
        return convert_uuids(response.data[0])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get register: {str(e)}")


@router.put("/{type}/{id}", response_model=RegisterResponse)
async def update_register(
    type: str,
    id: UUID,
    body: RegisterUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update a register entry. Only provided fields are updated."""
    _validate_register_type(type)
    _org_id(current_user)
    if not supabase:
        raise HTTPException(status_code=503, detail="Database service unavailable")
    try:
        payload = body.model_dump(exclude_unset=True)
        if "project_id" in payload:
            payload["project_id"] = str(payload["project_id"]) if payload["project_id"] else None
        if "task_id" in payload:
            payload["task_id"] = str(payload["task_id"]) if payload["task_id"] else None
        response = (
            supabase.table("registers")
            .update(payload)
            .eq("id", str(id))
            .eq("type", type)
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=404, detail="Register not found")
        return convert_uuids(response.data[0])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update register: {str(e)}")


@router.delete("/{type}/{id}", status_code=204)
async def delete_register(
    type: str,
    id: UUID,
    current_user: dict = Depends(get_current_user),
):
    """Delete a register entry."""
    _validate_register_type(type)
    _org_id(current_user)
    if not supabase:
        raise HTTPException(status_code=503, detail="Database service unavailable")
    try:
        response = (
            supabase.table("registers")
            .delete()
            .eq("id", str(id))
            .eq("type", type)
            .execute()
        )
        if response.data is None or (isinstance(response.data, list) and len(response.data) == 0):
            raise HTTPException(status_code=404, detail="Register not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete register: {str(e)}")


def _stub_recommend(type: str, context: Optional[dict]) -> dict:
    """Type-specific stub recommendations. Replace with Grok/OpenAI later."""
    stubs = {
        "risk": {"title": "New risk", "probability": 0.5, "impact": 0.5, "status": "identified"},
        "change": {"title": "Change request", "impact_area": "schedule", "status": "open"},
        "cost": {"title": "Cost item", "eac": 0, "etc": 0, "status": "open"},
        "issue": {"title": "Issue", "priority": "medium", "status": "open"},
        "benefits": {"title": "Benefit", "roi_forecast": 0, "status": "open"},
        "lessons_learned": {"title": "Lesson", "summary": "", "status": "open"},
        "decision": {"title": "Decision", "options": [], "status": "pending"},
        "opportunities": {"title": "Opportunity", "score": 0.5, "status": "open"},
    }
    data = dict(stubs.get(type, {"title": "New entry", "status": "open"}))
    if context:
        data.update({k: v for k, v in context.items() if k != "project_id"})
    return data


@router.post("/{type}/ai-recommend", response_model=AIRecommendResponse)
async def ai_recommend(
    type: str,
    body: Optional[AIRecommendRequest] = None,
    current_user: dict = Depends(get_current_user),
):
    """Get AI-generated recommendation for a new register entry (type-specific)."""
    _validate_register_type(type)
    _org_id(current_user)
    context = (body.context if body else None) or {}
    if body and body.project_id:
        context["project_id"] = str(body.project_id)
    data = _stub_recommend(type, context)
    return AIRecommendResponse(
        data=data,
        explanation=f"Suggested default fields for {type} register. Customize and save.",
    )
