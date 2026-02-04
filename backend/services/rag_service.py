"""
RAG Service
Phase 1: Retrieval-Augmented Generation for help chat
"""

from typing import List, Dict, Any
import os
from supabase import create_client, Client
import openai

class RAGService:
    """Service for RAG-based document retrieval"""
    
    def __init__(self):
        self.supabase: Client = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_KEY")
        )
        self.openai_client = openai.AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self.embedding_model = "text-embedding-3-small"
        
    async def search_documents(
        self,
        query: str,
        organization_id: str,
        limit: int = 3
    ) -> List[Dict[str, Any]]:
        """
        Search documents using vector similarity
        Returns top-N most relevant documents
        """
        try:
            # Generate embedding for query
            embedding = await self._generate_embedding(query)
            
            # Perform vector search using Supabase RPC function
            # Assumes you have a vector_similarity_search function in Supabase
            response = self.supabase.rpc(
                'vector_similarity_search',
                {
                    'query_embedding': embedding,
                    'match_count': limit,
                    'filter_org_id': organization_id
                }
            ).execute()
            
            # Format results
            results = []
            for doc in response.data:
                results.append({
                    'id': doc['id'],
                    'title': doc['title'],
                    'content': doc['content'],
                    'url': doc.get('url'),
                    'type': doc.get('content_type', 'documentation'),
                    'relevance': doc.get('similarity', 0.0)
                })
            
            return results
            
        except Exception as e:
            print(f"RAG search failed: {e}")
            return []
    
    async def _generate_embedding(self, text: str) -> List[float]:
        """Generate embedding for text"""
        try:
            response = await self.openai_client.embeddings.create(
                model=self.embedding_model,
                input=text
            )
            return response.data[0].embedding
        except Exception as e:
            print(f"Embedding generation failed: {e}")
            return []
    
    async def index_document(
        self,
        title: str,
        content: str,
        content_type: str,
        organization_id: str,
        url: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Index a document for RAG search
        """
        try:
            # Generate embedding
            embedding = await self._generate_embedding(content)
            
            # Insert into embeddings table
            doc_entry = {
                "title": title,
                "content": content,
                "content_type": content_type,
                "organization_id": organization_id,
                "url": url,
                "metadata": metadata or {},
                "embedding": embedding
            }
            
            response = self.supabase.table("embeddings").insert(doc_entry).execute()
            
            return response.data[0]['id']
            
        except Exception as e:
            print(f"Document indexing failed: {e}")
            raise
