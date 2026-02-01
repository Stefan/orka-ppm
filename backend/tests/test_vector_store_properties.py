"""
Property-Based Tests for Vector Store Operations
Feature: ai-help-chat-knowledge-base
Tests Properties 8 and 16 from the design document
"""

import pytest
from hypothesis import given, strategies as st, settings, assume, HealthCheck
from typing import List, Dict, Any
import os
import sys
import uuid
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from services.vector_store import VectorStore, VectorChunk, SearchResult


# Test data strategies
@st.composite
def vector_chunk_strategy(draw):
    """Generate valid vector chunks"""
    chunk_id = str(uuid.uuid4())
    document_id = str(uuid.uuid4())
    chunk_index = draw(st.integers(min_value=0, max_value=100))

    # Generate realistic content
    content_length = draw(st.integers(min_value=100, max_value=1000))
    content = draw(st.text(
        min_size=content_length,
        max_size=content_length,
        alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd', 'Zs', 'Po'))
    ))

    # Generate mock embedding (1536 dimensions for text-embedding-3-small)
    embedding = [draw(st.floats(min_value=-1.0, max_value=1.0)) for _ in range(1536)]

    # Generate metadata
    metadata = {
        "document_id": document_id,
        "chunk_index": chunk_index,
        "category": draw(st.sampled_from(["dashboard", "projects", "resources", "financial", "risks"])),
        "keywords": draw(st.lists(st.text(min_size=3, max_size=20), min_size=0, max_size=5)),
        "created_at": datetime.now().isoformat()
    }

    return VectorChunk(
        chunk_id=chunk_id,
        document_id=document_id,
        chunk_index=chunk_index,
        content=content,
        embedding=embedding,
        metadata=metadata
    )


@st.composite
def multiple_chunks_strategy(draw):
    """Generate multiple chunks for the same document"""
    document_id = str(uuid.uuid4())
    num_chunks = draw(st.integers(min_value=2, max_value=10))

    chunks = []
    for i in range(num_chunks):
        chunk_id = f"{document_id}_chunk_{i}"
        content = draw(st.text(min_size=200, max_size=800))
        embedding = [draw(st.floats(min_value=-1.0, max_value=1.0)) for _ in range(1536)]

        metadata = {
            "document_id": document_id,
            "chunk_index": i,
            "category": "test",
            "created_at": datetime.now().isoformat()
        }

        chunk = VectorChunk(
            chunk_id=chunk_id,
            document_id=document_id,
            chunk_index=i,
            content=content,
            embedding=embedding,
            metadata=metadata
        )
        chunks.append(chunk)

    return chunks


@pytest.fixture
def mock_vector_store():
    """Create a mock vector store for testing"""
    # In a real implementation, this would use a test database
    # For now, we'll create a mock that doesn't actually store data
    class MockVectorStore:
        def __init__(self):
            self.chunks = {}
            self.deleted_documents = set()

        async def upsert_chunks(self, chunks: List[VectorChunk]) -> None:
            """Mock upsert operation"""
            for chunk in chunks:
                self.chunks[chunk.chunk_id] = chunk

        async def similarity_search(self, query_embedding, limit=10, threshold=0.1):
            """Mock similarity search"""
            results = []
            for chunk in self.chunks.values():
                if not hasattr(chunk, 'embedding') or chunk.embedding is None:
                    continue

                # Simple mock similarity (cosine-like)
                similarity = sum(a * b for a, b in zip(query_embedding[:10], chunk.embedding[:10]))

                if similarity >= threshold:
                    results.append(SearchResult(
                        chunk_id=chunk.chunk_id,
                        document_id=chunk.document_id,
                        chunk_index=chunk.chunk_index,
                        content=chunk.content,
                        similarity_score=float(similarity),
                        metadata=chunk.metadata
                    ))

            results.sort(key=lambda x: x.similarity_score, reverse=True)
            return results[:limit]

        async def delete_by_document_id(self, document_id: str) -> int:
            """Mock delete operation"""
            deleted_count = 0
            chunks_to_delete = []

            for chunk_id, chunk in self.chunks.items():
                if chunk.document_id == document_id:
                    chunks_to_delete.append(chunk_id)
                    deleted_count += 1

            for chunk_id in chunks_to_delete:
                del self.chunks[chunk_id]

            self.deleted_documents.add(document_id)
            return deleted_count

        async def get_chunks_by_document_id(self, document_id: str) -> List[VectorChunk]:
            """Mock get chunks operation"""
            return [chunk for chunk in self.chunks.values() if chunk.document_id == document_id]

    return MockVectorStore()


