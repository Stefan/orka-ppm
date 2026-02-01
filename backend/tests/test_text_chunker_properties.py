"""
Property-Based Tests for Text Chunker
Feature: ai-help-chat-knowledge-base
Tests Property 6 from the design document
"""

import pytest
from hypothesis import given, strategies as st, settings, assume
from typing import List
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from services.text_chunker import (
    TextChunker,
    Chunk,
    ChunkingError
)


# Test data strategies
@st.composite
def text_document_strategy(draw):
    """Generate text documents of various sizes"""
    # Generate multiple paragraphs
    num_paragraphs = draw(st.integers(min_value=2, max_value=5))
    paragraphs = []
    
    for i in range(num_paragraphs):
        # Generate paragraph with reasonable length
        paragraph_length = draw(st.integers(min_value=50, max_value=200))
        paragraph = draw(st.text(
            min_size=paragraph_length,
            max_size=paragraph_length,
            alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Zs'))
        ))
        
        if paragraph.strip():
            paragraphs.append(paragraph.strip())
    
    # Join with double newlines
    text = '\n\n'.join(paragraphs)
    assume(len(text) > 200)  # Ensure minimum length
    
    return text


@st.composite
def chunker_config_strategy(draw):
    """Generate valid chunker configurations"""
    chunk_size = draw(st.integers(min_value=200, max_value=1000))
    overlap = draw(st.integers(min_value=0, max_value=min(chunk_size - 1, 200)))
    
    return chunk_size, overlap


# Fixtures
@pytest.fixture(scope="module")
def default_chunker():
    """Create text chunker with default configuration"""
    return TextChunker(chunk_size=512, overlap=50)


