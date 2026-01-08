"""
User Synchronization Service

This service handles synchronization between Supabase auth.users and the application's user_profiles table.
It identifies missing user profiles and creates them with default values.
"""

from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from uuid import UUID
import logging

from config.database import supabase, service_supabase
from models.users import UserRole

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SyncResult:
    """Result of a synchronization operation"""
    def __init__(self):
        self.total_auth_users: int = 0
        self.existing_profiles: int = 0
        self.created_profiles: int = 0
        self.failed_creations: int = 0
        self.errors: List[str] = []
        self.execution_time: float = 0.0
        self.created_user_ids: List[str] = []

    def to_dict(self) -> Dict[str, Any]:
        """Convert result to dictionary for JSON serialization"""
        return {
            "total_auth_users": self.total_auth_users,
            "existing_profiles": self.existing_profiles,
            "created_profiles": self.created_profiles,
            "failed_creations": self.failed_creations,
            "errors": self.errors,
            "execution_time": self.execution_time,
            "created_user_ids": self.created_user_ids
        }

class UserSynchronizationService:
    """Service for synchronizing users between auth.users and user_profiles"""
    
    def __init__(self):
        self.client = service_supabase or supabase
        if not self.client:
            raise RuntimeError("No Supabase client available for synchronization")
    
    def identify_missing_profiles(self) -> List[Dict[str, Any]]:
        """
        Identify auth.users records that don't have corresponding user_profiles records.
        
        Returns:
            List of auth.users records without corresponding user_profiles
            
        Raises:
            Exception: If database query fails
        """
        try:
            logger.info("Starting identification of missing user profiles")
            
            # Get all auth.users
            auth_users_response = self.client.table("auth.users").select("id, email, created_at, last_sign_in_at").execute()
            
            if not auth_users_response.data:
                logger.info("No auth users found")
                return []
            
            auth_users = auth_users_response.data
            logger.info(f"Found {len(auth_users)} auth users")
            
            # Get all existing user_profiles
            profiles_response = self.client.table("user_profiles").select("user_id").execute()
            existing_profile_user_ids = set()
            
            if profiles_response.data:
                existing_profile_user_ids = {profile["user_id"] for profile in profiles_response.data}
                logger.info(f"Found {len(existing_profile_user_ids)} existing user profiles")
            else:
                logger.info("No existing user profiles found")
            
            # Find missing profiles
            missing_profiles = []
            for auth_user in auth_users:
                if auth_user["id"] not in existing_profile_user_ids:
                    missing_profiles.append(auth_user)
            
            logger.info(f"Identified {len(missing_profiles)} users with missing profiles")
            return missing_profiles
            
        except Exception as e:
            logger.error(f"Error identifying missing profiles: {e}")
            raise Exception(f"Failed to identify missing profiles: {str(e)}")
    
    def get_sync_statistics(self) -> Dict[str, int]:
        """
        Get current synchronization statistics.
        
        Returns:
            Dictionary with counts of auth users, profiles, and missing profiles
        """
        try:
            # Count auth users
            auth_users_response = self.client.table("auth.users").select("id", count="exact").execute()
            total_auth_users = auth_users_response.count or 0
            
            # Count user profiles
            profiles_response = self.client.table("user_profiles").select("user_id", count="exact").execute()
            total_profiles = profiles_response.count or 0
            
            # Calculate missing
            missing_profiles = self.identify_missing_profiles()
            missing_count = len(missing_profiles)
            
            return {
                "total_auth_users": total_auth_users,
                "total_profiles": total_profiles,
                "missing_profiles": missing_count,
                "sync_percentage": round((total_profiles / total_auth_users * 100) if total_auth_users > 0 else 100, 2)
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
    
    def create_missing_profiles(self, missing_users: List[Dict[str, Any]], preserve_existing: bool = True) -> SyncResult:
        """
        Create user_profiles records for missing users with default values.
        
        Args:
            missing_users: List of auth.users records without profiles
            preserve_existing: If True, don't overwrite existing profile data
            
        Returns:
            SyncResult with details of the operation
            
        Raises:
            Exception: If profile creation fails
        """
        result = SyncResult()
        start_time = datetime.now()
        
        try:
            logger.info(f"Starting profile creation for {len(missing_users)} users (preserve_existing={preserve_existing})")
            
            for auth_user in missing_users:
                try:
                    user_id = auth_user["id"]
                    
                    # Enhanced preservation check with detailed logging
                    if preserve_existing:
                        existing_profile = self._get_existing_profile_with_details(user_id)
                        if existing_profile:
                            logger.info(f"Profile already exists for user {user_id}, preserving existing data")
                            logger.debug(f"Existing profile data: role={existing_profile.get('role')}, "
                                       f"is_active={existing_profile.get('is_active')}, "
                                       f"created_at={existing_profile.get('created_at')}")
                            result.existing_profiles += 1
                            continue
                    
                    # Create profile with default values
                    profile_data = {
                        "user_id": user_id,
                        "role": UserRole.team_member.value,  # Default role
                        "is_active": True,  # Default active status
                        "created_at": datetime.now().isoformat(),
                        "updated_at": datetime.now().isoformat()
                    }
                    
                    # Insert the profile with preservation validation
                    insert_response = self._create_profile_with_preservation_check(profile_data, preserve_existing)
                    
                    if insert_response and insert_response.data:
                        result.created_profiles += 1
                        result.created_user_ids.append(user_id)
                        logger.info(f"Created profile for user {user_id} with preservation mode: {preserve_existing}")
                    else:
                        result.failed_creations += 1
                        error_msg = f"Failed to create profile for user {user_id}: No data returned"
                        result.errors.append(error_msg)
                        logger.error(error_msg)
                        
                except Exception as user_error:
                    result.failed_creations += 1
                    error_msg = f"Failed to create profile for user {auth_user.get('id', 'unknown')}: {str(user_error)}"
                    result.errors.append(error_msg)
                    logger.error(error_msg)
            
            # Calculate execution time
            end_time = datetime.now()
            result.execution_time = (end_time - start_time).total_seconds()
            
            logger.info(f"Profile creation completed. Created: {result.created_profiles}, "
                       f"Preserved: {result.existing_profiles}, Failed: {result.failed_creations}")
            return result
            
        except Exception as e:
            error_msg = f"Profile creation operation failed: {str(e)}"
            logger.error(error_msg)
            result.errors.append(error_msg)
            result.execution_time = (datetime.now() - start_time).total_seconds()
            raise Exception(error_msg)
    
    def create_profile_for_user(self, user_id: str, role: str = None, is_active: bool = True) -> bool:
        """
        Create a single user profile for a specific user.
        
        Args:
            user_id: The auth.users ID to create a profile for
            role: Role to assign (defaults to team_member)
            is_active: Whether the user should be active
            
        Returns:
            True if profile was created successfully, False otherwise
        """
        try:
            # Check if user exists in auth.users
            auth_user_response = self.client.table("auth.users").select("id").eq("id", user_id).execute()
            if not auth_user_response.data:
                logger.error(f"Auth user {user_id} not found")
                return False
            
            # Check if profile already exists
            existing_profile = self.client.table("user_profiles").select("user_id").eq("user_id", user_id).execute()
            if existing_profile.data:
                logger.info(f"Profile already exists for user {user_id}")
                return True
            
            # Create profile
            profile_data = {
                "user_id": user_id,
                "role": role or UserRole.team_member.value,
                "is_active": is_active,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            }
            
            insert_response = self.client.table("user_profiles").insert(profile_data).execute()
            
            if insert_response.data:
                logger.info(f"Successfully created profile for user {user_id}")
                return True
            else:
                logger.error(f"Failed to create profile for user {user_id}: No data returned")
                return False
                
        except Exception as e:
            logger.error(f"Error creating profile for user {user_id}: {e}")
            return False
    
    def perform_full_sync(self, dry_run: bool = False) -> SyncResult:
        """
        Perform a complete synchronization operation.
        
        Args:
            dry_run: If True, only report what would be done without making changes
            
        Returns:
            SyncResult with complete synchronization details
        """
        result = SyncResult()
        start_time = datetime.now()
        
        try:
            logger.info(f"Starting full synchronization (dry_run={dry_run})")
            
            # Get statistics before sync
            stats_before = self.get_sync_statistics()
            result.total_auth_users = stats_before["total_auth_users"]
            result.existing_profiles = stats_before["total_profiles"]
            
            # Identify missing profiles
            missing_users = self.identify_missing_profiles()
            
            if not missing_users:
                logger.info("No missing profiles found - synchronization complete")
                result.execution_time = (datetime.now() - start_time).total_seconds()
                return result
            
            if dry_run:
                logger.info(f"DRY RUN: Would create {len(missing_users)} profiles")
                result.created_profiles = len(missing_users)
                result.created_user_ids = [user["id"] for user in missing_users]
            else:
                # Create missing profiles
                creation_result = self.create_missing_profiles(missing_users)
                result.created_profiles = creation_result.created_profiles
                result.failed_creations = creation_result.failed_creations
                result.errors.extend(creation_result.errors)
                result.created_user_ids = creation_result.created_user_ids
            
            # Calculate final execution time
            result.execution_time = (datetime.now() - start_time).total_seconds()
            
            # Log summary
            self._log_sync_summary(result, dry_run)
            
            return result
            
        except Exception as e:
            error_msg = f"Full synchronization failed: {str(e)}"
            logger.error(error_msg)
            result.errors.append(error_msg)
            result.execution_time = (datetime.now() - start_time).total_seconds()
            raise Exception(error_msg)
    
    def _log_sync_summary(self, result: SyncResult, dry_run: bool = False):
        """Log a summary of the synchronization operation"""
        mode = "DRY RUN" if dry_run else "EXECUTION"
        logger.info(f"=== SYNC {mode} SUMMARY ===")
        logger.info(f"Total auth users: {result.total_auth_users}")
        logger.info(f"Existing profiles: {result.existing_profiles}")
        logger.info(f"Profiles created: {result.created_profiles}")
        logger.info(f"Failed creations: {result.failed_creations}")
        logger.info(f"Execution time: {result.execution_time:.2f} seconds")
        
        if result.errors:
            logger.warning(f"Errors encountered: {len(result.errors)}")
            for error in result.errors:
                logger.warning(f"  - {error}")
        
        if result.created_user_ids:
            logger.info(f"Created profiles for users: {', '.join(result.created_user_ids[:5])}")
            if len(result.created_user_ids) > 5:
                logger.info(f"  ... and {len(result.created_user_ids) - 5} more")
    
    def generate_sync_report(self, result: SyncResult) -> Dict[str, Any]:
        """
        Generate a detailed synchronization report.
        
        Args:
            result: SyncResult from a synchronization operation
            
        Returns:
            Dictionary containing detailed report information
        """
        report = {
            "timestamp": datetime.now().isoformat(),
            "operation_summary": {
                "total_auth_users": result.total_auth_users,
                "existing_profiles_before": result.existing_profiles,
                "profiles_created": result.created_profiles,
                "failed_creations": result.failed_creations,
                "success_rate": round(
                    (result.created_profiles / (result.created_profiles + result.failed_creations) * 100) 
                    if (result.created_profiles + result.failed_creations) > 0 else 100, 2
                ),
                "execution_time_seconds": result.execution_time
            },
            "created_users": result.created_user_ids,
            "errors": result.errors,
            "recommendations": self._generate_recommendations(result)
        }
        
        return report
    
    def _generate_recommendations(self, result: SyncResult) -> List[str]:
        """Generate recommendations based on sync results"""
        recommendations = []
        
        if result.failed_creations > 0:
            recommendations.append(
                f"Review {result.failed_creations} failed profile creations. "
                "Check database constraints and permissions."
            )
        
        if result.created_profiles > 100:
            recommendations.append(
                "Large number of profiles created. Consider implementing automatic "
                "profile creation triggers to prevent future synchronization needs."
            )
        
        if result.execution_time > 30:
            recommendations.append(
                "Synchronization took longer than expected. Consider running sync "
                "operations during low-traffic periods."
            )
        
        if not result.errors and result.failed_creations == 0:
            recommendations.append(
                "Synchronization completed successfully. Consider setting up "
                "monitoring to detect future sync issues early."
            )
        
        return recommendations

    def _get_existing_profile_with_details(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Get existing profile with full details for preservation validation.
        
        Args:
            user_id: The user ID to check for existing profile
            
        Returns:
            Profile data if exists, None otherwise
        """
        try:
            response = self.client.table("user_profiles").select("*").eq("user_id", user_id).execute()
            if response.data and len(response.data) > 0:
                profile = response.data[0]
                logger.debug(f"Found existing profile for user {user_id}: {profile}")
                return profile
            return None
        except Exception as e:
            logger.warning(f"Error checking existing profile for user {user_id}: {e}")
            return None

    def _create_profile_with_preservation_check(self, profile_data: Dict[str, Any], preserve_existing: bool) -> Any:
        """
        Create profile with additional preservation validation.
        
        Args:
            profile_data: Profile data to insert
            preserve_existing: Whether to preserve existing data
            
        Returns:
            Insert response from database
        """
        user_id = profile_data["user_id"]
        
        try:
            # Double-check for existing profile if preservation is enabled
            if preserve_existing:
                existing_profile = self._get_existing_profile_with_details(user_id)
                if existing_profile:
                    logger.warning(f"Profile creation attempted for user {user_id} but profile already exists. "
                                 f"Preservation mode is enabled, skipping creation.")
                    return None
            
            # Validate profile data before insertion
            if not self._validate_profile_data(profile_data):
                logger.error(f"Profile data validation failed for user {user_id}")
                return None
            
            # Insert the profile
            response = self.client.table("user_profiles").insert(profile_data).execute()
            
            # Verify the insertion was successful
            if response.data and preserve_existing:
                inserted_profile = response.data[0]
                logger.info(f"Successfully created profile for user {user_id} with preservation validation")
                logger.debug(f"Inserted profile: {inserted_profile}")
            
            return response
            
        except Exception as e:
            logger.error(f"Error creating profile with preservation check for user {user_id}: {e}")
            raise

    def _validate_profile_data(self, profile_data: Dict[str, Any]) -> bool:
        """
        Validate profile data before insertion to ensure data integrity.
        
        Args:
            profile_data: Profile data to validate
            
        Returns:
            True if data is valid, False otherwise
        """
        try:
            # Check required fields
            required_fields = ["user_id", "role", "is_active"]
            for field in required_fields:
                if field not in profile_data:
                    logger.error(f"Missing required field: {field}")
                    return False
            
            # Validate user_id format (should be UUID)
            user_id = profile_data["user_id"]
            if not user_id or len(str(user_id).strip()) == 0:
                logger.error("Invalid user_id: empty or None")
                return False
            
            # Validate role
            role = profile_data["role"]
            valid_roles = [role.value for role in UserRole]
            if role not in valid_roles:
                logger.error(f"Invalid role: {role}. Valid roles: {valid_roles}")
                return False
            
            # Validate is_active
            is_active = profile_data["is_active"]
            if not isinstance(is_active, bool):
                logger.error(f"Invalid is_active value: {is_active}. Must be boolean.")
                return False
            
            logger.debug(f"Profile data validation passed for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error validating profile data: {e}")
            return False

    def preserve_existing_profile_data(self, user_id: str, new_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Merge new profile data with existing data, preserving existing values.
        
        Args:
            user_id: User ID to preserve data for
            new_data: New data to merge
            
        Returns:
            Merged data with existing values preserved
        """
        try:
            existing_profile = self._get_existing_profile_with_details(user_id)
            if not existing_profile:
                logger.info(f"No existing profile found for user {user_id}, using new data as-is")
                return new_data
            
            # Create merged data, preserving existing values
            merged_data = new_data.copy()
            
            # Preserve critical fields that shouldn't be overwritten
            preserve_fields = [
                "role", "is_active", "last_login", "deactivated_at", 
                "deactivated_by", "deactivation_reason", "sso_provider", 
                "sso_user_id", "created_at"
            ]
            
            for field in preserve_fields:
                if field in existing_profile and existing_profile[field] is not None:
                    merged_data[field] = existing_profile[field]
                    logger.debug(f"Preserved existing value for {field}: {existing_profile[field]}")
            
            # Always update the updated_at timestamp
            merged_data["updated_at"] = datetime.now().isoformat()
            
            logger.info(f"Successfully merged profile data for user {user_id}, "
                       f"preserved {len([f for f in preserve_fields if f in existing_profile])} existing fields")
            
            return merged_data
            
        except Exception as e:
            logger.error(f"Error preserving existing profile data for user {user_id}: {e}")
            # Return new data as fallback
            return new_data

    def get_preservation_report(self, user_ids: List[str]) -> Dict[str, Any]:
        """
        Generate a report on data preservation for specified users.
        
        Args:
            user_ids: List of user IDs to check
            
        Returns:
            Report with preservation status for each user
        """
        report = {
            "timestamp": datetime.now().isoformat(),
            "total_users_checked": len(user_ids),
            "users_with_profiles": 0,
            "users_without_profiles": 0,
            "preservation_details": {},
            "errors": []
        }
        
        try:
            for user_id in user_ids:
                try:
                    existing_profile = self._get_existing_profile_with_details(user_id)
                    if existing_profile:
                        report["users_with_profiles"] += 1
                        report["preservation_details"][user_id] = {
                            "has_profile": True,
                            "role": existing_profile.get("role"),
                            "is_active": existing_profile.get("is_active"),
                            "created_at": existing_profile.get("created_at"),
                            "last_updated": existing_profile.get("updated_at"),
                            "custom_fields": {
                                k: v for k, v in existing_profile.items() 
                                if k not in ["id", "user_id", "role", "is_active", "created_at", "updated_at"]
                                and v is not None
                            }
                        }
                    else:
                        report["users_without_profiles"] += 1
                        report["preservation_details"][user_id] = {
                            "has_profile": False,
                            "would_create_with_defaults": True
                        }
                        
                except Exception as user_error:
                    error_msg = f"Error checking user {user_id}: {str(user_error)}"
                    report["errors"].append(error_msg)
                    logger.error(error_msg)
            
            logger.info(f"Generated preservation report for {len(user_ids)} users: "
                       f"{report['users_with_profiles']} with profiles, "
                       f"{report['users_without_profiles']} without profiles")
            
        except Exception as e:
            error_msg = f"Error generating preservation report: {str(e)}"
            report["errors"].append(error_msg)
            logger.error(error_msg)
        
        return report


# Convenience function for external use
def sync_users(dry_run: bool = False) -> Dict[str, Any]:
    """
    Convenience function to perform user synchronization.
    
    Args:
        dry_run: If True, only report what would be done
        
    Returns:
        Dictionary with synchronization results
    """
    try:
        service = UserSynchronizationService()
        result = service.perform_full_sync(dry_run=dry_run)
        return service.generate_sync_report(result)
    except Exception as e:
        return {
            "error": str(e),
            "timestamp": datetime.now().isoformat(),
            "operation_summary": {
                "total_auth_users": 0,
                "existing_profiles_before": 0,
                "profiles_created": 0,
                "failed_creations": 0,
                "success_rate": 0,
                "execution_time_seconds": 0
            }
        }


def get_sync_status() -> Dict[str, Any]:
    """
    Get current synchronization status.
    
    Returns:
        Dictionary with current sync statistics
    """
    try:
        service = UserSynchronizationService()
        return service.get_sync_statistics()
    except Exception as e:
        return {
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }