"""
API Validation and Error Handling for Monte Carlo Risk Simulations.

This module provides comprehensive validation and error handling for:
- Input parameter validation
- Business logic validation
- Error response formatting
- Graceful degradation strategies
"""

from typing import List, Dict, Any, Optional, Union
from pydantic import BaseModel, Field, validator
from enum import Enum
import logging
from datetime import datetime

from .models import RiskCategory, ImpactType, DistributionType

# Import enhanced error handling
from .error_handling import (
    ValidationError as MCValidationError,
    MonteCarloError,
    ExternalSystemError as MCExternalSystemError,
    create_user_friendly_message
)

# Configure logging
logger = logging.getLogger(__name__)

# Legacy exception classes for backward compatibility
class ValidationError(MCValidationError):
    """Custom validation error for Monte Carlo API (legacy compatibility)."""
    def __init__(self, message: str, field: str = None, code: str = None):
        super().__init__(message, field=field)
        self.code = code

class BusinessLogicError(MonteCarloError):
    """Custom business logic error for Monte Carlo API."""
    def __init__(self, message: str, code: str = None):
        from .error_handling import ErrorCategory, ErrorSeverity
        super().__init__(
            message,
            category=ErrorCategory.BUSINESS_LOGIC,
            severity=ErrorSeverity.MEDIUM,
            recoverable=True
        )
        self.code = code

class ExternalSystemError(MCExternalSystemError):
    """Custom error for external system failures (legacy compatibility)."""
    def __init__(self, message: str, system: str = None, recoverable: bool = True):
        super().__init__(message, system=system, recoverable=recoverable)

"""
API Validation and Error Handling for Monte Carlo Risk Simulations.

This module provides comprehensive validation and error handling for:
- Input parameter validation
- Business logic validation
- Error response formatting
- Graceful degradation strategies
"""

from typing import List, Dict, Any, Optional, Union
from pydantic import BaseModel, Field, field_validator, model_validator
from enum import Enum
import logging
from datetime import datetime

from .models import RiskCategory, ImpactType, DistributionType

# Configure logging
logger = logging.getLogger(__name__)

class ValidationError(Exception):
    """Custom validation error for Monte Carlo API."""
    def __init__(self, message: str, field: str = None, code: str = None):
        self.message = message
        self.field = field
        self.code = code
        super().__init__(self.message)

class BusinessLogicError(Exception):
    """Custom business logic error for Monte Carlo API."""
    def __init__(self, message: str, code: str = None):
        self.message = message
        self.code = code
        super().__init__(self.message)

class ExternalSystemError(Exception):
    """Custom error for external system failures."""
    def __init__(self, message: str, system: str = None, recoverable: bool = True):
        self.message = message
        self.system = system
        self.recoverable = recoverable
        super().__init__(self.message)

# Pydantic models for comprehensive validation

class DistributionParametersValidator(BaseModel):
    """Base validator for probability distribution parameters."""
    pass

class TriangularDistributionParams(BaseModel):
    """Validation for triangular distribution parameters."""
    min: float = Field(..., description="Minimum value")
    mode: float = Field(..., description="Most likely value")
    max: float = Field(..., description="Maximum value")
    
    @model_validator(mode='after')
    def validate_triangular_ordering(self):
        """Validate that min <= mode <= max."""
        if self.mode < self.min:
            raise ValueError("Mode must be >= minimum value")
        if self.max < self.mode:
            raise ValueError("Maximum must be >= mode value")
        if self.max <= self.min:
            raise ValueError("Maximum must be > minimum value")
        return self

class NormalDistributionParams(BaseModel):
    """Validation for normal distribution parameters."""
    mean: float = Field(..., description="Mean value")
    std: float = Field(..., gt=0, description="Standard deviation (must be positive)")

class UniformDistributionParams(BaseModel):
    """Validation for uniform distribution parameters."""
    min: float = Field(..., description="Minimum value")
    max: float = Field(..., description="Maximum value")
    
    @model_validator(mode='after')
    def validate_max_greater_than_min(self):
        """Validate that max > min."""
        if self.max <= self.min:
            raise ValueError("Maximum must be > minimum value")
        return self

