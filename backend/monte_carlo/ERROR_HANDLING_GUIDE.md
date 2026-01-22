# Monte Carlo Risk Simulation - Error Handling Guide

## Overview

The Monte Carlo Risk Simulation system implements comprehensive error handling across all components to ensure:
- **Robustness**: Graceful handling of errors without system crashes
- **User-Friendly Messages**: Clear, actionable error messages for users
- **Graceful Degradation**: Continued operation with reduced functionality when external systems fail
- **Recovery Strategies**: Automatic retry and fallback mechanisms
- **Comprehensive Logging**: Detailed error tracking for debugging and monitoring

## Error Hierarchy

### Base Exception: `MonteCarloError`

All Monte Carlo-specific errors inherit from `MonteCarloError`, which provides:
- Error categorization (validation, computation, data access, etc.)
- Severity levels (low, medium, high, critical)
- Recoverability status
- Context information
- User-friendly message generation

### Specific Error Types

#### 1. ValidationError
**When**: Input validation fails
**Severity**: Low
**Recoverable**: Yes
**Example**:
```python
raise ValidationError(
    "Invalid distribution parameters",
    field="probability_distribution"
)
```

#### 2. ComputationError
**When**: Statistical computations fail
**Severity**: High
**Recoverable**: No
**Example**:
```python
raise ComputationError(
    "Matrix inversion failed",
    computation_type="correlation_matrix"
)
```

#### 3. DataAccessError
**When**: Data retrieval fails
**Severity**: Medium
**Recoverable**: Yes
**Example**:
```python
raise DataAccessError(
    "Failed to retrieve risk register data",
    data_source="risk_register"
)
```

#### 4. ExternalSystemError
**When**: External system integration fails
**Severity**: Medium
**Recoverable**: Yes
**Example**:
```python
raise ExternalSystemError(
    "Database connection failed",
    system="supabase"
)
```

#### 5. ConfigurationError
**When**: Configuration is invalid
**Severity**: High
**Recoverable**: No
**Example**:
```python
raise ConfigurationError(
    "Invalid iteration count",
    config_key="iterations"
)
```

#### 6. ResourceError
**When**: System resources are insufficient
**Severity**: High
**Recoverable**: Yes
**Example**:
```python
raise ResourceError(
    "Insufficient memory for simulation",
    resource_type="memory"
)
```

#### 7. ConvergenceError
**When**: Simulation fails to converge
**Severity**: High
**Recoverable**: No
**Example**:
```python
raise ConvergenceError(
    "Simulation did not converge after 100000 iterations",
    iterations_completed=100000
)
```

#### 8. DistributionError
**When**: Probability distribution is invalid
**Severity**: Low
**Recoverable**: Yes
**Example**:
```python
raise DistributionError(
    "Triangular distribution parameters violate min <= mode <= max",
    distribution_type="triangular"
)
```

#### 9. CorrelationError
**When**: Correlation matrix is invalid
**Severity**: Low
**Recoverable**: Yes
**Example**:
```python
raise CorrelationError(
    "Correlation matrix is not positive definite"
)
```

## Using Error Handling in Components

### Method Decorator

Use the `@with_error_handling` decorator for automatic error handling:

```python
from monte_carlo.error_integration import with_error_handling

class MyComponent:
    @with_error_handling(
        component_name="my_component",
        operation_name="calculate_statistics",
        reraise=True,
        recovery_enabled=True
    )
    def calculate_statistics(self, data):
        # Your code here
        if not data:
            raise ValidationError("Data cannot be empty", field="data")
        return statistics
```

### Context Manager

Use `ErrorContext` for block-level error handling:

```python
from monte_carlo.error_handling import ErrorContext

with ErrorContext(
    component_name="simulation",
    operation_name="run_iteration",
    recovery_manager=recovery_manager
):
    # Your code here
    result = perform_calculation()
```

### Safe Operations

Use safe operation wrappers for common patterns:

