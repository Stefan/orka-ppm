"""
FastAPI application entry point - Refactored modular architecture
"""

import logging
from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from datetime import datetime
import os

logger = logging.getLogger(__name__)

# Import configuration
from config.settings import settings
from config.database import supabase

# Import authentication
from auth.dependencies import get_current_user

# Import utilities
from utils.converters import convert_uuids

# Import routers
from routers.portfolios import router as portfolios_router
from routers.projects import router as projects_router
from routers.projects_import import router as projects_import_router
from routers.scenarios import router as scenarios_router
from routers.simulations import router as simulations_router
from routers.reports import router as reports_router
from routers.resources import router as resources_router
from routers.users import router as users_router
from routers.risks import router as risks_router
from routers.financial import router as financial_router
from routers.feedback import router as feedback_router
from routers.ai import router as ai_router
from routers.csv_import import router as csv_import_router
from routers.variance import router as variance_router
from routers.admin import router as admin_router
# from routers.change.change_management_simple import router as change_management_router
from routers.schedules import router as schedules_router
from routers.help_chat import router as help_chat_router
from routers.ai_resource_optimizer import router as ai_resource_optimizer_router
from routers.enhanced_pmr import router as enhanced_pmr_router
from routers.shareable_urls import router as shareable_urls_router
from routers.po_breakdown import router as po_breakdown_router
from routers.feature_flags import router as feature_flags_router
from routers.audit import router as audit_router
from routers.admin_performance import router as admin_performance_router
from routers.workflows import router as workflows_router
from routers.rbac import router as rbac_router
from routers.viewer_restrictions_router import router as viewer_restrictions_router
from routers.imports import router as imports_router
from routers.rundown import router as rundown_router
from routers.features import router as features_router
from routers.feature_toggles import router as feature_toggles_router
from routers.erp import router as erp_router
from routers.costbook import router as costbook_router
from routers.change.change_orders import router as change_orders_router
from routers.change.change_approvals import router as change_approvals_router
from routers.contract_integration import router as contract_integration_router
from routers.change.change_analytics import router as change_analytics_router
from routers.project_controls import router as project_controls_router
from routers.forecasts import router as forecasts_router
from routers.earned_value import router as earned_value_router
from routers.performance_analytics import router as performance_analytics_router
from routers.search import router as search_router
from routers.distribution import router as distribution_router
from routers.integrations import router as integrations_router
from routers.auth_sso import router as auth_sso_router
from routers.saved_views import router as saved_views_router
from routers.registers import router as registers_router

# Import performance tracking middleware
from middleware.performance_tracker import PerformanceMiddleware, performance_tracker

# Import AI agents and services
try:
    from ai_agents import create_ai_agents
    ai_agents = create_ai_agents(supabase, settings.OPENAI_API_KEY, settings.OPENAI_BASE_URL) if supabase and settings.OPENAI_API_KEY else None
    if ai_agents:
        logger.info("AI agents initialized successfully")
        if settings.OPENAI_BASE_URL:
            logger.info("Using custom API endpoint: %s", settings.OPENAI_BASE_URL)
    else:
        logger.warning("AI agents not available - missing dependencies or configuration")
except ImportError as e:
    logger.warning("AI agents not available: %s", e)
    ai_agents = None
# Import and initialize help chat performance service
try:
    from services.help_chat_performance import initialize_help_chat_performance
    help_chat_performance = initialize_help_chat_performance(supabase) if supabase else None
    if help_chat_performance:
        logger.info("Help chat performance service initialized")
    else:
        logger.warning("Help chat performance service not available - database not configured")
except ImportError as e:
    logger.warning("Help chat performance service not available: %s", e)
    help_chat_performance = None

# Import performance optimization components
try:
    from performance_optimization import (
        CacheManager, PerformanceMonitor, BulkOperationManager, limiter,
        performance_middleware, version_middleware, APIVersionManager
    )
    from slowapi import _rate_limit_exceeded_handler
    from slowapi.errors import RateLimitExceeded
    from slowapi.middleware import SlowAPIMiddleware
    
    # Initialize performance components
    cache_manager = CacheManager(settings.REDIS_URL)
    performance_monitor = PerformanceMonitor()
    bulk_operation_manager = BulkOperationManager(cache_manager)
    version_manager = APIVersionManager()
    
    logger.info("Performance optimization components loaded")
