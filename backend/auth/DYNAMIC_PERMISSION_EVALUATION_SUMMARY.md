# Dynamic Permission Evaluation System - Implementation Summary

## Overview

This document summarizes the implementation of the Dynamic Permission Evaluation System for the RBAC Enhancement feature. The system provides context-aware, time-based, and extensible permission evaluation with automatic synchronization on assignment changes.

## Implemented Components

### 1. Dynamic Permission Evaluator (`dynamic_permission_evaluator.py`)

**Purpose**: Core component for dynamic, context-aware permission evaluation.

**Key Features**:
- Context-aware permission evaluation considering project assignments and hierarchy
- Automatic permission updates when assignments change
- Multi-level permission verification (role + resource-specific)
- Custom permission rule support
- Assignment change event handling

**Main Classes**:

#### `DynamicPermissionEvaluator`
- `evaluate_permission()`: Full context-aware permission evaluation with detailed results
- `verify_multi_level_permission()`: Check permissions at multiple levels (role, resource, hierarchy)
- `handle_assignment_change()`: Process assignment changes and invalidate caches
- `register_custom_rule()`: Add custom permission rules
- `trigger_assignment_change()`: Trigger assignment change events

#### `AssignmentChangeEvent`
- Represents changes in user assignments (project, portfolio, organization)
- Tracks action type (added, removed, modified)
- Used for automatic permission synchronization

#### `PermissionEvaluationResult`
- Detailed result of permission evaluation
- Includes evaluation path, applied rules, and source roles
- Provides transparency into how permissions were determined

#### `CustomPermissionRule`
- Base class for custom permission rules
- Allows extending the system with business-specific logic
- Can override base permission results

**Requirements Satisfied**:
- 7.1: Context-aware permission evaluation
- 7.2: Automatic permission updates on assignment changes
- 7.3: Multi-level permission verification
- 7.5: Custom permission logic based on business rules

### 2. Time-Based Permission System (`time_based_permissions.py`)

**Purpose**: Manage time-based permissions with expiration and scheduling.

**Key Features**:
- Permission expiration enforcement
- Scheduled permission grants
- Time-window based permissions (e.g., business hours only)
- Automatic cleanup of expired permissions

**Main Classes**:

#### `TimeBasedPermission`
- Model for time-based permission grants
- Supports start dates, expiration dates, and recurring time windows
- `is_valid_at()`: Check if permission is valid at a specific time
- `time_until_expiration()`: Calculate remaining time

#### `TimeBasedPermissionManager`
- `grant_temporary_permission()`: Grant permission for a specific duration
- `grant_scheduled_permission()`: Grant permission for a specific time period
- `grant_time_window_permission()`: Grant permission during specific time windows
- `check_time_based_permission()`: Check if user has time-based permission
- `cleanup_expired_permissions()`: Remove expired permissions

**Time Window Support**:
- Days of week (e.g., Monday-Friday)
- Hours of day (e.g., 9:00-17:00)
- Specific date ranges
- Combinations of the above

**Requirements Satisfied**:
- 7.4: Time-based permissions with expiration enforcement

### 3. Custom Permission Rules (`custom_permission_rules.py`)

**Purpose**: Example custom permission rules demonstrating system extensibility.

**Implemented Rules**:

#### `ProjectOwnerRule`
- Grants full project permissions to project creators
- Business rule: Project owners have full access regardless of role

#### `EmergencyAccessRule`
- Provides emergency access during critical situations
- Can be activated/deactivated for specific users
- Useful for incident response scenarios

#### `DataClassificationRule`
- Enforces data classification access controls
- Supports levels: public, internal, confidential, secret
- Users can only access data at or below their clearance level

#### `BusinessHoursRule`
- Restricts sensitive operations to business hours
- Prevents deletions outside of support hours
- Configurable hours and days

#### `DelegationRule`
- Allows users to delegate permissions to others
- Useful for vacation coverage or temporary assignments
- Supports expiration dates

**Requirements Satisfied**:
- 7.5: Custom permission logic based on business rules

### 4. Property-Based Tests (`test_property_dynamic_evaluation.py`)

**Purpose**: Comprehensive property-based testing of dynamic evaluation system.

**Test Properties**:

#### Property 28: Context-Aware Permission Evaluation
- Validates that evaluation considers all hierarchy levels
- Tests consistency across multiple evaluations
- Verifies evaluation path includes all relevant checks

#### Property 29: Assignment Change Permission Synchronization
- Validates cache invalidation on assignment changes
- Tests listener notification system
- Ensures automatic permission updates

#### Property 30: Multi-Level Permission Verification
- Validates all levels are checked (role, resource, hierarchy)
- Tests consistency of multi-level results
- Verifies overall result logic

