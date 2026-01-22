"""
Error Handling Integration for Monte Carlo Components.

This module integrates comprehensive error handling into all Monte Carlo components,
providing consistent error management, recovery strategies, and user-friendly messages.
"""

import logging
from typing import Optional, Dict, Any, Callable, List
from functools import wraps

from .error_handling import (
    MonteCarloError, ValidationError, ComputationError, DataAccessError,
    ExternalSystemError, ConfigurationError, ResourceError, ConvergenceError,
    DistributionError, CorrelationError, ErrorHandler, ErrorRecoveryManager,
    ErrorContext, ErrorSeverity, ErrorCategory, RetryStrategy, FallbackStrategy,
    DegradedModeStrategy, create_user_friendly_message, get_global_recovery_manager
)
from .models import ValidationResult

logger = logging.getLogger(__name__)


# Component-specific error handlers
_component_handlers: Dict[str, ErrorHandler] = {}


def get_component_error_handler(component_name: str) -> ErrorHandler:
    """Get or create an error handler for a component."""
    if component_name not in _component_handlers:
        _component_handlers[component_name] = ErrorHandler(component_name)
    return _component_handlers[component_name]


# Decorator for Monte Carlo component methods

def with_error_handling(
    component_name: str,
    operation_name: Optional[str] = None,
    default_return: Any = None,
    reraise: bool = True,
    recovery_enabled: bool = True
):
    """
    Decorator to add comprehensive error handling to Monte Carlo component methods.
    
    Args:
        component_name: Name of the component (e.g., "engine", "analyzer")
        operation_name: Optional operation name (defaults to function name)
        default_return: Default value to return on error if not reraising
        reraise: Whether to re-raise errors after handling
        recovery_enabled: Whether to attempt error recovery
    """
    def decorator(func: Callable) -> Callable:
        error_handler = get_component_error_handler(component_name)
        recovery_manager = get_global_recovery_manager() if recovery_enabled else None
        
        @wraps(func)
        def wrapper(*args, **kwargs):
            op_name = operation_name or func.__name__
            
            with ErrorContext(
                component_name=component_name,
                operation_name=op_name,
                recovery_manager=recovery_manager,
                suppress_errors=not reraise
            ):
                try:
                    return func(*args, **kwargs)
                except MonteCarloError:
                    # Already a Monte Carlo error, just re-raise
                    raise
                except ValueError as e:
                    # Convert ValueError to ValidationError
                    raise ValidationError(str(e), original_exception=e)
                except TypeError as e:
                    # Convert TypeError to ValidationError
                    raise ValidationError(f"Invalid data type: {str(e)}", original_exception=e)
                except KeyError as e:
                    # Convert KeyError to DataAccessError
                    raise DataAccessError(f"Missing required data: {str(e)}", original_exception=e)
                except ZeroDivisionError as e:
                    # Convert ZeroDivisionError to ComputationError
                    raise ComputationError("Division by zero in calculation", original_exception=e)
                except MemoryError as e:
                    # Convert MemoryError to ResourceError
                    raise ResourceError("Insufficient memory", resource_type="memory", original_exception=e)
                except Exception as e:
                    # Generic error handling
                    logger.error(f"Unexpected error in {component_name}.{op_name}: {str(e)}", exc_info=True)
                    raise MonteCarloError(
                        f"Unexpected error in {op_name}: {str(e)}",
                        original_exception=e,
                        severity=ErrorSeverity.HIGH
                    )
        
        return wrapper
    return decorator


# Validation helpers with error handling

def validate_with_error_handling(
    validation_func: Callable,
    error_message: str,
    field_name: Optional[str] = None
) -> ValidationResult:
    """
    Execute a validation function with error handling.
    
    Args:
        validation_func: Function that performs validation
        error_message: Error message if validation fails
        field_name: Optional field name for validation error
        
    Returns:
        ValidationResult
        
    Raises:
        ValidationError: If validation fails
    """
    try:
        result = validation_func()
        if isinstance(result, ValidationResult):
            if not result.is_valid:
                raise ValidationError(
                    error_message,
                    field=field_name,
                    context={"errors": result.errors, "warnings": result.warnings}
                )
            return result
        elif isinstance(result, bool):
            if not result:
                raise ValidationError(error_message, field=field_name)
            return ValidationResult(is_valid=True)
        else:
            return ValidationResult(is_valid=True)
    except ValidationError:
        raise
    except Exception as e:
        raise ValidationError(
            f"{error_message}: {str(e)}",
            field=field_name,
            original_exception=e
        )


