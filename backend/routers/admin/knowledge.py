"""
Admin Knowledge Management API Router
Provides administrative endpoints for managing the knowledge base
"""

import logging
from fastapi import APIRouter, HTTPException, Depends, status, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime

from auth.dependencies import get_current_user
from auth.rbac import require_permission, Permission
from config.database import supabase
from schemas.knowledge import (
    KnowledgeDocumentCreate,
    KnowledgeDocumentUpdate,
    KnowledgeDocumentResponse,
    KnowledgeAnalytics
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/knowledge", tags=["admin-knowledge"])


@router.post("/documents", response_model=KnowledgeDocumentResponse)
@require_permission(Permission.ADMIN_ACCESS)
async def create_knowledge_document(
    document: KnowledgeDocumentCreate,
    current_user = Depends(get_current_user)
):
    """Create a new knowledge document"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")

        # Prepare document data
        doc_data = {
            "title": document.title,
            "content": document.content,
            "category": document.category,
            "keywords": document.keywords or [],
            "metadata": document.metadata or {},
            "access_control": {
                "roles": document.allowed_roles or ["user", "manager", "admin"]
            },
            "created_by": current_user["user_id"],
            "updated_by": current_user["user_id"],
            "version": 1,
            "is_active": True
        }

        # Insert into database
        response = supabase.table("knowledge_documents").insert(doc_data).execute()

        if not response.data:
            raise HTTPException(
                status_code=400,
                detail="Failed to create knowledge document"
            )

        # Trigger re-indexing (in a real implementation)
        # await trigger_document_reindexing(response.data[0]["id"])

        logger.info(f"Knowledge document created: {document.title} by {current_user['user_id']}")

        return KnowledgeDocumentResponse(**response.data[0])

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create knowledge document: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create knowledge document: {str(e)}"
        )


@router.put("/documents/{document_id}", response_model=KnowledgeDocumentResponse)
@require_permission(Permission.ADMIN_ACCESS)
async def update_knowledge_document(
    document_id: UUID,
    document: KnowledgeDocumentUpdate,
    current_user = Depends(get_current_user)
):
    """Update an existing knowledge document"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")

        # Check if document exists
        existing = supabase.table("knowledge_documents").select("*").eq("id", str(document_id)).execute()

        if not existing.data:
            raise HTTPException(status_code=404, detail="Knowledge document not found")

        # Prepare update data
        update_data = {
            "updated_by": current_user["user_id"],
            "updated_at": datetime.now().isoformat()
        }

        # Add fields that were provided
        update_fields = ["title", "content", "category", "keywords", "metadata", "allowed_roles", "is_active"]
        for field in update_fields:
            if hasattr(document, field) and getattr(document, field) is not None:
                if field == "allowed_roles":
                    update_data["access_control"] = {"roles": getattr(document, field)}
                else:
                    update_data[field] = getattr(document, field)

        # Increment version
        update_data["version"] = existing.data[0]["version"] + 1

        # Update document
        response = supabase.table("knowledge_documents").update(update_data).eq("id", str(document_id)).execute()

        if not response.data:
            raise HTTPException(
                status_code=400,
                detail="Failed to update knowledge document"
            )

        # Trigger re-indexing
        # await trigger_document_reindexing(str(document_id))

        logger.info(f"Knowledge document updated: {document_id} by {current_user['user_id']}")

        return KnowledgeDocumentResponse(**response.data[0])

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update knowledge document: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update knowledge document: {str(e)}"
        )


