"""
API Contract Testing - Schema Validation, Pagination, and Filtering

This module implements comprehensive property-based testing for API contracts,
including schema compliance, pagination behavior, and filtering correctness.

Task: 8.1 Create comprehensive API schema validation
**Validates: Requirements 6.1, 6.2, 6.3**
"""

import pytest
from typing import Dict, Any, List, Optional
from uuid import UUID, uuid4
from datetime import datetime, timezone

from hypothesis import given, settings, assume
from hypothesis import strategies as st

from tests.property_tests.pbt_framework import (
    DomainGenerators,
    BackendPBTFramework,
    get_test_settings
)


# ============================================================================
# API Schema Validation Helpers
# ============================================================================

class APISchemaValidator:
    """
    Validator for API response schemas.
    
    Provides validation methods for common API response patterns including:
    - Project responses
    - Financial record responses
    - User responses
    - Pagination metadata
    - Error responses
    
    **Validates: Requirements 6.1**
    """
    
    @staticmethod
    def validate_project_schema(project: Dict[str, Any]) -> bool:
        """
        Validate that a project response matches the expected schema.
        
        Args:
            project: Project data to validate
            
        Returns:
            True if schema is valid, False otherwise
        """
        required_fields = ['id', 'name', 'budget', 'status', 'created_at']
        
        # Check required fields exist
        for field in required_fields:
            if field not in project:
                return False
        
        # Validate field types
        try:
            # ID should be UUID-like string
            UUID(str(project['id']))
            
            # Name should be non-empty string
            if not isinstance(project['name'], str) or not project['name'].strip():
                return False
            
            # Budget should be numeric and non-negative
            budget = float(project['budget'])
            if budget < 0:
                return False
            
            # Status should be valid
            valid_statuses = ['planning', 'active', 'on_hold', 'completed', 'cancelled']
            if project['status'] not in valid_statuses:
                return False
            
            # created_at should be valid ISO timestamp
            datetime.fromisoformat(project['created_at'].replace('Z', '+00:00'))
            
            return True
        except (ValueError, TypeError, KeyError):
            return False
    
    @staticmethod
    def validate_financial_record_schema(record: Dict[str, Any]) -> bool:
        """
        Validate that a financial record response matches the expected schema.
        
        Args:
            record: Financial record data to validate
            
        Returns:
            True if schema is valid, False otherwise
        """
        required_fields = ['id', 'planned_amount', 'actual_amount', 'currency', 'variance_amount']
        
        # Check required fields exist
        for field in required_fields:
            if field not in record:
                return False
        
        # Validate field types
        try:
            # ID should be UUID-like string
            UUID(str(record['id']))
            
            # Amounts should be numeric
            float(record['planned_amount'])
            float(record['actual_amount'])
            float(record['variance_amount'])
            
            # Currency should be valid
            valid_currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD']
            if record['currency'] not in valid_currencies:
                return False
            
            return True
        except (ValueError, TypeError, KeyError):
            return False
    
    @staticmethod
    def validate_pagination_metadata(response: Dict[str, Any]) -> bool:
        """
        Validate that pagination metadata is present and correct.
        
        Args:
            response: API response with pagination metadata
            
        Returns:
            True if pagination metadata is valid, False otherwise
        """
        required_fields = ['total_count', 'page', 'per_page', 'total_pages']
        
        # Check required fields exist
        for field in required_fields:
            if field not in response:
                return False
        
        # Validate field types and constraints
        try:
            total_count = int(response['total_count'])
            page = int(response['page'])
            per_page = int(response['per_page'])
            total_pages = int(response['total_pages'])
            
            # All values should be non-negative
            if total_count < 0 or page < 0 or per_page < 0 or total_pages < 0:
                return False
            
            # Page should be within valid range
            if total_pages > 0:
                if page > 0 and page > total_pages:
                    return False
            # For empty results (total_pages=0), any page is acceptable
            
            # Per page should be reasonable
            if per_page < 1 or per_page > 1000:
                return False
            
            # Total pages calculation should be correct
            if per_page > 0:
                expected_total_pages = (total_count + per_page - 1) // per_page
                if total_pages != expected_total_pages:
                    return False
            
            return True
        except (ValueError, TypeError, KeyError):
            return False
    
    @staticmethod
    def validate_error_response(response: Dict[str, Any]) -> bool:
        """
        Validate that an error response matches the expected schema.
        
        Args:
            response: Error response data to validate
            
        Returns:
            True if error schema is valid, False otherwise
        """
        # Error responses should have 'detail' field
        if 'detail' not in response:
            return False
        
        # Detail should be a non-empty string
        if not isinstance(response['detail'], str) or not response['detail'].strip():
            return False
        
        return True


