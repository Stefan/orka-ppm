# Workflow Engine Core Infrastructure

## Overview

The Workflow Engine Core Infrastructure provides a comprehensive system for managing approval workflows within the PPM platform. This implementation establishes the foundation for workflow definition, instance execution, approval processing, and state management.

## Architecture

The workflow engine follows a layered architecture:

```
┌─────────────────────────────────────────┐
│         API Layer (Future)              │
│  (FastAPI endpoints for workflows)      │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│      Workflow Engine Core               │
│  (Business logic & orchestration)       │
│  - WorkflowEngineCore                   │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│      Repository Layer                   │
│  (Database abstraction)                 │
│  - WorkflowRepository                   │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│      Data Models                        │
│  (Pydantic models)                      │
│  - WorkflowDefinition                   │
│  - WorkflowInstance                     │
│  - WorkflowApproval                     │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│      Database (Supabase)                │
│  - workflows                            │
│  - workflow_instances                   │
│  - workflow_approvals                   │
└─────────────────────────────────────────┘
```

## Components

### 1. Data Models (`models/workflow.py`)

#### Core Models

**WorkflowDefinition**
- Defines the structure and steps of a workflow
- Contains workflow metadata, steps, and triggers
- Validates step ordering and configuration

**WorkflowInstance**
- Represents a specific execution of a workflow
- Tracks current state, context, and progress
- Links to the workflow definition and entity

**WorkflowApproval**
- Represents an individual approval decision
- Tracks approver, status, and decision details
- Links to workflow instance and step

#### Supporting Models

**WorkflowStep**
- Defines a single step in a workflow
- Specifies approvers, approval type, and conditions
- Supports timeout and auto-approval configuration

**WorkflowTrigger**
- Defines automatic workflow initiation conditions
- Supports threshold-based triggers
- Configurable for different entity types

#### Enums

- `WorkflowStatus`: draft, active, pending, in_progress, completed, rejected, cancelled
- `ApprovalStatus`: pending, approved, rejected, delegated, expired
- `ApprovalType`: any, all, majority, quorum
- `StepType`: approval, notification, condition, automated

### 2. Repository Layer (`services/workflow_repository.py`)

The repository provides database abstraction for all workflow operations:

#### Workflow Definition Operations
- `create_workflow()`: Create new workflow definition
- `get_workflow()`: Retrieve workflow by ID
- `list_workflows()`: List workflows with filtering
- `update_workflow()`: Update workflow definition
- `delete_workflow()`: Delete workflow definition

#### Workflow Instance Operations
- `create_workflow_instance()`: Create new instance
- `get_workflow_instance()`: Retrieve instance by ID
- `update_workflow_instance()`: Update instance state
- `list_workflow_instances()`: List instances with filtering

#### Workflow Approval Operations
- `create_approval()`: Create approval record
- `update_approval()`: Update approval decision
- `get_approvals_for_instance()`: Get all approvals for instance
- `get_pending_approvals_for_user()`: Get user's pending approvals
- `get_approval_by_id()`: Retrieve specific approval

### 3. Workflow Engine Core (`services/workflow_engine_core.py`)

The core engine orchestrates workflow execution:

#### Instance Management
- `create_workflow_instance()`: Initialize new workflow execution
  - Validates workflow definition
  - Creates initial approval records
  - Sets up workflow context

- `get_workflow_instance_status()`: Get detailed instance status
  - Returns instance data with all approvals
  - Groups approvals by step
  - Includes workflow metadata

#### Approval Processing
- `submit_approval_decision()`: Process approval decision
  - Validates approver and decision
  - Updates approval status
  - Handles rejection or advancement
  - Checks step completion

- `get_pending_approvals()`: Get user's pending approvals
  - Returns formatted pending approval list
  - Includes workflow context
  - Supports pagination

#### State Management (Internal)
- `_advance_workflow_step()`: Move to next step
  - Checks if workflow is complete
  - Creates approvals for next step
  - Updates instance status

- `_handle_workflow_rejection()`: Handle rejection
  - Updates instance to rejected status
  - Records rejection reason
  - Logs rejection event

- `_check_step_completion()`: Check if step is complete
  - Evaluates based on approval type
  - Counts approved approvals
  - Returns completion status

