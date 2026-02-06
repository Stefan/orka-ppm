"""
Help Documentation RAG (AI Help Chat Enhancement)
Indexes and retrieves help documentation using embeddings with organization filtering.
"""

import os
import logging
from typing import List, Dict, Any, Optional
from uuid import uuid4

from supabase import Client
from openai import OpenAI

logger = logging.getLogger(__name__)

SIMILARITY_THRESHOLD = 0.7
TOP_K = 3
EMBEDDING_DIM = 1536
CONTENT_TYPE_HELP_DOC = "help_doc"


class HelpDocumentationRAG:
    """RAG for help documentation: index and retrieve by semantic similarity."""

    def __init__(self, supabase_client: Client, openai_api_key: Optional[str] = None, base_url: Optional[str] = None):
        self.supabase = supabase_client
        self.openai_api_key = openai_api_key or os.getenv("OPENAI_API_KEY")
        self.base_url = base_url or os.getenv("OPENAI_BASE_URL")
        self.embedding_model = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-ada-002")
        self._openai: Optional[OpenAI] = None

    def _get_openai(self) -> OpenAI:
        if self._openai is None:
            if not self.openai_api_key:
                raise RuntimeError("HelpDocumentationRAG: OPENAI_API_KEY not set")
            kwargs = {"api_key": self.openai_api_key}
            if self.base_url:
                kwargs["base_url"] = self.base_url
            self._openai = OpenAI(**kwargs)
        return self._openai

    def _generate_embedding(self, text: str) -> List[float]:
        """Generate embedding for text using OpenAI."""
        client = self._get_openai()
        text = (text or "")[:8000]
        resp = client.embeddings.create(model=self.embedding_model, input=text)
        return resp.data[0].embedding

    def index_documentation(
        self,
        content_id: str,
        content_text: str,
        organization_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Index a help document: generate embedding and upsert into embeddings (content_type=help_doc)."""
        embedding = self._generate_embedding(content_text)
        record_id = str(uuid4())
        payload = {
            "id": record_id,
            "content_type": CONTENT_TYPE_HELP_DOC,
            "content_id": content_id,
            "content_text": (content_text or "")[:8000],
            "embedding": embedding,
            "metadata": metadata or {},
            "organization_id": organization_id,
        }
        self.supabase.table("embeddings").upsert(
            payload,
            on_conflict="content_type,content_id",
            update_columns=["content_text", "embedding", "metadata", "organization_id", "updated_at"],
        ).execute()
        return record_id

    def retrieve_relevant_docs(
        self,
        query: str,
        organization_id: Optional[str] = None,
        top_k: int = TOP_K,
        similarity_threshold: float = SIMILARITY_THRESHOLD,
    ) -> List[Dict[str, Any]]:
        """Retrieve top-k help docs by similarity; filter by organization_id."""
        if not query or not query.strip():
            return []
        query_embedding = self._generate_embedding(query.strip())
        try:
            rpc = self.supabase.rpc(
                "vector_similarity_search",
                {
                    "query_embedding": query_embedding,
                    "content_types": [CONTENT_TYPE_HELP_DOC],
                    "org_id": organization_id,
                    "similarity_limit": top_k,
                    "similarity_threshold": similarity_threshold,
                },
            )
            result = rpc.execute()
            rows = result.data or []
            return [
                {
                    "content_type": r.get("content_type"),
                    "content_id": r.get("content_id"),
                    "content_text": r.get("content_text"),
                    "metadata": r.get("metadata") or {},
                    "similarity_score": r.get("similarity_score"),
                }
                for r in rows
            ]
        except Exception as e:
            logger.warning("HelpDocumentationRAG.retrieve_relevant_docs failed: %s", e)
            return []


def get_help_documentation_rag(supabase_client: Optional[Client] = None) -> Optional[HelpDocumentationRAG]:
    """Return HelpDocumentationRAG instance if Supabase and OpenAI are configured."""
    try:
        from config.database import supabase
        client = supabase_client or supabase
        return HelpDocumentationRAG(client)
    except Exception as e:
        logger.debug("HelpDocumentationRAG not available: %s", e)
        return None