def safe_computation(
    computation_func: Callable,
    computation_type: str,
    fallback_value: Any = None,
    reraise: bool = True
) -> Any:
    """
    Execute a computation with error handling and optional fallback.
    
    Args:
        computation_func: Function that performs computation
        computation_type: Type of computation for error context
        fallback_value: Value to return if computation fails and not reraising
        reraise: Whether to re-raise errors
        
    Returns:
        Computation result or fallback value
        
    Raises:
        ComputationError: If computation fails and reraise is True
    """
    try:
        return computation_func()
    except ComputationError:
        if reraise:
            raise
        logger.warning(f"Computation failed, using fallback value: {computation_type}")
        return fallback_value
    except Exception as e:
        error = ComputationError(
            f"Computation failed: {str(e)}",
            computation_type=computation_type,
            original_exception=e
        )
        if reraise:
            raise error
        logger.warning(f"Computation failed, using fallback value: {computation_type}")
        return fallback_value


def safe_data_access(
    access_func: Callable,
    data_source: str,
    fallback_value: Any = None,
    retry_count: int = 3
) -> Any:
    """
    Execute a data access operation with retry logic and fallback.
    
    Args:
        access_func: Function that accesses data
        data_source: Name of data source for error context
        fallback_value: Value to return if access fails
        retry_count: Number of retry attempts
        
    Returns:
        Data or fallback value
        
    Raises:
        DataAccessError: If all retries fail and no fallback provided
    """
    recovery_manager = get_global_recovery_manager()
    retry_strategy = RetryStrategy(max_retries=retry_count)
    
    try:
        return access_func()
    except Exception as e:
        error = DataAccessError(
            f"Data access failed: {str(e)}",
            data_source=data_source,
            original_exception=e
        )
        
        # Attempt recovery with retry
        success, result = recovery_manager.attempt_recovery(
            error,
            operation=access_func
        )
        
        if success:
            return result
        elif fallback_value is not None:
            logger.warning(f"Data access failed, using fallback value: {data_source}")
            return fallback_value
        else:
            raise error


def safe_external_call(
    call_func: Callable,
    system_name: str,
    fallback_func: Optional[Callable] = None,
    degraded_mode_func: Optional[Callable] = None
) -> Any:
    """
    Execute an external system call with graceful degradation.
    
    Args:
        call_func: Function that calls external system
        system_name: Name of external system
        fallback_func: Optional fallback function
        degraded_mode_func: Optional degraded mode function
        
    Returns:
        Result from call, fallback, or degraded mode
        
    Raises:
        ExternalSystemError: If all recovery strategies fail
    """
    recovery_manager = get_global_recovery_manager()
    
    try:
        return call_func()
    except Exception as e:
        error = ExternalSystemError(
            f"External system call failed: {str(e)}",
            system=system_name,
            original_exception=e,
            recoverable=True
        )
        
        # Try fallback strategy first
        if fallback_func:
            fallback_strategy = FallbackStrategy(fallback_method=fallback_func)
            try:
                logger.info(f"Using fallback for {system_name}")
                return fallback_strategy.recover(error)
            except Exception as fallback_error:
                logger.warning(f"Fallback failed for {system_name}: {str(fallback_error)}")
        
        # Try degraded mode
        if degraded_mode_func:
            degraded_strategy = DegradedModeStrategy(degraded_mode_func)
            try:
                logger.warning(f"Entering degraded mode for {system_name}")
                return degraded_strategy.recover(error)
            except Exception as degraded_error:
                logger.error(f"Degraded mode failed for {system_name}: {str(degraded_error)}")
        
        # All recovery strategies failed
        raise error


# Context managers for specific operations

class SimulationErrorContext:
    """Context manager for simulation execution with comprehensive error handling."""
    
    def __init__(
        self,
        simulation_id: str,
        risk_count: int,
        iteration_count: int
    ):
        self.simulation_id = simulation_id
        self.risk_count = risk_count
        self.iteration_count = iteration_count
        self.error_handler = get_component_error_handler("simulation")
        self.errors: List[MonteCarloError] = []
    
    def __enter__(self):
        logger.info(f"Starting simulation {self.simulation_id} with {self.risk_count} risks, {self.iteration_count} iterations")
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is None:
            logger.info(f"Simulation {self.simulation_id} completed successfully")
            return False
        
        # Handle simulation-specific errors
        context = {
            "simulation_id": self.simulation_id,
            "risk_count": self.risk_count,
            "iteration_count": self.iteration_count
        }
        
        if isinstance(exc_val, ConvergenceError):
            logger.warning(f"Simulation {self.simulation_id} convergence issue: {exc_val.message}")
            self.errors.append(exc_val)
            # Don't suppress convergence errors - they should be handled by caller
            return False
        
        elif isinstance(exc_val, ResourceError):
            logger.error(f"Simulation {self.simulation_id} resource error: {exc_val.message}")
            self.errors.append(exc_val)
            return False
        
        elif isinstance(exc_val, ComputationError):
            logger.error(f"Simulation {self.simulation_id} computation error: {exc_val.message}")
            self.errors.append(exc_val)
            return False
        
        else:
            # Generic error handling
            error = self.error_handler.handle_error(exc_val, context=context, reraise=False)
            self.errors.append(error)
            return False


