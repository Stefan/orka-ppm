"""
Property-based tests for data integrity - Database constraint enforcement.

Feature: property-based-testing
Task: 10.3 Add database constraint enforcement testing

This module implements property-based tests for:
- Database constraint validation to prevent invalid data states
- Referential integrity enforcement testing
- Comprehensive data integrity validation

**Validates: Requirements 7.5**
"""

import pytest
from datetime import datetime, timezone, date, timedelta
from typing import Dict, Any, List, Optional
from uuid import uuid4

from hypothesis import given, settings, assume, HealthCheck
from hypothesis import strategies as st

from tests.property_tests.pbt_framework.domain_generators import (
    DomainGenerators,
    project_data_strategy,
    financial_record_strategy,
    user_role_assignment_strategy,
    resource_allocation_strategy
)
from tests.property_tests.pbt_framework.backend_pbt_framework import property_test


class ConstraintViolationError(Exception):
    """Exception raised when a database constraint is violated."""
    pass


class TestDatabaseConstraintEnforcement:
    """
    Property-based tests for database constraint enforcement.
    
    Task: 10.3 Add database constraint enforcement testing
    **Validates: Requirements 7.5**
    """
    
    @given(project_data=project_data_strategy())
    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_property_33_not_null_constraints(self, project_data: Dict[str, Any]):
        """
        Property 33: Database Constraint Enforcement (NOT NULL)
        
        For any attempt to create invalid data states, database constraints must 
        prevent the invalid states and maintain data integrity.
        
        This test validates NOT NULL constraints on required fields.
        
        Task: 10.3 Add database constraint enforcement testing
        **Validates: Requirements 7.5**
        """
        # Mock database with NOT NULL constraint enforcement
        class MockDatabase:
            REQUIRED_FIELDS = ['id', 'name', 'budget', 'status', 'organization_id']
            
            def insert_project(self, project):
                """Insert project with NOT NULL constraint checking."""
                # Check NOT NULL constraints
                for field in self.REQUIRED_FIELDS:
                    if field not in project or project[field] is None:
                        raise ConstraintViolationError(
                            f"NOT NULL constraint violation: {field} cannot be NULL"
                        )
                
                # Additional validation
                if isinstance(project.get('name'), str) and not project['name'].strip():
                    raise ConstraintViolationError(
                        "NOT NULL constraint violation: name cannot be empty string"
                    )
                
                return {'success': True, 'id': project['id']}
        
        db = MockDatabase()
        
        # Property: Valid data passes NOT NULL constraints
        result = db.insert_project(project_data)
        assert result['success'] is True, \
            "Valid project data must pass NOT NULL constraints"
        
        # Property: Missing required fields violate constraints
        for required_field in MockDatabase.REQUIRED_FIELDS:
            invalid_project = project_data.copy()
            invalid_project[required_field] = None
            
            with pytest.raises(ConstraintViolationError) as exc_info:
                db.insert_project(invalid_project)
            
            assert required_field in str(exc_info.value), \
                f"Constraint violation must identify missing field: {required_field}"
        
        # Property: Empty string for name violates constraint
        invalid_project = project_data.copy()
        invalid_project['name'] = ''
        
        with pytest.raises(ConstraintViolationError) as exc_info:
            db.insert_project(invalid_project)
        
        assert 'name' in str(exc_info.value).lower(), \
            "Empty name must violate constraint"
    
    @given(
        project_data=project_data_strategy(),
        budget_value=st.one_of(
            st.floats(min_value=-1000000, max_value=-0.01),  # Negative values
            st.just(float('inf')),  # Infinity
            st.just(float('-inf')),  # Negative infinity
        )
    )
    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_property_33_check_constraints_budget(self, project_data: Dict[str, Any], budget_value: float):
        """
        Property 33: Database Constraint Enforcement (CHECK constraints)
        
        For any budget value, CHECK constraints must enforce that budgets are
        non-negative and finite.
        
        Task: 10.3 Add database constraint enforcement testing
        **Validates: Requirements 7.5**
        """
        # Mock database with CHECK constraint enforcement
        class MockDatabase:
            def insert_project(self, project):
                """Insert project with CHECK constraint validation."""
                budget = project.get('budget')
                
                # CHECK constraint: budget >= 0
                if budget is None:
                    raise ConstraintViolationError("Budget cannot be NULL")
                
                if not isinstance(budget, (int, float)):
                    raise ConstraintViolationError("Budget must be numeric")
                
                if budget < 0:
                    raise ConstraintViolationError(
                        f"CHECK constraint violation: budget must be >= 0, got {budget}"
                    )
                
                # CHECK constraint: budget must be finite
                if not (-1e308 < budget < 1e308):  # Reasonable finite range
                    raise ConstraintViolationError(
                        f"CHECK constraint violation: budget must be finite, got {budget}"
                    )
                
                return {'success': True, 'id': project['id']}
        
        db = MockDatabase()
        
        # Property: Invalid budget values violate CHECK constraints
        invalid_project = project_data.copy()
        invalid_project['budget'] = budget_value
        
        with pytest.raises(ConstraintViolationError) as exc_info:
            db.insert_project(invalid_project)
        
        assert 'CHECK constraint' in str(exc_info.value) or 'budget' in str(exc_info.value).lower(), \
            "Invalid budget must violate CHECK constraint"
    
    @given(financial_record=financial_record_strategy())
    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_property_33_foreign_key_constraints(self, financial_record: Dict[str, Any]):
        """
        Property 33: Database Constraint Enforcement (FOREIGN KEY)
        
        For any financial record, FOREIGN KEY constraints must enforce that
        referenced projects exist.
        
        Task: 10.3 Add database constraint enforcement testing
        **Validates: Requirements 7.5**
        """
        # Mock database with FOREIGN KEY constraint enforcement
        class MockDatabase:
            def __init__(self):
                self.projects = {}
                self.financial_records = {}
            
            def insert_project(self, project):
                """Insert project."""
                project_id = project['id']
                self.projects[project_id] = project
                return {'success': True, 'id': project_id}
            
            def insert_financial_record(self, record):
                """Insert financial record with FOREIGN KEY validation."""
                project_id = record.get('project_id')
                
                if project_id is None:
                    raise ConstraintViolationError(
                        "FOREIGN KEY constraint: project_id cannot be NULL"
                    )
                
                # FOREIGN KEY constraint: project must exist
                if project_id not in self.projects:
                    raise ConstraintViolationError(
                        f"FOREIGN KEY constraint violation: "
                        f"project_id {project_id} does not exist in projects table"
                    )
                
                record_id = record['id']
                self.financial_records[record_id] = record
                return {'success': True, 'id': record_id}
            
            def delete_project(self, project_id):
                """Delete project with FOREIGN KEY constraint checking."""
                # Check for dependent financial records
                dependent_records = [
                    r for r in self.financial_records.values()
                    if r.get('project_id') == project_id
                ]
                
                if dependent_records:
                    raise ConstraintViolationError(
                        f"FOREIGN KEY constraint violation: "
                        f"Cannot delete project {project_id} - "
                        f"{len(dependent_records)} dependent financial records exist"
                    )
                
                if project_id in self.projects:
                    del self.projects[project_id]
                    return {'success': True}
                return {'success': False}
        
        db = MockDatabase()
        
        # Create a project first
        project_id = str(uuid4())
        project = {
            'id': project_id,
            'name': 'Test Project',
            'budget': 100000,
            'status': 'active',
            'organization_id': str(uuid4())
        }
        db.insert_project(project)
        
        # Property: Financial record with valid project_id succeeds
        valid_record = financial_record.copy()
        valid_record['project_id'] = project_id
        result = db.insert_financial_record(valid_record)
        assert result['success'] is True, \
            "Financial record with valid project_id must succeed"
        
        # Property: Financial record with non-existent project_id fails
        invalid_record = financial_record.copy()
        invalid_record['project_id'] = str(uuid4())  # Non-existent project
        
        with pytest.raises(ConstraintViolationError) as exc_info:
            db.insert_financial_record(invalid_record)
        
        assert 'FOREIGN KEY' in str(exc_info.value), \
            "Non-existent project_id must violate FOREIGN KEY constraint"
        
        # Property: Cannot delete project with dependent records
        with pytest.raises(ConstraintViolationError) as exc_info:
            db.delete_project(project_id)
        
        assert 'dependent' in str(exc_info.value).lower() or 'FOREIGN KEY' in str(exc_info.value), \
            "Deleting project with dependent records must violate constraint"
    
    @given(
        project_data=project_data_strategy(),
        duplicate_name=st.text(min_size=1, max_size=100)
    )
    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_property_33_unique_constraints(self, project_data: Dict[str, Any], duplicate_name: str):
        """
        Property 33: Database Constraint Enforcement (UNIQUE)
        
        For any project, UNIQUE constraints must prevent duplicate values in
        unique columns.
        
        Task: 10.3 Add database constraint enforcement testing
        **Validates: Requirements 7.5**
        """
        # Mock database with UNIQUE constraint enforcement
        class MockDatabase:
            def __init__(self):
                self.projects = {}
                self.project_names_by_org = {}  # Track unique names per organization
            
            def insert_project(self, project):
                """Insert project with UNIQUE constraint validation."""
                project_id = project['id']
                org_id = project['organization_id']
                name = project['name']
                
                # UNIQUE constraint: (name, organization_id) must be unique
                org_names = self.project_names_by_org.get(org_id, set())
                
                if name in org_names:
                    raise ConstraintViolationError(
                        f"UNIQUE constraint violation: "
                        f"project name '{name}' already exists in organization {org_id}"
                    )
                
                # Insert project
                self.projects[project_id] = project
                
                # Track name
                if org_id not in self.project_names_by_org:
                    self.project_names_by_org[org_id] = set()
                self.project_names_by_org[org_id].add(name)
                
                return {'success': True, 'id': project_id}
        
        db = MockDatabase()
        
        # Property: First project with name succeeds
        result = db.insert_project(project_data)
        assert result['success'] is True, \
            "First project with unique name must succeed"
        
        # Property: Duplicate name in same organization fails
        duplicate_project = project_data.copy()
        duplicate_project['id'] = str(uuid4())  # Different ID
        # Same name and organization_id
        
        with pytest.raises(ConstraintViolationError) as exc_info:
            db.insert_project(duplicate_project)
        
        assert 'UNIQUE' in str(exc_info.value), \
            "Duplicate project name in same organization must violate UNIQUE constraint"
        
        # Property: Same name in different organization succeeds
        different_org_project = project_data.copy()
        different_org_project['id'] = str(uuid4())
        different_org_project['organization_id'] = str(uuid4())  # Different organization
        
        result = db.insert_project(different_org_project)
        assert result['success'] is True, \
            "Same project name in different organization must succeed"


