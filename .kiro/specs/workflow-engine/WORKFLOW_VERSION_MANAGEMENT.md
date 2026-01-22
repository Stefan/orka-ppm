# Workflow Version Management Implementation

## Overview

This document describes the workflow version management implementation for the workflow engine. The system ensures that existing workflow instances continue to use their original workflow definitions even when workflows are updated, satisfying **Requirement 1.4**.

## Key Features

### 1. Version Tracking
- Each workflow definition has a `version` field (starting at 1)
- When a workflow instance is created, the current workflow version is stored in the instance's context data
- Instances always reference their original workflow version, ensuring consistent behavior

### 2. Version History
- When a workflow is updated, the current version is archived in `version_history`
- Historical versions are preserved in the workflow record
- Any version can be retrieved for inspection or instance execution

### 3. Instance Preservation
- Updating a workflow creates a new version without affecting existing instances
- Active instances continue using their original workflow definition
- New instances automatically use the latest workflow version

### 4. Version Migration (Optional)
- Instances can be manually migrated to different workflow versions
- Migration is tracked with metadata (from_version, to_version, migrated_at, migrated_by)
- Only in-progress instances can be migrated (completed/rejected instances are immutable)

## Implementation Details

### Core Components

#### 1. WorkflowRepository (`backend/services/workflow_repository.py`)

**New Methods:**
- `create_workflow_instance_with_version()` - Creates instance with explicit version tracking
- `create_workflow_version()` - Creates new workflow version while preserving history
- `get_workflow_version()` - Retrieves specific workflow version
- `list_workflow_versions()` - Lists all versions of a workflow
- `get_workflow_for_instance()` - Gets the correct workflow version for an instance

**Key Logic:**
```python
# When creating a new version:
1. Get current workflow definition
2. Extract current version from template_data
3. Archive current version in version_history
4. Increment version number
5. Update workflow with new version and archived history
```

#### 2. WorkflowEngineCore (`backend/services/workflow_engine_core.py`)

**Updated Methods:**
- `create_workflow_instance()` - Now stores workflow version with instance
- `_advance_workflow_step()` - Uses `get_workflow_for_instance()` to get correct version
- `_check_step_completion()` - Uses correct workflow version for approval logic

**Key Changes:**
```python
# Instance creation now includes version:
instance_data = await self.repository.create_workflow_instance_with_version(
    instance,
    workflow_version  # Current version at time of creation
)

# Workflow operations use instance-specific version:
workflow_data = await self.repository.get_workflow_for_instance(instance_id)
```

#### 3. WorkflowVersionService (`backend/services/workflow_version_service.py`)

**New Service Class** providing high-level version management:

**Methods:**
- `create_new_version()` - Creates new workflow version with preservation logic
- `get_version_history()` - Retrieves version history with instance counts
- `get_workflow_version()` - Gets specific version
- `migrate_instance_to_version()` - Migrates instance to different version
- `compare_versions()` - Compares two workflow versions

**Features:**
- Counts active instances before version creation
- Tracks instance counts per version
- Validates migration operations
- Provides version comparison for change analysis

### Data Structure

#### Workflow Record
```json
{
  "id": "uuid",
  "name": "Budget Approval Workflow",
  "template_data": {
    "version": 2,
    "steps": [...],
    "triggers": [...],
    "metadata": {}
  },
  "version_history": [
    {
      "version": 1,
      "steps": [...],
      "triggers": [...],
      "metadata": {},
      "created_at": "2024-01-15T10:00:00Z",
      "archived_at": "2024-01-20T15:30:00Z"
    }
  ]
}
```

#### Workflow Instance Record
```json
{
  "id": "uuid",
  "workflow_id": "uuid",
  "data": {
    "workflow_version": 1,  // Version at creation time
    "version_migration": {   // Optional, if migrated
      "from_version": 1,
      "to_version": 2,
      "migrated_at": "2024-01-25T12:00:00Z",
      "migrated_by": "user-uuid"
    }
  }
}
```

## Usage Examples

### Creating a New Workflow Version

