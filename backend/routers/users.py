"""
User management endpoints
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query, Request
from uuid import UUID
from typing import Optional, Dict, Any
from datetime import datetime

from auth.rbac import require_permission, Permission, require_admin
from config.database import supabase
from models.users import (
    UserCreateRequest, UserResponse, UserUpdateRequest, UserDeactivationRequest,
    UserListResponse, UserStatus, UserRole, UserRoleResponse
)
from utils.converters import convert_uuids

router = APIRouter(prefix="/api/admin/users", tags=["users"])

@router.get("/", response_model=UserListResponse)
async def list_users(
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by email"),
    status: Optional[UserStatus] = Query(None, description="Filter by status"),
    role: Optional[UserRole] = Query(None, description="Filter by role"),
    current_user = Depends(require_admin())
):
    """Get all users with pagination, search, and filtering - joins auth.users and user_profiles"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Use RPC function to join auth.users and user_profiles with proper filtering
        try:
            # Build the RPC call with filters
            rpc_params = {
                "page_num": page,
                "page_size": per_page
            }
            
            if search and search.strip():
                rpc_params["search_email"] = search.strip().lower()
            
            if status:
                if status == UserStatus.active:
                    rpc_params["filter_active"] = True
                elif status == UserStatus.inactive:
                    rpc_params["filter_active"] = False
                elif status == UserStatus.deactivated:
                    rpc_params["filter_deactivated"] = True
            
            if role:
                rpc_params["filter_role"] = role.value
            
            # Call the RPC function to get joined user data
            result = supabase.rpc("get_users_with_profiles", rpc_params).execute()
            
            if result.data:
                users_data = result.data.get("users", [])
                total_count = result.data.get("total_count", 0)
                
                users = []
                for row in users_data:
                    # Handle missing profile gracefully
                    profile_data = row.get("profile", {}) or {}
                    auth_data = row.get("auth", {}) or {}
                    
                    user_response = create_user_response(auth_data, profile_data)
                    users.append(user_response)
                
                total_pages = (total_count + per_page - 1) // per_page
                
                return UserListResponse(
                    users=users,
                    total_count=total_count,
                    page=page,
                    per_page=per_page,
                    total_pages=total_pages
                )
            
        except Exception as rpc_error:
            print(f"RPC function failed, falling back to manual join: {rpc_error}")
            
            # Fallback to manual join if RPC function doesn't exist
            return await _manual_join_users_and_profiles(page, per_page, search, status, role)
        
    except Exception as e:
        print(f"List users error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list users: {str(e)}")


async def _manual_join_users_and_profiles(
    page: int, 
    per_page: int, 
    search: Optional[str], 
    status: Optional[UserStatus], 
    role: Optional[UserRole]
) -> UserListResponse:
    """Manual fallback for joining auth.users and user_profiles when RPC function is not available"""
    try:
        # Get all auth.users first
        auth_query = supabase.table("auth.users").select("id, email, created_at, updated_at, last_sign_in_at")
        
        # Apply email search filter
        if search and search.strip():
            auth_query = auth_query.ilike("email", f"%{search.strip()}%")
        
        auth_result = auth_query.execute()
        auth_users = auth_result.data or []
        
        # Get all user_profiles
        profile_query = supabase.table("user_profiles").select("*")
        profile_result = profile_query.execute()
        profiles = {p["user_id"]: p for p in (profile_result.data or [])}
        
        # Join the data
        joined_users = []
        for auth_user in auth_users:
            profile = profiles.get(auth_user["id"], {})
            
            # Apply status filter
            if status:
                if status == UserStatus.active and not profile.get("is_active", True):
                    continue
                elif status == UserStatus.inactive and profile.get("is_active", True):
                    continue
                elif status == UserStatus.deactivated and not profile.get("deactivated_at"):
                    continue
            
            # Apply role filter
            if role and profile.get("role", "user") != role.value:
                continue
            
            user_response = create_user_response(auth_user, profile)
            joined_users.append(user_response)
        
        # Apply pagination
        total_count = len(joined_users)
        total_pages = (total_count + per_page - 1) // per_page
        start_idx = (page - 1) * per_page
        end_idx = start_idx + per_page
        paginated_users = joined_users[start_idx:end_idx]
        
        return UserListResponse(
            users=paginated_users,
            total_count=total_count,
            page=page,
            per_page=per_page,
            total_pages=total_pages
        )
        
    except Exception as e:
        print(f"Manual join failed, returning empty result: {e}")
        return UserListResponse(
            users=[],
            total_count=0,
            page=page,
            per_page=per_page,
            total_pages=0
        )