- `_create_approvals_for_step()`: Create approval records
  - Resolves approvers from step definition
  - Creates approval records
  - Sets expiration if configured

## Database Schema

### workflows table
```sql
CREATE TABLE workflows (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    template_data JSONB NOT NULL,  -- Contains steps, triggers, metadata
    status workflow_status DEFAULT 'draft',
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
);
```

### workflow_instances table
```sql
CREATE TABLE workflow_instances (
    id UUID PRIMARY KEY,
    workflow_id UUID REFERENCES workflows(id),
    project_id UUID REFERENCES projects(id),
    entity_type VARCHAR(50),
    entity_id UUID,
    current_step INTEGER DEFAULT 0,
    status workflow_status DEFAULT 'pending',
    data JSONB DEFAULT '{}',  -- Context data
    started_by UUID REFERENCES auth.users(id),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
);
```

### workflow_approvals table
```sql
CREATE TABLE workflow_approvals (
    id UUID PRIMARY KEY,
    workflow_instance_id UUID REFERENCES workflow_instances(id),
    step_number INTEGER NOT NULL,
    approver_id UUID REFERENCES auth.users(id),
    status approval_status DEFAULT 'pending',
    comments TEXT,
    approved_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
);
```

## Usage Examples

### Creating a Workflow Definition

```python
from models.workflow import WorkflowDefinition, WorkflowStep, ApprovalType
from services.workflow_repository import WorkflowRepository

# Define workflow steps
step1 = WorkflowStep(
    step_order=0,
    name="Manager Approval",
    description="Project manager must approve",
    approver_roles=["project_manager"],
    approval_type=ApprovalType.ALL,
    timeout_hours=48
)

step2 = WorkflowStep(
    step_order=1,
    name="Portfolio Manager Approval",
    description="Portfolio manager must approve",
    approver_roles=["portfolio_manager"],
    approval_type=ApprovalType.ANY,
    timeout_hours=72
)

# Create workflow definition
workflow = WorkflowDefinition(
    name="Budget Approval Workflow",
    description="Approval workflow for budget variances",
    steps=[step1, step2],
    status=WorkflowStatus.ACTIVE
)

# Save to database
repository = WorkflowRepository(db)
workflow_data = await repository.create_workflow(workflow)
```

### Initiating a Workflow Instance

```python
from services.workflow_engine_core import WorkflowEngineCore

engine = WorkflowEngineCore(db)

# Create workflow instance
instance = await engine.create_workflow_instance(
    workflow_id=workflow_id,
    entity_type="financial_tracking",
    entity_id=financial_record_id,
    initiated_by=user_id,
    context={
        "variance_amount": 50000,
        "variance_percentage": 15.5,
        "budget_category": "construction"
    }
)

print(f"Workflow instance created: {instance.id}")
print(f"Status: {instance.status}")
print(f"Current step: {instance.current_step}")
```

### Submitting an Approval Decision

```python
# Get pending approvals for user
pending_approvals = await engine.get_pending_approvals(user_id)

# Submit approval decision
result = await engine.submit_approval_decision(
    approval_id=pending_approvals[0].approval_id,
    approver_id=user_id,
    decision="approved",
    comments="Budget variance is justified due to material cost increases"
)

print(f"Decision: {result['decision']}")
print(f"Workflow status: {result['workflow_status']}")
print(f"Is complete: {result['is_complete']}")
```

### Checking Workflow Status

```python
# Get detailed workflow status
status = await engine.get_workflow_instance_status(instance_id)

print(f"Workflow: {status['workflow_name']}")
print(f"Status: {status['status']}")
print(f"Current step: {status['current_step']}")

# Check approvals by step
for step_num, approvals in status['approvals'].items():
    print(f"\nStep {step_num}:")
    for approval in approvals:
        print(f"  - Approver: {approval['approver_id']}")
        print(f"    Status: {approval['status']}")
        print(f"    Comments: {approval['comments']}")
```

## Approval Types

The workflow engine supports four approval types:

### ANY
- **Behavior**: Any single approver can approve the step
- **Use case**: Quick approvals where any authorized person can decide
- **Example**: Routine expense approvals under $1000

### ALL
- **Behavior**: All designated approvers must approve
- **Use case**: Critical decisions requiring consensus
- **Example**: Major budget changes requiring multiple stakeholders

