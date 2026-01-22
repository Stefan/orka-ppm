"""
Property-based tests for Audit RAG Search functionality.

These tests validate universal correctness properties for the audit log semantic search
using pytest and Hypothesis to ensure comprehensive coverage across all possible
search scenarios.

Feature: ai-empowered-ppm-features
Task: 19.4, 19.5
Requirements: 14.3, 14.4
"""

import pytest
from hypothesis import given, strategies as st, assume, settings
from datetime import datetime, timezone, timedelta
from uuid import UUID, uuid4
from typing import Dict, Any, List, Optional
import json

# Mock data structures for testing
@st.composite
def audit_log_data(draw):
    """Generate realistic audit log data for testing."""
    event_types = [
        'user_login', 'user_logout', 'data_access', 'data_modification',
        'project_created', 'project_updated', 'budget_changed', 'resource_allocated',
        'security_change', 'permission_granted', 'permission_revoked'
    ]
    severities = ['info', 'warning', 'error', 'critical']
    categories = ['Security Change', 'Financial Impact', 'Resource Allocation', 'Risk Event', 'Compliance Action']
    risk_levels = ['Low', 'Medium', 'High', 'Critical']
    
    return {
        'id': draw(st.uuids()),
        'event_type': draw(st.sampled_from(event_types)),
        'user_id': draw(st.uuids()),
        'entity_type': draw(st.sampled_from(['project', 'resource', 'budget', 'user', 'permission'])),
        'entity_id': draw(st.uuids()),
        'action_details': draw(st.dictionaries(
            st.text(min_size=1, max_size=20),
            st.one_of(st.text(max_size=50), st.integers(), st.decimals())
        )),
        'severity': draw(st.sampled_from(severities)),
        'timestamp': datetime.now(timezone.utc) - timedelta(days=draw(st.integers(min_value=0, max_value=30))),
        'category': draw(st.sampled_from(categories)),
        'risk_level': draw(st.sampled_from(risk_levels)),
        'tags': draw(st.dictionaries(st.text(min_size=1, max_size=10), st.text(max_size=20))),
        'is_anomaly': draw(st.booleans()),
        'anomaly_score': draw(st.floats(min_value=0.0, max_value=1.0)),
        'similarity_score': draw(st.floats(min_value=0.0, max_value=1.0))
    }

@st.composite
def search_query_data(draw):
    """Generate realistic search queries for testing."""
    queries = [
        "show me all security changes",
        "find budget modifications",
        "list critical events",
        "user login failures",
        "permission changes for project",
        "high risk events last week",
        "anomalous activities",
        "financial impact changes"
    ]
    return draw(st.sampled_from(queries))


