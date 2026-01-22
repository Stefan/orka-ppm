"""
Guest Access Controller Service for Shareable Project URLs

This service manages authentication and authorization for external users accessing
projects via share links. It provides secure token validation, rate limiting,
and access logging.

Requirements: 3.2, 3.3, 7.4
"""

from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from uuid import UUID
import logging
import hmac
import hashlib
from collections import defaultdict
from threading import Lock

from config.database import get_db
from models.shareable_urls import ShareLinkValidation, FilteredProjectData, SharePermissionLevel
from performance_optimization import CacheManager


class GuestAccessController:
    """
    Service for managing guest access via share links.
    
    This service handles:
    - Secure token validation with timing attack protection
    - Expiry checking with timezone awareness
    - Rate limiting for share link access (10 requests per minute per IP)
    - Access attempt logging
    
    Requirements: 3.2, 3.3, 7.4
    """
    
    # Rate limiting configuration
    RATE_LIMIT_REQUESTS = 10  # Maximum requests per window
    RATE_LIMIT_WINDOW = 60  # Window size in seconds (1 minute)
    
    # Cache TTL configuration
    TOKEN_VALIDATION_CACHE_TTL = 60  # 1 minute for token validation
    PROJECT_DATA_CACHE_TTL = 300  # 5 minutes for filtered project data
    
    def __init__(self, db_session=None, cache_manager: Optional[CacheManager] = None):
        """
        Initialize the guest access controller.
        
        Args:
            db_session: Database client (defaults to global Supabase client)
            cache_manager: Cache manager for Redis caching (optional)
        """
        self.db = db_session or get_db()
        self.logger = logging.getLogger(__name__)
        self.cache_manager = cache_manager
        
        # Rate limiting storage: {(ip_address, share_id): [(timestamp1, timestamp2, ...)]}
        self._rate_limit_storage: Dict[tuple, list] = defaultdict(list)
        self._rate_limit_lock = Lock()
    
    def _constant_time_compare(self, a: str, b: str) -> bool:
        """
        Compare two strings in constant time to prevent timing attacks.
        
        Uses HMAC comparison which is designed to be constant-time and
        prevents attackers from using timing information to guess tokens.
        
        Args:
            a: First string to compare
            b: Second string to compare
            
        Returns:
            bool: True if strings are equal, False otherwise
            
        Requirements: 3.2
        """
        if not isinstance(a, str) or not isinstance(b, str):
            return False
        
        # Convert to bytes for HMAC comparison
        a_bytes = a.encode('utf-8')
        b_bytes = b.encode('utf-8')
        
        # Use hmac.compare_digest for constant-time comparison
        return hmac.compare_digest(a_bytes, b_bytes)
    
    def _is_expired(self, expires_at: datetime) -> bool:
        """
        Check if a share link has expired with timezone awareness.
        
        Ensures both timestamps are timezone-aware and compares them correctly.
        If expires_at is naive (no timezone), assumes UTC.
        
        Args:
            expires_at: Expiration timestamp
            
        Returns:
            bool: True if expired, False otherwise
            
        Requirements: 3.3
        """
        # Get current time in UTC with timezone awareness
        now = datetime.now(timezone.utc)
        
        # Ensure expires_at is timezone-aware
        if expires_at.tzinfo is None:
            # Naive datetime, assume UTC
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        
        # Compare timestamps
        return now >= expires_at
    
    async def validate_token(self, token: str) -> ShareLinkValidation:
        """
        Validate a share link token with secure constant-time comparison.
        
        This method:
        1. Checks cache for recent validation result (1-minute TTL)
        2. Queries the database for the token if not cached
        3. Uses constant-time comparison to prevent timing attacks
        4. Checks expiry with timezone awareness
        5. Caches the validation result
        6. Returns validation result with share link details or error
        
        Args:
            token: Share link token to validate
            
        Returns:
            ShareLinkValidation: Validation result with share link details or error
            
        Requirements: 3.2, 3.3
        """
        try:
            # Check cache first (1-minute TTL)
            cache_key = f"share_token_validation:{token}"
            if self.cache_manager:
                cached_result = await self.cache_manager.get(cache_key)
                if cached_result:
                    self.logger.debug(f"Token validation cache hit: {token[:10]}...")
                    return ShareLinkValidation(**cached_result)
            
            if not self.db:
                self.logger.error("Database client not available, cannot validate token")
                return ShareLinkValidation(
                    is_valid=False,
                    share_id=None,
                    project_id=None,
                    permission_level=None,
                    error_message="Service temporarily unavailable"
                )
            
            # Validate token format (should be 64 characters)
            if not token or len(token) != 64:
                self.logger.warning(f"Invalid token format: length={len(token) if token else 0}")
                return ShareLinkValidation(
                    is_valid=False,
                    share_id=None,
                    project_id=None,
                    permission_level=None,
                    error_message="Invalid share link token"
                )
            
            # Query database for share link
            # Note: We still need to query by token, but we'll use constant-time
            # comparison for the final validation to prevent timing attacks
            result = self.db.table("project_shares").select(
                "id, project_id, token, permission_level, expires_at, is_active, revoked_at"
            ).eq("token", token).execute()
            
            # Check if share link exists
            if not result.data or len(result.data) == 0:
                self.logger.warning("Share link not found")
                validation_result = ShareLinkValidation(
                    is_valid=False,
                    share_id=None,
                    project_id=None,
                    permission_level=None,
                    error_message="Invalid share link token"
                )
                # Cache negative result with shorter TTL
                if self.cache_manager:
                    await self.cache_manager.set(cache_key, validation_result.dict(), ttl=30)
                return validation_result
            
            share = result.data[0]
            
            # Constant-time comparison of tokens to prevent timing attacks
            # Even though we queried by token, this adds an extra layer of security
            if not self._constant_time_compare(share["token"], token):
                self.logger.warning("Token comparison failed (should not happen)")
                validation_result = ShareLinkValidation(
                    is_valid=False,
                    share_id=None,
                    project_id=None,
                    permission_level=None,
                    error_message="Invalid share link token"
                )
                if self.cache_manager:
                    await self.cache_manager.set(cache_key, validation_result.dict(), ttl=30)
                return validation_result
            
            # Check if share link is active
            if not share["is_active"]:
                self.logger.info(f"Share link is inactive: {share['id']}")
                validation_result = ShareLinkValidation(
                    is_valid=False,
                    share_id=share["id"],
                    project_id=share["project_id"],
                    permission_level=None,
                    error_message="This share link is no longer active"
                )
                if self.cache_manager:
                    await self.cache_manager.set(cache_key, validation_result.dict(), ttl=self.TOKEN_VALIDATION_CACHE_TTL)
                return validation_result
            
            # Check if share link has been revoked
            if share.get("revoked_at") is not None:
                self.logger.info(f"Share link has been revoked: {share['id']}")
                validation_result = ShareLinkValidation(
                    is_valid=False,
                    share_id=share["id"],
                    project_id=share["project_id"],
                    permission_level=None,
                    error_message="This share link has been revoked"
                )
                if self.cache_manager:
                    await self.cache_manager.set(cache_key, validation_result.dict(), ttl=self.TOKEN_VALIDATION_CACHE_TTL)
                return validation_result
            
            # Parse expiration timestamp
            expires_at_str = share["expires_at"]
            if isinstance(expires_at_str, str):
                # Parse ISO format timestamp
                expires_at = datetime.fromisoformat(expires_at_str.replace('Z', '+00:00'))
            else:
                expires_at = expires_at_str
            
            # Check if share link has expired (with timezone awareness)
            if self._is_expired(expires_at):
                self.logger.info(f"Share link has expired: {share['id']}, expired_at={expires_at}")
                validation_result = ShareLinkValidation(
                    is_valid=False,
                    share_id=share["id"],
                    project_id=share["project_id"],
                    permission_level=None,
                    error_message="This share link has expired"
                )
                if self.cache_manager:
                    await self.cache_manager.set(cache_key, validation_result.dict(), ttl=self.TOKEN_VALIDATION_CACHE_TTL)
                return validation_result
            
            # All checks passed - share link is valid
            self.logger.info(f"Share link validated successfully: {share['id']}")
            validation_result = ShareLinkValidation(
                is_valid=True,
                share_id=share["id"],
                project_id=share["project_id"],
                permission_level=share["permission_level"],
                error_message=None
            )
            
            # Cache valid result with 1-minute TTL
            if self.cache_manager:
                await self.cache_manager.set(cache_key, validation_result.dict(), ttl=self.TOKEN_VALIDATION_CACHE_TTL)
            
            return validation_result
            
        except Exception as e:
            self.logger.error(
                f"Error validating share link token: {str(e)}",
                exc_info=True
            )
            return ShareLinkValidation(
                is_valid=False,
                share_id=None,
                project_id=None,
                permission_level=None,
                error_message="An error occurred while validating the share link"
            )
    
    def check_rate_limit(self, ip_address: str, share_id: str) -> bool:
        """
        Check if an IP address has exceeded the rate limit for a share link.
        
        Implements a sliding window rate limiter that tracks access attempts
        per IP per share link. Limits to 10 requests per minute per IP.
        
        Args:
            ip_address: IP address of the requester
            share_id: Share link ID being accessed
            
        Returns:
            bool: True if within rate limit, False if exceeded
            
        Requirements: 7.4
        """
        try:
            with self._rate_limit_lock:
                # Create key for this IP + share combination
                key = (ip_address, share_id)
                
                # Get current timestamp
                now = datetime.now(timezone.utc).timestamp()
                
                # Get existing access timestamps for this key
                access_times = self._rate_limit_storage[key]
                
                # Remove timestamps outside the current window
                cutoff_time = now - self.RATE_LIMIT_WINDOW
                access_times = [t for t in access_times if t > cutoff_time]
                
                # Check if rate limit exceeded
                if len(access_times) >= self.RATE_LIMIT_REQUESTS:
                    self.logger.warning(
                        f"Rate limit exceeded: ip={ip_address}, share_id={share_id}, "
                        f"requests={len(access_times)}"
                    )
                    return False
                
                # Add current access time
                access_times.append(now)
                
                # Update storage
                self._rate_limit_storage[key] = access_times
                
                self.logger.debug(
                    f"Rate limit check passed: ip={ip_address}, share_id={share_id}, "
                    f"requests={len(access_times)}/{self.RATE_LIMIT_REQUESTS}"
                )
                
                return True
                
        except Exception as e:
            self.logger.error(
                f"Error checking rate limit: {str(e)}",
                exc_info=True
            )
            # On error, allow access (fail open for availability)
            return True
    
    async def log_access_attempt(
        self,
        share_id: str,
        ip_address: str,
        user_agent: Optional[str],
        success: bool
    ) -> bool:
        """
        Log an access attempt to a share link.
        
        Records access attempts in the share_access_logs table for security
        monitoring and analytics. Includes IP address, user agent, and success status.
        
        Args:
            share_id: UUID of the share link
            ip_address: IP address of the requester
            user_agent: User agent string from the request
            success: Whether the access attempt was successful
            
        Returns:
            bool: True if logged successfully, False otherwise
            
        Requirements: 7.4
        """
        try:
            if not self.db:
                self.logger.error("Database client not available, cannot log access attempt")
                return False
            
            # Prepare log entry
            log_entry = {
                "share_id": share_id,
                "ip_address": ip_address,
                "user_agent": user_agent,
                "accessed_at": datetime.now(timezone.utc).isoformat(),
                "is_suspicious": False,  # Will be updated by suspicious activity detection
                "accessed_sections": []  # Will be updated as user navigates
            }
            
            # Insert log entry
            result = self.db.table("share_access_logs").insert(log_entry).execute()
            
            if not result.data or len(result.data) == 0:
                self.logger.error("Failed to insert access log entry")
                return False
            
            # If access was successful, update share link access count
            if success:
                # First, get current access count
                share_result = self.db.table("project_shares").select("access_count").eq("id", share_id).execute()
                
                if share_result.data and len(share_result.data) > 0:
                    current_count = share_result.data[0].get("access_count", 0)
                    
                    # Update with incremented count
                    update_result = self.db.table("project_shares").update({
                        "access_count": current_count + 1,
                        "last_accessed_at": datetime.now(timezone.utc).isoformat(),
                        "last_accessed_ip": ip_address,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }).eq("id", share_id).execute()
                    
                    if not update_result.data or len(update_result.data) == 0:
                        self.logger.warning(f"Failed to update share link access tracking: {share_id}")
                else:
                    self.logger.warning(f"Share link not found for access tracking: {share_id}")
            
            self.logger.info(
                f"Access attempt logged: share_id={share_id}, ip={ip_address}, "
                f"success={success}"
            )
            
            return True
            
        except Exception as e:
            self.logger.error(
                f"Error logging access attempt: {str(e)}",
                exc_info=True
            )
            return False
    
    def clear_rate_limit_cache(self) -> None:
        """
        Clear the rate limit cache.
        
        This method is primarily for testing purposes to reset rate limit state.
        In production, old entries are automatically cleaned up during rate limit checks.
        """
        with self._rate_limit_lock:
            self._rate_limit_storage.clear()
            self.logger.info("Rate limit cache cleared")
    
    async def invalidate_project_cache(self, project_id: UUID) -> int:
        """
        Invalidate all cached data for a specific project.
        
        This method should be called when project data is updated to ensure
        guests see the latest information. It clears all permission-level
        variants of the cached project data.
        
        Args:
            project_id: UUID of the project to invalidate
            
        Returns:
            int: Number of cache entries cleared
        """
        if not self.cache_manager:
            return 0
        
        try:
            # Clear all permission level variants
            cleared_count = 0
            for permission_level in SharePermissionLevel:
                cache_key = f"filtered_project:{project_id}:{permission_level.value}"
                if await self.cache_manager.delete(cache_key):
                    cleared_count += 1
            
            self.logger.info(f"Invalidated {cleared_count} cache entries for project {project_id}")
            return cleared_count
            
        except Exception as e:
            self.logger.error(f"Error invalidating project cache: {str(e)}")
            return 0
    
    async def invalidate_token_cache(self, token: str) -> bool:
        """
        Invalidate cached validation result for a specific token.
        
        This method should be called when a share link is revoked or its
        status changes to ensure immediate effect.
        
        Args:
            token: Share link token to invalidate
            
        Returns:
            bool: True if cache entry was cleared, False otherwise
        """
        if not self.cache_manager:
            return False
        
        try:
            cache_key = f"share_token_validation:{token}"
            result = await self.cache_manager.delete(cache_key)
            
            if result:
                self.logger.info(f"Invalidated token validation cache: {token[:10]}...")
            
            return result
            
        except Exception as e:
            self.logger.error(f"Error invalidating token cache: {str(e)}")
            return False
    
    def get_rate_limit_info(self, ip_address: str, share_id: str) -> Dict[str, Any]:
        """
        Get rate limit information for an IP address and share link.
        
        Returns current rate limit status including request count and time until reset.
        
        Args:
            ip_address: IP address to check
            share_id: Share link ID to check
            
        Returns:
            Dict with 'requests_count', 'limit', 'window_seconds', 'is_limited'
        """
        try:
            with self._rate_limit_lock:
                key = (ip_address, share_id)
                now = datetime.now(timezone.utc).timestamp()
                cutoff_time = now - self.RATE_LIMIT_WINDOW
                
                # Get and clean access times
                access_times = self._rate_limit_storage.get(key, [])
                access_times = [t for t in access_times if t > cutoff_time]
                
                return {
                    "requests_count": len(access_times),
                    "limit": self.RATE_LIMIT_REQUESTS,
                    "window_seconds": self.RATE_LIMIT_WINDOW,
                    "is_limited": len(access_times) >= self.RATE_LIMIT_REQUESTS,
                    "oldest_request_age": int(now - access_times[0]) if access_times else None
                }
        except Exception as e:
            self.logger.error(f"Error getting rate limit info: {str(e)}")
            return {
                "requests_count": 0,
                "limit": self.RATE_LIMIT_REQUESTS,
                "window_seconds": self.RATE_LIMIT_WINDOW,
                "is_limited": False,
                "oldest_request_age": None
            }
    
    def _sanitize_project_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sanitize project data to remove any sensitive information.
        
        This method ensures that financial data and internal notes are NEVER
        exposed at any permission level. It removes fields that contain
        sensitive information regardless of permission level.
        
        Sensitive fields that are always removed:
        - Financial data: budget, actual_cost, spent, financial_data, cost_breakdown
        - Internal notes: internal_notes, private_notes, confidential_notes
        - Sensitive metadata: created_by_email, updated_by_email
        
        Args:
            data: Raw project data dictionary
            
        Returns:
            Dict: Sanitized project data with sensitive fields removed
            
        Requirements: 2.5, 5.2
        """
        # List of sensitive fields that should NEVER be exposed
        sensitive_fields = {
            # Financial data
            'budget', 'actual_cost', 'spent', 'financial_data', 'cost_breakdown',
            'financial_details', 'cost_data', 'budget_details', 'expenditure',
            'invoice_data', 'payment_info', 'financial_records',
            
            # Internal notes and confidential information
            'internal_notes', 'private_notes', 'confidential_notes', 'admin_notes',
            'internal_comments', 'private_comments', 'confidential_data',
            
            # Sensitive metadata
            'created_by_email', 'updated_by_email', 'creator_email',
            'internal_metadata', 'sensitive_metadata'
        }
        
        # Create a copy to avoid modifying the original
        sanitized = data.copy()
        
        # Remove all sensitive fields
        for field in sensitive_fields:
            sanitized.pop(field, None)
        
        self.logger.debug(f"Sanitized project data, removed {len(sensitive_fields & set(data.keys()))} sensitive fields")
        
        return sanitized
    
    def _filter_sensitive_fields(
        self, 
        data: Dict[str, Any], 
        permission_level: SharePermissionLevel
    ) -> Dict[str, Any]:
        """
        Filter project data based on permission level.
        
        This method applies permission-level-specific filtering after sanitization.
        It determines which fields are included based on the permission level:
        
        - VIEW_ONLY: Basic info only (name, description, status, progress, dates)
        - LIMITED_DATA: VIEW_ONLY + milestones, timeline, documents, team_members
        - FULL_PROJECT: LIMITED_DATA + tasks, schedules, risks
        
        Note: Sensitive data (financial, internal notes) is removed by sanitization
        before this method is called.
        
        Args:
            data: Sanitized project data dictionary
            permission_level: Permission level for filtering
            
        Returns:
            Dict: Filtered project data based on permission level
            
        Requirements: 2.2, 2.3, 2.4
        """
        # Define fields for each permission level
        view_only_fields = {
            'id', 'name', 'description', 'status', 'progress_percentage',
            'start_date', 'end_date', 'created_at', 'updated_at'
        }
        
        limited_data_fields = view_only_fields | {
            'milestones', 'timeline', 'documents', 'team_members',
            'priority', 'health', 'portfolio_id'
        }
        
        full_project_fields = limited_data_fields | {
            'tasks', 'schedules', 'risks', 'dependencies',
            'resources', 'manager_id'
        }
        
        # Select appropriate field set based on permission level
        if permission_level == SharePermissionLevel.VIEW_ONLY:
            allowed_fields = view_only_fields
        elif permission_level == SharePermissionLevel.LIMITED_DATA:
            allowed_fields = limited_data_fields
        elif permission_level == SharePermissionLevel.FULL_PROJECT:
            allowed_fields = full_project_fields
        else:
            # Default to most restrictive if unknown permission level
            self.logger.warning(f"Unknown permission level: {permission_level}, defaulting to VIEW_ONLY")
            allowed_fields = view_only_fields
        
        # Filter data to only include allowed fields
        filtered = {
            key: value 
            for key, value in data.items() 
            if key in allowed_fields
        }
        
        self.logger.debug(
            f"Filtered project data for {permission_level}, "
            f"included {len(filtered)} of {len(data)} fields"
        )
        
        return filtered
    
    async def get_filtered_project_data(
        self,
        project_id: UUID,
        permission_level: SharePermissionLevel
    ) -> Optional[FilteredProjectData]:
        """
        Get filtered project data based on permission level.
        
        This method:
        1. Checks cache for recent filtered data (5-minute TTL)
        2. Queries the database for project data if not cached
        3. Sanitizes the data to remove sensitive information (financial, internal notes)
        4. Filters the data based on permission level
        5. Caches the filtered result
        6. Returns a FilteredProjectData model
        
        Permission levels:
        - VIEW_ONLY: Basic info (name, description, status, progress, dates)
        - LIMITED_DATA: VIEW_ONLY + milestones, timeline, documents, team_members
        - FULL_PROJECT: LIMITED_DATA + tasks, schedules, risks (NO financial/internal notes)
        
        Args:
            project_id: UUID of the project to retrieve
            permission_level: Permission level for filtering
            
        Returns:
            FilteredProjectData: Filtered project data, or None if project not found
            
        Requirements: 2.2, 2.3, 2.4, 2.5, 5.2
        """
        try:
            # Check cache first (5-minute TTL)
            cache_key = f"filtered_project:{project_id}:{permission_level.value}"
            if self.cache_manager:
                cached_data = await self.cache_manager.get(cache_key)
                if cached_data:
                    self.logger.debug(f"Filtered project data cache hit: {project_id}, {permission_level}")
                    return FilteredProjectData(**cached_data)
            
            if not self.db:
                self.logger.error("Database client not available, cannot get project data")
                return None
            
            # Query database for project
            result = self.db.table("projects").select("*").eq("id", str(project_id)).execute()
            
            # Check if project exists
            if not result.data or len(result.data) == 0:
                self.logger.warning(f"Project not found: {project_id}")
                return None
            
            project_data = result.data[0]
            
            # Step 1: Sanitize data to remove sensitive information
            # This ALWAYS removes financial data and internal notes
            sanitized_data = self._sanitize_project_data(project_data)
            
            # Step 2: Filter based on permission level
            filtered_data = self._filter_sensitive_fields(sanitized_data, permission_level)
            
            # Step 3: Query related data based on permission level
            # For LIMITED_DATA and FULL_PROJECT, we need to fetch related data
            
            if permission_level in [SharePermissionLevel.LIMITED_DATA, SharePermissionLevel.FULL_PROJECT]:
                # Fetch milestones
                try:
                    milestones_result = self.db.table("milestones").select(
                        "id, name, description, due_date, status, completion_percentage"
                    ).eq("project_id", str(project_id)).execute()
                    
                    if milestones_result.data:
                        filtered_data['milestones'] = milestones_result.data
                except Exception as e:
                    self.logger.warning(f"Could not fetch milestones: {str(e)}")
                    filtered_data['milestones'] = []
                
                # Fetch team members
                try:
                    # Query project_team_members junction table
                    team_result = self.db.table("project_team_members").select(
                        "user_id, role"
                    ).eq("project_id", str(project_id)).execute()
                    
                    if team_result.data:
                        # Get user details for team members (excluding sensitive info)
                        user_ids = [member['user_id'] for member in team_result.data]
                        if user_ids:
                            users_result = self.db.table("auth.users").select(
                                "id, email, raw_user_meta_data"
                            ).in_("id", user_ids).execute()
                            
                            # Combine team role with user info
                            users_by_id = {user['id']: user for user in users_result.data} if users_result.data else {}
                            team_members = []
                            for member in team_result.data:
                                user = users_by_id.get(member['user_id'])
                                if user:
                                    team_members.append({
                                        'id': user['id'],
                                        'name': user.get('raw_user_meta_data', {}).get('full_name', 'Unknown'),
                                        'role': member['role']
                                    })
                            filtered_data['team_members'] = team_members
                        else:
                            filtered_data['team_members'] = []
                    else:
                        filtered_data['team_members'] = []
                except Exception as e:
                    self.logger.warning(f"Could not fetch team members: {str(e)}")
                    filtered_data['team_members'] = []
                
                # Fetch documents (only public ones)
                try:
                    documents_result = self.db.table("documents").select(
                        "id, name, description, file_type, uploaded_at"
                    ).eq("project_id", str(project_id)).eq("is_public", True).execute()
                    
                    if documents_result.data:
                        filtered_data['documents'] = documents_result.data
                    else:
                        filtered_data['documents'] = []
                except Exception as e:
                    self.logger.warning(f"Could not fetch documents: {str(e)}")
                    filtered_data['documents'] = []
                
                # Create timeline data from project dates
                if filtered_data.get('start_date') and filtered_data.get('end_date'):
                    filtered_data['timeline'] = {
                        'start_date': filtered_data['start_date'],
                        'end_date': filtered_data['end_date'],
                        'duration_days': (
                            datetime.fromisoformat(str(filtered_data['end_date'])) - 
                            datetime.fromisoformat(str(filtered_data['start_date']))
                        ).days if filtered_data.get('start_date') and filtered_data.get('end_date') else None
                    }
            
            if permission_level == SharePermissionLevel.FULL_PROJECT:
                # Fetch tasks (excluding financial data)
                try:
                    tasks_result = self.db.table("tasks").select(
                        "id, name, description, status, priority, due_date, assigned_to, completion_percentage"
                    ).eq("project_id", str(project_id)).execute()
                    
                    if tasks_result.data:
                        filtered_data['tasks'] = tasks_result.data
                    else:
                        filtered_data['tasks'] = []
                except Exception as e:
                    self.logger.warning(f"Could not fetch tasks: {str(e)}")
                    filtered_data['tasks'] = []
            
            # Convert to FilteredProjectData model
            # Ensure required fields have values
            filtered_project = FilteredProjectData(
                id=str(filtered_data.get('id', project_id)),
                name=filtered_data.get('name', 'Unknown Project'),
                description=filtered_data.get('description'),
                status=filtered_data.get('status', 'unknown'),
                progress_percentage=filtered_data.get('progress_percentage'),
                start_date=filtered_data.get('start_date'),
                end_date=filtered_data.get('end_date'),
                milestones=filtered_data.get('milestones'),
                team_members=filtered_data.get('team_members'),
                documents=filtered_data.get('documents'),
                timeline=filtered_data.get('timeline'),
                tasks=filtered_data.get('tasks')
            )
            
            # Cache the filtered result with 5-minute TTL
            if self.cache_manager:
                await self.cache_manager.set(cache_key, filtered_project.dict(), ttl=self.PROJECT_DATA_CACHE_TTL)
            
            self.logger.info(
                f"Retrieved filtered project data: project_id={project_id}, "
                f"permission_level={permission_level}"
            )
            
            return filtered_project
            
        except Exception as e:
            self.logger.error(
                f"Error getting filtered project data: {str(e)}",
                exc_info=True
            )
            return None

