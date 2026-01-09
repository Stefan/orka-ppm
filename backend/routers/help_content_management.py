"""
Help Content Management API Router
Provides endpoints for managing help content with embedding generation and search
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query
from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
import logging

from auth.dependencies import get_current_user
from auth.rbac import require_permission, Permission
from config.database import supabase
from services.help_content_service import HelpContentService
from models.help_content import (
    HelpContent, HelpContentCreate, HelpContentUpdate, HelpContentSearch,
    HelpContentSearchResponse, ContentVersion, BulkContentOperation,
    BulkContentOperationResult, ContentType, ReviewStatus, Language
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/help-content", tags=["help-content-management"])

# Initialize help content service (will be done in startup)
help_content_service: Optional[HelpContentService] = None

def get_help_content_service() -> HelpContentService:
    """Get the help content service instance"""
    global help_content_service
    if help_content_service is None:
        import os
        openai_api_key = os.getenv("OPENAI_API_KEY")
        if not openai_api_key:
            raise HTTPException(
                status_code=503, 
                detail="Help content service unavailable - OpenAI API key not configured"
            )
        help_content_service = HelpContentService(supabase, openai_api_key)
    return help_content_service

# Response models
class CreateContentResponse(BaseModel):
    content: HelpContent
    message: str

class UpdateContentResponse(BaseModel):
    content: HelpContent
    message: str

class DeleteContentResponse(BaseModel):
    message: str
    content_id: UUID

class RegenerateEmbeddingsResponse(BaseModel):
    message: str
    processed: int
    errors: int

@router.post("/", response_model=CreateContentResponse)
async def create_help_content(
    content_data: HelpContentCreate,
    current_user = Depends(get_current_user),
    _permission = Depends(require_permission(Permission.MANAGE_CONTENT))
):
    """Create new help content with automatic embedding generation"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        service = get_help_content_service()
        content = await service.create_content(content_data, current_user["user_id"])
        
        return CreateContentResponse(
            content=content,
            message="Help content created successfully"
        )
        
    except Exception as e:
        logger.error(f"Failed to create help content: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to create help content: {str(e)}"
        )

@router.get("/{content_id}", response_model=HelpContent)
async def get_help_content(
    content_id: UUID,
    current_user = Depends(get_current_user)
):
    """Get help content by ID"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        service = get_help_content_service()
        content = await service.get_content(content_id)
        
        if not content:
            raise HTTPException(status_code=404, detail="Help content not found")
        
        return content
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get help content: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to get help content: {str(e)}"
        )

@router.get("/slug/{slug}", response_model=HelpContent)
async def get_help_content_by_slug(
    slug: str,
    language: Language = Language.en,
    current_user = Depends(get_current_user)
):
    """Get help content by slug and language"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        service = get_help_content_service()
        content = await service.get_content_by_slug(slug, language)
        
        if not content:
            raise HTTPException(status_code=404, detail="Help content not found")
        
        return content
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get help content by slug: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to get help content by slug: {str(e)}"
        )

@router.put("/{content_id}", response_model=UpdateContentResponse)
async def update_help_content(
    content_id: UUID,
    content_data: HelpContentUpdate,
    current_user = Depends(get_current_user),
    _permission = Depends(require_permission(Permission.MANAGE_CONTENT))
):
    """Update existing help content with version tracking"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        service = get_help_content_service()
        content = await service.update_content(content_id, content_data, current_user["user_id"])
        
        return UpdateContentResponse(
            content=content,
            message="Help content updated successfully"
        )
        
    except Exception as e:
        logger.error(f"Failed to update help content: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to update help content: {str(e)}"
        )

@router.delete("/{content_id}", response_model=DeleteContentResponse)
async def delete_help_content(
    content_id: UUID,
    current_user = Depends(get_current_user),
    _permission = Depends(require_permission(Permission.MANAGE_CONTENT))
):
    """Delete help content and associated data"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        service = get_help_content_service()
        
        # Check if content exists
        content = await service.get_content(content_id)
        if not content:
            raise HTTPException(status_code=404, detail="Help content not found")
        
        # Delete content
        await service._delete_content(content_id, current_user["user_id"])
        
        return DeleteContentResponse(
            message="Help content deleted successfully",
            content_id=content_id
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete help content: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to delete help content: {str(e)}"
        )

