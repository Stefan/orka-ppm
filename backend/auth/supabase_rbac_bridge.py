"""
Supabase RBAC Bridge for Auth Integration

This module provides the SupabaseRBACBridge class that bridges Supabase authentication
with the custom RBAC system. It handles:
- Role synchronization between Supabase auth.users and custom user_roles table
- User role retrieval from user_roles table during authentication
- Session update mechanism for role changes
- JWT token enhancement with role information

Requirements: 2.1, 2.2, 2.3, 2.4
"""

import jwt
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from uuid import UUID

from .rbac import Permission, UserRole, DEFAULT_ROLE_PERMISSIONS
from .enhanced_rbac_models import PermissionContext, EffectiveRole, ScopeType

logger = logging.getLogger(__name__)

# Try to import Redis for advanced caching
try:
    import redis.asyncio as aioredis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    logger.info("Redis not available, using in-memory cache only")


class SupabaseRBACBridge:
    """
    Bridge between Supabase authentication and custom RBAC system.
    
    This class provides seamless integration between Supabase auth and the custom
    roles system by:
    - Synchronizing roles between systems
    - Retrieving user roles during authentication
    - Updating sessions when roles change
    - Enhancing JWT tokens with role information
    
    Requirements:
    - 2.1: User authentication validation and role retrieval
    - 2.2: Session updates on role changes
    - 2.3: Bridge between Supabase auth.roles and custom roles
    - 2.4: Role information caching
    """
    
    def __init__(self, supabase_client=None, service_supabase_client=None, cache_ttl: int = 300, redis_url: Optional[str] = None):
        """
        Initialize the SupabaseRBACBridge.
        
        Args:
            supabase_client: Regular Supabase client for user operations
            service_supabase_client: Service role client for admin operations
            cache_ttl: Cache time-to-live in seconds (default: 5 minutes)
            redis_url: Optional Redis URL for distributed caching
        """
        self.supabase = supabase_client
        self.service_supabase = service_supabase_client
        self._role_cache: Dict[str, Any] = {}
        self._cache_timestamps: Dict[str, float] = {}
        self._cache_ttl = cache_ttl
        
        # Redis configuration for advanced caching
        self._redis_url = redis_url
        self._redis_client: Optional[Any] = None
        self._redis_enabled = False
        
        # Development mode user IDs
        self._dev_user_ids = {
            "00000000-0000-0000-0000-000000000001",
            "bf1b1732-2449-4987-9fdb-fefa2a93b816"
        }
    
    # =========================================================================
    # Redis Cache Initialization
    # Requirements: 2.4 - Role information caching for performance optimization
    # =========================================================================
    
    async def initialize_redis_cache(self) -> bool:
        """
        Initialize Redis connection for distributed caching.
        
        This enables advanced caching strategies across multiple application instances.
        Falls back to in-memory caching if Redis is unavailable.
        
        Returns:
            True if Redis was successfully initialized, False otherwise
            
        Requirements: 2.4 - Performance optimization with Redis caching
        """
        if not REDIS_AVAILABLE:
            logger.info("Redis library not available, using in-memory cache only")
            return False
        
        if not self._redis_url:
            logger.info("No Redis URL provided, using in-memory cache only")
            return False
        
        try:
            self._redis_client = await aioredis.from_url(
                self._redis_url,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=5
            )
            
            # Test connection
            await self._redis_client.ping()
            self._redis_enabled = True
            
            logger.info("Redis cache initialized successfully for RBAC bridge")
            return True
            
        except Exception as e:
            logger.warning(f"Failed to initialize Redis cache: {e}. Using in-memory cache only.")
            self._redis_enabled = False
            return False
    
    async def close_redis_cache(self) -> None:
        """Close Redis connection if active."""
        if self._redis_client:
            try:
                await self._redis_client.close()
                logger.info("Redis cache connection closed")
            except Exception as e:
                logger.error(f"Error closing Redis connection: {e}")
            finally:
                self._redis_enabled = False
                self._redis_client = None
    
    # =========================================================================
    # JWT Token Enhancement Methods
    # Requirements: 2.3 - JWT token enhancement with role information
    # =========================================================================
    
    async def enhance_jwt_token(self, user_id: UUID, base_token: Optional[str] = None) -> Dict[str, Any]:
        """
        Enhance JWT token with role and permission information.
        
        This method creates an enhanced token payload that includes:
        - User's assigned roles
        - Aggregated permissions
        - Role metadata (scope information)
        - Token enhancement timestamp
        
        Args:
            user_id: The user's UUID
            base_token: Optional base JWT token to enhance
            
        Returns:
            Dictionary with enhanced token payload
            
        Requirements: 2.3 - JWT token enhancement with role information
        """
        try:
            user_id_str = str(user_id)
            
            # Get enhanced user info with roles and permissions
            user_info = await self.get_enhanced_user_info(user_id)
            
            if not user_info:
                logger.warning(f"Could not get user info for JWT enhancement: {user_id_str}")
                return {}
            
            # Build enhanced token payload
            enhanced_payload = {
                "sub": user_id_str,
                "roles": user_info.get("roles", []),
                "role_ids": user_info.get("role_ids", []),
                "permissions": user_info.get("permissions", []),
                "effective_roles": user_info.get("effective_roles", []),
                "enhanced_at": datetime.now(timezone.utc).isoformat(),
                "cache_ttl": self._cache_ttl
            }
            
            # If base token provided, merge with existing claims
            if base_token:
                try:
                    base_payload = jwt.decode(base_token, options={"verify_signature": False})
                    # Preserve original claims, but override with enhanced data
                    enhanced_payload = {**base_payload, **enhanced_payload}
                except Exception as e:
                    logger.warning(f"Could not decode base token: {e}")
            
            logger.debug(f"Enhanced JWT token for user {user_id_str} with {len(enhanced_payload.get('roles', []))} roles")
            
            return enhanced_payload
            
        except Exception as e:
            logger.error(f"Error enhancing JWT token for user {user_id}: {e}")
            return {}
    
    async def create_enhanced_token_string(
        self,
        user_id: UUID,
        secret_key: str,
        algorithm: str = "HS256",
        expires_in_seconds: int = 3600
    ) -> Optional[str]:
        """
        Create a complete enhanced JWT token string.
        
        This method creates a signed JWT token with enhanced role information.
        
        Args:
            user_id: The user's UUID
            secret_key: Secret key for JWT signing
            algorithm: JWT signing algorithm (default: HS256)
            expires_in_seconds: Token expiration time in seconds (default: 1 hour)
            
        Returns:
            Signed JWT token string, or None if creation failed
            
        Requirements: 2.3 - JWT token creation with role information
        """
        try:
            # Get enhanced payload
            payload = await self.enhance_jwt_token(user_id)
            
            if not payload:
                return None
            
            # Add standard JWT claims
            now = datetime.now(timezone.utc)
            payload["iat"] = int(now.timestamp())
            payload["exp"] = int((now + timedelta(seconds=expires_in_seconds)).timestamp())
            
            # Sign the token
            token = jwt.encode(payload, secret_key, algorithm=algorithm)
            
            logger.debug(f"Created enhanced JWT token for user {user_id}")
            
            return token
            
        except Exception as e:
            logger.error(f"Error creating enhanced token string: {e}")
            return None
    
    async def extract_roles_from_token(self, token: str) -> Dict[str, Any]:
        """
        Extract role information from an enhanced JWT token.
        
        This method decodes a token and extracts the role and permission
        information that was added during enhancement.
        
        Args:
            token: JWT token string
            
        Returns:
            Dictionary with role information from the token
            
        Requirements: 2.3 - Extract role information from JWT tokens
        """
        try:
            # Decode token without verification (verification should be done separately)
            payload = jwt.decode(token, options={"verify_signature": False})
            
            # Extract role-related claims
            role_info = {
                "user_id": payload.get("sub"),
                "roles": payload.get("roles", []),
                "role_ids": payload.get("role_ids", []),
                "permissions": payload.get("permissions", []),
                "effective_roles": payload.get("effective_roles", []),
                "enhanced_at": payload.get("enhanced_at"),
                "is_enhanced": "roles" in payload and "permissions" in payload
            }
            
            return role_info
            
        except Exception as e:
            logger.error(f"Error extracting roles from token: {e}")
            return {
                "user_id": None,
                "roles": [],
                "permissions": [],
                "is_enhanced": False,
                "error": str(e)
            }
    
    async def validate_enhanced_token(self, token: str, secret_key: str, algorithm: str = "HS256") -> Optional[Dict[str, Any]]:
        """
        Validate and decode an enhanced JWT token.
        
        This method performs full validation including signature verification
        and expiration checking.
        
        Args:
            token: JWT token string
            secret_key: Secret key for JWT verification
            algorithm: JWT signing algorithm (default: HS256)
            
        Returns:
            Decoded and validated token payload, or None if invalid
            
        Requirements: 2.3 - JWT token validation
        """
        try:
            # Decode and verify token
            payload = jwt.decode(token, secret_key, algorithms=[algorithm])
            
            # Check if token is enhanced
            if "roles" not in payload or "permissions" not in payload:
                logger.warning("Token is not enhanced with role information")
            
            # Check if roles are still current
            user_id = payload.get("sub")
            if user_id:
                enhanced_at = payload.get("enhanced_at")
                if enhanced_at:
                    try:
                        enhanced_time = datetime.fromisoformat(enhanced_at.replace("Z", "+00:00"))
                        age_seconds = (datetime.now(timezone.utc) - enhanced_time).total_seconds()
                        
                        # If token is older than cache TTL, roles might be stale
                        if age_seconds > self._cache_ttl:
                            logger.info(f"Token roles may be stale (age: {age_seconds}s)")
                            payload["roles_may_be_stale"] = True
                    except (ValueError, TypeError):
                        pass
            
            return payload
            
        except jwt.ExpiredSignatureError:
            logger.warning("Token has expired")
            return None
        except jwt.InvalidTokenError as e:
            logger.error(f"Invalid token: {e}")
            return None
        except Exception as e:
            logger.error(f"Error validating enhanced token: {e}")
            return None
    
    # =========================================================================
    # Role Synchronization Methods
    # Requirements: 2.1, 2.3 - Role synchronization between systems
    # =========================================================================
    
    async def sync_user_roles(self, user_id: UUID) -> bool:
        """
        Synchronize roles between Supabase auth.users and custom user_roles table.
        
        This method:
        1. Retrieves roles from the custom user_roles table
        2. Updates the Supabase auth.users metadata with role information
        3. Ensures consistency between both systems
        
        Args:
            user_id: The user's UUID
            
        Returns:
            True if synchronization was successful, False otherwise
            
        Requirements: 2.1, 2.3 - Role synchronization
        """
        try:
            user_id_str = str(user_id)
            
            # Development mode: skip sync for dev users
            if user_id_str in self._dev_user_ids:
                logger.debug(f"Development mode: Skipping role sync for dev user {user_id_str}")
                return True
            
            # Check if we have the necessary clients
            if not self.supabase or not self.service_supabase:
                logger.warning("Supabase clients not available for role sync")
                return False
            
            # Get roles from custom system
            custom_roles = await self._get_user_roles_from_db(user_id_str)
            
            if not custom_roles:
                logger.info(f"No custom roles found for user {user_id_str}")
                # Still sync to clear any stale role data in auth metadata
                custom_roles = []
            
            # Prepare role metadata for Supabase auth
            role_names = [role["name"] for role in custom_roles]
            role_ids = [role["id"] for role in custom_roles]
            
            # Aggregate all permissions from roles
            all_permissions = set()
            for role in custom_roles:
                permissions = role.get("permissions", [])
                all_permissions.update(permissions)
            
            # Update Supabase auth metadata using service role client
            try:
                await self.service_supabase.auth.admin.update_user_by_id(
                    user_id_str,
                    {
                        "user_metadata": {
                            "roles": role_names,
                            "role_ids": role_ids,
                            "permissions": list(all_permissions),
                            "roles_synced_at": datetime.now(timezone.utc).isoformat()
                        }
                    }
                )
                
                logger.info(f"Successfully synced roles for user {user_id_str}: {role_names}")
                
                # Clear cache for this user
                self._clear_user_cache(user_id_str)
                
                return True
                
            except Exception as sync_error:
                logger.error(f"Error updating Supabase auth metadata for user {user_id_str}: {sync_error}")
                return False
            
        except Exception as e:
            logger.error(f"Error syncing user roles for {user_id}: {e}")
            return False
    
    async def sync_all_users_roles(self) -> Dict[str, Any]:
        """
        Synchronize roles for all users in the system.
        
        This is useful for:
        - Initial system setup
        - Bulk role updates
        - Periodic synchronization jobs
        
        Returns:
            Dictionary with sync statistics (success_count, error_count, errors)
            
        Requirements: 2.3 - Bulk role synchronization
        """
        try:
            if not self.supabase:
                logger.error("Supabase client not available for bulk sync")
                return {"success_count": 0, "error_count": 0, "errors": ["No Supabase client"]}
            
            # Get all users with role assignments
            response = self.supabase.table("user_roles").select(
                "user_id"
            ).execute()
            
            if not response.data:
                logger.info("No user role assignments found")
                return {"success_count": 0, "error_count": 0, "errors": []}
            
            # Get unique user IDs
            user_ids = list(set(row["user_id"] for row in response.data))
            
            success_count = 0
            error_count = 0
            errors = []
            
            for user_id_str in user_ids:
                try:
                    user_id = UUID(user_id_str)
                    success = await self.sync_user_roles(user_id)
                    if success:
                        success_count += 1
                    else:
                        error_count += 1
                        errors.append(f"Failed to sync user {user_id_str}")
                except Exception as e:
                    error_count += 1
                    errors.append(f"Error syncing user {user_id_str}: {str(e)}")
            
            logger.info(f"Bulk role sync completed: {success_count} success, {error_count} errors")
            
            return {
                "success_count": success_count,
                "error_count": error_count,
                "errors": errors
            }
            
        except Exception as e:
            logger.error(f"Error in bulk role sync: {e}")
            return {"success_count": 0, "error_count": 0, "errors": [str(e)]}
    
    # =========================================================================
    # User Role Retrieval Methods
    # Requirements: 2.1 - User role retrieval during authentication
    # =========================================================================
    
    async def get_user_from_jwt(self, token: str, secret_key: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Extract user and role information from JWT token.
        
        This method:
        1. Verifies and decodes the JWT token (signature verified when secret_key is set)
        2. Extracts user ID and basic info
        3. Retrieves enhanced user info with roles from database
        4. Returns complete user object with role information
        
        Args:
            token: JWT token string
            secret_key: Optional JWT secret for signature verification (e.g. SUPABASE_JWT_SECRET)
            
        Returns:
            Dictionary with user information including roles, or None if invalid
            
        Requirements: 2.1 - User authentication and role retrieval
        """
        try:
            # Supabase JWTs use RS256; do not attempt HS256 for those (avoids "alg value is not allowed")
            header = jwt.get_unverified_header(token)
            alg = (header.get("alg") or "").upper()
            if alg in ("RS256", "RS384", "RS512", "ES256", "ES384", "ES512"):
                # Token is asymmetric-signed; verification should be done via JWKS in dependencies
                return None
            if secret_key:
                payload = jwt.decode(token, secret_key, algorithms=["HS256"])
            else:
                payload = jwt.decode(token, options={"verify_signature": False})
            
            # Extract user ID
            user_id = payload.get("sub")
            if not user_id or user_id == "anon":
                logger.warning("Invalid or anonymous user in JWT token")
                return None
            
            # Get enhanced user info with roles
            user_info = await self.get_enhanced_user_info(UUID(user_id))
            
            if not user_info:
                logger.warning(f"Could not retrieve user info for {user_id}")
                return None
            
            # Add JWT payload data to user info
            user_info["email"] = payload.get("email", user_info.get("email"))
            user_info["jwt_payload"] = payload
            
            return user_info
            
        except jwt.DecodeError as e:
            logger.error(f"JWT decode error: {e}")
            return None
        except Exception as e:
            logger.error(f"Error extracting user from JWT: {e}")
            return None
    
    async def get_enhanced_user_info(self, user_id: UUID) -> Optional[Dict[str, Any]]:
        """
        Get user information enhanced with roles and permissions.
        
        This method retrieves:
        1. Basic user information from auth.users
        2. Role assignments from user_roles table
        3. Aggregated permissions from all roles
        4. Effective roles with scope information
        
        Uses advanced caching (Redis + in-memory) for performance.
        
        Args:
            user_id: The user's UUID
            
        Returns:
            Dictionary with enhanced user information, or None if user not found
            
        Requirements: 2.1 - Enhanced user info with roles
        """
        try:
            user_id_str = str(user_id)
            
            # Check cache first (with Redis support)
            cache_key = f"enhanced_user:{user_id_str}"
            cached_info = await self.get_cached_data_advanced(cache_key)
            if cached_info is not None:
                logger.debug(f"Cache hit for enhanced user info: {user_id_str}")
                return cached_info
            
            # Development mode: return admin user info for dev users
            if user_id_str in self._dev_user_ids:
                dev_user_info = {
                    "user_id": user_id_str,
                    "email": "dev@example.com",
                    "roles": ["admin"],
                    "role_ids": ["00000000-0000-0000-0000-000000000000"],
                    "permissions": [p.value for p in DEFAULT_ROLE_PERMISSIONS[UserRole.admin]],
                    "effective_roles": [
                        {
                            "role_id": "00000000-0000-0000-0000-000000000000",
                            "role_name": "admin",
                            "permissions": [p.value for p in DEFAULT_ROLE_PERMISSIONS[UserRole.admin]],
                            "source_type": "global",
                            "source_id": None,
                            "is_inherited": False
                        }
                    ],
                    "is_dev_user": True
                }
                await self.cache_data_advanced(cache_key, dev_user_info)
                return dev_user_info
            
            if not self.supabase:
                logger.warning("Supabase client not available")
                return None
            
            # Get user's role assignments with role details
            custom_roles = await self._get_user_roles_from_db(user_id_str)
            
            if not custom_roles:
                # User has no roles, return basic info with viewer permissions
                user_info = {
                    "user_id": user_id_str,
                    "roles": ["viewer"],
                    "role_ids": [],
                    "permissions": [p.value for p in DEFAULT_ROLE_PERMISSIONS[UserRole.viewer]],
                    "effective_roles": []
                }
                await self.cache_data_advanced(cache_key, user_info)
                return user_info
            
            # Extract role information
            role_names = [role["name"] for role in custom_roles]
            role_ids = [role["id"] for role in custom_roles]
            
            # Aggregate permissions from all roles
            all_permissions = set()
            for role in custom_roles:
                permissions = role.get("permissions", [])
                all_permissions.update(permissions)
            
            # Build effective roles list
            effective_roles = []
            for role in custom_roles:
                effective_role = {
                    "role_id": role["id"],
                    "role_name": role["name"],
                    "permissions": role.get("permissions", []),
                    "source_type": role.get("scope_type", "global"),
                    "source_id": role.get("scope_id"),
                    "is_inherited": False
                }
                effective_roles.append(effective_role)
            
            # Build enhanced user info
            user_info = {
                "user_id": user_id_str,
                "roles": role_names,
                "role_ids": role_ids,
                "permissions": list(all_permissions),
                "effective_roles": effective_roles,
                "roles_retrieved_at": datetime.now(timezone.utc).isoformat()
            }
            
            # Cache the result (with Redis support)
            await self.cache_data_advanced(cache_key, user_info)
            
            return user_info
            
        except Exception as e:
            logger.error(f"Error getting enhanced user info for {user_id}: {e}")
            return None
    
    # =========================================================================
    # Session Update Methods
    # Requirements: 2.2 - Session updates on role changes
    # =========================================================================
    
    async def update_session_permissions(self, user_id: UUID) -> bool:
        """
        Update user's session to reflect new permissions after role changes.
        
        This method:
        1. Retrieves updated roles from database
        2. Synchronizes roles with Supabase auth metadata
        3. Clears cached permission data (both Redis and in-memory)
        4. Triggers session refresh if needed
        
        Args:
            user_id: The user's UUID
            
        Returns:
            True if session was updated successfully, False otherwise
            
        Requirements: 2.2 - Session update on role changes
        """
        try:
            user_id_str = str(user_id)
            
            logger.info(f"Updating session permissions for user {user_id_str}")
            
            # Synchronize roles between systems
            sync_success = await self.sync_user_roles(user_id)
            
            if not sync_success:
                logger.warning(f"Role sync failed for user {user_id_str}, but continuing with cache clear")
            
            # Clear all cached data for this user (both Redis and in-memory)
            await self.clear_user_cache_advanced(user_id_str)
            
            # Clear permission checker cache if available
            try:
                from .enhanced_permission_checker import get_enhanced_permission_checker
                permission_checker = get_enhanced_permission_checker()
                permission_checker.clear_user_cache(user_id)
                logger.debug(f"Cleared permission checker cache for user {user_id_str}")
            except ImportError:
                logger.debug("Enhanced permission checker not available for cache clearing")
            
            logger.info(f"Successfully updated session permissions for user {user_id_str}")
            return True
            
        except Exception as e:
            logger.error(f"Error updating session permissions for {user_id}: {e}")
            return False
    
    async def refresh_user_session(self, user_id: UUID, refresh_token: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Refresh user's session with updated role information.
        
        This method can be called after role changes to ensure the user's
        session reflects their current permissions.
        
        Args:
            user_id: The user's UUID
            refresh_token: Optional refresh token for session renewal
            
        Returns:
            New session data if successful, None otherwise
            
        Requirements: 2.2 - Session refresh on role changes
        """
        try:
            user_id_str = str(user_id)
            
            # Update session permissions first
            update_success = await self.update_session_permissions(user_id)
            
            if not update_success:
                logger.warning(f"Session permission update failed for user {user_id_str}")
            
            # If refresh token provided, attempt to refresh the session
            if refresh_token and self.supabase:
                try:
                    session_response = await self.supabase.auth.refresh_session(refresh_token)
                    if session_response and session_response.session:
                        logger.info(f"Successfully refreshed session for user {user_id_str}")
                        return {
                            "session": session_response.session,
                            "user": session_response.user,
                            "permissions_updated": True
                        }
                except Exception as refresh_error:
                    logger.error(f"Error refreshing session: {refresh_error}")
            
            # Return updated user info even if session refresh failed
            user_info = await self.get_enhanced_user_info(user_id)
            return {
                "user": user_info,
                "permissions_updated": True,
                "session_refreshed": False
            }
            
        except Exception as e:
            logger.error(f"Error refreshing user session for {user_id}: {e}")
            return None
    
    async def notify_role_change(self, user_id: UUID, change_type: str, role_name: str) -> bool:
        """
        Notify system of role change and trigger necessary updates.
        
        This method should be called whenever a user's roles are modified
        to ensure all systems are updated accordingly.
        
        Args:
            user_id: The user's UUID
            change_type: Type of change ("added", "removed", "modified")
            role_name: Name of the role that changed
            
        Returns:
            True if notification was processed successfully
            
        Requirements: 2.2 - Role change notification
        """
        try:
            user_id_str = str(user_id)
            
            logger.info(f"Role change notification: {change_type} role '{role_name}' for user {user_id_str}")
            
            # Update session permissions
            await self.update_session_permissions(user_id)
            
            # Log the role change for audit purposes
            if self.supabase:
                try:
                    await self.supabase.table("audit_logs").insert({
                        "user_id": user_id_str,
                        "action": f"role_{change_type}",
                        "resource_type": "user_role",
                        "resource_id": user_id_str,
                        "action_details": {
                            "role_name": role_name,
                            "change_type": change_type
                        },
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }).execute()
                except Exception as audit_error:
                    logger.warning(f"Could not log role change to audit: {audit_error}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error processing role change notification: {e}")
            return False
    
    # =========================================================================
    # Helper Methods
    # =========================================================================
    
    async def _get_user_roles_from_db(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Get user's role assignments from the database.
        
        Args:
            user_id: The user's ID string
            
        Returns:
            List of role dictionaries with details
        """
        try:
            if not self.supabase:
                return []
            
            # Query user_roles with role details
            response = self.supabase.table("user_roles").select(
                "id, user_id, role_id, scope_type, scope_id, assigned_at, expires_at, is_active, "
                "roles(id, name, permissions, is_active)"
            ).eq("user_id", user_id).eq("is_active", True).execute()
            
            if not response.data:
                return []
            
            # Filter out expired assignments and inactive roles
            valid_roles = []
            now = datetime.now(timezone.utc)
            
            for assignment in response.data:
                # Check expiration
                expires_at = assignment.get("expires_at")
                if expires_at:
                    try:
                        expiry = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
                        if expiry < now:
                            continue
                    except (ValueError, TypeError):
                        pass
                
                # Check role is active
                role_data = assignment.get("roles", {})
                if not role_data or not role_data.get("is_active", True):
                    continue
                
                # Add scope information to role data
                role_info = dict(role_data)
                role_info["scope_type"] = assignment.get("scope_type")
                role_info["scope_id"] = assignment.get("scope_id")
                role_info["assigned_at"] = assignment.get("assigned_at")
                
                valid_roles.append(role_info)
            
            return valid_roles
            
        except Exception as e:
            logger.error(f"Error getting user roles from database: {e}")
            return []
    
    def _get_cached_data(self, cache_key: str) -> Optional[Any]:
        """Get cached data if valid."""
        if cache_key not in self._role_cache:
            return None
        
        timestamp = self._cache_timestamps.get(cache_key, 0)
        if (datetime.now().timestamp() - timestamp) >= self._cache_ttl:
            # Cache expired
            del self._role_cache[cache_key]
            if cache_key in self._cache_timestamps:
                del self._cache_timestamps[cache_key]
            return None
        
        return self._role_cache[cache_key]
    
    def _cache_data(self, cache_key: str, data: Any) -> None:
        """Cache data with timestamp."""
        self._role_cache[cache_key] = data
        self._cache_timestamps[cache_key] = datetime.now().timestamp()
    
    def _clear_user_cache(self, user_id: str) -> None:
        """Clear all cached data for a user."""
        keys_to_remove = [
            key for key in self._role_cache.keys()
            if user_id in key
        ]
        for key in keys_to_remove:
            del self._role_cache[key]
            if key in self._cache_timestamps:
                del self._cache_timestamps[key]
    
    def clear_all_cache(self) -> None:
        """Clear all cached data."""
        self._role_cache.clear()
        self._cache_timestamps.clear()
    
    # =========================================================================
    # Advanced Caching Methods with Redis Support
    # Requirements: 2.4 - Role information caching for performance optimization
    # =========================================================================
    
    async def get_cached_data_advanced(self, cache_key: str) -> Optional[Any]:
        """
        Get cached data with Redis support.
        
        This method tries Redis first (if enabled), then falls back to
        in-memory cache.
        
        Args:
            cache_key: The cache key to retrieve
            
        Returns:
            Cached data if found and valid, None otherwise
            
        Requirements: 2.4 - Advanced caching with Redis
        """
        try:
            # Try Redis first if enabled
            if self._redis_enabled and self._redis_client:
                try:
                    cached_json = await self._redis_client.get(f"rbac:{cache_key}")
                    if cached_json:
                        logger.debug(f"Redis cache hit for key: {cache_key}")
                        return json.loads(cached_json)
                except Exception as redis_error:
                    logger.warning(f"Redis cache read error: {redis_error}")
            
            # Fall back to in-memory cache
            return self._get_cached_data(cache_key)
            
        except Exception as e:
            logger.error(f"Error getting cached data: {e}")
            return None
    
    async def cache_data_advanced(self, cache_key: str, data: Any, ttl: Optional[int] = None) -> bool:
        """
        Cache data with Redis support.
        
        This method caches to both Redis (if enabled) and in-memory cache
        for redundancy and performance.
        
        Args:
            cache_key: The cache key to store
            data: The data to cache
            ttl: Optional custom TTL in seconds (uses default if not provided)
            
        Returns:
            True if caching was successful, False otherwise
            
        Requirements: 2.4 - Advanced caching with Redis
        """
        try:
            cache_ttl = ttl or self._cache_ttl
            
            # Cache to Redis if enabled
            if self._redis_enabled and self._redis_client:
                try:
                    data_json = json.dumps(data, default=str)
                    await self._redis_client.setex(
                        f"rbac:{cache_key}",
                        cache_ttl,
                        data_json
                    )
                    logger.debug(f"Cached to Redis: {cache_key}")
                except Exception as redis_error:
                    logger.warning(f"Redis cache write error: {redis_error}")
            
            # Always cache to in-memory as well
            self._cache_data(cache_key, data)
            
            return True
            
        except Exception as e:
            logger.error(f"Error caching data: {e}")
            return False
    
    async def clear_user_cache_advanced(self, user_id: str) -> bool:
        """
        Clear all cached data for a user from both Redis and in-memory cache.
        
        Args:
            user_id: The user's ID string
            
        Returns:
            True if cache clearing was successful
            
        Requirements: 2.4 - Cache invalidation on role changes
        """
        try:
            # Clear from Redis if enabled
            if self._redis_enabled and self._redis_client:
                try:
                    # Find all keys for this user
                    pattern = f"rbac:*{user_id}*"
                    cursor = 0
                    deleted_count = 0
                    
                    # Use SCAN to find matching keys
                    while True:
                        cursor, keys = await self._redis_client.scan(cursor, match=pattern, count=100)
                        if keys:
                            await self._redis_client.delete(*keys)
                            deleted_count += len(keys)
                        if cursor == 0:
                            break
                    
                    logger.debug(f"Cleared {deleted_count} Redis cache entries for user {user_id}")
                    
                except Exception as redis_error:
                    logger.warning(f"Redis cache clear error: {redis_error}")
            
            # Clear from in-memory cache
            self._clear_user_cache(user_id)
            
            return True
            
        except Exception as e:
            logger.error(f"Error clearing user cache: {e}")
            return False
    
    async def clear_all_cache_advanced(self) -> bool:
        """
        Clear all RBAC cached data from both Redis and in-memory cache.
        
        Returns:
            True if cache clearing was successful
            
        Requirements: 2.4 - Cache management
        """
        try:
            # Clear from Redis if enabled
            if self._redis_enabled and self._redis_client:
                try:
                    # Find all RBAC cache keys
                    pattern = "rbac:*"
                    cursor = 0
                    deleted_count = 0
                    
                    while True:
                        cursor, keys = await self._redis_client.scan(cursor, match=pattern, count=100)
                        if keys:
                            await self._redis_client.delete(*keys)
                            deleted_count += len(keys)
                        if cursor == 0:
                            break
                    
                    logger.info(f"Cleared {deleted_count} Redis cache entries")
                    
                except Exception as redis_error:
                    logger.warning(f"Redis cache clear error: {redis_error}")
            
            # Clear in-memory cache
            self.clear_all_cache()
            
            return True
            
        except Exception as e:
            logger.error(f"Error clearing all cache: {e}")
            return False
    
    async def get_cache_statistics(self) -> Dict[str, Any]:
        """
        Get statistics about the cache usage.
        
        Returns:
            Dictionary with cache statistics
            
        Requirements: 2.4 - Cache monitoring
        """
        try:
            stats = {
                "in_memory_entries": len(self._role_cache),
                "redis_enabled": self._redis_enabled,
                "cache_ttl": self._cache_ttl
            }
            
            # Get Redis stats if enabled
            if self._redis_enabled and self._redis_client:
                try:
                    # Count RBAC keys in Redis
                    pattern = "rbac:*"
                    cursor = 0
                    redis_count = 0
                    
                    while True:
                        cursor, keys = await self._redis_client.scan(cursor, match=pattern, count=100)
                        redis_count += len(keys)
                        if cursor == 0:
                            break
                    
                    stats["redis_entries"] = redis_count
                    
                    # Get Redis info
                    info = await self._redis_client.info("memory")
                    stats["redis_memory_used"] = info.get("used_memory_human", "unknown")
                    
                except Exception as redis_error:
                    logger.warning(f"Error getting Redis stats: {redis_error}")
                    stats["redis_error"] = str(redis_error)
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting cache statistics: {e}")
            return {"error": str(e)}
    
    # =========================================================================
    # Utility Methods
    # =========================================================================
    
    async def validate_user_session(self, user_id: UUID, token: str) -> bool:
        """
        Validate that a user's session token is valid and has current role information.
        
        Args:
            user_id: The user's UUID
            token: JWT token to validate
            
        Returns:
            True if session is valid with current roles, False otherwise
        """
        try:
            # Extract user from token
            user_from_token = await self.get_user_from_jwt(token)
            
            if not user_from_token:
                return False
            
            # Verify user ID matches
            if user_from_token.get("user_id") != str(user_id):
                logger.warning(f"User ID mismatch in token validation")
                return False
            
            # Get current user info from database
            current_user_info = await self.get_enhanced_user_info(user_id)
            
            if not current_user_info:
                return False
            
            # Check if roles in token match current roles
            token_roles = set(user_from_token.get("roles", []))
            current_roles = set(current_user_info.get("roles", []))
            
            if token_roles != current_roles:
                logger.info(f"Role mismatch detected for user {user_id}, session needs refresh")
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error validating user session: {e}")
            return False
    
    async def get_user_role_summary(self, user_id: UUID) -> Dict[str, Any]:
        """
        Get a summary of user's roles and permissions.
        
        Useful for debugging and admin interfaces.
        
        Args:
            user_id: The user's UUID
            
        Returns:
            Dictionary with role summary information
        """
        try:
            user_info = await self.get_enhanced_user_info(user_id)
            
            if not user_info:
                return {
                    "user_id": str(user_id),
                    "has_roles": False,
                    "roles": [],
                    "permissions_count": 0
                }
            
            return {
                "user_id": str(user_id),
                "has_roles": len(user_info.get("roles", [])) > 0,
                "roles": user_info.get("roles", []),
                "role_count": len(user_info.get("roles", [])),
                "permissions_count": len(user_info.get("permissions", [])),
                "effective_roles_count": len(user_info.get("effective_roles", [])),
                "is_dev_user": user_info.get("is_dev_user", False),
                "last_retrieved": user_info.get("roles_retrieved_at")
            }
            
        except Exception as e:
            logger.error(f"Error getting user role summary: {e}")
            return {
                "user_id": str(user_id),
                "error": str(e)
            }


# Create a singleton instance for use across the application
_supabase_rbac_bridge: Optional[SupabaseRBACBridge] = None


def get_supabase_rbac_bridge(
    supabase_client=None,
    service_supabase_client=None,
    redis_url: Optional[str] = None
) -> SupabaseRBACBridge:
    """
    Get or create the singleton SupabaseRBACBridge instance.
    
    Args:
        supabase_client: Optional Supabase client to use
        service_supabase_client: Optional service role client to use
        redis_url: Optional Redis URL for distributed caching
        
    Returns:
        The SupabaseRBACBridge singleton instance
    """
    global _supabase_rbac_bridge
    
    if _supabase_rbac_bridge is None:
        import os
        from config.database import supabase, service_supabase
        
        # Get Redis URL from environment if not provided
        if redis_url is None:
            redis_url = os.getenv('REDIS_URL')
        
        _supabase_rbac_bridge = SupabaseRBACBridge(
            supabase_client or supabase,
            service_supabase_client or service_supabase,
            redis_url=redis_url
        )
    
    return _supabase_rbac_bridge
