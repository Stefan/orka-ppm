"""
Share Link Generator Service for Shareable Project URLs

This service provides secure share link generation and management for projects,
enabling controlled external access to project information without requiring
full system accounts.

Requirements: 1.1, 1.2, 1.3, 1.4, 6.1, 6.2, 6.3, 6.4
"""

from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from uuid import UUID
import logging
import secrets
import base64

from config.database import get_db
from models.shareable_urls import (
    ShareLinkCreate,
    ShareLinkResponse,
    SharePermissionLevel,
    ShareLinkListResponse
)
from performance_optimization import CacheManager


class ShareLinkGenerator:
    """
    Service for creating and managing secure shareable URLs for projects.
    
    This service handles:
    - Cryptographically secure token generation (64-char URL-safe)
    - Token uniqueness validation across all projects
    - Share link creation with metadata storage
    - Share link management (list, revoke, extend expiry)
    
    Requirements: 1.1, 1.2, 1.3, 1.4, 6.1, 6.2, 6.3, 6.4
    """
    
    def __init__(self, db_session=None, base_url: str = None, cache_manager: Optional[CacheManager] = None):
        """
        Initialize the share link generator service.
        
        Args:
            db_session: Database client (defaults to global Supabase client)
            base_url: Base URL for constructing share links (e.g., "https://app.example.com")
            cache_manager: Cache manager for cache invalidation (optional)
        """
        self.db = db_session or get_db()
        self.logger = logging.getLogger(__name__)
        self.base_url = base_url or "https://app.orka-ppm.com"
        self.cache_manager = cache_manager
    
    def generate_secure_token(self) -> str:
        """
        Generate a cryptographically secure 64-character URL-safe token.
        
        This method uses the secrets module for cryptographically secure random
        generation and base64 URL-safe encoding to ensure tokens are:
        - Exactly 64 characters long
        - URL-safe (only A-Z, a-z, 0-9, -, _)
        - Cryptographically random and unpredictable
        - High entropy for security
        
        Returns:
            str: 64-character URL-safe token
            
        Requirements: 1.1, 1.2
        """
        # Generate 48 random bytes (will be 64 chars in base64)
        random_bytes = secrets.token_bytes(48)
        
        # Encode as URL-safe base64
        token = base64.urlsafe_b64encode(random_bytes).decode('utf-8')
        
        # Ensure exactly 64 characters (remove padding if present)
        token = token.replace('=', '')[:64]
        
        # Pad with additional random characters if needed
        while len(token) < 64:
            token += secrets.choice('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_')
        
        return token[:64]
    
    async def validate_token_uniqueness(self, token: str) -> bool:
        """
        Validate that a token is unique across all projects.
        
        Checks the project_shares table to ensure no existing share link
        uses the provided token. This prevents token collisions.
        
        Args:
            token: Token to validate
            
        Returns:
            bool: True if token is unique, False if already exists
            
        Requirements: 1.4
        """
        try:
            if not self.db:
                self.logger.warning("Database client not available, cannot validate token uniqueness")
                return False
            
            # Query for existing token
            result = self.db.table("project_shares").select("id").eq("token", token).execute()
            
            # Token is unique if no results found
            is_unique = len(result.data) == 0
            
            if not is_unique:
                self.logger.warning(f"Token collision detected: {token[:10]}...")
            
            return is_unique
            
        except Exception as e:
            self.logger.error(f"Error validating token uniqueness: {str(e)}", exc_info=True)
            return False
    
    async def create_share_link(
        self,
        project_id: UUID,
        creator_id: UUID,
        permission_level: SharePermissionLevel,
        expiry_duration_days: int,
        custom_message: Optional[str] = None
    ) -> Optional[ShareLinkResponse]:
        """
        Create a new share link for a project.
        
        Generates a unique cryptographically secure token, stores the share link
        metadata in the database, and returns a complete ShareLinkResponse with
        the shareable URL.
        
        The method ensures token uniqueness by regenerating if a collision occurs
        (extremely rare with 64-char tokens).
        
        Args:
            project_id: UUID of the project to share
            creator_id: UUID of the user creating the share link
            permission_level: Permission level for the share link
            expiry_duration_days: Number of days until link expires (1-365)
            custom_message: Optional custom message for recipients
            
        Returns:
            ShareLinkResponse: Created share link with metadata, or None if failed
            
        Requirements: 1.1, 1.2, 1.3, 1.4
        """
        try:
            if not self.db:
                self.logger.error("Database client not available, cannot create share link")
                return None
            
            # Validate expiry duration
            if not 1 <= expiry_duration_days <= 365:
                self.logger.error(f"Invalid expiry duration: {expiry_duration_days} days")
                return None
            
            # Generate unique token (retry up to 5 times if collision occurs)
            token = None
            max_retries = 5
            
            for attempt in range(max_retries):
                candidate_token = self.generate_secure_token()
                
                if await self.validate_token_uniqueness(candidate_token):
                    token = candidate_token
                    break
                
                self.logger.warning(
                    f"Token collision on attempt {attempt + 1}/{max_retries}, regenerating..."
                )
            
            if not token:
                self.logger.error("Failed to generate unique token after maximum retries")
                return None
            
            # Calculate expiration timestamp
            expires_at = datetime.now() + timedelta(days=expiry_duration_days)
            
            # Prepare share link data
            share_data = {
                "project_id": str(project_id),
                "token": token,
                "created_by": str(creator_id),
                "permission_level": permission_level.value,
                "expires_at": expires_at.isoformat(),
                "is_active": True,
                "custom_message": custom_message,
                "access_count": 0,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            }
            
            # Insert into database
            result = self.db.table("project_shares").insert(share_data).execute()
            
            if not result.data or len(result.data) == 0:
                self.logger.error("Failed to insert share link into database")
                return None
            
            created_share = result.data[0]
            
            # Construct share URL
            share_url = f"{self.base_url}/projects/{project_id}/share/{token}"
            
            # Create response model
            response = ShareLinkResponse(
                id=created_share["id"],
                project_id=created_share["project_id"],
                token=created_share["token"],
                share_url=share_url,
                permission_level=created_share["permission_level"],
                expires_at=datetime.fromisoformat(created_share["expires_at"]),
                is_active=created_share["is_active"],
                custom_message=created_share.get("custom_message"),
                access_count=created_share["access_count"],
                last_accessed_at=None,
                last_accessed_ip=None,
                revoked_at=None,
                revoked_by=None,
                revocation_reason=None,
                created_at=datetime.fromisoformat(created_share["created_at"]),
                updated_at=datetime.fromisoformat(created_share["updated_at"]),
                created_by=created_share["created_by"]
            )
            
            self.logger.info(
                f"Share link created: project={project_id}, "
                f"permission={permission_level.value}, expires={expires_at.date()}"
            )
            
            return response
            
        except Exception as e:
            self.logger.error(
                f"Error creating share link for project {project_id}: {str(e)}",
                exc_info=True
            )
            return None
    
    async def list_project_shares(
        self,
        project_id: UUID,
        include_inactive: bool = False
    ) -> Optional[ShareLinkListResponse]:
        """
        List all share links for a project.
        
        Retrieves all share links associated with a project, optionally filtering
        to only active links. Provides summary statistics including total count,
        active count, and expired count.
        
        Args:
            project_id: UUID of the project
            include_inactive: Whether to include revoked/inactive links
            
        Returns:
            ShareLinkListResponse: List of share links with statistics, or None if failed
            
        Requirements: 6.1
        """
        try:
            if not self.db:
                self.logger.error("Database client not available, cannot list share links")
                return None
            
            # Build query
            query = self.db.table("project_shares").select("*").eq("project_id", str(project_id))
            
            if not include_inactive:
                query = query.eq("is_active", True)
            
            # Order by creation date (newest first)
            query = query.order("created_at", desc=True)
            
            result = query.execute()
            
            # Handle empty or None results
            # Access result.data safely
            if hasattr(result, 'data'):
                data_attr = getattr(result, 'data', None)
                if isinstance(data_attr, list):
                    data_list = data_attr
                elif data_attr is None:
                    data_list = []
                else:
                    # Try to convert to list
                    try:
                        data_list = list(data_attr)
                    except (TypeError, AttributeError):
                        data_list = []
            else:
                data_list = []
            
            if not data_list:
                # No share links found, return empty list
                return ShareLinkListResponse(
                    share_links=[],
                    total=0,
                    active_count=0,
                    expired_count=0
                )
            
            # Convert to response models
            share_links = []
            active_count = 0
            expired_count = 0
            now = datetime.now()
            
            for share in data_list:
                # Construct share URL
                share_url = f"{self.base_url}/projects/{project_id}/share/{share['token']}"
                
                # Parse timestamps
                expires_at = datetime.fromisoformat(share["expires_at"])
                created_at = datetime.fromisoformat(share["created_at"])
                last_accessed_at = (
                    datetime.fromisoformat(share["last_accessed_at"])
                    if share.get("last_accessed_at")
                    else None
                )
                revoked_at = (
                    datetime.fromisoformat(share["revoked_at"])
                    if share.get("revoked_at")
                    else None
                )
                
                # Count active and expired
                is_expired = expires_at < now
                is_active = share["is_active"] and not is_expired
                
                if is_active:
                    active_count += 1
                if is_expired:
                    expired_count += 1
                
                response = ShareLinkResponse(
                    id=share["id"],
                    project_id=share["project_id"],
                    token=share["token"],
                    share_url=share_url,
                    permission_level=share["permission_level"],
                    expires_at=expires_at,
                    is_active=share["is_active"],
                    custom_message=share.get("custom_message"),
                    access_count=share["access_count"],
                    last_accessed_at=last_accessed_at,
                    last_accessed_ip=share.get("last_accessed_ip"),
                    revoked_at=revoked_at,
                    revoked_by=share.get("revoked_by"),
                    revocation_reason=share.get("revocation_reason"),
                    created_at=created_at,
                    updated_at=datetime.fromisoformat(share["updated_at"]),
                    created_by=share["created_by"]
                )
                
                share_links.append(response)
            
            return ShareLinkListResponse(
                share_links=share_links,
                total=len(share_links),
                active_count=active_count,
                expired_count=expired_count
            )
            
        except Exception as e:
            self.logger.error(
                f"Error listing share links for project {project_id}: {str(e)}",
                exc_info=True
            )
            return None
    
    async def revoke_share_link(
        self,
        share_id: UUID,
        revoked_by: UUID,
        revocation_reason: str
    ) -> bool:
        """
        Revoke a share link, immediately disabling access.
        
        Updates the share link to mark it as inactive and records who revoked it
        and why. This immediately prevents any further access via the link.
        Also invalidates any cached validation results for the token.
        
        Args:
            share_id: UUID of the share link to revoke
            revoked_by: UUID of the user revoking the link
            revocation_reason: Reason for revocation
            
        Returns:
            bool: True if successfully revoked, False otherwise
            
        Requirements: 6.2, 6.3
        """
        try:
            if not self.db:
                self.logger.error("Database client not available, cannot revoke share link")
                return False
            
            # Get the token before revoking (for cache invalidation)
            share_result = self.db.table("project_shares").select("token").eq("id", str(share_id)).execute()
            token = share_result.data[0]["token"] if share_result.data else None
            
            # Update share link
            update_data = {
                "is_active": False,
                "revoked_at": datetime.now().isoformat(),
                "revoked_by": str(revoked_by),
                "revocation_reason": revocation_reason,
                "updated_at": datetime.now().isoformat()
            }
            
            result = self.db.table("project_shares").update(update_data).eq("id", str(share_id)).execute()
            
            if not result.data or len(result.data) == 0:
                self.logger.error(f"Share link not found: {share_id}")
                return False
            
            # Invalidate token validation cache
            if self.cache_manager and token:
                cache_key = f"share_token_validation:{token}"
                await self.cache_manager.delete(cache_key)
                self.logger.debug(f"Invalidated token cache for revoked share link: {token[:10]}...")
            
            self.logger.info(
                f"Share link revoked: id={share_id}, by={revoked_by}, reason={revocation_reason}"
            )
            
            return True
            
        except Exception as e:
            self.logger.error(
                f"Error revoking share link {share_id}: {str(e)}",
                exc_info=True
            )
            return False
    
    async def extend_expiry(
        self,
        share_id: UUID,
        additional_days: int
    ) -> Optional[ShareLinkResponse]:
        """
        Extend the expiration time of a share link.
        
        Adds the specified number of days to the current expiration time.
        Only works for active, non-revoked links.
        
        Args:
            share_id: UUID of the share link to extend
            additional_days: Number of days to add (1-365)
            
        Returns:
            ShareLinkResponse: Updated share link, or None if failed
            
        Requirements: 6.3
        """
        try:
            if not self.db:
                self.logger.error("Database client not available, cannot extend share link")
                return None
            
            # Validate additional days
            if not 1 <= additional_days <= 365:
                self.logger.error(f"Invalid additional days: {additional_days}")
                return None
            
            # Get current share link
            result = self.db.table("project_shares").select("*").eq("id", str(share_id)).execute()
            
            if not result.data or len(result.data) == 0:
                self.logger.error(f"Share link not found: {share_id}")
                return None
            
            share = result.data[0]
            
            # Check if link is active
            if not share["is_active"]:
                self.logger.error(f"Cannot extend inactive share link: {share_id}")
                return None
            
            # Calculate new expiration
            current_expires_at = datetime.fromisoformat(share["expires_at"])
            new_expires_at = current_expires_at + timedelta(days=additional_days)
            
            # Update expiration
            update_data = {
                "expires_at": new_expires_at.isoformat(),
                "updated_at": datetime.now().isoformat()
            }
            
            update_result = self.db.table("project_shares").update(update_data).eq("id", str(share_id)).execute()
            
            if not update_result.data or len(update_result.data) == 0:
                self.logger.error(f"Failed to update share link: {share_id}")
                return None
            
            updated_share = update_result.data[0]
            
            # Construct share URL
            share_url = f"{self.base_url}/projects/{updated_share['project_id']}/share/{updated_share['token']}"
            
            # Create response
            response = ShareLinkResponse(
                id=updated_share["id"],
                project_id=updated_share["project_id"],
                token=updated_share["token"],
                share_url=share_url,
                permission_level=updated_share["permission_level"],
                expires_at=datetime.fromisoformat(updated_share["expires_at"]),
                is_active=updated_share["is_active"],
                custom_message=updated_share.get("custom_message"),
                access_count=updated_share["access_count"],
                last_accessed_at=(
                    datetime.fromisoformat(updated_share["last_accessed_at"])
                    if updated_share.get("last_accessed_at")
                    else None
                ),
                last_accessed_ip=updated_share.get("last_accessed_ip"),
                revoked_at=(
                    datetime.fromisoformat(updated_share["revoked_at"])
                    if updated_share.get("revoked_at")
                    else None
                ),
                revoked_by=updated_share.get("revoked_by"),
                revocation_reason=updated_share.get("revocation_reason"),
                created_at=datetime.fromisoformat(updated_share["created_at"]),
                updated_at=datetime.fromisoformat(updated_share["updated_at"]),
                created_by=updated_share["created_by"]
            )
            
            self.logger.info(
                f"Share link expiry extended: id={share_id}, "
                f"new_expiry={new_expires_at.date()}, added_days={additional_days}"
            )
            
            return response
            
        except Exception as e:
            self.logger.error(
                f"Error extending share link {share_id}: {str(e)}",
                exc_info=True
            )
            return None
    
    async def check_creator_permission(
        self,
        share_id: UUID,
        user_id: UUID
    ) -> bool:
        """
        Check if a user has permission to manage a share link.
        
        Users can manage share links if they:
        1. Created the share link, OR
        2. Have project_update permission for the associated project
        
        Args:
            share_id: UUID of the share link
            user_id: UUID of the user to check
            
        Returns:
            bool: True if user has permission, False otherwise
            
        Requirements: 1.5, 6.2, 6.3
        """
        try:
            if not self.db:
                self.logger.error("Database client not available, cannot check permissions")
                return False
            
            # Get share link details
            result = self.db.table("project_shares").select("created_by, project_id").eq("id", str(share_id)).execute()
            
            if not result.data or len(result.data) == 0:
                self.logger.error(f"Share link not found: {share_id}")
                return False
            
            share = result.data[0]
            
            # Check if user is the creator
            if share["created_by"] == str(user_id):
                return True
            
            # Check if user has project_update permission for the project
            # This would integrate with RBAC system
            # For now, we'll return False for non-creators
            # The API layer will handle RBAC checks
            return False
            
        except Exception as e:
            self.logger.error(
                f"Error checking creator permission for share {share_id}: {str(e)}",
                exc_info=True
            )
            return False
    
    async def bulk_revoke_share_links(
        self,
        share_ids: List[UUID],
        revoked_by: UUID,
        revocation_reason: str
    ) -> Dict[str, Any]:
        """
        Revoke multiple share links in a single operation.
        
        This method processes each share link individually and returns
        detailed results about successes and failures.
        
        Args:
            share_ids: List of share link UUIDs to revoke (max 50)
            revoked_by: UUID of the user revoking the links
            revocation_reason: Reason for revocation
            
        Returns:
            Dict with 'successful', 'failed', 'total_processed', 'success_count', 'failure_count'
            
        Requirements: 6.4
        """
        try:
            if not share_ids:
                return {
                    "successful": [],
                    "failed": [],
                    "total_processed": 0,
                    "success_count": 0,
                    "failure_count": 0
                }
            
            # Limit to 50 share links per operation
            if len(share_ids) > 50:
                self.logger.warning(f"Bulk revoke limited to 50 share links, received {len(share_ids)}")
                share_ids = share_ids[:50]
            
            successful = []
            failed = []
            
            for share_id in share_ids:
                try:
                    # Check if user has permission to revoke this share link
                    has_permission = await self.check_creator_permission(share_id, revoked_by)
                    
                    if not has_permission:
                        failed.append({
                            "share_id": str(share_id),
                            "error": "insufficient_permissions",
                            "message": "User does not have permission to revoke this share link"
                        })
                        continue
                    
                    # Revoke the share link
                    success = await self.revoke_share_link(share_id, revoked_by, revocation_reason)
                    
                    if success:
                        successful.append(str(share_id))
                    else:
                        failed.append({
                            "share_id": str(share_id),
                            "error": "revocation_failed",
                            "message": "Failed to revoke share link"
                        })
                        
                except Exception as e:
                    self.logger.error(f"Error revoking share link {share_id}: {str(e)}")
                    failed.append({
                        "share_id": str(share_id),
                        "error": "exception",
                        "message": str(e)
                    })
            
            result = {
                "successful": successful,
                "failed": failed,
                "total_processed": len(share_ids),
                "success_count": len(successful),
                "failure_count": len(failed)
            }
            
            self.logger.info(
                f"Bulk revoke completed: {len(successful)} successful, {len(failed)} failed"
            )
            
            return result
            
        except Exception as e:
            self.logger.error(
                f"Error in bulk revoke operation: {str(e)}",
                exc_info=True
            )
            return {
                "successful": [],
                "failed": [{"error": "bulk_operation_failed", "message": str(e)}],
                "total_processed": 0,
                "success_count": 0,
                "failure_count": 0
            }
    
    async def bulk_extend_expiry(
        self,
        share_ids: List[UUID],
        additional_days: int,
        user_id: UUID
    ) -> Dict[str, Any]:
        """
        Extend expiration time for multiple share links.
        
        This method processes each share link individually and returns
        detailed results about successes and failures.
        
        Args:
            share_ids: List of share link UUIDs to extend (max 50)
            additional_days: Number of days to add (1-365)
            user_id: UUID of the user performing the operation
            
        Returns:
            Dict with 'successful', 'failed', 'total_processed', 'success_count', 'failure_count'
            
        Requirements: 6.4
        """
        try:
            if not share_ids:
                return {
                    "successful": [],
                    "failed": [],
                    "total_processed": 0,
                    "success_count": 0,
                    "failure_count": 0
                }
            
            # Validate additional days
            if not 1 <= additional_days <= 365:
                return {
                    "successful": [],
                    "failed": [{"error": "invalid_days", "message": f"Additional days must be between 1 and 365, got {additional_days}"}],
                    "total_processed": 0,
                    "success_count": 0,
                    "failure_count": 0
                }
            
            # Limit to 50 share links per operation
            if len(share_ids) > 50:
                self.logger.warning(f"Bulk extend limited to 50 share links, received {len(share_ids)}")
                share_ids = share_ids[:50]
            
            successful = []
            failed = []
            
            for share_id in share_ids:
                try:
                    # Check if user has permission to extend this share link
                    has_permission = await self.check_creator_permission(share_id, user_id)
                    
                    if not has_permission:
                        failed.append({
                            "share_id": str(share_id),
                            "error": "insufficient_permissions",
                            "message": "User does not have permission to extend this share link"
                        })
                        continue
                    
                    # Extend the share link
                    result = await self.extend_expiry(share_id, additional_days)
                    
                    if result:
                        successful.append(str(share_id))
                    else:
                        failed.append({
                            "share_id": str(share_id),
                            "error": "extension_failed",
                            "message": "Failed to extend share link expiry"
                        })
                        
                except Exception as e:
                    self.logger.error(f"Error extending share link {share_id}: {str(e)}")
                    failed.append({
                        "share_id": str(share_id),
                        "error": "exception",
                        "message": str(e)
                    })
            
            result = {
                "successful": successful,
                "failed": failed,
                "total_processed": len(share_ids),
                "success_count": len(successful),
                "failure_count": len(failed)
            }
            
            self.logger.info(
                f"Bulk extend completed: {len(successful)} successful, {len(failed)} failed"
            )
            
            return result
            
        except Exception as e:
            self.logger.error(
                f"Error in bulk extend operation: {str(e)}",
                exc_info=True
            )
            return {
                "successful": [],
                "failed": [{"error": "bulk_operation_failed", "message": str(e)}],
                "total_processed": 0,
                "success_count": 0,
                "failure_count": 0
            }
    
    async def bulk_deactivate(
        self,
        share_ids: List[UUID],
        user_id: UUID,
        reason: str = "Bulk deactivation"
    ) -> Dict[str, Any]:
        """
        Deactivate multiple share links without full revocation.
        
        This is similar to revoke but specifically for temporary deactivation.
        The links can potentially be reactivated later.
        
        Args:
            share_ids: List of share link UUIDs to deactivate (max 50)
            user_id: UUID of the user performing the operation
            reason: Reason for deactivation
            
        Returns:
            Dict with 'successful', 'failed', 'total_processed', 'success_count', 'failure_count'
            
        Requirements: 6.4
        """
        try:
            if not share_ids:
                return {
                    "successful": [],
                    "failed": [],
                    "total_processed": 0,
                    "success_count": 0,
                    "failure_count": 0
                }
            
            # Limit to 50 share links per operation
            if len(share_ids) > 50:
                self.logger.warning(f"Bulk deactivate limited to 50 share links, received {len(share_ids)}")
                share_ids = share_ids[:50]
            
            successful = []
            failed = []
            
            for share_id in share_ids:
                try:
                    # Check if user has permission to deactivate this share link
                    has_permission = await self.check_creator_permission(share_id, user_id)
                    
                    if not has_permission:
                        failed.append({
                            "share_id": str(share_id),
                            "error": "insufficient_permissions",
                            "message": "User does not have permission to deactivate this share link"
                        })
                        continue
                    
                    # Deactivate the share link (same as revoke for now)
                    success = await self.revoke_share_link(share_id, user_id, reason)
                    
                    if success:
                        successful.append(str(share_id))
                    else:
                        failed.append({
                            "share_id": str(share_id),
                            "error": "deactivation_failed",
                            "message": "Failed to deactivate share link"
                        })
                        
                except Exception as e:
                    self.logger.error(f"Error deactivating share link {share_id}: {str(e)}")
                    failed.append({
                        "share_id": str(share_id),
                        "error": "exception",
                        "message": str(e)
                    })
            
            result = {
                "successful": successful,
                "failed": failed,
                "total_processed": len(share_ids),
                "success_count": len(successful),
                "failure_count": len(failed)
            }
            
            self.logger.info(
                f"Bulk deactivate completed: {len(successful)} successful, {len(failed)} failed"
            )
            
            return result
            
        except Exception as e:
            self.logger.error(
                f"Error in bulk deactivate operation: {str(e)}",
                exc_info=True
            )
            return {
                "successful": [],
                "failed": [{"error": "bulk_operation_failed", "message": str(e)}],
                "total_processed": 0,
                "success_count": 0,
                "failure_count": 0
            }
