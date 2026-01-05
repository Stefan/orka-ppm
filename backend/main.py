from fastapi import FastAPI, HTTPException, status, Query, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
from dotenv import load_dotenv
from pydantic import BaseModel
from uuid import UUID
import os
import jwt
from typing import List, Dict, Any
import json
from datetime import date, datetime, timedelta
from enum import Enum

load_dotenv()

# Environment variables with fallbacks
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

# Create Supabase client with error handling
supabase: Client = None
try:
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        print(f"WARNING: Missing environment variables - URL: {bool(SUPABASE_URL)}, KEY: {bool(SUPABASE_ANON_KEY)}")
        # Use fallback values for debugging
        SUPABASE_URL = SUPABASE_URL or "https://xceyrfvxooiplbmwavlb.supabase.co"
        SUPABASE_ANON_KEY = SUPABASE_ANON_KEY or "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjZXlyZnZ4b29pcGxibXdhdmxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4Mjg3ODEsImV4cCI6MjA4MjQwNDc4MX0.jIyJlwx2g9xn8OTSaLum6H8BKqknyxB8gYxgEKdfgqo"
    
    supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    print(f"✅ Supabase client created successfully")
except Exception as e:
    print(f"❌ Error creating Supabase client: {e}")
    # Create a dummy client for development
    supabase = None

app = FastAPI(
    title="PPM SaaS MVP API",
    description="Moderne AI-gestützte Project Portfolio Management Lösung",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://ppm-pearl.vercel.app",
        "https://orka-ppm.vercel.app",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
)

# ---------- Pydantic Models ----------
class HealthIndicator(str, Enum):
    green = "green"
    yellow = "yellow"
    red = "red"

class ProjectStatus(str, Enum):
    planning = "planning"
    active = "active"
    on_hold = "on-hold"
    completed = "completed"
    cancelled = "cancelled"

class ProjectCreate(BaseModel):
    portfolio_id: UUID
    name: str
    description: str | None = None
    status: ProjectStatus = ProjectStatus.planning
    priority: str | None = None
    budget: float | None = None
    start_date: date | None = None
    end_date: date | None = None
    manager_id: UUID | None = None
    team_members: List[UUID] = []

class ProjectResponse(BaseModel):
    id: str
    portfolio_id: str
    name: str
    description: str | None
    status: str
    priority: str | None
    budget: float | None
    actual_cost: float | None
    start_date: date | None
    end_date: date | None
    manager_id: str | None
    team_members: List[str]
    health: str
    created_at: datetime
    updated_at: datetime

class PortfolioCreate(BaseModel):
    name: str
    description: str | None = None
    owner_id: UUID

class PortfolioResponse(BaseModel):
    id: str
    name: str
    description: str | None
    owner_id: str
    created_at: datetime
    updated_at: datetime

# ---------- Utility Functions ----------
def convert_uuids(data):
    """Convert UUID objects to strings for JSON serialization"""
    if isinstance(data, list):
        return [convert_uuids(item) for item in data]
    elif isinstance(data, dict):
        return {key: convert_uuids(value) for key, value in data.items()}
    elif hasattr(data, '__dict__'):
        return convert_uuids(data.__dict__)
    else:
        return str(data) if isinstance(data, UUID) else data