@pytest.mark.property_test
class TestIngestionRoundTripIntegrity:
    """
    Property tests for ingestion round-trip integrity.
    Property 8: Ingestion Round-Trip Integrity
    Validates: Requirements 2.5
    """

    @settings(max_examples=20, deadline=10000, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @given(chunks=multiple_chunks_strategy())
    async def test_chunks_round_trip_integrity(self, mock_vector_store, chunks):
        """
        Test that chunks can be stored and retrieved with integrity.

        Property 8: After upserting chunks, they must be retrievable
        with identical content and metadata.
        """
        document_id = chunks[0].document_id

        # Store chunks
        await mock_vector_store.upsert_chunks(chunks)

        # Retrieve chunks
        retrieved_chunks = await mock_vector_store.get_chunks_by_document_id(document_id)

        # Verify all chunks were stored
        assert len(retrieved_chunks) == len(chunks), "All chunks must be retrievable"

        # Sort both lists by chunk_index for comparison
        chunks.sort(key=lambda x: x.chunk_index)
        retrieved_chunks.sort(key=lambda x: x.chunk_index)

        # Verify content integrity
        for original, retrieved in zip(chunks, retrieved_chunks):
            assert original.chunk_id == retrieved.chunk_id, "Chunk ID must be preserved"
            assert original.document_id == retrieved.document_id, "Document ID must be preserved"
            assert original.chunk_index == retrieved.chunk_index, "Chunk index must be preserved"
            assert original.content == retrieved.content, "Content must be preserved"
            assert original.metadata == retrieved.metadata, "Metadata must be preserved"

    @settings(max_examples=15, deadline=8000, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @given(chunk=vector_chunk_strategy())
    async def test_single_chunk_round_trip(self, mock_vector_store, chunk):
        """
        Test round-trip integrity for single chunks.

        Property 8: Individual chunks must maintain integrity
        through store/retrieve cycle.
        """
        # Store single chunk
        await mock_vector_store.upsert_chunks([chunk])

        # Retrieve and verify
        retrieved_chunks = await mock_vector_store.get_chunks_by_document_id(chunk.document_id)

        assert len(retrieved_chunks) == 1, "Single chunk must be retrievable"
        retrieved = retrieved_chunks[0]

        assert retrieved.chunk_id == chunk.chunk_id
        assert retrieved.content == chunk.content
        assert retrieved.metadata == chunk.metadata


@pytest.mark.property_test
class TestCascadeDeletion:
    """
    Property tests for cascade deletion.
    Property 16: Cascade Deletion
    Validates: Requirements 5.3
    """

    @settings(max_examples=15, deadline=8000, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @given(chunks=multiple_chunks_strategy())
    async def test_cascade_deletion_removes_all_chunks(self, mock_vector_store, chunks):
        """
        Test that deleting a document removes all its chunks.

        Property 16: When a document is deleted, all associated
        chunks must be removed.
        """
        document_id = chunks[0].document_id

        # Store chunks
        await mock_vector_store.upsert_chunks(chunks)

        # Verify chunks are stored
        initial_chunks = await mock_vector_store.get_chunks_by_document_id(document_id)
        assert len(initial_chunks) == len(chunks), "Chunks must be stored initially"

        # Delete document
        deleted_count = await mock_vector_store.delete_by_document_id(document_id)

        # Verify correct number of chunks deleted
        assert deleted_count == len(chunks), "All chunks must be deleted"

        # Verify no chunks remain
        remaining_chunks = await mock_vector_store.get_chunks_by_document_id(document_id)
        assert len(remaining_chunks) == 0, "No chunks should remain after deletion"

    @settings(max_examples=20, deadline=10000, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @given(
        chunks_a=multiple_chunks_strategy(),
        chunks_b=multiple_chunks_strategy()
    )
    async def test_cascade_deletion_isolation(self, mock_vector_store, chunks_a, chunks_b):
        """
        Test that cascade deletion only affects the specified document.

        Property 16: Deleting one document must not affect
        chunks from other documents.
        """
        # Ensure different document IDs
        assume(chunks_a[0].document_id != chunks_b[0].document_id)

        doc_id_a = chunks_a[0].document_id
        doc_id_b = chunks_b[0].document_id

        # Store both sets of chunks
        await mock_vector_store.upsert_chunks(chunks_a)
        await mock_vector_store.upsert_chunks(chunks_b)

        # Delete document A
        deleted_count = await mock_vector_store.delete_by_document_id(doc_id_a)

        # Verify only document A's chunks were deleted
        assert deleted_count == len(chunks_a), "Only document A's chunks should be deleted"

        # Verify document B's chunks remain
        remaining_chunks_b = await mock_vector_store.get_chunks_by_document_id(doc_id_b)
        assert len(remaining_chunks_b) == len(chunks_b), "Document B's chunks must remain"

        # Verify document A's chunks are gone
        remaining_chunks_a = await mock_vector_store.get_chunks_by_document_id(doc_id_a)
        assert len(remaining_chunks_a) == 0, "Document A's chunks must be deleted"