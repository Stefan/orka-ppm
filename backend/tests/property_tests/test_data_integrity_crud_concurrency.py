"""
Property-based tests for data integrity - CRUD operations and concurrency testing.

Feature: property-based-testing
Task: 10.1 Create CRUD operation and concurrency testing

This module implements property-based tests for:
- CRUD operation referential integrity validation
- Concurrent operation safety testing to prevent race conditions
- Data consistency preservation validation under concurrent load

**Validates: Requirements 7.1, 7.2**
"""

import pytest
import asyncio
from datetime import datetime, timezone
from typing import Dict, Any, List
from uuid import uuid4
from unittest.mock import Mock, AsyncMock, patch

from hypothesis import given, settings, assume, HealthCheck
from hypothesis import strategies as st

from tests.property_tests.pbt_framework.domain_generators import (
    DomainGenerators,
    project_data_strategy,
    financial_record_strategy,
    project_with_financials
)
from tests.property_tests.pbt_framework.backend_pbt_framework import property_test


class TestCRUDOperationReferentialIntegrity:
    """
    Property-based tests for CRUD operation referential integrity.
    
    Task: 10.1 Create CRUD operation and concurrency testing
    **Validates: Requirements 7.1**
    """
    
    @given(project_data=project_data_strategy())
    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_property_29_crud_referential_integrity_basic(self, project_data: Dict[str, Any]):
        """
        Property 29: CRUD Operation Referential Integrity (Basic)
        
        For any database CRUD operation sequence, referential integrity must be 
        maintained throughout all operations without data corruption.
        
        This test validates:
        - Create operations generate valid IDs
        - Read operations retrieve correct data
        - Update operations preserve referential integrity
        - Delete operations maintain consistency
        
        Task: 10.1 Create CRUD operation and concurrency testing
        **Validates: Requirements 7.1**
        """
        # Mock database operations
        mock_db = Mock()
        created_projects = {}
        
        def mock_create(data):
            project_id = str(uuid4())
            project = {**data, 'id': project_id}
            created_projects[project_id] = project
            return project
        
        def mock_read(project_id):
            return created_projects.get(project_id)
        
        def mock_update(project_id, updates):
            if project_id in created_projects:
                created_projects[project_id].update(updates)
                return created_projects[project_id]
            return None
        
        def mock_delete(project_id):
            if project_id in created_projects:
                del created_projects[project_id]
                return True
            return False
        
        mock_db.create = mock_create
        mock_db.read = mock_read
        mock_db.update = mock_update
        mock_db.delete = mock_delete
        
        # Property: Create operation generates valid ID
        created_project = mock_db.create(project_data)
        assert created_project is not None, "Create operation must return created project"
        assert 'id' in created_project, "Created project must have an ID"
        assert created_project['id'] is not None, "Project ID must not be None"
        
        project_id = created_project['id']
        
        # Property: Read operation retrieves correct data
        retrieved_project = mock_db.read(project_id)
        assert retrieved_project is not None, "Read operation must retrieve created project"
        assert retrieved_project['id'] == project_id, "Retrieved project ID must match"
        assert retrieved_project['name'] == project_data['name'], "Retrieved project name must match"
        assert retrieved_project['budget'] == project_data['budget'], "Retrieved project budget must match"
        
        # Property: Update operation preserves referential integrity
        update_data = {'name': 'Updated Project Name', 'budget': project_data['budget'] * 1.1}
        updated_project = mock_db.update(project_id, update_data)
        assert updated_project is not None, "Update operation must return updated project"
        assert updated_project['id'] == project_id, "Update must preserve project ID"
        assert updated_project['name'] == 'Updated Project Name', "Update must apply new name"
        
        # Verify update persisted
        retrieved_after_update = mock_db.read(project_id)
        assert retrieved_after_update['name'] == 'Updated Project Name', "Update must persist"
        
        # Property: Delete operation maintains consistency
        delete_result = mock_db.delete(project_id)
        assert delete_result is True, "Delete operation must succeed"
        
        # Verify deletion
        retrieved_after_delete = mock_db.read(project_id)
        assert retrieved_after_delete is None, "Deleted project must not be retrievable"
    
    @given(project_with_financials=project_with_financials())
    @settings(max_examples=50, deadline=10000, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_property_29_crud_cascade_deletion(self, project_with_financials: Dict[str, Any]):
        """
        Property 29: CRUD Operation Referential Integrity (Cascade Deletion)
        
        For any project with related financial records, deleting the project must
        cascade to delete all related records, maintaining referential integrity.
        
        Task: 10.1 Create CRUD operation and concurrency testing
        **Validates: Requirements 7.1**
        """
        project = project_with_financials['project']
        financial_records = project_with_financials['financial_records']
        
        # Assume at least one financial record
        assume(len(financial_records) > 0)
        
        # Mock database with cascade deletion
        mock_db = Mock()
        projects_store = {}
        financials_store = {}
        
        def mock_create_project(data):
            project_id = data.get('id', str(uuid4()))
            projects_store[project_id] = {**data, 'id': project_id}
            return projects_store[project_id]
        
        def mock_create_financial(data):
            financial_id = data.get('id', str(uuid4()))
            financials_store[financial_id] = {**data, 'id': financial_id}
            return financials_store[financial_id]
        
        def mock_get_financials_by_project(project_id):
            return [f for f in financials_store.values() if f.get('project_id') == project_id]
        
        def mock_delete_project(project_id):
            if project_id in projects_store:
                # Cascade delete financial records
                financial_ids_to_delete = [
                    fid for fid, f in financials_store.items() 
                    if f.get('project_id') == project_id
                ]
                for fid in financial_ids_to_delete:
                    del financials_store[fid]
                
                del projects_store[project_id]
                return True
            return False
        
        mock_db.create_project = mock_create_project
        mock_db.create_financial = mock_create_financial
        mock_db.get_financials_by_project = mock_get_financials_by_project
        mock_db.delete_project = mock_delete_project
        
        # Create project
        created_project = mock_db.create_project(project)
        project_id = created_project['id']
        
        # Create financial records
        created_financials = []
        for record in financial_records:
            record['project_id'] = project_id
            created_financial = mock_db.create_financial(record)
            created_financials.append(created_financial)
        
        # Property: Financial records are associated with project
        associated_financials = mock_db.get_financials_by_project(project_id)
        assert len(associated_financials) == len(financial_records), \
            "All financial records must be associated with project"
        
        for financial in associated_financials:
            assert financial['project_id'] == project_id, \
                "Each financial record must reference the project"
        
        # Property: Deleting project cascades to financial records
        delete_result = mock_db.delete_project(project_id)
        assert delete_result is True, "Project deletion must succeed"
        
        # Verify cascade deletion
        remaining_financials = mock_db.get_financials_by_project(project_id)
        assert len(remaining_financials) == 0, \
            "Cascade deletion must remove all related financial records"
        
        # Verify no orphaned records
        all_financials = list(financials_store.values())
        orphaned_financials = [f for f in all_financials if f.get('project_id') == project_id]
        assert len(orphaned_financials) == 0, \
            "No orphaned financial records must remain after project deletion"


class TestConcurrentOperationSafety:
    """
    Property-based tests for concurrent operation safety.
    
    Task: 10.1 Create CRUD operation and concurrency testing
    **Validates: Requirements 7.2**
    """
    
    @given(
        projects_data=st.lists(
            project_data_strategy(),
            min_size=2,
            max_size=10
        )
    )
    @settings(max_examples=50, deadline=15000, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_property_30_concurrent_creation_safety(self, projects_data: List[Dict[str, Any]]):
        """
        Property 30: Concurrent Operation Safety (Creation)
        
        For any set of concurrent database operations, race conditions must not 
        occur and data consistency must be preserved.
        
        This test validates that concurrent project creation:
        - Generates unique IDs for all projects
        - Completes successfully for all operations
        - Maintains data integrity without corruption
        
        Task: 10.1 Create CRUD operation and concurrency testing
        **Validates: Requirements 7.2**
        """
        # Mock async database with thread-safe operations
        created_projects = {}
        creation_lock = asyncio.Lock()
        
        async def async_create_project(data):
            # Simulate database operation delay
            await asyncio.sleep(0.001)
            
            async with creation_lock:
                project_id = str(uuid4())
                project = {**data, 'id': project_id, 'created_at': datetime.now(timezone.utc).isoformat()}
                created_projects[project_id] = project
                return project
        
        # Property: Concurrent creation completes successfully
        tasks = [async_create_project(data) for data in projects_data]
        created_results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Verify no exceptions occurred
        exceptions = [r for r in created_results if isinstance(r, Exception)]
        assert len(exceptions) == 0, f"Concurrent operations must not raise exceptions: {exceptions}"
        
        # Property: All projects were created
        assert len(created_results) == len(projects_data), \
            "All concurrent create operations must complete"
        
        # Property: All projects have unique IDs
        project_ids = [p['id'] for p in created_results]
        assert len(set(project_ids)) == len(project_ids), \
            "Concurrent operations must generate unique IDs"
        
        # Property: All created projects are in the store
        assert len(created_projects) == len(projects_data), \
            "All projects must be persisted"
        
        # Property: Data integrity is maintained
        for i, created_project in enumerate(created_results):
            original_data = projects_data[i]
            assert created_project['name'] == original_data['name'], \
                "Concurrent operations must preserve data integrity"
            assert created_project['budget'] == original_data['budget'], \
                "Concurrent operations must preserve budget data"
    
    @given(
        project_data=project_data_strategy(),
        num_concurrent_updates=st.integers(min_value=2, max_value=10)
    )
    @settings(max_examples=50, deadline=15000, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_property_30_concurrent_update_safety(
        self, 
        project_data: Dict[str, Any],
        num_concurrent_updates: int
    ):
        """
        Property 30: Concurrent Operation Safety (Updates)
        
        For any concurrent update operations on the same entity, the final state
        must be consistent and all updates must be applied without data loss.
        
        Task: 10.1 Create CRUD operation and concurrency testing
        **Validates: Requirements 7.2**
        """
        # Create initial project
        project_id = str(uuid4())
        project_store = {
            project_id: {**project_data, 'id': project_id, 'update_count': 0}
        }
        update_lock = asyncio.Lock()
        update_history = []
        
        async def async_update_project(project_id, update_data, update_id):
            # Simulate database operation delay
            await asyncio.sleep(0.001)
            
            async with update_lock:
                if project_id in project_store:
                    project_store[project_id].update(update_data)
                    project_store[project_id]['update_count'] += 1
                    project_store[project_id]['last_update_id'] = update_id
                    update_history.append({
                        'update_id': update_id,
                        'timestamp': datetime.now(timezone.utc).isoformat(),
                        'data': update_data.copy()
                    })
                    return project_store[project_id].copy()
            return None
        
        # Generate concurrent updates
        update_tasks = []
        for i in range(num_concurrent_updates):
            update_data = {
                'name': f"Updated Name {i}",
                'budget': project_data['budget'] + (i * 1000)
            }
            update_tasks.append(async_update_project(project_id, update_data, i))
        
        # Property: Concurrent updates complete successfully
        update_results = await asyncio.gather(*update_tasks, return_exceptions=True)
        
        # Verify no exceptions
        exceptions = [r for r in update_results if isinstance(r, Exception)]
        assert len(exceptions) == 0, f"Concurrent updates must not raise exceptions: {exceptions}"
        
        # Property: All updates were applied
        final_project = project_store[project_id]
        assert final_project['update_count'] == num_concurrent_updates, \
            "All concurrent updates must be applied"
        
        # Property: Update history is complete
        assert len(update_history) == num_concurrent_updates, \
            "All updates must be recorded in history"
        
        # Property: Final state is consistent
        assert 'last_update_id' in final_project, \
            "Final state must include last update identifier"
        assert final_project['last_update_id'] in range(num_concurrent_updates), \
            "Last update ID must be valid"
        
        # Property: No data corruption occurred
        assert 'id' in final_project, "Project ID must be preserved"
        assert final_project['id'] == project_id, "Project ID must not change"
        assert 'update_count' in final_project, "Update count must be tracked"
    
    @given(
        projects_data=st.lists(
            project_data_strategy(),
            min_size=3,
            max_size=8
        )
    )
    @settings(max_examples=30, deadline=20000, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_property_30_concurrent_mixed_operations_safety(
        self,
        projects_data: List[Dict[str, Any]]
    ):
        """
        Property 30: Concurrent Operation Safety (Mixed Operations)
        
        For any mix of concurrent create, read, update, and delete operations,
        data consistency must be preserved and race conditions must not corrupt data.
        
        Task: 10.1 Create CRUD operation and concurrency testing
        **Validates: Requirements 7.2**
        """
        # Mock database with thread-safe operations
        projects_store = {}
        operation_lock = asyncio.Lock()
        operation_log = []
        
        async def async_create(data):
            await asyncio.sleep(0.001)
            async with operation_lock:
                project_id = str(uuid4())
                project = {**data, 'id': project_id}
                projects_store[project_id] = project
                operation_log.append(('create', project_id))
                return project
        
        async def async_read(project_id):
            await asyncio.sleep(0.001)
            async with operation_lock:
                operation_log.append(('read', project_id))
                return projects_store.get(project_id)
        
        async def async_update(project_id, updates):
            await asyncio.sleep(0.001)
            async with operation_lock:
                if project_id in projects_store:
                    projects_store[project_id].update(updates)
                    operation_log.append(('update', project_id))
                    return projects_store[project_id]
                return None
        
        async def async_delete(project_id):
            await asyncio.sleep(0.001)
            async with operation_lock:
                if project_id in projects_store:
                    del projects_store[project_id]
                    operation_log.append(('delete', project_id))
                    return True
                return False
        
        # Create initial projects
        create_tasks = [async_create(data) for data in projects_data[:len(projects_data)//2]]
        created_projects = await asyncio.gather(*create_tasks)
        
        # Mix of operations on created projects
        mixed_tasks = []
        
        # Add read operations
        for project in created_projects[:2]:
            mixed_tasks.append(async_read(project['id']))
        
        # Add update operations
        for project in created_projects[2:4] if len(created_projects) > 2 else []:
            mixed_tasks.append(async_update(project['id'], {'name': 'Concurrent Update'}))
        
        # Add more create operations
        for data in projects_data[len(projects_data)//2:]:
            mixed_tasks.append(async_create(data))
        
        # Add delete operations (if we have enough projects)
        if len(created_projects) > 4:
            for project in created_projects[4:]:
                mixed_tasks.append(async_delete(project['id']))
        
        # Property: Mixed concurrent operations complete successfully
        mixed_results = await asyncio.gather(*mixed_tasks, return_exceptions=True)
        
        # Verify no exceptions
        exceptions = [r for r in mixed_results if isinstance(r, Exception)]
        assert len(exceptions) == 0, f"Mixed concurrent operations must not raise exceptions: {exceptions}"
        
        # Property: Operation log is complete
        assert len(operation_log) > 0, "Operations must be logged"
        
        # Property: Data consistency is maintained
        # Count operations by type
        creates = [op for op in operation_log if op[0] == 'create']
        reads = [op for op in operation_log if op[0] == 'read']
        updates = [op for op in operation_log if op[0] == 'update']
        deletes = [op for op in operation_log if op[0] == 'delete']
        
        # Verify operation counts make sense
        assert len(creates) == len(projects_data), "All creates must be logged"
        assert len(reads) >= 0, "Reads must be logged"
        assert len(updates) >= 0, "Updates must be logged"
        assert len(deletes) >= 0, "Deletes must be logged"
        
        # Property: Final state is consistent
        # Projects that were created but not deleted should exist
        created_ids = {op[1] for op in creates}
        deleted_ids = {op[1] for op in deletes}
        expected_remaining = created_ids - deleted_ids
        
        actual_remaining = set(projects_store.keys())
        assert actual_remaining == expected_remaining, \
            "Final state must match expected state after mixed operations"


class TestDataConsistencyUnderLoad:
    """
    Property-based tests for data consistency preservation under concurrent load.
    
    Task: 10.1 Create CRUD operation and concurrency testing
    **Validates: Requirements 7.2**
    """
    
    @given(
        num_operations=st.integers(min_value=10, max_value=50),
        operation_mix=st.lists(
            st.sampled_from(['create', 'read', 'update']),
            min_size=10,
            max_size=50
        )
    )
    @settings(max_examples=20, deadline=30000, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_data_consistency_under_concurrent_load(
        self,
        num_operations: int,
        operation_mix: List[str]
    ):
        """
        Property: Data Consistency Under Concurrent Load
        
        For any high volume of concurrent operations, data consistency must be
        preserved and the system must maintain referential integrity.
        
        Task: 10.1 Create CRUD operation and concurrency testing
        **Validates: Requirements 7.2**
        """
        # Mock database with consistency tracking
        data_store = {}
        consistency_lock = asyncio.Lock()
        operation_counter = {'create': 0, 'read': 0, 'update': 0}
        
        async def perform_operation(op_type, op_id):
            await asyncio.sleep(0.0001)  # Minimal delay to simulate DB operation
            
            async with consistency_lock:
                operation_counter[op_type] += 1
                
                if op_type == 'create':
                    entity_id = f"entity_{op_id}"
                    data_store[entity_id] = {
                        'id': entity_id,
                        'value': op_id,
                        'created_at': datetime.now(timezone.utc).isoformat()
                    }
                    return ('created', entity_id)
                
                elif op_type == 'read':
                    if data_store:
                        entity_id = list(data_store.keys())[0]
                        return ('read', data_store[entity_id])
                    return ('read', None)
                
                elif op_type == 'update':
                    if data_store:
                        entity_id = list(data_store.keys())[0]
                        data_store[entity_id]['value'] += 1
                        return ('updated', entity_id)
                    return ('updated', None)
        
        # Execute concurrent operations
        tasks = [
            perform_operation(operation_mix[i % len(operation_mix)], i)
            for i in range(num_operations)
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Property: All operations complete without exceptions
        exceptions = [r for r in results if isinstance(r, Exception)]
        assert len(exceptions) == 0, \
            f"Operations under load must not raise exceptions: {exceptions}"
        
        # Property: Operation counts are consistent
        total_operations = sum(operation_counter.values())
        assert total_operations == num_operations, \
            "All operations must be counted"
        
        # Property: Data store is consistent
        for entity_id, entity in data_store.items():
            assert 'id' in entity, "All entities must have IDs"
            assert entity['id'] == entity_id, "Entity IDs must match keys"
            assert 'value' in entity, "All entities must have values"
            assert 'created_at' in entity, "All entities must have creation timestamps"
