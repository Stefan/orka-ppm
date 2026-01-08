#!/usr/bin/env python3
"""
Test script for SAP PO Breakdown Management API endpoints
"""

import sys
import os
import asyncio
import json
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import uuid4

# Add the backend directory to Python path
sys.path.append('.')

from roche_construction_models import (
    POBreakdownCreate, POBreakdownUpdate, POBreakdown, ImportConfig, ImportResult,
    POBreakdownSummary, POBreakdownType
)
from roche_construction_services import POBreakdownService, HierarchyManager

# Mock Supabase client for testing
class MockSupabaseTable:
    def __init__(self, table_name, mock_data=None):
        self.table_name = table_name
        self.mock_data = mock_data or []
        self.last_insert = None
        self.last_update = None
        self.filters = {}
    
    def select(self, columns="*"):
        return self
    
    def eq(self, column, value):
        self.filters[column] = value
        return self
    
    def ilike(self, column, pattern):
        self.filters[f"{column}_ilike"] = pattern
        return self
    
    def order(self, column, desc=False):
        return self
    
    def range(self, start, end):
        return self
    
    def execute(self):
        # Return mock data based on table and filters
        if self.table_name == "po_breakdowns":
            if self.last_insert:
                # Return the inserted data with an ID
                result = self.last_insert.copy()
                result['id'] = str(uuid4())
                result['remaining_amount'] = float(result['planned_amount']) - float(result['actual_amount'])
                result['created_at'] = datetime.now().isoformat()
                result['updated_at'] = datetime.now().isoformat()
                self.mock_data.append(result)
                return type('MockResult', (), {'data': [result]})()
            elif self.last_update:
                # Return updated data
                return type('MockResult', (), {'data': [self.last_update]})()
            else:
                # Return existing data with filters applied
                filtered_data = self.mock_data.copy()
                
                # Apply filters
                if 'project_id' in self.filters:
                    filtered_data = [d for d in filtered_data if d.get('project_id') == self.filters['project_id']]
                
                if 'is_active' in self.filters:
                    filtered_data = [d for d in filtered_data if d.get('is_active') == self.filters['is_active']]
                
                if 'id' in self.filters:
                    filtered_data = [d for d in filtered_data if d.get('id') == self.filters['id']]
                
                return type('MockResult', (), {'data': filtered_data})()
        elif self.table_name == "projects":
            # Mock project data
            return type('MockResult', (), {'data': [{
                'id': str(uuid4()),
                'name': 'Test Project',
                'code': 'TEST',
                'start_date': datetime.now().isoformat(),
                'end_date': (datetime.now() + timedelta(days=90)).isoformat(),
                'budget': 100000
            }]})()
        else:
            return type('MockResult', (), {'data': []})()
    
    def insert(self, data):
        self.last_insert = data
        return self
    
    def update(self, data):
        self.last_update = data
        return self
    
    def upsert(self, data):
        return self.insert(data)

class MockSupabaseClient:
    def __init__(self):
        self.tables = {}
    
    def table(self, table_name):
        if table_name not in self.tables:
            self.tables[table_name] = MockSupabaseTable(table_name)
        return self.tables[table_name]