```python
from services.workflow_version_service import WorkflowVersionService

version_service = WorkflowVersionService(db)

# Create updated workflow definition
updated_workflow = WorkflowDefinition(
    name="Budget Approval Workflow",
    description="Updated with additional approval step",
    steps=[...],  # New steps
    triggers=[...],
    status=WorkflowStatus.ACTIVE,
    version=2  # Will be set automatically
)

# Create new version
result = await version_service.create_new_version(
    workflow_id=workflow_id,
    updated_workflow=updated_workflow,
    user_id=current_user_id
)

print(f"Created version {result['version']}")
print(f"Preserved {result['active_instances_preserved']} active instances")
```

### Retrieving Version History

```python
# Get all versions of a workflow
versions = await version_service.get_version_history(workflow_id)

for version in versions:
    print(f"Version {version['version']}: "
          f"{version['step_count']} steps, "
          f"{version['instance_count']} instances, "
          f"Current: {version['is_current']}")
```

### Migrating an Instance

```python
# Migrate instance to a different version (use with caution)
result = await version_service.migrate_instance_to_version(
    instance_id=instance_id,
    target_version=2,
    user_id=current_user_id
)

print(f"Migrated from v{result['from_version']} to v{result['to_version']}")
```

### Comparing Versions

```python
# Compare two versions to see what changed
comparison = await version_service.compare_versions(
    workflow_id=workflow_id,
    version1=1,
    version2=2
)

if comparison['changes']['steps_changed']:
    print(f"Steps changed: {comparison['changes']['step_count_v1']} -> "
          f"{comparison['changes']['step_count_v2']}")
```

## Testing

### Unit Tests
- **test_workflow_version_management.py** - 12 tests covering:
  - Version creation and preservation
  - Version history retrieval
  - Instance migration
  - Version comparison
  - Instance counting by version

### Integration Tests
- **test_workflow_version_integration.py** - 7 tests covering:
  - Complete version lifecycle
  - Instance creation with version tracking
  - Workflow updates preserving instances
  - Version retrieval for instances
  - Migration workflows

### Existing Tests
- All existing workflow engine tests continue to pass
- Backward compatibility maintained for instances without version tracking

## Database Considerations

### Schema Updates
The implementation uses existing database fields:
- `workflows.template_data` - Stores version and version_history
- `workflow_instances.data` - Stores workflow_version

No schema migrations required - the system works with existing tables.

### Performance
- Version history is stored as JSONB in the workflow record
- Retrieving historical versions requires parsing version_history array
- For high-volume systems, consider indexing on workflow_version in instance data

## Best Practices

### When to Create a New Version
Create a new version when:
- Adding or removing workflow steps
- Changing approval requirements (ANY → ALL, etc.)
- Modifying step order or dependencies
- Updating trigger conditions

### When NOT to Create a New Version
Don't create a new version for:
- Cosmetic changes (name, description)
- Metadata updates
- Status changes (draft → active)

### Migration Guidelines
- Only migrate instances when absolutely necessary
- Test migrations on non-production instances first
- Document the reason for migration
- Notify affected users before migration

## Future Enhancements

### Potential Improvements
1. **Automatic Migration Rules** - Define rules for automatic instance migration
2. **Version Rollback** - Ability to rollback to previous workflow version
3. **Version Branching** - Support for parallel workflow versions
4. **Migration Validation** - Pre-migration checks for compatibility
5. **Version Diff Visualization** - UI for comparing workflow versions

### API Endpoints (Future)
```
GET    /workflows/{id}/versions           - List versions
GET    /workflows/{id}/versions/{version} - Get specific version
POST   /workflows/{id}/versions           - Create new version
POST   /instances/{id}/migrate            - Migrate instance
GET    /workflows/{id}/versions/compare   - Compare versions
```

## Compliance with Requirements

### Requirement 1.4
> "WHEN updating workflow definitions, THE Workflow_Engine SHALL preserve existing workflow instances while applying changes to new instances"

**Implementation:**
✅ Existing instances store their workflow version in context data
✅ Instance operations use `get_workflow_for_instance()` to retrieve correct version
✅ New instances automatically use the latest workflow version
✅ Version history preserves all historical workflow definitions
✅ Active instances are counted and reported during version creation

## Summary

The workflow version management system provides robust version control for workflow definitions while ensuring existing workflow instances continue to function correctly. The implementation is backward-compatible, well-tested, and ready for production use.

**Key Benefits:**
- Zero disruption to active workflows during updates
- Complete version history for audit and compliance
- Flexible migration capabilities when needed
- Clear separation between workflow definition versions and instance execution
- Comprehensive testing coverage (19 tests, all passing)