except ImportError as e:
    logger.warning("Performance optimization not available: %s", e)
    cache_manager = None
    performance_monitor = None
    bulk_operation_manager = None
    version_manager = None

# Import pre-startup testing system
try:
    from pre_startup_testing.fastapi_integration import integrate_pre_startup_testing
    
    # Determine base URL for testing based on environment
    base_url = settings.base_url
    logger.info("Detected environment: %s", settings.environment)
    logger.info("Base URL for testing: %s", base_url)
    
    pre_startup_integration = None  # Will be set after app creation
    logger.info("Pre-startup testing system available")
except ImportError as e:
    logger.warning("Pre-startup testing system not available: %s", e)
    pre_startup_integration = None

# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    description=settings.APP_DESCRIPTION,
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Store components in app state for access in endpoints
if cache_manager:
    app.state.cache_manager = cache_manager
if performance_monitor:
    app.state.performance_monitor = performance_monitor
if bulk_operation_manager:
    app.state.bulk_operation_manager = bulk_operation_manager
if version_manager:
    app.state.version_manager = version_manager

# Response compression for large JSON payloads
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Add middleware
if cache_manager and performance_monitor:
    # Add rate limiting middleware
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)
    
    # Add performance monitoring middleware
    app.middleware("http")(performance_middleware)
    
    # Add API versioning middleware  
    app.middleware("http")(version_middleware)

# Enhanced CORS configuration for Vercel deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://orka-ppm.vercel.app",           # Current URL
        "https://ppm-saas.vercel.app",           # Likely new URL
        "https://ppm-saas-git-main.vercel.app",  # Git branch deployments
        "https://ppm-saas-*.vercel.app",         # Preview deployments
        "https://*.vercel.app",                  # All Vercel deployments
        "https://ppm-pearl.vercel.app",          # Legacy URL
        "http://localhost:3000",                 # Local development
        "http://127.0.0.1:3000",
        "https://localhost:3000"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=[
        "Accept",
        "Accept-Language", 
        "Content-Language",
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "X-Client-Info",
        "Cache-Control",
        "X-Correlation-ID",
    ],
)

# Integrate pre-startup testing after app creation
if pre_startup_integration is None:
    try:
        pre_startup_integration = integrate_pre_startup_testing(app, settings.base_url)
        logger.info("Pre-startup testing system integrated")
    except Exception as e:
        logger.warning("Error integrating pre-startup testing: %s", e)

# Register routers
app.include_router(portfolios_router)
app.include_router(projects_router)
app.include_router(projects_import_router)
app.include_router(scenarios_router)
app.include_router(simulations_router)
app.include_router(reports_router)
app.include_router(resources_router)
# Admin: performance router first so /api/admin/performance/stats and /health use real metrics, not admin_router mocks
app.include_router(admin_performance_router)
# Admin before users so DELETE /api/admin/users/{id}/roles/{role_name} matches admin (role=str), not users (role_id=UUID)
app.include_router(admin_router)
app.include_router(users_router)
app.include_router(risks_router)
app.include_router(financial_router)
app.include_router(feedback_router)
app.include_router(ai_router)
app.include_router(csv_import_router)
app.include_router(variance_router)
# app.include_router(change_management_router)
app.include_router(schedules_router)
app.include_router(help_chat_router)
app.include_router(ai_resource_optimizer_router)
app.include_router(enhanced_pmr_router)
app.include_router(shareable_urls_router)
app.include_router(po_breakdown_router)
app.include_router(feature_flags_router)
app.include_router(audit_router)
app.include_router(workflows_router)
app.include_router(rbac_router)
app.include_router(viewer_restrictions_router)
app.include_router(imports_router)
app.include_router(rundown_router)
app.include_router(feature_toggles_router)
app.include_router(features_router)
app.include_router(erp_router)
app.include_router(costbook_router)
app.include_router(change_orders_router)
app.include_router(change_approvals_router)
app.include_router(contract_integration_router)
app.include_router(change_analytics_router)
app.include_router(project_controls_router)
app.include_router(forecasts_router)
app.include_router(earned_value_router)
app.include_router(performance_analytics_router)
app.include_router(search_router)
app.include_router(distribution_router)
app.include_router(integrations_router)
app.include_router(auth_sso_router)
app.include_router(saved_views_router)
app.include_router(registers_router)

