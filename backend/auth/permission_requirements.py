"""
Permission Requirements Module

This module provides the PermissionRequirement class for expressing complex
permission logic with AND/OR combinations and nested requirements.

Features:
- AND logic: Require ALL of specified permissions
- OR logic: Require ANY of specified permissions
- Nested combinations: Complex requirements like (A AND B) OR (C AND D)
- Integration with error handler for detailed missing permission reporting

Requirements: 1.4 - Permission Combination Logic
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional, Set, Union, Tuple
from uuid import UUID
import logging

from .rbac import Permission
from .enhanced_rbac_models import PermissionContext

logger = logging.getLogger(__name__)


class RequirementType(str, Enum):
    """Types of permission requirements."""
    ALL = "all"  # AND logic - all permissions required
    ANY = "any"  # OR logic - any permission required
    SINGLE = "single"  # Single permission
    COMPLEX = "complex"  # Nested requirements with OR logic


@dataclass
class PermissionCheckResult:
    """
    Result of a permission requirement check.
    
    Contains detailed information about which permissions were satisfied
    and which were missing, useful for error reporting.
    """
    satisfied: bool
    requirement_type: RequirementType
    required_permissions: List[Permission] = field(default_factory=list)
    satisfied_permissions: List[Permission] = field(default_factory=list)
    missing_permissions: List[Permission] = field(default_factory=list)
    nested_results: List['PermissionCheckResult'] = field(default_factory=list)
    description: str = ""
    
    def get_all_missing_permissions(self) -> Set[Permission]:
        """
        Get all missing permissions from this result and nested results.
        
        Returns:
            Set of all missing permissions
        """
        missing = set(self.missing_permissions)
        for nested in self.nested_results:
            if not nested.satisfied:
                missing.update(nested.get_all_missing_permissions())
        return missing
    
    def get_human_readable_error(self) -> str:
        """
        Generate a human-readable error message for this result.
        
        Returns:
            Human-readable error message
        """
        if self.satisfied:
            return "Permission requirements satisfied"
        
        if self.requirement_type == RequirementType.SINGLE:
            return f"Missing permission: {self.missing_permissions[0].value if self.missing_permissions else 'unknown'}"
        
        if self.requirement_type == RequirementType.ALL:
            missing_names = [p.value for p in self.missing_permissions]
            return f"Missing required permissions (ALL required): {', '.join(missing_names)}"
        
        if self.requirement_type == RequirementType.ANY:
            required_names = [p.value for p in self.required_permissions]
            return f"Missing permissions (at least ONE required): {', '.join(required_names)}"
        
        if self.requirement_type == RequirementType.COMPLEX:
            # For complex requirements, show which sub-requirements failed
            failed_descriptions = []
            for nested in self.nested_results:
                if not nested.satisfied:
                    failed_descriptions.append(nested.get_human_readable_error())
            return f"Complex requirement not satisfied. Failed conditions: {'; '.join(failed_descriptions)}"
        
        return "Permission requirements not satisfied"


class PermissionRequirement(ABC):
    """
    Abstract base class for permission requirements.
    
    Represents a complex permission requirement that can be evaluated
    against a set of user permissions.
    
    Requirements: 1.4 - Permission combination logic
    """
    
    @abstractmethod
    def check(self, user_permissions: Set[Permission]) -> PermissionCheckResult:
        """
        Check if the requirement is satisfied by the given permissions.
        
        Args:
            user_permissions: Set of permissions the user has
            
        Returns:
            PermissionCheckResult with detailed information
        """
        pass
    
    @abstractmethod
    def get_all_permissions(self) -> Set[Permission]:
        """
        Get all permissions referenced by this requirement.
        
        Returns:
            Set of all permissions in this requirement
        """
        pass
    
    @abstractmethod
    def describe(self) -> str:
        """
        Get a human-readable description of this requirement.
        
        Returns:
            Description string
        """
        pass
    
    @staticmethod
    def single(permission: Permission) -> 'SinglePermissionRequirement':
        """
        Create a requirement for a single permission.
        
        Args:
            permission: The required permission
            
        Returns:
            SinglePermissionRequirement instance
        """
        return SinglePermissionRequirement(permission)
    
    @staticmethod
    def all_of(*permissions: Permission) -> 'AllOfRequirement':
        """
        Create a requirement that requires ALL of the specified permissions (AND logic).
        
        Args:
            *permissions: Permissions that are all required
            
        Returns:
            AllOfRequirement instance
            
        Requirements: 1.4 - AND logic for permission combinations
        """
        return AllOfRequirement(list(permissions))
    
    @staticmethod
    def any_of(*permissions: Permission) -> 'AnyOfRequirement':
        """
        Create a requirement that requires ANY of the specified permissions (OR logic).
        
        Args:
            *permissions: Permissions where at least one is required
            
        Returns:
            AnyOfRequirement instance
            
        Requirements: 1.4 - OR logic for permission combinations
        """
        return AnyOfRequirement(list(permissions))
    
    @staticmethod
    def complex(*requirements: 'PermissionRequirement') -> 'ComplexRequirement':
        """
        Create a complex requirement that combines multiple requirements with OR logic.
        
        This allows for nested combinations like (A AND B) OR (C AND D).
        
        Args:
            *requirements: Sub-requirements where at least one must be satisfied
            
        Returns:
            ComplexRequirement instance
            
        Requirements: 1.4 - Complex permission requirements for multi-step operations
        """
        return ComplexRequirement(list(requirements))
    
    @staticmethod
    def all_requirements(*requirements: 'PermissionRequirement') -> 'AllRequirementsRequirement':
        """
        Create a requirement that requires ALL sub-requirements to be satisfied (AND logic).
        
        This allows for nested combinations like (A OR B) AND (C OR D).
        
        Args:
            *requirements: Sub-requirements that must all be satisfied
            
        Returns:
            AllRequirementsRequirement instance
            
        Requirements: 1.4 - Complex permission requirements for multi-step operations
        """
        return AllRequirementsRequirement(list(requirements))


class SinglePermissionRequirement(PermissionRequirement):
    """
    Requirement for a single permission.
    
    The simplest form of permission requirement.
    """
    
    def __init__(self, permission: Permission):
        """
        Initialize with a single permission.
        
        Args:
            permission: The required permission
        """
        self.permission = permission
    
    def check(self, user_permissions: Set[Permission]) -> PermissionCheckResult:
        """Check if the user has this permission."""
        has_permission = self.permission in user_permissions
        
        return PermissionCheckResult(
            satisfied=has_permission,
            requirement_type=RequirementType.SINGLE,
            required_permissions=[self.permission],
            satisfied_permissions=[self.permission] if has_permission else [],
            missing_permissions=[] if has_permission else [self.permission],
            description=self.describe()
        )
    
    def get_all_permissions(self) -> Set[Permission]:
        """Get the single permission."""
        return {self.permission}
    
    def describe(self) -> str:
        """Describe this requirement."""
        return f"Requires: {self.permission.value}"


class AllOfRequirement(PermissionRequirement):
    """
    Requirement that requires ALL of the specified permissions (AND logic).
    
    All permissions must be present for the requirement to be satisfied.
    
    Requirements: 1.4 - AND logic for permission combinations
    """
    
    def __init__(self, permissions: List[Permission]):
        """
        Initialize with a list of required permissions.
        
        Args:
            permissions: List of permissions that are all required
        """
        self.permissions = permissions
    
    def check(self, user_permissions: Set[Permission]) -> PermissionCheckResult:
        """Check if the user has ALL of these permissions."""
        satisfied_perms = []
        missing_perms = []
        
        for perm in self.permissions:
            if perm in user_permissions:
                satisfied_perms.append(perm)
            else:
                missing_perms.append(perm)
        
        all_satisfied = len(missing_perms) == 0
        
        return PermissionCheckResult(
            satisfied=all_satisfied,
            requirement_type=RequirementType.ALL,
            required_permissions=list(self.permissions),
            satisfied_permissions=satisfied_perms,
            missing_permissions=missing_perms,
            description=self.describe()
        )
    
    def get_all_permissions(self) -> Set[Permission]:
        """Get all permissions in this requirement."""
        return set(self.permissions)
    
    def describe(self) -> str:
        """Describe this requirement."""
        perm_names = [p.value for p in self.permissions]
        return f"Requires ALL of: {', '.join(perm_names)}"


class AnyOfRequirement(PermissionRequirement):
    """
    Requirement that requires ANY of the specified permissions (OR logic).
    
    At least one permission must be present for the requirement to be satisfied.
    
    Requirements: 1.4 - OR logic for permission combinations
    """
    
    def __init__(self, permissions: List[Permission]):
        """
        Initialize with a list of permissions where at least one is required.
        
        Args:
            permissions: List of permissions where at least one is required
        """
        self.permissions = permissions
    
    def check(self, user_permissions: Set[Permission]) -> PermissionCheckResult:
        """Check if the user has ANY of these permissions."""
        satisfied_perms = []
        missing_perms = []
        
        for perm in self.permissions:
            if perm in user_permissions:
                satisfied_perms.append(perm)
            else:
                missing_perms.append(perm)
        
        any_satisfied = len(satisfied_perms) > 0
        
        return PermissionCheckResult(
            satisfied=any_satisfied,
            requirement_type=RequirementType.ANY,
            required_permissions=list(self.permissions),
            satisfied_permissions=satisfied_perms,
            # For ANY, only report missing if none were satisfied
            missing_permissions=missing_perms if not any_satisfied else [],
            description=self.describe()
        )
    
    def get_all_permissions(self) -> Set[Permission]:
        """Get all permissions in this requirement."""
        return set(self.permissions)
    
    def describe(self) -> str:
        """Describe this requirement."""
        perm_names = [p.value for p in self.permissions]
        return f"Requires ANY of: {', '.join(perm_names)}"


class ComplexRequirement(PermissionRequirement):
    """
    Complex requirement that combines multiple sub-requirements with OR logic.
    
    At least one sub-requirement must be satisfied for the overall requirement
    to be satisfied. This enables nested combinations like (A AND B) OR (C AND D).
    
    Requirements: 1.4 - Complex permission requirements for multi-step operations
    """
    
    def __init__(self, requirements: List[PermissionRequirement]):
        """
        Initialize with a list of sub-requirements.
        
        Args:
            requirements: List of sub-requirements where at least one must be satisfied
        """
        self.requirements = requirements
    
    def check(self, user_permissions: Set[Permission]) -> PermissionCheckResult:
        """Check if ANY of the sub-requirements is satisfied."""
        nested_results = []
        any_satisfied = False
        
        for req in self.requirements:
            result = req.check(user_permissions)
            nested_results.append(result)
            if result.satisfied:
                any_satisfied = True
        
        # Collect all permissions from all requirements
        all_required = set()
        for req in self.requirements:
            all_required.update(req.get_all_permissions())
        
        return PermissionCheckResult(
            satisfied=any_satisfied,
            requirement_type=RequirementType.COMPLEX,
            required_permissions=list(all_required),
            satisfied_permissions=[],  # Complex requirements track this in nested results
            missing_permissions=[],  # Complex requirements track this in nested results
            nested_results=nested_results,
            description=self.describe()
        )
    
    def get_all_permissions(self) -> Set[Permission]:
        """Get all permissions from all sub-requirements."""
        all_perms = set()
        for req in self.requirements:
            all_perms.update(req.get_all_permissions())
        return all_perms
    
    def describe(self) -> str:
        """Describe this requirement."""
        sub_descriptions = [f"({req.describe()})" for req in self.requirements]
        return f"Requires ONE OF: {' OR '.join(sub_descriptions)}"


class AllRequirementsRequirement(PermissionRequirement):
    """
    Requirement that requires ALL sub-requirements to be satisfied (AND logic).
    
    All sub-requirements must be satisfied for the overall requirement
    to be satisfied. This enables nested combinations like (A OR B) AND (C OR D).
    
    Requirements: 1.4 - Complex permission requirements for multi-step operations
    """
    
    def __init__(self, requirements: List[PermissionRequirement]):
        """
        Initialize with a list of sub-requirements.
        
        Args:
            requirements: List of sub-requirements that must all be satisfied
        """
        self.requirements = requirements
    
    def check(self, user_permissions: Set[Permission]) -> PermissionCheckResult:
        """Check if ALL of the sub-requirements are satisfied."""
        nested_results = []
        all_satisfied = True
        
        for req in self.requirements:
            result = req.check(user_permissions)
            nested_results.append(result)
            if not result.satisfied:
                all_satisfied = False
        
        # Collect all permissions from all requirements
        all_required = set()
        for req in self.requirements:
            all_required.update(req.get_all_permissions())
        
        return PermissionCheckResult(
            satisfied=all_satisfied,
            requirement_type=RequirementType.ALL,
            required_permissions=list(all_required),
            satisfied_permissions=[],  # Complex requirements track this in nested results
            missing_permissions=[],  # Complex requirements track this in nested results
            nested_results=nested_results,
            description=self.describe()
        )
    
    def get_all_permissions(self) -> Set[Permission]:
        """Get all permissions from all sub-requirements."""
        all_perms = set()
        for req in self.requirements:
            all_perms.update(req.get_all_permissions())
        return all_perms
    
    def describe(self) -> str:
        """Describe this requirement."""
        sub_descriptions = [f"({req.describe()})" for req in self.requirements]
        return f"Requires ALL OF: {' AND '.join(sub_descriptions)}"


# =============================================================================
# Convenience Functions for Common Permission Patterns
# =============================================================================

def require_read_and_write(resource: str) -> PermissionRequirement:
    """
    Create a requirement for both read and write permissions on a resource.
    
    Args:
        resource: Resource name (e.g., "project", "portfolio")
        
    Returns:
        AllOfRequirement for read and write permissions
    """
    read_perm = Permission(f"{resource}_read")
    write_perm = Permission(f"{resource}_update")
    return PermissionRequirement.all_of(read_perm, write_perm)


def require_full_access(resource: str) -> PermissionRequirement:
    """
    Create a requirement for full CRUD access on a resource.
    
    Args:
        resource: Resource name (e.g., "project", "portfolio")
        
    Returns:
        AllOfRequirement for create, read, update, delete permissions
    """
    perms = [
        Permission(f"{resource}_create"),
        Permission(f"{resource}_read"),
        Permission(f"{resource}_update"),
        Permission(f"{resource}_delete"),
    ]
    return PermissionRequirement.all_of(*perms)


def require_manager_or_admin() -> PermissionRequirement:
    """
    Create a requirement for manager-level or admin access.
    
    Returns:
        ComplexRequirement that accepts portfolio_manager, project_manager, or admin
    """
    return PermissionRequirement.complex(
        PermissionRequirement.single(Permission.user_manage),  # Admin
        PermissionRequirement.all_of(
            Permission.portfolio_read,
            Permission.portfolio_update
        ),  # Portfolio manager
        PermissionRequirement.all_of(
            Permission.project_read,
            Permission.project_update
        ),  # Project manager
    )


# =============================================================================
# Error Classes for Permission Requirement Failures
# =============================================================================

class PermissionRequirementError(Exception):
    """
    Exception raised when a permission requirement is not satisfied.
    
    Contains detailed information about the requirement and what was missing.
    """
    
    def __init__(
        self,
        user_id: Union[UUID, str],
        requirement: PermissionRequirement,
        result: PermissionCheckResult,
        context: Optional[PermissionContext] = None,
        message: Optional[str] = None
    ):
        """
        Initialize PermissionRequirementError.
        
        Args:
            user_id: The user's UUID or string ID
            requirement: The requirement that was not satisfied
            result: The detailed check result
            context: Optional permission context
            message: Optional custom error message
        """
        self.user_id = user_id if isinstance(user_id, UUID) else UUID(str(user_id)) if user_id else None
        self.requirement = requirement
        self.result = result
        self.context = context
        
        default_message = result.get_human_readable_error()
        self.message = message or default_message
        super().__init__(self.message)
    
    def to_dict(self) -> dict:
        """Convert error to dictionary for logging/serialization."""
        return {
            "user_id": str(self.user_id) if self.user_id else None,
            "requirement_description": self.requirement.describe(),
            "satisfied": self.result.satisfied,
            "missing_permissions": [p.value for p in self.result.get_all_missing_permissions()],
            "context": self.context.model_dump() if self.context else None,
            "message": self.message
        }
