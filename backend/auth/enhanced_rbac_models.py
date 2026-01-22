"""
Enhanced RBAC Models for Context-Aware Permission Checking

This module provides Pydantic models for the enhanced RBAC system that supports:
- Scoped permission checking (project, portfolio, organization)
- Role assignments with scope support
- Time-based permissions with expiration

Requirements: 1.1, 1.2, 7.1
"""

from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field, field_validator, ConfigDict
from enum import Enum


class ScopeType(str, Enum):
    """Scope types for role assignments and permission checking"""
    GLOBAL = "global"
    ORGANIZATION = "organization"
    PORTFOLIO = "portfolio"
    PROJECT = "project"


class PermissionContext(BaseModel):
    """
    Context model for scoped permission checking.
    
    Provides context information for evaluating permissions based on:
    - Project-specific access
    - Portfolio-level access
    - Organization-level access
    - Resource-specific access
    
    Requirements: 7.1 - Context-aware permission evaluation
    """
    project_id: Optional[UUID] = Field(
        default=None,
        description="Project ID for project-scoped permission checks"
    )
    portfolio_id: Optional[UUID] = Field(
        default=None,
        description="Portfolio ID for portfolio-scoped permission checks"
    )
    resource_id: Optional[UUID] = Field(
        default=None,
        description="Resource ID for resource-specific permission checks"
    )
    organization_id: Optional[UUID] = Field(
        default=None,
        description="Organization ID for organization-scoped permission checks"
    )
    
    def get_scope_type(self) -> ScopeType:
        """
        Determine the most specific scope type based on context.
        
        Returns the most specific scope type that has a value set,
        in order of specificity: project > portfolio > organization > global
        """
        if self.project_id is not None:
            return ScopeType.PROJECT
        elif self.portfolio_id is not None:
            return ScopeType.PORTFOLIO
        elif self.organization_id is not None:
            return ScopeType.ORGANIZATION
        return ScopeType.GLOBAL
    
    def get_scope_id(self) -> Optional[UUID]:
        """
        Get the scope ID for the most specific scope type.
        
        Returns the ID corresponding to the most specific scope type.
        """
        scope_type = self.get_scope_type()
        if scope_type == ScopeType.PROJECT:
            return self.project_id
        elif scope_type == ScopeType.PORTFOLIO:
            return self.portfolio_id
        elif scope_type == ScopeType.ORGANIZATION:
            return self.organization_id
        return None
    
    def is_global(self) -> bool:
        """Check if this is a global (unscoped) context."""
        return self.get_scope_type() == ScopeType.GLOBAL
    
    def to_cache_key(self) -> str:
        """
        Generate a cache key for this context.
        
        Used for caching permission results based on context.
        """
        parts = []
        if self.organization_id:
            parts.append(f"org:{self.organization_id}")
        if self.portfolio_id:
            parts.append(f"port:{self.portfolio_id}")
        if self.project_id:
            parts.append(f"proj:{self.project_id}")
        if self.resource_id:
            parts.append(f"res:{self.resource_id}")
        return ":".join(parts) if parts else "global"
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "project_id": "123e4567-e89b-12d3-a456-426614174000",
                "portfolio_id": "123e4567-e89b-12d3-a456-426614174001",
                "organization_id": "123e4567-e89b-12d3-a456-426614174002"
            }
        }
    )