class DistributionValidationContext:
    """Context manager for distribution validation with error handling."""
    
    def __init__(self, distribution_type: str, risk_id: Optional[str] = None):
        self.distribution_type = distribution_type
        self.risk_id = risk_id
        self.error_handler = get_component_error_handler("distribution_validation")
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is None:
            return False
        
        context = {
            "distribution_type": self.distribution_type,
            "risk_id": self.risk_id
        }
        
        if isinstance(exc_val, (ValueError, TypeError)):
            # Convert to DistributionError
            error = DistributionError(
                str(exc_val),
                distribution_type=self.distribution_type,
                original_exception=exc_val
            )
            self.error_handler.handle_error(error, context=context, reraise=True)
        
        return False


# Utility functions for error reporting

def create_error_report(errors: List[MonteCarloError]) -> Dict[str, Any]:
    """
    Create a comprehensive error report from a list of errors.
    
    Args:
        errors: List of MonteCarloError instances
        
    Returns:
        Dictionary containing error report
    """
    if not errors:
        return {"status": "success", "error_count": 0}
    
    # Group errors by category
    errors_by_category: Dict[str, List[Dict[str, Any]]] = {}
    for error in errors:
        category = error.category.value
        if category not in errors_by_category:
            errors_by_category[category] = []
        errors_by_category[category].append(error.to_dict())
    
    # Count by severity
    severity_counts = {
        "low": 0,
        "medium": 0,
        "high": 0,
        "critical": 0
    }
    for error in errors:
        severity_counts[error.severity.value] += 1
    
    # Identify recoverable vs non-recoverable
    recoverable_count = sum(1 for e in errors if e.recoverable)
    non_recoverable_count = len(errors) - recoverable_count
    
    return {
        "status": "error",
        "error_count": len(errors),
        "errors_by_category": errors_by_category,
        "severity_counts": severity_counts,
        "recoverable_errors": recoverable_count,
        "non_recoverable_errors": non_recoverable_count,
        "user_messages": [error.get_user_message() for error in errors[:5]],  # First 5 user messages
        "requires_attention": severity_counts["high"] > 0 or severity_counts["critical"] > 0
    }


def get_component_health_status() -> Dict[str, Any]:
    """
    Get health status of all Monte Carlo components based on error history.
    
    Returns:
        Dictionary containing component health information
    """
    health_status = {}
    
    for component_name, error_handler in _component_handlers.items():
        stats = error_handler.get_error_statistics()
        
        # Determine health status based on error count
        if stats["total_errors"] == 0:
            status = "healthy"
        elif stats["total_errors"] < 10:
            status = "warning"
        else:
            status = "unhealthy"
        
        health_status[component_name] = {
            "status": status,
            "total_errors": stats["total_errors"],
            "recent_errors": stats["recent_errors"],
            "last_errors": stats["error_history"][-3:] if stats["error_history"] else []
        }
    
    # Overall system health
    unhealthy_components = [name for name, status in health_status.items() if status["status"] == "unhealthy"]
    warning_components = [name for name, status in health_status.items() if status["status"] == "warning"]
    
    if unhealthy_components:
        overall_status = "unhealthy"
    elif warning_components:
        overall_status = "warning"
    else:
        overall_status = "healthy"
    
    return {
        "overall_status": overall_status,
        "components": health_status,
        "unhealthy_components": unhealthy_components,
        "warning_components": warning_components
    }


# Initialize default recovery strategies

def initialize_default_recovery_strategies():
    """Initialize default recovery strategies for common error scenarios."""
    recovery_manager = get_global_recovery_manager()
    
    # Data access errors: retry with exponential backoff
    recovery_manager.register_strategy(
        ErrorCategory.DATA_ACCESS,
        RetryStrategy(max_retries=3, base_delay=1.0)
    )
    
    # External system errors: retry then fallback
    recovery_manager.register_strategy(
        ErrorCategory.EXTERNAL_SYSTEM,
        RetryStrategy(max_retries=2, base_delay=0.5)
    )
    
    # Computation errors: fallback to simplified computation
    recovery_manager.register_strategy(
        ErrorCategory.COMPUTATION,
        FallbackStrategy(fallback_value=None)
    )
    
    logger.info("Initialized default recovery strategies for Monte Carlo system")


# Initialize on module import
initialize_default_recovery_strategies()