class TestReferentialIntegrityEnforcement:
    """
    Property-based tests for referential integrity enforcement.
    
    Task: 10.3 Add database constraint enforcement testing
    **Validates: Requirements 7.5**
    """
    
    @given(
        user_assignment=user_role_assignment_strategy(),
        resource_allocation=resource_allocation_strategy()
    )
    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_property_33_cascade_delete_enforcement(
        self,
        user_assignment: Dict[str, Any],
        resource_allocation: Dict[str, Any]
    ):
        """
        Property 33: Referential Integrity Enforcement (CASCADE DELETE)
        
        For any entity with dependent records, CASCADE DELETE must remove all
        dependent records to maintain referential integrity.
        
        Task: 10.3 Add database constraint enforcement testing
        **Validates: Requirements 7.5**
        """
        # Mock database with CASCADE DELETE enforcement
        class MockDatabase:
            def __init__(self):
                self.users = {}
                self.role_assignments = {}
                self.resource_allocations = {}
            
            def insert_user(self, user_id):
                """Insert user."""
                self.users[user_id] = {'id': user_id, 'created_at': datetime.now(timezone.utc).isoformat()}
                return {'success': True, 'id': user_id}
            
            def insert_role_assignment(self, assignment):
                """Insert role assignment."""
                user_id = assignment['user_id']
                if user_id not in self.users:
                    raise ConstraintViolationError(f"User {user_id} does not exist")
                
                assignment_id = assignment['id']
                self.role_assignments[assignment_id] = assignment
                return {'success': True, 'id': assignment_id}
            
            def insert_resource_allocation(self, allocation):
                """Insert resource allocation."""
                resource_id = allocation['resource_id']
                # Assume resource is a user
                if resource_id not in self.users:
                    raise ConstraintViolationError(f"Resource {resource_id} does not exist")
                
                allocation_id = allocation['id']
                self.resource_allocations[allocation_id] = allocation
                return {'success': True, 'id': allocation_id}
            
            def delete_user_cascade(self, user_id):
                """Delete user with CASCADE DELETE."""
                if user_id not in self.users:
                    return {'success': False, 'message': 'User not found'}
                
                # CASCADE DELETE: Remove dependent role assignments
                assignments_to_delete = [
                    aid for aid, a in self.role_assignments.items()
                    if a['user_id'] == user_id
                ]
                for aid in assignments_to_delete:
                    del self.role_assignments[aid]
                
                # CASCADE DELETE: Remove dependent resource allocations
                allocations_to_delete = [
                    aid for aid, a in self.resource_allocations.items()
                    if a['resource_id'] == user_id
                ]
                for aid in allocations_to_delete:
                    del self.resource_allocations[aid]
                
                # Delete user
                del self.users[user_id]
                
                return {
                    'success': True,
                    'deleted_assignments': len(assignments_to_delete),
                    'deleted_allocations': len(allocations_to_delete)
                }
        
        db = MockDatabase()
        
        # Create user
        user_id = user_assignment['user_id']
        db.insert_user(user_id)
        
        # Create role assignment for user
        db.insert_role_assignment(user_assignment)
        
        # Create resource allocation for user
        allocation_with_user = resource_allocation.copy()
        allocation_with_user['resource_id'] = user_id
        db.insert_resource_allocation(allocation_with_user)
        
        # Property: User has dependent records
        assert user_id in db.users, "User must exist"
        assert any(a['user_id'] == user_id for a in db.role_assignments.values()), \
            "User must have role assignment"
        assert any(a['resource_id'] == user_id for a in db.resource_allocations.values()), \
            "User must have resource allocation"
        
        # Property: CASCADE DELETE removes all dependent records
        result = db.delete_user_cascade(user_id)
        assert result['success'] is True, "CASCADE DELETE must succeed"
        assert result['deleted_assignments'] >= 1, "Must delete role assignments"
        assert result['deleted_allocations'] >= 1, "Must delete resource allocations"
        
        # Verify user is deleted
        assert user_id not in db.users, "User must be deleted"
        
        # Verify no orphaned records
        orphaned_assignments = [
            a for a in db.role_assignments.values()
            if a['user_id'] == user_id
        ]
        assert len(orphaned_assignments) == 0, \
            "No orphaned role assignments must remain"
        
        orphaned_allocations = [
            a for a in db.resource_allocations.values()
            if a['resource_id'] == user_id
        ]
        assert len(orphaned_allocations) == 0, \
            "No orphaned resource allocations must remain"
    
    @given(
        start_date=st.dates(min_value=date(2020, 1, 1), max_value=date(2030, 12, 31)),
        duration_days=st.integers(min_value=-365, max_value=-1)  # Negative duration (invalid)
    )
    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_property_33_date_range_constraints(self, start_date: date, duration_days: int):
        """
        Property 33: Database Constraint Enforcement (Date Range)
        
        For any date range, CHECK constraints must enforce that end_date >= start_date.
        
        Task: 10.3 Add database constraint enforcement testing
        **Validates: Requirements 7.5**
        """
        # Mock database with date range constraint enforcement
        class MockDatabase:
            def insert_project(self, project):
                """Insert project with date range validation."""
                start_date = project.get('start_date')
                end_date = project.get('end_date')
                
                if start_date and end_date:
                    # Parse dates if they're strings
                    if isinstance(start_date, str):
                        start_date = date.fromisoformat(start_date)
                    if isinstance(end_date, str):
                        end_date = date.fromisoformat(end_date)
                    
                    # CHECK constraint: end_date >= start_date
                    if end_date < start_date:
                        raise ConstraintViolationError(
                            f"CHECK constraint violation: "
                            f"end_date ({end_date}) must be >= start_date ({start_date})"
                        )
                
                return {'success': True, 'id': project['id']}
        
        db = MockDatabase()
        
        # Property: Invalid date range violates constraint (duration_days is negative)
        end_date = start_date + timedelta(days=duration_days)
        
        invalid_project = {
            'id': str(uuid4()),
            'name': 'Test Project',
            'budget': 100000,
            'status': 'active',
            'organization_id': str(uuid4()),
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat()
        }
        
        with pytest.raises(ConstraintViolationError) as exc_info:
            db.insert_project(invalid_project)
        
        assert 'end_date' in str(exc_info.value) and 'start_date' in str(exc_info.value), \
            "Invalid date range must violate CHECK constraint"
    
    @given(
        allocation_percentage=st.floats(
            min_value=100.01,
            max_value=200.0,
            allow_nan=False,
            allow_infinity=False
        )
    )
    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_property_33_percentage_range_constraints(self, allocation_percentage: float):
        """
        Property 33: Database Constraint Enforcement (Percentage Range)
        
        For any allocation percentage, CHECK constraints must enforce that
        percentage is between 0 and 100.
        
        Task: 10.3 Add database constraint enforcement testing
        **Validates: Requirements 7.5**
        """
        # Mock database with percentage range constraint enforcement
        class MockDatabase:
            def insert_resource_allocation(self, allocation):
                """Insert resource allocation with percentage validation."""
                percentage = allocation.get('allocation_percentage')
                
                if percentage is None:
                    raise ConstraintViolationError("allocation_percentage cannot be NULL")
                
                # CHECK constraint: 0 <= percentage <= 100
                if not (0 <= percentage <= 100):
                    raise ConstraintViolationError(
                        f"CHECK constraint violation: "
                        f"allocation_percentage must be between 0 and 100, got {percentage}"
                    )
                
                return {'success': True, 'id': allocation['id']}
        
        db = MockDatabase()
        
        # Property: Percentage > 100 violates constraint
        invalid_allocation = {
            'id': str(uuid4()),
            'resource_id': str(uuid4()),
            'project_id': str(uuid4()),
            'allocation_percentage': allocation_percentage,
            'hours_per_week': 40,
            'start_date': date.today().isoformat(),
            'end_date': (date.today() + timedelta(days=30)).isoformat()
        }
        
        with pytest.raises(ConstraintViolationError) as exc_info:
            db.insert_resource_allocation(invalid_allocation)
        
        assert 'allocation_percentage' in str(exc_info.value), \
            "Invalid percentage must violate CHECK constraint"
        assert '100' in str(exc_info.value), \
            "Error message must mention valid range"


