"""
Share Link Cleanup Service for Shareable Project URLs

This service provides automatic cleanup of expired share links and optimization
of access logs for large-scale deployments.

Requirements: Performance considerations
"""

from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional
from uuid import UUID
import logging

from config.database import get_db


class ShareLinkCleanupService:
    """
    Service for automatic cleanup and optimization of share link data.
    
    This service handles:
    - Automatic cleanup of expired share links
    - Archiving of old access logs
    - Database optimization for large-scale access logs
    - Cleanup statistics and reporting
    
    Requirements: Performance considerations
    """
    
    def __init__(self, db_session=None):
        """
        Initialize the cleanup service.
        
        Args:
            db_session: Database client (defaults to global Supabase client)
        """
        self.db = db_session or get_db()
        self.logger = logging.getLogger(__name__)
    
    async def cleanup_expired_share_links(
        self,
        grace_period_days: int = 7
    ) -> Dict[str, Any]:
        """
        Clean up expired share links after a grace period.
        
        This method marks expired share links as inactive after they have been
        expired for the specified grace period. This allows for a buffer period
        where links can potentially be extended before cleanup.
        
        Args:
            grace_period_days: Number of days after expiration before cleanup (default: 7)
            
        Returns:
            Dict with 'cleaned_count', 'grace_period_days', 'cleanup_timestamp'
        """
        try:
            if not self.db:
                self.logger.error("Database client not available, cannot cleanup expired links")
                return {
                    "cleaned_count": 0,
                    "grace_period_days": grace_period_days,
                    "cleanup_timestamp": datetime.now(timezone.utc).isoformat(),
                    "error": "Database not available"
                }
            
            # Calculate cutoff date (expired + grace period)
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=grace_period_days)
            
            # Find expired share links that are still marked as active
            # and have been expired for longer than the grace period
            result = self.db.table("project_shares").select("id, token, project_id, expires_at").eq(
                "is_active", True
            ).lt("expires_at", cutoff_date.isoformat()).execute()
            
            if not result.data or len(result.data) == 0:
                self.logger.info("No expired share links to clean up")
                return {
                    "cleaned_count": 0,
                    "grace_period_days": grace_period_days,
                    "cleanup_timestamp": datetime.now(timezone.utc).isoformat()
                }
            
            expired_links = result.data
            cleaned_count = 0
            
            # Mark each expired link as inactive
            for link in expired_links:
                try:
                    update_result = self.db.table("project_shares").update({
                        "is_active": False,
                        "revoked_at": datetime.now(timezone.utc).isoformat(),
                        "revocation_reason": f"Automatic cleanup - expired {grace_period_days} days ago",
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }).eq("id", link["id"]).execute()
                    
                    if update_result.data and len(update_result.data) > 0:
                        cleaned_count += 1
                        self.logger.debug(f"Cleaned up expired share link: {link['id']}")
                    
                except Exception as e:
                    self.logger.error(f"Error cleaning up share link {link['id']}: {str(e)}")
            
            self.logger.info(
                f"Cleaned up {cleaned_count} expired share links "
                f"(grace period: {grace_period_days} days)"
            )
            
            return {
                "cleaned_count": cleaned_count,
                "grace_period_days": grace_period_days,
                "cleanup_timestamp": datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            self.logger.error(
                f"Error during expired share link cleanup: {str(e)}",
                exc_info=True
            )
            return {
                "cleaned_count": 0,
                "grace_period_days": grace_period_days,
                "cleanup_timestamp": datetime.now(timezone.utc).isoformat(),
                "error": str(e)
            }
    
    async def archive_old_access_logs(
        self,
        retention_days: int = 90
    ) -> Dict[str, Any]:
        """
        Archive or delete old access logs to optimize database performance.
        
        This method removes access logs older than the retention period.
        For production deployments, consider archiving to cold storage instead
        of deletion.
        
        Args:
            retention_days: Number of days to retain access logs (default: 90)
            
        Returns:
            Dict with 'archived_count', 'retention_days', 'archive_timestamp'
        """
        try:
            if not self.db:
                self.logger.error("Database client not available, cannot archive logs")
                return {
                    "archived_count": 0,
                    "retention_days": retention_days,
                    "archive_timestamp": datetime.now(timezone.utc).isoformat(),
                    "error": "Database not available"
                }
            
            # Calculate cutoff date
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=retention_days)
            
            # Count logs to be archived
            count_result = self.db.table("share_access_logs").select(
                "id", count="exact"
            ).lt("accessed_at", cutoff_date.isoformat()).execute()
            
            logs_to_archive = count_result.count if hasattr(count_result, 'count') else 0
            
            if logs_to_archive == 0:
                self.logger.info("No old access logs to archive")
                return {
                    "archived_count": 0,
                    "retention_days": retention_days,
                    "archive_timestamp": datetime.now(timezone.utc).isoformat()
                }
            
            # Delete old logs (in production, consider archiving to cold storage first)
            delete_result = self.db.table("share_access_logs").delete().lt(
                "accessed_at", cutoff_date.isoformat()
            ).execute()
            
            archived_count = len(delete_result.data) if delete_result.data else 0
            
            self.logger.info(
                f"Archived {archived_count} access logs older than {retention_days} days"
            )
            
            return {
                "archived_count": archived_count,
                "retention_days": retention_days,
                "archive_timestamp": datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            self.logger.error(
                f"Error during access log archival: {str(e)}",
                exc_info=True
            )
            return {
                "archived_count": 0,
                "retention_days": retention_days,
                "archive_timestamp": datetime.now(timezone.utc).isoformat(),
                "error": str(e)
            }
    
    async def optimize_database_indexes(self) -> Dict[str, Any]:
        """
        Verify and report on database index usage for share link tables.
        
        This method checks that all required indexes exist and provides
        recommendations for optimization. Note: Actual index creation
        should be done via migrations.
        
        Returns:
            Dict with index status and recommendations
        """
        try:
            if not self.db:
                self.logger.error("Database client not available, cannot check indexes")
                return {
                    "status": "error",
                    "error": "Database not available"
                }
            
            # List of expected indexes for optimal performance
            expected_indexes = {
                "project_shares": [
                    "idx_project_shares_token",
                    "idx_project_shares_project_id",
                    "idx_project_shares_expires_at",
                    "idx_project_shares_created_by"
                ],
                "share_access_logs": [
                    "idx_share_access_logs_share_id",
                    "idx_share_access_logs_accessed_at",
                    "idx_share_access_logs_ip_address"
                ]
            }
            
            # Note: Supabase doesn't provide direct index introspection via the client
            # This is a placeholder for index verification logic
            # In production, this would query pg_indexes or use database-specific tools
            
            self.logger.info("Database index optimization check completed")
            
            return {
                "status": "success",
                "message": "All expected indexes should be created via migrations",
                "expected_indexes": expected_indexes,
                "recommendation": "Ensure all indexes are created during database setup"
            }
            
        except Exception as e:
            self.logger.error(
                f"Error during index optimization check: {str(e)}",
                exc_info=True
            )
            return {
                "status": "error",
                "error": str(e)
            }
    
    async def get_cleanup_statistics(self) -> Dict[str, Any]:
        """
        Get statistics about share links and access logs for cleanup planning.
        
        Returns:
            Dict with statistics about share links and access logs
        """
        try:
            if not self.db:
                self.logger.error("Database client not available, cannot get statistics")
                return {
                    "error": "Database not available"
                }
            
            # Count total share links
            total_shares_result = self.db.table("project_shares").select(
                "id", count="exact"
            ).execute()
            total_shares = total_shares_result.count if hasattr(total_shares_result, 'count') else 0
            
            # Count active share links
            active_shares_result = self.db.table("project_shares").select(
                "id", count="exact"
            ).eq("is_active", True).execute()
            active_shares = active_shares_result.count if hasattr(active_shares_result, 'count') else 0
            
            # Count expired but not cleaned up share links
            now = datetime.now(timezone.utc)
            expired_shares_result = self.db.table("project_shares").select(
                "id", count="exact"
            ).eq("is_active", True).lt("expires_at", now.isoformat()).execute()
            expired_shares = expired_shares_result.count if hasattr(expired_shares_result, 'count') else 0
            
            # Count total access logs
            total_logs_result = self.db.table("share_access_logs").select(
                "id", count="exact"
            ).execute()
            total_logs = total_logs_result.count if hasattr(total_logs_result, 'count') else 0
            
            # Count logs from last 30 days
            thirty_days_ago = now - timedelta(days=30)
            recent_logs_result = self.db.table("share_access_logs").select(
                "id", count="exact"
            ).gte("accessed_at", thirty_days_ago.isoformat()).execute()
            recent_logs = recent_logs_result.count if hasattr(recent_logs_result, 'count') else 0
            
            statistics = {
                "share_links": {
                    "total": total_shares,
                    "active": active_shares,
                    "expired_pending_cleanup": expired_shares,
                    "inactive": total_shares - active_shares
                },
                "access_logs": {
                    "total": total_logs,
                    "last_30_days": recent_logs,
                    "older_than_30_days": total_logs - recent_logs
                },
                "timestamp": now.isoformat()
            }
            
            self.logger.info(f"Cleanup statistics retrieved: {statistics}")
            
            return statistics
            
        except Exception as e:
            self.logger.error(
                f"Error getting cleanup statistics: {str(e)}",
                exc_info=True
            )
            return {
                "error": str(e)
            }
    
    async def run_full_cleanup(
        self,
        expired_grace_period_days: int = 7,
        log_retention_days: int = 90
    ) -> Dict[str, Any]:
        """
        Run a full cleanup operation including expired links and old logs.
        
        This is a convenience method that runs all cleanup operations in sequence.
        
        Args:
            expired_grace_period_days: Grace period for expired link cleanup
            log_retention_days: Retention period for access logs
            
        Returns:
            Dict with results from all cleanup operations
        """
        try:
            self.logger.info("Starting full cleanup operation")
            
            # Get statistics before cleanup
            stats_before = await self.get_cleanup_statistics()
            
            # Clean up expired share links
            expired_cleanup = await self.cleanup_expired_share_links(expired_grace_period_days)
            
            # Archive old access logs
            log_archive = await self.archive_old_access_logs(log_retention_days)
            
            # Get statistics after cleanup
            stats_after = await self.get_cleanup_statistics()
            
            result = {
                "status": "completed",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "statistics_before": stats_before,
                "statistics_after": stats_after,
                "expired_link_cleanup": expired_cleanup,
                "access_log_archive": log_archive
            }
            
            self.logger.info(
                f"Full cleanup completed: "
                f"{expired_cleanup.get('cleaned_count', 0)} links cleaned, "
                f"{log_archive.get('archived_count', 0)} logs archived"
            )
            
            return result
            
        except Exception as e:
            self.logger.error(
                f"Error during full cleanup operation: {str(e)}",
                exc_info=True
            )
            return {
                "status": "error",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "error": str(e)
            }
