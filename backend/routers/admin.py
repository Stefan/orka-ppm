"""
Admin dashboard and system management endpoints
"""

from fastapi import APIRouter, HTTPException, Depends, status
from typing import Dict, Any, List, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from uuid import UUID

from auth.rbac import require_admin, UserRole, Permission, DEFAULT_ROLE_PERMISSIONS
from auth.dependencies import get_current_user
from config.database import supabase
from services.rbac_audit_service import RBACAuditService

router = APIRouter(prefix="/admin", tags=["admin"])

# Initialize audit service
audit_service = RBACAuditService(supabase_client=supabase)

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


# ============================================================================
# RBAC Role Management Endpoints (Task 12)
# ============================================================================

class RoleInfo(BaseModel):
    """Information about a role and its permissions"""
    role: str
    permissions: List[str]
    description: str

class AssignRoleRequest(BaseModel):
    """Request to assign a role to a user"""
    role: str = Field(..., pattern="^(admin|portfolio_manager|project_manager|resource_manager|team_member|viewer)$")

class UserRoleInfo(BaseModel):
    """Information about a user and their roles"""
    user_id: str
    user_name: str
    email: str
    roles: List[str]

@router.get("/roles", response_model=List[RoleInfo])
async def get_roles(current_user = Depends(require_admin())):
    """
    Get all available roles and their associated permissions.
    
    Requirements: 9.1
    Property 24: Admin Authorization
    """
    try:
        # Define role descriptions
        role_descriptions = {
            "admin": "Full system access with user and role management capabilities",
            "portfolio_manager": "Manage portfolios, projects, and resources with AI insights",
            "project_manager": "Manage individual projects, resources, and risks",
            "resource_manager": "Manage resource allocations and availability",
            "team_member": "Basic project participation and issue reporting",
            "viewer": "Read-only access to projects and reports"
        }
        
        # Build response with all roles and their permissions
        roles_info = []
        for role in UserRole:
            permissions = DEFAULT_ROLE_PERMISSIONS.get(role, [])
            roles_info.append(RoleInfo(
                role=role.value,
                permissions=[perm.value for perm in permissions],
                description=role_descriptions.get(role.value, "")
            ))
        
        return roles_info
        
    except Exception as e:
        print(f"Get roles error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve roles: {str(e)}"
        )

@router.post("/users/{user_id}/roles")
async def assign_role_to_user(
    user_id: UUID,
    request: AssignRoleRequest,
    current_user = Depends(require_admin())
):
    """
    Assign a role to a user.
    
    Requirements: 9.2, 9.5, 9.6
    Property 24: Admin Authorization
    Property 25: Role Assignment and Removal
    """
    try:
        if not supabase:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Validate user exists
        user_response = supabase.table("user_profiles").select("user_id, role, is_active").eq("user_id", str(user_id)).execute()
        if not user_response.data:
            raise HTTPException(status_code=404, detail=f"User {user_id} not found")
        
        # Validate role exists
        try:
            role_enum = UserRole(request.role)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid role: {request.role}")
        
        # Check if role assignment already exists
        existing_role = supabase.table("user_roles").select("*").eq("user_id", str(user_id)).eq("role", request.role).execute()
        
        if existing_role.data:
            raise HTTPException(status_code=400, detail=f"User already has role: {request.role}")
        
        # Assign role to user
        role_assignment = {
            "user_id": str(user_id),
            "role": request.role,
            "assigned_at": datetime.now().isoformat(),
            "assigned_by": current_user.get("user_id")
        }
        
        supabase.table("user_roles").insert(role_assignment).execute()
        
        # Log role assignment to audit_logs
        admin_user_id = current_user.get("user_id")
        organization_id = current_user.get("organization_id", "00000000-0000-0000-0000-000000000000")
        
        audit_log = {
            "organization_id": organization_id,
            "user_id": admin_user_id,
            "action": "role_assignment",
            "entity_type": "user",
            "entity_id": str(user_id),
            "details": {
                "role": request.role,
                "affected_user_id": str(user_id),
                "admin_user_id": admin_user_id
            },
            "success": True,
            "created_at": datetime.now().isoformat()
        }
        
        supabase.table("audit_logs").insert(audit_log).execute()
        
        return {
            "message": f"Role '{request.role}' assigned to user {user_id}",
            "user_id": str(user_id),
            "role": request.role,
            "assigned_at": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Assign role error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to assign role: {str(e)}"
        )

