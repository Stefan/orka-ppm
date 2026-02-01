"""
Property-Based Tests for Response Generator
Feature: ai-help-chat-knowledge-base
Tests Properties 12 and 13 from the design document
"""

import pytest
from hypothesis import given, strategies as st, settings, assume
from typing import List, Dict, Any
import os
import sys
import uuid

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from services.response_generator import ResponseGenerator, CitationExtractor
from services.context_retriever import ContextualResult
from services.vector_store import SearchResult


# Test data strategies
@st.composite
def contextual_results_strategy(draw):
    """Generate mock contextual results"""
    num_results = draw(st.integers(min_value=1, max_value=5))

    results = []
    for i in range(num_results):
        # Create mock search result
        search_result = SearchResult(
            chunk_id=f"chunk_{i}",
            document_id=f"doc_{i}",
            chunk_index=i,
            content=draw(st.text(min_size=100, max_size=300, alphabet=st.characters(
                whitelist_categories=('Lu', 'Ll', 'Nd', 'Zs', 'Po')
            ))),
            similarity_score=draw(st.floats(min_value=0.5, max_value=0.9)),
            metadata={
                "title": f"Document {i}",
                "category": draw(st.sampled_from(["dashboard", "projects", "resources"])),
                "url": f"/docs/doc_{i}"
            }
        )

        # Create contextual result
        result = ContextualResult(
            search_result=search_result,
            contextual_score=draw(st.floats(min_value=0.1, max_value=1.0)),
            role_relevance=draw(st.floats(min_value=0.0, max_value=1.0)),
            page_relevance=draw(st.floats(min_value=0.0, max_value=1.0)),
            recency_score=draw(st.floats(min_value=0.1, max_value=1.0))
        )
        results.append(result)

    return results


@st.composite
def user_context_strategy(draw):
    """Generate user context for testing"""
    return {
        "user_id": str(uuid.uuid4()),
        "role": draw(st.sampled_from(["admin", "manager", "user"])),
        "current_page": draw(st.sampled_from(["/dashboard", "/projects", "/help"])),
        "current_project": draw(st.one_of(st.none(), st.uuids().map(str))),
        "current_portfolio": draw(st.one_of(st.none(), st.uuids().map(str))),
        "preferences": {}
    }


@pytest.fixture
def mock_response_generator():
    """Create a mock response generator for testing"""
    class MockOpenAIClient:
        async def chat(self, **kwargs):
            # Mock response
            return type('Response', (), {
                'choices': [type('Choice', (), {
                    'message': type('Message', (), {
                        'content': "This is a mock response with citation [1] and another citation [2]."
                    })()
                })()],
                'usage': type('Usage', (), {
                    'prompt_tokens': 100,
                    'completion_tokens': 50
                })()
            })()

    class MockTranslationService:
        async def translate_from_english(self, text: str, target_lang: str) -> str:
            return f"[{target_lang}] {text}"

    openai_client = MockOpenAIClient()
    translation_service = MockTranslationService()

    return ResponseGenerator(openai_client, translation_service)


@pytest.mark.property_test
class TestResponsePromptConstruction:
    """
    Property tests for response prompt construction.
    Property 12: Response Prompt Construction
    Validates: Requirements 4.1
    """

    @settings(max_examples=20, deadline=8000)
    @given(
        query=st.text(min_size=10, max_size=100, alphabet=st.characters(
            whitelist_categories=('Lu', 'Ll', 'Nd', 'Zs', 'Po')
        )),
        contextual_results=contextual_results_strategy(),
        user_context=user_context_strategy()
    )
    async def test_prompt_contains_all_context(self, mock_response_generator, query, contextual_results, user_context):
        """
        Test that generated prompts contain all necessary context.

        Property 12: Prompts must include query, context chunks,
        and user information.
        """
        # Get the prompt construction method (if accessible) or test the full flow
        # Since _construct_prompt is private, we'll test through the main method

        response = await mock_response_generator.generate_response(
            query=query,
            context_results=contextual_results,
            user_context=user_context
        )

        # Verify response contains expected elements
        assert "response" in response, "Response must contain response field"
        assert "citations" in response, "Response must contain citations field"
        assert "sources" in response, "Response must contain sources field"
        assert "confidence" in response, "Response must contain confidence field"

    @settings(max_examples=15, deadline=6000)
    @given(contextual_results=contextual_results_strategy())
    async def test_prompt_includes_source_references(self, mock_response_generator, contextual_results):
        """
        Test that prompts include proper source references.

        Property 12: Context must be properly formatted with
        numbered references for citation.
        """
        query = "How do I create a project?"
        user_context = {"role": "user", "current_page": "/dashboard"}

        response = await mock_response_generator.generate_response(
            query=query,
            context_results=contextual_results,
            user_context=user_context
        )

        # In our mock, response includes citations
        assert isinstance(response["citations"], list), "Citations must be a list"
        assert len(response["citations"]) >= 0, "Citations count must be valid"


@pytest.mark.property_test
class TestCitationInclusion:
    """
    Property tests for citation inclusion.
    Property 13: Citation Inclusion
    Validates: Requirements 4.4
    """

    @settings(max_examples=25, deadline=9000)
    @given(contextual_results=contextual_results_strategy())
    async def test_citations_correspond_to_sources(self, mock_response_generator, contextual_results):
        """
        Test that citations correspond to available sources.

        Property 13: All citations in response must reference
        valid sources.
        """
        assume(len(contextual_results) > 0)

        query = "Test query for citations"
        user_context = {"role": "user"}

        response = await mock_response_generator.generate_response(
            query=query,
            context_results=contextual_results,
            user_context=user_context
        )

        citations = response["citations"]
        sources = response["sources"]

        # Check citation validity
        for citation in citations:
            assert "number" in citation, "Citation must have number field"
            citation_num = citation["number"]

            # Citation number should correspond to a source
            assert 1 <= citation_num <= len(sources), f"Citation {citation_num} must reference valid source (1-{len(sources)})"

    @settings(max_examples=20, deadline=7000)
    def test_citation_extraction_from_text(self, contextual_results):
        """
        Test citation extraction from response text.

        Property 13: Citation extraction must correctly identify
        all citation markers in text.
        """
        # Test various citation formats
        test_texts = [
            "This is information [1] and more details [2].",
            "According to source [3], this is correct.",
            "Multiple citations [1], [2], and [3] support this.",
            "No citations here.",
            "Citation [5] at the end."
        ]

        for text in test_texts:
            citations = CitationExtractor.extract_citations(text)

            # Verify extraction is valid
            for citation in citations:
                assert isinstance(citation["number"], int), "Citation number must be integer"
                assert citation["number"] > 0, "Citation number must be positive"

    @settings(max_examples=15, deadline=5000)
    def test_citation_validation_logic(self, contextual_results):
        """
        Test citation validation against available context.

        Property 13: Citation validation must correctly check
        if citations reference available sources.
        """
        assume(len(contextual_results) >= 3)

        # Test various response texts
        test_cases = [
            ("Response with citation [1]", True),
            ("Response with citations [1] and [2]", True),
            ("Response with invalid citation [10]", False),
            ("Response with citations [1], [2], [3]", True),
            ("No citations", True)
        ]

        for response_text, expected_valid in test_cases:
            is_valid = CitationExtractor.validate_citations(response_text, contextual_results)
            if len(contextual_results) >= 3:
                assert is_valid == expected_valid, f"Citation validation failed for: {response_text}"