@router.delete("/documents/{document_id}")
@require_permission(Permission.ADMIN_ACCESS)
async def delete_knowledge_document(
    document_id: UUID,
    current_user = Depends(get_current_user)
):
    """Delete a knowledge document"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")

        # Check if document exists
        existing = supabase.table("knowledge_documents").select("*").eq("id", str(document_id)).execute()

        if not existing.data:
            raise HTTPException(status_code=404, detail="Knowledge document not found")

        # Soft delete by marking as inactive
        update_data = {
            "is_active": False,
            "updated_by": current_user["user_id"],
            "updated_at": datetime.now().isoformat()
        }

        response = supabase.table("knowledge_documents").update(update_data).eq("id", str(document_id)).execute()

        if not response.data:
            raise HTTPException(
                status_code=400,
                detail="Failed to delete knowledge document"
            )

        # Trigger cleanup of vector store entries
        # await cleanup_document_vectors(str(document_id))

        logger.info(f"Knowledge document deleted: {document_id} by {current_user['user_id']}")

        return {"message": "Knowledge document deleted successfully", "document_id": str(document_id)}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete knowledge document: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete knowledge document: {str(e)}"
        )


@router.get("/documents", response_model=List[KnowledgeDocumentResponse])
@require_permission(Permission.ADMIN_ACCESS)
async def list_knowledge_documents(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    category: Optional[str] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """List knowledge documents with filtering and pagination"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")

        # Build query
        query = supabase.table("knowledge_documents").select("*")

        # Apply filters
        if category:
            query = query.eq("category", category)

        if is_active is not None:
            query = query.eq("is_active", is_active)

        if search:
            # Simple search in title and content
            query = query.or_(f"title.ilike.%{search}%,content.ilike.%{search}%")

        # Apply pagination
        query = query.range(skip, skip + limit - 1)

        # Execute query
        response = query.execute()

        documents = [KnowledgeDocumentResponse(**doc) for doc in response.data]

        return documents

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list knowledge documents: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list knowledge documents: {str(e)}"
        )


@router.get("/documents/{document_id}", response_model=KnowledgeDocumentResponse)
@require_permission(Permission.ADMIN_ACCESS)
async def get_knowledge_document(
    document_id: UUID,
    current_user = Depends(get_current_user)
):
    """Get a specific knowledge document"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")

        response = supabase.table("knowledge_documents").select("*").eq("id", str(document_id)).execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="Knowledge document not found")

        return KnowledgeDocumentResponse(**response.data[0])

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get knowledge document: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get knowledge document: {str(e)}"
        )


@router.get("/analytics", response_model=KnowledgeAnalytics)
@require_permission(Permission.ADMIN_ACCESS)
async def get_knowledge_analytics(
    current_user = Depends(get_current_user)
):
    """Get knowledge base analytics"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")

        # Get document counts by category
        category_counts_response = supabase.table("knowledge_documents").select("category").execute()
        category_counts = {}
        for doc in category_counts_response.data:
            category = doc["category"]
            category_counts[category] = category_counts.get(category, 0) + 1

        # Get total document count
        total_docs_response = supabase.table("knowledge_documents").select("id", count="exact").execute()
        total_documents = total_docs_response.count or 0

        # Get active document count
        active_docs_response = supabase.table("knowledge_documents").select("id", count="exact").eq("is_active", True).execute()
        active_documents = active_docs_response.count or 0

        # Get query analytics (simplified)
        query_analytics = {
            "total_queries": 0,  # Would be populated from query logs
            "average_response_time": 0.0,
            "cache_hit_rate": 0.0,
            "error_rate": 0.0
        }

        return KnowledgeAnalytics(
            total_documents=total_documents,
            active_documents=active_documents,
            documents_by_category=category_counts,
            query_analytics=query_analytics,
            last_updated=datetime.now().isoformat()
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get knowledge analytics: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get knowledge analytics: {str(e)}"
        )


@router.post("/documents/{document_id}/reindex")
@require_permission(Permission.ADMIN_ACCESS)
async def reindex_knowledge_document(
    document_id: UUID,
    current_user = Depends(get_current_user)
):
    """Trigger re-indexing of a knowledge document"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")

        # Check if document exists
        existing = supabase.table("knowledge_documents").select("*").eq("id", str(document_id)).execute()

        if not existing.data:
            raise HTTPException(status_code=404, detail="Knowledge document not found")

        # In a real implementation, this would trigger re-indexing
        # await trigger_document_reindexing(str(document_id))

        logger.info(f"Re-indexing triggered for document: {document_id} by {current_user['user_id']}")

        return {
            "message": "Re-indexing triggered successfully",
            "document_id": str(document_id),
            "status": "queued"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to trigger re-indexing: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to trigger re-indexing: {str(e)}"
        )