@router.delete("/users/{user_id}/roles/{role}")
async def remove_role_from_user(
    user_id: UUID,
    role: str,
    current_user = Depends(require_admin())
):
    """
    Remove a role from a user.
    
    Requirements: 9.3, 9.5, 9.6
    Property 24: Admin Authorization
    Property 25: Role Assignment and Removal
    """
    try:
        if not supabase:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Validate user exists
        user_response = supabase.table("user_profiles").select("id, email, full_name").eq("id", str(user_id)).execute()
        if not user_response.data:
            raise HTTPException(status_code=404, detail=f"User {user_id} not found")
        
        # Validate role exists
        try:
            role_enum = UserRole(role)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid role: {role}")
        
        # Check if role assignment exists
        existing_role = supabase.table("user_roles").select("*").eq("user_id", str(user_id)).eq("role", role).execute()
        
        if not existing_role.data:
            raise HTTPException(status_code=404, detail=f"User does not have role: {role}")
        
        # Remove role from user
        supabase.table("user_roles").delete().eq("user_id", str(user_id)).eq("role", role).execute()
        
        # Log role removal to audit_logs
        admin_user_id = current_user.get("user_id")
        organization_id = current_user.get("organization_id", "00000000-0000-0000-0000-000000000000")
        
        audit_log = {
            "organization_id": organization_id,
            "user_id": admin_user_id,
            "action": "role_removal",
            "entity_type": "user",
            "entity_id": str(user_id),
            "details": {
                "role": role,
                "affected_user_id": str(user_id),
                "admin_user_id": admin_user_id
            },
            "success": True,
            "created_at": datetime.now().isoformat()
        }
        
        supabase.table("audit_logs").insert(audit_log).execute()
        
        return {
            "message": f"Role '{role}' removed from user {user_id}",
            "user_id": str(user_id),
            "role": role,
            "removed_at": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Remove role error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to remove role: {str(e)}"
        )


# ============================================================================
# Custom Role Management Endpoints (Task 8.2)
# ============================================================================

class CustomRoleRequest(BaseModel):
    """Request to create or update a custom role"""
    name: str = Field(..., min_length=3, max_length=50, pattern="^[a-z][a-z0-9_]*$")
    description: str = Field(..., min_length=10, max_length=500)
    permissions: List[str]

class CustomRoleResponse(BaseModel):
    """Response for custom role operations"""
    id: str
    name: str
    description: str
    permissions: List[str]
    is_custom: bool
    assigned_users_count: int
    created_at: str
    updated_at: Optional[str] = None

@router.get("/roles/all", response_model=List[CustomRoleResponse])
async def get_all_roles(current_user = Depends(require_admin())):
    """
    Get all roles including system and custom roles.
    
    Requirements: 4.2 - Custom role listing
    """
    try:
        if not supabase:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Fetch all roles from database
        roles_response = supabase.table("roles").select("*").execute()
        
        roles_list = []
        for role in roles_response.data:
            # Count assigned users for this role
            user_count_response = supabase.table("user_roles").select(
                "id", count="exact"
            ).eq("role_id", role["id"]).eq("is_active", True).execute()
            
            user_count = user_count_response.count if user_count_response.count is not None else 0
            
            roles_list.append(CustomRoleResponse(
                id=role["id"],
                name=role["name"],
                description=role.get("description", ""),
                permissions=role.get("permissions", []),
                is_custom=role.get("is_custom", False),
                assigned_users_count=user_count,
                created_at=role.get("created_at", datetime.now().isoformat()),
                updated_at=role.get("updated_at")
            ))
        
        return roles_list
        
    except Exception as e:
        print(f"Get all roles error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve roles: {str(e)}"
        )

