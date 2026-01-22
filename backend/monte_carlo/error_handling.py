"""
Comprehensive Error Handling for Monte Carlo Risk Simulation System.

This module provides:
- Custom exception hierarchy for different error types
- Error recovery strategies
- Logging and monitoring integration
- User-friendly error messages
- Graceful degradation patterns
"""

import logging
import traceback
from typing import Optional, Dict, Any, Callable, List
from datetime import datetime
from enum import Enum
import functools

# Configure logging
logger = logging.getLogger(__name__)


class ErrorSeverity(Enum):
    """Severity levels for errors."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ErrorCategory(Enum):
    """Categories of errors for classification."""
    VALIDATION = "validation"
    COMPUTATION = "computation"
    DATA_ACCESS = "data_access"
    EXTERNAL_SYSTEM = "external_system"
    CONFIGURATION = "configuration"
    RESOURCE = "resource"
    BUSINESS_LOGIC = "business_logic"


# Base Exception Classes

class MonteCarloError(Exception):
    """Base exception for all Monte Carlo system errors."""
    
    def __init__(
        self,
        message: str,
        category: ErrorCategory = ErrorCategory.BUSINESS_LOGIC,
        severity: ErrorSeverity = ErrorSeverity.MEDIUM,
        recoverable: bool = True,
        context: Optional[Dict[str, Any]] = None,
        original_exception: Optional[Exception] = None
    ):
        self.message = message
        self.category = category
        self.severity = severity
        self.recoverable = recoverable
        self.context = context or {}
        self.original_exception = original_exception
        self.timestamp = datetime.now()
        super().__init__(self.message)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert error to dictionary for logging/API responses."""
        return {
            "error_type": self.__class__.__name__,
            "message": self.message,
            "category": self.category.value,
            "severity": self.severity.value,
            "recoverable": self.recoverable,
            "timestamp": self.timestamp.isoformat(),
            "context": self.context,
            "original_error": str(self.original_exception) if self.original_exception else None
        }
    
    def get_user_message(self) -> str:
        """Get user-friendly error message."""
        return self.message


class ValidationError(MonteCarloError):
    """Error raised when input validation fails."""
    
    def __init__(self, message: str, field: Optional[str] = None, **kwargs):
        super().__init__(
            message,
            category=ErrorCategory.VALIDATION,
            severity=ErrorSeverity.LOW,
            recoverable=True,
            **kwargs
        )
        self.field = field
        if field:
            self.context["field"] = field
    
    def get_user_message(self) -> str:
        if self.field:
            return f"Invalid {self.field}: {self.message}"
        return f"Validation error: {self.message}"


class ComputationError(MonteCarloError):
    """Error raised during statistical computations."""
    
    def __init__(self, message: str, computation_type: Optional[str] = None, **kwargs):
        super().__init__(
            message,
            category=ErrorCategory.COMPUTATION,
            severity=ErrorSeverity.HIGH,
            recoverable=False,
            **kwargs
        )
        self.computation_type = computation_type
        if computation_type:
            self.context["computation_type"] = computation_type
    
    def get_user_message(self) -> str:
        return f"Computation failed: {self.message}. Please check your input parameters."


class DataAccessError(MonteCarloError):
    """Error raised when data access fails."""
    
    def __init__(self, message: str, data_source: Optional[str] = None, **kwargs):
        super().__init__(
            message,
            category=ErrorCategory.DATA_ACCESS,
            severity=ErrorSeverity.MEDIUM,
            recoverable=True,
            **kwargs
        )
        self.data_source = data_source
        if data_source:
            self.context["data_source"] = data_source
    
    def get_user_message(self) -> str:
        if self.data_source:
            return f"Unable to access {self.data_source}. Please try again later."
        return "Data access error. Please try again later."


class ExternalSystemError(MonteCarloError):
    """Error raised when external system integration fails."""
    
    def __init__(self, message: str, system: Optional[str] = None, **kwargs):
        super().__init__(
            message,
            category=ErrorCategory.EXTERNAL_SYSTEM,
            severity=ErrorSeverity.MEDIUM,
            recoverable=True,
            **kwargs
        )
        self.system = system
        if system:
            self.context["system"] = system
    
    def get_user_message(self) -> str:
        if self.system:
            return f"External system '{self.system}' is temporarily unavailable. The system will continue with reduced functionality."
        return "External service temporarily unavailable. Some features may be limited."


