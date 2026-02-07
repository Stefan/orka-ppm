"""
User management endpoints
"""

import json
import os

from fastapi import APIRouter, HTTPException, Depends, status, Query, Request
from uuid import UUID
from typing import Optional, Dict, Any, List
from datetime import datetime

# #region agent log
def _debug_log(msg: str, data: dict, hypothesis_id: str = ""):
    try:
        payload = {"message": msg, "data": data, "timestamp": int(datetime.now().timestamp() * 1000)}
        if hypothesis_id:
            payload["hypothesisId"] = hypothesis_id
        log_path = "/Users/stefan/Projects/orka-ppm/.cursor/debug.log"
        with open(log_path, "a") as f:
            f.write(json.dumps(payload) + "\n")
    except Exception:
        pass
# #endregion

from auth.rbac import require_permission, Permission, require_admin
from config.database import supabase, service_supabase
from services.user_management_audit import log_user_management_to_audit_trail
from models.users import (
    UserCreateRequest, UserResponse, UserUpdateRequest, UserDeactivationRequest,
    UserListResponse, UserStatus, UserRole, UserRoleResponse, UserInviteRequest
)
from utils.converters import convert_uuids

router = APIRouter(prefix="/api/admin/users", tags=["users"])


def _get_auth_user_by_id(user_id: str) -> Optional[dict]:
    """Get auth user by id via Auth Admin API. Returns dict with id, email, created_at, updated_at, last_sign_in_at or None if not found."""
    client = service_supabase if service_supabase else supabase
    if not client:
        return None
    try:
        resp = client.auth.admin.get_user_by_id(user_id)
        user = getattr(resp, "user", None) if resp else None
        if not user and resp and hasattr(resp, "id"):
            user = resp
        if not user:
            return None
        return {
            "id": str(getattr(user, "id", "")),
            "email": getattr(user, "email", "") or "",
            "created_at": getattr(user, "created_at", None),
            "updated_at": getattr(user, "updated_at", None),
            "last_sign_in_at": getattr(user, "last_sign_in_at", None),
        }
    except Exception as e:
        print(f"Auth admin get_user_by_id error: {e}")
        return None


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
            # #region agent log
            _debug_log("list_users_rpc_result", {"has_data": bool(result.data), "data_keys": list((result.data or {}).keys()) if isinstance(result.data, dict) else "not_dict"}, "A")
            # #endregion
            if result.data:
                users_data = result.data.get("users", [])
                total_count = result.data.get("total_count", 0)
                user_ids = []
                for row in users_data:
                    auth_data = row.get("auth", {}) or {}
                    uid = auth_data.get("id")
                    if uid:
                        user_ids.append(str(uid))
                # #region agent log
                _debug_log("list_users_rpc_user_ids", {"path": "rpc", "user_ids_len": len(user_ids), "user_ids_sample": user_ids[:3], "first_row_keys": list((users_data[0] or {}).keys()) if users_data else []}, "A")
                # #endregion
                roles_by_id = _fetch_roles_for_user_ids(user_ids)
                # #region agent log
                _debug_log("list_users_roles_by_id", {"path": "rpc", "roles_by_id_keys": list(roles_by_id.keys()), "sample": {k: roles_by_id[k] for k in list(roles_by_id.keys())[:2]}, "first_user_roles": roles_by_id.get(str(user_ids[0]), []) if user_ids else None}, "B")
                # #endregion
                users = []
                for row in users_data:
                    profile_data = row.get("profile", {}) or {}
                    auth_data = row.get("auth", {}) or {}
                    uid = auth_data.get("id", "")
                    user_response = create_user_response(
                        auth_data, profile_data,
                        roles=roles_by_id.get(str(uid), []) or None
                    )
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
            # #region agent log
            _debug_log("list_users_rpc_failed", {"path": "rpc_failed", "error": str(rpc_error)}, "A")
            # #endregion
            # Fallback to manual join if RPC function doesn't exist
            result = await _manual_join_users_and_profiles(page, per_page, search, status, role)
            print(f"Manual join returned {result.total_count} users")
            return result
        
    except Exception as e:
        print(f"List users error: {e}")
        import traceback
        traceback.print_exc()
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
        print(f"[DEBUG] Starting manual join - page={page}, per_page={per_page}")
        
        # Use Supabase Admin API to get auth users
        from config.database import service_supabase
        
        if not service_supabase:
            print("[DEBUG] Service client not available!")
            raise HTTPException(status_code=503, detail="Admin API not available")
        
        print("[DEBUG] Fetching users from Supabase admin API...")
        # Get auth users using admin API
        auth_response = service_supabase.auth.admin.list_users()
        auth_users = auth_response if isinstance(auth_response, list) else []
        print(f"[DEBUG] Found {len(auth_users)} auth users")
        
        # Get all user_profiles (service role so RLS does not hide other users' profiles)
        print("[DEBUG] Fetching user profiles...")
        profile_client = service_supabase or supabase
        profile_result = profile_client.table("user_profiles").select("*").execute()
        profiles = {p["user_id"]: p for p in (profile_result.data or [])}
        print(f"[DEBUG] Found {len(profiles)} user profiles")
        
        # Join the data: collect (auth_dict, profile, user_id) for users that pass filters
        joined = []
        for auth_user in auth_users:
            user_id = str(auth_user.id)
            profile = profiles.get(user_id, {})
            auth_dict = {
                "id": user_id,
                "email": auth_user.email,
                "created_at": auth_user.created_at,
                "updated_at": auth_user.updated_at,
                "last_sign_in_at": getattr(auth_user, 'last_sign_in_at', None)
            }
            if search and search.strip():
                if search.strip().lower() not in (auth_user.email or "").lower():
                    continue
            if status:
                if status == UserStatus.active and not profile.get("is_active", True):
                    continue
                elif status == UserStatus.inactive and profile.get("is_active", True):
                    continue
                elif status == UserStatus.deactivated and not profile.get("deactivated_at"):
                    continue
            if role and profile.get("role", "user") != role.value:
                continue
            joined.append((auth_dict, profile, user_id))
        # Fetch roles from user_roles for all matched user IDs
        user_ids = [uid for (_, _, uid) in joined]
        # #region agent log
        _debug_log("manual_join_user_ids", {"path": "manual", "user_ids_len": len(user_ids), "user_ids_sample": user_ids[:3]}, "D")
        # #endregion
        roles_by_id = _fetch_roles_for_user_ids(user_ids)
        # #region agent log
        _debug_log("manual_join_roles_by_id", {"path": "manual", "roles_by_id_keys": list(roles_by_id.keys()), "first_user_roles": roles_by_id.get(user_ids[0], []) if user_ids else None}, "B")
        # #endregion
        # Build user responses with roles
        joined_users = [
            create_user_response(auth_dict, profile, roles=roles_by_id.get(uid, []) or None)
            for auth_dict, profile, uid in joined
        ]
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