class BetaDistributionParams(BaseModel):
    """Validation for beta distribution parameters."""
    alpha: float = Field(..., gt=0, description="Alpha parameter (must be positive)")
    beta: float = Field(..., gt=0, description="Beta parameter (must be positive)")

class LognormalDistributionParams(BaseModel):
    """Validation for lognormal distribution parameters."""
    mu: float = Field(..., description="Mu parameter")
    sigma: float = Field(..., gt=0, description="Sigma parameter (must be positive)")

class MitigationStrategyValidator(BaseModel):
    """Validator for mitigation strategies."""
    id: str = Field(..., min_length=1, max_length=100)
    name: str = Field(..., min_length=1, max_length=200)
    description: str = Field(default="", max_length=1000)
    cost: float = Field(..., ge=0, description="Cost must be non-negative")
    effectiveness: float = Field(..., ge=0, le=1, description="Effectiveness must be between 0 and 1")
    implementation_time: int = Field(..., ge=0, description="Implementation time must be non-negative")

class RiskValidator(BaseModel):
    """Comprehensive validator for risk objects."""
    id: str = Field(..., min_length=1, max_length=100, pattern=r'^[a-zA-Z0-9_-]+$')
    name: str = Field(..., min_length=1, max_length=200)
    category: str = Field(..., description="Must be a valid risk category")
    impact_type: str = Field(..., description="Must be a valid impact type")
    distribution_type: str = Field(..., description="Must be a valid distribution type")
    distribution_parameters: Dict[str, float] = Field(..., description="Distribution parameters")
    baseline_impact: float = Field(..., description="Baseline impact value")
    correlation_dependencies: List[str] = Field(default=[], max_length=50)
    mitigation_strategies: List[MitigationStrategyValidator] = Field(default=[], max_length=10)
    
    @field_validator('category')
    @classmethod
    def validate_risk_category(cls, v):
        """Validate risk category."""
        try:
            RiskCategory(v)
        except ValueError:
            valid_categories = [cat.value for cat in RiskCategory]
            raise ValueError(f"Invalid risk category. Must be one of: {valid_categories}")
        return v
    
    @field_validator('impact_type')
    @classmethod
    def validate_impact_type(cls, v):
        """Validate impact type."""
        try:
            ImpactType(v)
        except ValueError:
            valid_types = [it.value for it in ImpactType]
            raise ValueError(f"Invalid impact type. Must be one of: {valid_types}")
        return v
    
    @field_validator('distribution_type')
    @classmethod
    def validate_distribution_type(cls, v):
        """Validate distribution type."""
        try:
            DistributionType(v)
        except ValueError:
            valid_types = [dt.value for dt in DistributionType]
            raise ValueError(f"Invalid distribution type. Must be one of: {valid_types}")
        return v
    
    @field_validator('baseline_impact')
    @classmethod
    def validate_baseline_impact(cls, v):
        """Validate baseline impact."""
        if not (-1e9 <= v <= 1e9):  # Reasonable bounds
            raise ValueError("Baseline impact is out of reasonable bounds")
        return v
    
    @model_validator(mode='after')
    def validate_distribution_parameters(self):
        """Validate distribution parameters based on distribution type."""
        dist_type = self.distribution_type
        params = self.distribution_parameters
        
        try:
            if dist_type == DistributionType.TRIANGULAR.value:
                TriangularDistributionParams(**params)
            elif dist_type == DistributionType.NORMAL.value:
                NormalDistributionParams(**params)
            elif dist_type == DistributionType.UNIFORM.value:
                UniformDistributionParams(**params)
            elif dist_type == DistributionType.BETA.value:
                BetaDistributionParams(**params)
            elif dist_type == DistributionType.LOGNORMAL.value:
                LognormalDistributionParams(**params)
            else:
                raise ValueError(f"Unsupported distribution type: {dist_type}")
        except Exception as e:
            raise ValueError(f"Invalid distribution parameters for {dist_type}: {str(e)}")
        
        return self
    
    @model_validator(mode='after')
    def validate_correlation_dependencies(self):
        """Validate correlation dependencies."""
        deps = self.correlation_dependencies
        
        if self.id in deps:
            raise ValueError("Risk cannot have correlation dependency on itself")
        
        # Check for duplicates
        if len(deps) != len(set(deps)):
            raise ValueError("Correlation dependencies must be unique")
        
        return self

