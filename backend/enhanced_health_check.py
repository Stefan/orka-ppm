"""
Enhanced Health Check Module

Provides comprehensive health checking including user synchronization status.
This module extends the basic health check to monitor the user sync system.
"""

from typing import Dict, Any, Optional
from datetime import datetime
import logging
from config.database import supabase, service_supabase

# Configure logging
logger = logging.getLogger(__name__)

class HealthCheckService:
    """Service for comprehensive application health checking"""
    
    def __init__(self):
        self.client = service_supabase or supabase
    
    async def get_basic_health(self) -> Dict[str, Any]:
        """
        Get basic application health status.
        
        Returns:
            Dictionary with basic health information
        """
        try:
            if self.client is None:
                return {
                    "status": "degraded",
                    "database": "not_configured",
                    "message": "Supabase client not initialized",
                    "timestamp": datetime.now().isoformat()
                }
            
            # Test basic database connection
            try:
                response = self.client.table("portfolios").select("count", count="exact").execute()
                return {
                    "status": "healthy",
                    "database": "connected",
                    "timestamp": datetime.now().isoformat()
                }
            except Exception as db_error:
                return {
                    "status": "degraded",
                    "database": "connection_failed",
                    "error": str(db_error),
                    "timestamp": datetime.now().isoformat()
                }
                
        except Exception as e:
            return {
                "status": "error",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    async def get_user_sync_health(self) -> Dict[str, Any]:
        """
        Get user synchronization system health status.
        
        Returns:
            Dictionary with user sync health information
        """
        try:
            if self.client is None:
                return {
                    "status": "unavailable",
                    "error": "Database client not available"
                }
            
            # Get user sync statistics
            sync_stats = await self._get_sync_statistics()
            
            # Determine sync health status
            missing_profiles = sync_stats.get("missing_profiles", 0)
            sync_percentage = sync_stats.get("sync_percentage", 0)
            
            if missing_profiles == 0 and sync_percentage == 100:
                status = "healthy"
            elif missing_profiles <= 5:  # Allow small number of missing profiles
                status = "warning"
            else:
                status = "degraded"
            
            return {
                "status": status,
                "total_auth_users": sync_stats.get("total_auth_users", 0),
                "total_profiles": sync_stats.get("total_profiles", 0),
                "missing_profiles": missing_profiles,
                "sync_percentage": sync_percentage,
                "last_checked": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error checking user sync health: {e}")
            return {
                "status": "error",
                "error": str(e),
                "last_checked": datetime.now().isoformat()
            }
    
    async def get_trigger_health(self) -> Dict[str, Any]:
        """
        Check if the automatic profile creation trigger is working.
        
        Returns:
            Dictionary with trigger health information
        """
        try:
            if self.client is None:
                return {
                    "status": "unavailable",
                    "error": "Database client not available"
                }
            
            # Check if trigger exists
            trigger_query = """
                SELECT trigger_name, event_manipulation, action_statement
                FROM information_schema.triggers 
                WHERE trigger_name = 'on_auth_user_created'
                AND event_object_table = 'users'
                AND event_object_schema = 'auth'
            """
            
            try:
                # Use raw SQL query to check trigger
                response = self.client.rpc('exec_sql', {'sql': trigger_query}).execute()
                
                if response.data and len(response.data) > 0:
                    return {
                        "status": "active",
                        "trigger_name": "on_auth_user_created",
                        "event": "INSERT",
                        "last_checked": datetime.now().isoformat()
                    }
                else:
                    return {
                        "status": "missing",
                        "error": "Automatic profile creation trigger not found",
                        "last_checked": datetime.now().isoformat()
                    }
                    
            except Exception as query_error:
                # If we can't check the trigger directly, assume it's working
                # if we have good sync statistics
                logger.warning(f"Could not check trigger directly: {query_error}")
                return {
                    "status": "unknown",
                    "error": "Could not verify trigger status",
                    "note": "Trigger status cannot be verified, check sync statistics",
                    "last_checked": datetime.now().isoformat()
                }
                
        except Exception as e:
            logger.error(f"Error checking trigger health: {e}")
            return {
                "status": "error",
                "error": str(e),
                "last_checked": datetime.now().isoformat()
            }
    
    async def get_comprehensive_health(self) -> Dict[str, Any]:
        """
        Get comprehensive health status including all subsystems.
        
        Returns:
            Dictionary with complete health information
        """
        try:
            # Get all health checks
            basic_health = await self.get_basic_health()
            user_sync_health = await self.get_user_sync_health()
            trigger_health = await self.get_trigger_health()
            
            # Determine overall status
            statuses = [
                basic_health.get("status"),
                user_sync_health.get("status"),
                trigger_health.get("status")
            ]
            
            if all(status == "healthy" for status in statuses if status != "unknown"):
                overall_status = "healthy"
            elif any(status == "error" for status in statuses):
                overall_status = "error"
            elif any(status == "degraded" for status in statuses):
                overall_status = "degraded"
            elif any(status == "warning" for status in statuses):
                overall_status = "warning"
            else:
                overall_status = "unknown"
            
            return {
                "status": overall_status,
                "timestamp": datetime.now().isoformat(),
                "components": {
                    "database": {
                        "status": basic_health.get("status"),
                        "connection": basic_health.get("database")
                    },
                    "user_sync": user_sync_health,
                    "triggers": trigger_health
                },
                "summary": {
                    "database_connected": basic_health.get("database") == "connected",
                    "users_synchronized": user_sync_health.get("missing_profiles", 0) == 0,
                    "triggers_active": trigger_health.get("status") in ["active", "unknown"]
                }
            }
            
        except Exception as e:
            logger.error(f"Error getting comprehensive health: {e}")
            return {
                "status": "error",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    async def _get_sync_statistics(self) -> Dict[str, Any]:
        """
        Get current synchronization statistics.
        
        Returns:
            Dictionary with sync statistics
        """
        try:
            # Count auth users
            auth_users_response = self.client.table("auth.users").select("id", count="exact").execute()
            total_auth_users = auth_users_response.count or 0
            
            # Count user profiles
            profiles_response = self.client.table("user_profiles").select("user_id", count="exact").execute()
            total_profiles = profiles_response.count or 0
            
            # Calculate missing profiles
            missing_profiles = max(0, total_auth_users - total_profiles)
            
            # Calculate sync percentage
            sync_percentage = round(
                (total_profiles / total_auth_users * 100) if total_auth_users > 0 else 100, 2
            )
            
            return {
                "total_auth_users": total_auth_users,
                "total_profiles": total_profiles,
                "missing_profiles": missing_profiles,
                "sync_percentage": sync_percentage
            }
            
        except Exception as e:
            logger.error(f"Error getting sync statistics: {e}")
            return {
                "total_auth_users": 0,
                "total_profiles": 0,
                "missing_profiles": 0,
                "sync_percentage": 0.0,
                "error": str(e)
            }


# Global health check service instance
health_service = HealthCheckService()


# Convenience functions for FastAPI endpoints
async def get_basic_health() -> Dict[str, Any]:
    """Get basic health status"""
    return await health_service.get_basic_health()


async def get_user_sync_health() -> Dict[str, Any]:
    """Get user synchronization health status"""
    return await health_service.get_user_sync_health()


async def get_comprehensive_health() -> Dict[str, Any]:
    """Get comprehensive health status"""
    return await health_service.get_comprehensive_health()