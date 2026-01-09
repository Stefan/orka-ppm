"""
Help Content Models
Pydantic models for help content management system
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID
from enum import Enum

class ContentType(str, Enum):
    guide = "guide"
    faq = "faq"
    feature_doc = "feature_doc"
    troubleshooting = "troubleshooting"
    tutorial = "tutorial"
    best_practice = "best_practice"

class ReviewStatus(str, Enum):
    draft = "draft"
    review = "review"
    approved = "approved"
    archived = "archived"

class Language(str, Enum):
    en = "en"
    de = "de"
    fr = "fr"

class HelpContentBase(BaseModel):
    """Base help content model"""
    content_type: ContentType
    title: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., min_length=1)
    tags: List[str] = Field(default_factory=list)
    language: Language = Language.en
    slug: Optional[str] = Field(None, max_length=255)
    meta_description: Optional[str] = Field(None, max_length=160)
    keywords: List[str] = Field(default_factory=list)
    
    @validator('slug')
    def validate_slug(cls, v):
        if v is not None:
            # Basic slug validation - alphanumeric and hyphens only
            import re
            if not re.match(r'^[a-z0-9-]+$', v):
                raise ValueError('Slug must contain only lowercase letters, numbers, and hyphens')
        return v
    
    @validator('tags', 'keywords')
    def validate_string_lists(cls, v):
        # Ensure all items in lists are strings and not empty
        return [item.strip() for item in v if item and item.strip()]

class HelpContentCreate(HelpContentBase):
    """Model for creating help content"""
    author_id: Optional[UUID] = None

class HelpContentUpdate(BaseModel):
    """Model for updating help content"""
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    content: Optional[str] = Field(None, min_length=1)
    tags: Optional[List[str]] = None
    slug: Optional[str] = Field(None, max_length=255)
    meta_description: Optional[str] = Field(None, max_length=160)
    keywords: Optional[List[str]] = None
    review_status: Optional[ReviewStatus] = None
    is_active: Optional[bool] = None
    
    @validator('slug')
    def validate_slug(cls, v):
        if v is not None:
            import re
            if not re.match(r'^[a-z0-9-]+$', v):
                raise ValueError('Slug must contain only lowercase letters, numbers, and hyphens')
        return v

class HelpContent(HelpContentBase):
    """Complete help content model"""
    id: UUID
    version: int = 1
    is_active: bool = True
    author_id: Optional[UUID] = None
    reviewer_id: Optional[UUID] = None
    review_status: ReviewStatus = ReviewStatus.draft
    created_at: datetime
    updated_at: datetime
    published_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class HelpContentWithMetrics(HelpContent):
    """Help content with engagement metrics"""
    unique_viewers: Optional[int] = 0
    total_views: Optional[int] = 0
    avg_rating: Optional[float] = None
    feedback_count: Optional[int] = 0

class HelpContentSearch(BaseModel):
    """Model for help content search parameters"""
    query: Optional[str] = None
    content_types: Optional[List[ContentType]] = None
    languages: Optional[List[Language]] = None
    tags: Optional[List[str]] = None
    review_status: Optional[List[ReviewStatus]] = None
    is_active: Optional[bool] = True
    limit: int = Field(default=10, ge=1, le=100)
    offset: int = Field(default=0, ge=0)

class HelpContentSearchResult(BaseModel):
    """Model for help content search results"""
    content: HelpContent
    similarity_score: Optional[float] = None
    relevance_score: Optional[float] = None

class HelpContentSearchResponse(BaseModel):
    """Model for help content search response"""
    results: List[HelpContentSearchResult]
    total_count: int
    has_more: bool

class ContentEmbedding(BaseModel):
    """Model for content embeddings"""
    content_id: UUID
    content_type: str
    content_text: str
    embedding: List[float]
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime

class ContentVersion(BaseModel):
    """Model for content versioning"""
    id: UUID
    content_id: UUID
    version_number: int
    title: str
    content: str
    changes_summary: Optional[str] = None
    created_by: Optional[UUID] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class BulkContentOperation(BaseModel):
    """Model for bulk content operations"""
    content_ids: List[UUID]
    operation: str  # 'activate', 'deactivate', 'archive', 'delete'
    reason: Optional[str] = None

class BulkContentOperationResult(BaseModel):
    """Model for bulk operation results"""
    successful_ids: List[UUID]
    failed_ids: List[UUID]
    errors: Dict[str, str]  # content_id -> error_message
    total_processed: int