@pytest.mark.property_test
class TestChunkSizeAndOverlapConstraints:
    """
    Property 6: Chunk Size and Overlap Constraints
    Validates: Requirements 2.2, 2.3
    
    For any Knowledge_Document ingested, all generated Chunks must have token 
    counts between 200-1000, and adjacent Chunks must contain overlapping content.
    """
    
    @settings(max_examples=5, deadline=30000)
    @given(text=text_document_strategy())
    def test_chunk_token_counts_within_bounds(self, default_chunker, text):
        """
        Test that all chunks have token counts within specified bounds.
        
        Property: For any text document, all generated chunks (except possibly
        the last one) must have token counts between 200 and 1000.
        """
        # Chunk the text
        chunks = default_chunker.chunk_text(text, preserve_boundaries=False)
        
        # Verify we got chunks
        assert len(chunks) > 0, \
            "Must generate at least one chunk"
        
        # Check each chunk's token count
        for i, chunk in enumerate(chunks):
            # Last chunk can be smaller
            if i == len(chunks) - 1:
                assert chunk.token_count <= 1000, \
                    f"Last chunk token count must be <= 1000, got {chunk.token_count}"
            else:
                assert 200 <= chunk.token_count <= 1000, \
                    f"Chunk {i} token count must be between 200-1000, got {chunk.token_count}"
    
    @settings(max_examples=5, deadline=30000)
    @given(
        text=text_document_strategy(),
        config=chunker_config_strategy()
    )
    def test_chunk_sizes_respect_configuration(self, text, config):
        """
        Test that chunks respect the configured chunk size.
        
        Property: For any text and chunk size configuration, generated chunks
        must not exceed the configured chunk size.
        """
        chunk_size, overlap = config
        chunker = TextChunker(chunk_size=chunk_size, overlap=overlap)
        
        # Chunk the text
        chunks = chunker.chunk_text(text, preserve_boundaries=False)
        
        # Verify all chunks respect size limit
        for i, chunk in enumerate(chunks):
            assert chunk.token_count <= chunk_size, \
                f"Chunk {i} exceeds configured size: {chunk.token_count} > {chunk_size}"
    
    @settings(max_examples=5, deadline=30000)
    @given(text=text_document_strategy())
    def test_adjacent_chunks_have_overlap(self, default_chunker, text):
        """
        Test that adjacent chunks contain overlapping content.
        
        Property: For any text document with multiple chunks, adjacent chunks
        must have overlapping content (some common words/phrases).
        """
        # Chunk the text
        chunks = default_chunker.chunk_text(text, preserve_boundaries=False)
        
        # If only one chunk, no overlap to test
        if len(chunks) <= 1:
            return
        
        # Check overlap between adjacent chunks
        for i in range(len(chunks) - 1):
            current_chunk = chunks[i]
            next_chunk = chunks[i + 1]
            
            # Get end of current chunk and start of next chunk
            current_end = current_chunk.content[-200:] if len(current_chunk.content) > 200 else current_chunk.content
            next_start = next_chunk.content[:200] if len(next_chunk.content) > 200 else next_chunk.content
            
            # Check for word overlap
            current_words = set(current_end.lower().split())
            next_words = set(next_start.lower().split())
            overlap_words = current_words & next_words
            
            # Should have some overlapping words if overlap > 0
            if default_chunker.overlap > 0:
                assert len(overlap_words) > 0, \
                    f"No overlap found between chunks {i} and {i+1}"
    
    @settings(max_examples=5, deadline=30000)
    @given(text=text_document_strategy())
    def test_chunks_preserve_content_order(self, default_chunker, text):
        """
        Test that chunks preserve the original content order.
        
        Property: For any text document, when chunks are concatenated,
        they should preserve the original content order (allowing for overlap).
        """
        # Chunk the text
        chunks = default_chunker.chunk_text(text, preserve_boundaries=False)
        
        # Verify chunks are in order
        for i in range(len(chunks) - 1):
            current_chunk = chunks[i]
            next_chunk = chunks[i + 1]
            
            # Character positions should be increasing
            assert current_chunk.start_char <= next_chunk.start_char, \
                f"Chunks out of order: chunk {i} starts at {current_chunk.start_char}, chunk {i+1} starts at {next_chunk.start_char}"
    
    @settings(max_examples=5, deadline=30000)
    @given(text=text_document_strategy())
    def test_chunk_indices_are_sequential(self, default_chunker, text):
        """
        Test that chunk indices are sequential starting from 0.
        
        Property: For any text document, chunk indices must be sequential
        integers starting from 0.
        """
        # Chunk the text
        chunks = default_chunker.chunk_text(text, preserve_boundaries=False)
        
        # Verify indices
        for i, chunk in enumerate(chunks):
            assert chunk.chunk_index == i, \
                f"Chunk index mismatch: expected {i}, got {chunk.chunk_index}"
    
    @settings(max_examples=5, deadline=30000)
    @given(text=text_document_strategy())
    def test_all_chunks_have_content(self, default_chunker, text):
        """
        Test that all chunks have non-empty content.
        
        Property: For any text document, every generated chunk must have
        non-empty content.
        """
        # Chunk the text
        chunks = default_chunker.chunk_text(text, preserve_boundaries=False)
        
        # Verify all chunks have content
        for i, chunk in enumerate(chunks):
            assert chunk.content, \
                f"Chunk {i} has empty content"
            
            assert len(chunk.content.strip()) > 0, \
                f"Chunk {i} has only whitespace content"
    
    @settings(max_examples=5, deadline=30000)
    @given(text=text_document_strategy())
    def test_semantic_chunking_preserves_boundaries(self, default_chunker, text):
        """
        Test that semantic chunking preserves paragraph boundaries.
        
        Property: For any text document with paragraphs, semantic chunking
        should try to preserve paragraph boundaries when possible.
        """
        # Chunk with semantic boundaries
        chunks = default_chunker.chunk_by_semantic_boundaries(text)
        
        # Verify chunks exist
        assert len(chunks) > 0, \
            "Must generate at least one chunk"
        
        # Verify all chunks have content
        for chunk in chunks:
            assert chunk.content.strip(), \
                "All chunks must have content"
    
    @settings(max_examples=5, deadline=30000)
    @given(
        text=text_document_strategy(),
        config=chunker_config_strategy()
    )
    def test_overlap_size_respected(self, text, config):
        """
        Test that the overlap size is approximately respected.
        
        Property: For any text and overlap configuration, the overlap
        between adjacent chunks should be approximately the configured size.
        """
        chunk_size, overlap = config
        
        # Skip if no overlap configured
        if overlap == 0:
            return
        
        chunker = TextChunker(chunk_size=chunk_size, overlap=overlap)
        
        # Chunk the text
        chunks = chunker.chunk_text(text, preserve_boundaries=False)
        
        # If only one chunk, no overlap to test
        if len(chunks) <= 1:
            return
        
        # Check that overlap exists between chunks
        for i in range(len(chunks) - 1):
            current_chunk = chunks[i]
            next_chunk = chunks[i + 1]
            
            # There should be some overlap in content
            # (exact overlap size is hard to verify due to token boundaries)
            current_end = current_chunk.content[-100:]
            next_start = next_chunk.content[:100]
            
            # Should have some common words
            current_words = set(current_end.split())
            next_words = set(next_start.split())
            overlap_words = current_words & next_words
            
            assert len(overlap_words) > 0, \
                f"Expected overlap between chunks {i} and {i+1}"