def _determine_user_status(profile_data: dict) -> str:
    """Determine user status based on profile data"""
    if not profile_data:
        return "active"  # Default for users without profiles
    
    if profile_data.get("deactivated_at"):
        return "deactivated"
    elif profile_data.get("is_active", True):
        return "active"
    else:
        return "inactive"

@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreateRequest,
    current_user = Depends(require_admin())
):
    """Create a new user account"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Check if user already exists
        existing_user = supabase.table("user_profiles").select("*").eq("email", user_data.email).execute()
        if existing_user.data:
            raise HTTPException(status_code=400, detail="User with this email already exists")
        
        # Create user in Supabase Auth (this would typically be done via admin API)
        # For now, we'll create a placeholder profile
        user_profile_data = {
            "user_id": str(UUID()),  # This should be the actual auth user ID
            "role": user_data.role.value,
            "is_active": True
        }
        
        profile_response = supabase.table("user_profiles").insert(user_profile_data).execute()
        
        if not profile_response.data:
            raise HTTPException(status_code=400, detail="Failed to create user profile")
        
        profile = profile_response.data[0]
        
        # Log admin action
        await log_admin_action(
            current_user.get("user_id"),
            profile["user_id"],
            "create_user",
            {"email": user_data.email, "role": user_data.role.value}
        )
        
        return UserResponse(
            id=profile["user_id"],
            email=user_data.email,
            role=profile["role"],
            status="active",
            is_active=True,
            last_login=None,
            created_at=profile["created_at"],
            updated_at=profile.get("updated_at"),
            deactivated_at=None,
            deactivated_by=None,
            deactivation_reason=None,
            sso_provider=None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Create user error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create user: {str(e)}")

@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    current_user = Depends(require_admin())
):
    """Get a single user by ID - maintains backward compatibility"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        user_data = await get_user_with_profile(str(user_id))
        if not user_data:
            raise HTTPException(status_code=404, detail="User not found")
        
        return create_user_response(user_data["auth"], user_data["profile"])
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Get user error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get user: {str(e)}")


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    user_data: UserUpdateRequest,
    current_user = Depends(require_admin())
):
    """Update user information - handles missing profiles gracefully"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # First check if auth user exists
        auth_response = supabase.table("auth.users").select("*").eq("id", str(user_id)).execute()
        if not auth_response.data:
            raise HTTPException(status_code=404, detail="User not found")
        
        auth_user = auth_response.data[0]
        
        # Get existing user profile or create default values
        profile_response = supabase.table("user_profiles").select("*").eq("user_id", str(user_id)).execute()
        
        if profile_response.data:
            # Profile exists, update it
            profile = profile_response.data[0]
            
            # Prepare update data
            update_data = {}
            if user_data.role is not None:
                update_data["role"] = user_data.role.value
            
            if user_data.is_active is not None:
                update_data["is_active"] = user_data.is_active
                if not user_data.is_active:
                    update_data["deactivated_at"] = datetime.now().isoformat()
                    update_data["deactivated_by"] = current_user.get("user_id")
                    update_data["deactivation_reason"] = user_data.deactivation_reason
                else:
                    # Reactivating user
                    update_data["deactivated_at"] = None
                    update_data["deactivated_by"] = None
                    update_data["deactivation_reason"] = None
            
            if update_data:
                update_response = supabase.table("user_profiles").update(update_data).eq("user_id", str(user_id)).execute()
                if not update_response.data:
                    raise HTTPException(status_code=400, detail="Failed to update user profile")
                
                updated_profile = update_response.data[0]
            else:
                updated_profile = profile
        else:
            # Profile doesn't exist, create it with the update data
            profile_data = {
                "user_id": str(user_id),
                "role": user_data.role.value if user_data.role else "user",
                "is_active": user_data.is_active if user_data.is_active is not None else True
            }
            
            if user_data.is_active is False:
                profile_data["deactivated_at"] = datetime.now().isoformat()
                profile_data["deactivated_by"] = current_user.get("user_id")
                profile_data["deactivation_reason"] = user_data.deactivation_reason
            
            create_response = supabase.table("user_profiles").insert(profile_data).execute()
            if not create_response.data:
                raise HTTPException(status_code=400, detail="Failed to create user profile")
            
            updated_profile = create_response.data[0]
        
        # Log admin action
        await log_admin_action(
            current_user.get("user_id"),
            str(user_id),
            "update_user",
            {"profile_existed": bool(profile_response.data), "changes": user_data.dict(exclude_unset=True)}
        )
        
        return create_user_response(auth_user, updated_profile)
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Update user error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update user: {str(e)}")

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: UUID,
    current_user = Depends(require_admin())
):
    """Delete a user account - handles missing profiles gracefully"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Check if auth user exists
        auth_response = supabase.table("auth.users").select("*").eq("id", str(user_id)).execute()
        if not auth_response.data:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Prevent self-deletion
        if str(user_id) == current_user.get("user_id"):
            raise HTTPException(status_code=400, detail="Cannot delete your own account")
        
        # Check if profile exists and delete it if it does
        profile_response = supabase.table("user_profiles").select("*").eq("user_id", str(user_id)).execute()
        profile_existed = bool(profile_response.data)
        
        if profile_existed:
            supabase.table("user_profiles").delete().eq("user_id", str(user_id)).execute()
        
        # Note: In a real implementation, you would also delete from auth.users using Supabase Auth admin API
        # For now, we only delete the profile as auth.users deletion requires special permissions
        
        # Log admin action
        await log_admin_action(
            current_user.get("user_id"),
            str(user_id),
            "delete_user",
            {"reason": "Admin deletion", "profile_existed": profile_existed}
        )
        
        return None
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Delete user error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete user: {str(e)}")