# ---------- Authentication ----------
security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Extract user from JWT token"""
    try:
        token = credentials.credentials
        # For now, just decode without verification for development
        payload = jwt.decode(token, options={"verify_signature": False})
        return {"user_id": payload.get("sub"), "email": payload.get("email")}
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid authentication token")

# ---------- Endpoints ----------
@app.get("/")
async def root():
    return {
        "message": "Willkommen zur PPM SaaS API – Deine Cora-Alternative mit agentic AI 🚀",
        "status": "healthy",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/debug")
async def debug_info():
    """Debug endpoint to check environment variables"""
    return {
        "supabase_url_set": bool(os.getenv("SUPABASE_URL")),
        "supabase_key_set": bool(os.getenv("SUPABASE_ANON_KEY")),
        "supabase_url_length": len(os.getenv("SUPABASE_URL", "")),
        "supabase_key_length": len(os.getenv("SUPABASE_ANON_KEY", "")),
        "environment": "production" if os.getenv("VERCEL") else "development",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        if supabase is None:
            return {
                "status": "degraded",
                "database": "not_configured",
                "message": "Supabase client not initialized",
                "timestamp": datetime.now().isoformat()
            }
        
        # Test Supabase connection
        response = supabase.table("portfolios").select("count", count="exact").execute()
        return {
            "status": "healthy",
            "database": "connected",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

# Portfolio Endpoints
@app.post("/portfolios/", response_model=PortfolioResponse, status_code=status.HTTP_201_CREATED)
async def create_portfolio(portfolio: PortfolioCreate, current_user = Depends(get_current_user)):
    try:
        response = supabase.table("portfolios").insert(portfolio.dict()).execute()
        if not response.data:
            raise HTTPException(status_code=400, detail="Fehler beim Erstellen des Portfolios")
        
        return convert_uuids(response.data[0])
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/portfolios/")
async def list_portfolios(current_user = Depends(get_current_user)):
    response = supabase.table("portfolios").select("*").execute()
    return convert_uuids(response.data)

@app.get("/portfolios/{portfolio_id}", response_model=PortfolioResponse)
async def get_portfolio(portfolio_id: UUID, current_user = Depends(get_current_user)):
    response = supabase.table("portfolios").select("*").eq("id", str(portfolio_id)).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return convert_uuids(response.data[0])

# Project Endpoints
@app.post("/projects/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(project: ProjectCreate, current_user = Depends(get_current_user)):
    try:
        project_data = project.dict()
        project_data['health'] = HealthIndicator.green.value
        
        response = supabase.table("projects").insert(project_data).execute()
        if not response.data:
            raise HTTPException(status_code=400, detail="Fehler beim Erstellen des Projekts")
        
        return convert_uuids(response.data[0])
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/projects/")
async def list_projects(
    portfolio_id: UUID | None = Query(None),
    status: ProjectStatus | None = Query(None),
    current_user = Depends(get_current_user)
):
    query = supabase.table("projects").select("*")
    
    if portfolio_id:
        query = query.eq("portfolio_id", str(portfolio_id))
    if status:
        query = query.eq("status", status.value)
    
    response = query.execute()
    return convert_uuids(response.data)

@app.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: UUID, current_user = Depends(get_current_user)):
    response = supabase.table("projects").select("*").eq("id", str(project_id)).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Project not found")
    return convert_uuids(response.data[0])

# Dashboard endpoint
@app.get("/dashboard")
async def get_dashboard_data(current_user = Depends(get_current_user)):
    """Get dashboard data for the authenticated user"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Get portfolios
        portfolios_response = supabase.table("portfolios").select("*").execute()
        portfolios = convert_uuids(portfolios_response.data)
        
        # Get projects
        projects_response = supabase.table("projects").select("*").execute()
        projects = convert_uuids(projects_response.data)
        
        # Calculate basic metrics
        total_projects = len(projects)
        active_projects = len([p for p in projects if p.get('status') == 'active'])
        completed_projects = len([p for p in projects if p.get('status') == 'completed'])
        
        # Health distribution
        health_distribution = {
            'green': len([p for p in projects if p.get('health') == 'green']),
            'yellow': len([p for p in projects if p.get('health') == 'yellow']),
            'red': len([p for p in projects if p.get('health') == 'red'])
        }
        
        # Budget summary
        total_budget = sum(float(p.get('budget', 0)) for p in projects if p.get('budget'))
        total_actual = sum(float(p.get('actual_cost', 0)) for p in projects if p.get('actual_cost'))
        
        return {
            "portfolios": portfolios,
            "projects": projects,
            "metrics": {
                "total_projects": total_projects,
                "active_projects": active_projects,
                "completed_projects": completed_projects,
                "health_distribution": health_distribution,
                "budget_summary": {
                    "total_budget": total_budget,
                    "total_actual": total_actual,
                    "variance": total_actual - total_budget
                }
            },
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        print(f"Dashboard error: {e}")  # Server-side logging
        raise HTTPException(status_code=500, detail=f"Dashboard data retrieval failed: {str(e)}")

# For deployment - Vercel serverless function handler
handler = app

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)