class SimulationRequestValidator(BaseModel):
    """Comprehensive validator for simulation requests."""
    risks: List[RiskValidator] = Field(..., min_length=1, max_length=100)
    iterations: int = Field(default=10000, ge=10000, le=1000000)
    correlations: Optional[Dict[str, Dict[str, float]]] = None
    random_seed: Optional[int] = Field(None, ge=0, le=2**31-1)
    baseline_costs: Optional[Dict[str, float]] = None
    schedule_data: Optional[Dict[str, Any]] = None
    
    @model_validator(mode='after')
    def validate_unique_risk_ids(self):
        """Validate that all risk IDs are unique."""
        risk_ids = [risk.id for risk in self.risks]
        if len(risk_ids) != len(set(risk_ids)):
            raise ValueError("All risk IDs must be unique")
        return self
    
    @model_validator(mode='after')
    def validate_correlations(self):
        """Validate correlation matrix."""
        if self.correlations is None:
            return self
        
        risk_ids = {risk.id for risk in self.risks}
        
        for risk1_id, correlations_dict in self.correlations.items():
            if risk1_id not in risk_ids:
                raise ValueError(f"Correlation references unknown risk: {risk1_id}")
            
            for risk2_id, correlation_value in correlations_dict.items():
                if risk2_id not in risk_ids:
                    raise ValueError(f"Correlation references unknown risk: {risk2_id}")
                
                if not isinstance(correlation_value, (int, float)):
                    raise ValueError(f"Correlation value must be numeric: {correlation_value}")
                
                if not -1.0 <= correlation_value <= 1.0:
                    raise ValueError(f"Correlation value must be between -1 and 1: {correlation_value}")
                
                if risk1_id == risk2_id and correlation_value != 1.0:
                    raise ValueError(f"Self-correlation must be 1.0, got {correlation_value}")
        
        return self
    
    @model_validator(mode='after')
    def validate_baseline_costs(self):
        """Validate baseline costs."""
        if self.baseline_costs is None:
            return self
        
        for cost_category, cost_value in self.baseline_costs.items():
            if not isinstance(cost_value, (int, float)):
                raise ValueError(f"Baseline cost must be numeric: {cost_category}")
            
            if cost_value < 0:
                raise ValueError(f"Baseline cost must be non-negative: {cost_category}")
        
        return self

class ScenarioRequestValidator(BaseModel):
    """Validator for scenario creation requests."""
    name: str = Field(..., min_length=1, max_length=200)
    description: str = Field(default="", max_length=1000)
    base_risks: List[RiskValidator] = Field(..., min_length=1, max_length=100)
    modifications: Dict[str, Dict[str, Any]] = Field(default={})
    
    @model_validator(mode='after')
    def validate_modifications(self):
        """Validate risk modifications."""
        risk_ids = {risk.id for risk in self.base_risks}
        
        for risk_id, modification in self.modifications.items():
            if risk_id not in risk_ids:
                raise ValueError(f"Modification references unknown risk: {risk_id}")
            
            # Validate modification structure
            if not isinstance(modification, dict):
                raise ValueError(f"Modification must be a dictionary: {risk_id}")
            
            # Validate parameter changes
            if 'parameter_changes' in modification:
                param_changes = modification['parameter_changes']
                if not isinstance(param_changes, dict):
                    raise ValueError(f"Parameter changes must be a dictionary: {risk_id}")
                
                for param_name, param_value in param_changes.items():
                    if not isinstance(param_value, (int, float)):
                        raise ValueError(f"Parameter value must be numeric: {param_name}")
        
        return self