# Add performance tracking middleware
app.add_middleware(PerformanceMiddleware, tracker=performance_tracker)
logger.info("Performance tracking middleware enabled")

# Basic endpoints
@app.get("/")
async def root():
    """Root endpoint with system status"""
    try:
        return {
            "message": "Willkommen zur Orka PPM – mit agentic AI 🚀",
            "status": "healthy",
            "version": settings.APP_VERSION,
            "timestamp": datetime.now().isoformat(),
            "database_status": "connected" if supabase else "degraded",
            "ai_status": "available" if ai_agents else "unavailable",
            "environment": settings.environment
        }
    except Exception as e:
        logger.exception("Root endpoint error: %s", e)
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
        
        # Test Supabase connection
        try:
            response = supabase.table("portfolios").select("count", count="exact").execute()
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
        return {
            "status": "error",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

@app.get("/debug")
async def debug_info():
    """Debug endpoint to check environment variables and system status"""
    try:
        env_vars = {
            "supabase_url_set": bool(settings.SUPABASE_URL),
            "supabase_key_set": bool(settings.SUPABASE_ANON_KEY),
            "supabase_url_length": len(settings.SUPABASE_URL),
            "supabase_key_length": len(settings.SUPABASE_ANON_KEY),
            "environment": settings.environment,
            "vercel_env": os.getenv("VERCEL_ENV", "unknown"),
            "timestamp": datetime.now().isoformat()
        }
        
        # Add actual values for debugging (be careful in production)
        if settings.environment == "development":
            env_vars.update({
                "supabase_url": settings.SUPABASE_URL or "not_set",
                "supabase_key_preview": (settings.SUPABASE_ANON_KEY[:50] + "...") if settings.SUPABASE_ANON_KEY else "not_set"
            })
        
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


@app.get("/debug/verify-jwt")
async def debug_verify_jwt(request: Request):
    """
    Verify whether the given Bearer token can be validated by JWKS or SUPABASE_JWT_SECRET.
    Only available in development. Call with: Authorization: Bearer <your-session-access-token>
    """
    if settings.environment != "development":
        raise HTTPException(status_code=404, detail="Not available")
    auth = request.headers.get("Authorization") or request.headers.get("authorization")
    if not auth or not auth.startswith("Bearer "):
        return {
            "valid": False,
            "error": "Missing or invalid Authorization header (expected: Bearer <token>)",
        }
    token = auth[7:].strip()
    if not token:
        return {"valid": False, "error": "Empty token"}
    import jwt
    # 1) Try JWKS first if SUPABASE_URL is set
    supabase_url = (settings.SUPABASE_URL or "").strip()
    if supabase_url:
        from auth.jwks_client import get_supabase_jwks_url, verify_token_with_jwks
        jwks_url = get_supabase_jwks_url(supabase_url)
        if jwks_url:
            payload = verify_token_with_jwks(token, jwks_url)
            if payload:
                return {
                    "valid": True,
                    "method": "JWKS",
                    "sub": payload.get("sub"),
                    "exp": payload.get("exp"),
                    "email": payload.get("email"),
                }
    # 2) Fallback: HS256 with SUPABASE_JWT_SECRET
    secret = (settings.SUPABASE_JWT_SECRET or "").strip()
    if not secret:
        return {
            "valid": False,
            "error": "SUPABASE_JWT_SECRET is not set and JWKS verification did not succeed (or SUPABASE_URL not set). Set SUPABASE_URL for JWKS or SUPABASE_JWT_SECRET in backend .env",
        }
    try:
        payload = jwt.decode(token, secret, algorithms=["HS256"])
        return {
            "valid": True,
            "method": "HS256",
            "sub": payload.get("sub"),
            "exp": payload.get("exp"),
            "email": payload.get("email"),
        }
    except jwt.ExpiredSignatureError:
        return {"valid": False, "error": "Token expired (exp)"}
    except jwt.InvalidSignatureError:
        return {
            "valid": False,
            "error": "Invalid signature – SUPABASE_JWT_SECRET does not match the Supabase project that issued this token. Prefer JWKS by setting SUPABASE_URL, or check Project Settings → API → JWT Secret.",
        }
    except jwt.InvalidTokenError as e:
        return {"valid": False, "error": f"Invalid token: {e}"}
    except Exception as e:
        return {"valid": False, "error": str(e)}


# Enhanced health check endpoints
@app.get("/health/comprehensive")
async def comprehensive_health_check():
    """Comprehensive health check including user synchronization status"""
    try:
        from enhanced_health_check import get_comprehensive_health
        return await get_comprehensive_health()
    except ImportError:
        # Fallback to basic health check if enhanced module not available
        return await health_check()
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

@app.get("/health/user-sync")
async def user_sync_health_check():
    """User synchronization system health check"""
    try:
        from enhanced_health_check import get_user_sync_health
        return await get_user_sync_health()
    except ImportError:
        return {
            "status": "unavailable",
            "error": "Enhanced health check module not available",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

# Dashboard endpoint with caching
@app.get("/dashboard")
async def get_dashboard_data(request: Request, current_user = Depends(get_current_user)):
    """Get dashboard data for the authenticated user with caching"""
    try:
        # Try to get from cache first
        cache_manager = getattr(request.app.state, 'cache_manager', None)
        if cache_manager:
            cache_key = f"dashboard:{current_user['user_id']}"
            cached_data = await cache_manager.get(cache_key)
            if cached_data:
                cached_data["cache_status"] = "cached"
                return cached_data
        
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
        
        dashboard_data = {
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
            "timestamp": datetime.now().isoformat(),
            "cache_status": "fresh"
        }
        
        # Cache the result for 60 seconds
        if cache_manager:
            await cache_manager.set(cache_key, dashboard_data, ttl=60)
        
        return dashboard_data
        
    except Exception as e:
        logger.exception("Dashboard error: %s", e)
        raise HTTPException(status_code=500, detail=f"Dashboard data retrieval failed: {str(e)}")

# Historical note: routers below were added elsewhere; this block kept for reference.
# Import additional routers as they are created
# from routers.resources import router as resources_router
# from routers.financial import router as financial_router
# from routers.risks import router as risks_router
# from routers.users import router as users_router
# from routers.feedback import router as feedback_router
# from routers.ai import router as ai_router
# from routers.csv_import import router as csv_import_router
# from routers.scenarios import router as scenarios_router
# from routers.simulations import router as simulations_router
# from routers.shareable_urls import router as shareable_urls_router
# from routers.change.change_management import router as change_management_router

# app.include_router(resources_router)
# app.include_router(financial_router)
# app.include_router(risks_router)
# app.include_router(users_router)
# app.include_router(feedback_router)
# app.include_router(ai_router)
# app.include_router(csv_import_router)
# app.include_router(scenarios_router)
# app.include_router(simulations_router)
# app.include_router(shareable_urls_router)
# app.include_router(change_management_router)

# Initialize Rundown Profile Scheduler
try:
    from services.rundown_scheduler import get_rundown_scheduler
    rundown_scheduler = get_rundown_scheduler()
    logger.info("Rundown profile scheduler available")
except ImportError as e:
    logger.warning("Rundown scheduler not available: %s", e)
    rundown_scheduler = None

# Startup event for scheduler
@app.on_event("startup")
async def startup_event():
    """Application startup handler."""
    if rundown_scheduler:
        try:
            await rundown_scheduler.start()
            next_run = rundown_scheduler.get_next_run_time()
            if next_run:
                logger.info("Next rundown profile generation scheduled for: %s", next_run)
        except Exception as e:
            logger.warning("Failed to start rundown scheduler: %s", e)

# Shutdown event for scheduler
@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown handler."""
    if rundown_scheduler:
        try:
            await rundown_scheduler.stop()
        except Exception as e:
            logger.warning("Error stopping rundown scheduler: %s", e)

# For deployment - Vercel serverless function handler
handler = app

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)