class TestComprehensiveDataIntegrityValidation:
    """
    Property-based tests for comprehensive data integrity validation.
    
    Task: 10.3 Add database constraint enforcement testing
    **Validates: Requirements 7.5**
    """
    
    @given(
        project_data=project_data_strategy(),
        financial_records=st.lists(
            financial_record_strategy(),
            min_size=1,
            max_size=5
        )
    )
    @settings(max_examples=50, deadline=10000, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_property_33_multi_constraint_validation(
        self,
        project_data: Dict[str, Any],
        financial_records: List[Dict[str, Any]]
    ):
        """
        Property 33: Comprehensive Data Integrity (Multiple Constraints)
        
        For any complex data operation, all applicable constraints must be
        enforced simultaneously to maintain data integrity.
        
        Task: 10.3 Add database constraint enforcement testing
        **Validates: Requirements 7.5**
        """
        # Mock database with comprehensive constraint enforcement
        class MockDatabase:
            def __init__(self):
                self.projects = {}
                self.financial_records = {}
                self.project_names_by_org = {}
            
            def insert_project_with_financials(self, project, financials):
                """Insert project with financial records, enforcing all constraints."""
                # Validate project constraints
                project_id = project['id']
                
                # NOT NULL constraints
                required_fields = ['id', 'name', 'budget', 'status', 'organization_id']
                for field in required_fields:
                    if field not in project or project[field] is None:
                        raise ConstraintViolationError(f"NOT NULL: {field} is required")
                
                # CHECK constraint: budget >= 0
                if project['budget'] < 0:
                    raise ConstraintViolationError("CHECK: budget must be >= 0")
                
                # UNIQUE constraint: (name, organization_id)
                org_id = project['organization_id']
                org_names = self.project_names_by_org.get(org_id, set())
                if project['name'] in org_names:
                    raise ConstraintViolationError(
                        f"UNIQUE: project name '{project['name']}' already exists"
                    )
                
                # Insert project
                self.projects[project_id] = project
                if org_id not in self.project_names_by_org:
                    self.project_names_by_org[org_id] = set()
                self.project_names_by_org[org_id].add(project['name'])
                
                # Insert financial records
                inserted_financials = []
                for financial in financials:
                    # FOREIGN KEY constraint
                    financial['project_id'] = project_id
                    
                    # NOT NULL constraints
                    if financial.get('planned_amount') is None:
                        raise ConstraintViolationError("NOT NULL: planned_amount is required")
                    if financial.get('actual_amount') is None:
                        raise ConstraintViolationError("NOT NULL: actual_amount is required")
                    
                    # CHECK constraints: amounts >= 0
                    if financial['planned_amount'] < 0:
                        raise ConstraintViolationError("CHECK: planned_amount must be >= 0")
                    if financial['actual_amount'] < 0:
                        raise ConstraintViolationError("CHECK: actual_amount must be >= 0")
                    
                    financial_id = financial['id']
                    self.financial_records[financial_id] = financial
                    inserted_financials.append(financial_id)
                
                return {
                    'success': True,
                    'project_id': project_id,
                    'financial_ids': inserted_financials
                }
        
        db = MockDatabase()
        
        # Property: Valid data passes all constraints
        result = db.insert_project_with_financials(project_data, financial_records)
        assert result['success'] is True, \
            "Valid data must pass all constraint checks"
        assert result['project_id'] == project_data['id'], \
            "Project must be inserted with correct ID"
        assert len(result['financial_ids']) == len(financial_records), \
            "All financial records must be inserted"
        
        # Verify project is in database
        assert project_data['id'] in db.projects, \
            "Project must be persisted"
        
        # Verify all financial records are in database
        for financial_id in result['financial_ids']:
            assert financial_id in db.financial_records, \
                f"Financial record {financial_id} must be persisted"
            
            # Verify FOREIGN KEY relationship
            financial = db.financial_records[financial_id]
            assert financial['project_id'] == project_data['id'], \
                "Financial record must reference correct project"
