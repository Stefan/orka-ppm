"""
Unit tests for RAG text chunker (document chunking).
Enterprise Test Strategy - Task 2.1
Requirements: 5.1, 5.3, 5.4
"""

import pytest
from unittest.mock import MagicMock, patch


@pytest.mark.unit
class TestTextChunkerValidation:
    """Chunker init and validation."""

    def test_chunk_size_must_be_positive(self):
        from services.text_chunker import TextChunker
        with pytest.raises(ValueError, match="chunk_size must be positive"):
            TextChunker(chunk_size=0)

    def test_overlap_cannot_be_negative(self):
        from services.text_chunker import TextChunker
        with pytest.raises(ValueError, match="overlap cannot be negative"):
            TextChunker(chunk_size=100, overlap=-1)

    def test_overlap_must_be_less_than_chunk_size(self):
        from services.text_chunker import TextChunker
        with pytest.raises(ValueError, match="overlap must be less than chunk_size"):
            TextChunker(chunk_size=100, overlap=100)


@pytest.mark.unit
@pytest.mark.parametrize("content,min_chunks", [
    ("short", 1),
    ("a" * 2000, 1),
    ("x " * 2000, 2),
])
def test_chunk_text_returns_chunks(content, min_chunks):
    """Chunking returns list of Chunk objects."""
    from services.text_chunker import TextChunker
    chunker = TextChunker(chunk_size=256, overlap=20)
    chunks = chunker.chunk_text(content, preserve_boundaries=False)
    assert len(chunks) >= min_chunks
    for i, c in enumerate(chunks):
        assert c.content
        assert c.chunk_index == i
        assert c.token_count >= 0
        assert c.start_char >= 0
        assert c.end_char <= len(content)
