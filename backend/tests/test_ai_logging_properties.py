"""
Property-based tests for AI Operation Logging
Feature: ai-ppm-platform, Property 34: AI Operation Logging
Validates: Requirements 10.1
"""

import pytest
from hypothesis import given, strategies as st, assume, settings
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timedelta
import uuid
import json
import asyncio

# Import AI model management classes
from ai_model_management import (
    AIModelManager, ModelOperation, ModelOperationType, 
    PerformanceMetrics, PerformanceStatus
)

# Mock Supabase client for testing
class MockSupabaseResponse:
    def __init__(self, data=None, count=0):
        self.data = data
        self.count = count

class MockSupabaseTable:
    def __init__(self):
        self.data_store = {}
        self.query_filters = {}
        self.update_data = None
        self.operations_log = []
    
    def insert(self, data):
        # Simulate database insert for AI operations
        record = data.copy()
        record['id'] = str(uuid.uuid4())
        record['created_at'] = datetime.now().isoformat()
        
        # Store in operations log for testing
        self.operations_log.append(record)
        self.data_store[record['id']] = record
        return MockSupabaseResponse([record])
    
    def select(self, fields):
        return self
    
    def eq(self, field, value):
        self.query_filters[field] = value
        return self
    
    def gte(self, field, value):
        self.query_filters[f"{field}_gte"] = value
        return self
    
    def lte(self, field, value):
        self.query_filters[f"{field}_lte"] = value
        return self
    
    def execute(self):
        # Apply filters and return results
        filtered_data = []
        for record in self.data_store.values():
            matches = True
            for field, value in self.query_filters.items():
                if field.endswith('_gte'):
                    actual_field = field[:-4]
                    if record.get(actual_field, '') < value:
                        matches = False
                        break
                elif field.endswith('_lte'):
                    actual_field = field[:-4]
                    if record.get(actual_field, '') > value:
                        matches = False
                        break
                elif record.get(field) != value:
                    matches = False
                    break
            if matches:
                filtered_data.append(record)
        
        # Reset filters
        self.query_filters = {}
        return MockSupabaseResponse(filtered_data)

class MockSupabaseClient:
    def __init__(self):
        self.tables = {
            'ai_model_operations': MockSupabaseTable(),
            'user_feedback': MockSupabaseTable(),
            'performance_alerts': MockSupabaseTable()
        }
    
    def table(self, table_name):
        return self.tables.get(table_name, MockSupabaseTable())

# Test data strategies for property-based testing
@st.composite
def model_operation_strategy(draw):
    """Generate valid AI model operations for testing"""
    operation_types = [
        ModelOperationType.RAG_QUERY,
        ModelOperationType.RESOURCE_OPTIMIZATION,
        ModelOperationType.RISK_FORECASTING,
        ModelOperationType.HALLUCINATION_VALIDATION,
        ModelOperationType.CONTENT_GENERATION,
        ModelOperationType.SKILL_MATCHING,
        ModelOperationType.CONFLICT_DETECTION
    ]
    
    model_ids = ['gpt-4', 'gpt-3.5-turbo', 'claude-3', 'gemini-pro']
    
    return ModelOperation(
        operation_id=str(uuid.uuid4()),
        model_id=draw(st.sampled_from(model_ids)),
        operation_type=draw(st.sampled_from(operation_types)),
        user_id=str(uuid.uuid4()),
        inputs=draw(st.dictionaries(
            st.text(min_size=1, max_size=50), 
            st.one_of(st.text(max_size=1000), st.integers(), st.floats(allow_nan=False, allow_infinity=False)),
            min_size=1, max_size=10
        )),
        outputs=draw(st.dictionaries(
            st.text(min_size=1, max_size=50), 
            st.one_of(st.text(max_size=2000), st.integers(), st.floats(allow_nan=False, allow_infinity=False)),
            min_size=1, max_size=10
        )),
        confidence_score=draw(st.one_of(st.none(), st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False))),
        response_time_ms=draw(st.integers(min_value=1, max_value=30000)),
        input_tokens=draw(st.integers(min_value=1, max_value=10000)),
        output_tokens=draw(st.integers(min_value=1, max_value=10000)),
        success=draw(st.booleans()),
        error_message=draw(st.one_of(st.none(), st.text(max_size=500))),
        timestamp=datetime.now(),
        metadata=draw(st.dictionaries(
            st.text(min_size=1, max_size=20), 
            st.one_of(st.text(max_size=100), st.integers(), st.booleans()),
            max_size=5
        ))
    )

