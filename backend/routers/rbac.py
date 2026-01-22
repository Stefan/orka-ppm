"""
RBAC Router

API endpoints for role-based access control management.
Provides endpoints for:
- User role management
- Role assignments with scope support
- Effective permissions display
- Permission checking

Requirements: 4.1, 4.4
"""

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from auth.dependencies import get_current_user
from auth.rbac import require_admin
from auth.enhanced_permission_checker import EnhancedPermissionChecker
from auth.enhanced_rbac_models import (
    PermissionContext,
    RoleAssignment,
    RoleAssignmentRequest,
    RoleAssignmentResponse,
    UserPermissionsResponse,
    PermissionCheckRequest,
    PermissionCheckResponse,
    ScopeType,
)
from auth.rbac import UserRole, Permission, DEFAULT_ROLE_PERMISSIONS
from config.database import supabase
from services.rbac_audit_service import RBACAuditService

router = APIRouter(prefix="/api/rbac", tags=["RBAC"])

# Initialize permission checker and audit service
permission_checker = EnhancedPermissionChecker(supabase_client=supabase)
audit_service = RBACAuditService(supabase_client=supabase)


class UserWithRolesResponse(BaseModel):
    """User with their role assignments"""
    id: str
    email: str
    full_name: Optional[str] = None
    roles: List[RoleAssignmentResponse]


class RoleInfo(BaseModel):
    """Role information with permissions"""
    role: str
    permissions: List[str]
    description: str


@router.get("/users-with-roles", response_model=List[UserWithRolesResponse])
async def get_users_with_roles(
    current_user = Depends(require_admin())
):
    """
    Get all users with their role assignments.
    
    Requirements: 4.1 - User role management interface
    """
    try:
        if not supabase:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Fetch all users
        users_response = supabase.table("user_profiles").select(
            "user_id, email, full_name"
        ).execute()
        
        if not users_response.data:
            return []
        
        users_with_roles = []
        
        for user in users_response.data:
            user_id = user["user_id"]
            
            # Fetch role assignments for this user
            roles_response = supabase.table("user_roles").select(
                "id, role_id, scope_type, scope_id, assigned_at, roles(id, name)"
            ).eq("user_id", user_id).eq("is_active", True).execute()
            
            role_assignments = []
            if roles_response.data:
                for assignment in roles_response.data:
                    role_data = assignment.get("roles")
                    if role_data:
                        role_assignments.append(RoleAssignmentResponse(
                            id=UUID(assignment["id"]),
                            user_id=UUID(user_id),
                            role_id=UUID(assignment["role_id"]),
                            role_name=role_data.get("name"),
                            scope_type=assignment.get("scope_type"),
                            scope_id=UUID(assignment["scope_id"]) if assignment.get("scope_id") else None,
                            assigned_by=UUID(current_user.get("user_id")),  # Placeholder
                            assigned_at=datetime.fromisoformat(assignment["assigned_at"]),
                            is_active=True
                        ))
            
            users_with_roles.append(UserWithRolesResponse(
                id=user_id,
                email=user["email"],
                full_name=user.get("full_name"),
                roles=role_assignments
            ))
        
        return users_with_roles
        
    except Exception as e:
        print(f"Error fetching users with roles: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch users with roles: {str(e)}"
        )