@router.post("/invite", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def invite_user(
    invite_data: UserInviteRequest,
    current_user = Depends(require_admin())
):
    """Invite a new user by email - creates user account and sends invitation"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        from config.database import service_supabase
        
        if not service_supabase:
            raise HTTPException(status_code=503, detail="Admin API not available")
        
        # Check if user already exists
        try:
            existing_user = service_supabase.auth.admin.list_users()
            if isinstance(existing_user, list):
                for user in existing_user:
                    if user.email == invite_data.email:
                        raise HTTPException(status_code=400, detail="User with this email already exists")
        except Exception as e:
            print(f"Error checking existing users: {e}")
        
        # Create user and send invite email via Supabase Auth (invite_user_by_email sends the email)
        try:
            invite_options = {
                "data": {
                    "invited_by": current_user.get("user_id"),
                    "invited_at": datetime.now().isoformat(),
                    "role": invite_data.role.value if hasattr(invite_data.role, "value") else invite_data.role,
                }
            }
            auth_response = service_supabase.auth.admin.invite_user_by_email(
                invite_data.email,
                invite_options
            )
            user = getattr(auth_response, "user", None)
            if not user or not getattr(user, "id", None):
                raise HTTPException(status_code=500, detail="Invite succeeded but no user id returned")
            user_id = str(user.id)
        except HTTPException:
            raise
        except Exception as auth_error:
            print(f"Error inviting user by email: {auth_error}")
            raise HTTPException(status_code=500, detail=f"Failed to create user account: {str(auth_error)}")
        
        # Create user profile (service role so RLS allows admin to insert for another user)
        try:
            user_profile_data = {
                "user_id": user_id,
                "role": invite_data.role.value if hasattr(invite_data.role, 'value') else invite_data.role,
                "is_active": True,
                "created_at": datetime.now().isoformat()
            }
            profile_client = service_supabase if service_supabase else supabase
            profile_response = profile_client.table("user_profiles").insert(user_profile_data).execute()
            
            if not profile_response.data:
                # Rollback: delete auth user if profile creation fails
                try:
                    service_supabase.auth.admin.delete_user(user_id)
                except:
                    pass
                raise HTTPException(status_code=400, detail="Failed to create user profile")
            
            profile = profile_response.data[0]
            
        except HTTPException:
            raise
        except Exception as profile_error:
            print(f"Error creating user profile: {profile_error}")
            # Rollback: delete auth user
            try:
                service_supabase.auth.admin.delete_user(user_id)
            except:
                pass
            raise HTTPException(status_code=500, detail=f"Failed to create user profile: {str(profile_error)}")
        
        # Log admin action
        await log_admin_action(
            current_user.get("user_id"),
            user_id,
            "invite_user",
            {"email": invite_data.email, "role": invite_data.role.value if hasattr(invite_data.role, 'value') else invite_data.role}
        )
        
        return UserResponse(
            id=user_id,
            email=invite_data.email,
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
        print(f"Invite user error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to invite user: {str(e)}")

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
        # For now, we'll create a placeholder profile (service role so RLS allows insert)
        user_profile_data = {
            "user_id": str(UUID()),  # This should be the actual auth user ID
            "role": user_data.role.value,
            "is_active": True
        }
        profile_client = service_supabase if service_supabase else supabase
        profile_response = profile_client.table("user_profiles").insert(user_profile_data).execute()
        
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
        
        # First check if auth user exists (Auth Admin API; no PostgREST on auth.users)
        auth_user = _get_auth_user_by_id(str(user_id))
        if not auth_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Use service role for user_profiles so RLS allows admin to update other users
        profile_client = service_supabase if service_supabase else supabase
        profile_response = profile_client.table("user_profiles").select("*").eq("user_id", str(user_id)).execute()
        
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
                update_response = profile_client.table("user_profiles").update(update_data).eq("user_id", str(user_id)).execute()
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
            
            create_response = profile_client.table("user_profiles").insert(profile_data).execute()
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
        
        # Check if auth user exists (Auth Admin API)
        auth_user = _get_auth_user_by_id(str(user_id))
        if not auth_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Prevent self-deletion
        if str(user_id) == current_user.get("user_id"):
            raise HTTPException(status_code=400, detail="Cannot delete your own account")
        
        # Use service role for user_profiles so RLS allows admin to delete other users' profiles
        profile_client = service_supabase if service_supabase else supabase
        profile_response = profile_client.table("user_profiles").select("*").eq("user_id", str(user_id)).execute()
        profile_existed = bool(profile_response.data)
        if profile_existed:
            profile_client.table("user_profiles").delete().eq("user_id", str(user_id)).execute()

        # Remove role assignments so auth delete can succeed (user_roles may reference auth.users)
        if service_supabase:
            try:
                service_supabase.table("user_roles").delete().eq("user_id", str(user_id)).execute()
            except Exception:
                pass

        # Delete from auth so user disappears from admin list (list is built from auth.admin.list_users())
        if service_supabase:
            try:
                service_supabase.auth.admin.delete_user(str(user_id))
            except Exception as auth_del_err:
                print(f"Auth delete user failed (profile may already be removed): {auth_del_err}")
                # Still return 204; profile/roles are cleaned; auth may need manual cleanup
        
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
        
        # Check if auth user exists (Auth Admin API)
        auth_user = _get_auth_user_by_id(str(user_id))
        if not auth_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Use service role for user_profiles so RLS allows admin to update/insert other users' profiles
        profile_client = service_supabase if service_supabase else supabase
        profile_response = profile_client.table("user_profiles").select("*").eq("user_id", str(user_id)).execute()
        
        update_data = {
            "is_active": False,
            "deactivated_at": datetime.now().isoformat(),
            "deactivated_by": current_user.get("user_id"),
            "deactivation_reason": deactivation_data.reason
        }
        
        if profile_response.data:
            # Profile exists, update it
            response = profile_client.table("user_profiles").update(update_data).eq("user_id", str(user_id)).execute()
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
            
            response = profile_client.table("user_profiles").insert(profile_data).execute()
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
    """Log administrative actions to admin_audit_log and to central audit trail (audit_logs)."""
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

    # Also write to central audit trail so user management appears in Audit Trail UI
    log_user_management_to_audit_trail(
        admin_user_id=admin_user_id or "",
        target_user_id=target_user_id,
        action=action,
        details=details,
    )


async def get_user_with_profile(user_id: str) -> Optional[Dict[str, Any]]:
    """Get complete user information from Auth Admin API and user_profiles, handling missing profiles gracefully"""
    try:
        if supabase is None:
            return None
        
        auth_user = _get_auth_user_by_id(user_id)
        if not auth_user:
            return None
        
        # Use service role so we can read any user's profile (e.g. admin viewing another user)
        profile_client = service_supabase if service_supabase else supabase
        profile_response = profile_client.table("user_profiles").select("*").eq("user_id", user_id).execute()
        profile = profile_response.data[0] if profile_response.data else {}
        
        return {
            "auth": auth_user,
            "profile": profile,
            "has_profile": bool(profile_response.data)
        }
        
    except Exception as e:
        print(f"Failed to get user with profile: {e}")
        return None


def _fetch_roles_for_user_ids(user_ids: List[str]) -> Dict[str, List[str]]:
    """Fetch role names from user_roles for given user IDs. Uses service role so RLS does not hide rows."""
    if not user_ids:
        return {}
    try:
        from config.database import service_supabase
        client = service_supabase if service_supabase else supabase
        # #region agent log
        _debug_log("fetch_roles_entry", {"user_ids_len": len(user_ids), "has_service_supabase": service_supabase is not None, "has_client": client is not None}, "B")
        # #endregion
        if not client:
            return {}
        # Select role names via join. Do not filter by is_active - column may not exist (migration 030).
        response = client.table("user_roles").select(
            "user_id, roles(name)"
        ).in_("user_id", user_ids).execute()
        out = {uid: [] for uid in user_ids}
        for row in (response.data or []):
            uid = row.get("user_id")
            if uid is None:
                continue
            uid = str(uid)
            role_obj = row.get("roles")
            name = role_obj.get("name") if isinstance(role_obj, dict) else None
            if name and uid in out:
                out[uid].append(name)
        # #region agent log
        _debug_log("fetch_roles_ok", {"row_count": len(response.data or []), "out_keys_with_roles": [k for k, v in out.items() if v]}, "E")
        # #endregion
        return out
    except Exception as e:
        # #region agent log
        _debug_log("fetch_roles_error", {"error": str(e)}, "B")
        # #endregion
        print(f"Error fetching roles for user list: {e}")
        return {}


def create_user_response(auth_data: dict, profile_data: dict, roles: Optional[List[str]] = None) -> UserResponse:
    """Create a consistent UserResponse object from auth and profile data, ensuring backward compatibility"""
    # Convert datetime objects to ISO strings
    last_login = auth_data.get("last_sign_in_at")
    if last_login and hasattr(last_login, 'isoformat'):
        last_login = last_login.isoformat()
    elif last_login and not isinstance(last_login, str):
        last_login = str(last_login)
    
    created_at = profile_data.get("created_at") or auth_data.get("created_at")
    if created_at and hasattr(created_at, 'isoformat'):
        created_at = created_at.isoformat()
    elif created_at and not isinstance(created_at, str):
        created_at = str(created_at)
    
    updated_at = profile_data.get("updated_at") or auth_data.get("updated_at")
    if updated_at and hasattr(updated_at, 'isoformat'):
        updated_at = updated_at.isoformat()
    elif updated_at and not isinstance(updated_at, str):
        updated_at = str(updated_at)
    
    role_from_profile = profile_data.get("role", "user")
    return UserResponse(
        id=auth_data.get("id", ""),
        email=auth_data.get("email", f"user{str(auth_data.get('id', ''))[:8]}@example.com"),
        role=role_from_profile,
        roles=roles if roles is not None else None,
        status=_determine_user_status(profile_data),
        is_active=profile_data.get("is_active", True),
        last_login=last_login,
        created_at=created_at,
        updated_at=updated_at,
        deactivated_at=profile_data.get("deactivated_at"),
        deactivated_by=profile_data.get("deactivated_by"),
        deactivation_reason=profile_data.get("deactivation_reason"),
        sso_provider=profile_data.get("sso_provider")
    )

# User Role Assignment Endpoints (part of main router, no separate prefix needed)
# These endpoints are already under /api/admin/users from the main router

@router.post("/{user_id}/roles/{role_id}", response_model=UserRoleResponse, status_code=status.HTTP_201_CREATED)
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

# DELETE /users/{user_id}/roles/{role} is implemented in admin router (role = role name string).
# A route here with role_id: UUID would match the same path and fail when frontend sends role name.

@router.get("/{user_id}/roles")
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

@router.get("/{user_id}/permissions")
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

# Role endpoints are now part of the main router (no separate router needed)