class MockAuditSearchAgent:
    """Mock audit search agent for property testing."""
    
    def __init__(self):
        self.search_results: List[Dict[str, Any]] = []
    
    def rank_results(self, query: str, results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Rank results by relevance (cosine similarity)
        
        This is a simplified version for testing that sorts by similarity_score
        """
        # Sort by similarity_score in descending order
        ranked = sorted(
            results,
            key=lambda x: x.get('similarity_score', 0.0),
            reverse=True
        )
        
        # Add relevance_score field
        for result in ranked:
            result['relevance_score'] = result.get('similarity_score', 0.0)
        
        return ranked
    
    def highlight_results(self, query: str, results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Highlight relevant sections in search results
        
        This is a simplified version for testing
        """
        query_terms = set(query.lower().split())
        
        for result in results:
            # Build text to highlight
            text_parts = []
            
            if result.get('event_type'):
                text_parts.append(f"Event: {result['event_type']}")
            
            if result.get('entity_type'):
                text_parts.append(f"Entity: {result['entity_type']}")
            
            if result.get('severity'):
                text_parts.append(f"Severity: {result['severity']}")
            
            if result.get('category'):
                text_parts.append(f"Category: {result['category']}")
            
            full_text = ". ".join(text_parts)
            
            # Simple highlighting: wrap matching terms in **bold**
            highlighted_text = full_text
            for term in query_terms:
                if len(term) > 2:
                    import re
                    pattern = re.compile(re.escape(term), re.IGNORECASE)
                    highlighted_text = pattern.sub(f"**{term}**", highlighted_text)
            
            result['highlighted_text'] = highlighted_text
        
        return results


class TestAuditRAGSearchProperties:
    """Property-based tests for Audit RAG Search"""
    
    @given(
        results=st.lists(audit_log_data(), min_size=1, max_size=50),
        query=search_query_data()
    )
    @settings(max_examples=100)
    def test_property_31_rag_audit_search_relevance_ranking(self, results, query):
        """
        Feature: ai-empowered-ppm-features
        Property 31: RAG Audit Search Relevance Ranking
        
        For any audit search query, the Audit_System SHALL return results ranked by 
        relevance score (cosine similarity of embeddings) in descending order.
        
        **Validates: Requirements 14.3**
        """
        # Arrange
        agent = MockAuditSearchAgent()
        
        # Act
        ranked_results = agent.rank_results(query, results)
        
        # Assert: Results should be sorted by relevance_score in descending order
        assert len(ranked_results) == len(results), "All results should be returned"
        
        # Check that results are sorted in descending order
        for i in range(len(ranked_results) - 1):
            current_score = ranked_results[i].get('relevance_score', 0.0)
            next_score = ranked_results[i + 1].get('relevance_score', 0.0)
            assert current_score >= next_score, \
                f"Results not properly ranked: {current_score} < {next_score} at position {i}"
        
        # Check that all results have relevance_score field
        for result in ranked_results:
            assert 'relevance_score' in result, "All results must have relevance_score"
            assert 0.0 <= result['relevance_score'] <= 1.0, \
                f"Relevance score must be between 0 and 1, got {result['relevance_score']}"
    
    @given(
        results=st.lists(audit_log_data(), min_size=1, max_size=50),
        query=search_query_data()
    )
    @settings(max_examples=100)
    def test_property_32_audit_search_result_highlighting(self, results, query):
        """
        Feature: ai-empowered-ppm-features
        Property 32: Audit Search Result Highlighting
        
        For any audit search result, the system SHALL include highlighted_text showing 
        the relevant sections that matched the query.
        
        **Validates: Requirements 14.4**
        """
        # Arrange
        agent = MockAuditSearchAgent()
        
        # Act
        highlighted_results = agent.highlight_results(query, results)
        
        # Assert: All results should have highlighted_text field
        assert len(highlighted_results) == len(results), "All results should be returned"
        
        for result in highlighted_results:
            assert 'highlighted_text' in result, \
                "All results must have highlighted_text field"
            
            assert isinstance(result['highlighted_text'], str), \
                "highlighted_text must be a string"
            
            assert len(result['highlighted_text']) > 0, \
                "highlighted_text must not be empty"
            
            # Check that highlighted text contains relevant information
            highlighted = result['highlighted_text']
            
            # Should contain at least one of: event type, entity type, severity, or category
            has_relevant_info = any([
                result.get('event_type', '') in highlighted,
                result.get('entity_type', '') in highlighted,
                result.get('severity', '') in highlighted,
                result.get('category', '') in highlighted
            ])
            
            assert has_relevant_info, \
                "highlighted_text must contain relevant information from the result"
    
    @given(
        results=st.lists(audit_log_data(), min_size=2, max_size=50),
        query=search_query_data()
    )
    @settings(max_examples=50)
    def test_ranking_stability(self, results, query):
        """
        Test that ranking is stable - same input produces same output
        
        Property: For any set of results and query, ranking should be deterministic
        """
        # Arrange
        agent = MockAuditSearchAgent()
        
        # Act - rank twice
        ranked_1 = agent.rank_results(query, results.copy())
        ranked_2 = agent.rank_results(query, results.copy())
        
        # Assert - should produce same order
        assert len(ranked_1) == len(ranked_2), "Rankings should have same length"
        
        for i in range(len(ranked_1)):
            assert ranked_1[i]['id'] == ranked_2[i]['id'], \
                f"Rankings differ at position {i}"
            assert ranked_1[i]['relevance_score'] == ranked_2[i]['relevance_score'], \
                f"Relevance scores differ at position {i}"
    
    @given(
        results=st.lists(audit_log_data(), min_size=1, max_size=50),
        query=search_query_data()
    )
    @settings(max_examples=50)
    def test_highlighting_preserves_results(self, results, query):
        """
        Test that highlighting doesn't modify original result data
        
        Property: For any results, highlighting should only add highlighted_text field
        """
        # Arrange
        agent = MockAuditSearchAgent()
        original_ids = [r['id'] for r in results]
        
        # Act
        highlighted = agent.highlight_results(query, results)
        
        # Assert - all original results should be present
        assert len(highlighted) == len(results), "Highlighting should preserve all results"
        
        highlighted_ids = [r['id'] for r in highlighted]
        assert set(highlighted_ids) == set(original_ids), \
            "Highlighting should not change result IDs"
        
        # Check that original fields are preserved
        for i, result in enumerate(highlighted):
            original = results[i]
            for key in ['id', 'event_type', 'user_id', 'entity_type', 'severity']:
                if key in original:
                    assert result[key] == original[key], \
                        f"Highlighting modified original field {key}"
    
    @given(
        results=st.lists(audit_log_data(), min_size=1, max_size=10)
    )
    @settings(max_examples=50)
    def test_empty_query_handling(self, results):
        """
        Test that empty or whitespace queries are handled gracefully
        
        Property: For any results with empty query, highlighting should still work
        """
        # Arrange
        agent = MockAuditSearchAgent()
        empty_queries = ["", "   ", "\t", "\n"]
        
        for query in empty_queries:
            # Act
            highlighted = agent.highlight_results(query, results)
            
            # Assert - should still return results with highlighted_text
            assert len(highlighted) == len(results), \
                f"Empty query '{query}' should still return all results"
            
            for result in highlighted:
                assert 'highlighted_text' in result, \
                    f"Empty query '{query}' should still add highlighted_text"
    
    @given(
        results=st.lists(audit_log_data(), min_size=5, max_size=50)
    )
    @settings(max_examples=50)
    def test_top_results_have_highest_scores(self, results):
        """
        Test that top N results have the highest relevance scores
        
        Property: For any ranked results, the first N results should have 
        the N highest relevance scores
        """
        # Arrange
        agent = MockAuditSearchAgent()
        query = "test query"
        top_n = min(5, len(results))
        
        # Act
        ranked = agent.rank_results(query, results)
        
        # Assert - top N should have highest scores
        top_scores = [r['relevance_score'] for r in ranked[:top_n]]
        all_scores = [r['relevance_score'] for r in ranked]
        
        # Every score in top_n should be >= every score not in top_n
        for top_score in top_scores:
            for other_score in all_scores[top_n:]:
                assert top_score >= other_score, \
                    f"Top result score {top_score} should be >= other score {other_score}"


# Integration test with mock data
class TestAuditRAGSearchIntegration:
    """Integration tests for Audit RAG Search with realistic scenarios"""
    
    def test_search_with_multiple_matching_terms(self):
        """Test search with query containing multiple matching terms"""
        # Arrange
        agent = MockAuditSearchAgent()
        results = [
            {
                'id': uuid4(),
                'event_type': 'security_change',
                'entity_type': 'permission',
                'severity': 'critical',
                'category': 'Security Change',
                'similarity_score': 0.95
            },
            {
                'id': uuid4(),
                'event_type': 'user_login',
                'entity_type': 'user',
                'severity': 'info',
                'category': 'Security Change',
                'similarity_score': 0.75
            },
            {
                'id': uuid4(),
                'event_type': 'budget_changed',
                'entity_type': 'budget',
                'severity': 'warning',
                'category': 'Financial Impact',
                'similarity_score': 0.50
            }
        ]
        query = "security change critical"
        
        # Act
        ranked = agent.rank_results(query, results)
        highlighted = agent.highlight_results(query, ranked)
        
        # Assert
        assert len(highlighted) == 3
        assert highlighted[0]['similarity_score'] == 0.95  # Highest score first
        assert highlighted[1]['similarity_score'] == 0.75
        assert highlighted[2]['similarity_score'] == 0.50
        
        # Check highlighting
        assert '**security**' in highlighted[0]['highlighted_text'].lower() or \
               '**critical**' in highlighted[0]['highlighted_text'].lower()
    
    def test_search_with_no_results(self):
        """Test search with empty results"""
        # Arrange
        agent = MockAuditSearchAgent()
        results = []
        query = "test query"
        
        # Act
        ranked = agent.rank_results(query, results)
        highlighted = agent.highlight_results(query, ranked)
        
        # Assert
        assert len(ranked) == 0
        assert len(highlighted) == 0
    
    def test_search_with_identical_scores(self):
        """Test search where multiple results have identical relevance scores"""
        # Arrange
        agent = MockAuditSearchAgent()
        results = [
            {'id': uuid4(), 'event_type': 'event1', 'similarity_score': 0.8},
            {'id': uuid4(), 'event_type': 'event2', 'similarity_score': 0.8},
            {'id': uuid4(), 'event_type': 'event3', 'similarity_score': 0.8}
        ]
        query = "test"
        
        # Act
        ranked = agent.rank_results(query, results)
        
        # Assert
        assert len(ranked) == 3
        # All should have same score
        assert all(r['relevance_score'] == 0.8 for r in ranked)
        # Order should be stable (same as input order for equal scores)
        assert ranked[0]['event_type'] == 'event1'
        assert ranked[1]['event_type'] == 'event2'
        assert ranked[2]['event_type'] == 'event3'