@router.get("/roles", response_model=List[RoleInfo])
async def get_available_roles(
    current_user = Depends(require_admin())
):
    """
    Get all available roles and their permissions.
    
    Requirements: 4.1 - Role information for assignment interface
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
        print(f"Error fetching roles: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch roles: {str(e)}"
        )


@router.post("/role-assignments", response_model=RoleAssignmentResponse)
async def create_role_assignment(
    request: RoleAssignmentRequest,
    current_user = Depends(require_admin())
):
    """
    Create a new role assignment for a user.
    
    Supports global and scoped role assignments (organization, portfolio, project).
    
    Requirements: 4.1 - Role assignment with scope selection
    """
    try:
        if not supabase:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Validate user exists
        user_response = supabase.table("user_profiles").select("user_id").eq(
            "user_id", str(request.user_id)
        ).execute()
        
        if not user_response.data:
            raise HTTPException(status_code=404, detail=f"User {request.user_id} not found")
        
        # Validate role exists
        role_response = supabase.table("roles").select("id, name").eq(
            "id", str(request.role_id)
        ).execute()
        
        if not role_response.data:
            raise HTTPException(status_code=404, detail=f"Role {request.role_id} not found")
        
        role_name = role_response.data[0]["name"]
        
        # Check if assignment already exists
        existing_query = supabase.table("user_roles").select("id").eq(
            "user_id", str(request.user_id)
        ).eq("role_id", str(request.role_id)).eq("is_active", True)
        
        if request.scope_type:
            existing_query = existing_query.eq("scope_type", request.scope_type)
            if request.scope_id:
                existing_query = existing_query.eq("scope_id", str(request.scope_id))
        
        existing_response = existing_query.execute()
        
        if existing_response.data:
            raise HTTPException(
                status_code=400,
                detail="This role assignment already exists for the user"
            )
        
        # Create role assignment
        admin_user_id = current_user.get("user_id")
        assignment_data = {
            "user_id": str(request.user_id),
            "role_id": str(request.role_id),
            "scope_type": request.scope_type.value if request.scope_type else None,
            "scope_id": str(request.scope_id) if request.scope_id else None,
            "assigned_by": admin_user_id,
            "assigned_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": request.expires_at.isoformat() if request.expires_at else None,
            "is_active": True
        }
        
        insert_response = supabase.table("user_roles").insert(assignment_data).execute()
        
        if not insert_response.data:
            raise HTTPException(status_code=500, detail="Failed to create role assignment")
        
        assignment = insert_response.data[0]
        
        # Log to audit trail using audit service
        org_id = current_user.get("organization_id")
        org_uuid = UUID(org_id) if org_id else None
        
        audit_service.log_role_assignment(
            user_id=UUID(admin_user_id),
            target_user_id=request.user_id,
            role_id=request.role_id,
            role_name=role_name,
            organization_id=org_uuid,
            scope_type=request.scope_type.value if request.scope_type else None,
            scope_id=request.scope_id,
            expires_at=request.expires_at,
            success=True
        )
        
        return RoleAssignmentResponse(
            id=UUID(assignment["id"]),
            user_id=request.user_id,
            role_id=request.role_id,
            role_name=role_name,
            scope_type=request.scope_type,
            scope_id=request.scope_id,
            assigned_by=UUID(admin_user_id),
            assigned_at=datetime.fromisoformat(assignment["assigned_at"]),
            expires_at=datetime.fromisoformat(assignment["expires_at"]) if assignment.get("expires_at") else None,
            is_active=True
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating role assignment: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create role assignment: {str(e)}"
        )


@router.delete("/users/{user_id}/roles/{role_id}")
async def delete_role_assignment(
    user_id: UUID,
    role_id: UUID,
    current_user = Depends(require_admin())
):
    """
    Remove a role assignment from a user.
    
    Requirements: 4.1 - Role assignment management
    """
    try:
        if not supabase:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Find the role assignment
        assignment_response = supabase.table("user_roles").select(
            "id, role_id, roles(name)"
        ).eq("user_id", str(user_id)).eq("id", str(role_id)).eq("is_active", True).execute()
        
        if not assignment_response.data:
            raise HTTPException(status_code=404, detail="Role assignment not found")
        
        assignment = assignment_response.data[0]
        role_name = assignment.get("roles", {}).get("name", "unknown")
        
        # Soft delete the assignment
        supabase.table("user_roles").update({
            "is_active": False
        }).eq("id", str(role_id)).execute()
        
        # Log to audit trail using audit service
        admin_user_id = current_user.get("user_id")
        org_id = current_user.get("organization_id")
        org_uuid = UUID(org_id) if org_id else None
        
        audit_service.log_role_removal(
            user_id=UUID(admin_user_id),
            target_user_id=user_id,
            role_id=UUID(assignment["role_id"]),
            role_name=role_name,
            organization_id=org_uuid,
            success=True
        )
        
        return {
            "message": "Role assignment removed successfully",
            "user_id": str(user_id),
            "role_id": str(role_id)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error removing role assignment: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to remove role assignment: {str(e)}"
        )


@router.get("/users/{user_id}/effective-permissions", response_model=UserPermissionsResponse)
async def get_user_effective_permissions(
    user_id: UUID,
    context: Optional[str] = Query(None, description="JSON-encoded permission context"),
    current_user = Depends(require_admin())
):
    """
    Get effective permissions for a user, including inherited permissions.
    
    Requirements: 4.4 - Display effective permissions showing inherited permissions
    """
    try:
        # Parse context if provided
        permission_context = None
        if context:
            import json
            context_data = json.loads(context)
            permission_context = PermissionContext(**context_data)
        
        # Get effective roles
        effective_roles = await permission_checker.get_effective_roles(user_id, permission_context)
        
        # Get aggregated permissions
        permissions = await permission_checker.get_user_permissions(user_id, permission_context)
        
        return UserPermissionsResponse(
            user_id=user_id,
            effective_roles=effective_roles,
            permissions=[p.value for p in permissions],
            context=permission_context
        )
        
    except Exception as e:
        print(f"Error fetching effective permissions: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch effective permissions: {str(e)}"
        )


@router.get("/user-permissions", response_model=UserPermissionsResponse)
async def get_current_user_permissions(
    context: Optional[str] = Query(None, description="JSON-encoded permission context"),
    current_user = Depends(get_current_user)
):
    """
    Get effective permissions for the current authenticated user.
    
    This endpoint is used by the frontend to load user permissions.
    
    Requirements: 3.2 - Real-time permission loading
    """
    try:
        user_id = UUID(current_user.get("user_id"))
        
        # Parse context if provided
        permission_context = None
        if context:
            import json
            context_data = json.loads(context)
            permission_context = PermissionContext(**context_data)
        
        # Get effective roles
        effective_roles = await permission_checker.get_effective_roles(user_id, permission_context)
        
        # Get aggregated permissions
        permissions = await permission_checker.get_user_permissions(user_id, permission_context)
        
        return UserPermissionsResponse(
            user_id=user_id,
            effective_roles=effective_roles,
            permissions=[p.value for p in permissions],
            context=permission_context
        )
        
    except Exception as e:
        print(f"Error fetching user permissions: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch user permissions: {str(e)}"
        )


@router.get("/check-permission", response_model=PermissionCheckResponse)
async def check_permission(
    permission: str = Query(..., description="Permission to check"),
    context: Optional[str] = Query(None, description="JSON-encoded permission context"),
    current_user = Depends(get_current_user)
):
    """
    Check if the current user has a specific permission.
    
    Supports context-aware permission checking.
    
    Requirements: 1.2 - Permission verification
    """
    try:
        user_id = UUID(current_user.get("user_id"))
        
        # Validate permission
        try:
            perm = Permission(permission)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid permission: {permission}")
        
        # Parse context if provided
        permission_context = None
        if context:
            import json
            context_data = json.loads(context)
            permission_context = PermissionContext(**context_data)
        
        # Check permission
        has_permission = await permission_checker.check_permission(user_id, perm, permission_context)
        
        # Get source role if permission is granted
        source_role = None
        if has_permission:
            effective_roles = await permission_checker.get_effective_roles(user_id, permission_context)
            for role in effective_roles:
                if perm.value in role.permissions:
                    source_role = role.role_name
                    break
        
        return PermissionCheckResponse(
            has_permission=has_permission,
            permission=permission,
            context=permission_context,
            source_role=source_role
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error checking permission: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to check permission: {str(e)}"
        )



# ============================================================================
# Audit Trail Endpoints (Task 8.3)
# ============================================================================

class AuditLogResponse(BaseModel):
    """Response model for audit log entries"""
    id: str
    organization_id: str
    user_id: str
    action: str
    entity_type: str
    entity_id: str
    details: dict
    success: bool
    created_at: str


class AuditLogListResponse(BaseModel):
    """Response model for paginated audit log list"""
    logs: List[AuditLogResponse]
    total_count: int
    page: int
    per_page: int
    total_pages: int


@router.get("/audit/role-changes", response_model=AuditLogListResponse)
async def get_role_change_audit_logs(
    limit: int = Query(50, ge=1, le=200, description="Number of records per page"),
    offset: int = Query(0, ge=0, description="Number of records to skip"),
    user_id: Optional[str] = Query(None, description="Filter by admin user ID"),
    target_user_id: Optional[str] = Query(None, description="Filter by affected user ID"),
    role_name: Optional[str] = Query(None, description="Filter by role name"),
    action: Optional[str] = Query(None, description="Filter by action type"),
    start_date: Optional[str] = Query(None, description="Filter by start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="Filter by end date (ISO format)"),
    current_user = Depends(require_admin())
):
    """
    Get audit trail for role and permission changes.
    
    Provides comprehensive audit logging with filtering options for:
    - Role assignments and removals
    - Custom role creation, updates, and deletion
    - Permission changes
    
    Requirements: 4.5 - Audit logging for role and permission changes
    """
    try:
        # Parse date filters if provided
        start_datetime = None
        end_datetime = None
        
        if start_date:
            try:
                start_datetime = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid start_date format. Use ISO format.")
        
        if end_date:
            try:
                end_datetime = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid end_date format. Use ISO format.")
        
        # Convert string UUIDs to UUID objects if provided
        user_uuid = UUID(user_id) if user_id else None
        target_user_uuid = UUID(target_user_id) if target_user_id else None
        
        # Get audit logs from service
        result = audit_service.get_role_change_history(
            limit=limit,
            offset=offset,
            user_id=user_uuid,
            target_user_id=target_user_uuid,
            role_name=role_name,
            action=action,
            start_date=start_datetime,
            end_date=end_datetime
        )
        
        # Convert to response model
        logs = [
            AuditLogResponse(
                id=log.get("id", ""),
                organization_id=log.get("organization_id", ""),
                user_id=log.get("user_id", ""),
                action=log.get("action", ""),
                entity_type=log.get("entity_type", ""),
                entity_id=log.get("entity_id", ""),
                details=log.get("details", {}),
                success=log.get("success", True),
                created_at=log.get("created_at", "")
            )
            for log in result.get("logs", [])
        ]
        
        return AuditLogListResponse(
            logs=logs,
            total_count=result.get("total_count", 0),
            page=result.get("page", 1),
            per_page=result.get("per_page", limit),
            total_pages=result.get("total_pages", 0)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching role change audit logs: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch audit logs: {str(e)}"
        )


@router.get("/audit/users/{user_id}/role-history", response_model=List[AuditLogResponse])
async def get_user_role_history(
    user_id: UUID,
    limit: int = Query(50, ge=1, le=200, description="Maximum number of records"),
    current_user = Depends(require_admin())
):
    """
    Get complete role change history for a specific user.
    
    Shows all role assignments and removals for the user in chronological order.
    
    Requirements: 4.5 - User-specific audit trail
    """
    try:
        # Get user role history from service
        logs = audit_service.get_user_role_history(
            target_user_id=user_id,
            limit=limit
        )
        
        # Convert to response model
        return [
            AuditLogResponse(
                id=log.get("id", ""),
                organization_id=log.get("organization_id", ""),
                user_id=log.get("user_id", ""),
                action=log.get("action", ""),
                entity_type=log.get("entity_type", ""),
                entity_id=log.get("entity_id", ""),
                details=log.get("details", {}),
                success=log.get("success", True),
                created_at=log.get("created_at", "")
            )
            for log in logs
        ]
        
    except Exception as e:
        print(f"Error fetching user role history: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch user role history: {str(e)}"
        )


@router.get("/audit/roles/{role_id}/modification-history", response_model=List[AuditLogResponse])
async def get_role_modification_history(
    role_id: UUID,
    limit: int = Query(50, ge=1, le=200, description="Maximum number of records"),
    current_user = Depends(require_admin())
):
    """
    Get complete modification history for a specific role.
    
    Shows all creation, updates, and deletion events for the role.
    
    Requirements: 4.5 - Role-specific audit trail
    """
    try:
        # Get role modification history from service
        logs = audit_service.get_role_modification_history(
            role_id=role_id,
            limit=limit
        )
        
        # Convert to response model
        return [
            AuditLogResponse(
                id=log.get("id", ""),
                organization_id=log.get("organization_id", ""),
                user_id=log.get("user_id", ""),
                action=log.get("action", ""),
                entity_type=log.get("entity_type", ""),
                entity_id=log.get("entity_id", ""),
                details=log.get("details", {}),
                success=log.get("success", True),
                created_at=log.get("created_at", "")
            )
            for log in logs
        ]
        
    except Exception as e:
        print(f"Error fetching role modification history: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch role modification history: {str(e)}"
        )
