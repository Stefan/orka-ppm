"""
Portfolio management endpoints
"""

from fastapi import APIRouter, HTTPException, Depends
from uuid import UUID

from auth.rbac import require_permission, Permission
from auth.dependencies import get_current_user
from config.database import supabase, service_supabase
from models.projects import PortfolioCreate, PortfolioUpdate, PortfolioResponse
from utils.converters import convert_uuids

router = APIRouter(prefix="/portfolios", tags=["portfolios"])

@router.post("/", response_model=PortfolioResponse, status_code=201)
async def create_portfolio(
    portfolio: PortfolioCreate, 
    current_user = Depends(require_permission(Permission.portfolio_create))
):
    """Create a new portfolio"""
    db = service_supabase if service_supabase else supabase
    if not db:
        raise HTTPException(status_code=503, detail="Database service unavailable")
    try:
        insert_data = convert_uuids(portfolio.dict())
        response = db.table("portfolios").insert(insert_data).execute()
        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to create portfolio")
        return convert_uuids(response.data[0])
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/")
async def list_portfolios(current_user = Depends(require_permission(Permission.portfolio_read))):
    """Get all portfolios"""
    db = service_supabase if service_supabase else supabase
    try:
        if not db:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        response = db.table("portfolios").select("*").execute()
        return convert_uuids(response.data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{portfolio_id}", response_model=PortfolioResponse)
async def get_portfolio(
    portfolio_id: UUID,
    current_user = Depends(require_permission(Permission.portfolio_read))
):
    """Get a specific portfolio"""
    db = service_supabase if service_supabase else supabase
    try:
        if not db:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        response = db.table("portfolios").select("*").eq("id", str(portfolio_id)).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Portfolio not found")
        return convert_uuids(response.data[0])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{portfolio_id}", response_model=PortfolioResponse)
async def update_portfolio(
    portfolio_id: UUID,
    payload: PortfolioUpdate,
    current_user = Depends(require_permission(Permission.portfolio_update))
):
    """Update a portfolio (partial update)."""
    db = service_supabase if service_supabase else supabase
    try:
        if not db:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        data = convert_uuids(payload.dict(exclude_unset=True))
        if not data:
            response = db.table("portfolios").select("*").eq("id", str(portfolio_id)).execute()
            if not response.data:
                raise HTTPException(status_code=404, detail="Portfolio not found")
            return convert_uuids(response.data[0])
        response = db.table("portfolios").update(data).eq("id", str(portfolio_id)).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Portfolio not found")
        return convert_uuids(response.data[0])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{portfolio_id}", status_code=204)
async def delete_portfolio(
    portfolio_id: UUID,
    current_user = Depends(require_permission(Permission.portfolio_delete))
):
    """Delete a portfolio. Fails if any project is assigned to it."""
    db = service_supabase if service_supabase else supabase
    try:
        if not db:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        existing = db.table("portfolios").select("id").eq("id", str(portfolio_id)).execute()
        if not existing.data or len(existing.data) == 0:
            raise HTTPException(status_code=404, detail="Portfolio not found")
        projs = db.table("projects").select("id").eq("portfolio_id", str(portfolio_id)).limit(1).execute()
        if projs.data and len(projs.data) > 0:
            raise HTTPException(
                status_code=409,
                detail="Portfolio cannot be deleted while it has projects. Move or delete the projects first."
            )
        db.table("portfolios").delete().eq("id", str(portfolio_id)).execute()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))