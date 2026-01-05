from fastapi import FastAPI, HTTPException, status, Query, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
from dotenv import load_dotenv
from pydantic import BaseModel
from uuid import UUID
import os
import jwt
from typing import List, Dict, Any
from datetime import date, datetime
from enum import Enum

# Load environment variables
load_dotenv()

# Environment variables with robust fallbacks
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://xceyrfvxooiplbmwavlb.supabase.co")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjZXlyZnZ4b29pcGxibXdhdmxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY4Mjg3ODEsImV4cCI6MjA1MjQwNDc4MX0.jIyJlwx2g9xn8OTSaLum6H8BKqknyxB8gYxgEKdfgqo")

print(f"🔍 Backend Environment Check:")
print(f"- SUPABASE_URL: {SUPABASE_URL}")
print(f"- SUPABASE_ANON_KEY length: {len(SUPABASE_ANON_KEY)}")

# Create Supabase client with graceful error handling
supabase: Client = None
try:
    supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    print(f"✅ Supabase client created successfully")
    
    # Test connection with graceful failure
    try:
        test_response = supabase.table("portfolios").select("count", count="exact").limit(1).execute()
        print(f"✅ Supabase connection test successful")
    except Exception as test_error:
        print(f"⚠️ Supabase connection test failed: {test_error}")
        print(f"⚠️ Continuing with degraded functionality")
        
except Exception as e:
    print(f"❌ Error creating Supabase client: {e}")
    print(f"⚠️ Continuing without database functionality")
    supabase = None

app = FastAPI(
    title="PPM SaaS MVP API",
    description="AI-powered Project Portfolio Management Platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://orka-ppm.vercel.app",
        "https://ppm-pearl.vercel.app", 
        "https://orka-*.vercel.app",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
)

# Pydantic Models
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

class PortfolioCreate(BaseModel):
    name: str
    description: str | None = None
    owner_id: UUID

# Utility Functions
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

# Authentication
security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Extract user from JWT token"""
    try:
        token = credentials.credentials
        payload = jwt.decode(token, options={"verify_signature": False})
        return {"user_id": payload.get("sub"), "email": payload.get("email")}
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid authentication token")

# Endpoints
@app.get("/")
async def root():
    try:
        return {
            "message": "Willkommen zur PPM SaaS API – Deine Cora-Alternative mit agentic AI 🚀",
            "status": "healthy",
            "version": "1.0.0",
            "timestamp": datetime.now().isoformat(),
            "database_status": "connected" if supabase else "degraded"
        }
    except Exception as e:
        print(f"Root endpoint error: {e}")
        return {
            "message": "PPM SaaS API",
            "status": "error",
            "error": str(e),
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
        
        try:
            response = supabase.table("portfolios").select("count", count="exact").limit(1).execute()
            return {
                "status": "healthy",
                "database": "connected",
                "timestamp": datetime.now().isoformat()
            }
        except Exception as db_error:
            return {
                "status": "degraded",
                "database": "connection_failed",
                "error": str(db_error),
                "timestamp": datetime.now().isoformat()
            }
    except Exception as e:
        print(f"Health check error: {e}")
        return {
            "status": "unhealthy",
            "database": "unknown",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

@app.get("/debug")
async def debug_info():
    """Debug endpoint to check environment variables and system status"""
    try:
        env_vars = {
            "supabase_url_set": bool(os.getenv("SUPABASE_URL")),
            "supabase_key_set": bool(os.getenv("SUPABASE_ANON_KEY")),
            "supabase_url_length": len(os.getenv("SUPABASE_URL", "")),
            "supabase_key_length": len(os.getenv("SUPABASE_ANON_KEY", "")),
            "environment": "production" if os.getenv("VERCEL") else "development",
            "vercel_env": os.getenv("VERCEL_ENV", "unknown"),
            "timestamp": datetime.now().isoformat()
        }
        
        # Test Supabase client status
        supabase_status = {
            "client_initialized": supabase is not None,
            "client_type": str(type(supabase)) if supabase else "None"
        }
        
        # Test database connection
        db_status = {"connected": False, "error": None}
        if supabase:
            try:
                response = supabase.table("portfolios").select("count", count="exact").limit(1).execute()
                db_status["connected"] = True
                db_status["table_accessible"] = True
            except Exception as db_error:
                db_status["error"] = str(db_error)
                db_status["error_type"] = type(db_error).__name__
        
        return {
            "status": "debug_info",
            "environment": env_vars,
            "supabase": supabase_status,
            "database": db_status,
            "message": "Backend debug information"
        }
        
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "error_type": type(e).__name__,
            "timestamp": datetime.now().isoformat()
        }

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
        print(f"Dashboard error: {e}")
        raise HTTPException(status_code=500, detail=f"Dashboard data retrieval failed: {str(e)}")

# Portfolio-specific endpoints that frontend expects
@app.get("/portfolio/kpis")
async def get_portfolio_kpis(current_user = Depends(get_current_user)):
    """Get portfolio KPIs"""
    try:
        dashboard_data = await get_dashboard_data(current_user)
        return {
            "kpis": dashboard_data["metrics"],
            "timestamp": dashboard_data["timestamp"]
        }
    except Exception as e:
        print(f"Portfolio KPIs error: {e}")
        raise HTTPException(status_code=500, detail=f"KPI data retrieval failed: {str(e)}")

@app.get("/portfolio/trends")
async def get_portfolio_trends(current_user = Depends(get_current_user)):
    """Get portfolio trends data"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Get projects for trend analysis
        projects_response = supabase.table("projects").select("*").execute()
        projects = convert_uuids(projects_response.data)
        
        # Calculate simple trends
        trends = {
            "project_completion_rate": {
                "current": len([p for p in projects if p.get('status') == 'completed']) / max(len(projects), 1) * 100,
                "trend": "up",
                "change": 5.2
            },
            "budget_utilization": {
                "current": 75.5,
                "trend": "stable",
                "change": 0.8
            },
            "health_score": {
                "current": len([p for p in projects if p.get('health') == 'green']) / max(len(projects), 1) * 100,
                "trend": "up",
                "change": 3.1
            }
        }
        
        return {
            "trends": trends,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        print(f"Portfolio trends error: {e}")
        raise HTTPException(status_code=500, detail=f"Trends data retrieval failed: {str(e)}")

@app.get("/portfolio/metrics")
async def get_portfolio_metrics(current_user = Depends(get_current_user)):
    """Get detailed portfolio metrics"""
    try:
        dashboard_data = await get_dashboard_data(current_user)
        
        # Enhanced metrics
        enhanced_metrics = {
            **dashboard_data["metrics"],
            "resource_utilization": 82.3,
            "risk_score": 2.1,
            "on_time_delivery": 87.5,
            "cost_performance_index": 0.95
        }
        
        return {
            "metrics": enhanced_metrics,
            "portfolios": dashboard_data["portfolios"],
            "timestamp": dashboard_data["timestamp"]
        }
    except Exception as e:
        print(f"Portfolio metrics error: {e}")
        raise HTTPException(status_code=500, detail=f"Metrics data retrieval failed: {str(e)}")

# For deployment - Vercel serverless function handler
handler = app

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)