#### Safe Computation
```python
from monte_carlo.error_integration import safe_computation

result = safe_computation(
    computation_func=lambda: complex_calculation(data),
    computation_type="risk_aggregation",
    fallback_value=0.0,
    reraise=False
)
```

#### Safe Data Access
```python
from monte_carlo.error_integration import safe_data_access

data = safe_data_access(
    access_func=lambda: database.get_risks(),
    data_source="risk_database",
    fallback_value=[],
    retry_count=3
)
```

#### Safe External Call
```python
from monte_carlo.error_integration import safe_external_call

result = safe_external_call(
    call_func=lambda: external_api.get_data(),
    system_name="external_api",
    fallback_func=lambda: get_cached_data(),
    degraded_mode_func=lambda: get_default_data()
)
```

## Recovery Strategies

### Retry Strategy

Automatically retries operations with exponential backoff:

```python
from monte_carlo.error_handling import RetryStrategy, get_global_recovery_manager

recovery_manager = get_global_recovery_manager()
retry_strategy = RetryStrategy(max_retries=3, base_delay=1.0)

recovery_manager.register_strategy(
    ErrorCategory.DATA_ACCESS,
    retry_strategy
)
```

### Fallback Strategy

Uses fallback values or methods when operations fail:

```python
from monte_carlo.error_handling import FallbackStrategy

fallback_strategy = FallbackStrategy(
    fallback_value=default_value,
    fallback_method=get_default_data
)

recovery_manager.register_strategy(
    ErrorCategory.COMPUTATION,
    fallback_strategy
)
```

### Degraded Mode Strategy

Continues with reduced functionality:

```python
from monte_carlo.error_handling import DegradedModeStrategy

degraded_strategy = DegradedModeStrategy(
    degraded_operation=simplified_calculation
)

recovery_manager.register_strategy(
    ErrorCategory.EXTERNAL_SYSTEM,
    degraded_strategy
)
```

## API Error Handling

### Endpoint Error Handling

Use the `@handle_monte_carlo_exceptions` decorator on API endpoints:

```python
from monte_carlo.api_validation import handle_monte_carlo_exceptions

@router.post("/simulations/run")
@handle_monte_carlo_exceptions
async def run_simulation(request: SimulationRequest):
    # Your code here
    # Errors are automatically caught and formatted
    pass
```

### Error Response Format

All API errors follow a consistent format:

```json
{
  "error_type": "validation_error",
  "message": "Invalid distribution parameters",
  "field": "probability_distribution",
  "code": "VALIDATION_FAILED",
  "timestamp": "2026-01-22T10:30:00Z",
  "recoverable": true,
  "severity": "low",
  "context": {
    "distribution_type": "triangular",
    "parameters": {"min": 10, "mode": 5, "max": 20}
  }
}
```

### HTTP Status Codes

- **400**: Validation errors
- **422**: Business logic errors
- **500**: Computation errors, configuration errors
- **502**: Recoverable external system errors
- **503**: Non-recoverable external system errors
- **507**: Resource errors (insufficient resources)

## Graceful Degradation

### Database Failures

When database operations fail:
1. Results are stored in memory only
2. User receives warning about limited persistence
3. Simulation continues normally
4. Response includes degradation notice

```python
{
  "simulation_id": "abc-123",
  "status": "completed",
  "storage_status": "degraded",
  "degradation": {
    "status": "degraded",
    "message": "Results computed but not persisted",
    "fallback_used": "memory_storage"
  }
}
```

### Cache Failures

When cache operations fail:
1. System falls back to direct computation
2. Performance may be slower
3. All functionality remains available

### Visualization Failures

When visualization generation fails:
1. Raw data is provided instead
2. User can use external tools
3. Alternative text-based summaries provided

## Monitoring and Health Checks

### Component Health Status

Get health status of all components:

