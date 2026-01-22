"""
Workflow Validation Service

Provides comprehensive validation for workflow definitions, including:
- Approver validation against RBAC system
- Sequential and parallel approval pattern validation
- Step configuration validation
- Trigger validation

Requirements: 1.1, 1.2, 1.3
"""

import logging
from typing import List, Dict, Any, Optional, Tuple
from uuid import UUID

from supabase import Client

from models.workflow import (
    WorkflowDefinition,
    WorkflowStep,
    WorkflowTrigger,
    ApprovalType,
    StepType,
    WorkflowStatus
)
from auth.rbac import UserRole, Permission, rbac

logger = logging.getLogger(__name__)


class WorkflowValidationError(Exception):
    """Custom exception for workflow validation errors"""
    def __init__(self, message: str, field: Optional[str] = None, details: Optional[Dict[str, Any]] = None):
        self.message = message
        self.field = field
        self.details = details or {}
        super().__init__(self.message)


class WorkflowValidationService:
    """
    Service for validating workflow definitions.
    
    Validates workflow definitions against business rules and RBAC constraints,
    ensuring that workflows are properly configured before activation.
    """
    
    def __init__(self, db: Client):
        """
        Initialize validation service with database client.
        
        Args:
            db: Supabase client instance
        """
        if not db:
            raise ValueError("Database client is required")
        
        self.db = db
        self.rbac = rbac
    
    async def validate_workflow_definition(
        self,
        workflow: WorkflowDefinition,
        validate_approvers: bool = True
    ) -> Tuple[bool, List[str]]:
        """
        Validate a complete workflow definition.
        
        Args:
            workflow: WorkflowDefinition to validate
            validate_approvers: Whether to validate approvers against RBAC (default True)
            
        Returns:
            Tuple of (is_valid, list_of_errors)
            
        Requirements: 1.1, 1.2, 1.3
        """
        errors = []
        
        try:
            # Validate basic workflow properties
            basic_errors = self._validate_basic_properties(workflow)
            errors.extend(basic_errors)
            
            # Validate workflow steps
            step_errors = await self._validate_steps(workflow.steps, validate_approvers)
            errors.extend(step_errors)
            
            # Validate triggers
            trigger_errors = self._validate_triggers(workflow.triggers)
            errors.extend(trigger_errors)
            
            # Validate step ordering and patterns
            pattern_errors = self._validate_approval_patterns(workflow.steps)
            errors.extend(pattern_errors)
            
            is_valid = len(errors) == 0
            
            if is_valid:
                logger.info(f"Workflow '{workflow.name}' validation passed")
            else:
                logger.warning(f"Workflow '{workflow.name}' validation failed with {len(errors)} errors")
            
            return is_valid, errors
            
        except Exception as e:
            logger.error(f"Error during workflow validation: {e}")
            errors.append(f"Validation error: {str(e)}")
            return False, errors
    
    def _validate_basic_properties(self, workflow: WorkflowDefinition) -> List[str]:
        """
        Validate basic workflow properties.
        
        Args:
            workflow: WorkflowDefinition to validate
            
        Returns:
            List of validation errors
        """
        errors = []
        
        # Validate name
        if not workflow.name or len(workflow.name.strip()) == 0:
            errors.append("Workflow name is required")
        elif len(workflow.name) > 255:
            errors.append("Workflow name must be 255 characters or less")
        
        # Validate steps exist
        if not workflow.steps or len(workflow.steps) == 0:
            errors.append("Workflow must have at least one step")
        
        # Validate version
        if workflow.version < 1:
            errors.append("Workflow version must be 1 or greater")
        
        return errors
    
    async def _validate_steps(
        self,
        steps: List[WorkflowStep],
        validate_approvers: bool
    ) -> List[str]:
        """
        Validate workflow steps.
        
        Args:
            steps: List of workflow steps to validate
            validate_approvers: Whether to validate approvers against RBAC
            
        Returns:
            List of validation errors
            
        Requirements: 1.2, 1.3
        """
        errors = []
        
        if not steps:
            return ["At least one workflow step is required"]
        
        # Validate step ordering
        expected_order = list(range(len(steps)))
        actual_order = sorted([step.step_order for step in steps])
        
        if actual_order != expected_order:
            errors.append(
                f"Steps must have sequential order starting from 0. "
                f"Expected {expected_order}, got {actual_order}"
            )
        
        # Validate each step
        for i, step in enumerate(steps):
            step_errors = await self._validate_single_step(step, i, validate_approvers)
            errors.extend(step_errors)
        
        return errors
    
    async def _validate_single_step(
        self,
        step: WorkflowStep,
        step_index: int,
        validate_approvers: bool
    ) -> List[str]:
        """
        Validate a single workflow step.
        
        Args:
            step: WorkflowStep to validate
            step_index: Index of the step in the workflow
            validate_approvers: Whether to validate approvers against RBAC
            
        Returns:
            List of validation errors
            
        Requirements: 1.2, 1.3
        """
        errors = []
        step_prefix = f"Step {step_index} ('{step.name}')"
        
        # Validate step name
        if not step.name or len(step.name.strip()) == 0:
            errors.append(f"{step_prefix}: Step name is required")
        elif len(step.name) > 255:
            errors.append(f"{step_prefix}: Step name must be 255 characters or less")
        
        # Validate step order matches index
        if step.step_order != step_index:
            errors.append(
                f"{step_prefix}: Step order {step.step_order} does not match position {step_index}"
            )
        
        # Validate approval steps have approvers
        if step.step_type == StepType.APPROVAL:
            if not step.approvers and not step.approver_roles:
                errors.append(
                    f"{step_prefix}: Approval step must have at least one approver or approver role"
                )
            
            # Validate approvers if requested
            if validate_approvers:
                approver_errors = await self._validate_approvers(step, step_prefix)
                errors.extend(approver_errors)
            
            # Validate approval type configuration
            approval_type_errors = self._validate_approval_type(step, step_prefix)
            errors.extend(approval_type_errors)
        
        # Validate timeout
        if step.timeout_hours is not None:
            if step.timeout_hours < 1:
                errors.append(f"{step_prefix}: Timeout must be at least 1 hour")
            elif step.timeout_hours > 8760:  # 1 year
                errors.append(f"{step_prefix}: Timeout cannot exceed 8760 hours (1 year)")
        
        return errors
    
    async def _validate_approvers(
        self,
        step: WorkflowStep,
        step_prefix: str
    ) -> List[str]:
        """
        Validate approvers against RBAC system.
        
        Args:
            step: WorkflowStep to validate
            step_prefix: Prefix for error messages
            
        Returns:
            List of validation errors
            
        Requirements: 1.3 - Approver validation against existing RBAC system
        """
        errors = []
        
        # Validate explicit approvers
        if step.approvers:
            for approver_id in step.approvers:
                try:
                    # Check if user exists and has appropriate permissions
                    user_valid = await self._validate_user_as_approver(approver_id)
                    if not user_valid:
                        errors.append(
                            f"{step_prefix}: User {approver_id} is not valid or lacks approval permissions"
                        )
                except Exception as e:
                    errors.append(
                        f"{step_prefix}: Error validating approver {approver_id}: {str(e)}"
                    )
        
        # Validate approver roles
        if step.approver_roles:
            for role_name in step.approver_roles:
                try:
                    # Validate role exists
                    role_valid = await self._validate_role(role_name)
                    if not role_valid:
                        errors.append(
                            f"{step_prefix}: Role '{role_name}' is not valid"
                        )
                    
                    # Check if role has approval permissions
                    role_has_approval_perm = await self._check_role_approval_permissions(role_name)
                    if not role_has_approval_perm:
                        errors.append(
                            f"{step_prefix}: Role '{role_name}' lacks approval permissions"
                        )
                except Exception as e:
                    errors.append(
                        f"{step_prefix}: Error validating role '{role_name}': {str(e)}"
                    )
        
        return errors
    
    async def _validate_user_as_approver(self, user_id: UUID) -> bool:
        """
        Validate that a user exists and has appropriate approval permissions.
        
        Args:
            user_id: User ID to validate
            
        Returns:
            True if user is valid as approver, False otherwise
            
        Requirements: 1.3
        """
        try:
            # Check if user exists in auth.users
            response = self.db.table("user_profiles").select("id").eq("id", str(user_id)).execute()
            
            if not response.data:
                logger.warning(f"User {user_id} not found in user_profiles")
                return False
            
            # Check if user has any approval-related permissions
            user_permissions = await self.rbac.get_user_permissions(str(user_id))
            
            # Define approval-related permissions
            approval_permissions = [
                Permission.change_approve,
                Permission.pmr_approve,
                Permission.project_update,
                Permission.portfolio_update,
                Permission.financial_update
            ]
            
            has_approval_permission = any(
                perm in user_permissions for perm in approval_permissions
            )
            
            if not has_approval_permission:
                logger.warning(f"User {user_id} lacks approval permissions")
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error validating user {user_id} as approver: {e}")
            return False
    
    async def _validate_role(self, role_name: str) -> bool:
        """
        Validate that a role exists in the system.
        
        Args:
            role_name: Role name to validate
            
        Returns:
            True if role exists, False otherwise
            
        Requirements: 1.3
        """
        try:
            # Check if role exists in UserRole enum
            try:
                UserRole(role_name)
                return True
            except ValueError:
                pass
            
            # Check if role exists in database
            response = self.db.table("roles").select("id").eq("name", role_name).execute()
            
            if not response.data:
                logger.warning(f"Role '{role_name}' not found")
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error validating role '{role_name}': {e}")
            return False
    
    async def _check_role_approval_permissions(self, role_name: str) -> bool:
        """
        Check if a role has approval permissions.
        
        Args:
            role_name: Role name to check
            
        Returns:
            True if role has approval permissions, False otherwise
            
        Requirements: 1.3
        """
        try:
            # Check UserRole enum first
            try:
                user_role = UserRole(role_name)
                # Get default permissions for this role
                from auth.rbac import DEFAULT_ROLE_PERMISSIONS
                role_permissions = DEFAULT_ROLE_PERMISSIONS.get(user_role, [])
                
                # Check for approval permissions
                approval_permissions = [
                    Permission.change_approve,
                    Permission.pmr_approve,
                    Permission.project_update,
                    Permission.portfolio_update,
                    Permission.financial_update
                ]
                
                return any(perm in role_permissions for perm in approval_permissions)
            except ValueError:
                pass
            
            # Check database role permissions
            response = self.db.table("roles").select("permissions").eq("name", role_name).execute()
            
            if not response.data:
                return False
            
            role_permissions = response.data[0].get("permissions", [])
            
            # Check for approval-related permissions
            approval_permission_strings = [
                "change_approve",
                "pmr_approve",
                "project_update",
                "portfolio_update",
                "financial_update"
            ]
            
            return any(perm in role_permissions for perm in approval_permission_strings)
            
        except Exception as e:
            logger.error(f"Error checking role approval permissions for '{role_name}': {e}")
            return False
    
    def _validate_approval_type(self, step: WorkflowStep, step_prefix: str) -> List[str]:
        """
        Validate approval type configuration.
        
        Args:
            step: WorkflowStep to validate
            step_prefix: Prefix for error messages
            
        Returns:
            List of validation errors
            
        Requirements: 1.2 - Sequential and parallel approval patterns
        """
        errors = []
        
        # Validate quorum configuration
        if step.approval_type == ApprovalType.QUORUM:
            if step.quorum_count is None:
                errors.append(
                    f"{step_prefix}: QUORUM approval type requires quorum_count to be set"
                )
            elif step.quorum_count < 1:
                errors.append(
                    f"{step_prefix}: quorum_count must be at least 1"
                )
            else:
                # Check if quorum count is achievable
                total_approvers = len(step.approvers) + len(step.approver_roles)
                if step.quorum_count > total_approvers:
                    errors.append(
                        f"{step_prefix}: quorum_count ({step.quorum_count}) exceeds "
                        f"total number of approvers ({total_approvers})"
                    )
        else:
            # Non-quorum types should not have quorum_count set
            if step.quorum_count is not None:
                errors.append(
                    f"{step_prefix}: quorum_count should only be set for QUORUM approval type"
                )
        
        # Validate majority configuration
        if step.approval_type == ApprovalType.MAJORITY:
            total_approvers = len(step.approvers) + len(step.approver_roles)
            if total_approvers < 2:
                errors.append(
                    f"{step_prefix}: MAJORITY approval type requires at least 2 approvers"
                )
        
        return errors
    
    def _validate_approval_patterns(self, steps: List[WorkflowStep]) -> List[str]:
        """
        Validate approval patterns (sequential and parallel).
        
        Args:
            steps: List of workflow steps
            
        Returns:
            List of validation errors
            
        Requirements: 1.2 - Sequential and parallel approval patterns
        """
        errors = []
        
        # Sequential pattern validation
        # Steps are executed in order (step_order), so sequential is the default
        # Validate that steps form a valid sequence
        
        approval_steps = [s for s in steps if s.step_type == StepType.APPROVAL]
        
        if not approval_steps:
            errors.append("Workflow must have at least one approval step")
        
        # Parallel pattern validation
        # Multiple approvers in a single step represent parallel approvals
        for step in approval_steps:
            total_approvers = len(step.approvers) + len(step.approver_roles)
            
            if total_approvers > 1:
                # This is a parallel approval step
                # Validate that approval type is appropriate
                if step.approval_type == ApprovalType.ANY and total_approvers > 10:
                    errors.append(
                        f"Step {step.step_order} ('{step.name}'): "
                        f"ANY approval type with {total_approvers} approvers may cause "
                        f"race conditions. Consider using ALL or MAJORITY."
                    )
        
        return errors
    
    def _validate_triggers(self, triggers: List[WorkflowTrigger]) -> List[str]:
        """
        Validate workflow triggers.
        
        Args:
            triggers: List of workflow triggers
            
        Returns:
            List of validation errors
        """
        errors = []
        
        # Validate each trigger
        for i, trigger in enumerate(triggers):
            trigger_prefix = f"Trigger {i} ({trigger.trigger_type})"
            
            # Validate trigger type
            if not trigger.trigger_type or len(trigger.trigger_type.strip()) == 0:
                errors.append(f"{trigger_prefix}: Trigger type is required")
            
            # Validate known trigger types
            known_trigger_types = [
                "budget_change",
                "milestone_update",
                "resource_allocation",
                "risk_threshold",
                "manual"
            ]
            
            if trigger.trigger_type not in known_trigger_types:
                errors.append(
                    f"{trigger_prefix}: Unknown trigger type. "
                    f"Known types: {', '.join(known_trigger_types)}"
                )
            
            # Validate threshold values for threshold-based triggers
            if trigger.trigger_type in ["budget_change", "risk_threshold"]:
                if not trigger.threshold_values:
                    errors.append(
                        f"{trigger_prefix}: Threshold values required for {trigger.trigger_type}"
                    )
                elif "percentage" in trigger.threshold_values:
                    percentage = trigger.threshold_values["percentage"]
                    if not isinstance(percentage, (int, float)) or percentage <= 0:
                        errors.append(
                            f"{trigger_prefix}: Threshold percentage must be a positive number"
                        )
        
        return errors
    
    async def validate_approver_availability(
        self,
        workflow: WorkflowDefinition
    ) -> Tuple[bool, List[str]]:
        """
        Validate that all approvers in the workflow are available and active.
        
        Args:
            workflow: WorkflowDefinition to validate
            
        Returns:
            Tuple of (all_available, list_of_unavailable_approvers)
            
        Requirements: 1.3
        """
        unavailable = []
        
        try:
            for step in workflow.steps:
                if step.step_type != StepType.APPROVAL:
                    continue
                
                # Check explicit approvers
                for approver_id in step.approvers:
                    try:
                        # Check if user is active
                        response = self.db.table("user_profiles").select(
                            "id, full_name"
                        ).eq("id", str(approver_id)).execute()
                        
                        if not response.data:
                            unavailable.append(
                                f"Step {step.step_order}: User {approver_id} not found"
                            )
                    except Exception as e:
                        unavailable.append(
                            f"Step {step.step_order}: Error checking user {approver_id}: {str(e)}"
                        )
                
                # Check role-based approvers
                for role_name in step.approver_roles:
                    try:
                        # Get users with this role
                        response = self.db.table("user_roles").select(
                            "user_id, roles(name)"
                        ).eq("roles.name", role_name).execute()
                        
                        if not response.data or len(response.data) == 0:
                            unavailable.append(
                                f"Step {step.step_order}: No users found with role '{role_name}'"
                            )
                    except Exception as e:
                        unavailable.append(
                            f"Step {step.step_order}: Error checking role '{role_name}': {str(e)}"
                        )
            
            all_available = len(unavailable) == 0
            return all_available, unavailable
            
        except Exception as e:
            logger.error(f"Error validating approver availability: {e}")
            return False, [f"Validation error: {str(e)}"]


# Singleton instance
_validation_service: Optional[WorkflowValidationService] = None


def get_workflow_validation_service(db: Client = None) -> WorkflowValidationService:
    """
    Get or create the workflow validation service singleton.
    
    Args:
        db: Supabase client instance (required on first call)
        
    Returns:
        WorkflowValidationService instance
    """
    global _validation_service
    
    if _validation_service is None:
        if db is None:
            raise ValueError("Database client required for first initialization")
        _validation_service = WorkflowValidationService(db)
    
    return _validation_service
