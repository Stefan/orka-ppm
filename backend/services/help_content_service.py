"""
Help Content Management Service
Provides comprehensive help content management with embedding generation, versioning, and search
"""

import os
import json
import asyncio
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
import logging
from uuid import UUID, uuid4
from supabase import Client
from openai import OpenAI

from models.help_content import (
    HelpContent, HelpContentCreate, HelpContentUpdate, HelpContentSearch,
    HelpContentSearchResult, HelpContentSearchResponse, ContentEmbedding,
    ContentVersion, BulkContentOperation, BulkContentOperationResult,
    ContentType, ReviewStatus, Language
)

logger = logging.getLogger(__name__)

class HelpContentService:
    """Service for managing help content with embedding generation and search capabilities"""
    
    def __init__(self, supabase_client: Client, openai_api_key: str, base_url: str = None):
        self.supabase = supabase_client
        # Initialize OpenAI client with optional custom base URL (for Grok, etc.)
        if base_url:
            self.openai_client = OpenAI(api_key=openai_api_key, base_url=base_url)
        else:
            self.openai_client = OpenAI(api_key=openai_api_key)
        
        # Check if we should use local embeddings (for Grok or when OpenAI embeddings unavailable)
        self.use_local_embeddings = os.getenv("USE_LOCAL_EMBEDDINGS", "false").lower() == "true"
        self.local_embedding_model = None
        
        if self.use_local_embeddings or base_url:
            logger.info("HelpContentService: Using local sentence-transformers for embeddings")
            try:
                from sentence_transformers import SentenceTransformer
                self.local_embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
                self.embedding_dimension = 384  # all-MiniLM-L6-v2 dimension
                self.use_local_embeddings = True
            except ImportError:
                logger.warning("sentence-transformers not installed, falling back to OpenAI")
                self.use_local_embeddings = False
                self.embedding_dimension = 1536
        else:
            self.embedding_dimension = 1536
        
        # Use configurable embedding model from environment or default
        self.embedding_model = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-ada-002")
        self.max_content_length = 8000
        self.supported_languages = ['en', 'de', 'fr']
    
    async def create_content(self, content_data: HelpContentCreate, user_id: str) -> HelpContent:
        """Create new help content with automatic embedding generation"""
        try:
            # Generate slug if not provided
            if not content_data.slug:
                content_data.slug = self._generate_slug(content_data.title)
            
            # Prepare content data for database
            db_data = {
                "content_type": content_data.content_type.value,
                "title": content_data.title,
                "content": content_data.content,
                "tags": content_data.tags,
                "language": content_data.language.value,
                "slug": content_data.slug,
                "meta_description": content_data.meta_description,
                "keywords": content_data.keywords,
                "author_id": content_data.author_id or user_id,
                "review_status": ReviewStatus.draft.value,
                "is_active": False,  # New content starts as inactive
                "version": 1
            }
            
            # Insert content into database
            response = self.supabase.table("help_content").insert(db_data).execute()
            
            if not response.data:
                raise Exception("Failed to create help content")
            
            content_record = response.data[0]
            content = HelpContent(**content_record)
            
            # Generate and store embedding asynchronously
            asyncio.create_task(self._generate_content_embedding(content))
            
            # Create initial version record
            await self._create_version_record(content, "Initial version", user_id)
            
            logger.info(f"Created help content: {content.id}")
            return content
            
        except Exception as e:
            logger.error(f"Failed to create help content: {e}")
            raise
    
    async def update_content(self, content_id: UUID, content_data: HelpContentUpdate, 
                           user_id: str) -> HelpContent:
        """Update existing help content with version tracking"""
        try:
            # Get existing content
            existing_response = self.supabase.table("help_content").select("*").eq("id", content_id).execute()
            
            if not existing_response.data:
                raise Exception(f"Help content not found: {content_id}")
            
            existing_content = existing_response.data[0]
            
            # Prepare update data
            update_data = {}
            changes = []
            
            # Track changes for version history
            if content_data.title and content_data.title != existing_content["title"]:
                update_data["title"] = content_data.title
                changes.append(f"Title changed from '{existing_content['title']}' to '{content_data.title}'")
            
            if content_data.content and content_data.content != existing_content["content"]:
                update_data["content"] = content_data.content
                changes.append("Content updated")
                # Increment version for content changes
                update_data["version"] = existing_content["version"] + 1
            
            if content_data.tags is not None:
                update_data["tags"] = content_data.tags
                changes.append("Tags updated")
            
            if content_data.slug and content_data.slug != existing_content["slug"]:
                update_data["slug"] = content_data.slug
                changes.append(f"Slug changed to '{content_data.slug}'")
            
            if content_data.meta_description is not None:
                update_data["meta_description"] = content_data.meta_description
                changes.append("Meta description updated")
            
            if content_data.keywords is not None:
                update_data["keywords"] = content_data.keywords
                changes.append("Keywords updated")
            
            if content_data.review_status:
                update_data["review_status"] = content_data.review_status.value
                changes.append(f"Review status changed to '{content_data.review_status.value}'")
                
                # Set published_at when approved
                if content_data.review_status == ReviewStatus.approved and not existing_content.get("published_at"):
                    update_data["published_at"] = datetime.now().isoformat()
            
            if content_data.is_active is not None:
                update_data["is_active"] = content_data.is_active
                changes.append(f"Active status changed to {content_data.is_active}")
            
            if not update_data:
                # No changes, return existing content
                return HelpContent(**existing_content)
            
            # Update content in database
            response = self.supabase.table("help_content").update(update_data).eq("id", content_id).execute()
            
            if not response.data:
                raise Exception("Failed to update help content")
            
            updated_content = HelpContent(**response.data[0])
            
            # Create version record if there were significant changes
            if changes:
                changes_summary = "; ".join(changes)
                await self._create_version_record(updated_content, changes_summary, user_id)
            
            # Regenerate embedding if content changed
            if "content" in update_data or "title" in update_data:
                asyncio.create_task(self._generate_content_embedding(updated_content))
            
            logger.info(f"Updated help content: {content_id}")
            return updated_content
            
        except Exception as e:
            logger.error(f"Failed to update help content: {e}")
            raise
    
    async def get_content(self, content_id: UUID) -> Optional[HelpContent]:
        """Get help content by ID"""
        try:
            response = self.supabase.table("help_content").select("*").eq("id", content_id).execute()
            
            if response.data:
                return HelpContent(**response.data[0])
            return None
            
        except Exception as e:
            logger.error(f"Failed to get help content: {e}")
            return None
    
    async def get_content_by_slug(self, slug: str, language: Language = Language.en) -> Optional[HelpContent]:
        """Get help content by slug and language"""
        try:
            response = self.supabase.table("help_content").select("*").eq("slug", slug).eq("language", language.value).execute()
            
            if response.data:
                return HelpContent(**response.data[0])
            return None
            
        except Exception as e:
            logger.error(f"Failed to get help content by slug: {e}")
            return None
    
    async def search_content(self, search_params: HelpContentSearch) -> HelpContentSearchResponse:
        """Search help content with vector similarity and filtering"""
        try:
            results = []
            
            # If there's a query, use vector similarity search
            if search_params.query:
                results = await self._vector_search(search_params)
            else:
                results = await self._filter_search(search_params)
            
            # Get total count for pagination
            total_count = await self._get_search_count(search_params)
            
            has_more = (search_params.offset + len(results)) < total_count
            
            return HelpContentSearchResponse(
                results=results,
                total_count=total_count,
                has_more=has_more
            )
            
        except Exception as e:
            logger.error(f"Failed to search help content: {e}")
            return HelpContentSearchResponse(results=[], total_count=0, has_more=False)
    
    async def get_content_versions(self, content_id: UUID) -> List[ContentVersion]:
        """Get version history for help content"""
        try:
            response = self.supabase.table("help_content_versions").select("*").eq("content_id", content_id).order("version_number", desc=True).execute()
            
            return [ContentVersion(**version) for version in response.data or []]
            
        except Exception as e:
            logger.error(f"Failed to get content versions: {e}")
            return []
    
    async def bulk_update_content(self, operation: BulkContentOperation, user_id: str) -> BulkContentOperationResult:
        """Perform bulk operations on help content"""
        try:
            successful_ids = []
            failed_ids = []
            errors = {}
            
            for content_id in operation.content_ids:
                try:
                    if operation.operation == "activate":
                        await self._update_content_status(content_id, True, user_id)
                    elif operation.operation == "deactivate":
                        await self._update_content_status(content_id, False, user_id)
                    elif operation.operation == "archive":
                        await self._archive_content(content_id, user_id)
                    elif operation.operation == "delete":
                        await self._delete_content(content_id, user_id)
                    
                    successful_ids.append(content_id)
                    
                except Exception as e:
                    failed_ids.append(content_id)
                    errors[str(content_id)] = str(e)
            
            return BulkContentOperationResult(
                successful_ids=successful_ids,
                failed_ids=failed_ids,
                errors=errors,
                total_processed=len(operation.content_ids)
            )
            
        except Exception as e:
            logger.error(f"Failed to perform bulk operation: {e}")
            raise
    
    async def regenerate_embeddings(self, content_types: Optional[List[ContentType]] = None) -> Dict[str, int]:
        """Regenerate embeddings for help content"""
        try:
            query_builder = self.supabase.table("help_content").select("id, title, content, content_type")
            
            if content_types:
                query_builder = query_builder.in_("content_type", [ct.value for ct in content_types])
            
            response = query_builder.eq("is_active", True).execute()
            
            if not response.data:
                return {"processed": 0, "errors": 0}
            
            processed = 0
            errors = 0
            
            for content_record in response.data:
                try:
                    content = HelpContent(**content_record)
                    await self._generate_content_embedding(content)
                    processed += 1
                except Exception as e:
                    logger.error(f"Failed to regenerate embedding for {content_record['id']}: {e}")
                    errors += 1
            
            return {"processed": processed, "errors": errors}
            
        except Exception as e:
            logger.error(f"Failed to regenerate embeddings: {e}")
            raise
    
    # Private helper methods
    
    def _generate_slug(self, title: str) -> str:
        """Generate URL-friendly slug from title"""
        import re
        slug = title.lower()
        slug = re.sub(r'[^a-z0-9\s-]', '', slug)
        slug = re.sub(r'\s+', '-', slug)
        slug = slug.strip('-')
        return slug[:50]  # Limit length
    
    async def _generate_content_embedding(self, content: HelpContent):
        """Generate and store embedding for help content"""
        try:
            # Combine title and content for embedding
            text_for_embedding = f"{content.title}\n\n{content.content}"
            
            # Truncate if too long
            if len(text_for_embedding) > self.max_content_length:
                text_for_embedding = text_for_embedding[:self.max_content_length]
            
            # Generate embedding using local model or OpenAI
            if self.use_local_embeddings and self.local_embedding_model:
                # Use local sentence-transformers model
                embedding = self.local_embedding_model.encode(text_for_embedding, convert_to_numpy=True)
                embedding = embedding.tolist()
            else:
                # Use OpenAI embeddings
                response = self.openai_client.embeddings.create(
                    model=self.embedding_model,
                    input=text_for_embedding
                )
                embedding = response.data[0].embedding
            
            # Store embedding
            embedding_data = {
                "content_type": "help_content",
                "content_id": str(content.id),
                "content_text": text_for_embedding,
                "embedding": embedding,
                "metadata": {
                    "title": content.title,
                    "content_type": content.content_type,
                    "language": content.language,
                    "tags": content.tags,
                    "version": content.version
                }
            }
            
            self.supabase.table("embeddings").upsert(
                embedding_data, 
                on_conflict="content_type,content_id"
            ).execute()
            
            logger.info(f"Generated embedding for help content: {content.id}")
            
        except Exception as e:
            logger.error(f"Failed to generate embedding for {content.id}: {e}")
    
    async def _create_version_record(self, content: HelpContent, changes_summary: str, user_id: str):
        """Create version record for content changes"""
        try:
            version_data = {
                "content_id": str(content.id),
                "version_number": content.version,
                "title": content.title,
                "content": content.content,
                "changes_summary": changes_summary,
                "created_by": user_id
            }
            
            self.supabase.table("help_content_versions").insert(version_data).execute()
            
        except Exception as e:
            logger.error(f"Failed to create version record: {e}")
    
    async def _vector_search(self, search_params: HelpContentSearch) -> List[HelpContentSearchResult]:
        """Perform vector similarity search"""
        try:
            # Generate query embedding using local model or OpenAI
            if self.use_local_embeddings and self.local_embedding_model:
                # Use local sentence-transformers model
                query_embedding = self.local_embedding_model.encode(search_params.query, convert_to_numpy=True)
                query_embedding = query_embedding.tolist()
            else:
                # Use OpenAI embeddings
                response = self.openai_client.embeddings.create(
                    model=self.embedding_model,
                    input=search_params.query
                )
                query_embedding = response.data[0].embedding
            
            # Build content type filter
            content_types = []
            if search_params.content_types:
                content_types = [ct.value for ct in search_params.content_types]
            
            # Use vector similarity search RPC
            result = self.supabase.rpc('help_content_vector_search', {
                'query_embedding': query_embedding,
                'content_types': content_types,
                'languages': [lang.value for lang in search_params.languages] if search_params.languages else [],
                'tags': search_params.tags or [],
                'is_active': search_params.is_active,
                'similarity_limit': search_params.limit,
                'offset_count': search_params.offset
            }).execute()
            
            if result.data:
                search_results = []
                for item in result.data:
                    content = HelpContent(**item)
                    search_results.append(HelpContentSearchResult(
                        content=content,
                        similarity_score=item.get('similarity_score', 0.0)
                    ))
                return search_results
            
            # Fallback to basic search if RPC not available
            return await self._fallback_vector_search(query_embedding, search_params)
            
        except Exception as e:
            logger.error(f"Vector search failed: {e}")
            return await self._filter_search(search_params)
    
    async def _fallback_vector_search(self, query_embedding: List[float], 
                                    search_params: HelpContentSearch) -> List[HelpContentSearchResult]:
        """Fallback vector search using basic similarity calculation"""
        try:
            # Get embeddings for help content
            embeddings_response = self.supabase.table("embeddings").select("*").eq("content_type", "help_content").execute()
            
            if not embeddings_response.data:
                return []
            
            # Calculate similarities
            similarities = []
            for embedding_record in embeddings_response.data:
                try:
                    similarity = self._calculate_cosine_similarity(query_embedding, embedding_record['embedding'])
                    similarities.append({
                        'content_id': embedding_record['content_id'],
                        'similarity_score': similarity
                    })
                except Exception:
                    continue
            
            # Sort by similarity
            similarities.sort(key=lambda x: x['similarity_score'], reverse=True)
            
            # Get top content IDs
            top_content_ids = [item['content_id'] for item in similarities[:search_params.limit]]
            
            if not top_content_ids:
                return []
            
            # Get content records
            content_response = self.supabase.table("help_content").select("*").in_("id", top_content_ids).execute()
            
            if not content_response.data:
                return []
            
            # Build results with similarity scores
            results = []
            content_by_id = {str(content['id']): content for content in content_response.data}
            
            for sim_item in similarities[:search_params.limit]:
                content_id = sim_item['content_id']
                if content_id in content_by_id:
                    content = HelpContent(**content_by_id[content_id])
                    results.append(HelpContentSearchResult(
                        content=content,
                        similarity_score=sim_item['similarity_score']
                    ))
            
            return results
            
        except Exception as e:
            logger.error(f"Fallback vector search failed: {e}")
            return []
    
    async def _filter_search(self, search_params: HelpContentSearch) -> List[HelpContentSearchResult]:
        """Perform filtered search without vector similarity"""
        try:
            query_builder = self.supabase.table("help_content").select("*")
            
            # Apply filters
            if search_params.content_types:
                query_builder = query_builder.in_("content_type", [ct.value for ct in search_params.content_types])
            
            if search_params.languages:
                query_builder = query_builder.in_("language", [lang.value for lang in search_params.languages])
            
            if search_params.is_active is not None:
                query_builder = query_builder.eq("is_active", search_params.is_active)
            
            if search_params.tags:
                # Use array overlap for tags
                query_builder = query_builder.overlaps("tags", search_params.tags)
            
            # Apply pagination
            query_builder = query_builder.range(search_params.offset, search_params.offset + search_params.limit - 1)
            
            response = query_builder.execute()
            
            results = []
            for content_record in response.data or []:
                content = HelpContent(**content_record)
                results.append(HelpContentSearchResult(
                    content=content,
                    similarity_score=None
                ))
            
            return results
            
        except Exception as e:
            logger.error(f"Filter search failed: {e}")
            return []
    
    async def _get_search_count(self, search_params: HelpContentSearch) -> int:
        """Get total count for search results"""
        try:
            query_builder = self.supabase.table("help_content").select("id", count="exact")
            
            # Apply same filters as search
            if search_params.content_types:
                query_builder = query_builder.in_("content_type", [ct.value for ct in search_params.content_types])
            
            if search_params.languages:
                query_builder = query_builder.in_("language", [lang.value for lang in search_params.languages])
            
            if search_params.is_active is not None:
                query_builder = query_builder.eq("is_active", search_params.is_active)
            
            if search_params.tags:
                query_builder = query_builder.overlaps("tags", search_params.tags)
            
            response = query_builder.execute()
            return response.count or 0
            
        except Exception as e:
            logger.error(f"Failed to get search count: {e}")
            return 0
    
    def _calculate_cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Calculate cosine similarity between two vectors"""
        try:
            import numpy as np
            vec1_np = np.array(vec1)
            vec2_np = np.array(vec2)
            
            dot_product = np.dot(vec1_np, vec2_np)
            norm1 = np.linalg.norm(vec1_np)
            norm2 = np.linalg.norm(vec2_np)
            
            if norm1 == 0 or norm2 == 0:
                return 0.0
            
            return dot_product / (norm1 * norm2)
        except Exception:
            return 0.0
    
    async def _update_content_status(self, content_id: UUID, is_active: bool, user_id: str):
        """Update content active status"""
        self.supabase.table("help_content").update({"is_active": is_active}).eq("id", content_id).execute()
    
    async def _archive_content(self, content_id: UUID, user_id: str):
        """Archive help content"""
        self.supabase.table("help_content").update({
            "review_status": ReviewStatus.archived.value,
            "is_active": False
        }).eq("id", content_id).execute()
    
    async def _delete_content(self, content_id: UUID, user_id: str):
        """Delete help content and associated data"""
        # Delete embeddings first
        self.supabase.table("embeddings").delete().eq("content_id", str(content_id)).execute()
        
        # Delete content
        self.supabase.table("help_content").delete().eq("id", content_id).execute()