class ConfigurationError(MonteCarloError):
    """Error raised when configuration is invalid."""
    
    def __init__(self, message: str, config_key: Optional[str] = None, **kwargs):
        super().__init__(
            message,
            category=ErrorCategory.CONFIGURATION,
            severity=ErrorSeverity.HIGH,
            recoverable=False,
            **kwargs
        )
        self.config_key = config_key
        if config_key:
            self.context["config_key"] = config_key
    
    def get_user_message(self) -> str:
        return f"Configuration error: {self.message}. Please contact system administrator."


class ResourceError(MonteCarloError):
    """Error raised when system resources are insufficient."""
    
    def __init__(self, message: str, resource_type: Optional[str] = None, **kwargs):
        super().__init__(
            message,
            category=ErrorCategory.RESOURCE,
            severity=ErrorSeverity.HIGH,
            recoverable=True,
            **kwargs
        )
        self.resource_type = resource_type
        if resource_type:
            self.context["resource_type"] = resource_type
    
    def get_user_message(self) -> str:
        return f"System resources insufficient: {self.message}. Please reduce simulation complexity or try again later."


class ConvergenceError(ComputationError):
    """Error raised when simulation fails to converge."""
    
    def __init__(self, message: str, iterations_completed: Optional[int] = None, **kwargs):
        super().__init__(
            message,
            computation_type="convergence",
            **kwargs
        )
        self.iterations_completed = iterations_completed
        if iterations_completed:
            self.context["iterations_completed"] = iterations_completed
    
    def get_user_message(self) -> str:
        return f"Simulation did not converge: {self.message}. Consider increasing iteration count or reviewing risk parameters."


class DistributionError(ValidationError):
    """Error raised when probability distribution is invalid."""
    
    def __init__(self, message: str, distribution_type: Optional[str] = None, **kwargs):
        super().__init__(
            message,
            field="probability_distribution",
            **kwargs
        )
        self.distribution_type = distribution_type
        if distribution_type:
            self.context["distribution_type"] = distribution_type
    
    def get_user_message(self) -> str:
        if self.distribution_type:
            return f"Invalid {self.distribution_type} distribution: {self.message}"
        return f"Invalid probability distribution: {self.message}"


class CorrelationError(ValidationError):
    """Error raised when correlation matrix is invalid."""
    
    def __init__(self, message: str, **kwargs):
        super().__init__(
            message,
            field="correlation_matrix",
            **kwargs
        )
    
    def get_user_message(self) -> str:
        return f"Invalid correlation matrix: {self.message}. Please check correlation coefficients."


# Error Handler Class

class ErrorHandler:
    """Centralized error handling and logging."""
    
    def __init__(self, component_name: str):
        self.component_name = component_name
        self.logger = logging.getLogger(f"monte_carlo.{component_name}")
        self.error_count = 0
        self.error_history: List[Dict[str, Any]] = []
    
    def handle_error(
        self,
        error: Exception,
        context: Optional[Dict[str, Any]] = None,
        reraise: bool = True
    ) -> Optional[MonteCarloError]:
        """
        Handle an error with logging and optional re-raising.
        
        Args:
            error: The exception to handle
            context: Additional context information
            reraise: Whether to re-raise the error after handling
            
        Returns:
            MonteCarloError if not re-raised, None otherwise
        """
        self.error_count += 1
        
        # Convert to MonteCarloError if not already
        if isinstance(error, MonteCarloError):
            mc_error = error
        else:
            mc_error = MonteCarloError(
                message=str(error),
                original_exception=error,
                context=context
            )
        
        # Add component context
        mc_error.context["component"] = self.component_name
        if context:
            mc_error.context.update(context)
        
        # Log error
        log_message = f"[{self.component_name}] {mc_error.category.value.upper()}: {mc_error.message}"
        
        if mc_error.severity == ErrorSeverity.CRITICAL:
            self.logger.critical(log_message, exc_info=True, extra=mc_error.to_dict())
        elif mc_error.severity == ErrorSeverity.HIGH:
            self.logger.error(log_message, exc_info=True, extra=mc_error.to_dict())
        elif mc_error.severity == ErrorSeverity.MEDIUM:
            self.logger.warning(log_message, extra=mc_error.to_dict())
        else:
            self.logger.info(log_message, extra=mc_error.to_dict())
        
        # Store in history (keep last 100)
        self.error_history.append({
            "timestamp": mc_error.timestamp,
            "error": mc_error.to_dict()
        })
        if len(self.error_history) > 100:
            self.error_history.pop(0)
        
        if reraise:
            raise mc_error
        
        return mc_error
    
    def get_error_statistics(self) -> Dict[str, Any]:
        """Get error statistics for monitoring."""
        return {
            "component": self.component_name,
            "total_errors": self.error_count,
            "recent_errors": len(self.error_history),
            "error_history": self.error_history[-10:]  # Last 10 errors
        }