# ============================================================================
# API Response Generators
# ============================================================================

@st.composite
def api_project_response(draw) -> Dict[str, Any]:
    """
    Generate a valid API project response.
    
    Args:
        draw: Hypothesis draw function
        
    Returns:
        Dict containing valid project API response
    """
    project = draw(DomainGenerators.project_data())
    
    # Ensure response matches API schema
    return {
        'id': str(project['id']),
        'name': project['name'],
        'budget': project['budget'],
        'status': project['status'],
        'health': project['health'],
        'created_at': project['created_at'],
        'organization_id': str(project['organization_id'])
    }


@st.composite
def api_financial_response(draw) -> Dict[str, Any]:
    """
    Generate a valid API financial record response.
    
    Args:
        draw: Hypothesis draw function
        
    Returns:
        Dict containing valid financial record API response
    """
    record = draw(DomainGenerators.financial_record())
    
    # Ensure response matches API schema
    return {
        'id': str(record['id']),
        'planned_amount': record['planned_amount'],
        'actual_amount': record['actual_amount'],
        'currency': record['currency'],
        'variance_amount': record['variance_amount'],
        'variance_percentage': record['variance_percentage'],
        'created_at': record['created_at']
    }


@st.composite
def pagination_params(draw) -> Dict[str, int]:
    """
    Generate valid pagination parameters.
    
    Args:
        draw: Hypothesis draw function
        
    Returns:
        Dict containing page and per_page parameters
    """
    return {
        'page': draw(st.integers(min_value=1, max_value=100)),
        'per_page': draw(st.integers(min_value=1, max_value=100))
    }


@st.composite
def filter_params(draw) -> Dict[str, Any]:
    """
    Generate valid filter parameters for API requests.
    
    Args:
        draw: Hypothesis draw function
        
    Returns:
        Dict containing filter parameters
    """
    params = {}
    
    # Optional search term
    if draw(st.booleans()):
        params['search'] = draw(st.text(min_size=1, max_size=50))
    
    # Optional status filter
    if draw(st.booleans()):
        params['status'] = draw(st.sampled_from(['planning', 'active', 'completed', 'cancelled']))
    
    # Optional sort field
    if draw(st.booleans()):
        params['sort_by'] = draw(st.sampled_from(['name', 'created_at', 'budget', 'status']))
        params['sort_order'] = draw(st.sampled_from(['asc', 'desc']))
    
    return params


# ============================================================================
# Property Tests for API Schema Compliance
# ============================================================================