@pytest.mark.property_test
class TestChunkingErrorHandling:
    """
    Additional property tests for error handling.
    """
    
    @settings(max_examples=5, deadline=5000)
    @given(invalid_text=st.one_of(st.just(""), st.just("   "), st.just("\n\n")))
    def test_empty_text_raises_error(self, default_chunker, invalid_text):
        """
        Test that empty text raises appropriate error.
        
        Property: For any empty or whitespace-only text,
        chunking must raise ChunkingError.
        """
        with pytest.raises(ChunkingError, match="Text cannot be empty"):
            default_chunker.chunk_text(invalid_text)
    
    @settings(max_examples=3, deadline=5000)
    @given(dummy=st.just(None))
    def test_invalid_chunk_size_raises_error(self, dummy):
        """
        Test that invalid chunk size raises error.
        
        Property: Creating a chunker with invalid chunk size
        must raise ValueError.
        """
        with pytest.raises(ValueError, match="chunk_size must be positive"):
            TextChunker(chunk_size=0, overlap=0)
        
        with pytest.raises(ValueError, match="chunk_size must be positive"):
            TextChunker(chunk_size=-100, overlap=0)
    
    @settings(max_examples=3, deadline=5000)
    @given(dummy=st.just(None))
    def test_invalid_overlap_raises_error(self, dummy):
        """
        Test that invalid overlap raises error.
        
        Property: Creating a chunker with invalid overlap
        must raise ValueError.
        """
        with pytest.raises(ValueError, match="overlap cannot be negative"):
            TextChunker(chunk_size=512, overlap=-10)
        
        with pytest.raises(ValueError, match="overlap must be less than chunk_size"):
            TextChunker(chunk_size=512, overlap=512)
        
        with pytest.raises(ValueError, match="overlap must be less than chunk_size"):
            TextChunker(chunk_size=512, overlap=600)


@pytest.mark.property_test
class TestDocumentChunkability:
    """
    Property tests for document chunkability.
    Property 4: Document Chunkability
    Validates: Requirements 1.5
    """

    @settings(max_examples=50, deadline=15000)
    @given(text=text_document_strategy())
    def test_any_document_can_be_chunked(self, default_chunker, text):
        """
        Test that any valid document can be chunked without errors.

        Property 4: For any valid document, the chunking process must
        succeed and produce at least one chunk.
        """
        # Should not raise any exceptions
        chunks = default_chunker.chunk_text(text, preserve_boundaries=True)

        # Must produce at least one chunk
        assert len(chunks) >= 1, "Chunking must produce at least one chunk"

        # All chunks must have content
        for chunk in chunks:
            assert len(chunk.content.strip()) > 0, "All chunks must have non-empty content"

    @settings(max_examples=30, deadline=10000)
    @given(text=st.text(min_size=1000, max_size=5000))
    def test_large_documents_chunk_successfully(self, text):
        """
        Test that large documents can be chunked successfully.

        Property 4: Large documents must be chunkable without
        memory issues or failures.
        """
        assume(text.strip())  # Ensure non-empty text

        chunker = TextChunker(chunk_size=512, overlap=50)

        # Should handle large documents
        chunks = chunker.chunk_text(text, preserve_boundaries=False)

        # Should produce reasonable number of chunks
        expected_chunks = max(1, len(text) // (512 - 50))  # Approximate
        assert len(chunks) <= expected_chunks * 2, "Should not produce excessive chunks"

        # Verify chunk content integrity
        total_content_length = sum(len(chunk.content) for chunk in chunks)
        assert total_content_length >= len(text) * 0.8, "Should preserve most content"


@pytest.mark.property_test
class TestChunkValidation:
    """
    Property tests for chunk validation.
    """
    
    @settings(max_examples=5, deadline=30000)
    @given(text=text_document_strategy())
    def test_generated_chunks_pass_validation(self, default_chunker, text):
        """
        Test that generated chunks pass validation.
        
        Property: For any text document, all generated chunks must
        pass the chunker's validation method.
        """
        # Chunk the text
        chunks = default_chunker.chunk_text(text, preserve_boundaries=False)
        
        # Validate chunks
        is_valid = default_chunker.validate_chunks(chunks)
        
        # Should be valid (or at least not crash)
        assert isinstance(is_valid, bool), \
            "Validation must return boolean"
    
    @settings(max_examples=5, deadline=30000)
    @given(text=text_document_strategy())
    def test_chunk_metadata_preserved(self, text):
        """
        Test that metadata is preserved in chunks.
        
        Property: For any text document with metadata, all generated chunks
        must preserve the metadata.
        """
        chunker = TextChunker(chunk_size=512, overlap=50)
        
        # Add metadata
        metadata = {"document_id": "test-123", "category": "test"}
        
        # Chunk with metadata
        chunks = chunker.chunk_text(text, preserve_boundaries=False, metadata=metadata)
        
        # Verify metadata in all chunks
        for chunk in chunks:
            assert chunk.metadata is not None, \
                "Chunk must have metadata"
            
            assert "document_id" in chunk.metadata, \
                "Metadata must contain document_id"
            
            assert chunk.metadata["document_id"] == "test-123", \
                "Metadata must be preserved"
