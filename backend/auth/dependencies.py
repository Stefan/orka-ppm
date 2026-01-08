"""
Authentication dependencies for FastAPI endpoints
"""

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Dict, Any

# Security scheme
security = HTTPBearer(auto_error=False)

async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Dict[str, Any]:
    """Extract user from JWT token with development mode fallback"""
    try:
        # Handle missing credentials in development mode
        if not credentials:
            print("🔧 Development mode: No credentials provided, using default user")
            return {"user_id": "00000000-0000-0000-0000-000000000001", "email": "dev@example.com"}
        
        token = credentials.credentials
        # For now, just decode without verification for development
        payload = jwt.decode(token, options={"verify_signature": False})
        
        # Development fix: If no user_id in token, provide a default one
        user_id = payload.get("sub")
        if not user_id or user_id == "anon":
            # Use a default development user ID
            user_id = "00000000-0000-0000-0000-000000000001"
            print(f"🔧 Development mode: Using default user ID {user_id}")
        
        return {"user_id": user_id, "email": payload.get("email", "dev@example.com")}
    except Exception as e:
        print(f"🔧 Development mode: Auth error ({e}), using default user")
        # In development mode, fall back to default user instead of failing
        return {"user_id": "00000000-0000-0000-0000-000000000001", "email": "dev@example.com"}

def get_current_user_id(current_user: Dict[str, Any] = Depends(get_current_user)) -> str:
    """Extract user ID from current user"""
    return current_user.get("user_id", "00000000-0000-0000-0000-000000000001")