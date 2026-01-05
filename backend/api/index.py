from fastapi import FastAPI, HTTPException, status, Query, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
from pydantic import BaseModel
from uuid import UUID
import os
import jwt
from typing import List, Dict, Any
from datetime import date, datetime
from enum import Enum

# Environment variables for Vercel
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://xceyrfvxooiplbmwavlb.supabase.co")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjZXlyZnZ4b29pcGxibXdhdmxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4Mjg3ODEsImV4cCI6MjA4MjQwNDc4MX0.jIyJlwx2g9xn8OTSaLum6H8BKqknyxB8gYxgEKdfgqo")

# Create Supabase client with error handling
supabase: Client = None
try:
    supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
except Exception as e:
    print(f"Supabase client creation failed: {e}")
    supabase = None

app = FastAPI(
    title="PPM SaaS API",
    description="AI-powered Project Portfolio Management Platform",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://orka-ppm.vercel.app",
        "https://ppm-pearl.vercel.app",
        "http://localhost:3000"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Models
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

# Utility functions
def convert_uuids(data):
    """Convert UUID objects to strings for JSON serialization"""
    if isinstance(data, list):
        return [convert_uuids(item) for item in data]
    elif isinstance(data, dict):
        return {key: convert_uuids(value) for key, value in data.items()}
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
    return {
        "message": "PPM SaaS API - Vercel Deployment",
        "status": "healthy",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat(),
        "database_status": "connected" if supabase else "degraded"
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
        
        return {
            "status": "healthy",
            "database": "connected",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "database": "unknown",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

@app.get("/debug")
async def debug_info():
    """Debug endpoint"""
    return {
        "status": "debug_info",
        "environment": {
            "supabase_url_set": bool(SUPABASE_URL),
            "supabase_key_set": bool(SUPABASE_ANON_KEY),
            "supabase_key_length": len(SUPABASE_ANON_KEY) if SUPABASE_ANON_KEY else 0,
            "environment": "vercel",
            "timestamp": datetime.now().isoformat()
        },
        "supabase": {
            "client_initialized": supabase is not None,
            "client_type": str(type(supabase)) if supabase else "None"
        }
    }

@app.get("/dashboard")
async def get_dashboard_data(current_user = Depends(get_current_user)):
    """Get dashboard data for the authenticated user"""
    try:
        if supabase is None:
            # Return mock data when database is not available
            return {
                "portfolios": [],
                "projects": [],
                "metrics": {
                    "total_projects": 0,
                    "active_projects": 0,
                    "completed_projects": 0,
                    "health_distribution": {"green": 0, "yellow": 0, "red": 0},
                    "budget_summary": {"total_budget": 0, "total_actual": 0, "variance": 0}
                },
                "timestamp": datetime.now().isoformat(),
                "note": "Mock data - database not connected"
            }
        
        # Get portfolios and projects
        portfolios_response = supabase.table("portfolios").select("*").execute()
        projects_response = supabase.table("projects").select("*").execute()
        
        portfolios = convert_uuids(portfolios_response.data)
        projects = convert_uuids(projects_response.data)
        
        # Calculate metrics
        total_projects = len(projects)
        active_projects = len([p for p in projects if p.get('status') == 'active'])
        completed_projects = len([p for p in projects if p.get('status') == 'completed'])
        
        health_distribution = {
            'green': len([p for p in projects if p.get('health') == 'green']),
            'yellow': len([p for p in projects if p.get('health') == 'yellow']),
            'red': len([p for p in projects if p.get('health') == 'red'])
        }
        
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
        raise HTTPException(status_code=500, detail=f"Dashboard data retrieval failed: {str(e)}")

# Portfolio endpoints that frontend expects
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
        raise HTTPException(status_code=500, detail=f"KPI data retrieval failed: {str(e)}")

@app.get("/portfolio/trends")
async def get_portfolio_trends(current_user = Depends(get_current_user)):
    """Get portfolio trends data"""
    try:
        trends = {
            "project_completion_rate": {"current": 75.0, "trend": "up", "change": 5.2},
            "budget_utilization": {"current": 82.5, "trend": "stable", "change": 0.8},
            "health_score": {"current": 88.3, "trend": "up", "change": 3.1}
        }
        
        return {
            "trends": trends,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Trends data retrieval failed: {str(e)}")

@app.get("/portfolio/metrics")
async def get_portfolio_metrics(current_user = Depends(get_current_user)):
    """Get detailed portfolio metrics"""
    try:
        dashboard_data = await get_dashboard_data(current_user)
        
        enhanced_metrics = {
            **dashboard_data["metrics"],
            "resource_utilization": 82.3,
            "risk_score": 2.1,
            "on_time_delivery": 87.5,
            "cost_performance_index": 0.95
        }
        
        return {
            "metrics": enhanced_metrics,
            "portfolios": dashboard_data.get("portfolios", []),
            "timestamp": dashboard_data["timestamp"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Metrics data retrieval failed: {str(e)}")

# For Vercel deployment
handler = app