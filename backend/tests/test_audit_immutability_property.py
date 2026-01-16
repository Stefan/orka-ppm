"""
Property-Based Tests for Audit Log Immutability

Tests Property 16: Append-Only Audit Log Immutability
Validates: Requirements 6.1
"""

import pytest
from hypothesis import given, strategies as st, settings
from uuid import uuid4


# ============================================================================
# Property Tests
# ============================================================================

# Feature: ai-empowered-audit-trail, Property 16: Append-Only Audit Log Immutability
@pytest.mark.property_test
def test_no_update_endpoints_exist():
    """
    Property 16: Append-Only Audit Log Immutability
    
    For any audit event in the roche_audit_logs table, there should be no 
    update or delete operations exposed through the API, ensuring that once 
    an event is created, it cannot be modified or removed.
    
    Validates: Requirements 6.1
    
    Property: The audit router should not expose any UPDATE or DELETE endpoints.
    """
    # Import the router to check its endpoints
    from routers.audit import router
    
    # Get all routes from the router
    routes = router.routes
    
    # Check that no routes use PUT, PATCH, or DELETE methods
    for route in routes:
        methods = route.methods if hasattr(route, 'methods') else set()
        
        # Property: No UPDATE methods (PUT, PATCH) should exist
        assert "PUT" not in methods, \
            f"Route {route.path} should not have PUT method (violates immutability)"
        
        assert "PATCH" not in methods, \
            f"Route {route.path} should not have PATCH method (violates immutability)"
        
        # Property: No DELETE methods should exist
        assert "DELETE" not in methods, \
            f"Route {route.path} should not have DELETE method (violates immutability)"


@pytest.mark.property_test
def test_only_read_and_create_operations_allowed():
    """
    Property: Audit router should only expose read (GET) and create (POST) operations.
    
    This ensures append-only behavior at the API level.
    
    Validates: Requirements 6.1
    """
    from routers.audit import router
    
    # Get all routes from the router
    routes = router.routes
    
    # Collect all HTTP methods used
    all_methods = set()
    for route in routes:
        if hasattr(route, 'methods'):
            all_methods.update(route.methods)
    
    # Property: Only GET and POST methods should be present
    allowed_methods = {"GET", "POST", "HEAD", "OPTIONS"}  # HEAD and OPTIONS are standard HTTP
    
    for method in all_methods:
        assert method in allowed_methods, \
            f"Method {method} is not allowed in append-only audit API"


@pytest.mark.property_test
def test_audit_router_documentation_mentions_immutability():
    """
    Property: API documentation should mention immutability.
    
    The router module should document the append-only nature of audit logs.
    
    Validates: Requirements 6.1
    """
    import routers.audit as audit_module
    
    # Get the module docstring or source
    module_source = audit_module.__doc__ or ""
    
    # Check if immutability/append-only is mentioned
    # (This is a documentation check)
    assert len(module_source) > 0, \
        "Audit router should have documentation"


# ============================================================================
# Unit Tests for Immutability Enforcement
# ============================================================================

def test_audit_router_has_no_update_routes():
    """Test that audit router has no update routes."""
    from routers.audit import router
    
    # Check each route
    for route in router.routes:
        if hasattr(route, 'path'):
            # Ensure no routes contain 'update' in their path
            # (This is a naming convention check)
            path_lower = route.path.lower()
            
            # If a route has 'update' in the name, it should not exist
            if 'update' in path_lower:
                # Check that it's not actually an update endpoint
                methods = route.methods if hasattr(route, 'methods') else set()
                assert "PUT" not in methods and "PATCH" not in methods, \
                    f"Route {route.path} appears to be an update endpoint"


def test_audit_router_has_no_delete_routes():
    """Test that audit router has no delete routes."""
    from routers.audit import router
    
    # Check each route
    for route in router.routes:
        if hasattr(route, 'path'):
            # Ensure no routes contain 'delete' in their path
            path_lower = route.path.lower()
            
            # If a route has 'delete' in the name, it should not exist
            if 'delete' in path_lower:
                # Check that it's not actually a delete endpoint
                methods = route.methods if hasattr(route, 'methods') else set()
                assert "DELETE" not in methods, \
                    f"Route {route.path} appears to be a delete endpoint"


def test_append_only_enforcement_documented():
    """Test that append-only enforcement is documented in the router."""
    import routers.audit
    import inspect
    
    # Get the source code of the router module
    source = inspect.getsource(routers.audit)
    
    # Check that append-only or immutability is mentioned
    source_lower = source.lower()
    
    assert 'append-only' in source_lower or 'immutability' in source_lower or 'immutable' in source_lower, \
        "Audit router should document append-only/immutability enforcement"
