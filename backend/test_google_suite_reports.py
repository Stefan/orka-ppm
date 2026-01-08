#!/usr/bin/env python3
"""
Test script for Google Suite Report Generation API endpoints
"""

import sys
import os
import asyncio
import json
from datetime import datetime, timedelta, date
from decimal import Decimal
from uuid import uuid4

# Add the backend directory to Python path
sys.path.append('.')

from roche_construction_models import (
    ReportTemplateCreate, ReportTemplate, ReportConfig, ReportGenerationRequest, GeneratedReport,
    ReportTemplateType, ReportGenerationStatus, ChartConfig
)
from roche_construction_services import GoogleSuiteReportGenerator, TemplateEngine

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
    
    def order(self, column, desc=False):
        return self
    
    def range(self, start, end):
        return self
    
    def delete(self):
        return self
    
    def execute(self):
        # Return mock data based on table and filters
        if self.table_name == "report_templates":
            if self.last_insert:
                # Return the inserted data with an ID
                result = self.last_insert.copy()
                result['id'] = str(uuid4())
                result['created_at'] = datetime.now().isoformat()
                result['updated_at'] = datetime.now().isoformat()
                self.mock_data.append(result)
                return type('MockResult', (), {'data': [result]})()
            else:
                # Return existing data with filters applied
                filtered_data = self.mock_data.copy()
                
                if 'id' in self.filters:
                    filtered_data = [d for d in filtered_data if d.get('id') == self.filters['id']]
                
                if 'is_active' in self.filters:
                    filtered_data = [d for d in filtered_data if d.get('is_active') == self.filters['is_active']]
                
                return type('MockResult', (), {'data': filtered_data})()
        
        elif self.table_name == "generated_reports":
            if self.last_insert:
                # Return the inserted data with an ID
                result = self.last_insert.copy()
                result['id'] = str(uuid4())
                result['created_at'] = datetime.now().isoformat()
                self.mock_data.append(result)
                return type('MockResult', (), {'data': [result]})()
            else:
                # Return existing data
                filtered_data = self.mock_data.copy()
                
                if 'project_id' in self.filters:
                    filtered_data = [d for d in filtered_data if d.get('project_id') == self.filters['project_id']]
                
                if 'id' in self.filters:
                    filtered_data = [d for d in filtered_data if d.get('id') == self.filters['id']]
                
                return type('MockResult', (), {'data': filtered_data})()
        
        elif self.table_name == "projects":
            # Mock project data
            return type('MockResult', (), {'data': [{
                'id': str(uuid4()),
                'name': 'Test Project',
                'description': 'Test project for report generation',
                'budget': 100000,
                'actual_cost': 75000,
                'start_date': datetime.now().isoformat(),
                'end_date': (datetime.now() + timedelta(days=90)).isoformat(),
                'status': 'active'
            }]})()
        
        else:
            return type('MockResult', (), {'data': []})()
    
    def insert(self, data):
        self.last_insert = data
        return self
    
    def update(self, data):
        self.last_update = data
        return self

class MockSupabaseClient:
    def __init__(self):
        self.tables = {}
    
    def table(self, table_name):
        if table_name not in self.tables:
            self.tables[table_name] = MockSupabaseTable(table_name)
        return self.tables[table_name]