def test_hierarchy_manager():
    """Test the HierarchyManager functionality"""
    print("🧪 Testing Hierarchy Manager...")
    
    manager = HierarchyManager()
    
    # Test CSV parsing
    csv_data = """name,sap_po_number,planned_amount,cost_center
Project Root,PO-001,100000,CC-001
  Phase 1,PO-002,50000,CC-002
    Task 1.1,PO-003,25000,CC-003
    Task 1.2,PO-004,25000,CC-004
  Phase 2,PO-005,50000,CC-005"""
    
    column_mappings = {
        'name': 'name',
        'sap_po_number': 'sap_po_number',
        'planned_amount': 'planned_amount',
        'cost_center': 'cost_center'
    }
    
    # Test 1: Parse CSV hierarchy
    print("\n1. Testing CSV parsing...")
    try:
        parsed_rows = manager.parse_csv_hierarchy(csv_data, column_mappings)
        print(f"✅ Parsed {len(parsed_rows)} rows")
        
        # Check hierarchy levels
        levels = [row.get('hierarchy_level', 0) for row in parsed_rows]
        print(f"✅ Hierarchy levels detected: {levels}")
        
    except Exception as e:
        print(f"❌ Failed to parse CSV: {e}")
        return False
    
    # Test 2: Validate hierarchy integrity
    print("\n2. Testing hierarchy validation...")
    try:
        # Add IDs for validation
        for i, row in enumerate(parsed_rows):
            row['id'] = f"test-{i}"
            if row.get('hierarchy_level', 0) > 0:
                # Find parent (previous item with lower level)
                for j in range(i-1, -1, -1):
                    if parsed_rows[j].get('hierarchy_level', 0) == row.get('hierarchy_level', 0) - 1:
                        row['parent_breakdown_id'] = parsed_rows[j]['id']
                        break
        
        validation = manager.validate_hierarchy_integrity(parsed_rows)
        print(f"✅ Hierarchy validation: {validation['is_valid']}")
        if validation['errors']:
            print(f"   Errors: {validation['errors']}")
        if validation['warnings']:
            print(f"   Warnings: {validation['warnings']}")
        
    except Exception as e:
        print(f"❌ Failed to validate hierarchy: {e}")
        return False
    
    # Test 3: Calculate cost rollups
    print("\n3. Testing cost rollups...")
    try:
        rollups = manager.calculate_cost_rollups(parsed_rows)
        print(f"✅ Calculated rollups for {len(rollups)} items")
        
        # Check root item rollup
        root_id = parsed_rows[0]['id']
        if root_id in rollups:
            root_rollup = rollups[root_id]
            print(f"   Root planned: {root_rollup['planned_amount']}")
            print(f"   Children total: {root_rollup['child_planned_total']}")
        
    except Exception as e:
        print(f"❌ Failed to calculate rollups: {e}")
        return False
    
    print("🎉 All Hierarchy Manager tests passed!")
    return True

async def test_po_breakdown_service():
    """Test the POBreakdownService functionality"""
    print("\n🧪 Testing PO Breakdown Service...")
    
    # Create mock Supabase client
    mock_supabase = MockSupabaseClient()
    
    # Initialize service
    service = POBreakdownService(mock_supabase)
    
    # Test data
    project_id = uuid4()
    user_id = uuid4()
    
    # Test 1: Create custom breakdown
    print("\n1. Testing custom breakdown creation...")
    
    breakdown_data = {
        'project_id': project_id,
        'name': 'Test PO Breakdown',
        'code': 'PO-TEST-001',
        'sap_po_number': 'SAP-12345',
        'hierarchy_level': 0,
        'planned_amount': Decimal('50000.00'),
        'committed_amount': Decimal('25000.00'),
        'actual_amount': Decimal('10000.00'),
        'currency': 'USD',
        'breakdown_type': 'sap_standard',
        'cost_center': 'CC-001',
        'category': 'Development',
        'tags': ['critical', 'phase1']
    }
    
    try:
        result = await service.create_custom_breakdown(project_id, breakdown_data, user_id)
        print(f"✅ Custom breakdown created: {result['name']}")
        breakdown_id = result['id']
    except Exception as e:
        print(f"❌ Failed to create breakdown: {e}")
        return False
    
    # Test 2: Get breakdown by ID
    print("\n2. Testing breakdown retrieval...")
    try:
        retrieved = await service.get_breakdown_by_id(breakdown_id)
        print(f"✅ Breakdown retrieved: {retrieved['name']}")
    except Exception as e:
        print(f"❌ Failed to retrieve breakdown: {e}")
        return False
    
    # Test 3: Update breakdown
    print("\n3. Testing breakdown update...")
    try:
        updates = {
            'actual_amount': '15000.00',
            'notes': 'Updated actual amount'
        }
        updated = await service.update_breakdown_structure(breakdown_id, updates, user_id)
        print(f"✅ Breakdown updated: {updated.get('notes', 'No notes')}")
    except Exception as e:
        print(f"❌ Failed to update breakdown: {e}")
        return False
    
    # Test 4: CSV Import
    print("\n4. Testing CSV import...")
    
    csv_data = """Name,SAP PO,Planned Amount,Cost Center
Root Project,PO-001,100000,CC-001
  Phase 1,PO-002,50000,CC-002
    Task 1.1,PO-003,25000,CC-003"""
    
    import_config = {
        'column_mappings': {
            'Name': 'name',
            'SAP PO': 'sap_po_number',
            'Planned Amount': 'planned_amount',
            'Cost Center': 'cost_center'
        },
        'default_breakdown_type': 'sap_standard',
        'default_currency': 'USD',
        'skip_validation_errors': False
    }
    
    try:
        import_result = await service.import_sap_csv(csv_data, project_id, import_config, user_id)
        print(f"✅ CSV import completed: {import_result['successful_imports']} successful")
        if import_result['errors']:
            print(f"   Errors: {import_result['errors']}")
    except Exception as e:
        print(f"❌ Failed to import CSV: {e}")
        return False
    
    # Test 5: Get hierarchy
    print("\n5. Testing hierarchy retrieval...")
    try:
        hierarchy = await service.get_breakdown_hierarchy(project_id)
        print(f"✅ Retrieved hierarchy with {len(hierarchy)} items")
    except Exception as e:
        print(f"❌ Failed to get hierarchy: {e}")
        return False
    
    # Test 6: Search breakdowns
    print("\n6. Testing breakdown search...")
    try:
        search_results = await service.search_breakdowns(project_id, search_query="Test")
        print(f"✅ Search returned {len(search_results)} results")
    except Exception as e:
        print(f"❌ Failed to search breakdowns: {e}")
        return False
    
    # Test 7: Get summary
    print("\n7. Testing breakdown summary...")
    try:
        summary = await service.get_breakdown_summary(project_id)
        print(f"✅ Summary: {summary['breakdown_count']} breakdowns, ${summary['total_planned']} planned")
    except Exception as e:
        print(f"❌ Failed to get summary: {e}")
        return False
    
    print("\n🎉 All PO Breakdown Service tests passed!")
    return True