@router.post("/roles", response_model=CustomRoleResponse)
async def create_custom_role(
    request: CustomRoleRequest,
    current_user = Depends(require_admin())
):
    """
    Create a new custom role with specific permissions.
    
    Requirements: 4.2, 4.3 - Custom role creation with validation
    """
    try:
        if not supabase:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Validate permissions
        invalid_permissions = []
        for perm in request.permissions:
            try:
                Permission(perm)
            except ValueError:
                invalid_permissions.append(perm)
        
        if invalid_permissions:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid permissions: {', '.join(invalid_permissions)}"
            )
        
        # Check if role name already exists
        existing_role = supabase.table("roles").select("id").eq("name", request.name).execute()
        if existing_role.data:
            raise HTTPException(
                status_code=400,
                detail=f"Role with name '{request.name}' already exists"
            )
        
        # Validate permission combinations
        validation_errors = validate_permission_combinations(request.permissions)
        if validation_errors:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid permission configuration: {'; '.join(validation_errors)}"
            )
        
        # Create the custom role
        role_data = {
            "name": request.name,
            "description": request.description,
            "permissions": request.permissions,
            "is_custom": True,
            "created_at": datetime.now().isoformat(),
            "created_by": current_user.get("user_id")
        }
        
        insert_response = supabase.table("roles").insert(role_data).execute()
        
        if not insert_response.data:
            raise HTTPException(status_code=500, detail="Failed to create custom role")
        
        created_role = insert_response.data[0]
        
        # Log to audit trail using audit service
        admin_user_id = current_user.get("user_id")
        org_id = current_user.get("organization_id")
        org_uuid = UUID(org_id) if org_id else None
        
        audit_service.log_custom_role_creation(
            user_id=UUID(admin_user_id),
            role_id=UUID(created_role["id"]),
            role_name=request.name,
            permissions=request.permissions,
            description=request.description,
            organization_id=org_uuid,
            success=True
        )
        
        return CustomRoleResponse(
            id=created_role["id"],
            name=created_role["name"],
            description=created_role["description"],
            permissions=created_role["permissions"],
            is_custom=True,
            assigned_users_count=0,
            created_at=created_role["created_at"],
            updated_at=None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Create custom role error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create custom role: {str(e)}"
        )

@router.put("/roles/{role_id}", response_model=CustomRoleResponse)
async def update_custom_role(
    role_id: UUID,
    request: CustomRoleRequest,
    current_user = Depends(require_admin())
):
    """
    Update an existing custom role.
    
    Requirements: 4.2, 4.3 - Custom role editing with validation
    """
    try:
        if not supabase:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Fetch the role
        role_response = supabase.table("roles").select("*").eq("id", str(role_id)).execute()
        
        if not role_response.data:
            raise HTTPException(status_code=404, detail=f"Role {role_id} not found")
        
        role = role_response.data[0]
        
        # Prevent editing system roles
        if not role.get("is_custom", False):
            raise HTTPException(
                status_code=400,
                detail="Cannot edit system roles"
            )
        
        # Validate permissions
        invalid_permissions = []
        for perm in request.permissions:
            try:
                Permission(perm)
            except ValueError:
                invalid_permissions.append(perm)
        
        if invalid_permissions:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid permissions: {', '.join(invalid_permissions)}"
            )
        
        # Validate permission combinations
        validation_errors = validate_permission_combinations(request.permissions)
        if validation_errors:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid permission configuration: {'; '.join(validation_errors)}"
            )
        
        # Update the role
        update_data = {
            "description": request.description,
            "permissions": request.permissions,
            "updated_at": datetime.now().isoformat(),
            "updated_by": current_user.get("user_id")
        }
        
        update_response = supabase.table("roles").update(update_data).eq("id", str(role_id)).execute()
        
        if not update_response.data:
            raise HTTPException(status_code=500, detail="Failed to update custom role")
        
        updated_role = update_response.data[0]
        
        # Count assigned users
        user_count_response = supabase.table("user_roles").select(
            "id", count="exact"
        ).eq("role_id", str(role_id)).eq("is_active", True).execute()
        
        user_count = user_count_response.count if user_count_response.count is not None else 0
        
        # Log to audit trail using audit service
        admin_user_id = current_user.get("user_id")
        org_id = current_user.get("organization_id")
        org_uuid = UUID(org_id) if org_id else None
        
        audit_service.log_custom_role_update(
            user_id=UUID(admin_user_id),
            role_id=role_id,
            role_name=updated_role["name"],
            old_permissions=role.get("permissions", []),
            new_permissions=request.permissions,
            old_description=role.get("description", ""),
            new_description=request.description,
            organization_id=org_uuid,
            success=True
        )
        
        return CustomRoleResponse(
            id=updated_role["id"],
            name=updated_role["name"],
            description=updated_role["description"],
            permissions=updated_role["permissions"],
            is_custom=True,
            assigned_users_count=user_count,
            created_at=updated_role["created_at"],
            updated_at=updated_role.get("updated_at")
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Update custom role error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update custom role: {str(e)}"
        )