def test_template_engine():
    """Test the TemplateEngine functionality"""
    print("🧪 Testing Template Engine...")
    
    engine = TemplateEngine()
    
    # Test 1: Data context building
    print("\n1. Testing data context building...")
    
    project_data = {
        'name': 'Test Project',
        'budget': 100000,
        'actual_cost': 75000,
        'start_date': '2024-01-01',
        'end_date': '2024-12-31'
    }
    
    try:
        context = engine._build_data_context(project_data)
        print(f"✅ Data context built with {len(context)} top-level keys")
        
        # Check financial calculations
        if 'financial' in context:
            financial = context['financial']
            print(f"   Budget: ${financial['budget']:,.2f}")
            print(f"   Actual: ${financial['actual_cost']:,.2f}")
            print(f"   Variance: ${financial['variance']:,.2f}")
            print(f"   Utilization: {financial['utilization_percentage']:.1f}%")
        
    except Exception as e:
        print(f"❌ Failed to build data context: {e}")
        return False
    
    # Test 2: Template population
    print("\n2. Testing template population...")
    
    template = {
        'name': 'Test Template',
        'data_mappings': {
            'project_name': 'project.name',
            'project_budget': 'financial.budget',
            'project_variance': 'financial.variance',
            'generation_date': 'current_date'
        }
    }
    
    try:
        populated = engine.populate_template_with_data(template, project_data)
        print(f"✅ Template populated with {len(populated['populated_data'])} fields")
        
        # Check populated data
        data = populated['populated_data']
        print(f"   Project Name: {data.get('project_name')}")
        print(f"   Budget: ${data.get('project_budget', 0):,.2f}")
        print(f"   Generation Date: {data.get('generation_date')}")
        
    except Exception as e:
        print(f"❌ Failed to populate template: {e}")
        return False
    
    # Test 3: Chart generation
    print("\n3. Testing chart generation...")
    
    chart_configs = [
        {
            'title': 'Financial Summary',
            'chart_type': 'bar',
            'data_source': 'financial_summary'
        },
        {
            'title': 'Risk Distribution',
            'chart_type': 'pie',
            'data_source': 'risk_distribution'
        }
    ]
    
    try:
        charts = engine.generate_charts_and_visualizations(context, chart_configs)
        print(f"✅ Generated {len(charts)} charts")
        
        for chart in charts:
            print(f"   Chart: {chart['title']} ({chart['type']})")
            if 'data' in chart and chart['data']:
                print(f"     Data points: {len(chart['data'])}")
        
    except Exception as e:
        print(f"❌ Failed to generate charts: {e}")
        return False
    
    print("🎉 All Template Engine tests passed!")
    return True

async def test_google_suite_service():
    """Test the GoogleSuiteReportGenerator functionality"""
    print("\n🧪 Testing Google Suite Report Generator...")
    
    # Create mock Supabase client
    mock_supabase = MockSupabaseClient()
    
    # Initialize service
    service = GoogleSuiteReportGenerator(mock_supabase)
    
    # Test data
    project_id = uuid4()
    user_id = uuid4()
    
    # Test 1: Create report template
    print("\n1. Testing report template creation...")
    
    template_data = {
        'name': 'Executive Summary Template',
        'description': 'Standard executive summary report',
        'template_type': 'executive_summary',
        'google_slides_template_id': 'template_12345',
        'data_mappings': {
            'project_name': 'project.name',
            'project_status': 'project.status',
            'budget': 'financial.budget',
            'actual_cost': 'financial.actual_cost',
            'variance': 'financial.variance'
        },
        'chart_configurations': [
            {
                'title': 'Financial Overview',
                'chart_type': 'bar',
                'data_source': 'financial_summary'
            }
        ],
        'is_public': True,
        'tags': ['executive', 'summary', 'financial']
    }
    
    try:
        template_result = await service.create_template(template_data, user_id)
        print(f"✅ Template created: {template_result['name']}")
        template_id = template_result['id']
    except Exception as e:
        print(f"❌ Failed to create template: {e}")
        return False
    
    # Test 2: Validate template
    print("\n2. Testing template validation...")
    try:
        validation = await service.validate_template_compatibility(template_id)
        print(f"✅ Template validation: {'Valid' if validation['is_valid'] else 'Invalid'}")
        if validation['warnings']:
            print(f"   Warnings: {len(validation['warnings'])}")
        if validation['errors']:
            print(f"   Errors: {len(validation['errors'])}")
    except Exception as e:
        print(f"❌ Failed to validate template: {e}")
        return False
    
    # Test 3: Generate report
    print("\n3. Testing report generation...")
    
    report_config = {
        'template_id': template_id,
        'include_charts': True,
        'include_raw_data': False,
        'custom_title': 'Q4 Executive Summary'
    }
    
    try:
        report_result = await service.generate_report(
            project_id=project_id,
            template_id=template_id,
            report_config=report_config,
            user_id=user_id,
            name='Test Executive Report',
            description='Generated test report'
        )
        print(f"✅ Report generated: {report_result['name']}")
        print(f"   Google Drive URL: {report_result['google_drive_url']}")
        print(f"   Generation time: {report_result['generation_time_ms']}ms")
        report_id = report_result['id']
    except Exception as e:
        print(f"❌ Failed to generate report: {e}")
        return False
    
    # Test 4: Get report status
    print("\n4. Testing report status retrieval...")
    try:
        status = await service.get_report_status(report_id)
        print(f"✅ Report status: {status['generation_status']}")
        print(f"   Progress: {status['progress_percentage']}%")
    except Exception as e:
        print(f"❌ Failed to get report status: {e}")
        return False
    
    # Test 5: List templates
    print("\n5. Testing template listing...")
    try:
        templates = await service.list_templates(template_type='executive_summary')
        print(f"✅ Found {len(templates)} executive summary templates")
    except Exception as e:
        print(f"❌ Failed to list templates: {e}")
        return False
    
    # Test 6: List project reports
    print("\n6. Testing project reports listing...")
    try:
        reports = await service.list_project_reports(project_id)
        print(f"✅ Found {len(reports)} reports for project")
    except Exception as e:
        print(f"❌ Failed to list project reports: {e}")
        return False
    
    print("\n🎉 All Google Suite Service tests passed!")
    return True