class APIErrorHandler:
    """Centralized error handling for Monte Carlo API."""
    
    @staticmethod
    def format_validation_error(error: Union[ValidationError, MCValidationError]) -> Dict[str, Any]:
        """Format validation error for API response."""
        if isinstance(error, MCValidationError):
            return {
                "error_type": "validation_error",
                "message": error.get_user_message(),
                "field": error.field if hasattr(error, 'field') else None,
                "code": error.code if hasattr(error, 'code') else "VALIDATION_FAILED",
                "timestamp": datetime.now().isoformat(),
                "recoverable": error.recoverable,
                "severity": error.severity.value if hasattr(error, 'severity') else "low",
                "context": error.context if hasattr(error, 'context') else {}
            }
        else:
            # Legacy format
            return {
                "error_type": "validation_error",
                "message": error.message,
                "field": error.field,
                "code": error.code or "VALIDATION_FAILED",
                "timestamp": datetime.now().isoformat(),
                "recoverable": True
            }
    
    @staticmethod
    def format_business_logic_error(error: BusinessLogicError) -> Dict[str, Any]:
        """Format business logic error for API response."""
        return {
            "error_type": "business_logic_error",
            "message": error.get_user_message() if hasattr(error, 'get_user_message') else error.message,
            "code": error.code or "BUSINESS_LOGIC_FAILED",
            "timestamp": datetime.now().isoformat(),
            "recoverable": error.recoverable if hasattr(error, 'recoverable') else True,
            "severity": error.severity.value if hasattr(error, 'severity') else "medium",
            "context": error.context if hasattr(error, 'context') else {}
        }
    
    @staticmethod
    def format_external_system_error(error: Union[ExternalSystemError, MCExternalSystemError]) -> Dict[str, Any]:
        """Format external system error for API response."""
        return {
            "error_type": "external_system_error",
            "message": error.get_user_message() if hasattr(error, 'get_user_message') else error.message,
            "system": error.system,
            "recoverable": error.recoverable,
            "timestamp": datetime.now().isoformat(),
            "retry_recommended": error.recoverable,
            "severity": error.severity.value if hasattr(error, 'severity') else "medium",
            "context": error.context if hasattr(error, 'context') else {}
        }
    
    @staticmethod
    def format_generic_error(error: Exception, error_type: str = "internal_error") -> Dict[str, Any]:
        """Format generic error for API response."""
        # Use enhanced error handling if available
        if isinstance(error, MonteCarloError):
            return {
                "error_type": error_type,
                "message": error.get_user_message(),
                "timestamp": datetime.now().isoformat(),
                "recoverable": error.recoverable,
                "severity": error.severity.value,
                "category": error.category.value,
                "context": error.context
            }
        else:
            # Fallback to basic format
            user_message = create_user_friendly_message(error)
            return {
                "error_type": error_type,
                "message": user_message,
                "timestamp": datetime.now().isoformat(),
                "recoverable": False
            }