class RoleAssignment(BaseModel):
    """
    Model for role assignments with scope support.
    
    Supports:
    - Global role assignments (no scope)
    - Organization-scoped assignments
    - Portfolio-scoped assignments
    - Project-scoped assignments
    - Time-based permissions with expiration
    
    Requirements: 1.1, 1.2, 5.4 - Granular role assignment support
    """
    id: Optional[UUID] = Field(
        default=None,
        description="Unique identifier for the role assignment"
    )
    user_id: UUID = Field(
        ...,
        description="User ID for the role assignment"
    )
    role_id: UUID = Field(
        ...,
        description="Role ID being assigned"
    )
    scope_type: Optional[ScopeType] = Field(
        default=None,
        description="Type of scope for this assignment (project, portfolio, organization, or None for global)"
    )
    scope_id: Optional[UUID] = Field(
        default=None,
        description="ID of the scope entity (project_id, portfolio_id, or organization_id)"
    )
    assigned_by: UUID = Field(
        ...,
        description="User ID of the person who made this assignment"
    )
    assigned_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp when the role was assigned"
    )
    expires_at: Optional[datetime] = Field(
        default=None,
        description="Optional expiration timestamp for time-based permissions"
    )
    is_active: bool = Field(
        default=True,
        description="Whether this role assignment is currently active"
    )
    
    @field_validator('scope_id')
    @classmethod
    def validate_scope_id(cls, v, info):
        """Validate that scope_id is provided when scope_type is set."""
        scope_type = info.data.get('scope_type')
        if scope_type is not None and scope_type != ScopeType.GLOBAL and v is None:
            raise ValueError(f"scope_id is required when scope_type is {scope_type}")
        return v
    
    def is_expired(self) -> bool:
        """Check if this role assignment has expired."""
        if self.expires_at is None:
            return False
        return datetime.now(timezone.utc) > self.expires_at
    
    def is_valid(self) -> bool:
        """Check if this role assignment is currently valid (active and not expired)."""
        return self.is_active and not self.is_expired()
    
    def matches_context(self, context: Optional[PermissionContext]) -> bool:
        """
        Check if this role assignment applies to the given context.
        
        A role assignment matches a context if:
        - The assignment is global (no scope), OR
        - The assignment's scope matches or is a parent of the context's scope
        
        Args:
            context: The permission context to check against
            
        Returns:
            True if this assignment applies to the context
        """
        # Global assignments always match
        if self.scope_type is None or self.scope_type == ScopeType.GLOBAL:
            return True
        
        # No context means global check - only global assignments match
        if context is None:
            return False
        
        # Check scope hierarchy
        if self.scope_type == ScopeType.ORGANIZATION:
            return context.organization_id == self.scope_id
        
        if self.scope_type == ScopeType.PORTFOLIO:
            return context.portfolio_id == self.scope_id
        
        if self.scope_type == ScopeType.PROJECT:
            return context.project_id == self.scope_id
        
        return False
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "123e4567-e89b-12d3-a456-426614174000",
                "role_id": "123e4567-e89b-12d3-a456-426614174001",
                "scope_type": "project",
                "scope_id": "123e4567-e89b-12d3-a456-426614174002",
                "assigned_by": "123e4567-e89b-12d3-a456-426614174003",
                "assigned_at": "2024-01-15T10:30:00Z",
                "expires_at": "2024-12-31T23:59:59Z",
                "is_active": True
            }
        }
    )


class RoleAssignmentRequest(BaseModel):
    """Request model for creating a new role assignment."""
    user_id: UUID
    role_id: UUID
    scope_type: Optional[ScopeType] = None
    scope_id: Optional[UUID] = None
    expires_at: Optional[datetime] = None


class RoleAssignmentResponse(BaseModel):
    """Response model for role assignment operations."""
    id: UUID
    user_id: UUID
    role_id: UUID
    role_name: Optional[str] = None
    scope_type: Optional[ScopeType] = None
    scope_id: Optional[UUID] = None
    assigned_by: UUID
    assigned_at: datetime
    expires_at: Optional[datetime] = None
    is_active: bool


class EffectiveRole(BaseModel):
    """
    Model representing an effective role for a user in a given context.
    
    Includes the role information along with how it was derived
    (global assignment, inherited from portfolio, etc.)
    """
    role_id: UUID
    role_name: str
    permissions: List[str]
    source_type: ScopeType = Field(
        description="The scope type from which this role was derived"
    )
    source_id: Optional[UUID] = Field(
        default=None,
        description="The scope ID from which this role was derived"
    )
    is_inherited: bool = Field(
        default=False,
        description="Whether this role was inherited from a parent scope"
    )


class UserPermissionsResponse(BaseModel):
    """Response model for user permissions queries."""
    user_id: UUID
    effective_roles: List[EffectiveRole]
    permissions: List[str]
    context: Optional[PermissionContext] = None


class PermissionCheckRequest(BaseModel):
    """Request model for permission check operations."""
    permission: str
    context: Optional[PermissionContext] = None


class PermissionCheckResponse(BaseModel):
    """Response model for permission check operations."""
    has_permission: bool
    permission: str
    context: Optional[PermissionContext] = None
    source_role: Optional[str] = Field(
        default=None,
        description="The role that granted this permission, if any"
    )