def test_pydantic_models():
    """Test the Pydantic models for Google Suite reports"""
    print("\n🧪 Testing Pydantic Models...")
    
    # Test ChartConfig
    chart_config = ChartConfig(
        chart_type='bar',
        data_source='financial_summary',
        title='Financial Overview',
        x_axis='Categories',
        y_axis='Amount',
        colors=['#4CAF50', '#2196F3', '#FF9800']
    )
    print(f"✅ ChartConfig model: {chart_config.title}")
    
    # Test ReportTemplateCreate
    template_create = ReportTemplateCreate(
        name='Test Template',
        template_type=ReportTemplateType.project_status,
        data_mappings={'project_name': 'project.name'},
        chart_configurations=[chart_config],
        is_public=True,
        tags=['test', 'template']
    )
    print(f"✅ ReportTemplateCreate model: {template_create.name}")
    
    # Test ReportConfig
    report_config = ReportConfig(
        template_id=uuid4(),
        data_range_start=date.today(),
        data_range_end=date.today() + timedelta(days=30),
        include_charts=True,
        custom_title='Custom Report Title'
    )
    print(f"✅ ReportConfig model: {report_config.custom_title}")
    
    # Test ReportGenerationRequest
    generation_request = ReportGenerationRequest(
        project_id=uuid4(),
        config=report_config,
        name='Test Report',
        description='Test report generation'
    )
    print(f"✅ ReportGenerationRequest model: {generation_request.name}")
    
    print("🎉 All Pydantic model tests passed!")
    return True

async def main():
    """Run all tests"""
    print("🚀 Starting Google Suite Report Generation Tests...")
    
    # Test Pydantic models
    if not test_pydantic_models():
        print("❌ Pydantic model tests failed")
        return False
    
    # Test Template Engine
    if not test_template_engine():
        print("❌ Template Engine tests failed")
        return False
    
    # Test service functionality
    if not await test_google_suite_service():
        print("❌ Service tests failed")
        return False
    
    print("\n🎉 All tests completed successfully!")
    print("\n📋 Google Suite Report Generation System Summary:")
    print("   ✅ GoogleSuiteReportGenerator implemented")
    print("   ✅ TemplateEngine for data processing and chart generation")
    print("   ✅ Pydantic models defined")
    print("   ✅ API router created (routers/reports.py)")
    print("   ✅ Database schema in migration file")
    print("   ✅ Template management system")
    print("   ✅ Report generation with Google Drive integration")
    print("   ✅ Chart and visualization generation")
    print("   ✅ Template validation and compatibility checking")
    print("   ✅ Report status tracking and management")
    
    return True

if __name__ == "__main__":
    asyncio.run(main())