class GracefulDegradationManager:
    """Manages graceful degradation strategies for external system failures."""
    
    def __init__(self):
        self.fallback_strategies = {
            "database": self._database_fallback,
            "cache": self._cache_fallback,
            "visualization": self._visualization_fallback,
            "export": self._export_fallback
        }
    
    def handle_system_failure(self, system: str, operation: str, **kwargs) -> Dict[str, Any]:
        """Handle system failure with appropriate fallback strategy."""
        logger.warning(f"System failure detected: {system} - {operation}")
        
        if system in self.fallback_strategies:
            return self.fallback_strategies[system](operation, **kwargs)
        else:
            return self._default_fallback(system, operation, **kwargs)
    
    def _database_fallback(self, operation: str, **kwargs) -> Dict[str, Any]:
        """Fallback strategy for database failures."""
        if operation == "store_results":
            return {
                "status": "degraded",
                "message": "Results computed but not persisted. Results available in memory only.",
                "fallback_used": "memory_storage",
                "data_retention": "session_only"
            }
        elif operation == "retrieve_results":
            return {
                "status": "unavailable",
                "message": "Historical results unavailable due to database connectivity issues.",
                "fallback_used": "none",
                "recommendation": "Retry operation later"
            }
        else:
            return self._default_fallback("database", operation, **kwargs)
    
    def _cache_fallback(self, operation: str, **kwargs) -> Dict[str, Any]:
        """Fallback strategy for cache failures."""
        return {
            "status": "degraded",
            "message": "Cache unavailable. Operations will be slower but functional.",
            "fallback_used": "direct_computation",
            "performance_impact": "moderate"
        }
    
    def _visualization_fallback(self, operation: str, **kwargs) -> Dict[str, Any]:
        """Fallback strategy for visualization failures."""
        return {
            "status": "degraded",
            "message": "Visualization service unavailable. Raw data provided instead.",
            "fallback_used": "raw_data_export",
            "alternative": "Use external visualization tools"
        }
    
    def _export_fallback(self, operation: str, **kwargs) -> Dict[str, Any]:
        """Fallback strategy for export failures."""
        return {
            "status": "degraded",
            "message": "Export service unavailable. Data available via API only.",
            "fallback_used": "api_response",
            "alternative": "Retrieve data via API endpoints"
        }
    
    def _default_fallback(self, system: str, operation: str, **kwargs) -> Dict[str, Any]:
        """Default fallback strategy."""
        return {
            "status": "failed",
            "message": f"System {system} unavailable for operation {operation}",
            "fallback_used": "none",
            "recommendation": "Contact system administrator"
        }

class InputSanitizer:
    """Sanitizes and normalizes input data."""
    
    @staticmethod
    def sanitize_string(value: str, max_length: int = 1000) -> str:
        """Sanitize string input."""
        if not isinstance(value, str):
            raise ValidationError("Value must be a string")
        
        # Remove potentially dangerous characters
        sanitized = value.strip()
        
        # Limit length
        if len(sanitized) > max_length:
            raise ValidationError(f"String too long. Maximum length: {max_length}")
        
        return sanitized
    
    @staticmethod
    def sanitize_numeric(value: Union[int, float], min_val: float = None, max_val: float = None) -> float:
        """Sanitize numeric input."""
        if not isinstance(value, (int, float)):
            raise ValidationError("Value must be numeric")
        
        # Check for NaN or infinity
        if not (-1e10 <= value <= 1e10):
            raise ValidationError("Numeric value out of reasonable bounds")
        
        # Apply bounds if specified
        if min_val is not None and value < min_val:
            raise ValidationError(f"Value must be >= {min_val}")
        
        if max_val is not None and value > max_val:
            raise ValidationError(f"Value must be <= {max_val}")
        
        return float(value)
    
    @staticmethod
    def sanitize_list(value: List[Any], max_items: int = 100) -> List[Any]:
        """Sanitize list input."""
        if not isinstance(value, list):
            raise ValidationError("Value must be a list")
        
        if len(value) > max_items:
            raise ValidationError(f"List too long. Maximum items: {max_items}")
        
        return value