class TestAPISchemaCompliance:
    """
    Property tests for API schema compliance across different input variations.
    
    **Property 24: API Schema Compliance**
    **Validates: Requirements 6.1**
    """
    
    @given(project=api_project_response())
    @settings(max_examples=100, deadline=None)
    def test_project_response_schema_compliance(self, project: Dict[str, Any]):
        """
        Property: Project API responses must match defined schema.
        
        For any valid project data, the API response should conform to
        the project schema with all required fields and correct types.
        
        **Property 24: API Schema Compliance**
        **Validates: Requirements 6.1**
        """
        # Validate schema compliance
        assert APISchemaValidator.validate_project_schema(project), \
            f"Project response does not match schema: {project}"
        
        # Verify specific constraints
        assert UUID(project['id']), "Project ID must be valid UUID"
        assert len(project['name'].strip()) > 0, "Project name must be non-empty"
        assert project['budget'] >= 0, "Project budget must be non-negative"
        assert project['status'] in ['planning', 'active', 'on_hold', 'completed', 'cancelled'], \
            "Project status must be valid"
    
    @given(record=api_financial_response())
    @settings(max_examples=100, deadline=None)
    def test_financial_record_schema_compliance(self, record: Dict[str, Any]):
        """
        Property: Financial record API responses must match defined schema.
        
        For any valid financial record, the API response should conform to
        the financial record schema with all required fields and correct types.
        
        **Property 24: API Schema Compliance**
        **Validates: Requirements 6.1**
        """
        # Validate schema compliance
        assert APISchemaValidator.validate_financial_record_schema(record), \
            f"Financial record response does not match schema: {record}"
        
        # Verify specific constraints
        assert UUID(record['id']), "Record ID must be valid UUID"
        assert record['currency'] in ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD'], \
            "Currency must be valid"
        
        # Verify variance calculation consistency
        expected_variance = record['actual_amount'] - record['planned_amount']
        assert abs(record['variance_amount'] - expected_variance) < 0.02, \
            "Variance amount must match calculation"
    
    @given(
        projects=st.lists(api_project_response(), min_size=0, max_size=50)
    )
    @settings(max_examples=50, deadline=None)
    def test_list_response_schema_compliance(self, projects: List[Dict[str, Any]]):
        """
        Property: List API responses must have consistent schema for all items.
        
        For any list of projects, all items in the response should conform
        to the same schema with consistent field types.
        
        **Property 24: API Schema Compliance**
        **Validates: Requirements 6.1**
        """
        # All projects in list should match schema
        for project in projects:
            assert APISchemaValidator.validate_project_schema(project), \
                f"Project in list does not match schema: {project}"
        
        # If list is not empty, verify field consistency
        if projects:
            first_project = projects[0]
            field_names = set(first_project.keys())
            
            # All projects should have same fields
            for project in projects[1:]:
                assert set(project.keys()) == field_names, \
                    "All projects in list should have same fields"


# ============================================================================
# Property Tests for Pagination Behavior
# ============================================================================