@st.composite
def performance_metrics_scenario(draw):
    """Generate scenarios for performance metrics testing"""
    return {
        'model_id': draw(st.sampled_from(['gpt-4', 'gpt-3.5-turbo', 'claude-3'])),
        'operation_type': draw(st.sampled_from(list(ModelOperationType))),
        'days': draw(st.integers(min_value=1, max_value=30)),
        'num_operations': draw(st.integers(min_value=1, max_value=100))
    }

class TestAIOperationLogging:
    """Property 34: AI Operation Logging tests"""

    @settings(max_examples=20)
    @given(operation=model_operation_strategy())
    def test_ai_operation_logging_completeness(self, operation):
        """
        Property 34: AI Operation Logging
        For any AI model operation, all operation details should be logged completely and accurately
        Validates: Requirements 10.1
        """
        # Create mock client and AI model manager
        mock_client = MockSupabaseClient()
        ai_manager = AIModelManager(mock_client)
        
        # Log the operation
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            success = loop.run_until_complete(ai_manager.log_model_operation(operation))
            
            # Verify logging was successful
            assert success, "Operation logging should succeed"
            
            # Verify operation was stored in mock database
            operations_table = mock_client.table('ai_model_operations')
            assert len(operations_table.operations_log) > 0, "Operation should be stored in database"
            
            # Verify logged operation contains all required fields
            logged_operation = operations_table.operations_log[-1]
            
            # Check all required fields are present and correct
            assert logged_operation['operation_id'] == operation.operation_id, "Operation ID should be preserved"
            assert logged_operation['model_id'] == operation.model_id, "Model ID should be preserved"
            assert logged_operation['operation_type'] == operation.operation_type.value, "Operation type should be preserved"
            assert logged_operation['user_id'] == operation.user_id, "User ID should be preserved"
            assert logged_operation['inputs'] == operation.inputs, "Inputs should be preserved"
            assert logged_operation['outputs'] == operation.outputs, "Outputs should be preserved"
            assert logged_operation['confidence_score'] == operation.confidence_score, "Confidence score should be preserved"
            assert logged_operation['response_time_ms'] == operation.response_time_ms, "Response time should be preserved"
            assert logged_operation['input_tokens'] == operation.input_tokens, "Input tokens should be preserved"
            assert logged_operation['output_tokens'] == operation.output_tokens, "Output tokens should be preserved"
            assert logged_operation['success'] == operation.success, "Success status should be preserved"
            assert logged_operation['error_message'] == operation.error_message, "Error message should be preserved"
            assert logged_operation['metadata'] == operation.metadata, "Metadata should be preserved"
            
            # Verify timestamp is properly formatted
            assert 'timestamp' in logged_operation, "Timestamp should be included"
            assert isinstance(logged_operation['timestamp'], str), "Timestamp should be string (ISO format)"
            
        finally:
            loop.close()

    @settings(max_examples=15)
    @given(operations=st.lists(model_operation_strategy(), min_size=2, max_size=20))
    def test_ai_operation_logging_consistency(self, operations):
        """
        Property 34: AI Operation Logging - Consistency
        For any sequence of AI operations, logging should maintain consistency and order
        Validates: Requirements 10.1
        """
        # Create mock client and AI model manager
        mock_client = MockSupabaseClient()
        ai_manager = AIModelManager(mock_client)
        
        # Ensure operations have unique IDs
        operation_ids = set()
        for i, operation in enumerate(operations):
            operation.operation_id = f"op_{i}_{uuid.uuid4()}"
            operation_ids.add(operation.operation_id)
        
        # Log all operations
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            logged_count = 0
            for operation in operations:
                success = loop.run_until_complete(ai_manager.log_model_operation(operation))
                if success:
                    logged_count += 1
            
            # Verify all operations were logged
            operations_table = mock_client.table('ai_model_operations')
            assert len(operations_table.operations_log) == logged_count, "All operations should be logged"
            assert logged_count == len(operations), "All operations should succeed"
            
            # Verify operation IDs are unique in the log
            logged_ids = [op['operation_id'] for op in operations_table.operations_log]
            assert len(set(logged_ids)) == len(logged_ids), "All logged operation IDs should be unique"
            
            # Verify all original operation IDs are present
            for operation_id in operation_ids:
                assert operation_id in logged_ids, f"Operation ID {operation_id} should be in the log"
            
        finally:
            loop.close()

    @settings(max_examples=10)
    @given(scenario=performance_metrics_scenario())
    def test_performance_metrics_calculation_accuracy(self, scenario):
        """
        Property 34: AI Operation Logging - Performance Metrics
        For any set of logged operations, performance metrics should be calculated accurately
        Validates: Requirements 10.1
        """
        # Create mock client and AI model manager
        mock_client = MockSupabaseClient()
        ai_manager = AIModelManager(mock_client)
        
        model_id = scenario['model_id']
        operation_type = scenario['operation_type']
        num_operations = scenario['num_operations']
        
        # Generate and log operations
        operations = []
        total_response_time = 0
        total_confidence = 0
        total_input_tokens = 0
        total_output_tokens = 0
        successful_operations = 0
        confidence_count = 0
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            for i in range(num_operations):
                operation = ModelOperation(
                    operation_id=f"test_op_{i}_{uuid.uuid4()}",
                    model_id=model_id,
                    operation_type=operation_type,
                    user_id=str(uuid.uuid4()),
                    inputs={"test": f"input_{i}"},
                    outputs={"test": f"output_{i}"},
                    confidence_score=0.8 + (i % 3) * 0.1 if i % 4 != 0 else None,  # Some operations without confidence
                    response_time_ms=1000 + (i % 5) * 500,
                    input_tokens=50 + (i % 10) * 10,
                    output_tokens=100 + (i % 8) * 20,
                    success=i % 10 != 0,  # 90% success rate
                    error_message="Test error" if i % 10 == 0 else None,
                    timestamp=datetime.now(),
                    metadata={"test": True}
                )
                
                operations.append(operation)
                
                # Calculate expected metrics
                total_response_time += operation.response_time_ms
                total_input_tokens += operation.input_tokens
                total_output_tokens += operation.output_tokens
                
                if operation.success:
                    successful_operations += 1
                
                if operation.confidence_score is not None:
                    total_confidence += operation.confidence_score
                    confidence_count += 1
                
                # Log the operation
                success = loop.run_until_complete(ai_manager.log_model_operation(operation))
                assert success, f"Operation {i} should be logged successfully"
            
            # Get performance metrics
            metrics = loop.run_until_complete(
                ai_manager.get_performance_metrics(model_id, operation_type, days=7)
            )
            
            # Verify metrics calculations
            assert metrics.model_id == model_id, "Model ID should match"
            assert metrics.operation_type == operation_type, "Operation type should match"
            assert metrics.total_operations == num_operations, f"Total operations should be {num_operations}, got {metrics.total_operations}"
            
            # Verify success rate calculation
            expected_success_rate = successful_operations / num_operations
            assert abs(metrics.success_rate - expected_success_rate) < 0.01, f"Success rate should be {expected_success_rate}, got {metrics.success_rate}"
            
            # Verify error rate calculation
            expected_error_rate = (num_operations - successful_operations) / num_operations
            assert abs(metrics.error_rate - expected_error_rate) < 0.01, f"Error rate should be {expected_error_rate}, got {metrics.error_rate}"
            
            # Verify average response time calculation
            expected_avg_response_time = total_response_time / num_operations
            assert abs(metrics.avg_response_time_ms - expected_avg_response_time) < 0.01, f"Average response time should be {expected_avg_response_time}, got {metrics.avg_response_time_ms}"
            
            # Verify average confidence score calculation (if any confidence scores exist)
            if confidence_count > 0:
                expected_avg_confidence = total_confidence / confidence_count
                assert abs(metrics.avg_confidence_score - expected_avg_confidence) < 0.01, f"Average confidence should be {expected_avg_confidence}, got {metrics.avg_confidence_score}"
            else:
                assert metrics.avg_confidence_score == 0.0, "Average confidence should be 0 when no confidence scores exist"
            
            # Verify token calculations
            expected_tokens_per_second = (total_input_tokens + total_output_tokens) / (total_response_time / 1000)
            if total_response_time > 0:
                assert abs(metrics.tokens_per_second - expected_tokens_per_second) < 0.01, f"Tokens per second should be {expected_tokens_per_second}, got {metrics.tokens_per_second}"
            
        finally:
            loop.close()

    @settings(max_examples=10)
    @given(operations=st.lists(model_operation_strategy(), min_size=1, max_size=10))
    def test_ai_operation_error_handling(self, operations):
        """
        Property 34: AI Operation Logging - Error Handling
        For any AI operations (including failed ones), error information should be logged accurately
        Validates: Requirements 10.1
        """
        # Create mock client and AI model manager
        mock_client = MockSupabaseClient()
        ai_manager = AIModelManager(mock_client)
        
        # Ensure some operations have errors
        for i, operation in enumerate(operations):
            if i % 3 == 0:  # Make every third operation fail
                operation.success = False
                operation.error_message = f"Test error for operation {i}: {operation.operation_type.value}"
            else:
                operation.success = True
                operation.error_message = None
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            # Log all operations
            for operation in operations:
                success = loop.run_until_complete(ai_manager.log_model_operation(operation))
                assert success, "Even failed operations should be logged successfully"
            
            # Verify error information is preserved
            operations_table = mock_client.table('ai_model_operations')
            logged_operations = operations_table.operations_log
            
            assert len(logged_operations) == len(operations), "All operations should be logged"
            
            # Check error information for each operation
            for i, logged_op in enumerate(logged_operations):
                original_op = operations[i]
                
                assert logged_op['success'] == original_op.success, f"Success status should match for operation {i}"
                assert logged_op['error_message'] == original_op.error_message, f"Error message should match for operation {i}"
                
                # Verify failed operations have error messages
                if not original_op.success:
                    assert logged_op['error_message'] is not None, f"Failed operation {i} should have error message"
                    assert len(logged_op['error_message']) > 0, f"Error message should not be empty for operation {i}"
                
        finally:
            loop.close()

    @settings(max_examples=5)
    @given(operations=st.lists(model_operation_strategy(), min_size=5, max_size=15))
    def test_ai_operation_metadata_preservation(self, operations):
        """
        Property 34: AI Operation Logging - Metadata Preservation
        For any AI operations with metadata, all metadata should be preserved accurately
        Validates: Requirements 10.1
        """
        # Create mock client and AI model manager
        mock_client = MockSupabaseClient()
        ai_manager = AIModelManager(mock_client)
        
        # Ensure operations have diverse metadata
        for i, operation in enumerate(operations):
            operation.metadata = {
                "test_id": f"test_{i}",
                "batch_id": f"batch_{i // 3}",
                "priority": i % 5,
                "tags": [f"tag_{j}" for j in range(i % 4)],
                "config": {
                    "temperature": 0.7 + (i % 3) * 0.1,
                    "max_tokens": 1000 + i * 100
                }
            }
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            # Log all operations
            for operation in operations:
                success = loop.run_until_complete(ai_manager.log_model_operation(operation))
                assert success, "Operation logging should succeed"
            
            # Verify metadata preservation
            operations_table = mock_client.table('ai_model_operations')
            logged_operations = operations_table.operations_log
            
            assert len(logged_operations) == len(operations), "All operations should be logged"
            
            # Check metadata for each operation
            for i, logged_op in enumerate(logged_operations):
                original_op = operations[i]
                
                assert logged_op['metadata'] == original_op.metadata, f"Metadata should be preserved exactly for operation {i}"
                
                # Verify nested metadata structure is preserved
                if 'config' in original_op.metadata:
                    assert 'config' in logged_op['metadata'], f"Nested config should be preserved for operation {i}"
                    assert logged_op['metadata']['config'] == original_op.metadata['config'], f"Nested config should match for operation {i}"
                
                # Verify list metadata is preserved
                if 'tags' in original_op.metadata:
                    assert 'tags' in logged_op['metadata'], f"Tags list should be preserved for operation {i}"
                    assert logged_op['metadata']['tags'] == original_op.metadata['tags'], f"Tags should match for operation {i}"
                
        finally:
            loop.close()

if __name__ == "__main__":
    # Run the tests
    pytest.main([__file__, "-v"])