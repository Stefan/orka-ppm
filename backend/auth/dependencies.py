"""
Authentication dependencies for FastAPI endpoints

This module provides authentication dependencies that integrate with the
SupabaseRBACBridge for enhanced JWT token handling with role information.
"""

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Dict, Any

# Security scheme
security = HTTPBearer(auto_error=False)

async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Dict[str, Any]:
    """
    Extract user from JWT token with development mode fallback.
    
    This function integrates with SupabaseRBACBridge to extract enhanced
    user information including roles and permissions from JWT tokens.
    """
    try:
        # Handle missing credentials in development mode
        if not credentials:
            default_user_id = "00000000-0000-0000-0000-000000000001"
            print("🔧 Development mode: No credentials provided, using default admin user")
            return {
                "user_id": default_user_id,
                "email": "dev@example.com",
                "tenant_id": default_user_id,
                "role": "admin",  # Add admin role for development
                "roles": ["admin"],
                "permissions": ["user_manage"]  # Add user_manage permission
            }
        
        token = credentials.credentials
        
        # Try to use SupabaseRBACBridge for enhanced token extraction
        try:
            from .supabase_rbac_bridge import get_supabase_rbac_bridge
            bridge = get_supabase_rbac_bridge()
            
            # Extract user info from token using the bridge
            user_info = await bridge.get_user_from_jwt(token)
            
            if user_info:
                user_id = user_info.get("user_id")
                # Return enhanced user info with roles and permissions
                # tenant_id: use from user_info or fallback to user_id (single-tenant)
                return {
                    "user_id": user_id,
                    "email": user_info.get("email", "dev@example.com"),
                    "roles": user_info.get("roles", []),
                    "permissions": user_info.get("permissions", []),
                    "effective_roles": user_info.get("effective_roles", []),
                    "tenant_id": user_info.get("tenant_id") or user_id,
                }
        except ImportError:
            print("🔧 SupabaseRBACBridge not available, using basic JWT decode")
        except Exception as bridge_error:
            print(f"🔧 Bridge error: {bridge_error}, falling back to basic decode")
        
        # Fallback to basic JWT decode
        payload = jwt.decode(token, options={"verify_signature": False})
        
        # Development fix: If no user_id in token, provide a default one
        user_id = payload.get("sub")
        if not user_id or user_id == "anon":
            # Use a default development user ID
            user_id = "00000000-0000-0000-0000-000000000001"
            print(f"🔧 Development mode: Using default user ID {user_id}")
        
        return {
            "user_id": user_id,
            "email": payload.get("email", "dev@example.com"),
            "roles": payload.get("roles", []),
            "permissions": payload.get("permissions", []),
            "tenant_id": payload.get("tenant_id") or payload.get("app_metadata", {}).get("tenant_id") or user_id,
        }
    except Exception as e:
        default_user_id = "00000000-0000-0000-0000-000000000001"
        print(f"🔧 Development mode: Auth error ({e}), using default admin user")
        # In development mode, fall back to default user instead of failing
        return {
            "user_id": default_user_id,
            "email": "dev@example.com",
            "tenant_id": default_user_id,
            "role": "admin",  # Add admin role for development
            "roles": ["admin"],
            "permissions": ["user_manage"]  # Add user_manage permission
        }

def get_current_user_id(current_user: Dict[str, Any] = Depends(get_current_user)) -> str:
    """Extract user ID from current user"""
    return current_user.get("user_id", "00000000-0000-0000-0000-000000000001")

async def get_current_user_with_roles(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Dict[str, Any]:
    """
    Extract user with full role and permission information from JWT token.
    
    This is an enhanced version of get_current_user that ensures role
    information is always included.
    """
    user = await get_current_user(credentials)
    
    # If roles are not in the token, fetch them from the bridge
    if "roles" not in user or not user["roles"]:
        # For development default user, provide admin roles
        if user.get("user_id") == "00000000-0000-0000-0000-000000000001":
            user["roles"] = ["admin"]
            user["permissions"] = ["user_manage"]
            user["effective_roles"] = ["admin"]
        else:
            try:
                from .supabase_rbac_bridge import get_supabase_rbac_bridge
                from uuid import UUID

                bridge = get_supabase_rbac_bridge()
                user_id = UUID(user["user_id"])

                # Get enhanced user info with roles
                enhanced_info = await bridge.get_enhanced_user_info(user_id)

                if enhanced_info:
                    user["roles"] = enhanced_info.get("roles", [])
                    user["permissions"] = enhanced_info.get("permissions", [])
                    user["effective_roles"] = enhanced_info.get("effective_roles", [])
            except Exception as e:
                print(f"🔧 Could not fetch roles for user: {e}")

    return user