class PerformanceValidator:
    """Validates requests for performance implications."""
    
    @staticmethod
    def validate_simulation_complexity(risks: List[Dict], iterations: int) -> Dict[str, Any]:
        """Validate simulation complexity and estimate performance impact."""
        risk_count = len(risks)
        
        # Calculate complexity score
        complexity_score = risk_count * (iterations / 10000)
        
        # Estimate execution time (simplified model)
        estimated_time = min(300, risk_count * 0.1 + iterations / 1000)
        
        # Performance warnings
        warnings = []
        if risk_count > 50:
            warnings.append("Large number of risks may impact performance")
        
        if iterations > 100000:
            warnings.append("High iteration count may result in longer execution time")
        
        if complexity_score > 1000:
            warnings.append("High complexity simulation - consider reducing parameters")
        
        # Memory estimation (rough)
        estimated_memory_mb = (risk_count * iterations * 8) / (1024 * 1024)  # 8 bytes per float
        
        if estimated_memory_mb > 1000:  # 1GB
            warnings.append("High memory usage expected - monitor system resources")
        
        return {
            "complexity_score": complexity_score,
            "estimated_execution_time": estimated_time,
            "estimated_memory_mb": estimated_memory_mb,
            "warnings": warnings,
            "performance_tier": (
                "low" if complexity_score < 100 else
                "medium" if complexity_score < 500 else
                "high"
            )
        }

# Utility functions for error handling

def validate_and_sanitize_simulation_request(request_data: Dict[str, Any]) -> Dict[str, Any]:
    """Validate and sanitize a complete simulation request."""
    try:
        # Use Pydantic validator
        validated_request = SimulationRequestValidator(**request_data)
        
        # Additional performance validation
        performance_info = PerformanceValidator.validate_simulation_complexity(
            validated_request.risks, 
            validated_request.iterations
        )
        
        return {
            "validated_data": validated_request.dict(),
            "performance_info": performance_info,
            "validation_status": "passed"
        }
        
    except Exception as e:
        raise ValidationError(f"Request validation failed: {str(e)}")

def handle_api_exception(exception: Exception) -> tuple[int, Dict[str, Any]]:
    """Handle API exceptions and return appropriate HTTP status and response."""
    error_handler = APIErrorHandler()
    
    # Handle Monte Carlo specific errors
    if isinstance(exception, (ValidationError, MCValidationError)):
        return 400, error_handler.format_validation_error(exception)
    elif isinstance(exception, BusinessLogicError):
        return 422, error_handler.format_business_logic_error(exception)
    elif isinstance(exception, (ExternalSystemError, MCExternalSystemError)):
        status_code = 503 if not exception.recoverable else 502
        return status_code, error_handler.format_external_system_error(exception)
    elif isinstance(exception, MonteCarloError):
        # Handle other Monte Carlo errors
        from .error_handling import ComputationError, ResourceError, ConfigurationError
        
        if isinstance(exception, ComputationError):
            return 500, error_handler.format_generic_error(exception, "computation_error")
        elif isinstance(exception, ResourceError):
            return 507, error_handler.format_generic_error(exception, "resource_error")
        elif isinstance(exception, ConfigurationError):
            return 500, error_handler.format_generic_error(exception, "configuration_error")
        else:
            return 500, error_handler.format_generic_error(exception, "monte_carlo_error")
    else:
        return 500, error_handler.format_generic_error(exception)


def create_user_friendly_error_message(error: Dict[str, Any]) -> str:
    """Create user-friendly error messages from technical errors."""
    error_type = error.get("error_type", "unknown")
    
    if error_type == "validation_error":
        field = error.get("field", "input")
        return f"Invalid {field}: {error.get('message', 'Please check your input')}"
    
    elif error_type == "business_logic_error":
        return f"Operation failed: {error.get('message', 'Please review your request')}"
    
    elif error_type == "external_system_error":
        system = error.get("system", "external service")
        if error.get("recoverable", False):
            return f"Temporary issue with {system}. Please try again in a few moments."
        else:
            return f"Service unavailable: {system}. Please contact support."
    
    elif error_type == "computation_error":
        return f"Calculation error: {error.get('message', 'Please check your input parameters')}"
    
    elif error_type == "resource_error":
        return f"System resources insufficient: {error.get('message', 'Please reduce complexity or try again later')}"
    
    elif error_type == "configuration_error":
        return f"Configuration error: {error.get('message', 'Please contact system administrator')}"
    
    else:
        # Use enhanced error message creation if available
        message = error.get('message', 'An unexpected error occurred')
        if len(message) > 200:
            message = message[:197] + "..."
        return message