@router.post("/{user_id}/deactivate", response_model=UserResponse)
async def deactivate_user(
    user_id: UUID,
    deactivation_data: UserDeactivationRequest,
    current_user = Depends(require_admin())
):
    """Deactivate a user account - handles missing profiles gracefully"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Prevent self-deactivation
        if str(user_id) == current_user.get("user_id"):
            raise HTTPException(status_code=400, detail="Cannot deactivate your own account")
        
        # Check if auth user exists
        auth_response = supabase.table("auth.users").select("*").eq("id", str(user_id)).execute()
        if not auth_response.data:
            raise HTTPException(status_code=404, detail="User not found")
        
        auth_user = auth_response.data[0]
        
        # Check if profile exists
        profile_response = supabase.table("user_profiles").select("*").eq("user_id", str(user_id)).execute()
        
        update_data = {
            "is_active": False,
            "deactivated_at": datetime.now().isoformat(),
            "deactivated_by": current_user.get("user_id"),
            "deactivation_reason": deactivation_data.reason
        }
        
        if profile_response.data:
            # Profile exists, update it
            response = supabase.table("user_profiles").update(update_data).eq("user_id", str(user_id)).execute()
            if not response.data:
                raise HTTPException(status_code=400, detail="Failed to deactivate user")
            updated_profile = response.data[0]
        else:
            # Profile doesn't exist, create it with deactivated status
            profile_data = {
                "user_id": str(user_id),
                "role": "user",  # Default role
                **update_data
            }
            
            response = supabase.table("user_profiles").insert(profile_data).execute()
            if not response.data:
                raise HTTPException(status_code=400, detail="Failed to create and deactivate user profile")
            updated_profile = response.data[0]
        
        # Log admin action
        await log_admin_action(
            current_user.get("user_id"),
            str(user_id),
            "deactivate_user",
            {
                "reason": deactivation_data.reason, 
                "notify_user": deactivation_data.notify_user,
                "profile_existed": bool(profile_response.data)
            }
        )
        
        return create_user_response(auth_user, updated_profile)
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Deactivate user error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to deactivate user: {str(e)}")

# Helper function for logging admin actions
async def log_admin_action(admin_user_id: str, target_user_id: str, action: str, details: Dict[str, Any]):
    """Log administrative actions for audit trail"""
    try:
        if supabase is None:
            return
        
        log_data = {
            "admin_user_id": admin_user_id,
            "target_user_id": target_user_id,
            "action": action,
            "details": details
        }
        
        supabase.table("admin_audit_log").insert(log_data).execute()
    except Exception as e:
        print(f"Failed to log admin action: {e}")


async def get_user_with_profile(user_id: str) -> Optional[Dict[str, Any]]:
    """Get complete user information from both auth.users and user_profiles, handling missing profiles gracefully"""
    try:
        if supabase is None:
            return None
        
        # Get auth user data
        auth_response = supabase.table("auth.users").select("*").eq("id", user_id).execute()
        if not auth_response.data:
            return None
        
        auth_user = auth_response.data[0]
        
        # Get profile data (may not exist)
        profile_response = supabase.table("user_profiles").select("*").eq("user_id", user_id).execute()
        profile = profile_response.data[0] if profile_response.data else {}
        
        return {
            "auth": auth_user,
            "profile": profile,
            "has_profile": bool(profile_response.data)
        }
        
    except Exception as e:
        print(f"Failed to get user with profile: {e}")
        return None


def create_user_response(auth_data: dict, profile_data: dict) -> UserResponse:
    """Create a consistent UserResponse object from auth and profile data, ensuring backward compatibility"""
    return UserResponse(
        id=auth_data.get("id", ""),
        email=auth_data.get("email", f"user{str(auth_data.get('id', ''))[:8]}@example.com"),
        role=profile_data.get("role", "user"),  # Default role for users without profiles
        status=_determine_user_status(profile_data),
        is_active=profile_data.get("is_active", True),  # Default to active for users without profiles
        last_login=auth_data.get("last_sign_in_at"),
        created_at=profile_data.get("created_at") or auth_data.get("created_at"),
        updated_at=profile_data.get("updated_at") or auth_data.get("updated_at"),
        deactivated_at=profile_data.get("deactivated_at"),
        deactivated_by=profile_data.get("deactivated_by"),
        deactivation_reason=profile_data.get("deactivation_reason"),
        sso_provider=profile_data.get("sso_provider")
    )

# User Role Assignment Endpoints (separate router for cleaner organization)
role_router = APIRouter(prefix="/users", tags=["user-roles"])

@role_router.post("/{user_id}/roles/{role_id}", response_model=UserRoleResponse, status_code=status.HTTP_201_CREATED)
async def assign_role_to_user(
    user_id: UUID, 
    role_id: UUID, 
    current_user = Depends(require_permission(Permission.user_manage))
):
    """Assign a role to a user"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Verify role exists
        role_response = supabase.table("roles").select("*").eq("id", str(role_id)).execute()
        if not role_response.data:
            raise HTTPException(status_code=404, detail="Role not found")
        
        role = role_response.data[0]
        
        # Check if assignment already exists
        existing_assignment = supabase.table("user_roles").select("*").eq("user_id", str(user_id)).eq("role_id", str(role_id)).execute()
        if existing_assignment.data:
            raise HTTPException(status_code=400, detail="Role already assigned to user")
        
        # Create assignment
        assignment_data = {
            "user_id": str(user_id),
            "role_id": str(role_id),
            "assigned_by": current_user.get("user_id"),
            "assigned_at": datetime.now().isoformat()
        }
        
        response = supabase.table("user_roles").insert(assignment_data).execute()
        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to assign role")
        
        assignment = response.data[0]
        
        return UserRoleResponse(
            id=assignment["id"],
            user_id=str(user_id),
            role_id=str(role_id),
            role_name=role["name"],
            assigned_by=assignment["assigned_by"],
            assigned_at=assignment["assigned_at"],
            created_at=assignment["created_at"],
            updated_at=assignment.get("updated_at")
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Assign role error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to assign role: {str(e)}")

@role_router.delete("/{user_id}/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_role_from_user(
    user_id: UUID, 
    role_id: UUID, 
    current_user = Depends(require_permission(Permission.user_manage))
):
    """Remove a role from a user"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        response = supabase.table("user_roles").delete().eq("user_id", str(user_id)).eq("role_id", str(role_id)).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Role assignment not found")
        
        return None
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Remove role error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to remove role: {str(e)}")

@role_router.get("/{user_id}/roles")
async def get_user_roles(user_id: UUID, current_user = Depends(require_permission(Permission.user_manage))):
    """Get all roles assigned to a user"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Join user_roles with roles table to get role details
        response = supabase.table("user_roles").select("*, roles(*)").eq("user_id", str(user_id)).execute()
        
        roles = []
        for assignment in response.data:
            role_data = assignment.get("roles", {})
            roles.append({
                "assignment_id": assignment["id"],
                "role_id": assignment["role_id"],
                "role_name": role_data.get("name", "Unknown"),
                "role_description": role_data.get("description", ""),
                "assigned_by": assignment["assigned_by"],
                "assigned_at": assignment["assigned_at"]
            })
        
        return {"user_id": str(user_id), "roles": roles}
        
    except Exception as e:
        print(f"Get user roles error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get user roles: {str(e)}")

@role_router.get("/{user_id}/permissions")
async def get_user_permissions(user_id: UUID, current_user = Depends(require_permission(Permission.user_manage))):
    """Get all permissions for a user (aggregated from all roles)"""
    try:
        # This would typically aggregate permissions from all assigned roles
        # For now, return a placeholder response
        return {
            "user_id": str(user_id),
            "permissions": ["portfolio_read", "project_read"]  # Placeholder
        }
        
    except Exception as e:
        print(f"Get user permissions error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get user permissions: {str(e)}")

# Include the role router in the main router
router.include_router(role_router)