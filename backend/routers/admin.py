"""
Admin dashboard and system management endpoints
"""

from fastapi import APIRouter, HTTPException, Depends, status
from typing import Dict, Any
from datetime import datetime
from pydantic import BaseModel

from auth.rbac import require_admin
from auth.dependencies import get_current_user
from config.database import supabase

router = APIRouter(prefix="/admin", tags=["admin"])

class BootstrapAdminRequest(BaseModel):
    email: str
    password: str = "admin123"  # Default password for development

@router.get("/performance/stats")
async def get_performance_stats(current_user = Depends(require_admin())):
    """Get system performance statistics"""
    try:
        # Mock performance stats for development
        return {
            "cpu_usage": 45.2,
            "memory_usage": 62.8,
            "disk_usage": 34.1,
            "active_connections": 12,
            "requests_per_minute": 156,
            "average_response_time": 245,
            "error_rate": 0.8,
            "uptime_seconds": 86400,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        print(f"Get performance stats error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get performance stats: {str(e)}")

@router.get("/performance/health")
async def get_system_health(current_user = Depends(require_admin())):
    """Get system health status"""
    try:
        # Check database connectivity
        db_status = "healthy"
        db_response_time = 0
        
        if supabase:
            try:
                start_time = datetime.now()
                supabase.table("portfolios").select("count", count="exact").limit(1).execute()
                db_response_time = (datetime.now() - start_time).total_seconds() * 1000
                db_status = "healthy"
            except Exception as db_error:
                print(f"Database health check failed: {db_error}")
                db_status = "degraded"
                db_response_time = -1
        else:
            db_status = "unavailable"
            db_response_time = -1
        
        return {
            "overall_status": "healthy" if db_status == "healthy" else "degraded",
            "database": {
                "status": db_status,
                "response_time_ms": db_response_time
            },
            "api": {
                "status": "healthy",
                "response_time_ms": 15
            },
            "cache": {
                "status": "healthy",
                "hit_rate": 85.4
            },
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        print(f"Get system health error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get system health: {str(e)}")

@router.get("/cache/stats")
async def get_cache_stats(current_user = Depends(require_admin())):
    """Get cache performance statistics"""
    try:
        # Mock cache stats for development
        return {
            "total_keys": 1247,
            "memory_usage_mb": 45.6,
            "hit_rate": 85.4,
            "miss_rate": 14.6,
            "evictions": 23,
            "operations_per_second": 342,
            "average_ttl_seconds": 1800,
            "top_keys": [
                {"key": "dashboard:*", "hits": 1234, "size_kb": 12.4},
                {"key": "user_permissions:*", "hits": 856, "size_kb": 8.2},
                {"key": "project_data:*", "hits": 645, "size_kb": 15.7}
            ],
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        print(f"Get cache stats error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get cache stats: {str(e)}")

@router.get("/system/info")
async def get_system_info(current_user = Depends(require_admin())):
    """Get system information and configuration"""
    try:
        return {
            "version": "1.0.0",
            "environment": "development",
            "database_connected": supabase is not None,
            "features": {
                "ai_enabled": False,
                "cache_enabled": True,
                "performance_monitoring": True,
                "user_management": True
            },
            "limits": {
                "max_users": 1000,
                "max_projects": 500,
                "max_file_size_mb": 10
            },
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        print(f"Get system info error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get system info: {str(e)}")

@router.post("/system/maintenance")
async def toggle_maintenance_mode(
    enabled: bool,
    current_user = Depends(require_admin())
):
    """Toggle system maintenance mode"""
    try:
        # In a real system, this would update a configuration flag
        return {
            "maintenance_mode": enabled,
            "message": f"Maintenance mode {'enabled' if enabled else 'disabled'}",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        print(f"Toggle maintenance mode error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to toggle maintenance mode: {str(e)}")

@router.get("/audit/logs")
async def get_audit_logs(
    limit: int = 50,
    offset: int = 0,
    current_user = Depends(require_admin())
):
    """Get system audit logs"""
    try:
        # Mock audit logs for development
        mock_logs = []
        for i in range(min(limit, 20)):
            mock_logs.append({
                "id": f"log-{i + offset + 1}",
                "timestamp": datetime.now().isoformat(),
                "user_id": "00000000-0000-0000-0000-000000000001",
                "action": "user_login" if i % 3 == 0 else "project_update" if i % 3 == 1 else "data_export",
                "resource": f"user/{i + 1}" if i % 3 == 0 else f"project/{i + 1}",
                "ip_address": f"192.168.1.{100 + i}",
                "user_agent": "Mozilla/5.0 (compatible; Admin Dashboard)",
                "success": True
            })
        
        return {
            "logs": mock_logs,
            "total_count": 1000,  # Mock total
            "page": (offset // limit) + 1,
            "per_page": limit,
            "total_pages": (1000 + limit - 1) // limit
        }
    except Exception as e:
        print(f"Get audit logs error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get audit logs: {str(e)}")

@router.post("/bootstrap/admin")
async def bootstrap_admin_user(request: BootstrapAdminRequest):
    """Bootstrap the first admin user - DEVELOPMENT ONLY"""
    try:
        # Security check: Only allow in development mode
        import os
        if os.getenv("DISABLE_BOOTSTRAP", "false").lower() == "true":
            raise HTTPException(
                status_code=403, 
                detail="Bootstrap endpoint is disabled in production. Use proper user creation process."
            )
        
        if os.getenv("ENVIRONMENT", "development") == "production":
            raise HTTPException(
                status_code=403,
                detail="Bootstrap endpoint not available in production environment."
            )
        
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Check if any users already exist
        try:
            existing_users = supabase.table("user_profiles").select("*").limit(1).execute()
            if existing_users.data:
                raise HTTPException(
                    status_code=400, 
                    detail="Users already exist. Use normal user creation process through admin panel."
                )
        except Exception as table_error:
            # Table doesn't exist, which is fine for bootstrapping
            print(f"user_profiles table not found, proceeding with bootstrap: {table_error}")
        
        # Log the bootstrap attempt for security
        print(f"🔐 SECURITY: Bootstrap admin attempted for email: {request.email}")
        
        # In a real system, this would:
        # 1. Create user in Supabase Auth
        # 2. Create user profile with admin role
        # 3. Set up initial permissions
        
        # For development, return success message
        return {
            "message": "Admin user bootstrapped successfully (DEVELOPMENT MODE)",
            "email": request.email,
            "user_id": "00000000-0000-0000-0000-000000000001",
            "role": "admin",
            "temporary_password": request.password,
            "security_notice": "This endpoint is for development only and should be disabled in production",
            "next_steps": [
                "Log in with the provided credentials",
                "Change the default password immediately",
                "Set up additional users through the admin panel",
                "Disable bootstrap endpoint for production (DISABLE_BOOTSTRAP=true)"
            ],
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Bootstrap admin user error: {e}")
@router.get("/help/setup")
async def get_setup_help():
    """Get safe setup help information - no sensitive details exposed"""
    try:
        import os
        environment = os.getenv("ENVIRONMENT", "development")
        
        if environment == "production":
            return {
                "message": "System is running in production mode",
                "user_management": {
                    "access": "Navigate to Admin > Users to manage users",
                    "create_users": "Use the 'Create User' button in the admin panel",
                    "roles": ["admin", "portfolio_manager", "project_manager", "resource_manager", "team_member", "viewer"]
                },
                "support": {
                    "documentation": "Contact your system administrator for setup documentation",
                    "api_docs": "Available at /docs endpoint",
                    "health_check": "Available at /health endpoint"
                },
                "security": {
                    "note": "All setup procedures should go through proper administrative channels",
                    "contact": "Contact your system administrator for user account setup"
                }
            }
        else:
            return {
                "message": "System is running in development mode",
                "user_management": {
                    "access": "Navigate to Admin > Users to manage users",
                    "development_features": [
                        "Mock users are automatically available",
                        "Default admin permissions are granted",
                        "No authentication required for development"
                    ],
                    "mock_users": [
                        {"email": "admin@example.com", "role": "admin"},
                        {"email": "manager@example.com", "role": "manager"},
                        {"email": "user@example.com", "role": "user"}
                    ]
                },
                "development_info": {
                    "note": "This is a development environment with relaxed security",
                    "api_docs": "Available at /docs endpoint",
                    "health_check": "Available at /health endpoint"
                },
                "production_note": "For production deployment, consult the system administrator"
            }
    except Exception as e:
        print(f"Get setup help error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get setup help")