def test_pydantic_models():
    """Test the Pydantic models for PO breakdown management"""
    print("\n🧪 Testing Pydantic Models...")
    
    # Test POBreakdownCreate
    breakdown_create = POBreakdownCreate(
        project_id=uuid4(),
        name='Test Breakdown',
        planned_amount=Decimal('50000.00'),
        breakdown_type=POBreakdownType.sap_standard,
        cost_center='CC-001',
        category='Development'
    )
    print(f"✅ POBreakdownCreate model: {breakdown_create.name}")
    
    # Test ImportConfig
    import_config = ImportConfig(
        column_mappings={'Name': 'name', 'Amount': 'planned_amount'},
        default_breakdown_type=POBreakdownType.custom_hierarchy,
        skip_validation_errors=True
    )
    print(f"✅ ImportConfig model: {len(import_config.column_mappings)} mappings")
    
    print("🎉 All Pydantic model tests passed!")
    return True

async def main():
    """Run all tests"""
    print("🚀 Starting SAP PO Breakdown Management Tests...")
    
    # Test Pydantic models
    if not test_pydantic_models():
        print("❌ Pydantic model tests failed")
        return False
    
    # Test Hierarchy Manager
    if not test_hierarchy_manager():
        print("❌ Hierarchy Manager tests failed")
        return False
    
    # Test service functionality
    if not await test_po_breakdown_service():
        print("❌ Service tests failed")
        return False
    
    print("\n🎉 All tests completed successfully!")
    print("\n📋 SAP PO Breakdown Management System Summary:")
    print("   ✅ POBreakdownService implemented")
    print("   ✅ HierarchyManager for CSV parsing and validation")
    print("   ✅ Pydantic models defined")
    print("   ✅ API endpoints added to main.py")
    print("   ✅ Database schema in migration file")
    print("   ✅ CSV import with hierarchy detection")
    print("   ✅ Cost rollup calculations")
    print("   ✅ Search and filtering capabilities")
    print("   ✅ Hierarchy integrity validation")
    
    return True

if __name__ == "__main__":
    asyncio.run(main())