# Decorator for error handling

def handle_errors(
    component_name: str,
    default_return: Any = None,
    reraise: bool = True,
    log_args: bool = False
):
    """
    Decorator to add error handling to functions.
    
    Args:
        component_name: Name of the component for logging
        default_return: Default value to return on error (if not reraising)
        reraise: Whether to re-raise errors
        log_args: Whether to log function arguments
    """
    def decorator(func: Callable) -> Callable:
        error_handler = ErrorHandler(component_name)
        
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            context = {
                "function": func.__name__,
                "module": func.__module__
            }
            
            if log_args:
                context["args"] = str(args)[:200]  # Limit size
                context["kwargs"] = str(kwargs)[:200]
            
            try:
                return func(*args, **kwargs)
            except MonteCarloError:
                # Already a Monte Carlo error, just re-raise
                raise
            except Exception as e:
                error_handler.handle_error(e, context=context, reraise=reraise)
                if not reraise:
                    return default_return
        
        return wrapper
    return decorator


# Recovery Strategies

class RecoveryStrategy:
    """Base class for error recovery strategies."""
    
    def can_recover(self, error: MonteCarloError) -> bool:
        """Check if this strategy can recover from the error."""
        return error.recoverable
    
    def recover(self, error: MonteCarloError, **kwargs) -> Any:
        """Attempt to recover from the error."""
        raise NotImplementedError


class RetryStrategy(RecoveryStrategy):
    """Retry the operation with exponential backoff."""
    
    def __init__(self, max_retries: int = 3, base_delay: float = 1.0):
        self.max_retries = max_retries
        self.base_delay = base_delay
    
    def recover(self, error: MonteCarloError, operation: Callable, **kwargs) -> Any:
        """Retry the operation."""
        import time
        
        for attempt in range(self.max_retries):
            try:
                logger.info(f"Retry attempt {attempt + 1}/{self.max_retries} for {operation.__name__}")
                return operation(**kwargs)
            except Exception as e:
                if attempt < self.max_retries - 1:
                    delay = self.base_delay * (2 ** attempt)
                    logger.warning(f"Retry failed, waiting {delay}s before next attempt")
                    time.sleep(delay)
                else:
                    logger.error(f"All retry attempts exhausted for {operation.__name__}")
                    raise


class FallbackStrategy(RecoveryStrategy):
    """Use a fallback value or method."""
    
    def __init__(self, fallback_value: Any = None, fallback_method: Optional[Callable] = None):
        self.fallback_value = fallback_value
        self.fallback_method = fallback_method
    
    def recover(self, error: MonteCarloError, **kwargs) -> Any:
        """Return fallback value or call fallback method."""
        if self.fallback_method:
            logger.info(f"Using fallback method for recovery")
            return self.fallback_method(**kwargs)
        else:
            logger.info(f"Using fallback value for recovery")
            return self.fallback_value


class DegradedModeStrategy(RecoveryStrategy):
    """Continue with reduced functionality."""
    
    def __init__(self, degraded_operation: Callable):
        self.degraded_operation = degraded_operation
    
    def recover(self, error: MonteCarloError, **kwargs) -> Any:
        """Execute degraded operation."""
        logger.warning(f"Entering degraded mode due to: {error.message}")
        return self.degraded_operation(**kwargs)


# Error Recovery Manager