#### Property 31: Time-Based Permission Support
- Validates permission validity periods
- Tests scheduled permission windows
- Verifies expiration calculation accuracy

#### Property 32: Custom Permission Logic Extensibility
- Validates custom rule registration and evaluation
- Tests rule override capabilities
- Verifies rule unregistration

**Test Statistics**:
- 13 property tests implemented
- 100+ iterations per test (via Hypothesis)
- All tests passing
- Comprehensive coverage of requirements 7.1-7.5

## Architecture

### Permission Evaluation Flow

```
1. Standard Role-Based Check
   ↓
2. Project Hierarchy Check (if project context)
   ↓
3. Resource-Specific Check (if resource context)
   ↓
4. Custom Rule Evaluation
   ↓
5. Return Detailed Result
```

### Assignment Change Flow

```
User Assignment Changes
   ↓
Trigger AssignmentChangeEvent
   ↓
Clear Permission Caches
   ↓
Notify Registered Listeners
   ↓
Update User Sessions
```

### Time-Based Permission Flow

```
Grant Time-Based Permission
   ↓
Store in Database & Cache
   ↓
Check Validity at Access Time
   ↓
Automatic Cleanup on Expiration
```

## Integration Points

### With Existing RBAC System

The dynamic evaluation system extends the existing `EnhancedPermissionChecker`:

```python
# Create evaluator with existing checker
checker = EnhancedPermissionChecker(supabase_client)
evaluator = DynamicPermissionEvaluator(
    permission_checker=checker,
    supabase_client=supabase
)

# Use for enhanced evaluation
result = await evaluator.evaluate_permission(
    user_id, permission, context
)
```

### With FastAPI Endpoints

```python
from auth.dynamic_permission_evaluator import get_dynamic_permission_evaluator

evaluator = get_dynamic_permission_evaluator()

# In endpoint
@router.post("/projects/{project_id}/update")
async def update_project(
    project_id: UUID,
    current_user = Depends(get_current_user)
):
    context = PermissionContext(project_id=project_id)
    result = await evaluator.evaluate_permission(
        current_user.id,
        Permission.project_update,
        context
    )
    
    if not result.has_permission:
        raise HTTPException(403, detail="Insufficient permissions")
```

### With Assignment Management

```python
# When user is assigned to a project
await evaluator.trigger_assignment_change(
    user_id=user_id,
    assignment_type="project",
    assignment_id=project_id,
    action="added"
)
```

## Database Schema Requirements

### New Tables

#### `time_based_permissions`
```sql
CREATE TABLE time_based_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    permission TEXT NOT NULL,
    project_id UUID REFERENCES projects(id),
    portfolio_id UUID REFERENCES portfolios(id),
    organization_id UUID REFERENCES organizations(id),
    resource_id UUID,
    starts_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    time_windows JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_time_based_perms_user ON time_based_permissions(user_id);
CREATE INDEX idx_time_based_perms_expires ON time_based_permissions(expires_at);
```

#### `resource_permissions`
```sql
CREATE TABLE resource_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    resource_id UUID NOT NULL,
    permission TEXT NOT NULL,
    granted BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_resource_perms_user_resource ON resource_permissions(user_id, resource_id);
```

#### `project_assignments`
```sql
CREATE TABLE project_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    project_id UUID NOT NULL REFERENCES projects(id),
    is_active BOOLEAN DEFAULT TRUE,
    assigned_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_project_assignments_user ON project_assignments(user_id);
CREATE INDEX idx_project_assignments_project ON project_assignments(project_id);
```

### Schema Updates

#### `projects` table
```sql
-- Add parent_project_id for hierarchy support
ALTER TABLE projects ADD COLUMN parent_project_id UUID REFERENCES projects(id);
```

## Usage Examples

### Example 1: Context-Aware Evaluation

```python
from auth.dynamic_permission_evaluator import get_dynamic_permission_evaluator
from auth.enhanced_rbac_models import PermissionContext
from auth.rbac import Permission

evaluator = get_dynamic_permission_evaluator()

# Evaluate with project context
context = PermissionContext(project_id=project_id)
result = await evaluator.evaluate_permission(
    user_id=user_id,
    permission=Permission.project_update,
    context=context
)

print(f"Has permission: {result.has_permission}")
print(f"Evaluation path: {result.evaluation_path}")
print(f"Applied rules: {result.applied_rules}")
print(f"Source roles: {result.source_roles}")
```

### Example 2: Time-Based Permissions

