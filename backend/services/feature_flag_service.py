"""
Feature flag service for gradual rollout and user-based access control
"""

from typing import Optional, List, Dict, Any
from uuid import UUID
import hashlib
from datetime import datetime

from models.feature_flags import (
    FeatureFlagCreate,
    FeatureFlagUpdate,
    FeatureFlagResponse,
    FeatureFlagCheckResponse,
    FeatureFlagStatus,
    RolloutStrategy
)


class FeatureFlagService:
    """Service for managing feature flags and access control"""
    
    def __init__(self, supabase_client):
        self.supabase = supabase_client
    
    def create_feature_flag(
        self,
        flag_data: FeatureFlagCreate,
        created_by: UUID
    ) -> FeatureFlagResponse:
        """
        Create a new feature flag.
        
        Args:
            flag_data: Feature flag configuration
            created_by: User ID creating the flag
            
        Returns:
            Created feature flag
        """
        # Check if feature flag with this name already exists
        existing = self.supabase.table("feature_flags").select("id").eq(
            "name", flag_data.name
        ).execute()
        
        if existing.data:
            raise ValueError(f"Feature flag '{flag_data.name}' already exists")
        
        # Prepare data for insertion
        insert_data = {
            "name": flag_data.name,
            "description": flag_data.description,
            "status": flag_data.status.value,
            "rollout_strategy": flag_data.rollout_strategy.value,
            "rollout_percentage": flag_data.rollout_percentage,
            "allowed_user_ids": [str(uid) for uid in flag_data.allowed_user_ids] if flag_data.allowed_user_ids else None,
            "allowed_roles": flag_data.allowed_roles,
            "metadata": flag_data.metadata or {},
            "created_by": str(created_by)
        }
        
        # Insert into database
        result = self.supabase.table("feature_flags").insert(insert_data).execute()
        
        if not result.data:
            raise Exception("Failed to create feature flag")
        
        return self._map_to_response(result.data[0])
    
    def update_feature_flag(
        self,
        flag_id: UUID,
        flag_data: FeatureFlagUpdate
    ) -> FeatureFlagResponse:
        """
        Update an existing feature flag.
        
        Args:
            flag_id: Feature flag ID
            flag_data: Updated configuration
            
        Returns:
            Updated feature flag
        """
        # Build update data
        update_data = {}
        
        if flag_data.description is not None:
            update_data["description"] = flag_data.description
        if flag_data.status is not None:
            update_data["status"] = flag_data.status.value
        if flag_data.rollout_strategy is not None:
            update_data["rollout_strategy"] = flag_data.rollout_strategy.value
        if flag_data.rollout_percentage is not None:
            update_data["rollout_percentage"] = flag_data.rollout_percentage
        if flag_data.allowed_user_ids is not None:
            update_data["allowed_user_ids"] = [str(uid) for uid in flag_data.allowed_user_ids]
        if flag_data.allowed_roles is not None:
            update_data["allowed_roles"] = flag_data.allowed_roles
        if flag_data.metadata is not None:
            update_data["metadata"] = flag_data.metadata
        
        if not update_data:
            raise ValueError("No fields to update")
        
        update_data["updated_at"] = datetime.now().isoformat()
        
        # Update in database
        result = self.supabase.table("feature_flags").update(update_data).eq(
            "id", str(flag_id)
        ).execute()
        
        if not result.data:
            raise ValueError(f"Feature flag {flag_id} not found")
        
        return self._map_to_response(result.data[0])
    
    def get_feature_flag(self, flag_id: UUID) -> Optional[FeatureFlagResponse]:
        """Get a feature flag by ID"""
        result = self.supabase.table("feature_flags").select("*").eq(
            "id", str(flag_id)
        ).execute()
        
        if not result.data:
            return None
        
        return self._map_to_response(result.data[0])
    
    def get_feature_flag_by_name(self, name: str) -> Optional[FeatureFlagResponse]:
        """Get a feature flag by name"""
        result = self.supabase.table("feature_flags").select("*").eq(
            "name", name
        ).execute()
        
        if not result.data:
            return None
        
        return self._map_to_response(result.data[0])
    
    def list_feature_flags(
        self,
        status: Optional[FeatureFlagStatus] = None
    ) -> List[FeatureFlagResponse]:
        """List all feature flags, optionally filtered by status"""
        query = self.supabase.table("feature_flags").select("*")
        
        if status:
            query = query.eq("status", status.value)
        
        result = query.execute()
        
        return [self._map_to_response(flag) for flag in result.data]
    
    def delete_feature_flag(self, flag_id: UUID) -> bool:
        """Delete a feature flag"""
        result = self.supabase.table("feature_flags").delete().eq(
            "id", str(flag_id)
        ).execute()
        
        return bool(result.data)
    
    def check_feature_enabled(
        self,
        feature_name: str,
        user_id: Optional[UUID] = None,
        user_roles: Optional[List[str]] = None
    ) -> FeatureFlagCheckResponse:
        """
        Check if a feature is enabled for a specific user.
        
        This method implements the core feature flag logic:
        1. Check if feature flag exists
        2. Check if feature is globally disabled
        3. Apply rollout strategy (all users, percentage, user list, role-based)
        
        Args:
            feature_name: Name of the feature to check
            user_id: Optional user ID for user-specific checks
            user_roles: Optional user roles for role-based checks
            
        Returns:
            Feature flag check response with enabled status and reason
        """
        # Get feature flag
        flag = self.get_feature_flag_by_name(feature_name)
        
        # If flag doesn't exist, default to disabled
        if not flag:
            return FeatureFlagCheckResponse(
                feature_name=feature_name,
                is_enabled=False,
                reason="Feature flag not found"
            )
        
        # If flag is disabled, return false
        if flag.status == FeatureFlagStatus.DISABLED:
            return FeatureFlagCheckResponse(
                feature_name=feature_name,
                is_enabled=False,
                reason="Feature is disabled",
                metadata=flag.metadata
            )
        
        # If flag is deprecated, return false
        if flag.status == FeatureFlagStatus.DEPRECATED:
            return FeatureFlagCheckResponse(
                feature_name=feature_name,
                is_enabled=False,
                reason="Feature is deprecated",
                metadata=flag.metadata
            )
        
        # Apply rollout strategy
        if flag.rollout_strategy == RolloutStrategy.ALL_USERS:
            return FeatureFlagCheckResponse(
                feature_name=feature_name,
                is_enabled=True,
                reason="Feature enabled for all users",
                metadata=flag.metadata
            )
        
        if flag.rollout_strategy == RolloutStrategy.USER_LIST:
            if not user_id:
                return FeatureFlagCheckResponse(
                    feature_name=feature_name,
                    is_enabled=False,
                    reason="User ID required for user list strategy"
                )
            
            if flag.allowed_user_ids and user_id in flag.allowed_user_ids:
                return FeatureFlagCheckResponse(
                    feature_name=feature_name,
                    is_enabled=True,
                    reason="User in allowed list",
                    metadata=flag.metadata
                )
            else:
                return FeatureFlagCheckResponse(
                    feature_name=feature_name,
                    is_enabled=False,
                    reason="User not in allowed list"
                )
        
        if flag.rollout_strategy == RolloutStrategy.ROLE_BASED:
            if not user_roles:
                return FeatureFlagCheckResponse(
                    feature_name=feature_name,
                    is_enabled=False,
                    reason="User roles required for role-based strategy"
                )
            
            if flag.allowed_roles:
                # Check if user has any of the allowed roles
                has_allowed_role = any(role in flag.allowed_roles for role in user_roles)
                if has_allowed_role:
                    return FeatureFlagCheckResponse(
                        feature_name=feature_name,
                        is_enabled=True,
                        reason="User has allowed role",
                        metadata=flag.metadata
                    )
                else:
                    return FeatureFlagCheckResponse(
                        feature_name=feature_name,
                        is_enabled=False,
                        reason="User does not have allowed role"
                    )
            else:
                return FeatureFlagCheckResponse(
                    feature_name=feature_name,
                    is_enabled=False,
                    reason="No allowed roles configured"
                )
        
        if flag.rollout_strategy == RolloutStrategy.PERCENTAGE:
            if not user_id:
                return FeatureFlagCheckResponse(
                    feature_name=feature_name,
                    is_enabled=False,
                    reason="User ID required for percentage rollout"
                )
            
            if flag.rollout_percentage is None:
                return FeatureFlagCheckResponse(
                    feature_name=feature_name,
                    is_enabled=False,
                    reason="Rollout percentage not configured"
                )
            
            # Use consistent hashing to determine if user is in rollout percentage
            user_hash = self._hash_user_for_percentage(str(user_id), feature_name)
            is_enabled = user_hash < flag.rollout_percentage
            
            return FeatureFlagCheckResponse(
                feature_name=feature_name,
                is_enabled=is_enabled,
                reason=f"User {'in' if is_enabled else 'not in'} {flag.rollout_percentage}% rollout",
                metadata=flag.metadata
            )
        
        # Default to disabled
        return FeatureFlagCheckResponse(
            feature_name=feature_name,
            is_enabled=False,
            reason="Unknown rollout strategy"
        )
    
    def _hash_user_for_percentage(self, user_id: str, feature_name: str) -> int:
        """
        Generate a consistent hash for percentage-based rollout.
        
        This ensures the same user always gets the same result for a feature,
        providing a stable rollout experience.
        
        Returns:
            Integer between 0 and 99
        """
        # Combine user ID and feature name for consistent hashing
        hash_input = f"{user_id}:{feature_name}"
        hash_bytes = hashlib.sha256(hash_input.encode()).digest()
        # Convert first 4 bytes to integer and mod by 100
        hash_int = int.from_bytes(hash_bytes[:4], byteorder='big')
        return hash_int % 100
    
    def _map_to_response(self, data: Dict[str, Any]) -> FeatureFlagResponse:
        """Map database record to response model"""
        return FeatureFlagResponse(
            id=UUID(data["id"]),
            name=data["name"],
            description=data["description"],
            status=FeatureFlagStatus(data["status"]),
            rollout_strategy=RolloutStrategy(data["rollout_strategy"]),
            rollout_percentage=data.get("rollout_percentage"),
            allowed_user_ids=[UUID(uid) for uid in data["allowed_user_ids"]] if data.get("allowed_user_ids") else None,
            allowed_roles=data.get("allowed_roles"),
            metadata=data.get("metadata"),
            created_at=datetime.fromisoformat(data["created_at"]),
            updated_at=datetime.fromisoformat(data["updated_at"]),
            created_by=UUID(data["created_by"])
        )
