"""
Property-Based Test for Error Response Format Consistency

Feature: project-import-mvp
Property 13: Error response format consistency

**Validates: Requirements 7.6**

Property Definition:
*For any* error condition (validation, parsing, authentication, authorization, or server error),
the Import_Service should return a JSON response with the structure:
`{success: false, count: 0, errors: [...], message: "..."}`.

Testing Framework: pytest with Hypothesis for property-based testing
Minimum iterations: 100 per property test
"""

import pytest
from hypothesis import given, settings, assume, HealthCheck
from hypothesis import strategies as st
from typing import Dict, Any, List, Optional
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
import json

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# =============================================================================
# Hypothesis Strategies for Generating Test Data
# =============================================================================

@st.composite
def error_message_strategy(draw):
    """Generate valid error messages."""
    return draw(st.text(min_size=1, max_size=200, alphabet=st.characters(
        whitelist_categories=('L', 'N', 'P', 'S', 'Z'),
        blacklist_characters='\x00'
    )))


@st.composite
def field_name_strategy(draw):
    """Generate valid field names."""
    return draw(st.sampled_from([
        "name", "budget", "status", "start_date", "end_date", 
        "description", "csv", "file", "server", "portfolio_id"
    ]))


@st.composite
def error_value_strategy(draw):
    """Generate various error values."""
    value_type = draw(st.sampled_from(["string", "number", "none", "empty"]))
    if value_type == "string":
        return draw(st.text(min_size=0, max_size=100))
    elif value_type == "number":
        return draw(st.floats(allow_nan=False, allow_infinity=False))
    elif value_type == "none":
        return None
    else:
        return ""


@st.composite
def validation_error_strategy(draw):
    """Generate a single validation error dict."""
    return {
        "index": draw(st.integers(min_value=-1, max_value=1000)),
        "field": draw(field_name_strategy()),
        "value": draw(error_value_strategy()),
        "error": draw(error_message_strategy())
    }


@st.composite
def validation_errors_list_strategy(draw, min_size=0, max_size=10):
    """Generate a list of validation errors."""
    return draw(st.lists(
        validation_error_strategy(),
        min_size=min_size,
        max_size=max_size
    ))


@st.composite
def error_response_strategy(draw):
    """Generate a complete error response."""
    return {
        "success": False,
        "count": 0,
        "errors": draw(validation_errors_list_strategy(min_size=0, max_size=5)),
        "message": draw(error_message_strategy())
    }


# =============================================================================
# Property 13: Error Response Format Consistency
# Feature: project-import-mvp, Property 13: Error response format consistency
# **Validates: Requirements 7.6**
# =============================================================================