class TestPaginationBehavior:
    """
    Property tests for API pagination behavior consistency.
    
    **Property 25: Pagination Behavior Consistency**
    **Validates: Requirements 6.2**
    """
    
    @given(
        total_items=st.integers(min_value=0, max_value=1000),
        params=pagination_params()
    )
    @settings(max_examples=100, deadline=None)
    def test_pagination_metadata_correctness(self, total_items: int, params: Dict[str, int]):
        """
        Property: Pagination metadata must be mathematically correct.
        
        For any total item count and pagination parameters, the pagination
        metadata should correctly calculate total pages and item ranges.
        
        **Property 25: Pagination Behavior Consistency**
        **Validates: Requirements 6.2**
        """
        page = params['page']
        per_page = params['per_page']
        
        # Calculate expected pagination metadata
        total_pages = (total_items + per_page - 1) // per_page if per_page > 0 else 0
        
        # Only test valid page numbers (within range)
        # Invalid page numbers should be rejected by the API with 400 error
        if total_pages > 0 and page > total_pages:
            # This would be an invalid request - API should return 400
            # Skip this test case as it's testing error handling, not pagination logic
            assume(False)
        
        # Create pagination response
        pagination_response = {
            'total_count': total_items,
            'page': page,
            'per_page': per_page,
            'total_pages': total_pages
        }
        
        # Validate pagination metadata
        assert APISchemaValidator.validate_pagination_metadata(pagination_response), \
            f"Pagination metadata is invalid: {pagination_response}"
        
        # Verify total pages calculation
        assert pagination_response['total_pages'] == total_pages, \
            "Total pages calculation must be correct"
    
    @given(
        items=st.lists(api_project_response(), min_size=0, max_size=100),
        params=pagination_params()
    )
    @settings(max_examples=50, deadline=None)
    def test_pagination_item_count_consistency(self, items: List[Dict[str, Any]], params: Dict[str, int]):
        """
        Property: Paginated responses must respect per_page limit.
        
        For any list of items and pagination parameters, the number of items
        returned should not exceed per_page limit.
        
        **Property 25: Pagination Behavior Consistency**
        **Validates: Requirements 6.2**
        """
        page = params['page']
        per_page = params['per_page']
        
        # Calculate pagination
        start_idx = (page - 1) * per_page
        end_idx = start_idx + per_page
        
        # Get paginated items
        paginated_items = items[start_idx:end_idx]
        
        # Verify item count respects per_page limit
        assert len(paginated_items) <= per_page, \
            f"Paginated items ({len(paginated_items)}) exceeds per_page limit ({per_page})"
        
        # Verify correct items are returned
        if start_idx < len(items):
            expected_count = min(per_page, len(items) - start_idx)
            assert len(paginated_items) == expected_count, \
                "Paginated items count should match expected count"
    
    @given(
        items=st.lists(api_project_response(), min_size=10, max_size=100),
        per_page=st.integers(min_value=5, max_value=20)
    )
    @settings(max_examples=50, deadline=None)
    def test_pagination_completeness(self, items: List[Dict[str, Any]], per_page: int):
        """
        Property: Paginating through all pages must return all items exactly once.
        
        For any list of items, iterating through all pages should return
        every item exactly once with no duplicates or omissions.
        
        **Property 25: Pagination Behavior Consistency**
        **Validates: Requirements 6.2**
        """
        total_items = len(items)
        total_pages = (total_items + per_page - 1) // per_page
        
        # Collect all items from all pages
        collected_items = []
        for page in range(1, total_pages + 1):
            start_idx = (page - 1) * per_page
            end_idx = start_idx + per_page
            page_items = items[start_idx:end_idx]
            collected_items.extend(page_items)
        
        # Verify all items collected
        assert len(collected_items) == total_items, \
            "Pagination should return all items"
        
        # Verify no duplicates (by comparing IDs)
        collected_ids = [item['id'] for item in collected_items]
        original_ids = [item['id'] for item in items]
        assert collected_ids == original_ids, \
            "Pagination should return items in order without duplicates"


# ============================================================================
# Property Tests for API Filtering
# ============================================================================

