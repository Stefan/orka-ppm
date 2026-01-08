"""
Portfolio management endpoints
"""

from fastapi import APIRouter, HTTPException, Depends
from uuid import UUID

from auth.rbac import require_permission, Permission
from auth.dependencies import get_current_user
from config.database import supabase
from models.projects import PortfolioCreate, PortfolioResponse
from utils.converters import convert_uuids

router = APIRouter(prefix="/portfolios", tags=["portfolios"])

@router.post("/", response_model=PortfolioResponse, status_code=201)
async def create_portfolio(
    portfolio: PortfolioCreate, 
    current_user = Depends(require_permission(Permission.portfolio_create))
):
    """Create a new portfolio"""
    try:
        if not supabase:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        response = supabase.table("portfolios").insert(portfolio.dict()).execute()
        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to create portfolio")
        
        return convert_uuids(response.data[0])
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/")
async def list_portfolios(current_user = Depends(require_permission(Permission.portfolio_read))):
    """Get all portfolios"""
    try:
        if not supabase:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        response = supabase.table("portfolios").select("*").execute()
        return convert_uuids(response.data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{portfolio_id}", response_model=PortfolioResponse)
async def get_portfolio(
    portfolio_id: UUID, 
    current_user = Depends(require_permission(Permission.portfolio_read))
):
    """Get a specific portfolio"""
    try:
        if not supabase:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        response = supabase.table("portfolios").select("*").eq("id", str(portfolio_id)).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Portfolio not found")
        return convert_uuids(response.data[0])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))