class TestErrorResponseFormatConsistency:
    """
    Property 13: Error Response Format Consistency
    
    Feature: project-import-mvp, Property 13: Error response format consistency
    **Validates: Requirements 7.6**
    
    For any error condition (validation, parsing, authentication, authorization, 
    or server error), the Import_Service should return a JSON response with the 
    structure: `{success: false, count: 0, errors: [...], message: "..."}`.
    """
    
    # -------------------------------------------------------------------------
    # Property 13.1: Error response has required structure
    # -------------------------------------------------------------------------
    
    @given(
        message=error_message_strategy(),
        errors=validation_errors_list_strategy(min_size=0, max_size=5)
    )
    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_error_response_has_required_fields(self, message, errors):
        """
        Property: For any error response, it must contain all required fields:
        success, count, errors, and message.
        
        **Validates: Requirements 7.6**
        """
        from routers.projects_import import _create_error_response
        
        # Create error response
        response = _create_error_response(message=message, errors=errors)
        
        # Verify all required fields are present
        assert "success" in response, "Error response missing 'success' field"
        assert "count" in response, "Error response missing 'count' field"
        assert "errors" in response, "Error response missing 'errors' field"
        assert "message" in response, "Error response missing 'message' field"
    
    # -------------------------------------------------------------------------
    # Property 13.2: Error response success is always False
    # -------------------------------------------------------------------------
    
    @given(
        message=error_message_strategy(),
        errors=validation_errors_list_strategy(min_size=0, max_size=5)
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_error_response_success_is_false(self, message, errors):
        """
        Property: For any error response, the 'success' field must be False.
        
        **Validates: Requirements 7.6**
        """
        from routers.projects_import import _create_error_response
        
        response = _create_error_response(message=message, errors=errors)
        
        assert response["success"] is False, (
            f"Error response 'success' should be False, got {response['success']}"
        )
    
    # -------------------------------------------------------------------------
    # Property 13.3: Error response count is always 0
    # -------------------------------------------------------------------------
    
    @given(
        message=error_message_strategy(),
        errors=validation_errors_list_strategy(min_size=0, max_size=5)
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_error_response_count_is_zero(self, message, errors):
        """
        Property: For any error response, the 'count' field must be 0.
        
        **Validates: Requirements 7.6**
        """
        from routers.projects_import import _create_error_response
        
        response = _create_error_response(message=message, errors=errors)
        
        assert response["count"] == 0, (
            f"Error response 'count' should be 0, got {response['count']}"
        )
    
    # -------------------------------------------------------------------------
    # Property 13.4: Error response errors is a list
    # -------------------------------------------------------------------------
    
    @given(
        message=error_message_strategy(),
        errors=validation_errors_list_strategy(min_size=0, max_size=5)
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_error_response_errors_is_list(self, message, errors):
        """
        Property: For any error response, the 'errors' field must be a list.
        
        **Validates: Requirements 7.6**
        """
        from routers.projects_import import _create_error_response
        
        response = _create_error_response(message=message, errors=errors)
        
        assert isinstance(response["errors"], list), (
            f"Error response 'errors' should be a list, got {type(response['errors'])}"
        )
    
    # -------------------------------------------------------------------------
    # Property 13.5: Error response message is a string
    # -------------------------------------------------------------------------
    
    @given(
        message=error_message_strategy(),
        errors=validation_errors_list_strategy(min_size=0, max_size=5)
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_error_response_message_is_string(self, message, errors):
        """
        Property: For any error response, the 'message' field must be a string.
        
        **Validates: Requirements 7.6**
        """
        from routers.projects_import import _create_error_response
        
        response = _create_error_response(message=message, errors=errors)
        
        assert isinstance(response["message"], str), (
            f"Error response 'message' should be a string, got {type(response['message'])}"
        )
    
    # -------------------------------------------------------------------------
    # Property 13.6: Error response preserves error list
    # -------------------------------------------------------------------------
    
    @given(
        message=error_message_strategy(),
        errors=validation_errors_list_strategy(min_size=1, max_size=5)
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_error_response_preserves_errors(self, message, errors):
        """
        Property: For any error response with errors, the errors list should be preserved.
        
        **Validates: Requirements 7.6**
        """
        from routers.projects_import import _create_error_response
        
        response = _create_error_response(message=message, errors=errors)
        
        assert response["errors"] == errors, (
            f"Error response should preserve errors list"
        )
    
    # -------------------------------------------------------------------------
    # Property 13.7: Error response preserves message
    # -------------------------------------------------------------------------
    
    @given(
        message=error_message_strategy(),
        errors=validation_errors_list_strategy(min_size=0, max_size=5)
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_error_response_preserves_message(self, message, errors):
        """
        Property: For any error response, the message should be preserved.
        
        **Validates: Requirements 7.6**
        """
        from routers.projects_import import _create_error_response
        
        response = _create_error_response(message=message, errors=errors)
        
        assert response["message"] == message, (
            f"Error response should preserve message"
        )
    
    # -------------------------------------------------------------------------
    # Property 13.8: Error response with None errors defaults to empty list
    # -------------------------------------------------------------------------
    
    @given(message=error_message_strategy())
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_error_response_none_errors_defaults_to_empty_list(self, message):
        """
        Property: For any error response with None errors, it should default to empty list.
        
        **Validates: Requirements 7.6**
        """
        from routers.projects_import import _create_error_response
        
        response = _create_error_response(message=message, errors=None)
        
        assert response["errors"] == [], (
            f"Error response with None errors should default to empty list"
        )
    
    # -------------------------------------------------------------------------
    # Property 13.9: Error response is JSON serializable
    # -------------------------------------------------------------------------
    
    @given(
        message=error_message_strategy(),
        errors=validation_errors_list_strategy(min_size=0, max_size=5)
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_error_response_is_json_serializable(self, message, errors):
        """
        Property: For any error response, it must be JSON serializable.
        
        **Validates: Requirements 7.6**
        """
        from routers.projects_import import _create_error_response
        
        response = _create_error_response(message=message, errors=errors)
        
        # Should not raise an exception
        try:
            json_str = json.dumps(response)
            parsed = json.loads(json_str)
            assert parsed == response
        except (TypeError, ValueError) as e:
            pytest.fail(f"Error response is not JSON serializable: {e}")


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