### MAJORITY
- **Behavior**: More than 50% of approvers must approve
- **Use case**: Democratic decision-making
- **Example**: Committee decisions with multiple voting members

### QUORUM
- **Behavior**: Specific number of approvers must approve
- **Use case**: Flexible approval requirements
- **Example**: Board decisions requiring 3 out of 5 members

## State Transitions

### Workflow Instance States

```
PENDING → IN_PROGRESS → COMPLETED
    ↓           ↓
CANCELLED   REJECTED
```

- **PENDING**: Instance created, waiting to start
- **IN_PROGRESS**: Actively processing approvals
- **COMPLETED**: All steps approved successfully
- **REJECTED**: Approval rejected at any step
- **CANCELLED**: Manually cancelled by user

### Approval States

```
PENDING → APPROVED
    ↓
REJECTED
    ↓
DELEGATED
```

- **PENDING**: Awaiting approver decision
- **APPROVED**: Approver approved the request
- **REJECTED**: Approver rejected the request
- **DELEGATED**: Approval delegated to another user
- **EXPIRED**: Approval timeout exceeded

## Error Handling

The workflow engine implements comprehensive error handling:

### Validation Errors
- Invalid workflow definitions
- Missing required fields
- Invalid state transitions
- Unauthorized approvers

### Runtime Errors
- Database connection failures
- Transaction failures
- Concurrent modification conflicts

### Recovery Mechanisms
- Transaction rollback on errors
- Detailed error logging
- Graceful degradation
- User-friendly error messages

## Testing

The core infrastructure includes comprehensive unit tests:

```bash
# Run workflow core tests
cd backend
python -m pytest tests/test_workflow_core_infrastructure.py -v

# Run with coverage
python -m pytest tests/test_workflow_core_infrastructure.py --cov=services --cov=models
```

### Test Coverage

- ✅ Model validation and structure
- ✅ Repository database operations
- ✅ Engine initialization and validation
- ✅ State transition logic
- ✅ Approval type handling
- ✅ Error handling and edge cases

## Future Enhancements

### Planned Features
1. **API Endpoints**: FastAPI routes for workflow management
2. **Role-based Approver Resolution**: Automatic approver lookup from RBAC
3. **Notification System**: Email and in-app notifications
4. **Workflow Templates**: Pre-defined workflow templates
5. **Delegation Support**: Approval delegation to other users
6. **Escalation**: Automatic escalation on timeout
7. **Audit Trail**: Comprehensive audit logging
8. **Analytics**: Workflow performance metrics

### Integration Points
- **RBAC System**: Role-based approver resolution
- **Notification Service**: Approval notifications
- **Audit System**: Workflow event logging
- **Dashboard**: Workflow status visualization
- **PPM Features**: Automatic workflow triggers

## Requirements Validation

This implementation satisfies the following requirements:

✅ **Requirement 1.1**: Workflow definitions stored with steps, approvers, and conditions
✅ **Requirement 2.1**: Workflow instances created with initial status and metadata
✅ **Requirement 2.2**: Approval step processing with sequence enforcement
✅ **Requirement 2.3**: Approval decisions recorded with timestamp and comments

## Performance Considerations

- **Database Queries**: Optimized with proper indexing
- **Batch Operations**: Support for bulk approval creation
- **Caching**: Repository layer ready for caching integration
- **Async Operations**: All operations use async/await pattern
- **Transaction Management**: Proper transaction handling for consistency

## Security Considerations

- **Authorization**: Approver validation before decision submission
- **Data Validation**: Comprehensive input validation using Pydantic
- **SQL Injection**: Protected by Supabase client parameterization
- **Audit Trail**: All operations logged for accountability
- **Access Control**: Integration with existing RBAC system

## Maintenance

### Logging
- All operations logged with appropriate levels
- Error details captured for debugging
- Performance metrics tracked

### Monitoring
- Database query performance
- Workflow execution times
- Approval response times
- Error rates and types

## Support

For questions or issues:
1. Check this documentation
2. Review test cases for usage examples
3. Check logs for error details
4. Consult the design document for architecture details

## Version History

- **v1.0.0** (2024-01-15): Initial core infrastructure implementation
  - Workflow models and validation
  - Repository layer with database operations
  - Core engine with state management
  - Comprehensive unit tests
