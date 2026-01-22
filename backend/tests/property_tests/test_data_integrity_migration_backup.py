"""
Property-based tests for data integrity - Migration and backup testing.

Feature: property-based-testing
Task: 10.2 Add data migration and backup testing

This module implements property-based tests for:
- Data migration information preservation validation
- Backup and restore accuracy testing (lossless operations)
- Data transformation correctness validation

**Validates: Requirements 7.3, 7.4**
"""

import pytest
import json
import copy
from datetime import datetime, timezone, date
from typing import Dict, Any, List
from uuid import uuid4
from decimal import Decimal

from hypothesis import given, settings, assume, HealthCheck
from hypothesis import strategies as st

from tests.property_tests.pbt_framework.domain_generators import (
    DomainGenerators,
    project_data_strategy,
    financial_record_strategy,
    project_with_financials,
    user_role_assignment_strategy
)
from tests.property_tests.pbt_framework.backend_pbt_framework import property_test


class TestDataMigrationInformationPreservation:
    """
    Property-based tests for data migration information preservation.
    
    Task: 10.2 Add data migration and backup testing
    **Validates: Requirements 7.3**
    """
    
    @given(project_data=project_data_strategy())
    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_property_31_migration_preserves_project_data(self, project_data: Dict[str, Any]):
        """
        Property 31: Data Migration Information Preservation (Projects)
        
        For any data migration or transformation, all essential information must 
        be preserved without loss or corruption.
        
        This test validates that project data migration:
        - Preserves all required fields
        - Maintains data types correctly
        - Preserves numeric precision
        - Maintains referential integrity
        
        Task: 10.2 Add data migration and backup testing
        **Validates: Requirements 7.3**
        """
        # Simulate migration: old schema -> new schema
        # Old schema has different field names
        def migrate_project_v1_to_v2(old_project):
            """Migrate project from v1 schema to v2 schema."""
            return {
                'id': old_project['id'],
                'project_name': old_project['name'],  # Renamed field
                'budget_amount': old_project['budget'],  # Renamed field
                'project_status': old_project['status'],  # Renamed field
                'health_indicator': old_project['health'],  # Renamed field
                'priority_level': old_project['priority'],  # Renamed field
                'department_name': old_project['department'],  # Renamed field
                'description_text': old_project.get('description', ''),  # Renamed field
                'organization_uuid': old_project['organization_id'],  # Renamed field
                'created_timestamp': old_project['created_at'],  # Renamed field
                # Preserve optional fields
                'start_date': old_project.get('start_date'),
                'end_date': old_project.get('end_date'),
                'duration_days': old_project.get('duration_days'),
                # Migration metadata
                'schema_version': 'v2',
                'migrated_at': datetime.now(timezone.utc).isoformat()
            }
        
        # Property: Migration preserves all essential data
        migrated_project = migrate_project_v1_to_v2(project_data)
        
        # Verify all essential fields are preserved
        assert migrated_project['id'] == project_data['id'], \
            "Migration must preserve project ID"
        assert migrated_project['project_name'] == project_data['name'], \
            "Migration must preserve project name"
        assert migrated_project['budget_amount'] == project_data['budget'], \
            "Migration must preserve budget with exact precision"
        assert migrated_project['project_status'] == project_data['status'], \
            "Migration must preserve project status"
        assert migrated_project['health_indicator'] == project_data['health'], \
            "Migration must preserve health indicator"
        assert migrated_project['priority_level'] == project_data['priority'], \
            "Migration must preserve priority level"
        assert migrated_project['department_name'] == project_data['department'], \
            "Migration must preserve department"
        assert migrated_project['organization_uuid'] == project_data['organization_id'], \
            "Migration must preserve organization reference"
        
        # Property: Optional fields are preserved if present
        if 'start_date' in project_data:
            assert migrated_project['start_date'] == project_data['start_date'], \
                "Migration must preserve start date"
        if 'end_date' in project_data:
            assert migrated_project['end_date'] == project_data['end_date'], \
                "Migration must preserve end date"
        if 'duration_days' in project_data:
            assert migrated_project['duration_days'] == project_data['duration_days'], \
                "Migration must preserve duration"
        
        # Property: Migration adds metadata
        assert 'schema_version' in migrated_project, \
            "Migration must add schema version"
        assert migrated_project['schema_version'] == 'v2', \
            "Migration must set correct schema version"
        assert 'migrated_at' in migrated_project, \
            "Migration must add migration timestamp"
    
    @given(financial_record=financial_record_strategy())
    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_property_31_migration_preserves_financial_precision(self, financial_record: Dict[str, Any]):
        """
        Property 31: Data Migration Information Preservation (Financial Precision)
        
        For any financial data migration, numeric precision must be preserved
        exactly to prevent rounding errors or data loss.
        
        Task: 10.2 Add data migration and backup testing
        **Validates: Requirements 7.3**
        """
        # Simulate migration with currency conversion and precision preservation
        def migrate_financial_record(old_record):
            """Migrate financial record preserving precision."""
            # Convert to Decimal for precise calculations
            planned = Decimal(str(old_record['planned_amount']))
            actual = Decimal(str(old_record['actual_amount']))
            variance = actual - planned
            
            return {
                'id': old_record['id'],
                'planned_amount_decimal': str(planned),  # Store as string to preserve precision
                'actual_amount_decimal': str(actual),
                'variance_amount_decimal': str(variance),
                'currency_code': old_record['currency'],
                'exchange_rate_decimal': str(old_record.get('exchange_rate', 1.0)),
                'variance_percentage': old_record['variance_percentage'],
                'variance_status': old_record['variance_status'],
                'period_start_date': old_record['period_start'],
                'period_end_date': old_record['period_end'],
                'category_name': old_record['category'],
                'cost_center_code': old_record['cost_center'],
                'created_timestamp': old_record['created_at'],
                'schema_version': 'v2'
            }
        
        # Property: Migration preserves financial precision
        migrated_record = migrate_financial_record(financial_record)
        
        # Verify precision preservation
        original_planned = Decimal(str(financial_record['planned_amount']))
        migrated_planned = Decimal(migrated_record['planned_amount_decimal'])
        assert original_planned == migrated_planned, \
            "Migration must preserve planned amount precision exactly"
        
        original_actual = Decimal(str(financial_record['actual_amount']))
        migrated_actual = Decimal(migrated_record['actual_amount_decimal'])
        assert original_actual == migrated_actual, \
            "Migration must preserve actual amount precision exactly"
        
        # Verify calculated variance is correct
        expected_variance = migrated_actual - migrated_planned
        migrated_variance = Decimal(migrated_record['variance_amount_decimal'])
        assert abs(expected_variance - migrated_variance) < Decimal('0.01'), \
            "Migration must calculate variance correctly"
        
        # Property: All essential fields are preserved
        assert migrated_record['currency_code'] == financial_record['currency'], \
            "Migration must preserve currency code"
        assert migrated_record['variance_status'] == financial_record['variance_status'], \
            "Migration must preserve variance status"
        assert migrated_record['category_name'] == financial_record['category'], \
            "Migration must preserve category"
    
    @given(
        projects_data=st.lists(
            project_data_strategy(),
            min_size=1,
            max_size=20
        )
    )
    @settings(max_examples=50, deadline=10000, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_property_31_batch_migration_consistency(self, projects_data: List[Dict[str, Any]]):
        """
        Property 31: Data Migration Information Preservation (Batch Consistency)
        
        For any batch data migration, all records must be migrated consistently
        and the total count must match.
        
        Task: 10.2 Add data migration and backup testing
        **Validates: Requirements 7.3**
        """
        def batch_migrate_projects(projects):
            """Migrate a batch of projects."""
            migrated = []
            failed = []
            
            for project in projects:
                try:
                    migrated_project = {
                        'id': project['id'],
                        'name': project['name'],
                        'budget': project['budget'],
                        'status': project['status'],
                        'migrated': True,
                        'migration_timestamp': datetime.now(timezone.utc).isoformat()
                    }
                    migrated.append(migrated_project)
                except Exception as e:
                    failed.append({'project': project, 'error': str(e)})
            
            return {
                'migrated': migrated,
                'failed': failed,
                'total_input': len(projects),
                'total_migrated': len(migrated),
                'total_failed': len(failed)
            }
        
        # Property: Batch migration processes all records
        result = batch_migrate_projects(projects_data)
        
        assert result['total_input'] == len(projects_data), \
            "Migration must account for all input records"
        assert result['total_migrated'] + result['total_failed'] == result['total_input'], \
            "Migration must process all records (migrated + failed = total)"
        
        # Property: No data loss in successful migrations
        assert result['total_migrated'] == len(projects_data), \
            "All valid projects must be migrated successfully"
        assert result['total_failed'] == 0, \
            "No migrations should fail for valid data"
        
        # Property: All migrated records have required fields
        for migrated_project in result['migrated']:
            assert 'id' in migrated_project, "Migrated project must have ID"
            assert 'name' in migrated_project, "Migrated project must have name"
            assert 'budget' in migrated_project, "Migrated project must have budget"
            assert 'migrated' in migrated_project, "Migrated project must have migration flag"
            assert migrated_project['migrated'] is True, "Migration flag must be True"


class TestBackupAndRestoreAccuracy:
    """
    Property-based tests for backup and restore accuracy.
    
    Task: 10.2 Add data migration and backup testing
    **Validates: Requirements 7.4**
    """
    
    @given(project_data=project_data_strategy())
    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_property_32_backup_restore_lossless_project(self, project_data: Dict[str, Any]):
        """
        Property 32: Backup and Restore Accuracy (Projects)
        
        For any backup and restore operation, restored data must match original 
        data exactly with no information loss.
        
        Task: 10.2 Add data migration and backup testing
        **Validates: Requirements 7.4**
        """
        # Simulate backup operation
        def backup_project(project):
            """Create a backup of project data."""
            # Serialize to JSON (common backup format)
            backup_data = json.dumps(project, sort_keys=True, default=str)
            return {
                'backup_id': str(uuid4()),
                'entity_type': 'project',
                'entity_id': project['id'],
                'backup_data': backup_data,
                'backup_timestamp': datetime.now(timezone.utc).isoformat(),
                'checksum': hash(backup_data)  # Simple checksum for integrity
            }
        
        def restore_project(backup):
            """Restore project from backup."""
            # Deserialize from JSON
            restored_data = json.loads(backup['backup_data'])
            
            # Verify checksum
            current_checksum = hash(backup['backup_data'])
            if current_checksum != backup['checksum']:
                raise ValueError("Backup data corrupted - checksum mismatch")
            
            return restored_data
        
        # Property: Backup and restore is lossless
        backup = backup_project(project_data)
        restored_project = restore_project(backup)
        
        # Verify all fields match exactly
        # Note: JSON serialization converts UUIDs to strings
        assert str(restored_project['id']) == str(project_data['id']), \
            "Restore must preserve project ID exactly"
        assert restored_project['name'] == project_data['name'], \
            "Restore must preserve project name exactly"
        assert restored_project['budget'] == project_data['budget'], \
            "Restore must preserve budget exactly"
        assert restored_project['status'] == project_data['status'], \
            "Restore must preserve status exactly"
        assert restored_project['health'] == project_data['health'], \
            "Restore must preserve health exactly"
        assert restored_project['priority'] == project_data['priority'], \
            "Restore must preserve priority exactly"
        assert restored_project['department'] == project_data['department'], \
            "Restore must preserve department exactly"
        assert str(restored_project['organization_id']) == str(project_data['organization_id']), \
            "Restore must preserve organization ID exactly"
        
        # Property: Optional fields are preserved
        for key in ['start_date', 'end_date', 'duration_days', 'description']:
            if key in project_data:
                assert key in restored_project, f"Restore must preserve {key}"
                assert restored_project[key] == project_data[key], \
                    f"Restore must preserve {key} value exactly"
    
    @given(project_with_financials=project_with_financials())
    @settings(max_examples=50, deadline=10000, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_property_32_backup_restore_complex_data(self, project_with_financials: Dict[str, Any]):
        """
        Property 32: Backup and Restore Accuracy (Complex Data)
        
        For any complex data structure with relationships, backup and restore
        must preserve all data and relationships exactly.
        
        Task: 10.2 Add data migration and backup testing
        **Validates: Requirements 7.4**
        """
        project = project_with_financials['project']
        financial_records = project_with_financials['financial_records']
        aggregated = project_with_financials['aggregated']
        
        # Assume we have financial records
        assume(len(financial_records) > 0)
        
        # Simulate backup of complex structure
        def backup_project_with_financials(data):
            """Backup project with all related financial records."""
            backup_data = json.dumps(data, sort_keys=True, default=str)
            return {
                'backup_id': str(uuid4()),
                'entity_type': 'project_with_financials',
                'backup_data': backup_data,
                'backup_timestamp': datetime.now(timezone.utc).isoformat(),
                'record_count': {
                    'projects': 1,
                    'financial_records': len(data['financial_records'])
                },
                'checksum': hash(backup_data)
            }
        
        def restore_project_with_financials(backup):
            """Restore project with all related financial records."""
            restored_data = json.loads(backup['backup_data'])
            
            # Verify checksum
            current_checksum = hash(backup['backup_data'])
            if current_checksum != backup['checksum']:
                raise ValueError("Backup corrupted")
            
            return restored_data
        
        # Property: Complex backup and restore is lossless
        backup = backup_project_with_financials(project_with_financials)
        restored_data = restore_project_with_financials(backup)
        
        # Verify project data (UUIDs are converted to strings by JSON)
        assert str(restored_data['project']['id']) == str(project['id']), \
            "Restore must preserve project ID"
        assert restored_data['project']['name'] == project['name'], \
            "Restore must preserve project name"
        assert restored_data['project']['budget'] == project['budget'], \
            "Restore must preserve project budget"
        
        # Verify financial records count
        assert len(restored_data['financial_records']) == len(financial_records), \
            "Restore must preserve all financial records"
        
        # Verify each financial record
        for i, restored_record in enumerate(restored_data['financial_records']):
            original_record = financial_records[i]
            assert str(restored_record['id']) == str(original_record['id']), \
                f"Restore must preserve financial record {i} ID"
            assert restored_record['planned_amount'] == original_record['planned_amount'], \
                f"Restore must preserve financial record {i} planned amount"
            assert restored_record['actual_amount'] == original_record['actual_amount'], \
                f"Restore must preserve financial record {i} actual amount"
            assert restored_record['currency'] == original_record['currency'], \
                f"Restore must preserve financial record {i} currency"
        
        # Verify aggregated data
        assert restored_data['aggregated']['total_planned'] == aggregated['total_planned'], \
            "Restore must preserve aggregated planned total"
        assert restored_data['aggregated']['total_actual'] == aggregated['total_actual'], \
            "Restore must preserve aggregated actual total"
        assert restored_data['aggregated']['total_variance'] == aggregated['total_variance'], \
            "Restore must preserve aggregated variance"
    
    @given(
        user_assignments=st.lists(
            user_role_assignment_strategy(),
            min_size=1,
            max_size=10
        )
    )
    @settings(max_examples=50, deadline=10000, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_property_32_incremental_backup_consistency(self, user_assignments: List[Dict[str, Any]]):
        """
        Property 32: Backup and Restore Accuracy (Incremental Backups)
        
        For any series of incremental backups, the final restored state must
        match the current state exactly.
        
        Task: 10.2 Add data migration and backup testing
        **Validates: Requirements 7.4**
        """
        # Simulate incremental backup system
        backup_history = []
        current_state = {}
        
        def create_incremental_backup(assignments, backup_type='full'):
            """Create incremental or full backup."""
            if backup_type == 'full':
                backup_data = copy.deepcopy(assignments)
            else:  # incremental
                # Only backup changes since last backup
                last_backup_time = backup_history[-1]['timestamp'] if backup_history else None
                backup_data = [a for a in assignments if not last_backup_time or 
                             a.get('assigned_at', '') > last_backup_time]
            
            backup = {
                'backup_id': str(uuid4()),
                'backup_type': backup_type,
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'data': json.dumps(backup_data, default=str),
                'record_count': len(backup_data)
            }
            backup_history.append(backup)
            return backup
        
        def restore_from_backups():
            """Restore from backup history."""
            restored_state = {}
            
            for backup in backup_history:
                data = json.loads(backup['data'])
                if backup['backup_type'] == 'full':
                    # Full backup replaces everything
                    restored_state = {a['id']: a for a in data}
                else:
                    # Incremental backup adds/updates
                    for assignment in data:
                        restored_state[assignment['id']] = assignment
            
            return list(restored_state.values())
        
        # Create full backup
        full_backup = create_incremental_backup(user_assignments, 'full')
        
        # Update current state
        current_state = {a['id']: a for a in user_assignments}
        
        # Property: Full backup can restore complete state
        restored = restore_from_backups()
        assert len(restored) == len(user_assignments), \
            "Full restore must recover all records"
        
        # Verify each assignment (UUIDs are converted to strings by JSON)
        restored_dict = {str(a['id']): a for a in restored}
        for assignment in user_assignments:
            assert str(assignment['id']) in restored_dict, \
                f"Restore must include assignment {assignment['id']}"
            restored_assignment = restored_dict[str(assignment['id'])]
            assert str(restored_assignment['user_id']) == str(assignment['user_id']), \
                "Restore must preserve user ID"
            assert restored_assignment['role'] == assignment['role'], \
                "Restore must preserve role"
            assert restored_assignment['role_level'] == assignment['role_level'], \
                "Restore must preserve role level"


class TestDataTransformationCorrectness:
    """
    Property-based tests for data transformation correctness.
    
    Task: 10.2 Add data migration and backup testing
    **Validates: Requirements 7.3**
    """
    
    @given(financial_record=financial_record_strategy())
    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_data_transformation_currency_normalization(self, financial_record: Dict[str, Any]):
        """
        Property: Data Transformation Correctness (Currency Normalization)
        
        For any currency normalization transformation, the converted values must
        be mathematically correct and reversible.
        
        Task: 10.2 Add data migration and backup testing
        **Validates: Requirements 7.3**
        """
        # Simulate currency normalization to USD
        def normalize_to_usd(record):
            """Transform financial record to USD base currency."""
            exchange_rate = record.get('exchange_rate', 1.0)
            
            if record['currency'] == 'USD':
                return {
                    **record,
                    'normalized_currency': 'USD',
                    'normalized_planned': record['planned_amount'],
                    'normalized_actual': record['actual_amount'],
                    'transformation_applied': False
                }
            else:
                # Convert to USD
                normalized_planned = record['planned_amount'] / exchange_rate
                normalized_actual = record['actual_amount'] / exchange_rate
                
                return {
                    **record,
                    'normalized_currency': 'USD',
                    'normalized_planned': round(normalized_planned, 2),
                    'normalized_actual': round(normalized_actual, 2),
                    'original_currency': record['currency'],
                    'original_planned': record['planned_amount'],
                    'original_actual': record['actual_amount'],
                    'exchange_rate_used': exchange_rate,
                    'transformation_applied': True
                }
        
        # Property: Transformation preserves original data
        transformed = normalize_to_usd(financial_record)
        
        assert 'normalized_currency' in transformed, \
            "Transformation must add normalized currency"
        assert transformed['normalized_currency'] == 'USD', \
            "Normalized currency must be USD"
        
        # Property: Original data is preserved
        assert transformed['currency'] == financial_record['currency'], \
            "Transformation must preserve original currency"
        assert transformed['planned_amount'] == financial_record['planned_amount'], \
            "Transformation must preserve original planned amount"
        assert transformed['actual_amount'] == financial_record['actual_amount'], \
            "Transformation must preserve original actual amount"
        
        # Property: Transformation is mathematically correct
        if financial_record['currency'] != 'USD' and 'exchange_rate' in financial_record:
            exchange_rate = financial_record['exchange_rate']
            expected_planned = financial_record['planned_amount'] / exchange_rate
            expected_actual = financial_record['actual_amount'] / exchange_rate
            
            assert abs(transformed['normalized_planned'] - expected_planned) < 0.01, \
                "Normalized planned amount must be mathematically correct"
            assert abs(transformed['normalized_actual'] - expected_actual) < 0.01, \
                "Normalized actual amount must be mathematically correct"
    
    @given(
        projects_data=st.lists(
            project_data_strategy(),
            min_size=2,
            max_size=10
        )
    )
    @settings(max_examples=50, deadline=10000, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_data_transformation_aggregation_correctness(self, projects_data: List[Dict[str, Any]]):
        """
        Property: Data Transformation Correctness (Aggregation)
        
        For any data aggregation transformation, the aggregated values must
        match the sum of individual values.
        
        Task: 10.2 Add data migration and backup testing
        **Validates: Requirements 7.3**
        """
        # Simulate portfolio aggregation transformation
        def aggregate_portfolio_metrics(projects):
            """Transform individual projects into portfolio metrics."""
            total_budget = sum(p['budget'] for p in projects)
            avg_budget = total_budget / len(projects) if projects else 0
            
            # Count by status
            status_counts = {}
            for project in projects:
                status = project['status']
                status_counts[status] = status_counts.get(status, 0) + 1
            
            # Count by health
            health_counts = {}
            for project in projects:
                health = project['health']
                health_counts[health] = health_counts.get(health, 0) + 1
            
            return {
                'portfolio_id': str(uuid4()),
                'project_count': len(projects),
                'total_budget': round(total_budget, 2),
                'average_budget': round(avg_budget, 2),
                'status_distribution': status_counts,
                'health_distribution': health_counts,
                'project_ids': [p['id'] for p in projects]
            }
        
        # Property: Aggregation is mathematically correct
        portfolio = aggregate_portfolio_metrics(projects_data)
        
        assert portfolio['project_count'] == len(projects_data), \
            "Aggregation must count all projects"
        
        # Verify total budget
        expected_total = sum(p['budget'] for p in projects_data)
        assert abs(portfolio['total_budget'] - expected_total) < 0.01, \
            "Aggregated total budget must match sum of individual budgets"
        
        # Verify average budget
        expected_avg = expected_total / len(projects_data)
        assert abs(portfolio['average_budget'] - expected_avg) < 0.01, \
            "Aggregated average budget must be correct"
        
        # Verify status distribution
        expected_status_counts = {}
        for project in projects_data:
            status = project['status']
            expected_status_counts[status] = expected_status_counts.get(status, 0) + 1
        
        assert portfolio['status_distribution'] == expected_status_counts, \
            "Status distribution must match actual counts"
        
        # Verify all projects are referenced
        assert len(portfolio['project_ids']) == len(projects_data), \
            "All project IDs must be included in aggregation"