class ErrorRecoveryManager:
    """Manages error recovery strategies."""
    
    def __init__(self):
        self.strategies: Dict[ErrorCategory, List[RecoveryStrategy]] = {}
        self.recovery_attempts = 0
        self.successful_recoveries = 0
    
    def register_strategy(self, category: ErrorCategory, strategy: RecoveryStrategy):
        """Register a recovery strategy for an error category."""
        if category not in self.strategies:
            self.strategies[category] = []
        self.strategies[category].append(strategy)
    
    def attempt_recovery(
        self,
        error: MonteCarloError,
        operation: Optional[Callable] = None,
        **kwargs
    ) -> tuple[bool, Any]:
        """
        Attempt to recover from an error.
        
        Returns:
            Tuple of (success, result)
        """
        self.recovery_attempts += 1
        
        if not error.recoverable:
            logger.error(f"Error is not recoverable: {error.message}")
            return False, None
        
        strategies = self.strategies.get(error.category, [])
        
        for strategy in strategies:
            if strategy.can_recover(error):
                try:
                    logger.info(f"Attempting recovery with {strategy.__class__.__name__}")
                    result = strategy.recover(error, operation=operation, **kwargs)
                    self.successful_recoveries += 1
                    logger.info(f"Recovery successful with {strategy.__class__.__name__}")
                    return True, result
                except Exception as e:
                    logger.warning(f"Recovery strategy {strategy.__class__.__name__} failed: {str(e)}")
                    continue
        
        logger.error(f"All recovery strategies exhausted for {error.category.value} error")
        return False, None
    
    def get_recovery_statistics(self) -> Dict[str, Any]:
        """Get recovery statistics."""
        success_rate = (
            (self.successful_recoveries / self.recovery_attempts * 100)
            if self.recovery_attempts > 0
            else 0
        )
        
        return {
            "total_attempts": self.recovery_attempts,
            "successful_recoveries": self.successful_recoveries,
            "success_rate": success_rate,
            "registered_strategies": {
                category.value: len(strategies)
                for category, strategies in self.strategies.items()
            }
        }


# Context Manager for Error Handling

class ErrorContext:
    """Context manager for handling errors in a specific context."""
    
    def __init__(
        self,
        component_name: str,
        operation_name: str,
        recovery_manager: Optional[ErrorRecoveryManager] = None,
        suppress_errors: bool = False
    ):
        self.component_name = component_name
        self.operation_name = operation_name
        self.recovery_manager = recovery_manager
        self.suppress_errors = suppress_errors
        self.error_handler = ErrorHandler(component_name)
    
    def __enter__(self):
        logger.debug(f"[{self.component_name}] Starting operation: {self.operation_name}")
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is None:
            logger.debug(f"[{self.component_name}] Operation completed successfully: {self.operation_name}")
            return False
        
        # Handle the error
        context = {"operation": self.operation_name}
        
        try:
            mc_error = self.error_handler.handle_error(exc_val, context=context, reraise=False)
            
            # Attempt recovery if manager is available
            if self.recovery_manager and mc_error.recoverable:
                success, result = self.recovery_manager.attempt_recovery(mc_error)
                if success:
                    logger.info(f"[{self.component_name}] Recovered from error in: {self.operation_name}")
                    return True  # Suppress the exception
            
            # Suppress error if configured
            if self.suppress_errors:
                logger.warning(f"[{self.component_name}] Suppressing error in: {self.operation_name}")
                return True
            
            # Re-raise the error
            return False
            
        except Exception as e:
            logger.critical(f"[{self.component_name}] Error handler failed: {str(e)}", exc_info=True)
            return False


# Utility Functions

def create_user_friendly_message(error: Exception) -> str:
    """Create a user-friendly error message from any exception."""
    if isinstance(error, MonteCarloError):
        return error.get_user_message()
    
    # Generic messages for common error types
    error_type = type(error).__name__
    
    if "ValueError" in error_type:
        return f"Invalid input: {str(error)}"
    elif "TypeError" in error_type:
        return "Invalid data type provided. Please check your input."
    elif "KeyError" in error_type:
        return "Required data is missing. Please check your input."
    elif "IndexError" in error_type:
        return "Data access error. Please check your input parameters."
    elif "ZeroDivisionError" in error_type:
        return "Mathematical error: division by zero. Please check your risk parameters."
    elif "MemoryError" in error_type:
        return "Insufficient memory. Please reduce simulation complexity."
    elif "TimeoutError" in error_type:
        return "Operation timed out. Please try again or reduce simulation complexity."
    else:
        return f"An unexpected error occurred: {str(error)[:100]}"


def log_error_with_context(
    logger: logging.Logger,
    error: Exception,
    context: Dict[str, Any],
    level: str = "error"
):
    """Log an error with full context information."""
    log_data = {
        "error_type": type(error).__name__,
        "error_message": str(error),
        "context": context,
        "timestamp": datetime.now().isoformat(),
        "traceback": traceback.format_exc()
    }
    
    log_method = getattr(logger, level, logger.error)
    log_method(f"Error occurred: {str(error)}", extra=log_data)


# Global error recovery manager instance
_global_recovery_manager = ErrorRecoveryManager()


def get_global_recovery_manager() -> ErrorRecoveryManager:
    """Get the global error recovery manager instance."""
    return _global_recovery_manager