```python
from auth.time_based_permissions import get_time_based_permission_manager
from datetime import timedelta

manager = get_time_based_permission_manager()

# Grant temporary access for 24 hours
await manager.grant_temporary_permission(
    user_id=contractor_id,
    permission=Permission.project_read,
    duration=timedelta(hours=24),
    context=PermissionContext(project_id=project_id)
)

# Grant business hours access
await manager.grant_time_window_permission(
    user_id=user_id,
    permission=Permission.financial_update,
    time_windows=[{
        "days_of_week": [0, 1, 2, 3, 4],  # Mon-Fri
        "start_hour": 9,
        "end_hour": 17
    }]
)
```

### Example 3: Custom Permission Rules

```python
from auth.dynamic_permission_evaluator import get_dynamic_permission_evaluator
from auth.custom_permission_rules import ProjectOwnerRule, BusinessHoursRule

evaluator = get_dynamic_permission_evaluator()

# Register custom rules
evaluator.register_custom_rule(ProjectOwnerRule(supabase))
evaluator.register_custom_rule(BusinessHoursRule(
    start_hour=9,
    end_hour=17,
    business_days=[0, 1, 2, 3, 4]  # Mon-Fri
))

# Permissions will now be evaluated with custom rules
result = await evaluator.evaluate_permission(
    user_id=user_id,
    permission=Permission.project_delete,
    context=context
)
```

### Example 4: Assignment Change Handling

```python
from auth.dynamic_permission_evaluator import get_dynamic_permission_evaluator

evaluator = get_dynamic_permission_evaluator()

# Register a listener for assignment changes
async def on_assignment_change(event):
    print(f"User {event.user_id} assignment changed: {event.action}")
    # Send notification, update UI, etc.

evaluator.register_assignment_listener(on_assignment_change)

# Trigger assignment change
await evaluator.trigger_assignment_change(
    user_id=user_id,
    assignment_type="project",
    assignment_id=project_id,
    action="added"
)
```

### Example 5: Multi-Level Verification

```python
from auth.dynamic_permission_evaluator import get_dynamic_permission_evaluator

evaluator = get_dynamic_permission_evaluator()

# Verify permission at all levels
results = await evaluator.verify_multi_level_permission(
    user_id=user_id,
    permission=Permission.resource_update,
    context=PermissionContext(
        project_id=project_id,
        resource_id=resource_id
    )
)

print(f"Role-based: {results['role_based']}")
print(f"Resource-specific: {results['resource_specific']}")
print(f"Hierarchy-based: {results['hierarchy_based']}")
print(f"Overall: {results['overall']}")
```

## Performance Considerations

### Caching Strategy

1. **Permission Cache**: Results cached for 5 minutes (configurable)
2. **Hierarchy Cache**: Project/portfolio relationships cached
3. **Time-Based Cache**: Active permissions cached in memory
4. **Automatic Invalidation**: Caches cleared on assignment changes

### Optimization Tips

1. Use context-specific checks when possible (more cacheable)
2. Register custom rules sparingly (evaluated on every check)
3. Clean up expired time-based permissions regularly
4. Use batch operations for multiple permission checks

## Testing

### Running Property Tests

```bash
# Run all dynamic evaluation tests
pytest tests/test_property_dynamic_evaluation.py -v

# Run specific property test
pytest tests/test_property_dynamic_evaluation.py::TestContextAwarePermissionEvaluation -v

# Run with coverage
pytest tests/test_property_dynamic_evaluation.py --cov=auth.dynamic_permission_evaluator
```

### Test Coverage

- Context-aware evaluation: ✓
- Assignment change synchronization: ✓
- Multi-level verification: ✓
- Time-based permissions: ✓
- Custom permission rules: ✓
- Integration scenarios: ✓

## Future Enhancements

### Potential Additions

1. **Permission Analytics**: Track permission usage patterns
2. **Audit Trail**: Log all permission evaluations
3. **Permission Recommendations**: Suggest optimal permission sets
4. **Bulk Operations**: Batch permission checks for efficiency
5. **Permission Templates**: Pre-defined permission sets for common roles
6. **Conditional Permissions**: Permissions based on resource state

### Scalability Improvements

1. **Redis Caching**: Move caches to Redis for distributed systems
2. **Database Optimization**: Add more indexes for common queries
3. **Async Processing**: Background processing for assignment changes
4. **Permission Preloading**: Preload permissions during session initialization

## Conclusion

The Dynamic Permission Evaluation System provides a comprehensive, extensible framework for context-aware permission management. It successfully implements all requirements (7.1-7.5) with full property-based test coverage, ensuring robust and reliable permission evaluation across the application.

The system is designed to be:
- **Flexible**: Supports custom rules and time-based permissions
- **Performant**: Intelligent caching and efficient queries
- **Maintainable**: Clear separation of concerns and comprehensive tests
- **Extensible**: Easy to add new permission logic without modifying core code

All property tests pass with 100+ iterations each, validating the correctness of the implementation across a wide range of scenarios.