@router.delete("/roles/{role_id}")
async def delete_custom_role(
    role_id: UUID,
    current_user = Depends(require_admin())
):
    """
    Delete a custom role.
    
    Requirements: 4.2 - Custom role deletion
    """
    try:
        if not supabase:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Fetch the role
        role_response = supabase.table("roles").select("*").eq("id", str(role_id)).execute()
        
        if not role_response.data:
            raise HTTPException(status_code=404, detail=f"Role {role_id} not found")
        
        role = role_response.data[0]
        
        # Prevent deleting system roles
        if not role.get("is_custom", False):
            raise HTTPException(
                status_code=400,
                detail="Cannot delete system roles"
            )
        
        # Check if role has assigned users
        user_assignments = supabase.table("user_roles").select(
            "id", count="exact"
        ).eq("role_id", str(role_id)).eq("is_active", True).execute()
        
        if user_assignments.count and user_assignments.count > 0:
            # Deactivate all user assignments
            supabase.table("user_roles").update({
                "is_active": False
            }).eq("role_id", str(role_id)).execute()
        
        # Delete the role
        supabase.table("roles").delete().eq("id", str(role_id)).execute()
        
        # Log to audit trail using audit service
        admin_user_id = current_user.get("user_id")
        org_id = current_user.get("organization_id")
        org_uuid = UUID(org_id) if org_id else None
        
        audit_service.log_custom_role_deletion(
            user_id=UUID(admin_user_id),
            role_id=role_id,
            role_name=role["name"],
            permissions=role.get("permissions", []),
            affected_users_count=user_assignments.count if user_assignments.count else 0,
            organization_id=org_uuid,
            success=True
        )
        
        return {
            "message": f"Custom role '{role['name']}' deleted successfully",
            "role_id": str(role_id),
            "role_name": role["name"],
            "affected_users": user_assignments.count if user_assignments.count else 0
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Delete custom role error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete custom role: {str(e)}"
        )

def validate_permission_combinations(permissions: List[str]) -> List[str]:
    """
    Validate permission combinations and return list of errors.
    
    Requirements: 4.3 - Permission validation
    """
    errors = []
    
    # Check for system_admin with other permissions
    if "system_admin" in permissions and len(permissions) > 1:
        errors.append("system_admin permission should not be combined with other permissions")
    
    # Check role_manage requires user_manage
    if "role_manage" in permissions and "user_manage" not in permissions:
        errors.append("role_manage permission requires user_manage permission")
    
    # Check financial write requires read
    financial_write = [p for p in permissions if p in ["financial_create", "financial_update", "financial_delete"]]
    if financial_write and "financial_read" not in permissions:
        errors.append("Financial write permissions require financial_read permission")
    
    # Check project write requires read
    project_write = [p for p in permissions if p in ["project_create", "project_update", "project_delete"]]
    if project_write and "project_read" not in permissions:
        errors.append("Project write permissions require project_read permission")
    
    # Check portfolio write requires read
    portfolio_write = [p for p in permissions if p in ["portfolio_create", "portfolio_update", "portfolio_delete"]]
    if portfolio_write and "portfolio_read" not in permissions:
        errors.append("Portfolio write permissions require portfolio_read permission")
    
    # Check resource write requires read
    resource_write = [p for p in permissions if p in ["resource_create", "resource_update", "resource_delete", "resource_allocate"]]
    if resource_write and "resource_read" not in permissions:
        errors.append("Resource write permissions require resource_read permission")
    
    # Check risk write requires read
    risk_write = [p for p in permissions if p in ["risk_create", "risk_update", "risk_delete"]]
    if risk_write and "risk_read" not in permissions:
        errors.append("Risk write permissions require risk_read permission")
    
    # Check issue write requires read
    issue_write = [p for p in permissions if p in ["issue_create", "issue_update", "issue_delete"]]
    if issue_write and "issue_read" not in permissions:
        errors.append("Issue write permissions require issue_read permission")
    
    return errors