```python
from monte_carlo.error_integration import get_component_health_status

health = get_component_health_status()
# Returns:
# {
#   "overall_status": "healthy",
#   "components": {
#     "engine": {"status": "healthy", "total_errors": 0},
#     "analyzer": {"status": "warning", "total_errors": 5}
#   }
# }
```

### Error Statistics

Get error statistics for a component:

```python
from monte_carlo.error_integration import get_component_error_handler

error_handler = get_component_error_handler("engine")
stats = error_handler.get_error_statistics()
# Returns:
# {
#   "component": "engine",
#   "total_errors": 10,
#   "recent_errors": 3,
#   "error_history": [...]
# }
```

### Recovery Statistics

Get recovery attempt statistics:

```python
from monte_carlo.error_handling import get_global_recovery_manager

recovery_manager = get_global_recovery_manager()
stats = recovery_manager.get_recovery_statistics()
# Returns:
# {
#   "total_attempts": 50,
#   "successful_recoveries": 45,
#   "success_rate": 90.0
# }
```

## Best Practices

### 1. Always Use Specific Error Types

❌ **Bad**:
```python
raise Exception("Something went wrong")
```

✅ **Good**:
```python
raise ValidationError("Invalid risk parameters", field="risk_id")
```

### 2. Provide Context

❌ **Bad**:
```python
raise ComputationError("Calculation failed")
```

✅ **Good**:
```python
raise ComputationError(
    "Matrix inversion failed during correlation analysis",
    computation_type="correlation_matrix",
    context={"matrix_size": 10, "condition_number": 1e15}
)
```

### 3. Use Appropriate Severity

```python
# Low severity for user input errors
raise ValidationError("Invalid parameter", severity=ErrorSeverity.LOW)

# High severity for system failures
raise ComputationError("Critical calculation failed", severity=ErrorSeverity.HIGH)

# Critical severity for data corruption
raise DataAccessError("Data corruption detected", severity=ErrorSeverity.CRITICAL)
```

### 4. Enable Recovery When Appropriate

```python
# Recoverable errors
raise DataAccessError("Database timeout", recoverable=True)

# Non-recoverable errors
raise ComputationError("Numerical instability", recoverable=False)
```

### 5. Log Errors Appropriately

```python
import logging
logger = logging.getLogger(__name__)

try:
    result = risky_operation()
except MonteCarloError as e:
    logger.error(f"Operation failed: {e.message}", extra=e.to_dict())
    raise
```

## Testing Error Handling

### Unit Tests

```python
import pytest
from monte_carlo.error_handling import ValidationError

def test_validation_error():
    with pytest.raises(ValidationError) as exc_info:
        validate_parameters(invalid_params)
    
    assert exc_info.value.field == "parameters"
    assert exc_info.value.recoverable == True
```

### Integration Tests

```python
def test_error_recovery():
    # Simulate external system failure
    with mock.patch('external_system.call', side_effect=Exception("Connection failed")):
        result = safe_external_call(
            call_func=external_system.call,
            system_name="external_system",
            fallback_func=lambda: "fallback_data"
        )
        assert result == "fallback_data"
```

## Troubleshooting

### Common Issues

#### 1. Errors Not Being Caught

**Problem**: Errors bypass error handling
**Solution**: Ensure you're using the decorators or context managers

#### 2. Recovery Not Working

**Problem**: Recovery strategies not executing
**Solution**: Check that error is marked as recoverable and appropriate strategy is registered

#### 3. Excessive Error Logging

**Problem**: Too many error logs
**Solution**: Adjust logging levels or use error suppression for expected errors

#### 4. User Messages Not Helpful

**Problem**: Technical error messages shown to users
**Solution**: Implement `get_user_message()` method in custom error classes

## Support

For issues or questions about error handling:
1. Check this guide first
2. Review error logs for detailed context
3. Check component health status
4. Contact the development team with error details and context

## Version History

- **v1.0.0** (2026-01-22): Initial comprehensive error handling implementation
  - Base error hierarchy
  - Recovery strategies
  - API integration
  - Graceful degradation
  - Monitoring and health checks