@router.post("/search", response_model=HelpContentSearchResponse)
async def search_help_content(
    search_params: HelpContentSearch,
    current_user = Depends(get_current_user)
):
    """Search help content with vector similarity and filtering"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        service = get_help_content_service()
        results = await service.search_content(search_params)
        
        return results
        
    except Exception as e:
        logger.error(f"Failed to search help content: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to search help content: {str(e)}"
        )

@router.get("/{content_id}/versions", response_model=List[ContentVersion])
async def get_content_versions(
    content_id: UUID,
    current_user = Depends(get_current_user),
    _permission = Depends(require_permission(Permission.MANAGE_CONTENT))
):
    """Get version history for help content"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        service = get_help_content_service()
        versions = await service.get_content_versions(content_id)
        
        return versions
        
    except Exception as e:
        logger.error(f"Failed to get content versions: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to get content versions: {str(e)}"
        )

@router.post("/bulk-operation", response_model=BulkContentOperationResult)
async def bulk_update_content(
    operation: BulkContentOperation,
    current_user = Depends(get_current_user),
    _permission = Depends(require_permission(Permission.MANAGE_CONTENT))
):
    """Perform bulk operations on help content"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        service = get_help_content_service()
        result = await service.bulk_update_content(operation, current_user["user_id"])
        
        return result
        
    except Exception as e:
        logger.error(f"Failed to perform bulk operation: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to perform bulk operation: {str(e)}"
        )

@router.post("/regenerate-embeddings", response_model=RegenerateEmbeddingsResponse)
async def regenerate_embeddings(
    content_types: Optional[List[ContentType]] = Query(None),
    current_user = Depends(get_current_user),
    _permission = Depends(require_permission(Permission.MANAGE_CONTENT))
):
    """Regenerate embeddings for help content"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        service = get_help_content_service()
        result = await service.regenerate_embeddings(content_types)
        
        return RegenerateEmbeddingsResponse(
            message=f"Regenerated embeddings for {result['processed']} content items",
            processed=result['processed'],
            errors=result['errors']
        )
        
    except Exception as e:
        logger.error(f"Failed to regenerate embeddings: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to regenerate embeddings: {str(e)}"
        )

# Public endpoints for content consumption

@router.get("/public/search", response_model=HelpContentSearchResponse)
async def public_search_help_content(
    query: Optional[str] = Query(None),
    content_types: Optional[List[ContentType]] = Query(None),
    languages: Optional[List[Language]] = Query(None),
    tags: Optional[List[str]] = Query(None),
    limit: int = Query(default=10, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    current_user = Depends(get_current_user)
):
    """Public search endpoint for help content (only returns approved, active content)"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Force search to only return approved, active content
        search_params = HelpContentSearch(
            query=query,
            content_types=content_types,
            languages=languages,
            tags=tags,
            is_active=True,
            limit=limit,
            offset=offset
        )
        
        service = get_help_content_service()
        results = await service.search_content(search_params)
        
        # Filter results to only include approved content
        filtered_results = []
        for result in results.results:
            if result.content.review_status == ReviewStatus.approved and result.content.published_at:
                filtered_results.append(result)
        
        return HelpContentSearchResponse(
            results=filtered_results,
            total_count=len(filtered_results),
            has_more=results.has_more
        )
        
    except Exception as e:
        logger.error(f"Failed to search help content publicly: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to search help content: {str(e)}"
        )

@router.get("/public/{content_id}", response_model=HelpContent)
async def public_get_help_content(
    content_id: UUID,
    current_user = Depends(get_current_user)
):
    """Public endpoint to get help content (only returns approved, active content)"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        service = get_help_content_service()
        content = await service.get_content(content_id)
        
        if not content:
            raise HTTPException(status_code=404, detail="Help content not found")
        
        # Only return approved, active content
        if not content.is_active or content.review_status != ReviewStatus.approved or not content.published_at:
            raise HTTPException(status_code=404, detail="Help content not found")
        
        return content
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get help content publicly: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to get help content: {str(e)}"
        )

@router.get("/public/slug/{slug}", response_model=HelpContent)
async def public_get_help_content_by_slug(
    slug: str,
    language: Language = Language.en,
    current_user = Depends(get_current_user)
):
    """Public endpoint to get help content by slug (only returns approved, active content)"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        service = get_help_content_service()
        content = await service.get_content_by_slug(slug, language)
        
        if not content:
            raise HTTPException(status_code=404, detail="Help content not found")
        
        # Only return approved, active content
        if not content.is_active or content.review_status != ReviewStatus.approved or not content.published_at:
            raise HTTPException(status_code=404, detail="Help content not found")
        
        return content
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get help content by slug publicly: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to get help content by slug: {str(e)}"
        )