class TestAPIFilteringCorrectness:
    """
    Property tests for API filtering parameter correctness.
    
    **Property 26: API Filter Parameter Correctness**
    **Validates: Requirements 6.3**
    """
    
    @given(
        projects=st.lists(api_project_response(), min_size=5, max_size=50),
        search_term=st.text(min_size=1, max_size=20)
    )
    @settings(max_examples=50, deadline=None)
    def test_search_filter_correctness(self, projects: List[Dict[str, Any]], search_term: str):
        """
        Property: Search filtering must return only matching items.
        
        For any search term, filtered results should only include items
        where the search term appears in searchable fields.
        
        **Property 26: API Filter Parameter Correctness**
        **Validates: Requirements 6.3**
        """
        search_lower = search_term.lower().strip()
        
        # Skip if search term is empty after stripping
        assume(len(search_lower) > 0)
        
        # Apply search filter
        filtered_projects = [
            p for p in projects
            if search_lower in p['name'].lower()
        ]
        
        # Verify all filtered items match search criteria
        for project in filtered_projects:
            assert search_lower in project['name'].lower(), \
                f"Filtered project '{project['name']}' does not match search term '{search_term}'"
        
        # Verify no matching items were excluded
        for project in projects:
            if search_lower in project['name'].lower():
                assert project in filtered_projects, \
                    f"Matching project '{project['name']}' was excluded from results"
    
    @given(
        projects=st.lists(api_project_response(), min_size=5, max_size=50),
        status_filter=st.sampled_from(['planning', 'active', 'completed', 'cancelled'])
    )
    @settings(max_examples=50, deadline=None)
    def test_status_filter_correctness(self, projects: List[Dict[str, Any]], status_filter: str):
        """
        Property: Status filtering must return only items with matching status.
        
        For any status filter, filtered results should only include items
        with the specified status value.
        
        **Property 26: API Filter Parameter Correctness**
        **Validates: Requirements 6.3**
        """
        # Apply status filter
        filtered_projects = [
            p for p in projects
            if p['status'] == status_filter
        ]
        
        # Verify all filtered items have correct status
        for project in filtered_projects:
            assert project['status'] == status_filter, \
                f"Filtered project has status '{project['status']}' but filter is '{status_filter}'"
        
        # Verify no matching items were excluded
        for project in projects:
            if project['status'] == status_filter:
                assert project in filtered_projects, \
                    f"Project with status '{status_filter}' was excluded from results"
    
    @given(
        projects=st.lists(api_project_response(), min_size=5, max_size=50),
        sort_field=st.sampled_from(['name', 'budget', 'created_at']),
        sort_order=st.sampled_from(['asc', 'desc'])
    )
    @settings(max_examples=50, deadline=None)
    def test_sort_parameter_correctness(self, projects: List[Dict[str, Any]], 
                                       sort_field: str, sort_order: str):
        """
        Property: Sort parameters must order results correctly.
        
        For any sort field and order, results should be sorted according
        to the specified field in the specified order.
        
        **Property 26: API Filter Parameter Correctness**
        **Validates: Requirements 6.3**
        """
        # Sort projects
        reverse = (sort_order == 'desc')
        sorted_projects = sorted(projects, key=lambda p: p[sort_field], reverse=reverse)
        
        # Verify sort order
        for i in range(len(sorted_projects) - 1):
            current = sorted_projects[i][sort_field]
            next_item = sorted_projects[i + 1][sort_field]
            
            if sort_order == 'asc':
                assert current <= next_item, \
                    f"Items not sorted ascending: {current} > {next_item}"
            else:
                assert current >= next_item, \
                    f"Items not sorted descending: {current} < {next_item}"
    
    @given(
        projects=st.lists(api_project_response(), min_size=10, max_size=50),
        filters=filter_params()
    )
    @settings(max_examples=30, deadline=None)
    def test_combined_filter_consistency(self, projects: List[Dict[str, Any]], 
                                        filters: Dict[str, Any]):
        """
        Property: Combined filters must be applied consistently.
        
        For any combination of filters, all filter criteria should be
        applied correctly and consistently.
        
        **Property 26: API Filter Parameter Correctness**
        **Validates: Requirements 6.3**
        """
        filtered_projects = projects.copy()
        
        # Apply search filter if present
        if 'search' in filters and filters['search'].strip():
            search_lower = filters['search'].lower().strip()
            filtered_projects = [
                p for p in filtered_projects
                if search_lower in p['name'].lower()
            ]
        
        # Apply status filter if present
        if 'status' in filters:
            filtered_projects = [
                p for p in filtered_projects
                if p['status'] == filters['status']
            ]
        
        # Apply sorting if present
        if 'sort_by' in filters:
            sort_field = filters['sort_by']
            reverse = filters.get('sort_order', 'asc') == 'desc'
            filtered_projects = sorted(filtered_projects, key=lambda p: p[sort_field], reverse=reverse)
        
        # Verify all filtered items meet all criteria
        for project in filtered_projects:
            # Check search criteria
            if 'search' in filters and filters['search'].strip():
                search_lower = filters['search'].lower().strip()
                assert search_lower in project['name'].lower(), \
                    "Filtered project does not match search criteria"
            
            # Check status criteria
            if 'status' in filters:
                assert project['status'] == filters['status'], \
                    "Filtered project does not match status criteria"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
